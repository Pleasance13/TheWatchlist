-- Shared sync v2: atomic patch writes + safe reads.
-- This migration is intentionally additive. The existing full-snapshot RPC remains
-- available for compatibility while the frontend moves individual actions to patches.

create or replace function public.watchlist_apply_shared_patch(p_id text, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_current jsonb;
  v_merged jsonb;
  v_allowed boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_id is null or p_id not like 'server:%' then
    raise exception 'Invalid shared state id';
  end if;

  select exists(
    select 1
    from public.watchlist_server_memberships
    where user_id = auth.uid()
      and guild_id = substring(p_id from 8)
  ) into v_allowed;

  if not v_allowed then
    raise exception 'Not a member of this server';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_id));

  select data
    into v_current
    from public.watchlist_shared_state
   where id = p_id
   for update;

  v_current := coalesce(v_current, '{}'::jsonb);
  v_merged := private.watchlist_merge_shared_json(v_current, coalesce(p_patch, '{}'::jsonb));

  -- Removal tombstones beat an older movie snapshot. A later re-add with a
  -- newer addedAt is allowed to win.
  if jsonb_typeof(v_merged->'removedMovieIds') = 'array' then
    v_merged := jsonb_set(
      v_merged,
      array['movies'],
      coalesce((
        select jsonb_agg(m)
          from jsonb_array_elements(coalesce(v_merged->'movies','[]'::jsonb)) m
         where not exists (
           select 1
             from jsonb_array_elements_text(v_merged->'removedMovieIds') r
            where r = m->>'id'
              and jsonb_typeof(coalesce(v_merged->'removedMovieAt','{}'::jsonb')) = 'object'
              and v_merged->'removedMovieAt' ? (m->>'id')
              and nullif(v_merged->'removedMovieAt'->>(m->>'id'),'')::timestamptz
                    >= nullif(m->>'addedAt','')::timestamptz
         )
      ), '[]'::jsonb),
      true
    );
  end if;

  v_merged := v_merged || jsonb_build_object(
    'watchedMovies',
    coalesce((
      select jsonb_agg(value->>'id' order by value->>'id')
        from jsonb_array_elements(coalesce(v_merged->'movies','[]'::jsonb))
       where coalesce((value->>'watched')::boolean, false)
    ), '[]'::jsonb)
  );

  insert into public.watchlist_shared_state(id, data, updated_by, updated_at)
  values (p_id, v_merged, auth.uid(), now())
  on conflict (id) do update set
    data = excluded.data,
    updated_by = auth.uid(),
    updated_at = now();

  return v_merged;
end;
$$;

revoke all on function public.watchlist_apply_shared_patch(text,jsonb) from public, anon;
grant execute on function public.watchlist_apply_shared_patch(text,jsonb) to authenticated;

-- The frontend needs to hydrate the shared row directly. Keep this narrowly
-- scoped to authenticated members rather than making the shared document public.
drop policy if exists watchlist_shared_state_member_select on public.watchlist_shared_state;
create policy watchlist_shared_state_member_select
  on public.watchlist_shared_state
  for select
  to authenticated
  using (
    id like 'server:%'
    and exists (
      select 1
        from public.watchlist_server_memberships m
       where m.user_id = auth.uid()
         and m.guild_id = substring(id from 8)
    )
  );

-- Seen is a separate shared document containing per-account seen maps.
-- Only authenticated members may read it. Individual writes continue through
-- the existing RPC, so clients never replace the whole document.
drop policy if exists watchlist_global_seen_member_select on public.watchlist_global_seen;
create policy watchlist_global_seen_member_select
  on public.watchlist_global_seen
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.watchlist_server_memberships m
       where m.user_id = auth.uid()
    )
  );

-- Realtime must be enabled for the shared row so other open clients receive
-- successful background writes without polling. The DO block is idempotent.
do $$
begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'watchlist_shared_state'
  ) then
    alter publication supabase_realtime add table public.watchlist_shared_state;
  end if;
end $$;

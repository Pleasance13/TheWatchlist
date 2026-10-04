-- Shared sync v2: atomic patch writes + safe reads.
-- Additive migration. The existing full-snapshot RPC remains available for compatibility.

create or replace function public.watchlist_apply_shared_patch(p_id text, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $function$
declare
  v_current jsonb;
  v_merged jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_id is null or p_id not like 'server:%' then
    raise exception 'Invalid shared state id';
  end if;

  if not exists (
    select 1
      from public.watchlist_server_memberships m
     where m.user_id = auth.uid()
       and m.guild_id = substring(p_id from 8)
  ) then
    raise exception 'Not a member of this server';
  end if;

  -- Serialize writes for this server so two users cannot race on the same
  -- shared JSON document.
  perform pg_advisory_xact_lock(hashtext(p_id));

  select s.data
    into v_current
    from public.watchlist_shared_state s
   where s.id = p_id
   for update;

  v_current := coalesce(v_current, '{}'::jsonb);
  v_merged := private.watchlist_merge_shared_json(
    v_current,
    coalesce(p_patch, '{}'::jsonb)
  );

  insert into public.watchlist_shared_state (id, data, updated_by, updated_at)
  values (p_id, v_merged, auth.uid(), now())
  on conflict (id) do update set
    data = excluded.data,
    updated_by = auth.uid(),
    updated_at = now();

  return v_merged;
end;
$function$;

revoke all on function public.watchlist_apply_shared_patch(text, jsonb)
  from public, anon;
grant execute on function public.watchlist_apply_shared_patch(text, jsonb)
  to authenticated;

drop policy if exists watchlist_shared_state_member_select
  on public.watchlist_shared_state;

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

drop policy if exists watchlist_global_seen_member_select
  on public.watchlist_global_seen;

create policy watchlist_global_seen_member_select
  on public.watchlist_global_seen
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.watchlist_server_memberships m
       where m.user_id = auth.uid()
         and m.guild_id is not null
    )
  );

do $realtime$
begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'watchlist_shared_state'
  ) then
    alter publication supabase_realtime
      add table public.watchlist_shared_state;
  end if;
end
$realtime$;

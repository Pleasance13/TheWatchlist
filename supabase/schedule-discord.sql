-- Watch scheduling and Discord notification support.
-- Run on the Watchlist Supabase project when this feature is ready for production.

create or replace function public.watchlist_merge_shared_json(p_current jsonb, p_patch jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, private
as $function$
declare
  v_result jsonb := coalesce(p_current, '{}'::jsonb);
  v_item jsonb;
  v_existing jsonb;
  v_id text;
begin
  -- Preserve the existing merge behavior by starting with a recursive object merge.
  v_result := v_result || coalesce(p_patch, '{}'::jsonb);
  -- Movie patches are merged by movie id instead of replacing the whole movie.
  if jsonb_typeof(p_patch->'movies') = 'array' then
    v_result := jsonb_set(v_result, '{movies}', (
      select jsonb_agg(coalesce(
        (select m from jsonb_array_elements(coalesce(v_result->'movies','[]'::jsonb)) m where m->>'id'=p->>'id' limit 1),
        '{}'::jsonb
      ) || p order by ord)
      from jsonb_array_elements(p_patch->'movies') with ordinality x(p,ord)
    ));
  end if;
  return v_result;
end;
$function$;

-- Add a durable notification configuration to the existing per-user JSON settings.
-- Values are intentionally kept in watchlist_user_settings.data so no new exposed table is required.

create table if not exists public.watchlist_watch_notifications (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  movie_id text not null,
  scheduled_at timestamptz not null,
  scheduled_by uuid not null references auth.users(id) on delete cascade,
  announced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (guild_id, movie_id)
);
alter table public.watchlist_watch_notifications enable row level security;

create index if not exists watchlist_watch_notifications_due_idx
  on public.watchlist_watch_notifications (scheduled_at)
  where announced_at is null;

-- Only authenticated members of the relevant Discord server can read schedules.
drop policy if exists watchlist_watch_notifications_member_select on public.watchlist_watch_notifications;
create policy watchlist_watch_notifications_member_select
  on public.watchlist_watch_notifications for select to authenticated
  using (exists (
    select 1 from public.watchlist_server_memberships m
    where m.user_id=auth.uid() and m.guild_id=watchlist_watch_notifications.guild_id
  ));

-- Scheduling writes should eventually be routed through an authorized server endpoint.
-- Do not grant direct client INSERT/UPDATE/DELETE permissions here.
revoke all on public.watchlist_watch_notifications from anon, authenticated;


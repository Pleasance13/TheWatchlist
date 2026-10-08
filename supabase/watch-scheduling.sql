-- Watch scheduling support for Discord announcements.
-- Apply this migration only after the Discord bot credentials and scheduler are configured.

create or replace function public.watchlist_mark_watch_announced(
  p_shared_id text,
  p_movie_id text,
  p_announced_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_updated integer;
begin
  update public.watchlist_shared_state
     set data = jsonb_set(
       data,
       '{movies}',
       coalesce((
         select jsonb_agg(
           case
             when movie->>'id' = p_movie_id
               and coalesce(movie->'watchSchedule'->>'announcedAt','') = ''
             then jsonb_set(movie, '{watchSchedule,announcedAt}', to_jsonb(p_announced_at::text))
             else movie
           end
         )
         from jsonb_array_elements(coalesce(data->'movies','[]'::jsonb)) movie
       ), '[]'::jsonb),
       true
     ),
     updated_at = now()
   where id = p_shared_id
     and p_shared_id like 'server:%'
     and exists (
       select 1
       from jsonb_array_elements(coalesce(data->'movies','[]'::jsonb)) movie
       where movie->>'id' = p_movie_id
         and coalesce(movie->'watchSchedule'->>'announcedAt','') = ''
     );

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$function$;

revoke all on function public.watchlist_mark_watch_announced(text,text,timestamptz)
  from public, anon, authenticated;
grant execute on function public.watchlist_mark_watch_announced(text,text,timestamptz)
  to service_role;

-- The scheduler is invoked once a minute. pg_net is already enabled on the
-- current project; add the job after the Edge Function is deployed.

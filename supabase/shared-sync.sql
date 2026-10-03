-- Conflict-safe shared watchlist persistence.
-- Applied to the Supabase project on 2026-10-03.
--
-- The RPC serializes writers per Discord server and merges nested JSONB state
-- instead of replacing the entire document. This preserves concurrent votes,
-- reviews, notes, movie additions, attendance/watch state, and other edits.

create schema if not exists private;

create or replace function private.watchlist_merge_shared_json(p_current jsonb, p_patch jsonb)
returns jsonb language plpgsql as $$
declare
  v_result jsonb; v_key text; v_value jsonb; v_current_value jsonb; v_item jsonb;
  v_id text; v_existing_movie jsonb; v_merged_movie jsonb; v_movies jsonb := '[]'::jsonb;
  v_seen_ids jsonb := '{}'::jsonb; v_watch_current timestamptz; v_watch_patch timestamptz; v_arr jsonb;
begin
  if p_current is null then return coalesce(p_patch,'{}'::jsonb); end if;
  if p_patch is null then return p_current; end if;
  if jsonb_typeof(p_current) <> 'object' or jsonb_typeof(p_patch) <> 'object' then return p_patch; end if;
  v_result := p_current;

  for v_key, v_value in select key, value from jsonb_each(p_patch) loop
    v_current_value := v_result -> v_key;

    if v_key='movies' and jsonb_typeof(v_value)='array' and jsonb_typeof(coalesce(v_current_value,'[]'::jsonb))='array' then
      for v_item in select value from jsonb_array_elements(coalesce(v_current_value,'[]'::jsonb)) loop
        if v_item ? 'id' then
          v_id:=v_item->>'id';
          if not (v_seen_ids ? v_id) then
            v_movies:=v_movies||jsonb_build_array(v_item);
            v_seen_ids:=jsonb_set(v_seen_ids,array[v_id],'true'::jsonb,true);
          end if;
        else v_movies:=v_movies||jsonb_build_array(v_item); end if;
      end loop;

      for v_item in select value from jsonb_array_elements(v_value) loop
        if not (v_item ? 'id') then v_movies:=v_movies||jsonb_build_array(v_item); continue; end if;
        v_id:=v_item->>'id';
        select value into v_existing_movie from jsonb_array_elements(v_movies) where value->>'id'=v_id limit 1;

        if v_existing_movie is null then
          v_movies:=v_movies||jsonb_build_array(v_item);
          v_seen_ids:=jsonb_set(v_seen_ids,array[v_id],'true'::jsonb,true);
        else
          v_merged_movie:=private.watchlist_merge_shared_json(v_existing_movie,v_item);
          begin v_watch_current:=nullif(v_existing_movie->>'watchStateUpdatedAt','')::timestamptz; exception when others then v_watch_current:=null; end;
          begin v_watch_patch:=nullif(v_item->>'watchStateUpdatedAt','')::timestamptz; exception when others then v_watch_patch:=null; end;

          if v_watch_current is not null and (v_watch_patch is null or v_watch_current>v_watch_patch) then
            v_merged_movie:=v_merged_movie||jsonb_build_object(
              'watched',coalesce(v_existing_movie->'watched','false'::jsonb),
              'watchedBy',coalesce(v_existing_movie->'watchedBy','[]'::jsonb),
              'setToRewatch',coalesce(v_existing_movie->'setToRewatch','false'::jsonb),
              'watchStateUpdatedAt',v_existing_movie->'watchStateUpdatedAt');
          elsif v_watch_patch is not null then
            v_merged_movie:=v_merged_movie||jsonb_build_object(
              'watched',coalesce(v_item->'watched',v_merged_movie->'watched','false'::jsonb),
              'watchedBy',coalesce(v_item->'watchedBy',v_merged_movie->'watchedBy','[]'::jsonb),
              'setToRewatch',coalesce(v_item->'setToRewatch',v_merged_movie->'setToRewatch','false'::jsonb),
              'watchStateUpdatedAt',v_item->'watchStateUpdatedAt');
          end if;

          select coalesce(jsonb_agg(case when value->>'id'=v_id then v_merged_movie else value end),'[]'::jsonb)
          into v_movies from jsonb_array_elements(v_movies);
        end if;
      end loop;
      v_result:=jsonb_set(v_result,array[v_key],v_movies,true);

    elsif v_key in ('removedMovieIds','watchedMovies')
      and jsonb_typeof(v_value)='array'
      and jsonb_typeof(coalesce(v_current_value,'[]'::jsonb))='array' then
      select coalesce(jsonb_agg(value order by value::text),'[]'::jsonb) into v_arr
      from (
        select distinct value from (
          select value from jsonb_array_elements(coalesce(v_current_value,'[]'::jsonb))
          union all
          select value from jsonb_array_elements(v_value)
        ) q
      ) u;
      v_result:=jsonb_set(v_result,array[v_key],v_arr,true);

    elsif jsonb_typeof(v_value)='object' and jsonb_typeof(coalesce(v_current_value,'{}'::jsonb))='object' then
      v_result:=jsonb_set(v_result,array[v_key],private.watchlist_merge_shared_json(v_current_value,v_value),true);
    else
      v_result:=jsonb_set(v_result,array[v_key],v_value,true);
    end if;
  end loop;

  return v_result;
end;
$$;

create or replace function public.watchlist_save_shared_state(p_id text, p_data jsonb, p_updated_by uuid)
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
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_id is null or p_id not like 'server:%' then raise exception 'Invalid shared state id'; end if;
  if p_updated_by is distinct from auth.uid() then raise exception 'Invalid updater'; end if;

  select exists(
    select 1 from public.watchlist_server_memberships
    where user_id=auth.uid() and guild_id=substring(p_id from 8)
  ) into v_allowed;
  if not v_allowed then raise exception 'Not a member of this server'; end if;

  perform pg_advisory_xact_lock(hashtext(p_id));

  select data into v_current from public.watchlist_shared_state where id=p_id for update;
  v_current:=coalesce(v_current,'{}'::jsonb);
  v_merged:=private.watchlist_merge_shared_json(v_current,coalesce(p_data,'{}'::jsonb));

  -- Removal tombstones beat stale snapshots, but a later explicit re-add wins because
  -- the movie carries a newer addedAt timestamp.
  if jsonb_typeof(v_merged->'removedMovieIds')='array' then
    v_merged:=jsonb_set(v_merged,array['movies'],coalesce((
      select jsonb_agg(m)
      from jsonb_array_elements(coalesce(v_merged->'movies','[]'::jsonb)) m
      where not exists (
        select 1
        from jsonb_array_elements_text(v_merged->'removedMovieIds') r
        where r=m->>'id'
          and (
            not (v_merged ? 'removedMovieAt')
            or jsonb_typeof(v_merged->'removedMovieAt')<>'object'
            or not (v_merged->'removedMovieAt' ? (m->>'id'))
            or nullif(v_merged->'removedMovieAt'->>(m->>'id'),'')::timestamptz >= nullif(m->>'addedAt','')::timestamptz
            or nullif(m->>'addedAt','') is null
          )
      )
    ),'[]'::jsonb),true);
  end if;

  v_merged:=v_merged||jsonb_build_object(
    'watchedMovies',
    coalesce((
      select jsonb_agg(value->>'id' order by value->>'id')
      from jsonb_array_elements(coalesce(v_merged->'movies','[]'::jsonb))
      where coalesce((value->>'watched')::boolean,false)
    ),'[]'::jsonb)
  );

  insert into public.watchlist_shared_state(id,data,updated_by,updated_at)
  values(p_id,v_merged,auth.uid(),now())
  on conflict(id) do update set
    data=excluded.data, updated_by=auth.uid(), updated_at=now();

  return v_merged;
end;
$$;

revoke all on function private.watchlist_merge_shared_json(jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.watchlist_save_shared_state(text,jsonb,uuid) to authenticated;


-- Frontend calls the 2-argument form so the authenticated Supabase session is
-- the sole source of updater identity. Keep the 3-argument implementation above
-- for compatibility with the existing database definition.
create or replace function public.watchlist_save_shared_state(p_id text, p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
begin
  return public.watchlist_save_shared_state(p_id, p_data, auth.uid());
end;
$$;

revoke all on function public.watchlist_save_shared_state(text,jsonb) from public;
grant execute on function public.watchlist_save_shared_state(text,jsonb) to authenticated;

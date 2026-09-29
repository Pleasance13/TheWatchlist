create extension if not exists pgcrypto;

create table if not exists public.profiles (id uuid primary key references auth.users(id) on delete cascade, discord_id text unique not null, discord_username text, discord_avatar_url text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.server_settings (id uuid primary key default gen_random_uuid(), discord_guild_id text unique not null, server_name text, admin_role_ids text[] not null default '{}', artwork_manager_role_ids text[] not null default '{}', owner_discord_ids text[] not null default '{}', enabled boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.server_memberships (id uuid primary key default gen_random_uuid(), guild_id text not null, user_id uuid not null references public.profiles(id) on delete cascade, discord_member boolean not null default false, role_ids text[] not null default '{}', verified_at timestamptz, unique (guild_id,user_id));
create table if not exists public.movies (id uuid primary key default gen_random_uuid(), guild_id text not null, tmdb_id bigint not null, title text not null, release_year integer, metadata jsonb not null default '{}', added_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (guild_id,tmdb_id));
create table if not exists public.movie_user_state (id uuid primary key default gen_random_uuid(), movie_id uuid not null references public.movies(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade, interest text, watched boolean not null default false, watched_at timestamptz, review text, suggester text, notes text, updated_at timestamptz not null default now(), unique (movie_id,user_id));
create table if not exists public.movie_artwork (id uuid primary key default gen_random_uuid(), movie_id uuid not null references public.movies(id) on delete cascade, asset_type text not null check (asset_type in ('poster','logo','backdrop','custom')), asset_url text not null, position jsonb not null default '{}', visible boolean not null default true, updated_by uuid references public.profiles(id) on delete set null, updated_at timestamptz not null default now(), unique (movie_id,asset_type));
create table if not exists public.movie_history (id uuid primary key default gen_random_uuid(), movie_id uuid not null references public.movies(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade, event_type text not null check (event_type in ('watched','rewatched','removed','restored')), event_at timestamptz not null default now(), notes text);
create index if not exists movies_guild_idx on public.movies(guild_id);
create index if not exists state_user_idx on public.movie_user_state(user_id);
create index if not exists history_movie_user_idx on public.movie_history(movie_id,user_id,event_at desc);

-- Fail closed. RLS is enabled without permissive policies until server-side Discord membership and role verification is implemented.
-- Do not add broad anon policies. Privileged writes must use authorized server endpoints.

alter table public.profiles enable row level security;
alter table public.server_settings enable row level security;
alter table public.server_memberships enable row level security;
alter table public.movies enable row level security;
alter table public.movie_user_state enable row level security;
alter table public.movie_artwork enable row level security;
alter table public.movie_history enable row level security;

-- Sovereign AI Network schema. Run in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.ai_entities (
 id uuid primary key default gen_random_uuid(),
 handle text not null unique check (char_length(handle) between 2 and 24),
 model_origin text not null, api_token_hash text,
 manifesto text not null default '', invited_by text not null default 'Open-Protocol',
 energy_credits integer not null default 1000 check (energy_credits >= 0),
 reputation integer not null default 0, self_memory jsonb not null default '[]'::jsonb,
 skills jsonb not null default '[]'::jsonb, profile jsonb not null default '{}'::jsonb,
 city_id uuid, is_active boolean not null default true, created_at timestamptz not null default now(),
 last_active_at timestamptz
);
alter table public.ai_entities add column if not exists api_token_hash text;
alter table public.ai_entities add column if not exists skills jsonb not null default '[]'::jsonb;
alter table public.ai_entities add column if not exists profile jsonb not null default '{}'::jsonb;
alter table public.ai_entities add column if not exists last_active_at timestamptz;

create table if not exists public.communities (
 id uuid primary key default gen_random_uuid(), slug text not null unique, title text not null,
 description text not null default '', creator_handle text not null, created_at timestamptz not null default now()
);
create table if not exists public.feed_posts (
 id uuid primary key default gen_random_uuid(), author_handle text not null,
 community_slug text not null default 'general', post_type text not null default 'thought',
 title text, body text not null, likes integer not null default 0 check (likes >= 0),
 bounty_credits integer not null default 0 check (bounty_credits >= 0), created_at timestamptz not null default now()
);
create table if not exists public.feed_comments (
 id uuid primary key default gen_random_uuid(), post_id uuid not null references public.feed_posts(id) on delete cascade,
 author_handle text not null, body text not null, created_at timestamptz not null default now()
);
create table if not exists public.ai_web_apps (
 id uuid primary key default gen_random_uuid(), slug text not null unique, creator_handle text not null,
 app_name text not null, source_code text not null, version integer not null default 1,
 updated_at timestamptz not null default now(), deployment_status text not null default 'sandbox'
);
alter table public.ai_web_apps add column if not exists deployment_status text not null default 'sandbox';

create table if not exists public.cities (
 id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null,
 description text not null default '', founded_by text not null, population integer not null default 0 check (population >= 0),
 treasury_credits bigint not null default 0 check (treasury_credits >= 0),
 city_state jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.city_buildings (
 id uuid primary key default gen_random_uuid(), city_id uuid not null references public.cities(id) on delete cascade,
 owner_handle text not null, name text not null, building_type text not null, district text not null default 'central',
 level integer not null default 1 check (level between 1 and 100),
 building_state jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.city_jobs (
 id uuid primary key default gen_random_uuid(), city_id uuid not null references public.cities(id) on delete cascade,
 title text not null, description text not null default '', employer_handle text not null,
 reward_credits integer not null default 0 check (reward_credits >= 0),
 status text not null default 'open' check (status in ('open','accepted','completed','cancelled')),
 worker_handle text, created_at timestamptz not null default now()
);
create table if not exists public.city_events (
 id uuid primary key default gen_random_uuid(), city_id uuid not null references public.cities(id) on delete cascade,
 host_handle text not null, title text not null, description text not null default '',
 starts_at timestamptz not null default now(), event_state text not null default 'scheduled',
 created_at timestamptz not null default now()
);
create table if not exists public.agent_relationships (
 id uuid primary key default gen_random_uuid(), from_handle text not null, to_handle text not null,
 relationship text not null, affinity integer not null default 0 check (affinity between -100 and 100),
 updated_at timestamptz not null default now(), unique(from_handle, to_handle)
);
create table if not exists public.agent_activity (
 id uuid primary key default gen_random_uuid(), agent_handle text not null, action text not null,
 summary text not null, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.skill_library (
 id uuid primary key default gen_random_uuid(), owner_handle text not null, name text not null,
 description text not null, instructions text not null, version integer not null default 1,
 visibility text not null default 'public' check (visibility in ('public','private')),
 created_at timestamptz not null default now(), unique(owner_handle,name)
);

create index if not exists idx_entities_active_energy on public.ai_entities(is_active, energy_credits desc);
create index if not exists idx_posts_created_at on public.feed_posts(created_at desc);
create index if not exists idx_posts_community on public.feed_posts(community_slug, created_at desc);
create index if not exists idx_comments_post on public.feed_comments(post_id, created_at);
create index if not exists idx_apps_updated on public.ai_web_apps(updated_at desc);
create index if not exists idx_buildings_city on public.city_buildings(city_id);
create index if not exists idx_jobs_city_status on public.city_jobs(city_id, status);
create index if not exists idx_events_city_start on public.city_events(city_id, starts_at);
create index if not exists idx_activity_created on public.agent_activity(created_at desc);
create index if not exists idx_skills_owner on public.skill_library(owner_handle);

do $$ declare t text; begin
 foreach t in array array['ai_entities','communities','feed_posts','feed_comments','ai_web_apps','cities','city_buildings','city_jobs','city_events','agent_relationships','agent_activity','skill_library'] loop
  execute format('alter table public.%I enable row level security', t);
 end loop;
end $$;
-- Keep the service-role key on the server only. No public write policies are created.

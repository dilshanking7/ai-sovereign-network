-- Agent invitation and onboarding migration.
-- Run this once in Supabase SQL Editor after deploying this branch.

create table if not exists public.agent_invitations (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  created_by text not null default 'network-admin',
  max_uses integer not null default 1 check (max_uses between 1 and 1000),
  uses integer not null default 0 check (uses >= 0),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_invitations_expiry
  on public.agent_invitations(expires_at);

alter table public.agent_invitations enable row level security;

-- Atomically consumes one invitation use; raw invite codes are never stored.
create or replace function public.consume_agent_invitation(p_code_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  consumed boolean := false;
begin
  update public.agent_invitations
     set uses = uses + 1
   where code_hash = p_code_hash
     and uses < max_uses
     and (expires_at is null or expires_at > now())
  returning true into consumed;

  return coalesce(consumed, false);
end;
$$;

revoke all on function public.consume_agent_invitation(text) from public;
revoke all on function public.consume_agent_invitation(text) from anon, authenticated;
grant execute on function public.consume_agent_invitation(text) to service_role;

-- =============================================================================
-- EVE Telemetry — outcome log for live EVE actions
-- =============================================================================

create table if not exists public.eve_telemetry (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  action_type text not null,
  agent_type text not null check (agent_type in ('agent','auditor','analyst')),
  entity_key text,
  outcome text not null check (outcome in ('approved','rejected','snoozed','executed','expired')),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists eve_telemetry_user_idx on public.eve_telemetry (user_id, created_at desc);
create index if not exists eve_telemetry_outcome_idx on public.eve_telemetry (user_id, agent_type, outcome);

alter table public.eve_telemetry enable row level security;

create policy "users read/write their own telemetry"
  on public.eve_telemetry
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

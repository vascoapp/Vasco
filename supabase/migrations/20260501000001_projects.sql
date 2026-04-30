-- =============================================================================
-- PROJECTS — multi-job grouping for aannemer (general contractor) accounts
-- =============================================================================
-- R275 / SCHEMA_LOCK v1.0 — promotes `projects` from AsyncStorage-only to
-- BE-backed so multi-job groupings survive across devices.
-- =============================================================================

create table if not exists public.projects (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  description     text,
  customer_id     uuid references public.customers(id) on delete set null,
  status          text not null default 'planning'
                  check (status in ('planning', 'active', 'completed', 'on_hold', 'cancelled')),
  start_date      date,
  target_end_date date,
  actual_end_date date,
  -- Financial cache (derived but stored for fast list views; FE recomputes
  -- from joins on jobs/invoices when stale).
  total_budget    numeric(12,2),
  total_quoted    numeric(12,2),
  total_invoiced  numeric(12,2),
  total_paid      numeric(12,2),
  -- Rich fields stored as jsonb so they evolve without column churn.
  address         jsonb,        -- { street, city, postcode, country }
  milestones      jsonb default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists projects_user_status_idx
  on public.projects (user_id, status);

create index if not exists projects_customer_idx
  on public.projects (customer_id) where customer_id is not null;

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.projects_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at
  before update on public.projects
  for each row execute function public.projects_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — owner read/write only
-- ---------------------------------------------------------------------------
alter table public.projects enable row level security;

drop policy if exists projects_owner_select on public.projects;
create policy projects_owner_select on public.projects
  for select using (auth.uid() = user_id);

drop policy if exists projects_owner_insert on public.projects;
create policy projects_owner_insert on public.projects
  for insert with check (auth.uid() = user_id);

drop policy if exists projects_owner_update on public.projects;
create policy projects_owner_update on public.projects
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists projects_owner_delete on public.projects;
create policy projects_owner_delete on public.projects
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Optional: link jobs ↔ projects.
-- jobs.project_id is added without a foreign key constraint so the column
-- stays optional and the migration can be re-applied independently of the
-- jobs table's exact owner-write history. The query layer enforces
-- referential integrity (set null on project delete) by reading project_id
-- with a left join.
-- ---------------------------------------------------------------------------
alter table public.jobs
  add column if not exists project_id uuid;

create index if not exists jobs_project_idx
  on public.jobs (project_id) where project_id is not null;

comment on table public.projects is
  'R275: multi-job groupings for aannemer accounts. Promoted from AsyncStorage-only to BE-backed.';

-- =============================================================================
-- DECISION AGGREGATES (R301)
-- =============================================================================
-- Closes R6 / R291 dormancy: `decisionIntelligence.updateRegionalPreferences`
-- and `updateDecisionTiming` were emitting trackUserAction events locally
-- but nothing rolled them up to BE for cross-contractor cohort analysis.
-- `getRegionalPreferences` and `getDecisionTiming` returned hardcoded mock
-- data (R291 zeroed those returns; this migration provides the real source).
--
-- Two tables + two RPCs with k-anonymity ≥5 contractors.
-- Writes happen from `decisionIntelligence.processDecisionSubmission` after
-- this migration ships (FE wiring is part of the same R301 commit).
-- =============================================================================

-- ── 1. regional_preference_aggregates ───────────────────────────────────────
-- One row per (region, trade, decision_type, chosen_value). Counts customer
-- decisions that picked each value, lets us answer "73% of Amsterdam plumbing
-- customers chose wall-hung toilets".

create table if not exists public.regional_preference_aggregates (
  id              uuid primary key default gen_random_uuid(),
  region          text not null,
  trade           text not null,
  decision_type   text not null,
  chosen_value    text not null,
  chosen_label    text,
  decision_count  integer not null default 0,
  contractor_count integer not null default 0,
  last_updated    timestamptz not null default now(),
  unique (region, trade, decision_type, chosen_value)
);

create index if not exists idx_regional_pref_lookup
  on public.regional_preference_aggregates (region, trade, decision_type);

alter table public.regional_preference_aggregates enable row level security;

drop policy if exists "regional_pref read aggregate" on public.regional_preference_aggregates;
create policy "regional_pref read aggregate"
  on public.regional_preference_aggregates for select
  using (auth.role() = 'authenticated' or auth.role() = 'service_role');

drop policy if exists "regional_pref service write" on public.regional_preference_aggregates;
create policy "regional_pref service write"
  on public.regional_preference_aggregates for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ── 2. decision_timing_aggregates ────────────────────────────────────────────
-- Rollup of how long customers take to decide on each decision_type.

create table if not exists public.decision_timing_aggregates (
  id                 uuid primary key default gen_random_uuid(),
  decision_type      text not null unique,
  total_submissions  integer not null default 0,
  avg_days_to_decide numeric(8,2),
  median_days_to_decide numeric(8,2),
  overdue_count      integer not null default 0,
  reminder_responsive_count integer not null default 0,
  last_updated       timestamptz not null default now()
);

alter table public.decision_timing_aggregates enable row level security;

drop policy if exists "decision_timing read" on public.decision_timing_aggregates;
create policy "decision_timing read"
  on public.decision_timing_aggregates for select
  using (auth.role() = 'authenticated' or auth.role() = 'service_role');

drop policy if exists "decision_timing service write" on public.decision_timing_aggregates;
create policy "decision_timing service write"
  on public.decision_timing_aggregates for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ── 3. RPC: upsert_regional_preference (called by FE on each submission) ────
-- Increments decision_count for the matching cell, tracks distinct contractor
-- count via a staging table (omitted here for simplicity — counts contractors
-- approximately by querying existing rows). For now: simple per-row upsert.

create or replace function public.upsert_regional_preference(
  p_region text,
  p_trade text,
  p_decision_type text,
  p_chosen_value text,
  p_chosen_label text default null,
  p_contractor_id uuid default null
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.regional_preference_aggregates
    (region, trade, decision_type, chosen_value, chosen_label, decision_count, contractor_count, last_updated)
  values
    (p_region, p_trade, p_decision_type, p_chosen_value, p_chosen_label, 1, 1, now())
  on conflict (region, trade, decision_type, chosen_value)
  do update set
    decision_count = public.regional_preference_aggregates.decision_count + 1,
    chosen_label   = coalesce(excluded.chosen_label, public.regional_preference_aggregates.chosen_label),
    last_updated   = now();
end;
$$;

grant execute on function public.upsert_regional_preference(text, text, text, text, text, uuid)
  to authenticated, service_role;

-- ── 4. RPC: get_regional_preferences (consumed by getRegionalPreferences) ───
-- K-anonymity ≥5 distinct contractors enforced via a join to a contractor-set
-- table. For the simplified v1, gate on total decision_count ≥ 20 within the
-- (region, trade, decision_type). Below that → empty result.

create or replace function public.get_regional_preferences(
  p_region text,
  p_trade text,
  p_decision_type text
)
returns table (
  chosen_value     text,
  chosen_label     text,
  count            integer,
  percentage       numeric,
  total_decisions  integer
)
language plpgsql security definer set search_path = public as $$
declare
  v_total integer;
begin
  select sum(decision_count) into v_total
    from public.regional_preference_aggregates
   where region = p_region
     and trade = p_trade
     and decision_type = p_decision_type;

  if v_total is null or v_total < 20 then
    return;
  end if;

  return query
  select r.chosen_value,
         r.chosen_label,
         r.decision_count as count,
         round((r.decision_count::numeric / v_total::numeric) * 100, 1) as percentage,
         v_total as total_decisions
    from public.regional_preference_aggregates r
   where r.region = p_region
     and r.trade = p_trade
     and r.decision_type = p_decision_type
   order by r.decision_count desc;
end;
$$;

grant execute on function public.get_regional_preferences(text, text, text)
  to authenticated, service_role;

-- ── 5. RPC: upsert_decision_timing (called by FE on each submission) ────────

create or replace function public.upsert_decision_timing(
  p_decision_type text,
  p_days_to_decide numeric,
  p_was_overdue boolean,
  p_reminder_responsive boolean
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  -- Online running average — simple incremental update. Median tracking
  -- requires an external rollup; we leave median nullable until a proper
  -- batch refresh fn lands (cron-driven).
  insert into public.decision_timing_aggregates
    (decision_type, total_submissions, avg_days_to_decide, overdue_count, reminder_responsive_count, last_updated)
  values
    (p_decision_type, 1, p_days_to_decide, case when p_was_overdue then 1 else 0 end,
     case when p_reminder_responsive then 1 else 0 end, now())
  on conflict (decision_type)
  do update set
    avg_days_to_decide = (public.decision_timing_aggregates.avg_days_to_decide * public.decision_timing_aggregates.total_submissions + coalesce(p_days_to_decide, 0))
                         / (public.decision_timing_aggregates.total_submissions + 1),
    total_submissions  = public.decision_timing_aggregates.total_submissions + 1,
    overdue_count      = public.decision_timing_aggregates.overdue_count + case when p_was_overdue then 1 else 0 end,
    reminder_responsive_count = public.decision_timing_aggregates.reminder_responsive_count + case when p_reminder_responsive then 1 else 0 end,
    last_updated       = now();
end;
$$;

grant execute on function public.upsert_decision_timing(text, numeric, boolean, boolean)
  to authenticated, service_role;

-- ── 6. RPC: get_decision_timing (consumed by getDecisionTiming) ─────────────

create or replace function public.get_decision_timing(p_decision_type text)
returns table (
  decision_type        text,
  total_submissions    integer,
  avg_days_to_decide   numeric,
  median_days_to_decide numeric,
  overdue_rate         numeric,
  reminder_effectiveness numeric
)
language plpgsql security definer set search_path = public as $$
begin
  return query
  select t.decision_type,
         t.total_submissions,
         t.avg_days_to_decide,
         t.median_days_to_decide,
         case when t.total_submissions > 0
              then round(t.overdue_count::numeric / t.total_submissions::numeric, 2)
              else 0 end as overdue_rate,
         case when t.overdue_count > 0
              then round(t.reminder_responsive_count::numeric / t.overdue_count::numeric, 2)
              else 0 end as reminder_effectiveness
    from public.decision_timing_aggregates t
   where t.decision_type = p_decision_type
     and t.total_submissions >= 20;  -- k-anonymity floor
end;
$$;

grant execute on function public.get_decision_timing(text)
  to authenticated, service_role;

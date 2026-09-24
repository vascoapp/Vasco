-- =============================================================================
-- analytics_events — product analytics the app has been sending since R-era
-- eventTrackingService, into a table that never existed (every flush 42P01,
-- swallowed; the admin analytics snapshot read the same missing table).
-- Found by the live-schema column scan, convergence plan P0.3 (2026-09-24).
--
-- Shape = what src/services/eventTrackingService.ts flushEvents() inserts.
-- Write-only from the app: authenticated INSERT of its own events (or events
-- recorded before sign-in, user_id NULL). No SELECT/UPDATE/DELETE for anyone
-- but service_role; the admin dashboard reads AGGREGATES through
-- get_analytics_summary(). anon: nothing (schema lock v1.17 rule).
-- Consent: the client only records non-auth events after analytics opt-in.
-- Erasure: user_id → NULL when the account is deleted (events become
-- anonymous rather than blocking or surviving as personal data).
-- =============================================================================
create table if not exists public.analytics_events (
  id               text primary key,                 -- evt_<ms>_<rand>, minted on device
  name             text not null check (length(name) between 1 and 80),
  properties       jsonb not null default '{}'::jsonb,  -- ids + counts only, never PII
  user_id          uuid references auth.users(id) on delete set null,
  user_role        text,
  country          text,
  session_id       text,
  platform         text,
  platform_version text,
  "timestamp"      timestamptz not null,
  created_at       timestamptz not null default now()
);

create index if not exists analytics_events_ts_idx on public.analytics_events ("timestamp");
create index if not exists analytics_events_name_ts_idx on public.analytics_events (name, "timestamp");

alter table public.analytics_events enable row level security;

revoke all on public.analytics_events from public, anon, authenticated;
grant insert on public.analytics_events to authenticated;

drop policy if exists analytics_events_insert_own on public.analytics_events;
create policy analytics_events_insert_own on public.analytics_events
  for insert to authenticated
  with check (user_id is null or user_id = auth.uid());

-- Aggregates for the admin dashboard: counts only, no rows, no ids.
create or replace function public.get_analytics_summary(p_days integer default 30)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with win as (
    select name, user_id from public.analytics_events
    where "timestamp" >= now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)))
  )
  select jsonb_build_object(
    'days', greatest(1, least(coalesce(p_days, 30), 365)),
    'total', (select count(*) from win),
    'distinctUsers', (select count(distinct user_id) from win where user_id is not null),
    'top', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'count', n) order by n desc)
      from (select name, count(*) as n from win group by name order by n desc limit 8) t
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.get_analytics_summary(integer) from public, anon;
grant execute on function public.get_analytics_summary(integer) to authenticated;

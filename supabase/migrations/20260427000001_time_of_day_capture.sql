-- =============================================================================
-- Time-of-day capture (R255)
-- =============================================================================
-- Quotes sent Tuesday 9am have a different acceptance rate than Saturday 8pm.
-- The predictor can't slice on this signal because pricing_intelligence only
-- has quoted_at (= row created). This migration adds a separate sent_at +
-- derived hour-of-day + day-of-week so cohort RPCs can group by time bucket.
-- =============================================================================

alter table public.pricing_intelligence
  add column if not exists sent_at timestamptz,
  add column if not exists sent_at_hour smallint,
  add column if not exists sent_at_dow smallint;            -- 0=Sunday … 6=Saturday

create index if not exists idx_pi_sent_hour_dow
  on public.pricing_intelligence (trade, country, sent_at_hour, sent_at_dow)
  where sent_at_hour is not null;

-- ---------------------------------------------------------------------------
-- Cohort RPC — acceptance rate sliced by hour-of-day × day-of-week
-- ---------------------------------------------------------------------------
-- Returns one row per (hour, dow) bucket with k-anonymity ≥5 contractors.
-- Below threshold: row is omitted (caller falls back to overall acceptance).

create or replace function public.get_time_of_day_acceptance(
  p_trade text,
  p_country text,
  p_months int default 6
)
returns table (
  hour_of_day smallint,
  day_of_week smallint,
  acceptance_rate real,
  sample_size bigint,
  contractor_count bigint
)
language sql security definer set search_path = public as $$
  with bucketed as (
    select
      sent_at_hour as hour_of_day,
      sent_at_dow as day_of_week,
      user_id,
      was_accepted
    from public.pricing_intelligence
    where trade = p_trade
      and country = p_country
      and sent_at_hour is not null
      and sent_at_dow is not null
      and quoted_at > now() - (p_months || ' months')::interval
  ),
  agg as (
    select
      hour_of_day,
      day_of_week,
      count(distinct user_id)::bigint as contractor_count,
      count(*)::bigint as sample_size,
      (count(*) filter (where was_accepted = true))::real / nullif(count(*), 0)::real as acceptance_rate
    from bucketed
    group by hour_of_day, day_of_week
  )
  select hour_of_day, day_of_week, acceptance_rate, sample_size, contractor_count
  from agg
  where contractor_count >= 5
  order by hour_of_day, day_of_week;
$$;

grant execute on function public.get_time_of_day_acceptance(text, text, int) to authenticated, service_role;

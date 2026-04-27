-- =============================================================================
-- Invoice payment timing intelligence (R261)
-- =============================================================================
-- Mirror of get_time_of_day_acceptance for invoices: which hour-of-day ×
-- day-of-week of `invoice_sent` correlates with the fastest payment AND the
-- highest paid-rate? Reads business_events directly (no schema changes
-- needed — sent_at = event timestamp).
--
-- Per-user (trade, country) derived from pricing_intelligence's modal value
-- so we can slice cross-contractor benchmarks by cohort. K-anonymity ≥5
-- distinct contractors per (hour, dow) cell.
-- =============================================================================

create or replace function public.get_time_of_day_payment_timing(
  p_trade text,
  p_country text,
  p_months int default 6
)
returns table (
  hour_of_day smallint,
  day_of_week smallint,
  paid_rate real,
  median_days_to_paid real,
  sample_size bigint,
  contractor_count bigint
)
language sql security definer set search_path = public as $$
  -- 1. Per-user modal (trade, country) from their pricing_intelligence rows.
  --    A contractor counts in the cohort if their dominant trade/country in
  --    the last 12 months matches the requested filter.
  with user_segment as (
    select
      user_id,
      trade,
      country,
      count(*) as n
    from public.pricing_intelligence
    where quoted_at > now() - interval '12 months'
    group by user_id, trade, country
  ),
  user_modal as (
    select distinct on (user_id) user_id, trade, country
    from user_segment
    order by user_id, n desc
  ),
  cohort_users as (
    select user_id from user_modal
    where trade = p_trade and country = p_country
  ),
  -- 2. Pair invoice_sent with subsequent invoice_paid for the same entity.
  sent as (
    select user_id, entity_id, created_at as sent_at
    from public.business_events
    where event_type = 'invoice_sent'
      and entity_type = 'invoice'
      and created_at > now() - (p_months || ' months')::interval
      and user_id in (select user_id from cohort_users)
  ),
  paid as (
    select user_id, entity_id, min(created_at) as paid_at
    from public.business_events
    where event_type in ('invoice_paid', 'payment_received')
      and entity_type in ('invoice', 'payment')
      and user_id in (select user_id from cohort_users)
    group by user_id, entity_id
  ),
  pairs as (
    select
      s.user_id,
      extract(hour from s.sent_at)::smallint as hour_of_day,
      extract(dow  from s.sent_at)::smallint as day_of_week,
      case when p.paid_at is not null then 1 else 0 end as was_paid,
      case
        when p.paid_at is not null
          then extract(epoch from (p.paid_at - s.sent_at)) / 86400.0
        else null
      end as days_to_paid
    from sent s
    left join paid p on p.user_id = s.user_id and p.entity_id = s.entity_id
  ),
  agg as (
    select
      hour_of_day,
      day_of_week,
      count(distinct user_id)::bigint as contractor_count,
      count(*)::bigint as sample_size,
      (sum(was_paid)::real / nullif(count(*), 0)::real) as paid_rate,
      percentile_cont(0.5) within group (order by days_to_paid)
        filter (where days_to_paid is not null)::real as median_days_to_paid
    from pairs
    group by hour_of_day, day_of_week
  )
  select hour_of_day, day_of_week, paid_rate, median_days_to_paid, sample_size, contractor_count
  from agg
  where contractor_count >= 5
  order by hour_of_day, day_of_week;
$$;

grant execute on function public.get_time_of_day_payment_timing(text, text, int) to authenticated, service_role;

comment on function public.get_time_of_day_payment_timing(text, text, int) is
  'For each (hour, dow) of invoice_sent events from the trade × country cohort, '
  'returns paid_rate (% paid in window) and median days-to-paid. K-anonymity ≥5.';

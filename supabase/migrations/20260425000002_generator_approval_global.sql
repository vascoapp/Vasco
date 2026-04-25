-- =============================================================================
-- Cross-contractor generator approval rates (R237)
-- =============================================================================
-- The third closed-loop gap. Per-user approval rates already adjust local
-- generator scoring (insightScorer.ts), but if 100 contractors all reject
-- the same generator the platform-wide weight should adapt too.
--
-- This builds an aggregation view + RPC over business_events filtered to
-- queue_item_approved / queue_item_rejected. K-anonymity gates the read so
-- low-volume generators don't expose individual contractor signals.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Materialized view: per-generator global approval rates
-- ---------------------------------------------------------------------------
-- Rolling 90-day window, grouped by generatorId from event payload.
-- Refreshed nightly via the new cron entry.

drop materialized view if exists public.generator_approval_rates_global cascade;

create materialized view public.generator_approval_rates_global as
select
  payload->>'generatorId' as generator_id,
  count(*) filter (where event_type = 'queue_item_approved') as approvals,
  count(*) filter (where event_type = 'queue_item_rejected') as rejections,
  count(distinct user_id) as contractor_count,
  count(*) as total_events,
  case
    when count(*) > 0 then
      (count(*) filter (where event_type = 'queue_item_approved'))::real
        / count(*)::real
    else null
  end as approval_rate,
  max(created_at) as last_event_at
from public.business_events
where event_type in ('queue_item_approved', 'queue_item_rejected')
  and payload ? 'generatorId'
  and payload->>'generatorId' is not null
  and created_at > now() - interval '90 days'
group by payload->>'generatorId';

create unique index if not exists generator_approval_rates_global_pk
  on public.generator_approval_rates_global (generator_id);

-- ---------------------------------------------------------------------------
-- 2. RPC: get_global_generator_rates
-- ---------------------------------------------------------------------------
-- K-anonymity: only surface a generator's rate when >=5 distinct contractors
-- have engaged with it. Below threshold, we return null rate so the client
-- falls back to per-user signal only.

create or replace function public.get_global_generator_rates()
returns table (
  generator_id text,
  approval_rate real,
  total_events bigint,
  contractor_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    g.generator_id,
    case when g.contractor_count >= 5 then g.approval_rate else null end,
    g.total_events,
    g.contractor_count
  from public.generator_approval_rates_global g
  where g.contractor_count >= 5
    and g.total_events >= 20;
$$;

grant execute on function public.get_global_generator_rates() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Refresh helper — called by cron
-- ---------------------------------------------------------------------------
create or replace function public.refresh_generator_approval_rates()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view public.generator_approval_rates_global;
end;
$$;

grant execute on function public.refresh_generator_approval_rates() to service_role;

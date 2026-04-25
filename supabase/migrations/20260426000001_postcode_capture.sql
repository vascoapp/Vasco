-- =============================================================================
-- Postcode capture (R240)
-- =============================================================================
-- The moat needs postcode-level granularity for cohort cells, but the data
-- must NEVER be exposed publicly — only used internally for prediction
-- accuracy. RLS restricts reads to the owning user; the cohort RPC
-- aggregates with k-anonymity ≥5 distinct contractors before returning.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add postcode columns where useful
-- ---------------------------------------------------------------------------
-- pricing_intelligence already has region (postcode prefix). Add full postcode
-- as a separate column so we can roll up by either granularity. NL is "1234 AB",
-- DE is 5 digits, FR is 5 digits, ES is 5 digits, IT is 5 digits, UK is alpha.
alter table public.pricing_intelligence add column if not exists postcode text;
alter table public.material_price_history add column if not exists postcode text;
alter table public.job_outcomes add column if not exists postcode text;

create index if not exists idx_pi_postcode on public.pricing_intelligence (country, postcode);
create index if not exists idx_mph_postcode on public.material_price_history (country, postcode);

-- ---------------------------------------------------------------------------
-- 2. Cohort RPC with postcode-level k-anonymity
-- ---------------------------------------------------------------------------
-- Returns aggregated stats for a (trade, country, postcode_prefix) cell, but
-- ONLY when the cell has ≥5 distinct contractors. Below threshold, returns
-- nulls so the UI falls back to the wider trade × country aggregate.
--
-- postcode_prefix is the first N chars of the postcode — caller passes the
-- granularity (e.g., 4 chars for NL "1234", 2 for "12"). Wider = more cells
-- pass anonymity gate but signal is weaker.
create or replace function public.get_postcode_cohort_stats(
  p_trade text,
  p_country text,
  p_postcode_prefix text,
  p_months int default 6
)
returns table (
  avg_unit_price real,
  median_unit_price real,
  avg_margin real,
  acceptance_rate real,
  sample_size bigint,
  contractor_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contractors bigint;
begin
  -- count distinct contractors in this postcode cell
  select count(distinct user_id) into v_contractors
  from public.pricing_intelligence
  where trade = p_trade
    and country = p_country
    and postcode is not null
    and left(postcode, length(p_postcode_prefix)) = p_postcode_prefix
    and quoted_at > now() - (p_months || ' months')::interval;

  -- k-anonymity gate: need ≥5 contractors before exposing aggregate
  if coalesce(v_contractors, 0) < 5 then
    return query select
      null::real, null::real, null::real, null::real,
      0::bigint, coalesce(v_contractors, 0);
    return;
  end if;

  return query
  select
    avg(quoted_unit_price)::real,
    percentile_cont(0.5) within group (order by quoted_unit_price)::real,
    avg(margin_percent)::real,
    (count(*) filter (where was_accepted = true))::real / nullif(count(*),0)::real,
    count(*),
    v_contractors
  from public.pricing_intelligence
  where trade = p_trade
    and country = p_country
    and postcode is not null
    and left(postcode, length(p_postcode_prefix)) = p_postcode_prefix
    and quoted_at > now() - (p_months || ' months')::interval;
end;
$$;

grant execute on function public.get_postcode_cohort_stats(text, text, text, int) to authenticated, service_role;

-- Document new columns in moat_schema_metadata (kept private — is_pii=true).
insert into public.moat_schema_metadata (table_name, column_name, business_meaning, data_type, unit, is_pii, notes) values
  ('pricing_intelligence', 'postcode', 'Customer postcode for cell-level cohort training. Internal use only.', 'text', null, true, 'NEVER expose to other contractors; only via k-anonymity aggregates.'),
  ('material_price_history', 'postcode', 'Postcode for regional material price granularity', 'text', null, true, 'Internal training signal; do not expose.'),
  ('job_outcomes', 'postcode', 'Postcode for job-outcome cohort training', 'text', null, true, 'Internal training signal; do not expose.')
on conflict (table_name, column_name) do nothing;

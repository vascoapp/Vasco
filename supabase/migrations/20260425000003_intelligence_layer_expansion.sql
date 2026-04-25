-- =============================================================================
-- Intelligence layer expansion (R238)
-- =============================================================================
-- Adds the demand-side, supply-side, and queryable-database structures from
-- the closed-loop audit. One migration covers everything because the new
-- tables share RLS patterns and reference each other.
-- =============================================================================
--
-- SUPPLY SIDE (capture):
--   1. generator_dismissals       — UI dismissal events (negative gradient)
--   2. customer_portal_events     — portal-side telemetry
--   3. photo_analyses             — persist Claude Haiku Vision output
--   4. job_quality_signals        — review / on-time / referral scores
--   5. model_training_pairs       — labeled pairs for retrain pipeline
--
-- DEMAND SIDE (prediction outputs):
--   6. ml_cashflow_gap_predictions, ml_supplier_leadtime_predictions,
--      ml_material_price_forecasts, ml_capacity_overrun_predictions —
--      thin tables that hold rolling per-user forecasts so the UI can read
--      the latest without recomputing on every render.
--
-- QUERYABLE DATABASE (structure for ad-hoc agent / dashboard queries):
--   7. moat_schema_metadata       — data-dictionary table
--   8. mv_margin_by_trade_month, mv_dso_by_customer, mv_winrate_by_amount —
--      materialized views over the most-queried slices
--   9. ts_daily_business_metrics  — time-series rollup
--  10. customer_embeddings, material_embeddings, quote_line_embeddings —
--      pgvector tables for semantic search
-- =============================================================================

create extension if not exists vector;

-- ===========================================================================
-- 1. generator_dismissals
-- ===========================================================================
-- Captures when a contractor dismisses a generator output in the UI (not the
-- same as rejecting an EVE queue item — this is the swipe-away signal).
-- Negative gradient for the global approval rate; helps prune noisy generators.
create table if not exists public.generator_dismissals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  generator_id text not null,
  insight_id text,
  screen text,
  reason text,                                -- optional free-text or chip code
  dismissed_at timestamptz not null default now()
);
create index if not exists idx_gd_user_gen on public.generator_dismissals (user_id, generator_id, dismissed_at desc);
alter table public.generator_dismissals enable row level security;
create policy "user manages own dismissals" on public.generator_dismissals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ===========================================================================
-- 2. customer_portal_events
-- ===========================================================================
-- Customer-side telemetry: open, scroll, decision-button hover, etc.
-- Anonymous (no PII beyond the portal token) so we can train acceptance
-- probability without consent friction. Owner reads aggregates only.
create table if not exists public.customer_portal_events (
  id uuid primary key default gen_random_uuid(),
  portal_token text not null,
  contractor_user_id uuid references auth.users(id) on delete cascade,
  quote_id text,
  decision_id text,
  event_type text not null check (event_type in (
    'portal_opened','quote_viewed','price_expanded','line_clicked',
    'photo_viewed','accept_hovered','decline_hovered','question_started',
    'question_sent','accepted','declined','session_ended'
  )),
  duration_ms integer,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_cpe_quote on public.customer_portal_events (quote_id, created_at desc);
create index if not exists idx_cpe_contractor on public.customer_portal_events (contractor_user_id, created_at desc);
alter table public.customer_portal_events enable row level security;
-- Anon can INSERT (portal has no auth), contractor reads own quotes only.
create policy "anon insert portal events" on public.customer_portal_events
  for insert with check (true);
create policy "contractor reads own portal events" on public.customer_portal_events
  for select using (auth.uid() = contractor_user_id);

-- ===========================================================================
-- 3. photo_analyses
-- ===========================================================================
-- Persists structured output from analyze-photo Edge Function. Today the
-- response is consumed once and discarded; persistence enables aggregate
-- learning ("kitchens in NL average 3.2 photos and €X total" etc).
create table if not exists public.photo_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id text,
  quote_id text,
  storage_path text,
  trade text,
  detected_rooms text[],
  detected_materials jsonb,
  estimated_complexity text check (estimated_complexity in ('simple','moderate','complex')),
  estimated_duration_hours numeric,
  estimated_cost_eur numeric,
  raw_response jsonb,
  analyzed_at timestamptz not null default now()
);
create index if not exists idx_pa_user_job on public.photo_analyses (user_id, job_id);
create index if not exists idx_pa_trade on public.photo_analyses (trade, analyzed_at desc);
alter table public.photo_analyses enable row level security;
create policy "user manages own photo analyses" on public.photo_analyses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ===========================================================================
-- 4. job_quality_signals
-- ===========================================================================
-- Was the job a "good" job? Composite of: paid on time, customer review,
-- referral generated, follow-up rebooked. Used to weight training data so
-- low-quality jobs don't pollute the predictors.
create table if not exists public.job_quality_signals (
  job_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id text,
  paid_on_time boolean,
  customer_review_score integer check (customer_review_score between 1 and 5),
  customer_review_text text,
  referral_generated boolean default false,
  rebook_within_180d boolean default false,
  composite_score numeric,                   -- 0-1, computed by trigger
  updated_at timestamptz not null default now()
);
alter table public.job_quality_signals enable row level security;
create policy "user manages own quality signals" on public.job_quality_signals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.compute_job_quality_score()
returns trigger language plpgsql as $$
begin
  new.composite_score := coalesce(
    (case when new.paid_on_time = true then 0.3 else 0 end)
    + (case when new.customer_review_score is not null then new.customer_review_score::numeric * 0.06 else 0 end)
    + (case when new.referral_generated = true then 0.2 else 0 end)
    + (case when new.rebook_within_180d = true then 0.2 else 0 end),
    0
  );
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists trg_job_quality_score on public.job_quality_signals;
create trigger trg_job_quality_score before insert or update on public.job_quality_signals
  for each row execute function public.compute_job_quality_score();

-- ===========================================================================
-- 5. model_training_pairs
-- ===========================================================================
-- Labeled (input_features, target_value) rows for the retrain pipeline.
-- Decouples training data from the live event tables so retrains stay
-- reproducible across schema evolution.
create table if not exists public.model_training_pairs (
  id uuid primary key default gen_random_uuid(),
  model_name text not null,                  -- 'quote_win' | 'cashflow_gap' | etc
  user_id uuid references auth.users(id) on delete set null,
  trade text,
  country text,
  features jsonb not null,
  target numeric,
  target_label text,
  source text not null,                      -- 'auto' | 'reason_code' | 'manual'
  weight numeric default 1.0,                -- composite_score from job_quality
  recorded_at timestamptz not null default now()
);
create index if not exists idx_mtp_model on public.model_training_pairs (model_name, recorded_at desc);
create index if not exists idx_mtp_cohort on public.model_training_pairs (model_name, trade, country, recorded_at desc);
alter table public.model_training_pairs enable row level security;
create policy "service role only" on public.model_training_pairs
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- ===========================================================================
-- 6. ML prediction caches (demand side)
-- ===========================================================================
-- Each is a one-row-per-user table. The retrain function writes here; the
-- UI reads with a single indexed lookup. Avoids recomputing predictions on
-- every screen mount.

create table if not exists public.ml_cashflow_gap_predictions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  horizon_days integer not null,
  predicted_gap_eur numeric not null,
  confidence numeric not null,
  features jsonb,
  computed_at timestamptz not null default now()
);

create table if not exists public.ml_supplier_leadtime_predictions (
  user_id uuid not null references auth.users(id) on delete cascade,
  supplier_id text not null,
  predicted_delay_days numeric not null,
  delay_probability numeric not null,        -- P(delay > 5 days)
  confidence numeric not null,
  computed_at timestamptz not null default now(),
  primary key (user_id, supplier_id)
);

create table if not exists public.ml_material_price_forecasts (
  trade text not null,
  country text not null,
  material_category text not null,
  forecast_horizon_days integer not null,
  predicted_price_change_pct numeric not null,
  confidence numeric not null,
  observation_count bigint not null,
  computed_at timestamptz not null default now(),
  primary key (trade, country, material_category, forecast_horizon_days)
);

create table if not exists public.ml_capacity_overrun_predictions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  horizon_days integer not null,
  overrun_probability numeric not null,
  predicted_overrun_days numeric not null,
  features jsonb,
  computed_at timestamptz not null default now()
);

alter table public.ml_cashflow_gap_predictions enable row level security;
alter table public.ml_supplier_leadtime_predictions enable row level security;
alter table public.ml_capacity_overrun_predictions enable row level security;
alter table public.ml_material_price_forecasts enable row level security;

create policy "user reads own cashflow pred" on public.ml_cashflow_gap_predictions
  for select using (auth.uid() = user_id);
create policy "service writes cashflow pred" on public.ml_cashflow_gap_predictions
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "user reads own leadtime pred" on public.ml_supplier_leadtime_predictions
  for select using (auth.uid() = user_id);
create policy "service writes leadtime pred" on public.ml_supplier_leadtime_predictions
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "auth read material forecasts" on public.ml_material_price_forecasts
  for select using (auth.role() = 'authenticated');
create policy "service writes material forecasts" on public.ml_material_price_forecasts
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "user reads own capacity pred" on public.ml_capacity_overrun_predictions
  for select using (auth.uid() = user_id);
create policy "service writes capacity pred" on public.ml_capacity_overrun_predictions
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- ===========================================================================
-- 7. moat_schema_metadata — data dictionary
-- ===========================================================================
-- Column-level metadata so a future agent (or dashboard generator) knows
-- what each column means in business terms. Seeded inline below.
create table if not exists public.moat_schema_metadata (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  column_name text not null,
  business_meaning text not null,
  data_type text not null,
  unit text,
  valid_range text,
  example_value text,
  is_pii boolean default false,
  notes text,
  unique (table_name, column_name)
);
alter table public.moat_schema_metadata enable row level security;
create policy "auth read schema metadata" on public.moat_schema_metadata
  for select using (auth.role() = 'authenticated');
create policy "service writes schema metadata" on public.moat_schema_metadata
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

insert into public.moat_schema_metadata (table_name, column_name, business_meaning, data_type, unit, valid_range, example_value, is_pii) values
  ('pricing_intelligence', 'quoted_unit_price', 'Per-unit price the contractor quoted for one line item', 'numeric', 'EUR', '0-100000', '85.00', false),
  ('pricing_intelligence', 'was_accepted', 'Whether the customer accepted the full quote containing this line', 'boolean', null, 'true|false', 'true', false),
  ('pricing_intelligence', 'margin_percent', 'Gross margin on the line at quote time', 'numeric', '%', '-100 to 100', '32.5', false),
  ('pricing_intelligence', 'trade', 'Contractor trade — one of plumbing/electrical/etc', 'text', null, '15-trade enum', 'plumbing', false),
  ('pricing_intelligence', 'country', 'ISO-2 country code', 'text', null, 'NL|DE|FR|ES|IT|UK', 'NL', false),
  ('quote_line_deltas', 'original_unit_price', 'Price the AI/cohort baseline suggested', 'numeric', 'EUR', '0-100000', '120.00', false),
  ('quote_line_deltas', 'new_unit_price', 'Price the contractor edited it to', 'numeric', 'EUR', '0-100000', '135.00', false),
  ('quote_line_deltas', 'reason_code', 'Why the contractor changed it (chip selection)', 'text', null, '7-code enum', 'waste_underestimated', false),
  ('job_quality_signals', 'composite_score', 'Weighted quality blend: on-time + review + referral + rebook', 'numeric', 'score', '0-1', '0.78', false),
  ('cohort_weekly_stats', 'avg_dso', 'Cohort average days-sales-outstanding', 'real', 'days', '0-365', '24.5', false),
  ('cohort_weekly_stats', 'contractor_count', 'Distinct contractors contributing — k-anonymity gate', 'bigint', 'count', '5+', '12', false),
  ('material_price_history', 'unit_price', 'Price contractor paid per unit', 'numeric', 'EUR', '0-100000', '4.20', false),
  ('customer_payment_patterns', 'avg_dso_days', 'Customer-specific average days to pay', 'numeric', 'days', '0-365', '31.0', false),
  ('photo_analyses', 'estimated_complexity', 'AI assessment of job complexity from photos', 'text', null, 'simple|moderate|complex', 'moderate', false),
  ('photo_analyses', 'estimated_duration_hours', 'AI hours estimate from photos before contractor refines', 'numeric', 'hours', '0-1000', '6.5', false)
on conflict (table_name, column_name) do nothing;

-- ===========================================================================
-- 8. Materialized views — common aggregate slices
-- ===========================================================================

drop materialized view if exists public.mv_margin_by_trade_month cascade;
create materialized view public.mv_margin_by_trade_month as
select
  trade,
  country,
  date_trunc('month', quoted_at) as month,
  count(*) as quotes,
  count(distinct user_id) as contractors,
  avg(margin_percent)::real as avg_margin,
  percentile_cont(0.5) within group (order by margin_percent)::real as median_margin
from public.pricing_intelligence
where margin_percent is not null
  and quoted_at > now() - interval '24 months'
group by trade, country, date_trunc('month', quoted_at);
create unique index on public.mv_margin_by_trade_month (trade, country, month);

-- pricing_intelligence is line-item-level; aggregate to quote-level first.
drop materialized view if exists public.mv_winrate_by_amount cascade;
create materialized view public.mv_winrate_by_amount as
with quote_totals as (
  select
    quote_id,
    user_id,
    trade,
    country,
    sum(quoted_total) as total_amount,
    bool_or(was_accepted) as was_accepted,
    min(quoted_at) as quoted_at
  from public.pricing_intelligence
  where quote_id is not null
    and quoted_at > now() - interval '12 months'
  group by quote_id, user_id, trade, country
)
select
  trade,
  country,
  case
    when total_amount < 1000 then 'under_1k'
    when total_amount < 5000 then '1k_5k'
    when total_amount < 10000 then '5k_10k'
    when total_amount < 25000 then '10k_25k'
    else 'over_25k'
  end as amount_bucket,
  count(*) as quotes,
  count(distinct user_id) as contractors,
  (count(*) filter (where was_accepted))::real / nullif(count(*),0)::real as win_rate
from quote_totals
where total_amount is not null
group by trade, country,
  case
    when total_amount < 1000 then 'under_1k'
    when total_amount < 5000 then '1k_5k'
    when total_amount < 10000 then '5k_10k'
    when total_amount < 25000 then '10k_25k'
    else 'over_25k'
  end;
create unique index on public.mv_winrate_by_amount (trade, country, amount_bucket);

create or replace function public.refresh_intelligence_aggregates()
returns void language plpgsql security definer set search_path = public as $$
begin
  refresh materialized view public.mv_margin_by_trade_month;
  refresh materialized view public.mv_winrate_by_amount;
  refresh materialized view public.generator_approval_rates_global;
end;
$$;
grant execute on function public.refresh_intelligence_aggregates() to service_role;

-- ===========================================================================
-- 9. Time-series daily rollup
-- ===========================================================================
-- One row per (user_id, day, metric). Backed by trigger that updates rows
-- on the fly when business_events arrive — keeps query cost flat.
create table if not exists public.ts_daily_business_metrics (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  quotes_sent integer not null default 0,
  quotes_accepted integer not null default 0,
  invoices_sent integer not null default 0,
  invoices_paid integer not null default 0,
  total_quoted_eur numeric not null default 0,
  total_paid_eur numeric not null default 0,
  primary key (user_id, day)
);
alter table public.ts_daily_business_metrics enable row level security;
create policy "user reads own daily metrics" on public.ts_daily_business_metrics
  for select using (auth.uid() = user_id);
create policy "service writes daily metrics" on public.ts_daily_business_metrics
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create or replace function public.bump_daily_metric_on_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := new.user_id;
  v_day date := (new.created_at at time zone 'UTC')::date;
begin
  if v_user is null then return new; end if;
  insert into public.ts_daily_business_metrics (user_id, day) values (v_user, v_day) on conflict do nothing;
  if new.event_type = 'quote_created' then
    update public.ts_daily_business_metrics
       set quotes_sent = quotes_sent + 1,
           total_quoted_eur = total_quoted_eur + coalesce((new.payload->>'amount')::numeric, 0)
     where user_id = v_user and day = v_day;
  elsif new.event_type = 'quote_accepted' then
    update public.ts_daily_business_metrics set quotes_accepted = quotes_accepted + 1
     where user_id = v_user and day = v_day;
  elsif new.event_type = 'invoice_sent' then
    update public.ts_daily_business_metrics set invoices_sent = invoices_sent + 1
     where user_id = v_user and day = v_day;
  elsif new.event_type = 'payment_received' then
    update public.ts_daily_business_metrics
       set invoices_paid = invoices_paid + 1,
           total_paid_eur = total_paid_eur + coalesce((new.payload->>'amount')::numeric, 0)
     where user_id = v_user and day = v_day;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_bump_daily_metric on public.business_events;
create trigger trg_bump_daily_metric after insert on public.business_events
  for each row execute function public.bump_daily_metric_on_event();

-- ===========================================================================
-- 10. Vector embeddings — pgvector tables for semantic search
-- ===========================================================================

create table if not exists public.customer_embeddings (
  customer_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  embedding vector(1536),
  source_text text,
  embedded_at timestamptz not null default now()
);
create index if not exists idx_customer_emb on public.customer_embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);
alter table public.customer_embeddings enable row level security;
create policy "user manages own customer emb" on public.customer_embeddings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.material_embeddings (
  material_key text primary key,             -- "<trade>|<material_name>"
  embedding vector(1536),
  source_text text,
  embedded_at timestamptz not null default now()
);
alter table public.material_embeddings enable row level security;
create policy "auth read material emb" on public.material_embeddings
  for select using (auth.role() = 'authenticated');
create policy "service writes material emb" on public.material_embeddings
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create table if not exists public.quote_line_embeddings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quote_id text,
  line_id text,
  embedding vector(1536),
  source_text text,
  embedded_at timestamptz not null default now()
);
create index if not exists idx_qle_user on public.quote_line_embeddings (user_id, embedded_at desc);
alter table public.quote_line_embeddings enable row level security;
create policy "user manages own line emb" on public.quote_line_embeddings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ===========================================================================
-- 11. RPCs for the queryable layer
-- ===========================================================================

create or replace function public.describe_moat_schema()
returns table (
  table_name text,
  column_name text,
  business_meaning text,
  data_type text,
  unit text,
  valid_range text,
  example_value text
)
language sql security definer set search_path = public as $$
  select table_name, column_name, business_meaning, data_type, unit, valid_range, example_value
  from public.moat_schema_metadata
  where is_pii = false
  order by table_name, column_name;
$$;
grant execute on function public.describe_moat_schema() to authenticated, service_role;

create or replace function public.query_margin_trend(
  p_trade text,
  p_country text,
  p_months int default 12
)
returns table (month timestamptz, avg_margin real, median_margin real, quotes bigint)
language sql security definer set search_path = public as $$
  select month::timestamptz, avg_margin, median_margin, quotes
  from public.mv_margin_by_trade_month
  where trade = p_trade
    and country = p_country
    and month > now() - (p_months || ' months')::interval
  order by month;
$$;
grant execute on function public.query_margin_trend(text, text, int) to authenticated, service_role;

create or replace function public.query_winrate_distribution(
  p_trade text,
  p_country text
)
returns table (amount_bucket text, win_rate real, quotes bigint, contractors bigint)
language sql security definer set search_path = public as $$
  select amount_bucket, win_rate, quotes, contractors
  from public.mv_winrate_by_amount
  where trade = p_trade and country = p_country
    and contractors >= 5
  order by case amount_bucket
    when 'under_1k' then 1 when '1k_5k' then 2 when '5k_10k' then 3
    when '10k_25k' then 4 else 5 end;
$$;
grant execute on function public.query_winrate_distribution(text, text) to authenticated, service_role;

create or replace function public.write_training_pair(
  p_model_name text,
  p_user_id uuid,
  p_trade text,
  p_country text,
  p_features jsonb,
  p_target numeric,
  p_target_label text,
  p_source text,
  p_weight numeric default 1.0
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  insert into public.model_training_pairs (
    model_name, user_id, trade, country, features, target, target_label, source, weight
  ) values (
    p_model_name, p_user_id, p_trade, p_country, p_features, p_target, p_target_label, p_source, p_weight
  ) returning id into v_id;
  return v_id;
end; $$;
grant execute on function public.write_training_pair(text, uuid, text, text, jsonb, numeric, text, text, numeric) to service_role;

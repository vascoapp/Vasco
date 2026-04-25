-- =============================================================================
-- Dormant feature consumers (R243)
-- =============================================================================
-- Closes the 6 remaining capture-without-loop tables identified in the audit.
-- One migration adds the missing aggregators / RPCs / view updates so the
-- existing tables actually inform predictions and surfaces.
-- =============================================================================
--
-- 1. generator_dismissals → blend into generator_approval_rates_global
-- 2. photo_analyses        → cohort summary RPC for quote benchmarks
-- 3. job_quality_signals   → weight lookup RPC for training pair writes
-- 4. embeddings            → similarity-search RPCs (customer + material)
-- 5. mv_*                  → already-built materialized views, no schema change
-- 6. ts_daily_business_metrics → range query RPC for chart UI
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Dismissals merged into global generator approval rates
-- ---------------------------------------------------------------------------
-- Earlier view only counted queue_item_approved / queue_item_rejected from
-- business_events. Dismissals from generator_dismissals (R240) were captured
-- but never affected the rate. Now they count as negative signal alongside
-- rejections.

drop materialized view if exists public.generator_approval_rates_global cascade;

create materialized view public.generator_approval_rates_global as
with combined as (
  select payload->>'generatorId' as generator_id,
         user_id,
         case when event_type = 'queue_item_approved' then 1 else 0 end as approved,
         case when event_type = 'queue_item_rejected' then 1 else 0 end as rejected,
         0 as dismissed,
         created_at
    from public.business_events
   where event_type in ('queue_item_approved','queue_item_rejected')
     and payload ? 'generatorId'
     and payload->>'generatorId' is not null
     and created_at > now() - interval '90 days'
  union all
  select generator_id,
         user_id,
         0 as approved,
         0 as rejected,
         1 as dismissed,
         dismissed_at as created_at
    from public.generator_dismissals
   where dismissed_at > now() - interval '90 days'
)
select
  generator_id,
  count(*) filter (where approved = 1)::bigint as approvals,
  count(*) filter (where rejected = 1)::bigint as rejections,
  count(*) filter (where dismissed = 1)::bigint as dismissals,
  count(distinct user_id)::bigint as contractor_count,
  count(*)::bigint as total_events,
  case
    when count(*) > 0 then
      (count(*) filter (where approved = 1))::real
        / count(*)::real
    else null
  end as approval_rate,
  max(created_at) as last_event_at
from combined
group by generator_id;

create unique index if not exists generator_approval_rates_global_pk
  on public.generator_approval_rates_global (generator_id);

-- ---------------------------------------------------------------------------
-- 2. Photo analysis cohort summary
-- ---------------------------------------------------------------------------
-- Returns aggregate stats by trade × estimated_complexity so the quote
-- detail screen can show "AI estimated similar jobs in NL plumbing at
-- €1,800–€2,400" — closes the loop on photo_analyses by giving the
-- contractor a benchmark.
create or replace function public.get_photo_analysis_cohort(
  p_trade text,
  p_country text default null,
  p_complexity text default null
)
returns table (
  avg_duration_hours real,
  avg_cost_eur real,
  median_cost_eur real,
  sample_size bigint,
  contractor_count bigint
)
language plpgsql security definer set search_path = public as $$
declare v_count bigint;
begin
  select count(distinct user_id) into v_count
    from public.photo_analyses
   where trade = p_trade
     and (p_complexity is null or estimated_complexity = p_complexity)
     and analyzed_at > now() - interval '180 days';

  if coalesce(v_count, 0) < 5 then
    return query select null::real, null::real, null::real, 0::bigint, coalesce(v_count, 0);
    return;
  end if;

  return query
  select
    avg(estimated_duration_hours)::real,
    avg(estimated_cost_eur)::real,
    percentile_cont(0.5) within group (order by estimated_cost_eur)::real,
    count(*),
    v_count
  from public.photo_analyses
  where trade = p_trade
    and (p_complexity is null or estimated_complexity = p_complexity)
    and analyzed_at > now() - interval '180 days';
end; $$;

grant execute on function public.get_photo_analysis_cohort(text, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Job quality lookup for training-pair weight
-- ---------------------------------------------------------------------------
-- Given a customer_id, returns the latest composite_score so training pair
-- writes can pass it as p_weight. High-quality jobs (paid on time, good
-- review, referral, rebook) train the model harder than disputed ones.
create or replace function public.get_customer_quality_weight(p_customer_id text)
returns numeric
language sql security definer set search_path = public as $$
  select coalesce(
    (select avg(composite_score)
       from public.job_quality_signals
      where customer_id = p_customer_id
        and composite_score is not null
        and updated_at > now() - interval '365 days'),
    1.0
  );
$$;

grant execute on function public.get_customer_quality_weight(text) to service_role;

-- ---------------------------------------------------------------------------
-- 4a. Customer similarity search
-- ---------------------------------------------------------------------------
-- Cosine-similarity over customer_embeddings, scoped to the calling user.
create or replace function public.match_similar_customers(
  p_user_id uuid,
  p_query_text text,
  p_limit int default 5
)
returns table (customer_id text, similarity real)
language plpgsql security definer set search_path = public as $$
declare
  v_query vector(1536);
begin
  -- The embedding for p_query_text is expected to have been written by
  -- embed-text under key '__query__' just before this call. The service
  -- wrapper findSimilarCustomersByText handles that flow.
  select embedding into v_query
    from public.customer_embeddings
   where customer_id = '__query__'
     and user_id = p_user_id
   order by embedded_at desc
   limit 1;

  if v_query is null then
    return;
  end if;

  return query
  select ce.customer_id,
         1 - (ce.embedding <=> v_query) as similarity
  from public.customer_embeddings ce
  where ce.user_id = p_user_id
    and ce.customer_id != '__query__'
  order by ce.embedding <=> v_query
  limit p_limit;
end; $$;

grant execute on function public.match_similar_customers(uuid, text, int) to authenticated, service_role;

-- 4b. Material similarity search (cohort-wide, no user_id scope)
create or replace function public.match_similar_materials(
  p_query_key text,
  p_limit int default 5
)
returns table (material_key text, similarity real)
language plpgsql security definer set search_path = public as $$
declare
  v_query vector(1536);
begin
  select embedding into v_query
    from public.material_embeddings
   where material_key = p_query_key
   limit 1;

  if v_query is null then
    return;
  end if;

  return query
  select me.material_key,
         1 - (me.embedding <=> v_query) as similarity
  from public.material_embeddings me
  where me.material_key != p_query_key
  order by me.embedding <=> v_query
  limit p_limit;
end; $$;

grant execute on function public.match_similar_materials(text, int) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Time-series range query for charts
-- ---------------------------------------------------------------------------
create or replace function public.query_daily_metrics(
  p_user_id uuid,
  p_days int default 90
)
returns table (
  day date,
  quotes_sent integer,
  quotes_accepted integer,
  invoices_sent integer,
  invoices_paid integer,
  total_quoted_eur numeric,
  total_paid_eur numeric
)
language sql security definer set search_path = public as $$
  select day, quotes_sent, quotes_accepted, invoices_sent, invoices_paid, total_quoted_eur, total_paid_eur
    from public.ts_daily_business_metrics
   where user_id = p_user_id
     and day > now() - (p_days || ' days')::interval
   order by day;
$$;

grant execute on function public.query_daily_metrics(uuid, int) to authenticated, service_role;

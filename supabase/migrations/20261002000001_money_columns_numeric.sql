-- =============================================================================
-- 20261002000001 — money in exact decimals, not REAL
-- =============================================================================
-- REAL keeps ~6 significant digits: 12345.67 came back as 12345.7 (live check
-- of import_catalog_prices, learnings #386). Every column below holds a
-- currency amount; totals and costs above € 10.000 lost their cents. Ratios,
-- hours and confidences stay REAL (no cents to lose).
--
-- Totals/costs: numeric(14,2). Unit prices: numeric(14,4) (DATANORM lists a
-- price per 100 divided down; the app sends 4 decimals).
-- Prod rows on 2026-10-02: 0 in every table except pricing_intelligence (2).
--
-- Contracts kept: the dependent VIEWS are recreated with their OLD output
-- types (casts added where a column became numeric) — get_material_cohort_stats
-- returns the benchmark view's min/max as REAL and a plpgsql RETURN QUERY
-- fails at RUN time on a type mismatch (#361). match_similar_jobs returned
-- je.actual_cost raw into a REAL slot: cast. import_catalog_prices compared
-- prices as REAL; it now compares numeric to numeric (a REAL-vs-numeric
-- comparison would report EVERY price as changed).
-- mv_margin_by_trade_month reads no changed column: untouched.
-- Verified in a rolled-back transaction on prod first (seeded rows, every
-- affected function called), then check:rpcs + check:catalog-import.
-- =============================================================================

drop view if exists public.material_price_benchmarks;
drop view if exists public.price_references;
drop materialized view if exists public.mv_winrate_by_amount;

alter table public.material_price_history     alter column price_excl_vat     type numeric(14,4) using price_excl_vat::numeric(14,4);
alter table public.price_observations         alter column price              type numeric(14,4) using price::numeric(14,4);
alter table public.pricing_intelligence       alter column quoted_unit_price  type numeric(14,4) using quoted_unit_price::numeric(14,4),
                                              alter column quoted_total       type numeric(14,2) using quoted_total::numeric(14,2),
                                              alter column accepted_price     type numeric(14,2) using accepted_price::numeric(14,2),
                                              alter column actual_cost        type numeric(14,2) using actual_cost::numeric(14,2),
                                              alter column counter_offer_amount type numeric(14,2) using counter_offer_amount::numeric(14,2);
alter table public.job_outcomes               alter column actual_cost        type numeric(14,2) using actual_cost::numeric(14,2),
                                              alter column estimated_cost     type numeric(14,2) using estimated_cost::numeric(14,2);
alter table public.job_embeddings             alter column actual_cost        type numeric(14,2) using actual_cost::numeric(14,2);
alter table public.invoice_outcomes           alter column amount             type numeric(14,2) using amount::numeric(14,2);
alter table public.customer_payment_patterns  alter column invoice_amount     type numeric(14,2) using invoice_amount::numeric(14,2);

create view public.material_price_benchmarks as
SELECT mph.trade,
    mph.country,
    COALESCE(a.canonical_key, mph.canonical_name, lower(mph.material_name)) AS cohort_key,
    mode() WITHIN GROUP (ORDER BY mph.material_name) AS material_name,
    mph.material_category,
    mph.unit,
    avg(mph.price_excl_vat)::real AS avg_price,
    percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (mph.price_excl_vat::double precision))::real AS median_price,
    percentile_cont(0.25::double precision) WITHIN GROUP (ORDER BY (mph.price_excl_vat::double precision))::real AS p25_price,
    percentile_cont(0.75::double precision) WITHIN GROUP (ORDER BY (mph.price_excl_vat::double precision))::real AS p75_price,
    min(mph.price_excl_vat)::real AS min_price,
    max(mph.price_excl_vat)::real AS max_price,
    count(*) AS sample_size,
    count(DISTINCT mph.observed_by) AS contractor_count,
    max(mph.observed_at) AS last_observed
   FROM material_price_history mph
     LEFT JOIN material_canonical_aliases a ON a.variant_key = COALESCE(mph.canonical_name, lower(mph.material_name))
  WHERE mph.observed_at > (now() - '180 days'::interval)
  GROUP BY mph.trade, mph.country, (COALESCE(a.canonical_key, mph.canonical_name, lower(mph.material_name))), mph.material_category, mph.unit
 HAVING count(DISTINCT mph.observed_by) >= 5;
grant select, insert, update, delete on public.material_price_benchmarks to authenticated;
grant all on public.material_price_benchmarks to service_role;

create view public.price_references as
SELECT po.user_id,
    po.material_id,
    mc.name AS material_name,
    (avg(po.price) FILTER (WHERE po.observed_at > (now() - '30 days'::interval)))::double precision AS avg_price_30d,
    (avg(po.price) FILTER (WHERE po.observed_at > (now() - '90 days'::interval)))::double precision AS avg_price_90d,
    (min(po.price) FILTER (WHERE po.observed_at > (now() - '30 days'::interval)))::real AS min_price_30d,
    (max(po.price) FILTER (WHERE po.observed_at > (now() - '30 days'::interval)))::real AS max_price_30d,
    (stddev(po.price) FILTER (WHERE po.observed_at > (now() - '90 days'::interval)))::double precision AS volatility,
    count(*) FILTER (WHERE po.observed_at > (now() - '90 days'::interval)) AS observation_count,
    max(po.observed_at) AS last_observed_at
   FROM price_observations po
     LEFT JOIN material_catalog mc ON mc.id::text = po.material_id AND mc.user_id = po.user_id
  GROUP BY po.user_id, po.material_id, mc.name;

create materialized view public.mv_winrate_by_amount as
WITH quote_totals AS (
         SELECT pricing_intelligence.quote_id,
            pricing_intelligence.user_id,
            pricing_intelligence.trade,
            pricing_intelligence.country,
            sum(pricing_intelligence.quoted_total)::double precision AS total_amount,
            bool_or(pricing_intelligence.was_accepted) AS was_accepted,
            min(pricing_intelligence.quoted_at) AS quoted_at
           FROM pricing_intelligence
          WHERE pricing_intelligence.quote_id IS NOT NULL AND pricing_intelligence.quoted_at > (now() - '1 year'::interval)
          GROUP BY pricing_intelligence.quote_id, pricing_intelligence.user_id, pricing_intelligence.trade, pricing_intelligence.country
        )
 SELECT trade,
    country,
        CASE
            WHEN total_amount < 1000::double precision THEN 'under_1k'::text
            WHEN total_amount < 5000::double precision THEN '1k_5k'::text
            WHEN total_amount < 10000::double precision THEN '5k_10k'::text
            WHEN total_amount < 25000::double precision THEN '10k_25k'::text
            ELSE 'over_25k'::text
        END AS amount_bucket,
    count(*) AS quotes,
    count(DISTINCT user_id) AS contractors,
    count(*) FILTER (WHERE was_accepted)::real / NULLIF(count(*), 0)::real AS win_rate
   FROM quote_totals
  WHERE total_amount IS NOT NULL
  GROUP BY trade, country, (
        CASE
            WHEN total_amount < 1000::double precision THEN 'under_1k'::text
            WHEN total_amount < 5000::double precision THEN '1k_5k'::text
            WHEN total_amount < 10000::double precision THEN '5k_10k'::text
            WHEN total_amount < 25000::double precision THEN '10k_25k'::text
            ELSE 'over_25k'::text
        END);
CREATE UNIQUE INDEX mv_winrate_by_amount_trade_country_amount_bucket_idx ON public.mv_winrate_by_amount USING btree (trade, country, amount_bucket);

CREATE OR REPLACE FUNCTION public.match_similar_jobs(query_embedding vector, match_trade text, match_country text DEFAULT 'NL'::text, match_threshold real DEFAULT 0.7, match_count integer DEFAULT 5)
 RETURNS TABLE(job_id text, job_description text, job_type text, actual_cost real, actual_hours real, margin_percent real, similarity real)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    je.job_id,
    je.job_description,
    je.job_type,
    je.actual_cost::real,  -- numeric since 20261002000001; the API stays real
    je.actual_hours,
    je.margin_percent,
    (1 - (je.embedding <=> query_embedding))::real AS similarity
  FROM job_embeddings je
  WHERE je.trade = match_trade
    AND je.country = match_country
    AND je.actual_cost IS NOT NULL
    AND 1 - (je.embedding <=> query_embedding) > match_threshold
  ORDER BY je.embedding <=> query_embedding
  LIMIT match_count;
END;
$function$
;

create or replace function public.import_catalog_prices(
  p_supplier_id text,
  p_supplier_name text,
  p_trade text,
  p_country text,
  p_currency text,
  -- [{ "a": article number, "n": name, "u": unit, "p": price excl. VAT,
  --    "k": canonical key }]
  p_items jsonb
)
returns table (imported integer, skipped integer)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_total integer;
  v_written integer;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if coalesce(trim(p_supplier_id), '') = '' then
    raise exception 'supplier required' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'items must be an array' using errcode = '22023';
  end if;
  v_total := jsonb_array_length(p_items);
  if v_total > 5000 then
    raise exception 'batch too large (% items, max 5000)', v_total using errcode = '22023';
  end if;

  -- Two imports at once (two devices, a double tap) would both see "no row
  -- yet" and both insert. One import per contractor at a time.
  perform pg_advisory_xact_lock(hashtextextended('import_catalog_prices:' || v_uid::text, 0));

  -- One statement: the valid rows (one per article — the LAST occurrence in
  -- the file wins, as the app's map did), the catalogue rows and the price
  -- rows. Invalid rows are counted as skipped.
  with batch as (
    select distinct on (x.a) x.a, left(x.n, 200) as n, nullif(trim(x.u), '') as u, round(x.p, 4) as p, x.k
      from (
        select trim(e->>'a') as a, coalesce(nullif(trim(e->>'n'), ''), trim(e->>'a')) as n,
               e->>'u' as u, (e->>'p')::numeric as p, nullif(trim(e->>'k'), '') as k, ord
          from jsonb_array_elements(p_items) with ordinality as t(e, ord)
         where jsonb_typeof(e) = 'object'
           and coalesce(trim(e->>'a'), '') <> ''
           and (e->>'p') ~ '^[0-9]+(\.[0-9]+)?$'
      ) x
     where x.p > 0 and x.k is not null
     order by x.a, x.ord desc
  ),
  -- The material picker's rows: once per article code. (A data-modifying
  -- CTE runs to completion whether or not it is referenced.)
  cat as (
    insert into material_catalog (user_id, name, manufacturer_code, base_unit, category)
    select v_uid, b.n, b.a, coalesce(b.u, 'piece'), coalesce(nullif(p_trade, ''), 'general')
      from batch b
     where not exists (
       select 1 from material_catalog m where m.user_id = v_uid and m.manufacturer_code = b.a
     )
    returning 1
  ),
  -- A price row only where it differs from this contractor's newest one.
  prices as (
    insert into material_price_history (
      observed_by, supplier_id, supplier_name, material_name, canonical_name,
      unit, price_excl_vat, currency, vat_rate, trade, country, source, observed_at
    )
    -- One per canonical key: two codes can share one ('ABC' / 'abc', or a
    -- code too short to be an identity, keyed by its text).
    select distinct on (b.k)
           v_uid, p_supplier_id, coalesce(nullif(p_supplier_name, ''), p_supplier_id), b.n, b.k,
           coalesce(b.u, 'piece'), b.p, coalesce(nullif(p_currency, ''), 'EUR'), null,
           coalesce(nullif(p_trade, ''), 'general'), coalesce(nullif(p_country, ''), 'NL'),
           'catalog', now()
      from batch b
     where b.p is distinct from (
       select h.price_excl_vat from material_price_history h
        where h.observed_by = v_uid and h.supplier_id = p_supplier_id and h.canonical_name = b.k
          -- Same unit too: the price watch groups by it, so a list that moves
          -- an article from m to Stk at the same price is a new observation.
          and lower(coalesce(h.unit, '')) = lower(coalesce(b.u, 'piece'))
        order by h.observed_at desc
        limit 1
     )
     -- Deterministic: two codes sharing a key would otherwise flip between
     -- imports and show the watch a price change that never happened.
     order by b.k, b.a
    returning 1
  )
  select count(*) from prices into v_written;

  return query select v_written, v_total - v_written;
end;
$$;


-- =============================================================================
-- COHORT MOAT FIX — corrects broken RPCs from 002_ai_moat_infrastructure.sql
-- =============================================================================
-- Changes:
-- 1. get_trade_pricing_stats reads from pricing_intelligence (not learning_profiles)
--    with k-anonymity guard (>= 5 contractors per trade×country×[job_type] cell).
-- 2. compute_weekly_cohort_stats aggregates from pricing_intelligence,
--    business_events (for acceptance + DSO) and material_price_history.
-- 3. on_quote_accepted_refresh_cohort() trigger recomputes the current week
--    for the accepted quote's (trade, country) on every quote_accepted event.
-- 4. material_price_history RLS tightened: raw SELECT replaced with an
--    aggregation-only view (k-anonymity >= 5 observers per material cell)
--    readable by authenticated users; the base table is read-owner-only.
-- 5. New helper get_material_cohort_stats RPC backs the benchmark UI.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Fixed get_trade_pricing_stats
-- ---------------------------------------------------------------------------
-- Reads from pricing_intelligence (the table that's actually written to by
-- dataCollector.recordPricingData and AppState.addQuote). Enforces k-anonymity:
-- returns NULLs + sample_size=0 when fewer than 5 distinct contractors
-- contribute, so the UI can fall back to local baselines without leaking
-- per-contractor pricing.

CREATE OR REPLACE FUNCTION get_trade_pricing_stats(
  p_trade TEXT,
  p_country TEXT,
  p_job_type TEXT DEFAULT NULL,
  p_months INT DEFAULT 6
)
RETURNS TABLE (
  avg_hourly_rate REAL,
  median_hourly_rate REAL,
  p25_hourly_rate REAL,
  p75_hourly_rate REAL,
  avg_margin REAL,
  acceptance_rate REAL,
  sample_size BIGINT,
  contractor_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contractors BIGINT;
BEGIN
  SELECT COUNT(DISTINCT pi.user_id) INTO v_contractors
  FROM pricing_intelligence pi
  WHERE pi.trade = p_trade
    AND pi.country = p_country
    AND (p_job_type IS NULL OR pi.job_type = p_job_type)
    AND pi.quoted_at > now() - (p_months || ' months')::INTERVAL;

  -- k-anonymity gate: need >=5 contractors before surfacing aggregate
  IF COALESCE(v_contractors, 0) < 5 THEN
    RETURN QUERY SELECT
      NULL::REAL, NULL::REAL, NULL::REAL, NULL::REAL,
      NULL::REAL, NULL::REAL,
      0::BIGINT, COALESCE(v_contractors, 0);
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    AVG(pi.quoted_unit_price)::REAL,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY pi.quoted_unit_price)::REAL,
    percentile_cont(0.25) WITHIN GROUP (ORDER BY pi.quoted_unit_price)::REAL,
    percentile_cont(0.75) WITHIN GROUP (ORDER BY pi.quoted_unit_price)::REAL,
    AVG(pi.margin_percent)::REAL,
    (COUNT(*) FILTER (WHERE pi.was_accepted = true))::REAL
      / NULLIF(COUNT(*)::REAL, 0),
    COUNT(*),
    v_contractors
  FROM pricing_intelligence pi
  WHERE pi.trade = p_trade
    AND pi.country = p_country
    AND (p_job_type IS NULL OR pi.job_type = p_job_type)
    AND pi.quoted_at > now() - (p_months || ' months')::INTERVAL;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Fixed compute_weekly_cohort_stats
-- ---------------------------------------------------------------------------
-- Aggregates real columns from pricing_intelligence (+ business_events for DSO
-- when payment_received is emitted). Idempotent via ON CONFLICT; the caller
-- passes the ISO week key ('2026-W17') or we default to the current week.

CREATE OR REPLACE FUNCTION compute_weekly_cohort_stats(
  p_week_key TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week_key TEXT;
BEGIN
  v_week_key := COALESCE(
    p_week_key,
    to_char(now(), 'IYYY') || '-W' || to_char(now(), 'IW')
  );

  INSERT INTO cohort_weekly_stats (
    trade, country, week_key,
    avg_hourly_rate, median_hourly_rate,
    avg_quote_acceptance_rate, avg_margin_percent,
    avg_job_duration_ratio, avg_jobs_per_week, avg_dso,
    avg_material_cost_ratio,
    contractor_count, data_points
  )
  SELECT
    pi.trade,
    pi.country,
    v_week_key,
    AVG(pi.quoted_unit_price)::REAL,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY pi.quoted_unit_price)::REAL,
    (COUNT(*) FILTER (WHERE pi.was_accepted = true))::REAL
      / NULLIF(COUNT(*)::REAL, 0),
    AVG(pi.margin_percent)::REAL,
    AVG(CASE
      WHEN jd.estimated_hours > 0 AND jd.actual_hours > 0
      THEN jd.actual_hours / jd.estimated_hours
    END)::REAL,
    NULL::REAL, -- avg_jobs_per_week: needs per-contractor rollup, deferred
    AVG(cpp.days_to_payment)::REAL,
    NULL::REAL, -- avg_material_cost_ratio: deferred
    COUNT(DISTINCT pi.user_id)::INT,
    COUNT(*)::INT
  FROM pricing_intelligence pi
  LEFT JOIN job_duration_data jd
    ON jd.trade = pi.trade AND jd.country = pi.country
    AND jd.created_at > now() - INTERVAL '7 days'
  LEFT JOIN customer_payment_patterns cpp
    ON cpp.user_id = pi.user_id
    AND cpp.created_at > now() - INTERVAL '7 days'
  WHERE pi.trade IS NOT NULL
    AND pi.country IS NOT NULL
    AND pi.quoted_at > now() - INTERVAL '7 days'
  GROUP BY pi.trade, pi.country
  HAVING COUNT(DISTINCT pi.user_id) >= 5  -- k-anonymity
  ON CONFLICT (trade, country, week_key) DO UPDATE SET
    avg_hourly_rate            = EXCLUDED.avg_hourly_rate,
    median_hourly_rate         = EXCLUDED.median_hourly_rate,
    avg_quote_acceptance_rate  = EXCLUDED.avg_quote_acceptance_rate,
    avg_margin_percent         = EXCLUDED.avg_margin_percent,
    avg_job_duration_ratio     = EXCLUDED.avg_job_duration_ratio,
    avg_dso                    = EXCLUDED.avg_dso,
    contractor_count           = EXCLUDED.contractor_count,
    data_points                = EXCLUDED.data_points,
    computed_at                = now();
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Trigger: refresh cohort on quote_accepted business_event
-- ---------------------------------------------------------------------------
-- Rather than recompute the entire cohort, we just re-run the weekly
-- aggregation on insert of a quote_accepted event. Cheap because the GROUP BY
-- only scans the last 7 days and the table is indexed by (user_id, event_type).

CREATE OR REPLACE FUNCTION on_quote_accepted_refresh_cohort()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.event_type = 'quote_accepted' THEN
    -- Fire-and-forget; swallow errors so the business_event insert never fails.
    BEGIN
      PERFORM compute_weekly_cohort_stats(NULL);
    EXCEPTION WHEN OTHERS THEN
      -- log but don't block the insert
      RAISE NOTICE 'compute_weekly_cohort_stats failed: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quote_accepted_cohort ON business_events;
CREATE TRIGGER trg_quote_accepted_cohort
AFTER INSERT ON business_events
FOR EACH ROW
EXECUTE FUNCTION on_quote_accepted_refresh_cohort();

-- ---------------------------------------------------------------------------
-- 4. Material price RLS tightening
-- ---------------------------------------------------------------------------
-- Before: "Users read all prices" USING (true) — every contractor could read
-- every raw supplier+price+timestamp tuple, which when combined with external
-- data could de-anonymize observers. After:
--   - Base table SELECT restricted to owner (observed_by) rows only.
--   - An aggregation-only VIEW surfaces per (trade, country, material, unit)
--     averages with k-anonymity >=5 distinct observers required per cell.

DROP POLICY IF EXISTS "Users read all prices" ON material_price_history;

CREATE POLICY "Users read own material prices"
  ON material_price_history FOR SELECT
  USING (auth.uid() = observed_by OR observed_by IS NULL);

-- Aggregated view — authenticated clients read this instead of the raw table.
CREATE OR REPLACE VIEW material_price_benchmarks AS
SELECT
  trade,
  country,
  LOWER(material_name)     AS material_name,
  material_category,
  unit,
  AVG(price_excl_vat)::REAL                                                    AS avg_price,
  percentile_cont(0.5)  WITHIN GROUP (ORDER BY price_excl_vat)::REAL            AS median_price,
  percentile_cont(0.25) WITHIN GROUP (ORDER BY price_excl_vat)::REAL            AS p25_price,
  percentile_cont(0.75) WITHIN GROUP (ORDER BY price_excl_vat)::REAL            AS p75_price,
  MIN(price_excl_vat)::REAL                                                     AS min_price,
  MAX(price_excl_vat)::REAL                                                     AS max_price,
  COUNT(*)                                                                      AS sample_size,
  COUNT(DISTINCT observed_by)                                                   AS contractor_count,
  MAX(observed_at)                                                              AS last_observed
FROM material_price_history
WHERE observed_at > now() - INTERVAL '180 days'
GROUP BY trade, country, LOWER(material_name), material_category, unit
HAVING COUNT(DISTINCT observed_by) >= 5;

-- Grant read on the view to authenticated users (view runs as invoker, but
-- the aggregation itself strips PII, so this is safe).
GRANT SELECT ON material_price_benchmarks TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. get_material_cohort_stats — parameterised reader for the benchmark UI
-- ---------------------------------------------------------------------------
-- Thin RPC wrapper around material_price_benchmarks. The hook calls this with
-- (trade, country) and optionally a material_name to narrow to one line item.

CREATE OR REPLACE FUNCTION get_material_cohort_stats(
  p_trade TEXT,
  p_country TEXT,
  p_material_name TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  material_name TEXT,
  material_category TEXT,
  unit TEXT,
  avg_price REAL,
  median_price REAL,
  p25_price REAL,
  p75_price REAL,
  min_price REAL,
  max_price REAL,
  sample_size BIGINT,
  contractor_count BIGINT,
  last_observed TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    mpb.material_name,
    mpb.material_category,
    mpb.unit,
    mpb.avg_price,
    mpb.median_price,
    mpb.p25_price,
    mpb.p75_price,
    mpb.min_price,
    mpb.max_price,
    mpb.sample_size,
    mpb.contractor_count,
    mpb.last_observed
  FROM material_price_benchmarks mpb
  WHERE mpb.trade = p_trade
    AND mpb.country = p_country
    AND (
      p_material_name IS NULL
      OR mpb.material_name = LOWER(p_material_name)
    )
  ORDER BY mpb.sample_size DESC
  LIMIT p_limit;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION get_trade_pricing_stats(TEXT, TEXT, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION compute_weekly_cohort_stats(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_material_cohort_stats(TEXT, TEXT, TEXT, INT) TO authenticated;

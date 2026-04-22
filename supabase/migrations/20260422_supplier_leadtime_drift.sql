-- =============================================================================
-- R204 — SUPPLIER LEAD-TIME DRIFT: supply-chain stress signal per supplier
-- =============================================================================
-- Uses lead_time_days on material_price_history. Per-supplier recent vs
-- baseline median comparison flags supply-chain stress (lead times
-- lengthening) or recovery (shortening) — a leading indicator for
-- scheduling buffers and re-quote timing.
--
-- K-anonymity ≥3 distinct observers per supplier cell (matches material
-- drift — supplier cells are naturally thinner than trade+country cells).
--
-- SCHEMA STABILITY: zero table changes, one new RPC, CREATE OR REPLACE.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_supplier_leadtime_drift(
  p_trade TEXT,
  p_country TEXT,
  p_recent_days INT DEFAULT 30,
  p_baseline_days INT DEFAULT 90,
  p_min_drift_days REAL DEFAULT 1.0
)
RETURNS TABLE (
  supplier_id TEXT,
  supplier_name TEXT,
  baseline_days REAL,
  recent_days REAL,
  drift_days REAL,
  recent_sample_size BIGINT,
  baseline_sample_size BIGINT,
  recent_observer_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH baseline AS (
    SELECT
      mph.supplier_id,
      MIN(mph.supplier_name) AS supplier_name,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY mph.lead_time_days)::REAL
                             AS median_days,
      COUNT(*)               AS sample_size,
      COUNT(DISTINCT mph.observed_by) AS observer_count
    FROM material_price_history mph
    WHERE mph.trade = p_trade
      AND mph.country = p_country
      AND mph.lead_time_days IS NOT NULL
      AND mph.observed_at <  now() - (p_recent_days  || ' days')::INTERVAL
      AND mph.observed_at >= now() - (p_baseline_days || ' days')::INTERVAL
    GROUP BY mph.supplier_id
  ),
  recent AS (
    SELECT
      mph.supplier_id,
      MIN(mph.supplier_name) AS supplier_name,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY mph.lead_time_days)::REAL
                             AS median_days,
      COUNT(*)               AS sample_size,
      COUNT(DISTINCT mph.observed_by) AS observer_count
    FROM material_price_history mph
    WHERE mph.trade = p_trade
      AND mph.country = p_country
      AND mph.lead_time_days IS NOT NULL
      AND mph.observed_at >= now() - (p_recent_days || ' days')::INTERVAL
    GROUP BY mph.supplier_id
  )
  SELECT
    r.supplier_id,
    r.supplier_name,
    b.median_days::REAL  AS baseline_days,
    r.median_days::REAL  AS recent_days,
    (r.median_days - b.median_days)::REAL AS drift_days,
    r.sample_size::BIGINT      AS recent_sample_size,
    COALESCE(b.sample_size, 0)::BIGINT AS baseline_sample_size,
    r.observer_count::BIGINT   AS recent_observer_count
  FROM recent r
  LEFT JOIN baseline b ON r.supplier_id = b.supplier_id
  WHERE b.median_days IS NOT NULL
    AND ABS(r.median_days - b.median_days) >= p_min_drift_days
    AND r.observer_count >= 3
    AND b.sample_size >= 3
  ORDER BY ABS(r.median_days - b.median_days) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION
  get_supplier_leadtime_drift(TEXT, TEXT, INT, INT, REAL)
  TO authenticated;

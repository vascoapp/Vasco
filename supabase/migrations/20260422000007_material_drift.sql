-- =============================================================================
-- R192 — MATERIAL DRIFT: detect supplier + market-wide price movements
-- =============================================================================
-- Compares a recent-window median price against a baseline-window median per
-- (material, supplier) cell, surfaces significant drifts (|Δ| >= 5%) with
-- a flag indicating whether the drift is market-wide (every supplier for
-- the same material moved the same direction) vs supplier-specific.
--
-- This is additive to R187's material_price_benchmarks view — that one
-- answers "what's the market rate right now?"; this one answers "did it
-- change, and who moved?"
--
-- SCHEMA STABILITY: no table changes, no column changes. Single new RPC,
-- CREATE OR REPLACE. K-anonymity gate ≥3 distinct observers per supplier+
-- material cell (lower than cohort's 5 because supplier slices are thinner
-- and we still don't expose per-contractor detail).
-- =============================================================================

CREATE OR REPLACE FUNCTION get_material_drift(
  p_trade TEXT,
  p_country TEXT,
  p_recent_days INT DEFAULT 30,
  p_baseline_days INT DEFAULT 90,
  p_min_drift_pct REAL DEFAULT 5.0
)
RETURNS TABLE (
  material_name TEXT,
  material_category TEXT,
  unit TEXT,
  supplier_id TEXT,
  supplier_name TEXT,
  baseline_price REAL,
  recent_price REAL,
  drift_pct REAL,
  recent_sample_size BIGINT,
  baseline_sample_size BIGINT,
  recent_observer_count BIGINT,
  is_market_wide BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH baseline AS (
    SELECT
      mph.trade,
      mph.country,
      LOWER(mph.material_name)      AS material_name,
      mph.material_category,
      mph.unit,
      mph.supplier_id,
      MIN(mph.supplier_name)        AS supplier_name,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY mph.price_excl_vat)::REAL
                                    AS median_price,
      COUNT(*)                      AS sample_size,
      COUNT(DISTINCT mph.observed_by) AS observer_count
    FROM material_price_history mph
    WHERE mph.trade = p_trade
      AND mph.country = p_country
      AND mph.observed_at <  now() - (p_recent_days  || ' days')::INTERVAL
      AND mph.observed_at >= now() - (p_baseline_days || ' days')::INTERVAL
    GROUP BY mph.trade, mph.country, LOWER(mph.material_name), mph.material_category, mph.unit, mph.supplier_id
  ),
  recent AS (
    SELECT
      mph.trade,
      mph.country,
      LOWER(mph.material_name)      AS material_name,
      mph.material_category,
      mph.unit,
      mph.supplier_id,
      MIN(mph.supplier_name)        AS supplier_name,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY mph.price_excl_vat)::REAL
                                    AS median_price,
      COUNT(*)                      AS sample_size,
      COUNT(DISTINCT mph.observed_by) AS observer_count
    FROM material_price_history mph
    WHERE mph.trade = p_trade
      AND mph.country = p_country
      AND mph.observed_at >= now() - (p_recent_days || ' days')::INTERVAL
    GROUP BY mph.trade, mph.country, LOWER(mph.material_name), mph.material_category, mph.unit, mph.supplier_id
  ),
  joined AS (
    SELECT
      r.material_name,
      r.material_category,
      r.unit,
      r.supplier_id,
      r.supplier_name,
      b.median_price::REAL  AS baseline_price,
      r.median_price::REAL  AS recent_price,
      CASE
        WHEN b.median_price IS NULL OR b.median_price = 0 THEN NULL
        ELSE (((r.median_price - b.median_price) / b.median_price) * 100.0)::REAL
      END AS drift_pct,
      r.sample_size::BIGINT     AS recent_sample_size,
      COALESCE(b.sample_size, 0)::BIGINT  AS baseline_sample_size,
      r.observer_count::BIGINT  AS recent_observer_count
    FROM recent r
    LEFT JOIN baseline b
      ON  r.material_name = b.material_name
      AND r.supplier_id   = b.supplier_id
      AND r.unit          = b.unit
  ),
  -- Market-wide detection: for each material, count how many suppliers had
  -- drift in the same direction. If every supplier moved up OR every supplier
  -- moved down (and at least 2 suppliers contributed), it's market-wide.
  per_material AS (
    SELECT
      material_name,
      COUNT(*) FILTER (WHERE drift_pct IS NOT NULL) AS suppliers_total,
      COUNT(*) FILTER (WHERE drift_pct IS NOT NULL AND drift_pct > 0) AS suppliers_up,
      COUNT(*) FILTER (WHERE drift_pct IS NOT NULL AND drift_pct < 0) AS suppliers_down
    FROM joined
    GROUP BY material_name
  )
  SELECT
    j.material_name,
    j.material_category,
    j.unit,
    j.supplier_id,
    j.supplier_name,
    j.baseline_price,
    j.recent_price,
    j.drift_pct,
    j.recent_sample_size,
    j.baseline_sample_size,
    j.recent_observer_count,
    (
      pm.suppliers_total >= 2
      AND (
        pm.suppliers_up = pm.suppliers_total
        OR pm.suppliers_down = pm.suppliers_total
      )
    ) AS is_market_wide
  FROM joined j
  JOIN per_material pm ON pm.material_name = j.material_name
  WHERE j.drift_pct IS NOT NULL
    AND ABS(j.drift_pct) >= p_min_drift_pct
    AND j.recent_observer_count >= 3   -- k-anonymity on recent window
    AND j.baseline_sample_size >= 3    -- need comparable baseline
  ORDER BY ABS(j.drift_pct) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION
  get_material_drift(TEXT, TEXT, INT, INT, REAL)
  TO authenticated;

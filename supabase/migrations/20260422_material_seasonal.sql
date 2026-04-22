-- =============================================================================
-- R197 — MATERIAL SEASONAL PATTERNS: cohort median material prices by season
-- =============================================================================
-- Companion to get_seasonal_pattern (quotes). material_price_history has no
-- explicit season column so we derive it from observed_at month:
--   Dec–Feb winter, Mar–May spring, Jun–Aug summer, Sep–Nov autumn.
-- Useful signal: heating/boiler SKUs spike in autumn, paint in spring, etc.
-- K-anonymity ≥5 distinct observers per (season, material) cell.
--
-- SCHEMA STABILITY: zero table changes; one new RPC, CREATE OR REPLACE.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_material_seasonal_pattern(
  p_trade TEXT,
  p_country TEXT,
  p_material_name TEXT DEFAULT NULL,
  p_months INT DEFAULT 18
)
RETURNS TABLE (
  season TEXT,
  material_name TEXT,
  unit TEXT,
  median_price REAL,
  sample_size BIGINT,
  observer_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH bucketed AS (
    SELECT
      CASE
        WHEN EXTRACT(MONTH FROM mph.observed_at) IN (12, 1, 2) THEN 'winter'
        WHEN EXTRACT(MONTH FROM mph.observed_at) IN (3, 4, 5)  THEN 'spring'
        WHEN EXTRACT(MONTH FROM mph.observed_at) IN (6, 7, 8)  THEN 'summer'
        ELSE 'autumn'
      END                       AS season,
      LOWER(mph.material_name)  AS material_name,
      mph.unit,
      mph.price_excl_vat,
      mph.observed_by
    FROM material_price_history mph
    WHERE mph.trade = p_trade
      AND mph.country = p_country
      AND mph.observed_at > now() - (p_months || ' months')::INTERVAL
      AND (p_material_name IS NULL OR LOWER(mph.material_name) = LOWER(p_material_name))
  )
  SELECT
    b.season,
    b.material_name,
    b.unit,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY b.price_excl_vat)::REAL,
    COUNT(*)::BIGINT,
    COUNT(DISTINCT b.observed_by)::BIGINT
  FROM bucketed b
  GROUP BY b.season, b.material_name, b.unit
  HAVING COUNT(DISTINCT b.observed_by) >= 5
  ORDER BY b.material_name, b.season;
END;
$$;

GRANT EXECUTE ON FUNCTION
  get_material_seasonal_pattern(TEXT, TEXT, TEXT, INT)
  TO authenticated;

-- =============================================================================
-- R197 — SEASONAL PATTERNS: per-season acceptance + median price by trade+country
-- =============================================================================
-- The `season` column on pricing_intelligence has been populated since 002
-- but never aggregated. This RPC gives contractors actionable seasonality
-- signal: "winter acceptance in NL plumbing is 12pp below summer — price
-- accordingly." K-anonymity gate ≥5 contractors aggregated across all
-- seasons (thin per-season cells are still meaningful when the overall
-- trade+country cohort is large enough).
--
-- SCHEMA STABILITY: zero table changes, one new RPC, CREATE OR REPLACE.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_seasonal_pattern(
  p_trade TEXT,
  p_country TEXT,
  p_months INT DEFAULT 18
)
RETURNS TABLE (
  season TEXT,
  median_price REAL,
  acceptance_rate REAL,
  sample_size BIGINT,
  contractor_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_contractors BIGINT;
BEGIN
  SELECT COUNT(DISTINCT user_id) INTO v_total_contractors
  FROM pricing_intelligence
  WHERE trade = p_trade
    AND country = p_country
    AND season IS NOT NULL
    AND quoted_at > now() - (p_months || ' months')::INTERVAL;

  IF COALESCE(v_total_contractors, 0) < 5 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    pi.season,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY pi.quoted_unit_price)::REAL,
    (COUNT(*) FILTER (WHERE pi.was_accepted = true))::REAL
      / NULLIF(COUNT(*) FILTER (WHERE pi.was_accepted IS NOT NULL)::REAL, 0),
    COUNT(*),
    COUNT(DISTINCT pi.user_id)
  FROM pricing_intelligence pi
  WHERE pi.trade = p_trade
    AND pi.country = p_country
    AND pi.season IS NOT NULL
    AND pi.quoted_at > now() - (p_months || ' months')::INTERVAL
  GROUP BY pi.season;
END;
$$;

GRANT EXECUTE ON FUNCTION get_seasonal_pattern(TEXT, TEXT, INT) TO authenticated;

-- =============================================================================
-- R202 — COHORT ACCEPT LAG: typical time-to-accept per trade+country
-- =============================================================================
-- Leverages the time_to_decision_hours column R188 added to
-- pricing_intelligence. Answers: "for NL plumbing, the cohort median
-- accept-lag is 72h — your customer has been sitting at 180h, send a
-- follow-up." Complements the cohort benchmark + seasonality dimensions.
--
-- K-anonymity ≥5 distinct contractors. Filters to accepted quotes only
-- (time_to_decision_hours on rejected quotes is a different distribution
-- and we don't want to mix them).
--
-- SCHEMA STABILITY: zero table changes; one new RPC, CREATE OR REPLACE.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_cohort_accept_lag(
  p_trade TEXT,
  p_country TEXT,
  p_customer_type TEXT DEFAULT NULL,
  p_months INT DEFAULT 12
)
RETURNS TABLE (
  p25_hours REAL,
  median_hours REAL,
  p75_hours REAL,
  avg_hours REAL,
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
  SELECT COUNT(DISTINCT user_id) INTO v_contractors
  FROM pricing_intelligence
  WHERE trade = p_trade
    AND country = p_country
    AND was_accepted = true
    AND time_to_decision_hours IS NOT NULL
    AND time_to_decision_hours >= 0
    AND (p_customer_type IS NULL OR customer_type = p_customer_type)
    AND quoted_at > now() - (p_months || ' months')::INTERVAL;

  IF COALESCE(v_contractors, 0) < 5 THEN
    RETURN QUERY SELECT
      NULL::REAL, NULL::REAL, NULL::REAL, NULL::REAL,
      0::BIGINT, COALESCE(v_contractors, 0);
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    percentile_cont(0.25) WITHIN GROUP (ORDER BY time_to_decision_hours)::REAL,
    percentile_cont(0.5)  WITHIN GROUP (ORDER BY time_to_decision_hours)::REAL,
    percentile_cont(0.75) WITHIN GROUP (ORDER BY time_to_decision_hours)::REAL,
    AVG(time_to_decision_hours)::REAL,
    COUNT(*),
    v_contractors
  FROM pricing_intelligence
  WHERE trade = p_trade
    AND country = p_country
    AND was_accepted = true
    AND time_to_decision_hours IS NOT NULL
    AND time_to_decision_hours >= 0
    AND (p_customer_type IS NULL OR customer_type = p_customer_type)
    AND quoted_at > now() - (p_months || ' months')::INTERVAL;
END;
$$;

GRANT EXECUTE ON FUNCTION
  get_cohort_accept_lag(TEXT, TEXT, TEXT, INT)
  TO authenticated;

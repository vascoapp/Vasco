-- =============================================================================
-- R195 — COHORT DSO: fill the "new customer, no history" void
-- =============================================================================
-- predictPaymentTiming currently falls back to a hardcoded 21-day default
-- when the contractor has no invoicePatterns. The cohort already has
-- customer_payment_patterns rows across every contractor; aggregate per
-- (country, customer_type) to give new contractors a meaningful DSO signal
-- on day one.
--
-- SCHEMA STABILITY: zero table changes; one new RPC, CREATE OR REPLACE.
-- K-anonymity ≥5 distinct contractors per (country, customer_type) cell.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_cohort_dso(
  p_country TEXT,
  p_customer_type TEXT DEFAULT NULL,
  p_months INT DEFAULT 12
)
RETURNS TABLE (
  median_dso REAL,
  avg_dso REAL,
  on_time_rate REAL,
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
  FROM customer_payment_patterns
  WHERE customer_region = p_country OR customer_region IS NULL -- region column is used as country proxy in some rows
    AND (p_customer_type IS NULL OR customer_type = p_customer_type)
    AND payment_date IS NOT NULL
    AND created_at > now() - (p_months || ' months')::INTERVAL;

  IF COALESCE(v_contractors, 0) < 5 THEN
    RETURN QUERY SELECT NULL::REAL, NULL::REAL, NULL::REAL, 0::BIGINT, COALESCE(v_contractors, 0);
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    percentile_cont(0.5) WITHIN GROUP (ORDER BY days_to_payment)::REAL,
    AVG(days_to_payment)::REAL,
    (COUNT(*) FILTER (WHERE NOT was_overdue))::REAL / NULLIF(COUNT(*)::REAL, 0),
    COUNT(*),
    v_contractors
  FROM customer_payment_patterns
  WHERE (customer_region = p_country OR customer_region IS NULL)
    AND (p_customer_type IS NULL OR customer_type = p_customer_type)
    AND payment_date IS NOT NULL
    AND created_at > now() - (p_months || ' months')::INTERVAL;
END;
$$;

GRANT EXECUTE ON FUNCTION get_cohort_dso(TEXT, TEXT, INT) TO authenticated;

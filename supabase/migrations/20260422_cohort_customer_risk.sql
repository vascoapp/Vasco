-- =============================================================================
-- R201 — COHORT CUSTOMER RISK: overdue baseline per (country, customer_type)
-- =============================================================================
-- Personal customer-risk scoring needs history. For a brand-new customer
-- the contractor has no signal — and a 0% placeholder is actively
-- misleading. This RPC gives the cohort's overdue rate + average
-- reminder count for that customer segment, so even first-time customers
-- have a grounded prior.
--
-- K-anonymity ≥5 distinct contractors per (country, customer_type) cell.
-- Companion to R195's get_cohort_dso; together they cover the
-- "payment experience" dimension for new customers.
--
-- SCHEMA STABILITY: zero table changes, one new RPC, CREATE OR REPLACE.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_cohort_overdue_rate(
  p_country TEXT,
  p_customer_type TEXT DEFAULT NULL,
  p_months INT DEFAULT 12
)
RETURNS TABLE (
  overdue_rate REAL,
  avg_reminders_sent REAL,
  avg_days_to_payment REAL,
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
  WHERE (customer_region = p_country OR customer_region IS NULL)
    AND (p_customer_type IS NULL OR customer_type = p_customer_type)
    AND was_overdue IS NOT NULL
    AND created_at > now() - (p_months || ' months')::INTERVAL;

  IF COALESCE(v_contractors, 0) < 5 THEN
    RETURN QUERY SELECT
      NULL::REAL, NULL::REAL, NULL::REAL,
      0::BIGINT, COALESCE(v_contractors, 0);
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    (COUNT(*) FILTER (WHERE was_overdue = true))::REAL
      / NULLIF(COUNT(*)::REAL, 0),
    AVG(COALESCE(reminders_sent, 0))::REAL,
    AVG(NULLIF(days_to_payment, 0))::REAL,
    COUNT(*),
    v_contractors
  FROM customer_payment_patterns
  WHERE (customer_region = p_country OR customer_region IS NULL)
    AND (p_customer_type IS NULL OR customer_type = p_customer_type)
    AND was_overdue IS NOT NULL
    AND created_at > now() - (p_months || ' months')::INTERVAL;
END;
$$;

GRANT EXECUTE ON FUNCTION
  get_cohort_overdue_rate(TEXT, TEXT, INT)
  TO authenticated;

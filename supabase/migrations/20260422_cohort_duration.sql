-- =============================================================================
-- R196 — COHORT JOB DURATION: fill the "no prior jobs" void
-- =============================================================================
-- predictJobDuration currently falls back to a hardcoded 1.15 ratio
-- (contractors typically underestimate by 15%) when the user has fewer than
-- 3 completed jobs in the trade. The cohort already has job_duration_data
-- rows; aggregate per (trade, job_type) so new contractors get a
-- trade-specific ratio on day one.
--
-- SCHEMA STABILITY: no table changes; one new RPC, CREATE OR REPLACE.
-- K-anonymity ≥5 distinct contractors.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_cohort_job_duration(
  p_trade TEXT,
  p_job_type TEXT DEFAULT NULL,
  p_months INT DEFAULT 12
)
RETURNS TABLE (
  median_ratio REAL,
  avg_ratio REAL,
  scope_change_rate REAL,
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
  FROM job_duration_data
  WHERE trade = p_trade
    AND (p_job_type IS NULL OR job_type = p_job_type)
    AND estimated_hours > 0
    AND actual_hours > 0
    AND created_at > now() - (p_months || ' months')::INTERVAL;

  IF COALESCE(v_contractors, 0) < 5 THEN
    RETURN QUERY SELECT NULL::REAL, NULL::REAL, NULL::REAL, 0::BIGINT, COALESCE(v_contractors, 0);
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    percentile_cont(0.5) WITHIN GROUP (ORDER BY (actual_hours / estimated_hours))::REAL,
    AVG(actual_hours / estimated_hours)::REAL,
    (COUNT(*) FILTER (WHERE actual_hours > estimated_hours * 1.3))::REAL
      / NULLIF(COUNT(*)::REAL, 0),
    COUNT(*),
    v_contractors
  FROM job_duration_data
  WHERE trade = p_trade
    AND (p_job_type IS NULL OR job_type = p_job_type)
    AND estimated_hours > 0
    AND actual_hours > 0
    AND created_at > now() - (p_months || ' months')::INTERVAL;
END;
$$;

GRANT EXECUTE ON FUNCTION get_cohort_job_duration(TEXT, TEXT, INT) TO authenticated;

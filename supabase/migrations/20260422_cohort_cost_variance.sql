-- =============================================================================
-- R203 — COHORT COST VARIANCE: actual_cost vs quoted_total on completed jobs
-- =============================================================================
-- Answers: "on NL plumbing jobs, the cohort lands at 92% of quoted cost —
-- you are landing at 105%, materials or hours are bleeding." Leverages
-- actual_cost + quoted_total columns already on pricing_intelligence.
--
-- K-anonymity ≥5 distinct contractors. Only rows where both quoted_total
-- and actual_cost are positive are considered (rejected quotes and
-- unfinished jobs are excluded).
--
-- SCHEMA STABILITY: zero table changes, one new RPC, CREATE OR REPLACE.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_cohort_cost_variance(
  p_trade TEXT,
  p_country TEXT,
  p_job_type TEXT DEFAULT NULL,
  p_months INT DEFAULT 12
)
RETURNS TABLE (
  median_ratio REAL,
  avg_ratio REAL,
  p25_ratio REAL,
  p75_ratio REAL,
  overrun_rate REAL,  -- % of jobs where actual_cost > quoted_total
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
    AND (p_job_type IS NULL OR job_type = p_job_type)
    AND quoted_total > 0
    AND actual_cost > 0
    AND completed_at IS NOT NULL
    AND completed_at > now() - (p_months || ' months')::INTERVAL;

  IF COALESCE(v_contractors, 0) < 5 THEN
    RETURN QUERY SELECT
      NULL::REAL, NULL::REAL, NULL::REAL, NULL::REAL, NULL::REAL,
      0::BIGINT, COALESCE(v_contractors, 0);
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    percentile_cont(0.5)  WITHIN GROUP (ORDER BY (actual_cost / quoted_total))::REAL,
    AVG(actual_cost / quoted_total)::REAL,
    percentile_cont(0.25) WITHIN GROUP (ORDER BY (actual_cost / quoted_total))::REAL,
    percentile_cont(0.75) WITHIN GROUP (ORDER BY (actual_cost / quoted_total))::REAL,
    (COUNT(*) FILTER (WHERE actual_cost > quoted_total))::REAL
      / NULLIF(COUNT(*)::REAL, 0),
    COUNT(*),
    v_contractors
  FROM pricing_intelligence
  WHERE trade = p_trade
    AND country = p_country
    AND (p_job_type IS NULL OR job_type = p_job_type)
    AND quoted_total > 0
    AND actual_cost > 0
    AND completed_at IS NOT NULL
    AND completed_at > now() - (p_months || ' months')::INTERVAL;
END;
$$;

GRANT EXECUTE ON FUNCTION
  get_cohort_cost_variance(TEXT, TEXT, TEXT, INT)
  TO authenticated;

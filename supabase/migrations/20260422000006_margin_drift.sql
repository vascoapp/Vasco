-- =============================================================================
-- R200 — MARGIN DRIFT: detect cohort margin compression / expansion
-- =============================================================================
-- Compares recent-window median margin_percent against a baseline-window
-- median per (trade, country, contractor_segment?) cell. Tells the
-- contractor whether their trade's margins are compressing — a leading
-- indicator of "raise prices now" or "something is wrong market-wide".
--
-- K-anonymity ≥5 distinct contractors in EACH window, not just overall —
-- margin signal is more PII-sensitive than price signal (reveals
-- profitability).
--
-- SCHEMA STABILITY: zero table changes, one new RPC, CREATE OR REPLACE.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_margin_drift(
  p_trade TEXT,
  p_country TEXT,
  p_recent_days INT DEFAULT 30,
  p_baseline_days INT DEFAULT 90,
  p_min_drift_pp REAL DEFAULT 2.0
)
RETURNS TABLE (
  recent_median_margin REAL,
  baseline_median_margin REAL,
  drift_pp REAL,
  recent_sample_size BIGINT,
  baseline_sample_size BIGINT,
  recent_contractor_count BIGINT,
  baseline_contractor_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent_median REAL;
  v_baseline_median REAL;
  v_recent_samples BIGINT;
  v_baseline_samples BIGINT;
  v_recent_contractors BIGINT;
  v_baseline_contractors BIGINT;
  v_drift_pp REAL;
BEGIN
  SELECT
    percentile_cont(0.5) WITHIN GROUP (ORDER BY margin_percent)::REAL,
    COUNT(*)::BIGINT,
    COUNT(DISTINCT user_id)::BIGINT
  INTO v_recent_median, v_recent_samples, v_recent_contractors
  FROM pricing_intelligence
  WHERE trade = p_trade
    AND country = p_country
    AND margin_percent IS NOT NULL
    AND quoted_at >= now() - (p_recent_days || ' days')::INTERVAL;

  SELECT
    percentile_cont(0.5) WITHIN GROUP (ORDER BY margin_percent)::REAL,
    COUNT(*)::BIGINT,
    COUNT(DISTINCT user_id)::BIGINT
  INTO v_baseline_median, v_baseline_samples, v_baseline_contractors
  FROM pricing_intelligence
  WHERE trade = p_trade
    AND country = p_country
    AND margin_percent IS NOT NULL
    AND quoted_at <  now() - (p_recent_days  || ' days')::INTERVAL
    AND quoted_at >= now() - (p_baseline_days || ' days')::INTERVAL;

  -- K-anonymity gate: both windows must have ≥5 distinct contractors.
  IF COALESCE(v_recent_contractors, 0) < 5
     OR COALESCE(v_baseline_contractors, 0) < 5 THEN
    RETURN;
  END IF;

  -- No meaningful baseline means no drift to report.
  IF v_baseline_median IS NULL THEN
    RETURN;
  END IF;

  v_drift_pp := COALESCE(v_recent_median, 0) - v_baseline_median;

  -- Suppress rows below the noise threshold.
  IF ABS(v_drift_pp) < p_min_drift_pp THEN
    RETURN;
  END IF;

  RETURN QUERY SELECT
    v_recent_median,
    v_baseline_median,
    v_drift_pp,
    v_recent_samples,
    v_baseline_samples,
    v_recent_contractors,
    v_baseline_contractors;
END;
$$;

GRANT EXECUTE ON FUNCTION
  get_margin_drift(TEXT, TEXT, INT, INT, REAL)
  TO authenticated;

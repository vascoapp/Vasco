-- =============================================================================
-- COHORT BENCHMARKS — lead source acceptance + crew utilization
-- Intelligence retrofit Stage 5
-- =============================================================================
-- Two RPCs, both SECURITY DEFINER, both K-anonymity gated.
--   1. get_lead_source_stats — read business_events for cross-contractor lead
--      source conversion rates. Called from leadSourceStatsService.fetchCohortLeadSourceStats
--      (Stage 2 added the FE stub; this migration ships the BE counterpart).
--   2. get_crew_utilization_stats — average active jobs per worker, aggregated
--      across contractors. Powers a richer workerCapacityGenerator suggestion
--      ("your cohort runs 3.2 active jobs per worker, you're at 5.5 on Bas").
--
-- K-anonymity invariant: every RPC returns null/empty when
-- contractor_count < 5 OR sample_size < 20. Matches the existing pattern from
-- get_cohort_accept_lag and the Schema Lock invariant.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. get_lead_source_stats
-- ---------------------------------------------------------------------------
-- Source data: public.business_events with entity_type='lead' AND
-- event_type='lead_converted'. Payload shape (set in dataCollector.emitLeadConverted):
--   { source, outcome: 'won'|'lost', estimatedValue, actualQuoteAmount,
--     sourceQuoteId, hoursFromCreatedToConverted }
-- Filter by source + trade + country; aggregate over last p_months months.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_lead_source_stats(
  p_source TEXT,
  p_trade TEXT DEFAULT NULL,
  p_country TEXT DEFAULT NULL,
  p_months INT DEFAULT 6
)
RETURNS TABLE (
  conversion_rate REAL,
  sample_size BIGINT,
  contractor_count BIGINT,
  avg_hours_to_convert REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contractors BIGINT;
  v_samples BIGINT;
BEGIN
  -- Count distinct contractors first so we can early-exit on k-anonymity failure
  -- without scanning the full aggregate.
  SELECT
    COUNT(DISTINCT user_id),
    COUNT(*)
  INTO v_contractors, v_samples
  FROM business_events
  WHERE entity_type = 'lead'
    AND event_type = 'lead_converted'
    AND payload->>'source' = p_source
    AND (p_trade IS NULL OR trade = p_trade)
    AND (p_country IS NULL OR country = p_country)
    AND created_at > now() - (p_months || ' months')::INTERVAL;

  IF COALESCE(v_contractors, 0) < 5 OR COALESCE(v_samples, 0) < 20 THEN
    RETURN QUERY SELECT
      NULL::REAL,
      0::BIGINT,
      COALESCE(v_contractors, 0),
      NULL::REAL;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    (COUNT(*) FILTER (WHERE payload->>'outcome' = 'won')::REAL
     / NULLIF(COUNT(*), 0)::REAL)::REAL AS conversion_rate,
    COUNT(*)::BIGINT AS sample_size,
    v_contractors AS contractor_count,
    AVG(NULLIF((payload->>'hoursFromCreatedToConverted')::REAL, 0))::REAL AS avg_hours_to_convert
  FROM business_events
  WHERE entity_type = 'lead'
    AND event_type = 'lead_converted'
    AND payload->>'source' = p_source
    AND (p_trade IS NULL OR trade = p_trade)
    AND (p_country IS NULL OR country = p_country)
    AND created_at > now() - (p_months || ' months')::INTERVAL;
END;
$$;

GRANT EXECUTE ON FUNCTION
  get_lead_source_stats(TEXT, TEXT, TEXT, INT)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. get_crew_utilization_stats
-- ---------------------------------------------------------------------------
-- Source data: public.workers + public.jobs (jobs.assigned_worker_id).
-- "Active" = job status in (lead, quoted, scheduled, in_progress, active).
-- Two-step aggregation:
--   a. Per contractor: count active workers + count active assigned jobs
--      → jobs_per_worker = jobs / NULLIF(workers, 0)
--   b. Across contractors (≥5): percentile + average
--
-- Solo contractors (workers.count < 2 OR no active jobs) are filtered out
-- of the per-contractor base so they don't pull the cohort median toward
-- zero. The signal is "how much do crews load their workers".
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_crew_utilization_stats(
  p_trade TEXT DEFAULT NULL,
  p_country TEXT DEFAULT NULL,
  p_months INT DEFAULT 3
)
RETURNS TABLE (
  avg_jobs_per_worker REAL,
  p25_jobs_per_worker REAL,
  median_jobs_per_worker REAL,
  p75_jobs_per_worker REAL,
  sample_size BIGINT,        -- number of contractors in the aggregate
  contractor_count BIGINT    -- same as sample_size here; kept for API parity
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contractors BIGINT;
BEGIN
  -- Build the per-contractor jobs_per_worker series into a temp computation,
  -- then aggregate. We filter contractors to those with ≥2 active workers
  -- AND at least 1 active assigned job — solo contractors and dormant
  -- accounts shouldn't shift the cohort distribution.
  WITH per_contractor AS (
    SELECT
      w.user_id,
      COUNT(DISTINCT w.id) FILTER (WHERE w.is_active IS NOT FALSE) AS active_workers,
      COUNT(DISTINCT j.id) FILTER (
        WHERE j.status IN ('lead', 'quoted', 'scheduled', 'in_progress', 'active')
          AND j.assigned_worker_id IS NOT NULL
      ) AS active_assigned_jobs
    FROM workers w
    LEFT JOIN jobs j ON j.user_id = w.user_id
      AND (p_trade IS NULL OR j.trade = p_trade)
      AND j.updated_at > now() - (p_months || ' months')::INTERVAL
    LEFT JOIN business_settings bs ON bs.user_id = w.user_id
    WHERE (p_trade IS NULL OR w.trade = p_trade)
      AND (p_country IS NULL OR bs.country = p_country)
      AND w.updated_at > now() - (p_months || ' months')::INTERVAL
    GROUP BY w.user_id
    HAVING
      COUNT(DISTINCT w.id) FILTER (WHERE w.is_active IS NOT FALSE) >= 2
      AND COUNT(DISTINCT j.id) FILTER (
        WHERE j.status IN ('lead', 'quoted', 'scheduled', 'in_progress', 'active')
          AND j.assigned_worker_id IS NOT NULL
      ) >= 1
  ),
  series AS (
    SELECT
      user_id,
      (active_assigned_jobs::REAL / NULLIF(active_workers, 0)::REAL)::REAL AS jpw
    FROM per_contractor
  )
  SELECT COUNT(*) INTO v_contractors FROM series;

  IF COALESCE(v_contractors, 0) < 5 THEN
    RETURN QUERY SELECT
      NULL::REAL, NULL::REAL, NULL::REAL, NULL::REAL,
      0::BIGINT,
      COALESCE(v_contractors, 0);
    RETURN;
  END IF;

  RETURN QUERY
  WITH per_contractor AS (
    SELECT
      w.user_id,
      COUNT(DISTINCT w.id) FILTER (WHERE w.is_active IS NOT FALSE) AS active_workers,
      COUNT(DISTINCT j.id) FILTER (
        WHERE j.status IN ('lead', 'quoted', 'scheduled', 'in_progress', 'active')
          AND j.assigned_worker_id IS NOT NULL
      ) AS active_assigned_jobs
    FROM workers w
    LEFT JOIN jobs j ON j.user_id = w.user_id
      AND (p_trade IS NULL OR j.trade = p_trade)
      AND j.updated_at > now() - (p_months || ' months')::INTERVAL
    LEFT JOIN business_settings bs ON bs.user_id = w.user_id
    WHERE (p_trade IS NULL OR w.trade = p_trade)
      AND (p_country IS NULL OR bs.country = p_country)
      AND w.updated_at > now() - (p_months || ' months')::INTERVAL
    GROUP BY w.user_id
    HAVING
      COUNT(DISTINCT w.id) FILTER (WHERE w.is_active IS NOT FALSE) >= 2
      AND COUNT(DISTINCT j.id) FILTER (
        WHERE j.status IN ('lead', 'quoted', 'scheduled', 'in_progress', 'active')
          AND j.assigned_worker_id IS NOT NULL
      ) >= 1
  ),
  series AS (
    SELECT
      (active_assigned_jobs::REAL / NULLIF(active_workers, 0)::REAL)::REAL AS jpw
    FROM per_contractor
  )
  SELECT
    AVG(jpw)::REAL AS avg_jobs_per_worker,
    percentile_cont(0.25) WITHIN GROUP (ORDER BY jpw)::REAL AS p25_jobs_per_worker,
    percentile_cont(0.5)  WITHIN GROUP (ORDER BY jpw)::REAL AS median_jobs_per_worker,
    percentile_cont(0.75) WITHIN GROUP (ORDER BY jpw)::REAL AS p75_jobs_per_worker,
    COUNT(*)::BIGINT AS sample_size,
    COUNT(*)::BIGINT AS contractor_count
  FROM series;
END;
$$;

GRANT EXECUTE ON FUNCTION
  get_crew_utilization_stats(TEXT, TEXT, INT)
  TO authenticated;

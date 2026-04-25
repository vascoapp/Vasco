-- =============================================================================
-- R224 — RETENTION COHORTS: week-by-week cohort retention from business_events
-- =============================================================================
-- Anchor point: each user's `signup_completed` event defines their cohort
-- (ISO week of signup). The user is "retained in week W+N" if they have ANY
-- business_event in that ISO week.
--
-- Returned shape is long-form: one row per (cohort_week, weeks_since_signup).
-- Client code pivots into a grid. This is easier to extend later with more
-- filters (country, trade, tier) without changing the wire format.
--
-- SCHEMA STABILITY: no table changes, one new RPC, CREATE OR REPLACE.
-- Admin-only access — function is SECURITY DEFINER and GRANT'd only to
-- service_role so contractor-scoped JWTs can't read other users' activity.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_signup_cohort_retention(
  p_weeks_back INT DEFAULT 12,
  p_max_week_offset INT DEFAULT 12,
  p_country TEXT DEFAULT NULL,
  p_trade TEXT DEFAULT NULL
)
RETURNS TABLE (
  cohort_week TEXT,          -- e.g. '2026-W15'
  cohort_size INT,           -- distinct users signed up that week
  weeks_since_signup INT,    -- 0, 1, 2, ...
  active_users INT,          -- distinct users from the cohort active that week-offset
  retention_pct REAL         -- active_users / cohort_size
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH signups AS (
    SELECT DISTINCT
      be.user_id,
      to_char(date_trunc('week', be.created_at), 'IYYY-"W"IW') AS cohort_week,
      date_trunc('week', be.created_at) AS cohort_start
    FROM business_events be
    WHERE be.event_type = 'signup_completed'
      AND be.created_at >= now() - (p_weeks_back || ' weeks')::INTERVAL
      AND (p_country IS NULL OR be.country = p_country)
      AND (p_trade   IS NULL OR be.trade   = p_trade)
  ),
  cohort_sizes AS (
    SELECT cohort_week, cohort_start, COUNT(DISTINCT user_id)::INT AS cohort_size
    FROM signups
    GROUP BY cohort_week, cohort_start
  ),
  activity AS (
    -- For each signup-user, find the distinct ISO weeks they had activity.
    SELECT
      s.user_id,
      s.cohort_week,
      s.cohort_start,
      GREATEST(
        0,
        FLOOR(EXTRACT(EPOCH FROM date_trunc('week', be.created_at) - s.cohort_start) / 604800)
      )::INT AS weeks_since_signup
    FROM signups s
    JOIN business_events be
      ON be.user_id = s.user_id
     AND be.created_at >= s.cohort_start
     AND be.created_at <  s.cohort_start + ((p_max_week_offset + 1) || ' weeks')::INTERVAL
  )
  SELECT
    a.cohort_week,
    cs.cohort_size,
    a.weeks_since_signup,
    COUNT(DISTINCT a.user_id)::INT AS active_users,
    (COUNT(DISTINCT a.user_id)::REAL / NULLIF(cs.cohort_size, 0)::REAL) AS retention_pct
  FROM activity a
  JOIN cohort_sizes cs ON cs.cohort_week = a.cohort_week
  WHERE a.weeks_since_signup <= p_max_week_offset
  GROUP BY a.cohort_week, cs.cohort_size, a.weeks_since_signup
  ORDER BY a.cohort_week DESC, a.weeks_since_signup ASC;
END;
$$;

-- Grant to authenticated + service_role. Returned rows are cohort-level
-- aggregates only (no user_id, no names) so the exposure is limited even
-- if a non-admin authenticated client invokes it. The admin dashboard
-- calls it via the anon-key SupabaseClient; the contractor app never
-- calls it at all.
GRANT EXECUTE ON FUNCTION
  get_signup_cohort_retention(INT, INT, TEXT, TEXT)
  TO authenticated, service_role;

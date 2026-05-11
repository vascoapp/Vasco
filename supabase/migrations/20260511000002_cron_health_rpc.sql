-- =============================================================================
-- CRON HEALTH RPC — R66 round 55 (2026-05-11)
-- =============================================================================
-- Admin dashboard needed an in-app readout of pg_cron registration state.
-- Previously the operator had to SSH into psql + `select * from cron.job` to
-- verify the 10 schedules from supabase/cron.sql actually registered. If
-- the manual run was skipped or failed, customer-facing flows that depend
-- on cron (weekly-digest emails, daily push notifications, draining the
-- account-deletion queue, weekly model retraining) silently stop and the
-- only signal is "users stop getting emails."
--
-- This RPC exposes a minimal slice of cron.job + cron.job_run_details so
-- the admin DeveloperHub Cron tab can render schedule count + last-run
-- status per job. SECURITY DEFINER because cron tables are owned by the
-- supabase_admin role and not normally visible to anon/authenticated.
--
-- Returns only metadata (jobname, schedule, active flag, last status,
-- last start time, last duration). No row payloads, no service-role JWTs,
-- no command bodies — defensive against a leaked admin PIN.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_cron_health()
RETURNS TABLE (
  jobname        text,
  schedule       text,
  active         boolean,
  last_status    text,
  last_start     timestamptz,
  last_end       timestamptz,
  last_runs      bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  -- Aggregate the most-recent run per job. Coalesce to NULL when a job
  -- exists but has never run (just registered, or paused for hours).
  WITH last_runs AS (
    SELECT
      jrd.jobid,
      jrd.status,
      jrd.start_time,
      jrd.end_time,
      ROW_NUMBER() OVER (PARTITION BY jrd.jobid ORDER BY jrd.start_time DESC) AS rn
    FROM cron.job_run_details jrd
  ),
  run_counts AS (
    SELECT jobid, COUNT(*) AS n FROM cron.job_run_details GROUP BY jobid
  )
  SELECT
    j.jobname::text,
    j.schedule::text,
    j.active,
    lr.status::text,
    lr.start_time,
    lr.end_time,
    COALESCE(rc.n, 0) AS last_runs
  FROM cron.job j
  LEFT JOIN last_runs lr ON lr.jobid = j.jobid AND lr.rn = 1
  LEFT JOIN run_counts rc ON rc.jobid = j.jobid
  WHERE j.jobname LIKE 'vasco-%'   -- only Vasco-owned schedules
  ORDER BY j.jobname;
$$;

-- Public-read: admin uses anon/authenticated role with PIN gate on the FE;
-- the RPC itself doesn't expose anything sensitive enough to need a
-- service-role caller. The LIKE 'vasco-%' filter prevents leaking other
-- tenants' cron jobs even if this database is shared in the future.
REVOKE ALL ON FUNCTION public.get_cron_health() FROM public;
GRANT EXECUTE ON FUNCTION public.get_cron_health() TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.get_cron_health() IS
  'R66r55: returns metadata for the 10 vasco-* cron schedules (registration state + last-run status). Read by admin DeveloperHub Cron tab.';

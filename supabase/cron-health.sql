-- =============================================================================
-- Cron Health Check (R66r50)
-- =============================================================================
-- Run against the prod Supabase project to confirm all 10 vasco-* jobs are
-- registered. A row count below 10 means cron.sql was not fully applied or
-- some jobs were dropped — silent dormancy on daily digest, packs, account
-- deletion drain, etc.
--
-- Usage in Dashboard SQL editor:
--   \i cron-health.sql
-- Or:
--   psql "$DATABASE_URL" -f cron-health.sql
-- =============================================================================

select
  jobname,
  schedule,
  active,
  database
from cron.job
where jobname like 'vasco-%'
order by jobname;

-- Expected (10 rows, all active = true):
--   vasco-churn-winback
--   vasco-daily-push-digest
--   vasco-drain-account-deletions
--   vasco-grant-referral-credits
--   vasco-pack-trigger-tick
--   vasco-refresh-generator-approval-rates
--   vasco-stale-draft-cleanup
--   vasco-train-extra-models
--   vasco-weekly-digest
--   vasco-weekly-retrain-models

-- Quick summary row
select
  count(*)                                        as total,
  count(*) filter (where active)                  as active,
  count(*) filter (where jobname like 'vasco-%')  as vasco_jobs
from cron.job;

-- Recent invocation results (last 24h, last 50 runs)
select
  j.jobname,
  r.status,
  r.start_time,
  r.end_time,
  r.return_message
from cron.job_run_details r
join cron.job j on j.jobid = r.jobid
where r.start_time > now() - interval '24 hours'
  and j.jobname like 'vasco-%'
order by r.start_time desc
limit 50;

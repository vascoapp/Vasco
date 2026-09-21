-- =============================================================================
-- Cron Health Check (R66r50; rewritten 2026-09-20)
-- =============================================================================
-- Confirms every job `cron.sql` registers is present and active.
--
-- ⚠️ This used to PRINT rows and list the expected jobs in a COMMENT, which
-- made it advisory: a human had to count them. It also expected 10 while
-- cron.sql defines 11 — and the one it omitted, `vasco-watchdog-daily`, was
-- the ONLY job actually registered in production on 2026-09-20. So the single
-- job that existed was the one nothing checked for, and the ten that were
-- missing (GDPR deletion drain, push digest, pack triggers, referral credits,
-- the retrain jobs) looked fine.
--
-- It now RAISES. A check that cannot fail is not a check.
--
-- Usage in Dashboard SQL editor: paste and run.
-- Or: psql "$DATABASE_URL" -f cron-health.sql
-- =============================================================================

do $$
declare
  -- Keep in step with cron.sql. `cronExpectationsMatchCronSql` in the jest
  -- suite fails when these disagree, in either direction.
  expected text[] := array[
    'vasco-churn-winback',
    'vasco-daily-push-digest',
    'vasco-drain-account-deletions',
    'vasco-grant-referral-credits',
    'vasco-pack-trigger-tick',
    'vasco-reconcile-http-outcomes',
    'vasco-refresh-generator-approval-rates',
    'vasco-stale-draft-cleanup',
    'vasco-train-extra-models',
    'vasco-watchdog-daily',
    'vasco-weekly-digest',
    'vasco-weekly-retrain-models'
  ];
  missing  text[];
  inactive text[];
  unknown_jobs text[];
begin
  select coalesce(array_agg(e order by e), '{}')
    into missing
  from unnest(expected) e
  where not exists (select 1 from cron.job j where j.jobname = e);

  select coalesce(array_agg(j.jobname order by j.jobname), '{}')
    into inactive
  from cron.job j
  where j.jobname = any(expected) and not j.active;

  -- Drift the other way: something scheduled that cron.sql does not define.
  select coalesce(array_agg(j.jobname order by j.jobname), '{}')
    into unknown_jobs
  from cron.job j
  where j.jobname like 'vasco-%' and not (j.jobname = any(expected));

  if array_length(missing, 1) is not null then
    raise exception
      'CRON HEALTH FAILED — % of % jobs NOT registered: %. Run supabase/cron.sql.',
      array_length(missing, 1), array_length(expected, 1), array_to_string(missing, ', ');
  end if;

  if array_length(inactive, 1) is not null then
    raise exception 'CRON HEALTH FAILED — registered but INACTIVE: %',
      array_to_string(inactive, ', ');
  end if;

  if array_length(unknown_jobs, 1) is not null then
    raise warning 'Scheduled but not defined in cron.sql: % (stale? rename?)',
      array_to_string(unknown_jobs, ', ');
  end if;

  raise notice 'CRON HEALTH OK — all % jobs registered and active.',
    array_length(expected, 1);
end $$;

-- Detail, for eyes, after the assertion above has passed.
select jobname, schedule, active, database
from cron.job
where jobname like 'vasco-%'
order by jobname;

-- Recent invocation results (last 24h, last 50 runs).
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

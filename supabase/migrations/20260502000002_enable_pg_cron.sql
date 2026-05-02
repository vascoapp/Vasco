-- =============================================================================
-- ENABLE pg_cron + pg_net (R293)
-- =============================================================================
-- Prerequisite for `supabase/cron.sql`. Without these, none of the 9 crons
-- documented in cron.sql can be registered:
--   - vasco-weekly-digest
--   - vasco-stale-draft-cleanup
--   - vasco-drain-account-deletions
--   - vasco-daily-push-digest
--   - vasco-churn-winback
--   - vasco-grant-referral-credits
--   - vasco-weekly-retrain-models
--   - vasco-train-extra-models
--   - vasco-refresh-generator-approval-rates
--
-- After this migration is pushed, the operator MUST run cron.sql ONCE to
-- register the schedules. cron.sql requires SUPABASE_URL and a service-role
-- JWT, neither of which can be safely committed.
--
-- Verify after: select jobid, schedule, jobname from cron.job order by jobname;
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

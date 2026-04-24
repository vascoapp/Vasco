-- =============================================================================
-- Supabase Cron Schedule (pg_cron + pg_net)
-- =============================================================================
-- Run once per project to register scheduled Edge Function calls.
-- Prerequisite: pg_cron + pg_net extensions enabled
--   create extension if not exists pg_cron;
--   create extension if not exists pg_net;
--
-- IMPORTANT: replace the two placeholders before running:
--   <SUPABASE_URL>          e.g. https://xxxx.supabase.co
--   <SERVICE_ROLE_KEY>      the service_role JWT (store via Dashboard, not committed)
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Weekly digest — Monday 08:00 UTC (shift per-market via the function itself)
select cron.schedule(
  'vasco-weekly-digest',
  '0 8 * * 1',
  $$
    select net.http_post(
      url := '<SUPABASE_URL>/functions/v1/weekly-digest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- Optional: quote token / stale-draft cleanup daily at 03:00 UTC
-- (deletes quotes in status='draft' older than 90 days)
select cron.schedule(
  'vasco-stale-draft-cleanup',
  '0 3 * * *',
  $$
    delete from public.documents
    where doc_type = 'quote'
      and status = 'draft'
      and created_at < now() - interval '90 days';
  $$
);

-- R220 — GDPR Art. 17 deletion-request drain, daily 02:00 UTC.
-- Processes up to 50 pending rows in account_deletion_requests per run:
-- erases user-owned data, anonymises tax-retained rows, calls
-- auth.admin.deleteUser, marks status='done'.
select cron.schedule(
  'vasco-drain-account-deletions',
  '0 2 * * *',
  $$
    select net.http_post(
      url := '<SUPABASE_URL>/functions/v1/drain-account-deletions',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- R226 — daily money-relevant push digest at 18:00 UTC.
-- Picks one push per user per day (overdue invoices / EVE queue /
-- staling quotes / tomorrow's jobs) and fans out via send-push.
-- Rate-limited to max 1/user/day + 24h dedupe on (type, entity_key).
select cron.schedule(
  'vasco-daily-push-digest',
  '0 18 * * *',
  $$
    select net.http_post(
      url := '<SUPABASE_URL>/functions/v1/daily-push-digest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- R228 — weekly churn win-back email, Mondays 10:00 UTC.
-- Finds users with 14+ days of zero business_events + 7+ days since
-- signup, picks new_stalled or active_quiet variant, sends via Resend.
-- Rate-limited to 1 email per user per 30 days.
select cron.schedule(
  'vasco-churn-winback',
  '0 10 * * 1',
  $$
    select net.http_post(
      url := '<SUPABASE_URL>/functions/v1/churn-winback-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- R232 — daily referral credit grant, 04:00 UTC.
-- Calls grant_referral_credits RPC which flips every activated
-- attribution to 'credited' and inserts 1-month subscription_credits
-- rows for both referrer and referred. Idempotent.
select cron.schedule(
  'vasco-grant-referral-credits',
  '0 4 * * *',
  $$
    select net.http_post(
      url := '<SUPABASE_URL>/functions/v1/grant-referral-credits',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- Listing live jobs (run in psql after setup to verify):
-- select * from cron.job;

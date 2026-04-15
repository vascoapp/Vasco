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

-- Listing live jobs (run in psql after setup to verify):
-- select * from cron.job;

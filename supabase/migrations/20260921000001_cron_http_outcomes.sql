-- =============================================================================
-- CRON HTTP OUTCOMES — #359 (2026-09-21)
-- =============================================================================
-- REGISTERED IS NOT WORKING.
--
-- Every scheduled job in supabase/cron.sql fires an edge function through
-- `net.http_post(...)` with a Bearer service-role header. If that key is wrong,
-- or the function is undeployed, or it 500s, the HTTP call fails — and pg_cron
-- records the run as SUCCEEDED, because the SQL statement succeeded. The
-- statement's job was to enqueue a request, and it did.
--
-- So `cron.job_run_details.status = 'succeeded'` says nothing whatsoever about
-- whether the work happened. On 2026-09-21 eleven schedules were registered
-- with a freshly-fetched key that had never been exercised, and the watchdog
-- would have reported them all healthy either way. That is the same shape as
-- #357 (a presence check cannot see a partial failure) one layer down.
--
-- Two facts about pg_net make this awkward, and they decide the design:
--
--   1. `net._http_response` has NO url column, and `net.http_request_queue`
--      (which does) is emptied as soon as a request completes. A response
--      therefore cannot be attributed to the job that caused it unless the
--      request id is recorded at call time. Hence `cron_http_calls`.
--
--   2. pg_net PRUNES `net._http_response` on a TTL measured in hours. Measured
--      on this project (pg_net 0.20.0), not assumed: at 20:40 UTC the table
--      held exactly ONE row — an 18:34 manual replay — while that same day's
--      07:00 and 08:00 watchdog responses were already gone. The
--      watchdog runs at 07:00/08:00 UTC; the erasure drain fires at 02:00.
--      A join performed at watchdog time would find the row already gone and
--      report "no failures" — a reassuring zero produced by a retention
--      policy. The outcome must therefore be COPIED out of pg_net long before
--      the digest reads it, which is what `vasco-reconcile-http-outcomes`
--      does every ten minutes.
--
-- The result is durable and attributed: "vasco-drain-account-deletions
-- returned 401 at 02:00", not "3 calls failed somewhere".
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. The call log
-- ---------------------------------------------------------------------------

create table if not exists public.cron_http_calls (
  id          bigserial primary key,
  jobname     text        not null,
  request_id  bigint      not null,
  sent_at     timestamptz not null default now(),
  -- Filled by the reconciler once pg_net has an answer. NULL means "no answer
  -- yet" — which is itself a finding once the row is old enough, because it
  -- means the response was pruned before we copied it, or never arrived.
  status_code int,
  error_msg   text,
  timed_out   boolean,
  resolved_at timestamptz
);

-- The reconciler's hot path: unresolved rows, newest first.
create index if not exists cron_http_calls_unresolved_idx
  on public.cron_http_calls (sent_at desc) where status_code is null;
create index if not exists cron_http_calls_sent_idx
  on public.cron_http_calls (sent_at desc);
create unique index if not exists cron_http_calls_request_idx
  on public.cron_http_calls (request_id);

alter table public.cron_http_calls enable row level security;

-- Nothing user-facing reads this; it carries operational detail only. Service
-- role writes it (from the cron bodies) and the watchdog reads it via a
-- SECURITY DEFINER RPC, so no direct grant to anon/authenticated.
drop policy if exists "service role manages cron http calls" on public.cron_http_calls;
create policy "service role manages cron http calls"
  on public.cron_http_calls for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- The cron bodies INSERT here as `postgres` (verified: every vasco-* job has
-- username='postgres'). That role has rolbypassrls, so the policy above does
-- not block it — but bypassing RLS is not the same as holding the privilege,
-- and which role owns this table depends on how the migration was applied.
-- Granting explicitly means the job body does not depend on that accident.
--
-- ⚠️ This matters more than a normal grant: the job body is ONE statement,
-- `with sent as (select net.http_post(…)) insert into cron_http_calls …`. If
-- the insert cannot proceed, the whole statement rolls back and the HTTP call
-- is never enqueued. A missing grant here does not degrade monitoring; it
-- stops the automation. (It stops it LOUDLY — pg_cron records the run as
-- failed and the watchdog already raises on that — which is the trade this
-- design accepts: a visible stop beats an invisible success.)
grant select, insert, update, delete on public.cron_http_calls to postgres;
grant usage, select on sequence public.cron_http_calls_id_seq to postgres;

comment on table public.cron_http_calls is
  '#359: one row per net.http_post issued by a cron job, with the outcome copied out of net._http_response before pg_net prunes it. Answers "did the scheduled call actually succeed", which cron.job_run_details cannot.';

-- ---------------------------------------------------------------------------
-- 2. Reconcile outcomes out of pg_net before it prunes them
-- ---------------------------------------------------------------------------
-- Called every 10 minutes by `vasco-reconcile-http-outcomes`. Deliberately a
-- function rather than inline SQL in the cron body, so the logic is versioned
-- here and a fix does not require re-registering the schedule.

create or replace function public.reconcile_cron_http_outcomes()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n integer;
begin
  update public.cron_http_calls c
     set status_code = r.status_code,
         error_msg   = r.error_msg,
         timed_out   = r.timed_out,
         resolved_at = now()
    from net._http_response r
   where r.id = c.request_id
     and c.status_code is null
     and c.resolved_at is null;
  get diagnostics n = row_count;

  -- Operational log, not a record of anything. Two weeks is enough to explain
  -- a bad night and short enough that this table never becomes a cost.
  delete from public.cron_http_calls where sent_at < now() - interval '14 days';

  return n;
end;
$$;

revoke all on function public.reconcile_cron_http_outcomes() from public;
grant execute on function public.reconcile_cron_http_outcomes() to service_role;

-- ---------------------------------------------------------------------------
-- 3. What the watchdog reads
-- ---------------------------------------------------------------------------
-- Returns one row per FAILED scheduled call in the window. A call is failed if
-- it came back non-2xx, timed out, carried a transport error, or is still
-- unresolved well after it was sent (see the `unresolved` reason).
--
-- ⚠️ Never selects `net._http_response.headers` or `.content`: the request
-- headers carry the service-role JWT and the body can carry customer data.
-- Only the verdict crosses this boundary.

create or replace function public.get_cron_http_failures(p_since timestamptz)
returns table (
  jobname     text,
  sent_at     timestamptz,
  status_code int,
  reason      text,
  detail      text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    c.jobname,
    c.sent_at,
    c.status_code,
    case
      when c.timed_out then 'timeout'
      when c.error_msg is not null then 'transport'
      when c.status_code is null then 'unresolved'
      else 'http_' || c.status_code::text
    end as reason,
    left(coalesce(c.error_msg, ''), 200) as detail
  from public.cron_http_calls c
  where c.sent_at >= p_since
    and (
      c.timed_out
      or c.error_msg is not null
      or (c.status_code is not null and (c.status_code < 200 or c.status_code >= 300))
      -- Unresolved after 30 minutes means the reconciler never found a
      -- response: pruned before we copied it, or the request never completed.
      -- Either way we cannot claim the call succeeded.
      or (c.status_code is null and c.sent_at < now() - interval '30 minutes')
    )
  order by c.sent_at desc;
$$;

revoke all on function public.get_cron_http_failures(timestamptz) from public;
grant execute on function public.get_cron_http_failures(timestamptz) to service_role;

comment on function public.get_cron_http_failures(timestamptz) is
  '#359: failed scheduled HTTP calls in a window, NAMED by job. pg_cron reports these runs as succeeded because enqueuing the request succeeded.';

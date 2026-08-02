-- =============================================================================
-- WATCHDOG — daily operator digest support (2026-07-25)
-- =============================================================================
-- Backs the `watchdog-daily` edge function, which posts a 09:00 Europe/Amsterdam
-- Telegram digest covering: Supabase platform logs, backend/app signals, the
-- good and bad of paying customers, and an analysis of the scheduled
-- automations themselves (including the watchdog's own health).
--
-- Three pieces:
--   1. subscription_audit  — append-only tier/status change log + trigger.
--      Without this, "converted to paid today" / "churned today" can only be
--      inferred from subscriptions.updated_at, which is overwritten by any
--      unrelated write (e.g. a webhook extending current_period_ends_at).
--      With it, the daily paying-customer deltas are exact.
--   2. watchdog_runs       — the watchdog logging itself, so it can report
--      "yesterday's run failed / never happened" and compute day-over-day
--      deltas. A watchdog that cannot observe its own silence is not a
--      watchdog.
--   3. RPCs                — watchdog_snapshot(since) returns the whole
--      backend picture as one jsonb blob (one round trip instead of ~15
--      supabase-js queries), and get_cron_runs_since(since) exposes per-run
--      pg_cron history (get_cron_health only exposes the single last run).
--
-- watchdog_snapshot wraps every section in its own exception block: a missing
-- table or renamed column degrades that one section to an error string rather
-- than 500-ing the entire digest. A monitoring tool must never go dark because
-- one of the things it monitors changed shape.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Subscription change audit
-- ---------------------------------------------------------------------------

create table if not exists public.subscription_audit (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  old_tier    text,
  new_tier    text,
  old_status  text,
  new_status  text,
  external_provider text,
  changed_at  timestamptz not null default now()
);

create index if not exists subscription_audit_changed_idx
  on public.subscription_audit (changed_at desc);
create index if not exists subscription_audit_user_idx
  on public.subscription_audit (user_id, changed_at desc);

alter table public.subscription_audit enable row level security;

-- Users may read their own history (GDPR transparency); only the service role
-- writes, and only the trigger actually does.
drop policy if exists "users read their own subscription audit" on public.subscription_audit;
create policy "users read their own subscription audit"
  on public.subscription_audit for select
  using (auth.uid() = user_id);

drop policy if exists "service role writes subscription audit" on public.subscription_audit;
create policy "service role writes subscription audit"
  on public.subscription_audit for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create or replace function public.log_subscription_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.subscription_audit
      (user_id, old_tier, new_tier, old_status, new_status, external_provider)
    values (new.user_id, null, new.tier, null, new.status, new.external_provider);
    return new;
  end if;

  -- Only record meaningful transitions. Period-extension writes from the Mollie
  -- webhook touch updated_at on every renewal and would otherwise flood this.
  if new.tier is distinct from old.tier
     or new.status is distinct from old.status then
    insert into public.subscription_audit
      (user_id, old_tier, new_tier, old_status, new_status, external_provider)
    values (new.user_id, old.tier, new.tier, old.status, new.status, new.external_provider);
  end if;
  return new;
end;
$$;

drop trigger if exists subscriptions_audit_changes on public.subscriptions;
create trigger subscriptions_audit_changes
  after insert or update on public.subscriptions
  for each row execute function public.log_subscription_change();

-- ---------------------------------------------------------------------------
-- 2. Watchdog self-log
-- ---------------------------------------------------------------------------

create table if not exists public.watchdog_runs (
  id            bigserial primary key,
  ran_at        timestamptz not null default now(),
  window_start  timestamptz,
  window_end    timestamptz,
  ok            boolean not null default true,
  delivered     boolean not null default false,
  severity      text,               -- 'ok' | 'warn' | 'critical'
  issue_count   int not null default 0,
  duration_ms   int,
  degraded      text[] not null default '{}',  -- sections that failed to collect
  summary       jsonb not null default '{}'::jsonb,
  error         text
);

create index if not exists watchdog_runs_ran_idx on public.watchdog_runs (ran_at desc);

alter table public.watchdog_runs enable row level security;

drop policy if exists "service role owns watchdog runs" on public.watchdog_runs;
create policy "service role owns watchdog runs"
  on public.watchdog_runs for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 3. Per-run pg_cron history
-- ---------------------------------------------------------------------------
-- get_cron_health() (R66r55) returns only the most recent run per job, which
-- cannot answer "did anything fail overnight?" if a later run succeeded.

create or replace function public.get_cron_runs_since(p_since timestamptz)
returns table (
  jobname     text,
  schedule    text,
  active      boolean,
  status      text,
  start_time  timestamptz,
  end_time    timestamptz,
  duration_ms int,
  message     text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    j.jobname::text,
    j.schedule::text,
    j.active,
    jrd.status::text,
    jrd.start_time,
    jrd.end_time,
    (extract(epoch from (jrd.end_time - jrd.start_time)) * 1000)::int,
    -- Truncated: return_message can contain a full SQL error including the
    -- statement body. 300 chars is enough to diagnose, short enough not to
    -- leak a service-role JWT embedded in a net.http_post command.
    left(jrd.return_message::text, 300)
  from cron.job j
  left join cron.job_run_details jrd
    on jrd.jobid = j.jobid and jrd.start_time >= p_since
  where j.jobname like 'vasco-%'
  order by j.jobname, jrd.start_time desc;
$$;

revoke all on function public.get_cron_runs_since(timestamptz) from public;
grant execute on function public.get_cron_runs_since(timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Backend snapshot
-- ---------------------------------------------------------------------------

create or replace function public.watchdog_snapshot(p_since timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  out_json  jsonb := '{}'::jsonb;
  degraded  text[] := '{}';
  tmp       jsonb;
begin
  -- ---- users -------------------------------------------------------------
  begin
    select jsonb_build_object(
      'total',      count(*),
      'new_24h',    count(*) filter (where created_at >= p_since),
      'confirmed',  count(*) filter (where email_confirmed_at is not null),
      'unconfirmed_24h', count(*) filter (
                      where created_at >= p_since and email_confirmed_at is null)
    ) into tmp from auth.users;
    out_json := out_json || jsonb_build_object('users', tmp);
  exception when others then
    degraded := degraded || 'users';
    out_json := out_json || jsonb_build_object('users', jsonb_build_object('error', sqlerrm));
  end;

  -- ---- subscriptions: current standing ----------------------------------
  begin
    select jsonb_build_object(
      'paying_active', count(*) filter (where tier <> 'free' and status = 'active'),
      'trialing',      count(*) filter (where status = 'trialing'),
      'past_due',      count(*) filter (where status = 'past_due'),
      'canceled',      count(*) filter (where status = 'canceled'),
      'expired',       count(*) filter (where status = 'expired'),
      'by_tier', (
        select coalesce(jsonb_object_agg(t.tier, t.n), '{}'::jsonb)
        from (select tier, count(*) n from public.subscriptions
              where status = 'active' and tier <> 'free' group by tier) t
      ),
      -- Renewal cliff: paying users whose period ends inside 3 days.
      'ending_3d', count(*) filter (
        where tier <> 'free' and status = 'active'
          and current_period_ends_at is not null
          and current_period_ends_at between now() and now() + interval '3 days'),
      -- Trials about to lapse with no payment provider attached at all.
      'trials_ending_3d_no_provider', count(*) filter (
        where status = 'trialing' and external_provider is null
          and trial_ends_at is not null
          and trial_ends_at between now() and now() + interval '3 days'),
      -- Already lapsed but never cleaned up — silent revenue leak.
      'active_but_expired_period', count(*) filter (
        where tier <> 'free' and status = 'active'
          and current_period_ends_at is not null
          and current_period_ends_at < now())
    ) into tmp from public.subscriptions;
    out_json := out_json || jsonb_build_object('subs', tmp);
  exception when others then
    degraded := degraded || 'subs';
    out_json := out_json || jsonb_build_object('subs', jsonb_build_object('error', sqlerrm));
  end;

  -- ---- subscriptions: what changed in the window -------------------------
  -- Exact, from the audit trigger. Empty until the trigger has been live for
  -- a day; the edge function labels it as such rather than reporting zeroes
  -- as if they were good news.
  begin
    select jsonb_build_object(
      'events', count(*),
      'new_paid', count(*) filter (
        where (old_tier is null or old_tier = 'free') and new_tier <> 'free'),
      'trial_converted', count(*) filter (
        where old_status = 'trialing' and new_status = 'active'),
      'upgraded', count(*) filter (
        where old_tier is not null and old_tier <> 'free' and new_tier <> 'free'
          and new_tier <> old_tier),
      'churned', count(*) filter (
        where new_status in ('canceled','expired')
          and old_status not in ('canceled','expired')),
      'went_past_due', count(*) filter (
        where new_status = 'past_due' and old_status is distinct from 'past_due'),
      'downgraded_to_free', count(*) filter (
        where old_tier is not null and old_tier <> 'free' and new_tier = 'free'),
      'recovered', count(*) filter (
        where old_status = 'past_due' and new_status = 'active'),
      'audit_rows_total', (select count(*) from public.subscription_audit)
    ) into tmp
    from public.subscription_audit
    where changed_at >= p_since;
    out_json := out_json || jsonb_build_object('sub_changes', tmp);
  exception when others then
    degraded := degraded || 'sub_changes';
    out_json := out_json || jsonb_build_object('sub_changes', jsonb_build_object('error', sqlerrm));
  end;

  -- ---- money: invoices / quotes -----------------------------------------
  begin
    select jsonb_build_object(
      'paid_24h_count',  count(*) filter (where doc_type='invoice' and status='paid' and paid_at >= p_since),
      'paid_24h_amount', coalesce(sum(total_amount) filter (
                           where doc_type='invoice' and status='paid' and paid_at >= p_since), 0),
      'sent_24h',        count(*) filter (where doc_type='invoice' and sent_at >= p_since),
      'open_count',      count(*) filter (where doc_type='invoice' and status='sent'),
      'open_amount',     coalesce(sum(total_amount) filter (
                           where doc_type='invoice' and status='sent'), 0),
      'overdue_count',   count(*) filter (
                           where doc_type='invoice' and status='sent'
                             and due_date is not null and due_date < current_date),
      'overdue_amount',  coalesce(sum(total_amount) filter (
                           where doc_type='invoice' and status='sent'
                             and due_date is not null and due_date < current_date), 0),
      'quotes_24h',      count(*) filter (where doc_type='quote' and created_at >= p_since),
      'quotes_sent_24h', count(*) filter (where doc_type='quote' and sent_at >= p_since)
    ) into tmp from public.documents;
    out_json := out_json || jsonb_build_object('money', tmp);
  exception when others then
    degraded := degraded || 'money';
    out_json := out_json || jsonb_build_object('money', jsonb_build_object('error', sqlerrm));
  end;

  -- ---- app activity ------------------------------------------------------
  begin
    select jsonb_build_object(
      'jobs_24h',      (select count(*) from public.jobs where created_at >= p_since),
      'customers_24h', (select count(*) from public.customers where created_at >= p_since),
      'active_users_24h', (
        select count(distinct user_id) from public.business_events
        where created_at >= p_since),
      'events_24h',    (select count(*) from public.business_events where created_at >= p_since),
      'top_events', (
        select coalesce(jsonb_object_agg(e.event_type, e.n), '{}'::jsonb)
        from (select event_type, count(*) n from public.business_events
              where created_at >= p_since
              group by event_type order by n desc limit 10) e
      )
    ) into tmp;
    out_json := out_json || jsonb_build_object('activity', tmp);
  exception when others then
    degraded := degraded || 'activity';
    out_json := out_json || jsonb_build_object('activity', jsonb_build_object('error', sqlerrm));
  end;

  -- ---- paying users who have gone quiet (churn risk) ---------------------
  begin
    select jsonb_build_object(
      'paying_silent_14d', count(*)
    ) into tmp
    from public.subscriptions s
    where s.tier <> 'free' and s.status = 'active'
      and not exists (
        select 1 from public.business_events be
        where be.user_id = s.user_id
          and be.created_at >= now() - interval '14 days'
      );
    out_json := out_json || jsonb_build_object('risk', tmp);
  exception when others then
    degraded := degraded || 'risk';
    out_json := out_json || jsonb_build_object('risk', jsonb_build_object('error', sqlerrm));
  end;

  -- ---- EVE queue telemetry ----------------------------------------------
  begin
    select jsonb_build_object(
      'total_24h', count(*),
      'by_outcome', (
        select coalesce(jsonb_object_agg(t.outcome, t.n), '{}'::jsonb)
        from (select outcome, count(*) n from public.eve_telemetry
              where created_at >= p_since group by outcome) t
      )
    ) into tmp from public.eve_telemetry where created_at >= p_since;
    out_json := out_json || jsonb_build_object('eve', tmp);
  exception when others then
    degraded := degraded || 'eve';
    out_json := out_json || jsonb_build_object('eve', jsonb_build_object('error', sqlerrm));
  end;

  -- ---- push delivery -----------------------------------------------------
  begin
    select jsonb_build_object(
      'sent_24h',   count(*),
      'failed_24h', count(*) filter (where success = false),
      'last_error', (select error from public.push_notification_log
                     where success = false and sent_at >= p_since
                     order by sent_at desc limit 1)
    ) into tmp from public.push_notification_log where sent_at >= p_since;
    out_json := out_json || jsonb_build_object('push', tmp);
  exception when others then
    degraded := degraded || 'push';
    out_json := out_json || jsonb_build_object('push', jsonb_build_object('error', sqlerrm));
  end;

  -- ---- previous watchdog run (self-observation) --------------------------
  begin
    select coalesce(
      (select jsonb_build_object(
         'ran_at', ran_at, 'ok', ok, 'delivered', delivered,
         'severity', severity, 'issue_count', issue_count, 'error', error)
       from public.watchdog_runs order by ran_at desc limit 1),
      '{}'::jsonb) into tmp;
    out_json := out_json || jsonb_build_object('previous_run', tmp);
  exception when others then
    degraded := degraded || 'previous_run';
  end;

  return out_json || jsonb_build_object(
    'degraded', to_jsonb(degraded),
    'since', p_since,
    'generated_at', now()
  );
end;
$$;

revoke all on function public.watchdog_snapshot(timestamptz) from public;
grant execute on function public.watchdog_snapshot(timestamptz) to service_role;

comment on function public.watchdog_snapshot(timestamptz) is
  'Daily operator digest source: users, subscriptions, paying-customer deltas, money, activity, churn risk, EVE, push. Section-guarded — a broken section degrades to an error string instead of failing the digest.';
comment on table public.subscription_audit is
  'Append-only tier/status transition log. Makes daily converted/churned counts exact rather than inferred from updated_at.';
comment on table public.watchdog_runs is
  'Self-log for watchdog-daily so it can detect and report its own missed or failed runs.';

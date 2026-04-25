-- =============================================================================
-- R228 — CHURN WIN-BACK LOG
-- =============================================================================
-- Tracks every win-back email we dispatch per user. Serves the same two
-- purposes as R226's push_notification_log, but on a longer cadence:
--   1. Rate-limit — max 1 win-back email per user per 30 days.
--   2. Audit — which variant fired, whether Resend accepted, error if any.
--
-- Owner-readable RLS (transparency); inserts service-role only.
-- =============================================================================

create table if not exists public.churn_winback_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  variant text not null check (variant in ('new_stalled', 'active_quiet')),
  locale text not null,
  days_since_activity int,
  success boolean not null default true,
  error text,
  sent_at timestamptz not null default now()
);

create index if not exists churn_winback_user_sent_idx
  on public.churn_winback_log (user_id, sent_at desc);

alter table public.churn_winback_log enable row level security;

create policy "users read their own winback log"
  on public.churn_winback_log for select
  using (auth.uid() = user_id);
-- No user INSERT/UPDATE/DELETE: service role only.

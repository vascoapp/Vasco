-- =============================================================================
-- R226 — PUSH NOTIFICATION LOG
-- =============================================================================
-- Tracks every push we dispatch per user. Serves two purposes:
--   1. Rate-limit — max 1 push per user per calendar-day across all types.
--   2. Dedupe — don't re-send the same (notif_type, entity_key) within 24h
--      (e.g. if a contractor already got 'overdue invoices: 3' today, we
--      don't ping again tomorrow unless the count changes).
--
-- No user PII beyond user_id. RLS: users can see their own log rows
-- (transparency); inserts/updates are service-role only.
-- =============================================================================

create table if not exists public.push_notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notif_type text not null,
  entity_key text,
  title text not null,
  body text not null,
  success boolean not null default true,
  error text,
  sent_at timestamptz not null default now()
);

create index if not exists push_log_user_sent_idx
  on public.push_notification_log (user_id, sent_at desc);

create index if not exists push_log_dedup_idx
  on public.push_notification_log (user_id, notif_type, entity_key, sent_at desc);

alter table public.push_notification_log enable row level security;

create policy "users read their own push log"
  on public.push_notification_log for select
  using (auth.uid() = user_id);
-- No user INSERT/UPDATE/DELETE policies: service role only.

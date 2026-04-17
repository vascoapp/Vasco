-- =============================================================================
-- Account deletion requests — GDPR Art. 17 "right to erasure"
-- =============================================================================
-- When a user taps "Delete my account" we insert a row here. A backend cron
-- job (or admin operator) processes them within the EU GDPR 30-day window:
--   • Erase: push_tokens, scanned_invoices, job_photos, customer_interactions,
--     decision_submissions, customer-uploads bucket objects
--   • Anonymize (cannot erase per EU tax law — 7yr retention):
--     invoices, quotes, jobs → set contact fields to NULL, keep amounts
--   • Delete auth.users row last (triggers ON DELETE CASCADE on most tables)
-- =============================================================================

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  reason text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'cancelled')),
  processed_at timestamptz,
  processor_notes text,
  constraint unique_pending_per_user unique (user_id, status) deferrable initially deferred
);

create index if not exists account_deletion_requests_status_idx
  on public.account_deletion_requests (status, requested_at);

alter table public.account_deletion_requests enable row level security;

-- User can see + create their own deletion request. Cannot update or delete
-- once submitted (the backend worker owns lifecycle after insert).
create policy "users read their own deletion requests"
  on public.account_deletion_requests for select
  using (auth.uid() = user_id);

create policy "users create their own deletion request"
  on public.account_deletion_requests for insert
  with check (auth.uid() = user_id);

-- Service role handles processing; no user UPDATE/DELETE policies.

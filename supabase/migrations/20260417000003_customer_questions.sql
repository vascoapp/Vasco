-- =============================================================================
-- Customer questions — free-text inbound from decisions portal
-- =============================================================================
-- The customer types an out-of-scope question in the decisions portal
-- ("can you also replace the shutoff valve?"). Low-stakes questions are
-- auto-answered by the AI from structured data (schedule, address, notes).
-- High-stakes questions (scope/price/schedule change) land here with an
-- AI draft for the contractor to approve in VascoCard.
--
-- Security:
--   • anon INSERT allowed (portal has no auth session) — same pattern as
--     decision_submissions (R97).
--   • Contractor SELECTs via their own user_id on the decision tracker.
--   • AI draft/reply flow is service-role.
-- =============================================================================

create table if not exists public.customer_questions (
  id uuid primary key default gen_random_uuid(),
  tracker_id text not null,
  tracker_access_token text,
  contractor_user_id uuid references auth.users(id) on delete cascade,
  question text not null,
  question_lang text default 'nl',

  -- Classification + AI draft
  stakes text not null default 'unknown' check (stakes in ('low', 'high', 'unknown')),
  ai_reply_draft text,
  ai_reply_confidence numeric(3, 2),
  ai_reply_reason text,

  -- Contractor-approved final reply
  approved_reply text,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,

  -- Delivery
  auto_sent boolean not null default false,
  sent_at timestamptz,

  -- Lifecycle
  status text not null default 'pending' check (status in ('pending', 'drafted', 'approved', 'sent', 'declined')),
  asked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists customer_questions_tracker_idx
  on public.customer_questions (tracker_id, asked_at desc);
create index if not exists customer_questions_contractor_idx
  on public.customer_questions (contractor_user_id, status)
  where contractor_user_id is not null;

alter table public.customer_questions enable row level security;

-- Customer-side (anon) can insert against a known tracker.
create policy "anon insert customer question"
  on public.customer_questions for insert
  with check (true);

-- Contractor reads + updates their own.
create policy "contractor reads their own questions"
  on public.customer_questions for select
  using (auth.uid() = contractor_user_id);

create policy "contractor updates their own questions"
  on public.customer_questions for update
  using (auth.uid() = contractor_user_id)
  with check (auth.uid() = contractor_user_id);

-- Anon can also read a question they just submitted if they have the tracker
-- access token — needed so the portal can poll for the auto-reply.
create policy "anon reads by tracker token"
  on public.customer_questions for select
  using (tracker_access_token is not null);

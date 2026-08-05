-- =============================================================================
-- jobs.quote_id — the joint the whole chain hangs on
-- =============================================================================
-- What this app sells that a general tool cannot copy is ONE CAPTURE flowing
-- the length of the job: quote → job → photos → completion → invoice → filing →
-- the accountant. Every one of those parts is built. The joint between the
-- first two does not exist.
--
-- `addJob` takes customerId, description, address, scheduled_date,
-- quoted_amount, agreed_amount, trade and priority — a signature written for
-- exactly this handoff. There is ONE call site in the entire app
-- (app/(contractor)/werk.tsx), and it passes a title. Nothing else.
--
-- So every job a contractor creates starts with no customer, no address, no
-- trade and no amount, and this is the single cause behind a long list of
-- separately-reported bugs:
--   • Job.trade undefined      → job forms matched no template (learnings #109)
--   • job.address undefined    → serviced assets matched nothing, and
--                                "directions to a job" had nowhere to go (#110)
--   • quotedAmount undefined   → the EVE draft-invoice action offers no figure
--   • no customer link         → invoices raised from a job cannot name a payer
-- They were filed as four bugs. They are one missing edge, and the fields were
-- never dead — they were never fed.
--
-- The DATA carry-over needs no migration: every destination column already
-- exists on `jobs` (verified against production). This column adds the part
-- that cannot be reconstructed afterwards — WHICH quote a job came from — so
-- the chain is traceable in the database rather than merely implied by matching
-- names and amounts.
--
-- TEXT, not uuid FK. Document ids are minted by `next_document_number` and are
-- human-facing strings ('I0001', '2026-0088'); the app addresses documents by
-- that number, and offline-created quotes carry a placeholder until they flush.
-- A hard FK would reject exactly the offline case this app is built for.
-- =============================================================================

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS quote_id TEXT;

CREATE INDEX IF NOT EXISTS jobs_quote_id_idx
  ON public.jobs (quote_id)
  WHERE quote_id IS NOT NULL;

COMMENT ON COLUMN public.jobs.quote_id IS
  'The quote this job was created from. TEXT (document number), deliberately '
  'not an FK: quotes minted offline carry a placeholder id until they flush. '
  'Set by the "start job from quote" flow; NULL for jobs created directly.';

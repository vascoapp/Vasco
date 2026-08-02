-- =============================================================================
-- regulated_submissions — status for every async statutory filing (v1.11)
-- =============================================================================
-- Vasco generates correct regulated payloads (FatturaPA, Facturae, XRechnung,
-- Factur-X, CIS returns) and today hands them to the OS share sheet. There is
-- no transport and — verified by grep before writing this — no status tracking
-- of any kind anywhere in the codebase.
--
-- Every one of these filings has the same shape: build a payload, hand it to an
-- authority, receive an acknowledgement now and an accept/reject LATER.
--
--   IT  FatturaPA -> SDI            mandatory for 100% of invoices
--   ES  Facturae  -> FACe           B2G
--   FR  Factur-X  -> PDP            phased mandate
--   NL/EU Peppol  -> Access Point
--   UK  CIS monthly return -> HMRC  due the 19th
--   UK  VAT (MTD)          -> HMRC  quarterly
--
-- So this is ONE table, not five. The state machine that governs it lives in
-- src/services/submissionLifecycle.ts and is the authority on legal transitions;
-- the CHECK below only constrains the vocabulary.
--
-- The column that matters most is `state`. "submitted" (the provider has it) and
-- "accepted" (the authority took it) are DIFFERENT, and conflating them is the
-- expensive mistake: a rejected FatturaPA is a legal non-event — the invoice was
-- never issued — so a contractor who believes they filed and did not is worse
-- off than one who never tried.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.regulated_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  channel         TEXT NOT NULL CHECK (channel IN ('sdi','face','pdp','peppol','hmrc_cis','hmrc_mtd')),
  -- Local entity the filing is about: invoice id, CIS tax month, VAT period.
  subject_id      TEXT NOT NULL,

  state           TEXT NOT NULL DEFAULT 'draft'
                  CHECK (state IN ('draft','queued','submitting','submitted','accepted','rejected','failed','cancelled')),

  -- Content-derived (see idempotencyKeyFor / payloadDigest). Correcting a
  -- rejected payload changes the digest, which is exactly when a NEW filing is
  -- legitimate; resending an unchanged payload keeps the key and dedupes.
  -- Duplicate submission is a compliance problem (two invoices, one number),
  -- not merely noise — hence the UNIQUE constraint rather than an index.
  idempotency_key TEXT NOT NULL,

  provider_ref    TEXT,
  -- The rejected filing this one corrects. `rejected` is terminal, so a
  -- correction is always a NEW row; without this link the two records are
  -- strangers and "was that rejection ever resolved?" is unanswerable — which
  -- is the whole reason the rejection is kept rather than mutated.
  supersedes      UUID REFERENCES public.regulated_submissions(id) ON DELETE SET NULL,
  -- Verbatim authority code, e.g. an SDI "scarto" like 00404. Never normalised:
  -- the contractor's accountant will ask for exactly this string.
  authority_code  TEXT,
  last_detail     TEXT,

  -- Full transition trail as [{at,state,detail,authorityCode}]. Append-only in
  -- practice; kept as JSONB so the audit history survives without a child table.
  attempts        JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT regulated_submissions_idempotency_unique UNIQUE (user_id, idempotency_key)
);

-- "What still needs my attention?" — the query behind the badge and the
-- rejected/failed insight. Partial, because terminal-accepted rows are the
-- majority and never appear in it.
CREATE INDEX IF NOT EXISTS idx_regulated_submissions_open
  ON public.regulated_submissions (user_id, channel, state)
  WHERE state NOT IN ('accepted','cancelled');

CREATE INDEX IF NOT EXISTS idx_regulated_submissions_subject
  ON public.regulated_submissions (user_id, channel, subject_id);

-- "Which rejections are still unresolved?" — a rejected row with no successor.
CREATE INDEX IF NOT EXISTS idx_regulated_submissions_supersedes
  ON public.regulated_submissions (supersedes)
  WHERE supersedes IS NOT NULL;

-- ---------------------------------------------------------------------------
-- RLS. Strictly owner-scoped: unlike material_price_history there is no cohort
-- dimension here — a filing is between one contractor and one tax authority.
-- ---------------------------------------------------------------------------
ALTER TABLE public.regulated_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS regulated_submissions_owner_select ON public.regulated_submissions;
CREATE POLICY regulated_submissions_owner_select ON public.regulated_submissions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS regulated_submissions_owner_insert ON public.regulated_submissions;
CREATE POLICY regulated_submissions_owner_insert ON public.regulated_submissions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS regulated_submissions_owner_update ON public.regulated_submissions;
CREATE POLICY regulated_submissions_owner_update ON public.regulated_submissions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- No DELETE policy on purpose: a statutory filing trail is not the contractor's
-- to erase. Account deletion is handled by the ON DELETE CASCADE above.

-- Learnings #87: a policy without a GRANT is inert — GRANT is checked BEFORE
-- RLS, so correct policies over a missing grant is a silent, total failure.
GRANT SELECT, INSERT, UPDATE ON public.regulated_submissions TO authenticated;
-- anon gets nothing. Learnings #90: anon is a member of PUBLIC, so stay explicit.

COMMENT ON TABLE public.regulated_submissions IS
  'Status of async statutory filings (SDI/FACe/PDP/Peppol e-invoices, HMRC CIS + MTD). '
  'State machine authority: src/services/submissionLifecycle.ts. '
  'state=submitted means the PROVIDER has it; only state=accepted means filed.';

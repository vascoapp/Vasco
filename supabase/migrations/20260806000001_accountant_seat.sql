-- =============================================================================
-- ACCOUNTANT SEAT — the collaboration layer, phase 2
-- =============================================================================
-- Phase 1 (b8da995) shipped the handover as text through the share sheet and
-- said plainly what it was not: "a handover the contractor SENDS, not a portal
-- the accountant logs into. A persistent seat needs an access-code table, an RPC
-- and a web view — the pattern the customer portal already uses — and that needs
-- a migration pushed to production." This is that migration.
--
-- WHY THE ADVISER AND NOT MORE CONTRACTOR FEATURES. A Steuerberater or
-- expert-comptable answers the mandate question for dozens of trades clients at
-- once, which makes them a distribution channel rather than a user. Once a
-- practice runs its trades clients through Vasco, the switching cost becomes
-- social rather than technical — the kind that does not decay.
--
-- -----------------------------------------------------------------------------
-- WHY A PUBLISHED SNAPSHOT AND NOT A LIVE VIEW
-- -----------------------------------------------------------------------------
-- Not a shortcut — the only honest option, for two independent reasons.
--
-- 1. THE SERVER CANNOT ASSEMBLE THIS. Per-invoice filing state is the entire
--    differentiator (every accounting package knows what was invoiced; none
--    knows whether SDI accepted it). It lives in AsyncStorage on the
--    contractor's device: `regulated_submissions` exists but nothing writes to
--    it, because no transport exists yet and submissionStore says so out loud.
--    A server-side join would therefore return an authoritative-looking table
--    with the one column that matters silently empty.
--
-- 2. IT IS A SMALLER ANON SURFACE. The anon-facing RPC reads ONE curated row
--    that the contractor explicitly published. There is no join into documents,
--    so there is no path by which a query-shape mistake exposes an invoice the
--    contractor never chose to share. Compare R14/R15 (20260711000003), where a
--    broad anon SELECT over a table whose token WAS the access code let any
--    anon-key holder harvest every portal.
--
-- The snapshot is also the truthful thing to show an adviser: "this is what
-- your client published, as at <date>", not a live figure that may move under
-- them between reading it and filing on it.
--
-- -----------------------------------------------------------------------------
-- READ-ONLY BY CONSTRUCTION
-- -----------------------------------------------------------------------------
-- There is no write path for the accountant, by design and not by omission. An
-- adviser acting on a contractor's behalf without an audit trail is not
-- something to build casually, least of all on the surface where being wrong is
-- a legal event. What the seat does record is the reverse direction: when the
-- adviser last opened it, so the contractor can see their handover was read.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.accountant_handovers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 128 bits from the same generator the decision-tracker portal uses. Never
  -- returned by the RPC below: the R14 lesson is that a readable token IS the
  -- credential, so it goes in on the way to a lookup and never comes back out.
  access_code   TEXT NOT NULL UNIQUE,

  -- Who this seat is for. Display only — it is what the contractor sees in
  -- their list of seats, so they can revoke the right one.
  label         TEXT NOT NULL,

  business_name TEXT NOT NULL,
  country       TEXT NOT NULL,
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,

  -- The AccountantHandover built by src/services/accountantHandoverService.ts.
  -- Stored whole rather than normalised into columns: it is a point-in-time
  -- publication, not a live entity, and shredding it into tables would invite
  -- exactly the "live view" reading this design rejects.
  payload       JSONB NOT NULL,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- A seat is a standing grant of access to financial records, so it expires by
  -- default rather than on request. Default 180 days: long enough to cover a
  -- filing period and the queries that follow it, short enough that a forgotten
  -- link dies on its own.
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '180 days'),
  revoked_at    TIMESTAMPTZ,

  -- The audit trail, pointing at the adviser rather than at the contractor.
  last_viewed_at TIMESTAMPTZ,
  view_count     INTEGER NOT NULL DEFAULT 0
);

-- One live seat per named adviser, so re-publishing a new period refreshes the
-- link the accountant already bookmarked instead of minting a second one they
-- will never open. Revoked rows are excluded so a label can be reused after a
-- seat is withdrawn.
CREATE UNIQUE INDEX IF NOT EXISTS accountant_handovers_live_label
  ON public.accountant_handovers (user_id, lower(label))
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS accountant_handovers_owner
  ON public.accountant_handovers (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS — contractor-scoped. anon gets NOTHING here; it reads via the RPC only.
-- ---------------------------------------------------------------------------
ALTER TABLE public.accountant_handovers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accountant_handovers_owner_select ON public.accountant_handovers;
CREATE POLICY accountant_handovers_owner_select ON public.accountant_handovers
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS accountant_handovers_owner_insert ON public.accountant_handovers;
CREATE POLICY accountant_handovers_owner_insert ON public.accountant_handovers
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS accountant_handovers_owner_update ON public.accountant_handovers;
CREATE POLICY accountant_handovers_owner_update ON public.accountant_handovers
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS accountant_handovers_owner_delete ON public.accountant_handovers;
CREATE POLICY accountant_handovers_owner_delete ON public.accountant_handovers
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Learnings #87: a policy without a GRANT is inert — GRANT is checked BEFORE
-- RLS, so correct policies over a missing grant fail silently and totally.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accountant_handovers TO authenticated;
-- anon deliberately absent. Learnings #90: anon is a member of PUBLIC, so being
-- explicit here is the difference between "we did not grant it" and "we did not
-- notice PUBLIC already had it".

-- ---------------------------------------------------------------------------
-- RPC — the adviser's only door
-- ---------------------------------------------------------------------------
-- Mirrors get_portal_by_access_code (20260511000004): NULL means no such seat,
-- {"expired": true} means the seat existed and no longer opens. The customer
-- portal learned that collapsing those two produces copy that cannot tell
-- someone whether to retype the link or ask for a new one.
--
-- Revoked and expired both return the same discriminator on purpose. "This link
-- was withdrawn by your client" is a fact about the contractor's intent, and
-- leaking it to whoever holds a dead code tells them the code was once real.
CREATE OR REPLACE FUNCTION public.get_accountant_handover(p_access_code TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.accountant_handovers%ROWTYPE;
BEGIN
  -- Format guard before touching the table: a malformed code is never a real
  -- seat, and this keeps junk out of the index and out of the view counter.
  IF p_access_code IS NULL
     OR length(p_access_code) < 16
     OR length(p_access_code) > 64
     OR p_access_code !~ '^[A-Za-z0-9_-]+$' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_row
  FROM public.accountant_handovers
  WHERE access_code = p_access_code;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_row.revoked_at IS NOT NULL OR v_row.expires_at < NOW() THEN
    RETURN jsonb_build_object('expired', true);
  END IF;

  -- Audit the read. The contractor granted a standing view of their financial
  -- records; "has my accountant actually opened this?" is a question they are
  -- entitled to answer, and it is the only thing the adviser's visit writes.
  UPDATE public.accountant_handovers
  SET last_viewed_at = NOW(),
      view_count = view_count + 1
  WHERE id = v_row.id;

  -- access_code is NOT in this projection, and must never be added to it.
  RETURN jsonb_build_object(
    'businessName', v_row.business_name,
    'country',      v_row.country,
    'periodStart',  v_row.period_start,
    'periodEnd',    v_row.period_end,
    'publishedAt',  v_row.updated_at,
    'expiresAt',    v_row.expires_at,
    'handover',     v_row.payload
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_accountant_handover(TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.get_accountant_handover(TEXT) TO anon, authenticated, service_role;

COMMENT ON TABLE public.accountant_handovers IS
  'Published, read-only handover snapshots an adviser opens by access code. '
  'Snapshot not live view: per-invoice filing state lives on the contractor device '
  '(see src/services/submissionStore.ts), so the server cannot assemble it. '
  'anon reads ONLY via get_accountant_handover(); it has no grant on this table.';

-- =============================================================================
-- GOBD AUDIT LOG — R66 round 15 (2026-05-07)
-- =============================================================================
-- The hash-chained audit trail at src/services/gobdAuditTrailService.ts (R250)
-- was AsyncStorage-only. The whole point of GoBD § 146 / NL Belastingdienst
-- AWR Art. 52 audit trails is server-side IMMUTABILITY — proof that records
-- were not retroactively altered. Storing the chain on the device defeats
-- this: any user could `localStorage.clear()` (or reinstall the app) to
-- erase their entire audit history, and a device wipe loses the chain
-- entirely. Tax authorities reject local-only audit trails on principle.
--
-- This migration creates a true append-only ledger:
--   - INSERT permitted for the row owner (auth.uid() = user_id)
--   - NO UPDATE policy, NO DELETE policy → immutable at the RLS layer
--   - Hash chain (prev_hash → content_hash) verified by the FE on read
--   - Per-user monotonic index enforces ordering
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.gobd_audit_log (
  id            text PRIMARY KEY,
  -- DEFAULT auth.uid() so queued offline inserts (which don't carry an
  -- explicit user_id in their payload) still satisfy the RLS check.
  user_id       uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_index   integer NOT NULL,
  type          text NOT NULL,
  ref           text NOT NULL,
  content_hash  text NOT NULL,
  prev_hash     text NOT NULL,
  signed_at     timestamptz NOT NULL,
  metadata      jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- Per-user index uniqueness — prevents two parallel chains for one user.
  UNIQUE (user_id, entry_index)
);

CREATE INDEX IF NOT EXISTS gobd_audit_log_user_index_idx
  ON public.gobd_audit_log (user_id, entry_index);

CREATE INDEX IF NOT EXISTS gobd_audit_log_user_ref_idx
  ON public.gobd_audit_log (user_id, ref);

ALTER TABLE public.gobd_audit_log ENABLE ROW LEVEL SECURITY;

-- INSERT only for the owner.
CREATE POLICY gobd_audit_log_insert_own ON public.gobd_audit_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- SELECT for the owner (auditors with service-role key bypass RLS).
CREATE POLICY gobd_audit_log_select_own ON public.gobd_audit_log
  FOR SELECT USING (auth.uid() = user_id);

-- INTENTIONALLY: no UPDATE policy → no row can be modified through the
-- API at all. Service role is the only mutation path, and it's used only
-- by support/audit tooling.
-- INTENTIONALLY: no DELETE policy → no row can be deleted through the
-- API at all (true append-only ledger).

COMMENT ON TABLE public.gobd_audit_log IS
  'Hash-chained tamper-evident audit trail for invoices/quotes. NL AWR Art. 52 + DE GoBD § 146 retention. Append-only: no UPDATE / no DELETE RLS policies.';

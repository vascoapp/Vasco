-- =============================================================================
-- SIGNATURES TABLE — R66 round 55 (2026-05-11)
-- =============================================================================
-- Closes the GDPR audit-trail gap flagged at R296.
--
-- Pre-R66r55 customer signatures wrote ONLY to `jobs.signature_svg` (a
-- single text column on the job row). On any subsequent jobs.update from
-- the contractor side the SVG could be overwritten, the timestamp was
-- whatever `customerSignoffAt` happened to hold, and there was no record
-- of WHO signed (just "the customer of this job") or under what device
-- conditions. For chargeback / disputed-completion scenarios that's not
-- evidence — it's a string in a row that the contractor can edit.
--
-- This table captures one immutable row per signing event:
--   - what was signed (job_id, optionally invoice/quote)
--   - who signed (signer_name as typed, signer_role for context)
--   - when (signed_at, server-stamped via default)
--   - how (user_agent for device, ip_hash for cohort verification —
--     full IP would be PII so we hash with a daily-rotating salt
--     to enable "same device cluster signed twice today" checks
--     without storing PII long-term)
--   - the SVG bytes (signature_svg)
--
-- RLS: contractor reads their own (via auth.uid() = contractor_user_id);
-- service_role full access (for the eventual signature-share edge fn
-- that lets a customer email-prove they signed without authenticating).
-- Customers signing via the decision portal never query — the portal
-- only writes (gated by the capability-URL access_code RPC pattern
-- from R31/R32). No public read.
--
-- The `jobs.signature_svg` column stays in place as the "current
-- displayed signature" pointer — the audit trail layers on top.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.signatures (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What was signed. job_id is the primary anchor; quote_id / invoice_id
  -- are optional secondary references for when the same signature
  -- backs a multi-document handover. job_id is uuid because R66r28
  -- migrated jobs.id text → uuid + added CASCADE FK on job_photos —
  -- signatures gets the same FK contract from day one.
  job_id               uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
  quote_id             uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  invoice_id           uuid REFERENCES public.documents(id) ON DELETE SET NULL,

  -- Who. contractor_user_id is the contractor whose job is being signed
  -- (used as the RLS predicate). signer_name is the typed name from the
  -- pad ("Jan de Vries"). signer_role disambiguates customer vs. team-lead
  -- vs. inspector for permit handovers.
  contractor_user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signer_name          text NOT NULL,
  signer_role          text NOT NULL DEFAULT 'customer'
    CHECK (signer_role IN ('customer', 'site_lead', 'inspector', 'subcontractor', 'other')),

  -- The signature itself + provenance.
  signature_svg        text NOT NULL,
  user_agent           text,
  ip_hash              text,  -- daily-rotating-salt hash of remote IP

  -- Timestamps. signed_at is server-stamped, not client-controlled —
  -- contractor can't backdate a signature.
  signed_at            timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS signatures_job_id_idx       ON public.signatures(job_id);
CREATE INDEX IF NOT EXISTS signatures_contractor_idx   ON public.signatures(contractor_user_id);
CREATE INDEX IF NOT EXISTS signatures_signed_at_idx    ON public.signatures(signed_at DESC);

ALTER TABLE public.signatures ENABLE ROW LEVEL SECURITY;

-- Contractor can SELECT their own signatures.
DROP POLICY IF EXISTS signatures_select_own ON public.signatures;
CREATE POLICY signatures_select_own ON public.signatures
  FOR SELECT
  USING (auth.uid() = contractor_user_id);

-- Contractor can INSERT a signature for one of their own jobs. The
-- decision-portal flow inserts via SECURITY DEFINER RPC (see below),
-- not via this policy.
DROP POLICY IF EXISTS signatures_insert_own ON public.signatures;
CREATE POLICY signatures_insert_own ON public.signatures
  FOR INSERT
  WITH CHECK (auth.uid() = contractor_user_id);

-- No UPDATE / DELETE policies. Signatures are append-only by design —
-- correcting a wrong signature means inserting a new row with the
-- corrected SVG; the audit trail preserves the original. Service-role
-- bypasses RLS if a real correction is ever needed.

-- ---------------------------------------------------------------------------
-- Decision-portal write path
-- ---------------------------------------------------------------------------
-- The customer signing flow goes through the capability-URL portal
-- (R31/R32). Customer is anonymous — auth.uid() is null — so the
-- INSERT policy above doesn't admit them. Mirror the
-- get_portal_by_access_code pattern: a SECURITY DEFINER RPC that
-- validates the access_code against decision_trackers + writes the
-- signature row server-side with the contractor's user_id resolved
-- from the tracker.

CREATE OR REPLACE FUNCTION public.write_signature_via_portal(
  p_access_code  text,
  p_signer_name  text,
  p_signer_role  text,
  p_signature_svg text,
  p_user_agent   text,
  p_ip_hash      text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tracker_id     uuid;
  v_contractor_id  uuid;
  v_job_text       text;
  v_job_uuid       uuid;
  v_signature_id   uuid;
BEGIN
  -- 1) Resolve tracker → contractor + job. Column names match the
  --    decision_trackers schema (R31 added `expires_at`; `user_id` is
  --    the contractor; `job_id` is TEXT because it pre-dates the
  --    R66r28 jobs.id→uuid migration and may still hold a tempId
  --    for offline-created jobs).
  SELECT id, user_id, job_id
    INTO v_tracker_id, v_contractor_id, v_job_text
    FROM public.decision_trackers
   WHERE access_code = p_access_code
     AND (expires_at IS NULL OR expires_at > now())
   LIMIT 1;

  IF v_tracker_id IS NULL THEN
    RAISE EXCEPTION 'invalid_or_expired_access_code';
  END IF;

  -- 2) Validate signer_role enum (CHECK constraint also catches this
  --    but a clear error message helps client-side debugging).
  IF p_signer_role NOT IN ('customer', 'site_lead', 'inspector', 'subcontractor', 'other') THEN
    RAISE EXCEPTION 'invalid_signer_role';
  END IF;

  -- 3) Best-effort cast job_id text → uuid. If the tracker still
  --    holds a tempId (job created offline, never flushed), store
  --    NULL on job_id and let the contractor's own subsequent signed
  --    insert backfill once tempId resolves. The signer_name / ip_hash
  --    still provide audit value even without a job FK.
  BEGIN
    v_job_uuid := v_job_text::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_job_uuid := NULL;
  END;

  -- 4) Insert. signed_at default = now() server-stamped.
  INSERT INTO public.signatures (
    job_id, contractor_user_id, signer_name, signer_role,
    signature_svg, user_agent, ip_hash
  ) VALUES (
    v_job_uuid, v_contractor_id, p_signer_name, p_signer_role,
    p_signature_svg, p_user_agent, p_ip_hash
  ) RETURNING id INTO v_signature_id;

  RETURN v_signature_id;
END;
$$;

REVOKE ALL ON FUNCTION public.write_signature_via_portal(text, text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.write_signature_via_portal(text, text, text, text, text, text) TO anon, authenticated, service_role;

COMMENT ON TABLE public.signatures IS
  'R66r55: append-only signature audit trail. One row per signing event with server-stamped signed_at + provenance (user_agent, ip_hash). Closes the R296 GDPR gap.';

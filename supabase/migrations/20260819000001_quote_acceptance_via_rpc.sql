-- =============================================================================
-- 20260819000001 — Customer quote acceptance: capability RPCs, not table grants
-- =============================================================================
-- VERIFIED DEAD IN PRODUCTION (2026-08-19). A customer tapping their
-- contractor's approval link could never accept a quote:
--
--   anon SELECT quote_acceptance_links  -> 42501 permission denied
--   anon UPDATE quote_acceptance_links  -> 42501 permission denied
--
-- Migration 20260507000006 created the table and wrote two anon RLS policies
-- (`qal_select_by_token`, `qal_anon_decide`) — but a policy only narrows a
-- privilege that was granted, and `anon` holds ZERO table grants in this
-- project (`information_schema.role_table_grants` for grantee 'anon': 0 rows).
-- So dataProvider.getAcceptanceLinkByToken 401s, logWarn swallows it, and
-- `null` is returned — which processAcceptance maps to "invalid link". The
-- customer is told their contractor's link is broken. Every time, since May.
--
-- ── Why NOT simply GRANT anon SELECT/UPDATE ──────────────────────────────
-- The obvious fix is the dangerous one. `qal_select_by_token` is
-- `FOR SELECT TO anon USING (true)` with the comment "PostgREST forces an
-- eq('token', X) filter for the result to return rows, so anon can't
-- enumerate." That is false — PostgREST returns every RLS-visible row when no
-- filter is supplied. The moment a grant lands, `GET /quote_acceptance_links`
-- with the public anon key dumps every pending token, customer name and quote
-- amount on the platform.
--
-- `qal_anon_decide`'s WITH CHECK is equally optimistic: its comment claims
-- "core fields (amount, quote_id, user_id, token, expires_at) untouched", but
-- the clause is `status IN ('accepted','rejected')` and nothing else. Any
-- column may be rewritten in the same statement — amount, customer name, even
-- user_id — as long as status lands on an allowed value. Combined with the
-- enumeration above: accept or rewrite every quote in the system.
--
-- ── The fix ──────────────────────────────────────────────────────────────
-- Use the pattern this codebase already settled on for anon customer surfaces
-- (20260507000009 get_portal_by_access_code, 20260511000003
-- write_signature_via_portal, and the grant policy set in 20260726000003):
-- SECURITY DEFINER RPCs with an explicit anon EXECUTE grant, and NO table
-- grant at all. The token in the URL is the capability; the function is the
-- only thing that ever sees the table.
--
-- The two anon RLS policies are dropped. They grant nothing today, they are
-- unreachable by design after this change, and leaving them in place leaves a
-- loaded footgun for whoever next reaches for `GRANT ... TO anon`.
-- =============================================================================

DROP POLICY IF EXISTS qal_select_by_token ON public.quote_acceptance_links;
DROP POLICY IF EXISTS qal_anon_decide     ON public.quote_acceptance_links;

-- ---------------------------------------------------------------------------
-- 1. Read one link by its bearer token.
-- ---------------------------------------------------------------------------
-- Returns NULL for malformed AND for absent, so a scanner cannot tell a
-- wrong token from a non-existent one. Never returns user_id or customer_id:
-- those are the contractor's internal identifiers and the customer's UI has
-- no use for them.
--
-- `status` and `expires_at` ARE returned — the customer needs "already
-- answered" and "this link expired" to be different messages, and the
-- client-side service branches on exactly those two fields.

CREATE OR REPLACE FUNCTION public.get_acceptance_link_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.quote_acceptance_links%ROWTYPE;
BEGIN
  -- Format guard before any table lookup, so malformed and not-found cost
  -- the same. Deliberately wider than the current 32-hex generator: links
  -- minted before R66r20 used a 12-char mixed alphabet and are still valid
  -- until they expire.
  IF p_token IS NULL
     OR length(p_token) < 8
     OR length(p_token) > 128
     OR p_token !~ '^[A-Za-z0-9_-]+$' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_row
    FROM public.quote_acceptance_links
   WHERE token = p_token
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'token',             v_row.token,
    'quote_id',          v_row.quote_id,
    'customer_name',     v_row.customer_name,
    'quote_amount',      v_row.quote_amount,
    'quote_description', v_row.quote_description,
    'status',            v_row.status,
    'decline_reason',    v_row.decline_reason,
    'created_at',        v_row.created_at,
    'responded_at',      v_row.responded_at,
    'expires_at',        v_row.expires_at
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Record the customer's decision.
-- ---------------------------------------------------------------------------
-- The one-shot forward transition the old RLS policy was trying to express,
-- expressed where it can actually be enforced: the UPDATE names the three
-- columns a customer is allowed to move and no others, and the WHERE clause
-- re-checks pending + unexpired at write time (so two taps racing cannot both
-- win, and an expired link cannot be decided even if the client's clock says
-- otherwise).
--
-- Returns NULL when the row is absent, already decided or expired. The caller
-- has already read the row and rendered the specific reason; this is the
-- server-side backstop, not the user-facing message.

CREATE OR REPLACE FUNCTION public.decide_acceptance_link(
  p_token    text,
  p_decision text,
  p_reason   text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.quote_acceptance_links%ROWTYPE;
BEGIN
  IF p_token IS NULL
     OR length(p_token) < 8
     OR length(p_token) > 128
     OR p_token !~ '^[A-Za-z0-9_-]+$' THEN
    RETURN NULL;
  END IF;

  IF p_decision IS NOT DISTINCT FROM NULL
     OR p_decision NOT IN ('accepted', 'rejected') THEN
    RAISE EXCEPTION 'invalid_decision';
  END IF;

  UPDATE public.quote_acceptance_links
     SET status         = p_decision,
         responded_at   = now(),
         decline_reason = CASE
                            WHEN p_decision = 'rejected' THEN left(p_reason, 2000)
                            ELSE decline_reason
                          END
   WHERE token      = p_token
     AND status     = 'pending'
     AND expires_at > now()
   RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'token',             v_row.token,
    'quote_id',          v_row.quote_id,
    'customer_name',     v_row.customer_name,
    'quote_amount',      v_row.quote_amount,
    'quote_description', v_row.quote_description,
    'status',            v_row.status,
    'decline_reason',    v_row.decline_reason,
    'created_at',        v_row.created_at,
    'responded_at',      v_row.responded_at,
    'expires_at',        v_row.expires_at
  );
END;
$$;

-- Explicit grants. 20260726000003 revoked default PUBLIC EXECUTE on functions
-- in this schema, so a new SECURITY DEFINER function is unreachable until
-- named here — which is the point: the anon surface is a list someone chose,
-- not a default someone forgot.
REVOKE ALL ON FUNCTION public.get_acceptance_link_by_token(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_acceptance_link_by_token(text)
  TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.decide_acceptance_link(text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.decide_acceptance_link(text, text, text)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.get_acceptance_link_by_token(text) IS
  'Anon-callable. Capability URL: the token IS the credential. Returns NULL for malformed and for absent alike. No table grant exists on quote_acceptance_links — this function is the only anon read path.';

COMMENT ON FUNCTION public.decide_acceptance_link(text, text, text) IS
  'Anon-callable. One-shot pending -> accepted/rejected transition, re-checked at write time. Moves status/responded_at/decline_reason only; amount, quote_id, user_id and expiry are untouchable by the customer.';

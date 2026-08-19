-- =============================================================================
-- 20260819000012 — a customer's decision has to reach the contractor
-- =============================================================================
-- Accepting a quote worked end to end on 2026-08-19 — the customer taps, the
-- row in `quote_acceptance_links` flips to 'accepted', responded_at is stamped.
-- And **the contractor never finds out.**
--
-- `getAcceptanceStatus()` in customerQuoteAcceptanceService is the only thing
-- that reads that table from the contractor's side, and it has ZERO callers.
-- Nothing on the quote list, the quote detail or the dashboard looks at it. So
-- the decision landed in a table nobody opened: the quote still reads "sent",
-- the contractor still chases it, and the customer believes they answered
-- days ago.
--
-- The fix is not another read path. Every contractor surface already reads
-- `documents.status`, so the decision is written THERE, once, in the one place
-- every acceptance route passes through — the web portal, the /accept link and
-- the app all call decide_acceptance_link.
--
-- ── Why the vocabularies line up ────────────────────────────────────────
-- documents_status_check allows draft|sent|accepted|rejected|expired|paid|
-- overdue, and the link's CHECK allows accepted|rejected. The two words we
-- write are valid in both, and QuoteStatus in src/domain/documents.ts uses the
-- same spelling — so no mapping table, and nothing to drift.
--
-- ── Deliberately narrow ─────────────────────────────────────────────────
-- Matched on user_id + document_number + doc_type='quote'. `quote_id` on the
-- link is TEXT holding the document_number form ("Q-260001"), not a uuid — the
-- comment on that column says so, and matching on it alone across all users
-- would be a cross-tenant write. The doc_type guard stops an invoice that
-- happens to share a number from being flipped.
--
-- A quote already 'paid' is left alone: money has moved, and a late
-- "accepted" would walk the status backwards.
-- =============================================================================

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
  v_row     public.quote_acceptance_links%ROWTYPE;
  v_name    text;
  v_country text;
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

  -- The half that was missing. Best-effort: a customer's acceptance must be
  -- recorded even if the quote row cannot be matched (an offline-created quote
  -- whose document_number was re-minted on flush, say). Losing the decision
  -- because the mirror failed would be worse than a stale badge.
  BEGIN
    UPDATE public.documents
       SET status     = v_row.status,
           updated_at = now()
     WHERE user_id         = v_row.user_id
       AND document_number = v_row.quote_id
       AND doc_type        = 'quote'
       AND status NOT IN ('paid', 'accepted', 'rejected');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  SELECT bs.business_name, bs.country
    INTO v_name, v_country
    FROM public.business_settings bs
   WHERE bs.user_id = v_row.user_id;

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
    'expires_at',        v_row.expires_at,
    'contractor_name',    v_name,
    'contractor_country', v_country
  );
END;
$$;

REVOKE ALL ON FUNCTION public.decide_acceptance_link(text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.decide_acceptance_link(text, text, text)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.decide_acceptance_link(text, text, text) IS
  'Anon-callable. One-shot pending -> accepted/rejected, re-checked at write time, AND mirrors the decision onto documents.status so the contractor actually sees it — getAcceptanceStatus() has no callers, so the link table alone reaches nobody.';

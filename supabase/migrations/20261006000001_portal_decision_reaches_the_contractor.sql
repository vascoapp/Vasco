-- A customer's decision in the quote portal reaches the contractor (W119).
--
-- IT walk 2026-10-06: a customer accepted in the portal and the contractor
-- learned nothing — no push, no business event (Finanze "Accettati 0"), no
-- job. decide_acceptance_link only mirrored documents.status. The portal
-- meanwhile said "your contractor has been notified".
--
-- Here: the RPC records the outcome event and creates the job (both in the
-- same call, so they happen even if the contractor's app is closed and the
-- portal's follow-up call is lost). The PUSH is the `quote-decided` edge
-- function's job — Postgres holds no service key to call Expo with — and
-- `notified_at` is its once-only claim, so a reload or a replayed request
-- never pushes twice.
--
-- Signature, grants and the FR withdrawal gate are unchanged; the body is the
-- live one (compared with pg_get_functiondef before writing this) plus the two
-- blocks marked W119.

ALTER TABLE public.quote_acceptance_links
  ADD COLUMN IF NOT EXISTS notified_at timestamptz;

COMMENT ON COLUMN public.quote_acceptance_links.notified_at IS
  'When the contractor was pushed about the decision (quote-decided edge function). Set once; the claim that makes the push idempotent.';

-- ONE job per quote, held by the database. The RPC below creates the job for a
-- portal acceptance; the app has three paths of its own that create one too
-- (convertQuoteToJob, updateQuote('accepted'), the in-app accept link). Any of
-- them running for a quote the server already accepted made a second job
-- (W119 review). With this index the second insert is refused (23505) and the
-- app adopts the existing row (findJobIdForQuote). Prod held 0 jobs with a
-- quote_id and 0 duplicates when this was written.
CREATE UNIQUE INDEX IF NOT EXISTS jobs_one_per_quote
  ON public.jobs (user_id, quote_id)
  WHERE quote_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.decide_acceptance_link(
  p_token           text,
  p_decision        text,
  p_reason          text DEFAULT NULL,
  p_withdrawal_ack  boolean DEFAULT false
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
  v_owner   uuid;
  v_trade   text;
  v_doc     record;
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

  -- The contractor's country must be known BEFORE the update: the gate decides
  -- whether the update may happen at all.
  SELECT l.user_id INTO v_owner
    FROM public.quote_acceptance_links l
   WHERE l.token = p_token
     AND l.status = 'pending'
     AND l.expires_at > now();

  IF v_owner IS NOT NULL THEN
    SELECT bs.country INTO v_country
      FROM public.business_settings bs
     WHERE bs.user_id = v_owner;

    -- Rejecting needs no acknowledgement: the right being waived is the right
    -- to UNDO a commitment, and declining commits to nothing.
    IF p_decision = 'accepted'
       AND upper(coalesce(v_country, '')) = 'FR'
       AND p_withdrawal_ack IS NOT TRUE THEN
      RAISE EXCEPTION 'withdrawal_ack_required';
    END IF;
  END IF;

  UPDATE public.quote_acceptance_links
     SET status         = p_decision,
         responded_at   = now(),
         decline_reason = CASE
                            WHEN p_decision = 'rejected' THEN left(p_reason, 2000)
                            ELSE decline_reason
                          END,
         withdrawal_ack_at = CASE
                               WHEN p_decision = 'accepted' AND p_withdrawal_ack IS TRUE
                                 THEN now()
                               ELSE withdrawal_ack_at
                             END
   WHERE token      = p_token
     AND status     = 'pending'
     AND expires_at > now()
   RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Best-effort mirror onto the quote. Preserved from 20260819000012: losing
  -- the customer's decision because the mirror failed would be worse than a
  -- stale badge.
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

  SELECT bs.business_name, bs.country, bs.trade
    INTO v_name, v_country, v_trade
    FROM public.business_settings bs
   WHERE bs.user_id = v_row.user_id;

  -- The decision reaches the contractor (W119, IT walk 2026-10-06). Until
  -- now a portal decision flipped documents.status and nothing else: no
  -- business event (the Finanze card counted 0 accepted), no job (an in-app
  -- accept creates one), and the portal told the customer "your contractor
  -- has been notified" while nothing did. Each step is best-effort for the
  -- same reason as the mirror above — the customer's decision must never be
  -- lost to a side effect — and `npm run check:quote-decision` proves on the
  -- live database that both rows land.
  --
  -- 1. The outcome event, the same row the app's emitQuoteAccepted /
  --    emitQuoteRejected write for an in-app decision (with trade + country
  --    for the cohort, R281). ts_daily_business_metrics counts it.
  BEGIN
    INSERT INTO public.business_events (user_id, event_type, entity_type, entity_id, payload, trade, country)
    VALUES (
      v_row.user_id,
      CASE WHEN v_row.status = 'accepted' THEN 'quote_accepted' ELSE 'quote_rejected' END,
      'quote',
      v_row.quote_id,
      jsonb_build_object('source', 'portal', 'quotedAmount', v_row.quote_amount, 'acceptedAmount',
                         CASE WHEN v_row.status = 'accepted' THEN v_row.quote_amount ELSE NULL END),
      v_trade,
      v_country
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- 2. The job, as the app's buildJobFromQuote maps it (title, scope, net
  --    amount as quoted AND agreed, the contractor's trade, the quote link) —
  --    once per quote: nothing is created if a job already carries this quote.
  IF v_row.status = 'accepted' THEN
    BEGIN
      SELECT d.customer_id, d.title, d.scope_text, d.total_amount
        INTO v_doc
        FROM public.documents d
       WHERE d.user_id         = v_row.user_id
         AND d.document_number = v_row.quote_id
         AND d.doc_type        = 'quote'
         AND d.deleted_at IS NULL
       LIMIT 1;
      IF FOUND AND NOT EXISTS (
        SELECT 1 FROM public.jobs j
         WHERE j.user_id = v_row.user_id AND j.quote_id = v_row.quote_id
      ) THEN
        INSERT INTO public.jobs (user_id, customer_id, title, description, status,
                                 quoted_amount, agreed_amount, trade, priority, quote_id)
        VALUES (
          v_row.user_id,
          v_doc.customer_id,
          coalesce(nullif(btrim(v_doc.title), ''), nullif(btrim(v_row.quote_description), ''), v_row.quote_id),
          v_doc.scope_text,
          'scheduled',
          v_doc.total_amount,
          v_doc.total_amount,
          v_trade,
          'normal',
          v_row.quote_id
        )
        ON CONFLICT (user_id, quote_id) WHERE quote_id IS NOT NULL DO NOTHING;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
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
    'expires_at',        v_row.expires_at,
    'contractor_name',    v_name,
    'contractor_country', v_country,
    'withdrawal_ack_at',  v_row.withdrawal_ack_at
  );
END;
$$;

-- CREATE OR REPLACE keeps the grants; stated again so this file alone says
-- who may call it (the anon surface is a list someone chose).
REVOKE ALL ON FUNCTION public.decide_acceptance_link(text, text, text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.decide_acceptance_link(text, text, text, boolean)
  TO anon, authenticated, service_role;

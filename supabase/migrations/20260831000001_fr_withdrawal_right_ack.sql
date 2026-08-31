-- FR statutory withdrawal right (Code de la consommation L221-5 / L221-9).
--
-- A French contractor's customer who accepts a devis away from business
-- premises has 14 days to withdraw, and must be TOLD so before they commit.
-- Most renovation work is signed at the customer's kitchen table, so this is
-- the normal case in France, not the edge one.
--
-- Two decisions worth stating, because both are load-bearing:
--
-- 1. The acknowledgement is ENFORCED here, not merely displayed. A check that
--    lives only in the web page is a check the next client forgets: the app
--    has its own accept path (src/lib/dataProvider.ts) and a third caller is
--    always one feature away. FR acceptance without the acknowledgement now
--    raises, so the guarantee is the database's, not the UI's.
--
-- 2. We record the TIME, not an IP. PostgREST reaches Postgres through a
--    pooler, so `inet_client_addr()` is Supabase's address, not the customer's
--    — storing it would be a fabricated audit trail, which is worse than none.
--    If IP is ever legally required it has to come from an edge function that
--    can read x-forwarded-for.

ALTER TABLE public.quote_acceptance_links
  ADD COLUMN IF NOT EXISTS withdrawal_ack_at timestamptz;

COMMENT ON COLUMN public.quote_acceptance_links.withdrawal_ack_at IS
  'When the customer acknowledged the 14-day withdrawal right (FR, Code de la consommation L221-5/L221-9). NULL where the right does not apply or was not yet acknowledged.';

-- The 3-arg signature is DROPPED rather than left beside a 4-arg overload:
-- two callable signatures is exactly how PostgREST ends up resolving the one
-- WITHOUT the enforcement.
DROP FUNCTION IF EXISTS public.decide_acceptance_link(text, text, text);

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
    'contractor_country', v_country,
    'withdrawal_ack_at',  v_row.withdrawal_ack_at
  );
END;
$$;

-- 20260726000003 revoked default PUBLIC EXECUTE in this schema, so a new
-- signature is unreachable until named here. That is the point: the anon
-- surface is a list someone chose, not a default someone forgot.
REVOKE ALL ON FUNCTION public.decide_acceptance_link(text, text, text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.decide_acceptance_link(text, text, text, boolean)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.decide_acceptance_link(text, text, text, boolean) IS
  'Anon-callable. Capability URL: the token IS the credential. For a FR contractor an acceptance without p_withdrawal_ack raises withdrawal_ack_required — the L221-5/L221-9 notice is enforced here, not in the UI. No table grant exists on quote_acceptance_links.';

-- =============================================================================
-- 20260819000005 — Say who sent the quote
-- =============================================================================
-- `/accept/<token>` is getting a real accept button (it previously showed no
-- quote content at all and bounced the customer to an app they do not have).
-- To render anything honest it needs to name the sender: "Van der Berg
-- Loodgieters sent you a quote" is the whole reassurance of a capability link
-- arriving cold in a WhatsApp message.
--
-- It also needs the contractor's COUNTRY. The currency on a customer-facing
-- page follows the contractor, not the reader's browser — a Dutch contractor's
-- quote is in euros whichever phone opens it (ui-playbook §8, and learnings
-- #151/#157: a default that is a market, not a neutral).
--
-- Both resolved SERVER-SIDE from the row's user_id, which is still never
-- returned. The customer learns the business name and country the contractor
-- publishes on their own quotes — nothing else, and nothing they could not read
-- off the PDF.
--
-- Additive: the existing keys are unchanged, so a client that has not shipped
-- yet keeps working. Same jsonb shape is returned by decide_acceptance_link so
-- the page can render a confirmation without a second round-trip.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_acceptance_link_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row      public.quote_acceptance_links%ROWTYPE;
  v_name     text;
  v_country  text;
BEGIN
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
    -- NOT user_id. The contractor's uuid stays server-side; these two are what
    -- a customer already sees on any quote they are sent.
    'contractor_name',    v_name,
    'contractor_country', v_country
  );
END;
$$;

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

-- CREATE OR REPLACE drops a function's SET clauses and its ACL is preserved,
-- but 20260806000002 learned the hard way that the search_path pin must be
-- re-declared (it is, above). Re-granting is cheap and makes the anon surface
-- explicit in a grant query rather than implied.
REVOKE ALL ON FUNCTION public.get_acceptance_link_by_token(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_acceptance_link_by_token(text)
  TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.decide_acceptance_link(text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.decide_acceptance_link(text, text, text)
  TO anon, authenticated, service_role;

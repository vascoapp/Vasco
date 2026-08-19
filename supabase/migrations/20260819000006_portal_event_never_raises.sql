-- =============================================================================
-- 20260819000006 — record_portal_event must never raise, and it could
-- =============================================================================
-- `customer_portal_events.event_type` carries a CHECK constraint listing twelve
-- allowed values. `record_portal_event` validates the access code and the
-- length of the event type, then inserts — so a caller passing a thirteenth
-- value gets a 23514 check violation propagated straight out of the function.
--
-- Its own COMMENT says "returns false instead of raising — telemetry must not
-- break the customer's screen", and until now that was true only for the
-- failures I happened to think of. A constraint is exactly the kind of thing
-- that changes underneath a client: the mobile app ships on its own cadence,
-- and an app version that learns a new event name before the database does
-- would start throwing on a page whose whole job is to let a customer answer
-- a quote.
--
-- Validating against a copy of the allowed list here would be a second
-- registry of the same facts, and hand-maintained registries drift in both
-- directions at once (learnings #170). So: catch instead. Any insert failure
-- is swallowed and reported as `false`, which is what the contract already
-- promised. The distinction the caller needs — "recorded" vs "not recorded" —
-- is preserved; the distinction it does not need — WHY — stays out of an
-- unauthenticated caller's response.
--
-- log_portal_activity gets the same treatment: decision_activities has no
-- CHECK today, but it is the same kind of endpoint and the same promise.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.record_portal_event(
  p_access_code text,
  p_event_type  text,
  p_decision_id text DEFAULT NULL,
  p_quote_id    text DEFAULT NULL,
  p_duration_ms int  DEFAULT NULL,
  p_metadata    jsonb DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF p_access_code IS NULL
     OR length(p_access_code) < 4
     OR length(p_access_code) > 64
     OR p_access_code !~ '^[A-Za-z0-9_-]+$'
     OR p_event_type IS NULL
     OR length(p_event_type) > 64 THEN
    RETURN false;
  END IF;

  SELECT user_id INTO v_user_id
    FROM public.decision_trackers
   WHERE access_code = p_access_code
     AND (expires_at IS NULL OR expires_at > now())
   LIMIT 1;

  IF v_user_id IS NULL THEN RETURN false; END IF;

  BEGIN
    INSERT INTO public.customer_portal_events (
      portal_token, contractor_user_id, quote_id, decision_id,
      event_type, duration_ms, metadata
    ) VALUES (
      p_access_code, v_user_id, p_quote_id, p_decision_id,
      p_event_type, p_duration_ms, p_metadata
    );
  EXCEPTION WHEN OTHERS THEN
    -- Includes 23514, the event_type CHECK. A telemetry row is never worth an
    -- error on the page a customer is trying to answer a quote on.
    RETURN false;
  END;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_portal_activity(
  p_access_code   text,
  p_activity_type text,
  p_item_id       uuid DEFAULT NULL,
  p_metadata      jsonb DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tracker_id uuid;
BEGIN
  IF p_access_code IS NULL
     OR length(p_access_code) < 4
     OR length(p_access_code) > 64
     OR p_access_code !~ '^[A-Za-z0-9_-]+$'
     OR p_activity_type IS NULL
     OR length(p_activity_type) > 64 THEN
    RETURN false;
  END IF;

  SELECT id INTO v_tracker_id
    FROM public.decision_trackers
   WHERE access_code = p_access_code
     AND (expires_at IS NULL OR expires_at > now())
   LIMIT 1;

  IF v_tracker_id IS NULL THEN RETURN false; END IF;

  BEGIN
    INSERT INTO public.decision_activities (tracker_id, activity_type, item_id, metadata)
    VALUES (v_tracker_id, p_activity_type, p_item_id, p_metadata);
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.record_portal_event(text, text, text, text, int, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.record_portal_event(text, text, text, text, int, jsonb)
  TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.log_portal_activity(text, text, uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.log_portal_activity(text, text, uuid, jsonb)
  TO anon, authenticated, service_role;

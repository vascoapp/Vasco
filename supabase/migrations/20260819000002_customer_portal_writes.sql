-- =============================================================================
-- 20260819000002 — The customer decision portal was one-way
-- =============================================================================
-- Same root cause as 20260819000001, three more surfaces. `anon` holds no
-- table grant in this project, and every write the customer portal makes goes
-- straight at a table:
--
--   anon upsert decision_submissions   -> 42501 permission denied
--   anon insert decision_activities    -> 42501 permission denied
--   anon insert customer_portal_events -> 42501 permission denied
--
-- The READ side works (get_portal_by_access_code is a granted SECURITY DEFINER
-- RPC), so the portal loads, renders the customer's decisions, and accepts
-- their answers. None of it reaches the contractor. decisionSyncService saves
-- locally and returns 'local', which the portal honestly reports to the
-- customer — but the retry it promises runs on the customer's own device
-- against the same 401, forever.
--
-- What is dead as a result:
--   · decision_submissions  — the contractor's decision inbox and the
--     realtime badge on /decisions. A customer can never answer anything.
--   · decision_activities   — the "where did the customer hesitate" timeline
--     added in R66r47. Never had a real row.
--   · customer_portal_events — the moat's portal-engagement feed. Its insert
--     never checks `error`, so even the write-failure log never fired: the
--     failure was invisible from both ends.
--
-- ── Plus one phantom ─────────────────────────────────────────────────────
-- decisionSyncService calls `rpc('update_tracker_progress')` after every
-- submission. That function has never existed — not in prod, not in any
-- migration in this repo. It is called inside a bare try/catch marked
-- "Non-critical", so `decision_trackers.completed_items` has never advanced
-- for anyone, including on the contractor-authenticated path where the
-- submission write itself does succeed. Every tracker reads "0 of N decided".
-- Defined here.
--
-- ── Shape ────────────────────────────────────────────────────────────────
-- Same as 20260819000001: SECURITY DEFINER RPCs keyed on the capability the
-- customer actually holds (the tracker's access_code, which is what
-- /customer/[code] is), explicit anon EXECUTE, and no table grant anywhere.
-- The customer's device never names its own tracker_id, contractor_user_id or
-- submitted_by — all three are resolved server-side from the code, so a
-- caller cannot write into someone else's tracker or file an answer as the
-- contractor.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. update_tracker_progress — recount, don't increment.
-- ---------------------------------------------------------------------------
-- Counts DISTINCT item_id so a customer changing their mind (upsert on the
-- same item) doesn't inflate the total, and clamps to total_items.
-- SECURITY DEFINER + no anon grant: it is called from the portal RPC below,
-- which has already proven the caller holds the access code, and from the
-- contractor's authenticated client where RLS scopes the tracker anyway.

CREATE OR REPLACE FUNCTION public.update_tracker_progress(p_tracker_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_done int;
BEGIN
  IF p_tracker_id IS NULL THEN RETURN; END IF;

  SELECT count(DISTINCT item_id) INTO v_done
    FROM public.decision_submissions
   WHERE tracker_id = p_tracker_id;

  UPDATE public.decision_trackers
     SET completed_items = least(v_done, greatest(total_items, 0)),
         -- decision_trackers_status_check allows only active/completed/
         -- expired. There is no 'in_progress' to move to, and demoting a
         -- tracker out of 'completed' because an item was re-opened is a
         -- decision for the contractor, not a counter. So: promote to
         -- completed when every item is answered, otherwise leave alone.
         status = CASE
                    WHEN total_items > 0 AND v_done >= total_items THEN 'completed'
                    ELSE status
                  END,
         updated_at = now()
   WHERE id = p_tracker_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_tracker_progress(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_tracker_progress(uuid)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1. The customer answers one decision.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_decision_via_portal(
  p_access_code             text,
  p_item_id                 uuid,
  p_value                   text,
  p_notes                   text DEFAULT NULL,
  p_photos                  text[] DEFAULT NULL,
  p_linked_product_url      text DEFAULT NULL,
  p_time_to_decide_seconds  int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tracker_id uuid;
  v_row        public.decision_submissions%ROWTYPE;
BEGIN
  IF p_access_code IS NULL
     OR length(p_access_code) < 4
     OR length(p_access_code) > 64
     OR p_access_code !~ '^[A-Za-z0-9_-]+$'
     OR p_item_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_tracker_id
    FROM public.decision_trackers
   WHERE access_code = p_access_code
     AND (expires_at IS NULL OR expires_at > now())
   LIMIT 1;

  IF v_tracker_id IS NULL THEN
    RETURN NULL;   -- unknown or expired code; no existence distinction
  END IF;

  -- The item must belong to THIS tracker. Without this an access code for
  -- one project could answer another project's items.
  IF NOT EXISTS (
    SELECT 1 FROM public.decision_items
     WHERE id = p_item_id AND tracker_id = v_tracker_id
  ) THEN
    RETURN NULL;
  END IF;

  -- submitted_by is hardcoded, never taken from the caller: this endpoint is
  -- reachable only by whoever holds a customer's link, so 'customer' is the
  -- only truthful value. submitted_at is server-stamped for the same reason
  -- responded_at is in decide_acceptance_link.
  INSERT INTO public.decision_submissions (
    tracker_id, item_id, submitted_by, value, notes, photos,
    linked_product_url, time_to_decide_seconds, submitted_at
  ) VALUES (
    v_tracker_id, p_item_id, 'customer', p_value, left(p_notes, 4000), p_photos,
    left(p_linked_product_url, 2000), p_time_to_decide_seconds, now()
  )
  ON CONFLICT (tracker_id, item_id, submitted_by) DO UPDATE
    SET value                  = excluded.value,
        notes                  = excluded.notes,
        photos                 = excluded.photos,
        linked_product_url     = excluded.linked_product_url,
        time_to_decide_seconds = excluded.time_to_decide_seconds,
        submitted_at           = excluded.submitted_at
  RETURNING * INTO v_row;

  PERFORM public.update_tracker_progress(v_tracker_id);

  RETURN jsonb_build_object(
    'id',                     v_row.id,
    'tracker_id',             v_row.tracker_id,
    'item_id',                v_row.item_id,
    'submitted_by',           v_row.submitted_by,
    'value',                  v_row.value,
    'notes',                  v_row.notes,
    'photos',                 v_row.photos,
    'linked_product_url',     v_row.linked_product_url,
    'time_to_decide_seconds', v_row.time_to_decide_seconds,
    'submitted_at',           v_row.submitted_at
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Portal activity (the hesitation timeline).
-- ---------------------------------------------------------------------------
-- Returns boolean rather than raising: telemetry must never be the reason a
-- customer's screen shows an error.

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

  INSERT INTO public.decision_activities (tracker_id, activity_type, item_id, metadata)
  VALUES (v_tracker_id, p_activity_type, p_item_id, p_metadata);

  RETURN true;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Portal engagement events (moat feed).
-- ---------------------------------------------------------------------------
-- contractor_user_id is resolved from the tracker, never accepted from the
-- caller — the client used to pass it and a customer's browser has no
-- business naming which contractor a row belongs to.

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

  INSERT INTO public.customer_portal_events (
    portal_token, contractor_user_id, quote_id, decision_id,
    event_type, duration_ms, metadata
  ) VALUES (
    p_access_code, v_user_id, p_quote_id, p_decision_id,
    p_event_type, p_duration_ms, p_metadata
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_decision_via_portal(text, uuid, text, text, text[], text, int) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_decision_via_portal(text, uuid, text, text, text[], text, int)
  TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.log_portal_activity(text, text, uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.log_portal_activity(text, text, uuid, jsonb)
  TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.record_portal_event(text, text, text, text, int, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.record_portal_event(text, text, text, text, int, jsonb)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.submit_decision_via_portal(text, uuid, text, text, text[], text, int) IS
  'Anon-callable. Tracker resolved from access_code; item ownership checked; submitted_by and submitted_at set server-side. The only anon write path to decision_submissions.';
COMMENT ON FUNCTION public.log_portal_activity(text, text, uuid, jsonb) IS
  'Anon-callable. Returns false instead of raising — telemetry must not break the customer''s screen.';
COMMENT ON FUNCTION public.record_portal_event(text, text, text, text, int, jsonb) IS
  'Anon-callable. contractor_user_id resolved from the tracker, never from the caller.';

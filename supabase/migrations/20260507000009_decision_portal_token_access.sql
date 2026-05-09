-- =============================================================================
-- R66 round 31 — customer decision portal: capability-URL access via RPC
-- =============================================================================
-- Pre-R31 the customer-facing portal at app/customer/[code] resolved through
-- mockCustomerPortal.validateAccessCode which always returns false in non-DEMO
-- mode. Migration 003 created decision_trackers with `access_code TEXT
-- UNIQUE` but no anon read surface — only contractor (auth.uid() = user_id)
-- could SELECT. R66r25 gated the contractor's "share with customer" button
-- precisely because any link would dead-end at "Code ongeldig" on the
-- customer's device.
--
-- Same shape as R66r19 (quote_acceptance_links): a high-entropy token in the
-- URL acts as bearer credential, server-side validates, returns the data
-- the customer's UI needs in one round-trip.
--
-- This round (R31) lands the migration only. R32 wires up the FE service
-- and replaces the mock-only flow. Mirrors R19 → R20 split.
-- =============================================================================

-- 1. Extend decision_trackers with the columns the customer-facing UI
--    needs. Pre-R31 the contractor-side FE held customer/project metadata
--    in component state only — even with a working portal-token, the
--    customer would see blank header info because it never reached BE.
ALTER TABLE public.decision_trackers
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS customer_email TEXT,
  ADD COLUMN IF NOT EXISTS project_name TEXT,
  ADD COLUMN IF NOT EXISTS project_start_date DATE,
  ADD COLUMN IF NOT EXISTS quote_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- 2. SECURITY DEFINER RPC: the only anon-callable read surface. No table-
--    level anon SELECT is granted on any of decision_trackers, _items, or
--    _submissions; a malformed access_code returns NULL without leaking
--    row existence (no separate "not found" vs "wrong code" distinction).
CREATE OR REPLACE FUNCTION public.get_portal_by_access_code(p_access_code TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tracker public.decision_trackers%ROWTYPE;
  v_business jsonb;
  v_categories jsonb;
  v_total int;
  v_completed int;
  v_overdue int;
BEGIN
  -- Format guard: mirrors app/customer/[code].tsx's regex. Reject before
  -- any table lookup so we don't leak timing differences between
  -- "malformed" and "not found".
  IF p_access_code IS NULL
     OR length(p_access_code) < 4
     OR length(p_access_code) > 64
     OR p_access_code !~ '^[A-Za-z0-9_-]+$' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_tracker
  FROM public.decision_trackers
  WHERE access_code = p_access_code;

  IF NOT FOUND OR v_tracker.status = 'expired' THEN
    RETURN NULL;
  END IF;

  -- Honor explicit expires_at if set.
  IF v_tracker.expires_at IS NOT NULL AND v_tracker.expires_at < now() THEN
    RETURN NULL;
  END IF;

  -- Contractor branding/info from business_settings (1:1 with user_id).
  -- LEFT JOIN — a contractor without a settings row still resolves the
  -- portal, just with empty branding fields.
  SELECT jsonb_build_object(
    'contractorName', COALESCE(bs.business_name, ''),
    'contractorCompany', bs.business_name,
    'contractorPhone', bs.phone,
    'contractorLogo', bs.logo_url,
    'contractorCountry', bs.country
  )
  INTO v_business
  FROM public.business_settings bs
  WHERE bs.user_id = v_tracker.user_id
  LIMIT 1;

  -- Items grouped by category, with the latest submission joined per item.
  -- A submission with submitted_by='customer' wins over contractor-recorded
  -- one (matches FE precedence in CustomerDecisionPortal.tsx).
  WITH item_with_sub AS (
    SELECT
      i.id,
      i.tracker_id,
      i.category,
      i.label,
      i.help_text,
      i.input_type,
      i.options,
      i.is_required,
      i.due_date,
      i.sort_order,
      (
        SELECT to_jsonb(s.*)
        FROM public.decision_submissions s
        WHERE s.tracker_id = i.tracker_id AND s.item_id = i.id
        ORDER BY (s.submitted_by = 'customer') DESC, s.submitted_at DESC
        LIMIT 1
      ) AS sub
    FROM public.decision_items i
    WHERE i.tracker_id = v_tracker.id
  )
  SELECT
    COALESCE(jsonb_agg(cat ORDER BY cat->>'name'), '[]'::jsonb),
    COALESCE(SUM((cat->>'totalCount')::int), 0),
    COALESCE(SUM((cat->>'completedCount')::int), 0),
    COALESCE(SUM((cat->>'overdueCount')::int), 0)
  INTO v_categories, v_total, v_completed, v_overdue
  FROM (
    SELECT
      jsonb_build_object(
        'id', i.category,
        'name', i.category,
        'phase', 'planning',
        'items', jsonb_agg(
          jsonb_build_object(
            'id', i.id,
            'name', i.label,
            'description', COALESCE(i.help_text, ''),
            'inputType', i.input_type,
            'options', i.options,
            'priority', 'important',
            'status', CASE WHEN i.sub IS NOT NULL THEN 'decided' ELSE 'pending' END,
            'dueDate', i.due_date,
            'isOverdue', (i.due_date IS NOT NULL AND i.due_date < current_date AND i.sub IS NULL),
            'value', i.sub->>'value',
            'notes', i.sub->>'notes',
            'photoUrls', i.sub->'photos',
            'decidedAt', i.sub->>'submitted_at'
          ) ORDER BY i.sort_order
        ),
        'totalCount', count(*),
        'completedCount', count(*) FILTER (WHERE i.sub IS NOT NULL),
        'overdueCount', count(*) FILTER (
          WHERE i.due_date IS NOT NULL AND i.due_date < current_date AND i.sub IS NULL
        ),
        'dueDate', to_jsonb(min(i.due_date)),
        'isOverdue', (
          min(i.due_date) IS NOT NULL
          AND min(i.due_date) < current_date
          AND count(*) FILTER (WHERE i.sub IS NULL) > 0
        )
      ) AS cat
    FROM item_with_sub i
    GROUP BY i.category
  ) categories;

  RETURN jsonb_build_object(
    'accessToken', v_tracker.access_code,
    'business', COALESCE(v_business, '{}'::jsonb),
    'customerName', v_tracker.customer_name,
    'customerPhone', v_tracker.customer_phone,
    'customerEmail', v_tracker.customer_email,
    'projectName', COALESCE(v_tracker.project_name, ''),
    'projectStartDate', COALESCE(v_tracker.project_start_date, v_tracker.created_at::date),
    'currentPhase', 'planning',
    'categories', COALESCE(v_categories, '[]'::jsonb),
    'totalDecisions', v_total,
    'completedDecisions', v_completed,
    'overdueDecisions', v_overdue,
    'quoteAmount', v_tracker.quote_amount,
    'depositAmount', v_tracker.deposit_amount
  );
END;
$$;

-- Anon EXECUTE — that's the only public read surface. Authenticated role
-- gets it too so the contractor's app can preview the customer view.
GRANT EXECUTE ON FUNCTION public.get_portal_by_access_code(TEXT) TO anon, authenticated;

-- Notes for R32 (service rewrite round, follows this migration):
--   * decisionTrackerService.ts to be added: createTracker (writes
--     decision_trackers WITHOUT id letting DB gen UUID; bulk-inserts
--     decision_items with the returned tracker uuid; returns the FE
--     tracker shape with BE UUIDs swapped in everywhere).
--   * R52/R54 contract: tempId-keyed local state at create time, swap
--     to BE row.id on success via idRemapBus, queue on BE failure.
--   * Customer-side app/customer/[code].tsx switches from
--     mockCustomerPortal.getPortalByAccessCode to supabase.rpc(
--     'get_portal_by_access_code', { p_access_code: code }).
--   * Mock stays as DEMO_MODE-only fallback for the 'VDB24A' demo code.
--   * Ungate R66r25 share-with-customer once the BE round-trip works.

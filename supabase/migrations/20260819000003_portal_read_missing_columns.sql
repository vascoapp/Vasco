-- =============================================================================
-- 20260819000003 — The customer decision portal read has NEVER succeeded
-- =============================================================================
-- `get_portal_by_access_code` is the only way a customer's browser loads their
-- decision list. Called with a real access code against prod:
--
--     ERROR: column di.priority does not exist
--
-- `decision_items` has: id, tracker_id, category, label, help_text, input_type,
-- options, is_required, due_date, sort_order, created_at. It has never had
-- `priority` or `is_overdue`. The RPC has referenced both since
-- 20260511000004 (11 May), through three subsequent redefinitions, so no real
-- tracker has ever rendered in the portal — only the DEMO_MODE mock path,
-- which never touches this function.
--
-- It survived because every probe of this endpoint used a junk access code,
-- which returns NULL at the format guard BEFORE any table is read. A 200 from
-- the guard looks exactly like a 200 from a successful query. The columns are
-- also wrapped in `COALESCE(di.priority, 'important')` — defensive code for a
-- NULL value, written by someone who never checked the column existed. COALESCE
-- does not survive a missing column; the statement fails to plan.
--
-- Fix: derive both from columns that DO exist, rather than adding two more
-- columns nothing writes.
--   · priority  — the contractor's write path already collapses it into
--                 `is_required` (decisionTrackerService: `is_required:
--                 item.priority !== 'optional'`). That boolean is the stored
--                 priority; read it back the same way it was written.
--                 ⚠️ 'critical' is lossy on the WRITE side and is not
--                 recoverable here — a separate gap, deliberately not papered
--                 over by inventing a value.
--   · isOverdue — computed from `due_date < current_date`. A stored boolean
--                 would need a nightly job to stay true anyway.
--
-- Verbatim copy of the 20260709000001 body with those two expressions changed
-- and the overdue count fixed to match. Everything else is unchanged.
-- =============================================================================

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
  IF p_access_code IS NULL
     OR length(p_access_code) < 4
     OR length(p_access_code) > 64
     OR p_access_code !~ '^[A-Za-z0-9_-]+$' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_tracker
  FROM public.decision_trackers
  WHERE access_code = p_access_code;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_tracker.status = 'expired'
     OR (v_tracker.expires_at IS NOT NULL AND v_tracker.expires_at < now()) THEN
    RETURN jsonb_build_object('expired', true);
  END IF;

  SELECT jsonb_build_object(
    'contractorName', COALESCE(bs.business_name, ''),
    'contractorCompany', bs.business_name,
    'contractorPhone', bs.phone,
    'contractorLogo', bs.logo_url,
    'contractorCountry', bs.country
  )
  INTO v_business
  FROM public.business_settings bs
  WHERE bs.user_id = v_tracker.user_id;

  WITH item_rows AS (
    SELECT
      di.tracker_id,
      di.category,
      jsonb_build_object(
        'id', di.id,
        'name', di.label,
        'description', COALESCE(di.help_text, ''),
        'inputType', di.input_type,
        'options', COALESCE(di.options, '[]'::jsonb),
        -- decision_items has no `priority` column and never has. The contractor
        -- write path (decisionTrackerService) already collapses priority into
        -- `is_required` (`is_required: item.priority !== 'optional'`), so that
        -- boolean IS the stored priority. Derive from it rather than invent a
        -- column: 'critical' was never persisted and cannot be recovered here.
        'priority', CASE WHEN COALESCE(di.is_required, true) THEN 'important' ELSE 'optional' END,
        'status', CASE WHEN di.id IN (
                    SELECT ds.item_id FROM public.decision_submissions ds
                    WHERE ds.tracker_id = di.tracker_id
                  ) THEN 'decided' ELSE 'pending' END,
        -- Likewise no `is_overdue` column. A stored flag would need a job to
        -- flip it anyway; due_date is real data and is right at read time.
        'isOverdue', (di.due_date IS NOT NULL AND di.due_date < current_date),
        'dueDate', COALESCE(di.due_date::text, ''),
        'value', (SELECT ds.value FROM public.decision_submissions ds
                  WHERE ds.tracker_id = di.tracker_id AND ds.item_id = di.id
                  ORDER BY ds.submitted_at DESC LIMIT 1),
        'notes', (SELECT ds.notes FROM public.decision_submissions ds
                  WHERE ds.tracker_id = di.tracker_id AND ds.item_id = di.id
                  ORDER BY ds.submitted_at DESC LIMIT 1),
        'decidedAt', (SELECT ds.submitted_at::text FROM public.decision_submissions ds
                      WHERE ds.tracker_id = di.tracker_id AND ds.item_id = di.id
                      ORDER BY ds.submitted_at DESC LIMIT 1)
      ) AS item_json
    FROM public.decision_items di
    WHERE di.tracker_id = v_tracker.id
  ),
  category_rows AS (
    SELECT
      category,
      jsonb_agg(item_json) AS items_json,
      count(*) AS total_items
    FROM item_rows
    GROUP BY category
  )
  SELECT
    jsonb_agg(jsonb_build_object(
      'id', category,
      'name', category,
      'phase', 'planning',
      'dueDate', '',
      'isOverdue', false,
      'items', items_json,
      'totalCount', total_items,
      'completedCount', (SELECT count(*) FROM public.decision_submissions ds
                          WHERE ds.tracker_id = v_tracker.id
                            AND ds.item_id IN (
                              SELECT di.id FROM public.decision_items di
                              WHERE di.tracker_id = v_tracker.id
                                AND di.category = category_rows.category
                            ))
    ))
  INTO v_categories
  FROM category_rows;

  SELECT count(*) INTO v_total
    FROM public.decision_items WHERE tracker_id = v_tracker.id;
  SELECT count(*) INTO v_completed
    FROM public.decision_submissions WHERE tracker_id = v_tracker.id;
  SELECT count(*) INTO v_overdue
    FROM public.decision_items
    WHERE tracker_id = v_tracker.id
      AND due_date IS NOT NULL
      AND due_date < current_date
      AND id NOT IN (
        SELECT item_id FROM public.decision_submissions WHERE tracker_id = v_tracker.id
      );

  RETURN jsonb_build_object(
    'accessToken', v_tracker.access_code,
    'trackerId', v_tracker.id,
    'projectName', COALESCE(v_tracker.project_name, ''),
    'business', COALESCE(v_business, '{}'::jsonb),
    'projectStartDate', COALESCE(v_tracker.project_start_date::text, now()::text),
    'currentPhase', 'planning',
    'categories', COALESCE(v_categories, '[]'::jsonb),
    'totalDecisions', v_total,
    'completedDecisions', v_completed,
    'overdueDecisions', v_overdue,
    'quoteAmount', v_tracker.quote_amount,
    'depositAmount', v_tracker.deposit_amount,
    'paymentLink', v_tracker.payment_link,
    'paymentStatus', v_tracker.payment_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_portal_by_access_code(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_portal_by_access_code(text) TO anon, authenticated, service_role;

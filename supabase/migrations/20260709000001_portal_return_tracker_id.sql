-- =============================================================================
-- Portal RPC returns the tracker UUID (fixes customer decision submissions)
-- =============================================================================
-- BUG: decision_submissions.tracker_id is a UUID FK to decision_trackers(id),
-- but the portal only ever received the tracker's access_code (32-hex text) via
-- get_portal_by_access_code — the UUID was never exposed. Both submit paths
-- (mobile decisionSyncService + admin web page) wrote tracker_id = access_code,
-- so EVERY real customer submission failed the FK/UUID cast, returned to the
-- client as a non-fatal "saved locally", and never reached the contractor.
-- flushUnsyncedSubmissions then retried the same doomed write on every load.
--
-- Fix: add 'trackerId' (the UUID) to the RPC payload. Clients key submissions on
-- it (falling back to accessToken when absent, so the client is safe to ship
-- before this migration is deployed). Function body is otherwise identical to
-- 20260530000001 — only the RETURN gains one line.
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
        'priority', COALESCE(di.priority, 'important'),
        'status', CASE WHEN di.id IN (
                    SELECT ds.item_id FROM public.decision_submissions ds
                    WHERE ds.tracker_id = di.tracker_id
                  ) THEN 'decided' ELSE 'pending' END,
        'isOverdue', COALESCE(di.is_overdue, false),
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
      AND is_overdue = true
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

REVOKE ALL ON FUNCTION public.get_portal_by_access_code(TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.get_portal_by_access_code(TEXT) TO anon, authenticated;

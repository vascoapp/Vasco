-- =============================================================================
-- PORTAL RPC: distinguish expired vs not-found — R66r58 (2026-05-11)
-- =============================================================================
-- Pre-r58 get_portal_by_access_code returned NULL for both:
--   (a) access_code doesn't exist
--   (b) access_code exists but expires_at < now()
-- The FE shows the same "Project not found" message either way, so a
-- customer with a stale link gets misleading copy + can't tell whether
-- to retype or ask for a new link.
--
-- Now: NULL still means (a); a JSON object `{"expired": true}` means (b).
-- FE branches on the discriminator.
--
-- Backwards-compatible with v1.0 callers that null-check the result —
-- (b) used to return null and now returns a truthy object, but the
-- shape doesn't carry the regular `accessToken`/`categories` keys, so
-- callers that try to read those just see undefined and fall through
-- to their existing error path. Updated FE in this round handles the
-- new shape explicitly.
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
  -- Format guard.
  IF p_access_code IS NULL
     OR length(p_access_code) < 4
     OR length(p_access_code) > 64
     OR p_access_code !~ '^[A-Za-z0-9_-]+$' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_tracker
  FROM public.decision_trackers
  WHERE access_code = p_access_code;

  -- Not found → NULL (FE shows generic "Project not found").
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Status-based expiry OR explicit expires_at past now()
  --   → return the {expired: true} discriminator instead of NULL so the
  --   FE can show a specific "link expired" message.
  IF v_tracker.status = 'expired'
     OR (v_tracker.expires_at IS NOT NULL AND v_tracker.expires_at < now()) THEN
    RETURN jsonb_build_object('expired', true);
  END IF;

  -- Contractor branding/info from business_settings (1:1 with user_id).
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

  -- Categories + items aggregated via the same logic as the original
  -- 20260507000009 RPC — keep this CTE in sync with that file.
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
    'projectName', COALESCE(v_tracker.project_name, ''),
    'business', COALESCE(v_business, '{}'::jsonb),
    'projectStartDate', COALESCE(v_tracker.project_start_date::text, now()::text),
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

-- Permissions unchanged from the original migration.
REVOKE ALL ON FUNCTION public.get_portal_by_access_code(TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.get_portal_by_access_code(TEXT) TO anon, authenticated;

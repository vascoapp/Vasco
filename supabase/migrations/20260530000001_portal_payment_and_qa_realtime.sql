-- =============================================================================
-- PORTAL: payment fields on the RPC + customer_questions realtime — R308 (2026-05-30)
-- =============================================================================
-- Two gaps the web + mobile customer portal hit:
--
--   1. The pay CTA reads portalData.paymentLink / paymentStatus, but
--      get_portal_by_access_code never returned them (and the columns didn't
--      exist). The button was dead on BOTH platforms. → add the columns +
--      surface them from the RPC. (Contractor side still needs to populate
--      payment_link when it mints a Mollie/Stripe checkout — separate step.)
--
--   2. The Q&A thread couldn't show the contractor's approved reply live —
--      customer_questions was not in the supabase_realtime publication, so the
--      portal had no way to learn when approved_reply lands. → add it to the
--      publication + REPLICA IDENTITY FULL so the realtime payload carries the
--      whole row (approved_reply / ai_reply_draft / auto_sent / status).
--
-- All additive. RPC body is the 20260511000004 (expired-signal) version + 2
-- payment keys — keep the CTE in sync with that file if it changes again.
-- =============================================================================

-- ── 1. payment columns on decision_trackers ─────────────────────────────────
ALTER TABLE public.decision_trackers
  ADD COLUMN IF NOT EXISTS payment_link   TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT;

-- Idempotent CHECK (drop+recreate per the project's enum-constraint rule).
ALTER TABLE public.decision_trackers DROP CONSTRAINT IF EXISTS decision_trackers_payment_status_check;
ALTER TABLE public.decision_trackers ADD CONSTRAINT decision_trackers_payment_status_check
  CHECK (payment_status IS NULL OR payment_status IN ('pending', 'paid', 'partial'));

-- ── 2. RPC: return paymentLink + paymentStatus ──────────────────────────────
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

-- ── 3. customer_questions realtime ──────────────────────────────────────────
-- Full row in the change payload so the portal can read approved_reply /
-- ai_reply_draft / auto_sent / status off an UPDATE without a follow-up fetch.
ALTER TABLE public.customer_questions REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'customer_questions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_questions;
  END IF;
END $$;

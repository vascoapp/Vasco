-- =============================================================================
-- MOAT ENRICHMENT — additive only, no renames, no drops, no type changes
-- =============================================================================
-- The pricing moat's value compounds when every quote outcome teaches us more
-- than "accepted: yes/no". This migration layers on:
--
-- 1. Outcome enrichment columns on pricing_intelligence:
--      - decline_reason (why the quote was lost)
--      - time_to_decision_hours (speed to accept/reject = price signal)
--      - reminder_count_before_decision (friction = mis-priced or wrong fit)
--      - counter_offer_amount (captures negotiation)
--      - contractor_segment (solo/small/medium/large) so the cohort can split
-- 2. New contractor_pricing_calibration table — per-user deltas vs cohort
--    (how much above/below median you price, how much better/worse you
--    convert). Enables personalized benchmarks.
-- 3. New RPC get_line_item_edit_distribution — surfaces the typical edit the
--    cohort applies to any AI-baseline line, from quote_line_deltas.
-- 4. New RPC compute_contractor_calibration + read RPC.
-- 5. Extra trigger branch on business_events to refresh calibration on
--    quote_accepted/quote_rejected for the emitting user.
--
-- SCHEMA STABILITY GUARANTEES:
--   - All ALTER TABLE statements are ADD COLUMN IF NOT EXISTS (re-runnable,
--     idempotent, never reshape existing columns).
--   - New table uses CREATE TABLE IF NOT EXISTS.
--   - New RPCs use CREATE OR REPLACE (no signature breakage).
--   - Zero renames, zero drops, zero type changes.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enrich pricing_intelligence — all additive, all nullable
-- ---------------------------------------------------------------------------

ALTER TABLE pricing_intelligence
  ADD COLUMN IF NOT EXISTS decline_reason TEXT;

ALTER TABLE pricing_intelligence
  ADD COLUMN IF NOT EXISTS time_to_decision_hours INT;

ALTER TABLE pricing_intelligence
  ADD COLUMN IF NOT EXISTS reminder_count_before_decision INT;

ALTER TABLE pricing_intelligence
  ADD COLUMN IF NOT EXISTS counter_offer_amount REAL;

-- contractor_segment: 'solo' | 'small_team' | 'medium' | 'large'.
-- Derived from businessProfile.teamSize; nullable so legacy rows are untouched.
ALTER TABLE pricing_intelligence
  ADD COLUMN IF NOT EXISTS contractor_segment TEXT;

-- Optional soft constraint for decline_reason via a CHECK (only enforced on
-- NEW rows because the column is nullable and existing rows stay NULL).
-- We deliberately avoid ALTER COLUMN ... SET NOT NULL to preserve backwards
-- compatibility with rows written before this migration.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'pricing_intelligence_decline_reason_chk'
  ) THEN
    ALTER TABLE pricing_intelligence
      ADD CONSTRAINT pricing_intelligence_decline_reason_chk
      CHECK (
        decline_reason IS NULL OR decline_reason IN (
          'price_too_high',
          'chose_competitor',
          'scope_changed',
          'no_response',
          'timing',
          'customer_declined',
          'other'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'pricing_intelligence_segment_chk'
  ) THEN
    ALTER TABLE pricing_intelligence
      ADD CONSTRAINT pricing_intelligence_segment_chk
      CHECK (
        contractor_segment IS NULL OR contractor_segment IN (
          'solo',
          'small_team',
          'medium',
          'large'
        )
      );
  END IF;
END $$;

-- Index the new filter columns we'll actually query on (segment + decline).
CREATE INDEX IF NOT EXISTS idx_pricing_segment
  ON pricing_intelligence (trade, country, contractor_segment)
  WHERE contractor_segment IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pricing_decline
  ON pricing_intelligence (trade, country, decline_reason)
  WHERE decline_reason IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Contractor calibration table — per-user deltas vs cohort
-- ---------------------------------------------------------------------------
-- One row per (user_id, trade, country). Recomputed by the
-- compute_contractor_calibration RPC, which is called by a trigger on
-- business_events for quote_accepted / quote_rejected events.

CREATE TABLE IF NOT EXISTS contractor_pricing_calibration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade TEXT NOT NULL,
  country TEXT NOT NULL,

  -- Your pricing vs cohort median (percent; +8 = you're 8% above cohort)
  median_price_vs_cohort_pct REAL,

  -- Your acceptance rate vs cohort (percent points; +3 = you convert 3 pp higher)
  acceptance_rate_vs_cohort_pct REAL,

  -- Your margin vs cohort (percent points)
  margin_vs_cohort_pct REAL,

  -- How many of YOUR rows went into this
  sample_size INT NOT NULL DEFAULT 0,
  -- How many cohort rows the comparison used (for confidence context)
  cohort_sample_size INT NOT NULL DEFAULT 0,
  -- 0.0-1.0 — own sample size + cohort size + recency factor
  confidence REAL NOT NULL DEFAULT 0.0,

  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, trade, country)
);

CREATE INDEX IF NOT EXISTS idx_calibration_user
  ON contractor_pricing_calibration (user_id);

ALTER TABLE contractor_pricing_calibration ENABLE ROW LEVEL SECURITY;

-- Owner-only read. Writes are SECURITY DEFINER via the RPC.
DROP POLICY IF EXISTS "Users read own calibration" ON contractor_pricing_calibration;
CREATE POLICY "Users read own calibration"
  ON contractor_pricing_calibration FOR SELECT
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3. compute_contractor_calibration RPC
-- ---------------------------------------------------------------------------
-- Recomputes the calibration row for (user_id, trade, country) from
-- pricing_intelligence. Uses the same k-anonymity gate as the cohort RPCs:
-- if the cohort doesn't have >=5 distinct contractors in the slice, the
-- comparison is meaningless and we return without writing (so the client
-- falls back to cohort medians).

CREATE OR REPLACE FUNCTION compute_contractor_calibration(
  p_user_id UUID,
  p_trade TEXT,
  p_country TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_own_median REAL;
  v_own_acceptance REAL;
  v_own_margin REAL;
  v_own_samples INT;

  v_cohort_median REAL;
  v_cohort_acceptance REAL;
  v_cohort_margin REAL;
  v_cohort_samples INT;
  v_cohort_contractors INT;

  v_price_delta_pct REAL;
  v_accept_delta_pp REAL;
  v_margin_delta_pp REAL;
  v_confidence REAL;
BEGIN
  -- Own stats (last 12 months so calibration reflects current pricing behavior)
  SELECT
    percentile_cont(0.5) WITHIN GROUP (ORDER BY quoted_unit_price)::REAL,
    (COUNT(*) FILTER (WHERE was_accepted = true))::REAL
      / NULLIF(COUNT(*)::REAL, 0),
    AVG(margin_percent)::REAL,
    COUNT(*)::INT
  INTO v_own_median, v_own_acceptance, v_own_margin, v_own_samples
  FROM pricing_intelligence
  WHERE user_id = p_user_id
    AND trade = p_trade
    AND country = p_country
    AND quoted_at > now() - INTERVAL '12 months';

  -- Cohort stats excluding this user (avoids self-bias)
  SELECT
    percentile_cont(0.5) WITHIN GROUP (ORDER BY quoted_unit_price)::REAL,
    (COUNT(*) FILTER (WHERE was_accepted = true))::REAL
      / NULLIF(COUNT(*)::REAL, 0),
    AVG(margin_percent)::REAL,
    COUNT(*)::INT,
    COUNT(DISTINCT user_id)::INT
  INTO
    v_cohort_median, v_cohort_acceptance, v_cohort_margin,
    v_cohort_samples, v_cohort_contractors
  FROM pricing_intelligence
  WHERE user_id <> p_user_id
    AND trade = p_trade
    AND country = p_country
    AND quoted_at > now() - INTERVAL '12 months';

  -- k-anonymity gate on cohort side
  IF COALESCE(v_cohort_contractors, 0) < 5 THEN
    RETURN;
  END IF;

  -- Need at least 5 own data points before we claim any personalization signal
  IF COALESCE(v_own_samples, 0) < 5 THEN
    RETURN;
  END IF;

  v_price_delta_pct := CASE
    WHEN v_cohort_median IS NULL OR v_cohort_median = 0 THEN NULL
    ELSE ((v_own_median - v_cohort_median) / v_cohort_median) * 100.0
  END;

  v_accept_delta_pp := CASE
    WHEN v_cohort_acceptance IS NULL THEN NULL
    ELSE (COALESCE(v_own_acceptance, 0) - v_cohort_acceptance) * 100.0
  END;

  v_margin_delta_pp := CASE
    WHEN v_cohort_margin IS NULL THEN NULL
    ELSE COALESCE(v_own_margin, 0) - v_cohort_margin
  END;

  -- Confidence combines own sample size + cohort depth (both tail off near 30).
  v_confidence := LEAST(
    1.0,
    (LEAST(v_own_samples, 30)::REAL / 30.0) * 0.6 +
    (LEAST(v_cohort_contractors, 30)::REAL / 30.0) * 0.4
  );

  INSERT INTO contractor_pricing_calibration (
    user_id, trade, country,
    median_price_vs_cohort_pct,
    acceptance_rate_vs_cohort_pct,
    margin_vs_cohort_pct,
    sample_size, cohort_sample_size, confidence,
    computed_at
  ) VALUES (
    p_user_id, p_trade, p_country,
    v_price_delta_pct,
    v_accept_delta_pp,
    v_margin_delta_pp,
    v_own_samples, v_cohort_samples, v_confidence,
    now()
  )
  ON CONFLICT (user_id, trade, country) DO UPDATE SET
    median_price_vs_cohort_pct    = EXCLUDED.median_price_vs_cohort_pct,
    acceptance_rate_vs_cohort_pct = EXCLUDED.acceptance_rate_vs_cohort_pct,
    margin_vs_cohort_pct          = EXCLUDED.margin_vs_cohort_pct,
    sample_size                   = EXCLUDED.sample_size,
    cohort_sample_size            = EXCLUDED.cohort_sample_size,
    confidence                    = EXCLUDED.confidence,
    computed_at                   = now();
END;
$$;

-- Thin reader RPC so the client never touches the base table directly.
CREATE OR REPLACE FUNCTION get_contractor_calibration(
  p_user_id UUID,
  p_trade TEXT,
  p_country TEXT
)
RETURNS TABLE (
  median_price_vs_cohort_pct REAL,
  acceptance_rate_vs_cohort_pct REAL,
  margin_vs_cohort_pct REAL,
  sample_size INT,
  cohort_sample_size INT,
  confidence REAL,
  computed_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.median_price_vs_cohort_pct,
    c.acceptance_rate_vs_cohort_pct,
    c.margin_vs_cohort_pct,
    c.sample_size,
    c.cohort_sample_size,
    c.confidence,
    c.computed_at
  FROM contractor_pricing_calibration c
  WHERE c.user_id = p_user_id
    AND c.trade = p_trade
    AND c.country = p_country
  LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- 4. get_line_item_edit_distribution RPC — from quote_line_deltas
-- ---------------------------------------------------------------------------
-- Answers "for a given AI-baseline line on a given trade/country, how does the
-- cohort typically adjust it?" K-anonymity >=5 distinct users required.
-- The client passes an ILIKE pattern (e.g. "copper pipe") to fuzzy-match
-- against the stored `description`.

CREATE OR REPLACE FUNCTION get_line_item_edit_distribution(
  p_trade TEXT,
  p_country TEXT,
  p_description_like TEXT
)
RETURNS TABLE (
  sample_size BIGINT,
  contractor_count BIGINT,
  median_qty_delta_pct REAL,
  median_unit_price_delta_pct REAL,
  top_reason_code TEXT,
  top_reason_share REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contractors BIGINT;
BEGIN
  SELECT COUNT(DISTINCT user_id) INTO v_contractors
  FROM quote_line_deltas
  WHERE (p_trade IS NULL OR trade = p_trade)
    AND (p_country IS NULL OR country = p_country)
    AND (p_description_like IS NULL OR description ILIKE '%' || p_description_like || '%')
    AND created_at > now() - INTERVAL '6 months';

  IF COALESCE(v_contractors, 0) < 5 THEN
    RETURN QUERY SELECT 0::BIGINT, COALESCE(v_contractors, 0),
      NULL::REAL, NULL::REAL, NULL::TEXT, NULL::REAL;
    RETURN;
  END IF;

  RETURN QUERY
  WITH deltas AS (
    SELECT
      qld.user_id,
      qld.reason_code,
      CASE
        WHEN qld.original_qty IS NULL OR qld.original_qty = 0 THEN NULL
        ELSE ((qld.new_qty - qld.original_qty) / qld.original_qty * 100.0)::REAL
      END AS qty_delta_pct,
      CASE
        WHEN qld.original_unit_price IS NULL OR qld.original_unit_price = 0 THEN NULL
        ELSE ((qld.new_unit_price - qld.original_unit_price) / qld.original_unit_price * 100.0)::REAL
      END AS price_delta_pct
    FROM quote_line_deltas qld
    WHERE (p_trade IS NULL OR qld.trade = p_trade)
      AND (p_country IS NULL OR qld.country = p_country)
      AND (p_description_like IS NULL OR qld.description ILIKE '%' || p_description_like || '%')
      AND qld.created_at > now() - INTERVAL '6 months'
  ),
  top_reason AS (
    SELECT reason_code,
           COUNT(*)::REAL / NULLIF((SELECT COUNT(*)::REAL FROM deltas), 0) AS share
    FROM deltas
    WHERE reason_code IS NOT NULL
    GROUP BY reason_code
    ORDER BY COUNT(*) DESC
    LIMIT 1
  )
  SELECT
    (SELECT COUNT(*) FROM deltas),
    v_contractors,
    (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY qty_delta_pct)::REAL FROM deltas WHERE qty_delta_pct IS NOT NULL),
    (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY price_delta_pct)::REAL FROM deltas WHERE price_delta_pct IS NOT NULL),
    (SELECT reason_code FROM top_reason),
    (SELECT share FROM top_reason);
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Trigger branch: refresh calibration on quote_accepted / quote_rejected
-- ---------------------------------------------------------------------------
-- We already have trg_quote_accepted_cohort (from 20260421_cohort_moat_fix)
-- refreshing the weekly cohort aggregate. Here we ADD a second trigger that
-- targets per-contractor calibration for the same two event types, without
-- touching the existing trigger.

CREATE OR REPLACE FUNCTION on_quote_outcome_refresh_calibration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trade TEXT;
  v_country TEXT;
BEGIN
  IF NEW.event_type NOT IN ('quote_accepted', 'quote_rejected') THEN
    RETURN NEW;
  END IF;

  -- Best-effort lookup of (trade, country) for the emitting user from the
  -- quote's pricing_intelligence row; fall back to the event's trade column
  -- and NL so we always have a shot at computing something useful.
  SELECT pi.trade, pi.country
  INTO v_trade, v_country
  FROM pricing_intelligence pi
  WHERE pi.user_id = NEW.user_id
    AND pi.quote_id = NEW.entity_id
  ORDER BY pi.quoted_at DESC
  LIMIT 1;

  v_trade   := COALESCE(v_trade, NEW.trade);
  v_country := COALESCE(v_country, NEW.country, 'NL');

  IF v_trade IS NULL THEN
    RETURN NEW; -- nothing to compute against
  END IF;

  BEGIN
    PERFORM compute_contractor_calibration(NEW.user_id, v_trade, v_country);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'compute_contractor_calibration failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quote_outcome_calibration ON business_events;
CREATE TRIGGER trg_quote_outcome_calibration
AFTER INSERT ON business_events
FOR EACH ROW
EXECUTE FUNCTION on_quote_outcome_refresh_calibration();

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION compute_contractor_calibration(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_contractor_calibration(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_line_item_edit_distribution(TEXT, TEXT, TEXT) TO authenticated;

-- =============================================================================
-- R191 — QUOTE WIN MODEL: cohort-trained logistic regression
-- =============================================================================
-- Replaces/augments the heuristic `predictQuoteWin` with a real model trained
-- on accumulated quote outcomes. Two RPCs:
--   1. get_quote_win_training_data — aggregates per-quote features+label from
--      pricing_intelligence. K-anonymity gated (>=5 contractors, >=20 quotes).
--      Returns NO user_id / quote_id — only numeric features + label.
--   2. save_quote_win_model — SECURITY DEFINER writer for ai_models (the
--      existing table has no user-write policy, so client-side training needs
--      a function to persist weights). Also flips prior versions to inactive.
--
-- SCHEMA STABILITY: no table changes. Both RPCs are CREATE OR REPLACE.
--   ai_models table was already introduced in 002_ai_moat_infrastructure.sql
--   with (model_name, model_version, trade, country) as the uniqueness key.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. get_quote_win_training_data
-- ---------------------------------------------------------------------------
-- Per-quote aggregation from pricing_intelligence (line-level). Returned
-- columns are the features the TS-side logistic regression consumes. Null
-- values in categorical columns pass through — the client treats them as
-- "unknown" one-hot=0. K-anonymity gate returns an empty set (client falls
-- back to heuristic), preserving privacy without a special error path.

CREATE OR REPLACE FUNCTION get_quote_win_training_data(
  p_trade TEXT,
  p_country TEXT,
  p_months INT DEFAULT 12
)
RETURNS TABLE (
  total_amount REAL,
  customer_type TEXT,
  month_num INT,
  contractor_segment TEXT,
  line_count INT,
  was_accepted BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contractor_count INT := 0;
  v_quote_count INT := 0;
BEGIN
  -- K-anonymity: count distinct contractors and quotes in the window.
  SELECT
    COUNT(DISTINCT user_id),
    COUNT(DISTINCT quote_id)
  INTO v_contractor_count, v_quote_count
  FROM pricing_intelligence
  WHERE trade = p_trade
    AND country = p_country
    AND was_accepted IS NOT NULL
    AND quoted_at > now() - (p_months || ' months')::INTERVAL
    AND quote_id IS NOT NULL;

  IF v_contractor_count < 5 OR v_quote_count < 20 THEN
    RETURN; -- empty set
  END IF;

  RETURN QUERY
  SELECT
    SUM(pi.quoted_total)::REAL                             AS total_amount,
    MIN(pi.customer_type)                                  AS customer_type,
    EXTRACT(MONTH FROM MIN(pi.quoted_at))::INT             AS month_num,
    MIN(pi.contractor_segment)                             AS contractor_segment,
    COUNT(*)::INT                                          AS line_count,
    BOOL_OR(pi.was_accepted)                               AS was_accepted
  FROM pricing_intelligence pi
  WHERE pi.trade = p_trade
    AND pi.country = p_country
    AND pi.was_accepted IS NOT NULL
    AND pi.quoted_at > now() - (p_months || ' months')::INTERVAL
    AND pi.quote_id IS NOT NULL
  GROUP BY pi.quote_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. save_quote_win_model — secure writer for ai_models
-- ---------------------------------------------------------------------------
-- Client-side trainer calls this with fitted coefficients + training metrics.
-- We pick the next version number for (quote_win, trade, country), insert the
-- new row as is_active=true, and flip all prior versions for the same key
-- to is_active=false + retired_at=now(). Single-transaction via SECURITY
-- DEFINER bypasses the read-only RLS on ai_models.

CREATE OR REPLACE FUNCTION save_quote_win_model(
  p_trade TEXT,
  p_country TEXT,
  p_weights JSONB,
  p_training_samples INT,
  p_accuracy REAL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_version INT;
  v_feature_columns TEXT[];
  v_id UUID;
BEGIN
  SELECT COALESCE(MAX(model_version), 0) + 1
  INTO v_next_version
  FROM ai_models
  WHERE model_name = 'quote_win'
    AND trade = p_trade
    AND country = p_country;

  -- Extract feature names from the weights object so downstream readers can
  -- verify they loaded a model compatible with their scoring code.
  v_feature_columns := ARRAY(
    SELECT jsonb_object_keys(COALESCE(p_weights->'weights', '{}'::jsonb))
  );

  -- Deactivate prior versions.
  UPDATE ai_models
  SET
    is_active = false,
    retired_at = COALESCE(retired_at, now())
  WHERE model_name = 'quote_win'
    AND trade = p_trade
    AND country = p_country
    AND is_active = true;

  INSERT INTO ai_models (
    model_name, model_version, trade, country,
    algorithm, feature_columns, target_column,
    training_samples, accuracy,
    model_weights,
    is_active, trained_at, activated_at
  ) VALUES (
    'quote_win', v_next_version, p_trade, p_country,
    'logistic_regression', v_feature_columns, 'was_accepted',
    p_training_samples, p_accuracy,
    p_weights,
    true, now(), now()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. get_quote_win_model — owner-agnostic reader so clients don't rely on
--    RLS-allowed SELECTs on ai_models to resolve "latest active model"
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_quote_win_model(
  p_trade TEXT,
  p_country TEXT
)
RETURNS TABLE (
  id UUID,
  model_version INT,
  algorithm TEXT,
  feature_columns TEXT[],
  training_samples INT,
  accuracy REAL,
  model_weights JSONB,
  activated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id, m.model_version, m.algorithm, m.feature_columns,
    m.training_samples, m.accuracy, m.model_weights, m.activated_at
  FROM ai_models m
  WHERE m.model_name = 'quote_win'
    AND m.trade = p_trade
    AND m.country = p_country
    AND m.is_active = true
  ORDER BY m.activated_at DESC NULLS LAST
  LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION get_quote_win_training_data(TEXT, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION save_quote_win_model(TEXT, TEXT, JSONB, INT, REAL) TO authenticated;
GRANT EXECUTE ON FUNCTION get_quote_win_model(TEXT, TEXT) TO authenticated;

-- =============================================================================
-- VASCO AI DATA MOAT INFRASTRUCTURE
-- =============================================================================
-- The moat = trade-specific operational data that compounds with every job.
-- Every quote, invoice, payment, material purchase = training data.
-- A generalist can never replicate this depth.
--
-- Architecture:
-- 1. Trade-specific pricing intelligence (quotes → actuals)
-- 2. Job duration prediction (estimated vs actual per trade+type)
-- 3. Customer payment behavior (DSO per customer segment)
-- 4. Material price tracking (supplier × material × time)
-- 5. Cross-contractor benchmarks (anonymized cohort)
-- 6. Vector embeddings for similar job matching (pgvector)
-- 7. AI model registry + versioning
-- =============================================================================

-- Enable pgvector for embedding similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- ==========================================================================
-- 1. PRICING INTELLIGENCE — the core moat
-- ==========================================================================

-- Every quote line item: what was quoted, what was accepted, what was the actual
CREATE TABLE IF NOT EXISTS pricing_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'NL',
  job_type TEXT, -- 'bathroom_renovation', 'rewire', 'exterior_paint', etc.

  -- Quote data
  quote_id TEXT,
  line_description TEXT NOT NULL,
  quoted_unit_price REAL NOT NULL,
  quoted_quantity REAL NOT NULL,
  quoted_total REAL NOT NULL,
  vat_rate REAL DEFAULT 21.0,

  -- Outcome data (filled when job completes)
  was_accepted BOOLEAN,
  accepted_price REAL, -- customer might negotiate
  actual_cost REAL, -- what it actually cost (materials + labor)
  actual_hours REAL,
  margin_percent REAL,

  -- Context
  customer_type TEXT, -- 'residential', 'commercial', 'government'
  region TEXT, -- postcode prefix (e.g., '10' for Amsterdam)
  season TEXT, -- 'spring', 'summer', 'autumn', 'winter'

  -- Timestamps
  quoted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pricing_trade ON pricing_intelligence(trade, job_type, country);
CREATE INDEX idx_pricing_user ON pricing_intelligence(user_id, quoted_at DESC);
CREATE INDEX idx_pricing_region ON pricing_intelligence(region, trade, job_type);

-- ==========================================================================
-- 2. JOB DURATION MODELS — predict how long jobs take
-- ==========================================================================

CREATE TABLE IF NOT EXISTS job_duration_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'NL',
  job_type TEXT NOT NULL,

  -- Estimates
  estimated_hours REAL NOT NULL,
  estimated_days INT,

  -- Actuals
  actual_hours REAL,
  actual_days INT,
  duration_ratio REAL, -- actual / estimated

  -- Factors that affect duration
  property_type TEXT, -- 'apartment', 'house', 'commercial', 'new_build'
  property_age_years INT,
  job_complexity TEXT CHECK (job_complexity IN ('simple', 'moderate', 'complex')),
  weather_impact BOOLEAN DEFAULT false,
  material_delays BOOLEAN DEFAULT false,
  scope_changes INT DEFAULT 0,

  -- Crew
  crew_size INT DEFAULT 1,
  used_subcontractor BOOLEAN DEFAULT false,

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_duration_trade ON job_duration_data(trade, job_type, country);
CREATE INDEX idx_duration_user ON job_duration_data(user_id, created_at DESC);

-- ==========================================================================
-- 3. CUSTOMER PAYMENT PATTERNS — predict when they'll pay
-- ==========================================================================

CREATE TABLE IF NOT EXISTS customer_payment_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL,

  -- Customer profile
  customer_type TEXT, -- 'residential', 'commercial', 'government', 'housing_corp'
  customer_region TEXT,
  relationship_months INT, -- how long they've been a customer

  -- Invoice data
  invoice_id TEXT NOT NULL,
  invoice_amount REAL NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  payment_date DATE,

  -- Derived
  days_to_payment INT,
  was_overdue BOOLEAN,
  reminders_sent INT DEFAULT 0,
  payment_method TEXT, -- 'ideal', 'bank_transfer', 'cash', 'mollie'

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_customer ON customer_payment_patterns(user_id, customer_id);
CREATE INDEX idx_payment_type ON customer_payment_patterns(customer_type, customer_region);

-- ==========================================================================
-- 4. MATERIAL PRICE HISTORY — track prices over time
-- ==========================================================================

-- Enriched price observations with category + trade context
CREATE TABLE IF NOT EXISTS material_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'NL',

  -- Material
  material_name TEXT NOT NULL,
  material_category TEXT, -- 'pipe_fitting', 'cable', 'paint', 'wood', 'fixture'
  brand TEXT,
  ean_code TEXT,
  unit TEXT NOT NULL, -- 'stuk', 'meter', 'liter', 'm2', 'kg'

  -- Supplier
  supplier_id TEXT NOT NULL,
  supplier_name TEXT NOT NULL,

  -- Price
  price_excl_vat REAL NOT NULL,
  currency TEXT DEFAULT 'EUR',
  vat_rate REAL DEFAULT 21.0,

  -- Availability
  in_stock BOOLEAN,
  lead_time_days INT,
  minimum_order_qty REAL,

  -- Context
  is_promotion BOOLEAN DEFAULT false,
  observed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source TEXT, -- 'manual', 'api', 'invoice_scan', 'catalog'

  observed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_material_lookup ON material_price_history(material_name, supplier_id, observed_at DESC);
CREATE INDEX idx_material_category ON material_price_history(trade, material_category, country);
CREATE INDEX idx_material_ean ON material_price_history(ean_code) WHERE ean_code IS NOT NULL;

-- ==========================================================================
-- 5. VECTOR EMBEDDINGS — similar job matching
-- ==========================================================================

-- Store embeddings for job descriptions to find similar past jobs
CREATE TABLE IF NOT EXISTS job_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  trade TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'NL',

  -- Job reference
  job_id TEXT,
  job_description TEXT NOT NULL,
  job_type TEXT,

  -- Embedding (1536 dimensions for OpenAI ada-002, or smaller for local models)
  embedding vector(384), -- using smaller model for efficiency

  -- Outcome data (what happened on this job)
  actual_cost REAL,
  actual_hours REAL,
  margin_percent REAL,
  customer_satisfaction INT, -- 1-5

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- HNSW index for fast similarity search
CREATE INDEX idx_job_embeddings ON job_embeddings USING hnsw (embedding vector_cosine_ops);

-- ==========================================================================
-- 6. AI MODEL REGISTRY — track model versions + performance
-- ==========================================================================

CREATE TABLE IF NOT EXISTS ai_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name TEXT NOT NULL, -- 'pricing_predictor', 'duration_estimator', 'payment_predictor'
  model_version INT NOT NULL,
  trade TEXT, -- NULL = trade-agnostic
  country TEXT,

  -- Model metadata
  algorithm TEXT NOT NULL, -- 'logistic_regression', 'gradient_boosting', 'neural_net', 'rule_based'
  feature_columns TEXT[] NOT NULL,
  target_column TEXT NOT NULL,

  -- Performance metrics
  training_samples INT,
  accuracy REAL,
  mae REAL, -- mean absolute error
  rmse REAL, -- root mean square error
  r_squared REAL,

  -- Model storage
  model_weights JSONB, -- for simple models (logistic regression coefficients)
  model_blob_path TEXT, -- for complex models (GCS/S3 path)

  -- Lifecycle
  is_active BOOLEAN DEFAULT false,
  trained_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,

  UNIQUE(model_name, model_version, trade, country)
);

-- ==========================================================================
-- 7. PREDICTION LOG — every prediction the AI makes
-- ==========================================================================

CREATE TABLE IF NOT EXISTS ai_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_id UUID REFERENCES ai_models(id),

  -- What was predicted
  prediction_type TEXT NOT NULL, -- 'quote_price', 'job_duration', 'payment_date', 'material_cost'
  predicted_value REAL NOT NULL,
  confidence REAL, -- 0-1

  -- Features used
  input_features JSONB NOT NULL,

  -- Outcome (filled when resolved)
  actual_value REAL,
  error REAL, -- predicted - actual
  error_percent REAL,
  resolved_at TIMESTAMPTZ,

  -- Context
  trade TEXT,
  job_id TEXT,
  invoice_id TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_predictions_user ON ai_predictions(user_id, prediction_type, created_at DESC);
CREATE INDEX idx_predictions_model ON ai_predictions(model_id, resolved_at);

-- ==========================================================================
-- 8. COHORT INTELLIGENCE — anonymized cross-contractor learning
-- ==========================================================================

-- Weekly aggregates per trade × country × metric
CREATE TABLE IF NOT EXISTS cohort_weekly_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade TEXT NOT NULL,
  country TEXT NOT NULL,
  week_key TEXT NOT NULL, -- '2026-W12'

  -- Pricing
  avg_hourly_rate REAL,
  median_hourly_rate REAL,
  avg_quote_acceptance_rate REAL,
  avg_margin_percent REAL,

  -- Operations
  avg_job_duration_ratio REAL, -- actual/estimated
  avg_jobs_per_week REAL,
  avg_dso REAL,

  -- Materials
  avg_material_cost_ratio REAL, -- material cost as % of total

  -- Sample
  contractor_count INT NOT NULL,
  data_points INT NOT NULL,

  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(trade, country, week_key)
);

-- ==========================================================================
-- 9. CONTRACTOR SKILL PROFILE — inferred from data
-- ==========================================================================

CREATE TABLE IF NOT EXISTS contractor_skill_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade TEXT NOT NULL,

  -- Inferred strengths (0-100 scores)
  pricing_accuracy INT DEFAULT 50,
  duration_accuracy INT DEFAULT 50,
  customer_retention INT DEFAULT 50,
  payment_collection INT DEFAULT 50,
  material_efficiency INT DEFAULT 50,
  quote_win_rate INT DEFAULT 50,

  -- Derived tier
  overall_score INT DEFAULT 50,
  tier TEXT DEFAULT 'developing' CHECK (tier IN ('developing', 'competent', 'proficient', 'expert')),

  -- Trend
  score_trend TEXT DEFAULT 'stable' CHECK (score_trend IN ('improving', 'stable', 'declining')),

  -- Data quality
  data_points INT DEFAULT 0,
  confidence REAL DEFAULT 0.0,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, trade)
);

-- ==========================================================================
-- 10. EVENT STREAM — every business event for ML pipeline
-- ==========================================================================

-- Append-only event log for training data extraction
CREATE TABLE IF NOT EXISTS business_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  event_type TEXT NOT NULL, -- 'quote_created', 'quote_sent', 'job_started', 'invoice_paid', etc.
  entity_type TEXT NOT NULL, -- 'quote', 'job', 'invoice', 'customer', 'material'
  entity_id TEXT NOT NULL,

  -- Event data
  payload JSONB NOT NULL DEFAULT '{}',

  -- Context
  trade TEXT,
  country TEXT,
  session_id TEXT,
  screen_context TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_user_type ON business_events(user_id, event_type, created_at DESC);
CREATE INDEX idx_events_entity ON business_events(entity_type, entity_id);

-- Partitioning hint for future scale (events table will grow fast)
-- ALTER TABLE business_events SET (autovacuum_vacuum_scale_factor = 0.01);

-- ==========================================================================
-- ROW LEVEL SECURITY
-- ==========================================================================

ALTER TABLE pricing_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_duration_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_payment_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohort_weekly_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_skill_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_events ENABLE ROW LEVEL SECURITY;

-- Users own their data
CREATE POLICY "Users own data" ON pricing_intelligence FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON job_duration_data FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON customer_payment_patterns FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON ai_predictions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON contractor_skill_profiles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON business_events FOR ALL USING (auth.uid() = user_id);

-- Material prices: users see own + contribute to shared pool
CREATE POLICY "Users contribute prices" ON material_price_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Users read all prices" ON material_price_history FOR SELECT USING (true);

-- Job embeddings: users see own + anonymized pool for similar job search
CREATE POLICY "Users own embeddings" ON job_embeddings FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

-- Cohort stats: readable by all authenticated (anonymized)
CREATE POLICY "Authenticated read" ON cohort_weekly_stats FOR SELECT USING (auth.role() = 'authenticated');

-- AI models: readable by all (shared model registry)
CREATE POLICY "Authenticated read" ON ai_models FOR SELECT USING (auth.role() = 'authenticated');

-- ==========================================================================
-- RPC FUNCTIONS — server-side computation
-- ==========================================================================

-- Get similar jobs based on embedding similarity
CREATE OR REPLACE FUNCTION match_similar_jobs(
  query_embedding vector(384),
  match_trade TEXT,
  match_country TEXT DEFAULT 'NL',
  match_threshold REAL DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  job_id TEXT,
  job_description TEXT,
  job_type TEXT,
  actual_cost REAL,
  actual_hours REAL,
  margin_percent REAL,
  similarity REAL
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    je.job_id,
    je.job_description,
    je.job_type,
    je.actual_cost,
    je.actual_hours,
    je.margin_percent,
    1 - (je.embedding <=> query_embedding) AS similarity
  FROM job_embeddings je
  WHERE je.trade = match_trade
    AND je.country = match_country
    AND je.actual_cost IS NOT NULL
    AND 1 - (je.embedding <=> query_embedding) > match_threshold
  ORDER BY je.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Compute trade pricing stats for a region
CREATE OR REPLACE FUNCTION get_trade_pricing_stats(
  p_trade TEXT,
  p_country TEXT,
  p_job_type TEXT DEFAULT NULL,
  p_months INT DEFAULT 6
)
RETURNS TABLE (
  avg_hourly_rate REAL,
  median_hourly_rate REAL,
  p25_hourly_rate REAL,
  p75_hourly_rate REAL,
  avg_margin REAL,
  acceptance_rate REAL,
  sample_size BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    AVG(pi.quoted_unit_price)::REAL,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY pi.quoted_unit_price)::REAL,
    percentile_cont(0.25) WITHIN GROUP (ORDER BY pi.quoted_unit_price)::REAL,
    percentile_cont(0.75) WITHIN GROUP (ORDER BY pi.quoted_unit_price)::REAL,
    AVG(pi.margin_percent)::REAL,
    (COUNT(*) FILTER (WHERE pi.was_accepted = true))::REAL / NULLIF(COUNT(*)::REAL, 0),
    COUNT(*)
  FROM pricing_intelligence pi
  WHERE pi.trade = p_trade
    AND pi.country = p_country
    AND (p_job_type IS NULL OR pi.job_type = p_job_type)
    AND pi.quoted_at > now() - (p_months || ' months')::INTERVAL;
END;
$$;

-- Predict DSO for a customer based on historical patterns
CREATE OR REPLACE FUNCTION predict_customer_dso(
  p_user_id UUID,
  p_customer_id TEXT
)
RETURNS TABLE (
  predicted_dso INT,
  confidence REAL,
  historical_avg REAL,
  payment_count BIGINT,
  on_time_rate REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(AVG(cpp.days_to_payment)::INT, 14),
    CASE
      WHEN COUNT(*) >= 10 THEN 0.9
      WHEN COUNT(*) >= 5 THEN 0.7
      WHEN COUNT(*) >= 2 THEN 0.5
      ELSE 0.3
    END::REAL,
    AVG(cpp.days_to_payment)::REAL,
    COUNT(*),
    (COUNT(*) FILTER (WHERE NOT cpp.was_overdue))::REAL / NULLIF(COUNT(*)::REAL, 0)
  FROM customer_payment_patterns cpp
  WHERE cpp.user_id = p_user_id
    AND cpp.customer_id = p_customer_id
    AND cpp.payment_date IS NOT NULL;
END;
$$;

-- Weekly cohort computation (run via cron/scheduled function)
CREATE OR REPLACE FUNCTION compute_weekly_cohort_stats(p_week_key TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO cohort_weekly_stats (
    trade, country, week_key,
    avg_hourly_rate, median_hourly_rate,
    avg_quote_acceptance_rate, avg_margin_percent,
    avg_job_duration_ratio, avg_jobs_per_week, avg_dso,
    avg_material_cost_ratio,
    contractor_count, data_points
  )
  SELECT
    lp.trade,
    lp.country,
    p_week_key,
    AVG((lp.profile_data->'invoicePatterns'->>'avgDSO')::REAL),
    percentile_cont(0.5) WITHIN GROUP (ORDER BY (lp.profile_data->'invoicePatterns'->>'avgDSO')::REAL),
    NULL, NULL, NULL, NULL,
    AVG((lp.profile_data->'invoicePatterns'->>'avgDSO')::REAL),
    NULL,
    COUNT(DISTINCT lp.user_id)::INT,
    COUNT(*)::INT
  FROM learning_profiles lp
  WHERE lp.trade IS NOT NULL AND lp.country IS NOT NULL
  GROUP BY lp.trade, lp.country
  ON CONFLICT (trade, country, week_key) DO UPDATE SET
    avg_hourly_rate = EXCLUDED.avg_hourly_rate,
    contractor_count = EXCLUDED.contractor_count,
    data_points = EXCLUDED.data_points,
    computed_at = now();
END;
$$;

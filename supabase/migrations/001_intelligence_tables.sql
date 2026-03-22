-- =============================================================================
-- VASCO INTELLIGENCE TABLES — Supabase migration
-- =============================================================================
-- Core tables for AI learning loop persistence
-- Designed for long-term, cross-user intelligence aggregation
-- =============================================================================

-- Learning profiles (per contractor, per role)
CREATE TABLE IF NOT EXISTS learning_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('contractor', 'sitelead', 'coo', 'cfo', 'director')),
  trade TEXT,
  country TEXT CHECK (country IN ('NL', 'UK', 'DE')),
  profile_data JSONB NOT NULL DEFAULT '{}',
  schema_version INT NOT NULL DEFAULT 2,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Insight interactions (what users see, click, dismiss, act on)
CREATE TABLE IF NOT EXISTS insight_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insight_id TEXT NOT NULL,
  generator_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('viewed', 'expanded', 'dismissed', 'snoozed', 'acted', 'ignored')),
  screen_context TEXT,
  category TEXT,
  dwell_time_ms INT,
  outcome TEXT CHECK (outcome IN ('positive', 'negative', 'neutral')),
  snooze_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_interactions_user ON insight_interactions(user_id, created_at DESC);
CREATE INDEX idx_interactions_generator ON insight_interactions(generator_id, action);

-- Calibration entries (predictions vs actuals)
CREATE TABLE IF NOT EXISTS calibration_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  generator_id TEXT NOT NULL,
  predicted_value TEXT NOT NULL,
  actual_value TEXT,
  is_accurate BOOLEAN,
  tolerance_pct REAL,
  resolved_at TIMESTAMPTZ,
  context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_calibration_user ON calibration_entries(user_id, generator_id);
CREATE INDEX idx_calibration_unresolved ON calibration_entries(user_id) WHERE resolved_at IS NULL;

-- Job outcomes (actual vs estimated for learning)
CREATE TABLE IF NOT EXISTS job_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL,
  job_type TEXT,
  trade TEXT,
  estimated_hours REAL,
  actual_hours REAL,
  estimated_cost REAL,
  actual_cost REAL,
  margin_percent REAL,
  customer_id TEXT,
  completed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_job_outcomes_user ON job_outcomes(user_id, completed_at DESC);

-- Invoice outcomes (payment patterns for DSO learning)
CREATE TABLE IF NOT EXISTS invoice_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL,
  customer_id TEXT,
  amount REAL NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL,
  due_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  days_to_payment INT,
  is_overdue BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoice_outcomes_user ON invoice_outcomes(user_id, issued_at DESC);

-- Accounting loop states (full lifecycle tracking)
CREATE TABLE IF NOT EXISTS accounting_loops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  quote_id TEXT,
  invoice_id TEXT,
  payment_id TEXT,
  external_invoice_id TEXT, -- Moneybird/Exact ID
  current_stage TEXT NOT NULL,
  amounts JSONB NOT NULL DEFAULT '{"quoted": 0, "agreed": 0, "invoiced": 0, "paid": 0}',
  history JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_loops_user ON accounting_loops(user_id, current_stage);

-- Price observations (supplier price tracking for anomaly detection)
CREATE TABLE IF NOT EXISTS price_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  material_id TEXT NOT NULL,
  material_name TEXT NOT NULL,
  supplier_id TEXT NOT NULL,
  supplier_name TEXT,
  price REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  unit TEXT,
  in_stock BOOLEAN,
  lead_time_days INT,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_prices_material ON price_observations(material_id, observed_at DESC);
CREATE INDEX idx_prices_supplier ON price_observations(supplier_id);

-- Cohort benchmarks (anonymized cross-user aggregations)
CREATE TABLE IF NOT EXISTS cohort_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade TEXT NOT NULL,
  country TEXT NOT NULL,
  metric TEXT NOT NULL, -- 'dso', 'margin', 'quote_acceptance', etc.
  period TEXT NOT NULL, -- '2026-W12', '2026-03'
  sample_size INT NOT NULL,
  p25 REAL, -- 25th percentile
  median REAL,
  p75 REAL, -- 75th percentile
  mean REAL,
  stddev REAL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_benchmarks_lookup ON cohort_benchmarks(trade, country, metric, period);

-- Integration connections (which services are linked)
CREATE TABLE IF NOT EXISTS integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'moneybird', 'mollie', 'technische_unie', etc.
  provider_type TEXT NOT NULL CHECK (provider_type IN ('accounting', 'payment', 'supplier')),
  is_connected BOOLEAN NOT NULL DEFAULT false,
  config JSONB DEFAULT '{}', -- encrypted in production
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- Data events (general event stream for ML training)
CREATE TABLE IF NOT EXISTS data_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  event_type TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  payload JSONB DEFAULT '{}',
  entities JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_user ON data_events(user_id, event_type, created_at DESC);

-- Feedback weights (observation arrays for prediction models)
CREATE TABLE IF NOT EXISTS feedback_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feedback_type TEXT NOT NULL,
  segment_key TEXT NOT NULL DEFAULT 'default',
  observations JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, feedback_type, segment_key)
);

-- Row Level Security
ALTER TABLE learning_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE insight_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE calibration_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_loops ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_weights ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users own data" ON learning_profiles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON insight_interactions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON calibration_entries FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON job_outcomes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON invoice_outcomes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON accounting_loops FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON integration_connections FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON data_events FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON feedback_weights FOR ALL USING (auth.uid() = user_id);

-- Price observations: users see their own + anonymous aggregates
CREATE POLICY "Users own prices" ON price_observations FOR ALL USING (auth.uid() = user_id);

-- Cohort benchmarks are readable by all authenticated users (anonymized)
CREATE POLICY "Authenticated read" ON cohort_benchmarks FOR SELECT USING (auth.role() = 'authenticated');

-- RPC: Compute cohort benchmarks (server-side function)
CREATE OR REPLACE FUNCTION compute_cohort_benchmarks(
  p_trade TEXT,
  p_country TEXT,
  p_metric TEXT,
  p_period TEXT
) RETURNS void AS $$
BEGIN
  INSERT INTO cohort_benchmarks (trade, country, metric, period, sample_size, p25, median, p75, mean, stddev)
  SELECT
    p_trade,
    p_country,
    p_metric,
    p_period,
    COUNT(*)::INT,
    percentile_cont(0.25) WITHIN GROUP (ORDER BY
      CASE p_metric
        WHEN 'dso' THEN (profile_data->'invoicePatterns'->>'avgDSO')::REAL
        WHEN 'margin' THEN (profile_data->'jobCompletionHistory'->0->>'marginPercent')::REAL
        ELSE 0
      END
    ),
    percentile_cont(0.5) WITHIN GROUP (ORDER BY
      CASE p_metric
        WHEN 'dso' THEN (profile_data->'invoicePatterns'->>'avgDSO')::REAL
        WHEN 'margin' THEN (profile_data->'jobCompletionHistory'->0->>'marginPercent')::REAL
        ELSE 0
      END
    ),
    percentile_cont(0.75) WITHIN GROUP (ORDER BY
      CASE p_metric
        WHEN 'dso' THEN (profile_data->'invoicePatterns'->>'avgDSO')::REAL
        WHEN 'margin' THEN (profile_data->'jobCompletionHistory'->0->>'marginPercent')::REAL
        ELSE 0
      END
    ),
    AVG(
      CASE p_metric
        WHEN 'dso' THEN (profile_data->'invoicePatterns'->>'avgDSO')::REAL
        WHEN 'margin' THEN (profile_data->'jobCompletionHistory'->0->>'marginPercent')::REAL
        ELSE 0
      END
    ),
    STDDEV(
      CASE p_metric
        WHEN 'dso' THEN (profile_data->'invoicePatterns'->>'avgDSO')::REAL
        WHEN 'margin' THEN (profile_data->'jobCompletionHistory'->0->>'marginPercent')::REAL
        ELSE 0
      END
    )
  FROM learning_profiles
  WHERE trade = p_trade AND country = p_country;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

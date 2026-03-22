-- =============================================================================
-- DECISION TRACKER TABLES — close the customer↔contractor loop
-- =============================================================================

-- Trackers: one per job, links contractor to customer decisions
CREATE TABLE IF NOT EXISTS decision_trackers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  access_code TEXT NOT NULL UNIQUE,
  template_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired')),
  total_items INT NOT NULL DEFAULT 0,
  completed_items INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trackers_user ON decision_trackers(user_id, status);
CREATE INDEX idx_trackers_code ON decision_trackers(access_code);

-- Decision items: individual decisions within a tracker
CREATE TABLE IF NOT EXISTS decision_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracker_id UUID NOT NULL REFERENCES decision_trackers(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  help_text TEXT,
  input_type TEXT NOT NULL DEFAULT 'select',
  options JSONB DEFAULT '[]',
  is_required BOOLEAN DEFAULT true,
  due_date DATE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_items_tracker ON decision_items(tracker_id, sort_order);

-- Submissions: what the customer chose
CREATE TABLE IF NOT EXISTS decision_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracker_id UUID NOT NULL REFERENCES decision_trackers(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES decision_items(id) ON DELETE CASCADE,
  submitted_by TEXT NOT NULL DEFAULT 'customer', -- 'customer' or 'contractor'
  value TEXT,
  notes TEXT,
  photos TEXT[], -- array of URIs
  linked_product_url TEXT,
  time_to_decide_seconds INT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tracker_id, item_id, submitted_by)
);

CREATE INDEX idx_submissions_tracker ON decision_submissions(tracker_id);

-- Activities: portal analytics
CREATE TABLE IF NOT EXISTS decision_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracker_id UUID NOT NULL REFERENCES decision_trackers(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, -- 'portal_accessed', 'item_viewed', 'decision_made', 'help_clicked'
  item_id UUID REFERENCES decision_items(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activities_tracker ON decision_activities(tracker_id, created_at DESC);

-- RLS
ALTER TABLE decision_trackers ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_activities ENABLE ROW LEVEL SECURITY;

-- Contractor owns trackers
CREATE POLICY "Users own trackers" ON decision_trackers FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own items" ON decision_items FOR ALL USING (
  tracker_id IN (SELECT id FROM decision_trackers WHERE user_id = auth.uid())
);

-- Submissions: contractor can read all; customers can insert (via access code validation in edge function)
CREATE POLICY "Contractor reads submissions" ON decision_submissions FOR SELECT USING (
  tracker_id IN (SELECT id FROM decision_trackers WHERE user_id = auth.uid())
);
CREATE POLICY "Anyone can submit" ON decision_submissions FOR INSERT WITH CHECK (true);

-- Activities: same pattern
CREATE POLICY "Contractor reads activities" ON decision_activities FOR SELECT USING (
  tracker_id IN (SELECT id FROM decision_trackers WHERE user_id = auth.uid())
);
CREATE POLICY "Anyone can log activity" ON decision_activities FOR INSERT WITH CHECK (true);

-- Enable realtime for submissions (contractor gets live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE decision_submissions;

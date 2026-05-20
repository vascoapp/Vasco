-- =============================================================================
-- 20260520000002 — Sales-pipeline leads (R81 US Phase 4)
-- =============================================================================
-- Lead = pre-customer interest. Captured from website forms, inbound calls,
-- Angi/Thumbtack, referrals, manual entry, or auto-created when a quote
-- gets rejected. Moves through the Kanban (new → contacted → estimate_sent
-- → won | lost) and converts into a real Customer + Job when status flips
-- to 'won'.
--
-- See src/domain/lead.ts for the canonical shape; this table mirrors it 1:1.
--
-- Schema stability: additive only. No renames / drops / type changes. The
-- enums are CHECK constraints (not pg ENUMs) so we can extend the
-- accepted values without an ALTER TYPE migration cascade.
-- =============================================================================

CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'estimate_sent', 'won', 'lost')),
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN (
      'website_form', 'phone_inbound', 'referral', 'social',
      'google_lsa', 'angi', 'thumbtack', 'manual',
      'rejected_estimate', 'other'
    )),

  customer_name text NOT NULL,
  customer_phone text,
  customer_email text,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,

  job_description text,
  estimated_value numeric(12, 2),
  notes text,

  source_quote_id uuid REFERENCES documents(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  contacted_at timestamptz,
  converted_at timestamptz
);

-- Indexes for the pipeline screen (status filter) + dashboard (per-user
-- date sorts).
CREATE INDEX IF NOT EXISTS leads_user_status_idx
  ON leads (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS leads_user_created_idx
  ON leads (user_id, created_at DESC);

-- updated_at auto-bump on UPDATE so we don't have to set it client-side.
CREATE OR REPLACE FUNCTION leads_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  -- Also auto-set converted_at when status crosses into a closed state.
  IF NEW.status IN ('won', 'lost') AND OLD.status NOT IN ('won', 'lost') THEN
    NEW.converted_at = now();
  END IF;
  -- Auto-set contacted_at on first transition out of 'new'.
  IF NEW.status <> 'new' AND OLD.status = 'new' AND NEW.contacted_at IS NULL THEN
    NEW.contacted_at = now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_leads_touch ON leads;
CREATE TRIGGER trg_leads_touch
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION leads_touch_updated_at();

-- RLS — owner-only read/write. Same pattern as customers / quotes.
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leads_owner_read" ON leads;
CREATE POLICY "leads_owner_read" ON leads
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "leads_owner_insert" ON leads;
CREATE POLICY "leads_owner_insert" ON leads
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "leads_owner_update" ON leads;
CREATE POLICY "leads_owner_update" ON leads
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "leads_owner_delete" ON leads;
CREATE POLICY "leads_owner_delete" ON leads
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE leads IS
  'R81 US Phase 4: pre-customer sales-pipeline entity. Status-Kanban-driven. Auto-creates from rejected quotes via the rejected_estimate source.';

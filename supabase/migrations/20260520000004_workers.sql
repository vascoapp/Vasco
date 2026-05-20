-- =============================================================================
-- 20260520000004 — Workers + Job.assigned_worker_id (R86 crew dispatch lite)
-- =============================================================================
-- A worker is a tech / installer / apprentice on the contractor's crew.
-- Solo contractors don't populate this; the table just stays empty.
-- Multi-tech crews use it to route jobs to specific people and to drive
-- per-tech schedule swimlanes in the smart-scheduler.
--
-- Schema-stability: additive only. ADD COLUMN IF NOT EXISTS on jobs,
-- new workers table. CHECK constraint on role uses an extensible set —
-- adding new roles later is one ALTER TABLE away.
-- =============================================================================

CREATE TABLE IF NOT EXISTS workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'tech'
    CHECK (role IN ('owner', 'lead_tech', 'tech', 'apprentice', 'subcontractor')),
  email text,
  phone text,
  trade text,
  hourly_cost numeric(10, 2),
  is_active boolean NOT NULL DEFAULT true,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workers_user_active_idx
  ON workers (user_id, is_active, created_at DESC);

-- updated_at auto-bump on UPDATE
CREATE OR REPLACE FUNCTION workers_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_workers_touch ON workers;
CREATE TRIGGER trg_workers_touch
  BEFORE UPDATE ON workers
  FOR EACH ROW EXECUTE FUNCTION workers_touch_updated_at();

ALTER TABLE workers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workers_owner_read" ON workers;
CREATE POLICY "workers_owner_read" ON workers
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "workers_owner_insert" ON workers;
CREATE POLICY "workers_owner_insert" ON workers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "workers_owner_update" ON workers;
CREATE POLICY "workers_owner_update" ON workers
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "workers_owner_delete" ON workers;
CREATE POLICY "workers_owner_delete" ON workers
  FOR DELETE USING (auth.uid() = user_id);

-- Job assignment ──────────────────────────────────────────────────────────
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS assigned_worker_id uuid
  REFERENCES workers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS jobs_assigned_worker_idx
  ON jobs (user_id, assigned_worker_id) WHERE assigned_worker_id IS NOT NULL;

COMMENT ON TABLE workers IS
  'R86 crew dispatch lite: crew member entity. Empty for solo contractors. References by jobs.assigned_worker_id.';

COMMENT ON COLUMN jobs.assigned_worker_id IS
  'R86 crew dispatch lite: which crew member is on this job. NULL for solo contractors / unassigned.';

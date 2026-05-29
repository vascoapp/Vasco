-- =============================================================================
-- 20260527000003 — Grant table access for leads + workers
-- =============================================================================
-- R302 fix: the original migrations (20260520000002 leads, 20260520000004
-- workers) enabled RLS and created owner-scoped policies, but never
-- issued the base table GRANT to the `authenticated` role. In a fresh
-- Supabase Cloud project, default privileges normally cover this — but
-- they did not propagate on this project, so every authenticated client
-- hits "permission denied for table leads / workers" on read.
--
-- Symptom observed in dev: Metro logs after contractor login showed
--   WARN [loadLeads] failed: permission denied for table leads
--   WARN [loadWorkers] failed: permission denied for table workers
-- The R97 hydration was a no-op against the live DB; the pipeline was
-- empty for every signed-in contractor.
--
-- Note: `contractor_licenses` is NOT a separate table — R79 stores
-- licenses as a JSONB column on `business_settings`, which inherits the
-- existing business_settings RLS + grants. No license-specific grant
-- needed.
--
-- Schema stability: pure GRANT, no DDL changes. Idempotent.
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON leads TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON workers TO authenticated;

-- Service-role bypasses RLS but still needs explicit grants for direct
-- inserts from edge functions (capture-lead, ai-command, etc.).
GRANT ALL ON leads TO service_role;

GRANT ALL ON workers TO service_role;

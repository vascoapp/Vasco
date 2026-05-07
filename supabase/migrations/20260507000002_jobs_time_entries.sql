-- =============================================================================
-- JOBS TIME ENTRIES — R66 round 12 (2026-05-07)
-- =============================================================================
-- Critical NL launch data-loss bug: contractors log hours via the timesheet
-- screen → `updateJob(jobId, { timeEntries: [...] })`. The R304 mapper
-- (`jobUpdatesToRowPayload`) intentionally dropped `timeEntries` because the
-- comment said "stored in separate tables" — but no such table existed and
-- `jobRowToJob` always returned `timeEntries: []`. Net effect: every
-- contractor's clock-in/out hours lived only in React state. On app cold
-- start, jobs reload from BE → timeEntries empty → all logged hours lost.
--
-- For NL launch we add a `time_entries jsonb` column to `jobs` (default
-- `'[]'::jsonb`). Single column, no FK ceremony, matches the FE shape:
--   [{ id, date, hours, clockIn, clockOut }]
-- Solo-contractor scale (a few hundred entries per job at most) makes JSONB
-- a safer choice than a separate child table — fewer joins, atomic updates,
-- and offline-queue replay just sends the whole array on each `updateJob`
-- (existing `persistOrQueue` semantics, no schema-aware diffing needed).
-- =============================================================================

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS time_entries jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.jobs.time_entries IS
  'Per-job time entries as JSONB array: [{id, date, hours, clockIn, clockOut}]. Written by FE updateJob() via R66/R12 mapper. Solo-scale only.';

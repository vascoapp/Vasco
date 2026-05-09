-- =============================================================================
-- JOB PHOTOS — id/uuid/uid audit fix — R66 round 28 (2026-05-07)
-- =============================================================================
-- Audit of `job_photos` (created in 20260415000007_job_photos_bucket.sql) found:
--
--   1. `job_id text` instead of `uuid`. Accepted any string — temp ids,
--      "Klant" display strings (R18 bug class), empty strings, anything.
--      Validation lived only in the FE (jobPhotoService.isTempIdFast guard).
--   2. NO foreign key constraint to `public.jobs(id)`. Orphan rows on job
--      deletion. Dangling references when a row was inserted while parent
--      was still on a temp id (pre-R27 — R27 closes that path FE-side).
--   3. Inconsistent with peer columns: `documents.job_id uuid REFERENCES
--      jobs(id) ON DELETE SET NULL`, `job_materials.job_id uuid REFERENCES
--      jobs(id) ON DELETE CASCADE`. job_photos was the outlier.
--
-- Photos belong to a job (vs. invoices which need to survive job deletion
-- for tax retention) — so CASCADE is the right ON DELETE behavior.
--
-- This migration:
--   1. DELETEs rows whose job_id can't parse as uuid (defensive — protects
--      against orphan/garbage data; current FE refuses non-uuid job_ids
--      since R27, so this should be a no-op in healthy databases).
--   2. DELETEs rows whose job_id doesn't reference an existing jobs row
--      (would otherwise block the FK constraint).
--   3. ALTERs the column type to uuid.
--   4. Adds the FK constraint with ON DELETE CASCADE.
-- =============================================================================

-- 1. Drop rows with malformed job_id (any text that isn't a valid uuid).
delete from public.job_photos
where job_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- 2. Drop rows that reference non-existent jobs (orphans).
delete from public.job_photos
where job_id::uuid not in (select id from public.jobs);

-- 3. Type change.
alter table public.job_photos
  alter column job_id type uuid using job_id::uuid;

-- 4. FK constraint with cascade — photos die with their parent job.
alter table public.job_photos
  add constraint job_photos_job_id_fkey
  foreign key (job_id) references public.jobs(id) on delete cascade;

-- Index now covers the typed column directly. Drop+recreate to keep the
-- planner from confusing a stale index entry.
drop index if exists job_photos_job_idx;
create index if not exists job_photos_job_idx
  on public.job_photos (user_id, job_id, taken_at desc);

comment on column public.job_photos.job_id is
  'uuid FK → jobs(id). R28 fix: was `text` with no FK; accepted any string and orphaned on job deletion.';

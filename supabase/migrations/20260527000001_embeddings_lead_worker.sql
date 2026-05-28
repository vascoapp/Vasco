-- =============================================================================
-- WIDEN embeddings.item_type CHECK TO INCLUDE 'lead' AND 'worker'
-- Intelligence retrofit Stage 4 — semantic embedding for R81 leads + R86 crew
-- =============================================================================
-- Pre-existing CHECK was ('material', 'job', 'regulation') per
-- 20260502000001_generic_embeddings.sql. We follow the R83 5-file workflow
-- rule: when a CHECK constraint needs new enum values, drop and recreate
-- (additive — no data loss; the new values widen the accept set).
--
-- The match_similar_items RPC accepts a free-text `match_type` parameter and
-- filters by `e.item_type = match_type`, so no RPC change is required to
-- query the new types. Callers pass 'lead' or 'worker' once this lands.
--
-- RLS unchanged: owner-or-global read; owner write (user_id NULL allowed for
-- cross-contractor cohort rows, though leads/workers will be owner-scoped
-- in practice).
-- =============================================================================

-- Find the existing constraint by name. Postgres generates a synthetic name
-- like `embeddings_item_type_check` for inline CHECKs; we drop defensively
-- with IF EXISTS so re-running on a partially-migrated DB doesn't error.
alter table public.embeddings
  drop constraint if exists embeddings_item_type_check;

alter table public.embeddings
  add constraint embeddings_item_type_check
  check (item_type in ('material', 'job', 'regulation', 'lead', 'worker'));

-- Comment for downstream operators reading the schema:
comment on column public.embeddings.item_type is
  'Entity type for cosine-similarity search. material/job/regulation seeded with R279; lead/worker added in intelligence-retrofit Stage 4.';

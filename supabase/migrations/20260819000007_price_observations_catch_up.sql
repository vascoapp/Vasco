-- =============================================================================
-- 20260819000007 — price_observations: the column half of a 4/5 chain
-- =============================================================================
-- Found by a new FE↔BE drift check (`npm run check:drift`) comparing every Row
-- type in src/lib/database.types.ts against the live columns. That file is
-- hand-maintained (workflow rule 8) and had never been compared to the
-- database.
--
-- `PriceObservationRow` declares 21 fields. The table has 12. Nine were
-- fiction:
--   source, confidence, is_sale, sale_end_date, regular_price,
--   stock_level, min_quantity, bulk_pricing, created_at
--
-- `source` and `confidence` are declared NON-optional, so the type promises
-- they are always present and they were never present at all.
--
-- PROVEN LIVE, with the exact row shape the app builds:
--   insert as the app builds it  -> PGRST204 Could not find the 'confidence'
--                                   column of 'price_observations'
-- PostgREST rejects the WHOLE statement on an unknown column, so this is not a
-- field quietly going missing — it is every write failing, into a logWarn.
--
-- ── Why ADD the columns rather than delete them from the type ─────────────
-- The rule is not to add columns nothing writes. These are written, by three
-- separate call sites, and the chain is 4/5 complete — domain type, mapper,
-- database.types and writers all exist; only the migration was skipped:
--
--   · intelligenceDataProvider.insertPriceObservation names ALL nine, and is
--     reached from pricingApi.recordPriceObservation ← decisionIntelligence,
--     which fires when a customer links a product in the decision portal. A
--     LIVE customer path.
--   · dataProvider.insertPriceObservation and createPriceObservationsBatch
--     both name source + confidence.
--   · ContractorDashboard (mounted at app/(tabs)/index.tsx) filters on
--     `po.isSale` and renders `po.regularPrice` — a filter that could only
--     ever match nothing, and a price that could only ever be blank, for
--     every real contractor. Learnings #109, exactly.
--
-- ── supplier_id ──────────────────────────────────────────────────────────
-- Also NOT NULL, with no default, and `createPriceObservationsBatch` never
-- sets it — so even with the nine columns added, that writer would still fail
-- 23502. It is wrong on its own terms: `supplier_name` is nullable and the
-- domain type says `supplierId?`, because an observation scanned off an
-- invoice has a supplier NAME long before it has a supplier ROW. Relaxed.
--
-- The table is empty in production, so every default and every relaxation
-- here is free — nothing to backfill and nothing to invalidate.
-- =============================================================================

ALTER TABLE public.price_observations
  -- Which of the moat's data channels this price came from. NOT NULL because
  -- an observation whose provenance is unknown cannot be weighted against one
  -- that came off a supplier invoice; the default exists only so the statement
  -- is safe, not as a value anything should rely on.
  ADD COLUMN IF NOT EXISTS source        text          NOT NULL DEFAULT 'unknown',
  -- 0..1. Scanned invoice ≈ 1.0; a customer's product link is softer.
  ADD COLUMN IF NOT EXISTS confidence    numeric(4,3)  NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS is_sale       boolean,
  ADD COLUMN IF NOT EXISTS sale_end_date date,
  ADD COLUMN IF NOT EXISTS regular_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS stock_level   text,
  ADD COLUMN IF NOT EXISTS min_quantity  numeric(12,3),
  ADD COLUMN IF NOT EXISTS bulk_pricing  jsonb,
  ADD COLUMN IF NOT EXISTS created_at    timestamptz   NOT NULL DEFAULT now();

-- An observation can name a supplier it cannot link to one.
ALTER TABLE public.price_observations
  ALTER COLUMN supplier_id DROP NOT NULL;

-- `confidence` is a probability. Nothing enforced that, and a writer passing a
-- percentage (85) instead of a fraction (0.85) would poison every weighting
-- that reads it — silently, because a number is a number.
ALTER TABLE public.price_observations
  DROP CONSTRAINT IF EXISTS price_observations_confidence_range;
ALTER TABLE public.price_observations
  ADD CONSTRAINT price_observations_confidence_range
  CHECK (confidence >= 0 AND confidence <= 1);

COMMENT ON COLUMN public.price_observations.source IS
  'Which pricing-moat channel produced this observation (job_completion, quote, invoice_scan, …). Set by every writer; the ''unknown'' default is a safety value, not a category.';
COMMENT ON COLUMN public.price_observations.confidence IS
  'Fraction 0..1, CHECK-enforced. A percentage here would silently skew every weighted average that reads it.';

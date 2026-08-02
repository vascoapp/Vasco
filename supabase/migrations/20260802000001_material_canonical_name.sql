-- =============================================================================
-- material_price_history += canonical_name  (SCHEMA_LOCK v1.10)
-- =============================================================================
-- WHY
-- `material_price_benchmarks` groups by LOWER(material_name) and suppresses
-- below HAVING COUNT(DISTINCT observed_by) >= 5. So the exact spelling a
-- contractor or an OCR pass happened to use IS the cohort key, and one physical
-- product recorded as
--
--     'YMvK 3x2,5mm²'  /  'kabel ymvk 3 x 2.5 mm2'  /  'YMVK-kabel 3X2,5'
--
-- fragments into three sub-k groups. The benchmark then shows NOTHING even
-- though the observations exist. Collapsing those variants raises cohort
-- density without recruiting a single additional contractor — the cheapest
-- available way to switch the differentiator on.
--
-- `canonical_name` holds the normalised cohort key produced by
-- src/services/materialNormalization.ts (identity-first: EAN > supplier article
-- number > deterministic text canonicalisation). `material_name` keeps the RAW
-- description, because it is user-visible in QuoteOptimizer and PriceAlerts and
-- a sorted-token key would be unreadable there.
--
-- DELIBERATELY ADDITIVE ONLY — the view and get_material_cohort_stats are NOT
-- touched in this migration.
--
-- Rationale: canonicalisation lives in TypeScript (unicode folding, unit
-- aliases across six languages, dimension parsing) and cannot be reproduced
-- faithfully in SQL, so existing rows cannot be back-filled by this migration.
-- Repointing the view at a column that is correct for new rows and merely
-- lower-cased for old ones would silently split every existing cohort in two.
--
-- The read-side switch is therefore a SEPARATE follow-up, to be applied only
-- after a client-side backfill pass has populated canonical_name for historic
-- rows and the result has been eyeballed against real data. Sequence:
--   1. this migration                          <- new rows start carrying the key
--   2. client backfill of historic rows
--   3. view + get_material_cohort_stats repoint to canonical_name
-- =============================================================================

ALTER TABLE material_price_history
  ADD COLUMN IF NOT EXISTS canonical_name TEXT;

COMMENT ON COLUMN material_price_history.canonical_name IS
  'Normalised cohort key from src/services/materialNormalization.ts '
  '(ean:<gtin> | art:<supplier>:<code> | sorted canonical tokens). '
  'material_name stays RAW for display. Read path still groups on '
  'material_name until the step-3 follow-up migration lands.';

-- Seed new-but-unwritten rows so the column is never a surprise NULL. This is
-- LOWER(material_name), NOT a real canonicalisation — see the note above. It
-- keeps old rows exactly as the current view already groups them, so nothing
-- moves cohort until the deliberate step-3 switch.
UPDATE material_price_history
   SET canonical_name = LOWER(TRIM(material_name))
 WHERE canonical_name IS NULL;

-- Supports the step-3 grouping and the client-side "does a cohort already exist
-- for this key?" lookup. Mirrors the view's grouping columns.
CREATE INDEX IF NOT EXISTS idx_material_price_history_canonical
  ON material_price_history (trade, country, canonical_name);

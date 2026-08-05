-- =============================================================================
-- COHORT KEY — group on the canonical name, not the raw spelling
-- =============================================================================
-- `material_price_benchmarks` groups by `LOWER(material_name)` and requires
-- `COUNT(DISTINCT observed_by) >= 5`. THE RAW SPELLING IS THE COHORT KEY, so one
-- product written six ways is six sub-k groups and the benchmark shows nothing
-- despite having the observations. Raising density this way costs nothing and
-- recruits nobody — it is the cheapest way to switch the differentiator on.
--
-- Migration 20260802000001 added `canonical_name` and deliberately did NOT
-- repoint the view, for a good reason at the time: canonicalisation lives in
-- TypeScript (unicode folding, six-language unit aliases, dimension parsing) and
-- cannot be reproduced in SQL, so historic rows could not be back-filled by a
-- migration. Repointing then would have split every existing cohort in two.
--
-- ⚠️ THAT REASON HAS EXPIRED, AND THE WINDOW IS OPEN EXACTLY NOW.
-- `material_price_history` currently holds ZERO rows in production (verified
-- 2026-08-06). There is no history to split and no back-fill to perform. Every
-- day of real observations makes this migration harder and more dangerous; on
-- an empty table it is free. The `coalesce` fallback below means it would also
-- have been correct with data, but it would have needed a back-fill first.
--
-- -----------------------------------------------------------------------------
-- THE KEY IS A THREE-LAYER CHAIN, IDENTITY FIRST
-- -----------------------------------------------------------------------------
--   1. an LLM- or human-proposed alias  (material_canonical_aliases, below)
--   2. the deterministic canonical name (canonical_name, written by
--      dataCollector via src/services/materialNormalization.ts — EAN >
--      supplier article number > sorted, folded text)
--   3. lower(material_name), the historic behaviour, for any row predating 1-2
--
-- Layer 3 is not decoration: without it a row whose canonical_name failed to be
-- written would silently vanish from every benchmark rather than merely
-- grouping coarsely. Falling back to the old behaviour is the safe failure.
--
-- -----------------------------------------------------------------------------
-- A COHORT KEY IS NOT A DISPLAY NAME
-- -----------------------------------------------------------------------------
-- The canonical form sorts and folds tokens, so it reads like `2.5x3 ymvk` —
-- correct to group on, wrong to show a contractor. The view therefore also
-- returns `material_name` as the MOST COMMON RAW SPELLING in the group. The
-- previous behaviour (grouping on the lowercased name and displaying it)
-- accidentally conflated the two jobs; separating them is what lets the key get
-- more aggressive without the UI getting worse.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Alias table — where a proposed merge lives once it has passed the gate
-- ---------------------------------------------------------------------------
-- Deterministic canonicalisation provably cannot merge everything: 'YMvK
-- 3x2,5mm²' never says "kabel", so no rule relates it to 'kabel ymvk 3x2.5mm2'.
-- Subset matching cannot fix it either — the cohort key is one string Postgres
-- GROUP BYs on, so the relation must be an EQUIVALENCE relation, and subset
-- matching is not transitive. That residual is what the LLM tier is for.
--
-- Proposals are ROWS, not a black box: reviewable, revocable, and attributable.
-- A merge that turns out to be wrong is one DELETE away from being undone,
-- which is not true of anything written into material_price_history itself.
CREATE TABLE IF NOT EXISTS public.material_canonical_aliases (
  variant_key   TEXT PRIMARY KEY,
  canonical_key TEXT NOT NULL,
  -- 'llm'    — proposed by the model, passed proposalIsAcceptable
  -- 'manual' — an operator decision
  -- 'ean'    — two spellings observed under one barcode; identity, not opinion
  source        TEXT NOT NULL CHECK (source IN ('llm', 'manual', 'ean')),
  confidence    REAL,
  rationale     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- An alias pointing at itself is a no-op; one pointing at another alias makes
  -- the relation non-transitive and the "equivalence relation" argument above
  -- collapses. Chains are rejected in the writer, not here — a CHECK cannot see
  -- other rows — but self-reference is cheap to forbid outright.
  CONSTRAINT alias_not_self CHECK (variant_key <> canonical_key)
);

CREATE INDEX IF NOT EXISTS material_canonical_aliases_target
  ON public.material_canonical_aliases (canonical_key);

ALTER TABLE public.material_canonical_aliases ENABLE ROW LEVEL SECURITY;

-- Readable by any signed-in contractor (it is part of resolving their own
-- benchmarks) and writable by NOBODY holding a client key. An alias table a
-- client can write is a moat-poisoning primitive: one crafted row merges an
-- expensive product into a cheap cohort and moves everyone's benchmark.
-- Proposals arrive via a service_role job (edge function), never from a device.
DROP POLICY IF EXISTS material_canonical_aliases_read ON public.material_canonical_aliases;
CREATE POLICY material_canonical_aliases_read ON public.material_canonical_aliases
  FOR SELECT TO authenticated USING (true);

-- Learnings #87: a policy without a GRANT is inert. Learnings #90: anon is a
-- member of PUBLIC, so say what it does not get.
GRANT SELECT ON public.material_canonical_aliases TO authenticated;
REVOKE ALL ON public.material_canonical_aliases FROM anon;

COMMENT ON TABLE public.material_canonical_aliases IS
  'variant→canonical merges that deterministic canonicalisation cannot make. '
  'Written ONLY by service_role (LLM proposer edge fn) after passing '
  'proposalIsAcceptable in src/services/materialNormalization.ts. '
  'Never client-writable: a crafted alias moves every contractor''s benchmark.';

-- ---------------------------------------------------------------------------
-- 2. Repoint the benchmark view
-- ---------------------------------------------------------------------------
-- DROP rather than CREATE OR REPLACE: replacing a view cannot rename or reorder
-- its columns, and this adds `cohort_key` ahead of `material_name`. The
-- consumer function is dropped first so the view has no dependents at that
-- moment; both are recreated below, in the same transaction as this migration.
-- Verified beforehand that no other view depends on this one.
DROP FUNCTION IF EXISTS get_material_cohort_stats(TEXT, TEXT, TEXT, INT) CASCADE;
DROP VIEW IF EXISTS public.material_price_benchmarks;

CREATE VIEW public.material_price_benchmarks AS
SELECT
  mph.trade,
  mph.country,
  -- The grouping key, exposed so callers can match on it directly.
  COALESCE(a.canonical_key, mph.canonical_name, lower(mph.material_name)) AS cohort_key,
  -- The label. Most common raw spelling in the group — what a contractor would
  -- recognise, rather than the sorted/folded key they never typed.
  mode() WITHIN GROUP (ORDER BY mph.material_name) AS material_name,
  mph.material_category,
  mph.unit,
  avg(mph.price_excl_vat)::real AS avg_price,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY mph.price_excl_vat::double precision)::real AS median_price,
  percentile_cont(0.25) WITHIN GROUP (ORDER BY mph.price_excl_vat::double precision)::real AS p25_price,
  percentile_cont(0.75) WITHIN GROUP (ORDER BY mph.price_excl_vat::double precision)::real AS p75_price,
  min(mph.price_excl_vat) AS min_price,
  max(mph.price_excl_vat) AS max_price,
  count(*) AS sample_size,
  count(DISTINCT mph.observed_by) AS contractor_count,
  max(mph.observed_at) AS last_observed
FROM material_price_history mph
LEFT JOIN public.material_canonical_aliases a
  ON a.variant_key = COALESCE(mph.canonical_name, lower(mph.material_name))
WHERE mph.observed_at > (now() - '180 days'::interval)
GROUP BY
  mph.trade,
  mph.country,
  COALESCE(a.canonical_key, mph.canonical_name, lower(mph.material_name)),
  mph.material_category,
  mph.unit
-- k-anonymity unchanged and non-negotiable: five DISTINCT contractors, not five
-- observations. Merging cohorts makes this threshold EASIER to reach, which is
-- the entire point — but it must not become easier to reach with one
-- contractor's data.
HAVING count(DISTINCT mph.observed_by) >= 5;

-- ---------------------------------------------------------------------------
-- 3. Repoint the RPC
-- ---------------------------------------------------------------------------
-- ⚠️ SEMANTIC CHANGE: `p_material_name` is now matched against the COHORT KEY,
-- so callers filtering by a specific material must pass the canonical key from
-- canonicalMaterialKey() rather than the raw name. The raw name is still
-- accepted as a fallback so an un-migrated caller degrades to "no match"
-- instead of an error — and the only current caller
-- (src/services/cohortBenchmarkService.ts) passes NULL and lists everything.
CREATE OR REPLACE FUNCTION get_material_cohort_stats(
  p_trade TEXT,
  p_country TEXT,
  p_material_name TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  cohort_key TEXT,
  material_name TEXT,
  material_category TEXT,
  unit TEXT,
  avg_price REAL,
  median_price REAL,
  p25_price REAL,
  p75_price REAL,
  min_price REAL,
  max_price REAL,
  sample_size BIGINT,
  contractor_count BIGINT,
  last_observed TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    mpb.cohort_key,
    mpb.material_name,
    mpb.material_category,
    mpb.unit,
    mpb.avg_price,
    mpb.median_price,
    mpb.p25_price,
    mpb.p75_price,
    mpb.min_price,
    mpb.max_price,
    mpb.sample_size,
    mpb.contractor_count,
    mpb.last_observed
  FROM material_price_benchmarks mpb
  WHERE mpb.trade = p_trade
    AND mpb.country = p_country
    AND (
      p_material_name IS NULL
      OR mpb.cohort_key = p_material_name
      OR mpb.cohort_key = lower(p_material_name)
      OR mpb.material_name = lower(p_material_name)
    )
  ORDER BY mpb.sample_size DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_material_cohort_stats(TEXT, TEXT, TEXT, INT) TO authenticated;

COMMENT ON VIEW public.material_price_benchmarks IS
  'Cohort benchmarks grouped on COALESCE(alias, canonical_name, lower(material_name)). '
  'cohort_key is the grouping key; material_name is the most common raw spelling, '
  'for display only. k-anonymity >= 5 DISTINCT contractors.';

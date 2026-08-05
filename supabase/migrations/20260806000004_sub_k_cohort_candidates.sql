-- =============================================================================
-- SUB-K COHORT CANDIDATES — the input to the LLM merge proposer
-- =============================================================================
-- These are the cohorts LOSING to fragmentation: real observations that sit
-- under the k-anonymity threshold, so they show nobody anything. They are the
-- only cohorts worth proposing merges for. Cohorts already at or above k are
-- deliberately excluded — merging those changes numbers contractors are already
-- being shown, for no gain in coverage.
--
-- 🔒 service_role ONLY, and that is a k-anonymity requirement rather than
-- caution. The benchmark view exists to never reveal a group of fewer than five
-- contractors; a function that lists precisely those groups is the exact
-- complement of it. A cohort with one contractor names a material only that
-- contractor bought. It is consumed by supabase/functions/propose-material-merges,
-- which runs on the service key and forwards only key/label/unit to the model —
-- never prices, suppliers or contractor identities.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_sub_k_cohort_candidates(p_k INT DEFAULT 5)
RETURNS TABLE (
  cohort_key   TEXT,
  label        TEXT,
  trade        TEXT,
  country      TEXT,
  unit         TEXT,
  category     TEXT,
  contractors  BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    COALESCE(a.canonical_key, mph.canonical_name, lower(mph.material_name)) AS cohort_key,
    -- Most common raw spelling, same as the benchmark view's display label: it
    -- is what the model can actually reason about. The canonical key alone is
    -- folded and token-sorted, which discards exactly the wording cues that say
    -- whether two keys are the same product.
    mode() WITHIN GROUP (ORDER BY mph.material_name) AS label,
    mph.trade,
    mph.country,
    mph.unit,
    mph.material_category,
    count(DISTINCT mph.observed_by) AS contractors
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
  HAVING count(DISTINCT mph.observed_by) < p_k
  ORDER BY count(*) DESC
  LIMIT 500;
$$;

REVOKE ALL ON FUNCTION public.get_sub_k_cohort_candidates(INT) FROM public;
GRANT EXECUTE ON FUNCTION public.get_sub_k_cohort_candidates(INT) TO service_role;
-- authenticated and anon deliberately absent. Learnings #90: anon is a member
-- of PUBLIC, so the REVOKE above is the load-bearing line.

COMMENT ON FUNCTION public.get_sub_k_cohort_candidates(INT) IS
  'Cohorts below the k-anonymity threshold — the merge proposer''s input. '
  'service_role ONLY: this is the exact complement of what the benchmark view '
  'is designed never to reveal.';

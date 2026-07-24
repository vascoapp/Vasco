// =============================================================================
// COMPLEXITY ENUM — single source of truth (#7)
// =============================================================================
// The BE schema (photo_analyses.estimated_complexity CHECK) and the cohort RPCs
// use `simple | moderate | complex`. The photo-analysis vision prompt has
// historically emitted the legacy FE value `medium`. That mismatch was patched
// inline in two places (intelligenceCaptureService + AIQuoteFromPhoto), which is
// exactly how enums drift back apart. Normalize at every read boundary here so
// there is one place to change if the vocabulary ever moves again.
// =============================================================================

export type Complexity = 'simple' | 'moderate' | 'complex';

/**
 * Map any incoming complexity token to the canonical BE enum.
 * Accepts the legacy FE `medium` (→ `moderate`). Unknown/empty → undefined so
 * the caller can send null and fall back to the broader trade-level cohort.
 */
export function normalizeComplexity(v: string | null | undefined): Complexity | undefined {
  if (v == null) return undefined;
  const s = String(v).toLowerCase().trim();
  if (s === 'medium' || s === 'moderate') return 'moderate';
  if (s === 'simple') return 'simple';
  if (s === 'complex') return 'complex';
  return undefined;
}

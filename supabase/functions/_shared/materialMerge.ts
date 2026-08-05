// =============================================================================
// MATERIAL MERGE VERIFIER — what the model is allowed to have decided
// =============================================================================
// Extracted from the propose-material-merges function so it can be tested on
// its own. It is the only thing standing between a language model and
// `material_price_history`, which is the training data the entire cohort moat
// runs on and the one table that cannot be un-poisoned.
//
// The doctrine everywhere in this codebase's LLM ladder: the model proposes,
// the rules engine verifies, and anything unverifiable is DISCARDED rather than
// repaired. A repaired merge is a merge nobody checked.
// =============================================================================

export interface MergeCandidate {
  cohort_key: string;
  label: string;
  trade: string;
  country: string;
  unit: string;
  category: string | null;
  contractors: number;
}

export interface Merge {
  canonical: string;
  variants: string[];
  reason?: string;
}

export interface VerifyResult {
  accepted: Merge[];
  rejected: { why: string; merge?: unknown }[];
}

/**
 * Verify a model's proposed merges against the candidates it was shown.
 *
 * The central check is `output ⊆ input`: every key the model emits must be one
 * it was given. That single rule is why this tier lets the model SELECT rather
 * than AUTHOR a canonical string — invention becomes structurally impossible
 * instead of merely detectable, and no canonicaliser is needed here to catch it.
 */
export function acceptableMerges(raw: unknown, candidates: MergeCandidate[]): VerifyResult {
  const byKey = new Map(candidates.map((c) => [c.cohort_key, c]));
  const accepted: Merge[] = [];
  const rejected: { why: string; merge?: unknown }[] = [];

  const list = Array.isArray((raw as { merges?: unknown })?.merges)
    ? ((raw as { merges: unknown[] }).merges)
    : [];

  // A key claimed as a variant may not later win, and a winner may not later be
  // demoted to a variant. Enforced across the whole batch because that is what
  // keeps the alias relation FLAT — one hop, always. Chained aliases would make
  // the relation non-transitive, and a cohort key has to be an equivalence
  // class or Postgres's GROUP BY silently gives the wrong answer.
  const claimedVariants = new Set<string>();
  const claimedWinners = new Set<string>();

  for (const m of list) {
    const canonical = (m as Merge)?.canonical;
    const variants = (m as Merge)?.variants;

    if (typeof canonical !== 'string' || !Array.isArray(variants) || variants.length === 0) {
      rejected.push({ why: 'malformed', merge: m });
      continue;
    }
    const winner = byKey.get(canonical);
    if (!winner) {
      // The check that matters most: the model invented a key.
      rejected.push({ why: 'canonical not in input', merge: m });
      continue;
    }
    if (claimedVariants.has(canonical)) {
      rejected.push({ why: 'canonical is already a variant (would chain)', merge: m });
      continue;
    }

    const good: string[] = [];
    for (const v of variants) {
      if (typeof v !== 'string') { rejected.push({ why: 'non-string variant', merge: m }); continue; }
      if (v === canonical) continue; // no-op, silently dropped
      const cand = byKey.get(v);
      if (!cand) { rejected.push({ why: `variant not in input: ${v}`, merge: m }); continue; }
      if (claimedWinners.has(v) || claimedVariants.has(v)) {
        rejected.push({ why: `variant already claimed: ${v}`, merge: m });
        continue;
      }
      // Unit and category are their own GROUP BY columns in the benchmark view.
      // Merging across them would put a price-per-metre in the same cohort as a
      // price-per-piece, which is worse than not merging at all.
      if (cand.unit !== winner.unit) {
        rejected.push({ why: `unit mismatch: ${cand.unit} vs ${winner.unit}`, merge: m });
        continue;
      }
      if ((cand.category ?? '') !== (winner.category ?? '')) {
        rejected.push({ why: 'category mismatch', merge: m });
        continue;
      }
      good.push(v);
    }

    if (good.length === 0) continue;
    good.forEach((v) => claimedVariants.add(v));
    claimedWinners.add(canonical);
    accepted.push({ canonical, variants: good, reason: (m as Merge)?.reason });
  }

  return { accepted, rejected };
}

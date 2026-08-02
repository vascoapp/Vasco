// =============================================================================
// SITUATIONAL RANKING — bounded LLM influence over insight ordering
// =============================================================================
// Tier 2 of the LLM ladder (see phrasing = tier 1, extraction = tier 3).
//
// WHAT RULES CANNOT SAY. `scoreInsight` already multiplies calibration, data
// volume and the contractor's own approval history — all grounded in measured
// outcomes. What none of them can express is cross-signal context:
//
//     "it is Friday, the VAT deadline is Monday, and three jobs are booked —
//      the VAT insight matters more than the margin insight THIS WEEK"
//
// That is a judgement over a situation, which is what a language model is
// actually good at, and it is the only thing being asked for here.
//
// THE "CANNOT INVENT" RULE FOR THIS TIER IS BOUNDED INFLUENCE.
// Phrasing forbids emitting a number. Extraction demands arithmetic. Here the
// model may only WEIGHT ids it was given, within a narrow band:
//
//   * it cannot introduce a generatorId that was not in the input
//   * it cannot return duplicates
//   * every multiplier is clamped to [MIN, MAX]
//
// The clamp is the load-bearing part. Calibration and approval rate are learned
// from what actually happened; a language model's hunch must be able to NUDGE
// that ordering but never overrule it. Within +-35% it can reorder neighbours;
// it can never promote a bottom insight to the top or bury a critical one.
//
// Pure and dependency-free — imported by the RN client and by the Deno edge
// function, so the bounds cannot drift between where they are produced and
// where they are enforced.
// =============================================================================

/** A single generator's situational weight. */
export interface RankingWeight {
  generatorId: string;
  /** Multiplier applied to rawScore. 1.0 = no opinion. */
  multiplier: number;
  /** Short, human-readable justification. Shown in the developer hub, not to contractors. */
  reason?: string;
}

export interface RankingHint {
  /** Bumped when the contract changes shape. */
  version: number;
  /** ISO. Hints are situational, so they expire — see RANKING_HINT_TTL_MS. */
  generatedAt: string;
  /**
   * Digest of the situation the hint was computed for. If the situation
   * changes materially the hint no longer applies, even inside its TTL.
   */
  contextDigest: string;
  provider: string;
  weights: RankingWeight[];
}

export const RANKING_HINT_VERSION = 1;

/**
 * Bounds on LLM influence. Deliberately tight.
 *
 * At 0.75-1.35 the model can reorder insights whose scores are already close,
 * which is exactly the "these two are both worth showing, which first?" case.
 * It cannot overturn a large gap, because a large gap means calibration or the
 * contractor's own approval history had a strong opinion, and those are
 * evidence rather than judgement.
 */
export const MIN_MULTIPLIER = 0.75;
export const MAX_MULTIPLIER = 1.35;

/** Situational context goes stale fast — a Friday hint is wrong by Tuesday. */
export const RANKING_HINT_TTL_MS = 24 * 60 * 60 * 1000;

export interface RankingViolation {
  generatorId?: string;
  rule: string;
  detail: string;
}

export interface RankingValidation {
  /** Weights safe to apply. Anything rejected is simply absent (⇒ multiplier 1.0). */
  accepted: RankingWeight[];
  violations: RankingViolation[];
}

/**
 * Validate model output against the ids it was actually offered.
 *
 * Returns accepted weights rather than rejecting the batch: one hallucinated id
 * should cost that id its hint, not cost every other insight a better ordering.
 */
export function validateRankingWeights(
  offeredGeneratorIds: string[],
  weights: unknown,
): RankingValidation {
  const accepted: RankingWeight[] = [];
  const violations: RankingViolation[] = [];
  const offered = new Set(offeredGeneratorIds);
  const seen = new Set<string>();

  if (!Array.isArray(weights)) {
    return { accepted, violations: [{ rule: 'not_an_array', detail: 'weights must be an array' }] };
  }

  for (const raw of weights) {
    const w = raw as Partial<RankingWeight>;
    const id = typeof w?.generatorId === 'string' ? w.generatorId.trim() : '';

    if (!id) {
      violations.push({ rule: 'missing_id', detail: 'weight has no generatorId' });
      continue;
    }
    // THE core rule: the model may only weight what it was shown.
    if (!offered.has(id)) {
      violations.push({ generatorId: id, rule: 'unknown_generator', detail: 'not among the offered insights' });
      continue;
    }
    if (seen.has(id)) {
      violations.push({ generatorId: id, rule: 'duplicate', detail: 'generatorId appears more than once' });
      continue;
    }
    if (typeof w.multiplier !== 'number' || !Number.isFinite(w.multiplier)) {
      violations.push({ generatorId: id, rule: 'non_numeric', detail: 'multiplier is not a finite number' });
      continue;
    }
    // Out-of-band values are rejected outright rather than clamped: a model
    // asking for 5x has misunderstood the task, and silently clamping to 1.35
    // would hide that in a way nobody would ever look at.
    if (w.multiplier < MIN_MULTIPLIER || w.multiplier > MAX_MULTIPLIER) {
      violations.push({
        generatorId: id,
        rule: 'out_of_bounds',
        detail: `multiplier ${w.multiplier} outside [${MIN_MULTIPLIER}, ${MAX_MULTIPLIER}]`,
      });
      continue;
    }

    seen.add(id);
    accepted.push({
      generatorId: id,
      multiplier: w.multiplier,
      reason: typeof w.reason === 'string' ? w.reason.slice(0, 160) : undefined,
    });
  }

  return { accepted, violations };
}

/**
 * Digest of the situation a hint was computed for.
 *
 * Deliberately COARSE: the set of firing generators, the day of week, and the
 * ISO date. A hint should survive a rawScore wobbling by 0.01, but must not
 * survive into a different day or a different set of insights — that is when
 * "the VAT deadline is Monday" stops being true.
 */
export function situationDigest(input: {
  generatorIds: string[];
  isoDate: string;
  dayOfWeek: number;
}): string {
  const ids = [...new Set(input.generatorIds)].sort().join(',');
  return `${input.isoDate}|${input.dayOfWeek}|${ids}`;
}

/** Whether a stored hint still applies to the situation in front of us. */
export function hintIsApplicable(
  hint: RankingHint | null | undefined,
  currentDigest: string,
  nowMs: number,
): boolean {
  if (!hint || hint.version !== RANKING_HINT_VERSION) return false;
  if (hint.contextDigest !== currentDigest) return false;
  const age = nowMs - Date.parse(hint.generatedAt);
  return Number.isFinite(age) && age >= 0 && age < RANKING_HINT_TTL_MS;
}

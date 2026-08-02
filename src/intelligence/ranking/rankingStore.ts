// =============================================================================
// RANKING STORE — synchronous application of an asynchronously-computed hint
// =============================================================================
// `scoreInsight` is SYNCHRONOUS and sits inside a render. The same constraint
// that shaped the phrasing layer applies here: an LLM call cannot go in the
// hot path without putting seconds in front of every card and breaking the
// offline-first guarantee.
//
// So the hint is computed OUT OF BAND (by the background scheduler, which
// already wakes every 30 minutes to run audits and build the morning briefing)
// and applied synchronously from an in-memory cache. If no hint exists, is
// stale, or was computed for a different situation, every multiplier is 1.0 —
// i.e. exactly today's ordering. The floor never moves.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  hintIsApplicable,
  situationDigest,
  validateRankingWeights,
  RANKING_HINT_VERSION,
  type RankingHint,
} from './rankingContract';

const STORAGE_KEY = '@vasco_ranking_hint';

/** In-memory mirror, because scoreInsight cannot await AsyncStorage. */
let activeHint: RankingHint | null = null;
let activeDigest = '';
let multipliers = new Map<string, number>();

/** Today's situation digest, recomputed by the scheduler. */
export function currentSituationDigest(generatorIds: string[], now: Date): string {
  return situationDigest({
    generatorIds,
    // Local date, deliberately — "today" for a contractor is their calendar day,
    // and a UTC split is what made Werk and Dagplanning disagree once already.
    isoDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    dayOfWeek: now.getDay(),
  });
}

/**
 * Install a hint. Weights are revalidated here even though the edge function
 * already validated them — a hint is data that survives in AsyncStorage across
 * app versions, and the offered-id set it was built against may no longer exist.
 */
export function applyRankingHint(
  hint: RankingHint | null,
  offeredGeneratorIds: string[],
  currentDigest: string,
  now: Date = new Date(),
): { applied: number; rejected: number } {
  if (!hintIsApplicable(hint, currentDigest, now.getTime())) {
    activeHint = null;
    activeDigest = '';
    multipliers = new Map();
    return { applied: 0, rejected: hint?.weights?.length ?? 0 };
  }

  const { accepted, violations } = validateRankingWeights(offeredGeneratorIds, hint!.weights);
  multipliers = new Map(accepted.map((w) => [w.generatorId, w.multiplier]));
  activeHint = hint!;
  activeDigest = currentDigest;
  return { applied: accepted.length, rejected: violations.length };
}

/** Forget any hint. Ordering reverts to pure rules. */
export function clearRankingHint(): void {
  activeHint = null;
  activeDigest = '';
  multipliers = new Map();
}

/**
 * The multiplier `scoreInsight` applies. 1.0 whenever there is no opinion —
 * which is the default, the offline case, the stale case and the failure case.
 */
export function getSituationalMultiplier(generatorId: string | undefined): number {
  if (!generatorId) return 1.0;
  return multipliers.get(generatorId) ?? 1.0;
}

/** Provenance for the developer hub: what is currently influencing ordering, and why. */
export function getActiveRankingHint(): { digest: string; hint: RankingHint | null } {
  return { digest: activeDigest, hint: activeHint };
}

// ---------------------------------------------------------------------------
// Persistence — the scheduler writes, app start reads
// ---------------------------------------------------------------------------

export async function persistRankingHint(hint: RankingHint): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(hint));
  } catch {
    // A hint is an optimisation. Losing it costs ordering quality, nothing else.
  }
}

/**
 * Load a persisted hint at startup so the first render of the day already has
 * it, rather than waiting for the scheduler's next tick.
 */
export async function hydrateRankingHint(
  offeredGeneratorIds: string[],
  now: Date = new Date(),
): Promise<{ applied: number; rejected: number }> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { applied: 0, rejected: 0 };
    const hint = JSON.parse(raw) as RankingHint;
    return applyRankingHint(hint, offeredGeneratorIds, currentSituationDigest(offeredGeneratorIds, now), now);
  } catch {
    return { applied: 0, rejected: 0 };
  }
}

export { RANKING_HINT_VERSION };

// =============================================================================
// RANKING REFRESH — the piece that closes the loop
// =============================================================================
// rankingContract validates, rankingStore applies, and the rank-insights edge
// function produces. Without this file none of them are ever reached: the hint
// is never requested, never persisted and never rehydrated, so
// `getSituationalMultiplier` returns 1.0 forever and the whole tier is inert.
//
// That is exactly the dead-code shape this codebase has been bitten by before
// (materials/material_aliases types with no migration; 47 translation keys with
// no call sites), so it is worth naming: a validator plus a store plus an edge
// function is NOT a feature until something calls them.
//
// Called from the background scheduler, never from a render — see
// rankingStore.ts for why the hot path has to stay synchronous.
// =============================================================================

import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { logWarn } from '../../utils/errorHandler';
import {
  applyRankingHint,
  currentSituationDigest,
  getActiveRankingHint,
  hydrateRankingHint,
  persistRankingHint,
} from './rankingStore';
import { hintIsApplicable, RANKING_HINT_VERSION, type RankingHint } from './rankingContract';

/** Bucketed magnitude — never a real figure. See rank-insights/index.ts. */
export type Magnitude = 'small' | 'medium' | 'large';

export interface RankableInsight {
  generatorId: string;
  category?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  /**
   * How big the underlying PROBLEM is — euros overdue, days late — bucketed by
   * the caller, which is the only place that still has the real figure.
   *
   * ⚠️ Must never be derived from `rawScore`. That is the score the rules
   * already assigned, so labelling it "magnitude" lies to the model, and since
   * the model's answer is then multiplied back into rawScore it forms a
   * feedback loop that carries no new information. No generator exposes a true
   * magnitude yet, so callers currently leave this undefined — which is correct.
   */
  magnitude?: Magnitude;
  ageDays?: number;
  confidence?: number;
}

export interface RankingContextSignals {
  /** Value-free situation flags, e.g. ['vat_deadline_in_3_days']. */
  signals?: string[];
  country?: string;
  trade?: string;
}

function confidenceBucket(c: number | undefined): 'low' | 'medium' | 'high' {
  if (typeof c !== 'number' || !Number.isFinite(c)) return 'medium';
  return c < 0.4 ? 'low' : c < 0.75 ? 'medium' : 'high';
}

// Hydration is folded into refreshRankingHint below rather than exposed as a
// separate init step. A separate step is one more thing a caller can forget —
// and a sweep of this session's modules found it already forgotten, so a
// persisted hint was never loaded on cold start and an offline launch got
// nothing despite a perfectly valid hint sitting on disk.

export type RefreshResult = { applied: number; skipped?: string };

/**
 * In-flight requests, keyed by situation digest.
 *
 * The cached-hint dedupe below is not enough on its own: it checks the APPLIED
 * hint, which is still empty while the first request is in the air. 17 screens
 * call `useVascoGuidance`, and Expo Router keeps tab screens mounted — so a cold
 * start fires the effect from several of them at once and every one of those
 * calls sails past the cache check together. That is N identical paid rankings
 * and, at max 12/hour, a rate limit trip from ordinary tab switching.
 *
 * Keyed by digest rather than a single flag so a genuinely different question
 * (new day, different insight set) is never blocked behind an unrelated one.
 */
const inFlight = new Map<string, Promise<RefreshResult>>();

/**
 * Ask the backend to re-rank, then persist and apply the result.
 *
 * Every failure path is a no-op that leaves the rules' ordering in place:
 * ranking is an optimisation, and an outage must never cost a contractor their
 * insights. Returns how many weights were applied, for the developer hub.
 */
export async function refreshRankingHint(
  insights: RankableInsight[],
  context: RankingContextSignals = {},
  now: Date = new Date(),
): Promise<RefreshResult> {
  const generatorIds = insights.map((i) => i.generatorId).filter(Boolean);
  if (generatorIds.length < 3) {
    // Below three insights there is nothing to reorder that the contractor
    // cannot see at a glance — not worth a call.
    return { applied: 0, skipped: 'too few insights' };
  }
  const digest = currentSituationDigest(generatorIds, now);

  // Concurrent callers asking the SAME question share one answer.
  const pending = inFlight.get(digest);
  if (pending) return pending;

  // EVERYTHING from here — including the hydrate — lives inside `run`, and
  // `inFlight.set` happens synchronously right after. An async IIFE executes up
  // to its first await and then yields, so no other caller can interleave
  // between creating the promise and registering it.
  //
  // The first version registered AFTER `await hydrateRankingHint(...)`, which
  // defeated the guard in exactly the case it exists for: on a cold start every
  // concurrent caller sailed past the check while the first was still hydrating.
  // (My own comment claimed "register BEFORE the first await" — it was not.)
  const run = (async (): Promise<RefreshResult> => {
  // DEDUPE — the difference between one call a day and one call per screen
  // mount. `vascoGuidanceService` invokes this from an effect keyed on the
  // generator set, which re-fires on every mount and on every tab change; Expo
  // Router keeps tab screens mounted, so without this a contractor opening the
  // app five times would pay for five identical rankings.
  //
  // The digest already encodes date + day-of-week + generator set, so an
  // unchanged digest means an unchanged question, and the answer is cached.
  //
  // Checked BEFORE connectivity on purpose: an already-current hint is valid
  // whether or not the backend is reachable, and reporting "not configured"
  // over a perfectly good cached hint is misleading in exactly the offline
  // case this app is built for.
  let active = getActiveRankingHint();
  if (!active.hint) {
    // Cold start: a hint persisted earlier today is still good. Loading it here
    // means an offline launch keeps yesterday evening's ordering instead of
    // silently falling back to pure rules.
    await hydrateRankingHint(generatorIds, now);
    active = getActiveRankingHint();
  }
  if (active.hint && hintIsApplicable(active.hint, digest, now.getTime())) {
    return { applied: active.hint.weights.length, skipped: 'hint already current' };
  }

  if (!isSupabaseConfigured) return { applied: 0, skipped: 'supabase not configured' };

  try {
    const { data, error } = await supabase.functions.invoke('rank-insights', {
      body: {
        contextDigest: digest,
        context: {
          dayOfWeek: now.getDay(),
          signals: context.signals,
          country: context.country,
          trade: context.trade,
        },
        insights: insights.map((i) => ({
          generatorId: i.generatorId,
          category: i.category,
          priority: i.priority,
          magnitude: i.magnitude,
          ageDays: i.ageDays,
          confidenceBucket: confidenceBucket(i.confidence),
        })),
      },
    });

    if (error || !data?.ok || !data?.hint) {
      return { applied: 0, skipped: error?.message ?? 'no hint returned' };
    }

    const hint = data.hint as RankingHint;
    if (hint.version !== RANKING_HINT_VERSION) {
      return { applied: 0, skipped: `hint version ${hint.version} != ${RANKING_HINT_VERSION}` };
    }

    const result = applyRankingHint(hint, generatorIds, digest, now);
    if (result.applied > 0) await persistRankingHint(hint);
    if (result.rejected > 0) {
      // Not silent: a model that keeps producing rejected weights is a prompt
      // problem, and the only place it would ever surface is here.
      logWarn('Ranking', `${result.rejected} weight(s) rejected by revalidation`);
    }
    return { applied: result.applied };
  } catch (err) {
    logWarn('Ranking', `refresh failed: ${String(err).slice(0, 160)}`);
    return { applied: 0, skipped: 'exception' };
  }
  })();

  // Always clear, including on rejection — a stuck entry would block this
  // question for the rest of the session. `run` never rejects (the catch above
  // covers it), but finally is the guarantee rather than the assumption.
  inFlight.set(digest, run);
  try {
    return await run;
  } finally {
    inFlight.delete(digest);
  }
}

/** Test seam: forget any in-flight request. */
export function resetRankingInFlight(): void {
  inFlight.clear();
}

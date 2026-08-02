// =============================================================================
// SITUATIONAL RANKING — bounded LLM influence
// =============================================================================
// The claim is "a language model may nudge insight ordering but can never
// overrule evidence". That rests entirely on the clamp and the offered-id
// check, so those get the most tests.
// =============================================================================

import {
  validateRankingWeights,
  situationDigest,
  hintIsApplicable,
  MIN_MULTIPLIER,
  MAX_MULTIPLIER,
  RANKING_HINT_VERSION,
  RANKING_HINT_TTL_MS,
  type RankingHint,
} from '../ranking/rankingContract';
import {
  applyRankingHint,
  clearRankingHint,
  getSituationalMultiplier,
  getActiveRankingHint,
  currentSituationDigest,
} from '../ranking/rankingStore';

const OFFERED = ['overdue-invoice', 'margin-drift', 'cert-expiry'];
const NOW = new Date('2026-08-07T09:00:00.000Z'); // a Friday

const hint = (over: Partial<RankingHint> = {}): RankingHint => ({
  version: RANKING_HINT_VERSION,
  generatedAt: NOW.toISOString(),
  contextDigest: currentSituationDigest(OFFERED, NOW),
  provider: 'moonshot',
  weights: [{ generatorId: 'overdue-invoice', multiplier: 1.2, reason: 'VAT deadline Monday' }],
  ...over,
});

afterEach(() => clearRankingHint());

describe('the model may only weight what it was shown', () => {
  it('accepts a well-formed weight', () => {
    const r = validateRankingWeights(OFFERED, [{ generatorId: 'margin-drift', multiplier: 1.1 }]);
    expect(r.accepted).toHaveLength(1);
    expect(r.violations).toEqual([]);
  });

  it('rejects a generatorId that was never offered', () => {
    const r = validateRankingWeights(OFFERED, [{ generatorId: 'invented-generator', multiplier: 1.2 }]);
    expect(r.accepted).toEqual([]);
    expect(r.violations[0].rule).toBe('unknown_generator');
  });

  it('rejects duplicates', () => {
    const r = validateRankingWeights(OFFERED, [
      { generatorId: 'cert-expiry', multiplier: 1.1 },
      { generatorId: 'cert-expiry', multiplier: 0.9 },
    ]);
    expect(r.accepted).toHaveLength(1);
    expect(r.violations.some((v) => v.rule === 'duplicate')).toBe(true);
  });

  it('keeps the good weights when one is bad', () => {
    const r = validateRankingWeights(OFFERED, [
      { generatorId: 'margin-drift', multiplier: 1.1 },
      { generatorId: 'nope', multiplier: 1.1 },
      { generatorId: 'cert-expiry', multiplier: 0.9 },
    ]);
    expect(r.accepted.map((w) => w.generatorId)).toEqual(['margin-drift', 'cert-expiry']);
    expect(r.violations).toHaveLength(1);
  });

  it('handles junk without throwing', () => {
    expect(validateRankingWeights(OFFERED, null).violations[0].rule).toBe('not_an_array');
    expect(validateRankingWeights(OFFERED, [null, {}, { generatorId: '' }]).accepted).toEqual([]);
  });

  it('truncates an over-long reason rather than storing it whole', () => {
    const r = validateRankingWeights(OFFERED, [
      { generatorId: 'cert-expiry', multiplier: 1.0, reason: 'x'.repeat(500) },
    ]);
    expect(r.accepted[0].reason!.length).toBeLessThanOrEqual(160);
  });
});

// ---------------------------------------------------------------------------
// THE load-bearing property.
// ---------------------------------------------------------------------------
describe('influence is bounded, so evidence still wins', () => {
  it.each([5, 2, 1.36, 0.74, 0.1, -1, 0])('rejects an out-of-band multiplier %p', (m) => {
    const r = validateRankingWeights(OFFERED, [{ generatorId: 'cert-expiry', multiplier: m }]);
    expect(r.accepted).toEqual([]);
    expect(r.violations[0].rule).toBe('out_of_bounds');
  });

  it.each([MIN_MULTIPLIER, 1.0, MAX_MULTIPLIER, 1.2])('accepts an in-band multiplier %p', (m) => {
    expect(validateRankingWeights(OFFERED, [{ generatorId: 'cert-expiry', multiplier: m }]).accepted)
      .toHaveLength(1);
  });

  // Out-of-band is REJECTED, not clamped: a model asking for 5x has
  // misunderstood the task, and silently clamping would hide that.
  it('does not silently clamp', () => {
    const r = validateRankingWeights(OFFERED, [{ generatorId: 'cert-expiry', multiplier: 9 }]);
    expect(r.accepted).toEqual([]);
  });

  it('cannot reorder past a large evidence gap', () => {
    // Two insights whose rule-derived scores differ by more than the band can close.
    const strong = 0.90;
    const weak = 0.40;
    expect(weak * MAX_MULTIPLIER).toBeLessThan(strong * MIN_MULTIPLIER);
  });

  it('CAN reorder neighbours whose scores are close', () => {
    const a = 0.60;
    const b = 0.58;
    expect(b * MAX_MULTIPLIER).toBeGreaterThan(a * MIN_MULTIPLIER);
  });
});

describe('a hint is situational, so it expires', () => {
  it('is stable for the same situation', () => {
    expect(currentSituationDigest(OFFERED, NOW)).toBe(currentSituationDigest([...OFFERED].reverse(), NOW));
  });

  it('changes when the insight set changes', () => {
    expect(currentSituationDigest(OFFERED, NOW)).not.toBe(currentSituationDigest([...OFFERED, 'cash-gap'], NOW));
  });

  it('changes on a different day', () => {
    const later = new Date('2026-08-08T09:00:00.000Z');
    expect(currentSituationDigest(OFFERED, NOW)).not.toBe(currentSituationDigest(OFFERED, later));
  });

  it('rejects a hint for a different situation', () => {
    expect(hintIsApplicable(hint(), 'some-other-digest', NOW.getTime())).toBe(false);
  });

  it('rejects a hint past its TTL', () => {
    const digest = currentSituationDigest(OFFERED, NOW);
    expect(hintIsApplicable(hint(), digest, NOW.getTime() + RANKING_HINT_TTL_MS + 1)).toBe(false);
  });

  it('rejects a hint from a future clock', () => {
    expect(hintIsApplicable(hint(), currentSituationDigest(OFFERED, NOW), NOW.getTime() - 60_000)).toBe(false);
  });

  it('rejects a hint built against a different contract version', () => {
    const h = hint({ version: RANKING_HINT_VERSION + 1 });
    expect(hintIsApplicable(h, currentSituationDigest(OFFERED, NOW), NOW.getTime())).toBe(false);
  });

  it('accepts a fresh hint for the current situation', () => {
    expect(hintIsApplicable(hint(), currentSituationDigest(OFFERED, NOW), NOW.getTime())).toBe(true);
  });
});

describe('the floor never moves', () => {
  it('returns 1.0 with no hint loaded', () => {
    expect(getSituationalMultiplier('overdue-invoice')).toBe(1.0);
    expect(getSituationalMultiplier(undefined)).toBe(1.0);
  });

  it('returns 1.0 for a generator the hint has no opinion on', () => {
    applyRankingHint(hint(), OFFERED, currentSituationDigest(OFFERED, NOW), NOW);
    expect(getSituationalMultiplier('margin-drift')).toBe(1.0);
  });

  it('applies the weight for a generator it does have an opinion on', () => {
    applyRankingHint(hint(), OFFERED, currentSituationDigest(OFFERED, NOW), NOW);
    expect(getSituationalMultiplier('overdue-invoice')).toBeCloseTo(1.2, 5);
  });

  it('applies nothing when the situation has moved on', () => {
    applyRankingHint(hint(), OFFERED, 'a-different-digest', NOW);
    expect(getSituationalMultiplier('overdue-invoice')).toBe(1.0);
  });

  it('applies nothing when the hint is stale', () => {
    const old = hint({ generatedAt: new Date(NOW.getTime() - RANKING_HINT_TTL_MS - 1).toISOString() });
    applyRankingHint(old, OFFERED, currentSituationDigest(OFFERED, NOW), NOW);
    expect(getSituationalMultiplier('overdue-invoice')).toBe(1.0);
  });

  it('drops a weight whose generator no longer exists in this app version', () => {
    const h = hint({ weights: [{ generatorId: 'removed-generator', multiplier: 1.3 }] });
    const r = applyRankingHint(h, OFFERED, currentSituationDigest(OFFERED, NOW), NOW);
    expect(r.applied).toBe(0);
    expect(r.rejected).toBe(1);
  });

  it('clears back to pure rules', () => {
    applyRankingHint(hint(), OFFERED, currentSituationDigest(OFFERED, NOW), NOW);
    clearRankingHint();
    expect(getSituationalMultiplier('overdue-invoice')).toBe(1.0);
    expect(getActiveRankingHint().hint).toBeNull();
  });

  it('handles a null hint without throwing', () => {
    expect(() => applyRankingHint(null, OFFERED, 'd', NOW)).not.toThrow();
    expect(getSituationalMultiplier('overdue-invoice')).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// REGRESSION — refreshRankingHint claimed to dedupe but never checked.
// Expo Router keeps tab screens mounted, so the effect that calls it re-fires
// on every mount and tab change. Without the digest check that is one paid
// ranking call per screen open instead of one per day.
// ---------------------------------------------------------------------------
describe('an unchanged situation must not be re-asked', () => {
  it('reports the cached hint instead of calling out again', async () => {
    const { refreshRankingHint } = require('../ranking/rankingRefresh');
    const digest = currentSituationDigest(OFFERED, NOW);
    applyRankingHint(hint(), OFFERED, digest, NOW);

    const r = await refreshRankingHint(
      OFFERED.map((generatorId) => ({ generatorId })),
      {},
      NOW,
    );
    expect(r.skipped).toBe('hint already current');
    expect(r.applied).toBe(1);
  });

  it('does not short-circuit when the situation has moved on', async () => {
    const { refreshRankingHint } = require('../ranking/rankingRefresh');
    applyRankingHint(hint(), OFFERED, currentSituationDigest(OFFERED, NOW), NOW);
    // A different insight set = a different question, so the cache must not answer it.
    const r = await refreshRankingHint(
      [...OFFERED, 'cash-gap'].map((generatorId) => ({ generatorId })),
      {},
      NOW,
    );
    expect(r.skipped).not.toBe('hint already current');
  });

  it('does not call out for a trivially small insight set', async () => {
    const { refreshRankingHint } = require('../ranking/rankingRefresh');
    const r = await refreshRankingHint([{ generatorId: 'overdue-invoice' }], {}, NOW);
    expect(r.skipped).toBe('too few insights');
  });
});

// ---------------------------------------------------------------------------
// REGRESSION — concurrent callers must share one request.
// 17 screens call useVascoGuidance and Expo Router keeps tab screens mounted,
// so a cold start fires the effect from several at once. The cached-hint check
// cannot help: the cache is still empty while the first request is in the air.
// ---------------------------------------------------------------------------
describe('concurrent callers share one in-flight request', () => {
  const mockInvoke = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    mockInvoke.mockReset();
    jest.doMock('../../lib/supabase', () => ({
      isSupabaseConfigured: true,
      supabase: { functions: { invoke: mockInvoke } },
    }));
  });
  afterEach(() => jest.dontMock('../../lib/supabase'));

  it('makes ONE network call for five simultaneous identical asks', async () => {
    let resolveCall: (v: unknown) => void = () => {};
    mockInvoke.mockImplementation(() => new Promise((res) => { resolveCall = res; }));

    const { refreshRankingHint, resetRankingInFlight } = require('../ranking/rankingRefresh');
    const { clearRankingHint: clear } = require('../ranking/rankingStore');
    clear();
    resetRankingInFlight();

    const args = OFFERED.map((generatorId) => ({ generatorId }));
    const all = Promise.all([1, 2, 3, 4, 5].map(() => refreshRankingHint(args, {}, NOW)));

    // Flush enough microtasks for the winner to get past hydrate and reach the
    // network. The losers never get there at all — they are handed the winner's
    // promise synchronously.
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
    expect(mockInvoke).toHaveBeenCalledTimes(1);

    resolveCall({ data: { ok: true, hint: null }, error: null });
    await all;
  });

  it('does not block a genuinely different question behind an unrelated one', async () => {
    let pendingCount = 0;
    mockInvoke.mockImplementation(() => { pendingCount += 1; return new Promise(() => {}); });

    const { refreshRankingHint, resetRankingInFlight } = require('../ranking/rankingRefresh');
    const { clearRankingHint: clear } = require('../ranking/rankingStore');
    clear();
    resetRankingInFlight();

    refreshRankingHint(OFFERED.map((generatorId) => ({ generatorId })), {}, NOW);
    refreshRankingHint([...OFFERED, 'cash-gap'].map((generatorId) => ({ generatorId })), {}, NOW);
    for (let i = 0; i < 10; i += 1) await Promise.resolve();

    // Different digests => two distinct questions => two calls.
    expect(pendingCount).toBe(2);
  });
});

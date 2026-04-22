/**
 * @jest-environment node
 */

jest.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: { rpc: jest.fn(async () => ({ data: null, error: null })) },
}));

import {
  trainQuoteWinModel,
  scoreQuoteWin,
  isModelStale,
  FEATURE_NAMES,
  type TrainingRow,
  __internal,
} from '../quoteWinModelService';

// Helper: synthesize a separable dataset where "higher amount" → "lower
// accept probability", modulated by customer type (residential accepts more).
function syntheticRows(n: number, seed = 42): TrainingRow[] {
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const rows: TrainingRow[] = [];
  for (let i = 0; i < n; i += 1) {
    const amount = 500 + rand() * 5000;
    const isRes = rand() > 0.5;
    // log-scale price drag; residential boost.
    const logAmt = Math.log(amount);
    const z = -0.8 * (logAmt - 7.5) + (isRes ? 0.6 : -0.3) + (rand() - 0.5) * 0.3;
    const accept = 1 / (1 + Math.exp(-z)) > 0.5;
    rows.push({
      total_amount: amount,
      customer_type: isRes ? 'residential' : 'commercial',
      month_num: 1 + Math.floor(rand() * 12),
      contractor_segment: null,
      line_count: 1 + Math.floor(rand() * 8),
      was_accepted: accept,
    });
  }
  return rows;
}

describe('quoteWinModelService', () => {
  test('training on <20 samples returns null', () => {
    const rows = syntheticRows(10);
    expect(trainQuoteWinModel(rows)).toBeNull();
  });

  test('training on separable data achieves >=70% train accuracy', () => {
    const rows = syntheticRows(200);
    const result = trainQuoteWinModel(rows);
    expect(result).not.toBeNull();
    expect(result!.trainAccuracy).toBeGreaterThanOrEqual(0.7);
    // Sanity: weights exist for every feature.
    for (const f of FEATURE_NAMES) {
      expect(typeof result!.weights.weights[f]).toBe('number');
      expect(Number.isFinite(result!.weights.weights[f])).toBe(true);
    }
  });

  test('scoring returns probabilities in [0,1] and monotonic in amount', () => {
    const rows = syntheticRows(200);
    const { weights } = trainQuoteWinModel(rows)!;
    const cheap = scoreQuoteWin({ amount: 800, customerType: 'residential' }, weights);
    const expensive = scoreQuoteWin({ amount: 8000, customerType: 'residential' }, weights);
    expect(cheap.probability).toBeGreaterThanOrEqual(0);
    expect(cheap.probability).toBeLessThanOrEqual(1);
    // Higher price → lower acceptance (dataset is constructed that way).
    expect(cheap.probability).toBeGreaterThan(expensive.probability);
  });

  test('residential customer scores higher than commercial at same price', () => {
    const rows = syntheticRows(200);
    const { weights } = trainQuoteWinModel(rows)!;
    const res = scoreQuoteWin({ amount: 2500, customerType: 'residential' }, weights);
    const com = scoreQuoteWin({ amount: 2500, customerType: 'commercial' }, weights);
    expect(res.probability).toBeGreaterThan(com.probability);
  });

  test('confidence grows with training set size', () => {
    const small = trainQuoteWinModel(syntheticRows(25))!;
    const large = trainQuoteWinModel(syntheticRows(200))!;
    const a = scoreQuoteWin({ amount: 2500 }, small.weights);
    const b = scoreQuoteWin({ amount: 2500 }, large.weights);
    expect(b.confidence).toBeGreaterThanOrEqual(a.confidence);
  });

  test('isModelStale: null activatedAt → stale', () => {
    expect(isModelStale(null)).toBe(true);
    expect(isModelStale(undefined)).toBe(true);
  });

  test('isModelStale: activated 1 day ago → not stale', () => {
    const d = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(isModelStale(d)).toBe(false);
  });

  test('isModelStale: activated 10 days ago → stale', () => {
    const d = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(isModelStale(d)).toBe(true);
  });

  test('sigmoid is numerically stable at extremes', () => {
    expect(__internal.sigmoid(1000)).toBeCloseTo(1, 10);
    expect(__internal.sigmoid(-1000)).toBeCloseTo(0, 10);
    expect(__internal.sigmoid(0)).toBeCloseTo(0.5, 10);
  });

  test('featurize encodes month cyclically', () => {
    const jan = __internal.featurize({ total_amount: 1000, customer_type: null, month_num: 1 });
    const dec = __internal.featurize({ total_amount: 1000, customer_type: null, month_num: 12 });
    // Jan and Dec are adjacent on the cycle — should be close in (sin,cos) space.
    const dist = Math.hypot(jan.month_sin - dec.month_sin, jan.month_cos - dec.month_cos);
    const jul = __internal.featurize({ total_amount: 1000, customer_type: null, month_num: 7 });
    const farDist = Math.hypot(jan.month_sin - jul.month_sin, jan.month_cos - jul.month_cos);
    expect(dist).toBeLessThan(farDist);
  });

  test('R208: contractor segment one-hots exclusive, solo=baseline', () => {
    const solo = __internal.featurize({ total_amount: 1, customer_type: null, month_num: 1, contractor_segment: 'solo' });
    const small = __internal.featurize({ total_amount: 1, customer_type: null, month_num: 1, contractor_segment: 'small_team' });
    const medium = __internal.featurize({ total_amount: 1, customer_type: null, month_num: 1, contractor_segment: 'medium' });
    const large = __internal.featurize({ total_amount: 1, customer_type: null, month_num: 1, contractor_segment: 'large' });
    // Solo is the implicit baseline — all three segment flags zero.
    expect(solo.is_small_team).toBe(0);
    expect(solo.is_medium).toBe(0);
    expect(solo.is_large).toBe(0);
    // Each non-solo segment sets exactly one flag.
    expect(small.is_small_team + small.is_medium + small.is_large).toBe(1);
    expect(small.is_small_team).toBe(1);
    expect(medium.is_medium).toBe(1);
    expect(large.is_large).toBe(1);
  });

  test('R208: segment flag meaningfully shifts score when weights reflect it', () => {
    // Hand-craft a model where is_large has a strong positive weight;
    // verify scoring a large-segment quote exceeds a solo-segment one.
    const model = {
      bias: 0,
      weights: {
        log_amount: 0, month_sin: 0, month_cos: 0,
        is_residential: 0, is_commercial: 0,
        is_small_team: 0, is_medium: 0, is_large: 2.0,
      },
      featureMeans: { log_amount: 0, month_sin: 0, month_cos: 0, is_residential: 0, is_commercial: 0, is_small_team: 0, is_medium: 0, is_large: 0 },
      featureStds:  { log_amount: 1, month_sin: 1, month_cos: 1, is_residential: 1, is_commercial: 1, is_small_team: 1, is_medium: 1, is_large: 1 },
      nSamples: 50,
      trainedAt: new Date().toISOString(),
    };
    const solo = scoreQuoteWin({ amount: 1000, contractorSegment: 'solo' }, model);
    const large = scoreQuoteWin({ amount: 1000, contractorSegment: 'large' }, model);
    expect(large.probability).toBeGreaterThan(solo.probability);
  });

  test('R208: legacy 5-feature model scores without NaN on new-shape input', () => {
    // Simulate a pre-R208 persisted model — only the original 5 features.
    const legacy = {
      bias: 0.5,
      weights: { log_amount: -0.3, month_sin: 0.1, month_cos: 0.1, is_residential: 0.4, is_commercial: -0.2 } as any,
      featureMeans: { log_amount: 7, month_sin: 0, month_cos: 0, is_residential: 0.5, is_commercial: 0.5 } as any,
      featureStds: { log_amount: 1, month_sin: 0.7, month_cos: 0.7, is_residential: 0.5, is_commercial: 0.5 } as any,
      nSamples: 60,
      trainedAt: new Date().toISOString(),
    };
    const r = scoreQuoteWin({ amount: 2500, customerType: 'residential', contractorSegment: 'medium' }, legacy);
    expect(r.probability).toBeGreaterThanOrEqual(0);
    expect(r.probability).toBeLessThanOrEqual(1);
    expect(Number.isFinite(r.probability)).toBe(true);
  });
});

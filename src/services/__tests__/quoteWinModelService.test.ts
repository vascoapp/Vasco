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
});

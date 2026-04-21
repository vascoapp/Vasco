/**
 * @jest-environment node
 */

// Shape the batch-RPC response per test by mutating this variable.
let mockBatchRows: unknown = null;
let mockCalibration: unknown = null;
let mockRpcCallLog: Array<{ fn: string; args: unknown }> = [];

jest.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: jest.fn(async (fn: string, args: unknown) => {
      mockRpcCallLog.push({ fn, args });
      if (fn === 'get_line_adjustments_batch') {
        return { data: mockBatchRows, error: null };
      }
      if (fn === 'get_contractor_calibration') {
        return { data: mockCalibration, error: null };
      }
      return { data: null, error: new Error('unknown rpc ' + fn) };
    }),
  },
}));

jest.mock('../cohortBenchmarkService', () => ({
  getContractorCalibration: jest.fn(async (userId: string) => {
    mockRpcCallLog.push({ fn: 'get_contractor_calibration', args: { userId } });
    if (!mockCalibration) return null;
    const row = Array.isArray(mockCalibration) ? mockCalibration[0] : mockCalibration;
    return {
      medianPriceVsCohortPct: row.median_price_vs_cohort_pct ?? null,
      acceptanceRateVsCohortPct: row.acceptance_rate_vs_cohort_pct ?? null,
      marginVsCohortPct: row.margin_vs_cohort_pct ?? null,
      sampleSize: row.sample_size ?? 0,
      cohortSampleSize: row.cohort_sample_size ?? 0,
      confidence: row.confidence ?? 0,
      computedAt: row.computed_at ?? new Date().toISOString(),
    };
  }),
}));

import { applyCohortAdjustments, __internal } from '../pricingMoatService';

beforeEach(() => {
  mockBatchRows = null;
  mockCalibration = null;
  mockRpcCallLog = [];
});

describe('pricingMoatService.applyCohortAdjustments', () => {
  const baseOpts = { trade: 'plumbing', country: 'NL', userId: 'user-1' };

  test('empty input returns empty output without RPCs', async () => {
    const res = await applyCohortAdjustments([], baseOpts);
    expect(res.lines).toEqual([]);
    expect(res.summary.totalLines).toBe(0);
    expect(res.summary.linesAdjusted).toBe(0);
    expect(mockRpcCallLog).toEqual([]);
  });

  test('lines without cohort data are returned unchanged', async () => {
    mockBatchRows = []; // RPC returns no rows → treat as thin data
    const res = await applyCohortAdjustments(
      [{ id: 'l1', description: 'copper pipe 15mm', quantity: 10, unitPrice: 3.8 }],
      baseOpts,
    );
    expect(res.lines).toHaveLength(1);
    expect(res.lines[0].quantity).toBe(10);
    expect(res.lines[0].unitPrice).toBe(3.8);
    expect(res.lines[0].adjustmentApplied).toBe(false);
    expect(res.lines[0].originalQuantity).toBe(10);
    expect(res.summary.linesAdjusted).toBe(0);
  });

  test('applies cohort qty+price deltas when k-anonymity is satisfied', async () => {
    mockBatchRows = [
      {
        input_index: 0,
        description_like: 'copper pipe 15mm',
        sample_size: 120,
        contractor_count: 18,
        median_qty_delta_pct: 12,
        median_unit_price_delta_pct: 5,
        top_reason_code: 'waste_underestimated',
        top_reason_share: 0.65,
      },
    ];
    const res = await applyCohortAdjustments(
      [{ id: 'l1', description: 'copper pipe 15mm', quantity: 10, unitPrice: 4 }],
      baseOpts,
    );
    // qty: 10 * 1.12 = 11.2
    expect(res.lines[0].quantity).toBeCloseTo(11.2, 5);
    // price: 4 * 1.05 = 4.20
    expect(res.lines[0].unitPrice).toBeCloseTo(4.2, 5);
    expect(res.lines[0].adjustmentApplied).toBe(true);
    expect(res.lines[0].originalQuantity).toBe(10);
    expect(res.lines[0].originalUnitPrice).toBe(4);
    expect(res.lines[0].cohortContractors).toBe(18);
    expect(res.summary.linesAdjusted).toBe(1);
  });

  test('deltas beyond ±50% cap are clamped to protect against outliers', async () => {
    mockBatchRows = [
      {
        input_index: 0,
        description_like: 'weird line',
        sample_size: 50,
        contractor_count: 6,
        median_qty_delta_pct: 200, // pathological
        median_unit_price_delta_pct: -90, // pathological
        top_reason_code: null,
        top_reason_share: null,
      },
    ];
    const res = await applyCohortAdjustments(
      [{ id: 'l1', description: 'weird line', quantity: 10, unitPrice: 100 }],
      baseOpts,
    );
    // qty delta capped at +50 → 10 * 1.5 = 15
    expect(res.lines[0].quantity).toBeCloseTo(15, 5);
    // price delta capped at -50 → 100 * 0.5 = 50
    expect(res.lines[0].unitPrice).toBeCloseTo(50, 5);
    expect(res.lines[0].qtyDeltaPct).toBe(50);
    expect(res.lines[0].priceDeltaPct).toBe(-50);
  });

  test('calibration shifts price by HALF the contractor offset when confident', async () => {
    mockBatchRows = [
      {
        input_index: 0,
        description_like: 'copper pipe 15mm',
        sample_size: 50,
        contractor_count: 10,
        median_qty_delta_pct: 0,
        median_unit_price_delta_pct: 0,
        top_reason_code: null,
        top_reason_share: null,
      },
    ];
    // Contractor historically prices 10% above cohort with high confidence.
    // Service should shift baseline up by 10/2 = 5%.
    mockCalibration = [{
      median_price_vs_cohort_pct: 10,
      acceptance_rate_vs_cohort_pct: 0,
      margin_vs_cohort_pct: 0,
      sample_size: 30,
      cohort_sample_size: 100,
      confidence: 0.8,
      computed_at: new Date().toISOString(),
    }];
    const res = await applyCohortAdjustments(
      [{ id: 'l1', description: 'copper pipe 15mm', quantity: 10, unitPrice: 4 }],
      baseOpts,
    );
    // 4 * 1.05 = 4.20
    expect(res.lines[0].unitPrice).toBeCloseTo(4.2, 5);
    expect(res.summary.calibrationApplied).toBe(true);
  });

  test('low-confidence calibration is ignored', async () => {
    mockBatchRows = [
      {
        input_index: 0,
        description_like: 'copper pipe 15mm',
        sample_size: 50,
        contractor_count: 10,
        median_qty_delta_pct: 0,
        median_unit_price_delta_pct: 0,
        top_reason_code: null,
        top_reason_share: null,
      },
    ];
    mockCalibration = [{
      median_price_vs_cohort_pct: 20,
      confidence: 0.1, // below MIN
      sample_size: 5,
      cohort_sample_size: 50,
    }];
    const res = await applyCohortAdjustments(
      [{ id: 'l1', description: 'copper pipe 15mm', quantity: 10, unitPrice: 4 }],
      baseOpts,
    );
    expect(res.lines[0].unitPrice).toBeCloseTo(4, 5);
    expect(res.summary.calibrationApplied).toBe(false);
  });

  test('does not call contractor-calibration RPC when userId is missing', async () => {
    mockBatchRows = [];
    await applyCohortAdjustments(
      [{ id: 'l1', description: 'anything', quantity: 1, unitPrice: 1 }],
      { trade: 'plumbing', country: 'NL' }, // no userId
    );
    const called = mockRpcCallLog.map(r => r.fn);
    expect(called).toContain('get_line_adjustments_batch');
    expect(called).not.toContain('get_contractor_calibration');
  });

  test('dedupes RPC keys when multiple lines share the first 3 tokens', async () => {
    mockBatchRows = [];
    await applyCohortAdjustments(
      [
        { id: 'l1', description: 'copper pipe 15mm type A', quantity: 1, unitPrice: 1 },
        { id: 'l2', description: 'copper pipe 15mm type B', quantity: 2, unitPrice: 2 },
      ],
      baseOpts,
    );
    const batchCall = mockRpcCallLog.find(r => r.fn === 'get_line_adjustments_batch');
    expect(batchCall).toBeDefined();
    const keys = (batchCall!.args as { p_descriptions: string[] }).p_descriptions;
    // Both lines start with "copper pipe 15mm" — should dedupe to 1 key.
    expect(keys).toEqual(['copper pipe 15mm']);
  });

  test('clamp rejects NaN/Infinity and enforces cap', () => {
    expect(__internal.clamp(25)).toBe(25);
    expect(__internal.clamp(200)).toBe(50);
    expect(__internal.clamp(-200)).toBe(-50);
    expect(__internal.clamp(NaN)).toBe(0);
    expect(__internal.clamp(Infinity)).toBe(0);
  });

  test('tokenKey strips case, extra whitespace, and truncates to 3 tokens', () => {
    expect(__internal.tokenKey('  Copper   Pipe 15mm Extra Stuff  ')).toBe('copper pipe 15mm');
    expect(__internal.tokenKey('ONE')).toBe('one');
    expect(__internal.tokenKey('')).toBe('');
  });
});

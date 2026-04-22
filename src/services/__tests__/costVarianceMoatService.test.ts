/**
 * @jest-environment node
 */

const mockStorage = new Map<string, string>();
let mockRpcResponse: unknown = null;
let mockRpcCalls = 0;

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k: string) => (mockStorage.has(k) ? mockStorage.get(k) : null)),
  setItem: jest.fn(async (k: string, v: string) => { mockStorage.set(k, v); }),
  removeItem: jest.fn(async (k: string) => { mockStorage.delete(k); }),
}));

jest.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: jest.fn(async () => {
      mockRpcCalls += 1;
      return { data: mockRpcResponse, error: null };
    }),
  },
}));

import { getCohortCostVariance } from '../costVarianceMoatService';

beforeEach(() => {
  mockStorage.clear();
  mockRpcResponse = null;
  mockRpcCalls = 0;
});

describe('costVarianceMoatService', () => {
  test('null RPC response → null', async () => {
    mockRpcResponse = null;
    expect(await getCohortCostVariance('plumbing', 'NL')).toBeNull();
  });

  test('k-anonymity suppressed row → null percentiles', async () => {
    mockRpcResponse = [{
      median_ratio: null, avg_ratio: null,
      p25_ratio: null, p75_ratio: null, overrun_rate: null,
      sample_size: 0, contractor_count: 3,
    }];
    const r = await getCohortCostVariance('plumbing', 'NL');
    expect(r?.medianRatio).toBeNull();
    expect(r?.sampleSize).toBe(0);
    expect(r?.contractorCount).toBe(3);
  });

  test('parses populated row + 24h cache hit', async () => {
    mockRpcResponse = [{
      median_ratio: 0.95, avg_ratio: 0.98,
      p25_ratio: 0.85, p75_ratio: 1.08, overrun_rate: 0.28,
      sample_size: 140, contractor_count: 18,
    }];
    const a = await getCohortCostVariance('plumbing', 'NL');
    const b = await getCohortCostVariance('plumbing', 'NL');
    expect(a?.medianRatio).toBeCloseTo(0.95, 5);
    expect(a?.overrunRate).toBeCloseTo(0.28, 5);
    expect(mockRpcCalls).toBe(1);
    expect(b?.medianRatio).toBeCloseTo(0.95, 5);
  });

  test('per-(trade, country, job_type) cache independence', async () => {
    mockRpcResponse = [{
      median_ratio: 1, avg_ratio: 1, p25_ratio: 0.9, p75_ratio: 1.1,
      overrun_rate: 0.3, sample_size: 30, contractor_count: 8,
    }];
    await getCohortCostVariance('plumbing', 'NL');
    await getCohortCostVariance('plumbing', 'NL', 'bathroom_renovation');
    await getCohortCostVariance('electrical', 'DE');
    expect(mockRpcCalls).toBe(3);
  });
});

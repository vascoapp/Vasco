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

import { getCohortDso, __internal } from '../paymentTimingMoatService';

beforeEach(() => {
  mockStorage.clear();
  mockRpcResponse = null;
  mockRpcCalls = 0;
});

describe('paymentTimingMoatService.getCohortDso', () => {
  test('returns null when RPC returns null', async () => {
    mockRpcResponse = null;
    expect(await getCohortDso('NL')).toBeNull();
  });

  test('parses single-row response', async () => {
    mockRpcResponse = [{
      median_dso: 22,
      avg_dso: 24.5,
      on_time_rate: 0.72,
      sample_size: 120,
      contractor_count: 18,
    }];
    const r = await getCohortDso('NL', 'residential');
    expect(r?.medianDso).toBe(22);
    expect(r?.sampleSize).toBe(120);
    expect(r?.contractorCount).toBe(18);
  });

  test('24h cache hit avoids a second RPC call', async () => {
    mockRpcResponse = [{ median_dso: 22, avg_dso: 22, on_time_rate: 0.7, sample_size: 50, contractor_count: 10 }];
    await getCohortDso('NL', 'residential');
    await getCohortDso('NL', 'residential');
    expect(mockRpcCalls).toBe(1);
  });

  test('different (country, customer_type) cache independently', async () => {
    mockRpcResponse = [{ median_dso: 22, avg_dso: 22, on_time_rate: 0.7, sample_size: 50, contractor_count: 10 }];
    await getCohortDso('NL', 'residential');
    await getCohortDso('DE', 'commercial');
    expect(mockRpcCalls).toBe(2);
  });

  test('k-anonymity-gated empty response yields null-median row', async () => {
    mockRpcResponse = [{ median_dso: null, avg_dso: null, on_time_rate: null, sample_size: 0, contractor_count: 2 }];
    const r = await getCohortDso('NL');
    expect(r?.medianDso).toBeNull();
    expect(r?.sampleSize).toBe(0);
  });
});

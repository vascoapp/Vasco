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

import { getCohortDurationRatio } from '../jobDurationMoatService';

beforeEach(() => {
  mockStorage.clear();
  mockRpcResponse = null;
  mockRpcCalls = 0;
});

describe('jobDurationMoatService.getCohortDurationRatio', () => {
  test('returns null when RPC returns null', async () => {
    mockRpcResponse = null;
    expect(await getCohortDurationRatio('plumbing')).toBeNull();
  });

  test('parses single-row response', async () => {
    mockRpcResponse = [{
      median_ratio: 1.18,
      avg_ratio: 1.22,
      scope_change_rate: 0.15,
      sample_size: 80,
      contractor_count: 12,
    }];
    const r = await getCohortDurationRatio('electrical', 'rewire');
    expect(r?.medianRatio).toBeCloseTo(1.18, 5);
    expect(r?.sampleSize).toBe(80);
    expect(r?.contractorCount).toBe(12);
  });

  test('24h cache hit avoids a second RPC call', async () => {
    mockRpcResponse = [{ median_ratio: 1.1, avg_ratio: 1.2, scope_change_rate: 0.1, sample_size: 30, contractor_count: 8 }];
    await getCohortDurationRatio('plumbing');
    await getCohortDurationRatio('plumbing');
    expect(mockRpcCalls).toBe(1);
  });

  test('different (trade, jobType) cache independently', async () => {
    mockRpcResponse = [{ median_ratio: 1.1, avg_ratio: 1.2, scope_change_rate: 0.1, sample_size: 30, contractor_count: 8 }];
    await getCohortDurationRatio('plumbing', 'bathroom_renovation');
    await getCohortDurationRatio('electrical', 'rewire');
    expect(mockRpcCalls).toBe(2);
  });

  test('k-anonymity-gated empty row yields null-median', async () => {
    mockRpcResponse = [{ median_ratio: null, avg_ratio: null, scope_change_rate: null, sample_size: 0, contractor_count: 2 }];
    const r = await getCohortDurationRatio('plumbing');
    expect(r?.medianRatio).toBeNull();
    expect(r?.sampleSize).toBe(0);
  });
});

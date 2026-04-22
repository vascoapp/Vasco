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

import { getCohortAcceptLag, classifyLag } from '../quoteResponseLagMoatService';

beforeEach(() => {
  mockStorage.clear();
  mockRpcResponse = null;
  mockRpcCalls = 0;
});

describe('quoteResponseLagMoatService', () => {
  describe('classifyLag', () => {
    const bundle = {
      p25Hours: 24, medianHours: 72, p75Hours: 168, avgHours: 90,
      sampleSize: 100, contractorCount: 15, fetchedAt: '',
    };
    test('≤ p25 → fast', () => { expect(classifyLag(10, bundle)).toBe('fast'); });
    test('between p25 and median → typical', () => { expect(classifyLag(50, bundle)).toBe('typical'); });
    test('between median and p75 → slow', () => { expect(classifyLag(120, bundle)).toBe('slow'); });
    test('> p75 → overdue', () => { expect(classifyLag(300, bundle)).toBe('overdue'); });
    test('null-percentile bundle → null', () => {
      expect(classifyLag(100, { ...bundle, p25Hours: null, medianHours: null, p75Hours: null })).toBeNull();
    });
    test('missing bundle → null', () => { expect(classifyLag(100, null)).toBeNull(); });
  });

  describe('getCohortAcceptLag', () => {
    test('null RPC response → null', async () => {
      mockRpcResponse = null;
      expect(await getCohortAcceptLag('plumbing', 'NL')).toBeNull();
    });

    test('k-anonymity-suppressed row → null-percentiles', async () => {
      mockRpcResponse = [{
        p25_hours: null, median_hours: null, p75_hours: null, avg_hours: null,
        sample_size: 0, contractor_count: 2,
      }];
      const r = await getCohortAcceptLag('plumbing', 'NL');
      expect(r?.medianHours).toBeNull();
      expect(r?.sampleSize).toBe(0);
    });

    test('parses populated response + 24h cache hit', async () => {
      mockRpcResponse = [{
        p25_hours: 24, median_hours: 72, p75_hours: 168, avg_hours: 90,
        sample_size: 300, contractor_count: 22,
      }];
      const a = await getCohortAcceptLag('electrical', 'NL', 'residential');
      const b = await getCohortAcceptLag('electrical', 'NL', 'residential');
      expect(a?.medianHours).toBe(72);
      expect(a?.p75Hours).toBe(168);
      expect(a?.contractorCount).toBe(22);
      expect(mockRpcCalls).toBe(1);
      expect(b?.medianHours).toBe(72);
    });

    test('per-(trade,country,customer_type) cache independence', async () => {
      mockRpcResponse = [{
        p25_hours: 12, median_hours: 48, p75_hours: 120, avg_hours: 60,
        sample_size: 30, contractor_count: 8,
      }];
      await getCohortAcceptLag('plumbing', 'NL', 'residential');
      await getCohortAcceptLag('plumbing', 'NL', 'commercial');
      await getCohortAcceptLag('plumbing', 'DE', 'residential');
      expect(mockRpcCalls).toBe(3);
    });
  });
});

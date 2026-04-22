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

import {
  severityFor,
  directionFor,
  getMarginDrift,
} from '../marginDriftService';

beforeEach(() => {
  mockStorage.clear();
  mockRpcResponse = null;
  mockRpcCalls = 0;
});

describe('marginDriftService', () => {
  describe('severityFor', () => {
    test('medium below 5pp abs', () => {
      expect(severityFor(2)).toBe('medium');
      expect(severityFor(-4.9)).toBe('medium');
    });
    test('high at/above 5pp abs', () => {
      expect(severityFor(5)).toBe('high');
      expect(severityFor(-7)).toBe('high');
    });
  });

  describe('directionFor', () => {
    test('positive → up', () => { expect(directionFor(3)).toBe('up'); });
    test('negative → down', () => { expect(directionFor(-3)).toBe('down'); });
  });

  describe('getMarginDrift', () => {
    test('returns null when below-threshold RPC returns empty', async () => {
      mockRpcResponse = [];
      expect(await getMarginDrift('plumbing', 'NL')).toBeNull();
    });

    test('parses single-row response + caches 24h', async () => {
      mockRpcResponse = [{
        recent_median_margin: 19,
        baseline_median_margin: 23,
        drift_pp: -4,
        recent_sample_size: 120,
        baseline_sample_size: 300,
        recent_contractor_count: 14,
        baseline_contractor_count: 22,
      }];
      const a = await getMarginDrift('plumbing', 'NL');
      const b = await getMarginDrift('plumbing', 'NL');
      expect(a?.driftPp).toBeCloseTo(-4, 5);
      expect(a?.recentMedianMargin).toBe(19);
      expect(a?.baselineContractorCount).toBe(22);
      expect(mockRpcCalls).toBe(1); // second call cached
      expect(b?.driftPp).toBeCloseTo(-4, 5);
    });

    test('forceRefresh bypasses cache', async () => {
      mockRpcResponse = [{
        recent_median_margin: 19,
        baseline_median_margin: 23,
        drift_pp: -4,
        recent_sample_size: 120,
        baseline_sample_size: 300,
        recent_contractor_count: 14,
        baseline_contractor_count: 22,
      }];
      await getMarginDrift('plumbing', 'NL');
      await getMarginDrift('plumbing', 'NL', { forceRefresh: true });
      expect(mockRpcCalls).toBe(2);
    });

    test('per-(trade,country) cache independence', async () => {
      mockRpcResponse = [{
        recent_median_margin: 19,
        baseline_median_margin: 23,
        drift_pp: -4,
        recent_sample_size: 120,
        baseline_sample_size: 300,
        recent_contractor_count: 14,
        baseline_contractor_count: 22,
      }];
      await getMarginDrift('plumbing', 'NL');
      await getMarginDrift('electrical', 'DE');
      expect(mockRpcCalls).toBe(2);
    });
  });
});

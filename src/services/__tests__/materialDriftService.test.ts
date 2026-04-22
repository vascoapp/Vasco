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
  getMaterialDrift,
  __internal,
} from '../materialDriftService';

beforeEach(() => {
  mockStorage.clear();
  mockRpcResponse = null;
  mockRpcCalls = 0;
});

describe('materialDriftService', () => {
  describe('severityFor', () => {
    test('medium at 5%', () => { expect(severityFor(5)).toBe('medium'); });
    test('medium at 11%', () => { expect(severityFor(11)).toBe('medium'); });
    test('high at 12%', () => { expect(severityFor(12)).toBe('high'); });
    test('high at 30%', () => { expect(severityFor(30)).toBe('high'); });
    test('uses absolute value — high on big drop', () => { expect(severityFor(-20)).toBe('high'); });
  });

  describe('directionFor', () => {
    test('positive → up', () => { expect(directionFor(5)).toBe('up'); });
    test('negative → down', () => { expect(directionFor(-5)).toBe('down'); });
    test('zero → up (no drift surfaced at zero)', () => { expect(directionFor(0)).toBe('up'); });
  });

  describe('getMaterialDrift caching', () => {
    test('first call hits RPC, second call in TTL uses cache', async () => {
      mockRpcResponse = [
        {
          material_name: 'copper pipe 15mm',
          material_category: 'pipe_fitting',
          unit: 'meter',
          supplier_id: 'wildkamp',
          supplier_name: 'Wildkamp',
          baseline_price: 3.5,
          recent_price: 4.0,
          drift_pct: 14.3,
          recent_sample_size: 12,
          baseline_sample_size: 40,
          recent_observer_count: 5,
          is_market_wide: false,
        },
      ];
      const a = await getMaterialDrift('plumbing', 'NL');
      const b = await getMaterialDrift('plumbing', 'NL');
      expect(a.rows).toHaveLength(1);
      expect(b.rows).toHaveLength(1);
      expect(mockRpcCalls).toBe(1); // second call cached
      expect(a.rows[0].driftPct).toBeCloseTo(14.3, 5);
      expect(a.rows[0].isMarketWide).toBe(false);
    });

    test('forceRefresh skips the cache', async () => {
      mockRpcResponse = [];
      await getMaterialDrift('plumbing', 'NL');
      await getMaterialDrift('plumbing', 'NL', { forceRefresh: true });
      expect(mockRpcCalls).toBe(2);
    });

    test('different (trade,country) cache independently', async () => {
      mockRpcResponse = [];
      await getMaterialDrift('plumbing', 'NL');
      await getMaterialDrift('electrical', 'DE');
      expect(mockRpcCalls).toBe(2);
    });

    test('stale cache (older than TTL) is ignored', async () => {
      mockRpcResponse = [];
      // Plant a stale cache entry manually.
      const key = `${__internal.CACHE_KEY}:plumbing:NL`;
      const staleBundle = {
        rows: [],
        fetchedAt: new Date(Date.now() - __internal.CACHE_TTL_MS - 1000).toISOString(),
      };
      mockStorage.set(key, JSON.stringify(staleBundle));
      await getMaterialDrift('plumbing', 'NL');
      expect(mockRpcCalls).toBe(1);
    });

    test('maps market-wide flag through correctly', async () => {
      mockRpcResponse = [
        {
          material_name: 'pvc 40mm',
          material_category: null,
          unit: 'meter',
          supplier_id: 'x',
          supplier_name: 'X',
          baseline_price: 2,
          recent_price: 2.3,
          drift_pct: 15,
          recent_sample_size: 10,
          baseline_sample_size: 30,
          recent_observer_count: 4,
          is_market_wide: true,
        },
      ];
      const bundle = await getMaterialDrift('plumbing', 'NL');
      expect(bundle.rows[0].isMarketWide).toBe(true);
    });
  });

  describe('boundary constants', () => {
    test('severity thresholds are consistent', () => {
      expect(__internal.SEVERITY_MEDIUM_MIN).toBeLessThan(__internal.SEVERITY_HIGH_MIN);
    });
  });
});

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

import { getSupplierLeadTimeDrift, severityFor } from '../supplierLeadTimeMoatService';

beforeEach(() => {
  mockStorage.clear();
  mockRpcResponse = null;
  mockRpcCalls = 0;
});

describe('supplierLeadTimeMoatService', () => {
  describe('severityFor', () => {
    test('medium below 5', () => {
      expect(severityFor(2)).toBe('medium');
      expect(severityFor(-4.9)).toBe('medium');
    });
    test('high at/above 5', () => {
      expect(severityFor(5)).toBe('high');
      expect(severityFor(-10)).toBe('high');
    });
  });

  describe('getSupplierLeadTimeDrift', () => {
    test('empty RPC response → empty bundle (not null)', async () => {
      mockRpcResponse = [];
      const r = await getSupplierLeadTimeDrift('plumbing', 'NL');
      expect(r.rows).toEqual([]);
    });

    test('parses rows + 6h cache hit', async () => {
      mockRpcResponse = [{
        supplier_id: 'wildkamp',
        supplier_name: 'Wildkamp',
        baseline_days: 3,
        recent_days: 8,
        drift_days: 5,
        recent_sample_size: 12,
        baseline_sample_size: 40,
        recent_observer_count: 5,
      }];
      const a = await getSupplierLeadTimeDrift('plumbing', 'NL');
      const b = await getSupplierLeadTimeDrift('plumbing', 'NL');
      expect(a.rows).toHaveLength(1);
      expect(a.rows[0].driftDays).toBe(5);
      expect(a.rows[0].supplierName).toBe('Wildkamp');
      expect(mockRpcCalls).toBe(1);
      expect(b.rows).toHaveLength(1);
    });

    test('forceRefresh bypasses cache', async () => {
      mockRpcResponse = [];
      await getSupplierLeadTimeDrift('plumbing', 'NL');
      await getSupplierLeadTimeDrift('plumbing', 'NL', { forceRefresh: true });
      expect(mockRpcCalls).toBe(2);
    });

    test('per-(trade,country) cache independence', async () => {
      mockRpcResponse = [];
      await getSupplierLeadTimeDrift('plumbing', 'NL');
      await getSupplierLeadTimeDrift('electrical', 'DE');
      expect(mockRpcCalls).toBe(2);
    });
  });
});

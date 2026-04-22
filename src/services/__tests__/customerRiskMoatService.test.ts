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

import { getCohortOverdueRate, bandFor } from '../customerRiskMoatService';

beforeEach(() => {
  mockStorage.clear();
  mockRpcResponse = null;
  mockRpcCalls = 0;
});

describe('customerRiskMoatService', () => {
  describe('bandFor', () => {
    test('null / undefined → null', () => {
      expect(bandFor(null)).toBeNull();
      expect(bandFor(undefined)).toBeNull();
    });
    test('<20% → low', () => {
      expect(bandFor(0)).toBe('low');
      expect(bandFor(0.19)).toBe('low');
    });
    test('20–40% → medium', () => {
      expect(bandFor(0.2)).toBe('medium');
      expect(bandFor(0.39)).toBe('medium');
    });
    test('≥40% → high', () => {
      expect(bandFor(0.4)).toBe('high');
      expect(bandFor(0.7)).toBe('high');
    });
  });

  describe('getCohortOverdueRate', () => {
    test('returns null when RPC returns null', async () => {
      mockRpcResponse = null;
      expect(await getCohortOverdueRate('NL')).toBeNull();
    });

    test('parses response with null-row (k-anonymity suppressed)', async () => {
      mockRpcResponse = [{
        overdue_rate: null,
        avg_reminders_sent: null,
        avg_days_to_payment: null,
        sample_size: 0,
        contractor_count: 2,
      }];
      const r = await getCohortOverdueRate('NL');
      expect(r?.overdueRate).toBeNull();
      expect(r?.sampleSize).toBe(0);
      expect(r?.contractorCount).toBe(2);
    });

    test('parses populated response + 24h cache hit', async () => {
      mockRpcResponse = [{
        overdue_rate: 0.38,
        avg_reminders_sent: 1.4,
        avg_days_to_payment: 27,
        sample_size: 180,
        contractor_count: 16,
      }];
      const a = await getCohortOverdueRate('NL', 'commercial');
      const b = await getCohortOverdueRate('NL', 'commercial');
      expect(a?.overdueRate).toBeCloseTo(0.38, 5);
      expect(a?.avgRemindersSent).toBeCloseTo(1.4, 5);
      expect(mockRpcCalls).toBe(1);
      expect(b?.overdueRate).toBeCloseTo(0.38, 5);
    });

    test('different (country, customer_type) cache independently', async () => {
      mockRpcResponse = [{
        overdue_rate: 0.3, avg_reminders_sent: 1, avg_days_to_payment: 22,
        sample_size: 50, contractor_count: 10,
      }];
      await getCohortOverdueRate('NL', 'residential');
      await getCohortOverdueRate('DE', 'commercial');
      expect(mockRpcCalls).toBe(2);
    });
  });
});

/**
 * @jest-environment node
 */

let mockRpcResponses: Record<string, { data: unknown; error: unknown | null }> = {};
let mockRpcCalls: Array<{ fn: string; args: unknown }> = [];

jest.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: jest.fn(async (fn: string, args: unknown) => {
      mockRpcCalls.push({ fn, args });
      return mockRpcResponses[fn] ?? { data: null, error: null };
    }),
  },
}));

import {
  getOrCreateReferralCode,
  attributeReferral,
  getReferralSummary,
  __internal,
} from '../referralService';

beforeEach(() => {
  mockRpcResponses = {};
  mockRpcCalls = [];
});

describe('referralService', () => {
  describe('getOrCreateReferralCode', () => {
    test('returns minted code as string', async () => {
      mockRpcResponses['get_or_create_referral_code'] = { data: 'ABC234', error: null };
      const code = await getOrCreateReferralCode('user-1');
      expect(code).toBe('ABC234');
    });

    test('returns null on RPC error', async () => {
      mockRpcResponses['get_or_create_referral_code'] = { data: null, error: new Error('boom') };
      expect(await getOrCreateReferralCode('user-1')).toBeNull();
    });
  });

  describe('attributeReferral', () => {
    test('rejects empty/short codes locally before RPC', async () => {
      expect(await attributeReferral('', 'user-2')).toBe(false);
      expect(await attributeReferral('A1', 'user-2')).toBe(false);
      expect(mockRpcCalls).toHaveLength(0);
    });

    test('uppercases + trims the code before sending', async () => {
      mockRpcResponses['attribute_referral'] = { data: 'attrib-uuid', error: null };
      await attributeReferral('  abc234 ', 'user-2');
      const call = mockRpcCalls.find(c => c.fn === 'attribute_referral')!;
      expect((call.args as any).p_code).toBe('ABC234');
    });

    test('returns true on successful attribution', async () => {
      mockRpcResponses['attribute_referral'] = { data: 'uuid-1', error: null };
      expect(await attributeReferral('ABC234', 'user-2')).toBe(true);
    });

    test('returns false when RPC returns null (code unknown or self-refer)', async () => {
      mockRpcResponses['attribute_referral'] = { data: null, error: null };
      expect(await attributeReferral('XYZ999', 'user-2')).toBe(false);
    });
  });

  describe('getReferralSummary', () => {
    test('maps snake_case row to camelCase', async () => {
      mockRpcResponses['get_referral_summary'] = {
        data: [{
          code: 'ABC234',
          total_referrals: 5,
          pending_count: 2,
          activated_count: 2,
          credited_count: 1,
        }],
        error: null,
      };
      const s = await getReferralSummary('user-1');
      expect(s).toEqual({
        code: 'ABC234',
        totalReferrals: 5,
        pendingCount: 2,
        activatedCount: 2,
        creditedCount: 1,
      });
    });

    test('handles null row (user never minted code)', async () => {
      mockRpcResponses['get_referral_summary'] = { data: null, error: null };
      expect(await getReferralSummary('user-1')).toBeNull();
    });

    test('handles empty array (no referrals yet)', async () => {
      mockRpcResponses['get_referral_summary'] = { data: [], error: null };
      expect(await getReferralSummary('user-1')).toBeNull();
    });
  });

  describe('buildShareUrl', () => {
    test('encodes the code and points at admin.vasco.app/ref/', () => {
      expect(__internal.buildShareUrl('ABC234')).toBe('https://admin.vasco.app/ref/ABC234');
      expect(__internal.buildShareUrl('A B/C')).toBe('https://admin.vasco.app/ref/A%20B%2FC');
    });
  });
});

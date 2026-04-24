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
  getCreditsSummary,
  consumeSubscriptionCredits,
} from '../subscriptionCreditsService';

beforeEach(() => {
  mockRpcResponses = {};
  mockRpcCalls = [];
});

describe('getCreditsSummary', () => {
  test('maps snake_case row to camelCase', async () => {
    mockRpcResponses['get_credits_summary'] = {
      data: [{ total_months: 5, redeemed_months: 2, available_months: 3 }],
      error: null,
    };
    const s = await getCreditsSummary('user-1');
    expect(s).toEqual({ totalMonths: 5, redeemedMonths: 2, availableMonths: 3 });
  });

  test('null RPC response → null', async () => {
    mockRpcResponses['get_credits_summary'] = { data: null, error: null };
    expect(await getCreditsSummary('user-1')).toBeNull();
  });

  test('handles single-object response (not array)', async () => {
    mockRpcResponses['get_credits_summary'] = {
      data: { total_months: 1, redeemed_months: 0, available_months: 1 },
      error: null,
    };
    const s = await getCreditsSummary('user-1');
    expect(s?.availableMonths).toBe(1);
  });

  test('error → null', async () => {
    mockRpcResponses['get_credits_summary'] = { data: null, error: new Error('nope') };
    expect(await getCreditsSummary('user-1')).toBeNull();
  });

  test('user with no credits → zeroed row', async () => {
    mockRpcResponses['get_credits_summary'] = {
      data: [{ total_months: 0, redeemed_months: 0, available_months: 0 }],
      error: null,
    };
    const s = await getCreditsSummary('user-1');
    expect(s).toEqual({ totalMonths: 0, redeemedMonths: 0, availableMonths: 0 });
  });
});

describe('consumeSubscriptionCredits', () => {
  test('passes max_months to RPC', async () => {
    mockRpcResponses['consume_subscription_credits'] = { data: [], error: null };
    await consumeSubscriptionCredits('user-1', 3);
    const call = mockRpcCalls.find(c => c.fn === 'consume_subscription_credits')!;
    expect((call.args as any).p_max_months).toBe(3);
  });

  test('defaults max_months to 12', async () => {
    mockRpcResponses['consume_subscription_credits'] = { data: [], error: null };
    await consumeSubscriptionCredits('user-1');
    const call = mockRpcCalls.find(c => c.fn === 'consume_subscription_credits')!;
    expect((call.args as any).p_max_months).toBe(12);
  });

  test('maps returned rows to camelCase', async () => {
    mockRpcResponses['consume_subscription_credits'] = {
      data: [
        { consumed_id: 'c-1', months_free: 1, source_type: 'referral', source_id: 'attr-a' },
        { consumed_id: 'c-2', months_free: 1, source_type: 'promo', source_id: null },
      ],
      error: null,
    };
    const rows = await consumeSubscriptionCredits('user-1');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ consumedId: 'c-1', monthsFree: 1, sourceType: 'referral', sourceId: 'attr-a' });
    expect(rows[1].sourceId).toBeNull();
  });

  test('permission-denied (service-role required) → empty array, not throw', async () => {
    mockRpcResponses['consume_subscription_credits'] = { data: null, error: new Error('permission denied') };
    expect(await consumeSubscriptionCredits('user-1')).toEqual([]);
  });

  test('non-array data → empty array', async () => {
    mockRpcResponses['consume_subscription_credits'] = { data: null, error: null };
    expect(await consumeSubscriptionCredits('user-1')).toEqual([]);
  });
});

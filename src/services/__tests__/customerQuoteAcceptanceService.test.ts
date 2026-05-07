/**
 * @jest-environment node
 *
 * R66 round 20 — customer quote acceptance service.
 * Verifies the BE-primary flow: createAcceptanceLink writes via dataProvider,
 * processAcceptance reads + decides via dataProvider, AsyncStorage cache
 * stays in sync. Token entropy bumped to 32 hex chars (128 bits).
 */

jest.mock('@react-native-async-storage/async-storage', () => {
  const mockStore: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => (k in mockStore ? mockStore[k] : null)),
      setItem: jest.fn(async (k: string, v: string) => { mockStore[k] = v; }),
      removeItem: jest.fn(async (k: string) => { delete mockStore[k]; }),
      __mockStore: mockStore,
    },
  };
});

jest.mock('../../lib/supabase', () => ({
  __esModule: true,
  isSupabaseConfigured: true,
  supabase: {
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'u-1' } } })) },
    from: jest.fn(),
  },
}));

const mockBE = {
  rows: new Map<string, any>(),
};

jest.mock('../../lib/dataProvider', () => ({
  __esModule: true,
  createAcceptanceLink: jest.fn(async (payload: any) => {
    const row = {
      ...payload,
      customer_id: payload.customer_id ?? null,
      customer_name: payload.customer_name ?? null,
      quote_description: payload.quote_description ?? null,
      status: 'pending',
      decline_reason: null,
      created_at: new Date().toISOString(),
      responded_at: null,
    };
    mockBE.rows.set(payload.token, row);
    return row;
  }),
  getAcceptanceLinkByToken: jest.fn(async (token: string) => mockBE.rows.get(token) ?? null),
  getAcceptanceLinkByQuoteId: jest.fn(async (quoteId: string) => {
    for (const row of mockBE.rows.values()) {
      if (row.quote_id === quoteId) return row;
    }
    return null;
  }),
  decideAcceptanceLink: jest.fn(async (token: string, decision: string, reason?: string) => {
    const row = mockBE.rows.get(token);
    if (!row) return null;
    row.status = decision;
    row.responded_at = new Date().toISOString();
    if (reason) row.decline_reason = reason;
    return row;
  }),
}));

beforeEach(() => {
  mockBE.rows.clear();
});

describe('customerQuoteAcceptanceService — R66 round 20', () => {
  test('generated tokens are 32 hex chars (128 bits)', async () => {
    const { createAcceptanceLink } = require('../customerQuoteAcceptanceService');
    const result = await createAcceptanceLink({ id: 'Q-1', amount: 500 });
    expect(result.token).toMatch(/^[0-9a-f]{32}$/);
  });

  test('createAcceptanceLink writes BE-primary, returns canonical link', async () => {
    const { createAcceptanceLink } = require('../customerQuoteAcceptanceService');
    const result = await createAcceptanceLink({
      id: 'Q-100',
      customerName: 'Acme BV',
      amount: 1500,
    });
    expect(result.link.status).toBe('pending');
    expect(result.link.quoteAmount).toBe(1500);
    expect(mockBE.rows.has(result.token)).toBe(true);
  });

  test('createAcceptanceLink nulls non-uuid customer for FK safety (R18 pattern)', async () => {
    const { createAcceptanceLink } = require('../customerQuoteAcceptanceService');
    const result = await createAcceptanceLink({
      id: 'Q-101',
      customer: 'Klant', // FE display string, not a uuid
      amount: 200,
    });
    const row = mockBE.rows.get(result.token);
    expect(row.customer_id).toBeNull();
  });

  test('createAcceptanceLink keeps real uuid customer_id', async () => {
    const { createAcceptanceLink } = require('../customerQuoteAcceptanceService');
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';
    const result = await createAcceptanceLink({
      id: 'Q-102',
      customer: validUuid,
      amount: 200,
    });
    const row = mockBE.rows.get(result.token);
    expect(row.customer_id).toBe(validUuid);
  });

  test('processAcceptance reads + decides via BE — cross-device path', async () => {
    const { createAcceptanceLink, processAcceptance } = require('../customerQuoteAcceptanceService');
    const { token } = await createAcceptanceLink({ id: 'Q-200', amount: 750 });
    // Simulate the customer's device: AsyncStorage is empty for this token
    // (the cache was on the contractor's device, not the customer's). The
    // BE-primary path is what makes this case work — pre-R20 it returned
    // 'Invalid link' here.
    const result = await processAcceptance(token);
    expect(result.success).toBe(true);
    expect(result.link?.status).toBe('accepted');
    expect(mockBE.rows.get(token)?.status).toBe('accepted');
  });

  test('processAcceptance returns invalid link for unknown token', async () => {
    const { processAcceptance } = require('../customerQuoteAcceptanceService');
    const result = await processAcceptance('00000000000000000000000000000000');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid link');
  });

  test('processAcceptance refuses already-decided link', async () => {
    const { createAcceptanceLink, processAcceptance } = require('../customerQuoteAcceptanceService');
    const { token } = await createAcceptanceLink({ id: 'Q-300', amount: 300 });
    await processAcceptance(token);
    const second = await processAcceptance(token);
    expect(second.success).toBe(false);
    expect(second.error).toMatch(/already accepted/);
  });

  test('rejectAcceptance writes decline_reason via BE', async () => {
    const { createAcceptanceLink, rejectAcceptance } = require('../customerQuoteAcceptanceService');
    const { token } = await createAcceptanceLink({ id: 'Q-400', amount: 400 });
    const result = await rejectAcceptance(token, 'price_too_high');
    expect(result.success).toBe(true);
    expect(mockBE.rows.get(token)?.status).toBe('rejected');
    expect(mockBE.rows.get(token)?.decline_reason).toBe('price_too_high');
  });
});

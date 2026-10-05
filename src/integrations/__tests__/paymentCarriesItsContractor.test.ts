/**
 * A payment carries the contractor it belongs to (sweep A7, 2026-10-05).
 *
 * The webhook only gets `metadata.invoiceId`, which is the app's document
 * NUMBER — unique per contractor, not across them. Without the contractor's
 * user id it cannot safely find the invoice (supabase/functions/_shared/
 * invoiceRef.ts), so a paid invoice was never marked paid.
 */
const U = 'aaaaaaaa-1111-4111-8111-000000000001';
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(), removeItem: jest.fn() },
}));
jest.mock('../../lib/secureStorage', () => ({
  getSecureItem: jest.fn(async () => JSON.stringify({ apiKey: 'test_x', userId: 'aaaaaaaa-1111-4111-8111-000000000001' })),
  setSecureItem: jest.fn(async () => {}), deleteSecureItem: jest.fn(async () => {}), migrateToSecure: jest.fn(async () => {}),
}));
const mockFetch = jest.fn(async (_url: string, _init: any) => ({
  ok: true, status: 201,
  json: async () => ({ id: 'tr_1', _links: { checkout: { href: 'https://pay' } } }),
  text: async () => '',
}));
jest.mock('../../utils/retry', () => ({ fetchWithRetry: (u: string, i: any) => mockFetch(u, i) }));

import { createPayment } from '../mollie';
import { setCurrentUser } from '../../lib/currentUser';

afterEach(() => setCurrentUser(null));

it('the Mollie payment metadata names the invoice AND the contractor', async () => {
  setCurrentUser({ id: U, country: 'NL' });
  await createPayment({ amount: 121, description: 'RE-2026-0001', invoiceId: 'RE-2026-0001', redirectUrl: 'https://x', webhookUrl: 'https://w' } as any);
  const body = JSON.parse(mockFetch.mock.calls[0][1].body);
  expect(body.metadata).toEqual({ invoiceId: 'RE-2026-0001', userId: U });
});

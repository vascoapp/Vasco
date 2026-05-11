/**
 * @jest-environment node
 *
 * R66r57: validateConnection() roundtrips the stored Stripe key against
 * /v1/balance instead of just checking SecureStore. This is what the
 * connect modal calls before flipping to "Connected ✓".
 */

const mockSecureStore = new Map<string, string>();
jest.mock('../../lib/secureStorage', () => ({
  getSecureItem: jest.fn(async (key: string) => mockSecureStore.get(key) ?? null),
  setSecureItem: jest.fn(async (key: string, value: string) => {
    mockSecureStore.set(key, value);
  }),
  deleteSecureItem: jest.fn(async (key: string) => {
    mockSecureStore.delete(key);
  }),
  migrateToSecure: jest.fn(async () => undefined),
}));

jest.mock('../../services/singletonReset', () => ({
  registerSingletonReset: () => () => undefined,
}));

const fetchMock = jest.fn();
(global as any).fetch = fetchMock;

import { saveStripeConfig, validateConnection } from '../stripe';

beforeEach(() => {
  mockSecureStore.clear();
  fetchMock.mockReset();
});

describe('validateConnection', () => {
  test('returns false when no key is stored', async () => {
    expect(await validateConnection()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('returns true on 200 from /v1/balance', async () => {
    await saveStripeConfig({ apiKey: 'sk_test_valid' });
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });
    expect(await validateConnection()).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/v1/balance');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk_test_valid');
  });

  test('returns false on 401 (invalid key)', async () => {
    await saveStripeConfig({ apiKey: 'sk_live_typo' });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
    expect(await validateConnection()).toBe(false);
  });

  test('returns false on network error', async () => {
    await saveStripeConfig({ apiKey: 'sk_test_offline' });
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    expect(await validateConnection()).toBe(false);
  });
});

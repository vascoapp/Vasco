/**
 * @jest-environment node
 *
 * R66r55: payment-provider disconnect hygiene.
 *
 * - clearMollieConfig / clearStripeConfig wipe SecureStore entries.
 * - Each module also registers a singletonReset callback so userChange
 *   (login/logout) wipes the key even without a UI button press.
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

jest.mock('../../services/singletonReset', () => {
  const list: Array<(uid: string | null) => void> = [];
  (globalThis as any).__mockResetters = list;
  return {
    registerSingletonReset: (fn: (uid: string | null) => void) => {
      list.push(fn);
      return () => {
        const idx = list.indexOf(fn);
        if (idx >= 0) list.splice(idx, 1);
      };
    },
  };
});

const mockResetters: Array<(uid: string | null) => void> =
  (globalThis as any).__mockResetters as Array<(uid: string | null) => void>;

import * as mollie from '../mollie';
import * as stripe from '../stripe';

beforeEach(() => {
  mockSecureStore.clear();
});

describe('mollie disconnect', () => {
  test('clearMollieConfig removes the stored key', async () => {
    await mollie.saveMollieConfig({ apiKey: 'test_abc' });
    expect(await mollie.isConnected()).toBe(true);
    await mollie.clearMollieConfig();
    expect(await mollie.isConnected()).toBe(false);
  });

  test('singletonReset callback wipes secure storage on logout', async () => {
    await mollie.saveMollieConfig({ apiKey: 'test_xyz' });
    expect(await mollie.isConnected()).toBe(true);

    // Fire every resetter exactly once with userId=null (logout).
    mockResetters.forEach((fn) => fn(null));
    // Wait one tick for the void-promise inside the resetter to settle.
    await new Promise((r) => setImmediate(r));

    expect(await mollie.isConnected()).toBe(false);
  });
});

describe('stripe disconnect', () => {
  test('clearStripeConfig removes the stored key', async () => {
    await stripe.saveStripeConfig({ apiKey: 'sk_test_abc' });
    expect(await stripe.isConnected()).toBe(true);
    await stripe.clearStripeConfig();
    expect(await stripe.isConnected()).toBe(false);
  });

  test('singletonReset wipes the stripe key on userChange', async () => {
    await stripe.saveStripeConfig({ apiKey: 'sk_test_xyz' });
    expect(await stripe.isConnected()).toBe(true);
    mockResetters.forEach((fn) => fn(null));
    await new Promise((r) => setImmediate(r));
    expect(await stripe.isConnected()).toBe(false);
  });
});

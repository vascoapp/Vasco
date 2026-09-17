/**
 * @jest-environment node
 */
// A payment credential must survive a RESTART and must never reach the next
// account on the device.
//
// Both halves were wrong at once. Mollie and Stripe deleted their stored key on
// every user CHANGE — and a cold start is one, because `currentUserId` starts
// as the 'current-user' placeholder and becomes the real id when AuthContext
// restores the session. So the contractor's own key was thrown away on every
// launch and the invoice screen quietly went back to "connect Mollie".
// Moneybird had the opposite bug (`moneybirdPersonalToken.test.ts`): one
// device-wide key that nothing dropped, so the NEXT account inherited it.
const mockStore = new Map<string, string>();
jest.mock('../../lib/secureStorage', () => ({
  getSecureItem: jest.fn(async (k: string) => mockStore.get(k) ?? null),
  setSecureItem: jest.fn(async (k: string, v: string) => { mockStore.set(k, v); }),
  deleteSecureItem: jest.fn(async (k: string) => { mockStore.delete(k); }),
  migrateToSecure: jest.fn(async () => {}),
}));

import { saveMollieConfig, isConnected as isMollieConnected } from '../mollie';
import { setCurrentUser } from '../../lib/currentUser';

const settle = () => new Promise((r) => setTimeout(r, 20));

describe('the Mollie key survives a cold start', () => {
  beforeEach(() => { mockStore.clear(); setCurrentUser(null); });
  afterAll(() => { setCurrentUser(null); });

  it('is still there when the placeholder resolves to the same account', async () => {
    // A cold start is NOT a logout: the app launches with the 'current-user'
    // placeholder and AuthContext restores the session, so the id changes once,
    // from placeholder to the same account whose key is already stored.
    setCurrentUser({ id: 'user-A' });
    // Let the reset that the sign-in fires finish before writing, or it races
    // the save it was never meant to touch.
    await settle();
    await saveMollieConfig({ apiKey: 'live_A' });
    expect(JSON.parse(mockStore.get('vasco_mollie') ?? '{}').userId).toBe('user-A');

    // Back to the placeholder WITHOUT touching storage — that is the state a
    // freshly launched process is in.
    const stored = mockStore.get('vasco_mollie') as string;
    setCurrentUser(null);
    await settle();
    mockStore.set('vasco_mollie', stored);

    setCurrentUser({ id: 'user-A' });
    await settle();

    await expect(isMollieConnected()).resolves.toBe(true);
  });

  it('is dropped when a DIFFERENT account signs in', async () => {
    setCurrentUser({ id: 'user-A' });
    await settle();
    await saveMollieConfig({ apiKey: 'live_A' });

    setCurrentUser({ id: 'user-B' });
    await settle();

    expect(mockStore.has('vasco_mollie')).toBe(false);
    await expect(isMollieConnected()).resolves.toBe(false);
  });

  it('is not readable by another account even before the reset has run', async () => {
    // The reset is async. In the window between a sign-in and the delete, a
    // read must still refuse a credential belonging to someone else.
    mockStore.set('vasco_mollie', JSON.stringify({ apiKey: 'live_A', userId: 'user-A' }));
    setCurrentUser({ id: 'user-B' });
    await expect(isMollieConnected()).resolves.toBe(false);
  });

  it('refuses a config stored before the owner field existed', async () => {
    mockStore.set('vasco_mollie', JSON.stringify({ apiKey: 'live_legacy' }));
    setCurrentUser({ id: 'user-D' });
    await expect(isMollieConnected()).resolves.toBe(false);
  });
});

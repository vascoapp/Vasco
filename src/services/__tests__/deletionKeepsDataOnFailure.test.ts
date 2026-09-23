/**
 * @jest-environment node
 *
 * A deletion request that never reached the server must not wipe the phone
 * (sweep 2026-09-23, B6). It used to clear every local key — unsynced writes
 * and photos included — and sign out, while the screen said "try again".
 */
const mockStore = new Map<string, string>([['@vasco_offline_writes', '[{"id":"w1"}]'], ['@vasco_pricebook', '[]']]);
let mockInsertError: any = null;
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => mockStore.get(k) ?? null),
    setItem: jest.fn(async (k: string, v: string) => { mockStore.set(k, v); }),
    removeItem: jest.fn(async (k: string) => { mockStore.delete(k); }),
    getAllKeys: jest.fn(async () => [...mockStore.keys()]),
    multiRemove: jest.fn(async (ks: string[]) => { ks.forEach((k) => mockStore.delete(k)); }),
    clear: jest.fn(async () => { mockStore.clear(); }),
  },
}));
jest.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: () => ({ insert: async () => ({ error: mockInsertError }) }),
    auth: { signOut: async () => ({}) },
  },
}));

import { requestAccountDeletion } from '../accountDeletionService';

describe('account deletion keeps the phone when the request failed', () => {
  it('a failed server request wipes nothing', async () => {
    mockInsertError = { code: 'PGRST301', message: 'offline' };
    const r = await requestAccountDeletion('11111111-1111-1111-1111-111111111111');
    expect(r.serverRequested).toBe(false);
    expect(r.success).toBe(false);
    expect(mockStore.get('@vasco_offline_writes')).toBeDefined();
  });

  it('a request that reached the server does wipe the phone', async () => {
    mockInsertError = null;
    const r = await requestAccountDeletion('11111111-1111-1111-1111-111111111111');
    expect(r.serverRequested).toBe(true);
    expect(mockStore.has('@vasco_offline_writes')).toBe(false);
  });
});

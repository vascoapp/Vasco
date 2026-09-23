/**
 * @jest-environment node
 *
 * Logout keeps device-only business data, owned; a DIFFERENT contractor
 * signing in wipes it (sweep 2026-09-23, A4). Logout used to wipe the
 * pricebook (the hourly rate billing uses), agreements, templates and every
 * unsynced write — logging straight back in as the same user lost it all.
 */
const mockStore = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => mockStore.get(k) ?? null),
    setItem: jest.fn(async (k: string, v: string) => { mockStore.set(k, v); }),
    removeItem: jest.fn(async (k: string) => { mockStore.delete(k); }),
    getAllKeys: jest.fn(async () => [...mockStore.keys()]),
    multiRemove: jest.fn(async (ks: string[]) => { ks.forEach((k) => mockStore.delete(k)); }),
  },
}));
jest.mock('../pendingJobPhotosQueue', () => ({ clearAll: jest.fn(async () => { mockStore.delete('@vasco_pending_job_photos'); }) }));

import { clearUserScopedStorage, claimDeviceData, deviceDataBelongsTo } from '../sessionCleanup';

const A = 'aaaaaaaa-0000-0000-0000-000000000001';
const B = 'bbbbbbbb-0000-0000-0000-000000000002';

function seed() {
  mockStore.clear();
  mockStore.set('@vasco_pricebook', '[{"id":"hour","basePrice":65}]');
  mockStore.set('@vasco_offline_writes', '[{"id":"w1"}]');
  mockStore.set('@vasco_service_agreements', '[{"id":"ag1"}]');
  mockStore.set('@vasco_ai_queue', '[{"id":"card"}]');      // regenerated — wiped
  mockStore.set('@vasco_invoices', '[{"id":"inv"}]');        // server-backed cache — wiped
  mockStore.set('@vasco_device_id', 'dev-1');               // device — kept
}

describe('logout keeps device-only data; a different user wipes it', () => {
  beforeEach(seed);

  it('logout keeps the pricebook, agreements and unsynced writes, and records the owner', async () => {
    await clearUserScopedStorage(A);
    expect(mockStore.get('@vasco_pricebook')).toBeDefined();
    expect(mockStore.get('@vasco_offline_writes')).toBeDefined();
    expect(mockStore.get('@vasco_service_agreements')).toBeDefined();
    expect(mockStore.get('@vasco_device_data_owner')).toBe(A);
    expect(mockStore.has('@vasco_ai_queue')).toBe(false);
    expect(mockStore.has('@vasco_invoices')).toBe(false);
    expect(mockStore.get('@vasco_device_id')).toBe('dev-1');
  });

  it('the SAME contractor signing back in keeps it all', async () => {
    await clearUserScopedStorage(A);
    await claimDeviceData(A);
    expect(mockStore.get('@vasco_pricebook')).toContain('65');
    expect(mockStore.get('@vasco_offline_writes')).toBeDefined();
    expect(await deviceDataBelongsTo(A)).toBe(true);
  });

  it('a DIFFERENT contractor gets none of it, and cannot upload it before the claim', async () => {
    await clearUserScopedStorage(A);
    expect(await deviceDataBelongsTo(B)).toBe(false);   // queues wait
    await claimDeviceData(B);
    expect(mockStore.has('@vasco_pricebook')).toBe(false);
    expect(mockStore.has('@vasco_offline_writes')).toBe(false);
    expect(mockStore.has('@vasco_service_agreements')).toBe(false);
    expect(mockStore.get('@vasco_device_data_owner')).toBe(B);
  });

  it('nobody signed in never uploads', async () => {
    expect(await deviceDataBelongsTo(null)).toBe(false);
  });
});

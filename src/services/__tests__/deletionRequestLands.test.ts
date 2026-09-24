/**
 * @jest-environment node
 *
 * The deletion request must LAND against the live schema. It sent a
 * `platform` key the table never had, so PostgREST rejected every request
 * (PGRST204) — invisible to the older test, whose mock insert accepted
 * anything (review 2026-09-24).
 */
const OWNER = '22222222-2222-4222-8222-222222222222';
jest.mock('../../lib/supabase', () => require('../../test-utils/fakeSupabase').fakeSupabaseModule({ userId: '22222222-2222-4222-8222-222222222222' }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: async () => null, setItem: async () => undefined, removeItem: async () => undefined,
    getAllKeys: async () => [], multiRemove: async () => undefined, clear: async () => undefined,
  },
}));

import { requestAccountDeletion } from '../accountDeletionService';
const fake = require('../../lib/supabase').__fake;

it('writes one pending request row the drain worker can pick up', async () => {
  const r = await requestAccountDeletion(OWNER);
  const insertErrors = fake.calls.filter((c: any) => c.table === 'account_deletion_requests' && c.error);
  expect(insertErrors).toEqual([]);
  expect(r.serverRequested).toBe(true);
  const rows = fake.rows('account_deletion_requests');
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ user_id: OWNER, status: 'pending' });
});

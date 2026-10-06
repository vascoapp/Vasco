/**
 * @jest-environment node
 */
// An offline accept of a quote the customer had ALREADY accepted in the portal
// (W119 review). decide_acceptance_link made the job server-side; the device's
// queued insert for the same quote is refused by jobs (user_id, quote_id)
// UNIQUE. It used to count as a rejection and be dropped after five tries —
// with the local temp job never resolved and every write queued against its
// temp id lost. It now ADOPTS the server's row: the temp id maps onto it.
const store: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k: string) => store[k] ?? null),
  setItem: jest.fn(async (k: string, v: string) => { store[k] = v; }),
  removeItem: jest.fn(async (k: string) => { delete store[k]; }),
}));
const UID = '11111111-1111-4111-8111-111111111111';
jest.mock('../../lib/currentUser', () => ({
  ...jest.requireActual('../../lib/currentUser'),
  getAuthedUserId: () => '11111111-1111-4111-8111-111111111111',
}));
jest.mock('../../lib/supabase', () => require('../../test-utils/fakeSupabase').fakeSupabaseModule({ userId: '11111111-1111-4111-8111-111111111111' }));

import type { FakeSupabase } from '../../test-utils/fakeSupabase';

it('a queued job for an already-accepted quote adopts the server job; its children follow', async () => {
  const fake = require('../../lib/supabase').__fake as FakeSupabase;
  fake.seed('jobs', [{ user_id: UID, title: 'Sostituzione miscelatore', status: 'scheduled', quote_id: 'Q0001' }]);
  const serverJobId = fake.rows('jobs')[0].id;

  const { queueWrite, flushQueue, queueSize } = require('../offlineWriteQueue');
  await queueWrite({ table: 'jobs', op: 'insert', payload: { id: 'j-1791300000000', user_id: UID, title: 'Sostituzione miscelatore', status: 'scheduled', quote_id: 'Q0001' } });
  await queueWrite({ table: 'jobs', op: 'update', rowId: 'j-1791300000000', payload: { site_contact: 'Portiere' } });

  await flushQueue();

  const jobs = fake.rows('jobs').filter((j) => j.quote_id === 'Q0001');
  expect(jobs).toHaveLength(1);
  expect(jobs[0].id).toBe(serverJobId);
  // The child write, queued against the temp id, landed on the adopted row.
  expect(jobs[0].site_contact).toBe('Portiere');
  expect(await queueSize()).toBe(0);
});

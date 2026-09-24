/**
 * Product analytics reach the backend, against the LIVE table's rules.
 *
 * flushEvents inserted into `analytics_events`, a table that did not exist
 * (42P01, swallowed) — no event ever arrived. Migration 20260924000001 made
 * it: insert-only, and only a user's OWN events (or anonymous ones). Runs on
 * the fake backend with that migration in its schema snapshot and RLS on.
 */
import type { FakeSupabase } from '../../test-utils/fakeSupabase';

const ME = 'aaaaaaaa-1111-4111-8111-000000000001';
jest.mock('../../lib/supabase', () => require('../../test-utils/fakeSupabase').fakeSupabaseModule({ userId: 'aaaaaaaa-1111-4111-8111-000000000001' }));
jest.mock('../../lib/currentUser', () => ({
  ...jest.requireActual('../../lib/currentUser'),
  getAuthedUserId: () => mockAuthed,
}));
let mockAuthed: string | null = 'aaaaaaaa-1111-4111-8111-000000000001';
jest.mock('../consentService', () => ({ consentService: { getConsent: async () => true } }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { trackEvent, flushEvents, setUserContext } from '../eventTrackingService';

const fake = require('../../lib/supabase').__fake as FakeSupabase;

beforeEach(async () => { await AsyncStorage.clear(); fake.reset(); mockAuthed = ME; });

it('events land in analytics_events and are marked flushed', async () => {
  setUserContext?.({ userId: ME, role: 'contractor', country: 'DE' } as any);
  await trackEvent('quote_sent' as any, { count: 1 });
  await trackEvent('invoice_sent' as any, {});
  const n = await flushEvents();
  expect(n).toBe(2);
  expect(fake.rows('analytics_events').map((r) => r.name).sort()).toEqual(['invoice_sent', 'quote_sent']);
  expect(fake.rows('analytics_events')[0].user_id).toBe(ME);
  expect(fake.calls.filter((c) => c.error)).toEqual([]);
});

it("an event recorded under a PREVIOUS account is sent anonymous, not refused forever", async () => {
  setUserContext?.({ userId: 'bbbbbbbb-2222-4222-8222-000000000002', role: 'contractor' } as any);
  await trackEvent('job_created' as any, {});
  expect(await flushEvents()).toBe(1);
  expect(fake.rows('analytics_events')[0].user_id).toBeNull();
});

it('a demo id (not a uuid) is sent anonymous', async () => {
  setUserContext?.({ userId: 'demo-contractor', role: 'contractor' } as any);
  await trackEvent('job_created' as any, {});
  expect(await flushEvents()).toBe(1);
  expect(fake.rows('analytics_events')[0].user_id).toBeNull();
});

it('nobody signed in → nothing is sent (the table is for signed-in users)', async () => {
  mockAuthed = null;
  await trackEvent('login' as any, {});
  expect(await flushEvents()).toBe(0);
  expect(fake.rows('analytics_events')).toHaveLength(0);
});

it('a batch retried after a partial success delivers the rest (duplicate ids are not a failure)', async () => {
  setUserContext?.({ userId: ME, role: 'contractor' } as any);
  await trackEvent('quote_sent' as any, {});
  await trackEvent('invoice_sent' as any, {});
  // The first event already landed in an earlier, interrupted flush.
  const stored = JSON.parse((await AsyncStorage.getItem('@vasco_analytics_events'))!);
  fake.seed('analytics_events', [{ id: stored[0].id, name: stored[0].name, timestamp: new Date().toISOString() }]);
  expect(await flushEvents()).toBe(2);
  expect(fake.rows('analytics_events')).toHaveLength(2);
});

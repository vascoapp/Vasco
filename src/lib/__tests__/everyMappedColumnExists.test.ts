/**
 * Every column the app's update mappers can emit exists in the LIVE schema,
 * and the real dataProvider write goes through. A Row field that is not a
 * column makes PostgREST reject the WHOLE write (PGRST204) — the edit is lost
 * and, behind a swallowed error, nobody sees it. Runs on the fake backend
 * (src/test-utils/fakeSupabase.ts), whose schema is a snapshot of production
 * (convergence plan P0.3).
 *
 * The mappers read `'x' in updates` / `updates[x] !== undefined`, so a Proxy
 * that claims to have EVERY field drives every branch — a new mapped field is
 * covered the day it is added.
 */
import type { FakeSupabase } from '../../test-utils/fakeSupabase';

jest.mock('../supabase', () => require('../../test-utils/fakeSupabase').fakeSupabaseModule());
const mockFake = require('../supabase').__fake as FakeSupabase;

import { customerUpdatesToRowPayload, jobUpdatesToRowPayload, projectUpdatesToRowPayload } from '../mappers';
import { updateCustomer, updateJob, updateProject } from '../dataProvider';

/** Pretends to hold every field, with a plausible value by name. */
const everyField = () => new Proxy({}, {
  has: () => true,
  get: (_t, k) => {
    const key = String(k);
    if (/At$|Date$|date$/.test(key)) return '2026-09-24T10:00:00.000Z';
    if (/(amount|price|hours|rate|quantity|count|days|budget|percent|progress|minutes)/i.test(key)) return 1;
    if (/^(is|has)[A-Z]|enabled|Signoff$/.test(key)) return true;
    if (/(entries|items|photos|materials|tags|checklist|notes)$/i.test(key)) return [];
    if (key === 'status') return 'scheduled';
    if (key === 'address') return { street: 'Hauptstr. 1', city: 'Köln', postcode: '50667' };
    return 'x';
  },
}) as any;

function unknownColumns(table: string, payload: Record<string, unknown>) {
  const cols = new Set(mockFake.columns(table));
  return Object.keys(payload).filter((k) => !cols.has(k));
}

describe('every column the update mappers emit exists in production', () => {
  it.each([
    ['customers', () => customerUpdatesToRowPayload(everyField())],
    ['jobs', () => jobUpdatesToRowPayload(everyField())],
    ['projects', () => projectUpdatesToRowPayload(everyField())],
  ])('%s', (table, build) => {
    const payload = (build as () => Record<string, unknown>)();
    expect(Object.keys(payload).length).toBeGreaterThan(3); // the proxy reached the branches
    expect(unknownColumns(table as string, payload)).toEqual([]);
  });

  it('and the real writes go through the fake backend', async () => {
    mockFake.seed('customers', [{ id: 'c0000000-0000-4000-8000-000000000001', name: 'A' }]);
    mockFake.seed('jobs', [{ id: 'j0000000-0000-4000-8000-000000000001', title: 'J', status: 'scheduled' }]);
    await expect(updateCustomer('c0000000-0000-4000-8000-000000000001', customerUpdatesToRowPayload(everyField()) as any)).resolves.toBeTruthy();
    await expect(updateJob('j0000000-0000-4000-8000-000000000001', jobUpdatesToRowPayload(everyField()) as any)).resolves.not.toThrow;
  });
});

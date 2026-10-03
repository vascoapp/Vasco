/**
 * getPriceReference read the VIEW price_references, which the signed-in role
 * cannot read (owner-only on purpose, 20261002000002: the view runs as its
 * owner and lists every contractor's prices). Every call failed with 42501 and
 * the reference was never shown. It now calls get_my_price_reference
 * (20261003000001), which returns the caller's own row only — the ownership
 * itself is proven in SQL (rolled-back trial, see learnings "agent batch B").
 *
 * The fake backend carries the LIVE grants, so the old read fails here exactly
 * as it does in production.
 */
jest.mock('../supabase', () => require('../../test-utils/fakeSupabase').fakeSupabaseModule());

import { getPriceReference } from '../intelligenceDataProvider';
import type { FakeSupabase } from '../../test-utils/fakeSupabase';

const fake = require('../supabase').__fake as FakeSupabase;
const ROW = {
  user_id: '11111111-1111-4111-8111-111111111111',
  material_id: 'mat-1',
  material_name: 'Kupferrohr 15mm',
  avg_price_30d: 12.34,
  avg_price_90d: 12.42,
  min_price_30d: 12.34,
  max_price_30d: 12.34,
  volatility: 0.11,
  observation_count: 2,
  last_observed_at: '2026-10-02T16:52:10Z',
};

beforeEach(() => { fake.reset(); });

it('the view itself is not readable by a signed-in contractor (why the old read was dead)', async () => {
  const r = await fake.client.from('price_references').select('*').eq('material_id', 'mat-1');
  expect(r.error?.code).toBe('42501');
});

it('returns the contractor\'s own price reference', async () => {
  fake.rpc('get_my_price_reference', (args) => ({ data: args.p_material_id === 'mat-1' ? [ROW] : [], error: null }));
  await expect(getPriceReference('mat-1')).resolves.toEqual(ROW);
  expect(fake.calls.filter((c) => c.table === 'price_references')).toHaveLength(0);
});

it('no row for that material → null, not an error', async () => {
  fake.rpc('get_my_price_reference', () => ({ data: [], error: null }));
  await expect(getPriceReference('other')).resolves.toBeNull();
});

/**
 * Generator calibration round-trips through the LIVE schema.
 *
 * The code wrote `prediction`, `predicted_at` and `accurate` — columns from a
 * migration that was a no-op (CREATE TABLE IF NOT EXISTS on an existing
 * table). The live table has `context`, `created_at`, `is_accurate`. Every
 * insert and resolve was PGRST204 and both reads 42703, all swallowed: the
 * learning loop never stored one entry. Found by the fake backend's schema
 * net (convergence plan P0.3, 2026-09-24).
 */
import type { FakeSupabase } from '../../test-utils/fakeSupabase';

jest.mock('../supabase', () => require('../../test-utils/fakeSupabase').fakeSupabaseModule({ userId: '11111111-1111-4111-8111-111111111111' }));
const fake = require('../supabase').__fake as FakeSupabase;

import {
  insertCalibrationEntry, resolveCalibrationEntry, getCalibrationEntriesByGenerator, getAllCalibrationScores,
} from '../intelligenceDataProvider';

it('record → read back → resolve → scored', async () => {
  const id = await insertCalibrationEntry({ generator_id: 'late_payment', prediction: 'will pay late', predicted_value: 14 });
  expect(id).toBeTruthy();
  expect(fake.rows('calibration_entries')).toHaveLength(1);

  const open = await getCalibrationEntriesByGenerator('late_payment', { unresolvedOnly: true, maxAgeDays: 30 });
  expect(open).toHaveLength(1);
  expect(open[0].prediction).toBe('will pay late'); // intelligenceBridge reads this

  await resolveCalibrationEntry(id!, 16, true);
  expect(await getCalibrationEntriesByGenerator('late_payment', { unresolvedOnly: true })).toHaveLength(0);

  const scores = await getAllCalibrationScores();
  expect(scores).toEqual([{ generator_id: 'late_payment', total: 1, resolved: 1, accurate: 1, rate: 1 }]);
  // …and not one call the live schema would reject.
  expect(fake.calls.filter((c) => c.error)).toEqual([]);
});

it('a prediction with no number still records (predicted_value is text NOT NULL)', async () => {
  const id = await insertCalibrationEntry({ generator_id: 'customer-lifecycle', prediction: 'quote sent — predicted acceptance' });
  expect(id).toBeTruthy();
  const [row] = await getCalibrationEntriesByGenerator('customer-lifecycle');
  expect(row.predicted_value).toBeNull();
  expect(fake.calls.filter((c) => c.error)).toEqual([]);
});

it('the stored number comes back as a number', async () => {
  const [row] = await getCalibrationEntriesByGenerator('late_payment');
  expect(row.predicted_value).toBe(14);
});


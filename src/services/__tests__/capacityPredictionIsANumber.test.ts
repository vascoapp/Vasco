/**
 * @jest-environment node
 *
 * A capacity-overrun prediction that is not a number is NO prediction.
 * NaN passes every "hide below threshold" gate (all comparisons with NaN are
 * false), so the Vandaag card rendered "NaN% kans · ~NaNd uitloop in komende
 * NaNd" (fresh walk, 2026-09-24). Postgres `numeric` stores 'NaN' — a model
 * that divides by zero writes exactly that, and PostgREST returns it as text.
 */
const U = '44444444-4444-4444-8444-444444444444';
jest.mock('../../lib/supabase', () => require('../../test-utils/fakeSupabase').fakeSupabaseModule({ userId: '44444444-4444-4444-8444-444444444444' }));
jest.mock('../../lib/currentUser', () => ({ ...jest.requireActual('../../lib/currentUser'), getAuthedUserId: () => '44444444-4444-4444-8444-444444444444' }));

import { getCapacityOverrunPrediction } from '../intelligenceCaptureService';
const fake = require('../../lib/supabase').__fake;

beforeEach(() => fake.reset());

it('a real prediction comes through as numbers', async () => {
  fake.seed('ml_capacity_overrun_predictions', [{ user_id: U, overrun_probability: 0.8, predicted_overrun_days: 3, horizon_days: 14 }]);
  expect(await getCapacityOverrunPrediction()).toMatchObject({ overrunProbability: 0.8, predictedOverrunDays: 3, horizonDays: 14 });
});

it("a 'NaN' figure is no prediction at all", async () => {
  fake.seed('ml_capacity_overrun_predictions', [{ user_id: U, overrun_probability: 'NaN', predicted_overrun_days: 3, horizon_days: 14 }]);
  expect(await getCapacityOverrunPrediction()).toBeNull();
});

it('no row is no prediction', async () => {
  expect(await getCapacityOverrunPrediction()).toBeNull();
});

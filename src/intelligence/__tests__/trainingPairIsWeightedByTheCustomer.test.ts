/**
 * Recursive-learning Loop 5 (memory/recursive-learning-loops.md): a decided
 * quote writes a quote-win training pair, weighted by its customer's
 * job-quality score. The weight lookup read `customer_id` off
 * pricing_intelligence — a column that table does not have — so the customer
 * was always undefined and get_customer_quality_weight was never called. The
 * customer now comes from the caller (the quote).
 *
 * The fake backend carries the LIVE schema: the pricing_intelligence select
 * must name real columns (42703 otherwise — the original shape of this loop's
 * defect), and the RPCs must be called with their live argument names. The
 * ownership rules of the two RPCs are proven in SQL (rolled-back trial,
 * migration 20261003000002).
 */
import type { FakeSupabase } from '../../test-utils/fakeSupabase';

const ME = 'aaaaaaaa-1111-4111-8111-000000000001';
jest.mock('../../lib/supabase', () => require('../../test-utils/fakeSupabase').fakeSupabaseModule({ userId: 'aaaaaaaa-1111-4111-8111-000000000001' }));

import { recordPricingOutcome } from '../dataCollector';

const fake = require('../../lib/supabase').__fake as FakeSupabase;
let pairs: any[] = [];
let weightAskedFor: string[] = [];

beforeEach(() => {
  fake.reset();
  pairs = [];
  weightAskedFor = [];
  fake.seed('pricing_intelligence', [
    { user_id: ME, quote_id: 'q-1', trade: 'plumbing', country: 'DE', line_description: 'Therme', quoted_unit_price: 1800, quoted_quantity: 1, quoted_total: 1800, customer_type: 'residential', quoted_at: '2026-03-10T09:00:00Z' },
    { user_id: ME, quote_id: 'q-1', trade: 'plumbing', country: 'DE', line_description: 'Montage', quoted_unit_price: 95, quoted_quantity: 4, quoted_total: 380, customer_type: 'residential', quoted_at: '2026-03-10T09:00:00Z' },
  ]);
  // PostgREST sends `numeric` as a JSON number; a string must work as well.
  fake.rpc('get_customer_quality_weight', ({ p_customer_id }) => {
    weightAskedFor.push(p_customer_id);
    return { data: p_customer_id === 'cust-good' ? 0.6 : '1.0', error: null };
  });
  fake.rpc('get_quote_engagement_features', () => ({ data: {}, error: null }));
  fake.rpc('write_training_pair', (args) => { pairs.push(args); return { data: 'pair-1', error: null }; });
});

it("a decided quote writes a training pair weighted by its customer's quality score", async () => {
  await recordPricingOutcome(ME, 'q-1', { wasAccepted: true, acceptedPrice: 2180, customerId: 'cust-good' });

  expect(weightAskedFor).toEqual(['cust-good']);
  expect(pairs).toHaveLength(1);
  expect(pairs[0]).toMatchObject({
    p_model_name: 'quote_win',
    p_user_id: ME,
    p_trade: 'plumbing',
    p_country: 'DE',
    p_target: 1,
    p_weight: 0.6,
  });
  expect(pairs[0].p_features).toMatchObject({ total_amount: 2180, line_count: 2, customer_type: 'residential', month_num: 3 });
  // Nothing the live schema would refuse on the way.
  expect(fake.calls.filter((c) => c.error)).toEqual([]);
});

it('a rejection is a pair too (target 0), and a customer with no signals weighs 1', async () => {
  await recordPricingOutcome(ME, 'q-1', { wasAccepted: false, customerId: 'cust-new' });
  expect(weightAskedFor).toEqual(['cust-new']);
  expect(pairs[0]).toMatchObject({ p_target: 0, p_target_label: 'rejected', p_weight: 1 });
});

it('no known customer (or one still on a temp id): weight 1, the weight is not asked', async () => {
  await recordPricingOutcome(ME, 'q-1', { wasAccepted: true, customerId: null });
  await recordPricingOutcome(ME, 'q-1', { wasAccepted: true, customerId: 'c-1712345678901' });
  expect(weightAskedFor).toEqual([]);
  expect(pairs.map((p) => p.p_weight)).toEqual([1, 1]);
});

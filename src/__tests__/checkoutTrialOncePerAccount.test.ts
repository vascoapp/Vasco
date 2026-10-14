/**
 * "One month free" is one month per ACCOUNT (review 2026-10-14). The website
 * checkout gave 30 days on every session: 30 in the app + 30 at checkout, and
 * cancel-in-trial → check out again → 30 more, without end.
 */
import fs from 'fs';
import path from 'path';
import { checkoutTrial, STRIPE_MIN_TRIAL_MS } from '../../supabase/functions/_shared/checkoutTrial';

const now = new Date('2026-10-14T10:00:00Z');
const inDays = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString();

describe('checkoutTrial', () => {
  it('a fresh account (no row) gets the month', () => {
    expect(checkoutTrial(null, now)).toEqual({ days: 30 });
  });

  it('a running in-app trial continues to its OWN end, not 30 more days', () => {
    const r = checkoutTrial({ tier: 'pro', status: 'trialing', trial_ends_at: inDays(20), external_id: null }, now);
    expect(r).toEqual({ endsAt: Math.ceil(new Date(inDays(20)).getTime() / 1000) });
  });

  it('a trial ending within Stripe\'s 48 h minimum is raised to it, no further', () => {
    const r = checkoutTrial({ tier: 'pro', status: 'trialing', trial_ends_at: inDays(1), external_id: null }, now) as { endsAt: number };
    expect(r.endsAt * 1000).toBeGreaterThanOrEqual(now.getTime() + STRIPE_MIN_TRIAL_MS);
    expect(r.endsAt * 1000).toBeLessThan(now.getTime() + STRIPE_MIN_TRIAL_MS + 5 * 60_000);
  });

  it('a used trial gets none', () => {
    expect(checkoutTrial({ tier: 'free', status: 'expired', trial_ends_at: null, external_id: null }, now)).toBeNull();
    expect(checkoutTrial({ tier: 'pro', status: 'trialing', trial_ends_at: inDays(-1), external_id: null }, now)).toBeNull();
  });

  it('an account that had a Stripe subscription (cancelled in its trial) gets none', () => {
    expect(checkoutTrial({ tier: 'free', status: 'canceled', trial_ends_at: null, external_id: 'sub_1' }, now)).toBeNull();
  });

  it('a live Stripe subscription still carrying the old in-app trial date gets none', () => {
    // Rows written before the webhook cleared trial_ends_at: Pro, Stripe
    // trialing, the app's date 20 days out — a second checkout must not
    // continue a trial the first checkout already gave.
    expect(checkoutTrial({ tier: 'pro', status: 'trialing', trial_ends_at: inDays(20), external_id: 'sub_1' }, now)).toBeNull();
  });
});

it('the checkout function asks the rule and never hard-codes a trial', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../../supabase/functions/create-subscription-checkout/index.ts'), 'utf8');
  expect(src).toMatch(/checkoutTrial\(subRow\)/);
  expect(src).not.toMatch(/trial_period_days\]',\s*'\d+'/);
});

it('the preview answers with the trial before any Stripe session is made', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../../supabase/functions/create-subscription-checkout/index.ts'), 'utf8');
  const preview = src.indexOf('if (preview)');
  expect(preview).toBeGreaterThan(src.indexOf('const trial = checkoutTrial(subRow);'));
  expect(preview).toBeLessThan(src.indexOf('checkout/sessions'));
  expect(src.slice(preview, preview + 200)).toMatch(/JSON\.stringify\(\{ ok: true, trial \}\)/);
});

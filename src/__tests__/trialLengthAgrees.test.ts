/**
 * One trial, one length (user, 2026-10-13: "1 month free"). The app's
 * TRIAL_DAYS, the website checkout's trial_period_days and the copy a
 * contractor reads in six languages must say the same thing — the 14-day
 * version lived in all three places at once.
 */
import fs from 'fs';
import path from 'path';
import { TRIAL_DAYS } from '../services/subscriptionService';

const ROOT = path.resolve(__dirname, '../..');

it('the app trial is 30 days', () => {
  expect(TRIAL_DAYS).toBe(30);
});

it('the website checkout grants the same trial', () => {
  const src = fs.readFileSync(path.join(ROOT, 'supabase/functions/create-subscription-checkout/index.ts'), 'utf8');
  const m = src.match(/trial_period_days\]',\s*'(\d+)'/);
  expect(Number(m?.[1])).toBe(TRIAL_DAYS);
});

it.each(['en', 'nl', 'de', 'fr', 'es', 'it'])('%s copy says one month, not 14 days', (l) => {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, `src/i18n/locales/${l}.json`), 'utf8'));
  for (const v of [d.onboarding.trialTitle, d.onboarding.trialAfter, d.onboarding.trialSummary, d.signup.subtitle]) {
    expect(v).not.toMatch(/\b14\b/);
  }
});

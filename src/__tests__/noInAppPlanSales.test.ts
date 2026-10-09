/**
 * No plan is sold inside the apps (user, 2026-10-09: plans are sold on the
 * website with Stripe). Apple (3.1.1) and Google Play allow in-app plan sales
 * only through their own billing: a buy button, a price list, a "View plans"
 * that leads to one, or "upgrade at vascobuild.com" is a review rejection.
 * DORMANT_CONTROLS.inAppPlanSales switches all of them on together — and must
 * only be turned on with store billing (e.g. RevenueCat) behind it.
 */
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';
import { DORMANT_CONTROLS } from '../config/dormant';

const ROOT = path.resolve(__dirname, '../..');
const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) return e.name === '__tests__' || e.name === 'node_modules' ? [] : walk(p);
  return /\.(tsx?|jsx?)$/.test(e.name) ? [p] : [];
});
const sources = [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'src'))]
  .map((f) => ({ f: path.relative(ROOT, f), s: stripComments(fs.readFileSync(f, 'utf8')) }));

it('in-app plan sales are off', () => {
  expect(DORMANT_CONTROLS.inAppPlanSales).toBe(false);
});

it('every "View plans" button sits behind the switch', () => {
  const bad: string[] = [];
  for (const { f, s } of sources) {
    for (const m of s.matchAll(/billing\.viewPlans/g)) {
      const before = s.slice(Math.max(0, m.index! - 80), m.index);
      if (!/DORMANT_CONTROLS\.inAppPlanSales \? \[\{ text: (?:i18n\.)?t\('$/.test(before)) bad.push(`${f}: …${before.slice(-60)}`);
    }
  }
  expect(bad).toEqual([]);
});

it('every checkout / billing-portal call sits behind the switch', () => {
  const profile = sources.find((x) => x.f === 'app/contractor/profile.tsx')!.s;
  // The two blocks that start a purchase or open the Stripe portal, and the iOS
  // "upgrade at vascobuild.com" note.
  expect(profile).toMatch(/\{DORMANT_CONTROLS\.inAppPlanSales && subscription\.tier !== 'free' && Platform\.OS !== 'ios' && \(/);
  expect(profile).toMatch(/\{DORMANT_CONTROLS\.inAppPlanSales && subscription\.tier !== 'contractor' && Platform\.OS !== 'ios' && \(/);
  expect(profile).toMatch(/\{DORMANT_CONTROLS\.inAppPlanSales && Platform\.OS === 'ios' && \(\s*<View style=\{styles\.iosBillingNote\}>/);
  const callers = sources.filter(({ f, s }) => f !== 'src/services/billingService.ts' && /startSubscriptionCheckout\(|startBillingPortal\(/.test(s)).map((x) => x.f);
  expect(callers).toEqual(['app/contractor/profile.tsx']);
});

it('onboarding shows no price list while the switch is off', () => {
  const onb = sources.find((x) => x.f === 'app/onboarding.tsx')!.s;
  const trial = onb.indexOf('if (!DORMANT_CONTROLS.inAppPlanSales) {');
  expect(trial).toBeGreaterThan(-1);
  // The trial card returns BEFORE the plan cards with their prices.
  expect(trial).toBeLessThan(onb.indexOf('{plans.map((plan) => {'));
  expect(onb).toMatch(/value: !DORMANT_CONTROLS\.inAppPlanSales\s*\? t\('onboarding\.trialSummary'/);
});

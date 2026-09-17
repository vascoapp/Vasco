/**
 * @jest-environment node
 */
// The subscription belongs to the ACCOUNT, and the device has to ask.
//
// `syncSubscriptionFromServer` ran on the SIGNED_IN event only — which fires
// when somebody signs in, not when the app reopens with a session already
// stored. So every later launch kept whatever was in AsyncStorage: a
// contractor inside their 14-day trial read "Kostenlos" on their profile, and
// a plan bought on another device never arrived (#339).
//
// Onboarding made it worse by OVERWRITING the local record with
// `{tier, billingCycle}`, dropping the `trialEndsAt` that signing up had just
// written.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const read = (rel: string) => stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

describe('the device asks the server for the entitlement', () => {
  const auth = read('src/context/AuthContext.tsx');

  it('syncs on a restored session, not only on sign-in', () => {
    expect(auth).toMatch(/event === 'INITIAL_SESSION'/);
    const at = auth.indexOf("event === 'INITIAL_SESSION'");
    expect(auth.slice(at, at + 400)).toMatch(/syncSubscriptionFromServer\(\)/);
  });

  it('still syncs on sign-in', () => {
    const at = auth.indexOf("event === 'SIGNED_IN'");
    expect(at).toBeGreaterThan(-1);
    expect(auth.slice(at, at + 900)).toMatch(/syncSubscriptionFromServer\(\)/);
  });
});

describe('onboarding does not clear the local trial', () => {
  it('merges into the stored record instead of replacing it', () => {
    const src = read('app/onboarding.tsx');
    const at = src.indexOf("'@vasco_subscription'");
    const block = src.slice(Math.max(0, at - 400), at + 600);
    expect(block).toMatch(/\.\.\.prevSub/);
  });
});

describe('picking the free plan during the trial does not end the trial', () => {
  // 'free' is the DEFAULT selection on the plan step, so this hit everyone who
  // did not change it: signUp grants 14 days of Pro, and once the billing_cycle
  // fix made this upsert actually land, it overwrote the row with tier 'free'.
  // Feature gating reads the TIER, so the trial was over on day one.
  const src = read('app/onboarding.tsx');

  it('keeps the trial tier locally while the trial is running', () => {
    const at = src.indexOf('keepTrialTier');
    expect(at).toBeGreaterThan(-1);
    // End anchored from the START — the local write is the setItem that
    // follows the declaration, and a short fixed window stopped before it.
    const write = src.indexOf('AsyncStorage.setItem', at);
    expect(write).toBeGreaterThan(at);
    const block = src.slice(at, write + 400);
    expect(block).toMatch(/trialActive/);
    expect(block).toMatch(/tier: keepTrialTier \?\? selectedPlan/);
  });

  it('writes the kept tier to the server, not the picked one', () => {
    const at = src.indexOf('const tierToWrite');
    expect(at).toBeGreaterThan(-1);
    const block = src.slice(at, at + 700);
    expect(block).toMatch(/tier: tierToWrite/);
    expect(block).toMatch(/status: tierToWrite === 'free' \? 'active' : 'trialing'/);
    // And never `tier: selectedPlan` again in that upsert.
    expect(block).not.toMatch(/tier: selectedPlan/);
  });

  it('carries the original end date instead of restarting the 14 days', () => {
    const at = src.indexOf('const tierToWrite');
    const block = src.slice(at, at + 700);
    expect(block).toMatch(/trial_ends_at: keepTrialEndsAt \?\?/);
  });
});


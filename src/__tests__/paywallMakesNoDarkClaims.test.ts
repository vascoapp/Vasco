/**
 * @jest-environment node
 */
// The subscription surfaces must not sell a feature that is dark in production.
//
// The Pro plan read "Full AI power — Vasco pays for itself" on the Profil
// paywall and "Full AI suite" on the onboarding plan card, in six languages,
// while production has no LLM provider key: photo→quote and generated scope
// text throw. `npm run check:listing` already refuses the same claim in the
// store listing; the in-app paywall — where the money actually changes hands —
// had no such check. Same pattern as scripts/check-store-listing.mjs.
//
// When an LLM key IS configured in production, delete this test on purpose.
import fs from 'fs';
import path from 'path';
import { TIERS } from '../services/subscriptionService';

// Acronyms case-SENSITIVE: Italian "ai" is a preposition ("ai clienti") and a
// case-insensitive /AI/ would fail an honest string. Spelled-out forms any case.
const ACRONYM = /\b(AI|KI|K\.I\.|IA)\b/;
const SPELLED = /(kunstmatige intelligentie|künstliche intelligenz|intelligence artificielle|intelligenza artificiale|inteligencia artificial|artificial intelligence)/i;
const DARK = { test: (s: string) => ACRONYM.test(s) || SPELLED.test(s) };

// Every key the plan cards (onboarding.tsx) and tier cards (profile.tsx) render.
const PAYWALL_KEYS = [
  'onboarding.planFree', 'onboarding.planPro', 'onboarding.planContractor',
  'onboarding.planFreeDesc', 'onboarding.planProDesc', 'onboarding.planContractorDesc',
  'onboarding.featAannemerProjects', 'onboarding.featAannemerSubs', 'onboarding.featAannemerQuote',
  'common.automatedFollowUps', 'common.purchasingAgent', 'common.eInvoicing', 'common.teamFeatures',
];

const LOCALES = ['en', 'nl', 'de', 'fr', 'es', 'it'];

function lookup(obj: any, dotted: string): unknown {
  return dotted.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

describe('paywall copy makes no claim that is dark in production', () => {
  it.each(LOCALES)('%s plan and tier copy', (loc) => {
    const json = JSON.parse(fs.readFileSync(path.join(__dirname, '../i18n/locales', `${loc}.json`), 'utf8'));
    const claims = PAYWALL_KEYS
      .map((k) => [k, lookup(json, k)] as const)
      .filter(([, v]) => typeof v === 'string' && DARK.test(v as string));
    expect(claims).toEqual([]);
  });

  it('the English defaults in the TIERS table', () => {
    const claims = Object.values(TIERS).map((t) => t.tagline).filter((s) => DARK.test(s));
    expect(claims).toEqual([]);
  });

  it('every key it checks still exists (a renamed key would pass silently)', () => {
    const en = JSON.parse(fs.readFileSync(path.join(__dirname, '../i18n/locales/en.json'), 'utf8'));
    const missing = PAYWALL_KEYS.filter((k) => typeof lookup(en, k) !== 'string');
    expect(missing).toEqual([]);
  });
});

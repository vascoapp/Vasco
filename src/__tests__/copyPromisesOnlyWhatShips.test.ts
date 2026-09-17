/**
 * @jest-environment node
 */
// Copy that promised a capability production does not have (#339).
//
// The onboarding welcome said "KI, die für Sie arbeitet — Vasco erstellt
// Angebote, Erinnerungen und Rechnungen automatisch" while the whole LLM layer
// is dark (no key in prod) and nothing customer-facing is ever sent without a
// tap. The value screen promised daily ROUTE OPTIMISATION, which is behind a
// kill switch, AI price suggestions, lead scoring (dormant by decision) and a
// metered "5 free AI insights" quota that limits nothing. Home quoted "~3x"
// and "30% more jobs" with no source, and the €69 plan sold a cross-trade
// quote builder that does not exist.
//
// The paywall and store listing were already made to stop claiming AI
// (paywallMakesNoDarkClaims / check:listing); these are the surfaces that were
// missed.
import fs from 'fs';
import path from 'path';
import { LLM_GENERATION_ENABLED } from '../config/ai';

const ROOT = path.resolve(__dirname, '../..');
const LOCALES = ['de', 'en', 'nl', 'fr', 'es', 'it'];
const load = (loc: string) => JSON.parse(fs.readFileSync(path.join(ROOT, `src/i18n/locales/${loc}.json`), 'utf8'));

/** Keys whose subject is a customer-facing send or an AI generation. */
const KEYS = [
  'onboarding.valueProp1Title',
  'onboarding.valueProp1Desc',
  'onboarding.valueProp2Desc',
  'onboarding.aiInsight.paymentsDesc',
  'onboarding.aiInsight.scheduleDesc',
  'onboarding.aiInsight.quotesDesc',
  'onboarding.aiInsight.leadsDesc',
  'onboarding.aiDemoNote',
  'dk.hero.guideStartDesc',
  'dk.empty.noJobsDesc',
  'common.automatedFollowUps',
];

// ⚠️ `get()` returns undefined for a missing key and the callers filter those
// out, so renaming a key — or adding a new claim — silently left it unchecked.
// The sibling guard `paywallMakesNoDarkClaims` has this; this one did not
// (meta-sweep 2026-09-17).
describe('the key list is still real', () => {
  const en = load('en');
  it.each(KEYS)('%s still exists in en', (key) => {
    expect({ key, found: typeof get(en, key) === 'string' }).toEqual({ key, found: true });
  });
});

const get = (j: unknown, key: string): string | undefined => {
  let cur: any = j;
  for (const part of key.split('.')) {
    if (!cur || typeof cur !== 'object' || !(part in cur)) return undefined;
    cur = cur[part];
  }
  return typeof cur === 'string' ? cur : undefined;
};

// "automatic" about a customer-facing message; an AI claim; an unsourced stat.
const PROMISES_AUTO_SEND = /automatisch|automatically|automatisch|automatique|automátic|automatic|automatisk/i;
const CLAIMS_AI = /\bKI\b|\bAI\b|\bIA\b/;

describe('onboarding and home promise only what ships', () => {
  it('the LLM layer is off in this build (the premise of these checks)', () => {
    expect(LLM_GENERATION_ENABLED).toBe(false);
  });

  it.each(LOCALES)('%s: no promise of automatic sending on those keys', (loc) => {
    const j = load(loc);
    const bad = KEYS.map((k) => [k, get(j, k)] as const)
      .filter(([, v]) => v && PROMISES_AUTO_SEND.test(v))
      .map(([k, v]) => `${k}: ${v}`);
    expect(bad).toEqual([]);
  });

  it.each(LOCALES)('%s: no AI claim on those keys while generation is off', (loc) => {
    const j = load(loc);
    const bad = KEYS.map((k) => [k, get(j, k)] as const)
      .filter(([, v]) => v && CLAIMS_AI.test(v))
      .map(([k, v]) => `${k}: ${v}`);
    expect(bad).toEqual([]);
  });

  it.each(LOCALES)('%s: no route-optimisation promise while the flag is off', (loc) => {
    const v = get(load(loc), 'onboarding.aiInsight.scheduleDesc') ?? '';
    expect(v).not.toMatch(/route|Route|ruta|percorso/i);
  });

  it.each(LOCALES)('%s: no unsourced conversion statistics', (loc) => {
    const j = load(loc);
    for (const k of ['dk.hero.guideFollowupDesc', 'dk.empty.noQuotesDesc']) {
      const v = get(j, k) ?? '';
      expect(v).not.toMatch(/\d+\s*%|\d+x|\d+\s*×/);
    }
  });

  it('the Automations tab is gone, with its toggles and invented hours-saved', () => {
    const ai = fs.readFileSync(path.join(ROOT, 'app/(contractor)/ai.tsx'), 'utf8');
    expect(ai).not.toMatch(/autoToggles/);
    expect(ai).not.toMatch(/hoursSavedPerWeek/);
    expect(ai).not.toMatch(/key: 'automations'/);
  });

  it('the service-agreement auto-invoice switch is gone (nothing read it)', () => {
    const src = fs.readFileSync(path.join(ROOT, 'app/contractor/service-agreements.tsx'), 'utf8');
    expect(src).not.toMatch(/setFormAutoInvoice\(!/);
  });
});

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

describe('a corrected string has no stale twin', () => {
  // 4af7c2d rewrote the NESTED `onboarding.aiInsight.*` copy and left 85 FLAT
  // `"aiInsight.quotes"`-style duplicates across the seven locale files, still
  // carrying "AI suggests prices based on local market data", "Auto-send
  // reminders" and "Optimize your route". i18next resolves a flat dotted key,
  // so which one a contractor saw depended on lookup order (sweep 2026-09-18).
  // Flat dotted keys are fine when they are the ONLY copy (`goals.more_jobs`
  // and friends). The defect is a flat key that DUPLICATES a nested one: two
  // strings for one slot, and the corrected one is not necessarily the one
  // i18next returns.
  it.each(['de', 'en', 'en-US', 'nl', 'fr', 'es', 'it'])('%s has no flat key duplicating a nested one', (loc) => {
    const dict = JSON.parse(fs.readFileSync(path.join(ROOT, `src/i18n/locales/${loc}.json`), 'utf8'));
    const ob = dict.onboarding ?? {};
    const duplicated = Object.keys(ob)
      .filter((k) => k.includes('.'))
      .filter((k) => {
        const [head, ...rest] = k.split('.');
        const nested = ob[head];
        return nested && typeof nested === 'object' && rest.join('.') in nested;
      });
    expect({ loc, duplicated }).toEqual({ loc, duplicated: [] });
  });

  // The inline `defaultValue` is what ships when a key is missing, so it is copy
  // too — and it still said "Smart quote pricing" / "AI suggests prices".
  it('the screen fallbacks make no AI or automation claim', () => {
    const src = fs.readFileSync(path.join(ROOT, 'app/onboarding.tsx'), 'utf8');
    const insights = src.slice(src.indexOf("goals.includes('faster_payments')"), src.indexOf('Always have at least 3'));
    expect(insights).not.toMatch(/AI suggests|Smart quote pricing|Auto-send|Optimize your route|Lead scoring/i);
  });

  it('the free-plan note does not call a concurrent cap a monthly one', () => {
    // `maxActiveJobs: 5` counts jobs open AT ONCE; the note said "5 jobs a
    // month", so a contractor with five open jobs was blocked on the 1st.
    for (const loc of ['de', 'en', 'nl', 'fr', 'es', 'it']) {
      const dict = JSON.parse(fs.readFileSync(path.join(ROOT, `src/i18n/locales/${loc}.json`), 'utf8'));
      const note = dict.onboarding?.aiDemoNote ?? '';
      expect(`${loc}: ${note}`).toMatch(/gleichzeitig|gelijktijdig|tegelijk|at a time|à la fois|a la vez|contemporaneamente/i);
    }
  });
});


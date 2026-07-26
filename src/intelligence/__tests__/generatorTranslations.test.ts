// =============================================================================
// GENERATOR TRANSLATIONS — resolution guard
// =============================================================================
// gt() returns THE KEY ITSELF when a key is missing. That is a silent failure:
// a typo ships "tip_invoice_titel" onto the contractor's home tab and every
// static check stays green, because the string exists in the source and the
// locale JSONs are not involved at all (generators have their own table).
//
// These tests close that hole for the tip generator specifically — its table
// was hardcoded Dutch until R323 and is the one most likely to be extended by
// hand — and assert the whole registry is complete across the six languages.
// =============================================================================

import { TRANSLATIONS, gt } from '../generatorTranslations';
import type { GeneratorLanguage } from '../generators/types';

const LANGS: GeneratorLanguage[] = ['nl', 'en', 'de', 'fr', 'es', 'it'];

// Every key the tip generator asks for, mirrored from staticTipGenerator.
const TIP_KEYS = [
  'tip_invoice_title', 'tip_invoice_msg', 'tip_invoice_detail',
  'tip_bulk_title', 'tip_bulk_msg', 'tip_bulk_action',
  'tip_decision_title', 'tip_decision_msg', 'tip_decision_action',
  'tip_crew_title', 'tip_crew_msg', 'tip_crew_action',
  'tip_safety_title', 'tip_safety_msg', 'tip_safety_action',
  'tip_cashflow_title', 'tip_cashflow_msg', 'tip_cashflow_action',
  'tip_schedule_title', 'tip_schedule_msg', 'tip_schedule_action',
  'tip_portfolio_title', 'tip_portfolio_msg', 'tip_portfolio_action',
  'tip_evidence_industry', 'tip_suggestion_see_details',
  'tip_dyn_underest_title', 'tip_dyn_underest_msg', 'tip_dyn_based_on_jobs',
  'tip_dyn_underest_obs', 'tip_dyn_underest_impl', 'tip_dyn_underest_sugg',
  'tip_dyn_streak_title', 'tip_dyn_streak_msg', 'tip_dyn_streak_best',
  'tip_dyn_streak_keepgoing', 'tip_dyn_streak_obs', 'tip_dyn_streak_evidence',
  'tip_dyn_streak_impl', 'tip_dyn_streak_sugg',
  'tip_dyn_payment_title', 'tip_dyn_payment_msg', 'tip_dyn_payment_action',
  'tip_dyn_payment_obs', 'tip_dyn_payment_evidence', 'tip_dyn_payment_impl',
  'tip_dyn_payment_sugg',
];

describe('generatorTranslations registry', () => {
  test('every key has all six languages, non-empty', () => {
    const broken: string[] = [];
    for (const [key, entry] of Object.entries(TRANSLATIONS)) {
      for (const lang of LANGS) {
        const v = (entry as Record<string, string>)[lang];
        if (!v || !v.trim()) broken.push(`${key}.${lang}`);
      }
    }
    expect(broken).toEqual([]);
  });

  test('placeholders match across languages (a dropped {{pct}} renders a hole)', () => {
    const ph = (s: string) => (s.match(/\{\{\w+\}\}/g) ?? []).sort().join(',');
    const mismatched: string[] = [];
    for (const [key, entry] of Object.entries(TRANSLATIONS)) {
      const base = ph((entry as Record<string, string>).nl ?? '');
      for (const lang of LANGS) {
        if (ph((entry as Record<string, string>)[lang] ?? '') !== base) {
          mismatched.push(`${key}.${lang}`);
        }
      }
    }
    expect(mismatched).toEqual([]);
  });

  // "Parity != translated" (learnings #82/#83), applied to the generator table.
  // The registry is hand-authored in Dutch first, so the failure mode is a new
  // key whose de/fr/es/it slots are the Dutch copy pasted across — which no
  // static check can see, since the key IS present in all six.
  test('de/fr/es/it are not the Dutch value pasted across', () => {
    const SAME_AS_NL_OK = new Set([
      'Vasco AI',      // brand name
      'Compliance',    // loanword, identical in nl/de
      'Marge',         // genuinely the same word in nl/de/fr
      'Benchmark: {{type}}', // loanword + placeholder
    ]);
    const hits: string[] = [];
    for (const [key, entry] of Object.entries(TRANSLATIONS)) {
      const nl = (entry as Record<string, string>).nl ?? '';
      if (nl.length <= 3 || SAME_AS_NL_OK.has(nl)) continue;
      for (const lang of ['de', 'fr', 'es', 'it'] as GeneratorLanguage[]) {
        if ((entry as Record<string, string>)[lang] === nl) hits.push(`${key}.${lang} = ${nl}`);
      }
    }
    expect(hits).toEqual([]);
  });

  test('no value still carries a hardcoded currency symbol next to a placeholder', () => {
    // Same rule as OTA preflight check 9, applied to the generator table:
    // the locale owns the words, formatMoney/gtMoney owns the money.
    const adjacent = /[€£$][   ]{0,2}\{\{|\}\}[   ]{0,2}[€£$]/;
    const hits: string[] = [];
    for (const [key, entry] of Object.entries(TRANSLATIONS)) {
      for (const lang of LANGS) {
        const v = (entry as Record<string, string>)[lang] ?? '';
        if (adjacent.test(v)) hits.push(`${key}.${lang} = ${v}`);
      }
    }
    expect(hits).toEqual([]);
  });
});

describe('staticTipGenerator keys resolve', () => {
  test.each(LANGS)('%s: every tip key resolves to real copy, not the key name', (lang) => {
    const unresolved = TIP_KEYS.filter((k) => gt(k, lang) === k);
    expect(unresolved).toEqual([]);
  });

  test('the six languages actually differ (not one language pasted six times)', () => {
    // tip_invoice_title is plain prose with no brand names or acronyms, so six
    // identical values would mean the table was filled in with one language.
    const values = LANGS.map((l) => gt('tip_invoice_title', l));
    expect(new Set(values).size).toBe(LANGS.length);
  });

  test('interpolation survives translation in every language', () => {
    for (const lang of LANGS) {
      const out = gt('tip_dyn_underest_msg', lang, { pct: 23 });
      expect(out).toContain('23');
      expect(out).not.toContain('{{pct}}');
    }
  });
});

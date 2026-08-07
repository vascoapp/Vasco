/**
 * @jest-environment node
 *
 * SEASONAL PURCHASING ADVICE — no invented forecast, and not English-only
 *
 * This card reaches the Vandaag queue for every contractor in every country,
 * and it used to read:
 *
 *   "Prices for painting materials are expected to drop 12% next season
 *    (autumn). Demand drops — clearance deals available"
 *
 * Two separate problems, both visible on one line:
 *
 * 1. THE NUMBER WAS INVENTED. `avgChange` is arithmetic over
 *    SEASONAL_PATTERNS multipliers — hardcoded judgement calls — applied to
 *    MARKET_BASELINES, a static reference table. Nothing in the chain is a
 *    measurement, so "12%" claimed a forecast the app cannot make. The
 *    seasonal DIRECTION is a defensible trade heuristic; the decimal on top of
 *    it was false precision.
 *
 * 2. IT WAS HARDCODED ENGLISH, rendered beside a localised subtitle, so the
 *    card came out half-translated in five locales.
 *
 * The first test is the one that matters: a percentage is exactly the kind of
 * thing that gets "helpfully" added back.
 */

// jest.setup.ts replaces src/i18n/i18n with a stub that echoes defaultValue,
// so under the global mock every locale looks like English and this file could
// not tell a localised string from a hardcoded one. Un-mock it here — the
// localisation assertions below are the whole point.
jest.unmock('../../i18n/i18n');
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-GB', languageCode: 'en' }],
}));

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    getItem: jest.fn(async (k: string) => store.get(k) ?? null),
    setItem: jest.fn(async (k: string, v: string) => { store.set(k, v); }),
  };
});
jest.mock('../subscriptionService', () => ({
  loadSubscription: async () => ({ tier: 'contractor' }),
  canUseFeature: () => ({ allowed: true }),
}));
jest.mock('../supplierBacklinkService', () => ({ SUPPLIERS: [] }));
jest.mock('../onboardingPreferencesService', () => ({
  loadOnboardingPreferences: async () => ({}),
}));
jest.mock('../../lib/currentUser', () => ({
  getCurrentUserId: () => 'u1',
  getCurrentCountry: () => 'NL',
  getCurrentTrade: () => 'painting',
}));

import i18n from '../../i18n/i18n';
import { getSeasonalAdvice } from '../purchasingAgentService';

/** Any bare percentage, which is what the fabricated forecast looked like. */
const PERCENT = /\d+\s*%/;

describe('the advice states a pattern, never a forecast', () => {
  it.each(['roofing', 'painting', 'tiling', 'insulation', 'general'])(
    'quotes no percentage for %s',
    async (trade) => {
      const r = await getSeasonalAdvice(trade, 'NL' as never);
      if (!r) return; // trade with no material table — nothing to assert
      expect(r.advice).not.toMatch(PERCENT);
      expect(r.suggestedAction).not.toMatch(PERCENT);
    },
  );

  it('quotes no currency amount either — the prices are equally derived', async () => {
    const r = await getSeasonalAdvice('roofing', 'NL' as never);
    if (!r) return;
    expect(r.advice).not.toMatch(/[€$£]\s*\d/);
    expect(r.suggestedAction).not.toMatch(/[€$£]\s*\d/);
  });
});

describe('localisation', () => {
  afterAll(async () => { await i18n.changeLanguage('en'); });

  it('renders Dutch when the app is Dutch, and never the raw trade slug', async () => {
    await i18n.changeLanguage('nl');
    const r = await getSeasonalAdvice('painting', 'NL' as never);
    expect(r).not.toBeNull();
    // "painting" is the slug; the sentence must carry the display name.
    expect(r!.advice.toLowerCase()).not.toContain('painting');
    expect(r!.advice).toMatch(/[Mm]ateriaal|[Mm]aterialen|[Pp]rijzen/);
  });

  it('renders German when the app is German', async () => {
    await i18n.changeLanguage('de');
    const r = await getSeasonalAdvice('painting', 'NL' as never);
    expect(r).not.toBeNull();
    // Deliberately NOT /Material/ — that word is in the English string too, so
    // this assertion would have passed on untranslated output. Match on the
    // words English cannot produce.
    expect(r!.advice).toMatch(/für|günstiger|teurer|schwanken/);
    expect(r!.advice).not.toMatch(/\busually\b|\bcheaper\b|\bmore expensive\b/);
  });

  it('still returns something in English', async () => {
    await i18n.changeLanguage('en');
    const r = await getSeasonalAdvice('painting', 'NL' as never);
    expect(r).not.toBeNull();
    expect(r!.advice.length).toBeGreaterThan(10);
    expect(r!.suggestedAction.length).toBeGreaterThan(3);
  });
});

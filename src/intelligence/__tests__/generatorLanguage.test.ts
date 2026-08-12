/**
 * Generator strings were served in DUTCH to German and US contractors.
 *
 * `useVascoGuidance` handed `i18n.language` to `gt()` behind an
 * `as GeneratorLanguage` cast. The app ships **en-US** as a real locale
 * (src/i18n/i18n.ts resolves the device tag to it), and 'en-US' is not a key in
 * any TranslationMap — so the lookup missed and `gt()` fell through to its
 * Dutch fallback. Found on the German demo contractor's Finanzen tab, which
 * read "2 facturen achterstallig: 800 €" in the middle of an otherwise German
 * screen, while the correct German string existed in the table all along.
 */
import { gt, toGeneratorLanguage, TRANSLATIONS } from '../generatorTranslations';

describe('toGeneratorLanguage', () => {
  it('drops the region subtag from a locale this app actually ships', () => {
    // en-US is the case that caused the bug — a shipped locale, not a typo.
    expect(toGeneratorLanguage('en-US')).toBe('en');
    expect(toGeneratorLanguage('de-AT')).toBe('de');
    expect(toGeneratorLanguage('nl-NL')).toBe('nl');
  });

  it('passes through the six supported languages', () => {
    for (const l of ['en', 'nl', 'de', 'fr', 'es', 'it']) {
      expect(toGeneratorLanguage(l)).toBe(l);
    }
  });

  it('falls back to ENGLISH, never Dutch, for anything unrecognised', () => {
    // Dutch as the silent fallback is precisely how a German contractor got
    // Dutch copy on a German screen.
    expect(toGeneratorLanguage('pt-BR')).toBe('en');
    expect(toGeneratorLanguage('')).toBe('en');
    expect(toGeneratorLanguage(undefined)).toBe('en');
    expect(toGeneratorLanguage(null)).toBe('en');
  });

  it('is case-insensitive', () => {
    expect(toGeneratorLanguage('DE')).toBe('de');
    expect(toGeneratorLanguage('en-us')).toBe('en');
  });
});

describe('gt', () => {
  it('serves German to a German contractor for the string seen on device', () => {
    const de = gt('fin_overdue_title', 'de', { count: 2, amount: '800 €' });
    expect(de).toBe('2 Rechnungen überfällig: 800 €');
    // The exact Dutch that was on the German screen must not appear.
    expect(de).not.toContain('facturen');
  });

  it('routes an en-US tag to English rather than Dutch', () => {
    const enUS = gt('fin_overdue_title', toGeneratorLanguage('en-US'), { count: 2, amount: '$800' });
    expect(enUS).toBe('2 invoices overdue: $800');
    expect(enUS).not.toContain('facturen');
  });

  it('falls back to English for an unknown language', () => {
    // Cast deliberately — this is the shape the old code produced.
    const bogus = gt('fin_overdue_title', 'pt' as never, { count: 1, amount: '€1' });
    expect(bogus).toBe('1 invoices overdue: €1');
  });

  it('every entry carries all six locales, so the fallback is only for bad tags', () => {
    // If this fails, changing the fallback from nl to en would start showing
    // English where Dutch used to appear legitimately.
    const incomplete = Object.entries(TRANSLATIONS).filter(([, v]) =>
      ['en', 'nl', 'de', 'fr', 'es', 'it'].some((l) => !(v as Record<string, string>)[l]),
    );
    expect(incomplete.map(([k]) => k)).toEqual([]);
  });
});

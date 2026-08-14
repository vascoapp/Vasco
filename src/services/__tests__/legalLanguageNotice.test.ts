/**
 * 35 of the 54 legal.* keys have no translation in any locale, so the privacy
 * policy, GDPR rights, liability limitations and dispute resolution fall
 * through to their English `contentDefault` in every language.
 *
 * Translating binding legal text is a decision for counsel, not a code change.
 * The honest interim is to say so — a Dutch or German reader must not assume
 * the text in front of them is authoritative in their language.
 */
import fs from 'fs';
import path from 'path';

const LOCALES = ['en', 'nl', 'de', 'fr', 'es', 'it'] as const;
const load = (l: string) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'i18n', 'locales', `${l}.json`), 'utf8'));

describe('the English-authoritative clause', () => {
  it.each(LOCALES)('%s has the notice and its heading', (l) => {
    const legal = load(l).legal ?? {};
    expect(typeof legal.languageNotice).toBe('string');
    expect(legal.languageNotice.length).toBeGreaterThan(40);
    expect(typeof legal.languageNoticeHeading).toBe('string');
  });

  it('is genuinely translated, not copied from English', () => {
    const en = load('en').legal.languageNotice;
    for (const l of LOCALES.filter((x) => x !== 'en')) {
      expect(load(l).legal.languageNotice).not.toBe(en);
    }
  });

  it('every locale actually names English as the prevailing version', () => {
    // The clause is worthless if a translation quietly drops the operative
    // part. Each language's own word for "English" must appear.
    const word: Record<string, string> = {
      en: 'English', nl: 'Engelse', de: 'englische', fr: 'anglaise', es: 'inglés', it: 'inglese',
    };
    for (const l of LOCALES) {
      expect(load(l).legal.languageNotice.toLowerCase()).toContain(word[l].toLowerCase());
    }
  });
});

describe('the last-updated month is not hardcoded English', () => {
  it('renders in the active language', () => {
    const d = new Date('2026-03-01');
    expect(d.toLocaleDateString('de', { month: 'long', year: 'numeric' })).toContain('März');
    expect(d.toLocaleDateString('fr', { month: 'long', year: 'numeric' })).toContain('mars');
    expect(d.toLocaleDateString('en', { month: 'long', year: 'numeric' })).toContain('March');
  });
});

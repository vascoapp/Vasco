// A message to the contractor's customer is written in the contractor's language.
//
// 2026-09-14, German device: "Ich bin unterwegs" → 20 Min. shared
// "Hi Anja Hoffmann, I'm on my way — ETA 20 min." Four screens resolved the
// language as `(businessProfile as any)?.language ?? 'en'`, and BusinessProfile
// has no `language` field, so it was English for everyone whose stored profile
// lacked the key. The caller also passed `${mins} min`, an English unit.
import fs from 'fs';
import path from 'path';
import i18n from '../../i18n/i18n';
import { messageLocale, renderTemplate, type Locale } from '../whatsappTemplateService';
import { stripComments } from '../../utils/stripComments';

const setLanguage = (lng: string) => { (i18n as unknown as { language: string }).language = lng; };

describe('messageLocale follows the app language', () => {
  afterAll(() => setLanguage('en'));

  it.each([
    ['de', 'de'], ['de-DE', 'de'], ['nl', 'nl'], ['fr-FR', 'fr'], ['es', 'es'], ['it', 'it'], ['en-US', 'en'],
  ])('%s → %s', (lng, expected) => {
    setLanguage(lng);
    expect(messageLocale()).toBe(expected);
  });

  it('falls back to English only for a language the templates do not have', () => {
    setLanguage('pl');
    expect(messageLocale()).toBe('en');
  });
});

describe('on_my_way', () => {
  const vars = { customer: 'Anja Hoffmann', minutes: '20', business: 'Bergmann Sanitär & Heizung GmbH' };

  it.each(['nl', 'de', 'fr', 'es', 'it'] as Locale[])('%s carries no English', (loc) => {
    const text = renderTemplate('on_my_way', loc, vars);
    expect(text).toContain('20');
    expect(text).toContain('Anja Hoffmann');
    expect(text).toContain('Bergmann Sanitär & Heizung GmbH');
    expect(text).not.toMatch(/\bETA\b|\bmin\b|on my way|\{\{/);
  });
});

describe('no screen reads a language off the business profile', () => {
  const APP = path.resolve(__dirname, '../../../app');
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      return e.isDirectory() ? walk(p) : /\.tsx?$/.test(e.name) ? [p] : [];
    });

  it('uses messageLocale()/i18n instead', () => {
    const files = walk(APP);
    expect(files.length).toBeGreaterThan(50);
    const hits = files.filter((f) =>
      /businessProfile\b[^;\n]*\)?\??\.language\b/.test(stripComments(fs.readFileSync(f, 'utf8'))),
    );
    expect(hits.map((f) => path.relative(APP, f))).toEqual([]);
  });
});

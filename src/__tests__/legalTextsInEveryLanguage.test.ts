// Privacy + terms in every language (user, 2026-09-30). The in-app legal
// screen rendered English in all six locales — its `legal.*Content` keys
// existed in none, so every section fell back to its English default — and
// the web pages existed only in English.
//
// Also the rule CLAUDE.md states and nothing checked: the legal documents live
// twice (docs/legal = admin/content/legal) and must stay identical.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';
import { legalUrl } from '../utils/legalLinks';

const ROOT = path.resolve(__dirname, '../..');
const LANGS = ['en', 'nl', 'de', 'fr', 'es', 'it'] as const;
const COUNTRIES = ['NL', 'DE', 'FR', 'ES', 'IT', 'UK'];
const locale = (l: string) => JSON.parse(fs.readFileSync(path.join(ROOT, `src/i18n/locales/${l}.json`), 'utf8')).legal ?? {};

// Every key the screen asks for: its static section keys + the per-country pair
// it composes at render time.
const screen = stripComments(fs.readFileSync(path.join(ROOT, 'app/contractor/legal.tsx'), 'utf8'));
const KEYS = [
  ...new Set([
    ...[...screen.matchAll(/(?:titleKey|headingKey|contentKey):\s*'legal\.([A-Za-z0-9_]+)'/g)].map((m) => m[1]),
    ...COUNTRIES.flatMap((c) => [`perCountryContent_${c}`, `einvoicingContent_${c}`]),
  ]),
];

it('finds the screen\'s keys at all', () => {
  expect(KEYS.length).toBeGreaterThan(40);
});

describe.each(LANGS)('%s', (lang) => {
  const own = locale(lang);
  const en = locale('en');

  it('has every legal key the screen renders', () => {
    expect(KEYS.filter((k) => !own[k])).toEqual([]);
  });

  if (lang !== 'en') {
    it('is actually translated, not the English text copied', () => {
      // Long body texts only: a heading like "GDPR" can legitimately match.
      const untranslated = KEYS.filter((k) => en[k] && en[k].length > 80 && own[k] === en[k]);
      expect(untranslated).toEqual([]);
    });
  }
});

const tree = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? tree(path.join(dir, e.name)).map((f) => `${e.name}/${f}`) : [e.name]);

it('docs/legal and admin/content/legal are identical', () => {
  const a = path.join(ROOT, 'docs/legal');
  const b = path.join(ROOT, 'admin/content/legal');
  expect(tree(a).sort()).toEqual(tree(b).sort());
  for (const f of tree(a)) {
    expect(`${f}: ${fs.readFileSync(path.join(b, f), 'utf8') === fs.readFileSync(path.join(a, f), 'utf8')}`).toBe(`${f}: true`);
  }
});

describe.each(['privacy-policy', 'terms-of-service'])('%s on the web', (slug) => {
  const en = fs.readFileSync(path.join(ROOT, `docs/legal/${slug}.md`), 'utf8');
  const headings = (md: string) => md.split('\n').filter((l) => /^#{1,6} /.test(l)).map((l) => l.match(/^#+/)![0]);

  it.each(LANGS.filter((l) => l !== 'en'))('exists in %s with the same structure', (lang) => {
    const file = path.join(ROOT, `docs/legal/${lang}/${slug}.md`);
    expect(fs.existsSync(file)).toBe(true);
    const md = fs.readFileSync(file, 'utf8');
    expect(headings(md)).toEqual(headings(en));
    expect(md).not.toBe(en);
    // Contact addresses survive translation.
    for (const email of new Set(en.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? [])) expect(md).toContain(email);
  });
});

it('the app opens the web pages in its own language', () => {
  expect(legalUrl('privacy', 'de')).toBe('https://vascobuild.com/privacy?lang=de');
  expect(legalUrl('terms', 'fr-FR')).toBe('https://vascobuild.com/terms?lang=fr');
  expect(legalUrl('terms', 'pt')).toBe('https://vascobuild.com/terms');
});

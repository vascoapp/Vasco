/**
 * The legal pages name the company that is actually registered (user,
 * 2026-10-12): 3511, trading as Vasco Build, Ertskade 74, 1019 BB Amsterdam,
 * KvK 99596326. Until then the privacy policy and terms said
 * "Address: [Your registered business address]" in six languages, the app and
 * the site footers said "Vasco B.V." — a company that does not exist — and the
 * App Store copyright line said the same. A store reviewer reads all of these.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');
const LANGS = ['', 'nl', 'de', 'fr', 'es', 'it'];
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const legalFiles = ['admin/content/legal', 'docs/legal'].flatMap((root) =>
  LANGS.flatMap((l) =>
    ['privacy-policy.md', 'terms-of-service.md'].map((f) => path.join(root, l, f)),
  ),
);

it.each(legalFiles)('%s names the registered company and has no placeholder', (f) => {
  const src = read(f);
  expect(src).toContain('KvK');
  expect(src).toContain('99596326');
  expect(src).toContain('Ertskade 74, 1019 BB');
  // A bracketed placeholder ("[Your registered business address]") that is not a link.
  expect(src).not.toMatch(/\[[A-Za-zÀ-ÿ][^\]\n]{3,}\](?!\()/);
});

it('no surface names "Vasco B.V."', () => {
  const surfaces = [
    'app/contractor/legal.tsx',
    'admin/src/app/legal/[slug]/page.tsx',
    'admin/src/components/MarketingHome.tsx',
    'fastlane/metadata/copyright.txt',
    ...['en', 'nl', 'de', 'fr', 'es', 'it'].map((l) => `src/i18n/locales/${l}.json`),
  ];
  for (const f of surfaces) {
    const code = read(f).split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    expect({ f, hit: /Vasco B\.?V\.?\b/.test(code) }).toEqual({ f, hit: false });
  }
});

it('the legal form is stated: eenmanszaak (user, 2026-10-12)', () => {
  for (const f of legalFiles) expect({ f, ok: read(f).includes('eenmanszaak') }).toEqual({ f, ok: true });
});

it('the in-app contact block names the company in every language', () => {
  for (const l of ['en', 'nl', 'de', 'fr', 'es', 'it']) {
    const t = JSON.parse(read(`src/i18n/locales/${l}.json`)).legal.contactDetailsContent as string;
    expect({ l, ok: t.includes('3511') && t.includes('eenmanszaak') && t.includes('99596326') && t.includes('Ertskade 74') }).toEqual({ l, ok: true });
  }
});

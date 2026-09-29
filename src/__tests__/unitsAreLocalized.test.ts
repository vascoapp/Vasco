// A number followed by a hard-coded English unit letter reads wrong in four of
// six languages: days are "j" in French, "g" in Italian, "T." in German.
//
// French emulator walk 2026-09-29: Factures showed "18d · DSO" — the English
// abbreviation plus English finance jargon a builder does not use. The same
// `{n}d` shape sat on five live screens (market prices, pipeline, licences,
// customer insights, market pulse), plus a literal 'EXPIRED' pill.
// Units go through `common.daysCompact` / `common.hoursCompact` (or
// `payments.days` where there is room for the word).
import fs from 'fs';
import path from 'path';
import manifest from '../config/dormant.files.json';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const dormant = new Set((manifest as any).files as string[]);

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

// `{x}d</Text>`, `` `${x}d` ``, `` `${x}h` `` — an interpolation glued to a unit letter.
const SUFFIX = /\}[dh](?=<|`)/;
// app/hub is the portfolio surface: out of scope (contractor + aannemer only).
const files = ['app', 'src/components'].flatMap((d) => walk(path.join(ROOT, d)))
  .map((f) => path.relative(ROOT, f))
  .filter((f) => !dormant.has(f) && !f.startsWith('app/hub/'));

it('no live screen glues an English unit letter to a number', () => {
  const hits: string[] = [];
  for (const f of files) {
    stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8')).split('\n').forEach((l, i) => {
      if (SUFFIX.test(l)) hits.push(`${f}:${i + 1}  ${l.trim().slice(0, 90)}`);
    });
  }
  expect(hits).toEqual([]);
});

it('no live screen labels a figure "DSO"', () => {
  const hits = files.filter((f) => /['>]DSO['<]/.test(stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8'))));
  expect(hits).toEqual([]);
});

it.each(['en', 'nl', 'de', 'fr', 'es', 'it'])('%s has the compact units', (loc) => {
  const c = JSON.parse(fs.readFileSync(path.join(ROOT, `src/i18n/locales/${loc}.json`), 'utf8')).common;
  expect(c.daysCompact).toMatch(/\{\{count\}\}/);
  expect(c.hoursCompact).toMatch(/\{\{count\}\}/);
  expect(c.expired).toBeTruthy();
});

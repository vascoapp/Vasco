/**
 * @jest-environment node
 */
// An Alert with a SENTENCE as its only argument puts the sentence in the
// TITLE slot, which Android cuts at two lines: "Het downloaden is niet gelukt.
// Probeer het opnieuw voordat je v…" (emulator walk 2026-09-28, delete
// account). Give it a short title and the sentence as the body.
// Checked in NL and DE (the longest) for every screen a contractor can reach.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';
import nl from '../i18n/locales/nl.json';
import de from '../i18n/locales/de.json';
import manifest from '../config/dormant.files.json';

const ROOT = path.resolve(__dirname, '../..');
const dormant = new Set((manifest as any).files as string[]);
const MAX_TITLE = 40;

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}
const lookup = (obj: any, key: string) => key.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);

it('no reachable single-argument Alert puts a sentence in the title', () => {
  const files = ['app', 'src/components', 'src/services'].flatMap((d) => walk(path.join(ROOT, d)))
    .filter((f) => !dormant.has(path.relative(ROOT, f)));
  expect(files.length).toBeGreaterThan(100);
  const bad: string[] = [];
  for (const f of files) {
    const src = stripComments(fs.readFileSync(f, 'utf8'));
    for (const m of src.matchAll(/Alert\.alert\(\s*t\(\s*'([\w.]+)'(?:\s*,\s*(?:'[^']*'|\{[^}]*\}))*\s*\)\s*\)/g)) {
      for (const [lang, cat] of [['nl', nl], ['de', de]] as const) {
        const v = lookup(cat, m[1]);
        if (typeof v === 'string' && v.length > MAX_TITLE) bad.push(`${path.relative(ROOT, f)}: ${m[1]} (${lang}, ${v.length} chars)`);
      }
    }
  }
  expect(bad).toEqual([]);
});

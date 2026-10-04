/**
 * A screen-header subtitle fits its one line in every language.
 *
 * DKScreenHeader renders the subtitle UPPERCASE, letter-spaced, numberOfLines
 * 1. The German VAT report read "FÜR IHRE STEUERBERATUNG ODER DAS STEUE…" on
 * the emulator (2026-10-04) — about 38 characters fit on a mid-size phone, so
 * 32 is the budget (a {{count}} is measured as "30").
 *
 * Covers every `subtitle={t('key'…)}` in app/. A subtitle built from a
 * variable is not covered — name it a key or measure it here.
 */
import * as fs from 'fs';
import * as path from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const LOCALES = ['en', 'nl', 'de', 'fr', 'es', 'it'];
const MAX = 32;

const tables = Object.fromEntries(LOCALES.map((l) => [l, JSON.parse(fs.readFileSync(path.join(ROOT, `src/i18n/locales/${l}.json`), 'utf8'))]));
const lookup = (table: any, key: string): string[] => {
  const parts = key.split('.');
  const last = parts.pop()!;
  let node = table;
  for (const p of parts) node = node?.[p];
  if (!node || typeof node !== 'object') return [];
  return Object.entries(node)
    .filter(([k, v]) => typeof v === 'string' && (k === last || k.startsWith(`${last}_`)))
    .map(([, v]) => v as string);
};

const files: string[] = [];
const walk = (dir: string) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (e.name.endsWith('.tsx')) files.push(full);
  }
};
walk(path.join(ROOT, 'app'));

const keys = new Set<string>();
for (const f of files) {
  for (const m of stripComments(fs.readFileSync(f, 'utf8')).matchAll(/subtitle=\{t\('([^']+)'/g)) keys.add(m[1]);
}

describe('screen-header subtitles', () => {
  it('finds the subtitles at all', () => {
    expect(keys.has('vatReport.subtitle')).toBe(true);
    expect(keys.has('quoteToInvoice.autoNumberDue')).toBe(true);
  });

  it(`fit ${MAX} characters in every language`, () => {
    const tooLong: string[] = [];
    for (const key of keys) {
      for (const l of LOCALES) {
        const forms = lookup(tables[l], key);
        if (!forms.length) tooLong.push(`${l} ${key}: missing`);
        for (const s of forms) {
          const shown = s.replace(/\{\{\s*count\s*\}\}/g, '30');
          if (shown.length > MAX) tooLong.push(`${l} ${key}: ${shown.length} "${shown}"`);
        }
      }
    }
    expect(tooLong).toEqual([]);
  });
});

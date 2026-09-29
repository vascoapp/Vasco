/**
 * @jest-environment node
 */
// The "fill in your business details" alert names the missing fields in the
// contractor's language — it listed "• Business name • Business address" in
// English under a Dutch sentence (emulator walk 2026-09-28).
// (jest's global i18n mock returns defaults, so this checks what can be
// checked honestly: every field key exists in all six catalogues, and the
// code translates by that key.)
import fs from 'fs';
import path from 'path';
import { getRequiredFields } from '../utils/businessProfileValidation';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const countries = ['NL', 'DE', 'FR', 'ES', 'IT', 'UK', undefined] as const;

it('every required-field key has a label in all six languages', () => {
  const keys = new Set(countries.flatMap((c) => getRequiredFields(c as any).map((f) => f.key)));
  expect(keys.size).toBeGreaterThan(8);
  for (const lang of ['en', 'nl', 'de', 'fr', 'es', 'it']) {
    const cat = JSON.parse(fs.readFileSync(path.join(ROOT, `src/i18n/locales/${lang}.json`), 'utf8'));
    for (const k of keys) {
      const v = k.split('.').reduce((o: any, p) => (o ? o[p] : undefined), cat);
      expect([lang, k, typeof v]).toEqual([lang, k, 'string']);
    }
  }
});

it('missing fields are reported through i18n, not the English label', () => {
  const src = stripComments(fs.readFileSync(path.join(ROOT, 'src/utils/businessProfileValidation.ts'), 'utf8'));
  expect(src).toMatch(/missingLabels\.push\(i18n\.t\(f\.key/);
  expect(src).not.toMatch(/missingLabels\.push\(f\.label\)/);
});

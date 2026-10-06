/**
 * Every PDF the app prints is A4. expo-print defaults to US Letter; only the
 * quote PDF passed a size, so invoices, VAT reports and receipts in all six
 * markets were Letter — and a one-line French invoice spilled its legal footer
 * onto page 2 (FR walk, 2026-10-06).
 */
import * as fs from 'fs';
import * as path from 'path';
import { stripComments } from '../utils/stripComments';
import { A4_PAGE } from '../utils/pdfPage';

const ROOT = path.join(__dirname, '../..');
function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : files(p);
    return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}

it('A4 is 595 × 842 points', () => {
  expect(A4_PAGE).toEqual({ width: 595, height: 842 });
});

it('every printToFileAsync call passes the A4 page', () => {
  const calls: string[] = [];
  for (const f of [...files(path.join(ROOT, 'src')), ...files(path.join(ROOT, 'app'))]) {
    const src = stripComments(fs.readFileSync(f, 'utf8'));
    for (const m of src.matchAll(/printToFileAsync\(\{([^}]*(?:\{[^}]*\}[^}]*)*)\}\)/g)) {
      calls.push(path.relative(ROOT, f));
      expect({ file: path.relative(ROOT, f), a4: /\.\.\.A4_PAGE/.test(m[1]) }).toEqual({ file: path.relative(ROOT, f), a4: true });
    }
  }
  expect(calls.length).toBeGreaterThanOrEqual(6);
});

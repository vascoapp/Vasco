// "45.5 × € 9,75" on a Dutch quote builder, quote, invoice and PDF (walk,
// 2026-09-29): a quantity interpolated raw prints an English point. Live
// screens print quantities through formatQuantity (src/i18n/formatting).
import fs from 'fs';
import path from 'path';
import manifest from '../config/dormant.files.json';
import { stripComments } from '../utils/stripComments';
import { formatQuantity } from '../i18n/formatting';

const ROOT = path.resolve(__dirname, '../..');
const dormant = new Set((manifest as any).files as string[]);
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(p);
  return /\.tsx?$/.test(e.name) ? [p] : [];
});
// `{x.quantity} ×`, `${x.quantity} ×`, `{x.quantity} {x.unit}`
const RAW = /\$?\{[\w.?]*[qQ]uantity\}\s*(?:×|x\s|\{[\w.?]*unit\})/;

it('formatQuantity writes the market decimal', () => {
  expect(formatQuantity(45.5, 'NL')).toBe('45,5');
  expect(formatQuantity(45, 'DE')).toBe('45');
  expect(formatQuantity(45.5, 'UK')).toBe('45.5');
});

it('no live file prints a raw quantity', () => {
  const hits = ['app', 'src/components', 'src/services'].flatMap((d) => walk(path.join(ROOT, d)))
    .map((f) => path.relative(ROOT, f))
    .filter((f) => !dormant.has(f) && !f.startsWith('app/hub/'))
    .flatMap((f) => stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8')).split('\n')
      .map((l, i) => (RAW.test(l) ? `${f}:${i + 1}` : null)).filter(Boolean) as string[]);
  expect(hits).toEqual([]);
});

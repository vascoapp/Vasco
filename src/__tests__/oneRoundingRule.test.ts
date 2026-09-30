// ONE commercial rounding rule for money. #354 fixed `round2` in
// src/domain/business.ts (float representation: 124,605 is 124.60499… in
// binary; sign: −0,285 must round like +0,285) — and ten private copies kept
// the old `Math.round(n * 100) / 100`, among them the XRechnung, Facturae and
// FatturaPA generators, DATEV, Lexoffice, the invoice PDF source and progress
// billing. The XML then stated 822,18 where the PDF stated 822,19 (#360,
// 2026-09-30). Money that reaches a document, a filing or a bill imports the
// shared one.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '..');
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(p);
  return /\.tsx?$/.test(e.name) ? [path.relative(ROOT, p)] : [];
});

// Estimates and insights — never printed on a document, never filed.
const ANALYTICS_ONLY = new Set([
  'services/jobCostTrackingService.ts',
  'services/estimationFeedbackService.ts',
  'intelligence/generators/supplierPriceAnomalyGenerator.ts',
]);

it('no money path defines its own round2', () => {
  const offenders = walk(ROOT)
    .filter((f) => f !== 'domain/business.ts' && !ANALYTICS_ONLY.has(f))
    .filter((f) => /\b(const|function)\s+round2\b/.test(stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8'))));
  expect(offenders).toEqual([]);
});

it('the e-invoice generators use the shared rule', () => {
  for (const f of ['integrations/einvoice.ts', 'integrations/einvoice-es.ts', 'integrations/einvoice-it.ts']) {
    expect(`${f}: ${/import \{[^}]*\bround2\b[^}]*\} from '\.\.\/domain\/business'/.test(fs.readFileSync(path.join(ROOT, f), 'utf8'))}`).toBe(`${f}: true`);
  }
});

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
    .filter((f) => f !== 'utils/round2.ts' && !ANALYTICS_ONLY.has(f))
    .filter((f) => /\b(const|function)\s+round2\b/.test(stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8'))));
  expect(offenders).toEqual([]);
});

it('the e-invoice generators use the shared rule', () => {
  for (const f of ['integrations/einvoice.ts', 'integrations/einvoice-es.ts', 'integrations/einvoice-it.ts']) {
    expect(`${f}: ${/import \{[^}]*\bround2\b[^}]*\} from '\.\.\/domain\/business'/.test(fs.readFileSync(path.join(ROOT, f), 'utf8'))}`).toBe(`${f}: true`);
  }
});

// The INLINE shape too (review, 2026-09-30): `Math.round(x * 100) / 100` has
// both bugs a named copy has, and 42 of them sat on money paths — the VAT
// return draft, payroll, the late-fee claim, job billing, the tax helpers.
// These files put money on a document, a filing or a stored amount.
const MONEY_FILES = [
  'constants/taxRates.ts', 'domain/documents.ts', 'services/jobBillingBasis.ts', 'services/lateFeeService.ts',
  'services/vatPrepService.ts', 'services/payrollService.ts', 'services/purchaseOrderService.ts',
  'services/expenseService.ts', 'services/accountantHandoverService.ts', 'services/dutchComplianceService.ts',
  'services/invoiceAutomationService.ts', 'services/quoteTierPresetService.ts', 'services/invoiceScanService.ts',
  'state/AppState.tsx', 'components/contractor/TieredQuoteBuilder.tsx',
  'integrations/einvoice.ts', 'integrations/einvoice-es.ts', 'integrations/einvoice-it.ts', 'integrations/einvoice-fr.ts',
  'integrations/datev.ts', 'integrations/lexoffice.ts', 'services/invoicePdfService.ts', 'services/quotePdfService.ts',
  'services/invoicePdfSource.ts', 'services/progressBillingService.ts', 'services/decisionUpgradeBilling.ts',
];
const APP_MONEY_FILES = ['../app/invoices/[id].tsx', '../app/contractor/pricebook/[id].tsx'];

it('no money file rounds cents inline', () => {
  const offenders: string[] = [];
  for (const f of [...MONEY_FILES, ...APP_MONEY_FILES]) {
    const src = stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    src.split('\n').forEach((line, i) => {
      if (/Math\.round\([^;]*\*\s*100\)\s*\/\s*100(?![\d.])/.test(line)) offenders.push(`${f}:${i + 1}: ${line.trim()}`);
    });
  }
  expect(offenders).toEqual([]);
});

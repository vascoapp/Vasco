/**
 * @jest-environment node
 */
// A document's fallback VAT rate is the CONTRACTOR's effective rate, never the
// country's standard rate. `getVATRate(country)` charges a Kleinunternehmer
// (§19 UStG) or a KOR contractor VAT they may not charge — on the quote screen,
// on the PDF, and on the acceptance link the customer confirms (#339, money
// sweep 2026-09-16). `getEffectiveVatRate(profile)` returns 0 for both.
//
// Line rates still win over either: `documentVatBreakdown` decides.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const DOCUMENT_SCREENS = [
  'app/quotes/[id].tsx',
  'app/invoices/[id].tsx',
  'app/(contractor)/facturen.tsx',
  'app/contractor/tiered-quote.tsx',
];

describe('document screens fall back to the effective rate', () => {
  it.each(DOCUMENT_SCREENS)('%s never reaches for the country standard rate', (rel) => {
    const src = stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
    expect({ rel, usesCountryStandard: /\bgetVATRate\s*\(|\bgetStandardVatRate\s*\(/.test(src) })
      .toEqual({ rel, usesCountryStandard: false });
  });

  it('at least one of them computes a breakdown at all (the check is live)', () => {
    const any = DOCUMENT_SCREENS.some((rel) =>
      /documentVatBreakdown\s*\(|getEffectiveVatRate\s*\(/.test(
        stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8')),
      ));
    expect(any).toBe(true);
  });
});

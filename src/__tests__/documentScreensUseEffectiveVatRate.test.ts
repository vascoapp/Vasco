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

  // ⚠️ "at least ONE of them" let the other three rot, and an absence check
  // alone is satisfied by a hardcoded rate. Every screen must name the
  // effective-rate helper, and none may inline a country→rate table
  // (meta-sweep 2026-09-17).
  // `tiered-quote.tsx` derives NO rate: it forwards the line's own
  // (`item.vatRate ?? tier.vatRate`), which is the #253 fix and must stay that
  // way. The others compute a fallback and must take the EFFECTIVE one.
  const RATE_DERIVING = DOCUMENT_SCREENS.filter((r) => !r.endsWith('tiered-quote.tsx'));

  it('the forwarding screen still forwards instead of deriving', () => {
    const src = stripComments(fs.readFileSync(path.join(ROOT, 'app/contractor/tiered-quote.tsx'), 'utf8'));
    expect(src).toMatch(/vatRate:\s*item\.vatRate \?\? tier\.vatRate/);
  });

  it.each(RATE_DERIVING)('%s computes its rate through the effective-rate helper', (rel) => {
    const src = stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
    expect({ rel, usesHelper: /documentVatBreakdown\s*\(|getEffectiveVatRate\s*\(/.test(src) })
      .toEqual({ rel, usesHelper: true });
  });

  it.each(DOCUMENT_SCREENS)('%s does not hardcode a country rate', (rel) => {
    const src = stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
    // e.g. `country === 'DE' ? 0.19 : 0.21` or `? 19 : 21`
    const hardcoded = /country\s*===\s*'[A-Z]{2}'\s*\?\s*0?\.?\d+\s*:\s*0?\.?\d+/.test(src);
    expect({ rel, hardcoded }).toEqual({ rel, hardcoded: false });
  });
});

/**
 * @jest-environment node
 */
// A country-dependent value must SKIP when the country is unknown, never
// default to the home market (CLAUDE.md; learnings #148/#151/#155/#157), and
// the business PROFILE outranks the account (#218).
//
// The sweep of 2026-09-17 found these still defaulting, each with a real
// consequence: a French contractor was shown a Dutch BTW-aangifte with a DigiD
// button, a German contractor's invoice EMAIL went out in Dutch, the legal and
// certificate screens handed him the Dutch compliance pack, an imported
// supplier sheet was booked at 21%, and every expense line said "21% btw".
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const read = (rel: string) => stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

describe('the VAT return refuses a market it cannot prepare', () => {
  const screen = read('app/contractor/vat-prep.tsx');
  const queue = read('src/services/aiActionQueueService.ts');

  it('the screen refuses instead of coercing every country to NL', () => {
    expect(screen).toMatch(/vatReturnSupported/);
    expect(screen).toMatch(/if \(!vatReturnSupported\)/);
    expect(screen).toMatch(/vatPrep\.unsupportedTitle/);
  });

  it('the quarter-end card is only queued for a supported market', () => {
    const at = queue.indexOf("type: 'tax_prep'");
    expect(at).toBeGreaterThan(-1);
    // Look back from the card to the condition that guards it.
    const before = queue.slice(Math.max(0, at - 1200), at);
    expect(before).toMatch(/vatReturnSupported/);
  });
});

describe('customer-facing language and compliance follow the profile', () => {
  it('the invoice email takes the ACTIVE language, not the account default', () => {
    const src = read('app/invoices/[id].tsx');
    expect(src).toMatch(/const language = messageLocale\(\)/);
    expect(src).not.toMatch(/user\?\.language \?\? 'nl'/);
  });

  it.each([
    ['app/contractor/legal.tsx', 'userCountry'],
    ['app/(contractor)/certificaten.tsx', 'country'],
  ])('%s picks its compliance pack profile-first', (rel, varName) => {
    const src = read(rel);
    const at = src.indexOf(`const ${varName} =`);
    expect(at).toBeGreaterThan(-1);
    const decl = src.slice(at, src.indexOf(';', at));
    expect(decl).toMatch(/businessProfile\??\.country/);
  });
});

describe('an unknown country does not become the Dutch VAT rate', () => {
  // ⚠️ `[^)]*` cannot cross the inner `)` of `getCurrentCountry()`, so the first
  // version of this matched nothing and a decoy sailed through it.
  it.each([
    ['src/ingestion/spreadsheetExtractor.ts', /getStandardVatRate\([\s\S]{0,160}?\?\?\s*'NL'/],
    ['app/contractor/expenses.tsx', /getVATRate\([\s\S]{0,160}?\?\?\s*'NL'/],
  ])('%s does not re-add the default', (rel, pattern) => {
    expect(read(rel)).not.toMatch(pattern);
  });
});

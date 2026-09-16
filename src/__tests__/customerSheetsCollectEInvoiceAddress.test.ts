/**
 * @jest-environment node
 */
// A German e-invoice is invalid without the BUYER's post code and city
// (BR-DE-8/9); Facturae and FatturaPA need them too. Both "new customer"
// sheets collected a single free-text address line, which cannot be split
// reliably ("Marktplatz 3, 10178 Berlin" vs "Via Roma 1 — 20100 Milano (MI)"),
// so `customers.postcode` / `.city` stayed null for every customer added in
// the app — the columns have existed since SCHEMA_LOCK v1.19 (#339).
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const SHEETS = ['app/contractor/customer-crm.tsx', 'app/(contractor)/bedrijf.tsx'];

describe('both new-customer sheets collect post code and city', () => {
  it.each(SHEETS)('%s has the fields', (rel) => {
    const src = stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
    expect(src).toMatch(/postcodePlaceholder/);
    expect(src).toMatch(/cityPlaceholder/);
  });

  it.each(SHEETS)('%s passes them to addCustomer', (rel) => {
    const src = stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
    const at = src.indexOf('addCustomer(');
    expect(at).toBeGreaterThan(-1);
    const call = src.slice(at, src.indexOf(');', at));
    expect(call).toMatch(/postcode:/);
    expect(call).toMatch(/city:/);
  });
});

describe('icon-only controls have a name', () => {
  it('the home notification bell is labelled', () => {
    const src = fs.readFileSync(path.join(ROOT, 'app/(contractor)/index.tsx'), 'utf8');
    const at = src.indexOf('styles.bellBtn');
    const tag = src.slice(Math.max(0, at - 200), at + 400);
    expect(tag).toMatch(/accessibilityLabel=/);
  });
});

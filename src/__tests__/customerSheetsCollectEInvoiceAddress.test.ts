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
// ONE customer form (#365). There were three, each missing what another had:
// the Free-plan limit and duplicate check lived only in customer-crm, the VAT
// id and Italian e-invoice fields only in (modals)/customers.
const FORM = 'src/components/shared/AddCustomerSheet.tsx';
const read = (rel: string) => stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

describe('the one customer form', () => {
  const src = read(FORM);

  it('collects post code, city and VAT id and passes them on', () => {
    expect(src).toMatch(/customersModal\.fieldPostcode/);
    expect(src).toMatch(/customersModal\.fieldCity/);
    expect(src).toMatch(/customersModal\.fieldVatId/);
    const structured = src.slice(src.indexOf('const structured = {'), src.indexOf('};', src.indexOf('const structured = {')));
    expect(structured).toMatch(/postcode:/);
    expect(structured).toMatch(/city:/);
    expect(structured).toMatch(/vatId:/);
    expect(src).toMatch(/addCustomer\([\s\S]{0,160}orUndefined\(structured\)/);
  });

  it('applies the plan limit and the duplicate check before adding', () => {
    expect(src).toMatch(/canAddClient\(sub, customers\.length\)/);
    expect(src).toMatch(/findDuplicates\(/);
  });

  it('edits as well as adds', () => {
    expect(src).toMatch(/updateCustomer\(customer\.id/);
  });

  it('every screen that adds a customer uses it', () => {
    for (const rel of [
      'app/(contractor)/bedrijf.tsx', 'app/contractor/tiered-quote.tsx', 'app/contractor/recurring/[id].tsx',
      'app/contractor/customer-crm.tsx', 'app/(modals)/customers.tsx',
    ]) {
      expect({ rel, uses: /<AddCustomerSheet\b/.test(read(rel)) }).toEqual({ rel, uses: true });
    }
  });

  it('no screen or component calls addCustomer( itself — a fourth form cannot appear', () => {
    const glob = require('glob') as { sync: (p: string, o?: any) => string[] };
    const files = [...glob.sync('app/**/*.tsx', { cwd: ROOT }), ...glob.sync('src/components/**/*.tsx', { cwd: ROOT })]
      .filter((f) => !f.includes('__tests__') && !f.startsWith('app/hub/') && f !== FORM);
    const offenders = files.filter((f) => /\baddCustomer\(/.test(read(f)));
    expect(offenders).toEqual([]);
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

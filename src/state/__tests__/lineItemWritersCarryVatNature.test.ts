/**
 * @jest-environment node
 */
// Every writer of a `line_items` row carries the line's VAT NATURE beside its
// rate, and both read mappers bring it back (Italy, migration 20261003000001).
//
// The class (#205, #319, R83): a field written by SOME of the paths a row
// takes. A line's rate already went through this — "written at every create
// and never read back", then "the heal dropped it" (2026-09-30). The nature
// rides the same paths: create quote, quote → invoice, job → invoice, edit
// lines, the offline heal. One path without it and a reverse-charge line
// silently becomes a bare 0 % that the FatturaPA export refuses on every other
// device. Static on purpose: the defect is textual — an object literal with
// `vat_rate:` and no `vat_nature:`.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../../utils/stripComments';
import { lineItemRowToQuoteLineItem } from '../../lib/mappers';

const read = (rel: string) => stripComments(fs.readFileSync(path.resolve(__dirname, '../..', rel), 'utf8'));

/** The object literals that build a line_items row: `{ … unit_price: … vat_rate: … }`. */
function lineRowLiterals(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/vat_rate:/g)) {
    // Walk back to the literal's opening brace and forward to its close.
    let depth = 0;
    let start = m.index!;
    for (; start >= 0; start--) {
      const c = src[start];
      if (c === '}') depth++;
      else if (c === '{') { if (depth === 0) break; depth--; }
    }
    let end = m.index!;
    depth = 0;
    for (; end < src.length; end++) {
      const c = src[end];
      if (c === '{') depth++;
      else if (c === '}') { if (depth === 0) break; depth--; }
    }
    const lit = src.slice(start, end + 1);
    if (/unit_price\s*:/.test(lit)) out.push(lit);
  }
  return out;
}

describe('line_items writers carry vat_nature', () => {
  for (const file of ['state/AppState.tsx', 'lib/dataProvider.ts']) {
    it(`${file}: every row literal with vat_rate also writes vat_nature`, () => {
      const lits = lineRowLiterals(read(file));
      const missing = lits.filter((l) => !/vat_nature\s*:/.test(l)).map((l) => l.replace(/\s+/g, ' ').slice(0, 140));
      expect(missing).toEqual([]);
    });
  }

  it('finds the writers at all (create quote, quote→invoice, edit lines, job→invoice, heal)', () => {
    // A regex that matches nothing reports a clean sweep (#177).
    expect(lineRowLiterals(read('state/AppState.tsx')).length).toBeGreaterThanOrEqual(4);
    expect(lineRowLiterals(read('lib/dataProvider.ts')).length).toBeGreaterThanOrEqual(1);
  });

  it('every writer goes through lineVatNature (a valid code, at 0 % only — the CHECK can never reject it)', () => {
    for (const file of ['state/AppState.tsx', 'lib/dataProvider.ts']) {
      for (const l of lineRowLiterals(read(file))) expect(l).toMatch(/vat_nature:\s*lineVatNature\(/);
    }
  });
});

describe('both read mappers bring it back', () => {
  it('lineItemRowToQuoteLineItem', () => {
    const row = { id: 'l', user_id: 'u', document_id: 'd', description: 'Subappalto', quantity: 1, unit_price: 900, total_price: 900, position: 0, vat_rate: 0, vat_nature: 'N6.3', created_at: '', updated_at: '' };
    expect(lineItemRowToQuoteLineItem(row).vatNature).toBe('N6.3');
    expect(lineItemRowToQuoteLineItem({ ...row, vat_nature: null }).vatNature).toBeUndefined();
    // A value the app does not know is not passed on as if it were a code.
    expect(lineItemRowToQuoteLineItem({ ...row, vat_nature: 'N6' }).vatNature).toBeUndefined();
  });

  it('loadLineItems (the cold-start read) maps vat_nature too', () => {
    const src = read('lib/dataProvider.ts');
    const body = src.slice(src.indexOf('export async function loadLineItems'), src.indexOf('export async function loadBusinessProfile'));
    expect(body).toMatch(/vatNature:\s*row\.vat_nature/);
  });
});

/**
 * A document's customer is SHOWN by name, never by id (#214, IT walk
 * 2026-10-06).
 *
 * `quote.customer` holds the customer's id on every quote the builder makes.
 * The Finanze quote list printed it raw — "d4c3e5c1-42fa-48d7-a082-67389…"
 * where "Edilizia Bianchi S.r.l." belongs — and the same `x.customer ||` read
 * sat in the AI follow-up card, the overdue notification, the payment list,
 * bank matching and the filings list. `findDocumentCustomer(...)?.name ??
 * x.customer` still printed the id once the customer was deleted.
 *
 * Rule: every live read of a document's `customer` for display goes through
 * `documentCustomerName` (or `findDocumentCustomer`), in every live file.
 */
import * as fs from 'fs';
import * as path from 'path';
import { stripComments } from '../utils/stripComments';
import { documentCustomerName } from '../domain/customers';

const ROOT = path.resolve(__dirname, '../..');
const dormant = new Set<string>(JSON.parse(fs.readFileSync(path.join(ROOT, 'src/config/dormant.files.json'), 'utf8')).files);

describe('documentCustomerName', () => {
  const customers = [{ id: '0b8c2f4e-1111-4222-8333-944455556666', name: 'Edilizia Bianchi S.r.l.' }];

  it('names the customer whose id sits in the name slot', () => {
    expect(documentCustomerName(customers, { customer: '0b8c2f4e-1111-4222-8333-944455556666' })).toBe('Edilizia Bianchi S.r.l.');
  });
  it('names the customer by FK', () => {
    expect(documentCustomerName(customers, { customerId: '0b8c2f4e-1111-4222-8333-944455556666', customer: 'x' })).toBe('Edilizia Bianchi S.r.l.');
  });
  it('keeps a name that is a name', () => {
    expect(documentCustomerName([], { customer: 'Bäckerei Jansen' })).toBe('Bäckerei Jansen');
  });
  it('prefers the document’s own customerName over an unresolvable slot', () => {
    expect(documentCustomerName([], { customer: 'c-1787349342347', customerName: 'Mario Rossi' })).toBe('Mario Rossi');
  });
  it.each(['d4c3e5c1-42fa-48d7-a082-673898576058', 'c-1787349342347', 'cust-003'])(
    'never returns an id (%s) — a deleted customer is blank, not a uuid',
    (id) => { expect(documentCustomerName(customers, { customer: id })).toBe(''); },
  );
});

describe('no live file shows a document’s raw customer slot', () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (!['__tests__', 'node_modules', 'test-utils'].includes(e.name)) walk(full); }
      else if (/\.tsx?$/.test(e.name)) files.push(path.relative(ROOT, full));
    }
  };
  walk(path.join(ROOT, 'app'));
  walk(path.join(ROOT, 'src'));

  // A document variable's `.customer` used as a VALUE: `x.customer ||`,
  // `x.customer ??`, `{x.customer}` in JSX, `${x.customer}` in a template.
  // Comparisons (`=== x.customer`), writes and `.customer?.trim()` are not shown.
  const DOC = '(?:q|quote|inv|invoice|doc|document|d)';
  // …and as the FALLBACK on the right of one (`name ?? inv.customer`,
  // `cust?.name || q.customer`) — the shape the review found in five live
  // places the first version of this guard let through.
  const SHOWN = new RegExp(
    `(?:\\b${DOC}\\??\\.customer\\s*(?:\\|\\||\\?\\?)`
    + `|(?:\\|\\||\\?\\?)\\s*\\(?\\s*(?:\\w+\\.)?${DOC}\\??\\.customer\\b(?!\\w|\\?\\.|\\.)`
    + `|\\{${DOC}\\??\\.customer\\}|\\$\\{${DOC}\\??\\.customer\\})`,
    'g',
  );
  /** Reads that want the ID (the slot holds one on builder quotes) — never shown. */
  const ALLOWED_LINE = [
    /\bcustomerId\s*[:?]/, // `customerId: quote.customer ?? ''`, `customerId ?? quote.customer`
    /\b\w*[cC]ustId\s*=/, // `const custId = inv.customerId || inv.customer`
    /looksLikeId\(/, // already refuses an id before showing the slot
  ];
  /** The resolver itself reads the slot. */
  const ALLOWED_FILE = new Set(['src/domain/customers.ts']);

  it('every display read resolves the customer', () => {
    const offenders: string[] = [];
    for (const f of files) {
      if (dormant.has(f) || ALLOWED_FILE.has(f)) continue;
      const src = stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8'));
      const lines = src.split('\n');
      for (const m of src.matchAll(SHOWN)) {
        const n = src.slice(0, m.index).split('\n').length;
        if (ALLOWED_LINE.some((re) => re.test(lines[n - 1]))) continue;
        offenders.push(`${f}:${n}  ${lines[n - 1].trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

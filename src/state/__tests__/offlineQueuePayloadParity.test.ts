/**
 * An offline write must persist the SAME fields the online write does.
 *
 * `persistOrQueue(table, op, onlineFn, { rowId, payload })` has two independent
 * descriptions of one mutation: the lambda that runs when there is a network,
 * and the `payload` the flush replays when there is not. They are authored
 * separately, right next to each other, and nothing made them agree — which is
 * learnings #370's whole class.
 *
 * Two live instances when this test was written: `markInvoiceSent` and
 * `markInvoicePaid` called `updateDocument(id, { status, sent_at/paid_at })`
 * but queued `{ status }` alone. An invoice marked sent or paid while offline
 * came back with a NULL timestamp — and `sentAt`/`paidAt` are what DSO, ageing
 * and the customer ledger are computed from. Not a crash; a number quietly
 * wrong forever after, which is the most expensive shape in this codebase.
 *
 * The tell was that `markQuoteSent`, a hundred lines above, already carried
 * `sent_at` in its payload. When one call site defends against a hazard and its
 * neighbour does not, the neighbour is the bug (#173).
 *
 * Static on purpose: exercising every mutator through a mocked queue would test
 * the mock. The defect is textual — two object literals that must match — so
 * the check reads the text.
 */
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(path.join(__dirname, '..', 'AppState.tsx'), 'utf8');

/** Keys of a flat object-literal body. */
const keysOf = (body: string) => new Set([...body.matchAll(/(\w+)\s*:/g)].map((m) => m[1]));

/**
 * Single-line form:
 *   persistOrQueue('t','op', () => fn(id, { A }), { rowId: id, payload: { B } })
 * Multi-line calls are matched separately below; between them these cover every
 * site that inlines both objects. A form this cannot parse is reported, not
 * skipped — an unparsed call site that prints as a pass is how a checker starts
 * lying (#177).
 */
const INLINE = /persistOrQueue\(\s*'(\w+)',\s*'(\w+)',\s*\(\)\s*=>\s*\w+\([^,]+,\s*\{([^}]*)\}\)\s*,\s*\{[^}]*payload:\s*\{([^}]*)\}/g;

const MULTILINE = /persistOrQueue\(\s*\n\s*'(\w+)',\s*'(\w+)',\s*\n\s*\(\)\s*=>\s*\w+\([^,]+,\s*\{([^}]*)\}[^\n]*\),\s*\n\s*\{[^}]*payload:\s*\{([^}]*)\}/g;

function mismatches(re: RegExp) {
  const out: string[] = [];
  for (const m of SRC.matchAll(re)) {
    const [, table, op, online, payload] = m;
    const lost = [...keysOf(online)].filter((k) => !keysOf(payload).has(k));
    if (lost.length) {
      const line = SRC.slice(0, m.index).split('\n').length;
      out.push(`AppState.tsx:${line} ${table}.${op} — queued payload drops ${lost.join(', ')}`);
    }
  }
  return out;
}

describe('offline queue payload parity', () => {
  it('every queued update carries what the online update writes', () => {
    expect([...mismatches(INLINE), ...mismatches(MULTILINE)]).toEqual([]);
  });

  it('the two invoice-status mutators still stamp their timestamps', () => {
    // Named explicitly because these two are the reason the check exists, and a
    // regex refactor that stopped matching them would otherwise pass silently.
    for (const [fn, col] of [['markInvoiceSent', 'sent_at'], ['markInvoicePaid', 'paid_at']]) {
      const body = SRC.slice(SRC.indexOf(`${fn}: (id) =>`), SRC.indexOf(`${fn}: (id) =>`) + 2400);
      expect(body).toContain('persistOrQueue');
      const queued = body.slice(body.indexOf('payload:'), body.indexOf('payload:') + 120);
      expect(`${fn} queued payload: ${queued}`).toContain(col);
    }
  });

  it('finds the call sites at all', () => {
    // A regex that matches nothing reports a clean sweep. Pin the count so a
    // refactor that reformats these calls fails here rather than turning the
    // whole check into a no-op.
    const seen = [...SRC.matchAll(INLINE)].length + [...SRC.matchAll(MULTILINE)].length;
    expect(seen).toBeGreaterThanOrEqual(6);
  });
});

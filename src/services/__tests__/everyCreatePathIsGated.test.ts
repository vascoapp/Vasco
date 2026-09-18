/**
 * @jest-environment node
 */
// A cap enforced on one of eight entry points is not a cap.
//
// Sweep 2026-09-19: the Free monthly limits (10 quotes, 10 invoices) were
// checked on `app/quotes/new.tsx` and `app/quotes/[id]/invoice.tsx` — the
// SECONDARY routes — while the default "new quote" destination
// (`contractor/tiered-quote`, which the + on the invoices tab and the AI
// queue's `draft_quote` both open), all three job-screen invoice buttons, both
// branches of the invoice list's create sheet, and the decision-upgrade
// invoice had no gate at all. Payment links were gated on the list screen and
// not on the invoice detail screen or the customer deposit request.
//
// And the two that DID gate could not bite: they counted documents by
// `createdAt`, which none of the create-mutators set on the optimistic object,
// so the count was 0 for anything made in the session and permanently 0 on an
// install with no backend. (`recordQuoteUsage`/`recordInvoiceUsage` still have
// no callers — the live count replaces them.)
//
// This guard pins both halves: every creating call site goes through the one
// helper, and the optimistic rows carry the timestamp the helper counts.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../../utils/stripComments';
import { createdThisMonth } from '../tierGatePrompt';

const ROOT = path.resolve(__dirname, '../../..');
const read = (rel: string) => stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

/** Every screen that can mint a quote or an invoice, and the mutator it calls. */
const CREATE_SITES: { file: string; mutator: RegExp; kind: 'quote' | 'invoice' }[] = [
  { file: 'app/quotes/new.tsx', mutator: /await addQuote\(/, kind: 'quote' },
  { file: 'app/contractor/tiered-quote.tsx', mutator: /await addQuote\(/, kind: 'quote' },
  { file: 'app/quotes/[id]/invoice.tsx', mutator: /await addInvoice\(/, kind: 'invoice' },
  { file: 'app/contractor/job/[id].tsx', mutator: /await addInvoiceFromJob\(/, kind: 'invoice' },
  { file: 'app/(contractor)/facturen.tsx', mutator: /await addInvoiceFromJob\(/, kind: 'invoice' },
  { file: 'app/(contractor)/decisions.tsx', mutator: /await addInvoiceFromDecisionUpgrades\(/, kind: 'invoice' },
];

describe('every screen that creates a document asks the gate first', () => {
  it.each(CREATE_SITES)('$file gates its $kind create', ({ file, mutator, kind }) => {
    const src = read(file);
    expect({ file, creates: mutator.test(src) }).toEqual({ file, creates: true });
    expect({ file, gated: new RegExp(`ensureCanCreate\\('${kind}'`).test(src) })
      .toEqual({ file, gated: true });
  });

  it('every call to a create-mutator has a gate ABOVE it in the same file', () => {
    for (const { file, mutator, kind } of CREATE_SITES) {
      const src = read(file);
      const re = new RegExp(mutator.source, 'g');
      for (const m of src.matchAll(re)) {
        const before = src.slice(0, m.index);
        const lastGate = before.lastIndexOf(`ensureCanCreate('${kind}'`);
        // Within ~40 lines: the gate guards THIS call, not one far above it.
        const linesBetween = lastGate === -1 ? Infinity : before.slice(lastGate).split('\n').length;
        expect({ file, at: m.index, guarded: linesBetween < 40 })
          .toEqual({ file, at: m.index, guarded: true });
      }
    }
  });
});

describe('the payment-link entitlement is checked wherever a link is minted', () => {
  const SITES = [
    'app/(contractor)/facturen.tsx',       // list screen — the one that always had it
    'app/invoices/[id].tsx',               // detail screen
    'src/components/contractor/ShareDecisionTracker.tsx', // customer deposit
  ];
  it.each(SITES)('%s checks hasPaymentProcessing', (file) => {
    const src = read(file);
    const gated = /ensureCanUsePaymentLink\(\)/.test(src)
      || /canUseFeature\([^)]*'hasPaymentProcessing'\)/.test(src);
    expect({ file, gated }).toEqual({ file, gated: true });
  });
});

describe('the optimistic row carries the timestamp the cap counts', () => {
  const APPSTATE = read('src/state/AppState.tsx');

  it('every locally-built Quote/Invoice stamps createdAt', () => {
    // The four create-mutators build their optimistic object inline. Each of
    // those literals must set `createdAt`, or it is invisible to the count.
    const literals = [...APPSTATE.matchAll(/const (newQuote|newInvoice): (Quote|Invoice) = \{([\s\S]*?)\n        \};/g)];
    // Seven, not the four the sweep first named: the project-billing trio
    // (term instalment, change order, retention release) build invoices too.
    expect(literals.length).toBeGreaterThanOrEqual(7);
    for (const lit of literals) {
      expect({ kind: lit[1], at: lit.index, stamped: /createdAt: new Date\(\)\.toISOString\(\)/.test(lit[3]) })
        .toEqual({ kind: lit[1], at: lit.index, stamped: true });
    }
  });
});

describe('createdThisMonth counts what it should', () => {
  const now = new Date('2026-09-19T10:00:00');

  it('counts only this calendar month', () => {
    const rows = [
      { createdAt: '2026-09-01T00:00:00.000Z' },
      { createdAt: '2026-09-19T09:00:00.000Z' },
      // Mid-August, so no timezone reading of this instant lands in September.
      // (A 2026-08-31T23:00Z fixture is 01:00 on 1 September in CEST — the
      // count is right and the fixture was wrong, which is the same UTC-vs-
      // local-day trap the date helpers carry a note about.)
      { createdAt: '2026-08-15T12:00:00.000Z' },
    ];
    expect(createdThisMonth(rows, now)).toBe(2);
  });

  it('an unstamped row cannot be counted — which is why the stamp matters', () => {
    expect(createdThisMonth([{}, { createdAt: null }], now)).toBe(0);
  });

  it('survives rubbish without throwing', () => {
    expect(createdThisMonth([{ createdAt: 'not-a-date' }], now)).toBe(0);
    expect(createdThisMonth(undefined, now)).toBe(0);
    expect(createdThisMonth([], now)).toBe(0);
  });
});

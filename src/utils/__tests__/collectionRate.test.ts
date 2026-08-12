import { collectionRate, isIssued, issuedInvoices } from '../collectionRate';

type Inv = { status: 'draft' | 'sent' | 'paid' | 'overdue'; amount: number };

// The exact demo-account data that surfaced this on the Geld tab.
const DEMO: Inv[] = [
  { status: 'overdue', amount: 350 }, // Hotel NH
  { status: 'overdue', amount: 450 }, // Bouwgroep Atlas
  { status: 'paid', amount: 760 }, // Van Dijk
  { status: 'draft', amount: 640 }, // De Jong — never sent
];

describe('collectionRate', () => {
  it('reports collected/billed by VALUE, not by document count', () => {
    // Old rule: 1 paid of 4 documents = 25%, printed in red directly beneath
    // "OMZET € 760" and "UITSTAAND € 800". € 760 of the € 1.560 actually
    // billed is 49% — a different number AND a different colour band.
    expect(collectionRate(DEMO)).toBe(49);
  });

  it('excludes drafts from the denominator', () => {
    // Drafting an invoice must not make the collection rate worse: the
    // customer has not received it, so it cannot have been collected.
    const withoutDraft = DEMO.filter((i) => i.status !== 'draft');
    expect(collectionRate(DEMO)).toBe(collectionRate(withoutDraft));
  });

  it('does not move when a new draft is added', () => {
    const before = collectionRate(DEMO);
    const after = collectionRate([...DEMO, { status: 'draft', amount: 5000 }]);
    expect(after).toBe(before);
  });

  it('is 100 only when every issued invoice is paid', () => {
    expect(collectionRate([{ status: 'paid', amount: 100 }])).toBe(100);
    expect(
      collectionRate([
        { status: 'paid', amount: 100 },
        { status: 'sent', amount: 100 },
      ]),
    ).toBe(50);
  });

  it('counts sent-but-not-yet-due alongside overdue as billed', () => {
    // Both are money owed to the contractor; only `paid` is money received.
    expect(
      collectionRate([
        { status: 'paid', amount: 500 },
        { status: 'sent', amount: 250 },
        { status: 'overdue', amount: 250 },
      ]),
    ).toBe(50);
  });

  it('returns 0 when nothing has been billed, and callers gate on that', () => {
    expect(collectionRate([])).toBe(0);
    expect(collectionRate([{ status: 'draft', amount: 900 }])).toBe(0);
    // The badge must be hidden in that state rather than rendering a red 0% —
    // an empty set is not a bad outcome.
    expect(issuedInvoices([{ status: 'draft', amount: 900 } as Inv])).toHaveLength(0);
  });

  it('tolerates a missing amount without producing NaN', () => {
    const rate = collectionRate([
      { status: 'paid', amount: undefined as unknown as number },
      { status: 'sent', amount: 100 },
    ]);
    expect(Number.isNaN(rate)).toBe(false);
    expect(rate).toBe(0);
  });

  it('isIssued treats exactly sent/paid/overdue as issued', () => {
    expect(isIssued({ status: 'sent' })).toBe(true);
    expect(isIssued({ status: 'paid' })).toBe(true);
    expect(isIssued({ status: 'overdue' })).toBe(true);
    expect(isIssued({ status: 'draft' })).toBe(false);
  });
});

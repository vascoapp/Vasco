/**
 * The P&L was fabricated, and it exports to the contractor's accountant.
 *
 * `calculatePeriodFinancials` used to read:
 *
 *   costOfMaterials   = Math.round(revenue * 0.25)  // "25% heuristic"
 *   grossProfit       = revenue - costOfMaterials
 *   operatingExpenses = Math.round(revenue * 0.10)  // "10% heuristic"
 *   netIncome         = grossProfit - operatingExpenses
 *   profitMargin      = netIncome / revenue
 *
 * So on € 760 of real revenue the screen — and the shared PDF/CSV — reported
 * Materialkosten 190, Bruttogewinn 570, Betriebskosten 76, Nettogewinn 494 and
 * Marge 65%. Four invented figures and one real one, in a document titled
 * "Profit & Loss".
 *
 * These tests pin the rule from learnings #103: if no real field exists, the
 * honest answer is null and an omitted row — not a better guess.
 */
import { generateMonthlyReport } from '../financialReportService';

const paidInvoice = (id: string, amount: number, jobId?: string) => ({
  id,
  customer: 'Hotel NH',
  job: 'j',
  jobId,
  amount,
  status: 'paid' as const,
  dueInDays: 0,
  paidAt: '2026-08-12T10:00:00.000Z',
});

const AUG = 8, YEAR = 2026;

describe('the P&L never invents a cost', () => {
  it('reports NO material cost when job materials are not supplied', () => {
    // Absent data is not zero data. Before, this produced 25% of revenue.
    const r = generateMonthlyReport(AUG, YEAR, [paidInvoice('i1', 760, 'j1')] as never, []);
    expect(r.revenue).toBe(760);
    expect(r.costOfMaterials).toBeNull();
    expect(r.grossProfit).toBeNull();
    expect(r.profitMargin).toBeNull();
  });

  it('sums the REAL material cost of the jobs behind the paid invoices', () => {
    const r = generateMonthlyReport(
      AUG, YEAR,
      [paidInvoice('i1', 760, 'j1')] as never,
      [],
      undefined,
      { j1: [{ jobId: 'j1', totalPrice: 126 } as never, { jobId: 'j1', totalPrice: 64 } as never] },
    );
    expect(r.costOfMaterials).toBe(190);
    expect(r.grossProfit).toBe(570);
    // Gross margin, derived from a real cost — not net, which is unknowable.
    expect(r.profitMargin).toBe(75);
  });

  it('falls back to unitPrice x quantity when totalPrice was never written', () => {
    const r = generateMonthlyReport(
      AUG, YEAR,
      [paidInvoice('i1', 100, 'j1')] as never,
      [],
      undefined,
      { j1: [{ jobId: 'j1', unitPrice: 21, quantity: 2 } as never] },
    );
    expect(r.costOfMaterials).toBe(42);
  });

  it('ignores materials belonging to jobs that were not invoiced in the period', () => {
    const r = generateMonthlyReport(
      AUG, YEAR,
      [paidInvoice('i1', 760, 'j1')] as never,
      [],
      undefined,
      {
        j1: [{ jobId: 'j1', totalPrice: 190 } as never],
        j2: [{ jobId: 'j2', totalPrice: 5000 } as never],
      },
    );
    expect(r.costOfMaterials).toBe(190);
  });

  it('reports no operating expenses or net income when none are recorded', () => {
    const r = generateMonthlyReport(
      AUG, YEAR,
      [paidInvoice('i1', 760, 'j1')] as never,
      [],
      undefined,
      { j1: [{ jobId: 'j1', totalPrice: 190 } as never] },
    );
    expect(r.operatingExpenses).toBeNull();
    expect(r.netIncome).toBeNull();
  });

  it('omits unknown rows from lineItems, which is what the PDF/CSV writes', () => {
    const r = generateMonthlyReport(
      AUG, YEAR,
      [paidInvoice('i1', 760, 'j1')] as never,
      [],
      undefined,
      { j1: [{ jobId: 'j1', totalPrice: 190 } as never] },
    );
    const labels = r.lineItems.map(l => l.label);
    expect(labels).toContain('Cost of Materials');
    expect(labels).toContain('Gross Profit');
    // A zero row in an exported P&L asserts "no operating costs", which is a
    // claim the app cannot make.
    expect(labels).not.toContain('Operating Expenses');
    expect(labels).not.toContain('Net Income');
    expect(r.lineItems.every(l => Number.isFinite(l.amount))).toBe(true);
  });

  it('no P&L figure is ever a fixed percentage of revenue', () => {
    // The regression itself: 25% / 10% / 35% of revenue must not reappear.
    const r = generateMonthlyReport(
      AUG, YEAR,
      [paidInvoice('i1', 1000, 'j1')] as never,
      [],
      undefined,
      { j1: [{ jobId: 'j1', totalPrice: 123 } as never] },
    );
    expect(r.costOfMaterials).not.toBe(250);
    expect(r.costOfMaterials).toBe(123);
    expect(r.grossProfit).toBe(877);
  });
});

describe('an empty material set is UNKNOWN, not zero', () => {
  it('reports null when the paid invoices have no linked material rows', () => {
    // The second bug under the first: with the 25% heuristic gone, summing an
    // empty set gave Materialkosten 0,00 € and Bruttomarge 100% on the device.
    // Zero rows found is not zero spent.
    const r = generateMonthlyReport(
      AUG, YEAR,
      [paidInvoice('i1', 760, 'j1')] as never,
      [], undefined,
      { j2: [{ jobId: 'j2', totalPrice: 99 } as never] }, // different job
    );
    expect(r.costOfMaterials).toBeNull();
    expect(r.grossProfit).toBeNull();
    expect(r.profitMargin).toBeNull();
  });

  it('reports null when the paid invoice carries no jobId at all', () => {
    // The demo's own paid invoice is exactly this shape.
    const r = generateMonthlyReport(
      AUG, YEAR,
      [paidInvoice('i1', 760)] as never,
      [], undefined,
      { j1: [{ jobId: 'j1', totalPrice: 190 } as never] },
    );
    expect(r.costOfMaterials).toBeNull();
    expect(r.profitMargin).toBeNull();
  });

  it('never reports a 100% gross margin from an absence of data', () => {
    const r = generateMonthlyReport(
      AUG, YEAR,
      [paidInvoice('i1', 760, 'j1')] as never,
      [], undefined, {},
    );
    expect(r.profitMargin).not.toBe(100);
    expect(r.profitMargin).toBeNull();
  });

  it('still reports a REAL zero when a material row genuinely costs nothing', () => {
    // A recorded free/warranty part is a measurement, so it counts.
    const r = generateMonthlyReport(
      AUG, YEAR,
      [paidInvoice('i1', 760, 'j1')] as never,
      [], undefined,
      { j1: [{ jobId: 'j1', totalPrice: 0 } as never] },
    );
    expect(r.costOfMaterials).toBe(0);
    expect(r.grossProfit).toBe(760);
  });
});

describe('operating expenses come from the REAL expense ledger', () => {
  // Correcting an earlier assumption of mine: the app DOES capture expenses
  // (expenseService, persisted at @vasco_expenses, written by the receipt
  // scanner and manual entry). It merely starts empty, which is not the same
  // as having no feature.
  const expense = (amount: number, category = 'kantoor', date = '2026-08-05T09:00:00.000Z') =>
    ({ id: `e-${amount}-${category}`, description: 'x', category, amount, vatAmount: 0, vatRate: 0,
       date: new Date(date), deductible: true, deductionPercentage: 100 } as never);

  const withMaterials = { j1: [{ jobId: 'j1', totalPrice: 190 } as never] };

  it('sums recorded expenses and completes the P&L down to net income', () => {
    const r = generateMonthlyReport(
      AUG, YEAR, [paidInvoice('i1', 760, 'j1')] as never, [], undefined,
      withMaterials, [expense(76)],
    );
    expect(r.costOfMaterials).toBe(190);
    expect(r.grossProfit).toBe(570);
    expect(r.operatingExpenses).toBe(76);
    expect(r.netIncome).toBe(494);
    // Now a NET margin, because every cost is known.
    expect(r.profitMargin).toBe(65);
  });

  it('EXCLUDES material-category expenses — they are already in costOfMaterials', () => {
    // Double-counting a cost understates profit exactly as badly as inventing
    // one overstates it.
    const r = generateMonthlyReport(
      AUG, YEAR, [paidInvoice('i1', 760, 'j1')] as never, [], undefined,
      withMaterials, [expense(76), expense(500, 'materiaal')],
    );
    expect(r.operatingExpenses).toBe(76);
    expect(r.netIncome).toBe(494);
  });

  it('ignores expenses dated outside the period', () => {
    const r = generateMonthlyReport(
      AUG, YEAR, [paidInvoice('i1', 760, 'j1')] as never, [], undefined,
      withMaterials, [expense(76), expense(9999, 'kantoor', '2026-06-05T09:00:00.000Z')],
    );
    expect(r.operatingExpenses).toBe(76);
  });

  it('an empty ledger is UNKNOWN, so net income stays null', () => {
    const r = generateMonthlyReport(
      AUG, YEAR, [paidInvoice('i1', 760, 'j1')] as never, [], undefined,
      withMaterials, [],
    );
    expect(r.operatingExpenses).toBeNull();
    expect(r.netIncome).toBeNull();
    // Falls back to the GROSS margin rather than reporting a net one.
    expect(r.profitMargin).toBe(75);
  });
});

describe('receipt-only contractors are not left with an empty P&L', () => {
  // Self-review catch: costOfMaterials read ONLY job materials, while
  // material-category expenses were excluded from opex to avoid double
  // counting. So someone who scans supplier receipts but never attaches
  // materials to a job had that spend counted NOWHERE and the whole statement
  // collapsed to unknown — for a contractor who had recorded everything.
  const exp = (amount: number, category: string) =>
    ({ id: `e-${amount}-${category}`, description: 'x', category, amount, vatAmount: 0, vatRate: 0,
       date: new Date('2026-08-05T09:00:00.000Z'), deductible: true, deductionPercentage: 100 } as never);

  it('falls back to material-category expenses when no job materials exist', () => {
    const r = generateMonthlyReport(
      AUG, YEAR, [paidInvoice('i1', 760, 'j1')] as never, [], undefined,
      {}, [exp(190, 'materiaal'), exp(76, 'kantoor')],
    );
    expect(r.costOfMaterials).toBe(190);
    expect(r.grossProfit).toBe(570);
    expect(r.operatingExpenses).toBe(76);
    expect(r.netIncome).toBe(494);
  });

  it('does NOT add both sources — that would double-count one purchase', () => {
    // Materials logged on the job AND scanned as a receipt is one spend
    // recorded twice. Job-linked wins; the receipt is not added on top.
    const r = generateMonthlyReport(
      AUG, YEAR, [paidInvoice('i1', 760, 'j1')] as never, [], undefined,
      { j1: [{ jobId: 'j1', totalPrice: 190 } as never] },
      [exp(190, 'materiaal')],
    );
    expect(r.costOfMaterials).toBe(190);
    expect(r.costOfMaterials).not.toBe(380);
  });

  it('still unknown when neither source has anything', () => {
    const r = generateMonthlyReport(
      AUG, YEAR, [paidInvoice('i1', 760, 'j1')] as never, [], undefined, {}, [exp(76, 'kantoor')],
    );
    expect(r.costOfMaterials).toBeNull();
    expect(r.netIncome).toBeNull();
  });
});

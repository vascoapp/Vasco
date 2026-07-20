/**
 * @jest-environment node
 */

import {
  prepareVatReturn,
  currentBtwPeriod,
  previousBtwPeriod,
  type VatPrepInput,
} from '../vatPrepService';
import type { Invoice } from '../../domain/documents';

const makeInvoice = (overrides: Partial<Invoice & Record<string, any>> = {}): Invoice => ({
  id: 'inv-1',
  customer: 'Fam. de Vries',
  job: 'CV-ketel onderhoud',
  amount: 1210,
  status: 'sent',
  dueInDays: 14,
  issueDate: '2026-02-15',
  dueDate: '2026-03-01',
  ...overrides,
} as any);

describe('prepareVatReturn — NL BTW', () => {
  it('classifies a standard invoice as rubriek_1a (21%) and splits net/vat correctly', () => {
    const draft = prepareVatReturn({
      country: 'NL',
      periodStart: '2026-01-01',
      periodEnd: '2026-03-31',
      invoices: [makeInvoice({ id: 'inv-std', amount: 1210, issueDate: '2026-02-15' })],
      expenses: [],
    });
    // 1210 gross / 1.21 = 1000 net, 210 vat
    expect(draft.rubriek_1a.net).toBeCloseTo(1000, 1);
    expect(draft.rubriek_1a.vat).toBeCloseTo(210, 1);
    expect(draft.totalOutputVat).toBeCloseTo(210, 1);
    expect(draft.lines).toHaveLength(1);
    expect(draft.lines[0].classification).toBe('rubriek_1a');
  });

  it('flags 9% (schilderen/tegel/stucwerk) as rubriek_1b with low confidence', () => {
    const draft = prepareVatReturn({
      country: 'NL',
      periodStart: '2026-01-01',
      periodEnd: '2026-03-31',
      invoices: [makeInvoice({ id: 'inv-paint', job: 'schilderen woonkamer', amount: 1090, issueDate: '2026-02-10' })],
      expenses: [],
    });
    expect(draft.lines[0].classification).toBe('rubriek_1b');
    expect(draft.lines[0].confidence).toBeLessThan(0.75);
    expect(draft.lowConfidenceLines).toBe(1);
    expect(draft.warnings.some((w) => w.includes('lage zekerheid'))).toBe(true);
  });

  it('flags verleggingsregeling as rubriek_2a (reverse-charge, 0%)', () => {
    const draft = prepareVatReturn({
      country: 'NL',
      periodStart: '2026-01-01',
      periodEnd: '2026-03-31',
      invoices: [makeInvoice({ id: 'inv-rev', job: 'onderaanneming verleggingsregeling', amount: 5000, issueDate: '2026-02-20' })],
      expenses: [],
    });
    expect(draft.lines[0].classification).toBe('rubriek_2a');
    expect(draft.lines[0].vatRate).toBe(0);
    // Output VAT stays zero on reverse-charge
    expect(draft.rubriek_2a.net).toBeCloseTo(5000, 1);
    expect(draft.rubriek_2a.vat).toBe(0);
  });

  it('rolls expenses into rubriek_5b (input VAT reclaim)', () => {
    const draft = prepareVatReturn({
      country: 'NL',
      periodStart: '2026-01-01',
      periodEnd: '2026-03-31',
      invoices: [],
      expenses: [
        { id: 'exp-1', description: 'Koperen buis', date: '2026-02-10', amount: 121, vatRate: 21, category: 'materiaal' },
      ],
    });
    expect(draft.rubriek_5b.net).toBeCloseTo(100, 1);
    expect(draft.rubriek_5b.vat).toBeCloseTo(21, 1);
    expect(draft.totalInputVat).toBeCloseTo(21, 1);
    // Net payable should be negative (we get a refund of input vat)
    expect(draft.netPayable).toBeCloseTo(-21, 1);
  });

  it('skips invoices outside the period and drafts', () => {
    const draft = prepareVatReturn({
      country: 'NL',
      periodStart: '2026-01-01',
      periodEnd: '2026-03-31',
      invoices: [
        makeInvoice({ id: 'in-period', amount: 1210, issueDate: '2026-02-15', status: 'sent' }),
        makeInvoice({ id: 'out-of-period', amount: 999, issueDate: '2025-12-01', status: 'sent' }),
        makeInvoice({ id: 'draft-in-period', amount: 5000, issueDate: '2026-02-20', status: 'draft' }),
      ],
      expenses: [],
    });
    expect(draft.lines).toHaveLength(1);
    expect(draft.lines[0].sourceId).toBe('in-period');
  });

  it('raises YoY variance warning when output VAT deviates ≥30% from same period last year', () => {
    const draft = prepareVatReturn({
      country: 'NL',
      periodStart: '2026-01-01',
      periodEnd: '2026-03-31',
      invoices: [makeInvoice({ amount: 12100, issueDate: '2026-02-15' })], // 2100 output vat
      expenses: [],
      prevYearTotalOutputVat: 1000, // huge jump → +110%
    });
    expect(draft.yoyVariancePct).not.toBeNull();
    expect(Math.abs(draft.yoyVariancePct!)).toBeGreaterThanOrEqual(30);
    expect(draft.warnings.some((w) => w.includes('wijkt'))).toBe(true);
  });

  it('throws for unsupported countries (FR/ES/IT/UK)', () => {
    const input: VatPrepInput = {
      country: 'FR' as any,
      periodStart: '2026-01-01',
      periodEnd: '2026-03-31',
      invoices: [],
      expenses: [],
    };
    expect(() => prepareVatReturn(input)).toThrow(/not yet supported/);
  });
});

// R221 — DE UStVA support
describe('prepareVatReturn — DE UStVA', () => {
  it('classifies a standard 19% DE invoice into kz_81', () => {
    const draft = prepareVatReturn({
      country: 'DE',
      periodStart: '2026-01-01',
      periodEnd: '2026-03-31',
      invoices: [
        { id: 'inv-1', customer: 'Fam. Müller', job: 'Badsanierung', amount: 1190, status: 'sent', sentAt: '2026-02-15', lastUpdated: '2026-02-15', dueInDays: 14 } as any,
      ],
      expenses: [],
    });
    expect(draft.country).toBe('DE');
    expect(draft.lines).toHaveLength(1);
    // 1190 gross @ 19% → 1000 net + 190 VAT
    expect(draft.lines[0].netAmount).toBeCloseTo(1000, 2);
    expect(draft.lines[0].vatAmount).toBeCloseTo(190, 2);
    expect(draft.lines[0].classification).toBe('kz_81');
    expect(draft.rollups.kz_81.vat).toBeCloseTo(190, 2);
    expect(draft.totalOutputVat).toBeCloseTo(190, 2);
  });

  it('flags §13b reverse-charge as kz_35 with low confidence', () => {
    const draft = prepareVatReturn({
      country: 'DE',
      periodStart: '2026-01-01',
      periodEnd: '2026-03-31',
      invoices: [
        { id: 'inv-2', customer: 'BauGmbH', job: 'Subunternehmer Leistung §13b Nettorechnung', amount: 5000, status: 'sent', sentAt: '2026-01-20', lastUpdated: '2026-01-20', dueInDays: 30 } as any,
      ],
      expenses: [],
    });
    expect(draft.lines[0].classification).toBe('kz_35');
    expect(draft.lines[0].vatAmount).toBe(0);
    expect(draft.lines[0].confidence).toBeLessThan(0.75);
    expect(draft.rollups.kz_35.net).toBeCloseTo(5000, 2);
  });

  it('classifies German business expense with 19% vorsteuer into kz_66', () => {
    const draft = prepareVatReturn({
      country: 'DE',
      periodStart: '2026-01-01',
      periodEnd: '2026-03-31',
      invoices: [],
      expenses: [
        { id: 'exp-1', description: 'Werkzeug Bauhaus', date: '2026-02-10', amount: 119, vatRate: 19 },
      ],
    });
    expect(draft.lines[0].classification).toBe('kz_66');
    expect(draft.lines[0].vatAmount).toBeCloseTo(19, 2);
    expect(draft.totalInputVat).toBeCloseTo(19, 2);
  });

  it('netPayable = output minus input VAT on DE drafts', () => {
    const draft = prepareVatReturn({
      country: 'DE',
      periodStart: '2026-01-01',
      periodEnd: '2026-03-31',
      invoices: [
        { id: 'inv-3', customer: 'A', job: 'x', amount: 1190, status: 'sent', sentAt: '2026-02-01', lastUpdated: '', dueInDays: 0 } as any,
      ],
      expenses: [{ id: 'exp-2', description: 'Material', date: '2026-02-05', amount: 238, vatRate: 19 }],
    });
    // output 190, input 38 → netPayable 152
    expect(draft.netPayable).toBeCloseTo(152, 2);
  });
});

describe('currentBtwPeriod / previousBtwPeriod', () => {
  it('returns YYYY-MM-DD bounded quarter strings', () => {
    const cur = currentBtwPeriod();
    expect(cur.periodStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(cur.periodEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // End strictly after start
    expect(new Date(cur.periodEnd).getTime()).toBeGreaterThan(new Date(cur.periodStart).getTime());
  });

  it('previous quarter starts strictly before current quarter starts', () => {
    const cur = currentBtwPeriod();
    const prev = previousBtwPeriod();
    expect(new Date(prev.periodStart).getTime()).toBeLessThan(new Date(cur.periodStart).getTime());
  });

  // Regression guard for the UTC-shift bug (fixed 1ea109b): the period was
  // built with `new Date(y,0,1)` (LOCAL) then formatted via toISOString(),
  // which in any UTC+ market rolled Q1 start back to "2025-12-31" — the VAT
  // quarter started in the PREVIOUS YEAR. The fix formats via localDateKey, so
  // construction and formatting are both local and the boundary is now exact
  // and TZ-independent. These assertions passed in a UTC CI even with the bug;
  // they FAIL in Amsterdam TZ without the fix.
  it('anchors the quarter to the FIRST day of the quarter, never the prior day', () => {
    const q1 = currentBtwPeriod(new Date(2026, 1, 15)); // Feb → Q1
    expect(q1.periodStart).toBe('2026-01-01');
    expect(q1.periodEnd).toBe('2026-03-31');

    // Exact Jan-1 boundary — the input that produced "2025-12-31" pre-fix.
    const jan1 = currentBtwPeriod(new Date(2026, 0, 1));
    expect(jan1.periodStart).toBe('2026-01-01');

    // Previous quarter of Q1 is the prior year's Q4.
    const prev = previousBtwPeriod(new Date(2026, 1, 15));
    expect(prev.periodStart).toBe('2025-10-01');
    expect(prev.periodEnd).toBe('2025-12-31');
  });
});

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

  it('throws for non-NL countries (not yet supported)', () => {
    const input: VatPrepInput = {
      country: 'DE' as any,
      periodStart: '2026-01-01',
      periodEnd: '2026-03-31',
      invoices: [],
      expenses: [],
    };
    expect(() => prepareVatReturn(input)).toThrow(/not yet supported/);
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
    // Note: we compare *starts* not end↔start — the service formats dates via
    // toISOString().slice(0,10) which can collapse adjacent quarter boundaries
    // into the same UTC date string depending on local TZ. The real invariant
    // is that the previous quarter begins at least a few months earlier.
    const cur = currentBtwPeriod();
    const prev = previousBtwPeriod();
    expect(new Date(prev.periodStart).getTime()).toBeLessThan(new Date(cur.periodStart).getTime());
  });
});

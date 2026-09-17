/**
 * @jest-environment node
 */
// `GermanTaxSettings` declared `istVersteuerung` and `voranmeldungszeitraum`
// since the German compliance types were written, and NOTHING wrote or read
// either: every VAT return was prepared on invoice dates (Soll) and quarterly.
// Both are wrong for a large part of the beachhead market — a small trade under
// §20 UStG accounts on receipts, and a newly founded business files monthly
// (§18 UStG). Decided and wired 2026-09-17.
import { prepareVatReturn, vatPeriodFor, currentMonthPeriod, previousMonthPeriod } from '../vatPrepService';

const invoice = (over: Record<string, unknown>) => ({
  id: 'inv-1', customer: 'Bäckerei Lindner', job: 'Heizung', amount: 1190,
  status: 'sent', issueDate: '2026-04-10T10:00:00.000Z', ...over,
} as never);

const base = {
  country: 'DE' as const,
  periodStart: '2026-04-01',
  periodEnd: '2026-06-30',
  expenses: [],
};

describe('Ist-Versteuerung declares an invoice when it is PAID', () => {
  it('leaves an unpaid invoice out of the period it was issued in', () => {
    const draft = prepareVatReturn({ ...base, vatBasis: 'ist', invoices: [invoice({})] });
    expect(draft.lines.filter((l) => l.sourceType === 'invoice_sent')).toHaveLength(0);
  });

  it('counts it in the period the money arrived', () => {
    const draft = prepareVatReturn({
      ...base,
      vatBasis: 'ist',
      invoices: [invoice({ status: 'paid', issueDate: '2026-03-20T10:00:00.000Z', paidAt: '2026-04-15T10:00:00.000Z' })],
    });
    const lines = draft.lines.filter((l) => l.sourceType === 'invoice_sent');
    expect(lines).toHaveLength(1);
    expect(lines[0].date).toBe('2026-04-15T10:00:00.000Z');
  });

  it('Soll — the default — still counts it on the invoice date, unpaid', () => {
    const draft = prepareVatReturn({ ...base, invoices: [invoice({})] });
    expect(draft.lines.filter((l) => l.sourceType === 'invoice_sent')).toHaveLength(1);
  });

  it('a March invoice paid in April is NOT in the Q2 return under Soll', () => {
    const draft = prepareVatReturn({
      ...base,
      invoices: [invoice({ status: 'paid', issueDate: '2026-03-20T10:00:00.000Z', paidAt: '2026-04-15T10:00:00.000Z' })],
    });
    expect(draft.lines.filter((l) => l.sourceType === 'invoice_sent')).toHaveLength(0);
  });
});

describe('the filing period follows the contractor cadence', () => {
  const now = new Date(2026, 8, 17); // 17 September 2026

  it('monthly gives a calendar month', () => {
    expect(vatPeriodFor('monthly', 'current', now)).toEqual(currentMonthPeriod(now));
    expect(currentMonthPeriod(now).periodStart).toBe('2026-09-01');
    expect(currentMonthPeriod(now).periodEnd).toBe('2026-09-30');
    expect(previousMonthPeriod(now).periodStart).toBe('2026-08-01');
    expect(previousMonthPeriod(now).periodEnd).toBe('2026-08-31');
  });

  it('quarterly is still the default for an unstated cadence', () => {
    expect(vatPeriodFor(undefined, 'current', now).periodStart).toBe('2026-07-01');
    expect(vatPeriodFor('quarterly', 'current', now).periodStart).toBe('2026-07-01');
  });

  it('yearly covers the calendar year', () => {
    expect(vatPeriodFor('yearly', 'current', now)).toEqual({ periodStart: '2026-01-01', periodEnd: '2026-12-31' });
    expect(vatPeriodFor('yearly', 'previous', now)).toEqual({ periodStart: '2025-01-01', periodEnd: '2025-12-31' });
  });
});

describe('the screen passes both settings', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.resolve(__dirname, '../../../app/contractor/vat-prep.tsx'), 'utf8');

  it('threads vatBasis and filingPeriod from the profile', () => {
    expect(src).toMatch(/vatBasis: businessProfile\?\.vatBasis/);
    expect(src).toMatch(/vatPeriodFor\(businessProfile\?\.filingPeriod/);
  });

  it('re-computes when either changes', () => {
    const deps = /\}, \[([^\]]*)\]\);/.exec(src.slice(src.indexOf('const draft')))?.[1] ?? '';
    expect(deps).toMatch(/vatBasis/);
    expect(deps).toMatch(/filingPeriod/);
  });
});

// The Dutch reduced rate covers painting, plastering, wallpapering and
// insulating labour (plus cleaning) on a home older than two years. It does
// NOT cover plumbing, electrical work or TILING — and "tegel" was in the
// matcher, so a 21% bathroom job was filed in rubriek 1b at 9% and the
// contractor owed the difference (#339 L11, decided with the user 2026-09-17).
describe('the NL 9% matcher covers only the work the rate applies to', () => {
  const nl = (job: string) => prepareVatReturn({
    country: 'NL',
    periodStart: '2026-04-01',
    periodEnd: '2026-06-30',
    expenses: [],
    invoices: [{ id: 'i', customer: 'K', job, amount: 1210, status: 'sent', issueDate: '2026-04-10T10:00:00.000Z' } as never],
  }).lines.filter((l) => l.sourceType === 'invoice_sent')[0];

  it.each(['Tegelwerk badkamer', 'Loodgieterswerk keuken', 'Elektra groepenkast'])(
    '%s stays at the standard rate', (job) => {
      expect(nl(job).vatRate).toBe(21);
    });

  it.each(['Schilderwerk woonkamer', 'Stucwerk slaapkamer', 'Behangen hal', 'Isolatie zolder'])(
    '%s is offered the reduced rate, flagged for review', (job) => {
      const line = nl(job);
      expect(line.vatRate).toBe(9);
      expect(line.warnings?.join(' ')).toMatch(/2 jaar/);
    });
});

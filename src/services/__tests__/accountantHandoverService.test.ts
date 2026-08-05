// =============================================================================
// ACCOUNTANT HANDOVER
// =============================================================================
// This goes to a professional who will reconcile against it. The properties
// worth pinning are the ones where a wrong answer produces wrong accounts: a
// rejected invoice must never read as issued, and "no mandate here" must never
// read as "not filed yet".
// =============================================================================

import { buildAccountantHandover, formatHandoverText } from '../accountantHandoverService';
import type { Submission } from '../submissionLifecycle';

const money = (n: number) => `€${n.toFixed(2)}`;

const inv = (over: Record<string, unknown> = {}) => ({
  id: 'i1', customer: 'Hotel NH', customerName: 'Hotel NH', reference: 'INV-1',
  job: '', amount: 100, total: 100, status: 'sent' as const, dueInDays: 14,
  sentAt: '2026-05-10T00:00:00.000Z', createdAt: '2026-05-01T00:00:00.000Z',
  ...over,
}) as never;

const sub = (over: Partial<Submission> = {}): Submission => ({
  id: 's1', channel: 'sdi', subjectId: 'i1', idempotencyKey: 'k1',
  state: 'submitted', attempts: [], createdAt: '2026-05-11T00:00:00.000Z',
  updatedAt: '2026-05-11T00:00:00.000Z', ...over,
});

const base = {
  businessName: 'Klempner Meier', country: 'IT',
  periodStart: '2026-04-01', periodEnd: '2026-06-30',
};

describe('period selection', () => {
  it('includes only invoices sent inside the period', () => {
    const h = buildAccountantHandover({
      ...base,
      invoices: [inv(), inv({ id: 'i2', sentAt: '2026-01-05T00:00:00.000Z' })],
      submissions: [],
    });
    expect(h.totals.count).toBe(1);
  });

  it('never uses the row id as a reference', () => {
    // "i-1043" means nothing to an accountant and reads like data.
    const h = buildAccountantHandover({
      ...base, invoices: [inv({ reference: undefined })], submissions: [],
    });
    expect(h.invoices[0].reference).toBe('Hotel NH');
    expect(h.invoices[0].reference).not.toBe('i1');
  });
});

describe('filing state — the part no accounting package knows', () => {
  it('surfaces a rejected invoice as not filed', () => {
    const h = buildAccountantHandover({
      ...base, invoices: [inv()], submissions: [sub({ state: 'rejected' })],
    });
    expect(h.notFiled).toHaveLength(1);
    // Reconciling a rejected invoice as revenue is reconciling something that
    // does not legally exist.
    expect(h.awaitingConfirmation).toHaveLength(0);
  });

  it('separates awaiting-confirmation from filed', () => {
    const h = buildAccountantHandover({
      ...base, invoices: [inv()], submissions: [sub({ state: 'submitted' })],
    });
    expect(h.awaitingConfirmation).toHaveLength(1);
    expect(h.notFiled).toHaveLength(0);
  });

  it('uses the most recent filing when a correction supersedes a rejection', () => {
    const h = buildAccountantHandover({
      ...base,
      invoices: [inv()],
      submissions: [
        sub({ id: 'old', state: 'rejected', createdAt: '2026-05-11T00:00:00.000Z' }),
        sub({ id: 'new', state: 'accepted', createdAt: '2026-05-20T00:00:00.000Z' }),
      ],
    });
    expect(h.notFiled).toHaveLength(0);
    expect(h.invoices[0].filing).toBe('accepted');
  });

  it('distinguishes "no mandate here" from "not filed yet"', () => {
    // A Dutch contractor has no filings because none are required. An
    // accountant must not chase them for submissions that never existed.
    const h = buildAccountantHandover({ ...base, country: 'NL', invoices: [inv()], submissions: [] });
    expect(h.mandateApplies).toBe(false);
    expect(h.notFiled).toHaveLength(0);
    expect(formatHandoverText(h, money)).toContain('No structured e-invoice filing is required');
    // Precisely the ROW suffix — the closing explanation legitimately uses
    // the words 'no filing status is shown'.
    expect(formatHandoverText(h, money)).not.toContain('· no filing');
  });
});

describe('the written handover', () => {
  it('leads with what is wrong, not with the full list', () => {
    const h = buildAccountantHandover({
      ...base,
      invoices: [inv(), inv({ id: 'i2', reference: 'INV-2' })],
      submissions: [sub({ subjectId: 'i2', state: 'rejected' })],
    });
    const text = formatHandoverText(h, money);
    // Three unissued invoices buried under forty correct ones get missed.
    expect(text.indexOf('NOT FILED')).toBeLessThan(text.indexOf('ALL INVOICES'));
    expect(text).toContain('INV-2');
  });
});

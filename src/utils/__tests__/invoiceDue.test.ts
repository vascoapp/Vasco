/**
 * @jest-environment node
 *
 * TWO SCREENS, ONE INVOICE, DIFFERENT ANSWERS
 *
 * Found by walking: the Meldingen inbox said Hotel NH was "14 dagen
 * achterstallig" while the Geld tab said 32, on the same day, for the same
 * invoice. Geld was right — it was due 2026-07-06.
 *
 * The cause is that `dueInDays` is a STORED SNAPSHOT of a derived value:
 * written once (`dueInDays: 14` when an invoice is sent) and never recomputed.
 * The seed carried -14 forever while the real date kept moving. Anything
 * reading the field inherits a number that was true once.
 *
 * The tests below pin the property that fixes it: when a date exists, the date
 * wins. The stale-snapshot case is the first test because that is the exact
 * shape of the bug that shipped.
 */

import { daysUntilDue, daysOverdue, isPastDue } from '../invoiceDue';

const NOW = new Date('2026-08-07T11:00:00Z');

describe('the date beats the stored snapshot', () => {
  it('ignores a stale dueInDays when a dueDate is present', () => {
    // Exactly the shipped seed row: frozen -14, actually 32 days past due.
    const inv = { dueDate: '2026-07-06', dueInDays: -14 };
    expect(daysOverdue(inv, NOW)).toBe(32);
  });

  it('falls back to dueInDays only when there is no date', () => {
    expect(daysUntilDue({ dueInDays: -14 }, NOW)).toBe(-14);
  });

  it('falls back when the stored date is unparseable rather than throwing', () => {
    expect(daysUntilDue({ dueDate: 'not-a-date', dueInDays: 5 }, NOW)).toBe(5);
  });

  it('returns null when nothing is known, so callers can omit the figure', () => {
    expect(daysUntilDue({}, NOW)).toBeNull();
    expect(daysOverdue({}, NOW)).toBeNull();
    expect(daysUntilDue(undefined, NOW)).toBeNull();
  });
});

describe('calendar days, not elapsed milliseconds', () => {
  it('counts a due date of yesterday as 1 day late all day', () => {
    // Late morning and late evening must agree — a day counter that flips
    // partway through the afternoon makes two screens disagree again, which
    // is the bug this module exists to prevent.
    const morning = new Date('2026-08-07T09:00:00');
    const evening = new Date('2026-08-07T23:30:00');
    const inv = { dueDate: '2026-08-06' };
    expect(daysOverdue(inv, morning)).toBe(1);
    expect(daysOverdue(inv, evening)).toBe(1);
  });

  it('treats the due date itself as not yet late', () => {
    const inv = { dueDate: '2026-08-07' };
    expect(daysUntilDue(inv, new Date('2026-08-07T23:00:00'))).toBe(0);
    expect(daysOverdue(inv, new Date('2026-08-07T23:00:00'))).toBe(0);
    expect(isPastDue(inv, new Date('2026-08-07T23:00:00'))).toBe(false);
  });

  it('counts forward for an invoice not yet due', () => {
    expect(daysUntilDue({ dueDate: '2026-08-14' }, new Date('2026-08-07T09:00:00'))).toBe(7);
  });
});

describe('daysOverdue never reports negative lateness', () => {
  it('clamps a future due date to 0 rather than a negative "overdue"', () => {
    expect(daysOverdue({ dueDate: '2026-09-01' }, new Date('2026-08-07T09:00:00'))).toBe(0);
  });
});

/**
 * @jest-environment node
 */
// "How late is this invoice" has one answer — `daysUntilDue` /
// `daysOverdue` / `isPastDue` in `src/utils/invoiceDue.ts` — and two ways to
// get it wrong, both of which were still live in 2026-09-19's sweep:
//
//  1. Reading `dueInDays`, a SNAPSHOT written once when the invoice is sent
//     and never recomputed. `collectionsAgentService` chose the dunning
//     escalation step from it, so an invoice forty days late was still filed
//     under "vriendelijk" — and that step decides what the customer is sent.
//
//  2. Subtracting milliseconds, or comparing `new Date(key) < new Date()`.
//     `new Date('2026-08-31')` is UTC midnight: the PREVIOUS local day for
//     every market east of Greenwich, and a day the label has not reached yet
//     for the US. `IntegratedPayments` did both — it said "2 days overdue" in
//     the afternoon for an invoice late since yesterday, and counted an
//     invoice due TODAY as overdue from 01:00 local.
//
// The helpers use calendar days from local midnight. These are the call sites
// that must go through them.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';
import { daysUntilDue, daysOverdue, isPastDue } from '../utils/invoiceDue';

const ROOT = path.resolve(__dirname, '../..');
const read = (rel: string) => stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

describe('the helper itself answers in calendar days', () => {
  // 14:00 local on the 19th. An invoice due on the 18th is ONE day late all
  // day, not two by the afternoon.
  const afternoon = new Date(2026, 8, 19, 14, 0, 0);

  it('does not flip mid-afternoon', () => {
    expect(daysUntilDue({ dueDate: '2026-09-18' }, afternoon)).toBe(-1);
    expect(daysOverdue({ dueDate: '2026-09-18' }, afternoon)).toBe(1);
  });

  it('an invoice due TODAY is not overdue', () => {
    expect(daysUntilDue({ dueDate: '2026-09-19' }, afternoon)).toBe(0);
    expect(isPastDue({ dueDate: '2026-09-19' }, afternoon)).toBe(false);
    expect(daysOverdue({ dueDate: '2026-09-19' }, afternoon)).toBe(0);
  });

  it('the date beats a stale snapshot', () => {
    expect(daysUntilDue({ dueDate: '2026-08-10', dueInDays: 14 }, afternoon)).toBe(-40);
  });
});

describe('the screens and services ask the helper', () => {
  const SITES: { rel: string; mustNot: RegExp[] }[] = [
    {
      rel: 'src/components/contractor/IntegratedPayments.tsx',
      mustNot: [
        /\(dueDate\.getTime\(\) - today\.getTime\(\)\)/,
        /const dueDate = new Date\(inv\.dueDate\);\s*\n\s*return dueDate < new Date\(\)/,
      ],
    },
    {
      rel: 'src/services/collectionsAgentService.ts',
      // The escalation step, and the filter that decides who is chased at all.
      mustNot: [/Math\.abs\(inv\.dueInDays \?\? 0\)/, /i\.dueInDays !== undefined && i\.dueInDays < 0/],
    },
    {
      rel: 'app/invoices/[id].tsx',
      // Including the statutory-interest basis: a frozen day count there is a
      // wrong amount of money, not a wrong label.
      mustNot: [/daysOverdue: Math\.abs\(invoice\.dueInDays\)/, /invoice\.dueInDays >= 0/],
    },
  ];

  it.each(SITES)('$rel derives it', ({ rel, mustNot }) => {
    const src = read(rel);
    expect({ rel, derives: /daysUntilDue|daysOverdue|isPastDue/.test(src) })
      .toEqual({ rel, derives: true });
    for (const pattern of mustNot) {
      expect({ rel, pattern: String(pattern), present: pattern.test(src) })
        .toEqual({ rel, pattern: String(pattern), present: false });
    }
  });
});

describe('a date key is read as a local day', () => {
  it('the VAT period label does not shift a quarter west of Greenwich', () => {
    const src = read('src/services/vatPrepService.ts');
    const fn = src.slice(src.indexOf('function periodLabel'), src.indexOf('export function currentBtwPeriod'));
    // `new Date('2026-01-01')` is 31 December 2025 in New York, which labelled
    // a US contractor's Q1 as "2025-Q4".
    expect(fn).toMatch(/parseCalendarDay\(periodStart\)/);
  });
});

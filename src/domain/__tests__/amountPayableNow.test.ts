/**
 * @jest-environment node
 *
 * Statutory interest accrues on what is DUE, not on retention.
 *
 * A progress invoice is issued for the full term amount (VAT on all of it) and
 * `retentionAmount` is withheld from the payment until oplevering. All three
 * late-fee callers passed `invoice.amount`, so the reminder the customer reads
 * over-claimed interest on money they are entitled to hold (#339).
 */
import fs from 'fs';
import path from 'path';
import { amountPayableNow } from '../documents';
import { stripComments } from '../../utils/stripComments';

describe('amountPayableNow', () => {
  it('subtracts the retention withheld from this invoice', () => {
    // €28.560 instalment with €1.428 held: interest base is €27.132.
    expect(amountPayableNow({ amount: 28560, retentionAmount: 1428 })).toBe(27132);
  });

  it('is the whole amount when nothing is withheld', () => {
    expect(amountPayableNow({ amount: 5200 })).toBe(5200);
    expect(amountPayableNow({ amount: 5200, retentionAmount: 0 })).toBe(5200);
  });

  it('never goes negative', () => {
    expect(amountPayableNow({ amount: 100, retentionAmount: 250 })).toBe(0);
  });
});

describe('every late-fee caller uses it', () => {
  const ROOT = path.resolve(__dirname, '../../..');
  const callers = ['app/invoices/[id].tsx', 'app/(contractor)/facturen.tsx', 'src/services/aiActionQueueService.ts'];

  // EVERY call, not the first one: `invoices/[id].tsx` has two — the email
  // disclosure and the overdue timeline — and checking only `indexOf` left the
  // second charging interest on retention that is not due, so the screen and
  // the customer's reminder disagreed.
  it.each(callers)('%s computes the fee on the payable amount at every call', (rel) => {
    const src = stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
    const calls: string[] = [];
    for (let at = src.indexOf('computeLateFee('); at !== -1; at = src.indexOf('computeLateFee(', at + 1)) {
      const end = src.indexOf('})', at);
      calls.push(src.slice(at, end === -1 ? at + 400 : end));
    }
    // The import line is not a call.
    const invocations = calls.filter((c) => c.includes('invoiceAmount:'));
    expect(invocations.length).toBeGreaterThan(0);
    for (const args of invocations) expect(args).toMatch(/invoiceAmount:\s*amountPayableNow\(/);
  });
});

describe('a payment link asks only for what is due now', () => {
  // The late-fee callers were fixed to charge interest on the payable amount;
  // the PAYMENT LINK beside them still asked for the full invoice total, so a
  // €28.560 instalment with €1.428 retention sent the customer a link for the
  // whole of it — money the contract says they may hold until the release
  // invoice (sweep 2026-09-18).
  const ROOT = path.resolve(__dirname, '../../..');
  const LINK_CALLERS = ['app/(contractor)/facturen.tsx', 'app/invoices/[id].tsx'];

  it.each(LINK_CALLERS)('%s bills the payable amount', (rel) => {
    const src = stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
    const calls: string[] = [];
    for (let at = src.indexOf('createPaymentLink('); at !== -1; at = src.indexOf('createPaymentLink(', at + 1)) {
      calls.push(src.slice(at, at + 320));
    }
    // The import line is not a call.
    const invocations = calls.filter((c) => /amount|invoice\.id/.test(c));
    expect(invocations.length).toBeGreaterThan(0);
    for (const call of invocations) {
      expect(call).toMatch(/amountPayableNow\(/);
      expect(call).not.toMatch(/amount: autoInv\.total|createPaymentLink\(invoice\.id, invoice\.amount\)/);
    }
  });
});


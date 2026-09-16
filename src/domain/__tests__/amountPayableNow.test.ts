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

  it.each(callers)('%s computes the fee on the payable amount', (rel) => {
    const src = stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
    const at = src.indexOf('computeLateFee(');
    expect(at).toBeGreaterThan(-1);
    const args = src.slice(at, src.indexOf('})', at));
    expect(args).toMatch(/invoiceAmount:\s*amountPayableNow\(/);
  });
});

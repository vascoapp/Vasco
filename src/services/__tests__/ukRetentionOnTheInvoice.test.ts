/**
 * UK: retention is deducted ON the invoice, VAT only on what is due now; its
 * VAT is charged at release (VAT Regulations 1995 reg. 89). EU markets keep the
 * full instalment on the invoice and the customer withholds the retention.
 *
 * UK walk, 2026-10-08: a £5,550.15 deposit with 5 % retention was invoiced at
 * £6,660.18 (VAT on the full valuation, retention nowhere on the document),
 * while the instalment card said "payable now £5,272.64 — of which £277.51
 * retention" — two figures for one retention, and VAT asked on held money.
 */
import { progressInvoiceLines, retentionDeductedOnInvoice, retentionOnAmount, retentionHeld } from '../progressBillingService';
import { amountPayableNow } from '../../domain/documents';

const labels = { work: 'Deposit (30%) — Kitchen refit', lessRetention: 'Less retention (5%)' };

it('the UK deducts the retention on the invoice; EU markets do not', () => {
  expect(retentionDeductedOnInvoice('UK')).toBe(true);
  for (const c of ['NL', 'DE', 'FR', 'ES', 'IT', undefined]) expect(retentionDeductedOnInvoice(c as any)).toBe(false);
});

it('a UK instalment invoice states the valuation and deducts the retention before VAT', () => {
  const lines = progressInvoiceLines({ workNet: 5550.15, retentionNet: 277.51, country: 'UK', labels });
  expect(lines).toEqual([
    { description: 'Deposit (30%) — Kitchen refit', quantity: 1, unitPrice: 5550.15 },
    { description: 'Less retention (5%)', quantity: 1, unitPrice: -277.51 },
  ]);
  const net = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  expect(Math.round(net * 100) / 100).toBe(5272.64);
});

it('an EU instalment invoice is the full valuation (retention withheld from payment)', () => {
  expect(progressInvoiceLines({ workNet: 5550.15, retentionNet: 277.51, country: 'NL', labels })).toEqual([
    { description: 'Deposit (30%) — Kitchen refit', quantity: 1, unitPrice: 5550.15 },
  ]);
});

it('a UK variation carries the project retention', () => {
  expect(retentionOnAmount({ retentionPercent: 5 } as any, 420.75)).toBe(21.04);
  expect(retentionOnAmount({ retentionPercent: 5 } as any, -100)).toBe(0); // minderwerk: nothing held
  expect(retentionOnAmount({ retentionPercent: 0 } as any, 420.75)).toBe(0);
});

it('what the customer pays now is never the retention twice', () => {
  // UK document total already net of retention: £5,272.64 + 20 % = £6,327.17.
  expect(amountPayableNow({ amount: 6327.17, retentionAmount: 333.01 }, 'UK')).toBe(6327.17);
  // NL: full instalment invoiced, retention withheld from the payment.
  expect(amountPayableNow({ amount: 6660.18, retentionAmount: 333.01 }, 'NL')).toBe(6327.17);
});

it('a UK release re-grossed from its own line leaves no penny "still held"', () => {
  const invoices = [
    { id: 'INV1', projectId: 'p', amount: 6327.17, retentionAmount: 333.01 },
    { id: 'INV2', projectId: 'p', amount: 333.02, isRetentionRelease: true }, // 277.52 net re-grossed
  ] as any;
  expect(retentionHeld('p', invoices)).toBe(0);
});

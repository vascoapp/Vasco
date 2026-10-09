/**
 * The "confirm invoice arrived" card (UK re-walk W187, 2026-10-09): it drafted
 * "Hi , invoice INV0002 is ready. Pay online…" for an invoice with no
 * customer, promising a payment link nothing had created.
 */
import { buildLiveActions } from '../eveLiveActionService';

const now = new Date('2026-10-09T09:00:00Z');
const sent = (o: any) => ({ id: 'INV1', status: 'sent', sentAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), amount: 115.68, ...o });

it('no card for an invoice without a customer', () => {
  const out = buildLiveActions({ invoices: [sent({ customer: '' })], customers: [], now } as any);
  expect(out.filter((a) => a.preparedData?.invoiceId === 'INV1')).toHaveLength(0);
});

it('with a customer: greets them by name and promises no online payment', () => {
  const out = buildLiveActions({
    invoices: [sent({ customerId: 'c1', customer: 'Sarah Jones' })],
    customers: [{ id: 'c1', name: 'Sarah Jones' }], now,
  } as any);
  const card = out.find((a) => a.preparedData?.invoiceId === 'INV1');
  expect(card).toBeDefined();
  const text = String(card!.preparedData!.template);
  expect(text).toContain('Sarah Jones');
  expect(text.toLowerCase()).not.toContain('pay online');
});

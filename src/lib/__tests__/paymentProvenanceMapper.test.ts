/**
 * documents.payment_* must reach the contractor.
 *
 * Both payment webhooks stamp `payment_id`, `payment_method` and
 * `payment_provider` on a document the moment a payment settles. DocumentRow
 * had no field for any of them, so `documentRowToInvoice` could not read them
 * and the contractor could never see whether money arrived by iDEAL, card or
 * bank transfer — nor get the provider reference needed to match a bank line.
 *
 * This is Rule #8 from the READ side, and it survived every earlier sweep for
 * one reason worth pinning: the writer is an edge function, not AppState, so
 * "grep who writes this field" came up empty on the client and the field
 * looked derived rather than missing.
 */
import { documentRowToInvoice } from '../mappers';
import type { DocumentRow } from '../database.types';

const paidRow = {
  id: 'doc-1',
  document_number: 'F-260014',
  user_id: 'u1',
  customer_id: 'c1',
  job_id: 'j1',
  doc_type: 'invoice',
  status: 'paid',
  total_amount: 1210,
  created_at: '2026-08-01T09:00:00Z',
  updated_at: '2026-08-14T11:02:00Z',
  paid_at: '2026-08-14T11:02:00Z',
  payment_id: 'tr_WDqYK6vllg',
  payment_method: 'ideal',
  payment_provider: 'mollie',
} as unknown as DocumentRow;

describe('payment provenance survives the row → invoice mapping', () => {
  it('carries method, provider and the provider reference', () => {
    const inv = documentRowToInvoice(paidRow);
    expect(inv.paymentMethod).toBe('ideal');
    expect(inv.paymentProvider).toBe('mollie');
    // The provider id is what a contractor matches against a bank statement.
    expect(inv.paymentId).toBe('tr_WDqYK6vllg');
  });

  it('leaves them undefined when the provider told us nothing', () => {
    // An invoice marked paid by hand has no method. Undefined is the honest
    // answer — the screen renders nothing rather than inventing "Bankoverboeking".
    const manual = { ...paidRow, payment_id: null, payment_method: null, payment_provider: null } as unknown as DocumentRow;
    const inv = documentRowToInvoice(manual);
    expect(inv.paymentMethod).toBeUndefined();
    expect(inv.paymentProvider).toBeUndefined();
    expect(inv.paymentId).toBeUndefined();
  });

  it('does not lose the fields the mapper already carried', () => {
    // Guard against a merge dropping a sibling: this mapper has accumulated
    // five separate Rule #8 fixes and each one is a field that used to vanish.
    const inv = documentRowToInvoice(paidRow);
    expect(inv.paidAt).toBe('2026-08-14T11:02:00Z');
    expect(inv.createdAt).toBe('2026-08-01T09:00:00Z');
    expect(inv.id).toBe('F-260014');
  });
});

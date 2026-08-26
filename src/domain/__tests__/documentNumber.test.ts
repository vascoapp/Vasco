// =============================================================================
// ONE RESOLVER FOR A DOCUMENT'S NUMBER
// =============================================================================
// `Invoice.reference` is optional, has no column, and nothing writes it. The
// real number is minted by the `next_document_number` RPC and lands on `id`
// (`documentRowToInvoice`: `id: row.document_number ?? row.id`).
//
// Eight readers each invented their own fallback for the missing field and
// disagreed about what to show instead:
//
//   • the dunning WhatsApp fell back to `''`, so a Mahnung quoting statutory
//     interest, €40 recovery costs and collections named NO invoice;
//   • the accountant handover and the tax-filings screen fell back to the
//     CUSTOMER NAME, handing an accountant a column of people where the
//     invoice numbers belong — and then needed a second workaround to stop
//     printing "Hotel NH — Hotel NH";
//   • `IntegratedPayments` and `notificationService` rendered an empty string;
//   • the Moneybird / Xero / QuickBooks export passed `undefined` through as
//     the external `Reference` / `DocNumber`.
//
// Same shape and same fix as `findDocumentCustomer` (#214): one resolver in the
// domain module, not N guards that drift.
// =============================================================================

import { documentNumber } from '../documents';

describe('documentNumber', () => {
  it('returns the minted document number that lives on id', () => {
    expect(documentNumber({ id: 'I0042' })).toBe('I0042');
  });

  it('prefers an explicit reference — a series imported from another system', () => {
    expect(documentNumber({ id: 'I0042', reference: '2026-0087' })).toBe('2026-0087');
  });

  it('ignores a blank or whitespace reference rather than returning it', () => {
    // The whole defect class: an empty override silently winning over a real
    // number is how the customer got a reminder naming no invoice.
    expect(documentNumber({ id: 'I0042', reference: '' })).toBe('I0042');
    expect(documentNumber({ id: 'I0042', reference: '   ' })).toBe('I0042');
  });

  it('trims, because the value reaches e-invoice XML and filenames', () => {
    expect(documentNumber({ id: 'I0042', reference: ' 2026-0087 ' })).toBe('2026-0087');
  });

  it('never throws on a missing document', () => {
    // Callers resolve an invoice by id first; a deleted one is a real state
    // (regulated_submissions has no DELETE policy, so a filing outlives its
    // invoice) and must not crash the screen listing it.
    expect(documentNumber(null)).toBe('');
    expect(documentNumber(undefined)).toBe('');
    expect(documentNumber({})).toBe('');
  });

  it('is falsy when there is nothing to show, so callers can choose a fallback', () => {
    // Deliberate: this resolver does not invent a label. The filings screen
    // wants "no longer in your list", the handover wants the customer name —
    // different answers, and neither belongs in the domain module.
    expect(documentNumber({ id: '' })).toBe('');
  });
});

/**
 * Which `documents` row a payment's `metadata.invoiceId` points at.
 *
 * The app creates payment links with `invoice.id`, which in this app IS the
 * document NUMBER ("RE-2026-0001" — AppState stamps `id: docNumber`), while
 * both webhooks updated `.eq('id', invoiceId)` against the uuid column: it
 * could never match, so a paid invoice was never marked paid (same class as
 * send-invoice, learnings #379). A number is unique per CONTRACTOR only, so
 * it is matched together with the contractor's user id the payment carries
 * (`metadata.userId`, written since 2026-10-05). Without one, a number is
 * ambiguous and is never guessed: another contractor's RE-2026-0001 must not
 * be marked paid.
 *
 * Pure TypeScript: jest imports it too.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type InvoiceLookup =
  | { column: 'id'; value: string }
  | { column: 'document_number'; value: string; userId: string };

export function invoiceLookup(ref: unknown, userId: unknown): InvoiceLookup | null {
  const r = typeof ref === 'string' ? ref.trim() : '';
  if (!r) return null;
  if (UUID.test(r)) return { column: 'id', value: r };
  const u = typeof userId === 'string' ? userId.trim() : '';
  if (UUID.test(u)) return { column: 'document_number', value: r, userId: u };
  return null;
}

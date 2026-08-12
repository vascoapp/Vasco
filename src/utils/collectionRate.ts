import type { Invoice, InvoiceStatus } from '../domain/documents';

/**
 * What share of the money the contractor has actually BILLED has been paid.
 *
 * Extracted from `geld.tsx` rather than left inline: the old rule
 * (`paid.length / invoices.length`) was wrong in two ways and no test could
 * reach it to say so.
 *
 *  1. A DRAFT invoice has never reached the customer, so it cannot have been
 *     collected. Counting it in the denominator meant that drafting an invoice
 *     made the contractor's collection rate go DOWN.
 *  2. Counting DOCUMENTS contradicts the euro figures printed beside the pill.
 *     On the demo data — 350 + 450 overdue, 760 paid, 640 draft — the old rule
 *     read 25% (1 of 4) in red, while € 760 of the € 1.560 actually billed is
 *     49%. The badge's own colour threshold (>= 50 amber, < 50 red) flipped on
 *     that difference, so it was not merely imprecise.
 */

/** Statuses that represent an invoice the customer has actually received. */
const ISSUED: readonly InvoiceStatus[] = ['sent', 'paid', 'overdue'];

export function isIssued(invoice: Pick<Invoice, 'status'>): boolean {
  return ISSUED.includes(invoice.status);
}

export function issuedInvoices<T extends Pick<Invoice, 'status'>>(invoices: readonly T[]): T[] {
  return invoices.filter(isIssued);
}

/**
 * Collected / billed, as a whole percentage, over issued invoices only.
 *
 * Returns 0 when nothing has been billed. Callers must not render that as a
 * score — an empty set is not a bad outcome — which is why the badge is gated
 * on `issuedInvoices(...).length > 0` rather than on this value.
 */
export function collectionRate(
  invoices: readonly Pick<Invoice, 'status' | 'amount'>[],
): number {
  const issued = issuedInvoices(invoices);
  const billed = issued.reduce((sum, i) => sum + (i.amount || 0), 0);
  if (billed <= 0) return 0;
  const collected = issued
    .filter((i) => i.status === 'paid')
    .reduce((sum, i) => sum + (i.amount || 0), 0);
  return Math.round((collected / billed) * 100);
}

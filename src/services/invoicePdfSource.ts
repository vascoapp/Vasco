// =============================================================================
// The PDF of a REAL invoice
// =============================================================================
// Every invoice PDF in the app — the detail screen's PDF button, the PDF
// attached to the invoice email, the Facturen share, the PDF modal — asked
// `invoiceAutomationService.getInvoice(id)`. That service keeps an in-memory
// list which starts EMPTY and which no real flow ever fills (its only writer,
// `generateInvoice`, has no caller outside a hook nothing uses). So for every
// invoice a contractor actually created, the PDF button gave a success haptic
// and did nothing, and the invoice email went out WITHOUT its PDF (#339).
//
// This builds the PDF's input from what the app really stores: the invoice
// record, its line items (keyed by document number) and the customer record,
// with the totals from the one VAT rule the invoice screen also uses.
// =============================================================================

import { documentNumber } from '../domain/documents';
import { documentVatBreakdown } from '../domain/business';
import { parseCalendarDay } from '../utils/dateKey';
import type { AutoInvoice, InvoiceLineItem } from './invoiceAutomationService';

export interface PdfSourceLine {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate?: number;
}

/**
 * What this needs off an invoice, structurally — the contractor's screens hold
 * two shapes of "invoice" (the domain record and `cashFlowService.Invoice`),
 * and both reach a PDF button.
 */
export interface PdfSourceInvoice {
  id: string;
  reference?: string | null;
  amount: number;
  status: AutoInvoice['status'] | 'cancelled';
  job?: string;
  jobId?: string;
  customer?: string;
  customerId?: string;
  customerName?: string;
  dueInDays?: number;
  dueDate?: string;
  sentAt?: string;
  createdAt?: string;
  notes?: string;
  /**
   * A retention-release invoice recovers money already invoiced and already
   * taxed on the term invoices — `amount` is the withheld GROSS and no new VAT
   * arises. Without this the synthesised line splits it by the profile rate
   * and the PDF charges the VAT a second time (#354).
   */
  isRetentionRelease?: boolean;
}

export interface PdfSourceCustomer {
  id?: string;
  name?: string;
  email?: string;
  address?: string;
  postcode?: string | null;
  city?: string | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function pdfInvoiceFromRecord(args: {
  invoice: PdfSourceInvoice;
  /** `lineItems[invoice.id]` from AppState. May be empty. */
  lines: PdfSourceLine[] | undefined;
  customer?: PdfSourceCustomer;
  /** The profile's effective rate in percent (0 for KOR / Kleinunternehmer). */
  fallbackVatRatePercent: number;
  /** Used only for an invoice with no stored lines. */
  fallbackDescription: string;
  now?: Date;
}): AutoInvoice {
  const { invoice, customer, fallbackDescription } = args;
  const now = args.now ?? new Date();
  // A retention release carries no new VAT: the tax on this money was charged
  // and declared when the term invoice went out. Anything else would
  // over-declare output VAT and let the customer reclaim it twice.
  const fallbackVatRatePercent = invoice.isRetentionRelease ? 0 : args.fallbackVatRatePercent;

  // An invoice with no stored lines gets one, split out of its GROSS amount —
  // the same thing the detail screen shows for it.
  const source: PdfSourceLine[] = args.lines && args.lines.length > 0
    ? args.lines
    : [{
        description: invoice.job || fallbackDescription,
        quantity: 1,
        unitPrice: round2(invoice.amount / (1 + fallbackVatRatePercent / 100)),
      }];

  const net = round2(source.reduce((s, li) => s + li.quantity * li.unitPrice, 0));
  const breakdown = documentVatBreakdown(net, source, fallbackVatRatePercent);

  const lineItems: InvoiceLineItem[] = source.map((li) => ({
    description: li.description,
    quantity: li.quantity,
    unitPrice: li.unitPrice,
    vatRate: li.vatRate ?? fallbackVatRatePercent,
    total: round2(li.quantity * li.unitPrice),
  }));

  const issueDate = parseCalendarDay(invoice.sentAt ?? invoice.createdAt ?? null) ?? now;
  const due = parseCalendarDay(invoice.dueDate ?? null)
    ?? new Date(issueDate.getTime() + (invoice.dueInDays ?? 14) * 86_400_000);

  const addressTail = [customer?.postcode, customer?.city].filter(Boolean).join(' ');
  const customerAddress = [customer?.address, addressTail].filter(Boolean).join(', ');

  return {
    id: invoice.id,
    invoiceNumber: documentNumber(invoice),
    jobId: invoice.jobId ?? '',
    customerId: customer?.id ?? invoice.customerId ?? '',
    customerName: customer?.name ?? invoice.customerName ?? invoice.customer ?? '',
    customerEmail: customer?.email || undefined,
    customerAddress,
    issueDate,
    dueDate: due,
    // 'cancelled' exists only on the cash-flow shape; a cancelled invoice has
    // no PDF button, and draft is the safe reading if one ever appears.
    status: invoice.status === 'cancelled' ? 'draft' : invoice.status,
    lineItems,
    subtotal: breakdown.net,
    vatAmount: breakdown.vat,
    total: breakdown.gross,
    paidAmount: invoice.status === 'paid' ? breakdown.gross : 0,
    payments: [],
    reminders: [],
    notes: invoice.notes,
  };
}

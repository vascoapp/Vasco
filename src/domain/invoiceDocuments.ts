// =============================================================================
// The documents an invoice becomes — ONE builder for every path.
// =============================================================================
// The invoice screen assembled the e-invoice (XRechnung / ZUGFeRD / Factur-X),
// the ES/IT mapper source and the PDF extras inline, per handler, and the
// copies drifted (2026-09-24):
//   - the ES/IT source named the buyer by the raw `invoice.customer` — an id
//     on R13.2-era invoices (#214) — while XRechnung used the resolved name;
//   - the EMAILED PDF left out the French 2026 mentions and the persisted
//     delivery date that the VIEWED PDF carried.
// The screen, the email path and the records archive all build from here.
// =============================================================================
import type { EInvoiceData } from '../integrations/einvoice';
import type { EInvoiceSource } from '../integrations/einvoiceMapping';
import type { BusinessProfile } from './business';
import { isSmallBusinessExempt, documentVatBreakdown } from './business';
import type { Invoice } from './documents';
import { documentNumber } from './documents';
import type { Customer } from './customers';
import { findDocumentCustomer } from './customers';
import { customerSignOffFor, type CustomerSignOff } from './signOff';

export interface InvoiceLine {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate?: number;
}

export interface InvoiceDocInputs {
  invoice: Invoice;
  /** The invoice's lines — `invoiceLinesFor` when not edited on screen. */
  lines: InvoiceLine[];
  customers: ReadonlyArray<Customer>;
  businessProfile: BusinessProfile | null | undefined;
  /** The contractor's country (profile first, account as fallback). */
  country: string;
  /** The rate a line without its own rate is billed at, as a fraction (0.19). */
  effectiveRate: number;
}

/**
 * The stored lines, or — for an invoice that never had any — one line
 * synthesised from its GROSS amount at the effective rate.
 */
export function invoiceLinesFor(
  invoice: Invoice,
  stored: ReadonlyArray<InvoiceLine> | undefined,
  effectiveRate: number,
  fallbackDescription: string,
): InvoiceLine[] {
  if (stored && stored.length > 0) {
    return stored.map((li, idx) => ({
      id: li.id || `item-${idx}`,
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      vatRate: li.vatRate,
    }));
  }
  return [{
    id: 'item-1',
    description: invoice.job || fallbackDescription,
    quantity: 1,
    unitPrice: invoice.amount / (1 + effectiveRate),
  }];
}

/** The name a HUMAN (or a tax authority) should read for this invoice's buyer. */
export function invoiceBuyerName(invoice: Invoice, customers: ReadonlyArray<Customer>): string {
  return findDocumentCustomer(customers, invoice)?.name ?? invoice.customer ?? '';
}

function totals(inp: InvoiceDocInputs) {
  const subtotal = inp.lines.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
  const b = documentVatBreakdown(subtotal, inp.lines, Math.round(inp.effectiveRate * 100));
  return { subtotal, vat: b.vat, gross: b.gross };
}

const currencyFor = (country: string) => (country === 'UK' ? 'GBP' : country === 'US' ? 'USD' : 'EUR');
const invoiceNumberOf = (invoice: Invoice) => documentNumber(invoice);
const issueDateOf = (invoice: Invoice) =>
  (invoice.sentAt ?? invoice.createdAt ?? invoice.deliveryDate ?? new Date().toISOString()).slice(0, 10);
// `??`, not `||`: 0 days is "due on receipt", and `|| 14` filed it as 14
// days later on every e-invoice (review 2026-09-24).
const dueDateOf = (invoice: Invoice) =>
  (invoice.dueDate ?? new Date(Date.now() + (invoice.dueInDays ?? 14) * 24 * 60 * 60 * 1000).toISOString()).slice(0, 10);

/** XRechnung / ZUGFeRD / Factur-X input. Per-line rates — this copy reaches a TAX AUTHORITY. */
export function buildEInvoiceData(inp: InvoiceDocInputs): EInvoiceData {
  const bp = (inp.businessProfile ?? {}) as Record<string, any>;
  const customer = findDocumentCustomer(inp.customers, inp.invoice);
  const t = totals(inp);
  const ratePct = inp.effectiveRate * 100;
  return {
    sellerName: bp.businessName ?? 'Vasco',
    sellerAddress: bp.address ?? '',
    sellerVatId: bp.vatNumber ?? '',
    // BR-DE-5/6/7 (contact) and BR-DE-8/9 (address detail) are rejections at
    // the buyer's gateway — see src/integrations/einvoice.ts.
    sellerCity: bp.city,
    sellerPostalCode: bp.postcode,
    sellerCountry: inp.country,
    sellerContactName: bp.businessName,
    sellerPhone: bp.phone,
    sellerEmail: bp.email,
    buyerName: invoiceBuyerName(inp.invoice, inp.customers),
    buyerAddress: (inp.invoice as any).customerAddress ?? '',
    buyerCity: customer?.city,
    buyerPostalCode: customer?.postcode,
    buyerCountry: customer?.country ?? inp.country,
    buyerVatId: customer?.vatId ?? (inp.invoice as any).customerVatId,
    invoiceNumber: invoiceNumberOf(inp.invoice),
    invoiceDate: issueDateOf(inp.invoice),
    dueDate: dueDateOf(inp.invoice),
    currency: currencyFor(inp.country),
    lineItems: inp.lines.map((li) => ({
      description: li.description,
      quantity: li.quantity,
      unitCode: 'piece',
      unitPrice: li.unitPrice,
      vatRate: li.vatRate ?? ratePct,
      vatAmount: li.quantity * li.unitPrice * ((li.vatRate ?? ratePct) / 100),
      lineTotal: li.quantity * li.unitPrice,
    })),
    totalNet: t.subtotal,
    totalVat: t.vat,
    totalGross: t.gross,
    // `E` (seller under a small-business scheme) vs `Z` (zero-rated supply).
    sellerVatExempt: isSmallBusinessExempt(bp),
    iban: bp.iban,
    bic: bp.bic,
    paymentReference: invoiceNumberOf(inp.invoice),
  };
}

/** The neutral model the ES (Facturae) and IT (FatturaPA) mappers take. */
export function buildEInvoiceSource(inp: InvoiceDocInputs): EInvoiceSource {
  const bp = (inp.businessProfile ?? {}) as Record<string, any>;
  const customer = findDocumentCustomer(inp.customers, inp.invoice);
  const t = totals(inp);
  return {
    seller: {
      name: bp.businessName ?? '',
      vatId: bp.vatNumber,
      taxId: bp.registrationNumber,
      address: bp.address,
      city: bp.city,
      postcode: bp.postcode,
      province: bp.province,
      country: inp.country,
      fiscalRegime: bp.fiscalRegime,
      personType: bp.personType,
      email: bp.email,
      phone: bp.phone,
      iban: bp.iban,
    },
    buyer: {
      // Was the raw `invoice.customer` — an id on converted invoices, filed
      // with SDI / FACe as the buyer's name.
      name: invoiceBuyerName(inp.invoice, inp.customers),
      vatId: customer?.vatId,
      taxId: customer?.taxId,
      address: customer?.address,
      city: customer?.city,
      postcode: customer?.postcode,
      province: customer?.province,
      country: customer?.country ?? inp.country,
      einvoiceRouting: customer?.einvoiceRouting,
      einvoiceEmail: customer?.einvoiceEmail,
    },
    invoiceNumber: invoiceNumberOf(inp.invoice),
    invoiceDate: issueDateOf(inp.invoice),
    dueDate: dueDateOf(inp.invoice),
    currency: currencyFor(inp.country),
    // A wrong AliquotaIVA here is a wrong rate filed with SDI, which accepts it.
    lines: inp.lines.map((li) => ({
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      lineTotal: li.quantity * li.unitPrice,
      vatRate: li.vatRate ?? inp.effectiveRate * 100,
    })),
    totalNet: t.subtotal,
    totalVat: t.vat,
    totalGross: t.gross,
  };
}

export interface InvoicePdfExtras {
  /** The persisted delivery date first (it survives the job), then the job's completion. */
  deliveryDate?: Date;
  customerSignature?: CustomerSignOff;
  frMentions: {
    buyerVatId?: string | null;
    operationNature?: 'goods' | 'services' | 'mixed' | null;
    deliveryAddress?: string | null;
    tvaSurLesDebits?: boolean | null;
  };
}

/** What every PDF of this invoice carries beyond its lines — viewed, emailed or archived. */
export function invoicePdfExtras(args: {
  /** Structural: the domain Invoice and the cash-flow list's row both fit. */
  invoice: {
    customer?: string | null;
    customerId?: string | null;
    jobId?: string | null;
    deliveryDate?: string | null;
    operationNature?: 'goods' | 'services' | 'mixed' | null;
    deliveryAddress?: string | null;
  };
  customers: ReadonlyArray<Customer>;
  jobs: ReadonlyArray<{ id: string; completedAt?: string | null; signatureSvg?: string | null; customerSignoffAt?: string | null; customerId?: string | null }>;
  businessProfile: BusinessProfile | null | undefined;
}): InvoicePdfExtras {
  const inv = args.invoice;
  const linkedJob = inv.jobId ? args.jobs.find((j) => j.id === inv.jobId) ?? null : null;
  const customer = findDocumentCustomer(args.customers, args.invoice);
  return {
    deliveryDate: inv.deliveryDate
      ? new Date(inv.deliveryDate)
      : linkedJob?.completedAt ? new Date(linkedJob.completedAt) : undefined,
    customerSignature: customerSignOffFor(linkedJob, args.customers as any, inv),
    // FR 2026 mentions: each fact prints a line only when it exists.
    frMentions: {
      buyerVatId: customer?.vatId,
      operationNature: inv.operationNature,
      deliveryAddress: inv.deliveryAddress,
      tvaSurLesDebits: (args.businessProfile as any)?.tvaSurLesDebits,
    },
  };
}

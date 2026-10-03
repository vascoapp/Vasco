// =============================================================================
// THE VAT REPORT — what the contractor hands their accountant (2026-10-03)
// =============================================================================
// User's decision: Vasco does NOT do tax returns. It gives a simple, correct
// report per period — sales and VAT per rate, VAT on purchases, the balance,
// and the documents behind every figure — which the contractor hands to their
// accountant or types into the tax portal themselves. No box mapping, no
// classification guesses, no filing.
//
// Why a new report and not vat-prep: `prepareVatReturn` took each invoice's
// GROSS amount and GUESSED its rate from words in the job title ("isolatie" →
// 9 %), then worked the VAT backwards. A mixed-rate invoice went into one box
// at one rate, and the figures could disagree with the invoices the customers
// received. This report adds up the invoices' OWN lines through the very
// function the PDF and the e-invoices print with (`pdfInvoiceFromRecord` →
// `documentVatBreakdown`, EN 16931: VAT per rate on the sum of line nets), so
// report == Σ invoices, to the cent, by construction.
//
// Pure: no React, no storage. The screen passes the stores in.
// =============================================================================

import { round2 } from '../utils/round2';
import { localDateKey, parseCalendarDay } from '../utils/dateKey';
import { isSmallBusinessExempt, type VatScheme } from '../domain/business';
import { findDocumentCustomer } from '../domain/customers';
import { documentNumber, type Invoice } from '../domain/documents';
import { pdfInvoiceFromRecord, type PdfSourceLine } from './invoicePdfSource';

export interface VatReportRow { ratePct: number; nature?: string; net: number; vat: number }

export interface VatReportInvoice {
  id: string;
  number: string;
  date: string;          // the day it counts on (issue day, or paid day on a cash basis)
  customer: string;
  net: number;
  vat: number;
  gross: number;
  rows: VatReportRow[];
}

export interface VatReportPurchase {
  id: string;
  date: string;
  supplier: string;
  description: string;
  net: number;
  vat: number;
  ratePct: number;
}

export interface VatReport {
  periodStart: string;   // YYYY-MM-DD, inclusive
  periodEnd: string;     // YYYY-MM-DD, inclusive
  basis: 'invoice' | 'cash';
  exempt: boolean;       // KOR / Kleinunternehmer: no VAT charged, none reclaimed
  sales: { rows: VatReportRow[]; net: number; vat: number; gross: number; invoices: VatReportInvoice[] };
  purchases: { rows: VatReportRow[]; net: number; vat: number; items: VatReportPurchase[] };
  /** Sales VAT − purchase VAT. Positive: to pay. Negative: to reclaim. */
  balance: number;
  /** What is NOT in the figures, and why — said, never silently dropped. */
  notIncluded: {
    drafts: Array<{ id: string; number: string; gross: number }>;
    unpaidOnCashBasis: Array<{ id: string; number: string; gross: number }>;
    /** Releases of withheld retention — already declared on the term invoices. */
    retentionReleases: Array<{ id: string; number: string; gross: number }>;
  };
}

export interface VatReportInput {
  periodStart: string;
  periodEnd: string;
  /** `vatBasis` from the profile: 'ist' = cash basis (counted when paid). */
  vatBasis?: 'soll' | 'ist';
  vatScheme?: VatScheme;
  /** The profile's effective standard rate in percent — the fallback for an invoice with no stored lines. */
  standardRatePct: number;
  invoices: Invoice[];
  /** `lineItems` from AppState, keyed by document number (or id). */
  lineItems: Record<string, PdfSourceLine[] | undefined>;
  customers?: Array<{ id: string; name: string }>;
  expenses: Array<{ id: string; description: string; supplier?: string; amount: number; vatAmount: number; vatRate: number; date: Date | string }>;
}

const dayOf = (v: string | Date | undefined | null): string | null => {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : localDateKey(v);
  // A date key stays a calendar day; an ISO timestamp becomes the LOCAL day it fell on.
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : localDateKey(d);
};

function addRows(into: Map<string, VatReportRow>, rows: VatReportRow[]) {
  for (const r of rows) {
    const k = `${r.ratePct}|${r.nature ?? ''}`;
    const cur = into.get(k) ?? { ratePct: r.ratePct, ...(r.nature ? { nature: r.nature } : {}), net: 0, vat: 0 };
    cur.net = round2(cur.net + r.net);
    cur.vat = round2(cur.vat + r.vat);
    into.set(k, cur);
  }
}
const sortRows = (m: Map<string, VatReportRow>) => [...m.values()].sort((a, b) => b.ratePct - a.ratePct || (a.nature ?? '').localeCompare(b.nature ?? ''));

export function buildVatReport(input: VatReportInput): VatReport {
  const cash = input.vatBasis === 'ist';
  const exempt = isSmallBusinessExempt({ vatScheme: input.vatScheme });
  const fallbackRate = exempt ? 0 : input.standardRatePct;
  const inPeriod = (day: string | null) => !!day && day >= input.periodStart && day <= input.periodEnd;

  const salesRows = new Map<string, VatReportRow>();
  const invoices: VatReportInvoice[] = [];
  const drafts: VatReport['notIncluded']['drafts'] = [];
  const unpaid: VatReport['notIncluded']['unpaidOnCashBasis'] = [];
  const retentionReleases: VatReport['notIncluded']['retentionReleases'] = [];

  for (const inv of input.invoices) {
    const number = documentNumber(inv);
    const issued = dayOf(inv.sentAt ?? inv.createdAt);
    const lines = input.lineItems[number] ?? input.lineItems[inv.id];
    const doc = pdfInvoiceFromRecord({ invoice: inv as any, lines, fallbackVatRatePercent: fallbackRate, fallbackDescription: inv.job ?? '' });

    if (inv.status === 'draft') {
      // Not issued yet as far as Vasco knows — but it may have been shared.
      // Said, so the contractor can confirm it went out.
      if (inPeriod(issued)) drafts.push({ id: inv.id, number, gross: doc.total });
      continue;
    }
    const day = cash ? (inv.status === 'paid' ? dayOf((inv as any).paidAt ?? (inv as any).paidDate) ?? issued : null) : issued;
    if (cash && inv.status !== 'paid') {
      if (inPeriod(issued)) unpaid.push({ id: inv.id, number, gross: doc.total });
      continue;
    }
    if (!inPeriod(day)) continue;
    // A retention release pays out money withheld from a term invoice whose
    // turnover and VAT were declared in full then. Counting it again here read
    // as new 0 % supplies (review, 2026-10-04): listed, not counted.
    if ((inv as any).isRetentionRelease) {
      retentionReleases.push({ id: inv.id, number, gross: doc.total });
      continue;
    }

    // The PDF's own rows: rated lines per rate (EN 16931), 0 % lines by nature.
    const rows: VatReportRow[] = exempt
      ? [{ ratePct: 0, net: doc.subtotal, vat: 0 }]
      : [
          // The rated groups the invoice's OWN totals were computed from — never
          // recomputed: calling vatRateGroups again with the rounded subtotal
          // tipped 4-decimal prices into its whole-document branch and taxed a
          // 0 % line (review, 2026-10-04). The 0 % group is split by its reason.
          ...(doc.vatGroups ?? []).filter((g) => g.ratePct !== 0).map((g) => ({ ratePct: g.ratePct, net: g.net, vat: g.vat })),
          ...zeroRateRows(doc.lineItems as any),
        ];
    addRows(salesRows, rows);
    // The ONE resolver (#214): FK → id-in-the-name-slot → name.
    const customer = findDocumentCustomer((input.customers ?? []) as any, inv as any)?.name ?? (inv as any).customerName ?? inv.customer ?? '';
    invoices.push({ id: inv.id, number, date: day!, customer, net: doc.subtotal, vat: doc.vatAmount, gross: doc.total, rows });
  }

  const purchaseRows = new Map<string, VatReportRow>();
  const items: VatReportPurchase[] = [];
  for (const e of input.expenses) {
    const day = dayOf(e.date);
    if (!inPeriod(day)) continue;
    // What the receipt says. An exempt contractor reclaims nothing.
    const vat = exempt ? 0 : round2(e.vatAmount ?? 0);
    const net = round2(e.amount ?? 0);
    const ratePct = exempt ? 0 : (e.vatRate ?? 0);
    addRows(purchaseRows, [{ ratePct, net, vat }]);
    items.push({ id: e.id, date: day!, supplier: e.supplier ?? '', description: e.description, net, vat, ratePct });
  }

  const sum = (xs: number[]) => round2(xs.reduce((s, x) => s + x, 0));
  const sales = {
    rows: sortRows(salesRows),
    net: sum(invoices.map((i) => i.net)),
    vat: sum(invoices.map((i) => i.vat)),
    gross: sum(invoices.map((i) => i.gross)),
    invoices: invoices.sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number)),
  };
  const purchases = {
    rows: sortRows(purchaseRows),
    net: sum(items.map((i) => i.net)),
    vat: sum(items.map((i) => i.vat)),
    items: items.sort((a, b) => a.date.localeCompare(b.date)),
  };
  return {
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    basis: cash ? 'cash' : 'invoice',
    exempt,
    sales,
    purchases,
    balance: round2(sales.vat - purchases.vat),
    notIncluded: { drafts, unpaidOnCashBasis: unpaid, retentionReleases },
  };
}

/** 0 % lines, by their stated reason (Italy's Natura) — vatRateGroups leaves them out. */
function zeroRateRows(lines: Array<{ quantity: number; unitPrice: number; vatRate?: number; vatNature?: string }>): VatReportRow[] {
  const m = new Map<string, number>();
  for (const l of lines) {
    if (l.vatRate !== 0) continue;
    const k = l.vatNature ?? '';
    m.set(k, round2((m.get(k) ?? 0) + round2(l.quantity * l.unitPrice)));
  }
  return [...m.entries()].map(([nature, net]) => ({ ratePct: 0, ...(nature ? { nature } : {}), net, vat: 0 }));
}

/** Calendar quarter / month / year bounds around `now`, as day keys. */
export function reportPeriod(kind: 'month' | 'quarter' | 'year', which: 'current' | 'previous', now: Date = new Date()): { start: string; end: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  let start: Date; let end: Date;
  if (kind === 'month') {
    const mm = which === 'current' ? m : m - 1;
    start = new Date(y, mm, 1); end = new Date(y, mm + 1, 0);
  } else if (kind === 'year') {
    const yy = which === 'current' ? y : y - 1;
    start = new Date(yy, 0, 1); end = new Date(yy, 11, 31);
  } else {
    const q = Math.floor(m / 3) + (which === 'current' ? 0 : -1);
    start = new Date(y, q * 3, 1); end = new Date(y, q * 3 + 3, 0);
  }
  return { start: localDateKey(start), end: localDateKey(end) };
}

export { parseCalendarDay };

// =============================================================================
// ACCOUNTANT HANDOVER — the first seat at the table for someone who is not the contractor
// =============================================================================
// Every Steuerberater and expert-comptable will be asked about the e-invoicing
// mandate by dozens of trades clients through 2027, and they answer for all of
// them at once. That makes the adviser a distribution channel rather than a
// single user — and the reason to build for them before building more for the
// contractor.
//
// The thing an accountant cannot get anywhere else is in here: PER-INVOICE
// FILING STATE. Every accounting package can tell them what was invoiced. None
// of them knows whether SDI accepted it, because that is not an accounting fact
// — it is the outcome of a submission, and a rejected FatturaPA means the
// invoice was never legally issued. An accountant who reconciles a rejected
// invoice as revenue is reconciling something that does not exist.
//
// -----------------------------------------------------------------------------
// SCOPE, AND WHAT THIS IS NOT YET
// -----------------------------------------------------------------------------
// This is a handover the contractor SENDS, not a portal the accountant logs
// into. A persistent seat needs an access-code table, an RPC and a web view —
// the pattern the customer portal already uses — and that needs a migration
// pushed to production. Rather than ship a login that cannot read anything, this
// delivers the content first through the share sheet the app already uses.
//
// It is read-only by construction. An accountant acting on a contractor's behalf
// without an audit trail would be the wrong thing to build, and the mandate is
// precisely the area where that would go wrong quietly.
// =============================================================================

import type { Invoice } from '../domain/documents';
import type { Submission } from './submissionLifecycle';

export interface HandoverInvoice {
  reference: string;
  customer: string;
  date?: string;
  amount: number;
  status: Invoice['status'];
  /**
   * Filing state, or null when this invoice has no regulated filing — which is
   * the correct answer in a country with no mandate, and NOT the same as "not
   * filed yet". Conflating the two would have an accountant chasing a Dutch
   * contractor for submissions that were never required.
   */
  filing: Submission['state'] | null;
}

export interface AccountantHandover {
  businessName: string;
  country: string;
  periodStart: string;
  periodEnd: string;
  invoices: HandoverInvoice[];
  totals: { invoiced: number; count: number };
  /** Filings the authority refused, or that failed in transit. Not issued. */
  notFiled: HandoverInvoice[];
  /** Handed over, no answer from the authority yet. */
  awaitingConfirmation: HandoverInvoice[];
  /** True when this country requires structured filing at all. */
  mandateApplies: boolean;
}

/** Countries where a regulated e-invoice filing is expected today. */
const FILING_COUNTRIES = new Set(['IT', 'ES', 'FR', 'DE']);

function inPeriod(iso: string | undefined, start: string, end: string): boolean {
  if (!iso) return false;
  const d = iso.slice(0, 10);
  return d >= start && d <= end;
}

export function buildAccountantHandover(input: {
  businessName: string;
  country: string;
  periodStart: string;
  periodEnd: string;
  invoices: Invoice[];
  submissions: Submission[];
}): AccountantHandover {
  const { periodStart, periodEnd } = input;
  const mandateApplies = FILING_COUNTRIES.has(input.country);

  // Latest filing per invoice. A corrected filing supersedes a rejected one, so
  // the most recent record is the one that describes where things stand — but
  // the rejection stays in the trail, which is what the audit needs.
  const latestBySubject = new Map<string, Submission>();
  for (const s of input.submissions) {
    const prev = latestBySubject.get(s.subjectId);
    if (!prev || s.createdAt > prev.createdAt) latestBySubject.set(s.subjectId, s);
  }

  const invoices: HandoverInvoice[] = input.invoices
    .filter((inv) => inPeriod(inv.sentAt ?? inv.createdAt, periodStart, periodEnd))
    .map((inv) => ({
      // Never the row id: it means nothing to an accountant and looks like data.
      reference: inv.reference || inv.customer || '—',
      customer: inv.customerName ?? inv.customer ?? '',
      date: (inv.sentAt ?? inv.createdAt)?.slice(0, 10),
      amount: inv.total ?? inv.amount ?? 0,
      status: inv.status,
      filing: latestBySubject.get(inv.id)?.state ?? null,
    }))
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

  return {
    businessName: input.businessName,
    country: input.country,
    periodStart,
    periodEnd,
    invoices,
    totals: {
      invoiced: Math.round(invoices.reduce((s, i) => s + i.amount, 0) * 100) / 100,
      count: invoices.length,
    },
    notFiled: invoices.filter((i) => i.filing === 'rejected' || i.filing === 'failed'),
    awaitingConfirmation: invoices.filter((i) => i.filing === 'submitted'),
    mandateApplies,
  };
}

/**
 * Plain text for the share sheet.
 *
 * Deliberately leads with what is WRONG. An accountant scanning a handover on a
 * phone needs the exceptions first; the full list is reference material they
 * will open on a desktop. Burying three unissued invoices under forty correct
 * ones is how they get missed.
 */
export function formatHandoverText(h: AccountantHandover, money: (n: number) => string): string {
  const lines: string[] = [];

  lines.push(`${h.businessName} — ${h.periodStart} to ${h.periodEnd}`);
  lines.push(`${h.totals.count} invoices · ${money(h.totals.invoiced)}`);
  lines.push('');

  if (h.notFiled.length > 0) {
    lines.push(`NOT FILED (${h.notFiled.length}) — these were refused, so they were never legally issued:`);
    for (const i of h.notFiled) {
      lines.push(`  · ${i.reference} — ${i.customer} — ${money(i.amount)}`);
    }
    lines.push('');
  }

  if (h.awaitingConfirmation.length > 0) {
    lines.push(`AWAITING CONFIRMATION (${h.awaitingConfirmation.length}) — sent, no answer from the authority yet:`);
    for (const i of h.awaitingConfirmation) {
      lines.push(`  · ${i.reference} — ${i.customer} — ${money(i.amount)}`);
    }
    lines.push('');
  }

  lines.push(`ALL INVOICES (${h.invoices.length}):`);
  for (const i of h.invoices) {
    // The filing column is omitted entirely where no mandate applies, rather
    // than printed as "none", which would read as a missing filing.
    const filing = h.mandateApplies ? ` · ${i.filing ?? 'no filing'}` : '';
    lines.push(`  ${i.date ?? ''} ${i.reference} — ${i.customer} — ${money(i.amount)} · ${i.status}${filing}`);
  }

  if (!h.mandateApplies) {
    lines.push('');
    lines.push('No structured e-invoice filing is required in this country today, so no filing status is shown.');
  }

  return lines.join('\n');
}

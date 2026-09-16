import type { Job } from '../domain/jobs';
import { grossFromDocumentLines } from '../domain/business';
import type { JobMaterial, Material } from '../domain/materials';

/**
 * What a finished job can be billed for.
 *
 * `addInvoiceFromJob` used to answer that with one line: the amount came from
 * `agreedAmount ?? quotedAmount`, and the lines were copied off the originating
 * QUOTE. Everything the contractor recorded while actually doing the work —
 * hours logged against the job, materials fitted — reached the invoice nowhere.
 * And a job with no quote at all could not be invoiced: the call threw
 * "job has no amount (€0)", the job screen swallowed the throw and navigated to
 * the invoice list anyway, so the contractor tapped "invoice this job", landed
 * on a list, and there was no invoice and no message.
 *
 * This module is the pure part of the answer, so it can be tested without
 * AppState.
 */
export interface BillableLine {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface JobBillingBasis {
  /** Lines to write onto the invoice. May be empty. */
  lineItems: BillableLine[];
  /**
   * Sum of the lines, NET. `Invoice.amount` is gross everywhere in this app
   * (the detail screen divides it back out by the VAT rate), so the caller
   * grosses this up with the profile's effective rate rather than this module
   * guessing at a rate it cannot see.
   */
  netAmount: number;
  /**
   * What was agreed up front, NET — only meaningful when source is 'quote'.
   * It is copied from `Quote.amount` (`quoteToJob`), and a quote's amount is
   * net. This field was documented and treated as GROSS, so a job invoiced
   * off an accepted €1.000 quote became an invoice of €1.000 gross: the VAT
   * was never billed (#339).
   */
  agreedAmount: number;
  /**
   * `quote` — a price was agreed up front and that is what gets billed.
   * `actuals` — nothing was agreed, so the job's own record is the bill.
   * `none` — neither; there is nothing to invoice yet.
   */
  source: 'quote' | 'actuals' | 'none';
  /**
   * What the job itself recorded — hours, materials, completion date — as one
   * line of prose for `Invoice.notes`. The contractor asked for the invoice to
   * arrive carrying the job's data; for a FIXED-PRICE job the lines cannot
   * carry it (the agreed total is the bill, and itemising the actuals under it
   * would make the lines disagree with the total), so it goes here, where it
   * is visible and editable before the invoice is sent.
   */
  workRecord?: string;
  /**
   * Hours the job recorded that could not be priced because no hourly rate is
   * set anywhere. They still appear as a line, at 0, rather than vanishing —
   * an invoice that is quietly missing its labour is worse than one with an
   * obvious blank on it.
   */
  unpricedHours: number;
}

export interface BillingLabels {
  /** e.g. "Labour" — takes {{hours}} */
  labour: (hours: number) => string;
  /** Fallback when a logged material is not in the catalogue. */
  material: string;
  /** One-line summary of what the job recorded, for the invoice's notes. */
  workRecord: (parts: { hours: number; materialCount: number; completedOn?: string }) => string;
}

/** Hours the job recorded, preferring the per-entry log over the rollup. */
export function loggedHours(job: Pick<Job, 'timeEntries' | 'actualHours'>): number {
  const entries = job.timeEntries ?? [];
  const fromEntries = entries.reduce((sum, e) => sum + (e.hours ?? 0), 0);
  if (fromEntries > 0) return Math.round(fromEntries * 100) / 100;
  return Math.round((job.actualHours ?? 0) * 100) / 100;
}

/**
 * Materials actually consumed. `planned` and `ordered` are intent, not work
 * done — billing those would charge the customer for a delivery that may never
 * have been fitted.
 */
export function billableMaterials(materials: JobMaterial[]): JobMaterial[] {
  return materials.filter(m => m.status === 'delivered' || m.status === 'installed');
}

export function buildJobActualLines(
  job: Pick<Job, 'timeEntries' | 'actualHours'>,
  jobMaterials: JobMaterial[],
  catalog: Pick<Material, 'id' | 'name'>[],
  hourlyRate: number | undefined,
  labels: BillingLabels,
): { lineItems: BillableLine[]; unpricedHours: number } {
  const lineItems: BillableLine[] = [];

  const hours = loggedHours(job);
  let unpricedHours = 0;
  if (hours > 0) {
    const rate = hourlyRate && hourlyRate > 0 ? hourlyRate : 0;
    if (rate === 0) unpricedHours = hours;
    lineItems.push({ description: labels.labour(hours), quantity: hours, unitPrice: rate });
  }

  for (const m of billableMaterials(jobMaterials)) {
    // `totalPrice` is what the line actually cost when it was recorded;
    // `unitPrice` may be missing on a hand-added row. Derive rather than drop.
    const qty = m.quantity > 0 ? m.quantity : 1;
    const unit = m.unitPrice ?? (m.totalPrice != null ? m.totalPrice / qty : 0);
    if (unit <= 0) continue; // a €0 material is stock we cannot price, not a gift
    const name = catalog.find(c => c.id === m.materialId)?.name ?? labels.material;
    lineItems.push({ description: name, quantity: qty, unitPrice: unit });
  }

  return { lineItems, unpricedHours };
}

/**
 * Decide what the invoice for this job says.
 *
 * A quoted job bills the quote — that is the agreement, and silently adding
 * the materials on top would re-charge for what the fixed price already
 * covered. What changes is the case the old code refused: no quote, but a
 * job full of recorded work.
 */
export function jobBillingBasis(args: {
  job: Pick<Job, 'timeEntries' | 'actualHours' | 'quotedAmount' | 'agreedAmount' | 'title' | 'completedAt'>;
  quoteLines: BillableLine[];
  jobMaterials: JobMaterial[];
  catalog: Pick<Material, 'id' | 'name'>[];
  hourlyRate?: number;
  labels: BillingLabels;
}): JobBillingBasis {
  const { job, quoteLines, jobMaterials, catalog, hourlyRate, labels } = args;
  const agreed = job.agreedAmount ?? job.quotedAmount ?? 0;

  // What the job recorded, regardless of how it is billed. A fixed-price
  // invoice carries it as a note; an actuals invoice carries it as lines.
  const hours = loggedHours(job);
  const billable = billableMaterials(jobMaterials);
  const workRecord = hours > 0 || billable.length > 0
    ? labels.workRecord({
        hours,
        materialCount: billable.length,
        completedOn: job.completedAt ?? undefined,
      })
    : undefined;

  if (agreed > 0) {
    // A job invoiced off an agreed price with no quote lines behind it used to
    // produce an invoice with NO specification at all — the detail screen
    // synthesised a "Services rendered" line at read time and nothing was ever
    // stored. Give it a real line, named after the job, at the agreed price.
    const lines = quoteLines.length > 0
      ? quoteLines
      : [{
          description: job.title,
          quantity: 1,
          // Already net (see `agreedAmount`). The caller grosses the lines up.
          unitPrice: Math.round(agreed * 100) / 100,
        }];
    const net = Math.round(lines.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0) * 100) / 100;
    return { lineItems: lines, netAmount: net, agreedAmount: agreed, source: 'quote', unpricedHours: 0, workRecord };
  }

  const { lineItems, unpricedHours } = buildJobActualLines(job, jobMaterials, catalog, hourlyRate, labels);
  const netAmount = Math.round(lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0) * 100) / 100;
  // Lines that add up to nothing are not an invoice. The case that reaches
  // here is real: hours logged, no rate anywhere to price them at. Reporting
  // 'none' with `unpricedHours` set lets the caller say WHICH of the two
  // reasons applies instead of quietly minting a €0 invoice — which is the
  // same silent-nothing this whole change exists to remove.
  if (netAmount <= 0) {
    return { lineItems: [], netAmount: 0, agreedAmount: 0, source: 'none', unpricedHours, workRecord };
  }
  return { lineItems, netAmount, agreedAmount: 0, source: 'actuals', unpricedHours, workRecord };
}

/**
 * The lines an invoice-from-job stores, and its GROSS `amount`.
 *
 * Extracted from `addInvoiceFromJob` so the arithmetic is testable: it used to
 * store `billing.agreedAmount` — the quote's NET amount — as the invoice's
 * GROSS total, so an accepted €1.000 quote invoiced as €1.000 and the VAT was
 * never billed (#339). It also dropped the agreed-price line when the job had
 * no quote lines, storing an invoice with none.
 *
 * - Quote lines, when there are any, pass through untouched: they carry the
 *   per-line `vatRate` the customer agreed to.
 * - Otherwise the basis's own lines (agreed-price line, or hours + materials).
 * - The amount follows the one VAT rule (`grossFromDocumentLines`): the lines'
 *   own rates when they reconcile, else `fallbackVatRatePercent` (0% for
 *   KOR / Kleinunternehmer).
 */
export function invoiceFromJobBilling<L extends { quantity: number; unitPrice: number; vatRate?: number }>(args: {
  billing: JobBillingBasis;
  quoteLines: L[];
  fallbackVatRatePercent: number;
  makeLine: (line: BillableLine, index: number) => L;
}): { lines: L[]; amount: number } {
  const { billing, quoteLines, fallbackVatRatePercent, makeLine } = args;
  const lines = billing.source === 'quote' && quoteLines.length > 0
    ? quoteLines
    : billing.lineItems.map(makeLine);
  return { lines, amount: grossFromDocumentLines(billing.netAmount, lines, fallbackVatRatePercent) };
}

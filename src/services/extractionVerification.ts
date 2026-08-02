// =============================================================================
// EXTRACTION VERIFICATION — arithmetic gate on LLM-extracted documents
// =============================================================================
// Vision/LLM extraction of a supplier invoice is the paperwork killer: it turns
// a photographed PDF into line items that feed the pricing moat. But an
// extractor that mis-reads "1.234,50" as "123450", drops a line, or invents a
// quantity does not fail loudly — it produces a plausible document that quietly
// poisons `material_price_history`, which is the training data the whole moat
// runs on.
//
// The defence is the same shape as the phrasing layer: THE MODEL PROPOSES, THE
// RULES ENGINE VERIFIES, AND ANYTHING UNVERIFIABLE IS DISCARDED. For phrasing
// the check is "no bare digits". Here it is arithmetic — and arithmetic is a
// far stronger gate, because a correctly extracted invoice is internally
// redundant:
//
//     unitPrice x quantity   == lineTotal      (per line)
//     sum(lineTotals)        == subtotal
//     subtotal x vatRate     == vatAmount
//     subtotal + vatAmount   == total
//
// An extractor that got a number wrong will almost always break one of these.
// That makes extraction *verifiable* in a way free-text generation never is.
//
// Everything here is pure and synchronous — no network, no LLM. It is the
// referee, so it must not depend on the thing it referees.
// =============================================================================

import type { ScannedInvoice, ScannedLineItem } from './invoiceScanService';

export type ExtractionSeverity = 'fatal' | 'warning';

export interface ExtractionIssue {
  severity: ExtractionSeverity;
  code: string;
  detail: string;
  /** Index into lineItems when the issue is line-scoped. */
  lineIndex?: number;
}

export interface VerificationResult {
  /** No fatal issues — safe to persist and feed the moat. */
  ok: boolean;
  /** Safe to feed the pricing moat. Stricter than `ok`. */
  moatSafe: boolean;
  issues: ExtractionIssue[];
  /** Lines that reconcile individually, usable even when the document total does not. */
  trustedLineIndices: number[];
}

// Money tolerance.
//
// The first version used max(cents, 0.5% of the value), which was the wrong
// model and left a real hole: 0.5% of a EUR 10,000 line is EUR 50, so a EUR 45
// extraction error was silently ACCEPTED and fed to the moat. Verified with a
// probe before changing it.
//
// Rounding error does not scale with magnitude — it accumulates PER LINE,
// because each line is independently rounded to the penny. So the bound is
// absolute and grows with the number of lines, not with the amount. The tiny
// relative term exists only to absorb IEEE-754 representation error on large
// sums (1e-9), never real discrepancies.
const CENT = 0.01;
const FLOAT_EPS = 1e-9;

/** Per-line check: quantity x unitPrice against the stated line total. */
function lineClose(a: number, b: number): boolean {
  return Math.abs(a - b) <= 2 * CENT + Math.abs(b) * FLOAT_EPS;
}

/** Document check: one penny of drift per line, plus a small floor. */
function docClose(a: number, b: number, lines: number): boolean {
  return Math.abs(a - b) <= CENT * Math.max(lines, 1) + 2 * CENT + Math.abs(b) * FLOAT_EPS;
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

/**
 * VAT rates that exist in the EU6 + US markets Vasco serves. A rate outside
 * this set is a misread decimal far more often than an exotic rate — 2.1 (FR
 * super-reduced) and 0 are real, 210 is a dropped decimal point.
 */
const PLAUSIBLE_VAT_RATES = [0, 2.1, 4, 5, 5.5, 6, 7, 9, 10, 12, 13, 19, 20, 21, 22, 23, 25];

function vatRatePlausible(rate: number): boolean {
  // Epsilon absorbs float noise only. The first version used 0.51, which was
  // wide enough to accept 0.5% as "0%" and 20.5% as "20%" — i.e. it let through
  // exactly the misread-decimal case the check exists to catch. Real rates are
  // never within 0.05 of each other.
  return PLAUSIBLE_VAT_RATES.some((r) => Math.abs(r - rate) < 0.05);
}

// ---------------------------------------------------------------------------
// Line-level checks
// ---------------------------------------------------------------------------

function verifyLine(line: ScannedLineItem, index: number): ExtractionIssue[] {
  const issues: ExtractionIssue[] = [];
  const at = (severity: ExtractionSeverity, code: string, detail: string) =>
    issues.push({ severity, code, detail, lineIndex: index });

  if (!line || typeof line !== 'object') {
    at('fatal', 'line_malformed', 'line item is not an object');
    return issues;
  }

  if (typeof line.description !== 'string' || line.description.trim().length === 0) {
    at('fatal', 'line_no_description', 'line has no description');
  }

  for (const [field, value] of [
    ['quantity', line.quantity],
    ['unitPrice', line.unitPrice],
    ['totalPrice', line.totalPrice],
  ] as const) {
    if (!isFiniteNumber(value)) {
      at('fatal', 'line_non_numeric', `${field} is not a finite number`);
    }
  }
  if (issues.some((i) => i.severity === 'fatal')) return issues;

  if (line.quantity <= 0) {
    at('fatal', 'line_bad_quantity', `quantity ${line.quantity} must be positive`);
  }
  // A negative unit price is a credit note line, which is legitimate; a
  // negative total with a positive unit price is not.
  if (((line.unitPrice < 0) !== (line.totalPrice < 0)) && line.totalPrice !== 0) {
    at('warning', 'line_sign_mismatch', 'unitPrice and totalPrice disagree on sign');
  }

  // THE line-level gate.
  const expected = line.quantity * line.unitPrice;
  if (!lineClose(expected, line.totalPrice)) {
    at(
      'fatal',
      'line_total_mismatch',
      `quantity x unitPrice = ${expected.toFixed(2)} but totalPrice = ${line.totalPrice.toFixed(2)}`,
    );
  }

  if (isFiniteNumber(line.vatRate) && !vatRatePlausible(line.vatRate)) {
    at('warning', 'line_vat_rate_implausible', `VAT rate ${line.vatRate}% is not a known EU/US rate`);
  }

  if (typeof line.unit !== 'string' || line.unit.trim().length === 0) {
    at('warning', 'line_no_unit', 'line has no unit — cohort grouping needs one');
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Document-level checks
// ---------------------------------------------------------------------------

/**
 * Verify an extracted document against itself.
 *
 * `ok` means "safe to show and persist". `moatSafe` is stricter: it additionally
 * requires that the document totals reconcile, because a document whose lines
 * do not add up may still have individually-correct lines but cannot be trusted
 * as a whole — and the moat is the asset we least want to poison.
 */
export function verifyExtractedInvoice(invoice: ScannedInvoice | null | undefined): VerificationResult {
  const issues: ExtractionIssue[] = [];
  const trustedLineIndices: number[] = [];

  if (!invoice || typeof invoice !== 'object') {
    return {
      ok: false,
      moatSafe: false,
      issues: [{ severity: 'fatal', code: 'no_document', detail: 'no document to verify' }],
      trustedLineIndices: [],
    };
  }

  const lines = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];
  if (lines.length === 0) {
    issues.push({ severity: 'fatal', code: 'no_line_items', detail: 'document has no line items' });
  }

  lines.forEach((line, i) => {
    const lineIssues = verifyLine(line, i);
    issues.push(...lineIssues);
    if (!lineIssues.some((x) => x.severity === 'fatal')) trustedLineIndices.push(i);
  });

  // --- subtotal reconciliation ---------------------------------------------
  const lineSum = trustedLineIndices.reduce((s, i) => s + lines[i].totalPrice, 0);
  let subtotalOk = false;
  if (!isFiniteNumber(invoice.subtotal) || invoice.subtotal === 0) {
    issues.push({ severity: 'warning', code: 'no_subtotal', detail: 'document has no subtotal to check against' });
  } else if (trustedLineIndices.length !== lines.length) {
    issues.push({
      severity: 'warning',
      code: 'subtotal_unverifiable',
      detail: 'some lines failed, so the subtotal cannot be reconciled',
    });
  } else if (!docClose(lineSum, invoice.subtotal, lines.length)) {
    // The classic signature of a DROPPED LINE: individually valid lines that
    // sum to less than the stated subtotal. Fatal, because feeding a partial
    // document to the moat records prices for a purchase that did not happen
    // as described.
    issues.push({
      severity: 'fatal',
      code: 'subtotal_mismatch',
      detail: `line items sum to ${lineSum.toFixed(2)} but subtotal is ${invoice.subtotal.toFixed(2)}`
        + (lineSum < invoice.subtotal ? ' — a line was probably missed' : ' — a line was probably double-counted'),
    });
  } else {
    subtotalOk = true;
  }

  // --- VAT + total reconciliation -------------------------------------------
  let totalsOk = false;
  const hasVat = isFiniteNumber(invoice.vatAmount);
  const hasTotal = isFiniteNumber(invoice.total) && invoice.total !== 0;
  const base = isFiniteNumber(invoice.subtotal) && invoice.subtotal !== 0 ? invoice.subtotal : lineSum;

  if (hasVat && hasTotal) {
    if (!docClose(base + invoice.vatAmount, invoice.total, lines.length)) {
      issues.push({
        severity: 'fatal',
        code: 'total_mismatch',
        detail: `subtotal ${base.toFixed(2)} + VAT ${invoice.vatAmount.toFixed(2)} = `
          + `${(base + invoice.vatAmount).toFixed(2)} but total is ${invoice.total.toFixed(2)}`,
      });
    } else {
      totalsOk = true;
    }

    // Cross-check VAT against the rates the lines claim. Only meaningful when
    // every line agrees on a rate; mixed-rate invoices are legitimate and are
    // checked by the total instead.
    const rates = new Set(
      lines.filter((l) => isFiniteNumber(l?.vatRate)).map((l) => l.vatRate),
    );
    if (rates.size === 1 && base > 0) {
      const rate = [...rates][0];
      const expectedVat = base * (rate / 100);
      if (!docClose(expectedVat, invoice.vatAmount, lines.length)) {
        issues.push({
          severity: 'warning',
          code: 'vat_amount_mismatch',
          detail: `${rate}% of ${base.toFixed(2)} = ${expectedVat.toFixed(2)} but vatAmount is ${invoice.vatAmount.toFixed(2)}`,
        });
      }
    }
  } else {
    issues.push({ severity: 'warning', code: 'no_totals', detail: 'document has no VAT/total to reconcile' });
  }

  // --- non-arithmetic sanity -------------------------------------------------
  if (typeof invoice.supplierName !== 'string' || invoice.supplierName.trim().length === 0) {
    issues.push({ severity: 'warning', code: 'no_supplier', detail: 'no supplier name — price observations need attribution' });
  }
  if (invoice.documentDate && Number.isNaN(Date.parse(invoice.documentDate))) {
    issues.push({ severity: 'warning', code: 'bad_date', detail: `documentDate "${invoice.documentDate}" is not parseable` });
  }

  const ok = !issues.some((i) => i.severity === 'fatal');
  return {
    ok,
    // The moat additionally demands that the document adds up end to end.
    moatSafe: ok && subtotalOk && totalsOk,
    issues,
    trustedLineIndices,
  };
}

/** One-line summary for logs and the scan-review UI. */
export function summariseVerification(result: VerificationResult): string {
  if (result.moatSafe) return 'Verified: document reconciles';
  const fatal = result.issues.filter((i) => i.severity === 'fatal');
  if (fatal.length > 0) return `Rejected: ${fatal[0].detail}`;
  const warn = result.issues.filter((i) => i.severity === 'warning');
  return warn.length > 0 ? `Accepted with warnings: ${warn[0].detail}` : 'Accepted';
}

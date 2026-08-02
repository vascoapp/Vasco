// =============================================================================
// CIS RETURN VERIFICATION — arithmetic gate before anything reaches HMRC
// =============================================================================
// The UK Construction Industry Scheme is the sharpest compliance wedge Vasco
// has: construction-specific, legally mandatory, MONTHLY, and it moves real
// money. A contractor paying subcontractors must deduct 0/20/30% from the
// LABOUR portion of every payment and file a return by the 19th.
//
// That also makes it the least forgiving thing to get wrong. An incorrect
// return is not a UX blemish — HMRC penalties start at £100 for one day late
// and escalate, an over-deduction takes money out of a subcontractor's pocket,
// and an under-deduction leaves the contractor liable for the shortfall.
//
// So the same rule as everywhere else in this codebase applies, and applies
// harder: THE SYSTEM PROPOSES, ARITHMETIC VERIFIES, UNVERIFIABLE IS DISCARDED.
// `ukComplianceService.calculateCISDeduction` already computes the numbers;
// this module is the independent referee that refuses to let a return that does
// not add up be submitted.
//
// The CIS rules encoded here:
//   * Materials are NOT subject to deduction. taxable = gross - materials.
//   * deduction = taxable x rate, where rate is 0 (gross status), 20
//     (registered/verified) or 30 (unverified) — nothing else is legal.
//   * net = gross - deduction.
//   * Figures are NET OF VAT. VAT never enters a CIS calculation.
//   * A nil return must still be filed; "no payments" is a valid return, not a
//     reason to skip the month.
//
// Pure and synchronous — no network, no HMRC SDK.
// =============================================================================

import type { CISPayment, CISMonthlyReturn } from '../types/uk-compliance';

export type CisSeverity = 'fatal' | 'warning';

export interface CisIssue {
  severity: CisSeverity;
  code: string;
  detail: string;
  /** Index into `payments` when the issue is payment-scoped. */
  paymentIndex?: number;
}

export interface CisVerificationResult {
  /** No fatal issues — safe to submit to HMRC. */
  ok: boolean;
  issues: CisIssue[];
  /** Recomputed from the payments, independent of the declared totals. */
  computed: { totalGross: number; totalMaterials: number; totalDeductions: number; totalNet: number };
}

/** The only deduction rates CIS permits. */
const LEGAL_RATES = [0, 20, 30];

// Money tolerance: HMRC works to the penny; allow per-payment rounding only.
const PENNY = 0.01;
function close(a: number, b: number, items = 1): boolean {
  return Math.abs(a - b) <= PENNY * Math.max(items, 1) + PENNY;
}

function finite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// Payment-level
// ---------------------------------------------------------------------------

export function verifyCisPayment(p: CISPayment, index: number): CisIssue[] {
  const issues: CisIssue[] = [];
  const at = (severity: CisSeverity, code: string, detail: string) =>
    issues.push({ severity, code, detail, paymentIndex: index });

  if (!p || typeof p !== 'object') {
    at('fatal', 'payment_malformed', 'payment is not an object');
    return issues;
  }

  for (const [field, v] of [
    ['grossAmount', p.grossAmount],
    ['materialsDeduction', p.materialsDeduction],
    ['cisDeduction', p.cisDeduction],
    ['netPayment', p.netPayment],
  ] as const) {
    if (!finite(v)) at('fatal', 'payment_non_numeric', `${field} is not a finite number`);
  }
  if (issues.length > 0) return issues;

  if (p.grossAmount <= 0) {
    at('fatal', 'payment_bad_gross', `grossAmount ${p.grossAmount} must be positive`);
  }
  if (p.materialsDeduction < 0) {
    at('fatal', 'payment_negative_materials', 'materialsDeduction cannot be negative');
  }
  // Materials above gross would make the labour element negative and produce a
  // negative deduction — i.e. money flowing the wrong way.
  if (p.materialsDeduction > p.grossAmount) {
    at('fatal', 'payment_materials_exceed_gross',
      `materials ${p.materialsDeduction.toFixed(2)} exceed gross ${p.grossAmount.toFixed(2)}`);
  }

  if (!LEGAL_RATES.includes(p.deductionRateApplied)) {
    at('fatal', 'payment_illegal_rate',
      `deduction rate ${p.deductionRateApplied}% is not a CIS rate (0, 20 or 30)`);
  }

  // A 20% rate requires the subcontractor to have been verified; 30% is the
  // unverified rate. Filing 20% with no verification number is the common way
  // a contractor becomes liable for the shortfall.
  if (p.deductionRateApplied === 20 && !String(p.verificationNumber ?? '').trim()) {
    at('warning', 'payment_unverified_at_20',
      'the 20% rate needs a verification number — unverified subcontractors are 30%');
  }

  if (!String(p.subcontractorUtr ?? '').trim()) {
    at('fatal', 'payment_no_utr', 'subcontractor UTR is required on a CIS return');
  }

  if (issues.some((i) => i.severity === 'fatal')) return issues;

  // THE calculation, recomputed independently.
  const taxable = p.grossAmount - p.materialsDeduction;
  const expectedDeduction = round2(taxable * (p.deductionRateApplied / 100));
  if (!close(expectedDeduction, p.cisDeduction)) {
    at('fatal', 'payment_deduction_mismatch',
      `(gross ${p.grossAmount.toFixed(2)} - materials ${p.materialsDeduction.toFixed(2)}) x `
      + `${p.deductionRateApplied}% = ${expectedDeduction.toFixed(2)} but cisDeduction is ${p.cisDeduction.toFixed(2)}`);
  }

  const expectedNet = round2(p.grossAmount - p.cisDeduction);
  if (!close(expectedNet, p.netPayment)) {
    at('fatal', 'payment_net_mismatch',
      `gross - deduction = ${expectedNet.toFixed(2)} but netPayment is ${p.netPayment.toFixed(2)}`);
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Return-level
// ---------------------------------------------------------------------------

/**
 * The dates a CIS tax month actually covers.
 *
 * UK tax months run from the **6th to the 5th**, not calendar months — so the
 * return labelled `2026-07` covers 6 July to 5 August, and is due 19 August.
 * Including a payment dated outside that window puts it in the wrong return:
 * it is both missing from the correct month and wrong in this one, which is two
 * filing errors from one mistake.
 */
export function cisPeriodRange(taxMonth: string): { start: string; end: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(taxMonth ?? '');
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  const endYear = month === 12 ? year + 1 : year;
  const endMonth = month === 12 ? 1 : month + 1;
  return {
    start: `${year}-${String(month).padStart(2, '0')}-06`,
    end: `${endYear}-${String(endMonth).padStart(2, '0')}-05`,
  };
}

/** `YYYY-MM` -> the 19th of the following month, per CIS filing rules. */
export function cisDueDate(taxMonth: string): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(taxMonth ?? '');
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  const dueYear = month === 12 ? year + 1 : year;
  const dueMonth = month === 12 ? 1 : month + 1;
  return `${dueYear}-${String(dueMonth).padStart(2, '0')}-19`;
}

export function verifyCisReturn(ret: CISMonthlyReturn | null | undefined): CisVerificationResult {
  const issues: CisIssue[] = [];
  const empty = { totalGross: 0, totalMaterials: 0, totalDeductions: 0, totalNet: 0 };

  if (!ret || typeof ret !== 'object') {
    return {
      ok: false,
      issues: [{ severity: 'fatal', code: 'no_return', detail: 'no return to verify' }],
      computed: empty,
    };
  }

  if (!/^\d{4}-\d{2}$/.test(ret.taxMonth ?? '')) {
    issues.push({ severity: 'fatal', code: 'bad_tax_month', detail: `taxMonth "${ret.taxMonth}" is not YYYY-MM` });
  }

  const expectedDue = cisDueDate(ret.taxMonth);
  if (expectedDue && ret.dueDate && ret.dueDate !== expectedDue) {
    issues.push({
      severity: 'warning',
      code: 'due_date_mismatch',
      detail: `CIS returns are due the 19th of the following month (${expectedDue}), not ${ret.dueDate}`,
    });
  }

  const payments = Array.isArray(ret.payments) ? ret.payments : [];

  // A nil return is legitimate and MUST still be filed — but it has to be
  // labelled, or HMRC reads an empty return as a non-filing.
  if (payments.length === 0 && ret.status !== 'nil-return') {
    issues.push({
      severity: 'warning',
      code: 'empty_not_marked_nil',
      detail: 'no payments — a month with no subcontractor payments must be filed as a nil return',
    });
  }

  payments.forEach((p, i) => issues.push(...verifyCisPayment(p, i)));

  // Payment dates must fall inside the 6th-to-5th tax month this return covers.
  const range = cisPeriodRange(ret.taxMonth);
  if (range) {
    payments.forEach((p, i) => {
      const d = String(p?.paymentDate ?? '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        issues.push({
          severity: 'fatal', code: 'payment_bad_date', paymentIndex: i,
          detail: `paymentDate "${p?.paymentDate}" is not YYYY-MM-DD`,
        });
      } else if (d < range.start || d > range.end) {
        issues.push({
          severity: 'fatal', code: 'payment_outside_period', paymentIndex: i,
          detail: `paid ${d}, outside tax month ${ret.taxMonth} (${range.start} to ${range.end}) `
            + '— UK tax months run 6th to 5th',
        });
      }
    });
  }

  const usable = payments.filter((_, i) => !issues.some((x) => x.paymentIndex === i && x.severity === 'fatal'));
  const computed = {
    totalGross: round2(usable.reduce((s, p) => s + (finite(p?.grossAmount) ? p.grossAmount : 0), 0)),
    totalMaterials: round2(usable.reduce((s, p) => s + (finite(p?.materialsDeduction) ? p.materialsDeduction : 0), 0)),
    totalDeductions: round2(usable.reduce((s, p) => s + (finite(p?.cisDeduction) ? p.cisDeduction : 0), 0)),
    totalNet: round2(usable.reduce((s, p) => s + (finite(p?.netPayment) ? p.netPayment : 0), 0)),
  };

  // Declared totals must match the payments they claim to summarise. This is
  // what catches a payment added or removed after the totals were computed.
  if (usable.length === payments.length) {
    const checks: Array<[string, number, number]> = [
      ['totalGross', ret.totalGross, computed.totalGross],
      ['totalDeductions', ret.totalDeductions, computed.totalDeductions],
      ['totalNet', ret.totalNet, computed.totalNet],
    ];
    for (const [field, declared, expected] of checks) {
      if (!finite(declared)) {
        issues.push({ severity: 'fatal', code: 'total_missing', detail: `${field} is not a finite number` });
      } else if (!close(declared, expected, payments.length)) {
        issues.push({
          severity: 'fatal',
          code: 'total_mismatch',
          detail: `${field} declared ${declared.toFixed(2)} but the payments sum to ${expected.toFixed(2)}`,
        });
      }
    }
  } else {
    issues.push({
      severity: 'warning',
      code: 'totals_unverifiable',
      detail: 'some payments failed, so the declared totals cannot be reconciled',
    });
  }

  return { ok: !issues.some((i) => i.severity === 'fatal'), issues, computed };
}

/** One-line summary for logs and the pre-submit confirmation screen. */
export function summariseCisVerification(r: CisVerificationResult): string {
  const fatal = r.issues.filter((i) => i.severity === 'fatal');
  if (fatal.length > 0) return `Cannot file: ${fatal[0].detail}`;
  const warn = r.issues.filter((i) => i.severity === 'warning');
  return warn.length > 0 ? `Ready to file, with warnings: ${warn[0].detail}` : 'Ready to file';
}

// =============================================================================
// CIS RETURN VERIFICATION
// =============================================================================
// CIS moves real money and carries real penalties: an over-deduction takes cash
// out of a subcontractor's pocket, an under-deduction leaves the contractor
// liable for the shortfall, and a late or malformed return starts at £100.
// These tests encode the rules rather than the current implementation, so they
// stay valid if calculateCISDeduction is ever rewritten.
// =============================================================================

import {
  verifyCisReturn,
  verifyCisPayment,
  cisDueDate,
  cisPeriodRange,
  summariseCisVerification,
} from '../cisReturnVerification';
import type { CISPayment, CISMonthlyReturn } from '../../types/uk-compliance';

const payment = (over: Partial<CISPayment> = {}): CISPayment => {
  const gross = over.grossAmount ?? 1000;
  const materials = over.materialsDeduction ?? 200;
  const rate = over.deductionRateApplied ?? 20;
  const deduction = Math.round((gross - materials) * (rate / 100) * 100) / 100;
  return {
    id: 'cis-1',
    contractorUtr: '1234567890',
    subcontractorUtr: '0987654321',
    subcontractorName: 'A. Sub Ltd',
    paymentDate: '2026-07-15',
    grossAmount: gross,
    materialsDeduction: materials,
    cisDeduction: deduction,
    netPayment: Math.round((gross - deduction) * 100) / 100,
    verificationNumber: 'V123456',
    deductionRateApplied: rate,
    ...over,
  };
};

const ret = (over: Partial<CISMonthlyReturn> = {}): CISMonthlyReturn => {
  const payments = over.payments ?? [payment()];
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    id: 'ret-1',
    taxMonth: '2026-07',
    dueDate: '2026-08-19',
    status: 'draft',
    payments,
    totalGross: over.totalGross ?? r2(payments.reduce((s, p) => s + p.grossAmount, 0)),
    totalDeductions: over.totalDeductions ?? r2(payments.reduce((s, p) => s + p.cisDeduction, 0)),
    totalNet: over.totalNet ?? r2(payments.reduce((s, p) => s + p.netPayment, 0)),
    ...over,
  };
};

describe('the CIS calculation', () => {
  it('accepts a correct payment', () => {
    // (1000 - 200) x 20% = 160 deduction, 840 net
    expect(verifyCisPayment(payment(), 0)).toEqual([]);
  });

  it('deducts from labour only, never from materials', () => {
    const wrong = payment({ cisDeduction: 200, netPayment: 800 }); // 20% of GROSS
    const issues = verifyCisPayment(wrong, 0);
    expect(issues.some((i) => i.code === 'payment_deduction_mismatch')).toBe(true);
  });

  it.each([
    [0, 0],
    [20, 160],
    [30, 240],
  ])('applies the %i%% rate correctly', (rate, expected) => {
    const p = payment({ deductionRateApplied: rate as 0 | 20 | 30 });
    expect(p.cisDeduction).toBeCloseTo(expected, 2);
    expect(verifyCisPayment(p, 0).filter((i) => i.severity === 'fatal')).toEqual([]);
  });

  it('rejects a rate CIS does not permit', () => {
    const p = payment({ deductionRateApplied: 25 as unknown as 20 });
    expect(verifyCisPayment(p, 0).some((i) => i.code === 'payment_illegal_rate')).toBe(true);
  });

  it('rejects materials exceeding gross', () => {
    const p = payment({ grossAmount: 500, materialsDeduction: 900 });
    expect(verifyCisPayment(p, 0).some((i) => i.code === 'payment_materials_exceed_gross')).toBe(true);
  });

  it('rejects a net that does not equal gross minus deduction', () => {
    expect(verifyCisPayment(payment({ netPayment: 999 }), 0)
      .some((i) => i.code === 'payment_net_mismatch')).toBe(true);
  });

  it('requires a subcontractor UTR', () => {
    expect(verifyCisPayment(payment({ subcontractorUtr: '' }), 0)
      .some((i) => i.code === 'payment_no_utr')).toBe(true);
  });

  // The way contractors become liable for a shortfall.
  it('warns when 20% is applied with no verification number', () => {
    const issues = verifyCisPayment(payment({ verificationNumber: '' }), 0);
    expect(issues.some((i) => i.code === 'payment_unverified_at_20')).toBe(true);
    expect(issues.some((i) => i.severity === 'fatal')).toBe(false);
  });

  it('does not warn about verification at the 30% unverified rate', () => {
    const p = payment({ deductionRateApplied: 30, verificationNumber: '' });
    expect(verifyCisPayment(p, 0).some((i) => i.code === 'payment_unverified_at_20')).toBe(false);
  });

  it('handles junk without throwing', () => {
    expect(() => verifyCisPayment(null as unknown as CISPayment, 0)).not.toThrow();
    expect(verifyCisPayment(payment({ grossAmount: NaN }), 0)
      .some((i) => i.code === 'payment_non_numeric')).toBe(true);
  });
});

describe('return totals', () => {
  it('accepts a return whose totals match its payments', () => {
    const r = verifyCisReturn(ret({ payments: [payment(), payment({ grossAmount: 500, materialsDeduction: 0 })] }));
    expect(r.ok).toBe(true);
    expect(summariseCisVerification(r)).toMatch(/Ready to file/);
  });

  // Catches a payment added or removed after the totals were computed.
  it('catches declared totals that do not match the payments', () => {
    const r = verifyCisReturn(ret({ totalGross: 9999 }));
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'total_mismatch')).toBe(true);
    expect(summariseCisVerification(r)).toMatch(/Cannot file/);
  });

  it('recomputes totals independently of what was declared', () => {
    const r = verifyCisReturn(ret({ payments: [payment(), payment()] }));
    expect(r.computed.totalGross).toBeCloseTo(2000, 2);
    expect(r.computed.totalDeductions).toBeCloseTo(320, 2);
    expect(r.computed.totalNet).toBeCloseTo(1680, 2);
    expect(r.computed.totalMaterials).toBeCloseTo(400, 2);
  });

  it('propagates a bad payment as a fatal return issue', () => {
    const r = verifyCisReturn(ret({ payments: [payment({ cisDeduction: 1 })] }));
    expect(r.ok).toBe(false);
  });
});

describe('filing rules', () => {
  it('computes the 19th-of-following-month deadline', () => {
    expect(cisDueDate('2026-07')).toBe('2026-08-19');
  });

  it('rolls the year over from December', () => {
    expect(cisDueDate('2026-12')).toBe('2027-01-19');
  });

  it('rejects a malformed tax month', () => {
    expect(cisDueDate('July 2026')).toBeNull();
    expect(cisDueDate('2026-13')).toBeNull();
    expect(verifyCisReturn(ret({ taxMonth: 'nope' })).ok).toBe(false);
  });

  it('warns when the stated due date is not the statutory one', () => {
    const r = verifyCisReturn(ret({ dueDate: '2026-08-31' }));
    expect(r.issues.some((i) => i.code === 'due_date_mismatch')).toBe(true);
  });

  // A quiet month still has to be filed — silence reads as non-filing.
  it('warns when an empty month is not marked as a nil return', () => {
    const r = verifyCisReturn(ret({ payments: [], totalGross: 0, totalDeductions: 0, totalNet: 0 }));
    expect(r.issues.some((i) => i.code === 'empty_not_marked_nil')).toBe(true);
    expect(r.ok).toBe(true); // a warning, not a blocker
  });

  it('accepts a properly labelled nil return without complaint', () => {
    const r = verifyCisReturn(ret({
      payments: [], status: 'nil-return', totalGross: 0, totalDeductions: 0, totalNet: 0,
    }));
    expect(r.issues.some((i) => i.code === 'empty_not_marked_nil')).toBe(false);
    expect(r.ok).toBe(true);
  });

  it('handles a null return without throwing', () => {
    expect(verifyCisReturn(null).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// UK tax months run 6th to 5th — not calendar months
// ---------------------------------------------------------------------------
describe('the tax month a return actually covers', () => {
  it('runs from the 6th to the 5th of the next month', () => {
    expect(cisPeriodRange('2026-07')).toEqual({ start: '2026-07-06', end: '2026-08-05' });
  });

  it('rolls the year over from December', () => {
    expect(cisPeriodRange('2026-12')).toEqual({ start: '2026-12-06', end: '2027-01-05' });
  });

  it('rejects a malformed month', () => {
    expect(cisPeriodRange('2026-13')).toBeNull();
  });

  it('accepts a payment inside the window', () => {
    for (const d of ['2026-07-06', '2026-07-20', '2026-08-05']) {
      const r = verifyCisReturn(ret({ payments: [payment({ paymentDate: d })] }));
      expect(r.issues.some((i) => i.code === 'payment_outside_period')).toBe(false);
    }
  });

  // A payment in the wrong return is TWO filing errors from one mistake:
  // missing from the right month, wrong in this one.
  it.each(['2026-07-05', '2026-08-06', '2026-06-30'])('rejects a payment dated %s', (d) => {
    const r = verifyCisReturn(ret({ payments: [payment({ paymentDate: d })] }));
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'payment_outside_period')).toBe(true);
  });

  it('rejects an unparseable payment date', () => {
    const r = verifyCisReturn(ret({ payments: [payment({ paymentDate: 'last tuesday' })] }));
    expect(r.issues.some((i) => i.code === 'payment_bad_date')).toBe(true);
  });
});

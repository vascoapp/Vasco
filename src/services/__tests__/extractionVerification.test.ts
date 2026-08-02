// =============================================================================
// EXTRACTION VERIFICATION — the arithmetic gate
// =============================================================================
// These tests encode the failure modes an OCR/LLM extractor actually produces
// on a photographed supplier invoice: a misread decimal, a dropped line, a
// swapped thousands separator. Each one is caught by internal redundancy rather
// than by trusting the model's own confidence score.
// =============================================================================

import { verifyExtractedInvoice, summariseVerification } from '../extractionVerification';
import type { ScannedInvoice, ScannedLineItem } from '../invoiceScanService';

const line = (over: Partial<ScannedLineItem> = {}): ScannedLineItem => ({
  description: 'YMvK kabel 3x2.5mm2',
  category: 'cable',
  quantity: 10,
  unit: 'm',
  unitPrice: 2.5,
  vatRate: 21,
  totalPrice: 25,
  confidence: 90,
  ...over,
});

const invoice = (over: Partial<ScannedInvoice> = {}): ScannedInvoice => {
  const lineItems = over.lineItems ?? [line()];
  const subtotal = over.subtotal ?? lineItems.reduce((s, l) => s + l.totalPrice, 0);
  const vatAmount = over.vatAmount ?? Number((subtotal * 0.21).toFixed(2));
  return {
    id: 'scan-1',
    documentType: 'invoice',
    supplierName: 'Technische Unie',
    documentDate: '2026-08-01',
    lineItems,
    subtotal,
    vatAmount,
    total: over.total ?? Number((subtotal + vatAmount).toFixed(2)),
    confidence: 88,
    scannedAt: '2026-08-02T10:00:00Z',
    ...over,
  };
};

describe('a clean document', () => {
  it('verifies and is safe to feed the moat', () => {
    const r = verifyExtractedInvoice(invoice());
    expect(r.ok).toBe(true);
    expect(r.moatSafe).toBe(true);
    expect(r.issues.filter((i) => i.severity === 'fatal')).toEqual([]);
    expect(summariseVerification(r)).toMatch(/reconciles/);
  });

  it('tolerates per-line rounding', () => {
    // 3 x 3.33 = 9.99, supplier prints 10.00.
    const r = verifyExtractedInvoice(
      invoice({ lineItems: [line({ quantity: 3, unitPrice: 3.33, totalPrice: 10.0 })] }),
    );
    expect(r.ok).toBe(true);
  });

  it('accepts multiple lines that add up', () => {
    const r = verifyExtractedInvoice(
      invoice({
        lineItems: [
          line({ quantity: 10, unitPrice: 2.5, totalPrice: 25 }),
          line({ description: 'Wartel M20', quantity: 20, unitPrice: 0.45, totalPrice: 9 }),
        ],
      }),
    );
    expect(r.moatSafe).toBe(true);
  });
});

describe('line-level arithmetic', () => {
  it('rejects a line whose total does not equal quantity x unitPrice', () => {
    const r = verifyExtractedInvoice(
      invoice({ lineItems: [line({ quantity: 10, unitPrice: 2.5, totalPrice: 250 })] }),
    );
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'line_total_mismatch')).toBe(true);
  });

  // The classic OCR failure: a decimal point read as a thousands separator.
  it('catches a misread decimal', () => {
    const r = verifyExtractedInvoice(
      invoice({ lineItems: [line({ quantity: 2, unitPrice: 1234.5, totalPrice: 24.69 })] }),
    );
    expect(r.ok).toBe(false);
  });

  it('rejects a non-positive quantity', () => {
    const r = verifyExtractedInvoice(invoice({ lineItems: [line({ quantity: 0, totalPrice: 0 })] }));
    expect(r.issues.some((i) => i.code === 'line_bad_quantity')).toBe(true);
  });

  it('rejects a line with no description', () => {
    const r = verifyExtractedInvoice(invoice({ lineItems: [line({ description: '  ' })] }));
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'line_no_description')).toBe(true);
  });

  it('rejects non-numeric fields without throwing', () => {
    const bad = line({ unitPrice: undefined as unknown as number });
    expect(() => verifyExtractedInvoice(invoice({ lineItems: [bad] }))).not.toThrow();
    expect(verifyExtractedInvoice(invoice({ lineItems: [bad] })).ok).toBe(false);
  });

  it('warns on an implausible VAT rate but does not reject the document', () => {
    const r = verifyExtractedInvoice(invoice({ lineItems: [line({ vatRate: 210 })] }));
    expect(r.issues.some((i) => i.code === 'line_vat_rate_implausible')).toBe(true);
    expect(r.ok).toBe(true);
  });

  it('accepts every real EU rate', () => {
    for (const rate of [0, 6, 7, 9, 19, 20, 21, 22, 25]) {
      const r = verifyExtractedInvoice(invoice({ lineItems: [line({ vatRate: rate })] }));
      expect(r.issues.some((i) => i.code === 'line_vat_rate_implausible')).toBe(false);
    }
  });

  it('isolates the bad line and still trusts the good ones', () => {
    const r = verifyExtractedInvoice(
      invoice({
        lineItems: [line(), line({ quantity: 5, unitPrice: 1, totalPrice: 999 })],
        subtotal: 1024,
      }),
    );
    expect(r.trustedLineIndices).toEqual([0]);
  });
});

describe('document-level reconciliation', () => {
  // The signature of a DROPPED LINE — every line is individually valid.
  it('catches a dropped line via the subtotal', () => {
    const r = verifyExtractedInvoice(invoice({ lineItems: [line()], subtotal: 100 }));
    expect(r.ok).toBe(false);
    const issue = r.issues.find((i) => i.code === 'subtotal_mismatch');
    expect(issue?.detail).toMatch(/probably missed/);
  });

  it('names double-counting when the lines overshoot', () => {
    const r = verifyExtractedInvoice(invoice({ lineItems: [line(), line()], subtotal: 25 }));
    expect(r.issues.find((i) => i.code === 'subtotal_mismatch')?.detail).toMatch(/double-counted/);
  });

  it('catches a total that does not equal subtotal + VAT', () => {
    const r = verifyExtractedInvoice(invoice({ subtotal: 25, vatAmount: 5.25, total: 999 }));
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'total_mismatch')).toBe(true);
  });

  it('warns when the stated VAT disagrees with a single-rate document', () => {
    // Lines all claim 21%, but vatAmount is a 9% figure — and total agrees with
    // it, so only the cross-check can see the problem.
    const r = verifyExtractedInvoice(invoice({ subtotal: 25, vatAmount: 2.25, total: 27.25 }));
    expect(r.issues.some((i) => i.code === 'vat_amount_mismatch')).toBe(true);
  });

  it('does not cross-check VAT on a mixed-rate document', () => {
    const r = verifyExtractedInvoice(
      invoice({
        lineItems: [
          line({ vatRate: 21, quantity: 10, unitPrice: 2.5, totalPrice: 25 }),
          line({ vatRate: 9, quantity: 10, unitPrice: 1, totalPrice: 10 }),
        ],
        subtotal: 35,
        vatAmount: 6.15,
        total: 41.15,
      }),
    );
    expect(r.issues.some((i) => i.code === 'vat_amount_mismatch')).toBe(false);
    expect(r.ok).toBe(true);
  });

  it('is ok but NOT moat-safe when totals are absent', () => {
    const r = verifyExtractedInvoice(
      invoice({ subtotal: 0, vatAmount: undefined as unknown as number, total: 0 }),
    );
    expect(r.ok).toBe(true);
    expect(r.moatSafe).toBe(false);
  });

  it('rejects a document with no line items', () => {
    expect(verifyExtractedInvoice(invoice({ lineItems: [] })).ok).toBe(false);
  });

  it('handles null without throwing', () => {
    expect(verifyExtractedInvoice(null).ok).toBe(false);
  });

  it('warns on a missing supplier and an unparseable date', () => {
    const r = verifyExtractedInvoice(invoice({ supplierName: '', documentDate: 'not-a-date' }));
    expect(r.issues.some((i) => i.code === 'no_supplier')).toBe(true);
    expect(r.issues.some((i) => i.code === 'bad_date')).toBe(true);
    expect(r.ok).toBe(true); // warnings, not fatal
  });
});

describe('moatSafe is stricter than ok', () => {
  it('withholds moat feeding when the subtotal cannot be reconciled', () => {
    const r = verifyExtractedInvoice(
      invoice({ subtotal: 0, vatAmount: 5.25, total: 30.25 }),
    );
    expect(r.ok).toBe(true);
    expect(r.moatSafe).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// REGRESSION — tolerance was magnitude-relative and far too loose
// ---------------------------------------------------------------------------
// The first version used max(cents, 0.5% of value). A probe showed a EUR 45
// error on a EUR 10,000 line was silently ACCEPTED and fed to the moat.
// Rounding accumulates per LINE, not proportionally to the amount.
describe('tolerance is absolute, not proportional', () => {
  it('rejects a EUR 5 error on a EUR 1000 line', () => {
    const r = verifyExtractedInvoice(
      invoice({ lineItems: [line({ quantity: 1, unitPrice: 1000, totalPrice: 1005 })], subtotal: 1005 }),
    );
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'line_total_mismatch')).toBe(true);
  });

  it('rejects a EUR 45 error on a EUR 10000 line', () => {
    const r = verifyExtractedInvoice(
      invoice({ lineItems: [line({ quantity: 1, unitPrice: 10000, totalPrice: 10045 })], subtotal: 10045 }),
    );
    expect(r.ok).toBe(false);
  });

  it('rejects even a 10 cent error on a large line', () => {
    const r = verifyExtractedInvoice(
      invoice({ lineItems: [line({ quantity: 1, unitPrice: 9000, totalPrice: 9000.1 })], subtotal: 9000.1 }),
    );
    expect(r.ok).toBe(false);
  });

  it('still tolerates genuine penny rounding on a large line', () => {
    // 3 x 3333.33 = 9999.99; supplier prints 10000.00
    const r = verifyExtractedInvoice(
      invoice({ lineItems: [line({ quantity: 3, unitPrice: 3333.33, totalPrice: 10000 })], subtotal: 10000 }),
    );
    expect(r.ok).toBe(true);
  });

  it('lets rounding accumulate across many lines without false-flagging', () => {
    const many = Array.from({ length: 20 }, () => line({ quantity: 3, unitPrice: 3.33, totalPrice: 10 }));
    // each line rounds up 1c => 20c drift against an exact subtotal
    const r = verifyExtractedInvoice(invoice({ lineItems: many, subtotal: 199.8 }));
    expect(r.issues.some((i) => i.code === 'subtotal_mismatch')).toBe(false);
  });
});

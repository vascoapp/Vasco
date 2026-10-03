import { isVatNature, type VatNature } from './vatNature';

export type QuoteLineItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  // R66 round 47: per-line VAT rate. Persisted on line_items.vat_rate
  // (migration 20260508000001). Mixed-rate quotes (NL plumbing 9% labor +
  // 21% materials) survive cold start via this field. KOR contractors
  // get 0 across all lines (driven by businessProfile.vatScheme at write
  // time in AppState.addQuote / addInvoice).
  vatRate?: number;
  /**
   * Italy: WHY a 0 % line carries no IVA — the FatturaPA Natura (N6.3 reverse
   * charge subappalto edile, N4 esente …). Persisted on line_items.vat_nature
   * (migration 20261003000003). Meaningful only with vatRate 0; every writer
   * sends it through `lineVatNature`, which drops it otherwise.
   */
  vatNature?: VatNature;
};

/**
 * The vat_nature column value for a line: a valid code on a 0 % line, NULL on
 * anything else. One rule for every writer (create, convert, edit, heal), so
 * the CHECK constraint can never reject an app write and a nature can never
 * sit on a rated line (SDI 00401).
 */
export function lineVatNature(line: { vatRate?: number | null; vatNature?: unknown }, fallbackRate?: number | null): VatNature | null {
  const rate = line.vatRate ?? fallbackRate;
  return rate === 0 && isVatNature(line.vatNature) ? line.vatNature : null;
}

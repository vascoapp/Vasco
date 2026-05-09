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
};

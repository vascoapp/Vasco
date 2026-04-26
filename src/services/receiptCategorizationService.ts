// =============================================================================
// RECEIPT CATEGORIZATION (R246)
// =============================================================================
// Extends invoiceScanService with: auto-categorization (materials / labor /
// fuel / tools / overhead), VAT-bucket assignment (high/low/exempt), and
// supplier matching against the user's known suppliers.
//
// Runs purely from the parsed line items — no extra Claude call, just
// keyword + supplier matching against the existing suppliers registry.
// =============================================================================

import type { ScannedInvoice, ScannedLineItem } from './invoiceScanService';

export type ExpenseCategory =
  | 'materials_pipe' | 'materials_fittings' | 'materials_electrical' | 'materials_lumber'
  | 'materials_paint' | 'materials_tile' | 'materials_other'
  | 'labor_subcontractor' | 'labor_temp_staff'
  | 'tools_consumable' | 'tools_capital'
  | 'fuel' | 'parking_tolls'
  | 'overhead_office' | 'overhead_subscription' | 'overhead_insurance'
  | 'meals_travel'
  | 'unknown';

export type VatBucket = 'standard' | 'reduced' | 'exempt' | 'reverse_charge';

export interface CategorizedLine {
  line: ScannedLineItem;
  category: ExpenseCategory;
  vatBucket: VatBucket;
  matchedSupplierId?: string;
  confidence: number;
}

export interface CategorizedInvoice {
  invoice: ScannedInvoice;
  lines: CategorizedLine[];
  totalsByCategory: Record<ExpenseCategory, number>;
  totalsByVatBucket: Record<VatBucket, number>;
}

// Keyword patterns per category — order matters; first match wins.
const CATEGORY_RULES: Array<{ category: ExpenseCategory; patterns: RegExp[] }> = [
  { category: 'materials_pipe', patterns: [/\bbuis\b/i, /\bpijp/i, /\bpipe\b/i, /\brohr/i, /\btuyau/i, /\bcopper\b/i, /\bppr\b/i, /\bpex\b/i] },
  { category: 'materials_fittings', patterns: [/\bkoppeling/i, /\belbow\b/i, /\btee\b/i, /\bventiel/i, /\bvalve\b/i, /\bfitting/i] },
  { category: 'materials_electrical', patterns: [/\bkabel\b/i, /\bcable\b/i, /\bschakel/i, /\bswitch\b/i, /\bsocket\b/i, /\bstoppcontact/i, /\bleitung/i] },
  { category: 'materials_lumber', patterns: [/\bplank/i, /\bhout\b/i, /\bwood\b/i, /\bbalk\b/i, /\bbeam\b/i, /\bplywood/i, /\bosb\b/i, /\bplaat/i] },
  { category: 'materials_paint', patterns: [/\bverf\b/i, /\bpaint/i, /\black\b/i, /\bfarbe/i, /\bprimer/i, /\bcoating/i] },
  { category: 'materials_tile', patterns: [/\btegel/i, /\btile/i, /\bfliese/i, /\bgrout\b/i, /\bvoeg/i] },
  { category: 'fuel', patterns: [/\bbenzine/i, /\bdiesel/i, /\bbrandstof/i, /\bpetrol/i, /\bfuel\b/i, /\btankstation/i, /\bshell\b/i, /\bbp\b/i] },
  { category: 'parking_tolls', patterns: [/\bparkeren/i, /\bparking/i, /\btol\b/i, /\bmaut/i, /\bp\+r\b/i] },
  { category: 'meals_travel', patterns: [/\bhotel\b/i, /\blunch/i, /\bdiner/i, /\bdinner/i, /\bovernachting/i] },
  { category: 'tools_capital', patterns: [/\bmachine\b/i, /\bsaw\b/i, /\bdrill\b/i, /\bzaag\b/i, /\bboor/i, /\bhilti/i, /\bmakita/i, /\bdewalt/i] },
  { category: 'tools_consumable', patterns: [/\bschroef/i, /\bscrew\b/i, /\bnagel/i, /\bnail\b/i, /\bschuurpapier/i, /\bsandpaper/i, /\bbit\b/i] },
  { category: 'overhead_subscription', patterns: [/\babonnement/i, /\bsubscription/i, /\bsoftware/i, /\bsaas\b/i, /\bvasco\b/i, /\bmoneybird/i, /\bmicrosoft\b/i] },
  { category: 'overhead_insurance', patterns: [/\bverzekering/i, /\binsurance\b/i, /\bversicherung/i, /\bassurance/i] },
];

// Standard VAT rates per country — used to bucket each line.
const VAT_BUCKETS: Record<number, VatBucket> = {
  21: 'standard',  9: 'reduced',
  19: 'standard',  7: 'reduced',
  20: 'standard',  10: 'reduced', 5: 'reduced',
  0: 'exempt',
};

export function categorizeLine(line: ScannedLineItem, knownSuppliers: Array<{ id: string; aliases: string[] }> = []): CategorizedLine {
  const desc = String(line.description ?? '').toLowerCase();
  let category: ExpenseCategory = 'materials_other';
  let confidence = 0.4;

  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some((p) => p.test(desc))) {
      category = rule.category;
      confidence = 0.85;
      break;
    }
  }

  if (category === 'materials_other' && desc.length < 4) {
    category = 'unknown';
    confidence = 0.1;
  }

  const vatRate = Math.round(Number(line.vatRate ?? 0));
  const vatBucket = VAT_BUCKETS[vatRate] ?? 'standard';

  // Try supplier match (line could mention "Tech Unie" / "Hornbach" etc.)
  let matchedSupplierId: string | undefined;
  for (const sup of knownSuppliers) {
    if (sup.aliases.some((alias) => desc.includes(alias.toLowerCase()))) {
      matchedSupplierId = sup.id;
      confidence = Math.min(0.95, confidence + 0.1);
      break;
    }
  }

  return { line, category, vatBucket, matchedSupplierId, confidence };
}

export function categorizeInvoice(
  invoice: ScannedInvoice,
  knownSuppliers: Array<{ id: string; aliases: string[] }> = [],
): CategorizedInvoice {
  const lines = (invoice.lineItems ?? []).map((l) => categorizeLine(l, knownSuppliers));

  const totalsByCategory = {} as Record<ExpenseCategory, number>;
  const totalsByVatBucket = {} as Record<VatBucket, number>;

  for (const cl of lines) {
    const lineTotal = (Number(cl.line.quantity) || 0) * (Number(cl.line.unitPrice) || 0);
    totalsByCategory[cl.category] = (totalsByCategory[cl.category] ?? 0) + lineTotal;
    totalsByVatBucket[cl.vatBucket] = (totalsByVatBucket[cl.vatBucket] ?? 0) + lineTotal;
  }

  return { invoice, lines, totalsByCategory, totalsByVatBucket };
}

/**
 * Spreadsheet Extractor — smart column mapping + extraction from parsed sheets.
 * Detects Dutch+English column names and converts rows into ExtractedInvoice format
 * compatible with the existing ingestion pipeline.
 */

import type { ParsedSheet } from './spreadsheetParser';
import type { ExtractedInvoice, ExtractedLineItem } from './invoiceExtractor';

// ── Column Mapping ─────────────────────────────────────────

type FieldType =
  | 'description' | 'quantity' | 'unit' | 'price' | 'total'
  | 'brand' | 'category' | 'sku'
  | 'supplier' | 'invoiceNumber' | 'date'
  | 'subtotal' | 'vat' | 'grandTotal';

const FIELD_PATTERNS: Record<FieldType, RegExp[]> = {
  description: [/omschrijving/i, /description/i, /artikel/i, /product/i, /item/i, /naam/i],
  quantity: [/aantal/i, /qty/i, /quantity/i, /hoeveelheid/i, /stuks/i],
  unit: [/eenheid/i, /unit/i, /eeh/i],
  price: [/prijs/i, /price/i, /stukprijs/i, /unit.?price/i, /tarief/i, /per.?stuk/i],
  total: [/totaal/i, /total/i, /bedrag/i, /amount/i, /regelprijs/i, /line.?total/i],
  brand: [/merk/i, /brand/i, /fabrikant/i, /manufacturer/i],
  category: [/categorie/i, /category/i, /groep/i, /group/i],
  sku: [/artikelnr/i, /article/i, /sku/i, /ean/i, /product.?code/i, /artikelcode/i],
  supplier: [/leverancier/i, /supplier/i, /vendor/i],
  invoiceNumber: [/factuurnr/i, /invoice.?#/i, /invoice.?no/i, /factuurnummer/i, /documentnr/i],
  date: [/datum/i, /date/i, /factuurdatum/i, /invoice.?date/i],
  subtotal: [/subtotaal/i, /subtotal/i, /excl/i, /netto/i],
  vat: [/btw/i, /vat/i, /tax/i, /belasting/i],
  grandTotal: [/totaal.*incl/i, /grand.?total/i, /incl.*btw/i, /te.?betalen/i],
};

export interface ColumnMapping {
  field: FieldType;
  column: string;
  confidence: number;
}

/**
 * Match sheet headers to known field types. Returns best-match for each field.
 */
export function detectMapping(headers: string[]): ColumnMapping[] {
  const mappings: ColumnMapping[] = [];

  for (const [field, patterns] of Object.entries(FIELD_PATTERNS) as [FieldType, RegExp[]][]) {
    let bestMatch: { column: string; confidence: number } | null = null;

    for (const header of headers) {
      for (let i = 0; i < patterns.length; i++) {
        if (patterns[i].test(header)) {
          const confidence = 1 - i * 0.1; // First pattern = highest confidence
          if (!bestMatch || confidence > bestMatch.confidence) {
            bestMatch = { column: header, confidence: Math.max(confidence, 0.5) };
          }
        }
      }
    }

    if (bestMatch) {
      mappings.push({ field, column: bestMatch.column, confidence: bestMatch.confidence });
    }
  }

  return mappings;
}

// ── Helpers ─────────────────────────────────────────────────

function getStr(row: Record<string, string | number>, mapping: ColumnMapping[] | undefined, field: FieldType): string | undefined {
  const m = mapping?.find((c) => c.field === field);
  if (!m) return undefined;
  const val = row[m.column];
  return val != null && val !== '' ? String(val) : undefined;
}

function getNum(row: Record<string, string | number>, mapping: ColumnMapping[] | undefined, field: FieldType): number {
  const m = mapping?.find((c) => c.field === field);
  if (!m) return 0;
  const val = row[m.column];
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const normalized = val.replace(/[€$\s]/g, '').replace(/\./g, '').replace(',', '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

// ── Extraction ─────────────────────────────────────────────

/**
 * Extract an invoice from a parsed spreadsheet sheet.
 * Compatible with the existing ExtractedInvoice type from invoiceExtractor.
 */
export function extractFromSpreadsheet(
  sheet: ParsedSheet,
  sourceUri: string,
  supplierOverride?: string,
): ExtractedInvoice {
  const mapping = detectMapping(sheet.headers);

  // Try to extract invoice-level metadata from first few rows
  let supplierName = supplierOverride;
  let invoiceNumber: string | undefined;
  let invoiceDate: string | undefined;

  // Check if supplier/invoice fields exist in mapped columns
  if (!supplierName && mapping.find((m) => m.field === 'supplier')) {
    // Take from first non-empty row
    for (const row of sheet.rows.slice(0, 5)) {
      const val = getStr(row, mapping, 'supplier');
      if (val) { supplierName = val; break; }
    }
  }
  if (mapping.find((m) => m.field === 'invoiceNumber')) {
    for (const row of sheet.rows.slice(0, 5)) {
      const val = getStr(row, mapping, 'invoiceNumber');
      if (val) { invoiceNumber = val; break; }
    }
  }
  if (mapping.find((m) => m.field === 'date')) {
    for (const row of sheet.rows.slice(0, 5)) {
      const val = getStr(row, mapping, 'date');
      if (val) { invoiceDate = val; break; }
    }
  }

  // Extract line items
  const lineItems: ExtractedLineItem[] = [];

  for (const row of sheet.rows) {
    const description = getStr(row, mapping, 'description');
    if (!description) continue; // skip rows without a description

    const quantity = getNum(row, mapping, 'quantity') || 1;
    const unitPrice = getNum(row, mapping, 'price');
    const totalPrice = getNum(row, mapping, 'total') || unitPrice * quantity;
    const unit = getStr(row, mapping, 'unit') ?? 'stuk';
    const brand = getStr(row, mapping, 'brand');
    const category = getStr(row, mapping, 'category');
    const sku = getStr(row, mapping, 'sku');

    // Skip rows that look like totals/summaries (no unit price AND total > 0 might be a summary)
    if (unitPrice <= 0 && totalPrice <= 0) continue;

    lineItems.push({
      id: `xls_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      description,
      quantity,
      unit,
      unitPrice: unitPrice || (totalPrice / quantity),
      totalPrice,
      confidence: mapping.length >= 4 ? 0.8 : 0.6,
      brand,
      category,
      sku,
    });
  }

  // Compute totals
  const subtotal = lineItems.reduce((s, i) => s + i.totalPrice, 0);
  const vatRate = 21;
  const vatAmount = subtotal * (vatRate / 100);
  const total = subtotal + vatAmount;

  // Determine document type heuristic
  const hasInvoiceKeyword = sheet.headers.some((h) => /factuur|invoice/i.test(h));
  const documentType: ExtractedInvoice['documentType'] = hasInvoiceKeyword ? 'invoice' : 'unknown';

  return {
    id: `xls_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    documentType,
    documentNumber: invoiceNumber,
    documentDate: invoiceDate,
    supplierName,
    subtotal,
    vatAmount,
    vatRate,
    total,
    currency: 'EUR',
    lineItems,
    rawText: `[Spreadsheet: ${sheet.name}, ${sheet.rowCount} rows]`,
    extractionConfidence: lineItems.length > 0 ? (mapping.length >= 4 ? 0.85 : 0.65) : 0.2,
    extractedAt: new Date().toISOString(),
    sourceUri,
  };
}

/**
 * Extraction Bridge — converts between invoiceExtractor output,
 * Supabase row shapes, and the pdfSchema ExtractedDocument type
 * used by priceRisk and the existing AppState.
 */

import type { ExtractedInvoice, ExtractedLineItem } from './invoiceExtractor';
import type { ExtractedDocument } from './pdfSchema';

// ── invoiceExtractor → DB rows ──────────────────────────────

export function extractedInvoiceToRow(
  invoice: ExtractedInvoice,
  sourceType: 'pdf' | 'camera' | 'paste' | 'excel' | 'csv',
  sourceUri?: string,
) {
  const docType = invoice.documentType === 'order' ? 'unknown' as const : invoice.documentType;
  return {
    source_type: sourceType,
    source_uri: sourceUri ?? invoice.sourceUri,
    doc_type: docType,
    supplier_name: invoice.supplierName,
    supplier_id: invoice.supplierId,
    document_number: invoice.documentNumber,
    document_date: invoice.documentDate,
    total_amount: invoice.total,
    vat_amount: invoice.vatAmount,
    currency: invoice.currency,
    confidence: invoice.extractionConfidence,
    raw_text: invoice.rawText,
    extracted_json: {
      subtotal: invoice.subtotal,
      vatRate: invoice.vatRate,
      supplierAddress: invoice.supplierAddress,
      supplierVatNumber: invoice.supplierVatNumber,
    },
  };
}

export function extractedLineItemsToRows(invoice: ExtractedInvoice) {
  return invoice.lineItems.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    total_price: item.totalPrice,
    unit: item.unit,
    brand: item.brand,
    category: item.category,
    article_number: item.sku,
    confidence: item.confidence,
  }));
}

// ── DB rows → pdfSchema ExtractedDocument (for priceRisk compat) ─

export function rowToExtractedDocument(
  row: {
    doc_type: string;
    supplier_name?: string;
    document_date?: string;
    total_amount?: number;
    vat_amount?: number;
  },
  itemRows: {
    description: string;
    quantity?: number;
    unit_price?: number;
    total_price?: number;
  }[],
): ExtractedDocument {
  const lineItems = itemRows.map((r) => ({
    description: r.description,
    quantity: r.quantity ?? 1,
    unitPrice: r.unit_price ?? 0,
    totalPrice: r.total_price ?? r.unit_price ?? 0,
  }));

  const total = row.total_amount ?? lineItems.reduce((s, i) => s + i.totalPrice, 0);
  const taxTotal = row.vat_amount ?? 0;
  const subtotal = total - taxTotal;

  return {
    source: 'pdf',
    docType: (row.doc_type === 'invoice' || row.doc_type === 'quote') ? row.doc_type : 'invoice',
    vendorName: row.supplier_name,
    issueDate: row.document_date,
    lineItems,
    subtotal,
    taxTotal,
    total,
    currency: 'EUR',
  };
}

// ── invoiceExtractor → pdfSchema ExtractedDocument (direct) ─

export function invoiceToExtractedDocument(invoice: ExtractedInvoice): ExtractedDocument {
  return {
    source: 'pdf',
    docType: (invoice.documentType === 'invoice' || invoice.documentType === 'quote')
      ? invoice.documentType
      : 'invoice',
    vendorName: invoice.supplierName,
    issueDate: invoice.documentDate,
    lineItems: invoice.lineItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
    })),
    subtotal: invoice.subtotal ?? 0,
    taxTotal: invoice.vatAmount ?? 0,
    total: invoice.total ?? 0,
    currency: 'EUR',
  };
}

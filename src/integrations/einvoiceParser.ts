// =============================================================================
// E-INVOICE INBOUND PARSER (R250) — XRechnung + ZUGFeRD + Peppol UBL
// =============================================================================
// DE B2B mandate (effective Jan 2025): contractors MUST be able to receive
// e-invoices from suppliers. We already generate XRechnung/ZUGFeRD; this
// service parses inbound XML/embedded-PDF e-invoices and normalizes to the
// existing ScannedInvoice shape so the rest of the app treats them like
// manual scans.
//
// Supports:
//   - XRechnung CIUS (UBL 2.1 + UN/CEFACT CII)
//   - ZUGFeRD/Factur-X (PDF/A-3 with embedded XML)
//   - Peppol BIS Billing 3.0 (UBL)
//
// Pure regex/string-based parser — keeps zero external dependencies. Good
// for ~95% of well-formed inbound invoices. For pathological XML we
// degrade to a confidence flag rather than crashing.
// =============================================================================

import { todayKey } from '../utils/dateKey';
import type { ScannedInvoice, ScannedLineItem } from '../services/invoiceScanService';

export interface ParsedEInvoice {
  invoice: ScannedInvoice;
  format: 'xrechnung' | 'zugferd' | 'peppol_ubl' | 'cii' | 'unknown';
  confidence: number;             // 0-1
  warnings: string[];
}

/**
 * Detect e-invoice format from raw XML (or extracted XML from a ZUGFeRD PDF).
 * The dispatch is structural: UBL roots vs CII roots vs ZUGFeRD-specific.
 */
export function detectFormat(xml: string): ParsedEInvoice['format'] {
  if (xml.includes('<rsm:CrossIndustryInvoice') || xml.includes('CrossIndustryInvoice')) {
    if (xml.includes('zugferd') || xml.includes('Factur-X') || xml.includes('factur-x')) return 'zugferd';
    return 'cii';
  }
  if (xml.includes('<Invoice') && xml.includes('xmlns')) {
    if (xml.includes('XRechnung') || xml.includes('xrechnung')) return 'xrechnung';
    if (xml.includes('peppol') || xml.includes('PEPPOL')) return 'peppol_ubl';
    return 'xrechnung';   // default UBL → XRechnung CIUS
  }
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Tiny XML-fragment helpers — avoid pulling a full XML parser dep
// ---------------------------------------------------------------------------

function firstMatch(xml: string, tag: string): string | null {
  const re = new RegExp(`<(?:[a-zA-Z]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[a-zA-Z]+:)?${tag}>`);
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

function allMatches(xml: string, tag: string): string[] {
  const re = new RegExp(`<(?:[a-zA-Z]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[a-zA-Z]+:)?${tag}>`, 'g');
  const out: string[] = [];
  let m;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}

function num(s: string | null): number {
  if (!s) return 0;
  const cleaned = s.replace(/[^\d.,-]/g, '').replace(',', '.');
  const v = parseFloat(cleaned);
  return Number.isFinite(v) ? v : 0;
}

// ---------------------------------------------------------------------------
// UBL parser (XRechnung / Peppol)
// ---------------------------------------------------------------------------

function parseUbl(xml: string): { invoice: ScannedInvoice; warnings: string[] } {
  const warnings: string[] = [];

  const documentNumber = firstMatch(xml, 'ID') ?? '';
  const documentDate = firstMatch(xml, 'IssueDate') ?? todayKey();
  const supplierName = firstMatch(xml, 'RegistrationName')
    ?? firstMatch(xml, 'PartyName')
    ?? '(unknown)';

  // Tax totals
  const taxAmount = num(firstMatch(xml, 'TaxAmount'));
  const totalRaw = firstMatch(xml, 'PayableAmount') ?? firstMatch(xml, 'TaxInclusiveAmount');
  const total = num(totalRaw);
  const subtotal = total - taxAmount;

  // Line items
  const lineBlocks = allMatches(xml, 'InvoiceLine');
  const lineItems: ScannedLineItem[] = lineBlocks.map((block, idx) => {
    const description = firstMatch(block, 'Description') ?? firstMatch(block, 'Name') ?? `Line ${idx + 1}`;
    const quantity = num(firstMatch(block, 'InvoicedQuantity') ?? firstMatch(block, 'Quantity')) || 1;
    const unitPrice = num(firstMatch(block, 'PriceAmount'));
    const lineTotal = num(firstMatch(block, 'LineExtensionAmount')) || (unitPrice * quantity);
    const vatPct = num(firstMatch(block, 'Percent'));
    return {
      description,
      category: 'unknown',
      quantity,
      unit: 'piece',
      unitPrice: unitPrice || (quantity > 0 ? lineTotal / quantity : 0),
      totalPrice: lineTotal,
      vatRate: vatPct,
      confidence: 90,
    } as ScannedLineItem;
  });

  if (lineItems.length === 0) warnings.push('No invoice lines parsed.');
  if (total === 0) warnings.push('Total amount could not be parsed.');

  const invoice: ScannedInvoice = {
    id: `eparsed-${Date.now()}`,
    documentType: 'invoice',
    supplierName,
    documentNumber,
    documentDate,
    lineItems,
    subtotal,
    vatAmount: taxAmount,
    total,
    confidence: lineItems.length > 0 && total > 0 ? 90 : 50,
    scannedAt: new Date().toISOString(),
  };
  return { invoice, warnings };
}

// ---------------------------------------------------------------------------
// CII parser (ZUGFeRD / CrossIndustryInvoice)
// ---------------------------------------------------------------------------

function parseCii(xml: string): { invoice: ScannedInvoice; warnings: string[] } {
  const warnings: string[] = [];
  const documentNumber = firstMatch(xml, 'IssuerAssignedID')
    ?? firstMatch(xml, 'ID')
    ?? '';
  const documentDate = firstMatch(xml, 'IssueDateTime')?.replace(/<[^>]+>|[^\d-]/g, '').slice(0, 10)
    ?? todayKey();

  const supplierName = firstMatch(xml, 'Name') ?? '(unknown)';
  const grandTotal = num(firstMatch(xml, 'GrandTotalAmount'));
  const taxTotal = num(firstMatch(xml, 'TaxTotalAmount'));
  const subtotal = grandTotal - taxTotal;

  const lineBlocks = allMatches(xml, 'IncludedSupplyChainTradeLineItem');
  const lineItems: ScannedLineItem[] = lineBlocks.map((block, idx) => {
    const description = firstMatch(block, 'Name') ?? `Line ${idx + 1}`;
    const quantity = num(firstMatch(block, 'BilledQuantity')) || 1;
    const unitPrice = num(firstMatch(block, 'ChargeAmount'));
    const total = num(firstMatch(block, 'LineTotalAmount')) || unitPrice * quantity;
    const vatPct = num(firstMatch(block, 'RateApplicablePercent'));
    return {
      description, category: 'unknown', quantity, unit: 'piece',
      unitPrice, totalPrice: total, vatRate: vatPct, confidence: 90,
    } as ScannedLineItem;
  });

  if (lineItems.length === 0) warnings.push('No line items parsed from CII document.');
  if (grandTotal === 0) warnings.push('Grand total missing.');

  const invoice: ScannedInvoice = {
    id: `eparsed-${Date.now()}`,
    documentType: 'invoice',
    supplierName, documentNumber, documentDate, lineItems,
    subtotal, vatAmount: taxTotal, total: grandTotal,
    confidence: lineItems.length > 0 && grandTotal > 0 ? 90 : 50,
    scannedAt: new Date().toISOString(),
  };
  return { invoice, warnings };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function parseEInvoiceXml(xml: string): ParsedEInvoice {
  const format = detectFormat(xml);
  if (format === 'unknown') {
    return {
      invoice: emptyInvoice(),
      format: 'unknown', confidence: 0,
      warnings: ['Could not detect e-invoice format — no UBL or CII root tags found.'],
    };
  }
  const { invoice, warnings } = format === 'cii' || format === 'zugferd' ? parseCii(xml) : parseUbl(xml);
  return { invoice, format, confidence: invoice.confidence / 100, warnings };
}

function emptyInvoice(): ScannedInvoice {
  return {
    id: `eparsed-empty-${Date.now()}`,
    documentType: 'invoice', supplierName: '', documentNumber: '',
    documentDate: todayKey(),
    lineItems: [], subtotal: 0, vatAmount: 0, total: 0,
    confidence: 0, scannedAt: new Date().toISOString(),
  };
}

/**
 * Extract embedded XML from a ZUGFeRD/Factur-X PDF/A-3 base64 string.
 * Returns null when no embedded XML found. Production-grade ZUGFeRD reads
 * the AFRelationship attribute to find /factur-x.xml; this minimal version
 * does substring extraction which works for ~80% of well-formed PDFs.
 * For full coverage, layer in a real PDF lib (pdf-lib, pdf-parse).
 */
export function extractZugferdXml(pdfBase64: string): string | null {
  try {
    const decoded = atob(pdfBase64.replace(/\s/g, ''));
    const start = decoded.indexOf('<?xml');
    if (start < 0) return null;
    const end = decoded.lastIndexOf('</rsm:CrossIndustryInvoice>');
    if (end < 0) {
      const altEnd = decoded.lastIndexOf('</Invoice>');
      if (altEnd < 0) return null;
      return decoded.slice(start, altEnd + '</Invoice>'.length);
    }
    return decoded.slice(start, end + '</rsm:CrossIndustryInvoice>'.length);
  } catch {
    return null;
  }
}

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

/**
 * ⚠️ `(?=[\\s/>])` is the whole point of this pattern.
 *
 * Without that boundary the tag name matches a PREFIX of a longer tag, because
 * `[^>]*` happily eats the rest of the name. `ExchangedDocument` matched
 * `<rsm:ExchangedDocumentContext>`, and since the CLOSING pattern still
 * required an exact `</…ExchangedDocument>`, the captured block ran from inside
 * the Context element all the way to the end of the real one — swallowing the
 * specification URN. Every inbound ZUGFeRD then imported with the document
 * number `urn:cen.eu:en16931:2017`: identical for every supplier, so nothing
 * could be reconciled and duplicates were invisible.
 *
 * The same flaw hits any tag that is a prefix of another — `Name` /
 * `NameSuffix`, `ID` / `IDType`, `Amount` / `AmountCurrency`. It is a general
 * fault in the matcher, not one bad call site, which is why it is fixed here.
 */
function tagPattern(tag: string): string {
  return `<(?:[a-zA-Z]+:)?${tag}(?=[\\s/>])[^>]*>([\\s\\S]*?)<\\/(?:[a-zA-Z]+:)?${tag}>`;
}

function firstMatch(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(tagPattern(tag)));
  return m ? m[1].trim() : null;
}

function allMatches(xml: string, tag: string): string[] {
  const re = new RegExp(tagPattern(tag), 'g');
  const out: string[] = [];
  let m;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}

/**
 * An identifier nested inside a wrapper element.
 *
 * Scoping matters: a UBL invoice line has its own `cbc:ID` (the line number),
 * so `firstMatch(line, 'ID')` returns "1", not the article number. The article
 * number only means anything relative to its wrapper.
 */
function nestedValue(block: string, wrapper: string, tag = 'ID'): string | undefined {
  const inner = firstMatch(block, wrapper);
  if (!inner) return undefined;
  const v = firstMatch(inner, tag);
  return v ? v.trim() || undefined : undefined;
}

/**
 * The `unitCode` attribute on a quantity element (UBL `unitCode`, CII
 * `unitCode`), e.g. MTR / H87 / KGM.
 *
 * Not cosmetic: `unit` is one of the benchmark view's GROUP BY columns, so
 * every line landing as 'piece' merges metres and kilograms into one cohort and
 * makes the average meaningless. The previous behaviour hardcoded 'piece' for
 * every structured invoice.
 */
function unitCode(block: string, tag: string): string | undefined {
  const re = new RegExp(`<(?:[a-zA-Z]+:)?${tag}[^>]*unitCode="([^"]+)"`);
  const m = block.match(re);
  return m ? m[1].trim() || undefined : undefined;
}

/**
 * UN/ECE Rec 20 codes → the unit vocabulary the moat already groups on.
 *
 * Unmapped codes are passed through lowercased rather than coerced to 'piece':
 * an unrecognised-but-consistent unit still groups correctly with itself, while
 * mislabelling it 'piece' pollutes a cohort that means something else.
 */
const UNIT_BY_CODE: Record<string, string> = {
  H87: 'piece', C62: 'piece', EA: 'piece', PCE: 'piece',
  MTR: 'meter', MTK: 'm2', MTQ: 'm3',
  KGM: 'kg', GRM: 'g', TNE: 'ton',
  LTR: 'liter', MLT: 'ml',
  HUR: 'hour', DAY: 'day',
  MMT: 'mm', CMT: 'cm', KMT: 'km',
  SET: 'set', PK: 'pack', BX: 'box', RO: 'roll',
};

function mapUnit(code: string | undefined): string {
  if (!code) return 'piece';
  return UNIT_BY_CODE[code.toUpperCase()] ?? code.toLowerCase();
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
      unit: mapUnit(unitCode(block, 'InvoicedQuantity')),
      unitPrice: unitPrice || (quantity > 0 ? lineTotal / quantity : 0),
      totalPrice: lineTotal,
      vatRate: vatPct,
      // THE MOAT'S BEST INPUT, and it was being thrown away. canonicalMaterialKey
      // ranks identity above text: an EAN gives confidence 1 and a
      // supplier-namespaced article number is next. Those keys need no
      // canonicalisation, no LLM merge and no judgement — two contractors who
      // scanned the same barcode are in the same cohort, full stop. The mandate
      // is about to compel every merchant in four countries to send exactly
      // this, and until now the parser dropped it on the floor.
      ean: nestedValue(block, 'StandardItemIdentification'),
      articleNumber: nestedValue(block, 'SellersItemIdentification'),
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
  // ⚠️ SCOPED, and it has to be. `firstMatch(xml, 'ID')` over a whole CII
  // document returns the FIRST <ram:ID>, which is
  // GuidelineSpecifiedDocumentContextParameter/ID — the specification URN
  // `urn:cen.eu:en16931:2017`. Every inbound ZUGFeRD from every supplier
  // therefore imported with the SAME document number, so nothing could be
  // matched to a supplier statement and duplicates were invisible.
  //
  // Same bug shape as the e-invoice validator matching a line's cbc:ID for the
  // invoice number, and the third time this codebase has been bitten by a
  // whole-document search for a generic tag name. The invoice number in CII is
  // ExchangedDocument/ID; IssuerAssignedID belongs to REFERENCED documents (a
  // buyer order, a despatch advice) and is only a fallback.
  const documentNumber = nestedValue(xml, 'ExchangedDocument', 'ID')
    ?? firstMatch(xml, 'IssuerAssignedID')
    ?? '';
  const documentDate = firstMatch(xml, 'IssueDateTime')?.replace(/<[^>]+>|[^\d-]/g, '').slice(0, 10)
    ?? todayKey();

  // Also scoped. In CII the line items come BEFORE the parties, so the first
  // <ram:Name> in the document is a PRODUCT name — an inbound invoice imported
  // with its first line item as the supplier. `SpecifiedTradeProduct/Name` and
  // `SellerTradeParty/Name` are the same tag at different depths, which is
  // exactly why the search has to say which one it means.
  const supplierName = nestedValue(xml, 'SellerTradeParty', 'Name')
    ?? '(unknown)';
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
      description, category: 'unknown', quantity,
      unit: mapUnit(unitCode(block, 'BilledQuantity')),
      unitPrice, totalPrice: total, vatRate: vatPct,
      // CII names the same two identifiers differently: GlobalID carries the
      // GTIN, SellerAssignedID the supplier's catalogue code. Both live inside
      // SpecifiedTradeProduct, which is why they are read through the wrapper.
      ean: nestedValue(block, 'SpecifiedTradeProduct', 'GlobalID'),
      articleNumber: nestedValue(block, 'SpecifiedTradeProduct', 'SellerAssignedID'),
      confidence: 90,
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

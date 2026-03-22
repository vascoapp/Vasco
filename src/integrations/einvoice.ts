// =============================================================================
// E-INVOICE SERVICE — XRechnung + ZUGFeRD + Peppol
// =============================================================================
// Mandatory in Germany: receiving since Jan 2025, sending from Jan 2027
// Supports: XRechnung (B2G), ZUGFeRD (B2B hybrid PDF+XML), Peppol BIS 3.0
// =============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EInvoiceFormat = 'XRechnung' | 'ZUGFeRD' | 'Peppol' | 'FacturX' | 'Facturae' | 'FatturaPA';

export interface EInvoiceData {
  // Seller
  sellerName: string;
  sellerAddress: string;
  sellerVatId: string; // DE123456789
  sellerTaxNumber?: string;

  // Buyer
  buyerName: string;
  buyerAddress: string;
  buyerVatId?: string;
  leitwegId?: string; // For B2G (government) invoices

  // Invoice
  invoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD
  dueDate: string;
  currency: string;

  // Line items
  lineItems: EInvoiceLineItem[];

  // Totals
  totalNet: number;
  totalVat: number;
  totalGross: number;

  // Payment
  iban?: string;
  bic?: string;
  paymentReference?: string;
}

export interface EInvoiceLineItem {
  description: string;
  quantity: number;
  unitCode: string; // UN/CEFACT codes: 'HUR' (hour), 'C62' (piece), 'MTR' (meter)
  unitPrice: number;
  vatRate: number;
  vatAmount: number;
  lineTotal: number;
}

// ---------------------------------------------------------------------------
// Unit code mapping (UN/CEFACT)
// ---------------------------------------------------------------------------

export const UNIT_CODES: Record<string, string> = {
  stuk: 'C62',
  stück: 'C62',
  piece: 'C62',
  uur: 'HUR',
  stunde: 'HUR',
  hour: 'HUR',
  meter: 'MTR',
  m2: 'MTK',
  liter: 'LTR',
  kg: 'KGM',
  rol: 'C62',
  doos: 'C62',
  set: 'C62',
};

// ---------------------------------------------------------------------------
// Generate XRechnung XML (EN 16931 / UBL 2.1)
// ---------------------------------------------------------------------------

export function generateXRechnungXML(data: EInvoiceData): string {
  const lines = data.lineItems.map((li, idx) => `
    <cac:InvoiceLine>
      <cbc:ID>${idx + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="${UNIT_CODES[li.unitCode.toLowerCase()] ?? 'C62'}">${li.quantity}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="${data.currency}">${li.lineTotal.toFixed(2)}</cbc:LineExtensionAmount>
      <cac:Item>
        <cbc:Name>${escapeXml(li.description)}</cbc:Name>
        <cac:ClassifiedTaxCategory>
          <cbc:ID>S</cbc:ID>
          <cbc:Percent>${li.vatRate}</cbc:Percent>
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="${data.currency}">${li.unitPrice.toFixed(2)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0</cbc:CustomizationID>
  <cbc:ID>${escapeXml(data.invoiceNumber)}</cbc:ID>
  <cbc:IssueDate>${data.invoiceDate}</cbc:IssueDate>
  <cbc:DueDate>${data.dueDate}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${data.currency}</cbc:DocumentCurrencyCode>
  ${data.leitwegId ? `<cbc:BuyerReference>${escapeXml(data.leitwegId)}</cbc:BuyerReference>` : ''}
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${escapeXml(data.sellerName)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress><cbc:StreetName>${escapeXml(data.sellerAddress)}</cbc:StreetName><cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country></cac:PostalAddress>
      <cac:PartyTaxScheme><cbc:CompanyID>${escapeXml(data.sellerVatId)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${escapeXml(data.buyerName)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress><cbc:StreetName>${escapeXml(data.buyerAddress)}</cbc:StreetName><cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country></cac:PostalAddress>
    </cac:Party>
  </cac:AccountingCustomerParty>
  ${data.iban ? `<cac:PaymentMeans><cbc:PaymentMeansCode>58</cbc:PaymentMeansCode><cac:PayeeFinancialAccount><cbc:ID>${data.iban}</cbc:ID></cac:PayeeFinancialAccount></cac:PaymentMeans>` : ''}
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${data.currency}">${data.totalVat.toFixed(2)}</cbc:TaxAmount>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${data.currency}">${data.totalNet.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${data.currency}">${data.totalNet.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${data.currency}">${data.totalGross.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${data.currency}">${data.totalGross.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${lines}
</Invoice>`;
}

// ---------------------------------------------------------------------------
// Generate ZUGFeRD XML (embedded in PDF)
// ---------------------------------------------------------------------------

export function generateZUGFeRDXML(data: EInvoiceData): string {
  // ZUGFeRD uses Cross Industry Invoice (CII) format
  // Simplified version — production would use full CII schema
  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${escapeXml(data.invoiceNumber)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime><udt:DateTimeString format="102">${data.invoiceDate.replace(/-/g, '')}</udt:DateTimeString></ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${data.currency}</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${data.totalNet.toFixed(2)}</ram:LineTotalAmount>
        <ram:TaxTotalAmount currencyID="${data.currency}">${data.totalVat.toFixed(2)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${data.totalGross.toFixed(2)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${data.totalGross.toFixed(2)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}

// ---------------------------------------------------------------------------
// Determine which format to use
// ---------------------------------------------------------------------------

export function getRequiredFormat(country: string, isB2G: boolean): EInvoiceFormat {
  if (country === 'DE' && isB2G) return 'XRechnung';
  if (country === 'DE') return 'ZUGFeRD';
  if (country === 'NL') return 'Peppol';
  if (country === 'FR') return 'FacturX';
  if (country === 'ES') return 'Facturae';
  if (country === 'IT') return 'FatturaPA'; // Mandatory SDI
  if (country === 'UK') return 'Peppol'; // Peppol BIS 3.0 growing adoption
  return 'Peppol'; // Default: Peppol is the EU standard
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

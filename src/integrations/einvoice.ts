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
  /** BT-37/BT-38. XRechnung BR-DE rules make city and post code mandatory. */
  sellerCity?: string;
  sellerPostalCode?: string;
  /** ISO 3166-1 alpha-2. Was hardcoded 'DE' for both parties. */
  sellerCountry?: string;
  /** BG-6 seller contact. BR-DE-5/6/7 make all three mandatory in XRechnung. */
  sellerContactName?: string;
  sellerPhone?: string;
  sellerEmail?: string;

  // Buyer
  buyerName: string;
  buyerAddress: string;
  buyerVatId?: string;
  buyerCity?: string;
  buyerPostalCode?: string;
  buyerCountry?: string;
  leitwegId?: string; // For B2G (government) invoices
  /**
   * BT-10. XRechnung BR-DE-15 makes this mandatory on EVERY invoice, not just
   * B2G — the Leitweg-ID is simply what a public buyer puts in it. A B2B
   * invoice without any buyer reference is rejected.
   */
  buyerReference?: string;

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

/**
 * XRechnung 3.0 (UBL 2.1) — the German market's mandatory format.
 *
 * Rewritten 2026-08-19 after checking the output against the EN 16931 syntax
 * binding and the BR-DE rules. The previous version was well-formed XML that a
 * German buyer's system would reject, in five separate ways. Each is a real
 * rule with a real error code, so they are listed here rather than fixed
 * silently — this is the format the German go-to-market rests on:
 *
 *  1. BT-27/BT-44 (seller/buyer name) bind to
 *     `cac:PartyLegalEntity/cbc:RegistrationName`. The old version emitted only
 *     `cac:PartyName/cbc:Name`, which is BT-28/BT-45 — the OPTIONAL trading
 *     name. The mandatory legal name was absent from every invoice.
 *  2. BG-23 (VAT breakdown) was missing entirely: `cac:TaxTotal` carried a bare
 *     `cbc:TaxAmount` and no `cac:TaxSubtotal`. Every invoice must carry one
 *     subtotal per (category, rate) pair with its taxable and tax amount.
 *  3. BR-DE-15: BT-10 BuyerReference is mandatory on EVERY XRechnung. The old
 *     version emitted it only when a Leitweg-ID was present — i.e. only for
 *     B2G — so every B2B invoice, which is the entire beachhead, was invalid.
 *  4. BR-DE-5/6/7: seller contact name, telephone and email are mandatory.
 *     None were emitted.
 *  5. The country code was hardcoded `DE` for both parties, so a Dutch
 *     contractor invoicing a German customer declared itself German.
 *
 * ⚠️ Passing our own validator is not conformance. KoSIT's is authoritative;
 * ours is a partial structural + arithmetic check, and it PASSED all five of
 * the above (its BR-06 matched the trading name). See
 * src/integrations/__tests__/xrechnungValidity.test.ts.
 */
export function generateXRechnungXML(data: EInvoiceData): string {
  const cur = data.currency;
  const sellerCountry = data.sellerCountry ?? 'DE';
  const buyerCountry = data.buyerCountry ?? sellerCountry;

  const lines = data.lineItems.map((li, idx) => `
    <cac:InvoiceLine>
      <cbc:ID>${idx + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="${UNIT_CODES[li.unitCode.toLowerCase()] ?? 'C62'}">${li.quantity}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="${cur}">${li.lineTotal.toFixed(2)}</cbc:LineExtensionAmount>
      <cac:Item>
        <cbc:Name>${escapeXml(li.description)}</cbc:Name>
        <cac:ClassifiedTaxCategory>
          <cbc:ID>S</cbc:ID>
          <cbc:Percent>${li.vatRate}</cbc:Percent>
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="${cur}">${li.unitPrice.toFixed(2)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`).join('');

  // BG-23 — one breakdown per distinct VAT rate, since that is what the rule
  // is keyed on. Summing the lines rather than reusing data.totalVat: a single
  // stated total cannot be split back out per rate, and an invoice mixing 19%
  // and 7% (materials vs. some reduced-rate work) is ordinary.
  const byRate = new Map<number, { net: number; vat: number }>();
  for (const li of data.lineItems) {
    const acc = byRate.get(li.vatRate) ?? { net: 0, vat: 0 };
    acc.net += li.lineTotal;
    acc.vat += li.lineTotal * (li.vatRate / 100);
    byRate.set(li.vatRate, acc);
  }
  const subtotals = [...byRate.entries()].map(([rate, a]) => `
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${cur}">${a.net.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${cur}">${a.vat.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>${rate}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`).join('');

  // BR-DE-15. A B2B invoice has no Leitweg-ID, and an empty BT-10 is as
  // invalid as an absent one, so it falls back to the invoice number — a
  // reference the buyer can actually match, not a placeholder.
  const buyerRef = data.leitwegId ?? data.buyerReference ?? data.invoiceNumber;

  const addr = (street: string, city: string | undefined, zip: string | undefined, country: string) => `
        <cac:PostalAddress>
          <cbc:StreetName>${escapeXml(street)}</cbc:StreetName>${city ? `
          <cbc:CityName>${escapeXml(city)}</cbc:CityName>` : ''}${zip ? `
          <cbc:PostalZone>${escapeXml(zip)}</cbc:PostalZone>` : ''}
          <cac:Country><cbc:IdentificationCode>${escapeXml(country)}</cbc:IdentificationCode></cac:Country>
        </cac:PostalAddress>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0</cbc:CustomizationID>
  <cbc:ID>${escapeXml(data.invoiceNumber)}</cbc:ID>
  <cbc:IssueDate>${data.invoiceDate}</cbc:IssueDate>
  <cbc:DueDate>${data.dueDate}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${cur}</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>${escapeXml(buyerRef)}</cbc:BuyerReference>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${escapeXml(data.sellerName)}</cbc:Name></cac:PartyName>${addr(data.sellerAddress, data.sellerCity, data.sellerPostalCode, sellerCountry)}
      <cac:PartyTaxScheme><cbc:CompanyID>${escapeXml(data.sellerVatId)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>
      <cac:PartyLegalEntity><cbc:RegistrationName>${escapeXml(data.sellerName)}</cbc:RegistrationName></cac:PartyLegalEntity>
      <cac:Contact>
        <cbc:Name>${escapeXml(data.sellerContactName ?? data.sellerName)}</cbc:Name>${data.sellerPhone ? `
        <cbc:Telephone>${escapeXml(data.sellerPhone)}</cbc:Telephone>` : ''}${data.sellerEmail ? `
        <cbc:ElectronicMail>${escapeXml(data.sellerEmail)}</cbc:ElectronicMail>` : ''}
      </cac:Contact>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${escapeXml(data.buyerName)}</cbc:Name></cac:PartyName>${addr(data.buyerAddress, data.buyerCity, data.buyerPostalCode, buyerCountry)}${data.buyerVatId ? `
      <cac:PartyTaxScheme><cbc:CompanyID>${escapeXml(data.buyerVatId)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : ''}
      <cac:PartyLegalEntity><cbc:RegistrationName>${escapeXml(data.buyerName)}</cbc:RegistrationName></cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  ${data.iban ? `<cac:PaymentMeans><cbc:PaymentMeansCode>58</cbc:PaymentMeansCode><cac:PayeeFinancialAccount><cbc:ID>${escapeXml(data.iban)}</cbc:ID></cac:PayeeFinancialAccount></cac:PaymentMeans>` : ''}
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${cur}">${data.totalVat.toFixed(2)}</cbc:TaxAmount>${subtotals}
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${cur}">${data.totalNet.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${cur}">${data.totalNet.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${cur}">${data.totalGross.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${cur}">${data.totalGross.toFixed(2)}</cbc:PayableAmount>
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

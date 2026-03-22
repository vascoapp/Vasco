// =============================================================================
// E-INVOICE SERVICE — Factur-X (French CII variant of ZUGFeRD)
// =============================================================================
// Mandatory in France: B2B e-invoicing phased rollout 2024-2027
// Factur-X = French implementation of EN 16931 using CII (Cross-Industry Invoice)
// Profiles: Minimum, Basic WL, Basic, EN 16931, Extended
// =============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FacturXProfile =
  | 'minimum'
  | 'basicwl'
  | 'basic'
  | 'en16931'
  | 'extended';

export interface FacturXInvoice {
  // Seller (Vendeur)
  sellerName: string;
  sellerAddress: string;
  sellerCity: string;
  sellerPostalCode: string;
  sellerCountry: string; // FR
  sellerVatId: string; // FR12345678901
  sellerSiret: string; // 14-digit SIRET
  sellerSiren?: string; // 9-digit SIREN (derived from SIRET)
  sellerNaf?: string; // NAF/APE code (e.g. 4322A plumbing)
  sellerRcs?: string; // RCS registration (e.g. "Paris B 123 456 789")

  // Buyer (Acheteur)
  buyerName: string;
  buyerAddress: string;
  buyerCity: string;
  buyerPostalCode: string;
  buyerCountry: string;
  buyerVatId?: string;
  buyerSiret?: string;

  // Invoice
  invoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD
  dueDate: string;
  currency: string; // EUR

  // Line items
  lineItems: FacturXLineItem[];

  // Totals
  totalNet: number;
  totalVat: number;
  totalGross: number;

  // Payment
  iban?: string;
  bic?: string;
  paymentReference?: string;

  // French mandatory fields
  paymentTermsNote?: string; // e.g. "30 jours date de facture"
  latePaymentPenaltyRate?: number; // Taux de pénalités de retard (e.g. 12 for 12%)
  latePaymentFixedPenalty?: number; // Indemnité forfaitaire (default 40 EUR)
  earlyPaymentDiscount?: string; // Escompte pour paiement anticipé

  // Profile
  profile?: FacturXProfile;
}

export interface FacturXLineItem {
  description: string;
  quantity: number;
  unitCode: string; // UN/CEFACT: 'HUR', 'C62', 'MTR', etc.
  unitPrice: number;
  vatRate: number; // 0 | 2.1 | 5.5 | 10 | 20
  vatCategoryCode: string; // 'S' standard, 'Z' zero-rate, 'E' exempt, 'AE' reverse charge
  vatAmount: number;
  lineTotal: number;
}

// ---------------------------------------------------------------------------
// French TVA rates
// ---------------------------------------------------------------------------

export const TVA_RATES = {
  NORMAL: 20, // Taux normal
  INTERMEDIAIRE: 10, // Taux intermédiaire (rénovation logement > 2 ans)
  REDUIT: 5.5, // Taux réduit (travaux amélioration énergétique)
  SUPER_REDUIT: 2.1, // Taux super-réduit
  EXONERE: 0, // Exonéré
} as const;

// ---------------------------------------------------------------------------
// Unit code mapping (UN/CEFACT) — French labels
// ---------------------------------------------------------------------------

export const UNIT_CODES_FR: Record<string, string> = {
  pièce: 'C62',
  unité: 'C62',
  piece: 'C62',
  heure: 'HUR',
  hour: 'HUR',
  mètre: 'MTR',
  meter: 'MTR',
  m2: 'MTK',
  litre: 'LTR',
  kg: 'KGM',
  rouleau: 'C62',
  lot: 'C62',
  forfait: 'C62',
};

// ---------------------------------------------------------------------------
// Generate Factur-X XML (CII format)
// ---------------------------------------------------------------------------

export function generateFacturXXml(data: FacturXInvoice): string {
  const profile = data.profile ?? 'en16931';
  const profileUrn = PROFILE_URNS[profile];

  const latePaymentPenalty = data.latePaymentFixedPenalty ?? 40;
  const penaltyRate = data.latePaymentPenaltyRate ?? 12;

  const paymentTermsText = data.paymentTermsNote
    ?? `Date d'échéance: ${data.dueDate}. `
    + `Taux de pénalités de retard: ${penaltyRate}%. `
    + `Indemnité forfaitaire pour frais de recouvrement: ${latePaymentPenalty.toFixed(2)} EUR.`
    + (data.earlyPaymentDiscount
      ? ` Escompte pour paiement anticipé: ${data.earlyPaymentDiscount}.`
      : ' Pas d\'escompte pour paiement anticipé.');

  // Group VAT by rate for tax breakdown
  const vatBreakdown = buildVatBreakdown(data.lineItems, data.currency);

  const lineItemsXml = data.lineItems.map((li, idx) => `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${idx + 1}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${escapeXml(li.description)}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${li.unitPrice.toFixed(2)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="${UNIT_CODES_FR[li.unitCode.toLowerCase()] ?? li.unitCode}">${li.quantity}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>${li.vatCategoryCode}</ram:CategoryCode>
          <ram:RateApplicablePercent>${li.vatRate}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${li.lineTotal.toFixed(2)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100"
  xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:BusinessProcessSpecifiedDocumentContextParameter>
      <ram:ID>A1</ram:ID>
    </ram:BusinessProcessSpecifiedDocumentContextParameter>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>${profileUrn}</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${escapeXml(data.invoiceNumber)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${data.invoiceDate.replace(/-/g, '')}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${escapeXml(data.sellerName)}</ram:Name>
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${escapeXml(data.sellerSiret)}</ram:ID>
        </ram:SpecifiedLegalOrganization>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${escapeXml(data.sellerPostalCode)}</ram:PostcodeCode>
          <ram:LineOne>${escapeXml(data.sellerAddress)}</ram:LineOne>
          <ram:CityName>${escapeXml(data.sellerCity)}</ram:CityName>
          <ram:CountryID>${data.sellerCountry}</ram:CountryID>
        </ram:PostalTradeAddress>
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${escapeXml(data.sellerVatId)}</ram:ID>
        </ram:SpecifiedTaxRegistration>${data.sellerRcs ? `
        <ram:Description>RCS: ${escapeXml(data.sellerRcs)}</ram:Description>` : ''}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${escapeXml(data.buyerName)}</ram:Name>${data.buyerSiret ? `
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${escapeXml(data.buyerSiret)}</ram:ID>
        </ram:SpecifiedLegalOrganization>` : ''}
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${escapeXml(data.buyerPostalCode)}</ram:PostcodeCode>
          <ram:LineOne>${escapeXml(data.buyerAddress)}</ram:LineOne>
          <ram:CityName>${escapeXml(data.buyerCity)}</ram:CityName>
          <ram:CountryID>${data.buyerCountry}</ram:CountryID>
        </ram:PostalTradeAddress>${data.buyerVatId ? `
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${escapeXml(data.buyerVatId)}</ram:ID>
        </ram:SpecifiedTaxRegistration>` : ''}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery/>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${data.currency}</ram:InvoiceCurrencyCode>${data.iban ? `
      <ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>58</ram:TypeCode>
        <ram:PayeePartyCreditorFinancialAccount>
          <ram:IBANID>${escapeXml(data.iban)}</ram:IBANID>
        </ram:PayeePartyCreditorFinancialAccount>${data.bic ? `
        <ram:PayeeSpecifiedCreditorFinancialInstitution>
          <ram:BICID>${escapeXml(data.bic)}</ram:BICID>
        </ram:PayeeSpecifiedCreditorFinancialInstitution>` : ''}
      </ram:SpecifiedTradeSettlementPaymentMeans>` : ''}
      <ram:SpecifiedTradePaymentTerms>
        <ram:Description>${escapeXml(paymentTermsText)}</ram:Description>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${data.dueDate.replace(/-/g, '')}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
${vatBreakdown}
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${data.totalNet.toFixed(2)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${data.totalNet.toFixed(2)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${data.currency}">${data.totalVat.toFixed(2)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${data.totalGross.toFixed(2)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${data.totalGross.toFixed(2)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
${lineItemsXml}
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}

// ---------------------------------------------------------------------------
// Profile URNs
// ---------------------------------------------------------------------------

const PROFILE_URNS: Record<FacturXProfile, string> = {
  minimum: 'urn:factur-x.eu:1p0:minimum',
  basicwl: 'urn:factur-x.eu:1p0:basicwl',
  basic: 'urn:factur-x.eu:1p0:basic',
  en16931: 'urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:en16931',
  extended: 'urn:cen.eu:en16931:2017#conformant#urn:factur-x.eu:1p0:extended',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildVatBreakdown(items: FacturXLineItem[], currency: string): string {
  const groups: Record<number, { basisAmount: number; taxAmount: number; categoryCode: string }> = {};

  for (const item of items) {
    if (!groups[item.vatRate]) {
      groups[item.vatRate] = { basisAmount: 0, taxAmount: 0, categoryCode: item.vatCategoryCode };
    }
    groups[item.vatRate].basisAmount += item.lineTotal;
    groups[item.vatRate].taxAmount += item.vatAmount;
  }

  return Object.entries(groups).map(([rate, g]) => `      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${g.taxAmount.toFixed(2)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${g.basisAmount.toFixed(2)}</ram:BasisAmount>
        <ram:CategoryCode>${g.categoryCode}</ram:CategoryCode>
        <ram:RateApplicablePercent>${rate}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>`).join('\n');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

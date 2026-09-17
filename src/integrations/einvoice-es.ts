// =============================================================================
// E-INVOICE SERVICE — Facturae 3.2.2 + VeriFactu (Spanish standard)
// =============================================================================
// Mandatory in Spain: B2B e-invoicing via Facturae + VeriFactu verification
// Facturae 3.2.2: XML format required for B2G (FACe) and increasingly B2B
// VeriFactu: real-time invoice reporting to AEAT (tax authority)
// =============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FacturaeSchemaVersion = '3.2.1' | '3.2.2';

export type PersonTypeCode = 'F' | 'J'; // F = Física (individual), J = Jurídica (legal entity)

export type RegimeFiscal =
  | '01' // General
  | '02' // Exportación
  | '03' // Operaciones no sujetas
  | '04' // Régimen especial de bienes usados
  | '05' // Régimen especial de agencias de viaje
  | '06' // Régimen especial de grupos de entidades
  | '07' // Régimen especial de criterio de caja
  | '08' // IPSI/IGIC
  | '09' // Facturación prestaciones servicios artículo 283
  | '10' // Cobros cuenta terceros
  | '15' // Régimen especial franquiciado
  | '17' // Régimen especial recargo equivalencia
  | '19'; // Actividades ganadería, pesca, acuicultura

export interface FacturaeInvoice {
  // Schema
  schemaVersion?: FacturaeSchemaVersion;

  // Seller (Emisor)
  sellerName: string;
  sellerTradeName?: string;
  sellerNif: string; // NIF/CIF (e.g. B12345678)
  sellerAddress: string;
  sellerCity: string;
  sellerPostalCode: string;
  sellerProvince: string;
  sellerCountry: string; // ESP
  sellerPersonType: PersonTypeCode;
  sellerRegimeFiscal: RegimeFiscal;

  // Buyer (Receptor)
  buyerName: string;
  buyerNif: string;
  buyerAddress: string;
  buyerCity: string;
  buyerPostalCode: string;
  buyerProvince: string;
  buyerCountry: string;
  buyerPersonType: PersonTypeCode;

  // Invoice
  invoiceNumber: string;
  invoiceSeriesCode?: string;
  invoiceDate: string; // YYYY-MM-DD
  dueDate: string;
  currency: string; // EUR
  languageCode?: string; // es

  // Line items
  lineItems: FacturaeLineItem[];

  // Totals
  totalNet: number;
  totalVat: number;
  totalIrpf: number; // Total IRPF withholding
  totalGross: number; // totalNet + totalVat - totalIrpf

  // Payment
  iban?: string;
  bic?: string;
  paymentMethod?: string; // 04 = transfer, 01 = cash, 02 = cheque

  // VeriFactu
  verifactuEnabled?: boolean;
}

export interface FacturaeLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;

  // IVA
  ivaRate: number; // 0 | 4 | 10 | 21
  ivaAmount: number;

  // IRPF withholding (retención)
  irpfRate?: number; // e.g. 15 for 15%
  irpfAmount?: number;

  // Recargo de equivalencia (surcharge for retail)
  recargoRate?: number;
  recargoAmount?: number;
}

// ---------------------------------------------------------------------------
// Spanish IVA rates
// ---------------------------------------------------------------------------

export const IVA_RATES = {
  GENERAL: 21, // Tipo general
  REDUCIDO: 10, // Tipo reducido (renovación vivienda)
  SUPERREDUCIDO: 4, // Tipo superreducido (pan, leche, medicamentos)
  EXENTO: 0, // Exento
} as const;

// ---------------------------------------------------------------------------
// Generate Facturae 3.2.2 XML
// ---------------------------------------------------------------------------

export function generateFacturaeXml(data: FacturaeInvoice): string {
  const version = data.schemaVersion ?? '3.2.2';
  const ns = `http://www.facturae.gob.es/formato/Versiones/Facturaev3_2_2.xml`;

  // Build tax outputs (IVA)
  const taxOutputs = buildTaxOutputs(data.lineItems);
  // Same source as the TaxesOutputs block above: the lines as printed.
  const totals = facturaeTaxTotals(data.lineItems);
  // Build tax withholdings (IRPF)
  const taxWithholdings = buildTaxWithholdings(data.lineItems);

  const invoiceLinesXml = data.lineItems.map((li, idx) => {
    const irpfXml = li.irpfRate && li.irpfAmount ? `
              <WithholdingsAndCharges>
                <Charge>
                  <ChargeReason>IRPF</ChargeReason>
                  <ChargeRate>${li.irpfRate.toFixed(2)}</ChargeRate>
                  <ChargeAmount>${li.irpfAmount.toFixed(2)}</ChargeAmount>
                </Charge>
              </WithholdingsAndCharges>` : '';

    return `
            <InvoiceLine>
              <ItemDescription>${escapeXml(li.description)}</ItemDescription>
              <Quantity>${li.quantity.toFixed(2)}</Quantity>
              <UnitPriceWithoutTax>${li.unitPrice.toFixed(6)}</UnitPriceWithoutTax>
              <TotalCost>${li.lineTotal.toFixed(2)}</TotalCost>
              <GrossAmount>${li.lineTotal.toFixed(2)}</GrossAmount>${irpfXml}
              <TaxesOutputs>
                <Tax>
                  <TaxTypeCode>01</TaxTypeCode>
                  <TaxRate>${li.ivaRate.toFixed(2)}</TaxRate>
                  <TaxableBase><TotalAmount>${li.lineTotal.toFixed(2)}</TotalAmount></TaxableBase>
                  <TaxAmount><TotalAmount>${li.ivaAmount.toFixed(2)}</TotalAmount></TaxAmount>
                </Tax>
              </TaxesOutputs>
            </InvoiceLine>`;
  }).join('');

  const paymentXml = data.iban ? `
          <PaymentDetails>
            <Installment>
              <InstallmentDueDate>${data.dueDate}</InstallmentDueDate>
              <InstallmentAmount>${data.totalGross.toFixed(2)}</InstallmentAmount>
              <PaymentMeans>${data.paymentMethod ?? '04'}</PaymentMeans>
              <AccountToBeCredited>
                <IBAN>${escapeXml(data.iban)}</IBAN>${data.bic ? `
                <BIC>${escapeXml(data.bic)}</BIC>` : ''}
              </AccountToBeCredited>
            </Installment>
          </PaymentDetails>` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<fe:Facturae xmlns:fe="${ns}" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  <FileHeader>
    <SchemaVersion>${version}</SchemaVersion>
    <Modality>I</Modality>
    <InvoiceIssuerType>EM</InvoiceIssuerType>
    <Batch>
      <BatchIdentifier>${escapeXml(data.sellerNif + data.invoiceNumber)}</BatchIdentifier>
      <InvoicesCount>1</InvoicesCount>
      <TotalInvoicesAmount><TotalAmount>${data.totalGross.toFixed(2)}</TotalAmount></TotalInvoicesAmount>
      <TotalOutstandingAmount><TotalAmount>${data.totalGross.toFixed(2)}</TotalAmount></TotalOutstandingAmount>
      <TotalExecutableAmount><TotalAmount>${data.totalGross.toFixed(2)}</TotalAmount></TotalExecutableAmount>
      <InvoiceCurrencyCode>${data.currency}</InvoiceCurrencyCode>
    </Batch>
  </FileHeader>
  <Parties>
    <SellerParty>
      <TaxIdentification>
        <PersonTypeCode>${data.sellerPersonType}</PersonTypeCode>
        <ResidenceTypeCode>R</ResidenceTypeCode>
        <TaxIdentificationNumber>${escapeXml(data.sellerNif)}</TaxIdentificationNumber>
      </TaxIdentification>
      <${data.sellerPersonType === 'J' ? 'LegalEntity' : 'Individual'}>
        ${data.sellerPersonType === 'J'
          ? `<CorporateName>${escapeXml(data.sellerName)}</CorporateName>${data.sellerTradeName ? `
        <TradeName>${escapeXml(data.sellerTradeName)}</TradeName>` : ''}`
          : `<Name>${escapeXml(data.sellerName)}</Name>`}
        <AddressInSpain>
          <Address>${escapeXml(data.sellerAddress)}</Address>
          <PostCode>${escapeXml(data.sellerPostalCode)}</PostCode>
          <Town>${escapeXml(data.sellerCity)}</Town>
          <Province>${escapeXml(data.sellerProvince)}</Province>
          <CountryCode>${data.sellerCountry}</CountryCode>
        </AddressInSpain>
      </${data.sellerPersonType === 'J' ? 'LegalEntity' : 'Individual'}>
    </SellerParty>
    <BuyerParty>
      <TaxIdentification>
        <PersonTypeCode>${data.buyerPersonType}</PersonTypeCode>
        <ResidenceTypeCode>R</ResidenceTypeCode>
        <TaxIdentificationNumber>${escapeXml(data.buyerNif)}</TaxIdentificationNumber>
      </TaxIdentification>
      <${data.buyerPersonType === 'J' ? 'LegalEntity' : 'Individual'}>
        ${data.buyerPersonType === 'J'
          ? `<CorporateName>${escapeXml(data.buyerName)}</CorporateName>`
          : `<Name>${escapeXml(data.buyerName)}</Name>`}
        <AddressInSpain>
          <Address>${escapeXml(data.buyerAddress)}</Address>
          <PostCode>${escapeXml(data.buyerPostalCode)}</PostCode>
          <Town>${escapeXml(data.buyerCity)}</Town>
          <Province>${escapeXml(data.buyerProvince)}</Province>
          <CountryCode>${data.buyerCountry}</CountryCode>
        </AddressInSpain>
      </${data.buyerPersonType === 'J' ? 'LegalEntity' : 'Individual'}>
    </BuyerParty>
  </Parties>
  <Invoices>
    <Invoice>
      <InvoiceHeader>
        <InvoiceNumber>${escapeXml(data.invoiceNumber)}</InvoiceNumber>${data.invoiceSeriesCode ? `
        <InvoiceSeriesCode>${escapeXml(data.invoiceSeriesCode)}</InvoiceSeriesCode>` : ''}
        <InvoiceDocumentType>FC</InvoiceDocumentType>
        <InvoiceClass>OO</InvoiceClass>
      </InvoiceHeader>
      <InvoiceIssueData>
        <IssueDate>${data.invoiceDate}</IssueDate>
        <InvoiceCurrencyCode>${data.currency}</InvoiceCurrencyCode>
        <TaxCurrencyCode>${data.currency}</TaxCurrencyCode>
        <LanguageName>${data.languageCode ?? 'es'}</LanguageName>
      </InvoiceIssueData>
      <TaxesOutputs>
${taxOutputs}
      </TaxesOutputs>${data.totalIrpf > 0 ? `
      <TaxesWithheld>
${taxWithholdings}
      </TaxesWithheld>` : ''}
      <InvoiceTotals>
        <TotalGrossAmount>${totals.base.toFixed(2)}</TotalGrossAmount>
        <TotalGrossAmountBeforeTaxes>${totals.base.toFixed(2)}</TotalGrossAmountBeforeTaxes>
        <TotalTaxOutputs>${totals.tax.toFixed(2)}</TotalTaxOutputs>
        <TotalTaxesWithheld>${data.totalIrpf.toFixed(2)}</TotalTaxesWithheld>
        <InvoiceTotal>${round2(totals.base + totals.tax - data.totalIrpf).toFixed(2)}</InvoiceTotal>
        <TotalOutstandingAmount>${round2(totals.base + totals.tax - data.totalIrpf).toFixed(2)}</TotalOutstandingAmount>
        <TotalExecutableAmount>${round2(totals.base + totals.tax - data.totalIrpf).toFixed(2)}</TotalExecutableAmount>
      </InvoiceTotals>
      <Items>
        ${invoiceLinesXml}
      </Items>${paymentXml}
    </Invoice>
  </Invoices>
</fe:Facturae>`;
}

// ---------------------------------------------------------------------------
// Generate VeriFactu QR code data
// ---------------------------------------------------------------------------

export function generateVerifactuQR(data: FacturaeInvoice): string {
  // VeriFactu QR contains a URL to AEAT verification service with invoice hash
  const hashInput = [
    data.sellerNif,
    data.invoiceNumber,
    data.invoiceDate,
    data.totalGross.toFixed(2),
  ].join('|');

  // Simple hash for demo — production would use SHA-256
  const hash = simpleHash(hashInput);

  const params = new URLSearchParams({
    nif: data.sellerNif,
    numserie: data.invoiceSeriesCode ?? '',
    numfactura: data.invoiceNumber,
    fecha: data.invoiceDate,
    importe: data.totalGross.toFixed(2),
    huella: hash,
  });

  return `https://www2.agenciatributaria.gob.es/wlpl/TGVI-JDIT/VerificarFactura?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The taxable base and the tax PER RATE, from the lines as PRINTED.
 *
 * One implementation, used by both the TaxesOutputs block and the header
 * totals. They used to be computed twice — the block from the lines, the
 * header from `data.totalNet/totalVat` (what the screen computed) — so
 * Facturae's arithmetic check (Σ TaxesOutputs = TotalTaxOutputs) could fail by
 * a cent. Two copies of one sum is how they drift apart; a decoy on one of them
 * passed while the other was still right, which is exactly the warning.
 */
export function facturaeTaxGroups(items: FacturaeLineItem[]): Array<{ rate: number; base: number; tax: number }> {
  const bases: Record<number, number> = {};
  for (const item of items) {
    // The ROUNDED line total: each line prints `lineTotal.toFixed(2)`, so the
    // taxable base must add up the same figures the receiver re-adds.
    bases[item.ivaRate] = round2((bases[item.ivaRate] ?? 0) + round2(item.lineTotal));
  }
  // The tax of a rate group is its taxable base x the rate, computed ONCE.
  // Adding up each line's already-rounded VAT drifted: ten lines of EUR 12,34
  // at 21% summed to 25,90 where 123,40 x 21% is 25,91.
  return Object.keys(bases).map((rate) => ({
    rate: Number(rate),
    base: bases[Number(rate)],
    tax: round2(bases[Number(rate)] * (Number(rate) / 100)),
  }));
}

export function facturaeTaxTotals(items: FacturaeLineItem[]): { base: number; tax: number } {
  return facturaeTaxGroups(items).reduce(
    (acc, g) => ({ base: round2(acc.base + g.base), tax: round2(acc.tax + g.tax) }),
    { base: 0, tax: 0 },
  );
}

function buildTaxOutputs(items: FacturaeLineItem[]): string {
  return facturaeTaxGroups(items).map((g) => `        <Tax>
          <TaxTypeCode>01</TaxTypeCode>
          <TaxRate>${g.rate.toFixed(2)}</TaxRate>
          <TaxableBase><TotalAmount>${g.base.toFixed(2)}</TotalAmount></TaxableBase>
          <TaxAmount><TotalAmount>${g.tax.toFixed(2)}</TotalAmount></TaxAmount>
        </Tax>`).join('\n');
}

function buildTaxWithholdings(items: FacturaeLineItem[]): string {
  const groups: Record<number, { basisAmount: number; taxAmount: number }> = {};

  for (const item of items) {
    if (item.irpfRate && item.irpfAmount) {
      if (!groups[item.irpfRate]) {
        groups[item.irpfRate] = { basisAmount: 0, taxAmount: 0 };
      }
      groups[item.irpfRate].basisAmount += item.lineTotal;
      groups[item.irpfRate].taxAmount += item.irpfAmount;
    }
  }

  return Object.entries(groups).map(([rate, g]) => `        <Tax>
          <TaxTypeCode>04</TaxTypeCode>
          <TaxRate>${parseFloat(rate).toFixed(2)}</TaxRate>
          <TaxableBase><TotalAmount>${g.basisAmount.toFixed(2)}</TotalAmount></TaxableBase>
          <TaxAmount><TotalAmount>${g.taxAmount.toFixed(2)}</TotalAmount></TaxAmount>
        </Tax>`).join('\n');
}

// ---------------------------------------------------------------------------
// VAT rate helper
// ---------------------------------------------------------------------------

/**
 * Returns the standard IVA rate for Spain.
 * Construction: 21% general, 10% for renovation of dwellings.
 * IRPF withholding: 15% standard, 7% for new autónomos (first 3 years).
 */
export function getVATRateForCountry(): number {
  return IVA_RATES.GENERAL; // 21%
}

function simpleHash(input: string): string {
  // Simple string hash for demo/mock — production would use crypto.subtle.digest('SHA-256', ...)
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0').toUpperCase();
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * E-INVOICE IDENTIFIERS → IDENTITY-GRADE COHORT KEYS
 *
 * The pricing moat's binding constraint is not how many observations exist, it
 * is that one product is spelled many ways, so observations scatter into sub-k
 * cohorts and the benchmark shows nothing. Text canonicalisation narrows that;
 * an EAN closes it outright — two contractors who scanned the same barcode are
 * in the same cohort with no judgement involved and no model in the loop.
 *
 * Structured e-invoices carry those codes, and the EU mandate is about to
 * compel every merchant in four countries to send them. The parser was
 * discarding them, so the best input the moat will ever get was landing as
 * free text. These tests pin the whole chain: XML → ScannedLineItem →
 * canonicalMaterialKey.
 */

import { parseEInvoiceXml } from '../einvoiceParser';
import { canonicalMaterialKey } from '../../services/materialNormalization';

const UBL = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0</cbc:CustomizationID>
  <cbc:ID>RE-2026-4471</cbc:ID>
  <cbc:IssueDate>2026-08-01</cbc:IssueDate>
  <cac:AccountingSupplierParty><cac:Party>
    <cac:PartyName><cbc:Name>Grosshandel Bauer GmbH</cbc:Name></cac:PartyName>
  </cac:Party></cac:AccountingSupplierParty>
  <cac:TaxTotal><cbc:TaxAmount currencyID="EUR">19.00</cbc:TaxAmount></cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:TaxInclusiveAmount currencyID="EUR">119.00</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">119.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="MTR">50</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">100.00</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>YMvK kabel 3x2,5mm2</cbc:Name>
      <cac:SellersItemIdentification><cbc:ID>ART-99881</cbc:ID></cac:SellersItemIdentification>
      <cac:StandardItemIdentification><cbc:ID schemeID="0160">4006379012345</cbc:ID></cac:StandardItemIdentification>
    </cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="EUR">2.00</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>
</Invoice>`;

const CII = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100">
  <rsm:ExchangedDocument><ram:ID>ZF-2026-1</ram:ID></rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:SpecifiedTradeProduct>
        <ram:GlobalID schemeID="0160">4006379099999</ram:GlobalID>
        <ram:SellerAssignedID>ZF-ART-7</ram:SellerAssignedID>
        <ram:Name>Knauf Diamant 12,5mm</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice><ram:ChargeAmount>12.99</ram:ChargeAmount></ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="H87">10</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>129.90</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:TaxTotalAmount>24.68</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>154.58</ram:GrandTotalAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;

describe('UBL (XRechnung / Peppol)', () => {
  it('extracts the EAN and the supplier article number', () => {
    const line = parseEInvoiceXml(UBL).invoice.lineItems[0];
    expect(line.ean).toBe('4006379012345');
    expect(line.articleNumber).toBe('ART-99881');
  });

  it('does not mistake the line number for the article number', () => {
    // cbc:ID appears on the line itself (value "1") as well as inside the two
    // identification wrappers. Reading it unscoped is the exact bug that made
    // the free validator pass an invoice with no invoice number.
    const line = parseEInvoiceXml(UBL).invoice.lineItems[0];
    expect(line.articleNumber).not.toBe('1');
  });

  it('reads the real unit instead of defaulting everything to piece', () => {
    // `unit` is a GROUP BY column on the benchmark view, so hardcoding 'piece'
    // put metres and pieces in one cohort and made the average meaningless.
    expect(parseEInvoiceXml(UBL).invoice.lineItems[0].unit).toBe('meter');
  });
});

describe('CII (ZUGFeRD / Factur-X)', () => {
  it('extracts GlobalID and SellerAssignedID from SpecifiedTradeProduct', () => {
    const line = parseEInvoiceXml(CII).invoice.lineItems[0];
    expect(line.ean).toBe('4006379099999');
    expect(line.articleNumber).toBe('ZF-ART-7');
  });

  it('maps H87 to piece', () => {
    expect(parseEInvoiceXml(CII).invoice.lineItems[0].unit).toBe('piece');
  });
});

describe('the point of all this — identity beats text', () => {
  it('an extracted EAN produces a confidence-1 cohort key', () => {
    const line = parseEInvoiceXml(UBL).invoice.lineItems[0];
    const key = canonicalMaterialKey({
      description: line.description,
      ean: line.ean,
      articleNumber: line.articleNumber,
      supplierId: 'grosshandel_bauer_gmbh',
      unit: line.unit,
    });
    expect(key.method).toBe('ean');
    expect(key.confidence).toBe(1);
    expect(key.key).toBe('ean:4006379012345');
  });

  it('two different spellings of one barcoded product land in ONE cohort', () => {
    // This is the whole moat argument in one assertion. No canonicalisation,
    // no LLM merge, no judgement — the barcode simply is the identity.
    const a = canonicalMaterialKey({ description: 'YMvK kabel 3x2,5mm2', ean: '4006379012345' });
    const b = canonicalMaterialKey({ description: 'Kabel YMVK 3 x 2.5', ean: '4006379012345' });
    expect(a.key).toBe(b.key);
  });

  it('falls back to the article number when there is no EAN, and only with a supplier', () => {
    // A catalogue code is unique inside one catalogue, so without the supplier
    // it is not an identity and must not be treated as one.
    const withSupplier = canonicalMaterialKey({
      description: 'Knauf Diamant', articleNumber: 'ZF-ART-7', supplierId: 'bauhaus',
    });
    const without = canonicalMaterialKey({ description: 'Knauf Diamant', articleNumber: 'ZF-ART-7' });
    expect(withSupplier.method).toBe('article');
    expect(without.method).not.toBe('article');
  });
});

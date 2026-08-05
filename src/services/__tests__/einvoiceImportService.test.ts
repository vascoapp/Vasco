// =============================================================================
// E-INVOICE IMPORT
// =============================================================================
// This path writes into material_price_history, which is the training data the
// whole cohort moat runs on and the one thing that cannot be un-poisoned. So
// the properties worth pinning are about what reaches it, and about failing
// clearly rather than presenting an empty invoice as a success.
// =============================================================================

import { importEInvoiceXml } from '../einvoiceImportService';

jest.mock('../invoiceScanService', () => ({
  ...jest.requireActual('../invoiceScanService'),
  feedPricingMoat: jest.fn().mockResolvedValue(undefined),
}));

const { feedPricingMoat } = jest.requireMock('../invoiceScanService');

const XRECHNUNG = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0</cbc:CustomizationID>
  <cbc:ID>RE-2026-4471</cbc:ID>
  <cbc:IssueDate>2026-08-01</cbc:IssueDate>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty><cac:Party>
    <cac:PartyName><cbc:Name>Grosshandel Bauer GmbH</cbc:Name></cac:PartyName>
  </cac:Party></cac:AccountingSupplierParty>
  <cac:TaxTotal><cbc:TaxAmount currencyID="EUR">19.00</cbc:TaxAmount></cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">100.00</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">100.00</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">119.00</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">119.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="MTR">50</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">100.00</cbc:LineExtensionAmount>
    <cac:Item><cbc:Name>YMvK kabel 3x2,5mm2</cbc:Name></cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="EUR">2.00</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>
</Invoice>`;

beforeEach(() => jest.clearAllMocks());

describe('importing a supplier e-invoice', () => {
  it('reads an XRechnung into the same shape a photo scan produces', async () => {
    const r = await importEInvoiceXml(XRECHNUNG);
    expect(r.ok).toBe(true);
    expect(r.invoice?.supplierName).toContain('Bauer');
    expect(r.invoice?.lineItems.length).toBeGreaterThan(0);
    // One downstream, two intakes — the whole point of reusing the parser.
    expect(r.invoice?.documentNumber).toBe('RE-2026-4471');
  });

  it('feeds the price index', async () => {
    const r = await importEInvoiceXml(XRECHNUNG);
    expect(feedPricingMoat).toHaveBeenCalledTimes(1);
    expect(r.fedMoat).toBe(true);
  });

  it("tags the moat rows 'einvoice', not 'invoice_scan'", async () => {
    // Provenance is the whole reason this intake is worth more than the photo
    // one. These are the supplier's declared figures; the OCR rows are a model
    // reading a photograph. Same table, different evidence — and if the vision
    // path ever regresses, this tag is the only thing that makes the
    // trustworthy rows separable in a table that cannot be un-poisoned.
    await importEInvoiceXml(XRECHNUNG);
    expect(feedPricingMoat).toHaveBeenCalledWith(expect.anything(), 'einvoice');
  });

  it('still imports when the moat feed throws', async () => {
    // The contractor asked to read their invoice. A failure in our background
    // analytics must not take that away from them.
    feedPricingMoat.mockRejectedValueOnce(new Error('offline'));
    const r = await importEInvoiceXml(XRECHNUNG);
    expect(r.ok).toBe(true);
    expect(r.fedMoat).toBe(false);
  });
});

describe('failing clearly', () => {
  it('rejects an empty file', async () => {
    const r = await importEInvoiceXml('   ');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('empty_file');
  });

  it('rejects something that is not an e-invoice', async () => {
    const r = await importEInvoiceXml('<html><body>hello</body></html>');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('unrecognised_format');
    expect(feedPricingMoat).not.toHaveBeenCalled();
  });

  it('refuses an invoice with no lines rather than reporting success', async () => {
    // An invoice with no lines has nothing to price and nothing worth showing.
    // Presenting it as imported would be the dishonest outcome.
    const noLines = XRECHNUNG.replace(/<cac:InvoiceLine>[\s\S]*<\/cac:InvoiceLine>/, '');
    const r = await importEInvoiceXml(noLines);
    expect(r.ok).toBe(false);
    expect(r.error).toBe('no_line_items');
    expect(feedPricingMoat).not.toHaveBeenCalled();
  });
});

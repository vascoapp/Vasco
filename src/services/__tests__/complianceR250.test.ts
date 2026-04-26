/**
 * @jest-environment node
 *
 * R250 compliance tests:
 *  - einvoiceParser: XRechnung UBL + ZUGFeRD CII parsing
 *  - gobdAuditTrailService: hash chain integrity
 *  - companyLookup.lookupNlUbo: API key gating
 */

jest.mock('@react-native-async-storage/async-storage', () => {
  const mockStore: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => (k in mockStore ? mockStore[k] : null)),
      setItem: jest.fn(async (k: string, v: string) => { mockStore[k] = v; }),
      removeItem: jest.fn(async (k: string) => { delete mockStore[k]; }),
      __mockStore: mockStore,
    },
  };
});

describe('einvoiceParser — XRechnung UBL', () => {
  const sampleUbl = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</cbc:CustomizationID>
  <cbc:ID>R-2026-001</cbc:ID>
  <cbc:IssueDate>2026-04-15</cbc:IssueDate>
  <cac:AccountingSupplierParty><cac:Party><cac:PartyLegalEntity>
    <cbc:RegistrationName>Mueller GmbH</cbc:RegistrationName>
  </cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty>
  <cac:TaxTotal><cbc:TaxAmount currencyID="EUR">95.00</cbc:TaxAmount></cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:PayableAmount currencyID="EUR">595.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="H87">5</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">500.00</cbc:LineExtensionAmount>
    <cac:Item><cbc:Name>Kupferrohr 22mm</cbc:Name></cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="EUR">100.00</cbc:PriceAmount></cac:Price>
    <cac:TaxCategory><cbc:Percent>19</cbc:Percent></cac:TaxCategory>
  </cac:InvoiceLine>
</Invoice>`;

  test('detectFormat → xrechnung', () => {
    const { detectFormat } = require('../../integrations/einvoiceParser');
    expect(detectFormat(sampleUbl)).toBe('xrechnung');
  });

  test('parseEInvoiceXml extracts header + line + total', () => {
    const { parseEInvoiceXml } = require('../../integrations/einvoiceParser');
    const result = parseEInvoiceXml(sampleUbl);
    expect(result.format).toBe('xrechnung');
    expect(result.invoice.documentNumber).toBe('R-2026-001');
    expect(result.invoice.documentDate).toBe('2026-04-15');
    expect(result.invoice.supplierName).toBe('Mueller GmbH');
    expect(result.invoice.total).toBeCloseTo(595, 1);
    expect(result.invoice.vatAmount).toBeCloseTo(95, 1);
    expect(result.invoice.lineItems).toHaveLength(1);
    expect(result.invoice.lineItems[0].description).toBe('Kupferrohr 22mm');
    expect(result.invoice.lineItems[0].quantity).toBe(5);
    expect(result.invoice.lineItems[0].vatRate).toBe(19);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  test('detectFormat → unknown for non-einvoice xml', () => {
    const { detectFormat } = require('../../integrations/einvoiceParser');
    expect(detectFormat('<root>hello</root>')).toBe('unknown');
  });
});

describe('einvoiceParser — ZUGFeRD CII', () => {
  const sampleCii = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100">
  <rsm:ExchangedDocument>
    <ram:ID>FX-2026-7</ram:ID>
    <ram:IssueDateTime><udt:DateTimeString format="102">20260420</udt:DateTimeString></ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:Name>Stahltraeger 6m</ram:Name>
      <ram:BilledQuantity unitCode="H87">2</ram:BilledQuantity>
      <ram:ChargeAmount currencyID="EUR">450.00</ram:ChargeAmount>
      <ram:LineTotalAmount currencyID="EUR">900.00</ram:LineTotalAmount>
      <ram:RateApplicablePercent>19</ram:RateApplicablePercent>
    </ram:IncludedSupplyChainTradeLineItem>
    <ram:Name>BauTech AG</ram:Name>
    <ram:GrandTotalAmount currencyID="EUR">1071.00</ram:GrandTotalAmount>
    <ram:TaxTotalAmount currencyID="EUR">171.00</ram:TaxTotalAmount>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;

  test('detectFormat → cii', () => {
    const { detectFormat } = require('../../integrations/einvoiceParser');
    const fmt = detectFormat(sampleCii);
    expect(['cii', 'zugferd']).toContain(fmt);
  });

  test('parseEInvoiceXml CII extracts grand total + line', () => {
    const { parseEInvoiceXml } = require('../../integrations/einvoiceParser');
    const result = parseEInvoiceXml(sampleCii);
    expect(result.invoice.total).toBeCloseTo(1071, 1);
    expect(result.invoice.vatAmount).toBeCloseTo(171, 1);
    expect(result.invoice.lineItems.length).toBeGreaterThanOrEqual(1);
    expect(result.invoice.lineItems[0].description).toBe('Stahltraeger 6m');
  });
});

describe('gobdAuditTrailService — hash chain', () => {
  beforeEach(async () => {
    const svc = require('../gobdAuditTrailService');
    await svc.__resetForTest();
  });

  test('appends entries with chained prevHash', async () => {
    const svc = require('../gobdAuditTrailService');
    const e1 = await svc.appendAudit({ type: 'invoice_created', ref: 'INV-1', payload: { amount: 100 } });
    const e2 = await svc.appendAudit({ type: 'invoice_sent', ref: 'INV-1', payload: { sentAt: '2026-04-20' } });
    expect(e1.prevHash).toBe('0000000000000000');
    expect(e2.prevHash).toBe(e1.contentHash);
    expect(e1.index).toBe(0);
    expect(e2.index).toBe(1);
  });

  test('verifyAuditTrail returns valid for clean chain', async () => {
    const svc = require('../gobdAuditTrailService');
    await svc.appendAudit({ type: 'invoice_created', ref: 'A', payload: { x: 1 } });
    await svc.appendAudit({ type: 'invoice_sent', ref: 'A', payload: { x: 2 } });
    await svc.appendAudit({ type: 'invoice_paid', ref: 'A', payload: { x: 3 } });
    const result = await svc.verifyAuditTrail();
    expect(result.valid).toBe(true);
    expect(result.totalEntries).toBe(3);
  });

  test('exportAuditTrail produces parseable text', async () => {
    const svc = require('../gobdAuditTrailService');
    await svc.appendAudit({ type: 'invoice_created', ref: 'B', payload: { x: 1 } });
    const text = await svc.exportAuditTrail();
    expect(text).toContain('Vasco GoBD audit trail');
    expect(text).toContain('invoice_created|B');
  });
});

describe('lookupNlUbo', () => {
  test('rejects non-8-digit numbers', async () => {
    const { lookupNlUbo } = require('../../integrations/companyLookup');
    const r = await lookupNlUbo('123');
    expect(r.found).toBe(false);
    expect(r.error).toMatch(/8 digits/);
  });

  test('reports missing API key', async () => {
    const { lookupNlUbo } = require('../../integrations/companyLookup');
    const r = await lookupNlUbo('12345678');
    expect(r.found).toBe(false);
    expect(r.error).toMatch(/API key/);
  });
});

/**
 * The wedge, closed: what we SEND must be what we can RECEIVE.
 *
 * memory/gtm-germany-beachhead says the German receive obligation — binding
 * since Jan 2025, no turnover threshold — is the wedge, two years ahead of the
 * issuing deadline every competitor is selling to. `einvoiceParser` is that
 * receive side, reached from app/contractor/inkoop.tsx.
 *
 * The generator and the parser were written separately and had never met. If
 * our own XRechnung does not survive our own importer, then either we emit
 * something a German buyer's system cannot read, or we cannot read what a
 * German supplier sends us — and both are the wedge failing.
 *
 * This is the same trap as the validator: two artefacts built from one
 * understanding can agree with each other and both be wrong. So it asserts
 * VALUES that came from outside — the numbers on the invoice — not merely that
 * parsing produced an object.
 */
import { generateXRechnungXML, generateCIIXML, type EInvoiceData } from '../einvoice';
import { parseEInvoiceXml, detectFormat } from '../einvoiceParser';

const INVOICE: EInvoiceData = {
  sellerName: 'Elektro Meyer GmbH',
  sellerAddress: 'Hauptstraße 14',
  sellerVatId: 'DE123456789',
  sellerCity: 'Berlin', sellerPostalCode: '10115',
  sellerContactName: 'Jörg Meyer', sellerPhone: '+49 30 1234567',
  sellerEmail: 'buchhaltung@elektro-meyer.de',
  buyerName: 'Bäckerei Schmidt',
  buyerAddress: 'Marktplatz 3', buyerCity: 'Berlin', buyerPostalCode: '10178',
  invoiceNumber: 'R-2026-0042',
  invoiceDate: '2026-08-19',
  dueDate: '2026-09-18',
  currency: 'EUR',
  lineItems: [
    { description: 'Schaltschrank prüfen', quantity: 1, unitCode: 'stuk', unitPrice: 480, vatRate: 19, lineTotal: 480 },
    { description: 'Kabel NYM-J 3x1,5', quantity: 20, unitCode: 'm', unitPrice: 1.2, vatRate: 19, lineTotal: 24 },
  ],
  totalNet: 504, totalVat: 95.76, totalGross: 599.76,
} as EInvoiceData;

describe('XRechnung round trip: our generator → our importer', () => {
  const xml = generateXRechnungXML(INVOICE);
  const parsed = parseEInvoiceXml(xml);

  it('is recognised as XRechnung, not "unknown"', () => {
    expect(detectFormat(xml)).toBe('xrechnung');
    expect(parsed.format).toBe('xrechnung');
  });

  it('recovers the supplier — the field a purchase import is keyed on', () => {
    // inkoop.tsx books this against a supplier; an empty name makes the import
    // useless even though it "succeeded".
    expect(parsed.invoice.supplierName).toContain('Elektro Meyer');
  });

  it('recovers the invoice number and the money', () => {
    // ScannedInvoice calls these documentNumber / total — the shape is shared
    // with the photo-scan path, where "document" may be a receipt or a
    // delivery note rather than an invoice.
    expect(parsed.invoice.documentNumber).toBe('R-2026-0042');
    expect(parsed.invoice.total).toBeCloseTo(599.76, 2);
    expect(parsed.invoice.vatAmount).toBeCloseTo(95.76, 2);
    expect(parsed.invoice.subtotal).toBeCloseTo(504, 2);
  });

  it('recovers both line items with their real prices', () => {
    // Two lines with DIFFERENT unit prices, so a parser that grabbed the first
    // match for everything would be caught.
    expect(parsed.invoice.lineItems).toHaveLength(2);
    const [a, b] = parsed.invoice.lineItems;
    expect(a.description).toContain('Schaltschrank');
    expect(Number(a.unitPrice)).toBeCloseTo(480, 2);
    expect(b.description).toContain('Kabel');
    expect(Number(b.unitPrice)).toBeCloseTo(1.2, 2);
  });

  it('does not silently degrade to a low-confidence guess', () => {
    // A parse that "works" at 0.2 confidence is one the import screen should
    // not be trusting, and would mean the round trip is broken in practice.
    expect(parsed.confidence).toBeGreaterThan(0.5);
  });
});


/**
 * The same round trip for CII — the payload inside ZUGFeRD and Factur-X, and
 * what our importer reads off an inbound one.
 *
 * ⚠️ A CII document is NOT a ZUGFeRD or Factur-X file. Both of those are a
 * PDF/A-3 with this XML attached, and nothing here embeds anything in a PDF.
 * What this proves is that the payload is complete and readable; the container
 * is a separate, unbuilt piece.
 */
describe('CII round trip: our generator → our importer', () => {
  const xml = generateCIIXML(INVOICE);
  const parsed = parseEInvoiceXml(xml);

  it('is recognised as CII', () => {
    expect(detectFormat(xml)).toBe('cii');
  });

  it('carries a seller AND a buyer — the old stub had neither', () => {
    expect(xml).toContain('<ram:SellerTradeParty>');
    expect(xml).toContain('<ram:BuyerTradeParty>');
    expect(xml).toContain('Elektro Meyer GmbH');
    expect(xml).toContain('Bäckerei Schmidt');
  });

  it('carries the line items — the old stub had none', () => {
    expect(xml.match(/<ram:IncludedSupplyChainTradeLineItem>/g) ?? []).toHaveLength(2);
    expect(parsed.invoice.lineItems).toHaveLength(2);
    expect(parsed.invoice.lineItems[0].description).toContain('Schaltschrank');
  });

  it('carries a VAT breakdown per rate — the old stub had none', () => {
    // Header-level ApplicableTradeTax, one per rate, with basis and calculated
    // amount. A single stated total is not a breakdown.
    expect(xml).toContain('<ram:BasisAmount>504.00</ram:BasisAmount>');
    expect(xml).toContain('<ram:CalculatedAmount>95.76</ram:CalculatedAmount>');
  });

  it('has the three header blocks in the order the schema requires', () => {
    // SupplyChainTradeTransaction: lines, Agreement, Delivery, Settlement.
    // The old version emitted Settlement alone, so it was not schema-valid
    // even before the missing content.
    const agreement = xml.indexOf('ApplicableHeaderTradeAgreement');
    const delivery = xml.indexOf('ApplicableHeaderTradeDelivery');
    const settlement = xml.indexOf('ApplicableHeaderTradeSettlement');
    expect(agreement).toBeGreaterThan(-1);
    expect(delivery).toBeGreaterThan(agreement);
    expect(settlement).toBeGreaterThan(delivery);
  });

  it('round-trips the money through our own importer', () => {
    expect(parsed.invoice.documentNumber).toBe('R-2026-0042');
    expect(parsed.invoice.total).toBeCloseTo(599.76, 2);
    expect(parsed.invoice.vatAmount).toBeCloseTo(95.76, 2);
  });
});


/**
 * The two receive-side defects this round trip exposed, pinned individually.
 *
 * Both were live on the path a German or French contractor uses to import a
 * supplier's ZUGFeRD — which memory/gtm-germany-beachhead calls the wedge, and
 * which has been legally binding since Jan 2025 with no turnover threshold.
 * Neither would have been found by reading: the old generator produced no
 * parties and no lines, so a self-test could not have hit either one.
 */
describe('CII parser — the two things it used to read off the wrong element', () => {
  const xml = generateCIIXML(INVOICE);

  it('the document number is the invoice number, not the specification URN', () => {
    // `firstMatch(xml, 'ID')` over a whole CII document returns
    // GuidelineSpecifiedDocumentContextParameter/ID. Every supplier's invoice
    // imported as "urn:cen.eu:en16931:2017" — identical for all of them, so
    // nothing reconciled and duplicates were invisible.
    const n = parseEInvoiceXml(xml).invoice.documentNumber;
    expect(n).toBe('R-2026-0042');
    expect(n).not.toContain('urn:');
  });

  it('the supplier is the seller, not the first product on the invoice', () => {
    // In CII the line items come BEFORE the parties, so the first <ram:Name>
    // is a product. Purchases were booked against "Schaltschrank prüfen".
    const s = parseEInvoiceXml(xml).invoice.supplierName;
    expect(s).toContain('Elektro Meyer');
    expect(s).not.toContain('Schaltschrank');
  });

  it('a tag name never matches a longer tag that starts with it', () => {
    // The root cause of the first bug: `[^>]*` let `ExchangedDocument` match
    // `<rsm:ExchangedDocumentContext>`, and the block then ran to the end of
    // the real element, swallowing the URN. Guarded at the matcher, because
    // Name/NameSuffix and ID/IDType would fail the same way.
    expect(xml).toContain('<rsm:ExchangedDocumentContext>');
    expect(xml).toContain('<rsm:ExchangedDocument>');
    expect(parseEInvoiceXml(xml).invoice.documentNumber).toBe('R-2026-0042');
  });
});

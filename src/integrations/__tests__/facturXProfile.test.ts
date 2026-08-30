/**
 * Factur-X and ZUGFeRD share the CII syntax and are NOT the same document.
 *
 * A validator decides which standard a file claims by reading
 * `GuidelineSpecifiedDocumentContextParameter/ID`. Before this, every French
 * invoice carried the bare `urn:cen.eu:en16931:2017` — neither profile — so it
 * failed Factur-X validation while the UI called it Factur-X.
 */
import {
  generateCIIXML,
  generateZUGFeRDXML,
  generateFacturXXML,
  guidelineUrnForCountry,
  GUIDELINE_URNS,
  type EInvoiceData,
} from '../einvoice';

const base: EInvoiceData = {
  sellerName: 'Plomberie Moreau',
  sellerAddress: '12 rue de Rivoli',
  sellerVatId: 'FR40303265045',
  sellerCity: 'Paris',
  sellerPostalCode: '75001',
  sellerCountry: 'FR',
  buyerName: 'Client SARL',
  buyerAddress: '5 avenue Foch',
  buyerCity: 'Lyon',
  buyerPostalCode: '69006',
  buyerCountry: 'FR',
  invoiceNumber: 'F-2026-0007',
  invoiceDate: '2026-08-30',
  dueDate: '2026-09-29',
  currency: 'EUR',
  lineItems: [
    { description: 'Remplacement chaudiere', quantity: 1, unitCode: 'C62', unitPrice: 1200, vatRate: 10, vatAmount: 120, lineTotal: 1200 },
  ],
  totalNet: 1200,
  totalVat: 120,
  totalGross: 1320,
};

const guidelineOf = (xml: string): string => {
  const m = xml.match(/<ram:GuidelineSpecifiedDocumentContextParameter>\s*<ram:ID>([^<]+)<\/ram:ID>/);
  return m ? m[1] : '';
};

describe('Factur-X carries the French profile URN', () => {
  it('names the two profiles distinctly', () => {
    expect(GUIDELINE_URNS.facturx).toBe('urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:en16931');
    expect(GUIDELINE_URNS.en16931).toBe('urn:cen.eu:en16931:2017');
    expect(GUIDELINE_URNS.facturx).not.toBe(GUIDELINE_URNS.en16931);
  });

  it('resolves the URN from the seller country', () => {
    expect(guidelineUrnForCountry('FR')).toBe(GUIDELINE_URNS.facturx);
    expect(guidelineUrnForCountry('DE')).toBe(GUIDELINE_URNS.en16931);
    expect(guidelineUrnForCountry(undefined)).toBe(GUIDELINE_URNS.en16931);
  });

  it('emits the Factur-X profile for a French seller', () => {
    expect(guidelineOf(generateFacturXXML(base))).toBe(GUIDELINE_URNS.facturx);
    expect(guidelineOf(generateCIIXML(base))).toBe(GUIDELINE_URNS.facturx);
  });

  it('still emits plain EN 16931 for a German seller — Factur-X must not leak into ZUGFeRD', () => {
    const de: EInvoiceData = { ...base, sellerCountry: 'DE', buyerCountry: 'DE' };
    expect(guidelineOf(generateZUGFeRDXML(de))).toBe(GUIDELINE_URNS.en16931);
    expect(guidelineOf(generateZUGFeRDXML(de))).not.toContain('factur-x');
  });

  it('forces the French profile even if the caller passes another country', () => {
    const de: EInvoiceData = { ...base, sellerCountry: 'DE' };
    expect(guidelineOf(generateFacturXXML(de))).toBe(GUIDELINE_URNS.facturx);
  });
});

/**
 * BT-24 of a Factur-X / ZUGFeRD EN 16931 invoice — pinned to what the
 * AUTHORITY's validator accepts, not to what we once believed.
 *
 * History: #277 (2026-08-30) gave France
 * `urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:en16931`, reasoning
 * that the bare EN 16931 URN was "neither profile", and this file pinned it.
 * The first run of Mustang 2.26.0 (2026-10-01, npm run check:pdfa3) rejected
 * every French invoice: FX-SCH-A-000556 "Value of 'ram:ID' is not allowed".
 * The EN 16931 profile of Factur-X 1.0 AND ZUGFeRD 2.x is
 * `urn:cen.eu:en16931:2017`; the French-ness lives in the PDF/A-3 container.
 *
 * Plus the French 2026-reform content (BR-FR-05/10/12/13) Mustang's FR
 * schematron checks, which only the French invoice must carry.
 */
import {
  generateCIIXML,
  generateZUGFeRDXML,
  generateFacturXXML,
  guidelineUrnForCountry,
  GUIDELINE_URNS,
  FR_STATUTORY_NOTES,
  sirenFromSiret,
  type EInvoiceData,
} from '../einvoice';

const base: EInvoiceData = {
  sellerName: 'Plomberie Moreau',
  sellerAddress: '12 rue de Rivoli',
  sellerVatId: 'FR40303265045',
  sellerCity: 'Paris',
  sellerPostalCode: '75001',
  sellerCountry: 'FR',
  sellerEmail: 'contact@plomberie-moreau.fr',
  sellerLegalRegistrationId: '303265045',
  sellerLegalRegistrationScheme: '0002',
  buyerName: 'Client SARL',
  buyerAddress: '5 avenue Foch',
  buyerCity: 'Lyon',
  buyerPostalCode: '69006',
  buyerCountry: 'FR',
  buyerEmail: 'factures@client.fr',
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

describe('Factur-X / ZUGFeRD EN 16931 carry the identifier Mustang accepts', () => {
  it('is urn:cen.eu:en16931:2017 for both — never the invented #compliant#…:en16931', () => {
    expect(GUIDELINE_URNS.facturx).toBe('urn:cen.eu:en16931:2017');
    expect(GUIDELINE_URNS.en16931).toBe('urn:cen.eu:en16931:2017');
    for (const xml of [generateFacturXXML(base), generateCIIXML(base), generateZUGFeRDXML({ ...base, sellerCountry: 'DE' })]) {
      expect(guidelineOf(xml)).toBe('urn:cen.eu:en16931:2017');
      expect(xml).not.toContain('factur-x.eu:1p0:en16931');
    }
    expect(guidelineUrnForCountry('FR')).toBe('urn:cen.eu:en16931:2017');
  });
});

describe('French 2026-reform content in the XML', () => {
  const fr = generateFacturXXML(base);

  it('carries the three statutory payment notes with their subject codes (BR-FR-05)', () => {
    for (const n of FR_STATUTORY_NOTES) {
      expect(fr).toContain(`<ram:SubjectCode>${n.code}</ram:SubjectCode>`);
    }
    expect(FR_STATUTORY_NOTES.map((n) => n.code).sort()).toEqual(['AAB', 'PMD', 'PMT']);
  });

  it('carries the seller SIREN as BT-30 with scheme 0002 (BR-FR-10)', () => {
    expect(fr).toMatch(/<ram:SpecifiedLegalOrganization>\s*<ram:ID schemeID="0002">303265045<\/ram:ID>/);
  });

  it('carries both electronic addresses as EM (BR-FR-12 / BR-FR-13)', () => {
    expect(fr).toContain('<ram:URIID schemeID="EM">contact@plomberie-moreau.fr</ram:URIID>');
    expect(fr).toContain('<ram:URIID schemeID="EM">factures@client.fr</ram:URIID>');
  });

  it('does not put French statutory notes on a German invoice', () => {
    const de = generateCIIXML({ ...base, sellerCountry: 'DE', buyerCountry: 'DE' });
    expect(de).not.toContain('<ram:IncludedNote>');
  });

  it('derives the SIREN from a SIRET, and refuses anything else', () => {
    expect(sirenFromSiret('303 265 045 00017')).toBe('303265045');
    expect(sirenFromSiret('303265045')).toBe('303265045');
    expect(sirenFromSiret('30326504')).toBeNull();
    expect(sirenFromSiret('HRB 12345')).toBeNull();
    expect(sirenFromSiret(undefined)).toBeNull();
  });
});

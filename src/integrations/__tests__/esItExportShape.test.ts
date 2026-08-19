/**
 * Do the Facturae (ES) and FatturaPA (IT) export buttons actually work?
 *
 * Both are rendered in app/invoices/[id].tsx (country === 'ES' / 'IT') and both
 * build their argument as `const data: any = { … }` — so TypeScript cannot see
 * whether that object matches what the generator expects. The comment sitting
 * directly above the buttons says the mappers do not exist:
 *
 *   "ES/IT formats also gap (Facturae, FatturaPA generators exist but no UI
 *    mapper). See DORMANT_AUDIT.md R4."
 *
 * The buttons ship anyway. This calls the generators with the EXACT shape the
 * screen builds, which is the only way to find out — Italy is the market where
 * a rejected invoice was never legally issued, so "it throws" and "it produces
 * something SDI rejects" are both worth knowing before a contractor taps it.
 */
import { generateFatturaPAXml } from '../einvoice-it';
import { generateFacturaeXml } from '../einvoice-es';

/** Exactly what app/invoices/[id].tsx assembles for IT. */
const IT_SHAPE: any = {
  sellerName: 'Idraulico Rossi SRL',
  sellerVatId: 'IT12345678901',
  sellerCodiceFiscale: 'IT12345678901',
  sellerAddress: 'Via Roma 1',
  sellerCity: 'Milano',
  sellerPostalCode: '20100',
  sellerProvince: 'MI',
  sellerCountry: 'IT',
  buyerName: 'Panificio Bianchi',
  buyerVatId: 'IT98765432109',
  buyerCodiceFiscale: '',
  buyerAddress: 'Via Verdi 2',
  buyerCity: '',
  buyerPostalCode: '',
  buyerProvince: '',
  buyerCountry: 'IT',
  invoiceNumber: 'F-2026-0007',
  invoiceDate: '2026-08-19',
  dueDate: '2026-09-18',
  currency: 'EUR',
  lineItems: [
    { description: 'Riparazione', quantity: 1, unitPrice: 200, lineTotal: 200, ivaRate: 22, ivaAmount: 44 },
  ],
  totalNet: 200,
  totalVat: 44,
  totalGross: 244,
  iban: 'IT60X0542811101000000123456',
  paymentMethod: 'MP05',
};

/** And for ES. */
const ES_SHAPE: any = { ...IT_SHAPE, sellerCountry: 'ES', buyerCountry: 'ES', sellerNif: 'B12345678' };

describe('ES / IT e-invoice mappers — historic shapes, kept as a regression', () => {
  // These held the buttons closed until src/integrations/einvoiceMapping.ts
  // existed. They stay `it.failing` because the shapes below are the OLD
  // hand-built ones — the point is that a flat `{…, lineItems}` object must
  // never again be handed straight to these generators. If someone makes
  // either pass, they have widened a generator to swallow the wrong shape,
  // which is how the crash got in.
  //
  // The real coverage is einvoiceMapping.test.ts.
  it.failing('FatturaPA must NOT accept a flat hand-built object', () => {
    expect(() => generateFatturaPAXml(IT_SHAPE)).not.toThrow();
  });

  it.failing('Facturae must NOT accept a shape with no buyer NIF', () => {
    expect(() => generateFacturaeXml(ES_SHAPE)).not.toThrow();
  });

  it('the generators themselves are still exported and callable', () => {
    // Guard against "fixing" this by deleting the generators. FatturaPA in
    // particular carries REA, bollo, cassa previdenziale and a DatiRiepilogo
    // grouped by rate — real work that should survive until a mapper uses it.
    expect(typeof generateFatturaPAXml).toBe('function');
    expect(typeof generateFacturaeXml).toBe('function');
  });
});

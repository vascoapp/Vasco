/**
 * @jest-environment node
 */
// First run against the OFFICIAL schemas (2026-10-01, npm run
// check:einvoice-schemas): every FatturaPA with a due date put
// DataScadenzaPagamento after ImportoPagamento — schema-invalid, so SDI refuses
// it (00200) and in Italy the invoice was never legally issued; and a
// self-employed Spanish seller or buyer had no FirstSurname, which Facturae
// requires. These pin the same facts without network or xmllint.
import { splitSpanishName } from '../einvoice-es';
import { toFacturae, toFatturaPA, type EInvoiceSource } from '../einvoiceMapping';
import { generateFacturaeXml } from '../einvoice-es';
import { generateFatturaPAXml } from '../einvoice-it';

it('splits a Spanish name into given name(s) and surnames', () => {
  expect(splitSpanishName('Lucía Navarro Gómez')).toEqual({ name: 'Lucía', firstSurname: 'Navarro', secondSurname: 'Gómez' });
  expect(splitSpanishName('María José García López')).toEqual({ name: 'María José', firstSurname: 'García', secondSurname: 'López' });
  expect(splitSpanishName('Javier Ruiz')).toEqual({ name: 'Javier', firstSurname: 'Ruiz' });
  expect(splitSpanishName('Javier')).toBeNull();
});

const src = (over: Partial<EInvoiceSource> = {}): EInvoiceSource => ({
  seller: { name: 'Lucía Navarro Gómez', vatId: 'ES12345678Z', address: 'Calle Mayor 1', city: 'Madrid', postcode: '28013', province: 'Madrid', country: 'ES', personType: 'F', fiscalRegime: 'RF01', iban: 'ES9121000418450200051332' },
  buyer: { name: 'Panadería Navarro S.L.', vatId: 'ESB87654321', address: 'Calle Sol 3', city: 'Sevilla', postcode: '41001', province: 'Sevilla', country: 'ES', einvoiceRouting: 'ABCDEF1' },
  invoiceNumber: 'FA-1', invoiceDate: '2026-09-30', dueDate: '2026-10-30', currency: 'EUR',
  lines: [{ description: 'Pintura', quantity: 3, unitPrice: 35.5, lineTotal: 106.5, vatRate: 21 }],
  totalNet: 106.5, totalVat: 22.37, totalGross: 128.87,
  ...over,
} as EInvoiceSource);

it('a self-employed seller is Name + FirstSurname (+ SecondSurname) in Facturae', () => {
  const r = toFacturae(src());
  expect(r.ok).toBe(true);
  const xml = generateFacturaeXml((r as any).document);
  expect(xml).toMatch(/<Name>Lucía<\/Name>\s*<FirstSurname>Navarro<\/FirstSurname>\s*<SecondSurname>Gómez<\/SecondSurname>/);
});

it('a one-word person name is asked for, never guessed — seller and buyer', () => {
  const seller = toFacturae(src({ seller: { ...src().seller, name: 'Lucía' } }));
  expect(seller.ok).toBe(false);
  expect((seller as any).missing.map((m: any) => m.key)).toContain('profile.nameWithSurname');
  const buyer = toFacturae(src({ buyer: { ...src().buyer, name: 'Navarro', vatId: '12345678Z' } }));
  expect((buyer as any).missing.map((m: any) => m.key)).toContain('customer.nameWithSurname');
});

it('FatturaPA states the due date BEFORE the amount (XSD order)', () => {
  const r = toFatturaPA(src({
    seller: { name: 'Idraulica Bianchi S.r.l.', vatId: 'IT01234567897', taxId: '01234567897', address: 'Via Roma 10', city: 'Milano', postcode: '20121', province: 'MI', country: 'IT', fiscalRegime: 'RF01', iban: 'IT60X0542811101000000123456' },
    buyer: { name: 'Panificio Bruno S.r.l.', vatId: 'IT09876543217', address: 'Corso Italia 5', city: 'Torino', postcode: '10121', province: 'TO', country: 'IT', einvoiceRouting: 'ABCDEF1' },
    lines: [{ description: 'Manodopera', quantity: 2, unitPrice: 50, lineTotal: 100, vatRate: 22 }], totalNet: 100, totalVat: 22, totalGross: 122,
  }));
  expect(r.ok).toBe(true);
  const xml = generateFatturaPAXml((r as any).document);
  const due = xml.indexOf('<DataScadenzaPagamento>');
  expect(due).toBeGreaterThan(-1);
  expect(due).toBeLessThan(xml.indexOf('<ImportoPagamento>'));
});

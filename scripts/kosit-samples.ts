import { writeFileSync } from 'fs';
import { generateXRechnungXML, generateCIIXML } from '../src/integrations/einvoice';
import { documentVatBreakdown } from '../src/domain/business';
// Sample invoices for the official KoSIT validator (npm run check:kosit),
// produced by OUR generators: the four cases that matter for Germany.
const OUT = process.argv[2];
const seller = {
  sellerName: 'Sanitär Bergmann GmbH', sellerAddress: 'Hauptstraße 14', sellerVatId: 'DE123456789',
  sellerCity: 'Köln', sellerPostalCode: '50667', sellerCountry: 'DE', sellerContactName: 'Thomas Bergmann',
  sellerPhone: '+49 221 1234567', sellerEmail: 'buero@bergmann-sanitaer.de',
  buyerName: 'Bäckerei Lindner GmbH', buyerAddress: 'Marktplatz 3', buyerCity: 'Köln', buyerPostalCode: '50676', buyerCountry: 'DE',
  buyerEmail: 'rechnung@baeckerei-lindner.de', deliveryDate: '2026-09-28',
  buyerReference: 'RE-2026-0087', invoiceNumber: 'RE-2026-0087', invoiceDate: '2026-09-30', dueDate: '2026-10-30', currency: 'EUR',
  iban: 'DE89370400440532013000', bic: 'COBADEFFXXX', paymentReference: 'RE-2026-0087',
};
type L = { description: string; quantity: number; unitCode: string; unitPrice: number; vatRate: number };
function data(lines: L[], extra: Record<string, unknown> = {}, fallback = 19) {
  const raw = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const b = documentVatBreakdown(raw, lines, fallback);
  return { ...seller, ...extra,
    lineItems: lines.map((l) => ({ ...l, vatAmount: 0, lineTotal: l.quantity * l.unitPrice })),
    totalNet: b.net, totalVat: b.vat, totalGross: b.gross } as any;
}
const cases: Record<string, any> = {
  'single-19': data([{ description: 'Trinkwasserleitung erneuern', quantity: 1, unitCode: 'stuk', unitPrice: 4369.75, vatRate: 19 }], { sellerVatExempt: false }),
  'mixed-subcent': data([
    { description: 'Arbeitszeit', quantity: 1.333, unitCode: 'uur', unitPrice: 55, vatRate: 19 },
    { description: 'Kupferrohr 15 mm', quantity: 2.5, unitCode: 'm', unitPrice: 12.99, vatRate: 19 },
    { description: 'Fachbuch', quantity: 1.125, unitCode: 'stuk', unitPrice: 9.99, vatRate: 7 },
  ], { sellerVatExempt: false }),
  'kleinunternehmer': data([{ description: 'Wartung Heizung', quantity: 2.5, unitCode: 'uur', unitPrice: 48, vatRate: 0 }], { sellerVatExempt: true }, 0),
  'b2g-leitweg': data([{ description: 'Reparatur Sanitäranlage Rathaus', quantity: 3, unitCode: 'uur', unitPrice: 62.5, vatRate: 19 }],
    { sellerVatExempt: false, leitwegId: '04011000-1234512345-06', buyerReference: '04011000-1234512345-06' }),
};
for (const [name, d] of Object.entries(cases)) {
  writeFileSync(`${OUT}/ubl-${name}.xml`, generateXRechnungXML(d));
  writeFileSync(`${OUT}/cii-${name}.xml`, generateCIIXML(d));
}
console.log('written', Object.keys(cases).length * 2);

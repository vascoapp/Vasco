// Sample Italian (FatturaPA) and Spanish (Facturae) invoices for the official
// schema check (npm run check:einvoice-schemas) — built EXACTLY as the invoice
// screen builds them: buildEInvoiceSource → toFatturaPA / toFacturae →
// generator. A mapper refusal is a failure here: these inputs are complete.
import { writeFileSync } from 'fs';
import { buildEInvoiceSource } from '../src/domain/invoiceDocuments';
import { toFatturaPA, toFacturae } from '../src/integrations/einvoiceMapping';
import { generateFatturaPAXml } from '../src/integrations/einvoice-it';
import { generateFacturaeXml } from '../src/integrations/einvoice-es';

const OUT = process.argv[2];
type Line = { description: string; quantity: number; unitPrice: number; vatRate: number };
const inputs = (country: string, profile: Record<string, unknown>, customer: Record<string, unknown>, lines: Line[], rate: number) => ({
  invoice: { id: `${country}-2026-0101`, customerId: 'c1', customer: String(customer.name), job: 'Lavori', amount: 0, status: 'sent', dueInDays: 30, sentAt: '2026-09-30T09:00:00Z' } as any,
  lines, customers: [{ id: 'c1', ...customer }] as any, businessProfile: profile as any, country, effectiveRate: rate,
});

const IT_SELLER = { businessName: 'Idraulica Bianchi S.r.l.', vatNumber: 'IT01234567897', taxId: '01234567897', address: 'Via Roma 10', city: 'Milano', postcode: '20121', province: 'MI', country: 'IT', fiscalRegime: 'RF01', email: 'info@bianchi.it', phone: '+39 02 1234567', iban: 'IT60X0542811101000000123456' };
const IT_BUYER = { name: 'Panificio Bruno S.r.l.', vatId: 'IT09876543217', address: 'Corso Italia 5', city: 'Torino', postcode: '10121', province: 'TO', country: 'IT', einvoiceRouting: 'ABCDEF1' };
const ES_SELLER = { businessName: 'Fontanería Ruiz S.L.', vatNumber: 'ESB12345674', taxId: 'B12345674', address: 'Calle Mayor 1', city: 'Madrid', postcode: '28013', province: 'Madrid', country: 'ES', personType: 'J', email: 'info@ruiz.es', iban: 'ES9121000418450200051332' };
const ES_BUYER = { name: 'Panadería Navarro S.L.', vatId: 'ESB87654321', taxId: 'B87654321', address: 'Calle Sol 3', city: 'Sevilla', postcode: '41001', province: 'Sevilla', country: 'ES' };

const cases: Array<[string, 'it' | 'es', ReturnType<typeof inputs>]> = [
  ['it-b2b-mixed', 'it', inputs('IT', IT_SELLER, IT_BUYER, [
    { description: 'Manodopera', quantity: 1.333, unitPrice: 55, vatRate: 22 },
    { description: 'Tubo rame 15 mm', quantity: 2.5, unitPrice: 12.99, vatRate: 22 },
    { description: 'Ristrutturazione bagno (aliquota agevolata)', quantity: 1.125, unitPrice: 199.99, vatRate: 10 },
  ], 0.22)],
  ['it-forfettario-bollo', 'it', inputs('IT', { ...IT_SELLER, fiscalRegime: 'RF19', vatScheme: undefined }, IT_BUYER, [
    { description: 'Riparazione caldaia', quantity: 2.5, unitPrice: 48, vatRate: 0 },
  ], 0)],
  ['es-company-mixed', 'es', inputs('ES', ES_SELLER, ES_BUYER, [
    { description: 'Mano de obra', quantity: 1.333, unitPrice: 55, vatRate: 21 },
    { description: 'Reforma vivienda (tipo reducido)', quantity: 1.125, unitPrice: 199.99, vatRate: 10 },
  ], 0.21)],
  ['es-autonomo', 'es', inputs('ES', { ...ES_SELLER, businessName: 'Lucía Navarro Gómez', vatNumber: 'ES12345678Z', taxId: '12345678Z', personType: 'F' }, ES_BUYER, [
    { description: 'Pintura salón', quantity: 3, unitPrice: 35.5, vatRate: 21 },
  ], 0.21)],
];

let refused = 0;
for (const [name, fmt, inp] of cases) {
  const src = buildEInvoiceSource(inp);
  const r = fmt === 'it' ? toFatturaPA(src) : toFacturae(src);
  if (!r.ok) { console.log(`REFUSED ${name}: ${JSON.stringify(r.missing)}`); refused++; continue; }
  const xml = fmt === 'it' ? generateFatturaPAXml(r.document as any) : generateFacturaeXml(r.document as any);
  writeFileSync(`${OUT}/${name}.xml`, xml);
}
console.log(`written ${cases.length - refused}${refused ? `, refused ${refused}` : ''}`);
if (refused) process.exit(2);

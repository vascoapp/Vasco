// Signed Facturae samples for scripts/check-facturae-signature.mjs — built
// EXACTLY as the invoice screen builds them: buildEInvoiceSource → toFacturae
// → generateFacturaeXml → readSigningCertificate (the import screen's reader,
// on a .p12 the check script just made with openssl) → signFacturae.
//
// Usage: npx tsx scripts/facturae-signature-samples.ts <outDir> <pkiDir> <p12 password>
// Writes <name>.xml, expected.json (error-level value-rule codes each sample
// must produce — none here) and dss-expected.json ("valid" | "tampered").
import { readFileSync, writeFileSync } from 'fs';
import { buildEInvoiceSource } from '../src/domain/invoiceDocuments';
import { toFacturae } from '../src/integrations/einvoiceMapping';
import { generateFacturaeXml } from '../src/integrations/einvoice-es';
import { signFacturae } from '../src/integrations/facturaeSignature';
import { readSigningCertificate } from '../src/integrations/signingCertificate';

const [OUT, PKI, PASSWORD] = process.argv.slice(2);
if (!OUT || !PKI || !PASSWORD) { console.error('usage: facturae-signature-samples.ts <outDir> <pkiDir> <password>'); process.exit(2); }

type Line = { description: string; quantity: number; unitPrice: number; vatRate: number };
const inputs = (profile: Record<string, unknown>, customer: Record<string, unknown>, lines: Line[]) => ({
  invoice: { id: 'FAC-2026-0101', customerId: 'c1', customer: String(customer.name), job: 'Obra', amount: 0, status: 'sent', dueInDays: 30, sentAt: '2026-09-30T09:00:00Z' } as any,
  lines, customers: [{ id: 'c1', ...customer }] as any, businessProfile: profile as any, country: 'ES', effectiveRate: 0.21,
});

const COMPANY = { businessName: 'Fontanería Ruiz S.L.', registrationNumber: 'B12345674', address: 'Calle Mayor 1', city: 'Madrid', postcode: '28013', province: 'Madrid', country: 'ES', personType: 'J', email: 'info@ruiz.es', iban: 'ES9121000418450200051332' };
const AUTONOMO = { ...COMPANY, businessName: 'Lucía Navarro Gómez', vatNumber: 'ES12345678Z', registrationNumber: '12345678Z', personType: 'F' };
const AYUNTAMIENTO = { name: 'Ayuntamiento de Madrid', taxId: 'P2807900B', address: 'Calle Montalbán 1', city: 'Madrid', postcode: '28014', province: 'Madrid', country: 'ES',
  dir3OficinaContable: 'L01280796', dir3OrganoGestor: 'L01280796', dir3UnidadTramitadora: 'LA0002878' };
// An S-NIF State organ; the three codes need not be distinct entities in DIR3's shape.
const MINISTERIO = { name: 'Dirección General del Agua', taxId: 'S2800568D', address: 'Plaza San Juan de la Cruz 10', city: 'Madrid', postcode: '28003', province: 'Madrid', country: 'ES',
  dir3OficinaContable: 'E04921901', dir3OrganoGestor: 'E04921901', dir3UnidadTramitadora: 'E04921901' };
// Q (public-law body) WITH codes: written and signed like a FACe invoice.
const CONSORCIO = { name: 'Consorcio de Aguas', taxId: 'Q2826000H', address: 'Calle Agua 2', city: 'Madrid', postcode: '28001', province: 'Madrid', country: 'ES',
  dir3OficinaContable: 'A13002908', dir3OrganoGestor: 'A13002908', dir3UnidadTramitadora: 'A13002908' };
const B2B = { name: 'Panadería Navarro S.L.', vatId: 'ESB87654323', address: 'Calle Sol 3', city: 'Sevilla', postcode: '41001', province: 'Sevilla', country: 'ES' };

const p12 = (f: string) => readFileSync(`${PKI}/${f}`).toString('binary');
const material = (file: string, sellerNif: string) => {
  const r = readSigningCertificate(p12(file), PASSWORD, sellerNif);
  if (!r.ok) { console.error(`certificate ${file} refused: ${r.problem}`); process.exit(2); }
  return r.material;
};
const REP = material('representative.p12', 'B12345674');
const PERSON = material('autonomo.p12', '12345678Z');

type Case = { name: string; inp: ReturnType<typeof inputs>; mat: typeof REP; tamper?: boolean };
const cases: Case[] = [
  { name: 'es-b2g-local-signed', mat: REP, inp: inputs(COMPANY, AYUNTAMIENTO, [
    { description: 'Mantenimiento fontanería — colegio público', quantity: 1.333, unitPrice: 55, vatRate: 21 },
    { description: 'Reforma aseos (tipo reducido)', quantity: 1.125, unitPrice: 199.99, vatRate: 10 },
  ]) },
  { name: 'es-b2g-state-autonomo-signed', mat: PERSON, inp: inputs(AUTONOMO, MINISTERIO, [
    { description: 'Pintura sala "A" & pasillo <planta 2>', quantity: 3, unitPrice: 35.5, vatRate: 21 },
  ]) },
  { name: 'es-b2g-q-signed', mat: REP, inp: inputs(COMPANY, CONSORCIO, [
    { description: 'Revisión instalación', quantity: 1, unitPrice: 250, vatRate: 21 },
  ]) },
  { name: 'es-b2b-signed', mat: REP, inp: inputs(COMPANY, B2B, [
    { description: 'Reparación horno', quantity: 0.333, unitPrice: 60, vatRate: 21 },
    { description: 'Descuento', quantity: -1, unitPrice: 10, vatRate: 21 },
  ]) },
  // MUST fail the validator: one character of the invoice changed after signing.
  { name: 'es-b2g-tampered', mat: REP, tamper: true, inp: inputs(COMPANY, AYUNTAMIENTO, [
    { description: 'Mantenimiento', quantity: 1, unitPrice: 500, vatRate: 21 },
  ]) },
];

const expected: Record<string, string[]> = {};
const dss: Record<string, 'valid' | 'tampered'> = {};
for (const c of cases) {
  const m = toFacturae(buildEInvoiceSource(c.inp));
  if (!m.ok) { console.error(`REFUSED ${c.name}: ${JSON.stringify(m.missing)}`); process.exit(2); }
  let xml = signFacturae(generateFacturaeXml(m.document), c.mat);
  if (c.tamper) {
    const before = xml;
    xml = xml.replace('<ItemDescription>Mantenimiento</ItemDescription>', '<ItemDescription>Mantenimiento.</ItemDescription>');
    if (xml === before) { console.error('tamper target not found'); process.exit(2); }
  }
  writeFileSync(`${OUT}/${c.name}.xml`, xml);
  expected[`${c.name}.xml`] = [];
  dss[`${c.name}.xml`] = c.tamper ? 'tampered' : 'valid';
}
writeFileSync(`${OUT}/expected.json`, JSON.stringify(expected, null, 2));
writeFileSync(`${OUT}/dss-expected.json`, JSON.stringify(dss, null, 2));
console.log(`written ${cases.length} signed samples`);

// Sample Italian (FatturaPA) and Spanish (Facturae) invoices for the official
// schema check (npm run check:einvoice-schemas) and the SDI / FACe value rules
// (npm run check:einvoice-rules) — built EXACTLY as the invoice screen builds
// them: buildEInvoiceSource → toFatturaPA / toFacturae → generator. A mapper
// refusal is a failure here: these inputs are complete.
//
// Profiles use the keys the business-settings form actually writes: for Italy
// `registrationNumber` is the "Camera di Commercio" (REA) field, for Spain the
// NIF/CIF field (2026-10-01: the REA reached <CodiceFiscale>).
//
// `expected.json` (written beside the files) lists, per sample, the
// error-level rule codes that sample MUST produce — the refusals. Every other
// sample must produce none.
import { writeFileSync } from 'fs';
import { buildEInvoiceSource } from '../src/domain/invoiceDocuments';
import { toFatturaPA, toFacturae } from '../src/integrations/einvoiceMapping';
import { generateFatturaPAXml } from '../src/integrations/einvoice-it';
import { generateFacturaeXml } from '../src/integrations/einvoice-es';
import { signFacturae, type SigningMaterial } from '../src/integrations/facturaeSignature';
import * as forge from 'node-forge';
import type { VatNature } from '../src/domain/vatNature';

const OUT = process.argv[2];
type Line = { description: string; quantity: number; unitPrice: number; vatRate: number; vatNature?: VatNature };
const inputs = (country: string, profile: Record<string, unknown>, customer: Record<string, unknown>, lines: Line[], rate: number) => ({
  invoice: { id: `${country}-2026-0101`, customerId: 'c1', customer: String(customer.name), job: 'Lavori', amount: 0, status: 'sent', dueInDays: 30, sentAt: '2026-09-30T09:00:00Z' } as any,
  lines, customers: [{ id: 'c1', ...customer }] as any, businessProfile: profile as any, country, effectiveRate: rate,
});

const IT_SELLER = { businessName: 'Idraulica Bianchi S.r.l.', vatNumber: 'IT01234567897', registrationNumber: 'REA MI-1234567', address: 'Via Roma 10', city: 'Milano', postcode: '20121', province: 'MI', country: 'IT', fiscalRegime: 'RF01', email: 'info@bianchi.it', phone: '+39 02 1234567', iban: 'IT60X0542811101000000123456' };
const IT_BUYER = { name: 'Panificio Bruno S.r.l.', vatId: 'IT09876543217', address: 'Corso Italia 5', city: 'Torino', postcode: '10121', province: 'TO', country: 'IT', einvoiceRouting: 'ABCDEF1' };
const IT_CONSUMER = { name: 'Mario Rossi', taxId: 'rssmra80a01h501u', address: 'Via Verdi 3', city: 'Roma', postcode: '00184', province: 'RM', country: 'IT', einvoiceRouting: '0000000' };
const ES_SELLER = { businessName: 'Fontanería Ruiz S.L.', registrationNumber: 'B12345674', address: 'Calle Mayor 1', city: 'Madrid', postcode: '28013', province: 'Madrid', country: 'ES', personType: 'J', email: 'info@ruiz.es', iban: 'ES9121000418450200051332' };
const ES_BUYER = { name: 'Panadería Navarro S.L.', vatId: 'ESB87654323', taxId: 'B87654323', address: 'Calle Sol 3', city: 'Sevilla', postcode: '41001', province: 'Sevilla', country: 'ES' };

const ES_PUBLIC_BODY = { ...ES_BUYER, name: 'Ayuntamiento de Madrid', vatId: undefined, taxId: 'P2807900B',
  dir3OficinaContable: 'L01280796', dir3OrganoGestor: 'L01280796', dir3UnidadTramitadora: 'LA0002878' };

type Case = { name: string; fmt: 'it' | 'es'; inp: ReturnType<typeof inputs>; expect?: string[]; sign?: boolean };
const cases: Case[] = [
  { name: 'it-b2b-mixed', fmt: 'it', inp: inputs('IT', IT_SELLER, IT_BUYER, [
    { description: 'Manodopera', quantity: 1.333, unitPrice: 55, vatRate: 22 },
    { description: 'Tubo rame 15 mm', quantity: 2.5, unitPrice: 12.99, vatRate: 22 },
    { description: 'Ristrutturazione bagno (aliquota agevolata)', quantity: 1.125, unitPrice: 199.99, vatRate: 10 },
  ], 0.22) },
  { name: 'it-forfettario-bollo', fmt: 'it', inp: inputs('IT', { ...IT_SELLER, fiscalRegime: 'RF19' }, IT_BUYER, [
    { description: 'Riparazione caldaia', quantity: 2.5, unitPrice: 48, vatRate: 0 },
  ], 0) },
  // € 77,47 exactly: NOT above the threshold — no bollo.
  { name: 'it-forfettario-77-47', fmt: 'it', inp: inputs('IT', { ...IT_SELLER, fiscalRegime: 'RF19' }, IT_BUYER, [
    { description: 'Sopralluogo', quantity: 1, unitPrice: 77.47, vatRate: 0 },
  ], 0) },
  // A consumer: codice fiscale only, 0000000, iPhone typography in the text.
  { name: 'it-consumer-typography', fmt: 'it', inp: inputs('IT', IT_SELLER, IT_CONSUMER, [
    { description: 'Sostituzione dell’impianto – bagno “Deluxe”…', quantity: 3, unitPrice: 12.345, vatRate: 10 },
  ], 0.1) },
  // A PEC instead of a code; four rates with sub-cent quantities and a negative (credit) line.
  { name: 'it-pec-rates-credit', fmt: 'it', inp: inputs('IT', IT_SELLER, { ...IT_BUYER, einvoiceRouting: undefined, einvoiceEmail: 'panificio@pec.it' }, [
    { description: 'Manodopera', quantity: 0.333, unitPrice: 47.5, vatRate: 22 },
    { description: 'Materiale', quantity: 7.125, unitPrice: 3.33, vatRate: 10 },
    { description: 'Prodotto agevolato', quantity: 1.5, unitPrice: 9.99, vatRate: 4 },
    { description: 'Storno acconto', quantity: -1, unitPrice: 20, vatRate: 22 },
  ], 0.22) },
  // Ordinary regime with a 0 % line whose nature the contractor stated: an
  // expense paid in the customer's name is outside IVA (N1, art. 15).
  { name: 'it-ordinary-zero-line', fmt: 'it', inp: inputs('IT', IT_SELLER, IT_BUYER, [
    { description: 'Lavori', quantity: 1, unitPrice: 100, vatRate: 22 },
    { description: 'Anticipazione spese', quantity: 1, unitPrice: 15.5, vatRate: 0, vatNature: 'N1' },
  ], 0.22) },
  // Reverse charge (2026-10-03): a building subcontract (N6.3) and a
  // completion service (N6.7) beside a 22 % line and an N1 expense — four
  // DatiRiepilogo (00443/00444), each 0 % one with its RiferimentoNormativo,
  // and no marca da bollo (reverse charge IS subject to IVA) although the 0 %
  // amount is far above € 77,47.
  { name: 'it-reverse-charge-edilizia', fmt: 'it', inp: inputs('IT', IT_SELLER, IT_BUYER, [
    { description: 'Subappalto impianto idraulico cantiere Via Po', quantity: 1, unitPrice: 4250, vatRate: 0, vatNature: 'N6.3' },
    { description: 'Completamento bagni', quantity: 12.5, unitPrice: 38.4, vatRate: 0, vatNature: 'N6.7' },
    { description: 'Noleggio attrezzatura', quantity: 1, unitPrice: 120, vatRate: 22 },
    { description: 'Diritti di segreteria anticipati', quantity: 1, unitPrice: 16, vatRate: 0, vatNature: 'N1' },
  ], 0.22) },
  // Forfettario: an unstated 0 % line is the franchise (N2.2), a stated N1 stays N1.
  { name: 'it-forfettario-n1', fmt: 'it', inp: inputs('IT', { ...IT_SELLER, fiscalRegime: 'RF19' }, IT_BUYER, [
    { description: 'Riparazione caldaia', quantity: 1, unitPrice: 60, vatRate: 0 },
    { description: 'Marca da bollo pratica comunale', quantity: 1, unitPrice: 16, vatRate: 0, vatNature: 'N1' },
  ], 0) },
  // REFUSALS — the file must not be handed over.
  { name: 'it-refuse-pa-office-code', fmt: 'it', expect: ['00427'], inp: inputs('IT', IT_SELLER, { ...IT_BUYER, einvoiceRouting: 'UFABCD' }, [
    { description: 'Lavori', quantity: 1, unitPrice: 100, vatRate: 22 },
  ], 0.22) },
  { name: 'it-refuse-bad-partita-iva', fmt: 'it', expect: ['00305'], inp: inputs('IT', IT_SELLER, { ...IT_BUYER, vatId: 'IT09876543210' }, [
    { description: 'Lavori', quantity: 1, unitPrice: 100, vatRate: 22 },
  ], 0.22) },
  { name: 'it-refuse-emoji', fmt: 'it', expect: ['00200'], inp: inputs('IT', IT_SELLER, IT_BUYER, [
    { description: 'Lavori 👍', quantity: 1, unitPrice: 100, vatRate: 22 },
  ], 0.22) },
  { name: 'es-company-mixed', fmt: 'es', inp: inputs('ES', ES_SELLER, ES_BUYER, [
    { description: 'Mano de obra', quantity: 1.333, unitPrice: 55, vatRate: 21 },
    { description: 'Reforma vivienda (tipo reducido)', quantity: 1.125, unitPrice: 199.99, vatRate: 10 },
  ], 0.21) },
  { name: 'es-autonomo', fmt: 'es', inp: inputs('ES', { ...ES_SELLER, businessName: 'Lucía Navarro Gómez', vatNumber: 'ES12345678Z', registrationNumber: '12345678Z', personType: 'F' }, ES_BUYER, [
    { description: 'Pintura salón', quantity: 3, unitPrice: 35.5, vatRate: 21 },
  ], 0.21) },
  // NIE holder and an ES-prefixed DNI: both natural persons (were filed as companies).
  { name: 'es-nie-buyer', fmt: 'es', inp: inputs('ES', ES_SELLER, { ...ES_BUYER, name: 'Anna Müller Schmidt', vatId: undefined, taxId: 'X1234567L' }, [
    { description: 'Reparación', quantity: 0.333, unitPrice: 60, vatRate: 21 },
    { description: 'Material', quantity: 4, unitPrice: 2.995, vatRate: 4 },
    { description: 'Descuento', quantity: -1, unitPrice: 10, vatRate: 21 },
  ], 0.21) },
  { name: 'es-dni-prefixed-buyer', fmt: 'es', inp: inputs('ES', ES_SELLER, { ...ES_BUYER, name: 'Javier Ruiz Pérez', vatId: 'ES12345678Z', taxId: undefined }, [
    // An invoice without lines gets one line synthesised from its gross: a
    // unit price with many decimals (invoiceLinesFor).
    { description: 'Trabajos', quantity: 1, unitPrice: 1000 / 1.21, vatRate: 21 },
  ], 0.21) },
  // REFUSAL — a public body (NIF P…) receives through FACe: DIR3 codes present,
  // but UNSIGNED → the value rules refuse (HAP II.2).
  { name: 'es-refuse-public-body-unsigned', fmt: 'es', expect: ['HAP1650-II.2'], inp: inputs('ES', ES_SELLER, ES_PUBLIC_BODY, [
    { description: 'Mantenimiento', quantity: 1, unitPrice: 500, vatRate: 21 },
  ], 0.21) },
  // FACe, SIGNED (XAdES-EPES, Facturae policy v3.1) with DIR3 centres — the
  // schema must accept ds:Signature (xmldsig resolved from the local copy).
  { name: 'es-b2g-signed', fmt: 'es', sign: true, inp: inputs('ES', ES_SELLER, ES_PUBLIC_BODY, [
    { description: 'Mantenimiento fontanería', quantity: 1.333, unitPrice: 55, vatRate: 21 },
    { description: 'Reforma aseos', quantity: 1, unitPrice: 300, vatRate: 10 },
  ], 0.21) },
  // A Q body (may be outside FACe) unsigned and without DIR3: warnings, not refused.
  { name: 'es-q-unsigned', fmt: 'es', inp: inputs('ES', ES_SELLER, { ...ES_BUYER, name: 'Cámara de Comercio', vatId: undefined, taxId: 'Q2826000H' }, [
    { description: 'Revisión', quantity: 1, unitPrice: 120, vatRate: 21 },
  ], 0.21) },
];
// The MAPPER refuses these (asks for the field before any file exists).
const mapperRefusals: Array<{ name: string; fmt?: 'it' | 'es'; inp: ReturnType<typeof inputs>; missing: string[] }> = [
  // Ordinary regime, a 0 % line with no stated nature: reverse charge, exempt
  // or out of scope are different invoices in law — asked for, never guessed.
  // A DRAFT must choose; an issued invoice keeps the old N2.2 + a warning
  // (its lines can no longer be edited — review 2026-10-03).
  { name: 'it-ordinary-zero-line-without-nature', fmt: 'it', missing: ['invoices.vatNatureMissing'],
    inp: (() => { const i = inputs('IT', IT_SELLER, IT_BUYER, [
      { description: 'Lavori', quantity: 1, unitPrice: 100, vatRate: 22 },
      { description: 'Subappalto', quantity: 1, unitPrice: 900, vatRate: 0 },
    ], 0.22); return { ...i, invoice: { ...(i as any).invoice, status: 'draft' } } as any; })() },
  // A forfettario does not apply reverse charge as the supplier.
  { name: 'it-forfettario-reverse-charge', fmt: 'it', missing: ['invoices.vatNatureNotForRegime'],
    inp: inputs('IT', { ...IT_SELLER, fiscalRegime: 'RF19' }, IT_BUYER, [
      { description: 'Subappalto', quantity: 1, unitPrice: 900, vatRate: 0, vatNature: 'N6.3' },
    ], 0) },
  { name: 'es-public-body-without-dir3', missing: ['customer.dir3OficinaContable', 'customer.dir3OrganoGestor', 'customer.dir3UnidadTramitadora'],
    inp: inputs('ES', ES_SELLER, { ...ES_PUBLIC_BODY, dir3OficinaContable: undefined, dir3OrganoGestor: undefined, dir3UnidadTramitadora: undefined }, [
      { description: 'Mantenimiento', quantity: 1, unitPrice: 500, vatRate: 21 },
    ], 0.21) },
  { name: 'es-public-body-bad-dir3', missing: ['customer.dir3UnidadTramitadora'],
    inp: inputs('ES', ES_SELLER, { ...ES_PUBLIC_BODY, dir3UnidadTramitadora: 'LA00028' }, [
      { description: 'Mantenimiento', quantity: 1, unitPrice: 500, vatRate: 21 },
    ], 0.21) },
];

/**
 * A throwaway signing certificate made in-process (node-forge), FNMT-shaped
 * (serialNumber IDCES-…, organizationIdentifier VATES-<the seller's CIF>).
 * Only to put a REAL XAdES signature in front of the XSD here; the signature
 * itself is judged by EU DSS in npm run check:facturae-signature.
 */
function throwawayMaterial(): SigningMaterial {
  const keys = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 });
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date(Date.now() - 60_000);
  cert.validity.notAfter = new Date(Date.now() + 86_400_000);
  const name = [{ shortName: 'C', value: 'ES' }, { type: '2.5.4.97', value: 'VATES-B12345674' }, { type: '2.5.4.5', value: 'IDCES-12345678Z' }, { shortName: 'CN', value: 'TEST ONLY 12345678Z (R: B12345674)' }];
  cert.setSubject(name);
  cert.setIssuer(name);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return {
    privateKeyPem: forge.pki.privateKeyToPem(keys.privateKey),
    certificatesDer: [forge.util.encode64(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes())],
  };
}

let refused = 0;
const expected: Record<string, string[]> = {};
let material: SigningMaterial | undefined;
for (const { name, fmt, inp, expect, sign } of cases) {
  const src = buildEInvoiceSource(inp);
  const r = fmt === 'it' ? toFatturaPA(src) : toFacturae(src);
  if (!r.ok) { console.log(`REFUSED ${name}: ${JSON.stringify(r.missing)}`); refused++; continue; }
  let xml = fmt === 'it' ? generateFatturaPAXml(r.document as any) : generateFacturaeXml(r.document as any);
  if (sign) xml = signFacturae(xml, (material ??= throwawayMaterial()));
  writeFileSync(`${OUT}/${name}.xml`, xml);
  if (expect) expected[`${name}.xml`] = expect;
}
for (const { name, fmt, inp, missing } of mapperRefusals) {
  const r = fmt === 'it' ? toFatturaPA(buildEInvoiceSource(inp)) : toFacturae(buildEInvoiceSource(inp));
  const got = r.ok ? [] : r.missing.map((m) => m.key).sort();
  if (got.join() !== [...missing].sort().join()) {
    console.log(`MAPPER ${name}: expected refusal [${missing.join(', ')}], got ${r.ok ? 'a document' : `[${got.join(', ')}]`}`);
    refused++;
  } else console.log(`refused by the mapper as expected: ${name} [${got.join(', ')}]`);
}
writeFileSync(`${OUT}/expected.json`, JSON.stringify(expected, null, 2));
console.log(`written ${cases.length} cases${refused ? `, ${refused} not as expected` : ''}`);
if (refused) process.exit(2);

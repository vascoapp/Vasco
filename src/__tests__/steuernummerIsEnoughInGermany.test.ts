/**
 * A German sole trader invoices under the Steuernummer alone (§14 Abs. 4 Nr. 2
 * UStG: Steuernummer OR USt-IdNr; no Handelsregister number for a sole trader).
 *
 * German walk, 2026-10-06: the send gate demanded "Handelsregisternummer (HRB)"
 * AND a USt-IdNr, so a Steuernummer-only Handwerker could send no invoice at
 * all — and the Steuernummer reached no e-invoice. Now it is BT-32 (and BT-29,
 * which BR-CO-26 needs when there is no BT-30/BT-31); KoSIT accepts both
 * shapes (npm run check:kosit: steuernummer-only, kleinunternehmer-steuernummer).
 */
import { checkInvoiceReadiness } from '../utils/businessProfileValidation';
import { buildEInvoiceData } from '../domain/invoiceDocuments';
import { generateXRechnungXML, generateCIIXML } from '../integrations/einvoice';

const de = {
  country: 'DE', businessName: 'Sanitär Weber', address: 'Hauptstraße 12', postcode: '50667', city: 'Köln',
  phone: '+49 221 1234567', email: 'rechnung@weber.test', iban: 'DE89370400440532013000',
} as any;

describe('the send gate', () => {
  it('a Steuernummer alone is enough', () => {
    const r = checkInvoiceReadiness({ ...de, kvkNumber: '217/5814/0815' });
    expect(r.missing).not.toContain('profile.vatOrSteuernummer');
    expect(r.missing).not.toContain('profile.registrationHrb');
  });
  it('a USt-IdNr alone is enough', () => {
    expect(checkInvoiceReadiness({ ...de, vatNumber: 'DE811907980' }).missing).not.toContain('profile.vatOrSteuernummer');
  });
  it('neither: asks for "USt-IdNr or Steuernummer", never for an HRB', () => {
    const r = checkInvoiceReadiness({ ...de });
    expect(r.missing).toContain('profile.vatOrSteuernummer');
    expect(r.missing).not.toContain('profile.registrationHrb');
  });
});

describe('the e-invoice carries the Steuernummer', () => {
  const inputs = (bp: any) => ({
    businessProfile: bp, country: 'DE', effectiveRate: 0.19, customers: [],
    invoice: { id: 'RE-1', customer: 'Bäckerei', amount: 225.51, status: 'draft', dueDate: '2026-10-20' },
    lines: [{ id: 'l1', description: 'Heizungswartung', quantity: 1, unitPrice: 189.5, vatRate: 19 }],
  } as any);

  it('Steuernummer only: BT-32 (FC) and BT-29, no empty VAT block', () => {
    const d = buildEInvoiceData(inputs({ ...de, kvkNumber: '217/5814/0815' }));
    expect(d.sellerTaxNumber).toBe('217/5814/0815');
    const ubl = generateXRechnungXML(d);
    expect(ubl).toMatch(/<cbc:CompanyID>217\/5814\/0815<\/cbc:CompanyID><cac:TaxScheme><cbc:ID>FC<\/cbc:ID>/);
    expect(ubl).toMatch(/<cac:PartyIdentification><cbc:ID>217\/5814\/0815<\/cbc:ID>/);
    expect(ubl).not.toMatch(/<cbc:CompanyID><\/cbc:CompanyID>/);
    const cii = generateCIIXML(d);
    expect(cii).toMatch(/<ram:ID schemeID="FC">217\/5814\/0815<\/ram:ID>/);
  });

  it('with a USt-IdNr the seller identifier is unchanged (control)', () => {
    const d = buildEInvoiceData(inputs({ ...de, vatNumber: 'DE811907980', kvkNumber: '217/5814/0815' }));
    const ubl = generateXRechnungXML(d);
    expect(ubl).toMatch(/<cbc:ID>VAT<\/cbc:ID>/);
    expect(ubl).not.toMatch(/<cac:PartyIdentification>/);
  });

  it('outside Germany the field (a KvK number in NL) is not a Steuernummer', () => {
    const d = buildEInvoiceData({ ...inputs({ ...de, country: 'NL', kvkNumber: '12345678' }), country: 'NL' });
    expect(d.sellerTaxNumber).toBeUndefined();
  });
});

describe('an HRB copied into the Steuernummer slot by older onboarding', () => {
  it('is neither a Steuernummer on the e-invoice nor enough for the gate', () => {
    const { germanSteuernummer } = require('../utils/validation');
    expect(germanSteuernummer({ kvkNumber: 'HRB 12345' })).toBeUndefined();
    expect(germanSteuernummer({ kvkNumber: 'K-123', registrationNumber: 'K-123' })).toBeUndefined();
    expect(germanSteuernummer({ kvkNumber: ' 217/5814/0815 ' })).toBe('217/5814/0815');
    expect(germanSteuernummer({ kvkNumber: '2181508150815' })).toBe('2181508150815');
    // Review 2026-10-06: a name filter let these through.
    for (const v of ['HRB12345', 'HR B 1234', 'Amtsgericht Köln HRB 1234', 'DE811907980', '12345']) {
      expect(germanSteuernummer({ kvkNumber: v })).toBeUndefined();
    }
    expect(checkInvoiceReadiness({ ...de, kvkNumber: 'HRB 12345' }).missing).toContain('profile.vatOrSteuernummer');
  });
});

it('the profile counts as complete with the Steuernummer in Germany (same rule as the gate)', () => {
  const fs = require('fs'); const path = require('path');
  const { stripComments } = require('../utils/stripComments');
  const src: string = stripComments(fs.readFileSync(path.join(__dirname, '../state/AppState.tsx'), 'utf8'));
  expect(src).toMatch(/merged\.country === 'DE'\s*\?\s*!!\(merged\.vatNumber \|\| germanSteuernummer\(merged\)\)/);
});

describe('Spain: a bare NIF passes the send gate (ES walk, 2026-10-06)', () => {
  const es = { country: 'ES', businessName: 'Fontanería García', address: 'Calle Mayor 12', postcode: '28013', city: 'Madrid', email: 'a@b.es', phone: '+34 600 000 000', iban: 'ES9121000418450200051332' } as any;
  it('bare DNI-NIF with a correct control letter: ready', () => {
    const r = checkInvoiceReadiness({ ...es, vatNumber: '12345678Z' });
    expect([...r.missing, ...r.invalid]).toEqual([]);
  });
  it('ES-prefixed is still fine; a wrong control letter is still refused', () => {
    expect(checkInvoiceReadiness({ ...es, vatNumber: 'ES12345678Z' }).invalid).toEqual([]);
    expect(checkInvoiceReadiness({ ...es, vatNumber: '12345678A' }).invalid.length).toBeGreaterThan(0);
  });
});

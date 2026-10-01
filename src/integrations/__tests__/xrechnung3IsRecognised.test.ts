/**
 * @jest-environment node
 */
// The official KoSIT validator rejected EVERY XRechnung we generated
// (2026-10-01): BT-24 carried the 2.x-era `urn:xoev-de:kosit:standard:…`
// form, so no XRechnung 3.0 scenario matched; once it did, BT-23 (business
// process), BT-34 and BT-49 (seller / buyer electronic address) were missing.
// Our own validator passed all of it. `npm run check:kosit` runs the real
// validator; this pins the same facts without Java.
import fs from 'fs';
import path from 'path';
import { DOMParser } from '@xmldom/xmldom';
import { generateXRechnungXML, XRECHNUNG_3_CUSTOMIZATION_ID, XRECHNUNG_PROFILE_ID, type EInvoiceData } from '../einvoice';
import { validateXmlString } from '../../../admin/src/lib/einvoice-validator';
import { stripComments } from '../../utils/stripComments';

const parse = (s: string) => new DOMParser().parseFromString(s, 'text/xml') as unknown as Document;
const base: EInvoiceData = {
  sellerName: 'Sanitär Bergmann GmbH', sellerAddress: 'Hauptstraße 14', sellerVatId: 'DE123456789',
  sellerCity: 'Köln', sellerPostalCode: '50667', sellerContactName: 'Thomas Bergmann',
  sellerPhone: '+49 221 1234567', sellerEmail: 'buero@bergmann-sanitaer.de', sellerVatExempt: false,
  buyerName: 'Bäckerei Lindner GmbH', buyerAddress: 'Marktplatz 3', buyerCity: 'Köln', buyerPostalCode: '50676',
  buyerEmail: 'rechnung@baeckerei-lindner.de', buyerReference: 'RE-1',
  invoiceNumber: 'RE-1', invoiceDate: '2026-09-30', dueDate: '2026-10-30', currency: 'EUR',
  lineItems: [{ description: 'Wartung', quantity: 1, unitCode: 'stuk', unitPrice: 100, vatRate: 19, vatAmount: 19, lineTotal: 100 }],
  totalNet: 100, totalVat: 19, totalGross: 119,
};

it('declares XRechnung 3.0 the way KoSIT matches it (BT-24) and the business process (BT-23)', () => {
  const xml = generateXRechnungXML(base);
  expect(XRECHNUNG_3_CUSTOMIZATION_ID).toBe('urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0');
  expect(xml).toContain(`<cbc:CustomizationID>${XRECHNUNG_3_CUSTOMIZATION_ID}</cbc:CustomizationID>`);
  expect(xml).toContain(`<cbc:ProfileID>${XRECHNUNG_PROFILE_ID}</cbc:ProfileID>`);
  expect(xml).not.toContain('xoev-de:kosit:standard');
});

it('carries the seller and buyer electronic addresses (BT-34 / BT-49)', () => {
  const xml = generateXRechnungXML(base);
  expect(xml).toContain('<cbc:EndpointID schemeID="EM">buero@bergmann-sanitaer.de</cbc:EndpointID>');
  expect(xml).toContain('<cbc:EndpointID schemeID="EM">rechnung@baeckerei-lindner.de</cbc:EndpointID>');
  // A public buyer is addressed by its Leitweg-ID, not an email.
  const b2g = generateXRechnungXML({ ...base, leitwegId: '04011000-1234512345-06' });
  expect(b2g).toContain('<cbc:EndpointID schemeID="0204">04011000-1234512345-06</cbc:EndpointID>');
});

it('our validator now rejects the stale identifier it used to pass', () => {
  const stale = generateXRechnungXML(base).replace(XRECHNUNG_3_CUSTOMIZATION_ID, 'urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0');
  const r = validateXmlString(stale, parse);
  expect(r.findings.filter((f) => f.severity === 'error').map((f) => f.rule)).toContain('BT-24');
});

it('the invoice screen refuses an XRechnung with no buyer address', () => {
  const src = stripComments(fs.readFileSync(path.resolve(__dirname, '../../../app/invoices/[id].tsx'), 'utf8'));
  expect(src).toMatch(/if \(format === 'XRechnung' && !data\.leitwegId && !data\.buyerEmail\) \{/);
});

it('the builder hands the customer\'s email and the delivery date to the XML', () => {
  const { buildEInvoiceData } = require('../../domain/invoiceDocuments');
  const data = buildEInvoiceData({
    invoice: { id: 'RE-2026-0101', customerId: 'c1', customer: 'Bäckerei Lindner GmbH', job: 'Wartung', amount: 119, status: 'draft', dueInDays: 14, deliveryDate: '2026-09-28' },
    lines: [{ description: 'Wartung', quantity: 1, unitPrice: 100, vatRate: 19 }],
    customers: [{ id: 'c1', name: 'Bäckerei Lindner GmbH', email: 'rechnung@baeckerei-lindner.de', city: 'Köln', postcode: '50676' }],
    businessProfile: { businessName: 'Sanitär Bergmann GmbH', email: 'buero@bergmann-sanitaer.de', country: 'DE', vatScheme: 'standard' },
    country: 'DE', effectiveRate: 0.19,
  });
  const xml = generateXRechnungXML(data);
  expect(xml).toContain('<cbc:EndpointID schemeID="EM">rechnung@baeckerei-lindner.de</cbc:EndpointID>');
  expect(xml).toContain('<cbc:ActualDeliveryDate>2026-09-28</cbc:ActualDeliveryDate>');
});

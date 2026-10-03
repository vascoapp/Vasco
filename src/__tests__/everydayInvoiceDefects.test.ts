// The nine defects the everyday matrix found on 2026-10-03 (npm run matrix —
// real screens → official validators). Each is also a matrix check; these pin
// the cause in the normal suite so a regression is caught without the matrix.
let captured = '';
jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(async ({ html }: { html: string }) => { captured = html; return { uri: 'file://x.pdf' }; }),
}));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(async () => false), shareAsync: jest.fn() }));

import { renderInvoicePdfFile, sellerAddressLine, registrationParts } from '../services/invoicePdfService';
import { normalizeSellerVatId, isValidSellerVatId } from '../utils/validation';
import { buildEInvoiceData, buildEInvoiceSource } from '../domain/invoiceDocuments';
import { toFatturaPA } from '../integrations/einvoiceMapping';

const text = () => captured.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, '\n');
const invoice = (over: Record<string, unknown> = {}) => ({
  id: 'i1', invoiceNumber: 'I0001', jobId: 'j1', customerId: 'c1',
  customerName: 'Anna Schmidt', customerAddress: 'Kastanienallee 7, 10435 Berlin', issueDate: new Date('2026-10-03'),
  dueDate: new Date('2026-10-17'), status: 'draft',
  lineItems: [{ description: 'Arbeitszeit', quantity: 6, unitPrice: 68, vatRate: 19, total: 408 }],
  subtotal: 408, vatAmount: 77.52, total: 485.52, paidAmount: 0, payments: [], reminders: [],
  ...over,
}) as any;
const DE = { businessName: 'Haustechnik Weber', address: 'Hauptstraße 12', postcode: '10115', city: 'Berlin', country: 'DE' as const, language: 'de', vatNumber: 'DE136695976', kvkNumber: '21/815/08150' };

describe('the printed invoice', () => {
  it('#1 names the seller WITH postcode and city — and never twice', () => {
    expect(sellerAddressLine(DE)).toBe('Hauptstraße 12, 10115 Berlin');
    // Already complete in the street line: not repeated.
    expect(sellerAddressLine({ address: 'Keizersgracht 100, 1015 CX Amsterdam', postcode: '1015 CX', city: 'Amsterdam', country: 'NL' })).toBe('Keizersgracht 100, 1015 CX Amsterdam');
    // A city inside a STREET name must not cost the address its town (review).
    expect(sellerAddressLine({ address: 'Berliner Straße 12', postcode: '10715', city: 'Berlin', country: 'DE' })).toBe('Berliner Straße 12, 10715 Berlin');
    expect(sellerAddressLine({ address: 'Via Roma 3', postcode: '00184', city: 'Roma', country: 'IT' })).toBe('Via Roma 3, 00184 Roma');
    expect(sellerAddressLine({ address: '10 High Street', postcode: 'SW1A 1AA', city: 'London', country: 'UK' })).toBe('10 High Street, London SW1A 1AA');
  });

  it('#1 + #2 + #4: a German draft — full address, no draft stamp, Steuernummer under its name', async () => {
    await renderInvoicePdfFile(invoice(), DE);
    const t = text();
    expect(t).toContain('Hauptstraße 12, 10115 Berlin');
    expect(t).not.toMatch(/\bENTWURF\b/);
    expect(t).toContain('Steuernummer: 21/815/08150');
    expect(t).not.toMatch(/HRB\s*:?\s*21\/815/);
    // No service date was given, so none is CLAIMED ("entspricht dem
    // Rechnungsdatum" was false for work done earlier — review). The invoice
    // screen asks for it before a German invoice leaves.
    expect(t).not.toContain('Leistungsdatum');
  });

  it('#2 a draft whose number is still the offline placeholder keeps its stamp — it is not final', async () => {
    await renderInvoicePdfFile(invoice({ invoiceNumber: 'I-OFF-3A9F01' }), DE);
    expect(text()).toMatch(/\bENTWURF\b/);
  });

  it('#5 Germany prints the date of service even when it is the invoice date', async () => {
    await renderInvoicePdfFile(invoice({ deliveryDate: new Date('2026-10-03') }), DE);
    expect(text()).toMatch(/Leistungsdatum\s*\n+\s*3\. Oktober 2026/);
    // …while the Netherlands keeps its rule (only when it differs).
    await renderInvoicePdfFile(invoice({ deliveryDate: new Date('2026-10-03') }), { ...DE, country: 'NL', language: 'nl' });
    expect(text()).not.toContain('Leveringsdatum');
  });

  it('#2 a paid invoice still says so — only the draft stamp is gone', async () => {
    await renderInvoicePdfFile(invoice({ status: 'paid' }), DE);
    expect(text()).toContain('BEZAHLT');
  });

  it('#4 a real HRB entry is still printed, an onboarding copy is not taken for a Steuernummer', () => {
    expect(registrationParts({ country: 'DE', registrationNumber: 'HRB 84521', kvkNumber: '21/815/08150' })).toEqual(['HRB 84521', 'Steuernummer: 21/815/08150']);
    expect(registrationParts({ country: 'DE', registrationNumber: 'HRB 84521', kvkNumber: 'HRB 84521' })).toEqual(['HRB 84521']);
    expect(registrationParts({ country: 'NL', kvkNumber: '12345678' })).toEqual(['KvK: 12345678']);
    // FR/UK/IT: business settings edits registrationNumber; kvkNumber is onboarding's copy.
    expect(registrationParts({ country: 'FR', kvkNumber: '732 829 320 00075', registrationNumber: '732 829 320 00074' })).toEqual(['SIRET: 732 829 320 00074']);
  });

  it('#9 the buyer\'s codice fiscale / partita IVA are printed under the buyer', async () => {
    await renderInvoicePdfFile(invoice({ customerName: 'Giulia Bianco', customerTaxId: 'BNCGLI85M41H501Y' }), { ...DE, country: 'IT', language: 'it', vatNumber: 'IT01234567897' });
    expect(text()).toContain('C.F.: BNCGLI85M41H501Y');
    await renderInvoicePdfFile(invoice({ customerName: 'Edilizia Bianchi S.r.l.', customerVatId: 'IT07654321095' }), { ...DE, country: 'IT', language: 'it', vatNumber: 'IT01234567897' });
    expect(text()).toContain('IT07654321095');
  });
});

describe('identifiers written the local way (#6, #7)', () => {
  it('a bare partita IVA / NIF is accepted and stored canonical; a wrong check digit is not', () => {
    expect(normalizeSellerVatId('01234567897', 'IT')).toBe('IT01234567897');
    expect(normalizeSellerVatId('12345678Z', 'ES')).toBe('ES12345678Z');
    expect(normalizeSellerVatId('1234567L', 'ES')).toBe('ES01234567L'); // a 7-digit DNI, padded
    expect(normalizeSellerVatId('de 136 695 976', 'DE')).toBe('DE136695976');
    expect(isValidSellerVatId('01234567896', 'IT')).toBe(false);
    expect(isValidSellerVatId('12345678A', 'ES')).toBe(false);
    // A condominio's codice fiscale is not a partita IVA.
    expect(normalizeSellerVatId('93012345679', 'IT')).toBe('93012345679');
  });
});

describe('e-invoices', () => {
  const inputs = (customer: Record<string, unknown>, country: 'DE' | 'IT') => ({
    invoice: { id: 'i1', number: 'I0001', customerId: 'c1', customer: 'c1', status: 'draft', amount: 485.52, createdAt: '2026-10-03' } as any,
    lines: [{ id: 'l1', description: 'Arbeitszeit', quantity: 6, unitPrice: 68, vatRate: country === 'DE' ? 19 : 22 }] as any,
    customers: [{ id: 'c1', ...customer }] as any,
    businessProfile: { businessName: 'X', address: 'Via Roma 12', postcode: '20121', city: 'Milano', province: 'MI', vatNumber: 'IT01234567897', taxCode: 'RSSMRA80A01F205X', fiscalRegime: 'RF01', personType: 'F', email: 'a@b.it', phone: '02 1', country } as any,
    country,
    effectiveRate: country === 'DE' ? 0.19 : 0.22,
  }) as any;

  it('#3 the XRechnung carries the customer\'s street (KoSIT rejected every one without it)', () => {
    const d = buildEInvoiceData(inputs({ name: 'Müller Bau GmbH', address: 'Friedrichstraße 50', postcode: '10117', city: 'Berlin', email: 'r@m.de' }, 'DE'));
    expect(d.buyerAddress).toBe('Friedrichstraße 50');
  });

  it('#8 a private Italian customer (codice fiscale, no SDI code) gets a FatturaPA, routed 0000000', () => {
    const r = toFatturaPA(buildEInvoiceSource(inputs({ name: 'Giulia Bianco', taxId: 'BNCGLI85M41H501Y', address: 'Via Dante 3', postcode: '20123', city: 'Milano', province: 'MI' }, 'IT')));
    expect(r.ok ? [] : r.missing.map((m) => m.key)).not.toContain('customer.einvoiceRouting');
    expect(r.ok).toBe(true);
    // …while a BUSINESS still needs its code or PEC.
    const b = toFatturaPA(buildEInvoiceSource(inputs({ name: 'Edilizia Bianchi S.r.l.', vatId: 'IT07654321095', address: 'Corso Buenos Aires 20', postcode: '20124', city: 'Milano', province: 'MI' }, 'IT')));
    expect(b.ok ? [] : b.missing.map((m) => m.key)).toContain('customer.einvoiceRouting');
  });
});

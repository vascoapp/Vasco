/**
 * @jest-environment node
 */
// The Spanish and Italian demos must be able to produce their e-invoice.
//
// On a device, "Exportar Facturae" and "Esporta FatturaPA" refused for every
// demo invoice: the demo sellers had no province / person type / RegimeFiscale
// and the demo business customers no address or SDI route. So the one feature
// those markets are sold on could not be demonstrated, walked or screenshotted —
// and nobody could see whether the generated XML was right. This runs the real
// mappers on the demo data.
import { toFatturaPA, toFacturae, type EInvoiceSource } from '../einvoiceMapping';
import {
  ES_BUSINESS_PROFILE, IT_BUSINESS_PROFILE,
  DEMO_CUSTOMER_VAT_IDS, DEMO_CUSTOMER_EINVOICE_DETAILS,
} from '../../data/mockBusiness';
import type { BusinessProfile } from '../../domain/business';

// Mirrors buildEInvoiceSource in app/invoices/[id].tsx.
function source(p: BusinessProfile, customerId: string, name: string, vatRate: number): EInvoiceSource {
  const buyer = DEMO_CUSTOMER_EINVOICE_DETAILS[customerId];
  const net = 1000;
  return {
    seller: {
      name: p.businessName ?? '', vatId: p.vatNumber, taxId: p.registrationNumber, address: p.address,
      city: p.city, postcode: p.postcode, province: p.province, country: p.country,
      fiscalRegime: p.fiscalRegime, personType: p.personType, email: p.email, phone: p.phone,
    },
    buyer: { name, vatId: DEMO_CUSTOMER_VAT_IDS[customerId], country: p.country, ...buyer },
    invoiceNumber: 'DEMO-1', invoiceDate: '2026-09-01', dueDate: '2026-10-01', currency: 'EUR',
    lines: [{ description: 'Trabajo', quantity: 1, unitPrice: net, lineTotal: net, vatRate }],
    totalNet: net, totalVat: net * vatRate / 100, totalGross: net * (1 + vatRate / 100),
  };
}

describe('the ES/IT demos can produce their structured invoice', () => {
  it.each(['cust-es-004', 'cust-es-005'])('Facturae for %s', (id) => {
    const r = toFacturae(source(ES_BUSINESS_PROFILE, id, 'Cliente S.L.', 21));
    expect(r.ok ? [] : r.missing).toEqual([]);
  });

  it.each(['cust-it-004', 'cust-it-005'])('FatturaPA for %s', (id) => {
    const r = toFatturaPA(source(IT_BUSINESS_PROFILE, id, 'Cliente S.r.l.', 22));
    expect(r.ok ? [] : r.missing).toEqual([]);
  });
});

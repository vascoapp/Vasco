/**
 * The customer's structured-invoice address must survive the whole chain.
 *
 * `app/invoices/[id].tsx` used to read `(invoice as any).customerCity` and
 * `.customerPostcode` — fields that existed nowhere. They were undefined on
 * every invoice, so XRechnung omitted CityName and PostalZone, and BR-DE-8/9
 * require both. **Every German invoice this app has produced was invalid on the
 * buyer address alone**, and today's generator fix could not change that: the
 * generator can only emit what it is given.
 *
 * So this pins the chain rather than one end of it — rule #8's five files, of
 * which four are code: domain type, row type, read mapper, write mapper.
 */
import { customerRowToCustomer, customerUpdatesToRowPayload } from '../mappers';
import type { CustomerRow } from '../database.types';
import type { Customer } from '../../domain/customers';

const ROW = {
  id: 'c-1', user_id: 'u1', name: 'Bäckerei Schmidt',
  email: 'b@s.de', phone: '+4930123', address: 'Marktplatz 3',
  city: 'Berlin', postcode: '10178', country: 'DE', province: null,
  vat_id: 'DE987654321', tax_id: null,
  einvoice_routing: null, einvoice_email: null,
  created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
} as unknown as CustomerRow;

describe('customer fiscal address, end to end', () => {
  it('reads the address parts a structured invoice needs', () => {
    const c = customerRowToCustomer(ROW);
    expect(c.city).toBe('Berlin');
    expect(c.postcode).toBe('10178');
    expect(c.country).toBe('DE');
    expect(c.vatId).toBe('DE987654321');
  });

  it('writes camelCase back as the real column names', () => {
    // The whole reason this mapper exists: PostgREST rejects an unknown column
    // and rejects the WHOLE statement with it, so one `vatId` would silently
    // kill every customer edit that touched it.
    const payload = customerUpdatesToRowPayload({
      city: 'Milano', postcode: '20100', province: 'MI',
      vatId: 'IT12345678901', taxId: 'RSSMRA80A01F205X',
      einvoiceRouting: '0000000', einvoiceEmail: 'pec@example.it',
    } as Partial<Customer>);
    expect(payload).toEqual({
      city: 'Milano', postcode: '20100', province: 'MI',
      vat_id: 'IT12345678901', tax_id: 'RSSMRA80A01F205X',
      einvoice_routing: '0000000', einvoice_email: 'pec@example.it',
    });
  });

  it('omits absent keys but sends an explicit null', () => {
    // #143: `!== undefined` is what lets a field be CLEARED. If this ever
    // becomes a truthiness check, a contractor can never remove a wrong VAT
    // number — it would just be ignored.
    expect(customerUpdatesToRowPayload({ city: 'Berlin' })).toEqual({ city: 'Berlin' });
    expect(customerUpdatesToRowPayload({ vatId: null as never })).toEqual({ vat_id: null });
  });

  it('never invents a country', () => {
    // NULL means "same as the contractor", which is what keeps every
    // pre-existing customer row correct rather than silently German.
    const c = customerRowToCustomer({ ...ROW, country: null } as unknown as CustomerRow);
    expect(c.country).toBeUndefined();
  });
});

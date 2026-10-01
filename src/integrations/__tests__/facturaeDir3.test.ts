/**
 * @jest-environment node
 */
// DIR3 — the three administrative centres FACe routes a public-body invoice
// on (Orden HAP/1650/2015 Anexo II.8): their format, the mapper refusing
// without them (by name, before any file exists), the generator writing them
// where the Facturae 3.2.2 schema wants them, and the customer column mapping
// (FE↔BE, migration 20261001000011).
import { isValidDir3Code, normalizeDir3, isFaceOnlyNif, isSpanishPublicBodyNif } from '../fiscalIds';
import { toFacturae, type EInvoiceSource } from '../einvoiceMapping';
import { generateFacturaeXml } from '../einvoice-es';
import { checkFacturae } from '../einvoiceValueRules';
import { parseXml, at, kids, textAt } from '../miniXml';
import { customerRowToCustomer, customerUpdatesToRowPayload } from '../../lib/mappers';

const CODES = { dir3OficinaContable: 'L01280796', dir3OrganoGestor: 'L01280796', dir3UnidadTramitadora: 'LA0002878' };
const src = (buyer: Partial<EInvoiceSource['buyer']>): EInvoiceSource => ({
  seller: { name: 'Fontanería Ruiz S.L.', taxId: 'B12345674', address: 'Calle Mayor 1', city: 'Madrid', postcode: '28013', province: 'Madrid', country: 'ES', personType: 'J' },
  buyer: { name: 'Ayuntamiento de Madrid', taxId: 'P2807900B', address: 'Calle Montalbán 1', city: 'Madrid', postcode: '28014', province: 'Madrid', country: 'ES', ...buyer },
  invoiceNumber: 'FA-1', invoiceDate: '2026-09-30', dueDate: '2026-10-30', currency: 'EUR',
  lines: [{ description: 'Obra', quantity: 1, unitPrice: 100, lineTotal: 100, vatRate: 21 }],
  totalNet: 0, totalVat: 0, totalGross: 0,
} as EInvoiceSource);
const missingKeys = (s: EInvoiceSource) => { const r = toFacturae(s); return r.ok ? [] : r.missing.map((m) => m.key); };

it('DIR3 format: 9 alphanumerics starting with a letter; pasted spacing/case normalized', () => {
  for (const ok of ['L01280796', 'E04921901', 'LA0002878', 'GE0001234', 'A13002908', 'U01300001', ' l01 280 796 ']) expect([ok, isValidDir3Code(ok)]).toEqual([ok, true]);
  for (const bad of ['', 'L0128079', 'L012807961', '101280796', 'L01280_96', undefined, null]) expect([bad, isValidDir3Code(bad)]).toEqual([bad, false]);
  expect(normalizeDir3(' la-000.2878 ')).toBe('LA0002878');
});

it('P and S are FACe-only; Q is a public body that may sit outside FACe', () => {
  expect([isFaceOnlyNif('P2807900B'), isFaceOnlyNif('S2800568D'), isFaceOnlyNif('Q2826000H'), isFaceOnlyNif('B87654323')]).toEqual([true, true, false, false]);
  expect(isSpanishPublicBodyNif('Q2826000H')).toBe(true);
});

describe('the mapper refuses rather than invents', () => {
  it('P/S without codes: all three asked for, by name, for the customer', () => {
    expect(missingKeys(src({}))).toEqual(['customer.dir3OficinaContable', 'customer.dir3OrganoGestor', 'customer.dir3UnidadTramitadora']);
    expect(toFacturae(src({ taxId: 'S2800568D' }))).toMatchObject({ ok: false, missing: expect.arrayContaining([{ key: 'customer.dir3OrganoGestor', where: 'customer' }]) });
  });
  it('a code that is not DIR3-shaped counts as missing (FACe would reject it)', () => {
    expect(missingKeys(src({ ...CODES, dir3UnidadTramitadora: 'LA00' }))).toEqual(['customer.dir3UnidadTramitadora']);
  });
  it('Q: none given → none written (a chamber of commerce is B2B); some given → the rest asked for', () => {
    const q = toFacturae(src({ taxId: 'Q2826000H' }));
    expect(q.ok && q.document.buyerAdministrativeCentres).toBeFalsy();
    expect(missingKeys(src({ taxId: 'Q2826000H', dir3OficinaContable: 'A13002908' }))).toEqual(['customer.dir3OrganoGestor', 'customer.dir3UnidadTramitadora']);
  });
  it('a business buyer never gets centres, even if a stale code is stored', () => {
    const b = toFacturae(src({ taxId: undefined, vatId: 'ESB87654323', name: 'Panadería Navarro S.L.', ...CODES }));
    expect(b.ok && b.document.buyerAdministrativeCentres).toBeFalsy();
  });
});

it('the generator writes AdministrativeCentres in schema order: after TaxIdentification, before LegalEntity; each with code, role, address, description', () => {
  const r = toFacturae(src({ ...CODES, dir3OficinaContable: ' l01280796 ' }));
  if (!r.ok) throw new Error(JSON.stringify(r.missing));
  const xml = generateFacturaeXml(r.document);
  const buyer = at(parseXml(xml).children[0], 'Parties/BuyerParty')!;
  expect(buyer.children.map((c) => c.name)).toEqual(['TaxIdentification', 'AdministrativeCentres', 'LegalEntity']);
  const centres = kids(at(buyer, 'AdministrativeCentres'), 'AdministrativeCentre');
  expect(centres.map((c) => [textAt(c, 'CentreCode'), textAt(c, 'RoleTypeCode'), textAt(c, 'CentreDescription')])).toEqual([
    ['L01280796', '01', 'Oficina contable'], ['L01280796', '02', 'Órgano gestor'], ['LA0002878', '03', 'Unidad tramitadora'],
  ]);
  for (const c of centres) {
    expect(c.children.map((x) => x.name)).toEqual(['CentreCode', 'RoleTypeCode', 'AddressInSpain', 'CentreDescription']);
    expect(textAt(c, 'AddressInSpain/PostCode')).toBe('28014');
  }
  // DIR3 present → the value rules only miss the signature now.
  expect(checkFacturae(xml, { today: '2026-10-01' }).filter((f) => f.severity === 'error').map((f) => f.code)).toEqual(['HAP1650-II.2']);
});

it('customer columns: camelCase ↔ snake_case in both directions (5-file rule)', () => {
  expect(customerUpdatesToRowPayload(CODES)).toEqual({ dir3_oficina_contable: 'L01280796', dir3_organo_gestor: 'L01280796', dir3_unidad_tramitadora: 'LA0002878' });
  expect(customerUpdatesToRowPayload({ dir3OrganoGestor: '' })).toEqual({ dir3_organo_gestor: '' });
  const c = customerRowToCustomer({ id: 'c', user_id: 'u', name: 'X', email: null, phone: null, address: null, city: null, postcode: null, country: null, province: null,
    vat_id: null, tax_id: 'P2807900B', einvoice_routing: null, einvoice_email: null,
    dir3_oficina_contable: 'L01280796', dir3_organo_gestor: 'L01280796', dir3_unidad_tramitadora: null, created_at: '', updated_at: '' });
  expect([c.dir3OficinaContable, c.dir3OrganoGestor, c.dir3UnidadTramitadora]).toEqual(['L01280796', 'L01280796', undefined]);
});

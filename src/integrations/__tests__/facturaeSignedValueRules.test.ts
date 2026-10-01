/**
 * @jest-environment node
 */
// checkFacturae on SIGNED files (the export gate): a signed public-body
// invoice with its DIR3 centres passes; a signature that is not structurally
// a Facturae v3.1 XAdES-EPES is refused whoever the buyer (HAP II.2,
// signatureInvalid). Cryptographic validity is NOT judged here — that is
// verifyFacturaeSignature / EU DSS.
import { checkFacturae } from '../einvoiceValueRules';
import { signFacturae, FACTURAE_POLICY } from '../facturaeSignature';
import { toFacturae, type EInvoiceSource } from '../einvoiceMapping';
import { generateFacturaeXml } from '../einvoice-es';
import { makeTestCertificate } from '../../test-utils/testCertificates';

const T = makeTestCertificate({ person: '12345678Z', entity: 'B12345674' });
const xmlFor = (buyer: Partial<EInvoiceSource['buyer']>) => {
  const r = toFacturae({
    seller: { name: 'Fontanería Ruiz S.L.', taxId: 'B12345674', address: 'Calle Mayor 1', city: 'Madrid', postcode: '28013', province: 'Madrid', country: 'ES', personType: 'J' },
    buyer: { name: 'Ayuntamiento de Madrid', taxId: 'P2807900B', address: 'Calle Montalbán 1', city: 'Madrid', postcode: '28014', province: 'Madrid', country: 'ES',
      dir3OficinaContable: 'L01280796', dir3OrganoGestor: 'L01280796', dir3UnidadTramitadora: 'LA0002878', ...buyer },
    invoiceNumber: 'FA-1', invoiceDate: '2026-09-30', dueDate: '2026-10-30', currency: 'EUR',
    lines: [{ description: 'Obra', quantity: 1.333, unitPrice: 55, lineTotal: 73.315, vatRate: 21 }],
    totalNet: 0, totalVat: 0, totalGross: 0,
  } as EInvoiceSource);
  if (!r.ok) throw new Error(JSON.stringify(r.missing));
  return signFacturae(generateFacturaeXml(r.document), T.material);
};
const errors = (xml: string) => checkFacturae(xml, { today: '2026-10-01' }).filter((f) => f.severity === 'error').map((f) => `${f.code}:${f.key}`);
const all = (xml: string) => checkFacturae(xml, { today: '2026-10-01' }).map((f) => `${f.severity}:${f.code}`);
const mutate = (xml: string, from: string | RegExp, to: string) => {
  const out = xml.replace(from, to);
  if (out === xml) throw new Error(`mutation did not apply: ${from}`);
  return out;
};

it('a signed P invoice with DIR3 passes, with no findings at all; so do signed S, Q and B2B ones', () => {
  expect(all(xmlFor({}))).toEqual([]);
  expect(all(xmlFor({ taxId: 'S2800568D' }))).toEqual([]);
  expect(all(xmlFor({ taxId: 'Q2826000H' }))).toEqual([]);
  expect(all(xmlFor({ taxId: undefined, vatId: 'ESB87654323', name: 'Panadería Navarro S.L.' }))).toEqual([]);
});

describe('a signature that is not a Facturae v3.1 XAdES-EPES is refused — B2B included', () => {
  const b2b = () => xmlFor({ taxId: undefined, vatId: 'ESB87654323', name: 'Panadería Navarro S.L.' });
  it.each([
    ['another policy', () => mutate(b2b(), FACTURAE_POLICY.identifier, 'urn:oid:1.2.3')],
    ['the wrong policy digest', () => mutate(b2b(), FACTURAE_POLICY.digestValue, 'f/LPQFpMc/ha+1dJ+Y5y11OPVnM=')],
    ['no SigningTime', () => mutate(b2b(), /<xades:SigningTime>[^<]*<\/xades:SigningTime>/, '')],
    ['SignedProperties not referenced', () => mutate(b2b(), /<ds:Reference Type="http:\/\/uri\.etsi\.org\/01903#SignedProperties"[\s\S]*?<\/ds:Reference>/, '')],
    ['KeyInfo not referenced', () => mutate(b2b(), /<ds:Reference URI="#Certificate-[\s\S]*?<\/ds:Reference>/, '')],
    ['not enveloped', () => mutate(b2b(), '<ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>', '')],
    ['a role the policy does not allow', () => mutate(b2b(), '<xades:ClaimedRole>emisor</xades:ClaimedRole>', '<xades:ClaimedRole>notario</xades:ClaimedRole>')],
  ] as Array<[string, () => string]>)('%s', (_l, make) => {
    expect(errors(make())).toEqual(['HAP1650-II.2:signatureInvalid']);
  });
});

it('a signed public-body invoice whose DIR3 role is gone is still refused (II.8)', () => {
  const xml = mutate(xmlFor({}), '<RoleTypeCode>03</RoleTypeCode>', '<RoleTypeCode>02</RoleTypeCode>');
  expect(errors(xml)).toEqual(['HAP1650-II.8:publicBuyerDir3ES']);
});

/**
 * @jest-environment node
 */
// The Facturae XAdES-EPES signature (src/integrations/facturaeSignature.ts):
// it verifies — with OUR verifier and, independently, with node's own crypto
// — it carries what the "Política de Firma Facturae v3.1" demands, and any
// change to the invoice, the signed properties or the certificate breaks it.
// The authority-grade check (EU DSS, trust anchors, policy) is
// npm run check:facturae-signature.
import { createHash, createVerify, X509Certificate } from 'crypto';
import * as forge from 'node-forge';
import {
  signFacturae, verifyFacturaeSignature, facturaeSignatureStructure, FACTURAE_POLICY, DS_NS, XADES_NS,
  C14N_ALG, RSA_SHA256, SHA256, ENVELOPED, SIGNED_PROPERTIES_TYPE, FacturaeSignatureError, rfc2253Name, rsaSignSha256,
} from '../facturaeSignature';
import { parseXmlDocument, canonicalizeDocument, canonicalizeSubtree, findElement, isNs, type XElement } from '../xmlC14n';
import { toFacturae, type EInvoiceSource } from '../einvoiceMapping';
import { generateFacturaeXml } from '../einvoice-es';
import { makeTestCertificate } from '../../test-utils/testCertificates';

const src: EInvoiceSource = {
  seller: { name: 'Fontanería Ruiz S.L.', taxId: 'B12345674', address: 'Calle Mayor 1', city: 'Madrid', postcode: '28013', province: 'Madrid', country: 'ES', personType: 'J' },
  buyer: { name: 'Ayuntamiento de Madrid', taxId: 'P2807900B', address: 'Calle Montalbán 1', city: 'Madrid', postcode: '28014', province: 'Madrid', country: 'ES',
    dir3OficinaContable: 'L01280796', dir3OrganoGestor: 'L01280796', dir3UnidadTramitadora: 'LA0002878' },
  invoiceNumber: 'FA-2026-0101', invoiceDate: '2026-09-30', dueDate: '2026-10-30', currency: 'EUR',
  lines: [{ description: 'Pintura "A" & <pasillo>', quantity: 1.333, unitPrice: 55, lineTotal: 73.315, vatRate: 21 }],
  totalNet: 0, totalVat: 0, totalGross: 0,
};
const unsigned = () => {
  const r = toFacturae(src);
  if (!r.ok) throw new Error(JSON.stringify(r.missing));
  return generateFacturaeXml(r.document);
};

const T = makeTestCertificate({ person: '12345678Z', entity: 'B12345674' });
const signed = signFacturae(unsigned(), T.material, { signingTime: new Date('2026-10-01T10:00:00Z'), id: 't1' });
const doc = parseXmlDocument(signed);
const el = (local: string, ns = XADES_NS): XElement => findElement(doc.root, (e) => isNs(e, ns, local))!;
const text = (e: XElement | undefined) => (e ? e.children.map((c) => (c.type === 'text' ? c.value : '')).join('') : '');
const attr = (e: XElement | undefined, n: string) => e?.attrs.find((a) => a.qname === n)?.value;
const kids = (e: XElement, local: string, ns = DS_NS) => e.children.filter((c): c is XElement => c.type === 'element' && isNs(c, ns, local));

it('round trip: our verifier accepts it', () => {
  expect(verifyFacturaeSignature(signed)).toMatchObject({ valid: true, problems: [] });
});

it('independently: node crypto verifies the SignatureValue over the canonical SignedInfo, with the KeyInfo certificate', () => {
  const si = el('SignedInfo', DS_NS);
  const cert = new X509Certificate(Buffer.from(text(el('X509Certificate', DS_NS)), 'base64'));
  const v = createVerify('RSA-SHA256');
  v.update(Buffer.from(canonicalizeSubtree(si), 'utf8'));
  expect(v.verify(cert.publicKey, Buffer.from(text(el('SignatureValue', DS_NS)), 'base64'))).toBe(true);
  // …and the invoice digest is SHA-256 over the canonical unsigned invoice.
  const docRef = kids(si, 'Reference').find((r) => attr(r, 'URI') === '')!;
  expect(text(kids(docRef, 'DigestValue')[0])).toBe(createHash('sha256').update(canonicalizeDocument(parseXmlDocument(unsigned())), 'utf8').digest('base64'));
});

it('is enveloped: the signed file minus the Signature is the unsigned invoice, node for node', () => {
  const sig = el('Signature', DS_NS);
  expect(sig.parent).toBe(doc.root);
  expect(canonicalizeDocument(doc, { exclude: [sig] })).toBe(canonicalizeDocument(parseXmlDocument(unsigned())));
});

it('SignedInfo: C14N 1.0, RSA-SHA256, and the three references the policy demands', () => {
  const si = el('SignedInfo', DS_NS);
  expect(attr(kids(si, 'CanonicalizationMethod')[0], 'Algorithm')).toBe(C14N_ALG);
  expect(attr(kids(si, 'SignatureMethod')[0], 'Algorithm')).toBe(RSA_SHA256);
  const refs = kids(si, 'Reference');
  expect(refs).toHaveLength(3);
  const docRef = refs.find((r) => attr(r, 'URI') === '')!;
  expect(attr(kids(kids(docRef, 'Transforms')[0], 'Transform')[0], 'Algorithm')).toBe(ENVELOPED);
  expect(refs.some((r) => attr(r, 'URI') === `#${attr(el('SignedProperties'), 'Id')}` && attr(r, 'Type') === SIGNED_PROPERTIES_TYPE)).toBe(true);
  expect(refs.some((r) => attr(r, 'URI') === `#${attr(el('KeyInfo', DS_NS), 'Id')}`)).toBe(true);
  for (const r of refs) expect(attr(kids(r, 'DigestMethod')[0], 'Algorithm')).toBe(SHA256);
});

it('SignedProperties: SigningTime, SigningCertificate (digest + issuer/serial of THIS cert), the v3.1 policy, ClaimedRole emisor, DataObjectFormat', () => {
  expect(text(el('SigningTime'))).toBe('2026-10-01T10:00:00Z');
  const certDigest = text(findElement(el('CertDigest'), (e) => isNs(e, DS_NS, 'DigestValue')));
  expect(certDigest).toBe(createHash('sha256').update(Buffer.from(T.certDer, 'binary')).digest('base64'));
  expect(text(findElement(el('IssuerSerial'), (e) => isNs(e, DS_NS, 'X509SerialNumber')))).toBe(BigInt(`0x${T.cert.serialNumber}`).toString(10));
  expect(text(findElement(el('IssuerSerial'), (e) => isNs(e, DS_NS, 'X509IssuerName')))).toBe('CN=VASCO TEST CA - NOT TRUSTED,O=VASCO TEST ONLY,C=ES');
  expect(text(findElement(el('SigPolicyId'), (e) => isNs(e, XADES_NS, 'Identifier')))).toBe(FACTURAE_POLICY.identifier);
  expect(FACTURAE_POLICY.identifier).toBe('http://www.facturae.es/politica_de_firma_formato_facturae/politica_de_firma_formato_facturae_v3_1.pdf');
  const hash = el('SigPolicyHash');
  expect(attr(findElement(hash, (e) => isNs(e, DS_NS, 'DigestMethod')), 'Algorithm')).toBe('http://www.w3.org/2000/09/xmldsig#sha1');
  expect(text(findElement(hash, (e) => isNs(e, DS_NS, 'DigestValue')))).toBe('Ohixl6upD6av8N7pEvDABhEL6hM=');
  expect(text(el('ClaimedRole'))).toBe('emisor');
  const dof = el('DataObjectFormat');
  const docRefId = attr(kids(el('SignedInfo', DS_NS), 'Reference').find((r) => attr(r, 'URI') === ''), 'Id');
  expect(attr(dof, 'ObjectReference')).toBe(`#${docRefId}`);
  expect(text(findElement(dof, (e) => isNs(e, XADES_NS, 'MimeType')))).toBe('text/xml');
  expect(attr(el('QualifyingProperties'), 'Target')).toBe(`#${attr(el('Signature', DS_NS), 'Id')}`);
});

it('the structural check (what the export gate runs) finds nothing wrong', () => {
  expect(facturaeSignatureStructure(signed)).toMatchObject({ signed: true, enveloped: true, problems: [], claimedRole: 'emisor', policyDigest: FACTURAE_POLICY.digestValue });
});

describe('any change breaks it', () => {
  const mutate = (from: string | RegExp, to: string) => {
    const out = signed.replace(from, to);
    if (out === signed) throw new Error(`mutation did not apply: ${from}`);
    return out;
  };
  it.each([
    ['an amount in the invoice', () => mutate(/<InvoiceTotal>([\d.]+)</, '<InvoiceTotal>1.00<'), 'reference ""'],
    ['the signing time', () => mutate('2026-10-01T10:00:00Z', '2026-10-01T10:00:01Z'), 'reference "#Signature-t1-SignedProperties"'],
    ['the certificate in KeyInfo', () => signed.replace(/(<ds:X509Certificate>[^<]{300})(.)/, (_m, a: string, c: string) => `${a}${c === 'A' ? 'B' : 'A'}`), 'reference "#Certificate-t1"'],
    ['the signature value', () => signed.replace(/(<ds:SignatureValue[^>]*>)(.)/, (_m, a: string, c: string) => `${a}${c === 'A' ? 'B' : 'A'}`), 'SignatureValue'],
  ] as Array<[string, () => string, string]>)('%s', (_label, make, expected) => {
    const r = verifyFacturaeSignature(make());
    expect(r.valid).toBe(false);
    expect(r.problems.join(' | ')).toContain(expected);
  });
});

describe('refuses rather than signs wrongly', () => {
  it('a key that is not the certificate\'s', () => {
    const other = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 0x10001 });
    expect(() => signFacturae(unsigned(), { ...T.material, privateKeyPem: forge.pki.privateKeyToPem(other.privateKey) }))
      .toThrow(FacturaeSignatureError);
  });
  it('an already signed file, and a document that is not a Facturae', () => {
    expect(() => signFacturae(signed, T.material)).toThrow(/already signed/);
    expect(() => signFacturae('<Invoice/>', T.material)).toThrow(/not a Facturae/);
  });
});

it('the BigInt RSA path (fast on Hermes) gives byte-for-byte forge\'s PKCS#1 v1.5 signature, in a fraction of the time', () => {
  const key = forge.pki.privateKeyFromPem(T.material.privateKeyPem) as forge.pki.rsa.PrivateKey;
  for (const msg of ['', 'x', 'Facturae ñ €', 'z'.repeat(5000)]) {
    const md = () => { const m = forge.md.sha256.create(); m.update(msg, 'utf8'); return m; };
    expect(forge.util.bytesToHex(rsaSignSha256(key, md()))).toBe(forge.util.bytesToHex(key.sign(md())));
  }
  const t0 = Date.now();
  for (let i = 0; i < 5; i++) rsaSignSha256(key, forge.md.sha256.create().update('y'));
  expect((Date.now() - t0) / 5).toBeLessThan(250); // forge's jsbn: ~1300 ms here
});

it('RFC 2253 issuer names: keywords, OID=#DER for the rest, most specific RDN first', () => {
  const c = makeTestCertificate({ person: '12345678Z', entity: 'B12345674' }).cert;
  const subjectAsn1 = (forge.pki.certificateToAsn1(c).value[0] as any).value[5];
  const name = rfc2253Name(subjectAsn1);
  expect(name.startsWith('CN=TEST ONLY 12345678Z (R: B12345674),')).toBe(true);
  expect(name).toContain('2.5.4.5=#'); // serialNumber is not an RFC 2253 keyword
  expect(name.endsWith(',C=ES')).toBe(true);
});

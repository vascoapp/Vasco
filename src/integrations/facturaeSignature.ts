// =============================================================================
// FACTURAE SIGNATURE — XAdES-EPES under the "Política de Firma Facturae v3.1"
// =============================================================================
// FACe (every Spanish public administration, Ley 25/2013) accepts a Facturae
// only signed with an advanced electronic signature following the Facturae
// signature policy (Orden HAP/1650/2015 Anexo II rule 2). This module produces
// that signature ON THE DEVICE, in pure JavaScript (node-forge for RSA,
// SHA and PKCS#12; our own C14N in xmlC14n.ts) — no native module, so it ships
// over the air.
//
// Policy document (fetched 2026-10-01):
//   http://www.facturae.es/politica_de_firma_formato_facturae/politica_de_firma_formato_facturae_v3_1.pdf
//   §1.2/1.3: an ENVELOPED XAdES-EPES whose SignedInfo references (1) the whole
//   invoice (URI="", enveloped-signature transform), (2) the SignedProperties
//   and (3) the KeyInfo holding the signing certificate; SignedProperties carry
//   SigningTime, SigningCertificate, SignaturePolicyIdentifier (identifier =
//   the policy URL + SigPolicyHash) and, optionally, SignerRole with exactly
//   one ClaimedRole — "emisor"/"supplier" when the issuer signs.
//
// ⚠️ SigPolicyHash. The value every FACe-accepted signer writes — and the one
// FACe / @firma check — is SHA-1 `Ohixl6upD6av8N7pEvDABhEL6hM=` (Facturae-PHP,
// nSoftware, the Facturae ecosystem). The PDF served at that URL TODAY hashes
// to SHA-1 `f/LPQFpMc/ha+1dJ+Y5y11OPVnM=` (45 735 bytes, measured 2026-10-01,
// both facturae.es and facturae.gob.es): the hosted file was re-published
// after the policy was registered. We write the registered value, because the
// receiver compares against its own configuration, not against a download.
// npm run check:facturae-signature reports what the EU DSS validator says
// about it either way.
//
// Algorithms: RSA-SHA256 and SHA-256 digests (policy §6 admits the SHA-2
// family; FACe accepts SHA-256/512). Canonicalization: C14N 1.0 inclusive.
// XAdES namespace: v1.3.2 (the policy allows any later version without
// significant syntax change; it is what FACe signers use today).
// =============================================================================

import * as forge from 'node-forge';
import {
  parseXmlDocument, canonicalizeDocument, canonicalizeSubtree, elementById, findElement, isNs,
  type XElement,
} from './xmlC14n';

export const DS_NS = 'http://www.w3.org/2000/09/xmldsig#';
export const XADES_NS = 'http://uri.etsi.org/01903/v1.3.2#';
export const C14N_ALG = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
export const RSA_SHA256 = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
export const SHA256 = 'http://www.w3.org/2001/04/xmlenc#sha256';
export const SHA1 = 'http://www.w3.org/2000/09/xmldsig#sha1';
export const ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';
export const SIGNED_PROPERTIES_TYPE = 'http://uri.etsi.org/01903#SignedProperties';

export const FACTURAE_POLICY = {
  identifier: 'http://www.facturae.es/politica_de_firma_formato_facturae/politica_de_firma_formato_facturae_v3_1.pdf',
  description: 'Política de Firma FacturaE v3.1',
  digestAlgorithm: SHA1,
  digestValue: 'Ohixl6upD6av8N7pEvDABhEL6hM=',
} as const;

/** What signing needs: the private key and the certificate chain, signer first. */
export interface SigningMaterial {
  /** PKCS#8 / PKCS#1 PEM of the RSA private key. Never logged, never persisted in clear. */
  privateKeyPem: string;
  /** Base64 DER certificates; [0] is the signer's. */
  certificatesDer: string[];
}

export interface SignOptions {
  signingTime?: Date;
  /** Suffix for the element Ids; random by default. */
  id?: string;
}

// ---------------------------------------------------------------------------
// Bytes helpers (forge works in "binary strings": one char per byte)
// ---------------------------------------------------------------------------

const sha256B64 = (utf8Text: string): string => {
  const md = forge.md.sha256.create();
  md.update(utf8Text, 'utf8');
  return forge.util.encode64(md.digest().getBytes());
};
const sha256OfBytesB64 = (bytes: string): string => {
  const md = forge.md.sha256.create();
  md.update(bytes, 'raw');
  return forge.util.encode64(md.digest().getBytes());
};
const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------------------------------------------------------------------------
// Distinguished names — RFC 4514/2253, as X509IssuerName wants them
// ---------------------------------------------------------------------------

/** RFC 2253 keywords; any other attribute type is written OID=#hex (its DER). */
const DN_KEYWORDS: Record<string, string> = {
  '2.5.4.3': 'CN', '2.5.4.7': 'L', '2.5.4.8': 'ST', '2.5.4.10': 'O', '2.5.4.11': 'OU',
  '2.5.4.6': 'C', '2.5.4.9': 'STREET', '0.9.2342.19200300.100.1.25': 'DC', '0.9.2342.19200300.100.1.1': 'UID',
};

const escapeDnValue = (v: string): string => {
  let out = v.replace(/([,+"\\<>;=])/g, '\\$1');
  if (/^[ #]/.test(out)) out = `\\${out}`;
  if (/ $/.test(out)) out = `${out.slice(0, -1)}\\ `;
  return out;
};

/**
 * The issuer DN in RFC 2253 order (most specific RDN first). Read from the
 * certificate's own ASN.1 so multi-valued RDNs and non-keyword attributes
 * (serialNumber, organizationIdentifier) are rendered exactly, the way Java's
 * X500Principal.getName(RFC2253) does.
 */
export function rfc2253Name(nameAsn1: forge.asn1.Asn1): string {
  const rdns = (nameAsn1.value as forge.asn1.Asn1[]).map((set) =>
    (set.value as forge.asn1.Asn1[]).map((atv) => {
      const [oidNode, valueNode] = atv.value as forge.asn1.Asn1[];
      const oid = forge.asn1.derToOid(oidNode.value as string);
      const kw = DN_KEYWORDS[oid];
      if (kw) {
        const raw = valueNode.value as string;
        // BMPString is UTF-16BE; every other string type here is UTF-8/ASCII bytes.
        let text: string | undefined;
        if (valueNode.type === forge.asn1.Type.BMPSTRING) {
          text = String.fromCharCode(...Array.from({ length: raw.length / 2 }, (_, i) => (raw.charCodeAt(2 * i) << 8) | raw.charCodeAt(2 * i + 1)));
        } else if (valueNode.type === forge.asn1.Type.UTF8 || valueNode.type === forge.asn1.Type.PRINTABLESTRING || valueNode.type === forge.asn1.Type.IA5STRING) {
          try { text = forge.util.decodeUtf8(raw); } catch { text = undefined; }
        }
        // Anything we cannot render as text losslessly goes out as its DER, which
        // RFC 2253 allows for every attribute type.
        if (text !== undefined) return `${kw}=${escapeDnValue(text)}`;
      }
      return `${oid}=#${forge.util.bytesToHex(forge.asn1.toDer(valueNode).getBytes())}`;
    }).join('+'));
  return rdns.reverse().join(',');
}

/** Decimal serial number (X509SerialNumber is an xs:integer). */
export const serialDecimal = (cert: forge.pki.Certificate): string =>
  new forge.jsbn.BigInteger(cert.serialNumber, 16).toString(10);

const certFromB64 = (b64: string): { cert: forge.pki.Certificate; asn1: forge.asn1.Asn1; der: string } => {
  const der = forge.util.decode64(b64);
  const asn1 = forge.asn1.fromDer(der);
  return { cert: forge.pki.certificateFromAsn1(asn1), asn1, der };
};

/** The issuer Name node inside tbsCertificate (index 3, after the optional [0] version). */
const issuerAsn1 = (certAsn1: forge.asn1.Asn1): forge.asn1.Asn1 => {
  const tbs = (certAsn1.value as forge.asn1.Asn1[])[0];
  const parts = tbs.value as forge.asn1.Asn1[];
  const offset = parts[0].tagClass === forge.asn1.Class.CONTEXT_SPECIFIC ? 1 : 0;
  return parts[2 + offset];
};

// ---------------------------------------------------------------------------
// RSA PKCS#1 v1.5 / SHA-256 on native BigInt
// ---------------------------------------------------------------------------
// forge's jsbn picks its slowest multiply on React Native (`navigator` exists,
// appName is not "Netscape") and Hermes has no JIT: one 2048-bit signature
// took ~1.3 s in jest and would take several seconds on a phone. Hermes
// implements BigInt natively, so the private operation runs on BigInt with
// the CRT, then is CHECKED (s^e mod n = m) before it is used — a fault in the
// CRT path must never produce a bad signature. PKCS#1 v1.5 is deterministic,
// so the bytes equal forge's (the test asserts it). No BigInt → forge.

/** DER prefix of DigestInfo{ sha256 } (RFC 8017 §9.2 note 1). */
const SHA256_DIGEST_INFO = '3031300d060960864801650304020105000420';

const toBig = (b: forge.jsbn.BigInteger): bigint => BigInt(`0x${b.toString(16) || '0'}`);
function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  const ZERO = BigInt(0);
  const ONE = BigInt(1);
  let result = ONE;
  let b = base % mod;
  let e = exp;
  while (e > ZERO) {
    if ((e & ONE) === ONE) result = (result * b) % mod;
    e >>= ONE;
    b = (b * b) % mod;
  }
  return result;
}

/** The raw signature (binary string) of a SHA-256 message digest. */
export function rsaSignSha256(key: forge.pki.rsa.PrivateKey, md: forge.md.MessageDigest): string {
  const k = key as forge.pki.rsa.PrivateKey & { dP?: forge.jsbn.BigInteger; dQ?: forge.jsbn.BigInteger; qInv?: forge.jsbn.BigInteger };
  if (typeof BigInt !== 'function' || !k.p || !k.q || !k.dP || !k.dQ || !k.qInv) return key.sign(md);
  const len = (key.n.bitLength() + 7) >> 3;
  const digestInfoHex = SHA256_DIGEST_INFO + forge.util.bytesToHex(md.digest().getBytes());
  const psLen = len - 3 - digestInfoHex.length / 2;
  if (psLen < 8) return key.sign(md);
  const em = BigInt(`0x0001${'ff'.repeat(psLen)}00${digestInfoHex}`);
  const n = toBig(key.n);
  const p = toBig(k.p);
  const q = toBig(k.q);
  const m1 = modPow(em % p, toBig(k.dP), p);
  const m2 = modPow(em % q, toBig(k.dQ), q);
  const h = ((((m1 - m2) % p) + p) % p * toBig(k.qInv)) % p;
  const s = m2 + h * q;
  // Fault check: a signature that does not open to the encoded message is never returned.
  if (modPow(s, toBig(key.e), n) !== em) return key.sign(md);
  const hex = s.toString(16).padStart(len * 2, '0');
  return forge.util.hexToBytes(hex);
}

// ---------------------------------------------------------------------------
// Signing
// ---------------------------------------------------------------------------

export class FacturaeSignatureError extends Error {}

/**
 * Signs a Facturae document (as our generator writes it) with an enveloped
 * XAdES-EPES under the Facturae v3.1 policy. Returns the signed document.
 * Verifies its own output before returning — a signature this module cannot
 * verify is never handed over.
 */
export function signFacturae(xml: string, material: SigningMaterial, opts: SignOptions = {}): string {
  if (!material.certificatesDer.length) throw new FacturaeSignatureError('no certificate');
  const unsigned = parseXmlDocument(xml);
  if (unsigned.root.local !== 'Facturae') throw new FacturaeSignatureError('not a Facturae document');
  if (findElement(unsigned.root, (e) => isNs(e, DS_NS, 'Signature'))) throw new FacturaeSignatureError('already signed');

  const id = opts.id ?? `${Date.now().toString(36)}${Math.floor(Math.random() * 1e9).toString(36)}`;
  const sigId = `Signature-${id}`;
  const spId = `${sigId}-SignedProperties`;
  const kiId = `Certificate-${id}`;
  const refId = `Reference-${id}`;
  const signingTime = (opts.signingTime ?? new Date()).toISOString().replace(/\.\d{3}Z$/, 'Z');

  const signer = certFromB64(material.certificatesDer[0]);
  const privateKey = forge.pki.privateKeyFromPem(material.privateKeyPem) as forge.pki.rsa.PrivateKey;
  const pub = signer.cert.publicKey as forge.pki.rsa.PublicKey;
  if (!pub.n || pub.n.compareTo(privateKey.n) !== 0) throw new FacturaeSignatureError('the private key does not belong to the certificate');

  // (1) The invoice: URI="" + enveloped-signature = the document without the
  // Signature element. The Signature is inserted as the LAST child with no
  // whitespace around it, so "the signed document minus the Signature" is the
  // unsigned document node for node — re-checked in verifyFacturaeSignature.
  const docDigest = sha256B64(canonicalizeDocument(unsigned));

  const certsXml = material.certificatesDer.map((c) => `<ds:X509Certificate>${c}</ds:X509Certificate>`).join('');
  const signedProperties =
    `<xades:SignedProperties Id="${spId}">` +
      '<xades:SignedSignatureProperties>' +
        `<xades:SigningTime>${signingTime}</xades:SigningTime>` +
        '<xades:SigningCertificate><xades:Cert>' +
          `<xades:CertDigest><ds:DigestMethod Algorithm="${SHA256}"/><ds:DigestValue>${sha256OfBytesB64(signer.der)}</ds:DigestValue></xades:CertDigest>` +
          `<xades:IssuerSerial><ds:X509IssuerName>${escapeXml(rfc2253Name(issuerAsn1(signer.asn1)))}</ds:X509IssuerName><ds:X509SerialNumber>${serialDecimal(signer.cert)}</ds:X509SerialNumber></xades:IssuerSerial>` +
        '</xades:Cert></xades:SigningCertificate>' +
        '<xades:SignaturePolicyIdentifier><xades:SignaturePolicyId>' +
          `<xades:SigPolicyId><xades:Identifier>${FACTURAE_POLICY.identifier}</xades:Identifier><xades:Description>${FACTURAE_POLICY.description}</xades:Description></xades:SigPolicyId>` +
          `<xades:SigPolicyHash><ds:DigestMethod Algorithm="${FACTURAE_POLICY.digestAlgorithm}"/><ds:DigestValue>${FACTURAE_POLICY.digestValue}</ds:DigestValue></xades:SigPolicyHash>` +
        '</xades:SignaturePolicyId></xades:SignaturePolicyIdentifier>' +
        '<xades:SignerRole><xades:ClaimedRoles><xades:ClaimedRole>emisor</xades:ClaimedRole></xades:ClaimedRoles></xades:SignerRole>' +
      '</xades:SignedSignatureProperties>' +
      '<xades:SignedDataObjectProperties>' +
        `<xades:DataObjectFormat ObjectReference="#${refId}">` +
          '<xades:Description>Factura electrónica</xades:Description>' +
          '<xades:ObjectIdentifier><xades:Identifier Qualifier="OIDAsURN">urn:oid:1.2.840.10003.5.109.10</xades:Identifier></xades:ObjectIdentifier>' +
          '<xades:MimeType>text/xml</xades:MimeType>' +
        '</xades:DataObjectFormat>' +
      '</xades:SignedDataObjectProperties>' +
    '</xades:SignedProperties>';

  const reference = (attrs: string, digest: string, transforms = '') =>
    `<ds:Reference ${attrs}>${transforms}<ds:DigestMethod Algorithm="${SHA256}"/><ds:DigestValue>${digest}</ds:DigestValue></ds:Reference>`;
  const signedInfo = (spDigest: string, kiDigest: string) =>
    '<ds:SignedInfo>' +
      `<ds:CanonicalizationMethod Algorithm="${C14N_ALG}"/>` +
      `<ds:SignatureMethod Algorithm="${RSA_SHA256}"/>` +
      reference(`Id="${refId}" Type="http://www.w3.org/2000/09/xmldsig#Object" URI=""`, docDigest,
        `<ds:Transforms><ds:Transform Algorithm="${ENVELOPED}"/></ds:Transforms>`) +
      reference(`Type="${SIGNED_PROPERTIES_TYPE}" URI="#${spId}"`, spDigest) +
      reference(`URI="#${kiId}"`, kiDigest) +
    '</ds:SignedInfo>';

  const assemble = (si: string, sigValue: string) => {
    const signature =
      `<ds:Signature xmlns:ds="${DS_NS}" xmlns:xades="${XADES_NS}" Id="${sigId}">` +
        si +
        `<ds:SignatureValue Id="${sigId}-SignatureValue">${sigValue}</ds:SignatureValue>` +
        `<ds:KeyInfo Id="${kiId}"><ds:X509Data>${certsXml}</ds:X509Data></ds:KeyInfo>` +
        `<ds:Object><xades:QualifyingProperties Target="#${sigId}">${signedProperties}</xades:QualifyingProperties></ds:Object>` +
      '</ds:Signature>';
    const close = xml.lastIndexOf('</');
    return xml.slice(0, close) + signature + xml.slice(close);
  };

  // (2)+(3): digests of SignedProperties and KeyInfo IN PLACE — their
  // canonical form carries every namespace in scope there (fe, ds, xades).
  const draft = parseXmlDocument(assemble(signedInfo('', ''), ''));
  const spDigest = sha256B64(canonicalizeSubtree(mustById(draft.root, spId)));
  const kiDigest = sha256B64(canonicalizeSubtree(mustById(draft.root, kiId)));

  const withDigests = parseXmlDocument(assemble(signedInfo(spDigest, kiDigest), ''));
  const si = findElement(withDigests.root, (e) => isNs(e, DS_NS, 'SignedInfo')) as XElement;
  const md = forge.md.sha256.create();
  md.update(canonicalizeSubtree(si), 'utf8');
  const signatureValue = forge.util.encode64(rsaSignSha256(privateKey, md));

  const signed = assemble(signedInfo(spDigest, kiDigest), signatureValue);
  const check = verifyFacturaeSignature(signed);
  if (!check.valid) throw new FacturaeSignatureError(`self-check failed: ${check.problems.join('; ')}`);
  return signed;
}

const mustById = (root: XElement, id: string): XElement => {
  const e = elementById(root, id);
  if (!e) throw new FacturaeSignatureError(`no element with Id ${id}`);
  return e;
};

// ---------------------------------------------------------------------------
// Verification — the cryptographic check, in JS (jest + the self-check above).
// The authority-grade check is the EU DSS validator: check:facturae-signature.
// ---------------------------------------------------------------------------

export interface SignatureVerification {
  valid: boolean;
  problems: string[];
  signerCertificate?: forge.pki.Certificate;
}

const textOf = (e: XElement | undefined): string =>
  e ? e.children.map((c) => (c.type === 'text' ? c.value : '')).join('').trim() : '';
const child = (e: XElement | undefined, ns: string, local: string): XElement | undefined =>
  e ? (e.children.find((c) => c.type === 'element' && isNs(c, ns, local)) as XElement | undefined) : undefined;
const childrenNs = (e: XElement | undefined, ns: string, local: string): XElement[] =>
  e ? (e.children.filter((c) => c.type === 'element' && isNs(c, ns, local)) as XElement[]) : [];
const attr = (e: XElement | undefined, name: string): string | undefined => e?.attrs.find((a) => a.qname === name)?.value;

const DIGESTS: Record<string, () => forge.md.MessageDigest> = {
  [SHA256]: () => forge.md.sha256.create(),
  [SHA1]: () => forge.md.sha1.create(),
  'http://www.w3.org/2001/04/xmlenc#sha512': () => forge.md.sha512.create(),
};
const SIG_DIGESTS: Record<string, () => forge.md.MessageDigest> = {
  [RSA_SHA256]: () => forge.md.sha256.create(),
  'http://www.w3.org/2000/09/xmldsig#rsa-sha1': () => forge.md.sha1.create(),
  'http://www.w3.org/2001/04/xmldsig-more#rsa-sha512': () => forge.md.sha512.create(),
};

/**
 * Recomputes every reference digest and the RSA signature value of an
 * enveloped XML signature that uses C14N 1.0 and same-document references
 * only (what signFacturae writes). Does NOT judge the certificate (trust,
 * revocation) — that belongs to a validator with trust anchors.
 */
export function verifyFacturaeSignature(xml: string): SignatureVerification {
  const problems: string[] = [];
  let doc;
  try { doc = parseXmlDocument(xml); } catch (e) { return { valid: false, problems: [`not well-formed: ${(e as Error).message}`] }; }
  const sig = doc.root.children.find((c) => c.type === 'element' && isNs(c, DS_NS, 'Signature')) as XElement | undefined;
  if (!sig) return { valid: false, problems: ['no ds:Signature child of the root'] };
  const si = child(sig, DS_NS, 'SignedInfo');
  if (attr(child(si, DS_NS, 'CanonicalizationMethod'), 'Algorithm') !== C14N_ALG) problems.push('SignedInfo canonicalization is not C14N 1.0');
  for (const ref of childrenNs(si, DS_NS, 'Reference')) {
    const uri = attr(ref, 'URI') ?? '';
    const transforms = childrenNs(child(ref, DS_NS, 'Transforms'), DS_NS, 'Transform').map((t) => attr(t, 'Algorithm'));
    let bytes: string;
    if (uri === '') {
      if (transforms.join() !== ENVELOPED) { problems.push(`reference "": unsupported transforms ${transforms.join()}`); continue; }
      bytes = canonicalizeDocument(doc, { exclude: [sig] });
    } else if (uri.startsWith('#')) {
      const target = elementById(doc.root, uri.slice(1));
      if (!target) { problems.push(`reference ${uri}: target not found`); continue; }
      if (transforms.some((t) => t !== C14N_ALG)) { problems.push(`reference ${uri}: unsupported transforms`); continue; }
      bytes = canonicalizeSubtree(target);
    } else { problems.push(`reference ${uri}: external references are not used`); continue; }
    const mk = DIGESTS[attr(child(ref, DS_NS, 'DigestMethod'), 'Algorithm') ?? ''];
    if (!mk) { problems.push(`reference ${uri}: unknown digest`); continue; }
    const md = mk();
    md.update(bytes, 'utf8');
    if (forge.util.encode64(md.digest().getBytes()) !== textOf(child(ref, DS_NS, 'DigestValue'))) problems.push(`reference "${uri}": digest mismatch`);
  }
  const certB64 = textOf(child(child(child(sig, DS_NS, 'KeyInfo'), DS_NS, 'X509Data'), DS_NS, 'X509Certificate')).replace(/\s+/g, '');
  let cert: forge.pki.Certificate | undefined;
  try { cert = certFromB64(certB64).cert; } catch { problems.push('KeyInfo carries no readable certificate'); }
  const mkSig = SIG_DIGESTS[attr(child(si, DS_NS, 'SignatureMethod'), 'Algorithm') ?? ''];
  if (!mkSig) problems.push('unknown SignatureMethod');
  if (cert && si && mkSig) {
    const md = mkSig();
    md.update(canonicalizeSubtree(si), 'utf8');
    try {
      const ok = (cert.publicKey as forge.pki.rsa.PublicKey).verify(md.digest().getBytes(), forge.util.decode64(textOf(child(sig, DS_NS, 'SignatureValue')).replace(/\s+/g, '')));
      if (!ok) problems.push('SignatureValue does not verify');
    } catch { problems.push('SignatureValue does not verify'); }
  }
  return { valid: problems.length === 0, problems, signerCertificate: cert };
}

// ---------------------------------------------------------------------------
// Structure — what checkFacturae (einvoiceValueRules) asks of a signed file
// ---------------------------------------------------------------------------

export interface XadesStructure {
  signed: boolean;
  /** ds:Signature is a child of the root and carries the three references the policy demands. */
  enveloped: boolean;
  policyIdentifier?: string;
  policyDigest?: string;
  policyDigestAlgorithm?: string;
  hasSigningTime: boolean;
  hasSigningCertificate: boolean;
  claimedRole?: string;
  /** Problems in policy terms, English (for the rule finding's message). */
  problems: string[];
}

/**
 * Is the signature STRUCTURALLY a Facturae v3.1 XAdES-EPES? Pure and
 * crypto-free (it runs on every export gate). Cryptographic validity is
 * verifyFacturaeSignature / the DSS validator.
 */
export function facturaeSignatureStructure(xml: string): XadesStructure {
  const res: XadesStructure = { signed: false, enveloped: false, hasSigningTime: false, hasSigningCertificate: false, problems: [] };
  let doc;
  try { doc = parseXmlDocument(xml); } catch { res.problems.push('not well-formed'); return res; }
  const sig = doc.root.children.find((c) => c.type === 'element' && isNs(c, DS_NS, 'Signature')) as XElement | undefined;
  if (!sig) return res;
  res.signed = true;
  const refs = childrenNs(child(sig, DS_NS, 'SignedInfo'), DS_NS, 'Reference');
  const sp = findElement(sig, (e) => isNs(e, XADES_NS, 'SignedProperties'));
  const ki = child(sig, DS_NS, 'KeyInfo');
  const docRef = refs.find((r) => (attr(r, 'URI') ?? '') === '');
  const docRefEnveloped = !!docRef && childrenNs(child(docRef, DS_NS, 'Transforms'), DS_NS, 'Transform').some((t) => attr(t, 'Algorithm') === ENVELOPED);
  const spId = attr(sp, 'Id');
  const kiId = attr(ki, 'Id');
  const spRef = !!spId && refs.some((r) => attr(r, 'URI') === `#${spId}` && /^http:\/\/uri\.etsi\.org\/01903(\/v1\.\d\.\d)?#SignedProperties$/.test(attr(r, 'Type') ?? ''));
  const kiRef = !!kiId && refs.some((r) => attr(r, 'URI') === `#${kiId}`);
  if (!docRefEnveloped) res.problems.push('no enveloped reference to the whole invoice (URI="")');
  if (!spRef) res.problems.push('SignedProperties are not signed');
  if (!kiRef) res.problems.push('KeyInfo (the certificate) is not signed');
  if (!textOf(child(child(ki, DS_NS, 'X509Data'), DS_NS, 'X509Certificate'))) res.problems.push('KeyInfo carries no certificate');
  res.enveloped = docRefEnveloped && spRef && kiRef;
  const ssp = child(sp, XADES_NS, 'SignedSignatureProperties');
  res.hasSigningTime = !!textOf(child(ssp, XADES_NS, 'SigningTime'));
  res.hasSigningCertificate = !!(child(ssp, XADES_NS, 'SigningCertificate') ?? child(ssp, XADES_NS, 'SigningCertificateV2'));
  if (!res.hasSigningTime) res.problems.push('no SigningTime');
  const spi = child(child(ssp, XADES_NS, 'SignaturePolicyIdentifier'), XADES_NS, 'SignaturePolicyId');
  res.policyIdentifier = textOf(child(child(spi, XADES_NS, 'SigPolicyId'), XADES_NS, 'Identifier')) || undefined;
  const hash = child(spi, XADES_NS, 'SigPolicyHash');
  res.policyDigestAlgorithm = attr(child(hash, DS_NS, 'DigestMethod'), 'Algorithm');
  res.policyDigest = textOf(child(hash, DS_NS, 'DigestValue')) || undefined;
  if (res.policyIdentifier !== FACTURAE_POLICY.identifier) res.problems.push(`policy identifier is "${res.policyIdentifier ?? ''}", not the Facturae v3.1 policy`);
  else if (res.policyDigest !== FACTURAE_POLICY.digestValue || res.policyDigestAlgorithm !== FACTURAE_POLICY.digestAlgorithm) res.problems.push('SigPolicyHash is not the Facturae v3.1 policy digest');
  const roles = childrenNs(child(child(ssp, XADES_NS, 'SignerRole'), XADES_NS, 'ClaimedRoles'), XADES_NS, 'ClaimedRole').map(textOf);
  if (roles.length > 1) res.problems.push('SignerRole carries more than one ClaimedRole');
  res.claimedRole = roles[0];
  if (res.claimedRole !== undefined && !['emisor', 'supplier', 'receptor', 'customer', 'tercero', 'third party'].includes(res.claimedRole)) res.problems.push(`ClaimedRole "${res.claimedRole}" is not one the policy allows`);
  return res;
}

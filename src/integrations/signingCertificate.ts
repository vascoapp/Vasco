// =============================================================================
// A contractor's signing certificate (.p12 / .pfx) — read, judged, never logged
// =============================================================================
// Spain: FACe accepts a Facturae only signed (Orden HAP/1650/2015 Anexo II.2)
// with a certificate the contractor already has — almost always the FNMT one
// they use for the AEAT. They import it ONCE (app/contractor/facturae-certificate.tsx);
// this module turns the file + password into what signFacturae needs and the
// three facts the screen shows: holder, NIF, expiry.
//
// Pure (node-forge only). Refuses rather than guesses:
//   · wrong password / not a PKCS#12           → 'unreadable'
//   · no private key, or no certificate for it → 'noKey'
//   · not RSA (FACe's policy §6: RSA)          → 'notRsa'
//   · expired / not yet valid                  → 'expired' / 'notYetValid'
//   · no NIF in the certificate                → 'noNif'
//   · NIF ≠ the seller's NIF                   → 'nifMismatch' — a signature by
//     someone else is not the issuer's signature (SignerRole "emisor").
//
// Where an FNMT certificate keeps the NIF (FNMT "Certificado de Persona Física"
// / "de Representante", DPC 2024): subject serialNumber (2.5.4.5)
// "IDCES-12345678Z" for the person; a representative certificate also carries
// the ENTITY in organizationIdentifier (2.5.4.97) "VATES-B12345678". Older
// certificates have the bare NIF in serialNumber, or "… - NIF 12345678Z" in the
// CN. All of them are read; a company signs with its representative's
// certificate, so its CIF matches through organizationIdentifier.
// =============================================================================

import * as forge from 'node-forge';
import { checkSpanishTaxId } from './fiscalIds';
import type { SigningMaterial } from './facturaeSignature';

export interface CertificateInfo {
  holder: string;
  /** Every Spanish tax id the certificate names (person and, for a representative, the entity). */
  nifs: string[];
  /** The id that matched the seller, when checked. */
  nif?: string;
  notBefore: string;
  notAfter: string;
  issuer: string;
  serialNumber: string;
}

export type CertificateProblem = 'unreadable' | 'noKey' | 'notRsa' | 'expired' | 'notYetValid' | 'noNif' | 'nifMismatch' | 'cannotSign';

export type CertificateReadResult =
  | { ok: true; material: SigningMaterial; info: CertificateInfo }
  | { ok: false; problem: CertificateProblem; info?: CertificateInfo };

const OID_SERIAL = '2.5.4.5';
const OID_ORG_ID = '2.5.4.97';
const OID_CN = '2.5.4.3';
const OID_O = '2.5.4.10';

const attrValue = (name: forge.pki.Certificate['subject'], oid: string): string | undefined => {
  const a = name.attributes.find((x) => x.type === oid);
  return a ? String(a.value) : undefined;
};

/** The Spanish NIFs a certificate subject names, normalized (no ES prefix). */
export function certificateNifs(cert: forge.pki.Certificate): string[] {
  const candidates: string[] = [];
  const serial = attrValue(cert.subject, OID_SERIAL);
  if (serial) candidates.push(serial.replace(/^(IDC|PAS|TIN)ES-/i, ''));
  const orgId = attrValue(cert.subject, OID_ORG_ID);
  if (orgId) candidates.push(orgId.replace(/^(VAT|NTR)ES-/i, ''));
  const cn = attrValue(cert.subject, OID_CN) ?? '';
  for (const m of cn.matchAll(/\b(?:NIF:?\s*)?([0-9XYZKLM]\d{7}[A-Z]|[A-W]\d{7}[0-9A-J])\b/gi)) candidates.push(m[1]);
  const out: string[] = [];
  for (const c of candidates) {
    const chk = checkSpanishTaxId(c);
    if (chk.valid && !out.includes(chk.bare)) out.push(chk.bare);
  }
  return out;
}

const infoOf = (cert: forge.pki.Certificate): CertificateInfo => ({
  holder: attrValue(cert.subject, OID_CN) ?? attrValue(cert.subject, OID_O) ?? '',
  nifs: certificateNifs(cert),
  notBefore: cert.validity.notBefore.toISOString(),
  notAfter: cert.validity.notAfter.toISOString(),
  issuer: attrValue(cert.issuer, OID_CN) ?? attrValue(cert.issuer, OID_O) ?? '',
  serialNumber: cert.serialNumber,
});

/** keyUsage permits a signature: digitalSignature or nonRepudiation. No
 *  keyUsage extension at all = unrestricted (RFC 5280 §4.2.1.3). */
function maySign(cert: forge.pki.Certificate): boolean {
  const ku = cert.getExtension('keyUsage') as { digitalSignature?: boolean; nonRepudiation?: boolean } | null;
  return !ku || !!ku.digitalSignature || !!ku.nonRepudiation;
}

/**
 * Reads a PKCS#12 (binary string, one char per byte) with its password.
 * `sellerNif` and `now` judge it for signing Facturae as that seller.
 */
export function readSigningCertificate(p12Binary: string, password: string, sellerNif: string | undefined, now: Date = new Date()): CertificateReadResult {
  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(p12Binary), false, password);
  } catch {
    return { ok: false, problem: 'unreadable' };
  }
  const keyBags = [
    ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? []),
    ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? []),
  ];
  const certs = (p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [])
    .map((b) => b.cert).filter((c): c is forge.pki.Certificate => !!c);
  // A key bag whose key forge could not decode (EC, or an unsupported cipher) has no .key.
  const keys = keyBags.map((b) => b.key).filter((k) => !!k) as forge.pki.rsa.PrivateKey[];
  if (keys.length === 0) {
    const anyKeyBag = keyBags.length > 0;
    return { ok: false, problem: anyKeyBag ? 'notRsa' : 'noKey', info: certs[0] ? infoOf(certs[0]) : undefined };
  }
  const rsaKeys = keys.filter((k) => !!k.n);
  if (rsaKeys.length === 0) return { ok: false, problem: 'notRsa' };
  // The (key, certificate) PAIR — not the first key: a file can carry several
  // keys, and the first one need not have its certificate here (security
  // review, 2026-10-02). A pair whose certificate may sign comes first.
  const pairs = rsaKeys.flatMap((k) => certs
    .filter((c) => (c.publicKey as forge.pki.rsa.PublicKey).n?.compareTo(k.n) === 0)
    .map((c) => ({ key: k, signer: c })));
  if (pairs.length === 0) return { ok: false, problem: 'noKey' };
  const pair = pairs.find((p) => maySign(p.signer)) ?? pairs[0];
  const key = pair.key;
  const signer = pair.signer;
  // An authentication-only certificate (keyUsage without digitalSignature or
  // nonRepudiation) would sign here and be rejected by FACe / @firma later.
  if (!maySign(signer)) return { ok: false, problem: 'cannotSign', info: infoOf(signer) };
  const info = infoOf(signer);
  if (now.getTime() > signer.validity.notAfter.getTime()) return { ok: false, problem: 'expired', info };
  if (now.getTime() < signer.validity.notBefore.getTime()) return { ok: false, problem: 'notYetValid', info };
  if (info.nifs.length === 0) return { ok: false, problem: 'noNif', info };
  const want = sellerNif ? checkSpanishTaxId(sellerNif).bare : '';
  const match = info.nifs.find((n) => n === want);
  if (!want || !match) return { ok: false, problem: 'nifMismatch', info };
  // Chain: the signer first, then the others the file carries (issuer CAs).
  const chain = [signer, ...certs.filter((c) => c !== signer)];
  return {
    ok: true,
    info: { ...info, nif: match },
    material: {
      privateKeyPem: forge.pki.privateKeyInfoToPem(forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(key))),
      certificatesDer: chain.map((c) => forge.util.encode64(forge.asn1.toDer(forge.pki.certificateToAsn1(c)).getBytes())),
    },
  };
}

/**
 * Re-judges stored material at signing time: a certificate valid at import can
 * have expired since, and the profile's NIF can have changed.
 */
export function judgeStoredCertificate(material: SigningMaterial, sellerNif: string | undefined, now: Date = new Date()): CertificateReadResult {
  let cert: forge.pki.Certificate;
  try {
    cert = forge.pki.certificateFromAsn1(forge.asn1.fromDer(forge.util.decode64(material.certificatesDer[0])));
  } catch {
    return { ok: false, problem: 'unreadable' };
  }
  const info = infoOf(cert);
  if (now.getTime() > cert.validity.notAfter.getTime()) return { ok: false, problem: 'expired', info };
  if (now.getTime() < cert.validity.notBefore.getTime()) return { ok: false, problem: 'notYetValid', info };
  const want = sellerNif ? checkSpanishTaxId(sellerNif).bare : '';
  const match = info.nifs.find((n) => n === want);
  if (!want || !match) return { ok: false, problem: 'nifMismatch', info };
  return { ok: true, material, info: { ...info, nif: match } };
}

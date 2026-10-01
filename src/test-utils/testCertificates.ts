// THROWAWAY signing certificates for tests — minted in-process with node-forge,
// never written to disk, never committed. FNMT-shaped subjects: serialNumber
// "IDCES-<DNI>" for the person, organizationIdentifier "VATES-<CIF>" for a
// representative of a company. TEST ONLY: the issuer says so.
import * as forge from 'node-forge';
import type { SigningMaterial } from '../integrations/facturaeSignature';

export interface TestCertificate {
  material: SigningMaterial;
  cert: forge.pki.Certificate;
  certDer: string; // binary string
  p12Binary: string;
  password: string;
}

let keyCache: forge.pki.rsa.KeyPair | undefined;
/** One 2048-bit key per test process (generation is the slow part). */
export const testKeyPair = (): forge.pki.rsa.KeyPair =>
  (keyCache ??= forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 }));

export function makeTestCertificate(opts: {
  person?: string; // DNI/NIE → serialNumber IDCES-…
  entity?: string; // CIF → organizationIdentifier VATES-…
  cn?: string;
  notBefore?: Date;
  notAfter?: Date;
  password?: string;
  p12Algorithm?: '3des' | 'aes256';
  withKey?: boolean;
  /** keyUsage extension; omitted = none (unrestricted). */
  keyUsage?: { digitalSignature?: boolean; nonRepudiation?: boolean; keyEncipherment?: boolean };
  /** Put an UNRELATED private key (no certificate here) before the real one. */
  strayKeyFirst?: boolean;
} = {}): TestCertificate {
  const keys = testKeyPair();
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '0a1b2c3d';
  cert.validity.notBefore = opts.notBefore ?? new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = opts.notAfter ?? new Date(Date.now() + 30 * 86_400_000);
  const subject: forge.pki.CertificateField[] = [{ shortName: 'C', value: 'ES' }];
  if (opts.entity) subject.push({ type: '2.5.4.97', value: `VATES-${opts.entity}` }, { shortName: 'O', value: 'TEST ONLY SL' });
  if (opts.person) subject.push({ type: '2.5.4.5', value: `IDCES-${opts.person}` });
  subject.push({ shortName: 'CN', value: opts.cn ?? `TEST ONLY ${opts.person ?? ''}${opts.entity ? ` (R: ${opts.entity})` : ''}`.trim() });
  cert.setSubject(subject);
  cert.setIssuer([{ shortName: 'C', value: 'ES' }, { shortName: 'O', value: 'VASCO TEST ONLY' }, { shortName: 'CN', value: 'VASCO TEST CA - NOT TRUSTED' }]);
  if (opts.keyUsage) cert.setExtensions([{ name: 'keyUsage', critical: true, ...opts.keyUsage }]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const password = opts.password ?? 'test-only-pw';
  let p12 = forge.pkcs12.toPkcs12Asn1(opts.withKey === false ? null : keys.privateKey, [cert], password, { algorithm: opts.p12Algorithm ?? 'aes256' });
  if (opts.strayKeyFirst) {
    // Two MAC-less containers, their AuthenticatedSafe contents concatenated:
    // stray key first, then the real key + certificate.
    const stray = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 0x10001 }).privateKey;
    const a = forge.pkcs12.toPkcs12Asn1(stray, null as any, password, { algorithm: 'aes256', useMac: false });
    const b = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, { algorithm: opts.p12Algorithm ?? 'aes256', useMac: false });
    const inner = (pfx: any) => forge.asn1.fromDer(pfx.value[1].value[1].value[0].value);
    const merged = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [...inner(a).value, ...inner(b).value] as any);
    (b as any).value[1].value[1].value[0].value = forge.asn1.toDer(merged).getBytes();
    p12 = b;
  }
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  return {
    cert,
    certDer,
    password,
    p12Binary: forge.asn1.toDer(p12).getBytes(),
    material: { privateKeyPem: forge.pki.privateKeyToPem(keys.privateKey), certificatesDer: [forge.util.encode64(certDer)] },
  };
}

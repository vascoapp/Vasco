/**
 * @jest-environment node
 */
// Reading the contractor's .p12 (src/integrations/signingCertificate.ts): what
// the import screen shows (holder, NIF, expiry) and every refusal — wrong
// password, no key, expired, not yet valid, no NIF, someone else's NIF. A
// company signs with its REPRESENTATIVE's certificate: its CIF is read from
// organizationIdentifier (VATES-…), the person's DNI from serialNumber (IDCES-…).
import * as forge from 'node-forge';
import { readSigningCertificate, judgeStoredCertificate, certificateNifs } from '../signingCertificate';
import { signFacturae, verifyFacturaeSignature } from '../facturaeSignature';
import { makeTestCertificate } from '../../test-utils/testCertificates';

const DAY = 86_400_000;
const NOW = new Date();

describe('a good certificate', () => {
  const rep = makeTestCertificate({ person: '12345678Z', entity: 'B12345674', cn: '12345678Z PEDRO RUIZ (R: B12345674)' });

  it('a company (CIF) signs with its representative\'s certificate — matched through organizationIdentifier', () => {
    const r = readSigningCertificate(rep.p12Binary, rep.password, 'ESB12345674', NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.info).toMatchObject({ holder: '12345678Z PEDRO RUIZ (R: B12345674)', nif: 'B12345674', issuer: 'VASCO TEST CA - NOT TRUSTED' });
    expect(r.info.nifs).toEqual(['12345678Z', 'B12345674']);
    // X.509 time has whole seconds.
    expect(new Date(r.info.notAfter).getTime()).toBe(Math.floor(rep.cert.validity.notAfter.getTime() / 1000) * 1000);
  });

  it('what it hands over signs, and the signature verifies', () => {
    const r = readSigningCertificate(rep.p12Binary, rep.password, 'B12345674', NOW);
    if (!r.ok) throw new Error(r.problem);
    expect(r.material.privateKeyPem).toMatch(/^-----BEGIN PRIVATE KEY-----/);
    const xml = signFacturae('<fe:Facturae xmlns:fe="http://www.facturae.gob.es/formato/Versiones/Facturaev3_2_2.xml"><FileHeader/></fe:Facturae>', r.material);
    expect(verifyFacturaeSignature(xml).valid).toBe(true);
  });

  it('a sole trader (autónomo) matches on the DNI in serialNumber; legacy 3DES .p12 files are read too', () => {
    const person = makeTestCertificate({ person: '12345678Z', cn: 'NAVARRO GOMEZ LUCIA - 12345678Z', p12Algorithm: '3des' });
    const r = readSigningCertificate(person.p12Binary, person.password, '12345678Z', NOW);
    expect(r).toMatchObject({ ok: true, info: { nif: '12345678Z' } });
  });

  it('an older certificate with the NIF only in its CN ("… - NIF 12345678Z")', () => {
    const old = makeTestCertificate({ cn: 'NOMBRE NAVARRO GOMEZ LUCIA - NIF 12345678Z' });
    expect(certificateNifs(old.cert)).toEqual(['12345678Z']);
    expect(readSigningCertificate(old.p12Binary, old.password, '12345678Z', NOW).ok).toBe(true);
  });
});

describe('refusals, each by name', () => {
  const good = makeTestCertificate({ person: '12345678Z', entity: 'B12345674' });
  it('wrong password → unreadable; not a PKCS#12 at all → unreadable', () => {
    expect(readSigningCertificate(good.p12Binary, 'wrong', 'B12345674', NOW)).toEqual({ ok: false, problem: 'unreadable' });
    expect(readSigningCertificate('not a p12', 'x', 'B12345674', NOW)).toEqual({ ok: false, problem: 'unreadable' });
  });
  it('a certificate exported WITHOUT its private key → noKey', () => {
    const noKey = makeTestCertificate({ person: '12345678Z', withKey: false });
    expect(readSigningCertificate(noKey.p12Binary, noKey.password, '12345678Z', NOW)).toMatchObject({ ok: false, problem: 'noKey' });
  });
  it('expired → expired (with its date); not yet valid → notYetValid', () => {
    const expired = makeTestCertificate({ person: '12345678Z', notBefore: new Date(Date.now() - 400 * DAY), notAfter: new Date(Date.now() - DAY) });
    expect(readSigningCertificate(expired.p12Binary, expired.password, '12345678Z', NOW)).toMatchObject({ ok: false, problem: 'expired', info: { nifs: ['12345678Z'] } });
    const future = makeTestCertificate({ person: '12345678Z', notBefore: new Date(Date.now() + DAY), notAfter: new Date(Date.now() + 400 * DAY) });
    expect(readSigningCertificate(future.p12Binary, future.password, '12345678Z', NOW)).toMatchObject({ ok: false, problem: 'notYetValid' });
  });
  it('no Spanish NIF in it → noNif', () => {
    const anon = makeTestCertificate({ cn: 'Somebody' });
    expect(readSigningCertificate(anon.p12Binary, anon.password, '12345678Z', NOW)).toMatchObject({ ok: false, problem: 'noNif' });
  });
  it('another business\'s NIF → nifMismatch; and a missing seller NIF is never a match', () => {
    expect(readSigningCertificate(good.p12Binary, good.password, 'B87654323', NOW)).toMatchObject({ ok: false, problem: 'nifMismatch' });
    expect(readSigningCertificate(good.p12Binary, good.password, undefined, NOW)).toMatchObject({ ok: false, problem: 'nifMismatch' });
  });
  it('an invalid NIF in the certificate (bad control letter) is not read as a NIF', () => {
    const bad = makeTestCertificate({ person: '12345678A' });
    expect(certificateNifs(bad.cert)).toEqual([]);
  });
});

it('stored material is judged again at signing time: expiry since import, a changed profile NIF', () => {
  const c = makeTestCertificate({ person: '12345678Z', entity: 'B12345674', notAfter: new Date(Date.now() + 2 * DAY) });
  expect(judgeStoredCertificate(c.material, 'B12345674', NOW).ok).toBe(true);
  expect(judgeStoredCertificate(c.material, 'B12345674', new Date(Date.now() + 3 * DAY))).toMatchObject({ ok: false, problem: 'expired' });
  expect(judgeStoredCertificate(c.material, 'B87654323', NOW)).toMatchObject({ ok: false, problem: 'nifMismatch' });
  expect(judgeStoredCertificate({ ...c.material, certificatesDer: [forge.util.encode64('junk')] }, 'B12345674', NOW)).toMatchObject({ ok: false, problem: 'unreadable' });
});

// Sign or not at export (src/services/facturaeSigning.ts). FACe-only buyers
// (P/S) are never handed an unsigned file: no certificate → needCertificate,
// a bad one → certificateProblem. Everyone else is signed when a usable
// certificate is stored and unsigned otherwise — never blocked.
import { makeTestCertificate } from '../../test-utils/testCertificates';
import { facturaeSignatureStructure, verifyFacturaeSignature } from '../../integrations/facturaeSignature';

const mockStored: { current: any } = { current: null };
jest.mock('../signingCertificateStore', () => ({
  loadSigningCertificate: jest.fn(async (owner: string) => (mockStored.current && mockStored.current.owner === owner ? mockStored.current : null)),
}));

// eslint-disable-next-line import/first
import { signFacturaeForExport, sellerNifOf } from '../facturaeSigning';

const XML = '<?xml version="1.0" encoding="UTF-8"?>\n<fe:Facturae xmlns:fe="http://www.facturae.gob.es/formato/Versiones/Facturaev3_2_2.xml" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">\n  <FileHeader/>\n</fe:Facturae>';
const DAY = 86_400_000;
const good = makeTestCertificate({ person: '12345678Z', entity: 'B12345674' });
const expired = makeTestCertificate({ person: '12345678Z', entity: 'B12345674', notBefore: new Date(Date.now() - 90 * DAY), notAfter: new Date(Date.now() - DAY) });
const store = (c: typeof good) => ({ owner: 'u1', material: c.material, info: {}, importedAt: '' });
const run = (buyerNif: string) => signFacturaeForExport(XML, { buyerNif, sellerNif: 'ESB12345674', owner: 'u1' });

beforeEach(() => { mockStored.current = null; });

it('the seller NIF is the one the mapper uses: vatNumber, else registrationNumber', () => {
  expect(sellerNifOf({ vatNumber: 'ESB12345674', registrationNumber: 'X' })).toBe('ESB12345674');
  expect(sellerNifOf({ registrationNumber: 'B12345674' })).toBe('B12345674');
  expect(sellerNifOf(null)).toBeUndefined();
});

describe('FACe-only buyer (P local, S State)', () => {
  it.each(['P2807900B', 'S2800568D'])('%s without a certificate → needCertificate', async (nif) => {
    expect(await run(nif)).toEqual({ kind: 'needCertificate' });
  });
  it('an expired certificate → certificateProblem expired (never an unsigned file)', async () => {
    mockStored.current = store(expired);
    expect(await run('P2807900B')).toMatchObject({ kind: 'certificateProblem', problem: 'expired' });
  });
  it('a certificate of another business → certificateProblem nifMismatch', async () => {
    mockStored.current = store(good);
    expect(await signFacturaeForExport(XML, { buyerNif: 'P2807900B', sellerNif: 'B87654323', owner: 'u1' })).toMatchObject({ kind: 'certificateProblem', problem: 'nifMismatch' });
  });
  it('another account\'s certificate is not this account\'s → needCertificate', async () => {
    mockStored.current = { ...store(good), owner: 'someone-else' };
    expect(await run('P2807900B')).toEqual({ kind: 'needCertificate' });
  });
  it('a usable certificate → signed, structurally Facturae XAdES-EPES, and it verifies', async () => {
    mockStored.current = store(good);
    const r = await run('P2807900B');
    expect(r.kind).toBe('signed');
    if (r.kind !== 'signed') return;
    expect(facturaeSignatureStructure(r.xml).problems).toEqual([]);
    expect(verifyFacturaeSignature(r.xml).valid).toBe(true);
  });
});

describe('business buyer, and Q bodies that may sit outside FACe', () => {
  it.each(['B87654323', 'Q2826000H'])('%s without a certificate → unsigned, untouched', async (nif) => {
    expect(await run(nif)).toEqual({ kind: 'unsigned', xml: XML });
  });
  it('an expired certificate is not used, does not block a B2B invoice — and says why (2026-10-02)', async () => {
    mockStored.current = store(expired);
    expect(await run('B87654323')).toMatchObject({ kind: 'unsigned', xml: XML, because: { problem: 'expired' } });
  });
  it('a usable certificate → signed (decision: sign when available)', async () => {
    mockStored.current = store(good);
    expect((await run('B87654323')).kind).toBe('signed');
  });
});

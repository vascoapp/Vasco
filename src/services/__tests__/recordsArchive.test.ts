/**
 * @jest-environment node
 *
 * Before deleting, the contractor downloads their INVOICES — each issued one
 * as the PDF the customer received plus the market's e-invoice — and the
 * archive SAYS what it could not produce (export, then delete, 2026-09-24).
 * The ZIP is read back by the system `unzip`, not by our own code.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

let mockZip: Uint8Array | null = null;
let mockPrintFails = new Set<string>();
let mockPrinted: string[] = [];
jest.mock('expo-print', () => ({
  printToFileAsync: async ({ html }: { html: string }) => {
    const hit = [...mockPrintFails].find((n) => html.includes(n));
    if (hit) throw new Error('print failed');
    mockPrinted.push(html);
    return { uri: `file:///cache/p${mockPrinted.length}.pdf` };
  },
}));
// The archive is STREAMED through a FileHandle at explicit offsets; the mock
// places each write at its offset, as the device does.
jest.mock('expo-file-system', () => ({
  Paths: { cache: 'file:///cache' },
  File: class {
    uri: string; name: string; exists = false;
    constructor(a: string, b?: string) { this.uri = b ? `${a}/${b}` : a; this.name = b ?? a; }
    async bytes() { return Uint8Array.from([0x25, 0x50, 0x44, 0x46, this.uri.length]); } // "%PDF"
    create() { mockZip = new Uint8Array(0); }
    open() {
      const h = {
        offset: 0 as number | null,
        writeBytes(b: Uint8Array) {
          const at = h.offset ?? 0;
          const grown = new Uint8Array(Math.max(mockZip!.length, at + b.length));
          grown.set(mockZip!); grown.set(b, at); mockZip = grown;
          h.offset = at + b.length;
        },
        close() {},
      };
      return h;
    }
    delete() {}
  },
}));
jest.mock('expo-sharing', () => ({ isAvailableAsync: async () => true, shareAsync: async () => undefined }));

import { exportRecordsArchive } from '../recordsArchiveService';

const t = (_k: string, fb: string, o?: Record<string, unknown>) => fb.replace(/\{\{(\w+)\}\}/g, (_, k) => String(o?.[k] ?? ''));
const hasUnzip = (() => { try { execFileSync('unzip', ['-v'], { stdio: 'ignore' }); return true; } catch { return false; } })();
const unzipList = (zip: Uint8Array) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arch-'));
  const f = path.join(dir, 'a.zip');
  fs.writeFileSync(f, zip);
  execFileSync('unzip', ['-tq', f]);
  execFileSync('unzip', ['-q', f, '-d', path.join(dir, 'x')]);
  return { dir: path.join(dir, 'x'), names: execFileSync('unzip', ['-Z1', f], { encoding: 'utf8' }).trim().split('\n').sort() };
};

// Complete for a German invoice (checkInvoiceReadiness): HRB included.
const bpDE = { businessName: 'Sanitär Becker GmbH', registrationNumber: 'HRB 12345', vatNumber: 'DE123456789', country: 'DE', city: 'Köln', postcode: '50667', address: 'Ring 1', email: 'a@b.de', phone: '0221', iban: 'DE89370400440532013000' } as any;
const customers = [{ id: 'c1', name: 'Familie Müller', city: 'Köln', postcode: '50667', country: 'DE' }] as any;
const inv = (id: string, status: string, extra: any = {}) => ({ id, customer: 'Familie Müller', customerId: 'c1', job: 'Bad', amount: 119, status, dueInDays: 14, createdAt: '2026-09-01T10:00:00Z', ...extra });

beforeEach(() => { mockZip = null; mockPrintFails = new Set(); mockPrinted = []; });

(hasUnzip ? it : it.skip)('every issued invoice as PDF + XRechnung; drafts are not issued documents', async () => {
  const r = await exportRecordsArchive({
    invoices: [inv('RE-2026-0001', 'paid'), inv('RE-2026-0002', 'sent'), inv('RE-2026-0003', 'draft')] as any,
    lineItems: { 'RE-2026-0001': [{ description: 'Armatur', quantity: 1, unitPrice: 100, vatRate: 19 }] },
    customers, jobs: [], businessProfile: bpDE, country: 'DE', t, now: new Date('2026-09-24T12:00:00Z'),
  });
  expect(r).toMatchObject({ ok: true, invoiceCount: 2, pdfFailed: [], complete: true });
  const { dir, names } = unzipList(mockZip!);
  expect(names).toEqual([
    'README.txt',
    'invoices/RE-2026-0001-xrechnung.xml', 'invoices/RE-2026-0001.pdf',
    'invoices/RE-2026-0002-xrechnung.xml', 'invoices/RE-2026-0002.pdf',
  ]);
  const xml = fs.readFileSync(path.join(dir, 'invoices/RE-2026-0001-xrechnung.xml'), 'utf8');
  expect(xml).toContain('Familie Müller');       // the resolved buyer, in UTF-8
  expect(xml).toContain('RE-2026-0001');
  expect(fs.readFileSync(path.join(dir, 'README.txt'), 'utf8')).toContain('Issued invoices: 2');
  // The archived XRechnung through the repo's validator (BR-DE rules, BT-10…).
  // NOT KoSIT — ours is not authoritative (einvoice-mandate-wedge memory); the
  // KoSIT run is owed and needs a Java runtime.
  const { DOMParser } = require('@xmldom/xmldom');
  const { validateXmlString } = require('../../../admin/src/lib/einvoice-validator');
  const v = validateXmlString(xml, (x: string) => new DOMParser().parseFromString(x, 'text/xml'));
  expect(v.format).toBe('UBL Invoice');
  expect(v.findings.filter((f: any) => f.severity === 'error').map((f: any) => `${f.rule}: ${f.message}`)).toEqual([]);
});

(hasUnzip ? it : it.skip)('a PDF that fails and an e-invoice that cannot be built are NAMED, and the archive is not complete', async () => {
  mockPrintFails.add('RE-2026-0002');
  const r = await exportRecordsArchive({
    invoices: [inv('RE-2026-0001', 'sent'), inv('RE-2026-0002', 'sent')] as any,
    lineItems: {}, customers: [{ id: 'c1', name: 'Familie Müller' }] as any, jobs: [],
    businessProfile: { ...bpDE, country: 'IT' }, country: 'IT', t,
  });
  expect(r.complete).toBe(false);
  expect(r.pdfFailed).toEqual(['RE-2026-0002']);
  expect(r.xmlMissing.map((m) => [m.number, m.kind])).toEqual([['RE-2026-0001', 'fields'], ['RE-2026-0002', 'fields']]);
  const { dir, names } = unzipList(mockZip!);
  expect(names).toEqual(['README.txt', 'invoices/RE-2026-0001.pdf']);
  const readme = fs.readFileSync(path.join(dir, 'README.txt'), 'utf8');
  expect(readme).toMatch(/PDF could not be created[\s\S]*RE-2026-0002/);
  expect(readme).toMatch(/No e-invoice in this archive:[\s\S]*RE-2026-0001: missing details/);
});

it('UK has no e-invoice format — said, not silently skipped', async () => {
  const r = await exportRecordsArchive({
    invoices: [inv('INV-0001', 'sent')] as any, lineItems: {}, customers, jobs: [],
    businessProfile: { ...bpDE, country: 'UK' }, country: 'UK', t,
  });
  expect(r.xmlMissing).toEqual([{ number: 'INV-0001', reason: 'no e-invoice format for this country', kind: 'noFormat' }]);
  expect(r.complete).toBe(true);
});

(hasUnzip ? it : it.skip)('XRechnung only with the BR-DE details: a customer without city/post code gets the PDF and a README line', async () => {
  const r = await exportRecordsArchive({
    invoices: [inv('RE-2026-0001', 'sent')] as any, lineItems: {},
    customers: [{ id: 'c1', name: 'Familie Müller' }] as any, jobs: [],
    businessProfile: bpDE, country: 'DE', t,
  });
  expect(r.xmlMissing).toEqual([{ number: 'RE-2026-0001', kind: 'fields', reason: 'missing details: customer city and post code' }]);
  const { names } = unzipList(mockZip!);
  expect(names).toEqual(['README.txt', 'invoices/RE-2026-0001.pdf']);
});

(hasUnzip ? it : it.skip)('two invoices with one number keep their PDF and XML paired; a hostile number cannot climb out', async () => {
  await exportRecordsArchive({
    invoices: [inv('RE-1', 'sent'), { ...inv('RE-1', 'paid'), id: 'x2', reference: 'RE-1' }, inv('../../evil', 'sent')] as any,
    lineItems: {}, customers, jobs: [], businessProfile: bpDE, country: 'DE', t,
  });
  const { names } = unzipList(mockZip!);
  expect(names).toEqual([
    'README.txt',
    'invoices/RE-1-2-xrechnung.xml', 'invoices/RE-1-2.pdf',
    'invoices/RE-1-xrechnung.xml', 'invoices/RE-1.pdf',
    'invoices/evil-xrechnung.xml', 'invoices/evil.pdf',
  ]);
});

it('without a business profile the e-invoice is withheld and named, and the rate is the country standard', async () => {
  const r = await exportRecordsArchive({
    invoices: [inv('RE-9', 'sent')] as any, lineItems: {}, customers, jobs: [],
    businessProfile: null, country: 'DE', t,
  });
  expect(r.xmlMissing[0]).toMatchObject({ number: 'RE-9', kind: 'fields' });
  expect(r.xmlMissing[0].reason).toMatch(/your business details/);
  // The synthesised line: 119 gross at DE 19% is 100 net, not 119 at 0%.
  expect(mockPrinted[0]).toMatch(/100[,.]00/);
});

/**
 * @jest-environment node
 *
 * The records archive is a ZIP written in-house (src/utils/storedZip.ts), so
 * it is checked by INDEPENDENT readers: CRC-32 against Node's zlib, and the
 * archive against the system `unzip` — integrity, names, bytes.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import { execFileSync } from 'child_process';
import { crc32, utf8, zipStored, safeZipName } from '../storedZip';

const hasUnzip = (() => { try { execFileSync('unzip', ['-v'], { stdio: 'ignore' }); return true; } catch { return false; } })();

it('CRC-32 matches zlib', () => {
  const zc = (zlib as any).crc32 as ((d: Uint8Array) => number) | undefined;
  const samples = [new Uint8Array(0), utf8('Rechnung RE-2026-0001'), Uint8Array.from({ length: 5000 }, (_, i) => (i * 31) % 256)];
  for (const s of samples) {
    if (zc) expect(crc32(s)).toBe(zc(s));
  }
  expect(crc32(utf8('123456789'))).toBe(0xcbf43926); // the standard check value
});

it('UTF-8 encodes like Buffer', () => {
  for (const s of ['Müller', 'Façade', '€ 1.234,50', '日本', '😀']) {
    expect(Buffer.from(utf8(s)).toString('hex')).toBe(Buffer.from(s, 'utf8').toString('hex'));
  }
});

(hasUnzip ? it : it.skip)('the system unzip reads every entry back byte-for-byte', () => {
  const pdf = Uint8Array.from({ length: 70000 }, (_, i) => (i * 7 + 3) % 256); // binary
  const entries = [
    { name: 'README.txt', data: utf8('Rechnungen 2026\n') },
    { name: 'invoices/RE-2026-0001.pdf', data: pdf },
    { name: 'invoices/RE-2026-0001-xrechnung.xml', data: utf8('<?xml version="1.0"?><Invoice>Bäckerei Müller</Invoice>') },
    { name: safeZipName('invoices/Rechnung Müller & Söhne (Köln).pdf'), data: utf8('x') },
    { name: 'empty.txt', data: new Uint8Array(0) },
  ];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zip-'));
  const zip = path.join(dir, 'a.zip');
  fs.writeFileSync(zip, zipStored(entries, new Date(2026, 8, 24, 13, 30, 10)));
  execFileSync('unzip', ['-tq', zip]); // throws on any CRC / structure error
  const out = path.join(dir, 'out');
  execFileSync('unzip', ['-q', zip, '-d', out]);
  for (const e of entries) {
    expect(Buffer.compare(fs.readFileSync(path.join(out, e.name)), Buffer.from(e.data))).toBe(0);
  }
});

it('refuses what it cannot write correctly', () => {
  expect(() => zipStored([{ name: 'a', data: new Uint8Array(1) }, { name: 'a', data: new Uint8Array(1) }])).toThrow(/duplicate/);
});

it('names are folded to ASCII, so even a reader that ignores the UTF-8 flag extracts them as written', () => {
  expect(safeZipName('invoices/Rechnung Müller & Söhne (Köln).pdf')).toBe('invoices/Rechnung-Mueller-Soehne-Koeln-.pdf');
  expect(safeZipName('Façade São Paulo straße')).toBe('Facade-Sao-Paulo-strasse');
  expect(safeZipName('RE-2026-0001-xrechnung.xml')).toBe('RE-2026-0001-xrechnung.xml');
});

it('no entry name climbs out of the folder it is extracted into', () => {
  expect(safeZipName('invoices/../../etc/x.pdf')).toBe('invoices/etc/x.pdf');
  expect(safeZipName('/abs/RE-1.pdf')).toBe('abs/RE-1.pdf');
});

(hasUnzip ? it : it.skip)('the streaming writer produces the same archive as the in-memory one', () => {
  const { StoredZipWriter } = require('../storedZip');
  const entries = [{ name: 'a.txt', data: utf8('eins') }, { name: 'b/c.pdf', data: Uint8Array.from([1, 2, 3, 255]) }];
  const when = new Date(2026, 8, 25, 9, 0, 0);
  const chunks: Uint8Array[] = [];
  const w = new StoredZipWriter((b: Uint8Array) => chunks.push(b.slice()), when);
  for (const e of entries) w.add(e.name, e.data);
  w.finish();
  const streamed = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  expect(streamed.equals(Buffer.from(zipStored(entries, when)))).toBe(true);
});

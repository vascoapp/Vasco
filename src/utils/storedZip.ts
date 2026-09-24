/**
 * A ZIP archive of STORED (uncompressed) entries — PKWARE APPNOTE 6.3, the
 * subset every unzipper reads: one local header per file, a central
 * directory, an end record. No compression: the archive's PDFs are already
 * compressed, and a dependency could not be installed on this Drive-synced
 * checkout (2026-09-24). Pure JS, so it ships over the air.
 *
 * Limits (asserted): < 65,535 entries and < 4 GiB — no ZIP64.
 * Verified against the system `unzip` in its test.
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** UTF-8 bytes of a string (TextEncoder is not guaranteed on every Hermes). */
export function utf8(s: string): Uint8Array {
  const out: number[] = [];
  for (const ch of s) {
    let cp = ch.codePointAt(0)!;
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else { out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63)); }
  }
  return Uint8Array.from(out);
}

export interface ZipEntry { name: string; data: Uint8Array }

/** DOS date/time of a JS date, as ZIP stores it. */
function dosDateTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/**
 * Writes STORED entries to a sink as they arrive and keeps only the central
 * directory (~50 bytes per entry) — so an archive of hundreds of PDFs never
 * sits in memory twice (review 2026-09-24: ~2x the archive on a phone).
 */
export class StoredZipWriter {
  private central: Uint8Array[] = [];
  private offset = 0;
  private names = new Set<string>();
  private readonly time: number;
  private readonly date: number;

  constructor(private readonly sink: (bytes: Uint8Array) => void, when: Date = new Date()) {
    ({ time: this.time, date: this.date } = dosDateTime(when));
  }

  add(entryName: string, data: Uint8Array): void {
    if (this.names.has(entryName)) throw new Error(`zipStored: duplicate entry ${entryName}`);
    if (this.central.length >= 0xfffe) throw new Error('zipStored: too many entries (no ZIP64)');
    this.names.add(entryName);
    const name = utf8(entryName);
    const crc = crc32(data);
    const size = data.length;
    if (this.offset + 30 + name.length + size > 0xffffffff) throw new Error('zipStored: archive over 4 GiB (no ZIP64)');

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // local file header signature
    lv.setUint16(4, 20, true);         // version needed: 2.0
    lv.setUint16(6, 0x0800, true);     // flags: UTF-8 names
    lv.setUint16(8, 0, true);          // method: stored
    lv.setUint16(10, this.time, true);
    lv.setUint16(12, this.date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);      // compressed = uncompressed
    lv.setUint32(22, size, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);         // extra length
    local.set(name, 30);

    const cd = new Uint8Array(46 + name.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true); // central directory signature
    cv.setUint16(4, 20, true);         // version made by
    cv.setUint16(6, 20, true);         // version needed
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, this.time, true);
    cv.setUint16(14, this.date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, name.length, true);
    // extra, comment, disk start, internal attrs = 0; external attrs = 0
    cv.setUint32(42, this.offset, true); // local header offset
    cd.set(name, 46);

    this.sink(local);
    this.sink(data);
    this.central.push(cd);
    this.offset += local.length + size;
  }

  /** Central directory + end record. Nothing may be added afterwards. */
  finish(): void {
    const cdSize = this.central.reduce((n, c) => n + c.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true); // end of central directory
    ev.setUint16(8, this.central.length, true);
    ev.setUint16(10, this.central.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, this.offset, true);
    for (const c of this.central) this.sink(c);
    this.sink(end);
  }
}

/** The whole archive in memory — for small archives and tests. */
export function zipStored(entries: ZipEntry[], when: Date = new Date()): Uint8Array {
  const parts: Uint8Array[] = [];
  const w = new StoredZipWriter((b) => parts.push(b), when);
  for (const e of entries) w.add(e.name, e.data);
  w.finish();
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let p = 0;
  for (const part of parts) { out.set(part, p); p += part.length; }
  return out;
}

/**
 * An entry name every unzipper extracts as written. The UTF-8 flag is set,
 * but Apple's bundled `unzip` ignores it and writes "Müller" as "M++ller"
 * (seen in the test, 2026-09-24) — and the archive goes to an accountant
 * whose tools we do not know. Letters are folded to ASCII, anything else
 * outside [A-Za-z0-9._-/] becomes '-'.
 */
export function safeZipName(name: string): string {
  const folded = name
    .replace(/ß/g, 'ss').replace(/Æ/g, 'AE').replace(/æ/g, 'ae').replace(/Ø/g, 'O').replace(/ø/g, 'o')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .normalize?.('NFD').replace(/[\u0300-\u036f]/g, '') ?? name;
  // …and no path that climbs out of the extraction folder ("zip-slip"):
  // '..' and empty segments go, and nothing starts at the root.
  return folded
    .replace(/[^A-Za-z0-9._\-/]+/g, '-').replace(/-{2,}/g, '-')
    .split('/').filter((seg) => seg !== '' && seg !== '.' && seg !== '..').join('/');
}

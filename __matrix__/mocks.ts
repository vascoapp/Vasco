/**
 * Native boundaries of the everyday matrix — the ONLY things not real.
 * Each captures what the app hands over, so the validator half can judge the
 * actual artefact: the HTML expo-print would render, the bytes/XML written
 * through expo-file-system, what was shared.
 *
 * Fonts for the PDF/A-3 hybrid are read from the same Inter TTFs the app
 * bundles (node_modules), bypassing expo-asset — the asset download is a
 * device concern, checked on the emulator (#388), not an invoice-content one.
 */
import fs from 'fs';
import path from 'path';

export interface Capture {
  html: string[];
  files: Record<string, string | Uint8Array>;
  shared: Array<{ uri?: string; message?: string; title?: string }>;
}
export const capture = (): Capture => {
  const g = globalThis as any;
  g.__matrixCapture = g.__matrixCapture ?? { html: [], files: {}, shared: [] };
  return g.__matrixCapture;
};

export const printMock = {
  printToFileAsync: async (opts: { html: string }) => {
    capture().html.push(opts.html);
    return { uri: `file:///cache/print-${capture().html.length}.pdf` };
  },
};

const nameOf = (parts: any[]) => parts.map((p) => (typeof p === 'string' ? p : p?.uri ?? '')).join('/').replace(/\/+/g, '/').split('/').pop() ?? '';

class MockFile {
  uri: string;
  name: string;
  constructor(...parts: any[]) {
    this.name = nameOf(parts);
    this.uri = `file:///cache/${this.name}`;
  }
  get exists() { return Object.prototype.hasOwnProperty.call(capture().files, this.name); }
  create() { /* write() records */ }
  delete() { delete capture().files[this.name]; }
  write(data: string | Uint8Array) { capture().files[this.name] = data; }
  move(_to: any) { /* named-PDF rename: irrelevant to content */ }
  async text() { const d = capture().files[this.name]; return typeof d === 'string' ? d : Buffer.from(d ?? '').toString('utf8'); }
  async bytes() { const d = capture().files[this.name]; return typeof d === 'string' ? new TextEncoder().encode(d) : (d ?? new Uint8Array()); }
  async base64() { const d = capture().files[this.name]; return Buffer.from(typeof d === 'string' ? d : (d ?? new Uint8Array())).toString('base64'); }
}

export const fileSystemMock = {
  File: MockFile,
  Paths: { cache: { uri: 'file:///cache' }, document: { uri: 'file:///doc' } },
  documentDirectory: 'file:///doc/',
  cacheDirectory: 'file:///cache/',
  writeAsStringAsync: async (uri: string, data: string) => { capture().files[uri.split('/').pop()!] = data; },
  readAsStringAsync: async () => '',
  deleteAsync: async () => {},
  getInfoAsync: async () => ({ exists: false }),
  EncodingType: { UTF8: 'utf8', Base64: 'base64' },
};

export const sharingMock = {
  isAvailableAsync: async () => true,
  shareAsync: async (uri: string, opts?: { dialogTitle?: string }) => { capture().shared.push({ uri, title: opts?.dialogTitle }); },
};

const font = (rel: string) => new Uint8Array(fs.readFileSync(path.join(process.cwd(), 'node_modules/@expo-google-fonts/inter', rel)));
export const pdfA3FontsMock = {
  loadPdfA3Fonts: async () => ({
    regular: font('400Regular/Inter_400Regular.ttf'),
    bold: font('700Bold/Inter_700Bold.ttf'),
  }),
};

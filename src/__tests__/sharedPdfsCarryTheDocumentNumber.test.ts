// The customer received the German invoice RE-2026-0087 as
// "4b190e6c-420d-4d2f-bb86-5faf7dd4ea2f.pdf": expo-print's random cache name
// went straight into the share sheet (emulator, 2026-09-30). Every PDF a
// customer receives is renamed to its document number first.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const moves: Array<{ from: string; to: string }> = [];
jest.mock('expo-file-system', () => {
  class File {
    uri: string;
    exists = false;
    constructor(a: any, b?: string) { this.uri = b ? `${a.uri ?? a}/${b}` : String(a); }
    delete() {}
    move(to: File) { moves.push({ from: this.uri, to: to.uri }); this.uri = to.uri; }
    async base64() { return ''; }
  }
  return { File, Paths: { cache: { uri: 'file:///cache' } } };
});
jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(async () => ({ uri: 'file:///cache/Print/4b190e6c-420d-4d2f-bb86-5faf7dd4ea2f.pdf' })),
}));
const shared: string[] = [];
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async (uri: string) => { shared.push(uri); }),
}));

import { pdfFileName } from '../utils/namedPdf';
import { generateInvoicePdf } from '../services/invoicePdfService';
import { generateQuotePdf } from '../services/quotePdfService';
import { shareReceipt } from '../services/receiptShareService';

beforeEach(() => { shared.length = 0; moves.length = 0; });

it('names only away what a file system refuses', () => {
  expect(pdfFileName('RE-2026-0087')).toBe('RE-2026-0087.pdf');
  expect(pdfFileName('Zahlungsbeleg RE/2026:0087')).toBe('Zahlungsbeleg-RE-2026-0087.pdf');
  expect(pdfFileName('')).toBe('document.pdf');
});

const invoice = {
  id: 'i1', invoiceNumber: 'RE-2026-0087', jobId: 'j1', customerId: 'c1', customerName: 'Bäckerei Lindner GmbH',
  issueDate: new Date('2026-08-17'), dueDate: new Date('2026-09-16'), status: 'overdue',
  lineItems: [{ description: 'Trinkwasserleitung', quantity: 1, unitPrice: 4369.75, vatRate: 19, total: 4369.75 }],
  subtotal: 4369.75, vatAmount: 830.25, total: 5200, paidAmount: 0, payments: [], reminders: [],
} as any;

it('the invoice PDF reaches the share sheet as RE-2026-0087.pdf', async () => {
  await generateInvoicePdf(invoice, { businessName: 'Bergmann Sanitär', country: 'DE', language: 'de' });
  expect(shared).toEqual(['file:///cache/RE-2026-0087.pdf']);
});

it('the quote PDF reaches the share sheet under its number', async () => {
  await generateQuotePdf(
    { quoteNumber: 'AN-2026-0041', customerName: 'Anja Hoffmann', jobTitle: 'Badsanierung', issueDate: '2026-09-30', validUntil: '2026-10-30', lineItems: [{ description: 'Fliesen', quantity: 12, unitPrice: 40, vatRate: 19 }], subtotal: 480, vatAmount: 91.2, total: 571.2 },
    'Bergmann Sanitär', 'Köln', '', '', { language: 'de', country: 'DE' },
  );
  expect(shared).toEqual(['file:///cache/AN-2026-0041.pdf']);
});

it('the receipt reaches the share sheet under its heading and number', async () => {
  await shareReceipt({ invoice: { ...invoice, id: 'RE-2026-0087', amount: 5200 }, businessName: 'Bergmann Sanitär', locale: 'de', country: 'DE' } as any);
  expect(shared).toEqual(['file:///cache/Zahlungsbeleg-RE-2026-0087.pdf']);
});

it('no service shares a printed PDF without naming it', () => {
  const dir = path.resolve(__dirname, '../services');
  const offenders = fs.readdirSync(dir).filter((f) => f.endsWith('.ts')).filter((f) => {
    const src = stripComments(fs.readFileSync(path.join(dir, f), 'utf8'));
    return src.includes('printToFileAsync') && src.includes('shareAsync') && !src.includes('nameThePdf(');
  });
  // Internal documents (VAT prep for the accountant, budget) are allowed a
  // random name only by being listed here on purpose.
  expect(offenders.sort()).toEqual(['budgetPdfService.ts', 'vatPrepExportService.ts'].filter((f) => offenders.includes(f)));
});

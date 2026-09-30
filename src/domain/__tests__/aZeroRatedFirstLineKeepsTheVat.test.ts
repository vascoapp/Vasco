/**
 * @jest-environment node
 */
// `lineItems[0]?.vatRate ?? 0` was the document's fallback at three call sites,
// and a 0 fallback means "no VAT at all" — an invoice whose FIRST line was
// 0 % printed no VAT rows under a Total that included VAT (review 2026-09-30).
let captured = '';
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn(async ({ html }: { html: string }) => { captured = html; return { uri: 'file://x.pdf' }; }) }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(async () => false), shareAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({ File: class { uri = ''; constructor(a: any) { this.uri = String(a); } move() {} delete() {} }, Paths: { cache: { uri: 'file:///cache' } } }));

import { documentFallbackRate } from '../business';
import { renderInvoicePdfFile } from '../../services/invoicePdfService';

it('the fallback is the highest line rate, not the first', () => {
  expect(documentFallbackRate([{ vatRate: 0 }, { vatRate: 19 }])).toBe(19);
  expect(documentFallbackRate([{ vatRate: 0 }])).toBe(0);
  expect(documentFallbackRate([{}], 21)).toBe(21);
});

it('an invoice whose first line is 0 % still prints its VAT row', async () => {
  await renderInvoicePdfFile({
    id: 'i1', invoiceNumber: 'RE-2026-0101', jobId: 'j1', customerId: 'c1', customerName: 'Familie Schneider',
    issueDate: new Date('2026-09-30'), dueDate: new Date('2026-10-30'), status: 'draft',
    lineItems: [
      { description: 'Anfahrt (steuerfrei)', quantity: 1, unitPrice: 50, vatRate: 0, total: 50 },
      { description: 'Wartung', quantity: 1, unitPrice: 100, vatRate: 19, total: 100 },
    ],
    subtotal: 150, vatAmount: 19, total: 169, paidAmount: 0, payments: [], reminders: [],
  } as any, { businessName: 'Bergmann Sanitär', country: 'DE', language: 'de', vatScheme: 'standard' } as any);
  // The 19 % row with € 19,00 is printed.
  expect(captured).toMatch(/19%<\/span><span>[^<]*19,00/);
});

it('no document takes its FIRST line\'s rate as its fallback', () => {
  const fs = require('fs');
  const path = require('path');
  const { stripComments } = require('../../utils/stripComments');
  const root = path.resolve(__dirname, '../../..');
  const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e: any) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return e.name === '__tests__' || e.name === 'node_modules' ? [] : walk(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
  const offenders = [...walk(path.join(root, 'src')), ...walk(path.join(root, 'app'))]
    .filter((f) => /\[0\]\??\.vatRate\s*\?\?\s*0\b/.test(stripComments(fs.readFileSync(f, 'utf8'))))
    .map((f) => path.relative(root, f));
  expect(offenders).toEqual([]);
});

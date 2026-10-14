/**
 * The quote PDF's own label table had lost its accents in four languages —
 * "Gultig bis", "Erstellt fur", "Conditions generales", "Valido hasta",
 * "contactenos", "e valido" — on a document the CUSTOMER reads. The invoice
 * PDF had the same loss, fixed in #389; this table was missed. The renderer is
 * UTF-8 HTML (other labels in the same table always carried accents).
 */
import fs from 'fs';
import path from 'path';

const mockHtml: string[] = [];
jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(async ({ html }: { html: string }) => { mockHtml.push(html); return { uri: 'file:///tmp/q.pdf' }; }),
}));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(async () => false), shareAsync: jest.fn() }));

import { generateQuotePdf, type QuotePdfData } from '../services/quotePdfService';

const quote = {
  quoteNumber: 'Q-1', customerName: 'Kunde', jobTitle: 'Bad', issueDate: '01.10.2026', validUntil: '31.10.2026',
  lineItems: [{ description: 'Arbeit', quantity: 1, unitPrice: 100, vatRate: 19 }],
  subtotal: 100, vatRate: 19, vatAmount: 19, total: 119, notes: 'x', terms: 'y',
} as unknown as QuotePdfData;
const html = async (language: string, country?: any) => {
  mockHtml.length = 0;
  await generateQuotePdf(quote, 'Firma', 'Str. 1', '', '', { language, country });
  return mockHtml[0];
};

const STRIPPED: Record<string, RegExp> = {
  de: /\b(Gultig|gultig|Erstellt fur|Geschaftsbedingungen)\b/,
  fr: /\b(Etabli|generales|repondre|Propulse par)\b/,
  es: /\b(Valido|valido|Terminos|contactenos|Opcion)\b/,
  it: /\b(Qta|e valido)\b/,
};

it.each(Object.keys(STRIPPED))('%s labels keep their accents', async (lang) => {
  const h = await html(lang);
  expect(h).not.toMatch(STRIPPED[lang]);
});

it('a German quote reads German', async () => {
  const h = await html('de');
  expect(h).toContain('Gültig bis');
  expect(h).toContain('Allgemeine Geschäftsbedingungen');
});

it('a UK quote is in pounds — and the quote screen passes the country', async () => {
  expect(await html('en', 'UK')).toContain('£');
  const src = fs.readFileSync(path.resolve(__dirname, '../../app/quotes/[id].tsx'), 'utf8');
  expect(src).toMatch(/\{ vatScheme: businessProfile\.vatScheme, country \}/);
  expect(src).toMatch(/const country = businessProfile\.country \?\? user\?\.country/);
});

it('no label in the table has lost its accent — including ones a plain quote never prints', () => {
  // `optionLabel` prints only on a tiered quote; read the table itself.
  const src = fs.readFileSync(path.resolve(__dirname, '../services/quotePdfService.ts'), 'utf8');
  const table = src.slice(src.indexOf('const LABELS'), src.indexOf('function getLabels'));
  // Each language's own block: "Valido fino al" is correct Italian.
  for (const [lang, re] of Object.entries(STRIPPED)) {
    const start = table.indexOf(`\n  ${lang}: {`);
    expect(start).toBeGreaterThan(0);
    const block = table.slice(start, table.indexOf('\n  },', start));
    expect(block).not.toMatch(re);
  }
});

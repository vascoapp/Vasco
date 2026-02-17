/**
 * Spreadsheet Parser — reads Excel/CSV files and returns structured data.
 * Uses the `xlsx` library for both .xlsx and .csv parsing.
 */

import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';

// ── Types ──────────────────────────────────────────────────

export interface ParsedSheet {
  name: string;
  headers: string[];
  rows: Record<string, string | number>[];
  rowCount: number;
}

export interface ParsedSpreadsheet {
  fileName: string;
  sheets: ParsedSheet[];
  totalRows: number;
}

export type SpreadsheetType = 'invoice' | 'price_list' | 'budget' | 'unknown';

// ── Parser ─────────────────────────────────────────────────

/**
 * Read an Excel or CSV file from a local URI and parse into structured sheets.
 */
export async function parseSpreadsheet(uri: string): Promise<ParsedSpreadsheet> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: 'base64',
  });

  const workbook = XLSX.read(base64, { type: 'base64' });
  const fileName = uri.split('/').pop() ?? 'unknown';

  const sheets: ParsedSheet[] = [];
  let totalRows = 0;

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    if (!ws) continue;

    const jsonRows = XLSX.utils.sheet_to_json<Record<string, string | number>>(ws, {
      defval: '',
    });

    const headers = jsonRows.length > 0 ? Object.keys(jsonRows[0]) : [];

    sheets.push({
      name: sheetName,
      headers,
      rows: jsonRows,
      rowCount: jsonRows.length,
    });

    totalRows += jsonRows.length;
  }

  return { fileName, sheets, totalRows };
}

// ── Type Detection ─────────────────────────────────────────

const INVOICE_KEYWORDS = [
  /factuur/i, /invoice/i, /btw/i, /vat/i, /totaal/i,
  /leverancier/i, /supplier/i, /factuurnr/i, /invoice.?#/i,
];

const PRICE_LIST_KEYWORDS = [
  /prijs/i, /price/i, /catalogus/i, /catalog/i,
  /artikelnr/i, /sku/i, /ean/i, /tarief/i,
];

const BUDGET_KEYWORDS = [
  /kostenbegroting/i, /budget/i, /kostenraming/i, /begroting/i,
  /VVO/i, /BVO/i, /GDV/i, /deelbudget/i,
  /kostenpost/i, /begroot/i, /nacalculatie/i, /staartkosten/i,
];

/**
 * Heuristic: classify a sheet as invoice, price list, or unknown
 * based on header names and content patterns.
 */
export function detectSpreadsheetType(sheet: ParsedSheet): SpreadsheetType {
  const headerStr = sheet.headers.join(' ').toLowerCase();
  const sampleStr = sheet.rows.slice(0, 5)
    .map((r) => Object.values(r).join(' '))
    .join(' ');
  const combined = `${headerStr} ${sampleStr}`;

  let invoiceScore = 0;
  let priceListScore = 0;
  let budgetScore = 0;

  for (const kw of INVOICE_KEYWORDS) {
    if (kw.test(combined)) invoiceScore++;
  }
  for (const kw of PRICE_LIST_KEYWORDS) {
    if (kw.test(combined)) priceListScore++;
  }
  for (const kw of BUDGET_KEYWORDS) {
    if (kw.test(combined)) budgetScore++;
  }

  if (budgetScore >= 2) return 'budget';
  if (invoiceScore >= 2) return 'invoice';
  if (priceListScore >= 2) return 'price_list';
  if (budgetScore > invoiceScore && budgetScore > priceListScore) return 'budget';
  if (invoiceScore > priceListScore) return 'invoice';
  if (priceListScore > invoiceScore) return 'price_list';
  return 'unknown';
}

/**
 * Budget Workbook Extractor — processes parsed Excel spreadsheets into
 * structured budget lines. Detects Dutch+English column names and converts
 * rows into ExtractedBudgetLine format for the budget analysis pipeline.
 */

import type { ParsedSpreadsheet, ParsedSheet } from './spreadsheetParser';

// ── Types ──────────────────────────────────────────────────

export interface ExtractedBudgetLine {
  id: string;
  costCode: string;
  description: string;
  category: string;
  subcategory: string;
  quantity: number;
  unit: string;
  unitRate: number;
  total: number;
  supplier?: string;
  sheetSource: string;
  confidence: number;
}

export interface BudgetExtractionResult {
  projectName: string;
  totalBudget: number;
  currency: string;
  lines: ExtractedBudgetLine[];
  categories: BudgetCategorySummary[];
  metadata: {
    fileName: string;
    sheetsProcessed: number;
    totalLinesExtracted: number;
    averageConfidence: number;
  };
}

export interface BudgetCategorySummary {
  name: string;
  total: number;
  lineCount: number;
  percentage: number;
}

// ── Column Mapping ─────────────────────────────────────────

type BudgetFieldType =
  | 'costCode' | 'description' | 'category' | 'subcategory'
  | 'quantity' | 'unit' | 'unitRate' | 'total'
  | 'supplier';

const BUDGET_FIELD_PATTERNS: Record<BudgetFieldType, RegExp[]> = {
  costCode: [/kostenpost/i, /kostcode/i, /code/i, /cost.?code/i, /nr/i, /nummer/i],
  description: [/omschrijving/i, /description/i, /werkzaamheden/i, /activiteit/i, /post/i],
  category: [/categorie/i, /category/i, /hoofdgroep/i, /groep/i],
  subcategory: [/subcategorie/i, /subcategory/i, /deelgroep/i, /onderdeel/i],
  quantity: [/aantal/i, /qty/i, /quantity/i, /hoeveelheid/i],
  unit: [/eenheid/i, /unit/i, /eeh/i],
  unitRate: [/prijs/i, /tarief/i, /eenheidsprijs/i, /price/i, /rate/i, /per.?eenheid/i],
  total: [/totaal/i, /total/i, /bedrag/i, /amount/i, /subtotaal/i],
  supplier: [/leverancier/i, /supplier/i, /aannemer/i, /vendor/i],
};

export interface BudgetColumnMapping {
  field: BudgetFieldType;
  column: string;
  confidence: number;
}

/**
 * Match sheet headers to known budget field types. Returns best-match for each field.
 */
export function detectBudgetColumns(headers: string[]): BudgetColumnMapping[] {
  const mappings: BudgetColumnMapping[] = [];

  for (const [field, patterns] of Object.entries(BUDGET_FIELD_PATTERNS) as [BudgetFieldType, RegExp[]][]) {
    let bestMatch: { column: string; confidence: number } | null = null;

    for (const header of headers) {
      for (let i = 0; i < patterns.length; i++) {
        if (patterns[i].test(header)) {
          const confidence = 1 - i * 0.1; // First pattern = highest confidence
          if (!bestMatch || confidence > bestMatch.confidence) {
            bestMatch = { column: header, confidence: Math.max(confidence, 0.5) };
          }
        }
      }
    }

    if (bestMatch) {
      mappings.push({ field, column: bestMatch.column, confidence: bestMatch.confidence });
    }
  }

  return mappings;
}

// ── Helpers ─────────────────────────────────────────────────

function getStr(
  row: Record<string, string | number>,
  mapping: BudgetColumnMapping[] | undefined,
  field: BudgetFieldType,
): string | undefined {
  const m = mapping?.find((c) => c.field === field);
  if (!m) return undefined;
  const val = row[m.column];
  return val != null && val !== '' ? String(val) : undefined;
}

function getNum(
  row: Record<string, string | number>,
  mapping: BudgetColumnMapping[] | undefined,
  field: BudgetFieldType,
): number {
  const m = mapping?.find((c) => c.field === field);
  if (!m) return 0;
  const val = row[m.column];
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const normalized = val.replace(/[€$\s]/g, '').replace(/\./g, '').replace(',', '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

// ── Category from Sheet Name ───────────────────────────────

/**
 * Extract a clean category name from a sheet name like "01 Sloopwerk" -> "Sloopwerk".
 * Strips leading numbers, dots, dashes, and whitespace.
 */
function categoryFromSheetName(sheetName: string): string {
  return sheetName.replace(/^[\d.\-\s]+/, '').trim() || sheetName;
}

// ── Extraction ─────────────────────────────────────────────

/**
 * Extract structured budget lines from a parsed workbook.
 * Processes ALL sheets, detects column mappings per sheet, deduplicates by costCode,
 * and computes category summaries.
 */
export function extractBudgetWorkbook(parsed: ParsedSpreadsheet): BudgetExtractionResult {
  const allLines: ExtractedBudgetLine[] = [];

  for (let sheetIndex = 0; sheetIndex < parsed.sheets.length; sheetIndex++) {
    const sheet = parsed.sheets[sheetIndex];
    const mapping = detectBudgetColumns(sheet.headers);
    const sheetCategory = categoryFromSheetName(sheet.name);

    for (let rowIndex = 0; rowIndex < sheet.rows.length; rowIndex++) {
      const row = sheet.rows[rowIndex];

      const description = getStr(row, mapping, 'description');
      const total = getNum(row, mapping, 'total');

      // Skip header/summary rows: no description or total = 0
      if (!description || total === 0) continue;

      const quantity = getNum(row, mapping, 'quantity') || 1;
      const unitRate = getNum(row, mapping, 'unitRate') || (total / quantity);
      const costCode = getStr(row, mapping, 'costCode') ?? '';
      const category = getStr(row, mapping, 'category') ?? sheetCategory;
      const subcategory = getStr(row, mapping, 'subcategory') ?? '';
      const unit = getStr(row, mapping, 'unit') ?? 'stuk';
      const supplier = getStr(row, mapping, 'supplier');

      // Confidence based on how many fields were successfully mapped
      const mappedCount = mapping.length;
      const confidence = mappedCount >= 6 ? 0.9 : mappedCount >= 4 ? 0.75 : 0.6;

      allLines.push({
        id: `bgt_${sheetIndex}_${rowIndex}`,
        costCode,
        description,
        category,
        subcategory,
        quantity,
        unit,
        unitRate,
        total,
        supplier,
        sheetSource: sheet.name,
        confidence,
      });
    }
  }

  // Deduplicate by costCode — keep highest confidence
  const deduped = deduplicateByCostCode(allLines);

  // Calculate category summaries
  const categories = buildCategorySummaries(deduped);

  // Total budget = sum of all line totals
  const totalBudget = deduped.reduce((sum, line) => sum + line.total, 0);

  // Average confidence
  const averageConfidence = deduped.length > 0
    ? deduped.reduce((sum, line) => sum + line.confidence, 0) / deduped.length
    : 0;

  // Derive project name from file name (strip extension)
  const projectName = parsed.fileName.replace(/\.[^.]+$/, '');

  return {
    projectName,
    totalBudget,
    currency: 'EUR',
    lines: deduped,
    categories,
    metadata: {
      fileName: parsed.fileName,
      sheetsProcessed: parsed.sheets.length,
      totalLinesExtracted: deduped.length,
      averageConfidence: Math.round(averageConfidence * 100) / 100,
    },
  };
}

// ── Deduplication ──────────────────────────────────────────

/**
 * Deduplicate budget lines by costCode. When duplicates exist, keep the one
 * with the highest confidence score.
 */
function deduplicateByCostCode(lines: ExtractedBudgetLine[]): ExtractedBudgetLine[] {
  const seen = new Map<string, ExtractedBudgetLine>();

  for (const line of lines) {
    // Lines without a costCode are always kept (no dedup key)
    if (!line.costCode) {
      seen.set(line.id, line);
      continue;
    }

    const existing = seen.get(line.costCode);
    if (!existing || line.confidence > existing.confidence) {
      seen.set(line.costCode, line);
    }
  }

  return Array.from(seen.values());
}

// ── Category Summaries ─────────────────────────────────────

/**
 * Build category summaries with totals, line counts, and percentage of budget.
 */
function buildCategorySummaries(lines: ExtractedBudgetLine[]): BudgetCategorySummary[] {
  const catMap = new Map<string, { total: number; lineCount: number }>();

  for (const line of lines) {
    const cat = line.category || 'Overig';
    const entry = catMap.get(cat) ?? { total: 0, lineCount: 0 };
    entry.total += line.total;
    entry.lineCount += 1;
    catMap.set(cat, entry);
  }

  const grandTotal = lines.reduce((sum, l) => sum + l.total, 0);

  const summaries: BudgetCategorySummary[] = [];

  for (const [name, { total, lineCount }] of catMap.entries()) {
    summaries.push({
      name,
      total,
      lineCount,
      percentage: grandTotal > 0 ? Math.round((total / grandTotal) * 10000) / 100 : 0,
    });
  }

  // Sort by total descending
  summaries.sort((a, b) => b.total - a.total);

  return summaries;
}

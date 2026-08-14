// =============================================================================
// PAYROLL CSV — separator and decimal mark are ONE decision
// =============================================================================
// This lived inline in app/contractor/payroll.tsx, where no test could reach it
// (learnings #138), and it was wrong: `;` separators with `.` decimals.
//
// `;` is the separator EU bookkeeping imports expect — but only BECAUSE
// comma-decimal locales need the comma for numbers. Pairing `;` with `.` is the
// one combination that is wrong everywhere: German and Dutch Excel opened the
// file and read every amount as text, and an English-locale Excel does not want
// `;` at all. The two conventions travel together.
//
// This is an accountant-facing export, so it states figures it cannot walk
// back. An unknown hourly rate exports BLANK, never 0 — a 0 in a payroll import
// asserts that the person costs nothing.
// =============================================================================

import type { Country } from '../i18n/formatting';

export interface PayrollCsvLine {
  name: string;
  hours: number;
  hourlyCost?: number;
  cost?: number;
}

export interface PayrollCsvLabels {
  name: string;
  hours: string;
  rate: string;
  cost: string;
}

/** UK and US read `.` decimals and therefore `,` separators. Everyone else is the pair. */
export function usesCommaDecimal(country: Country): boolean {
  return country !== 'UK' && country !== 'US';
}

export function csvSeparator(country: Country): ';' | ',' {
  return usesCommaDecimal(country) ? ';' : ',';
}

/** Fixed 2dp, decimal mark per country, and never a thousands separator — one would split the cell. */
export function csvNumber(n: number, country: Country): string {
  const fixed = n.toFixed(2);
  return usesCommaDecimal(country) ? fixed.replace('.', ',') : fixed;
}

/**
 * RFC4180 quoting. A worker called "Jansen, Piet" in a comma-separated file
 * would otherwise split one column into two and shift every later value along
 * the row — silently, into a payroll import.
 */
export function csvCell(value: string, country: Country): string {
  const sep = csvSeparator(country);
  if (value.includes(sep) || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildPayrollCsv(
  lines: PayrollCsvLine[],
  labels: PayrollCsvLabels,
  country: Country,
  period: { from: string; to: string },
): string {
  const sep = csvSeparator(country);
  const header = [labels.name, labels.hours, labels.rate, labels.cost]
    .map((h) => csvCell(h, country))
    .join(sep);
  const rows = lines.map((l) =>
    [
      csvCell(l.name, country),
      csvNumber(l.hours, country),
      l.hourlyCost === undefined ? '' : csvNumber(l.hourlyCost, country),
      l.cost === undefined ? '' : csvNumber(l.cost, country),
    ].join(sep),
  );
  return [`# ${period.from} — ${period.to}`, header, ...rows].join('\n');
}

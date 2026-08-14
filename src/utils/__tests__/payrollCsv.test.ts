/**
 * The export goes to the contractor's bookkeeper, so a misread column is a
 * wrong payroll figure in someone else's system.
 *
 * The bug: `;` separators with `.` decimals — the one combination wrong in
 * every locale. `;` exists because comma-decimal Excel needs the comma for
 * numbers, so pairing it with `.` meant German and Dutch Excel read every
 * amount as text.
 */
import {
  buildPayrollCsv, csvNumber, csvSeparator, csvCell, usesCommaDecimal,
} from '../payrollCsv';

const LABELS = { name: 'Name', hours: 'Hours', rate: 'Hourly cost', cost: 'Cost' };
const PERIOD = { from: '2026-08-01', to: '2026-08-14' };

describe('separator and decimal mark always agree', () => {
  it('pairs ; with , for comma-decimal countries', () => {
    for (const c of ['NL', 'DE', 'FR', 'ES', 'IT'] as const) {
      expect(csvSeparator(c)).toBe(';');
      expect(csvNumber(1234.5, c)).toBe('1234,50');
    }
  });

  it('pairs , with . for UK and US', () => {
    for (const c of ['UK', 'US'] as const) {
      expect(csvSeparator(c)).toBe(',');
      expect(csvNumber(1234.5, c)).toBe('1234.50');
    }
  });

  it('never emits the broken pair — a ; row must not contain a . decimal', () => {
    const csv = buildPayrollCsv([{ name: 'Weber', hours: 8, hourlyCost: 42.5, cost: 340 }], LABELS, 'DE', PERIOD);
    const row = csv.split('\n')[2];
    expect(row).toContain(';');
    expect(row).toBe('Weber;8,00;42,50;340,00');
    expect(row).not.toMatch(/\d\.\d/);
  });

  it('never emits a thousands separator, which would split the cell', () => {
    // 1.234,56 in a ;-file is fine; 1.234,56 written as "1.234,56" with a
    // thousands dot is two cells in a ,-file and ambiguous in either.
    expect(csvNumber(1234567.89, 'DE')).toBe('1234567,89');
    expect(csvNumber(1234567.89, 'US')).toBe('1234567.89');
  });
});

describe('a name containing the separator cannot shift the row', () => {
  it('quotes a comma-containing name in a comma-separated file', () => {
    expect(csvCell('Jansen, Piet', 'US')).toBe('"Jansen, Piet"');
  });

  it('leaves that same name unquoted where ; is the separator', () => {
    expect(csvCell('Jansen, Piet', 'NL')).toBe('Jansen, Piet');
  });

  it('quotes a semicolon-containing name in a ;-separated file', () => {
    expect(csvCell('Meier; Sohn', 'DE')).toBe('"Meier; Sohn"');
  });

  it('escapes embedded quotes by doubling them', () => {
    expect(csvCell('Bob "The Pipe"', 'US')).toBe('"Bob ""The Pipe"""');
  });

  it('keeps every row at exactly four fields even with a comma name', () => {
    const csv = buildPayrollCsv([{ name: 'Jansen, Piet', hours: 8, hourlyCost: 40, cost: 320 }], LABELS, 'US', PERIOD);
    const row = csv.split('\n')[2];
    // Naive split would give 5; the quoted field is one cell.
    expect(row).toBe('"Jansen, Piet",8.00,40.00,320.00');
  });
});

describe('an unknown rate stays unknown', () => {
  it('exports blank, never 0 — a 0 asserts the person costs nothing', () => {
    const csv = buildPayrollCsv([{ name: 'Weber', hours: 6 }], LABELS, 'DE', PERIOD);
    const row = csv.split('\n')[2];
    expect(row).toBe('Weber;6,00;;');
    expect(row).not.toContain('0,00;0,00');
  });

  it('still exports a REAL zero cost when one is recorded', () => {
    const csv = buildPayrollCsv([{ name: 'Azubi', hours: 4, hourlyCost: 0, cost: 0 }], LABELS, 'DE', PERIOD);
    expect(csv.split('\n')[2]).toBe('Azubi;4,00;0,00;0,00');
  });
});

describe('structure', () => {
  it('carries a period comment, a header, then one row per line', () => {
    const csv = buildPayrollCsv(
      [{ name: 'A', hours: 1, hourlyCost: 1, cost: 1 }, { name: 'B', hours: 2, hourlyCost: 2, cost: 4 }],
      LABELS, 'NL', PERIOD,
    );
    const lines = csv.split('\n');
    expect(lines[0]).toBe('# 2026-08-01 — 2026-08-14');
    expect(lines[1]).toBe('Name;Hours;Hourly cost;Cost');
    expect(lines).toHaveLength(4);
  });

  it('usesCommaDecimal covers every Country member', () => {
    for (const c of ['UK', 'NL', 'DE', 'FR', 'ES', 'IT', 'US'] as const) {
      expect(typeof usesCommaDecimal(c)).toBe('boolean');
    }
  });
});

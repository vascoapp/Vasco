// How numbers and text are WRITTEN into the Italian and Spanish e-invoices.
//
// Both authorities recompute a line from the figures printed in the file:
//   · SDI 00423 — PrezzoTotale = PrezzoUnitario × Quantita (± 0,01);
//   · Orden HAP/1650/2015 Anexo II 6a — TotalCost = round2(Quantity ×
//     UnitPriceWithoutTax), exactly.
// Quantities were printed with `toFixed(2)`, so 1,333 h became 1.33 and the
// file's own line no longer added up (both rejected, 2026-10-01). FatturaPA
// allows up to 8 decimals for Quantita and PrezzoUnitario, Facturae up to 8 for
// UnitPriceWithoutTax and any for Quantity: print what the contractor entered.
import { round2 } from '../utils/round2';

/** `n` with at least `min` and at most `max` decimals, trailing zeros dropped. */
export function decimalText(n: number, min = 2, max = 8): string {
  let s = (Object.is(n, -0) ? 0 : n).toFixed(max);
  if (Number(s) === 0) s = (0).toFixed(max);
  const dot = s.indexOf('.');
  if (dot < 0) return s;
  let end = s.length;
  while (end > dot + 1 + min && s[end - 1] === '0') end--;
  return s.slice(0, end === dot + 1 ? dot : end);
}

/** Money to the cent, through THE rounding rule — never `toFixed` on a raw float (73.315 → "73.31"). */
export const moneyText = (n: number): string => round2(n).toFixed(2);

// FatturaPA text elements are String…LatinType: Basic Latin + Latin-1
// Supplement only. An iPhone types ’ “ ” – … by default, and one of them in a
// line description made the whole file schema-invalid (SDI 00200). These have
// an exact Latin-1 spelling; anything else (emoji, ł, ő …) is left for the
// value-rule check to refuse with the field named — never silently dropped.
const LATIN1_SPELLING: Record<string, string> = {
  '‘': "'", '’': "'", '‚': "'", '‛': "'", '′': "'",
  '“': '"', '”': '"', '„': '"', '‟': '"', '″': '"',
  '‐': '-', '‑': '-', '‒': '-', '–': '-', '—': '-', '―': '-', '−': '-',
  '…': '...', '€': 'EUR', '•': '-', ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ',
};
export const latin1Text = (s: string): string =>
  s.replace(/[‘’‚‛′“”„‟″‐-―−…€•    ]/g, (c) => LATIN1_SPELLING[c] ?? c);

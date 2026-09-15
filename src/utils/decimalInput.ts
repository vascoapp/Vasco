// =============================================================================
// DECIMAL INPUT — reading a number a contractor TYPED
// =============================================================================
// `parseFloat("12,50")` is 12. Every EU6 market but the UK writes a decimal
// comma, and the German/Dutch/French keyboard's decimal key IS a comma, so a
// bare parseFloat silently dropped the cents from expenses, recurring amounts
// and material quantities. Sites that knew added `.replace(',', '.')` one at a
// time (pricebook, project billing, the quote builder, job forms); the rest
// did not. One rule, here.
//
// Rule for a single typed value (not a formatted report):
//   - both separators present → the LAST one is the decimal ("1.234,56", "1,234.56")
//   - one kind, repeated      → grouping ("1.234.567")
//   - one kind, once          → decimal ("12,5", "0,125", "12.5") — EXCEPT
//     the market's own GROUPING mark followed by exactly three digits, which
//     is how that market writes thousands: "1.500" in Germany is fifteen
//     hundred, "1,500" in the UK likewise. Both used to read as 1.5.
// Either separator is accepted as the decimal otherwise, because which key a
// phone's decimal pad emits depends on the keyboard, not on the app.
// =============================================================================

import { COUNTRY_CONFIG, type Country } from '../i18n/formatting';
import { getCurrentCountry } from '../lib/currentUser';

function decimalMarkFor(country: string | undefined): ',' | '.' {
  const cfg = COUNTRY_CONFIG[(country ?? '') as Country] ?? COUNTRY_CONFIG.NL;
  // `format`, not `formatToParts`: Hermes does not implement the latter, so it
  // passes in node and throws on every device (compactCurrency.test.ts).
  try {
    return new Intl.NumberFormat(cfg.locale).format(1.5).includes('.') ? '.' : ',';
  } catch {
    return ['UK', 'GB', 'US'].includes(String(country)) ? '.' : ',';
  }
}

/** The typed value as a number, or `undefined` for empty / not a number. */
export function parseDecimalInput(text: string | null | undefined, country?: Country | string): number | undefined {
  if (text == null) return undefined;
  let s = String(text).replace(/[\s  ']/g, '');
  if (!s) return undefined;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    const dec = lastComma > lastDot ? ',' : '.';
    const group = dec === ',' ? '.' : ',';
    s = s.split(group).join('').replace(dec, '.');
  } else {
    const sep = lastComma >= 0 ? ',' : lastDot >= 0 ? '.' : null;
    if (sep) {
      const count = s.split(sep).length - 1;
      const groupingMark = decimalMarkFor(country ?? getCurrentCountry()) === ',' ? '.' : ',';
      const isThousands = sep === groupingMark && /^-?[1-9]\d{0,2}[.,]\d{3}$/.test(s);
      s = count > 1 || isThousands ? s.split(sep).join('') : s.replace(sep, '.');
    }
  }
  // A trailing separator ("12,") is a number mid-typing, not an error.
  if (s.endsWith('.')) s = s.slice(0, -1);
  if (!/^-?\d*\.?\d+$/.test(s)) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * A number as it should appear inside an editable field: the market's decimal
 * separator, no grouping (a grouped "4.369,75" would be re-read as typed), at
 * most `maxDecimals` decimals, none when whole. `String(4369.747899)` put
 * "4369.747899159664" — with a POINT — in a German invoice line.
 *
 * `money`: a fractional amount always shows cents — "185,50", not "185,5"
 * (seen in the German quote builder, 2026-09-15). A whole amount stays "85".
 * Quantities pass their own `maxDecimals` (3): capping them at 2 displayed
 * 0,125 m as "0,13", and any edit to the field then saved 0.13.
 */
export function formatDecimalInput(
  n: number | null | undefined,
  country: Country = 'NL',
  maxDecimals = 2,
  money = false,
): string {
  if (n == null || !Number.isFinite(n)) return '';
  const cfg = COUNTRY_CONFIG[country] ?? COUNTRY_CONFIG.NL;
  const rounded = Math.round(n * 10 ** maxDecimals) / 10 ** maxDecimals;
  const minimumFractionDigits = money && !Number.isInteger(rounded) ? Math.min(2, maxDecimals) : 0;
  try {
    return new Intl.NumberFormat(cfg.locale, {
      useGrouping: false,
      minimumFractionDigits,
      maximumFractionDigits: maxDecimals,
    }).format(n);
  } catch {
    const s = minimumFractionDigits ? rounded.toFixed(minimumFractionDigits) : String(rounded);
    return decimalMarkFor(country) === ',' ? s.replace('.', ',') : s;
  }
}

import { getCurrentCountry } from '../lib/currentUser';
import { COUNTRY_CONFIG, type Country } from '../i18n/formatting';

/**
 * Format currency amounts consistently across the app.
 *
 * These used to read `amount.toLocaleString(undefined, …)` with a hardcoded
 * '€'. `undefined` means the DEVICE locale, so a Dutch contractor on an
 * English phone saw the Vandaag banner read "VASCO BESPAARDE €2.00" — US
 * grouping and a US decimal point — directly above euro amounts on the same
 * screen that were formatted correctly as "€ 350". The hardcoded symbol was
 * wrong for the UK and US markets on top of that.
 *
 * The contractor's COUNTRY decides both, which is what `formatCurrency` in
 * src/i18n/formatting.ts has always done. Country defaults to the signed-in
 * contractor via `getCurrentCountry()` — the same `?? 'NL'` fallback that
 * formatting.ts uses in twelve places — so the existing call sites are correct
 * without passing anything.
 *
 * The one behaviour kept from the old implementation: amounts >= 1000 drop the
 * decimals, which is what lets these fit in KPI tiles and card headers.
 */
function intl(country: Country | undefined, fractionDigits: number): Intl.NumberFormat {
  const c = country ?? ((getCurrentCountry() as Country) ?? 'NL');
  const { currency, locale } = COUNTRY_CONFIG[c] ?? COUNTRY_CONFIG.NL;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/** Format as currency. Large amounts show no decimals, small amounts show 2. */
export function formatAmount(amount: number, country?: Country): string {
  return intl(country, Math.abs(amount) >= 1000 ? 0 : 2).format(amount);
}

/** Format as unit price (always 2 decimals) */
export function formatUnitPrice(price: number, country?: Country): string {
  return intl(country, 2).format(price);
}

/** Format percentage */
export function formatPercent(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`;
}

/** Format with +/- sign for changes */
export function formatChange(value: number, country?: Country): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${formatAmount(value, country)}`;
}

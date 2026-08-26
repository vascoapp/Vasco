/**
 * The euro SIGN goes BEFORE the amount, on the customer-facing pages too.
 *
 * User decision 2026-08-26: "€ 1.234,56". `Intl` follows each locale's own
 * convention — de/fr/es/it trail the sign, nl leads it — so the same quote
 * rendered two ways depending on the contractor's country. These pages are
 * read by the contractor's CLIENT, so they must agree with what the contractor
 * sees in the app; `src/i18n/formatting.ts` applies the identical rule there.
 * GBP and USD already lead and are untouched.
 */
export function euroLeading(formatted: string): string {
  if (!formatted.includes('€') || formatted.startsWith('€')) return formatted;
  const rest = formatted.replace('€', '').replace(/[\s  ]+$/, '');
  return `€ ${rest}`;
}

/**
 * Drop-in for `new Intl.NumberFormat(...)` at a money call site: same
 * `.format(n)` shape, euro sign moved to the front.
 */
export function moneyFormatter(
  locale: string,
  options: Intl.NumberFormatOptions,
): { format: (n: number) => string } {
  let inner: Intl.NumberFormat;
  try {
    inner = new Intl.NumberFormat(locale, options);
  } catch {
    inner = new Intl.NumberFormat('en', { ...options, currencyDisplay: undefined });
  }
  return { format: (n: number) => euroLeading(inner.format(n)) };
}

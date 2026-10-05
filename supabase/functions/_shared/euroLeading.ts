/**
 * The euro SIGN goes BEFORE the amount, in every market that uses it.
 *
 * User decision 2026-08-26: "€ 1.234,56", not "1.234,56 €" and not "EUR".
 * `Intl` follows each locale's own convention, which splits the six EU markets
 * down the middle — de-DE/fr-FR/es-ES/it-IT trail the symbol, nl-NL leads it.
 * The separator is the NBSP `Intl` itself uses, so the sign never wraps away
 * from its number. GBP and USD already lead and are untouched.
 *
 * Shared by the app (src/i18n/formatting.ts) and the edge functions (the
 * weekly digest) — one rule, never two copies kept in step by hand.
 * Pure TypeScript: jest imports it too.
 */
export function euroLeading(formatted: string): string {
  if (!formatted.includes('\u20AC') || formatted.startsWith('\u20AC')) return formatted;
  const rest = formatted.replace('\u20AC', '').replace(/[\s\u00A0\u202F]+$/, '');
  return `\u20AC\u00A0${rest}`;
}

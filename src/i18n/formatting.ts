import { getCurrentCountry } from '../lib/currentUser';
export type Country = 'UK' | 'NL' | 'DE' | 'FR' | 'ES' | 'IT' | 'US';

const COUNTRY_CONFIG: Record<Country, { currency: string; locale: string }> = {
  UK: { currency: 'GBP', locale: 'en-GB' },
  NL: { currency: 'EUR', locale: 'nl-NL' },
  DE: { currency: 'EUR', locale: 'de-DE' },
  FR: { currency: 'EUR', locale: 'fr-FR' },
  ES: { currency: 'EUR', locale: 'es-ES' },
  IT: { currency: 'EUR', locale: 'it-IT' },
  US: { currency: 'USD', locale: 'en-US' },
};

/** ISO currency code for a country (UK→GBP, US→USD, EU6→EUR). Single source
 *  of truth so services that persist a currency (e.g. the pricing moat) don't
 *  hardcode 'EUR' and mis-tag GBP/USD rows. */
export function currencyForCountry(country: Country = 'NL'): string {
  return (COUNTRY_CONFIG[country] ?? COUNTRY_CONFIG.NL).currency;
}

export function formatCurrency(amount: number, country: Country = 'NL'): string {
  // Fall back rather than throw on an unrecognised key. `currencyForCountry`
  // right above already does this; this one did not, so passing anything that
  // is not a Country -- a currency CODE, most easily -- destructured undefined
  // and threw "Cannot read properties of undefined (reading 'currency')",
  // taking the whole screen down. See formatCurrencyCode below for callers
  // that legitimately hold a currency rather than a country.
  const { currency, locale } = COUNTRY_CONFIG[country] ?? COUNTRY_CONFIG.NL;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format an amount that is denominated in a specific ISO currency.
 *
 * `formatCurrency` takes a COUNTRY and derives the currency from it, which is
 * right for a contractor's own money. Enterprise dashboards are different: a
 * portfolio holds projects in several currencies at once, so the amount
 * carries its own currency code and only the grouping/decimal separators
 * should follow the viewer. Passing that code into formatCurrency's country
 * slot is what threw.
 */
export function formatCurrencyCode(
  amount: number,
  currencyCode: string,
  country: Country = 'NL',
): string {
  const { locale } = COUNTRY_CONFIG[country] ?? COUNTRY_CONFIG.NL;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Intl throws on a malformed currency code; show the number rather than
    // nothing, and never take the screen down over a formatting detail.
    return `${currencyCode} ${amount.toFixed(2)}`;
  }
}

export function formatDate(date: Date | string, country: Country = 'NL'): string {
  const { locale } = COUNTRY_CONFIG[country];
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

export function formatDateShort(date: Date | string, country: Country = 'NL'): string {
  const { locale } = COUNTRY_CONFIG[country];
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function formatNumber(n: number, country: Country = 'NL'): string {
  const { locale } = COUNTRY_CONFIG[country];
  return new Intl.NumberFormat(locale).format(n);
}

/** Whole-currency formatter (0 decimals) — right symbol + locale grouping.
 *  NL €1.234 · UK £1,234 · US $1,234. Use for compact amount displays that
 *  shouldn't show cents. narrowSymbol with a fallback for older Intl builds. */
export function formatCurrency0(amount: number, country: Country = 'NL'): string {
  const { currency, locale } = COUNTRY_CONFIG[country];
  const rounded = Math.round(amount);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency', currency, currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(rounded);
  } catch {
    return new Intl.NumberFormat(locale, {
      style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(rounded);
  }
}

/**
 * Compact currency for KPI tiles: €760 / €4,5K / €1,2M.
 *
 * Was duplicated as a local helper in geld.tsx while app/hub/savings.tsx did
 * its own `€${(x/1000).toFixed(1)}K`, which rendered "€0.0K" for anything
 * under a thousand and hardcoded a period separator into locales that use a
 * comma. Values below 1000 stay whole, and the decimal separator follows the
 * country.
 */
export function compactCurrency(amount: number, country: Country = 'NL'): string {
  const abs = Math.abs(amount);
  if (abs < 1_000) return formatCurrency0(amount, country);
  const { currency, locale } = COUNTRY_CONFIG[country];
  const divisor = abs >= 1_000_000 ? 1_000_000 : 1_000;
  const suffix = abs >= 1_000_000 ? 'M' : 'K';
  const scaled = amount / divisor;
  const number = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1, maximumFractionDigits: 1,
  }).format(scaled);
  try {
    const symbol = new Intl.NumberFormat(locale, {
      style: 'currency', currency, currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? '';
    return `${symbol}${number}${suffix}`;
  } catch {
    return `${number}${suffix}`;
  }
}


/**
 * Currency for strings built OUTSIDE a component, where no `country` prop is
 * in scope — generators, services, scheduler alerts. Resolves the signed-in
 * contractor's country itself.
 *
 * Replaces a hand-rolled pattern that was scattered across contractor-facing
 * call sites: those hardcoded the euro symbol (wrong for UK/US) and, where
 * they used a fixed-decimal helper, forced a period separator (wrong in
 * nl/de/fr/es/it).
 */
export function formatMoney(amount: number): string {
  const c = (getCurrentCountry() as Country) ?? 'NL';
  return formatCurrency0(amount, COUNTRY_CONFIG[c] ? c : 'NL');
}

/**
 * Two-decimal sibling of formatMoney, for amounts a CUSTOMER sees or pays:
 * invoice totals, quote totals, per-unit material prices. Cents are part of
 * the number there — rounding an invoice to whole euros in a payment reminder
 * makes the message disagree with the invoice it is chasing.
 */
export function formatMoney2(amount: number): string {
  const c = (getCurrentCountry() as Country) ?? 'NL';
  return formatCurrency(amount, COUNTRY_CONFIG[c] ? c : 'NL');
}

/**
 * Compact sibling of formatMoney for KPI tiles built outside a component
 * (€4,5K / £1,2M). Same country resolution as formatMoney.
 */
export function compactMoney(amount: number): string {
  const c = (getCurrentCountry() as Country) ?? 'NL';
  return compactCurrency(amount, COUNTRY_CONFIG[c] ? c : 'NL');
}

/**
 * Bare currency symbol for the signed-in contractor's country — for FIELD
 * LABELS that name a unit ("Unit price (€)") rather than render an amount.
 * Those cannot use formatMoney: there is no number to format, and a hardcoded
 * "(€)" sits above an input a British contractor types pounds into.
 */
export function currencySymbol(country?: Country): string {
  const c = country ?? ((getCurrentCountry() as Country) ?? 'NL');
  const { currency, locale } = COUNTRY_CONFIG[c] ?? COUNTRY_CONFIG.NL;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency', currency, currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? '€';
  } catch {
    return '€';
  }
}

export function getCountryConfig(country: Country) {
  return COUNTRY_CONFIG[country];
}

export function getDefaultLanguage(country: Country): 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it' {
  switch (country) {
    case 'UK': return 'en';
    case 'NL': return 'nl';
    case 'DE': return 'de';
    case 'FR': return 'fr';
    case 'ES': return 'es';
    case 'IT': return 'it';
    case 'US': return 'en';
  }
}

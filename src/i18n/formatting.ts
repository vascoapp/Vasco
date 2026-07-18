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

export function formatCurrency(amount: number, country: Country = 'NL'): string {
  const { currency, locale } = COUNTRY_CONFIG[country];
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
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

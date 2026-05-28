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

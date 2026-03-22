export type Country = 'UK' | 'NL' | 'DE' | 'FR' | 'ES' | 'IT';

const COUNTRY_CONFIG: Record<Country, { currency: string; locale: string }> = {
  UK: { currency: 'GBP', locale: 'en-GB' },
  NL: { currency: 'EUR', locale: 'nl-NL' },
  DE: { currency: 'EUR', locale: 'de-DE' },
  FR: { currency: 'EUR', locale: 'fr-FR' },
  ES: { currency: 'EUR', locale: 'es-ES' },
  IT: { currency: 'EUR', locale: 'it-IT' },
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
  }
}

import { euroLeading } from '../i18n/formatting';
// =============================================================================
// MULTI-CURRENCY UTILITIES (R249)
// =============================================================================
// Replaces hardcoded EUR/GBP assumptions across the app.
// - formatMoney() handles all 10 currencies Vasco supports
// - convert() does ECB-rate conversion (cached daily) for cross-border quotes
// - currencySymbol() for compact UI labels
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CurrencyCode } from '../data/countries';

const RATES_CACHE_KEY = '@vasco_ecb_rates';
const RATES_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

const ECB_API = 'https://api.frankfurter.app/latest';      // ECB-sourced, free, no key

interface CachedRates {
  base: 'EUR';
  rates: Partial<Record<CurrencyCode, number>>;
  fetchedAt: number;
}

const FALLBACK_RATES: CachedRates = {
  base: 'EUR',
  rates: {
    EUR: 1,
    GBP: 0.85,
    SEK: 11.4,
    NOK: 11.5,
    DKK: 7.46,
    USD: 1.08,
  },
  fetchedAt: 0,
};

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  EUR: '€', GBP: '£', SEK: 'kr', NOK: 'kr', DKK: 'kr', USD: '$',
};

const CURRENCY_LOCALES: Record<CurrencyCode, string> = {
  EUR: 'nl-NL', GBP: 'en-GB', SEK: 'sv-SE', NOK: 'nb-NO', DKK: 'da-DK', USD: 'en-US',
};

export function currencySymbol(code: CurrencyCode): string {
  return CURRENCY_SYMBOLS[code] ?? code;
}

/**
 * Locale-aware money formatter. Uses Intl.NumberFormat for correct
 * thousand separators, decimal char, and currency placement per locale.
 */
export function formatMoney(amount: number, currency: CurrencyCode = 'EUR', locale?: string): string {
  const finalLocale = locale ?? CURRENCY_LOCALES[currency] ?? 'en-EU';
  try {
    return euroLeading(new Intl.NumberFormat(finalLocale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(amount));
  } catch {
    // Fallback for environments without Intl currency support
    return `${currencySymbol(currency)}${amount.toFixed(2)}`;
  }
}

async function loadCachedRates(): Promise<CachedRates | null> {
  try {
    const raw = await AsyncStorage.getItem(RATES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedRates;
    if (Date.now() - parsed.fetchedAt > RATES_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function fetchEcbRates(): Promise<CachedRates> {
  try {
    const res = await fetch(`${ECB_API}?from=EUR&to=GBP,SEK,NOK,DKK`);
    if (!res.ok) throw new Error('ECB unreachable');
    const json = await res.json();
    const rates: CachedRates['rates'] = { EUR: 1, ...json.rates };
    const fresh: CachedRates = { base: 'EUR', rates, fetchedAt: Date.now() };
    await AsyncStorage.setItem(RATES_CACHE_KEY, JSON.stringify(fresh)).catch(() => {});
    return fresh;
  } catch {
    return FALLBACK_RATES;
  }
}

export async function getRates(): Promise<CachedRates> {
  const cached = await loadCachedRates();
  if (cached) return cached;
  return fetchEcbRates();
}

/**
 * Convert an amount from one currency to another using cached ECB rates.
 * Cross-rate computed via EUR. Returns the input unchanged when src === dst.
 */
export async function convert(amount: number, from: CurrencyCode, to: CurrencyCode): Promise<number> {
  if (from === to) return amount;
  const { rates } = await getRates();
  const fromRate = rates[from];
  const toRate = rates[to];
  if (typeof fromRate !== 'number' || typeof toRate !== 'number') return amount;
  // Convert from → EUR → to
  const inEur = amount / fromRate;
  return inEur * toRate;
}

/** Synchronous conversion using whatever rates are cached. Returns amount unchanged on miss. */
export function convertSync(amount: number, from: CurrencyCode, to: CurrencyCode, rates: CachedRates['rates']): number {
  if (from === to) return amount;
  const fromRate = rates[from];
  const toRate = rates[to];
  if (typeof fromRate !== 'number' || typeof toRate !== 'number') return amount;
  return (amount / fromRate) * toRate;
}

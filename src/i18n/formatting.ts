import { getCurrentCountry } from '../lib/currentUser';
export type Country = 'UK' | 'NL' | 'DE' | 'FR' | 'ES' | 'IT' | 'US';

export const COUNTRY_CONFIG: Record<Country, { currency: string; locale: string }> = {
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

/**
 * Country defaults to the SIGNED-IN CONTRACTOR, not to NL.
 *
 * The default was a hardcoded 'NL' and 189 call sites across the app omit the
 * argument — so most money in the product rendered in Dutch convention for
 * everyone. Invisible while the app was only ever walked in Dutch; obvious as a
 * German contractor, whose Finanzen tab showed "760 €" in the KPI tiles (which
 * pass a country) directly above "€ 760,00" in the cashflow card and
 * "€ 2.450,00" in the quote list, which do not.
 *
 * It also reaches OUTSIDE the app: geld.tsx builds the customer-facing
 * payment-reminder message with formatCurrency, so a German contractor's
 * reminder quoted a Dutch-formatted amount to their own customer.
 *
 * `currencySymbol` further down has always resolved it this way. Falls back to
 * NL exactly as before when no contractor is signed in.
 */
export function formatCurrency(amount: number, countryArg?: Country): string {
  const country = countryArg ?? ((getCurrentCountry() as Country) ?? 'NL');
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
  const { locale } = COUNTRY_CONFIG[country] ?? COUNTRY_CONFIG.NL;
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

export function formatDateShort(date: Date | string, country: Country = 'NL'): string {
  const { locale } = COUNTRY_CONFIG[country] ?? COUNTRY_CONFIG.NL;
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

// ─── Clock + calendar in the CONTRACTOR's locale, not the device's ──────────
//
// There was no time formatter here at all, so every call site reached for
// `toLocaleTimeString(undefined, …)` / `toLocaleDateString(undefined, …)`,
// which follows the DEVICE. A Dutch contractor holding an English phone read
// "01:30 PM" on a screen that says "3u30" one line below, and "Geldig tot
// September 8, 2026" under a Dutch heading. On a nl-NL device both render
// correctly, which is why walking the simulator never showed it.
//
// `country` is the contractor's, from `useAuth().user.country` — the same
// argument formatCurrency/formatDate already take.

/** "13:30" everywhere in the EU6; "1:30 PM" for US/UK. */
export function formatTime(date: Date | string, country: Country = 'NL'): string {
  const { locale } = COUNTRY_CONFIG[country] ?? COUNTRY_CONFIG.NL;
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/** "12 jul" / "Jul 12" — day + short month, no year. */
export function formatDayMonth(date: Date | string, country: Country = 'NL'): string {
  const { locale } = COUNTRY_CONFIG[country] ?? COUNTRY_CONFIG.NL;
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(d);
}

/** "ma" / "Mon" — short weekday, for column headers. */
export function formatWeekdayShort(date: Date | string, country: Country = 'NL'): string {
  const { locale } = COUNTRY_CONFIG[country] ?? COUNTRY_CONFIG.NL;
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(d);
}

/** "jul" / "Jul" — bare short month, for period labels on a monthly series. */
export function formatMonthShort(date: Date | string, country: Country = 'NL'): string {
  const { locale } = COUNTRY_CONFIG[country] ?? COUNTRY_CONFIG.NL;
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, { month: 'short' }).format(d);
}

/** "jul 2026" / "Jul 2026" — month buckets in a forecast that crosses a year. */
export function formatMonthYear(date: Date | string, country: Country = 'NL'): string {
  const { locale } = COUNTRY_CONFIG[country] ?? COUNTRY_CONFIG.NL;
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(d);
}

/** "zondag 9 augustus" / "Sunday, August 9" — the day-planner header. */
export function formatWeekdayDayMonth(date: Date | string, country: Country = 'NL'): string {
  const { locale } = COUNTRY_CONFIG[country] ?? COUNTRY_CONFIG.NL;
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d);
}

export function formatNumber(n: number, country: Country = 'NL'): string {
  const { locale } = COUNTRY_CONFIG[country];
  return new Intl.NumberFormat(locale).format(n);
}

/**
 * One-decimal number in the contractor's locale — "1,5" in NL/DE/FR/ES/IT,
 * "1.5" in UK/US.
 *
 * Exists because `toFixed(1)` always emits a POINT, so hour readouts rendered
 * "0.0u" on Dutch screens: unit localised, number not. Half-localised is its
 * own bug — it reads like a glitch rather than a translation gap.
 */
export function formatDecimal1(n: number, country: Country = 'NL'): string {
  const { locale } = COUNTRY_CONFIG[country];
  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(n);
  } catch {
    return n.toFixed(1);
  }
}

/** Whole-currency formatter (0 decimals) — right symbol + locale grouping.
 *  NL €1.234 · UK £1,234 · US $1,234. Use for compact amount displays that
 *  shouldn't show cents. narrowSymbol with a fallback for older Intl builds. */
/** Whole-currency variant. Same contractor default as formatCurrency above. */
export function formatCurrency0(amount: number, countryArg?: Country): string {
  const country = countryArg ?? ((getCurrentCountry() as Country) ?? 'NL');
  const { currency, locale } = COUNTRY_CONFIG[country] ?? COUNTRY_CONFIG.NL;
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
/**
 * [thousands, millions] suffix per market, for the path where the runtime has
 * no `notation: 'compact'` — which is every iOS build here, Hermes not having
 * it. "K" is an anglicism a German contractor does not write; "Tsd." is the
 * abbreviation that belongs on a German KPI tile. Leading space where the
 * language sets the suffix off as its own word.
 */
const COMPACT_SUFFIX: Record<Country, [string, string]> = {
  NL: ['K', ' mln'],
  DE: [' Tsd.', ' Mio.'],
  FR: [' k', ' M'],
  ES: ['K', ' M'],
  IT: ['K', ' Mln'],
  UK: ['K', 'M'],
  US: ['K', 'M'],
};

/**
 * Compact "4,5K" variant. Same contractor default as formatCurrency above.
 *
 * 🔴 Do NOT reach for `formatToParts` here. This function used it to pull the
 * currency symbol out, and Hermes does not implement it — the call threw on
 * every render, the catch returned the bare number, and the three headline
 * tiles on the Finanzen tab read "3,2K · 5,4K · 31,8K" with NO CURRENCY AT ALL
 * on the money screen of a money app. Seen on device 2026-08-26; invisible to
 * the jest walk, which runs on Node's full ICU where formatToParts works.
 *
 * The symbol and its POSITION now come from formatting 0 through the same
 * formatter and swapping the digit out, so de-DE keeps "… €" after the number
 * and nl-NL keeps "€ …" before it. The compact suffix is Intl's own where the
 * runtime supports `notation: 'compact'` (German gets "Tsd."/"Mio.", not the
 * English "K"); where it does not, the number simply comes back uncompacted,
 * which is longer but never wrong.
 */
export function compactCurrency(amount: number, countryArg?: Country): string {
  const country = countryArg ?? ((getCurrentCountry() as Country) ?? 'NL');
  const abs = Math.abs(amount);
  if (abs < 1_000) return formatCurrency0(amount, country);
  const { currency, locale } = COUNTRY_CONFIG[country] ?? COUNTRY_CONFIG.NL;

  let number: string;
  try {
    number = new Intl.NumberFormat(locale, {
      notation: 'compact', compactDisplay: 'short', maximumFractionDigits: 1,
    } as Intl.NumberFormatOptions).format(amount);
  } catch {
    number = '';
  }
  // A runtime that ignores `notation` hands back the full number. Detect that
  // by length rather than by feature-sniffing, and fall back to the hand-rolled
  // scale so the tile still fits.
  if (!number || !/[^\d\s.,-]/.test(number)) {
    const divisor = abs >= 1_000_000 ? 1_000_000 : 1_000;
    const [thousand, million] = COMPACT_SUFFIX[country] ?? COMPACT_SUFFIX.NL;
    number = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1, maximumFractionDigits: 1,
    }).format(amount / divisor) + (abs >= 1_000_000 ? million : thousand);
  }

  // Formatting 0 gives the symbol AND the locale's placement/spacing; swapping
  // the single digit keeps both without parsing the pattern by hand.
  const shell = formatCurrency0(0, country);
  return shell.includes('0') ? shell.replace('0', number) : `${number}`;
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
 * Date siblings of formatMoney, for call sites that cannot reach `country`:
 * module-level helpers and leaf subcomponents that are not passed the user.
 * Prefer the explicit `formatDate*(date, country)` forms in a component that
 * already has `useAuth()`; these exist so the alternative is never
 * `toLocaleDateString(undefined, …)`, which follows the DEVICE.
 */
export function formatDateAuto(date: Date | string): string {
  const c = (getCurrentCountry() as Country) ?? 'NL';
  return formatDate(date, COUNTRY_CONFIG[c] ? c : 'NL');
}

export function formatDateShortAuto(date: Date | string): string {
  const c = (getCurrentCountry() as Country) ?? 'NL';
  return formatDateShort(date, COUNTRY_CONFIG[c] ? c : 'NL');
}

export function formatDayMonthAuto(date: Date | string): string {
  const c = (getCurrentCountry() as Country) ?? 'NL';
  return formatDayMonth(date, COUNTRY_CONFIG[c] ? c : 'NL');
}

export function formatTimeAuto(date: Date | string): string {
  const c = (getCurrentCountry() as Country) ?? 'NL';
  return formatTime(date, COUNTRY_CONFIG[c] ? c : 'NL');
}

// Every shape the explicit family has needs an Auto sibling. A GAP here is
// what sends a call site back to `toLocaleDateString(undefined, …)`: the three
// worst offenders in this sweep each reached for the device because the shape
// they wanted (bare weekday, bare month, month+year) had no helper at all.
export function formatWeekdayShortAuto(date: Date | string): string {
  const c = (getCurrentCountry() as Country) ?? 'NL';
  return formatWeekdayShort(date, COUNTRY_CONFIG[c] ? c : 'NL');
}

export function formatWeekdayDayMonthAuto(date: Date | string): string {
  const c = (getCurrentCountry() as Country) ?? 'NL';
  return formatWeekdayDayMonth(date, COUNTRY_CONFIG[c] ? c : 'NL');
}

export function formatMonthShortAuto(date: Date | string): string {
  const c = (getCurrentCountry() as Country) ?? 'NL';
  return formatMonthShort(date, COUNTRY_CONFIG[c] ? c : 'NL');
}

export function formatMonthYearAuto(date: Date | string): string {
  const c = (getCurrentCountry() as Country) ?? 'NL';
  return formatMonthYear(date, COUNTRY_CONFIG[c] ? c : 'NL');
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

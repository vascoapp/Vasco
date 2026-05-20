// =============================================================================
// COUNTRY REGISTRY (R249 + R74 US foundation)
// =============================================================================
// Single source of truth for every country Vasco serves: EU5 + UK + Nordics.
// Adding a new country = adding a row here + (later) per-country integration
// depth. All other code reads from this registry rather than hard-coding
// country strings.
// =============================================================================

import { US_STATE_RATES } from './usSalesTax';

export type CountryCode =
  // EU5 + UK — full integration depth (Tier 1)
  | 'NL' | 'DE' | 'FR' | 'ES' | 'IT' | 'UK'
  // Nordics — registry foundation (R249)
  | 'SE' | 'NO' | 'DK' | 'FI'
  // US — foundation (R74 US expansion). Sales-tax regime, ACH bank
  // format, "Estimate" terminology. No Peppol / no VAT.
  | 'US';

export type CurrencyCode =
  | 'EUR' | 'GBP' | 'SEK' | 'NOK' | 'DKK' | 'USD';

export type LocaleCode =
  | 'en' | 'en-US' | 'nl' | 'de' | 'fr' | 'es' | 'it' | 'sv' | 'no' | 'da' | 'fi';

export interface BusinessIdFormat {
  label: string;
  pattern: RegExp;
  example: string;
  registrationAuthority: string;
}

export interface VatConfig {
  standardRate: number;
  reducedRates: number[];
  vatNumberPattern: RegExp;
  vatNumberExample: string;
}

export interface EInvoiceConfig {
  formats: Array<'peppol' | 'xrechnung' | 'zugferd' | 'facturx' | 'facturae' | 'fatturapa'>;
  defaultFormat: 'peppol' | 'xrechnung' | 'zugferd' | 'facturx' | 'facturae' | 'fatturapa';
  b2gMandatory: boolean;
  b2bMandatory: boolean;
  peppolEndpointScheme?: string;
}

// US sales tax operates at state level (and often city/county). v1 stores
// per-state base rates; multi-jurisdictional lookup later via TaxJar /
// Avalara. See `src/data/usSalesTax.ts`.
export interface SalesTaxConfig {
  // Looked up at runtime by state code; rates live in `usSalesTax.ts`
  // rather than this registry to keep this file readable.
  ratesByStateCode: Record<string, number>;
  defaultStateRate?: number;
}

// Bank-account input format. SEPA (IBAN+BIC) for EU; UK uses IBAN+sort-
// code; US uses ACH (routing+account). Drives onboarding form + invoice
// PDF rendering.
export type BankAccountFormat = 'sepa' | 'sepa_uk' | 'ach';

// US contractors say "Estimate"; everyone else says "Quote". US says
// "Sales tax"; EU says "VAT". Surfaces label-only — feature behaviour
// branches on `taxRegime`, not on these strings.
export interface Terminology {
  quoteLabel: string;    // "Quote" | "Estimate"
  taxLabel: string;      // "VAT" | "Sales tax"
  bankAccountLabel: string; // "IBAN" | "Bank account"
}

// Authoritative discriminator. Read this before touching `vat` /
// `eInvoice` / `salesTax` so callers don't trip on absent fields.
export type TaxRegime = 'vat' | 'sales_tax';

export interface CountryConfig {
  code: CountryCode;
  name: string;
  flagEmoji: string;
  currency: CurrencyCode;
  primaryLocale: LocaleCode;
  fallbackLocales: LocaleCode[];
  businessId: BusinessIdFormat;
  // R74: optional. US has no VAT — gated on `taxRegime === 'vat'`.
  vat?: VatConfig;
  // R74: optional. US has no Peppol equivalent.
  eInvoice?: EInvoiceConfig;
  // R74: present only when `taxRegime === 'sales_tax'`.
  salesTax?: SalesTaxConfig;
  taxRegime: TaxRegime;
  bankAccountFormat: BankAccountFormat;
  terminology: Terminology;
  commonCerts: string[];
  phonePrefix: string;
  tier: 1 | 2;
}

export const COUNTRIES: Record<CountryCode, CountryConfig> = {
  // ─── EU5 + UK ─ full depth ────────────────────────────────────────────────
  NL: {
    code: 'NL', name: 'Netherlands', flagEmoji: '🇳🇱',
    currency: 'EUR', primaryLocale: 'nl', fallbackLocales: ['en'],
    businessId: {
      label: 'KvK nummer', pattern: /^\d{8}$/, example: '12345678',
      registrationAuthority: 'Kamer van Koophandel',
    },
    vat: {
      standardRate: 21, reducedRates: [9, 0],
      vatNumberPattern: /^NL\d{9}B\d{2}$/, vatNumberExample: 'NL123456789B01',
    },
    eInvoice: {
      formats: ['peppol'], defaultFormat: 'peppol',
      b2gMandatory: true, b2bMandatory: false, peppolEndpointScheme: '0106',
    },
    taxRegime: 'vat',
    bankAccountFormat: 'sepa',
    terminology: { quoteLabel: 'Quote', taxLabel: 'VAT', bankAccountLabel: 'IBAN' },
    commonCerts: ['VCA', 'VCA*', 'VCA**', 'BHV', 'NEN3140'],
    phonePrefix: '+31', tier: 1,
  },
  DE: {
    code: 'DE', name: 'Deutschland', flagEmoji: '🇩🇪',
    currency: 'EUR', primaryLocale: 'de', fallbackLocales: ['en'],
    businessId: {
      label: 'HRB Nummer', pattern: /^HRB\s?\d{1,7}$/i, example: 'HRB 12345',
      registrationAuthority: 'Handelsregister',
    },
    vat: {
      standardRate: 19, reducedRates: [7, 0],
      vatNumberPattern: /^DE\d{9}$/, vatNumberExample: 'DE123456789',
    },
    eInvoice: {
      formats: ['xrechnung', 'zugferd', 'peppol'], defaultFormat: 'xrechnung',
      b2gMandatory: true, b2bMandatory: true, peppolEndpointScheme: '0204',
    },
    taxRegime: 'vat',
    bankAccountFormat: 'sepa',
    terminology: { quoteLabel: 'Quote', taxLabel: 'VAT', bankAccountLabel: 'IBAN' },
    commonCerts: ['Meisterbrief', 'SCC', 'TÜV', 'Sachkundenachweis'],
    phonePrefix: '+49', tier: 1,
  },
  FR: {
    code: 'FR', name: 'France', flagEmoji: '🇫🇷',
    currency: 'EUR', primaryLocale: 'fr', fallbackLocales: ['en'],
    businessId: {
      label: 'SIRET', pattern: /^\d{14}$/, example: '12345678900012',
      registrationAuthority: 'INSEE / Greffe',
    },
    vat: {
      standardRate: 20, reducedRates: [10, 5.5, 2.1, 0],
      vatNumberPattern: /^FR[A-Z0-9]{2}\d{9}$/, vatNumberExample: 'FRXX123456789',
    },
    eInvoice: {
      formats: ['facturx', 'peppol'], defaultFormat: 'facturx',
      b2gMandatory: true, b2bMandatory: false, peppolEndpointScheme: '0009',
    },
    taxRegime: 'vat',
    bankAccountFormat: 'sepa',
    terminology: { quoteLabel: 'Quote', taxLabel: 'VAT', bankAccountLabel: 'IBAN' },
    commonCerts: ['RGE', 'Qualibat', 'Qualifelec'],
    phonePrefix: '+33', tier: 1,
  },
  ES: {
    code: 'ES', name: 'España', flagEmoji: '🇪🇸',
    currency: 'EUR', primaryLocale: 'es', fallbackLocales: ['en'],
    businessId: {
      label: 'NIF / CIF', pattern: /^[A-Z]\d{8}$|^\d{8}[A-Z]$/i, example: 'B12345678',
      registrationAuthority: 'Registro Mercantil',
    },
    vat: {
      standardRate: 21, reducedRates: [10, 4, 0],
      vatNumberPattern: /^ES[A-Z0-9]\d{7}[A-Z0-9]$/, vatNumberExample: 'ESB12345678',
    },
    eInvoice: {
      formats: ['facturae', 'peppol'], defaultFormat: 'facturae',
      b2gMandatory: true, b2bMandatory: false, peppolEndpointScheme: '0184',
    },
    taxRegime: 'vat',
    bankAccountFormat: 'sepa',
    terminology: { quoteLabel: 'Quote', taxLabel: 'VAT', bankAccountLabel: 'IBAN' },
    commonCerts: ['REA', 'PRL', 'CAEM'],
    phonePrefix: '+34', tier: 1,
  },
  IT: {
    code: 'IT', name: 'Italia', flagEmoji: '🇮🇹',
    currency: 'EUR', primaryLocale: 'it', fallbackLocales: ['en'],
    businessId: {
      label: 'Partita IVA', pattern: /^\d{11}$/, example: '12345678901',
      registrationAuthority: 'Camera di Commercio',
    },
    vat: {
      standardRate: 22, reducedRates: [10, 5, 4, 0],
      vatNumberPattern: /^IT\d{11}$/, vatNumberExample: 'IT12345678901',
    },
    eInvoice: {
      formats: ['fatturapa', 'peppol'], defaultFormat: 'fatturapa',
      b2gMandatory: true, b2bMandatory: true, peppolEndpointScheme: '0211',
    },
    taxRegime: 'vat',
    bankAccountFormat: 'sepa',
    terminology: { quoteLabel: 'Quote', taxLabel: 'VAT', bankAccountLabel: 'IBAN' },
    commonCerts: ['SOA', 'F-Gas', 'CAM'],
    phonePrefix: '+39', tier: 1,
  },
  UK: {
    code: 'UK', name: 'United Kingdom', flagEmoji: '🇬🇧',
    currency: 'GBP', primaryLocale: 'en', fallbackLocales: [],
    businessId: {
      label: 'Companies House no.', pattern: /^[A-Z0-9]{6,8}$/i, example: '12345678',
      registrationAuthority: 'Companies House',
    },
    vat: {
      standardRate: 20, reducedRates: [5, 0],
      vatNumberPattern: /^GB\d{9}$/, vatNumberExample: 'GB123456789',
    },
    eInvoice: {
      formats: ['peppol'], defaultFormat: 'peppol',
      b2gMandatory: false, b2bMandatory: false, peppolEndpointScheme: '0088',
    },
    taxRegime: 'vat',
    bankAccountFormat: 'sepa_uk',
    terminology: { quoteLabel: 'Quote', taxLabel: 'VAT', bankAccountLabel: 'Sort code + Account' },
    commonCerts: ['Gas Safe', 'NICEIC', 'CSCS', 'CHAS'],
    phonePrefix: '+44', tier: 1,
  },

  // ─── Nordics — registry foundation ────────────────────────────────────────
  // SE/NO/DK/FI all use Peppol heavily for B2G + emerging B2B mandates.
  // Currency mix: SEK/NOK/DKK + EUR (Finland uses EUR).

  SE: {
    code: 'SE', name: 'Sverige', flagEmoji: '🇸🇪',
    currency: 'SEK', primaryLocale: 'sv', fallbackLocales: ['en'],
    businessId: {
      label: 'Organisationsnummer', pattern: /^\d{6}-?\d{4}$/, example: '556677-8899',
      registrationAuthority: 'Bolagsverket',
    },
    vat: {
      standardRate: 25, reducedRates: [12, 6, 0],
      vatNumberPattern: /^SE\d{12}$/, vatNumberExample: 'SE556677889901',
    },
    eInvoice: {
      formats: ['peppol'], defaultFormat: 'peppol',
      b2gMandatory: true, b2bMandatory: false, peppolEndpointScheme: '0007',
    },
    taxRegime: 'vat',
    bankAccountFormat: 'sepa',
    terminology: { quoteLabel: 'Quote', taxLabel: 'VAT', bankAccountLabel: 'IBAN' },
    commonCerts: ['BAS-U', 'BAS-P', 'Heta arbeten', 'Auktoriserad'],
    phonePrefix: '+46', tier: 2,
  },
  NO: {
    code: 'NO', name: 'Norge', flagEmoji: '🇳🇴',
    currency: 'NOK', primaryLocale: 'no', fallbackLocales: ['en', 'sv', 'da'],
    businessId: {
      label: 'Organisasjonsnummer', pattern: /^\d{9}$/, example: '987654321',
      registrationAuthority: 'Brønnøysundregistrene',
    },
    vat: {
      standardRate: 25, reducedRates: [15, 12, 0],
      vatNumberPattern: /^NO\d{9}MVA$/, vatNumberExample: 'NO987654321MVA',
    },
    eInvoice: {
      formats: ['peppol'], defaultFormat: 'peppol',
      b2gMandatory: true, b2bMandatory: false, peppolEndpointScheme: '0192',
    },
    taxRegime: 'vat',
    bankAccountFormat: 'sepa',
    terminology: { quoteLabel: 'Quote', taxLabel: 'VAT', bankAccountLabel: 'IBAN' },
    commonCerts: ['HMS-kort', 'StartBANK', 'Sentral godkjenning'],
    phonePrefix: '+47', tier: 2,
  },
  DK: {
    code: 'DK', name: 'Danmark', flagEmoji: '🇩🇰',
    currency: 'DKK', primaryLocale: 'da', fallbackLocales: ['en', 'no', 'sv'],
    businessId: {
      label: 'CVR-nummer', pattern: /^\d{8}$/, example: '12345678',
      registrationAuthority: 'CVR (Erhvervsstyrelsen)',
    },
    vat: {
      standardRate: 25, reducedRates: [0],
      vatNumberPattern: /^DK\d{8}$/, vatNumberExample: 'DK12345678',
    },
    eInvoice: {
      formats: ['peppol'], defaultFormat: 'peppol',
      b2gMandatory: true, b2bMandatory: false, peppolEndpointScheme: '0184',
    },
    taxRegime: 'vat',
    bankAccountFormat: 'sepa',
    terminology: { quoteLabel: 'Quote', taxLabel: 'VAT', bankAccountLabel: 'IBAN' },
    commonCerts: ['VVS-aut.', 'KS-aut.', 'EL-aut.', 'Byggeskadeforsikring'],
    phonePrefix: '+45', tier: 2,
  },
  FI: {
    code: 'FI', name: 'Suomi', flagEmoji: '🇫🇮',
    currency: 'EUR', primaryLocale: 'fi', fallbackLocales: ['en', 'sv'],
    businessId: {
      label: 'Y-tunnus', pattern: /^\d{7}-\d$/, example: '1234567-8',
      registrationAuthority: 'PRH (Patentti- ja rekisterihallitus)',
    },
    vat: {
      standardRate: 24, reducedRates: [14, 10, 0],
      vatNumberPattern: /^FI\d{8}$/, vatNumberExample: 'FI12345678',
    },
    eInvoice: {
      formats: ['peppol'], defaultFormat: 'peppol',
      b2gMandatory: true, b2bMandatory: true, peppolEndpointScheme: '0216',
    },
    taxRegime: 'vat',
    bankAccountFormat: 'sepa',
    terminology: { quoteLabel: 'Quote', taxLabel: 'VAT', bankAccountLabel: 'IBAN' },
    commonCerts: ['Tilaajavastuu', 'RALA', 'SFS-EN'],
    phonePrefix: '+358', tier: 2,
  },

  // ─── United States — registry foundation (R74) ────────────────────────────
  // No VAT (sales tax per state), no Peppol, ACH bank format, "Estimate"
  // terminology. Most US contractors run as sole-proprietors or LLCs filing
  // with an EIN (federal Employer Identification Number, format XX-XXXXXXX).
  // Rates + per-state nexus rules live in `src/data/usSalesTax.ts`.
  US: {
    code: 'US', name: 'United States', flagEmoji: '🇺🇸',
    currency: 'USD', primaryLocale: 'en-US', fallbackLocales: ['en'],
    businessId: {
      label: 'EIN',
      pattern: /^\d{2}-?\d{7}$/,
      example: '12-3456789',
      registrationAuthority: 'IRS',
    },
    taxRegime: 'sales_tax',
    bankAccountFormat: 'ach',
    salesTax: { ratesByStateCode: US_STATE_RATES, defaultStateRate: 0 },
    terminology: { quoteLabel: 'Estimate', taxLabel: 'Sales tax', bankAccountLabel: 'Bank account' },
    commonCerts: [
      // State licensing varies wildly; these are the most-mentioned national
      // ones plus a few state-licensing umbrellas. Per-state lookup added
      // in Phase 2 of the US expansion plan.
      'EPA 608 (HVAC)',
      'NATE (HVAC)',
      'OSHA 10',
      'OSHA 30',
      'State Contractor License',
      'EPA RRP (Lead-Safe)',
    ],
    phonePrefix: '+1',
    tier: 2,
  },
};

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function getCountryConfig(code: string): CountryConfig | null {
  const upper = code.toUpperCase() as CountryCode;
  return COUNTRIES[upper] ?? null;
}

export function listSupportedCountries(): CountryConfig[] {
  return Object.values(COUNTRIES);
}

export function listTier1Countries(): CountryConfig[] {
  return Object.values(COUNTRIES).filter((c) => c.tier === 1);
}

export function listNordicCountries(): CountryConfig[] {
  return [COUNTRIES.SE, COUNTRIES.NO, COUNTRIES.DK, COUNTRIES.FI];
}

export function getDefaultCurrencyForCountry(code: string): CurrencyCode {
  return getCountryConfig(code)?.currency ?? 'EUR';
}

export function getDefaultEInvoiceFormat(code: string): EInvoiceConfig['defaultFormat'] | null {
  return getCountryConfig(code)?.eInvoice?.defaultFormat ?? null;
}

export function validateBusinessId(code: string, value: string): boolean {
  const cfg = getCountryConfig(code);
  if (!cfg) return false;
  return cfg.businessId.pattern.test(value.trim());
}

export function validateVatNumber(code: string, value: string): boolean {
  const cfg = getCountryConfig(code);
  // VAT regime countries only — US returns false (no VAT number to validate).
  if (!cfg || !cfg.vat) return false;
  return cfg.vat.vatNumberPattern.test(value.replace(/\s/g, '').toUpperCase());
}

// R74 US foundation helpers
export function getTaxRegime(code: string): TaxRegime | null {
  return getCountryConfig(code)?.taxRegime ?? null;
}

export function getTerminology(code: string): Terminology {
  return (
    getCountryConfig(code)?.terminology ?? {
      quoteLabel: 'Quote',
      taxLabel: 'VAT',
      bankAccountLabel: 'IBAN',
    }
  );
}

export function getBankAccountFormat(code: string): BankAccountFormat | null {
  return getCountryConfig(code)?.bankAccountFormat ?? null;
}

export function isVatCountry(code: string): boolean {
  return getCountryConfig(code)?.taxRegime === 'vat';
}

export function isSalesTaxCountry(code: string): boolean {
  return getCountryConfig(code)?.taxRegime === 'sales_tax';
}

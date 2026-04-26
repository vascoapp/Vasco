// =============================================================================
// COUNTRY REGISTRY (R249)
// =============================================================================
// Single source of truth for every country Vasco serves: EU5 + UK + Nordics.
// Adding a new country = adding a row here + (later) per-country integration
// depth. All other code reads from this registry rather than hard-coding
// country strings.
// =============================================================================

export type CountryCode =
  // EU5 + UK — full integration depth (Tier 1)
  | 'NL' | 'DE' | 'FR' | 'ES' | 'IT' | 'UK'
  // Nordics — registry foundation (R249)
  | 'SE' | 'NO' | 'DK' | 'FI';

export type CurrencyCode =
  | 'EUR' | 'GBP' | 'SEK' | 'NOK' | 'DKK';

export type LocaleCode =
  | 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it' | 'sv' | 'no' | 'da' | 'fi';

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

export interface CountryConfig {
  code: CountryCode;
  name: string;
  flagEmoji: string;
  currency: CurrencyCode;
  primaryLocale: LocaleCode;
  fallbackLocales: LocaleCode[];
  businessId: BusinessIdFormat;
  vat: VatConfig;
  eInvoice: EInvoiceConfig;
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
    commonCerts: ['Tilaajavastuu', 'RALA', 'SFS-EN'],
    phonePrefix: '+358', tier: 2,
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
  return getCountryConfig(code)?.eInvoice.defaultFormat ?? null;
}

export function validateBusinessId(code: string, value: string): boolean {
  const cfg = getCountryConfig(code);
  if (!cfg) return false;
  return cfg.businessId.pattern.test(value.trim());
}

export function validateVatNumber(code: string, value: string): boolean {
  const cfg = getCountryConfig(code);
  if (!cfg) return false;
  return cfg.vat.vatNumberPattern.test(value.replace(/\s/g, '').toUpperCase());
}

// R250: VAT scheme. 'standard' = normal trade VAT (21/19/etc).
// 'small_business_NL_KOR' = Dutch Kleineondernemersregeling, no VAT charged
// (turnover ≤ €20k/yr). 'small_business_DE_kleinunternehmer' = §19 UStG,
// no VAT charged (turnover ≤ €22k prior year, ≤ €50k current year).
// When small_business is set, every invoice must show 0% VAT and a legal
// note ("BTW niet van toepassing — KOR" / "Kein Ausweis der USt gem. §19 UStG").
export type VatScheme =
  | 'standard'
  | 'small_business_NL_KOR'
  | 'small_business_DE_kleinunternehmer';

// R79 US Phase 2: per-state contractor license. Each entry stored as a row
// in `BusinessProfile.licenses[]` and persisted to
// `business_settings.licenses jsonb`.
export type ContractorLicenseType =
  | 'master_plumber'
  | 'master_electrician'
  | 'general_contractor'
  | 'hvac'
  | 'roofing'
  | 'gas_fitter'
  | 'epa_608'
  | 'state_contractor'
  | 'other';

export interface ContractorLicense {
  type: ContractorLicenseType;
  state: string;            // 'TX', 'CA', etc.
  number: string;           // license number as issued
  expiryDate: string;       // ISO date (YYYY-MM-DD)
  issueDate?: string;       // ISO date, optional
  issuingAuthority?: string; // e.g. "Texas Department of Licensing and Regulation"
}

export type BusinessProfile = {
  isComplete: boolean;
  completenessPercent: number;
  businessName?: string;
  kvkNumber?: string;
  vatNumber?: string;
  address?: string;
  email?: string;
  phone?: string;
  country?: 'UK' | 'NL' | 'DE' | 'FR' | 'ES' | 'IT' | 'US';
  // R74 US foundation: state code (e.g. 'TX', 'CA') — required when
  // country === 'US' for sales-tax lookup + state contractor license
  // routing. Ignored for non-US countries.
  state?: string;
  registrationNumber?: string;
  trade?: string;
  businessType?: string;
  // R263: team size, captured in onboarding step 7. Used by the VAT scheme
  // advisor to suggest KOR / Kleinunternehmer (only solo contractors qualify).
  teamSize?: 'solo' | 'small' | 'medium' | 'large';
  certifications?: string[];
  serviceAreaRadius?: number;
  enabledPaymentMethods?: string[];
  // R250: VAT scheme — drives every invoice's VAT treatment.
  vatScheme?: VatScheme;
  // R66 NL launch: payment + locale fields. Migration
  // `20260415000001_business_profiles.sql` declared these on
  // `business_settings` but the mapper + UI dropped them. Without `iban`,
  // every NL invoice PDF rendered with no bank details — customers had no
  // way to pay. Same shape covers DE Bezahldetails / FR coordonnées
  // bancaires for the EU6 expansion.
  iban?: string;
  bic?: string;
  // R74 US foundation: ACH bank details — used in place of IBAN/BIC when
  // country === 'US'. Routing # is 9 digits (ABA), account # is 4-17
  // digits. Both rendered on US invoice PDFs in lieu of SEPA fields.
  routingNumber?: string;
  bankAccountNumber?: string;
  // R79 US Phase 2: state-licensing array. Each entry tracks a per-state
  // license that the contractor holds. Stored as JSONB on
  // `business_settings.licenses` (migration 20260520000001). The
  // 30-day-before-expiry warning fires from
  // `complianceGatingService.checkLicenseExpiry()` (client-side).
  licenses?: ContractorLicense[];
  postcode?: string;
  city?: string;
  /** IT/ES provincia, 2 letters. Separate from the US `state` field, which has
   *  different values and validation. */
  province?: string;
  /** Country-interpreted. IT: RegimeFiscale RF01–RF19, mandatory in FatturaPA
   *  — there is no safe default, because RF01 on a forfettario is a fiscally
   *  wrong invoice that SDI ACCEPTS, so nobody ever finds out. ES: régimen. */
  fiscalRegime?: string;
  /** 'F' natural person / 'J' legal person. Facturae requires it explicitly;
   *  it also decides Nome+Cognome vs Denominazione in FatturaPA. */
  personType?: 'F' | 'J';
  website?: string;
  invoicePrefix?: string;
  quotePrefix?: string;
  defaultPaymentTerms?: number;
};

export function isSmallBusinessExempt(profile: { vatScheme?: VatScheme }): boolean {
  return profile.vatScheme === 'small_business_NL_KOR'
      || profile.vatScheme === 'small_business_DE_kleinunternehmer';
}

// R66r50: country-aware standard VAT rates for EU6. Pre-R66r50 the codebase
// hardcoded 21 (NL) across quote builder, photo-quote, invoice import, cohort
// writes, and Moneybird export — DE/FR/ES/IT/UK contractors got NL rate.
// Source of truth lives in `src/constants/taxRates.ts` (decimal: 0.21 etc).
// We return percentages here (21 etc) to match existing call-site convention.
import { getVATRate as getVATRateDecimal } from '../constants/taxRates';

export function getStandardVatRate(country: BusinessProfile['country']): number {
  return Math.round(getVATRateDecimal(country ?? 'NL') * 100);
}

export function getEffectiveVatRate(profile: { country?: BusinessProfile['country']; vatScheme?: VatScheme }): number {
  if (isSmallBusinessExempt(profile)) return 0;
  return getStandardVatRate(profile.country);
}

// R66r59: country-specific reduced VAT rates for line-item-level overrides.
// Returns the percent value when a reduced rate is legally applicable in
// that country for trade-relevant categories, or null when the country
// has no relevant reduced bracket.
//
// NL 9% — renovation + maintenance labor on residential homes >2 years
//   old (Belastingdienst Verlaagd tarief, BTW-Tarievenregeling). Applies
//   to plumbing/electrical/painting/tiling/etc — the bread-and-butter of
//   solo contractors. Big real-money issue: at 21% the contractor either
//   over-charges the customer or eats the difference at year-end VAT
//   reconciliation. Source: belastingdienst.nl/wps/wcm/connect/bldcontentnl/
//   belastingdienst/zakelijk/btw/tarieven_en_vrijstellingen/
//   diensten_9_btw/diensten_aan_woningen_ouder_dan_2_jaar.
// Other EU6: reduced rates exist (DE 7%, FR 5.5%/10%, ES 10%, IT 10%,
//   UK 5%) but apply to food/books/energy/transport — not construction
//   labor — so we return null for those until a real product case lands.
export function getReducedVatRate(country: BusinessProfile['country']): number | null {
  if (country === 'NL') return 9;
  return null;
}

export function getVatExemptionNote(country: string | undefined, vatScheme: VatScheme | undefined): string | null {
  if (vatScheme === 'small_business_NL_KOR') {
    return 'BTW niet van toepassing — kleineondernemersregeling (KOR).';
  }
  if (vatScheme === 'small_business_DE_kleinunternehmer') {
    return 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmer).';
  }
  return null;
}

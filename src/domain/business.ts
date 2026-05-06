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

export type BusinessProfile = {
  isComplete: boolean;
  completenessPercent: number;
  businessName?: string;
  kvkNumber?: string;
  vatNumber?: string;
  address?: string;
  email?: string;
  phone?: string;
  country?: 'UK' | 'NL' | 'DE' | 'FR' | 'ES' | 'IT';
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
  postcode?: string;
  city?: string;
  website?: string;
  invoicePrefix?: string;
  quotePrefix?: string;
  defaultPaymentTerms?: number;
};

export function isSmallBusinessExempt(profile: { vatScheme?: VatScheme }): boolean {
  return profile.vatScheme === 'small_business_NL_KOR'
      || profile.vatScheme === 'small_business_DE_kleinunternehmer';
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

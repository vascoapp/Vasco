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
  certifications?: string[];
  serviceAreaRadius?: number;
  enabledPaymentMethods?: string[];
  // R250: VAT scheme — drives every invoice's VAT treatment.
  vatScheme?: VatScheme;
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

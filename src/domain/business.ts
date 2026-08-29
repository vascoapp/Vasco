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
// FR 10% — travaux d'amélioration, de transformation, d'aménagement et
//   d'entretien on dwellings completed more than 2 years ago (CGI art.
//   279-0 bis). This IS construction labour and it is the ordinary rate a
//   French artisan charges on residential renovation. `einvoice-fr.ts` has
//   said so in this repo the whole time: `INTERMEDIAIRE: 10, // Taux
//   intermédiaire (rénovation logement > 2 ans)`.
//   NOT covered here: the 5.5% taux réduit for energy-renovation work (CGI
//   art. 278-0 bis A). One function returning one number cannot express two
//   brackets; a French contractor doing energy work still has to correct the
//   rate by hand. Widening the return type is the follow-up.
// IT 10% — manutenzione ordinaria e straordinaria on residential buildings
//   (DPR 633/1972, Tabella A parte III n. 127-quaterdecies). Again
//   construction, and again already written down next door in
//   `einvoice-it.ts`: `RIDOTTA_10: 10, // Aliquota ridotta (ristrutturazione
//   edilizia)`. The 4% prima casa bracket is narrower and is not modelled.
// ES 10% — obras de renovación y reparación on dwellings (Ley 37/1992 art.
//   91.Uno.2.10º), subject to conditions the contractor asserts: the client
//   is not acting as a business, the building is over 2 years old, and
//   supplied materials do not exceed 40% of the taxable base.
//
// The previous version of this function returned null for all five non-NL
// markets, on the stated grounds that their reduced rates "apply to
// food/books/energy/transport — not construction labor". For FR, IT and ES
// that premise was simply wrong, and two files in this same repo contradicted
// it. The consequence was not cosmetic: the opt-in toggle in
// `TieredQuoteBuilder` renders only when this returns non-null, so a French
// artisan quoting a bathroom refit had no way to reach 10% and was billed out
// at 20% — roughly 9% too expensive, or the same amount out of his own margin
// at the year-end reconciliation. In Italy the gap was 22% vs 10%.
//
// Still null, deliberately:
// DE 7% — covers food, books, transport, cultural admission. German
//   construction labour has no reduced bracket; 19% is correct.
// UK 5% — exists for residential conversions and for dwellings empty at
//   least 2 years (VAT Notice 708), but it is conditional and much narrower
//   than a general renovation rate, so it needs its own product case rather
//   than a shared "renovation" toggle.
//
// This stays an explicit opt-in per quote: the contractor asserts the work
// qualifies, exactly as the NL 9% has always worked. Nothing applies a
// reduced rate on its own.
export function getReducedVatRate(country: BusinessProfile['country']): number | null {
  if (country === 'NL') return 9;
  if (country === 'FR' || country === 'IT' || country === 'ES') return 10;
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

/**
 * NET → GROSS, rounded to cents.
 *
 * `Invoice.amount` is GROSS everywhere in this app while `Quote.amount` is the
 * NET sum of its line items, so every path that turns one into the other has to
 * cross that boundary. Two of them did it with the same inline arithmetic and a
 * third (`addInvoice`, the most travelled) did not do it at all — it copied the
 * quote's net straight onto the invoice. The result was one field carrying two
 * units: an invoice whose own detail screen read "126,14 €" contributed
 * "106,00 €" to UMSATZ, and revenue summed quote-derived nets together with
 * job-derived grosses.
 *
 * One helper so the conversion cannot drift again. A 0% rate (KOR /
 * Kleinunternehmer) returns the net unchanged, which is correct: there is no
 * VAT to add.
 */
/**
 * NET → GROSS for a document that has its own agreed line rates.
 *
 * `addInvoice` grossed every quote at `getEffectiveVatRate(businessProfile)` —
 * the country's STANDARD rate — while copying the quote's line items, rates and
 * all, onto the invoice. So a quote agreed at a reduced rate produced an
 * invoice whose lines said 10% and whose `amount` had been grossed at 20%. The
 * customer is billed the wrong VAT, and the invoice disagrees with itself.
 *
 * Latent for NL's 9% since the toggle shipped; reachable in FR/IT/ES from the
 * moment `getReducedVatRate` started returning a rate for them.
 *
 * Precedence, most specific first:
 *   1. exempt (fallback 0) — KOR / Kleinunternehmer charge no VAT, full stop;
 *   2. every line has a rate AND the lines add up to the document's net —
 *      sum the lines, which is the only correct answer for a MIXED-rate quote
 *      (NL 9% labour + 21% materials is the ordinary case);
 *   3. every line has the SAME rate — use it, even if the line sum has drifted
 *      from `amount` (a discount, a rounding, a hand-edited total);
 *   4. otherwise the profile rate, as before.
 */
export function grossFromDocumentLines(
  netAmount: number,
  lines: Array<{ quantity: number; unitPrice: number; vatRate?: number }> | undefined,
  fallbackVatRatePercent: number,
): number {
  if (fallbackVatRatePercent === 0) return Math.round(netAmount * 100) / 100;
  const rated = (lines ?? []).filter(
    (l) => typeof l.vatRate === 'number' && Number.isFinite(l.vatRate),
  );
  if (rated.length === 0 || rated.length !== (lines ?? []).length) {
    return grossFromNet(netAmount, fallbackVatRatePercent);
  }
  const lineNet = rated.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  if (Math.abs(lineNet - netAmount) <= 0.01) {
    const gross = rated.reduce(
      (s, l) => s + l.quantity * l.unitPrice * (1 + (l.vatRate as number) / 100),
      0,
    );
    return Math.round(gross * 100) / 100;
  }
  const rates = Array.from(new Set(rated.map((l) => l.vatRate as number)));
  if (rates.length === 1) return grossFromNet(netAmount, rates[0]);
  return grossFromNet(netAmount, fallbackVatRatePercent);
}

export function grossFromNet(netAmount: number, vatRatePercent: number): number {
  return Math.round(netAmount * (1 + vatRatePercent / 100) * 100) / 100;
}

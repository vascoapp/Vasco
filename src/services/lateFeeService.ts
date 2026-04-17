// =============================================================================
// LATE FEE SERVICE — EU Directive 2011/7/EU statutory interest + recovery fee
// =============================================================================
// Every EU member state has transposed Directive 2011/7/EU on combating late
// payment in commercial transactions. For B2B invoices past their payment
// deadline, the creditor is entitled to:
//   1. Statutory interest at the reference rate + 8 percentage points (most
//      countries use ECB refi as base; UK uses BoE base).
//   2. A fixed recovery fee of €40 (or £40/£70/£100 tiered in UK under Late
//      Payment of Commercial Debts (Interest) Act 1998).
// These are recoverable WITHOUT a separate contract clause — the law provides
// them automatically once the payment deadline has passed.
//
// IMPORTANT:
//  - Only applies to B2B. Consumer invoices follow different rules per country.
//  - Contractor still needs to include the disclosure line in the reminder;
//    without disclosure, many judges require a warning before enforcing.
//  - Rates change twice a year (ECB sets the refi rate on Jan 1 and Jul 1).
//    Override via `baseRatePctOverride` when ECB moves.
// =============================================================================

export type LateFeeCountry = 'NL' | 'DE' | 'FR' | 'ES' | 'IT' | 'UK';
export type CustomerType = 'business' | 'consumer';

/** ECB refinancing rate as of 2026-01-01 (4.5%). Update each semester. For UK
 * we fall back to BoE base (5.25%) since it's not in EUR. */
const DEFAULT_BASE_RATE_PCT: Record<LateFeeCountry, number> = {
  NL: 4.5,
  DE: 4.5,
  FR: 4.5,
  ES: 4.5,
  IT: 4.5,
  UK: 5.25,
};

/** Statutory margin the directive adds on top of the base rate (B2B). */
const B2B_STATUTORY_MARGIN_PCT = 8;

/** Fixed recovery fee in the local currency. UK has tiered fee per Late
 * Payment of Commercial Debts (Interest) Act 1998 schedule. */
function fixedRecoveryFee(country: LateFeeCountry, invoiceAmount: number): number {
  if (country !== 'UK') return 40;
  if (invoiceAmount < 1000) return 40;
  if (invoiceAmount < 10000) return 70;
  return 100;
}

export interface LateFeeInput {
  invoiceAmount: number;            // base amount owed (excl VAT is fine — interest applies to the whole sum including VAT per the directive, so pass total-with-VAT for strict compliance)
  daysOverdue: number;
  country: LateFeeCountry;
  customerType?: CustomerType;      // defaults to 'business'
  /** Override the reference base rate if ECB/BoE changed since defaults. */
  baseRatePctOverride?: number;
}

export interface LateFeeBreakdown {
  applicable: boolean;              // false when consumer or daysOverdue < 1
  baseRatePct: number;              // e.g. 4.5
  marginPct: number;                // 8 for B2B, 0 for consumer
  effectiveRatePct: number;         // base + margin
  daysOverdue: number;
  interest: number;                 // principal * rate * (days / 365), rounded to cents
  recoveryFee: number;              // 40 (EUR) or tiered GBP for UK
  totalOwedIncludingFees: number;   // invoiceAmount + interest + recoveryFee
  disclosureLine: string;           // ready-to-paste legal disclosure per locale-neutral English
  currency: 'EUR' | 'GBP';
}

export function computeLateFee(input: LateFeeInput): LateFeeBreakdown {
  const customerType = input.customerType ?? 'business';
  const baseRatePct = input.baseRatePctOverride ?? DEFAULT_BASE_RATE_PCT[input.country];
  const marginPct = customerType === 'business' ? B2B_STATUTORY_MARGIN_PCT : 0;
  const effectiveRatePct = baseRatePct + marginPct;
  const currency = input.country === 'UK' ? 'GBP' : 'EUR';

  const applicable = customerType === 'business' && input.daysOverdue >= 1;

  if (!applicable) {
    return {
      applicable: false,
      baseRatePct,
      marginPct,
      effectiveRatePct,
      daysOverdue: input.daysOverdue,
      interest: 0,
      recoveryFee: 0,
      totalOwedIncludingFees: input.invoiceAmount,
      disclosureLine: '',
      currency,
    };
  }

  const interestRaw = input.invoiceAmount * (effectiveRatePct / 100) * (input.daysOverdue / 365);
  const interest = Math.round(interestRaw * 100) / 100;
  const recoveryFee = fixedRecoveryFee(input.country, input.invoiceAmount);
  const totalOwedIncludingFees = Math.round((input.invoiceAmount + interest + recoveryFee) * 100) / 100;

  const currencyPrefix = currency === 'GBP' ? '£' : '€';
  const disclosureLine =
    input.country === 'UK'
      ? `Under the Late Payment of Commercial Debts (Interest) Act 1998, statutory interest of ${effectiveRatePct.toFixed(2)}% applies (${currencyPrefix}${interest.toFixed(2)}) plus a fixed recovery fee of ${currencyPrefix}${recoveryFee.toFixed(0)}.`
      : `Under EU Directive 2011/7/EU, statutory interest of ${effectiveRatePct.toFixed(2)}% applies (${currencyPrefix}${interest.toFixed(2)}) plus a fixed recovery fee of ${currencyPrefix}${recoveryFee.toFixed(0)} for late B2B payment.`;

  return {
    applicable: true,
    baseRatePct,
    marginPct,
    effectiveRatePct,
    daysOverdue: input.daysOverdue,
    interest,
    recoveryFee,
    totalOwedIncludingFees,
    disclosureLine,
    currency,
  };
}

/**
 * Localized disclosure sentence for direct paste into the reminder body.
 * Keep short — 1 sentence. Used when `daysOverdue >= 7` (firm+final cadence).
 */
export function disclosureLineLocalized(
  breakdown: LateFeeBreakdown,
  locale: 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it',
): string {
  if (!breakdown.applicable) return '';
  const { effectiveRatePct, interest, recoveryFee, currency } = breakdown;
  const cur = currency === 'GBP' ? '£' : '€';
  const interestStr = `${cur}${interest.toFixed(2)}`;
  const recoveryStr = `${cur}${recoveryFee.toFixed(0)}`;
  const ratePctStr = `${effectiveRatePct.toFixed(2)}%`;
  switch (locale) {
    case 'nl':
      return `Volgens de Wet Betalingstermijnen (EU-richtlijn 2011/7) komt hier ${ratePctStr} rente bovenop (${interestStr}) plus €${recoveryFee.toFixed(0)} incassokosten.`;
    case 'de':
      return `Nach dem Gesetz zur Bekämpfung von Zahlungsverzug (EU-Richtlinie 2011/7) fallen ${ratePctStr} Verzugszinsen an (${interestStr}) zzgl. ${recoveryStr} Pauschale.`;
    case 'fr':
      return `Conformément à la directive 2011/7/UE sur les retards de paiement, des intérêts de ${ratePctStr} s'appliquent (${interestStr}) plus une indemnité forfaitaire de ${recoveryStr}.`;
    case 'es':
      return `Según la Directiva 2011/7/UE sobre morosidad, se aplican intereses del ${ratePctStr} (${interestStr}) más una compensación fija de ${recoveryStr}.`;
    case 'it':
      return `Ai sensi della Direttiva 2011/7/UE sui ritardi di pagamento, si applicano interessi del ${ratePctStr} (${interestStr}) più un importo forfettario di ${recoveryStr}.`;
    case 'en':
    default:
      return breakdown.disclosureLine;
  }
}

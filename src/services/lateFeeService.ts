// =============================================================================
// LATE FEE SERVICE — EU Directive 2011/7/EU statutory interest + recovery fee
// =============================================================================
// Every EU member state has transposed Directive 2011/7/EU on combating late
// payment in commercial transactions. For B2B invoices past their payment
// deadline, the creditor is entitled to:
//   1. Statutory interest at the reference rate + a margin of at least 8
//      points (DE 9, FR 10). Base: ECB refi, except DE (Bundesbank
//      Basiszinssatz) and UK (BoE Bank Rate). See the tables below.
//   2. A fixed recovery fee of €40 (or £40/£70/£100 tiered in UK under Late
//      Payment of Commercial Debts (Interest) Act 1998).
// These are recoverable WITHOUT a separate contract clause — the law provides
// them automatically once the payment deadline has passed.
//
// IMPORTANT:
//  - Only applies to B2B. Consumer invoices follow different rules per country.
//  - Contractor still needs to include the disclosure line in the reminder;
//    without disclosure, many judges require a warning before enforcing.
//  - The statutory reference rates are fixed twice a year (for 1 Jan and
//    1 Jul). DEFAULT_BASE_RATE_PCT must be updated each semester; override via
//    `baseRatePctOverride` in between.
// =============================================================================

import { COUNTRY_CONFIG, formatCurrency } from '../i18n/formatting';

export type LateFeeCountry = 'NL' | 'DE' | 'FR' | 'ES' | 'IT' | 'UK';
export type CustomerType = 'business' | 'consumer';

const LATE_FEE_COUNTRIES: readonly LateFeeCountry[] = ['NL', 'DE', 'FR', 'ES', 'IT', 'UK'];

/**
 * The market's late-fee regime, or null when there is none we know.
 *
 * Every caller used to write `supported.includes(c) ? c : 'NL'`, which told a
 * US contractor they were owed EU statutory interest plus €40. A market we do
 * not cover gets NO claim (CLAUDE.md: a country-dependent nudge must skip when
 * the country is unknown, never default).
 */
export function lateFeeCountry(country: string | null | undefined): LateFeeCountry | null {
  return LATE_FEE_COUNTRIES.includes(country as LateFeeCountry) ? (country as LateFeeCountry) : null;
}

/**
 * Whether the statutory B2B claim may be made against this customer.
 *
 * The commercial rate and the fixed €40 fee exist for B2B transactions only.
 * A consumer owes neither: they owe the market's ordinary statutory interest,
 * and collection costs only on that market's own terms (NL: after a 14-day
 * WIK letter). Every caller hardcoded 'business', and the disclosure went out
 * in the reminder EMAIL — so a private householder was quoted the B2B figures.
 *
 * `Customer` has no business/consumer flag. A VAT id is positive evidence of a
 * business, so that is the test. No evidence → no claim: a missing claim is
 * recoverable, a confident wrong legal claim sent to a customer is not (#306).
 *
 * ES is the exception: Facturae needs the buyer's NIF even for a private
 * person, so `vatId` holds one for consumers too. A legal entity's NIF (CIF)
 * starts with an entity letter; a person's starts with a digit (DNI) or
 * K/L/M/X/Y/Z. Self-employed autónomos use their DNI and so read as consumers
 * here — fail closed, same reasoning.
 */
export function lateFeeCustomerType(
  customer: { vatId?: string } | null | undefined,
  country: LateFeeCountry,
): CustomerType {
  const id = customer?.vatId?.trim() ?? '';
  if (!id) return 'consumer';
  if (country === 'ES') {
    // An intra-EU VAT number carries the "ES" prefix in front of the NIF.
    return /^[A-HJNP-SUVW]/i.test(id.replace(/^ES/i, '')) ? 'business' : 'consumer';
  }
  return 'business';
}

/**
 * Reference rate in force for 2026 H2 (from 2026-07-01). Update each semester.
 * - EUR markets: ECB main refinancing rate, 2.40% (NL wettelijke handelsrente
 *   10,4% and FR's default 12,40% both confirm it).
 * - DE: NOT the ECB rate — §288 BGB runs on the Bundesbank Basiszinssatz
 *   (§247 BGB), 1.52% from 2026-07-01.
 * - UK: Bank of England Bank Rate on the 30 June reference day, 3.75%.
 * Was a flat "ECB 4.5% as of 2026-01-01" for all five EUR markets — the 2023
 * rate — which overstated every interest figure, including the one pasted into
 * reminder emails.
 */
const DEFAULT_BASE_RATE_PCT: Record<LateFeeCountry, number> = {
  NL: 2.4,
  DE: 1.52,
  FR: 2.4,
  ES: 2.4,
  IT: 2.4,
  UK: 3.75,
};

/**
 * Statutory B2B margin over the reference rate. The directive sets a FLOOR of
 * 8 points; two markets transposed it higher, and a flat 8 under-stated both:
 * - NL art. 6:119a BW · ES Ley 3/2004 art. 7 · IT D.Lgs. 231/2002 art. 5 · UK
 *   Late Payment of Commercial Debts (Interest) Act 1998: 8
 * - DE §288 Abs. 2 BGB: 9
 * - FR Code de commerce L441-10: 10 (the default when the terms set no rate)
 */
const B2B_STATUTORY_MARGIN_PCT: Record<LateFeeCountry, number> = {
  NL: 8,
  DE: 9,
  FR: 10,
  ES: 8,
  IT: 8,
  UK: 8,
};

/** A statutory rate in the market's own number format: "10,52" / "12,4" / "11.75". */
export function formatLateFeeRate(ratePct: number, country: LateFeeCountry): string {
  return new Intl.NumberFormat(COUNTRY_CONFIG[country].locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(ratePct);
}

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
  country: LateFeeCountry;
}

export function computeLateFee(input: LateFeeInput): LateFeeBreakdown {
  const customerType = input.customerType ?? 'business';
  const baseRatePct = input.baseRatePctOverride ?? DEFAULT_BASE_RATE_PCT[input.country];
  const marginPct = customerType === 'business' ? B2B_STATUTORY_MARGIN_PCT[input.country] : 0;
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
      country: input.country,
    };
  }

  const interestRaw = input.invoiceAmount * (effectiveRatePct / 100) * (input.daysOverdue / 365);
  const interest = Math.round(interestRaw * 100) / 100;
  const recoveryFee = fixedRecoveryFee(input.country, input.invoiceAmount);
  const totalOwedIncludingFees = Math.round((input.invoiceAmount + interest + recoveryFee) * 100) / 100;

  const rate = formatLateFeeRate(effectiveRatePct, input.country);
  const interestStr = formatCurrency(interest, input.country);
  const recoveryStr = formatCurrency(recoveryFee, input.country);
  const disclosureLine =
    input.country === 'UK'
      ? `Under the Late Payment of Commercial Debts (Interest) Act 1998, statutory interest of ${rate}% applies (${interestStr}) plus a fixed recovery fee of ${recoveryStr}.`
      : `Under EU Directive 2011/7/EU, statutory interest of ${rate}% applies (${interestStr}) plus a fixed recovery fee of ${recoveryStr} for late B2B payment.`;

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
    country: input.country,
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
  const { effectiveRatePct, interest, recoveryFee, country } = breakdown;
  // Numbers follow the CONTRACTOR's market (the invoice's currency and
  // format), like every other amount in the reminder — never `toFixed`, which
  // put "€64.93" in a French email beside a "5 200,00 €" total.
  const interestStr = formatCurrency(interest, country);
  const recoveryStr = formatCurrency(recoveryFee, country);
  const rate = formatLateFeeRate(effectiveRatePct, country);
  const ratePctStr = locale === 'fr' ? `${rate} %` : `${rate}%`;
  switch (locale) {
    case 'nl':
      return `Volgens de Wet Betalingstermijnen (EU-richtlijn 2011/7) komt hier ${ratePctStr} rente bovenop (${interestStr}) plus ${recoveryStr} incassokosten.`;
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

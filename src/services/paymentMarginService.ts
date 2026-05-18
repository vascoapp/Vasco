// =============================================================================
// PAYMENT MARGIN SERVICE — Hybrid pricing: subscription + tier-based commission
// =============================================================================
// Vasco charges commission on every paid invoice. The rate depends on the
// contractor's subscription tier:
//   Free       → 3.5%
//   Pro        → 2% (€39/mo)
//   Contractor → 1% (€69/mo)
// Plus standard payment processor fees (Mollie/Stripe), which apply on top.
//
// Transparency: the disclosure is surfaced during processor connect onboarding
// and in payment settings, localized in 6 languages.
// =============================================================================

import type { Country } from '../context/AuthContext';
import type { SubscriptionTier } from './subscriptionService';

// ─── Tier → Commission Rate ────────────────────────────────────────────────

export const COMMISSION_BY_TIER: Record<SubscriptionTier, number> = {
  free: 3.5,
  pro: 2.0,
  contractor: 1.0,
};

export function getCommissionPercent(tier: SubscriptionTier): number {
  return COMMISSION_BY_TIER[tier];
}

// ─── Payment Methods ───────────────────────────────────────────────────────

export type PaymentMethod =
  | 'ideal'
  | 'sepa_direct_debit'
  | 'credit_card'
  | 'bancontact'
  | 'sofort'
  | 'klarna'
  | 'apple_pay'
  | 'paypal';

/** Legacy export — represents the Free-tier baseline rate (3%) */
export const VASCO_PLATFORM_FEE_PERCENT = COMMISSION_BY_TIER.free;

/**
 * Tier-aware disclosure. Pass the user's current tier to get a specific
 * message. Defaults to free-tier (3%) when tier is unknown.
 */
export function getFeeDisclosure(
  locale: 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it',
  tier: SubscriptionTier = 'free',
): string {
  const rate = COMMISSION_BY_TIER[tier];
  const lc = locale as keyof typeof DISCLOSURE_TEMPLATES;
  const tpl = DISCLOSURE_TEMPLATES[lc] ?? DISCLOSURE_TEMPLATES.en;
  return tpl(rate, tier);
}

const TIER_LABEL_BY_LOCALE: Record<string, Record<SubscriptionTier, string>> = {
  en: { free: 'Free', pro: 'Pro', contractor: 'Contractor' },
  nl: { free: 'Gratis', pro: 'Pro', contractor: 'Aannemer' },
  de: { free: 'Free', pro: 'Pro', contractor: 'Contractor' },
  fr: { free: 'Gratuit', pro: 'Pro', contractor: 'Contractor' },
  es: { free: 'Gratis', pro: 'Pro', contractor: 'Contractor' },
  it: { free: 'Gratis', pro: 'Pro', contractor: 'Contractor' },
};

const DISCLOSURE_TEMPLATES = {
  en: (rate: number, tier: SubscriptionTier) =>
    rate === 0
      ? `You're on the ${TIER_LABEL_BY_LOCALE.en[tier]} plan — Vasco charges 0% commission. Payment provider fees (iDEAL, credit card, etc.) apply separately.`
      : `Vasco charges ${rate}% commission on payments received (${TIER_LABEL_BY_LOCALE.en[tier]} plan). Upgrade to lower it. Payment provider fees apply separately.`,
  nl: (rate: number, tier: SubscriptionTier) =>
    rate === 0
      ? `Je hebt het ${TIER_LABEL_BY_LOCALE.nl[tier]}-abonnement — Vasco rekent 0% commissie. Betaalproviderkosten (iDEAL, creditcard, enz.) worden apart berekend.`
      : `Vasco rekent ${rate}% commissie op ontvangen betalingen (${TIER_LABEL_BY_LOCALE.nl[tier]}-abonnement). Upgrade om dit te verlagen. Betaalproviderkosten worden apart berekend.`,
  de: (rate: number, tier: SubscriptionTier) =>
    rate === 0
      ? `Du nutzt den ${TIER_LABEL_BY_LOCALE.de[tier]}-Plan — Vasco berechnet 0% Provision. Zahlungsanbietergebühren (Kreditkarte usw.) fallen separat an.`
      : `Vasco berechnet ${rate}% Provision auf erhaltene Zahlungen (${TIER_LABEL_BY_LOCALE.de[tier]}-Plan). Upgrade um diese zu senken. Zahlungsanbietergebühren fallen separat an.`,
  fr: (rate: number, tier: SubscriptionTier) =>
    rate === 0
      ? `Vous êtes sur l'abonnement ${TIER_LABEL_BY_LOCALE.fr[tier]} — Vasco prélève 0% de commission. Les frais du prestataire de paiement s'appliquent séparément.`
      : `Vasco prélève ${rate}% de commission sur les paiements reçus (abonnement ${TIER_LABEL_BY_LOCALE.fr[tier]}). Passez à un plan supérieur pour la réduire. Les frais du prestataire s'appliquent séparément.`,
  es: (rate: number, tier: SubscriptionTier) =>
    rate === 0
      ? `Estás en el plan ${TIER_LABEL_BY_LOCALE.es[tier]} — Vasco cobra el 0% de comisión. Las comisiones del proveedor de pago se aplican por separado.`
      : `Vasco cobra el ${rate}% de comisión sobre los pagos recibidos (plan ${TIER_LABEL_BY_LOCALE.es[tier]}). Mejora tu plan para reducirla. Las comisiones del proveedor se aplican por separado.`,
  it: (rate: number, tier: SubscriptionTier) =>
    rate === 0
      ? `Sei sull'abbonamento ${TIER_LABEL_BY_LOCALE.it[tier]} — Vasco addebita lo 0% di commissione. Le commissioni del fornitore di pagamento si applicano separatamente.`
      : `Vasco addebita il ${rate}% di commissione sui pagamenti ricevuti (piano ${TIER_LABEL_BY_LOCALE.it[tier]}). Aggiorna il tuo piano per ridurla. Le commissioni del fornitore si applicano separatamente.`,
};

/** Legacy export — defaults to free tier disclosure */
export const VASCO_FEE_DISCLOSURE = {
  en: getFeeDisclosure('en', 'free'),
  nl: getFeeDisclosure('nl', 'free'),
  de: getFeeDisclosure('de', 'free'),
  fr: getFeeDisclosure('fr', 'free'),
  es: getFeeDisclosure('es', 'free'),
  it: getFeeDisclosure('it', 'free'),
};

// ─── Processor Fee Structure ───────────────────────────────────────────────

interface FeeStructure {
  mollieFlatFee: number;         // EUR flat per transaction (processor fee)
  molliePercentageFee: number;   // % of transaction amount (processor fee)
}

export const PAYMENT_FEES: Record<PaymentMethod, FeeStructure> = {
  ideal: { mollieFlatFee: 0.32, molliePercentageFee: 0 },
  sepa_direct_debit: { mollieFlatFee: 0.30, molliePercentageFee: 0 },
  credit_card: { mollieFlatFee: 0.25, molliePercentageFee: 1.8 },
  bancontact: { mollieFlatFee: 0.39, molliePercentageFee: 0 },
  sofort: { mollieFlatFee: 0.30, molliePercentageFee: 0 },
  klarna: { mollieFlatFee: 0.29, molliePercentageFee: 2.99 },
  apple_pay: { mollieFlatFee: 0.25, molliePercentageFee: 1.8 },
  paypal: { mollieFlatFee: 0.35, molliePercentageFee: 2.49 },
};

// ─── Country → Default Methods ─────────────────────────────────────────────

export const COUNTRY_PAYMENT_METHODS: Record<Country, PaymentMethod[]> = {
  NL: ['ideal', 'credit_card', 'sepa_direct_debit', 'apple_pay', 'klarna'],
  DE: ['sofort', 'credit_card', 'sepa_direct_debit', 'apple_pay', 'klarna', 'paypal'],
  FR: ['credit_card', 'apple_pay', 'sepa_direct_debit', 'klarna', 'paypal'],
  ES: ['credit_card', 'apple_pay', 'sepa_direct_debit', 'paypal'],
  IT: ['credit_card', 'apple_pay', 'sepa_direct_debit', 'paypal'],
  UK: ['credit_card', 'apple_pay', 'paypal', 'klarna'],
};

// ─── Fee Calculation ───────────────────────────────────────────────────────

export interface PaymentFeeBreakdown {
  method: PaymentMethod;
  amount: number;
  processorFee: number;           // What Mollie/Stripe charges
  vascoFee: number;               // Tier-based Vasco commission
  totalFee: number;               // processor + Vasco combined
  contractorReceives: number;     // amount - totalFee
  displayProcessorFee: string;    // "EUR 0.32" or "1.8% + EUR 0.25"
  displayVascoFee: string;        // "3% (EUR X.XX)" or "0% (Contractor plan)"
  displayTotalFee: string;        // Combined display
  commissionPercent: number;      // The actual % charged for this calculation
}

export function calculatePaymentFees(
  amount: number,
  method: PaymentMethod,
  tier: SubscriptionTier = 'free',
): PaymentFeeBreakdown {
  const fees = PAYMENT_FEES[method];
  const commissionPercent = COMMISSION_BY_TIER[tier];

  const processorFee = fees.mollieFlatFee + (amount * fees.molliePercentageFee / 100);
  const vascoFee = amount * (commissionPercent / 100);
  const totalFee = processorFee + vascoFee;
  const contractorReceives = amount - totalFee;

  const displayProcessorFee = fees.molliePercentageFee > 0
    ? `${fees.molliePercentageFee}% + EUR ${fees.mollieFlatFee.toFixed(2)}`
    : `EUR ${fees.mollieFlatFee.toFixed(2)}`;

  const displayVascoFee = commissionPercent === 0
    ? `0% (your plan)`
    : `${commissionPercent}% (EUR ${(Math.round(vascoFee * 100) / 100).toFixed(2)})`;

  return {
    method,
    amount,
    processorFee: Math.round(processorFee * 100) / 100,
    vascoFee: Math.round(vascoFee * 100) / 100,
    totalFee: Math.round(totalFee * 100) / 100,
    contractorReceives: Math.round(contractorReceives * 100) / 100,
    displayProcessorFee,
    displayVascoFee,
    displayTotalFee: `EUR ${(Math.round(totalFee * 100) / 100).toFixed(2)}`,
    commissionPercent,
  };
}

// ─── Revenue Projection ────────────────────────────────────────────────────

export interface MonthlyPaymentRevenue {
  totalTransactions: number;
  totalVolume: number;
  totalMollieFees: number;
  totalVascoFees: number;
  totalVascoMargin: number;
  avgMarginPerTransaction: number;
  revenueByMethod: Record<PaymentMethod, { count: number; volume: number; margin: number }>;
}

export function projectMonthlyRevenue(
  avgInvoiceSize: number,
  invoicesPerMonth: number,
  methodDistribution: Partial<Record<PaymentMethod, number>>, // % per method
  tier: SubscriptionTier = 'free',
): MonthlyPaymentRevenue {
  const result: MonthlyPaymentRevenue = {
    totalTransactions: invoicesPerMonth,
    totalVolume: avgInvoiceSize * invoicesPerMonth,
    totalMollieFees: 0,
    totalVascoFees: 0,
    totalVascoMargin: 0,
    avgMarginPerTransaction: 0,
    revenueByMethod: {} as MonthlyPaymentRevenue['revenueByMethod'],
  };

  for (const [method, pct] of Object.entries(methodDistribution)) {
    const count = Math.round(invoicesPerMonth * ((pct as number) / 100));
    if (count === 0) continue;

    const fees = calculatePaymentFees(avgInvoiceSize, method as PaymentMethod, tier);
    const vascoRevenue = fees.vascoFee * count;

    result.totalMollieFees += fees.processorFee * count;
    result.totalVascoFees += fees.totalFee * count;
    result.totalVascoMargin += vascoRevenue;
    result.revenueByMethod[method as PaymentMethod] = {
      count,
      volume: avgInvoiceSize * count,
      margin: Math.round(vascoRevenue * 100) / 100,
    };
  }

  result.avgMarginPerTransaction = invoicesPerMonth > 0
    ? Math.round((result.totalVascoMargin / invoicesPerMonth) * 100) / 100
    : 0;

  return result;
}

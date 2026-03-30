// =============================================================================
// PAYMENT MARGIN SERVICE — Revenue from payment processing
// =============================================================================
// VascoApp charges a flat 1% fee on all payments received through the platform.
// This is communicated upfront during onboarding and in payment settings.
// On top of the 1% Vasco fee, standard payment processor fees apply (Mollie/Stripe).
//
// Transparency: "Vasco charges 1% on payments received. Payment provider fees
// (iDEAL, credit card, etc.) are separate and shown before each transaction."
// =============================================================================

import type { Country } from '../context/AuthContext';

// ─── Fee Structure ─────────────────────────────────────────────────────────

export type PaymentMethod =
  | 'ideal'
  | 'sepa_direct_debit'
  | 'credit_card'
  | 'bancontact'
  | 'sofort'
  | 'klarna'
  | 'apple_pay'
  | 'paypal';

// ─── Vasco Platform Fee ────────────────────────────────────────────────────

/** Vasco takes a flat 1% on all payments received through the platform */
export const VASCO_PLATFORM_FEE_PERCENT = 1.0;

/** Displayed to users during onboarding and in payment settings */
export const VASCO_FEE_DISCLOSURE = {
  en: 'Vasco charges a 1% platform fee on payments received. Payment provider fees (iDEAL, credit card, etc.) apply separately.',
  nl: 'Vasco rekent 1% platformkosten op ontvangen betalingen. Betaalproviderkosten (iDEAL, creditcard, etc.) worden apart berekend.',
  de: 'Vasco berechnet 1% Plattformgebuhr auf erhaltene Zahlungen. Zahlungsanbietergebuhren (Kreditkarte usw.) fallen separat an.',
  fr: 'Vasco facture 1% de frais de plateforme sur les paiements recus. Les frais du prestataire de paiement s\'appliquent separement.',
  es: 'Vasco cobra un 1% de comision de plataforma sobre los pagos recibidos. Las comisiones del proveedor de pago se aplican por separado.',
  it: 'Vasco addebita l\'1% di commissione piattaforma sui pagamenti ricevuti. Le commissioni del fornitore di pagamento si applicano separatamente.',
};

interface FeeStructure {
  mollieFlatFee: number;         // EUR flat per transaction (processor fee)
  molliePercentageFee: number;   // % of transaction amount (processor fee)
  vascoFlatFee: number;          // EUR flat — total charged to contractor
  vascoPercentageFee: number;    // % — total charged (1% Vasco + processor %)
  vascoMarginFlat: number;       // Vasco revenue per transaction
  vascoMarginPercentage: number; // Vasco revenue as % (always 1%)
}

// Fee = processor fee + 1% Vasco platform fee
// Contractor sees: "iDEAL: EUR 0.32 + 1% Vasco fee"
// Vasco always earns 1% of the payment amount
export const PAYMENT_FEES: Record<PaymentMethod, FeeStructure> = {
  ideal: {
    mollieFlatFee: 0.32, molliePercentageFee: 0,
    vascoFlatFee: 0.32, vascoPercentageFee: 1.0,
    vascoMarginFlat: 0, vascoMarginPercentage: 1.0,
  },
  sepa_direct_debit: {
    mollieFlatFee: 0.30, molliePercentageFee: 0,
    vascoFlatFee: 0.30, vascoPercentageFee: 1.0,
    vascoMarginFlat: 0, vascoMarginPercentage: 1.0,
  },
  credit_card: {
    mollieFlatFee: 0.25, molliePercentageFee: 1.8,
    vascoFlatFee: 0.25, vascoPercentageFee: 2.8,  // 1.8% processor + 1% Vasco
    vascoMarginFlat: 0, vascoMarginPercentage: 1.0,
  },
  bancontact: {
    mollieFlatFee: 0.39, molliePercentageFee: 0,
    vascoFlatFee: 0.39, vascoPercentageFee: 1.0,
    vascoMarginFlat: 0, vascoMarginPercentage: 1.0,
  },
  sofort: {
    mollieFlatFee: 0.30, molliePercentageFee: 0,
    vascoFlatFee: 0.30, vascoPercentageFee: 1.0,
    vascoMarginFlat: 0, vascoMarginPercentage: 1.0,
  },
  klarna: {
    mollieFlatFee: 0.29, molliePercentageFee: 2.99,
    vascoFlatFee: 0.29, vascoPercentageFee: 3.99,  // 2.99% processor + 1% Vasco
    vascoMarginFlat: 0, vascoMarginPercentage: 1.0,
  },
  apple_pay: {
    mollieFlatFee: 0.25, molliePercentageFee: 1.8,
    vascoFlatFee: 0.25, vascoPercentageFee: 2.8,
    vascoMarginFlat: 0, vascoMarginPercentage: 1.0,
  },
  paypal: {
    mollieFlatFee: 0.35, molliePercentageFee: 2.49,
    vascoFlatFee: 0.35, vascoPercentageFee: 3.49,  // 2.49% processor + 1% Vasco
    vascoMarginFlat: 0, vascoMarginPercentage: 1.0,
  },
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
  vascoFee: number;               // 1% platform fee
  totalFee: number;               // processor + Vasco combined
  contractorReceives: number;     // amount - totalFee
  displayProcessorFee: string;    // "EUR 0.32" or "1.8% + EUR 0.25"
  displayVascoFee: string;        // "1% (EUR X.XX)"
  displayTotalFee: string;        // Combined display
}

export function calculatePaymentFees(
  amount: number,
  method: PaymentMethod,
): PaymentFeeBreakdown {
  const fees = PAYMENT_FEES[method];

  const processorFee = fees.mollieFlatFee + (amount * fees.molliePercentageFee / 100);
  const vascoFee = amount * (VASCO_PLATFORM_FEE_PERCENT / 100);
  const totalFee = processorFee + vascoFee;
  const contractorReceives = amount - totalFee;

  const displayProcessorFee = fees.molliePercentageFee > 0
    ? `${fees.molliePercentageFee}% + EUR ${fees.mollieFlatFee.toFixed(2)}`
    : `EUR ${fees.mollieFlatFee.toFixed(2)}`;

  return {
    method,
    amount,
    processorFee: Math.round(processorFee * 100) / 100,
    vascoFee: Math.round(vascoFee * 100) / 100,
    totalFee: Math.round(totalFee * 100) / 100,
    contractorReceives: Math.round(contractorReceives * 100) / 100,
    displayProcessorFee,
    displayVascoFee: `1% (EUR ${(Math.round(vascoFee * 100) / 100).toFixed(2)})`,
    displayTotalFee: `EUR ${(Math.round(totalFee * 100) / 100).toFixed(2)}`,
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

    const fees = calculatePaymentFees(avgInvoiceSize, method as PaymentMethod);
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

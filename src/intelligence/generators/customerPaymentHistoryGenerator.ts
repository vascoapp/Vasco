// =============================================================================
// CUSTOMER PAYMENT HISTORY GENERATOR
// =============================================================================
// When creating an invoice/quote, checks the customer's past payment behavior.
// Warns if customer is a slow payer (avg days to pay, overdue count).
// =============================================================================

import type { ScoredInsight, GeneratorContext } from './types';
import { useAppState } from '../../state/AppState';
import { recordMetricSnapshot } from '../learningStorage';
import { logPrediction } from '../calibration';
import { gt } from '../generatorTranslations';
import { useCohortOverdueRate } from '../../services/customerRiskMoatService';

export function useCustomerPaymentHistoryInsight(ctx: GeneratorContext): ScoredInsight | null {
  const { invoices, customers, businessProfile } = useAppState();
  // R211: cohort overdue rate — used as a reference point to decide
  // whether the customer's rate is "just above market" or genuinely risky.
  const cohortRisk = useCohortOverdueRate(businessProfile?.country ?? 'NL', null);

  if (invoices.length < 2 || customers.length === 0) return null;

  // Find customers with payment history
  const customerPaymentData: {
    customerId: string;
    customerName: string;
    avgDaysToPayEstimate: number;
    overdueCount: number;
    totalInvoices: number;
    totalAmount: number;
  }[] = [];

  for (const customer of customers) {
    const custInvoices = invoices.filter(i => i.customer === customer.name || i.customer === customer.id);
    if (custInvoices.length < 2) continue;

    const overdueCount = custInvoices.filter(i => i.status === 'overdue').length;
    const paidInvoices = custInvoices.filter(i => i.status === 'paid');

    // Estimate avg payment days from dueInDays (lower = paid faster)
    const avgDays = custInvoices.reduce((sum, i) => sum + (i.dueInDays ?? 14), 0) / custInvoices.length;
    const totalAmount = custInvoices.reduce((sum, i) => sum + i.amount, 0);

    customerPaymentData.push({
      customerId: customer.id,
      customerName: customer.name,
      avgDaysToPayEstimate: Math.round(avgDays),
      overdueCount,
      totalInvoices: custInvoices.length,
      totalAmount,
    });
  }

  if (customerPaymentData.length === 0) return null;

  // Find the slowest payer (highest overdue count or highest avg days)
  const slowestPayer = customerPaymentData.sort((a, b) => {
    if (b.overdueCount !== a.overdueCount) return b.overdueCount - a.overdueCount;
    return b.avgDaysToPayEstimate - a.avgDaysToPayEstimate;
  })[0];

  if (slowestPayer.overdueCount === 0) return null; // No slow payers

  // Record metric
  recordMetricSnapshot('customerOverdueRate', slowestPayer.overdueCount / slowestPayer.totalInvoices);

  // Log prediction
  logPrediction({
    generatorId: 'customer-payment-history',
    predictedAt: new Date().toISOString(),
    prediction: `${slowestPayer.customerName} heeft ${slowestPayer.overdueCount} verlopen facturen van ${slowestPayer.totalInvoices} totaal`,
    predictedValue: slowestPayer.overdueCount,
  });

  const overdueRate = Math.round((slowestPayer.overdueCount / slowestPayer.totalInvoices) * 100);
  const isSevere = overdueRate > 50;

  return {
    id: 'customer-payment-history',
    generatorId: 'customer-payment-history',
    category: 'financial',
    priority: isSevere ? 'high' : 'medium',
    title: `Betalingsgedrag: ${slowestPayer.customerName}`,
    message: `${slowestPayer.customerName} heeft ${slowestPayer.overdueCount} verlopen facturen (${overdueRate}% van totaal). ${isSevere ? 'Overweeg vooruitbetaling of een betaalkorting.' : 'Stuur facturen snel na oplevering.'}`,
    detail: `${slowestPayer.totalInvoices} facturen, totaal €${slowestPayer.totalAmount.toLocaleString('nl-NL')}. Gemiddelde betaaltermijn: ~${slowestPayer.avgDaysToPayEstimate} dagen.`,
    icon: 'person',
    actionLabel: isSevere ? 'Betaalkorting aanbieden' : 'Stuur herinnering',
    source: gt('source_customer', ctx.language),
    metric: { label: 'Verlopen', value: `${overdueRate}%`, trend: isSevere ? 'down' : 'neutral' },

    rootCauseTags: ['cashflow', 'customer-risk'],
    rawScore: 0,
    reasoning: {
      observation: `${slowestPayer.customerName} betaalt regelmatig te laat`,
      evidence: cohortRisk && cohortRisk.overdueRate !== null && cohortRisk.contractorCount >= 5
        ? `${slowestPayer.overdueCount} van ${slowestPayer.totalInvoices} facturen waren verlopen (${overdueRate}%). Cohort in jouw land: ${Math.round((cohortRisk.overdueRate ?? 0) * 100)}%.`
        : `${slowestPayer.overdueCount} van ${slowestPayer.totalInvoices} facturen waren verlopen`,
      implication: cohortRisk && cohortRisk.overdueRate !== null && overdueRate > (cohortRisk.overdueRate * 100 + 10)
        ? `Dit is ${Math.round(overdueRate - (cohortRisk.overdueRate * 100))}pp boven het cohort — serieuze risico, niet gewoon slechte gewoonte.`
        : `Dit verhoogt je DSO en blokkeert werkkapitaal`,
      suggestion: isSevere
        ? 'Bied 2% korting bij betaling binnen 7 dagen, of vraag een aanbetaling'
        : 'Stuur facturen direct na oplevering en plan automatische herinneringen',
    },
    dataPoints: slowestPayer.totalInvoices,
    confidence: Math.min(0.9, 0.6 + slowestPayer.totalInvoices * 0.05),
    freshness: 2,
  };
}

// =============================================================================
// CUSTOMER PAYMENT HISTORY GENERATOR
// =============================================================================
// When creating an invoice/quote, checks the customer's past payment behavior.
// Warns if customer is a slow payer (avg days to pay, overdue count).
// =============================================================================

import type { ScoredInsight, GeneratorContext } from './types';
import { daysUntilDue } from '../../utils/invoiceDue';
import { useAppState } from '../../state/AppState';
import { recordMetricSnapshot } from '../learningStorage';
import { logPrediction } from '../calibration';
import { gt, gtMoney } from '../generatorTranslations';
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

    // Estimate avg payment days from the due-date offset (lower = paid faster).
    // Derived rather than read from the stored `dueInDays` snapshot, which is
    // frozen at send time and decays — it biased this signal toward whatever
    // constant an invoice happened to be created with.
    //
    // ⚠️ Still an approximation, and knowingly so: this measures how the DUE
    // DATE sits relative to today, not when the customer actually paid. A real
    // payment-speed signal needs a paidAt timestamp, which invoices do not
    // carry yet. Named as an estimate because that is what it is.
    const avgDays = custInvoices.reduce(
      (sum, i) => sum + (daysUntilDue(i) ?? i.dueInDays ?? 14), 0,
    ) / custInvoices.length;
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
    prediction: `${slowestPayer.customerName} has ${slowestPayer.overdueCount} overdue invoices out of ${slowestPayer.totalInvoices} total`,
    predictedValue: slowestPayer.overdueCount,
  });

  const overdueRate = Math.round((slowestPayer.overdueCount / slowestPayer.totalInvoices) * 100);
  const isSevere = overdueRate > 50;

  return {
    id: 'customer-payment-history',
    generatorId: 'customer-payment-history',
    category: 'financial',
    priority: isSevere ? 'high' : 'medium',
    title: gt('cph_title', ctx.language, { name: slowestPayer.customerName }),
    message: gt('cph_message', ctx.language, { name: slowestPayer.customerName, count: slowestPayer.overdueCount, rate: overdueRate })
      + ' ' + (isSevere ? gt('cph_message_severe', ctx.language) : gt('cph_message_mild', ctx.language)),
    detail: gt('cph_detail', ctx.language, { count: slowestPayer.totalInvoices, amount: gtMoney(slowestPayer.totalAmount, ctx.country), days: slowestPayer.avgDaysToPayEstimate }),
    icon: 'person',
    actionLabel: isSevere ? gt('cph_action_discount', ctx.language) : gt('cph_action_reminder', ctx.language),
    source: gt('source_customer', ctx.language),
    metric: { label: gt('cph_metric_overdue', ctx.language), value: `${overdueRate}%`, trend: isSevere ? 'down' : 'neutral' },

    rootCauseTags: ['cashflow', 'customer-risk'],
    rawScore: 0,
    reasoning: {
      observation: gt('cph_obs', ctx.language, { name: slowestPayer.customerName }),
      evidence: cohortRisk && cohortRisk.overdueRate !== null && cohortRisk.contractorCount >= 5
        ? gt('cph_evidence_cohort', ctx.language, { count: slowestPayer.overdueCount, total: slowestPayer.totalInvoices, rate: overdueRate, cohort: Math.round((cohortRisk.overdueRate ?? 0) * 100) })
        : gt('cph_evidence', ctx.language, { count: slowestPayer.overdueCount, total: slowestPayer.totalInvoices }),
      implication: cohortRisk && cohortRisk.overdueRate !== null && overdueRate > (cohortRisk.overdueRate * 100 + 10)
        ? gt('cph_impl_cohort', ctx.language, { pp: Math.round(overdueRate - (cohortRisk.overdueRate * 100)) })
        : gt('cph_impl', ctx.language),
      suggestion: isSevere
        ? gt('cph_sugg_severe', ctx.language)
        : gt('cph_sugg_mild', ctx.language),
    },
    dataPoints: slowestPayer.totalInvoices,
    confidence: Math.min(0.9, 0.6 + slowestPayer.totalInvoices * 0.05),
    freshness: 2,
  };
}

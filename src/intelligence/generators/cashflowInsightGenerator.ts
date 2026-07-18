// =============================================================================
// CASHFLOW INSIGHT GENERATOR
// =============================================================================
// Generates actionable financial insights from FinancialAnalysisService data.
// Produces the highest-priority insight among: overdue invoices, revenue trend,
// customer concentration, negative cashflow projection, win rate drop, high DSO.
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import { useFinancialAnalysis } from '../../services/financialAnalysisService';
import { recordMetricSnapshot } from '../learningStorage';
import { logPrediction } from '../calibration';
import { gt } from '../generatorTranslations';
import { useAppState } from '../../state/AppState';
import { useCohortDso } from '../../services/paymentTimingMoatService';
import { useMarginDrift } from '../../services/marginDriftService';

export const cashflowInsightGenerator: InsightGenerator = {
  id: 'cashflow-insight',
  screens: ['geld', 'today', 'cashflow', 'invoices'],
  roles: ['contractor'],
  generate(_ctx: GeneratorContext): ScoredInsight | null {
    return null; // hook-based — see useCashflowInsight below
  },
};

export function useCashflowInsight(ctx: GeneratorContext): ScoredInsight | null {
  const fin = useFinancialAnalysis();
  const { businessProfile } = useAppState();
  // R211: cohort DSO — replace the static "14-21 days" benchmark with a
  // real country-specific median when available.
  const cohortDso = useCohortDso(businessProfile?.country ?? 'NL', null);
  // R215: margin drift — used in win-rate low branch to clarify if the
  // issue is trade-wide compression vs individual pricing.
  const marginDrift = useMarginDrift(businessProfile?.trade ?? 'general', businessProfile?.country ?? 'NL');

  // Record metric snapshots for trend tracking
  if (fin.avgDaysToPayment > 0) recordMetricSnapshot('dso', fin.avgDaysToPayment);
  if (fin.totalRevenue > 0) recordMetricSnapshot('revenue', fin.totalRevenue);
  if (fin.quoteWinRate > 0) recordMetricSnapshot('win_rate', fin.quoteWinRate);

  // Collect candidate insights, pick highest priority
  const candidates: ScoredInsight[] = [];
  const lang = ctx.language;

  // 1. Overdue invoices — critical if > 0
  if (fin.overdueCount > 0) {
    const amount = Math.round(fin.overdueAmount);
    candidates.push({
      id: `fin-overdue-${fin.overdueCount}`,
      generatorId: 'cashflow-insight',
      category: 'financial',
      priority: fin.overdueAmount > 2000 ? 'critical' : 'high',
      title: gt('fin_overdue_title', lang, { count: fin.overdueCount, amount }),
      message: gt('fin_overdue_message', lang, {
        count: fin.overdueCount,
        amount: amount.toLocaleString(),
        days: fin.avgDaysToPayment,
      }),
      detail: fin.overdueDetails
        .slice(0, 3)
        .map(d => gt('fin_overdue_detail_item', lang, {
          customer: d.customer,
          amount: d.amount,
          days: d.daysOverdue,
        }))
        .join('. '),
      icon: 'alert-circle',
      actionLabel: gt('fin_action_send_invoices', lang),
      actionRoute: '/(contractor)/facturen',
      source: gt('source_financial_analysis', lang),
      metric: { label: gt('fin_overdue_metric', lang), value: `\u20AC${amount.toLocaleString()}`, trend: 'down' },
      rootCauseTags: ['cashflow', 'overdue'],
      rawScore: 0.95,
      reasoning: {
        observation: `${fin.overdueCount} invoices are past due, totaling \u20AC${amount}`,
        evidence: `Based on ${fin.overdueDetails.length} overdue invoices. Avg DSO: ${fin.avgDaysToPayment} days.`,
        implication: `Delayed payments reduce working capital and create cash flow pressure.`,
        suggestion: `Send reminders for oldest overdue invoices first. Consider auto-reminders.`,
      },
      dataPoints: fin.overdueDetails.length,
      confidence: 0.95,
      freshness: 1,
      action: {
        type: 'send_reminder',
        label: gt('fin_action_send_invoices', lang),
        params: { overdueCount: fin.overdueCount, overdueAmount: amount },
        requiresApproval: true,
      },
    });
  }

  // 2. Revenue growth / decline
  if (Math.abs(fin.revenueGrowth) >= 10) {
    const growing = fin.revenueGrowth > 0;
    const pct = Math.abs(Math.round(fin.revenueGrowth));
    candidates.push({
      id: `fin-revenue-${growing ? 'up' : 'down'}-${pct}`,
      generatorId: 'cashflow-insight',
      category: 'financial',
      priority: growing ? 'medium' : 'high',
      title: growing
        ? gt('fin_revenue_growth_title', lang, { pct })
        : gt('fin_revenue_decline_title', lang, { pct }),
      message: growing
        ? `Monthly revenue increased by ${pct}%. Avg monthly: \u20AC${Math.round(fin.avgMonthlyRevenue).toLocaleString()}.`
        : `Monthly revenue decreased by ${pct}%. Review pipeline and pricing.`,
      icon: growing ? 'trending-up' : 'trending-down',
      actionLabel: growing ? undefined : gt('fin_action_review_pricing', lang),
      actionRoute: growing ? undefined : '/(contractor)/geld',
      source: gt('source_financial_analysis', lang),
      metric: { label: 'Growth', value: `${growing ? '+' : '-'}${pct}%`, trend: growing ? 'up' : 'down' },
      rootCauseTags: ['cashflow', 'revenue'],
      rawScore: growing ? 0.5 : 0.8,
      reasoning: {
        observation: `Revenue ${growing ? 'grew' : 'declined'} ${pct}% month-over-month`,
        evidence: `Based on paid invoices. Avg monthly revenue: \u20AC${Math.round(fin.avgMonthlyRevenue)}.`,
        implication: growing
          ? `Positive trend — maintain current pace.`
          : `Declining trend may indicate pipeline issues or seasonal dip.`,
        suggestion: growing
          ? `Consider capacity planning for sustained growth.`
          : `Review quote pipeline, follow up on sent quotes, check pricing.`,
      },
      dataPoints: fin.monthlyRevenue.filter(m => m.revenue > 0).length,
      confidence: 0.75,
      freshness: 1,
    });
  }

  // 3. Customer concentration risk
  if (fin.concentrationRisk && fin.topCustomers.length > 0) {
    const top = fin.topCustomers[0];
    candidates.push({
      id: `fin-concentration-${top.customer}`,
      generatorId: 'cashflow-insight',
      category: 'financial',
      priority: top.percentage > 70 ? 'high' : 'medium',
      title: gt('fin_concentration_title', lang, { pct: top.percentage, name: top.customer }),
      message: `${top.percentage}% of revenue comes from ${top.customer}. Losing this client would be a major risk.`,
      icon: 'warning',
      actionLabel: gt('fin_action_diversify', lang),
      source: gt('source_financial_analysis', lang),
      metric: { label: 'Concentration', value: `${top.percentage}%`, trend: 'down' },
      rootCauseTags: ['cashflow', 'concentration'],
      rawScore: 0.65,
      reasoning: {
        observation: `Top customer accounts for ${top.percentage}% of total revenue`,
        evidence: `${top.customer}: \u20AC${top.revenue} from ${top.invoiceCount} invoices.`,
        implication: `High customer concentration increases business risk.`,
        suggestion: `Actively pursue new customers. Aim for no single client above 30%.`,
      },
      dataPoints: fin.topCustomers.length,
      confidence: 0.85,
      freshness: 1,
    });
  }

  // 4. Negative projected cashflow
  if (fin.projectedCashflow < 0) {
    candidates.push({
      id: `fin-cashflow-negative`,
      generatorId: 'cashflow-insight',
      category: 'financial',
      priority: 'high',
      title: gt('fin_cashflow_negative_title', lang),
      message: `Projected cashflow: \u20AC${fin.projectedCashflow.toLocaleString()}. Send pending invoices and follow up on overdue payments.`,
      icon: 'arrow-down-circle',
      actionLabel: gt('fin_action_send_invoices', lang),
      actionRoute: '/(contractor)/facturen',
      source: gt('source_financial_analysis', lang),
      metric: { label: 'Cashflow', value: `\u20AC${fin.projectedCashflow.toLocaleString()}`, trend: 'down' },
      rootCauseTags: ['cashflow', 'negative-projection'],
      rawScore: 0.85,
      reasoning: {
        observation: `Next month projected cashflow is negative: \u20AC${fin.projectedCashflow}`,
        evidence: `Based on 3-month trailing average and pipeline conversion rate.`,
        implication: `Working capital shortfall may require financing or payment acceleration.`,
        suggestion: `Invoice completed work immediately. Send reminders for overdue invoices.`,
      },
      dataPoints: 6,
      confidence: 0.7,
      freshness: 1,
      action: {
        type: 'send_reminder',
        label: gt('fin_action_send_invoices', lang),
        params: { projectedCashflow: fin.projectedCashflow },
        requiresApproval: true,
      },
    });
  }

  // 5. Low quote win rate
  if (fin.quoteWinRate > 0 && fin.quoteWinRate < 50) {
    candidates.push({
      id: `fin-winrate-${fin.quoteWinRate}`,
      generatorId: 'cashflow-insight',
      category: 'financial',
      priority: fin.quoteWinRate < 30 ? 'high' : 'medium',
      title: gt('fin_winrate_drop_title', lang, { pct: fin.quoteWinRate }),
      message: `Win rate: ${fin.quoteWinRate}%. Pipeline: \u20AC${fin.quotePipeline.toLocaleString()}. Avg quote: \u20AC${fin.avgQuoteValue.toLocaleString()}.`,
      icon: 'stats-chart',
      actionLabel: gt('fin_action_review_pricing', lang),
      actionRoute: '/(contractor)/geld',
      source: gt('source_financial_analysis', lang),
      metric: { label: 'Win Rate', value: `${fin.quoteWinRate}%`, trend: 'down' },
      rootCauseTags: ['cashflow', 'quotes', 'win-rate'],
      rawScore: 0.6,
      reasoning: {
        observation: `Quote win rate is ${fin.quoteWinRate}%`,
        evidence: marginDrift && marginDrift.driftPp < -2
          ? `Based on all decided quotes. Cohort margin dropped ${marginDrift.driftPp.toFixed(1)}pp recently — market-wide compression, not just you.`
          : `Based on all decided quotes (accepted + rejected + expired).`,
        implication: marginDrift && marginDrift.driftPp < -2
          ? `Trade margins are compressing cohort-wide. Pricing below market won't solve this — consider upselling or tier-based differentiation.`
          : `Low conversion means more effort per acquired job. Review pricing.`,
        suggestion: `Consider tiered pricing, faster response times, or competitive analysis.`,
      },
      dataPoints: 3,
      confidence: 0.7,
      freshness: 1,
    });
  }

  // 6. High DSO (> 30 days)
  if (fin.avgDaysToPayment > 30) {
    candidates.push({
      id: `fin-dso-${fin.avgDaysToPayment}`,
      generatorId: 'cashflow-insight',
      category: 'financial',
      priority: fin.avgDaysToPayment > 45 ? 'high' : 'medium',
      title: gt('fin_dso_high_title', lang, { days: fin.avgDaysToPayment }),
      message: cohortDso?.medianDso && cohortDso.sampleSize > 0
        ? `Customers take an average of ${fin.avgDaysToPayment} days to pay. Cohort median: ${Math.round(cohortDso.medianDso)} days.`
        : `Customers take an average of ${fin.avgDaysToPayment} days to pay. Industry benchmark: 14-21 days.`,
      icon: 'hourglass',
      actionLabel: gt('fin_action_send_invoices', lang),
      actionRoute: '/(contractor)/facturen',
      source: gt('source_financial_analysis', lang),
      metric: { label: 'DSO', value: `${fin.avgDaysToPayment}d`, trend: 'down' },
      rootCauseTags: ['cashflow', 'dso'],
      rawScore: 0.55,
      reasoning: {
        observation: `Average days to payment: ${fin.avgDaysToPayment} days`,
        evidence: cohortDso?.medianDso && cohortDso.sampleSize > 0
          ? `Based on paid invoices with sent and paid dates. Cohort (${cohortDso.contractorCount} contractors, ${cohortDso.sampleSize} samples) median: ${Math.round(cohortDso.medianDso)}d.`
          : `Based on paid invoices with sent and paid dates.`,
        implication: cohortDso?.medianDso && fin.avgDaysToPayment > cohortDso.medianDso + 7
          ? `You're ${fin.avgDaysToPayment - Math.round(cohortDso.medianDso)}d above cohort — real capital drag, not just seasonal.`
          : `High DSO ties up working capital and increases cash flow risk.`,
        suggestion: `Send invoices sooner, offer payment links, use automated reminders.`,
      },
      dataPoints: 3,
      confidence: 0.8,
      freshness: 1,
    });
  }

  // Pick the highest-priority candidate
  if (candidates.length === 0) return null;

  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  candidates.sort((a, b) => {
    const pa = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 3;
    const pb = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 3;
    if (pa !== pb) return pa - pb;
    return b.rawScore - a.rawScore;
  });

  const best = candidates[0];

  // Log prediction for calibration
  logPrediction({
    generatorId: 'cashflow-insight',
    predictedAt: new Date().toISOString(),
    prediction: best.title,
    predictedValue: best.rawScore,
  });

  return best;
}

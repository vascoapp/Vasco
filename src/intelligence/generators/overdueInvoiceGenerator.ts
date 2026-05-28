// =============================================================================
// OVERDUE INVOICE GENERATOR
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import { useCashFlow } from '../../services/cashFlowService';
import { recordMetricSnapshot, getTrend } from '../learningStorage';
import { isAboveThreshold, detectAnomaly, getSeasonalMultiplier } from '../adaptiveThresholds';
import { logPrediction } from '../calibration';
import { gt, gtMoney } from '../generatorTranslations';
import { MS_PER_DAY } from '../../utils/timeConstants';

export const overdueInvoiceGenerator: InsightGenerator = {
  id: 'overdue-invoice',
  screens: ['today', 'invoices'],
  roles: ['contractor'],
  generate(ctx: GeneratorContext): ScoredInsight | null {
    return null; // Data injected via hook wrapper
  },
};

export function useOverdueInvoiceInsight(ctx: GeneratorContext): ScoredInsight | null {
  const { invoices } = useCashFlow();
  const overdueInvoices = invoices.filter(i => i.status === 'overdue');

  if (overdueInvoices.length === 0) return null;

  const totalOverdue = overdueInvoices.reduce((sum, i) => sum + i.amount, 0);
  const avgDaysOverdue = overdueInvoices.reduce((sum, i) => {
    const dueDate = new Date(i.dueDate);
    const days = Math.floor((ctx.now.getTime() - dueDate.getTime()) / MS_PER_DAY);
    return sum + Math.max(0, days);
  }, 0) / overdueInvoices.length;

  // Record metric snapshot for trend tracking
  recordMetricSnapshot('overdueAmount', totalOverdue);

  // Log prediction for calibration: "overdue amount will be €X"
  logPrediction({
    generatorId: 'overdue-invoice',
    predictedAt: new Date().toISOString(),
    prediction: `Outstanding amount: ${gtMoney(totalOverdue, ctx.country)} (${overdueInvoices.length} invoices)`,
    predictedValue: totalOverdue,
  });

  // Use adaptive threshold instead of hardcoded >5000
  const isSignificant = isAboveThreshold(ctx.profile, 'overdueAmount', totalOverdue);

  // Anomaly detection: escalate on sudden overdue spikes
  const anomaly = detectAnomaly(ctx.profile, 'overdueAmount', totalOverdue);

  // Seasonal context
  const seasonMult = getSeasonalMultiplier('overdueAmount');
  const seasonNote = seasonMult > 1.05 ? ` ${gt('overdue_season_note', ctx.language)}` : '';
  const priority = anomaly.severity === 'severe' ? 'critical'
    : anomaly.severity === 'moderate' ? 'high'
    : overdueInvoices.length >= 3 || isSignificant ? 'high' : 'medium';

  // Get collection velocity trend
  const trend = getTrend(ctx.profile, 'overdueAmount', 4);
  const trendText = trend
    ? trend.direction === 'declining'
      ? ` ${gt('overdue_trend_down', ctx.language, { from: gtMoney(trend.previousValue, ctx.country), to: gtMoney(trend.currentValue, ctx.country) })}`
      : trend.direction === 'improving'
        ? ` ${gt('overdue_trend_up', ctx.language, { from: gtMoney(trend.previousValue, ctx.country), to: gtMoney(trend.currentValue, ctx.country) })}`
        : ''
    : '';

  return {
    id: 'overdue-invoices',
    generatorId: 'overdue-invoice',
    category: 'financial',
    priority,
    title: overdueInvoices.length === 1
      ? gt('overdue_title_single', ctx.language)
      : gt('overdue_title_multi', ctx.language, { count: overdueInvoices.length }),
    message: `${gt('overdue_message', ctx.language, { amount: gtMoney(totalOverdue, ctx.country) })}${ctx.profile.invoicePatterns.onTimeRate > 0 ? ` ${gt('overdue_ontime_rate', ctx.language, { pct: Math.round(ctx.profile.invoicePatterns.onTimeRate * 100) })}` : ''}`,
    detail: `${gt('overdue_detail', ctx.language, { days: Math.round(avgDaysOverdue) })}${trendText}${anomaly.isAnomaly ? ` ${anomaly.description}` : ''}`,
    icon: 'receipt',
    actionLabel: gt('overdue_action_send_reminders', ctx.language),
    actionRoute: '/(contractor)/facturen',
    source: gt('source_billing', ctx.language),
    metric: { label: gt('overdue_metric_outstanding', ctx.language), value: gtMoney(totalOverdue, ctx.country), trend: 'down' },

    rootCauseTags: ['cashflow', 'overdue'],
    rawScore: 0,
    reasoning: {
      observation: gt('overdue_observation', ctx.language, { count: overdueInvoices.length }),
      evidence: `${gt('overdue_evidence', ctx.language, { count: invoices.length })}${trend ? `, ${gt('overdue_evidence_trend', ctx.language, { direction: trend.direction })}` : ''}${anomaly.isAnomaly ? ` — ${gt('overdue_evidence_anomaly', ctx.language, { z: anomaly.zScore.toFixed(1) })}` : ''}`,
      implication: `${gt('overdue_implication', ctx.language, { amount: gtMoney(totalOverdue, ctx.country) })}${trendText}${seasonNote}`,
      suggestion: avgDaysOverdue > 14
        ? gt('overdue_suggestion_phone', ctx.language)
        : gt('overdue_suggestion_email', ctx.language),
    },
    dataPoints: invoices.length,
    confidence: anomaly.isAnomaly ? Math.min(0.95, 0.9 + 0.05) : 0.9,
    freshness: 1,
    action: {
      type: 'send_reminder',
      label: gt('action_send_reminder', ctx.language),
      params: { invoiceCount: overdueInvoices.length, totalAmount: totalOverdue },
      requiresApproval: false,
      estimatedImpact: `${gt('overdue_impact_faster', ctx.language)} — ${gtMoney(totalOverdue, ctx.country)}`,
    },
    enqueueHint: {
      type: 'draft_reminder',
      entityKey: `overdue-batch:${overdueInvoices.map(i => i.id).sort().join(',')}`,
      expiresInDays: 3,
    },
  } as ScoredInsight;
}

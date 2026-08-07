// =============================================================================
// OVERDUE INVOICE GENERATOR
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import { useCashFlow } from '../../services/cashFlowService';
import { recordMetricSnapshot, getTrend } from '../learningStorage';
import { isAboveThreshold, detectAnomaly, getSeasonalMultiplier } from '../adaptiveThresholds';
import { logPrediction } from '../calibration';
import { gtMoney } from '../generatorTranslations';
import { daysOverdue } from '../../utils/invoiceDue';
// gtv() === gt() for any key without a phrasing spec, so this is a strict
// superset: spec'd keys gain LLM wording, everything else is byte-identical.
// Whole-file rather than per-key on purpose — learnings #466: partial adoption
// inside a single generator is the bug, not the fix.
import { gtv } from '../phrasing/phrasingStore';
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
  // Shared helper rather than a third local rounding of the same question:
  // this used Math.floor, eveLiveActionService used Math.round and the audit
  // scheduler Math.ceil, so one invoice could be 14, 15 and 15 days overdue
  // simultaneously depending on which surface asked.
  const avgDaysOverdue = overdueInvoices.reduce(
    (sum, i) => sum + (daysOverdue(i as any, ctx.now) ?? 0), 0,
  ) / overdueInvoices.length;

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
  const seasonNote = seasonMult > 1.05 ? ` ${gtv('overdue_season_note', ctx.language)}` : '';
  const priority = anomaly.severity === 'severe' ? 'critical'
    : anomaly.severity === 'moderate' ? 'high'
    : overdueInvoices.length >= 3 || isSignificant ? 'high' : 'medium';

  // Get collection velocity trend
  const trend = getTrend(ctx.profile, 'overdueAmount', 4);
  const trendText = trend
    ? trend.direction === 'declining'
      ? ` ${gtv('overdue_trend_down', ctx.language, { from: gtMoney(trend.previousValue, ctx.country), to: gtMoney(trend.currentValue, ctx.country) })}`
      : trend.direction === 'improving'
        ? ` ${gtv('overdue_trend_up', ctx.language, { from: gtMoney(trend.previousValue, ctx.country), to: gtMoney(trend.currentValue, ctx.country) })}`
        : ''
    : '';

  return {
    id: 'overdue-invoices',
    generatorId: 'overdue-invoice',
    category: 'financial',
    priority,
    title: overdueInvoices.length === 1
      ? gtv('overdue_title_single', ctx.language)
      : gtv('overdue_title_multi', ctx.language, { count: overdueInvoices.length }),
    message: `${gtv('overdue_message', ctx.language, { amount: gtMoney(totalOverdue, ctx.country) })}${ctx.profile.invoicePatterns.onTimeRate > 0 ? ` ${gtv('overdue_ontime_rate', ctx.language, { pct: Math.round(ctx.profile.invoicePatterns.onTimeRate * 100) })}` : ''}`,
    detail: `${gtv('overdue_detail', ctx.language, { days: Math.round(avgDaysOverdue) })}${trendText}${anomaly.isAnomaly ? ` ${anomaly.description}` : ''}`,
    icon: 'receipt',
    actionLabel: gtv('overdue_action_send_reminders', ctx.language),
    actionRoute: '/(contractor)/facturen',
    source: gtv('source_billing', ctx.language),
    metric: { label: gtv('overdue_metric_outstanding', ctx.language), value: gtMoney(totalOverdue, ctx.country), trend: 'down' },

    rootCauseTags: ['cashflow', 'overdue'],
    rawScore: 0,
    reasoning: {
      observation: gtv('overdue_observation', ctx.language, { count: overdueInvoices.length }),
      evidence: `${gtv('overdue_evidence', ctx.language, { count: invoices.length })}${trend ? `, ${gtv('overdue_evidence_trend', ctx.language, { direction: trend.direction })}` : ''}${anomaly.isAnomaly ? ` — ${gtv('overdue_evidence_anomaly', ctx.language, { z: anomaly.zScore.toFixed(1) })}` : ''}`,
      implication: `${gtv('overdue_implication', ctx.language, { amount: gtMoney(totalOverdue, ctx.country) })}${trendText}${seasonNote}`,
      suggestion: avgDaysOverdue > 14
        ? gtv('overdue_suggestion_phone', ctx.language)
        : gtv('overdue_suggestion_email', ctx.language),
    },
    dataPoints: invoices.length,
    confidence: anomaly.isAnomaly ? Math.min(0.95, 0.9 + 0.05) : 0.9,
    freshness: 1,
    action: {
      type: 'send_reminder',
      label: gtv('action_send_reminder', ctx.language),
      params: { invoiceCount: overdueInvoices.length, totalAmount: totalOverdue },
      requiresApproval: false,
      estimatedImpact: `${gtv('overdue_impact_faster', ctx.language)} — ${gtMoney(totalOverdue, ctx.country)}`,
    },
    enqueueHint: {
      type: 'draft_reminder',
      entityKey: `overdue-batch:${overdueInvoices.map(i => i.id).sort().join(',')}`,
      expiresInDays: 3,
    },
  } as ScoredInsight;
}

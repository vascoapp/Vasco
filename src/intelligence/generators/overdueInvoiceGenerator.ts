// =============================================================================
// OVERDUE INVOICE GENERATOR
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import { useCashFlow } from '../../services/cashFlowService';
import { recordMetricSnapshot, getTrend } from '../learningStorage';
import { isAboveThreshold, detectAnomaly, getSeasonalMultiplier } from '../adaptiveThresholds';
import { logPrediction } from '../calibration';
import { gt } from '../generatorTranslations';
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
    prediction: `Openstaand bedrag: €${totalOverdue.toLocaleString('nl-NL')} (${overdueInvoices.length} facturen)`,
    predictedValue: totalOverdue,
  });

  // Use adaptive threshold instead of hardcoded >5000
  const isSignificant = isAboveThreshold(ctx.profile, 'overdueAmount', totalOverdue);

  // Anomaly detection: escalate on sudden overdue spikes
  const anomaly = detectAnomaly(ctx.profile, 'overdueAmount', totalOverdue);

  // Seasonal context
  const seasonMult = getSeasonalMultiplier('overdueAmount');
  const seasonNote = seasonMult > 1.05 ? ' Hogere openstaande bedragen zijn normaal in het laagseizoen.' : '';
  const priority = anomaly.severity === 'severe' ? 'critical'
    : anomaly.severity === 'moderate' ? 'high'
    : overdueInvoices.length >= 3 || isSignificant ? 'high' : 'medium';

  // Get collection velocity trend
  const trend = getTrend(ctx.profile, 'overdueAmount', 4);
  const trendText = trend
    ? trend.direction === 'declining'
      ? ` Openstaand bedrag daalt (€${Math.round(trend.previousValue).toLocaleString('nl-NL')} → €${Math.round(trend.currentValue).toLocaleString('nl-NL')}).`
      : trend.direction === 'improving'
        ? ` Openstaand bedrag stijgt (€${Math.round(trend.previousValue).toLocaleString('nl-NL')} → €${Math.round(trend.currentValue).toLocaleString('nl-NL')}).`
        : ''
    : '';

  return {
    id: 'overdue-invoices',
    generatorId: 'overdue-invoice',
    category: 'financial',
    priority,
    title: `${overdueInvoices.length} verlopen ${overdueInvoices.length === 1 ? 'factuur' : 'facturen'}`,
    message: `€${totalOverdue.toLocaleString('nl-NL')} staat nog open. Stuur een herinnering om sneller betaald te worden.${ctx.profile.invoicePatterns.onTimeRate > 0 ? ` Je on-time betaalratio is ${Math.round(ctx.profile.invoicePatterns.onTimeRate * 100)}%.` : ''}`,
    detail: `Gemiddeld ${Math.round(avgDaysOverdue)} dagen over de betaaltermijn. Automatische herinneringen verhogen de incasso met 35%.${trendText}${anomaly.isAnomaly ? ` ${anomaly.description}` : ''}`,
    icon: 'receipt',
    actionLabel: 'Herinneringen sturen',
    actionRoute: '/(contractor)/facturen',
    source: gt('source_billing', ctx.language),
    metric: { label: 'Openstaand', value: `€${totalOverdue.toLocaleString('nl-NL')}`, trend: 'down' },

    rootCauseTags: ['cashflow', 'overdue'],
    rawScore: 0,
    reasoning: {
      observation: `${overdueInvoices.length} facturen zijn over de betaaltermijn`,
      evidence: `Op basis van ${invoices.length} facturen${trend ? `, trend: ${trend.direction}` : ''}${anomaly.isAnomaly ? ` — anomalie gedetecteerd (${anomaly.zScore.toFixed(1)}σ)` : ''}`,
      implication: `€${totalOverdue.toLocaleString('nl-NL')} werkkapitaal geblokkeerd${trendText}${seasonNote}`,
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
      estimatedImpact: `${gt('overdue_impact_faster', ctx.language)} — €${totalOverdue.toLocaleString('nl-NL')}`,
    },
  };
}

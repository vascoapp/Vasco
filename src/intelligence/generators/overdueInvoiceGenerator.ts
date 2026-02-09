// =============================================================================
// OVERDUE INVOICE GENERATOR
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import { useCashFlow } from '../../services/cashFlowService';
import { recordMetricSnapshot, getTrend } from '../learningStorage';
import { isAboveThreshold } from '../adaptiveThresholds';

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
    const days = Math.floor((ctx.now.getTime() - dueDate.getTime()) / 86400000);
    return sum + Math.max(0, days);
  }, 0) / overdueInvoices.length;

  // Record metric snapshot for trend tracking
  recordMetricSnapshot('overdueAmount', totalOverdue);

  // Use adaptive threshold instead of hardcoded >5000
  const isSignificant = isAboveThreshold(ctx.profile, 'overdueAmount', totalOverdue);
  const priority = overdueInvoices.length >= 3 || isSignificant ? 'high' : 'medium';

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
    message: `€${totalOverdue.toLocaleString('nl-NL')} staat nog open. Stuur een herinnering om sneller betaald te worden.`,
    detail: `Gemiddeld ${Math.round(avgDaysOverdue)} dagen over de betaaltermijn. Automatische herinneringen verhogen de incasso met 35%.${trendText}`,
    icon: 'receipt',
    actionLabel: 'Herinneringen sturen',
    actionRoute: '/(contractor)/facturen',
    source: 'Facturatie',
    metric: { label: 'Openstaand', value: `€${totalOverdue.toLocaleString('nl-NL')}`, trend: 'down' },

    rawScore: 0,
    reasoning: {
      observation: `${overdueInvoices.length} facturen zijn over de betaaltermijn`,
      evidence: `Op basis van ${invoices.length} facturen${trend ? `, trend: ${trend.direction}` : ''}`,
      implication: `€${totalOverdue.toLocaleString('nl-NL')} werkkapitaal geblokkeerd${trendText}`,
      suggestion: avgDaysOverdue > 14
        ? 'Overweeg telefonisch contact — facturen ouder dan 14 dagen vereisen persoonlijke opvolging'
        : 'Stuur een vriendelijke herinnering per e-mail',
    },
    dataPoints: invoices.length,
    confidence: 0.9,
    freshness: 1,
  };
}

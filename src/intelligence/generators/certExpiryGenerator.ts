// =============================================================================
// CERT EXPIRY GENERATOR
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import { useExpiryCalendar } from '../../services/complianceService';
import { logPrediction } from '../calibration';

export const certExpiryGenerator: InsightGenerator = {
  id: 'cert-expiry',
  screens: ['today', 'meer'],
  roles: ['contractor'],
  generate(ctx: GeneratorContext): ScoredInsight | null {
    return null;
  },
};

export function useCertExpiryInsight(ctx: GeneratorContext): ScoredInsight | null {
  const calendar = useExpiryCalendar(2); // next 2 months

  const expiringItems = calendar.flatMap(month =>
    month.items.map(item => ({ ...item, date: month.date }))
  );

  if (expiringItems.length === 0) return null;

  const soonest = expiringItems[0];
  const daysUntil = Math.ceil((new Date(soonest.date).getTime() - ctx.now.getTime()) / 86400000);

  // Log prediction for calibration
  logPrediction({
    generatorId: 'cert-expiry',
    predictedAt: new Date().toISOString(),
    prediction: `${expiringItems.length} certificaten verlopen binnen ${daysUntil} dagen`,
    predictedValue: daysUntil,
  });
  const priority = daysUntil <= 14 ? 'high' : daysUntil <= 30 ? 'medium' : 'low';

  return {
    id: `cert-expiry-${soonest.id}`,
    generatorId: 'cert-expiry',
    category: 'compliance',
    priority,
    title: daysUntil <= 7
      ? `${soonest.name} verloopt deze week!`
      : `${soonest.name} verloopt over ${daysUntil} dagen`,
    message: `Vernieuw je ${soonest.type} op tijd om werkonderbrekingen te voorkomen.${expiringItems.length > 1 ? ` Nog ${expiringItems.length - 1} andere items verlopen binnenkort.` : ''}`,
    icon: 'document-text',
    actionLabel: 'Vernieuwen',
    actionRoute: '/(contractor)/certificaten',
    source: 'Compliance',

    rootCauseTags: ['compliance', 'certification'],
    rawScore: 0,
    reasoning: {
      observation: `${expiringItems.length} certificaat/vergunning${expiringItems.length > 1 ? 'en' : ''} verloop${expiringItems.length > 1 ? 'en' : 't'} binnenkort`,
      evidence: `Op basis van je certificatenregister`,
      implication: daysUntil <= 14
        ? 'Verlopen certificaten kunnen leiden tot werkstop en boetes'
        : 'Tijdig vernieuwen voorkomt last-minute kosten en stress',
      suggestion: `Start het vernieuwingsproces voor ${soonest.name} zo snel mogelijk`,
    },
    dataPoints: expiringItems.length,
    confidence: 0.95,
    freshness: 1,
  };
}

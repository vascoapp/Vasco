// =============================================================================
// SCHEDULE FRAGILITY GENERATOR
// =============================================================================
// Warns when SPI drops below threshold across the project portfolio.
// Uses mockProjects + mockDeliveryMetrics to find schedule risk.
// =============================================================================

import type { ScoredInsight, GeneratorContext } from './types';
import { mockProjects, mockDeliveryMetrics } from '../../data/mockProjects';
import { logPrediction } from '../calibration';
import { gt } from '../generatorTranslations';

export function useScheduleFragilityInsight(ctx: GeneratorContext): ScoredInsight | null {
  if (ctx.role !== 'coo' && ctx.role !== 'director') return null;

  // Find projects with SPI < 0.95
  const delayedProjects = mockProjects
    .map(p => {
      const m = mockDeliveryMetrics[p.id];
      if (!m) return null;
      return { project: p, spi: m.spiSchedulePerformanceIndex, variance: m.scheduleVarianceDays };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null && d.spi < 0.95)
    .sort((a, b) => a.spi - b.spi);

  if (delayedProjects.length === 0) return null;

  const worst = delayedProjects[0];
  const avgSpi = delayedProjects.reduce((s, d) => s + d.spi, 0) / delayedProjects.length;

  logPrediction({
    generatorId: 'schedule-fragility',
    predictedAt: new Date().toISOString(),
    prediction: `${delayedProjects.length} projecten SPI < 0.95, laagste: ${worst.spi.toFixed(2)}`,
    predictedValue: worst.spi,
  });

  return {
    id: 'schedule-fragility',
    generatorId: 'schedule-fragility',
    category: 'operational',
    priority: worst.spi < 0.85 ? 'critical' : worst.spi < 0.90 ? 'high' : 'medium',
    title: `Planning: ${worst.project.name}`,
    message: `SPI ${worst.spi.toFixed(2)} — project loopt ${Math.abs(worst.variance)} dagen achter op schema. ${delayedProjects.length > 1 ? `${delayedProjects.length} projecten onder target.` : ''}`,
    detail: `Gemiddelde SPI van vertraagde projecten: ${avgSpi.toFixed(2)}. Kritiek pad heeft 0 dagen float. Review resource-allocatie en leveranciersplanning.`,
    icon: 'time',
    actionLabel: 'Bekijk planning',
    actionRoute: '/hub/schedule',
    source: gt('source_scheduling', ctx.language),
    metric: { label: 'SPI', value: worst.spi.toFixed(2), trend: worst.spi < 0.90 ? 'down' : 'neutral' },
    rootCauseTags: ['schedule', 'spi', 'delay'],
    rawScore: 0,
    reasoning: {
      observation: `${worst.project.name} heeft een SPI van ${worst.spi.toFixed(2)}`,
      evidence: `${Math.abs(worst.variance)} dagen achterstand, ${delayedProjects.length} projecten onder SPI 0.95`,
      implication: worst.spi < 0.90
        ? 'Significante vertraging — directe interventie vereist om deadline te halen'
        : 'Lichte vertraging — monitor wekelijks en pas planning aan',
      suggestion: worst.spi < 0.90
        ? 'Escaleer naar projectmanager — overweeg extra resources of scope-aanpassing'
        : 'Review kritiek pad items en leveranciersplanning deze week',
    },
    dataPoints: mockProjects.length,
    confidence: 0.88,
    freshness: 2,
  };
}

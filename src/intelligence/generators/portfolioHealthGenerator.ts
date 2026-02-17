// Portfolio Health Generator - Aggregates SPI/CPI health across portfolio
import type { ScoredInsight, GeneratorContext } from './types';
import { mockProjects, mockDeliveryMetrics, mockAppraisals } from '../../data/mockProjects';
import { logPrediction } from '../calibration';

export function usePortfolioHealthInsight(ctx: GeneratorContext): ScoredInsight | null {
  if (ctx.role !== 'director') return null;

  const projectHealth = mockProjects.map(p => {
    const m = mockDeliveryMetrics[p.id];
    if (!m) return null;
    const spi = m.spiSchedulePerformanceIndex;
    const cpi = m.cpiCostPerformanceIndex;
    const status = spi >= 0.95 && cpi >= 0.95 ? 'on-track'
      : spi >= 0.85 && cpi >= 0.85 ? 'at-risk'
      : 'behind';
    return { project: p, spi, cpi, status };
  }).filter((d): d is NonNullable<typeof d> => d !== null);

  if (projectHealth.length === 0) return null;

  const onTrack = projectHealth.filter(p => p.status === 'on-track').length;
  const atRisk = projectHealth.filter(p => p.status === 'at-risk').length;
  const behind = projectHealth.filter(p => p.status === 'behind').length;
  const avgSpi = projectHealth.reduce((s, p) => s + p.spi, 0) / projectHealth.length;
  const avgCpi = projectHealth.reduce((s, p) => s + p.cpi, 0) / projectHealth.length;

  if (atRisk === 0 && behind === 0) return null; // All healthy, no insight needed

  logPrediction({
    generatorId: 'portfolio-health',
    predictedAt: new Date().toISOString(),
    prediction: `Portfolio: ${onTrack} op schema, ${atRisk} risico, ${behind} achter`,
    predictedValue: atRisk + behind,
  });

  return {
    id: 'portfolio-health',
    generatorId: 'portfolio-health',
    category: 'financial',
    priority: behind > 0 ? 'high' : atRisk >= 2 ? 'medium' : 'low',
    title: behind > 0
      ? `${behind} project${behind > 1 ? 'en' : ''} achter op schema en budget`
      : `${atRisk} project${atRisk > 1 ? 'en' : ''} vereisen aandacht`,
    message: `Portfolio: ${onTrack} op schema, ${atRisk} risico, ${behind} achter. Gem. SPI: ${avgSpi.toFixed(2)}, gem. CPI: ${avgCpi.toFixed(2)}.`,
    detail: `${projectHealth.length} projecten geanalyseerd. Projecten met SPI < 0.85 of CPI < 0.85 zijn als 'achter' geclassificeerd. Focus op de projecten met de laagste scores.`,
    icon: 'business',
    actionLabel: 'Bekijk portfolio',
    actionRoute: '/hub/projects',
    source: 'Portfolio Analyse',
    metric: { label: 'Risico', value: `${atRisk + behind}`, trend: behind > 0 ? 'down' : 'neutral' },
    rootCauseTags: ['portfolio', 'health'],
    rawScore: 0,
    reasoning: {
      observation: `${atRisk + behind} van ${projectHealth.length} projecten presteren onder target`,
      evidence: `Gem. SPI: ${avgSpi.toFixed(2)}, gem. CPI: ${avgCpi.toFixed(2)}, ${behind} projecten onder 0.85`,
      implication: behind > 0
        ? 'Significante portfolio-risico\'s — directe interventie vereist'
        : 'Portfolio is overwegend gezond maar risicoprojecten vereisen monitoring',
      suggestion: behind > 0
        ? 'Plan een directie-review voor projecten onder SPI/CPI 0.85 deze week'
        : 'Monitor risicoprojecten tweewekelijks en review mitigatieplannen',
    },
    dataPoints: projectHealth.length,
    confidence: 0.90,
    freshness: 4,
  };
}

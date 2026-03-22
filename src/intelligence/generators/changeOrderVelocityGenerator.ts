// =============================================================================
// CHANGE ORDER VELOCITY GENERATOR
// =============================================================================
// Tracks change order backlog and approval speed across the portfolio.
// Flags when pending change orders accumulate or cycle time is too long.
// =============================================================================

import type { ScoredInsight, GeneratorContext } from './types';
import { mockProjects, mockDeliveryMetrics } from '../../data/mockProjects';
import { logPrediction } from '../calibration';
import { gt } from '../generatorTranslations';

export function useChangeOrderVelocityInsight(ctx: GeneratorContext): ScoredInsight | null {
  if (ctx.role !== 'coo' && ctx.role !== 'cfo') return null;

  const projectsWithCOs = mockProjects
    .map(p => {
      const m = mockDeliveryMetrics[p.id];
      if (!m || m.changeOrdersSubmitted === 0) return null;
      const pendingCOs = m.changeOrdersSubmitted - m.changeOrdersApproved;
      return { project: p, metrics: m, pendingCOs, totalValue: m.changeOrdersValue, cycleTime: m.avgChangeOrderCycleTime };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null)
    .sort((a, b) => b.pendingCOs - a.pendingCOs);

  if (projectsWithCOs.length === 0) return null;

  const totalPending = projectsWithCOs.reduce((s, d) => s + d.pendingCOs, 0);
  const totalValue = projectsWithCOs.reduce((s, d) => s + d.totalValue, 0);
  const avgCycleTime = projectsWithCOs.reduce((s, d) => s + d.cycleTime, 0) / projectsWithCOs.length;

  if (totalPending === 0) return null;

  const worst = projectsWithCOs[0];
  const currency = worst.project.currency === 'GBP' ? '£' : '€';
  const formatM = (v: number) => v >= 1_000_000
    ? `${currency}${(v / 1_000_000).toFixed(1)}M`
    : `${currency}${(v / 1000).toFixed(0)}K`;

  logPrediction({
    generatorId: 'change-order-velocity',
    predictedAt: new Date().toISOString(),
    prediction: `${totalPending} change orders pending, gem. doorlooptijd ${Math.round(avgCycleTime)} dagen`,
    predictedValue: totalPending,
  });

  return {
    id: 'change-order-velocity',
    generatorId: 'change-order-velocity',
    category: 'operational',
    priority: avgCycleTime > 21 ? 'high' : totalPending > 3 ? 'medium' : 'low',
    title: `${totalPending} change orders wachten`,
    message: `${totalPending} change orders pending met totale waarde ${formatM(totalValue)}. Gemiddelde doorlooptijd: ${Math.round(avgCycleTime)} dagen.`,
    detail: `${projectsWithCOs.length} projecten met change orders. ${worst.project.name} heeft ${worst.pendingCOs} openstaand. Langzame goedkeuring verhoogt projectrisico.`,
    icon: 'swap-horizontal',
    actionLabel: 'Bekijk wijzigingen',
    actionRoute: '/hub/costs',
    source: gt('source_change_order', ctx.language),
    metric: { label: 'Doorlooptijd', value: `${Math.round(avgCycleTime)}d`, trend: avgCycleTime > 21 ? 'down' : 'neutral' },
    rootCauseTags: ['change-orders', 'approvals'],
    rawScore: 0,
    reasoning: {
      observation: `${totalPending} change orders wachten op goedkeuring`,
      evidence: `Totale waarde: ${formatM(totalValue)}, gemiddelde doorlooptijd: ${Math.round(avgCycleTime)} dagen`,
      implication: avgCycleTime > 21
        ? 'Trage goedkeuring blokkeert werkvoortgang en verhoogt kosten'
        : 'Change order pipeline is beheersbaar',
      suggestion: avgCycleTime > 21
        ? 'Verkort de goedkeuringscyclus — overweeg gedelegeerde bevoegdheden onder £50K'
        : 'Monitor doorlooptijd maandelijks en bespreek bottlenecks',
    },
    dataPoints: projectsWithCOs.length,
    confidence: 0.85,
    freshness: 2,
  };
}

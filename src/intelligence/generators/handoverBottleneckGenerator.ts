// Handover Bottleneck Generator - Flags delayed handovers blocking payments
import type { ScoredInsight, GeneratorContext } from './types';
import { mockProjects, mockDeliveryMetrics } from '../../data/mockProjects';
import { logPrediction } from '../calibration';

// Simulated handover data per project (matches DirectorDashboard mock)
const PORTFOLIO_HANDOVERS = [
  { projectId: 'uk-001', projectName: 'One Broadgate Place', total: 12, completed: 9, pendingSignoff: 2, blockedValue: 285000 },
  { projectId: 'nl-001', projectName: 'Keizersgracht 401', total: 8, completed: 5, pendingSignoff: 1, blockedValue: 420000 },
  { projectId: 'de-001', projectName: 'Zeil 42', total: 6, completed: 2, pendingSignoff: 0, blockedValue: 0 },
];

export function useHandoverBottleneckInsight(ctx: GeneratorContext): ScoredInsight | null {
  if (ctx.role !== 'director' && ctx.role !== 'cfo') return null;

  const totalPendingSignoff = PORTFOLIO_HANDOVERS.reduce((s, h) => s + h.pendingSignoff, 0);
  const totalBlockedValue = PORTFOLIO_HANDOVERS.reduce((s, h) => s + h.blockedValue, 0);
  const totalHandovers = PORTFOLIO_HANDOVERS.reduce((s, h) => s + h.total, 0);
  const totalCompleted = PORTFOLIO_HANDOVERS.reduce((s, h) => s + h.completed, 0);
  const completionRate = totalHandovers > 0 ? totalCompleted / totalHandovers : 0;

  if (totalPendingSignoff === 0 && totalBlockedValue === 0) return null;

  const worstProject = [...PORTFOLIO_HANDOVERS].sort((a, b) => b.blockedValue - a.blockedValue)[0];
  const formatK = (v: number) => `£${(v / 1000).toFixed(0)}K`;

  logPrediction({
    generatorId: 'handover-bottleneck',
    predictedAt: new Date().toISOString(),
    prediction: `${totalPendingSignoff} handovers pending signoff, ${formatK(totalBlockedValue)} geblokkeerd`,
    predictedValue: totalPendingSignoff,
  });

  return {
    id: 'handover-bottleneck',
    generatorId: 'handover-bottleneck',
    category: 'operational',
    priority: totalBlockedValue > 500000 ? 'high' : totalPendingSignoff > 2 ? 'medium' : 'low',
    title: `${totalPendingSignoff} handovers wachten op aftekening`,
    message: `${totalPendingSignoff} handovers wachten op signoff. Geblokkeerde betalingswaarde: ${formatK(totalBlockedValue)}. Handover-compleetheid: ${Math.round(completionRate * 100)}%.`,
    detail: `${worstProject.projectName} blokkeert ${formatK(worstProject.blockedValue)} aan betalingen. ${totalCompleted} van ${totalHandovers} handovers afgerond over hele portfolio.`,
    icon: 'swap-horizontal',
    actionLabel: 'Bekijk handovers',
    actionRoute: '/hub/projects',
    source: 'Handover Tracker',
    metric: { label: 'Pending', value: `${totalPendingSignoff}`, trend: totalPendingSignoff > 2 ? 'down' : 'neutral' },
    rootCauseTags: ['handover', 'payments'],
    rawScore: 0,
    reasoning: {
      observation: `${totalPendingSignoff} handovers wachten op signoff over ${PORTFOLIO_HANDOVERS.length} projecten`,
      evidence: `Geblokkeerde waarde: ${formatK(totalBlockedValue)}, handover-compleetheid: ${Math.round(completionRate * 100)}%`,
      implication: totalBlockedValue > 500000
        ? 'Vertraagde handovers blokkeren significant betalingsverkeer'
        : 'Handover pipeline vereist aandacht om betalingen te versnellen',
      suggestion: totalBlockedValue > 500000
        ? 'Prioriteer signoff van handovers met de hoogste geblokkeerde waarde deze week'
        : 'Plan wekelijkse handover-reviews om achterstanden te voorkomen',
    },
    dataPoints: PORTFOLIO_HANDOVERS.length,
    confidence: 0.88,
    freshness: 2,
  };
}

// =============================================================================
// APPROVAL BOTTLENECK GENERATOR
// =============================================================================
// Flags approvals waiting >48h. Calculates delay cost impact on projects.
// =============================================================================

import type { ScoredInsight, GeneratorContext } from './types';
import { mockProjects, mockDeliveryMetrics } from '../../data/mockProjects';
import { logPrediction } from '../calibration';

// Simulated pending approvals data (matches hub/approvals.tsx mock)
const PENDING_APPROVALS = [
  { id: 'app-1', project: 'Riverside Quarter', amount: 340000, daysWaiting: 5, type: 'Contract Change' },
  { id: 'app-2', project: 'Oak Gardens', amount: 890000, daysWaiting: 3, type: 'Draw Request' },
  { id: 'app-3', project: 'Riverside Quarter', amount: 156000, daysWaiting: 1, type: 'Purchase Order' },
];

export function useApprovalBottleneckInsight(ctx: GeneratorContext): ScoredInsight | null {
  if (ctx.role !== 'cfo' && ctx.role !== 'director') return null;

  const overdueApprovals = PENDING_APPROVALS.filter(a => a.daysWaiting > 2);
  if (overdueApprovals.length === 0) return null;

  const totalValue = overdueApprovals.reduce((sum, a) => sum + a.amount, 0);
  const maxWaiting = Math.max(...overdueApprovals.map(a => a.daysWaiting));
  const avgWaiting = overdueApprovals.reduce((sum, a) => sum + a.daysWaiting, 0) / overdueApprovals.length;

  logPrediction({
    generatorId: 'approval-bottleneck',
    predictedAt: new Date().toISOString(),
    prediction: `${overdueApprovals.length} goedkeuringen wachten >48u, totaal £${Math.round(totalValue / 1000)}K`,
    predictedValue: overdueApprovals.length,
  });

  const formatK = (v: number) => `£${(v / 1000).toFixed(0)}K`;

  return {
    id: 'approval-bottleneck',
    generatorId: 'approval-bottleneck',
    category: 'operational',
    priority: maxWaiting > 5 ? 'high' : 'medium',
    title: `${overdueApprovals.length} goedkeuringen wachten`,
    message: `${overdueApprovals.length} items wachten >48 uur op goedkeuring. Totale waarde: ${formatK(totalValue)}. Langst wachtend: ${maxWaiting} dagen.`,
    detail: `Vertraagde goedkeuringen vertragen projecten gemiddeld 5 werkdagen. Gemiddelde wachttijd: ${Math.round(avgWaiting)} dagen. Focus op de items met de hoogste waarde eerst.`,
    icon: 'timer',
    actionLabel: 'Bekijk goedkeuringen',
    actionRoute: '/hub/approvals',
    source: 'Approval Tracker',
    metric: { label: 'Wachtend', value: `${overdueApprovals.length}`, trend: maxWaiting > 3 ? 'down' : 'neutral' },
    rootCauseTags: ['approvals', 'bottleneck'],
    rawScore: 0,
    reasoning: {
      observation: `${overdueApprovals.length} goedkeuringen wachten langer dan 48 uur`,
      evidence: `Totale geblokkeerde waarde: ${formatK(totalValue)}, langst wachtend: ${maxWaiting} dagen`,
      implication: 'Elke dag vertraging kost gemiddeld 1 werkdag projectvertraging',
      suggestion: maxWaiting > 5
        ? 'Prioriteer de langst wachtende items vandaag — escaleer indien nodig'
        : 'Plan dagelijks 15 minuten voor goedkeuringen om achterstanden te voorkomen',
    },
    dataPoints: PENDING_APPROVALS.length,
    confidence: 0.9,
    freshness: 1,
  };
}

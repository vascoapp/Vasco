// =============================================================================
// PERMIT DELAY GENERATOR
// =============================================================================
// Flags overdue permits that are under-review or submitted and past their
// target decision date. Monitors permit pipeline across the portfolio.
// =============================================================================

import type { ScoredInsight, GeneratorContext } from './types';
import { mockProjects } from '../../data/mockProjects';
import { logPrediction } from '../calibration';

export function usePermitDelayInsight(ctx: GeneratorContext): ScoredInsight | null {
  if (ctx.role !== 'coo' && ctx.role !== 'director') return null;

  const now = new Date();
  const allPermits = mockProjects.flatMap(p =>
    p.permits.map(permit => ({ ...permit, projectName: p.name, projectId: p.id }))
  );

  // Find permits that are pending (submitted/under-review) and past their target date
  const pendingStatuses = ['submitted', 'under-review'];
  const overduePermits = allPermits.filter(p => {
    if (!pendingStatuses.includes(p.status)) return false;
    if (!p.targetDecisionDate) return false;
    return new Date(p.targetDecisionDate) < now;
  });

  const pendingPermits = allPermits.filter(p => pendingStatuses.includes(p.status));

  if (overduePermits.length === 0 && pendingPermits.length < 2) return null;

  const hasOverdue = overduePermits.length > 0;
  const worstOverdue = overduePermits[0];
  const daysOverdue = worstOverdue
    ? Math.round((now.getTime() - new Date(worstOverdue.targetDecisionDate!).getTime()) / 86400000)
    : 0;

  logPrediction({
    generatorId: 'permit-delay',
    predictedAt: new Date().toISOString(),
    prediction: `${overduePermits.length} vergunningen verlopen, ${pendingPermits.length} pending`,
    predictedValue: overduePermits.length,
  });

  return {
    id: 'permit-delay',
    generatorId: 'permit-delay',
    category: 'operational',
    priority: overduePermits.length >= 2 ? 'high' : hasOverdue ? 'medium' : 'low',
    title: hasOverdue
      ? `${overduePermits.length} vergunning${overduePermits.length > 1 ? 'en' : ''} verlopen`
      : `${pendingPermits.length} vergunningen in behandeling`,
    message: hasOverdue
      ? `${worstOverdue!.projectName}: ${worstOverdue!.type} is ${daysOverdue} dagen over de beslistermijn. ${overduePermits.length > 1 ? `Nog ${overduePermits.length - 1} andere verlopen.` : ''}`
      : `${pendingPermits.length} vergunningen wachten op besluit. Monitor de voortgang regelmatig.`,
    detail: `Totaal ${allPermits.length} vergunningen in portfolio. ${overduePermits.length} verlopen, ${pendingPermits.length} in behandeling. Vergunningsvertragingen kunnen projectstart met maanden vertragen.`,
    icon: 'document-text',
    actionLabel: 'Bekijk vergunningen',
    actionRoute: '/hub/projects',
    source: 'Vergunning Tracker',
    metric: { label: 'Verlopen', value: `${overduePermits.length}`, trend: hasOverdue ? 'down' : 'neutral' },
    rootCauseTags: ['permits', 'regulatory'],
    rawScore: 0,
    reasoning: {
      observation: hasOverdue
        ? `${overduePermits.length} vergunningen zijn over de beslistermijn`
        : `${pendingPermits.length} vergunningen zijn in behandeling`,
      evidence: `${allPermits.length} vergunningen over ${mockProjects.length} projecten geanalyseerd`,
      implication: hasOverdue
        ? 'Vertraagde vergunningen kunnen projectstart blokkeren en kosten verhogen'
        : 'Vergunningen zijn op schema maar vereisen actieve monitoring',
      suggestion: hasOverdue
        ? 'Neem contact op met de vergunningverlener voor een statusupdate — overweeg spoedprocedure'
        : 'Plan maandelijkse vergunning-reviews om vertragingen te voorkomen',
    },
    dataPoints: allPermits.length,
    confidence: 0.85,
    freshness: 3,
  };
}

// =============================================================================
// CASCADING DELAY GENERATOR (Cross-Service)
// =============================================================================
// Combines capacityPlanning (alerts, forecast) with smartScheduler (jobs)
// to predict when a current job overrun will cascade and delay downstream jobs.
// =============================================================================

import type { ScoredInsight, GeneratorContext } from './types';
import { useCapacityAlerts } from '../../services/capacityPlanningService';
import { useCapacityForecast } from '../../services/capacityPlanningService';
import { useScheduler } from '../../services/smartSchedulerService';
import { logPrediction } from '../calibration';
import { getTrend } from '../learningStorage';
import { getAdaptiveThreshold } from '../adaptiveThresholds';

export function useCascadingDelayInsight(ctx: GeneratorContext): ScoredInsight | null {
  const { data: alerts } = useCapacityAlerts('active');
  const { data: forecast } = useCapacityForecast(undefined, 7);
  const { jobs } = useScheduler();

  // Find jobs currently in progress that might be at risk
  const inProgressJobs = jobs.filter(j => j.status === 'in_progress');
  const scheduledJobs = jobs.filter(j => j.status === 'scheduled');

  if (inProgressJobs.length === 0 || scheduledJobs.length === 0) return null;

  // Check capacity alerts for cascade-delay or job-at-risk types
  const cascadeAlerts = alerts.filter(a =>
    a.type === 'cascade-delay' || a.type === 'job-at-risk' || a.type === 'overbooked'
  );

  // Find overrunning in-progress jobs (actual > estimated)
  const overrunningJobs = inProgressJobs.filter(j => {
    if (!j.actualHoursLogged || !j.estimatedHours) return false;
    return j.actualHoursLogged > j.estimatedHours * 0.9; // already at 90%+ of estimate
  });

  if (overrunningJobs.length === 0 && cascadeAlerts.length === 0) return null;

  // Log prediction for calibration: predicted cascade delay
  const topOverrunForLog = overrunningJobs[0];
  if (topOverrunForLog) {
    logPrediction({
      generatorId: 'cascading-delay',
      predictedAt: new Date().toISOString(),
      prediction: `Cascade vertraging: ${topOverrunForLog.projectName} overschrijdt schatting`,
      predictedValue: topOverrunForLog.actualHoursLogged && topOverrunForLog.estimatedHours
        ? topOverrunForLog.actualHoursLogged / topOverrunForLog.estimatedHours
        : 1.0,
    });
  }

  // Find downstream jobs that would be affected
  // Use adaptive threshold for capacity utilization (default 85%, adapted per contractor)
  const capThreshold = getAdaptiveThreshold(ctx.profile, 'capacityUtilization');
  const overbookedDays = forecast.filter(day => day.utilization > (capThreshold.threshold / 100));
  const affectedDownstream: string[] = [];
  let totalDelayHours = 0;

  for (const overrunJob of overrunningJobs) {
    const overrunHours = overrunJob.actualHoursLogged && overrunJob.estimatedHours
      ? overrunJob.actualHoursLogged - overrunJob.estimatedHours
      : 0;

    // Find jobs that are scheduled after this overrunning job
    const downstreamJobs = scheduledJobs.filter(sj =>
      new Date(sj.startTime) > new Date(overrunJob.endTime)
    ).slice(0, 3);

    for (const dj of downstreamJobs) {
      affectedDownstream.push(dj.projectName);
    }
    totalDelayHours += Math.max(0, overrunHours);
  }

  // Use capacity alerts if no overruns detected but alerts exist
  if (overrunningJobs.length === 0 && cascadeAlerts.length > 0) {
    const topAlert = cascadeAlerts[0];
    return {
      id: `cascade-alert-${topAlert.id}`,
      generatorId: 'cascading-delay',
      category: 'alert',
      priority: topAlert.severity === 'critical' ? 'high' : 'medium',
      title: topAlert.title,
      message: topAlert.message,
      detail: topAlert.suggestedActions.join('. '),
      icon: 'git-merge',
      actionLabel: 'Planning bekijken',
      actionRoute: '/(contractor)/index',
      source: 'Cascade Analyse',

      rootCauseTags: ['schedule', 'cascade'],
      rawScore: 0,
      reasoning: {
        observation: topAlert.title,
        evidence: `Capaciteitsanalyse: ${overbookedDays.length} overbelaste dagen in komende week`,
        implication: topAlert.message,
        suggestion: topAlert.suggestedActions[0] || 'Herplan overbelaste dagen',
      },
      dataPoints: alerts.length + forecast.length,
      confidence: 0.72,
      freshness: 2,
    };
  }

  // Build cascade prediction
  const uniqueAffected = [...new Set(affectedDownstream)];
  const topOverrun = overrunningJobs[0];
  const overrunPercent = topOverrun.estimatedHours && topOverrun.actualHoursLogged
    ? Math.round((topOverrun.actualHoursLogged / topOverrun.estimatedHours - 1) * 100)
    : 0;

  return {
    id: 'cascading-delay',
    generatorId: 'cascading-delay',
    category: 'alert',
    priority: uniqueAffected.length >= 2 || totalDelayHours > 4 ? 'high' : 'medium',
    title: `Vertraging dreigt: ${overrunningJobs.length} klus${overrunningJobs.length > 1 ? 'sen lopen' : ' loopt'} uit`,
    message: `${topOverrun.projectName} is ${overrunPercent}% over de schatting. ${uniqueAffected.length > 0 ? `${uniqueAffected.length} vervolgklus${uniqueAffected.length > 1 ? 'sen' : ''} worden beïnvloed.` : ''}`,
    detail: uniqueAffected.length > 0
      ? `Getroffen: ${uniqueAffected.slice(0, 3).join(', ')}${uniqueAffected.length > 3 ? ` +${uniqueAffected.length - 3}` : ''}`
      : undefined,
    icon: 'git-merge',
    actionLabel: 'Herplannen',
    actionRoute: '/(contractor)/index',
    source: 'Cascade Analyse',
    metric: {
      label: 'Uitloop',
      value: `${totalDelayHours.toFixed(1)}u`,
      trend: 'down',
    },

    rootCauseTags: ['schedule', 'cascade'],
    rawScore: 0,
    reasoning: {
      observation: `${overrunningJobs.length} lopende klus${overrunningJobs.length > 1 ? 'sen overschrijden' : ' overschrijdt'} de schatting`,
      evidence: `${topOverrun.projectName}: ${topOverrun.actualHoursLogged?.toFixed(1)}u gebruikt van ${topOverrun.estimatedHours}u geschat. ${overbookedDays.length} overbelaste dagen vooruit${(() => { const t = getTrend(ctx.profile, 'capacityUtilization', 4); return t && t.slope !== 0 ? ` — bezettingstrend: ${t.direction}` : ''; })()}`,
      implication: `${uniqueAffected.length} vervolgklussen dreigen vertraagd te raken — geschatte cascade: ${totalDelayHours.toFixed(1)} uur`,
      suggestion: overrunningJobs.length > 1
        ? 'Herplan de minst urgente klus van morgen om ruimte te maken'
        : 'Overweeg extra hulp in te schakelen of de klant te informeren over vertraging',
    },
    dataPoints: inProgressJobs.length + scheduledJobs.length,
    confidence: 0.70,
    freshness: 1,
  };
}

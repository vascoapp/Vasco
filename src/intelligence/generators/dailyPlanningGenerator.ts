// =============================================================================
// DAILY PLANNING GENERATOR
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import { useDaySchedule } from '../../services/smartSchedulerService';

export const dailyPlanningGenerator: InsightGenerator = {
  id: 'daily-planning',
  screens: ['today'],
  roles: ['contractor'],
  generate(ctx: GeneratorContext): ScoredInsight | null {
    return null;
  },
};

export function useDailyPlanningInsight(ctx: GeneratorContext): ScoredInsight | null {
  const today = ctx.now.toISOString().split('T')[0];
  const daySchedule = useDaySchedule(today);

  if (daySchedule.jobs.length === 0) return null;

  // Find schedule gaps > 1.5 hours
  const sortedJobs = [...daySchedule.jobs].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  let maxGapHours = 0;
  let gapStart = '';
  let gapEnd = '';

  for (let i = 0; i < sortedJobs.length - 1; i++) {
    const endCurrent = new Date(sortedJobs[i].endTime).getTime();
    const startNext = new Date(sortedJobs[i + 1].startTime).getTime();
    const gapMs = startNext - endCurrent;
    const gapHrs = gapMs / 3600000;
    if (gapHrs > maxGapHours && gapHrs >= 1.5) {
      maxGapHours = gapHrs;
      gapStart = new Date(endCurrent).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
      gapEnd = new Date(startNext).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    }
  }

  if (maxGapHours < 1.5) return null;

  return {
    id: 'schedule-gap',
    generatorId: 'daily-planning',
    category: 'schedule',
    priority: 'low',
    title: 'Gat in je planning',
    message: `Je hebt een vrij blok van ${maxGapHours.toFixed(1)} uur tussen ${gapStart}-${gapEnd}. Ideaal voor een kleinere klus.`,
    detail: 'Vasco heeft openstaande offertes in de buurt gevonden die in dit tijdblok passen. Wil je ze bekijken?',
    icon: 'time',
    actionLabel: 'Bekijk klussen',
    actionRoute: '/(contractor)/besparen',
    source: 'Planner',
    timestamp: 'Nu',

    rawScore: 0,
    reasoning: {
      observation: `${maxGapHours.toFixed(1)} uur ongebruikte tijd gevonden in je dagplanning`,
      evidence: `Op basis van ${daySchedule.jobs.length} geplande afspraken vandaag`,
      implication: `${maxGapHours.toFixed(1)} uur potentiële omzet gemist`,
      suggestion: 'Vul het gat met een kleine klus of administratie om de dag productief te houden',
    },
    dataPoints: daySchedule.jobs.length,
    confidence: 0.85,
    freshness: 0.5,
  };
}

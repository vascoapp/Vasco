// =============================================================================
// GOAL PROGRESS GENERATOR
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import { useSavingsAggregation } from '../../services/savingsAggregatorService';
import { logPrediction } from '../calibration';
import { recordMetricSnapshot, getTrend } from '../learningStorage';
import { gt } from '../generatorTranslations';

export const goalProgressGenerator: InsightGenerator = {
  id: 'goal-progress',
  screens: ['today', 'savings'],
  roles: ['contractor'],
  generate(ctx: GeneratorContext): ScoredInsight | null {
    return null;
  },
};

export function useGoalProgressInsight(ctx: GeneratorContext): ScoredInsight | null {
  const savings = useSavingsAggregation();

  if (!savings || savings.totalSavedThisMonth <= 0) return null;

  const monthlyGoal = ctx.profile.savingsProfile.goalAmount || 500;
  const progressPercent = Math.min(100, Math.round((savings.totalSavedThisMonth / monthlyGoal) * 100));

  // Record metric snapshot for trend tracking
  recordMetricSnapshot('savingsTotal', savings.totalSavedThisMonth);

  // Log prediction for calibration
  logPrediction({
    generatorId: 'goal-progress',
    predictedAt: new Date().toISOString(),
    prediction: `Besparingsdoel: ${progressPercent}% van €${monthlyGoal}`,
    predictedValue: savings.totalSavedThisMonth,
  });
  const isOnTrack = progressPercent >= 75;
  const streak = ctx.profile.savingsProfile.savingsStreak;
  const streakText = streak >= 2 ? ` ${streak} maanden op rij bespaard!` : '';
  const topCat = ctx.profile.savingsProfile.topSavingsCategory;

  return {
    id: 'goal-progress',
    generatorId: 'goal-progress',
    category: isOnTrack ? 'opportunity' : 'tip',
    priority: 'low',
    title: isOnTrack
      ? `${progressPercent}% van je maanddoel bereikt!`
      : `Besparingsdoel: ${progressPercent}% bereikt`,
    message: isOnTrack
      ? `Je hebt €${savings.totalSavedThisMonth.toLocaleString('nl-NL')} bespaard deze maand. Je bent goed op weg!${streakText}`
      : `€${savings.totalSavedThisMonth.toLocaleString('nl-NL')} van €${monthlyGoal.toLocaleString('nl-NL')} bespaard. Er zijn nog kansen om je doel te halen.`,
    icon: isOnTrack ? 'trophy' : 'flag',
    actionLabel: isOnTrack ? undefined : 'Bekijk kansen',
    actionRoute: isOnTrack ? undefined : '/(contractor)/besparen',
    source: gt('source_savings', ctx.language),
    metric: {
      label: 'Voortgang',
      value: `${progressPercent}%`,
      trend: isOnTrack ? 'up' : 'neutral',
    },

    rootCauseTags: ['savings', 'goal'],
    rawScore: 0,
    reasoning: {
      observation: `€${savings.totalSavedThisMonth.toLocaleString('nl-NL')} bespaard van €${monthlyGoal.toLocaleString('nl-NL')} maanddoel`,
      evidence: `Op basis van ${savings.breakdown.length} besparingscategorieën${(() => { const t = getTrend(ctx.profile, 'savingsTotal'); return t && t.slope !== 0 ? ` (trend: ${t.direction})` : ''; })()}`,
      implication: isOnTrack
        ? `Op jaarbasis is dit €${(savings.totalSavedThisMonth * 12).toLocaleString('nl-NL')} besparing`
        : `Je mist nog €${(monthlyGoal - savings.totalSavedThisMonth).toLocaleString('nl-NL')} om je doel te halen`,
      suggestion: isOnTrack
        ? 'Verhoog je maanddoel om meer te besparen'
        : topCat ? `Focus op "${topCat}" — je beste besparingscategorie` : 'Focus op leveranciersvergelijking — daar zitten de snelste besparingen',
    },
    dataPoints: savings.breakdown.length,
    confidence: 0.7,
    freshness: 6,
  };
}

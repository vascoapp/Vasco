// =============================================================================
// GOAL PROGRESS GENERATOR
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import { useSavingsAggregation } from '../../services/savingsAggregatorService';

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
  const isOnTrack = progressPercent >= 75;

  return {
    id: 'goal-progress',
    generatorId: 'goal-progress',
    category: isOnTrack ? 'opportunity' : 'tip',
    priority: 'low',
    title: isOnTrack
      ? `${progressPercent}% van je maanddoel bereikt!`
      : `Besparingsdoel: ${progressPercent}% bereikt`,
    message: isOnTrack
      ? `Je hebt €${savings.totalSavedThisMonth.toLocaleString('nl-NL')} bespaard deze maand. Je bent goed op weg!`
      : `€${savings.totalSavedThisMonth.toLocaleString('nl-NL')} van €${monthlyGoal.toLocaleString('nl-NL')} bespaard. Er zijn nog kansen om je doel te halen.`,
    icon: isOnTrack ? 'trophy' : 'flag',
    actionLabel: isOnTrack ? undefined : 'Bekijk kansen',
    actionRoute: isOnTrack ? undefined : '/(contractor)/besparen',
    source: 'Besparingsdoel',
    metric: {
      label: 'Voortgang',
      value: `${progressPercent}%`,
      trend: isOnTrack ? 'up' : 'neutral',
    },

    rawScore: 0,
    reasoning: {
      observation: `€${savings.totalSavedThisMonth.toLocaleString('nl-NL')} bespaard van €${monthlyGoal.toLocaleString('nl-NL')} maanddoel`,
      evidence: `Op basis van ${savings.breakdown.length} besparingscategorieën`,
      implication: isOnTrack
        ? `Op jaarbasis is dit €${(savings.totalSavedThisMonth * 12).toLocaleString('nl-NL')} besparing`
        : `Je mist nog €${(monthlyGoal - savings.totalSavedThisMonth).toLocaleString('nl-NL')} om je doel te halen`,
      suggestion: isOnTrack
        ? 'Verhoog je maanddoel om meer te besparen'
        : 'Focus op leveranciersvergelijking — daar zitten de snelste besparingen',
    },
    dataPoints: savings.breakdown.length,
    confidence: 0.7,
    freshness: 6,
  };
}

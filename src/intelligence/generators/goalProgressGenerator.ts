// =============================================================================
// GOAL PROGRESS GENERATOR
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import { useSavingsAggregation } from '../../services/savingsAggregatorService';
import { logPrediction } from '../calibration';
import { recordMetricSnapshot, getTrend } from '../learningStorage';
import { gt, gtMoney } from '../generatorTranslations';

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
    prediction: `Savings goal: ${progressPercent}% of ${gtMoney(monthlyGoal, ctx.country)}`,
    predictedValue: savings.totalSavedThisMonth,
  });
  const isOnTrack = progressPercent >= 75;
  const streak = ctx.profile.savingsProfile.savingsStreak;
  const streakText = streak >= 2 ? ` ${gt('goal_progress_streak', ctx.language, { count: streak })}` : '';
  const topCat = ctx.profile.savingsProfile.topSavingsCategory;

  return {
    id: 'goal-progress',
    generatorId: 'goal-progress',
    category: isOnTrack ? 'opportunity' : 'tip',
    priority: 'low',
    title: isOnTrack
      ? gt('goal_progress_title_ontrack', ctx.language, { pct: progressPercent })
      : gt('goal_progress_title', ctx.language, { pct: progressPercent }),
    message: isOnTrack
      ? `${gt('goal_progress_message_ontrack', ctx.language, { amount: gtMoney(savings.totalSavedThisMonth, ctx.country) })}${streakText}`
      : gt('goal_progress_message', ctx.language, { current: gtMoney(savings.totalSavedThisMonth, ctx.country), target: gtMoney(monthlyGoal, ctx.country) }),
    icon: isOnTrack ? 'trophy' : 'flag',
    actionLabel: isOnTrack ? undefined : gt('goal_progress_action', ctx.language),
    actionRoute: isOnTrack ? undefined : '/(contractor)/besparen',
    source: gt('source_savings', ctx.language),
    metric: {
      label: gt('goal_progress_metric_label', ctx.language),
      value: `${progressPercent}%`,
      trend: isOnTrack ? 'up' : 'neutral',
    },

    rootCauseTags: ['savings', 'goal'],
    rawScore: 0,
    reasoning: {
      observation: gt('goal_progress_observation', ctx.language, { current: gtMoney(savings.totalSavedThisMonth, ctx.country), target: gtMoney(monthlyGoal, ctx.country) }),
      evidence: `${gt('goal_progress_evidence', ctx.language, { count: savings.breakdown.length })}${(() => { const t = getTrend(ctx.profile, 'savingsTotal'); return t && t.slope !== 0 ? ` ${gt('goal_progress_evidence_trend', ctx.language, { direction: gt(`trend_dir_${t.direction}`, ctx.language) })}` : ''; })()}`,
      implication: isOnTrack
        ? gt('goal_progress_implication_ontrack', ctx.language, { amount: gtMoney(savings.totalSavedThisMonth * 12, ctx.country) })
        : gt('goal_progress_implication', ctx.language, { amount: gtMoney(monthlyGoal - savings.totalSavedThisMonth, ctx.country) }),
      suggestion: isOnTrack
        ? gt('goal_progress_suggestion_ontrack', ctx.language)
        : topCat ? gt('goal_progress_suggestion_cat', ctx.language, { category: topCat }) : gt('goal_progress_suggestion', ctx.language),
    },
    dataPoints: savings.breakdown.length,
    confidence: 0.7,
    freshness: 6,
  };
}

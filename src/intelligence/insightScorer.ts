// =============================================================================
// INSIGHT SCORER - Ranks and filters generated insights
// =============================================================================
// finalScore = (relevance × W_r) + (engagement × W_e) + (freshness × W_f)
//            + (urgency × W_u) - fatiguePenalty
// Weights are role-dependent. Category diversity enforced.
// =============================================================================

import type { ScoredInsight, ScreenContext, UserRole } from './generators/types';
import { priorityToUrgencyScore } from './generators/types';
import {
  getEngagementRate,
  getLastShownTime,
  getLastDismissedTime,
  getRemainingDailyBudget,
  type ContractorLearningProfile,
} from './learningStorage';
import { getConfidenceMultiplier, getCalibrationScores, logPrediction } from './calibration';
import type { CalibrationScore } from './calibration';

// =============================================================================
// CALIBRATION CACHE
// =============================================================================

let calibrationCache: Map<string, number> = new Map();
let calibrationCacheAge = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function refreshCalibrationCache(): Promise<void> {
  const scores = await getCalibrationScores();
  const newCache = new Map<string, number>();
  for (const score of scores) {
    newCache.set(score.generatorId, getConfidenceMultiplier(score.accuracyRate));
  }
  calibrationCache = newCache;
  calibrationCacheAge = Date.now();
}

function getCalibratedMultiplier(generatorId: string): number {
  const multiplier = calibrationCache.get(generatorId);
  if (multiplier !== undefined) return multiplier;
  return 1.0; // neutral default if no calibration data
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_PER_SCREEN = 5;
const MIN_SCORE_THRESHOLD = 0.3;
const FATIGUE_SAME_GENERATOR_4H = 0.3;
const FATIGUE_DISMISSED_24H = 0.6;
const MAX_PER_CATEGORY = 2; // diversity enforcement

// =============================================================================
// ROLE-BASED SCORING WEIGHTS
// =============================================================================
// Each role values different dimensions:
// - Contractors: engagement (what they actually use) + freshness (time-sensitive)
// - CFO: urgency (financial risk) + relevance (financial screens)
// - Site Lead: relevance (site-specific) + freshness (daily operations)
// - COO: balanced with slight urgency emphasis
// - Director: urgency (strategic risk) + relevance (portfolio)
// =============================================================================

interface ScoringWeights {
  relevance: number;
  engagement: number;
  freshness: number;
  urgency: number;
}

const ROLE_WEIGHTS: Record<UserRole, ScoringWeights> = {
  contractor: { relevance: 0.35, engagement: 0.30, freshness: 0.25, urgency: 0.10 },
  sitelead:   { relevance: 0.40, engagement: 0.25, freshness: 0.25, urgency: 0.10 },
  coo:        { relevance: 0.30, engagement: 0.20, freshness: 0.20, urgency: 0.30 },
  cfo:        { relevance: 0.30, engagement: 0.20, freshness: 0.15, urgency: 0.35 },
  director:   { relevance: 0.30, engagement: 0.15, freshness: 0.15, urgency: 0.40 },
};

// =============================================================================
// SCREEN RELEVANCE WEIGHTS
// =============================================================================

const SCREEN_RELEVANCE: Record<string, Record<ScreenContext, number>> = {
  'overdue-invoice': { today: 0.9, invoices: 1.0, savings: 0.3, decisions: 0.2, meer: 0.1, schedule: 0.1, dispatch: 0.1, costs: 0.5, cashflow: 0.8, returns: 0.2, approvals: 0.1, risks: 0.3, performance: 0.2, permits: 0.1, procurement: 0.1, financials: 0.5, efficiency: 0.2, market: 0.1, emerging: 0.1, portfolio: 0.2, overview: 0.3, safety: 0.1, quality: 0.1, issues: 0.1 },
  'savings-opportunity': { today: 0.7, invoices: 0.3, savings: 1.0, decisions: 0.4, meer: 0.3, schedule: 0.1, dispatch: 0.1, costs: 0.5, cashflow: 0.3, returns: 0.2, approvals: 0.1, risks: 0.1, performance: 0.3, permits: 0.1, procurement: 0.5, financials: 0.3, efficiency: 0.3, market: 0.2, emerging: 0.1, portfolio: 0.1, overview: 0.3, safety: 0.1, quality: 0.1, issues: 0.1 },
  'margin-drift': { today: 0.8, invoices: 0.5, savings: 0.9, decisions: 0.7, meer: 0.2, schedule: 0.1, dispatch: 0.1, costs: 0.9, cashflow: 0.5, returns: 0.3, approvals: 0.1, risks: 0.4, performance: 0.5, permits: 0.1, procurement: 0.2, financials: 0.7, efficiency: 0.4, market: 0.1, emerging: 0.1, portfolio: 0.2, overview: 0.5, safety: 0.1, quality: 0.1, issues: 0.1 },
  'compliance-alert': { today: 0.9, invoices: 0.2, savings: 0.1, decisions: 0.3, meer: 0.8, schedule: 0.2, dispatch: 0.2, costs: 0.1, cashflow: 0.1, returns: 0.1, approvals: 0.3, risks: 0.5, performance: 0.2, permits: 0.7, procurement: 0.1, financials: 0.2, efficiency: 0.1, market: 0.2, emerging: 0.1, portfolio: 0.1, overview: 0.4, safety: 0.8, quality: 0.5, issues: 0.3 },
  'labor-efficiency': { today: 0.7, invoices: 0.2, savings: 0.5, decisions: 0.8, meer: 0.2, schedule: 0.5, dispatch: 0.5, costs: 0.7, cashflow: 0.2, returns: 0.1, approvals: 0.1, risks: 0.2, performance: 0.6, permits: 0.1, procurement: 0.1, financials: 0.4, efficiency: 0.9, market: 0.1, emerging: 0.1, portfolio: 0.1, overview: 0.3, safety: 0.1, quality: 0.1, issues: 0.1 },
  'estimation-calibration': { today: 0.5, invoices: 0.2, savings: 0.8, decisions: 0.6, meer: 0.3, schedule: 0.2, dispatch: 0.1, costs: 0.6, cashflow: 0.1, returns: 0.1, approvals: 0.1, risks: 0.2, performance: 0.5, permits: 0.1, procurement: 0.1, financials: 0.3, efficiency: 0.4, market: 0.1, emerging: 0.1, portfolio: 0.1, overview: 0.3, safety: 0.1, quality: 0.1, issues: 0.1 },
  'dso-trend': { today: 0.8, invoices: 1.0, savings: 0.2, decisions: 0.3, meer: 0.2, schedule: 0.1, dispatch: 0.1, costs: 0.3, cashflow: 0.9, returns: 0.2, approvals: 0.1, risks: 0.3, performance: 0.3, permits: 0.1, procurement: 0.1, financials: 0.6, efficiency: 0.2, market: 0.1, emerging: 0.1, portfolio: 0.1, overview: 0.3, safety: 0.1, quality: 0.1, issues: 0.1 },
  'cert-expiry': { today: 0.8, invoices: 0.1, savings: 0.1, decisions: 0.2, meer: 0.9, schedule: 0.1, dispatch: 0.1, costs: 0.1, cashflow: 0.1, returns: 0.1, approvals: 0.2, risks: 0.4, performance: 0.1, permits: 0.6, procurement: 0.1, financials: 0.1, efficiency: 0.1, market: 0.1, emerging: 0.1, portfolio: 0.1, overview: 0.3, safety: 0.5, quality: 0.2, issues: 0.1 },
  'supplier-price': { today: 0.4, invoices: 0.2, savings: 0.9, decisions: 0.3, meer: 0.6, schedule: 0.1, dispatch: 0.1, costs: 0.5, cashflow: 0.2, returns: 0.1, approvals: 0.1, risks: 0.1, performance: 0.2, permits: 0.1, procurement: 0.8, financials: 0.3, efficiency: 0.2, market: 0.3, emerging: 0.1, portfolio: 0.1, overview: 0.2, safety: 0.1, quality: 0.1, issues: 0.1 },
  'weather-schedule': { today: 0.9, invoices: 0.1, savings: 0.1, decisions: 0.1, meer: 0.1, schedule: 0.8, dispatch: 0.5, costs: 0.1, cashflow: 0.1, returns: 0.1, approvals: 0.1, risks: 0.3, performance: 0.1, permits: 0.1, procurement: 0.1, financials: 0.1, efficiency: 0.2, market: 0.1, emerging: 0.1, portfolio: 0.1, overview: 0.3, safety: 0.2, quality: 0.1, issues: 0.1 },
  'daily-planning': { today: 1.0, invoices: 0.1, savings: 0.2, decisions: 0.3, meer: 0.1, schedule: 0.9, dispatch: 0.6, costs: 0.1, cashflow: 0.1, returns: 0.1, approvals: 0.1, risks: 0.1, performance: 0.2, permits: 0.1, procurement: 0.1, financials: 0.1, efficiency: 0.5, market: 0.1, emerging: 0.1, portfolio: 0.1, overview: 0.3, safety: 0.1, quality: 0.1, issues: 0.1 },
  'cross-service': { today: 0.5, invoices: 0.7, savings: 0.8, decisions: 0.7, meer: 0.3, schedule: 0.2, dispatch: 0.2, costs: 0.4, cashflow: 0.4, returns: 0.2, approvals: 0.2, risks: 0.3, performance: 0.4, permits: 0.1, procurement: 0.3, financials: 0.4, efficiency: 0.3, market: 0.2, emerging: 0.2, portfolio: 0.2, overview: 0.3, safety: 0.1, quality: 0.1, issues: 0.1 },
  'cash-gap': { today: 0.8, invoices: 0.9, savings: 0.2, decisions: 0.3, meer: 0.2, schedule: 0.1, dispatch: 0.1, costs: 0.4, cashflow: 1.0, returns: 0.2, approvals: 0.1, risks: 0.4, performance: 0.2, permits: 0.1, procurement: 0.1, financials: 0.5, efficiency: 0.2, market: 0.1, emerging: 0.1, portfolio: 0.1, overview: 0.3, safety: 0.1, quality: 0.1, issues: 0.1 },
  'capacity': { today: 0.7, invoices: 0.1, savings: 0.2, decisions: 0.8, meer: 0.2, schedule: 0.9, dispatch: 0.8, costs: 0.2, cashflow: 0.1, returns: 0.1, approvals: 0.1, risks: 0.2, performance: 0.3, permits: 0.1, procurement: 0.1, financials: 0.2, efficiency: 0.7, market: 0.1, emerging: 0.1, portfolio: 0.1, overview: 0.3, safety: 0.1, quality: 0.1, issues: 0.1 },
  'goal-progress': { today: 0.6, invoices: 0.2, savings: 0.9, decisions: 0.2, meer: 0.3, schedule: 0.1, dispatch: 0.1, costs: 0.3, cashflow: 0.2, returns: 0.2, approvals: 0.1, risks: 0.1, performance: 0.5, permits: 0.1, procurement: 0.1, financials: 0.3, efficiency: 0.2, market: 0.1, emerging: 0.1, portfolio: 0.1, overview: 0.3, safety: 0.1, quality: 0.1, issues: 0.1 },
  'profitability': { today: 0.5, invoices: 0.3, savings: 0.3, decisions: 0.4, meer: 0.2, schedule: 0.1, dispatch: 0.1, costs: 0.7, cashflow: 0.5, returns: 0.5, approvals: 0.2, risks: 0.5, performance: 0.7, permits: 0.1, procurement: 0.2, financials: 0.8, efficiency: 0.4, market: 0.2, emerging: 0.1, portfolio: 0.6, overview: 0.9, safety: 0.1, quality: 0.1, issues: 0.1 },
  'financial-audit': { today: 0.7, invoices: 0.9, savings: 0.2, decisions: 0.3, meer: 0.2, schedule: 0.1, dispatch: 0.1, costs: 0.6, cashflow: 0.5, returns: 0.2, approvals: 0.3, risks: 0.4, performance: 0.2, permits: 0.1, procurement: 0.2, financials: 0.7, efficiency: 0.2, market: 0.1, emerging: 0.1, portfolio: 0.2, overview: 0.5, safety: 0.1, quality: 0.1, issues: 0.1 },
  'margin-root-cause': { today: 0.8, invoices: 0.4, savings: 0.9, decisions: 0.9, meer: 0.2, schedule: 0.1, dispatch: 0.1, costs: 0.8, cashflow: 0.3, returns: 0.3, approvals: 0.1, risks: 0.4, performance: 0.6, permits: 0.1, procurement: 0.2, financials: 0.6, efficiency: 0.5, market: 0.1, emerging: 0.1, portfolio: 0.2, overview: 0.5, safety: 0.1, quality: 0.1, issues: 0.1 },
  'customer-lifecycle': { today: 0.7, invoices: 0.8, savings: 0.2, decisions: 0.7, meer: 0.3, schedule: 0.1, dispatch: 0.1, costs: 0.3, cashflow: 0.5, returns: 0.3, approvals: 0.1, risks: 0.3, performance: 0.5, permits: 0.1, procurement: 0.1, financials: 0.4, efficiency: 0.1, market: 0.2, emerging: 0.1, portfolio: 0.3, overview: 0.4, safety: 0.1, quality: 0.1, issues: 0.1 },
  'cascading-delay': { today: 0.9, invoices: 0.1, savings: 0.1, decisions: 0.7, meer: 0.1, schedule: 1.0, dispatch: 0.7, costs: 0.3, cashflow: 0.2, returns: 0.1, approvals: 0.1, risks: 0.5, performance: 0.3, permits: 0.1, procurement: 0.1, financials: 0.2, efficiency: 0.6, market: 0.1, emerging: 0.1, portfolio: 0.1, overview: 0.3, safety: 0.1, quality: 0.2, issues: 0.2 },
  'static-tip': { today: 0.3, invoices: 0.3, savings: 0.3, decisions: 0.3, meer: 0.3, schedule: 0.3, dispatch: 0.3, costs: 0.3, cashflow: 0.3, returns: 0.3, approvals: 0.3, risks: 0.3, performance: 0.3, permits: 0.3, procurement: 0.3, financials: 0.3, efficiency: 0.3, market: 0.3, emerging: 0.3, portfolio: 0.3, overview: 0.3, safety: 0.3, quality: 0.3, issues: 0.3 },
};

// =============================================================================
// SCORING FUNCTIONS
// =============================================================================

function getRelevanceScore(generatorId: string, screen: ScreenContext): number {
  const mapping = SCREEN_RELEVANCE[generatorId];
  if (!mapping) return 0.3;
  return mapping[screen] ?? 0.3;
}

function getFreshnessScore(freshnessHours: number): number {
  return 1 / (1 + freshnessHours / 24);
}

function getFatiguePenalty(
  profile: ContractorLearningProfile,
  generatorId: string,
  now: Date,
): number {
  let penalty = 0;

  // Same generator shown in last 4 hours
  const lastShown = getLastShownTime(profile, generatorId);
  if (lastShown) {
    const hoursSince = (now.getTime() - new Date(lastShown).getTime()) / 3600000;
    if (hoursSince < 4) penalty += FATIGUE_SAME_GENERATOR_4H;
  }

  // Dismissed in last 24 hours
  const lastDismissed = getLastDismissedTime(profile, generatorId);
  if (lastDismissed) {
    const hoursSince = (now.getTime() - new Date(lastDismissed).getTime()) / 3600000;
    if (hoursSince < 24) penalty += FATIGUE_DISMISSED_24H;
  }

  return penalty;
}

// =============================================================================
// MAIN SCORER
// =============================================================================

export function scoreInsight(
  insight: ScoredInsight,
  screen: ScreenContext,
  profile: ContractorLearningProfile,
  now: Date,
  role: UserRole = 'contractor',
): ScoredInsight {
  const weights = ROLE_WEIGHTS[role] || ROLE_WEIGHTS.contractor;

  const relevance = getRelevanceScore(insight.generatorId, screen);
  const engagement = getEngagementRate(profile, insight.generatorId);
  const freshness = getFreshnessScore(insight.freshness);
  const urgency = priorityToUrgencyScore(insight.priority);
  const fatigue = getFatiguePenalty(profile, insight.generatorId, now);

  const baseScore =
    (relevance * weights.relevance) +
    (engagement * weights.engagement) +
    (freshness * weights.freshness) +
    (urgency * weights.urgency) -
    fatigue;

  // Apply calibration multiplier: accurate generators boosted, inaccurate dampened
  const calibrationMult = getCalibratedMultiplier(insight.generatorId);
  const finalScore = baseScore * calibrationMult;

  return {
    ...insight,
    rawScore: Math.max(0, Math.min(1, finalScore)),
  };
}

export function scoreAndRankInsights(
  insights: ScoredInsight[],
  screen: ScreenContext,
  profile: ContractorLearningProfile,
  now: Date,
  role: UserRole = 'contractor',
): ScoredInsight[] {
  const budget = getRemainingDailyBudget(profile);

  const scored = insights
    .map(insight => scoreInsight(insight, screen, profile, now, role))
    .filter(insight => insight.rawScore >= MIN_SCORE_THRESHOLD)
    .sort((a, b) => b.rawScore - a.rawScore);

  // Diversity enforcement: max MAX_PER_CATEGORY insights per category
  const categoryCounts = new Map<string, number>();
  const diversified: ScoredInsight[] = [];

  for (const insight of scored) {
    const cat = insight.category || 'other';
    const count = categoryCounts.get(cat) || 0;
    if (count < MAX_PER_CATEGORY) {
      diversified.push(insight);
      categoryCounts.set(cat, count + 1);
    }
    if (diversified.length >= Math.min(MAX_PER_SCREEN, budget)) break;
  }

  return diversified;
}

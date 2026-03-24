// =============================================================================
// INSIGHT SCORER - Ranks and filters generated insights
// =============================================================================
// finalScore = (relevance × W_r) + (engagement × W_e) + (freshness × W_f)
//            + (urgency × W_u) - fatiguePenalty
// Weights are role-dependent. Category diversity enforced.
// =============================================================================

import type { ScoredInsight, ScreenContext, UserRole } from './generators/types';
import { MS_PER_HOUR } from '../utils/timeConstants';
import { priorityToUrgencyScore } from './generators/types';
import {
  getEngagementRate,
  getLastShownTime,
  getLastDismissedTime,
  getRemainingDailyBudget,
  getHabituationScore,
  getCategoryFatigueToday,
  getScreenVisitCount,
  getOutcomeSuccessRate,
  getSnoozeExpiry,
  type ContractorLearningProfile,
} from './learningStorage';
import { getConfidenceMultiplier, getCalibrationScores, logPrediction } from './calibration';
import type { CalibrationScore } from './calibration';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getQueueHistory } from '../services/aiActionQueueService';

// =============================================================================
// GENERATOR DISPLAY NAMES (for consolidation evidence)
// =============================================================================

const GENERATOR_DISPLAY_NAMES: Record<string, string> = {
  'overdue-invoice': 'Openstaande facturen',
  'savings-opportunity': 'Besparingskansen',
  'margin-drift': 'Marge-analyse',
  'compliance-alert': 'Compliance',
  'labor-efficiency': 'Arbeidsefficiëntie',
  'estimation-calibration': 'Offertekalibratie',
  'dso-trend': 'DSO-trend',
  'cert-expiry': 'Certificaten',
  'supplier-price': 'Leveranciersprijzen',
  'weather-schedule': 'Weersplanning',
  'daily-planning': 'Dagplanning',
  'cross-service': 'Cross-service',
  'cash-gap': 'Kasgat-analyse',
  'capacity': 'Capaciteitsplanning',
  'goal-progress': 'Doelvoortgang',
  'profitability': 'Winstgevendheid',
  'financial-audit': 'Financiële audit',
  'margin-root-cause': 'Marge-oorzaak',
  'customer-lifecycle': 'Klant-levenscyclus',
  'cascading-delay': 'Cascadevertraging',
  'estimation-variance-type': 'Schattingsafwijking',
  'static-tip': 'Vasco Tip',
  // CFO project generators
  'project-budget-variance': 'Budgetvariantie',
  'contingency-burn': 'Contingency Tracker',
  'approval-bottleneck': 'Approval Tracker',
  'project-risk-score': 'Risico Analyse',
  'portfolio-irr': 'IRR Analyse',
  // COO generators
  'schedule-fragility': 'Planningsfragiliteit',
  'supplier-risk': 'Procurement Risico',
  'permit-delay': 'Vergunning Tracker',
  'change-order-velocity': 'Change Order Tracker',
  // Director generators
  'handover-bottleneck': 'Handover Tracker',
  'portfolio-health': 'Portfolio Gezondheid',
  'value-delivery': 'Platform ROI',
  'cross-project-risk': 'Cross-Project Risico',
};

// =============================================================================
// CALIBRATION CACHE (with AsyncStorage persistence)
// =============================================================================

const CALIBRATION_CACHE_KEY = '@vasco_calibration_cache';
const CACHE_PERSIST_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours for persisted cache

let calibrationCache: Map<string, number> = new Map();
let calibrationCacheAge = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes for in-memory refresh

export async function refreshCalibrationCache(): Promise<void> {
  const scores = await getCalibrationScores();
  const newCache = new Map<string, number>();
  for (const score of scores) {
    newCache.set(score.generatorId, getConfidenceMultiplier(score.accuracyRate));
  }
  calibrationCache = newCache;
  calibrationCacheAge = Date.now();

  // Persist to AsyncStorage so cache survives app restart
  try {
    const persistData = {
      entries: Object.fromEntries(newCache),
      savedAt: calibrationCacheAge,
    };
    await AsyncStorage.setItem(CALIBRATION_CACHE_KEY, JSON.stringify(persistData));
  } catch { /* silent */ }
}

/**
 * Load calibration cache from AsyncStorage on cold start.
 * Uses persisted data if < 24 hours old, otherwise returns false.
 */
async function loadPersistedCalibrationCache(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(CALIBRATION_CACHE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw) as { entries: Record<string, number>; savedAt: number };
    if (Date.now() - data.savedAt > CACHE_PERSIST_TTL_MS) return false;

    calibrationCache = new Map(Object.entries(data.entries));
    calibrationCacheAge = data.savedAt;
    return true;
  } catch {
    return false;
  }
}

// Cold-start: try loading persisted cache immediately
let coldStartLoaded = false;

function getCalibratedMultiplier(generatorId: string): number {
  // Cold start: load from AsyncStorage if cache is empty
  if (!coldStartLoaded && calibrationCache.size === 0) {
    coldStartLoaded = true;
    loadPersistedCalibrationCache().then(loaded => {
      if (!loaded) refreshCalibrationCache().catch(() => {});
    }).catch(() => {});
  }

  // Auto-refresh stale cache (fire-and-forget, uses current cache in meantime)
  if (calibrationCacheAge > 0 && Date.now() - calibrationCacheAge > CACHE_TTL_MS) {
    refreshCalibrationCache().catch(() => {});
  }
  const multiplier = calibrationCache.get(generatorId);
  if (multiplier !== undefined) return multiplier;
  return 1.0; // neutral default if no calibration data
}

// =============================================================================
// APPROVAL RATE CACHE — learns from queue history (Initiative 3)
// =============================================================================
// Per-generator approval rate from the AI action queue. High approval rate
// means the contractor trusts this generator's suggestions → boost score.
// Low approval rate means noise → dampen score.
// =============================================================================

let approvalRateCache: Map<string, number> = new Map(); // generatorId → approval rate (0..1)
let approvalRateCacheAge = 0;
const APPROVAL_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function refreshApprovalRateCache(): Promise<void> {
  try {
    const history = await getQueueHistory();
    const stats: Record<string, { approved: number; total: number }> = {};
    for (const item of history) {
      const gen = item.sourceGeneratorId || 'unknown';
      if (!stats[gen]) stats[gen] = { approved: 0, total: 0 };
      stats[gen].total++;
      if (item.status === 'approved') stats[gen].approved++;
    }
    const newCache = new Map<string, number>();
    for (const [gen, s] of Object.entries(stats)) {
      if (s.total >= 2) { // need at least 2 data points
        newCache.set(gen, s.approved / s.total);
      }
    }
    approvalRateCache = newCache;
    approvalRateCacheAge = Date.now();
  } catch { /* silent */ }
}

function getApprovalRateMultiplier(generatorId: string): number {
  // Auto-refresh stale cache
  if (approvalRateCacheAge === 0 || Date.now() - approvalRateCacheAge > APPROVAL_CACHE_TTL_MS) {
    refreshApprovalRateCache().catch(() => {});
  }
  const rate = approvalRateCache.get(generatorId);
  if (rate === undefined) return 1.0; // no history → neutral
  if (rate >= 0.8) return 1.3;        // 80%+ approval → boost
  if (rate <= 0.2) return 0.5;        // 20%- approval → dampen
  return 1.0;                          // middle ground → neutral
}

// =============================================================================
// CROSS-GENERATOR CONFIDENCE DEPENDENCIES
// =============================================================================
// Some generators reinforce each other. When a "source" generator has high
// calibration accuracy, the "dependent" generator gets a confidence boost.
// =============================================================================

const CONFIDENCE_DEPENDENCIES: Record<string, string[]> = {
  'margin-root-cause': ['margin-drift'],                    // root cause depends on drift detection
  'cash-gap':          ['dso-trend', 'overdue-invoice'],    // cash gap depends on DSO + overdue
  'cascading-delay':   ['capacity', 'daily-planning'],      // cascade depends on capacity awareness
  'customer-lifecycle': ['overdue-invoice', 'profitability'], // lifecycle depends on payment + profit
  'goal-progress':     ['savings-opportunity'],              // goals met via realized savings
  'profitability':     ['estimation-calibration', 'margin-drift'], // profit driven by estimation + margins
  'labor-efficiency':  ['capacity'],                         // efficiency improves with balanced capacity
  'estimation-variance-type': ['estimation-calibration'],    // variance type informs calibration
  'margin-drift':      ['labor-efficiency'],                 // margin erosion often caused by labor issues
};

function getCrossGeneratorBoost(generatorId: string): number {
  const deps = CONFIDENCE_DEPENDENCIES[generatorId];
  if (!deps || deps.length === 0) return 0;

  let totalMult = 0;
  let depCount = 0;
  for (const depId of deps) {
    const mult = calibrationCache.get(depId);
    if (mult !== undefined && mult > 1.0) {
      totalMult += mult - 1.0; // excess above 1.0
      depCount++;
    }
  }

  // Small boost: avg excess * 0.5, capped at 0.1
  if (depCount === 0) return 0;
  return Math.min(0.1, (totalMult / depCount) * 0.5);
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_PER_SCREEN = 5;
const MIN_SCORE_THRESHOLD = 0.3;
const MAX_PER_CATEGORY = 2; // diversity enforcement

// Role-aware fatigue: contractors tolerate frequent insights, enterprise roles prefer less noise
const ROLE_FATIGUE: Record<UserRole, { sameGenerator4h: number; dismissed24h: number }> = {
  contractor: { sameGenerator4h: 0.20, dismissed24h: 0.40 },  // high tolerance
  sitelead:   { sameGenerator4h: 0.25, dismissed24h: 0.50 },  // moderate
  coo:        { sameGenerator4h: 0.35, dismissed24h: 0.65 },  // lower tolerance
  cfo:        { sameGenerator4h: 0.40, dismissed24h: 0.70 },  // low — prefers quality over quantity
  director:   { sameGenerator4h: 0.45, dismissed24h: 0.75 },  // lowest — strategic, few insights
};

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

const SCREEN_RELEVANCE: Record<string, Partial<Record<ScreenContext, number>>> = {
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
  'estimation-variance-type': { today: 0.6, invoices: 0.2, savings: 0.9, decisions: 0.7, meer: 0.3, schedule: 0.1, dispatch: 0.1, costs: 0.7, cashflow: 0.1, returns: 0.1, approvals: 0.1, risks: 0.2, performance: 0.5, permits: 0.1, procurement: 0.1, financials: 0.3, efficiency: 0.4, market: 0.1, emerging: 0.1, portfolio: 0.1, overview: 0.3, safety: 0.1, quality: 0.1, issues: 0.1 },
  'static-tip': { today: 0.3, invoices: 0.3, savings: 0.3, decisions: 0.3, meer: 0.3, schedule: 0.3, dispatch: 0.3, costs: 0.3, cashflow: 0.3, returns: 0.3, approvals: 0.3, risks: 0.3, performance: 0.3, permits: 0.3, procurement: 0.3, financials: 0.3, efficiency: 0.3, market: 0.3, emerging: 0.3, portfolio: 0.3, overview: 0.3, safety: 0.3, quality: 0.3, issues: 0.3, 'quote-new': 0.3, 'invoice-new': 0.3, 'invoice-create': 0.3, 'job-detail': 0.3, 'job-materials': 0.3, 'jobs-list': 0.3, 'cfo-projects': 0.3, 'cfo-costs': 0.3, 'cfo-appraisal': 0.3, 'cfo-risks': 0.3, 'cfo-approvals': 0.3, 'coo-schedule': 0.3, 'director-metrics': 0.3 },
  // Workflow generators
  'quote-benchmark': { 'quote-new': 1.0, today: 0.4 },
  'material-suggestion': { 'job-materials': 1.0, 'job-detail': 0.7 },
  'customer-payment-history': { 'invoice-new': 0.9, 'invoice-create': 0.9, 'quote-new': 0.7 },
  'margin-warning': { 'job-detail': 1.0, 'quote-new': 0.8 },
  'similar-job-comparison': { 'jobs-list': 0.8, 'job-detail': 0.9, 'quote-new': 0.7 },
  // CFO project generators
  'project-budget-variance': { 'cfo-costs': 1.0, 'cfo-projects': 0.8 },
  'contingency-burn': { 'cfo-costs': 0.9, 'cfo-projects': 0.7 },
  'approval-bottleneck': { 'cfo-approvals': 1.0, 'cfo-projects': 0.6 },
  'project-risk-score': { 'cfo-risks': 1.0, 'cfo-projects': 0.7 },
  'portfolio-irr': { 'cfo-appraisal': 1.0, 'cfo-projects': 0.8 },
  // COO generators
  'schedule-fragility': { efficiency: 1.0, 'coo-schedule': 1.0, schedule: 0.9 },
  'supplier-risk': { emerging: 0.9, procurement: 1.0 },
  'permit-delay': { market: 1.0, permits: 1.0 },
  'change-order-velocity': { financials: 0.8, efficiency: 0.7, costs: 0.6 },
  // Director generators
  'handover-bottleneck': { portfolio: 0.9, approvals: 0.7 },
  'portfolio-health': { portfolio: 1.0, performance: 0.7 },
  'value-delivery': { performance: 1.0, 'director-metrics': 1.0 },
  'cross-project-risk': { risks: 1.0, portfolio: 0.8 },
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
  role: UserRole = 'contractor',
): number {
  const fatigueLevels = ROLE_FATIGUE[role] || ROLE_FATIGUE.contractor;
  let penalty = 0;

  // Same generator shown in last 4 hours
  const lastShown = getLastShownTime(profile, generatorId);
  if (lastShown) {
    const hoursSince = (now.getTime() - new Date(lastShown).getTime()) / MS_PER_HOUR;
    if (hoursSince < 4) penalty += fatigueLevels.sameGenerator4h;
  }

  // Dismissed in last 24 hours (escalating: more dismissals = higher penalty)
  const lastDismissed = getLastDismissedTime(profile, generatorId);
  if (lastDismissed) {
    const hoursSince = (now.getTime() - new Date(lastDismissed).getTime()) / MS_PER_HOUR;
    if (hoursSince < 24) penalty += fatigueLevels.dismissed24h;
  }

  // Habituation: persistent dismissal pattern (14-day window)
  penalty += getHabituationScore(profile, generatorId);

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

  // Suppress generators in dismissedPatterns (user consistently ignores these)
  if (profile.dismissedPatterns.includes(insight.generatorId)) {
    return { ...insight, rawScore: 0 };
  }

  const relevance = getRelevanceScore(insight.generatorId, screen);

  // Screen affinity: boost relevance for frequently-visited screens
  const screenVisits = getScreenVisitCount(profile, screen);
  const screenAffinityBoost = screenVisits > 20 ? 0.05 : screenVisits > 10 ? 0.03 : 0;
  const engagement = getEngagementRate(profile, insight.generatorId);
  const freshness = getFreshnessScore(insight.freshness);
  const urgency = priorityToUrgencyScore(insight.priority);
  const fatigue = getFatiguePenalty(profile, insight.generatorId, now, role);
  const categoryFatigue = getCategoryFatigueToday(profile, insight.category || 'other', now);

  // Cross-screen dedup: penalize enterprise roles seeing same generator on different screen within 6h
  let crossScreenPenalty = 0;
  if (role !== 'contractor') {
    const sixHoursAgo = new Date(now.getTime() - 6 * MS_PER_HOUR).toISOString();
    const recentOnOtherScreen = profile.insightInteractions.some(
      i => i.generatorId === insight.generatorId
        && i.action === 'viewed'
        && i.timestamp > sixHoursAgo
        && i.screenContext !== screen
        && i.screenContext !== '',
    );
    if (recentOnOtherScreen) crossScreenPenalty = 0.15;
  }

  // Outcome success rate (computed early so actionedBonus can reference it)
  const outcomeRate = getOutcomeSuccessRate(profile, insight.generatorId);

  // Actioned pattern boost: scaled by outcome success rate
  // High outcome rate (>0.7) → 0.08, moderate (>0.5) → 0.05, low → 0.02
  const isActioned = profile.actionedPatterns.includes(insight.generatorId);
  const actionedBonus = isActioned
    ? (outcomeRate > 0.7 ? 0.08 : outcomeRate > 0.5 ? 0.05 : 0.02)
    : 0;

  const baseScore =
    (relevance * weights.relevance) +
    (engagement * weights.engagement) +
    (freshness * weights.freshness) +
    (urgency * weights.urgency) +
    screenAffinityBoost +
    actionedBonus -
    fatigue -
    categoryFatigue -
    crossScreenPenalty;

  // Data-point confidence: insights based on few data points get dampened
  // Scales from 0.7 (1 data point) to 1.0 (10+ data points)
  const dp = insight.dataPoints ?? 1;
  const dataPointFactor = dp >= 10 ? 1.0 : 0.7 + 0.3 * (Math.min(dp, 10) / 10);

  // Apply calibration multiplier: accurate generators boosted, inaccurate dampened
  const calibrationMult = getCalibratedMultiplier(insight.generatorId);

  // Cross-generator confidence: boost when dependent generators are well-calibrated
  const crossBoost = getCrossGeneratorBoost(insight.generatorId);

  // Outcome-based boost: generators whose insights led to positive results get a bonus
  const outcomeBoost = outcomeRate > 0.6 ? 0.05 : outcomeRate < 0.3 ? -0.05 : 0;

  // Approval rate from queue history: learn what the contractor actually acts on
  const approvalMult = getApprovalRateMultiplier(insight.generatorId);

  const finalScore = (baseScore + crossBoost + outcomeBoost) * calibrationMult * dataPointFactor * approvalMult;

  // Low-data confidence warning for insights based on few data points
  const confidenceWarning = dp < 5
    ? `Vroeg signaal — gebaseerd op ${dp} datapunt${dp > 1 ? 'en' : ''}`
    : undefined;

  return {
    ...insight,
    rawScore: Math.max(0, Math.min(1, finalScore)),
    confidenceWarning,
  };
}

// =============================================================================
// INSIGHT CONSOLIDATION
// =============================================================================
// Merges insights that share rootCauseTags. The highest-scored insight absorbs
// lower-scored ones sharing >= 1 tag. Absorbed insights boost confidence and
// evidence, creating stronger composite signals.
// =============================================================================

function consolidateInsights(insights: ScoredInsight[]): ScoredInsight[] {
  if (insights.length <= 1) return insights;

  const absorbed = new Set<string>();
  const result: ScoredInsight[] = [];

  for (const primary of insights) {
    if (absorbed.has(primary.id)) continue;

    const tags = primary.rootCauseTags;
    if (!tags || tags.length === 0) {
      result.push(primary);
      continue;
    }

    // Find lower-scored insights sharing >= 1 tag
    const absorbedInsights: ScoredInsight[] = [];
    for (const candidate of insights) {
      if (candidate.id === primary.id || absorbed.has(candidate.id)) continue;
      const candidateTags = candidate.rootCauseTags;
      if (!candidateTags || candidateTags.length === 0) continue;

      const shared = tags.some(t => candidateTags.includes(t));
      if (shared && candidate.rawScore <= primary.rawScore) {
        absorbedInsights.push(candidate);
        absorbed.add(candidate.id);
      }
    }

    if (absorbedInsights.length > 0) {
      // Boost confidence: +15% per absorbed insight, capped at 0.95
      const boostedConfidence = Math.min(0.95, primary.confidence + absorbedInsights.length * 0.15);

      // Boost rawScore: 1.1x for multi-source corroboration
      const boostedScore = Math.min(1, primary.rawScore * 1.1);

      // Update evidence string with source generator names
      const absorbedIds = absorbedInsights.map(i => i.id);
      const sourceNames = absorbedInsights.map(i => GENERATOR_DISPLAY_NAMES[i.generatorId] || i.generatorId);
      const evidence = `${primary.reasoning.evidence} — bevestigd door ${sourceNames.join(', ')} (${absorbedInsights.length + 1} bronnen)`;

      result.push({
        ...primary,
        confidence: boostedConfidence,
        rawScore: boostedScore,
        consolidatedFrom: absorbedIds,
        reasoning: {
          ...primary.reasoning,
          evidence,
        },
      });
    } else {
      result.push(primary);
    }
  }

  // Re-sort after score adjustments
  return result.sort((a, b) => b.rawScore - a.rawScore);
}

export function scoreAndRankInsights(
  insights: ScoredInsight[],
  screen: ScreenContext,
  profile: ContractorLearningProfile,
  now: Date,
  role: UserRole = 'contractor',
): ScoredInsight[] {
  const budget = getRemainingDailyBudget(profile);

  // Filter snoozed insights before scoring
  const unsnoozed = insights.filter(insight => !getSnoozeExpiry(profile, insight.generatorId));

  const scored = unsnoozed
    .map(insight => scoreInsight(insight, screen, profile, now, role))
    .filter(insight => insight.rawScore >= MIN_SCORE_THRESHOLD)
    .sort((a, b) => b.rawScore - a.rawScore);

  // Consolidation: merge related insights before diversity enforcement
  const consolidated = consolidateInsights(scored);

  // Diversity enforcement: max 1 insight per generator, max MAX_PER_CATEGORY per category
  const categoryCounts = new Map<string, number>();
  const seenGenerators = new Set<string>();
  const diversified: ScoredInsight[] = [];

  for (const insight of consolidated) {
    // Generator-level dedup: only the highest-scored insight per generator
    if (seenGenerators.has(insight.generatorId)) continue;

    const cat = insight.category || 'other';
    const count = categoryCounts.get(cat) || 0;
    if (count < MAX_PER_CATEGORY) {
      diversified.push(insight);
      categoryCounts.set(cat, count + 1);
      seenGenerators.add(insight.generatorId);
    }
    if (diversified.length >= Math.min(MAX_PER_SCREEN, budget)) break;
  }

  return diversified;
}

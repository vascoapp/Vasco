// =============================================================================
// LEARNING STORAGE - On-device learning profile via AsyncStorage
// =============================================================================
// Tracks contractor behavior to personalize insights. All data stays on-device.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback, useRef } from 'react';
import { MS_PER_DAY } from '../utils/timeConstants';

// =============================================================================
// TYPES
// =============================================================================

export interface ContractorLearningProfile {
  schemaVersion: number;                       // migration versioning (current: 2)
  contractorId: string;
  insightInteractions: InsightInteraction[];   // last 500
  serviceUsageStats: Record<string, number>;   // screen visit counts
  dismissedPatterns: string[];                 // insight categories user ignores
  actionedPatterns: string[];                  // insight categories user acts on
  jobCompletionHistory: JobOutcome[];          // last 50 jobs
  invoicePatterns: InvoicePattern;
  savingsProfile: SavingsProfile;
  metricHistory: MetricSnapshot[];             // max 12 weeks per metric
  insightsShownToday: number;                  // daily budget counter
  insightsShownDate: string;                   // YYYY-MM-DD for budget reset
  lastUpdated: string;
}

export interface InsightInteraction {
  insightId: string;
  generatorId: string;
  action: 'viewed' | 'expanded' | 'dismissed' | 'snoozed' | 'acted' | 'ignored';
  timestamp: string;
  screenContext: string;
  category?: string;
  dwellTimeMs?: number;
  outcome?: 'positive' | 'negative' | 'neutral'; // filled after acting
  snoozeUntil?: string;  // ISO date — if snoozed, when it should reappear
}

export interface JobOutcome {
  jobId: string;
  jobType: string;
  estimatedHours: number;
  actualHours: number;
  estimatedCost: number;
  actualCost: number;
  marginPercent: number;
  completedAt: string;
}

export interface InvoicePattern {
  avgDSO: number;
  onTimeRate: number;
  totalInvoices: number;
  overdueCount: number;
}

export interface SavingsProfile {
  monthlySavings: number;
  goalAmount: number;
  savingsStreak: number;       // consecutive months meeting goal
  topSavingsCategory: string;
}

// =============================================================================
// METRIC TREND TYPES
// =============================================================================

export type MetricKey =
  | 'dso'
  | 'marginLeakage'
  | 'idlePercent'
  | 'estimationAccuracy'
  | 'savingsTotal'
  | 'overdueAmount'
  | 'complianceScore'
  | 'capacityUtilization'
  | 'quoteMedian'
  | 'customerOverdueRate'
  | 'jobMargin'
  | 'revenue'
  | 'win_rate'
  // Site lead metrics
  | 'workforceUtilization'
  | 'incidentRate'
  | 'defectCount'
  | 'inspectionScore';

export interface MetricSnapshot {
  metric: MetricKey;
  value: number;
  recordedAt: string;  // ISO date
  weekKey: string;     // YYYY-Www for deduplication
}

export type TrendDirection = 'improving' | 'stable' | 'declining';

export interface TrendResult {
  direction: TrendDirection;
  slope: number;           // positive = increasing raw value
  currentValue: number;
  previousValue: number;
  dataPoints: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STORAGE_KEY_PREFIX = '@vasco_learning_profile';
const MAX_INTERACTIONS = 500;
const MAX_JOB_HISTORY = 50;
const DEBOUNCE_MS = 2000;
const DAILY_INSIGHT_BUDGET = 20;

// Active role for role-aware storage (set by setActiveRole, defaults to 'contractor')
let activeRole = 'contractor';

export function setActiveRole(role: string): void {
  if (role !== activeRole) {
    activeRole = role;
    cachedProfile = null; // Invalidate cache when role changes
  }
}

function getStorageKey(): string {
  return `${STORAGE_KEY_PREFIX}_${activeRole}`;
}

// In-memory dedup for recordMetricSnapshot: prevent redundant AsyncStorage writes from re-renders
const recentMetricWrites = new Map<string, number>(); // metricKey -> timestamp
const METRIC_DEDUP_MS = 60 * 1000; // 1 minute between writes for same metric

// =============================================================================
// DEFAULT PROFILE
// =============================================================================

const CURRENT_SCHEMA_VERSION = 2;

function createDefaultProfile(contractorId: string = 'default'): ContractorLearningProfile {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    contractorId,
    insightInteractions: [],
    serviceUsageStats: {},
    dismissedPatterns: [],
    actionedPatterns: [],
    jobCompletionHistory: [],
    invoicePatterns: { avgDSO: 0, onTimeRate: 0, totalInvoices: 0, overdueCount: 0 },
    savingsProfile: { monthlySavings: 0, goalAmount: 500, savingsStreak: 0, topSavingsCategory: '' },
    metricHistory: [],
    insightsShownToday: 0,
    insightsShownDate: new Date().toISOString().split('T')[0],
    lastUpdated: new Date().toISOString(),
  };
}

// =============================================================================
// PROFILE MIGRATION SYSTEM
// =============================================================================
// Migration registry: each migration upgrades from version N to N+1.
// Runs sequentially: v0→v1→v2→...→current. Auto-persists upgraded profiles.
// =============================================================================

type ProfileMigration = (profile: Record<string, unknown>) => Record<string, unknown>;

const migrations: Record<number, ProfileMigration> = {
  // v0→v1: Ensure metricHistory exists (replaces ad-hoc guard)
  0: (profile) => {
    if (!profile.metricHistory) profile.metricHistory = [];
    profile.schemaVersion = 1;
    return profile;
  },
  // v1→v2: schemaVersion field is now required on all profiles
  1: (profile) => {
    profile.schemaVersion = 2;
    return profile;
  },
};

function migrateProfile(profile: Record<string, unknown>): ContractorLearningProfile {
  let version = (profile.schemaVersion as number) || 0;
  while (version < CURRENT_SCHEMA_VERSION) {
    const migrate = migrations[version];
    if (migrate) {
      profile = migrate(profile);
    }
    version++;
  }
  profile.schemaVersion = CURRENT_SCHEMA_VERSION;
  return profile as unknown as ContractorLearningProfile;
}

// =============================================================================
// PERSISTENCE
// =============================================================================

export async function loadProfile(): Promise<ContractorLearningProfile> {
  try {
    const raw = await AsyncStorage.getItem(getStorageKey());
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const version = (parsed.schemaVersion as number) || 0;
      const profile = migrateProfile(parsed);
      // Auto-persist if we upgraded the schema
      if (version < CURRENT_SCHEMA_VERSION) {
        await saveProfile(profile);
      }
      return profile;
    }
  } catch {
    // Corrupted data — start fresh
  }
  return createDefaultProfile();
}

export async function saveProfile(profile: ContractorLearningProfile): Promise<void> {
  try {
    profile.lastUpdated = new Date().toISOString();
    await AsyncStorage.setItem(getStorageKey(), JSON.stringify(profile));
  } catch {
    // Silent fail — non-critical
  }
}

// =============================================================================
// INTERACTION RECORDING
// =============================================================================

let pendingSave: ReturnType<typeof setTimeout> | null = null;
let cachedProfile: ContractorLearningProfile | null = null;

async function getProfile(): Promise<ContractorLearningProfile> {
  if (!cachedProfile) {
    cachedProfile = await loadProfile();
  }
  return cachedProfile;
}

function debouncedSave(profile: ContractorLearningProfile) {
  cachedProfile = profile;
  if (pendingSave) clearTimeout(pendingSave);
  pendingSave = setTimeout(() => {
    saveProfile(profile);
    pendingSave = null;
  }, DEBOUNCE_MS);
}

export async function recordInteraction(interaction: InsightInteraction): Promise<void> {
  const profile = await getProfile();

  // Append and trim to max
  profile.insightInteractions.push(interaction);
  if (profile.insightInteractions.length > MAX_INTERACTIONS) {
    profile.insightInteractions = profile.insightInteractions.slice(-MAX_INTERACTIONS);
  }

  // Update pattern tracking
  if (interaction.action === 'acted') {
    if (!profile.actionedPatterns.includes(interaction.generatorId)) {
      profile.actionedPatterns.push(interaction.generatorId);
    }
  } else if (interaction.action === 'dismissed' || interaction.action === 'ignored') {
    const dismissCount = profile.insightInteractions
      .filter(i => i.generatorId === interaction.generatorId && (i.action === 'dismissed' || i.action === 'ignored'))
      .length;
    // Only mark as dismissed pattern after 3+ dismissals
    if (dismissCount >= 3 && !profile.dismissedPatterns.includes(interaction.generatorId)) {
      profile.dismissedPatterns.push(interaction.generatorId);
    }
  }

  debouncedSave(profile);
}

/**
 * Record the outcome of acting on an insight.
 * Call this after a user acts on an insight and the result is known.
 * Positive outcomes boost future engagement; negative outcomes dampen.
 */
export async function recordInsightOutcome(
  insightId: string,
  generatorId: string,
  outcome: 'positive' | 'negative' | 'neutral',
): Promise<void> {
  const profile = await getProfile();

  // Find the most recent 'acted' interaction for this insight and stamp it
  const actedIdx = [...profile.insightInteractions]
    .reverse()
    .findIndex(i => i.insightId === insightId && i.generatorId === generatorId && i.action === 'acted');

  if (actedIdx >= 0) {
    const realIdx = profile.insightInteractions.length - 1 - actedIdx;
    profile.insightInteractions[realIdx].outcome = outcome;
  }

  debouncedSave(profile);
}

/**
 * Get the outcome success rate for a generator (how often acted insights led to positive outcomes).
 * Returns 0.5 (neutral) when insufficient data.
 */
/**
 * Check if a generator is currently snoozed (snoozeUntil > now).
 * Returns the expiry ISO string if snoozed, null otherwise.
 */
export function getSnoozeExpiry(profile: ContractorLearningProfile, generatorId: string): string | null {
  const now = new Date().toISOString();
  const snoozed = profile.insightInteractions
    .filter(i => i.generatorId === generatorId && i.action === 'snoozed' && i.snoozeUntil)
    .sort((a, b) => (b.snoozeUntil || '').localeCompare(a.snoozeUntil || ''));

  if (snoozed.length > 0 && snoozed[0].snoozeUntil! > now) {
    return snoozed[0].snoozeUntil!;
  }
  return null;
}

export function getOutcomeSuccessRate(profile: ContractorLearningProfile, generatorId: string): number {
  const withOutcomes = profile.insightInteractions.filter(
    i => i.generatorId === generatorId && i.action === 'acted' && i.outcome
  );
  if (withOutcomes.length < 2) return 0.5;

  const positives = withOutcomes.filter(i => i.outcome === 'positive').length;
  return positives / withOutcomes.length;
}

export async function recordScreenVisit(screenName: string): Promise<void> {
  const profile = await getProfile();
  profile.serviceUsageStats[screenName] = (profile.serviceUsageStats[screenName] || 0) + 1;
  debouncedSave(profile);
}

export async function getRecentScreens(): Promise<string[]> {
  const profile = await getProfile();
  // Return screens sorted by visit count (most visited first)
  return Object.entries(profile.serviceUsageStats)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .map(([screen]) => screen)
    .slice(0, 10);
}

export async function recordJobOutcome(outcome: JobOutcome): Promise<void> {
  const profile = await getProfile();
  profile.jobCompletionHistory.push(outcome);
  if (profile.jobCompletionHistory.length > MAX_JOB_HISTORY) {
    profile.jobCompletionHistory = profile.jobCompletionHistory.slice(-MAX_JOB_HISTORY);
  }

  // Update savingsProfile from job outcomes
  const completedJobs = profile.jobCompletionHistory;
  if (completedJobs.length > 0) {
    const avgMargin = completedJobs.reduce((s, j) => s + j.marginPercent, 0) / completedJobs.length;
    const totalSaved = completedJobs.reduce((s, j) => {
      const saved = j.estimatedCost - j.actualCost;
      return s + (saved > 0 ? saved : 0);
    }, 0);

    profile.savingsProfile.monthlySavings = Math.round(totalSaved / Math.max(1, getMonthSpan(completedJobs)));
    profile.savingsProfile.savingsStreak = countConsecutiveSavingsMonths(completedJobs);

    // Identify top savings category
    const catSavings = new Map<string, number>();
    for (const job of completedJobs) {
      const saved = job.estimatedCost - job.actualCost;
      if (saved > 0) {
        catSavings.set(job.jobType, (catSavings.get(job.jobType) || 0) + saved);
      }
    }
    let topCat = '';
    let topVal = 0;
    for (const [cat, val] of catSavings) {
      if (val > topVal) { topCat = cat; topVal = val; }
    }
    if (topCat) profile.savingsProfile.topSavingsCategory = topCat;
  }

  debouncedSave(profile);

  // Resolve calibration predictions now that we have a new outcome
  resolveOutcomesFromJobHistory().catch(() => {/* silent */});
}

/**
 * Resolve calibration predictions when outcomes are known.
 * Call this when a job completes (to resolve margin-drift predictions)
 * or when invoices get paid (to resolve DSO predictions).
 * Uses batch resolver from calibration system.
 */
export async function resolveOutcomesFromJobHistory(): Promise<void> {
  const { resolveCalibrationPredictions } = await import('./calibration');
  const profile = await getProfile();

  const recentJobs = profile.jobCompletionHistory.slice(-5);
  if (recentJobs.length === 0) return;

  const totalLeakage = recentJobs.reduce((sum, j) => {
    const delta = j.actualCost - j.estimatedCost;
    return sum + (delta > 0 ? delta : 0);
  }, 0);

  const avgAccuracy = recentJobs.reduce((sum, j) => {
    if (j.estimatedCost === 0) return sum;
    return sum + (1 - Math.abs(j.actualCost - j.estimatedCost) / j.estimatedCost) * 100;
  }, 0) / recentJobs.length;

  const avgDurationRatio = recentJobs.reduce((sum, j) => {
    if (j.estimatedHours === 0) return sum;
    return sum + j.actualHours / j.estimatedHours;
  }, 0) / recentJobs.length;

  // Compute additional metrics for expanded resolution
  const totalSaved = recentJobs.reduce((sum, j) => {
    const saved = j.estimatedCost - j.actualCost;
    return sum + (saved > 0 ? saved : 0);
  }, 0);

  const avgMargin = recentJobs.reduce((sum, j) => sum + j.marginPercent, 0) / recentJobs.length;

  // Compute average variance ratio for estimation-variance-type
  const avgVarianceRatio = recentJobs.reduce((sum, j) => {
    if (j.estimatedCost === 0) return sum;
    return sum + Math.abs(j.actualCost - j.estimatedCost) / j.estimatedCost;
  }, 0) / recentJobs.length;

  await resolveCalibrationPredictions([
    { generatorId: 'margin-drift', actualValue: totalLeakage, tolerancePercent: 15 },
    { generatorId: 'margin-root-cause', actualValue: totalLeakage, tolerancePercent: 25 },
    { generatorId: 'estimation-calibration', actualValue: avgAccuracy, tolerancePercent: 10 },
    { generatorId: 'cascading-delay', actualValue: avgDurationRatio, tolerancePercent: 20 },
    { generatorId: 'profitability', actualValue: totalLeakage, tolerancePercent: 20 },
    { generatorId: 'savings-opportunity', actualValue: totalSaved, tolerancePercent: 25 },
    { generatorId: 'labor-efficiency', actualValue: avgDurationRatio, tolerancePercent: 20 },
    { generatorId: 'capacity', actualValue: avgDurationRatio * 100, tolerancePercent: 25 },
    { generatorId: 'estimation-variance-type', actualValue: avgVarianceRatio * 100, tolerancePercent: 15 },
    // R237: extended coverage — these generators predict against the same
    // job-completion signals; passing them through the same resolver lets
    // the calibration multiplier kick in for them too.
    { generatorId: 'margin-warning', actualValue: avgMargin, tolerancePercent: 15 },
    { generatorId: 'similar-job-comparison', actualValue: avgDurationRatio, tolerancePercent: 25 },
    { generatorId: 'crew-performance', actualValue: avgDurationRatio, tolerancePercent: 25 },
    { generatorId: 'project-budget-variance', actualValue: totalLeakage, tolerancePercent: 20 },
    { generatorId: 'project-risk-score', actualValue: avgVarianceRatio * 100, tolerancePercent: 25 },
  ]);
}

/**
 * Resolve quote-outcome predictions. Called when a quote is accepted or
 * rejected. Generators that predicted likelihood-of-acceptance get graded
 * here; the actualValue is 1 for accepted, 0 for rejected.
 */
export async function resolveOutcomesFromQuoteOutcome(
  accepted: boolean,
  daysToDecision?: number,
): Promise<void> {
  const { resolveCalibrationPredictions } = await import('./calibration');
  const v = accepted ? 100 : 0; // %-style for tolerance math
  const ops: Array<{ generatorId: string; actualValue: number; tolerancePercent?: number }> = [
    { generatorId: 'quote-benchmark', actualValue: v, tolerancePercent: 20 },
    { generatorId: 'customer-lifecycle', actualValue: v, tolerancePercent: 25 },
  ];
  if (typeof daysToDecision === 'number' && daysToDecision >= 0) {
    ops.push({ generatorId: 'customer-payment-history', actualValue: daysToDecision, tolerancePercent: 30 });
  }
  await resolveCalibrationPredictions(ops);
}

/**
 * Resolve material/supplier predictions. Called when a material purchase
 * lands. actualPrice is what the contractor paid per unit.
 */
export async function resolveOutcomesFromMaterialPurchase(
  actualUnitPrice: number,
): Promise<void> {
  const { resolveCalibrationPredictions } = await import('./calibration');
  await resolveCalibrationPredictions([
    { generatorId: 'supplier-price', actualValue: actualUnitPrice, tolerancePercent: 15 },
    { generatorId: 'material-suggestion', actualValue: actualUnitPrice, tolerancePercent: 20 },
    { generatorId: 'supplier-price-anomaly', actualValue: actualUnitPrice, tolerancePercent: 20 },
  ]);
}

// =============================================================================
// INVOICE OUTCOME RECORDING
// =============================================================================

export interface InvoiceOutcome {
  invoiceId: string;
  amount: number;
  issuedDate: string;
  dueDate: string;
  paidDate?: string;   // undefined if still unpaid
  isOverdue: boolean;
}

export async function recordInvoiceOutcome(outcome: InvoiceOutcome): Promise<void> {
  const profile = await getProfile();

  profile.invoicePatterns.totalInvoices++;
  if (outcome.isOverdue) {
    profile.invoicePatterns.overdueCount++;
  }

  // Calculate DSO if paid
  if (outcome.paidDate) {
    const issued = new Date(outcome.issuedDate).getTime();
    const paid = new Date(outcome.paidDate).getTime();
    const daysToPayment = Math.max(0, Math.round((paid - issued) / MS_PER_DAY));

    // Running average DSO
    const prevTotal = profile.invoicePatterns.avgDSO * (profile.invoicePatterns.totalInvoices - 1);
    profile.invoicePatterns.avgDSO = Math.round(
      (prevTotal + daysToPayment) / profile.invoicePatterns.totalInvoices
    );

    const due = new Date(outcome.dueDate).getTime();
    const onTime = paid <= due;
    const prevOnTimeCount = Math.round(
      profile.invoicePatterns.onTimeRate * (profile.invoicePatterns.totalInvoices - 1)
    );
    profile.invoicePatterns.onTimeRate = (prevOnTimeCount + (onTime ? 1 : 0)) / profile.invoicePatterns.totalInvoices;
  }

  // Resolve calibration predictions for invoice-related generators
  if (outcome.paidDate) {
    const issued = new Date(outcome.issuedDate).getTime();
    const paid = new Date(outcome.paidDate).getTime();
    const actualDSO = Math.max(0, Math.round((paid - issued) / MS_PER_DAY));

    import('./calibration').then(({ resolveCalibrationPredictions }) => {
      resolveCalibrationPredictions([
        { generatorId: 'dso-trend', actualValue: actualDSO, tolerancePercent: 20 },
        { generatorId: 'overdue-invoice', actualValue: outcome.amount, tolerancePercent: 15 },
        { generatorId: 'cash-gap', actualValue: actualDSO, tolerancePercent: 20 },
      ]).catch(() => {});
    }).catch(() => {});
  }

  debouncedSave(profile);
}

// =============================================================================
// SAVINGS PROFILE HELPERS
// =============================================================================

function getMonthSpan(jobs: JobOutcome[]): number {
  if (jobs.length < 2) return 1;
  const dates = jobs.map(j => new Date(j.completedAt).getTime()).sort();
  const spanMs = dates[dates.length - 1] - dates[0];
  return Math.max(1, Math.round(spanMs / (30 * MS_PER_DAY)));
}

function countConsecutiveSavingsMonths(jobs: JobOutcome[]): number {
  if (jobs.length === 0) return 0;
  const byMonth = new Map<string, number>();
  for (const job of jobs) {
    const monthKey = job.completedAt.slice(0, 7); // YYYY-MM
    const saved = job.estimatedCost - job.actualCost;
    byMonth.set(monthKey, (byMonth.get(monthKey) || 0) + (saved > 0 ? saved : 0));
  }
  const months = [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  let streak = 0;
  for (const [, saved] of months) {
    if (saved > 0) streak++;
    else break;
  }
  return streak;
}

export async function incrementInsightsShown(count: number): Promise<void> {
  const profile = await getProfile();
  const today = new Date().toISOString().split('T')[0];
  if (profile.insightsShownDate !== today) {
    profile.insightsShownToday = 0;
    profile.insightsShownDate = today;
  }
  profile.insightsShownToday += count;
  debouncedSave(profile);
}

// =============================================================================
// METRIC TREND TRACKING
// =============================================================================

const MAX_SNAPSHOTS_PER_METRIC = 12;

function getWeekKey(date: Date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / MS_PER_DAY - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export async function recordMetricSnapshot(metric: MetricKey, value: number): Promise<void> {
  // Dedup: skip redundant writes from re-renders (1-minute window per metric)
  const now = Date.now();
  const lastWrite = recentMetricWrites.get(metric);
  if (lastWrite && now - lastWrite < METRIC_DEDUP_MS) return;
  recentMetricWrites.set(metric, now);

  const profile = await getProfile();
  const weekKey = getWeekKey();

  // Deduplicate: only one snapshot per metric per week
  const existingIdx = profile.metricHistory.findIndex(
    s => s.metric === metric && s.weekKey === weekKey
  );
  if (existingIdx >= 0) {
    // Update the existing snapshot for this week
    profile.metricHistory[existingIdx].value = value;
    profile.metricHistory[existingIdx].recordedAt = new Date().toISOString();
  } else {
    profile.metricHistory.push({
      metric,
      value,
      recordedAt: new Date().toISOString(),
      weekKey,
    });
  }

  // Trim to max snapshots per metric
  const byMetric = new Map<MetricKey, MetricSnapshot[]>();
  for (const snap of profile.metricHistory) {
    const arr = byMetric.get(snap.metric) || [];
    arr.push(snap);
    byMetric.set(snap.metric, arr);
  }
  const trimmed: MetricSnapshot[] = [];
  for (const [, snaps] of byMetric) {
    const sorted = snaps.sort((a, b) => a.weekKey.localeCompare(b.weekKey));
    trimmed.push(...sorted.slice(-MAX_SNAPSHOTS_PER_METRIC));
  }
  profile.metricHistory = trimmed;

  debouncedSave(profile);
}

// Higher-is-better metrics: improving means value is increasing
const HIGHER_IS_BETTER: MetricKey[] = ['estimationAccuracy', 'savingsTotal', 'complianceScore', 'capacityUtilization'];

export function getTrend(
  profile: ContractorLearningProfile,
  metric: MetricKey,
  weeks: number = 4,
): TrendResult | null {
  const snapshots = profile.metricHistory
    .filter(s => s.metric === metric)
    .sort((a, b) => a.weekKey.localeCompare(b.weekKey))
    .slice(-weeks);

  if (snapshots.length < 2) return null;

  const current = snapshots[snapshots.length - 1].value;
  const previous = snapshots[snapshots.length - 2].value;
  const first = snapshots[0].value;

  // Simple linear slope: (last - first) / periods
  const slope = (current - first) / (snapshots.length - 1);

  const higherIsBetter = HIGHER_IS_BETTER.includes(metric);
  const improving = higherIsBetter ? slope > 0.5 : slope < -0.5;
  const declining = higherIsBetter ? slope < -0.5 : slope > 0.5;

  return {
    direction: improving ? 'improving' : declining ? 'declining' : 'stable',
    slope,
    currentValue: current,
    previousValue: previous,
    dataPoints: snapshots.length,
  };
}

// =============================================================================
// HOOK: useMetricTrend
// =============================================================================

export function useMetricTrend(metric: MetricKey, weeks: number = 4): TrendResult | null {
  const { profile } = useLearningProfile();
  return getTrend(profile, metric, weeks);
}

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Recency-weighted engagement rate (14-day half-life).
 * Recent interactions weight ~1.0; 2 weeks old ~0.5; 2 months old ~6%.
 * Falls back to 0.5 (neutral) when total weight < 0.01.
 */
const ENGAGEMENT_HALF_LIFE_DAYS = 14;
const ENGAGEMENT_DECAY = Math.LN2 / ENGAGEMENT_HALF_LIFE_DAYS;

export function getEngagementRate(profile: ContractorLearningProfile, generatorId: string): number {
  const now = Date.now();
  const interactions = profile.insightInteractions.filter(i => i.generatorId === generatorId);
  if (interactions.length === 0) return 0.5; // neutral default

  let positiveWeight = 0;
  let totalWeight = 0;

  for (const interaction of interactions) {
    if (interaction.action === 'viewed' || interaction.action === 'snoozed') continue; // skip neutral
    const ageMs = now - new Date(interaction.timestamp).getTime();
    const ageDays = Math.max(0, ageMs / MS_PER_DAY);
    const weight = Math.exp(-ENGAGEMENT_DECAY * ageDays);

    // Dwell-time bonus: expanded insights with >5s dwell get up to 1.5x weight
    const dwellBonus = (interaction.action === 'expanded' && interaction.dwellTimeMs)
      ? Math.min(1.5, 1 + Math.log10(Math.max(1, interaction.dwellTimeMs / 5000)))
      : 1.0;

    if (interaction.action === 'acted' || interaction.action === 'expanded') {
      positiveWeight += weight * dwellBonus;
    }
    totalWeight += weight;
  }

  if (totalWeight < 0.01) return 0.5; // insufficient data → neutral
  return positiveWeight / totalWeight;
}

/**
 * Get early habituation signal: how many times a generator was dismissed recently.
 * Returns 0 (no habituation) to 1 (strong habituation).
 */
export function getHabituationScore(profile: ContractorLearningProfile, generatorId: string): number {
  const now = Date.now();
  const recentDismissals = profile.insightInteractions.filter(i => {
    if (i.generatorId !== generatorId) return false;
    if (i.action !== 'dismissed' && i.action !== 'ignored') return false;
    const ageMs = now - new Date(i.timestamp).getTime();
    return ageMs < 14 * MS_PER_DAY; // last 14 days
  });
  // 0 dismissals = 0, 1 = 0.15, 2 = 0.3, 3+ = 0.5+
  return Math.min(0.8, recentDismissals.length * 0.15);
}

/**
 * Get cross-category fatigue: how many insights of this category were shown today.
 * Returns penalty 0-0.3 based on saturation.
 */
export function getCategoryFatigueToday(
  profile: ContractorLearningProfile,
  category: string,
  now: Date,
): number {
  const todayStr = now.toISOString().split('T')[0];
  const todayViews = profile.insightInteractions.filter(i => {
    return i.timestamp.startsWith(todayStr) && i.action === 'viewed'
      && i.category === category;
  });
  // More than 5 views of the same category today = fatigue starts
  const viewCount = todayViews.length;
  if (viewCount <= 5) return 0;
  return Math.min(0.3, (viewCount - 5) * 0.05);
}

export function getScreenVisitCount(profile: ContractorLearningProfile, screen: string): number {
  return profile.serviceUsageStats[screen] || 0;
}

export function getRemainingDailyBudget(profile: ContractorLearningProfile): number {
  const today = new Date().toISOString().split('T')[0];
  if (profile.insightsShownDate !== today) return DAILY_INSIGHT_BUDGET;
  return Math.max(0, DAILY_INSIGHT_BUDGET - profile.insightsShownToday);
}

export function getLastShownTime(profile: ContractorLearningProfile, generatorId: string): string | null {
  const shown = profile.insightInteractions
    .filter(i => i.generatorId === generatorId && i.action === 'viewed')
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return shown.length > 0 ? shown[0].timestamp : null;
}

export function getLastDismissedTime(profile: ContractorLearningProfile, generatorId: string): string | null {
  const dismissed = profile.insightInteractions
    .filter(i => i.generatorId === generatorId && i.action === 'dismissed')
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return dismissed.length > 0 ? dismissed[0].timestamp : null;
}

// =============================================================================
// HOOK: useLearningProfile
// =============================================================================

export function useLearningProfile(): {
  profile: ContractorLearningProfile;
  loading: boolean;
  refresh: () => void;
} {
  const [profile, setProfile] = useState<ContractorLearningProfile>(createDefaultProfile());
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    const p = await loadProfile();
    if (mounted.current) {
      setProfile(p);
      cachedProfile = p;
      setLoading(false);
      // Resolve any pending calibration predictions on app startup
      resolveOutcomesFromJobHistory().catch(() => {/* silent */});
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => { mounted.current = false; };
  }, [load]);

  return { profile, loading, refresh: load };
}

// =============================================================================
// CROSS-DOMAIN OUTCOME RECORDERS (for intelligence feedback loops)
// =============================================================================

export async function recordInsuranceOutcome(data: {
  claimId: string;
  type: string;
  wasApproved: boolean;
  amount: number;
  daysToResolve: number;
}): Promise<void> {
  await recordMetricSnapshot('complianceScore', data.wasApproved ? 1 : 0);
}

export async function recordPermitOutcome(data: {
  permitId: string;
  type: string;
  wasGranted: boolean;
  daysToDecision: number;
}): Promise<void> {
  await recordMetricSnapshot('complianceScore', data.wasGranted ? 1 : 0);
}

export async function recordSubcontractorQuality(data: {
  subcontractorId: string;
  jobId: string;
  qualityScore: number; // 1-5
  onTime: boolean;
  reworkRequired: boolean;
}): Promise<void> {
  // Track via capacity utilization as proxy for sub performance
  const score = data.qualityScore * 20; // normalize to 0-100
  await recordMetricSnapshot('capacityUtilization', score);
}

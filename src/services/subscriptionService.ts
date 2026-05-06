// =============================================================================
// SUBSCRIPTION SERVICE — 4-tier freemium system for VascoApp
// =============================================================================
// Tiers: Free → Advanced → Pro → Contractor
// Free: get started, limited jobs/quotes/invoices
// Advanced: more capacity, basic AI, payment processing
// Pro: full AI, purchasing agent, ML predictions, benchmarking
// Contractor: team features, dedicated support, white-label, API
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Country } from '../context/AuthContext';
import i18n from '../i18n/i18n';

// ─── Tier Definitions ──────────────────────────────────────────────────────

export type SubscriptionTier = 'free' | 'advanced' | 'pro' | 'contractor';
export type BillingCycle = 'monthly' | 'annual';

export interface TierLimits {
  // Capacity limits
  maxActiveJobs: number;
  maxQuotesPerMonth: number;
  maxInvoicesPerMonth: number;
  maxAiInsightsPerMonth: number;
  maxClients: number;
  maxPhotoStorageMB: number;
  maxTeamSeats: number;

  // Payment & invoicing
  hasPaymentProcessing: boolean;
  hasAccountingIntegrations: boolean;
  maxAccountingIntegrations: number;
  hasEInvoicing: boolean;
  hasFullEInvoicing: boolean;         // All 6 EU formats

  // AI & intelligence
  hasEveAI: boolean;                  // EVE Agent (basic execution)
  hasEveAuditor: boolean;             // EVE Auditor (compliance monitoring)
  hasEveAnalyst: boolean;             // EVE Analyst (business intelligence)
  hasAutomationPacks: boolean;
  maxAutomationPacks: number;
  hasMlPredictions: boolean;
  hasBenchmarking: boolean;
  hasPriceIndex: boolean;
  hasInvoiceScanning: boolean;

  // Purchasing agent (Pro+)
  hasPurchasingAgent: boolean;        // Scheduled deal finder
  hasBulkPurchaseOptimizer: boolean;  // Cross-job material aggregation
  hasPriceDropAlerts: boolean;        // Daily price monitoring
  hasSupplierScoring: boolean;        // Loyalty/reliability scoring

  // Export & client features
  hasPdfExport: boolean;
  hasClientPortal: boolean;
  hasQuoteTemplates: boolean;         // Trade-specific templates
  hasCustomerDecisions: boolean;      // Decision tracker per job

  // Team & enterprise
  hasApiAccess: boolean;
  hasWhiteLabel: boolean;
  hasSubcontractorPortal: boolean;
  hasWorkerPortal: boolean;
  hasCalendarSync: boolean;
  hasDedicatedSupport: boolean;
  hasOnboardingAssistance: boolean;   // Personalized setup help
  complianceCountries: number;
}

export interface TierConfig {
  id: SubscriptionTier;
  name: string;
  tagline: string;
  monthlyPrice: number;
  annualMonthlyPrice: number;
  annualPrice: number;
  extraSeatPrice: number;
  limits: TierLimits;
  badge?: string;                     // "POPULAR", "BEST VALUE"
}

// ─── Tier Configurations ───────────────────────────────────────────────────

export const TIERS: Record<SubscriptionTier, TierConfig> = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'Get started — free forever',
    monthlyPrice: 0,
    annualMonthlyPrice: 0,
    annualPrice: 0,
    extraSeatPrice: 0,
    limits: {
      maxActiveJobs: 5,
      maxQuotesPerMonth: 10,
      maxInvoicesPerMonth: 10,
      maxAiInsightsPerMonth: 5,
      maxClients: 25,
      maxPhotoStorageMB: 500,
      maxTeamSeats: 1,
      hasPaymentProcessing: false,
      hasAccountingIntegrations: false,
      maxAccountingIntegrations: 0,
      hasEInvoicing: false,
      hasFullEInvoicing: false,
      hasEveAI: false,
      hasEveAuditor: false,
      hasEveAnalyst: false,
      hasAutomationPacks: false,
      maxAutomationPacks: 0,
      hasMlPredictions: false,
      hasBenchmarking: false,
      hasPriceIndex: false,
      hasInvoiceScanning: false,
      hasPurchasingAgent: false,
      hasBulkPurchaseOptimizer: false,
      hasPriceDropAlerts: false,
      hasSupplierScoring: false,
      hasPdfExport: false,
      hasClientPortal: false,
      hasQuoteTemplates: false,
      hasCustomerDecisions: false,
      hasApiAccess: false,
      hasWhiteLabel: false,
      hasSubcontractorPortal: false,
      hasWorkerPortal: false,
      hasCalendarSync: false,
      hasDedicatedSupport: false,
      hasOnboardingAssistance: false,
      complianceCountries: 1,
    },
  },

  advanced: {
    id: 'advanced',
    name: 'Advanced',
    tagline: 'More capacity, smarter tools',
    monthlyPrice: 19,
    annualMonthlyPrice: 14,
    annualPrice: 168,
    extraSeatPrice: 0,
    badge: 'POPULAR',
    limits: {
      maxActiveJobs: 25,
      maxQuotesPerMonth: 50,
      maxInvoicesPerMonth: 50,
      maxAiInsightsPerMonth: 25,
      maxClients: 100,
      maxPhotoStorageMB: 2000,
      maxTeamSeats: 1,
      hasPaymentProcessing: true,
      hasAccountingIntegrations: true,
      maxAccountingIntegrations: 3,
      hasEInvoicing: true,
      hasFullEInvoicing: false,
      hasEveAI: true,                // Basic EVE Agent
      hasEveAuditor: false,
      hasEveAnalyst: false,
      hasAutomationPacks: true,
      maxAutomationPacks: 3,
      hasMlPredictions: false,
      hasBenchmarking: false,
      hasPriceIndex: false,
      hasInvoiceScanning: true,
      hasPurchasingAgent: false,
      hasBulkPurchaseOptimizer: false,
      hasPriceDropAlerts: false,
      hasSupplierScoring: false,
      hasPdfExport: true,
      hasClientPortal: false,
      hasQuoteTemplates: true,
      hasCustomerDecisions: false,
      hasApiAccess: false,
      hasWhiteLabel: false,
      hasSubcontractorPortal: false,
      hasWorkerPortal: false,
      hasCalendarSync: true,
      hasDedicatedSupport: false,
      hasOnboardingAssistance: false,
      complianceCountries: 2,
    },
  },

  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'Full AI power — Vasco pays for itself',
    monthlyPrice: 39,
    annualMonthlyPrice: 29,
    annualPrice: 348,
    extraSeatPrice: 9,
    badge: 'BEST VALUE',
    limits: {
      maxActiveJobs: Infinity,
      maxQuotesPerMonth: Infinity,
      maxInvoicesPerMonth: Infinity,
      maxAiInsightsPerMonth: 100,
      maxClients: Infinity,
      maxPhotoStorageMB: 10000,
      maxTeamSeats: 3,
      hasPaymentProcessing: true,
      hasAccountingIntegrations: true,
      maxAccountingIntegrations: 10,
      hasEInvoicing: true,
      hasFullEInvoicing: true,
      hasEveAI: true,
      hasEveAuditor: true,           // Full compliance monitoring
      hasEveAnalyst: true,           // Full business intelligence
      hasAutomationPacks: true,
      maxAutomationPacks: 7,
      hasMlPredictions: true,
      hasBenchmarking: true,
      hasPriceIndex: true,
      hasInvoiceScanning: true,
      hasPurchasingAgent: true,      // Scheduled deal finder
      hasBulkPurchaseOptimizer: true, // Cross-job bulk savings
      hasPriceDropAlerts: true,       // Daily price monitoring
      hasSupplierScoring: true,       // Supplier reliability tracking
      hasPdfExport: true,
      hasClientPortal: true,
      hasQuoteTemplates: true,
      hasCustomerDecisions: true,
      hasApiAccess: false,
      hasWhiteLabel: false,
      hasSubcontractorPortal: false,
      hasWorkerPortal: false,
      hasCalendarSync: true,
      hasDedicatedSupport: false,
      hasOnboardingAssistance: false,
      complianceCountries: 6,
    },
  },

  contractor: {
    id: 'contractor',
    name: 'Contractor',
    tagline: 'Team features + dedicated support',
    monthlyPrice: 69,
    annualMonthlyPrice: 49,
    annualPrice: 588,
    extraSeatPrice: 19,
    limits: {
      maxActiveJobs: Infinity,
      maxQuotesPerMonth: Infinity,
      maxInvoicesPerMonth: Infinity,
      maxAiInsightsPerMonth: Infinity,
      maxClients: Infinity,
      maxPhotoStorageMB: 50000,
      maxTeamSeats: 15,
      hasPaymentProcessing: true,
      hasAccountingIntegrations: true,
      maxAccountingIntegrations: 19,
      hasEInvoicing: true,
      hasFullEInvoicing: true,
      hasEveAI: true,
      hasEveAuditor: true,
      hasEveAnalyst: true,
      hasAutomationPacks: true,
      maxAutomationPacks: 7,
      hasMlPredictions: true,
      hasBenchmarking: true,
      hasPriceIndex: true,
      hasInvoiceScanning: true,
      hasPurchasingAgent: true,
      hasBulkPurchaseOptimizer: true,
      hasPriceDropAlerts: true,
      hasSupplierScoring: true,
      hasPdfExport: true,
      hasClientPortal: true,
      hasQuoteTemplates: true,
      hasCustomerDecisions: true,
      hasApiAccess: true,
      hasWhiteLabel: true,
      hasSubcontractorPortal: true,
      hasWorkerPortal: true,
      hasCalendarSync: true,
      hasDedicatedSupport: true,
      hasOnboardingAssistance: true,
      complianceCountries: 6,
    },
  },
};

// ─── Subscription State ────────────────────────────────────────────────────

export interface SubscriptionState {
  tier: SubscriptionTier;
  billingCycle: BillingCycle;
  startedAt: string;
  expiresAt: string | null;
  seatsUsed: number;
  seatsPurchased: number;
  aiInsightsUsedThisMonth: number;
  quotesUsedThisMonth: number;
  invoicesUsedThisMonth: number;
  activeJobCount: number;
  clientCount: number;
  trialEndsAt: string | null;        // 14-day trial of Pro
}

const STORAGE_KEY = '@vasco_subscription';
const USAGE_KEY = '@vasco_usage_month';

// ─── Default state ─────────────────────────────────────────────────────────

function defaultState(): SubscriptionState {
  return {
    tier: 'free',
    billingCycle: 'monthly',
    startedAt: new Date().toISOString(),
    expiresAt: null,
    seatsUsed: 1,
    seatsPurchased: 0,
    aiInsightsUsedThisMonth: 0,
    quotesUsedThisMonth: 0,
    invoicesUsedThisMonth: 0,
    activeJobCount: 0,
    clientCount: 0,
    trialEndsAt: null,
  };
}

// ─── Persistence ───────────────────────────────────────────────────────────

export async function loadSubscription(): Promise<SubscriptionState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Merge with defaults to handle partial saves (e.g. from onboarding)
      const state: SubscriptionState = { ...defaultState(), ...parsed };
      // Migrate old tier names
      if ((state.tier as string) === 'gratis') state.tier = 'free';
      // Reset monthly usage if new month
      const usageMonth = await AsyncStorage.getItem(USAGE_KEY);
      const currentMonth = new Date().toISOString().slice(0, 7);
      if (usageMonth !== currentMonth) {
        state.aiInsightsUsedThisMonth = 0;
        state.quotesUsedThisMonth = 0;
        state.invoicesUsedThisMonth = 0;
        await AsyncStorage.setItem(USAGE_KEY, currentMonth);
        await saveSubscription(state);
      }
      return state;
    }
  } catch {}
  return defaultState();
}

export async function saveSubscription(state: SubscriptionState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

// ─── Tier Helpers ──────────────────────────────────────────────────────────

export function getTierConfig(tier: SubscriptionTier): TierConfig {
  return TIERS[tier];
}

export function getTierLimits(tier: SubscriptionTier): TierLimits {
  return TIERS[tier].limits;
}

export function getPrice(tier: SubscriptionTier, cycle: BillingCycle): number {
  const config = TIERS[tier];
  return cycle === 'annual' ? config.annualMonthlyPrice : config.monthlyPrice;
}

/** Returns ordered list of tiers for display */
export function getAllTiers(): TierConfig[] {
  return [TIERS.free, TIERS.advanced, TIERS.pro, TIERS.contractor];
}

/** Check if a tier has access to a higher tier's features */
export function tierAtLeast(current: SubscriptionTier, required: SubscriptionTier): boolean {
  const order: SubscriptionTier[] = ['free', 'advanced', 'pro', 'contractor'];
  return order.indexOf(current) >= order.indexOf(required);
}

// ─── Feature Gating ────────────────────────────────────────────────────────

export type GateResult =
  | { allowed: true }
  | { allowed: false; reason: string; upgradeFeature: string; requiredTier: SubscriptionTier };

// R52: gate functions now accept an optional `liveCount` derived from
// AppState (jobs/quotes/invoices/customers arrays) — single source of
// truth. The previous design read counters off `state` (clientCount,
// quotesUsedThisMonth, etc.), but those counters were never incremented
// anywhere in the codebase, so every gate trivially allowed unlimited
// usage on every tier. Free-tier limits (5 jobs / 10 quotes / 25 clients
// etc.) were declared but completely toothless.
//
// Call sites pass the relevant array length / monthly count from AppState
// so the gates honor real usage. The legacy `state.xxxCount` / `xxxUsed`
// fields stay as a fallback for callers that don't have AppState handy
// (e.g. background jobs).

export function canCreateJob(state: SubscriptionState, liveCount?: number): GateResult {
  const limits = getTierLimits(state.tier);
  const count = liveCount ?? state.activeJobCount;
  if (count >= limits.maxActiveJobs) {
    return { allowed: false, reason: i18n.t('tierGate.jobLimitReached', { count: limits.maxActiveJobs }), upgradeFeature: 'More active jobs', requiredTier: 'advanced' };
  }
  return { allowed: true };
}

export function canCreateQuote(state: SubscriptionState, liveCount?: number): GateResult {
  const limits = getTierLimits(state.tier);
  const count = liveCount ?? state.quotesUsedThisMonth;
  if (count >= limits.maxQuotesPerMonth) {
    return { allowed: false, reason: i18n.t('tierGate.quoteLimitReached', { count: limits.maxQuotesPerMonth }), upgradeFeature: 'More quotes', requiredTier: 'advanced' };
  }
  return { allowed: true };
}

export function canCreateInvoice(state: SubscriptionState, liveCount?: number): GateResult {
  const limits = getTierLimits(state.tier);
  const count = liveCount ?? state.invoicesUsedThisMonth;
  if (count >= limits.maxInvoicesPerMonth) {
    return { allowed: false, reason: i18n.t('tierGate.invoiceLimitReached', { count: limits.maxInvoicesPerMonth }), upgradeFeature: 'More invoices', requiredTier: 'advanced' };
  }
  return { allowed: true };
}

export function canUseAiInsight(state: SubscriptionState, liveCount?: number): GateResult {
  const limits = getTierLimits(state.tier);
  const count = liveCount ?? state.aiInsightsUsedThisMonth;
  if (count >= limits.maxAiInsightsPerMonth) {
    return { allowed: false, reason: i18n.t('tierGate.aiInsightLimitReached', { count: limits.maxAiInsightsPerMonth }), upgradeFeature: 'More AI insights', requiredTier: 'pro' };
  }
  return { allowed: true };
}

export function canAddClient(state: SubscriptionState, liveCount?: number): GateResult {
  const limits = getTierLimits(state.tier);
  const count = liveCount ?? state.clientCount;
  if (count >= limits.maxClients) {
    return { allowed: false, reason: i18n.t('tierGate.clientLimitReached', { count: limits.maxClients }), upgradeFeature: 'More clients', requiredTier: 'advanced' };
  }
  return { allowed: true };
}

export function canAddTeamMember(state: SubscriptionState): GateResult {
  const limits = getTierLimits(state.tier);
  const totalSeats = limits.maxTeamSeats + state.seatsPurchased;
  if (state.seatsUsed >= totalSeats) {
    return { allowed: false, reason: i18n.t('tierGate.seatsInUse', { count: totalSeats }), upgradeFeature: 'More team seats', requiredTier: 'contractor' };
  }
  return { allowed: true };
}

export function canUseFeature(state: SubscriptionState, feature: keyof TierLimits): GateResult {
  const limits = getTierLimits(state.tier);
  const value = limits[feature];
  if (typeof value === 'boolean' && !value) {
    const featureInfo: Record<string, { name: string; tier: SubscriptionTier }> = {
      hasPaymentProcessing: { name: 'Payment processing', tier: 'advanced' },
      hasAccountingIntegrations: { name: 'Accounting integrations', tier: 'advanced' },
      hasEInvoicing: { name: 'E-invoicing', tier: 'advanced' },
      hasFullEInvoicing: { name: 'All e-invoice formats', tier: 'pro' },
      hasEveAI: { name: 'EVE AI assistant', tier: 'advanced' },
      hasEveAuditor: { name: 'EVE compliance monitoring', tier: 'pro' },
      hasEveAnalyst: { name: 'EVE business intelligence', tier: 'pro' },
      hasAutomationPacks: { name: 'Automation packs', tier: 'advanced' },
      hasMlPredictions: { name: 'ML predictions', tier: 'pro' },
      hasBenchmarking: { name: 'Contractor benchmarking', tier: 'pro' },
      hasPriceIndex: { name: 'EU price index', tier: 'pro' },
      hasInvoiceScanning: { name: 'Invoice scanning', tier: 'advanced' },
      hasPurchasingAgent: { name: 'Purchasing agent', tier: 'pro' },
      hasBulkPurchaseOptimizer: { name: 'Bulk purchase optimizer', tier: 'pro' },
      hasPriceDropAlerts: { name: 'Price drop alerts', tier: 'pro' },
      hasSupplierScoring: { name: 'Supplier reliability scoring', tier: 'pro' },
      hasPdfExport: { name: 'PDF/CSV export', tier: 'advanced' },
      hasClientPortal: { name: 'Client portal', tier: 'pro' },
      hasQuoteTemplates: { name: 'Quote templates', tier: 'advanced' },
      hasCustomerDecisions: { name: 'Customer decision tracker', tier: 'pro' },
      hasApiAccess: { name: 'API access', tier: 'contractor' },
      hasWhiteLabel: { name: 'White-label documents', tier: 'contractor' },
      hasSubcontractorPortal: { name: 'Subcontractor portal', tier: 'contractor' },
      hasWorkerPortal: { name: 'Worker portal', tier: 'contractor' },
      hasCalendarSync: { name: 'Calendar sync', tier: 'advanced' },
      hasDedicatedSupport: { name: 'Dedicated support', tier: 'contractor' },
      hasOnboardingAssistance: { name: 'Onboarding assistance', tier: 'contractor' },
    };
    const info = featureInfo[feature];
    return {
      allowed: false,
      reason: i18n.t('tierGate.featureRequiresTier', { feature: info?.name ?? feature, tier: info?.tier ?? 'pro' }),
      upgradeFeature: info?.name ?? String(feature),
      requiredTier: info?.tier ?? 'pro',
    };
  }
  return { allowed: true };
}

// ─── Usage Tracking ────────────────────────────────────────────────────────

export async function recordAiInsightUsage(state: SubscriptionState): Promise<SubscriptionState> {
  const updated = { ...state, aiInsightsUsedThisMonth: state.aiInsightsUsedThisMonth + 1 };
  await saveSubscription(updated);
  return updated;
}

export async function recordQuoteUsage(state: SubscriptionState): Promise<SubscriptionState> {
  const updated = { ...state, quotesUsedThisMonth: state.quotesUsedThisMonth + 1 };
  await saveSubscription(updated);
  return updated;
}

export async function recordInvoiceUsage(state: SubscriptionState): Promise<SubscriptionState> {
  const updated = { ...state, invoicesUsedThisMonth: state.invoicesUsedThisMonth + 1 };
  await saveSubscription(updated);
  return updated;
}

// ─── Upgrade / Downgrade ───────────────────────────────────────────────────

export async function upgradeTo(
  state: SubscriptionState,
  tier: SubscriptionTier,
  cycle: BillingCycle,
): Promise<SubscriptionState> {
  const updated = { ...state, tier, billingCycle: cycle, startedAt: new Date().toISOString() };
  await saveSubscription(updated);
  return updated;
}

export async function startTrial(state: SubscriptionState): Promise<SubscriptionState> {
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 14);
  state.tier = 'pro';
  state.trialEndsAt = trialEnd.toISOString();
  await saveSubscription(state);
  return state;
}

export function isTrialActive(state: SubscriptionState): boolean {
  if (!state.trialEndsAt) return false;
  return new Date(state.trialEndsAt) > new Date();
}

export function isTrialExpired(state: SubscriptionState): boolean {
  if (!state.trialEndsAt) return false;
  return new Date(state.trialEndsAt) <= new Date();
}

export function daysLeftInTrial(state: SubscriptionState): number {
  if (!state.trialEndsAt) return 0;
  const diff = new Date(state.trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

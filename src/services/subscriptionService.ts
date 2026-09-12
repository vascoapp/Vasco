// =============================================================================
// SUBSCRIPTION SERVICE — 3-tier hybrid (subscription + commission) for VascoApp
// =============================================================================
// Tiers: Free → Pro → Contractor
// Free: get started — 3.5% commission per paid invoice
// Pro: €39/mo + 2% commission — full AI, ML, benchmarking, purchasing agent
// Contractor: €69/mo + 1% commission — team features, API, white-label, support
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Country } from '../context/AuthContext';
import i18n from '../i18n/i18n';
import { DEMO_MODE } from '../config/demo';
// Static, like the other 58 services that touch the backend. It was a dynamic
// `await import()` first, which throws in jest without --experimental-vm-modules
// — and the surrounding try/catch swallowed that, so every sync silently
// returned null while the tests reported the local fallback as correct.
// `src/lib/supabase` imports only the client, env and types, so there is no
// cycle back to this file.
import { supabase } from '../lib/supabase';
import type { SubscriptionRow } from '../lib/database.types';

// ─── Tier Definitions ──────────────────────────────────────────────────────

export type SubscriptionTier = 'free' | 'pro' | 'contractor';
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

/** Length of the Pro trial. The signup subtitle says "14" in all six
 *  locales, so this constant and that copy have to move together. */
export const TRIAL_DAYS = 14;

const STORAGE_KEY = '@vasco_subscription';
const USAGE_KEY = '@vasco_usage_month';

// ─── Default state ─────────────────────────────────────────────────────────

function defaultState(): SubscriptionState {
  return {
    // Demo/dev builds default to the Pro tier so the demo showcases — and QA
    // can exercise — the full paid feature set (photo→AI→quote, EVE AI,
    // e-invoicing, benchmarking…). Real installs default to Free. Was 'free'
    // for everyone, which locked the demo account out of every Pro feature.
    tier: DEMO_MODE ? 'pro' : 'free',
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

/**
 * Drop an expired trial back to Free. Returns the SAME object when nothing
 * changed, so callers can cheaply tell whether a write is needed.
 *
 * Factored out because the rule now has two callers — the local load and the
 * server sync — and two copies of "when does a trial end" is how they drift
 * into disagreeing about whether someone is entitled to e-invoicing.
 */
function applyTrialExpiry(state: SubscriptionState): SubscriptionState {
  if (!state.trialEndsAt || !isTrialExpired(state)) return state;
  return { ...state, tier: 'free', trialEndsAt: null };
}

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
      // An expired trial has to STOP granting Pro, and this is the only place
      // every consumer already passes through — `getTierLimits(sub.tier)` is
      // called from dozens of screens and none of them should have to know
      // about trials. Wiring `startTrial` without this would have handed out
      // Pro permanently, which is a worse bug than the missing trial was.
      const expired = applyTrialExpiry(state);
      if (expired !== state) {
        await saveSubscription(expired);
        return expired;
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
  return [TIERS.free, TIERS.pro, TIERS.contractor];
}

/** Check if a tier has access to a higher tier's features */
export function tierAtLeast(current: SubscriptionTier, required: SubscriptionTier): boolean {
  const order: SubscriptionTier[] = ['free', 'pro', 'contractor'];
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
    return { allowed: false, reason: i18n.t('tierGate.jobLimitReached', { count: limits.maxActiveJobs }), upgradeFeature: 'More active jobs', requiredTier: 'pro' };
  }
  return { allowed: true };
}

export function canCreateQuote(state: SubscriptionState, liveCount?: number): GateResult {
  const limits = getTierLimits(state.tier);
  const count = liveCount ?? state.quotesUsedThisMonth;
  if (count >= limits.maxQuotesPerMonth) {
    return { allowed: false, reason: i18n.t('tierGate.quoteLimitReached', { count: limits.maxQuotesPerMonth }), upgradeFeature: 'More quotes', requiredTier: 'pro' };
  }
  return { allowed: true };
}

export function canCreateInvoice(state: SubscriptionState, liveCount?: number): GateResult {
  const limits = getTierLimits(state.tier);
  const count = liveCount ?? state.invoicesUsedThisMonth;
  if (count >= limits.maxInvoicesPerMonth) {
    return { allowed: false, reason: i18n.t('tierGate.invoiceLimitReached', { count: limits.maxInvoicesPerMonth }), upgradeFeature: 'More invoices', requiredTier: 'pro' };
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
    return { allowed: false, reason: i18n.t('tierGate.clientLimitReached', { count: limits.maxClients }), upgradeFeature: 'More clients', requiredTier: 'pro' };
  }
  return { allowed: true };
}

export function canAddTeamMember(state: SubscriptionState, liveCount?: number): GateResult {
  const limits = getTierLimits(state.tier);
  const totalSeats = limits.maxTeamSeats + state.seatsPurchased;
  const used = liveCount ?? state.seatsUsed;
  if (used >= totalSeats) {
    return { allowed: false, reason: i18n.t('tierGate.seatsInUse', { count: totalSeats }), upgradeFeature: 'More team seats', requiredTier: 'contractor' };
  }
  return { allowed: true };
}

export function canUseFeature(state: SubscriptionState, feature: keyof TierLimits): GateResult {
  const limits = getTierLimits(state.tier);
  const value = limits[feature];
  if (typeof value === 'boolean' && !value) {
    const featureInfo: Record<string, { name: string; tier: SubscriptionTier }> = {
      hasPaymentProcessing: { name: 'Payment processing', tier: 'pro' },
      hasAccountingIntegrations: { name: 'Accounting integrations', tier: 'pro' },
      hasEInvoicing: { name: 'E-invoicing', tier: 'pro' },
      hasFullEInvoicing: { name: 'All e-invoice formats', tier: 'pro' },
      hasEveAI: { name: 'EVE AI assistant', tier: 'pro' },
      hasEveAuditor: { name: 'EVE compliance monitoring', tier: 'pro' },
      hasEveAnalyst: { name: 'EVE business intelligence', tier: 'pro' },
      hasAutomationPacks: { name: 'Automation packs', tier: 'pro' },
      hasMlPredictions: { name: 'ML predictions', tier: 'pro' },
      hasBenchmarking: { name: 'Contractor benchmarking', tier: 'pro' },
      hasPriceIndex: { name: 'EU price index', tier: 'pro' },
      hasInvoiceScanning: { name: 'Invoice scanning', tier: 'pro' },
      hasPurchasingAgent: { name: 'Purchasing agent', tier: 'pro' },
      hasBulkPurchaseOptimizer: { name: 'Bulk purchase optimizer', tier: 'pro' },
      hasPriceDropAlerts: { name: 'Price drop alerts', tier: 'pro' },
      hasSupplierScoring: { name: 'Supplier reliability scoring', tier: 'pro' },
      hasPdfExport: { name: 'PDF/CSV export', tier: 'pro' },
      hasClientPortal: { name: 'Client portal', tier: 'pro' },
      hasQuoteTemplates: { name: 'Quote templates', tier: 'pro' },
      hasCustomerDecisions: { name: 'Customer decision tracker', tier: 'pro' },
      hasApiAccess: { name: 'API access', tier: 'contractor' },
      hasWhiteLabel: { name: 'White-label documents', tier: 'contractor' },
      hasSubcontractorPortal: { name: 'Subcontractor portal', tier: 'contractor' },
      hasWorkerPortal: { name: 'Worker portal', tier: 'contractor' },
      hasCalendarSync: { name: 'Calendar sync', tier: 'pro' },
      hasDedicatedSupport: { name: 'Dedicated support', tier: 'contractor' },
      hasOnboardingAssistance: { name: 'Onboarding assistance', tier: 'contractor' },
    };
    const info = featureInfo[feature];
    // Localize the feature name shown in the upgrade prompt. Pre-fix the
    // hardcoded English `info.name` (e.g. "Invoice scanning") was interpolated
    // verbatim into the localized message, so a Dutch user saw
    // "Invoice scanning vereist het pro-abonnement". tierGate.features.<key>
    // carries the name in all 6 locales; fall back to the English name.
    const localizedName = i18n.t(`tierGate.features.${String(feature)}`, { defaultValue: info?.name ?? String(feature) });
    return {
      allowed: false,
      reason: i18n.t('tierGate.featureRequiresTier', { feature: localizedName, tier: info?.tier ?? 'pro' }),
      upgradeFeature: localizedName,
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
  // Clearing `trialEndsAt` is what makes the field mean exactly one thing:
  // "this Pro access is a trial, and it ends". `loadSubscription` downgrades on
  // an expired trial, so leaving it set on a PAYING customer would drop them to
  // Free fourteen days after they subscribed. An explicit tier change — in
  // either direction — ends the trial, because the contractor has now chosen.
  const updated = {
    ...state,
    tier,
    billingCycle: cycle,
    startedAt: new Date().toISOString(),
    trialEndsAt: null,
  };
  await saveSubscription(updated);
  // A tier change is an entitlement change, so it belongs on the account too —
  // otherwise a contractor who upgrades on their phone opens the tablet and is
  // still on the old tier.
  await pushSubscription(updated);
  return updated;
}

/**
 * Start the 14-day Pro trial the signup screen promises.
 *
 * Until 2026-09-12 this function had **zero call sites**, and `trialEndsAt`,
 * `isTrialActive` and `daysLeftInTrial` had zero readers — while the signup
 * subtitle promised the trial in all six languages. Every contractor who ever
 * signed up landed on Free, where `hasAutomationPacks`, `hasEveAI` and
 * `hasEInvoicing` are all false. In Germany that is the whole pitch: they were
 * sold the e-invoice obligation and handed a build that cannot issue one.
 *
 * Returns a NEW state rather than mutating the argument — the old version
 * assigned into the caller's object, so a caller that kept the pre-call value
 * saw it change underneath them.
 */
// ─── Server sync — the entitlement lives with the ACCOUNT, not the device ───

/** Exactly the columns this service reads back. */
type SubscriptionServerRow = Pick<
  SubscriptionRow,
  'tier' | 'billing_cycle' | 'status' | 'trial_ends_at'
>;

/** Exactly the columns this service writes. */
type SubscriptionUpsert = Pick<SubscriptionRow, 'user_id' | 'trial_ends_at'> & {
  tier: SubscriptionTier;
  billing_cycle: SubscriptionRow['billing_cycle'];
  status: SubscriptionRow['status'];
};

/**
 * `public.subscriptions.tier` allows `'advanced'`, which this app's three-tier
 * model has no member for. Read it as `pro` — the nearest paid tier. Mapping it
 * to `free` would strip a paying contractor of everything they bought.
 */
function tierFromServer(tier: string): SubscriptionTier {
  if (tier === 'pro' || tier === 'contractor' || tier === 'free') return tier;
  if (tier === 'advanced') return 'pro';
  return 'free';
}

function statusForState(state: SubscriptionState): 'trialing' | 'active' {
  return state.trialEndsAt && isTrialActive(state) ? 'trialing' : 'active';
}

/**
 * Write the local entitlement up to the account.
 *
 * Best-effort by design: a contractor mid-signup on a train must not be blocked
 * because the upsert failed. The local copy stays authoritative until the next
 * successful pull.
 */
export async function pushSubscription(state: SubscriptionState): Promise<boolean> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) return false;
    // `supabase.from(...)` resolves to `never` against this project's
    // hand-maintained Database interface, so the query builder is cast — the
    // same workaround accountantSeatService and friends already use. The row
    // shape is kept honest by typing it here instead, against the declaration
    // in database.types.ts that `npm run check:drift` compares to the live
    // catalog.
    const row: SubscriptionUpsert = {
      user_id: userId,
      tier: state.tier,
      billing_cycle: state.billingCycle === 'annual' ? 'yearly' : 'monthly',
      status: statusForState(state),
      trial_ends_at: state.trialEndsAt,
    };
    const { error } = await (supabase.from('subscriptions') as any).upsert(row, {
      onConflict: 'user_id',
    });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Pull the account's entitlement and let it win over the device.
 *
 * This is what stops the 14-day trial being device-local. Before it, state
 * lived only in AsyncStorage, so **a reinstall granted a fresh trial** and the
 * trial did not follow the contractor to a second device.
 *
 * Rules:
 *  - a server row WINS for tier and trial end. It is the account's entitlement;
 *    the device's copy is a cache.
 *  - no server row means this account has never been synced, so the local state
 *    is pushed up rather than wiped — otherwise upgrading the app would reset
 *    an existing contractor to Free.
 *  - any failure (offline, RLS, cold start before session) leaves local state
 *    untouched. Never lock someone out of what they paid for because a request
 *    failed.
 */
export async function syncSubscriptionFromServer(): Promise<SubscriptionState | null> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) return null;

    const { data, error } = (await (supabase.from('subscriptions') as any)
      .select('tier, billing_cycle, status, trial_ends_at')
      .eq('user_id', userId)
      .maybeSingle()) as { data: SubscriptionServerRow | null; error: unknown };
    if (error) return null;

    const local = await loadSubscription();

    if (!data) {
      await pushSubscription(local);
      return local;
    }

    const merged = applyTrialExpiry({
      ...local,
      tier: tierFromServer(data.tier),
      billingCycle: data.billing_cycle === 'yearly' ? 'annual' : 'monthly',
      trialEndsAt: data.trial_ends_at,
    });
    await saveSubscription(merged);
    // If the pull expired the trial, tell the server too, so the next device
    // does not read a lapsed trial as live.
    if (merged.trialEndsAt !== data.trial_ends_at) await pushSubscription(merged);
    return merged;
  } catch {
    return null;
  }
}

export async function startTrial(state: SubscriptionState): Promise<SubscriptionState> {
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);
  const updated: SubscriptionState = {
    ...state,
    tier: 'pro',
    trialEndsAt: trialEnd.toISOString(),
  };
  await saveSubscription(updated);
  // Publish the grant so it belongs to the ACCOUNT. Without this the trial is
  // device-local: reinstalling would hand out a fresh fourteen days.
  await pushSubscription(updated);
  return updated;
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

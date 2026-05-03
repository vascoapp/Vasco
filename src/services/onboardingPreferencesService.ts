// =============================================================================
// ONBOARDING PREFERENCES SERVICE
// =============================================================================
// Loads and exposes the user's onboarding answers (goals, challenges, team size,
// selected plan) so the app can personalize views and feature gating.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Country, Language } from '../context/AuthContext';
import type { SubscriptionTier } from './subscriptionService';

// ─── Types ──────────────────────────────────────────────────────────────────

export type OnboardingGoal =
  | 'more_jobs'
  | 'faster_payments'
  | 'less_admin'
  | 'grow_team'
  | 'stay_compliant'
  | 'better_quotes';

export type OnboardingChallenge =
  | 'quoting'
  | 'invoicing'
  | 'scheduling'
  | 'compliance'
  | 'finding_work'
  | 'paperwork';

export type TeamSize = 'solo' | 'small' | 'medium' | 'large';

export interface OnboardingPreferences {
  country: Country | null;
  language: Language;
  trades: string[];
  goals: OnboardingGoal[];
  challenges: OnboardingChallenge[];
  teamSize: TeamSize | null;
  businessType: string | null;
  registrationFields: Record<string, string>;
  certifications: string[];
  postcode: string;
  serviceRadius: number;
  selectedPlan: SubscriptionTier;
  billingCycle: 'monthly' | 'annual';
  completedAt: string | null;
  demoMode: boolean;
}

const STORAGE_KEY = '@vasco_onboarding';
const SUBSCRIPTION_KEY = '@vasco_subscription';

const DEFAULT_PREFERENCES: OnboardingPreferences = {
  country: null,
  language: 'en',
  trades: [],
  goals: [],
  challenges: [],
  teamSize: null,
  businessType: null,
  registrationFields: {},
  certifications: [],
  postcode: '',
  serviceRadius: 25,
  selectedPlan: 'free',
  billingCycle: 'annual',
  completedAt: null,
  demoMode: false,
};

// ─── Load / Save ────────────────────────────────────────────────────────────

let _cachedPrefs: OnboardingPreferences | null = null;

export async function loadOnboardingPreferences(): Promise<OnboardingPreferences> {
  if (_cachedPrefs) return _cachedPrefs;

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;

    const parsed = JSON.parse(raw);
    const prefs: OnboardingPreferences = {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      goals: parsed.goals ?? [],
      challenges: parsed.challenges ?? [],
      teamSize: parsed.teamSize ?? null,
      selectedPlan: parsed.selectedPlan === 'gratis' ? 'free' : (parsed.selectedPlan ?? 'free'),
      billingCycle: parsed.billingCycle ?? 'annual',
    };
    _cachedPrefs = prefs;
    return prefs;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function clearPreferencesCache(): void {
  _cachedPrefs = null;
}

// ─── Derived helpers ────────────────────────────────────────────────────────

/** Is this a solo contractor (no team features needed)? */
export function isSoloContractor(prefs: OnboardingPreferences): boolean {
  return prefs.teamSize === 'solo' || prefs.teamSize === null;
}

/** Does the user want to focus on getting paid faster? */
export function wantsPaymentFocus(prefs: OnboardingPreferences): boolean {
  return prefs.goals.includes('faster_payments') || prefs.challenges.includes('invoicing');
}

/** Does the user want help with quoting? */
export function wantsQuotingHelp(prefs: OnboardingPreferences): boolean {
  return prefs.goals.includes('better_quotes') || prefs.challenges.includes('quoting');
}

/** Does the user need compliance features prominently? */
export function wantsComplianceFocus(prefs: OnboardingPreferences): boolean {
  return prefs.goals.includes('stay_compliant') || prefs.challenges.includes('compliance');
}

/** Does the user want to grow / find more work? */
export function wantsGrowthFocus(prefs: OnboardingPreferences): boolean {
  return prefs.goals.includes('more_jobs') || prefs.challenges.includes('finding_work');
}

/** Does the user want less admin? */
export function wantsAutomationFocus(prefs: OnboardingPreferences): boolean {
  return prefs.goals.includes('less_admin') || prefs.challenges.includes('paperwork');
}

/**
 * Does the user want team management features?
 * @deprecated R307: zero callers. Helper still works but no UI gates on it.
 * If multi-employee features ever ship (LAUNCH.md §6 condition), wire this
 * into the worker/team route gates.
 */
export function wantsTeamFeatures(prefs: OnboardingPreferences): boolean {
  return prefs.teamSize === 'small' || prefs.teamSize === 'medium' || prefs.teamSize === 'large';
}

// R10.2: removed `getDashboardSectionOrder`, `getPrioritizedInsightTypes`,
// and the `useOnboardingPreferences` hook (all three had zero callers).
// They were written for a multi-section Vandaag dashboard that was replaced
// by the DraftKings 2-section layout (hero + schedule). Insight prioritization
// still happens, just at the queue level in aiActionQueueService.ts which
// reads the wantsPaymentFocus / wantsQuotingHelp / wantsComplianceFocus /
// wantsAutomationFocus / wantsGrowthFocus helpers directly.

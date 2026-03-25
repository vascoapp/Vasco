// =============================================================================
// ONBOARDING TRACKER SERVICE — Track setup completion progress
// =============================================================================
// Tracks which onboarding steps a contractor has completed.
// Persisted to AsyncStorage so progress survives app restarts.
// Used by: Vandaag tab (progress indicator), VascoCard (next step suggestions).
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = '@vasco_onboarding_progress';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OnboardingStep =
  | 'profile_complete'
  | 'first_customer_added'
  | 'first_job_created'
  | 'first_quote_sent'
  | 'first_invoice_sent'
  | 'accounting_connected'
  | 'payment_connected';

export interface OnboardingProgress {
  completedSteps: OnboardingStep[];
  lastUpdated: string; // ISO date
}

export interface NextStepSuggestion {
  step: OnboardingStep;
  action: string; // English default description of what to do
  route: string;  // Expo Router path to navigate to
}

/**
 * Ordered list of onboarding steps with their suggested actions and routes.
 */
const STEP_ORDER: { step: OnboardingStep; action: string; route: string }[] = [
  {
    step: 'profile_complete',
    action: 'Complete your business profile with company details',
    route: '/contractor/profile',
  },
  {
    step: 'first_customer_added',
    action: 'Add your first customer to get started',
    route: '/contractor/customer-crm',
  },
  {
    step: 'first_job_created',
    action: 'Create your first job to track your work',
    route: '/(contractor)/werk',
  },
  {
    step: 'first_quote_sent',
    action: 'Send your first quote to win new work',
    route: '/(contractor)/geld',
  },
  {
    step: 'first_invoice_sent',
    action: 'Send your first invoice to get paid',
    route: '/(contractor)/geld',
  },
  {
    step: 'accounting_connected',
    action: 'Connect your accounting software for automatic sync',
    route: '/contractor/profile',
  },
  {
    step: 'payment_connected',
    action: 'Set up online payments to get paid faster',
    route: '/contractor/payments',
  },
];

const EMPTY_PROGRESS: OnboardingProgress = {
  completedSteps: [],
  lastUpdated: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

async function loadProgress(): Promise<OnboardingProgress> {
  try {
    const raw = await AsyncStorage.getItem(ONBOARDING_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as OnboardingProgress;
      // Validate completedSteps is an array
      if (Array.isArray(parsed.completedSteps)) {
        return parsed;
      }
    }
  } catch {
    // fall through to default
  }
  return EMPTY_PROGRESS;
}

async function saveProgress(progress: OnboardingProgress): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_KEY, JSON.stringify(progress)).catch(() => {});
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Mark a single onboarding step as complete.
 * Idempotent — marking an already-complete step is a no-op.
 */
export async function markStepComplete(step: OnboardingStep): Promise<void> {
  const progress = await loadProgress();
  if (progress.completedSteps.includes(step)) return;

  progress.completedSteps.push(step);
  progress.lastUpdated = new Date().toISOString();
  await saveProgress(progress);
}

/**
 * Get the full onboarding progress including completed steps
 * and a numeric completion percentage.
 */
export async function getProgress(): Promise<OnboardingProgress & { percentage: number }> {
  const progress = await loadProgress();
  const percentage = Math.round((progress.completedSteps.length / STEP_ORDER.length) * 100);
  return { ...progress, percentage };
}

/**
 * Get the next incomplete onboarding step with a suggested action.
 * Returns null if all steps are complete.
 */
export async function getNextStep(): Promise<NextStepSuggestion | null> {
  const progress = await loadProgress();
  const nextStep = STEP_ORDER.find((s) => !progress.completedSteps.includes(s.step));
  if (!nextStep) return null;

  return {
    step: nextStep.step,
    action: nextStep.action,
    route: nextStep.route,
  };
}

/**
 * Check if the user has completed all onboarding steps.
 */
export async function isFullyOnboarded(): Promise<boolean> {
  const progress = await loadProgress();
  return progress.completedSteps.length >= STEP_ORDER.length;
}

/**
 * Reset onboarding progress (useful for testing or account reset).
 */
export async function resetProgress(): Promise<void> {
  await saveProgress(EMPTY_PROGRESS);
}

/**
 * Get all step definitions with their completion status.
 * Useful for rendering a checklist UI.
 */
export async function getAllSteps(): Promise<
  { step: OnboardingStep; action: string; route: string; completed: boolean }[]
> {
  const progress = await loadProgress();
  return STEP_ORDER.map((s) => ({
    ...s,
    completed: progress.completedSteps.includes(s.step),
  }));
}

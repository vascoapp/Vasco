// =============================================================================
// ACTIVATION MILESTONES (R225)
// =============================================================================
// Week-1 time-to-value lever. Five concrete milestones derived from
// AppState — no new DB query. When a contractor checks off 3+, week-4
// retention climbs hard per vertical-SaaS benchmarks.
//
// The checklist auto-hides permanently once either (a) all 5 are done,
// or (b) the contractor explicitly dismisses it. Dismissal persists in
// AsyncStorage so it doesn't nag across app restarts.
// =============================================================================

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DISMISSED_KEY = '@vasco_activation_dismissed';

export type MilestoneId =
  | 'profile_complete'
  | 'first_customer'
  | 'first_quote_sent'
  | 'first_job_scheduled'
  | 'first_payment_received';

export interface Milestone {
  id: MilestoneId;
  /** i18n key under activation.* — component supplies the string. */
  labelKey: string;
  done: boolean;
  /** Route to navigate to when tapped. */
  route: string;
}

// ---------------------------------------------------------------------------
// Pure evaluator — testable without React
// ---------------------------------------------------------------------------

export interface ActivationInput {
  businessProfile: { isComplete?: boolean; businessName?: string; kvkNumber?: string; country?: string } | null | undefined;
  customers: Array<{ id: string }>;
  quotes: Array<{ id: string; status?: string }>;
  jobs: Array<{ id: string; status?: string }>;
  invoices: Array<{ id: string; status?: string }>;
}

export function evaluateMilestones(input: ActivationInput): Milestone[] {
  const profileDone = Boolean(
    input.businessProfile?.isComplete
    || (input.businessProfile?.businessName
        && input.businessProfile?.country
        && (input.businessProfile?.kvkNumber || input.businessProfile?.businessName)),
  );
  const firstCustomer = (input.customers?.length ?? 0) > 0;
  const firstQuoteSent = (input.quotes ?? []).some(
    (q) => q.status === 'sent' || q.status === 'accepted' || q.status === 'rejected' || q.status === 'expired',
  );
  const firstJobScheduled = (input.jobs ?? []).some(
    (j) => j.status && j.status !== 'lead' && j.status !== 'draft',
  );
  const firstPaymentReceived = (input.invoices ?? []).some((i) => i.status === 'paid');

  return [
    { id: 'profile_complete',       labelKey: 'activation.profile',         done: profileDone,       route: '/contractor/profile' },
    { id: 'first_customer',         labelKey: 'activation.firstCustomer',   done: firstCustomer,     route: '/contractor/customer-crm' },
    { id: 'first_quote_sent',       labelKey: 'activation.firstQuote',      done: firstQuoteSent,    route: '/contractor/tiered-quote' },
    { id: 'first_job_scheduled',    labelKey: 'activation.firstJob',        done: firstJobScheduled, route: '/(contractor)/werk' },
    { id: 'first_payment_received', labelKey: 'activation.firstPayment',    done: firstPaymentReceived, route: '/(contractor)/geld' },
  ];
}

export function completedCount(milestones: Milestone[]): number {
  return milestones.filter((m) => m.done).length;
}

export function allComplete(milestones: Milestone[]): boolean {
  return milestones.every((m) => m.done);
}

// ---------------------------------------------------------------------------
// Dismissal persistence
// ---------------------------------------------------------------------------

export async function isDismissed(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(DISMISSED_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function markDismissed(): Promise<void> {
  try {
    await AsyncStorage.setItem(DISMISSED_KEY, '1');
  } catch {
    // silent
  }
}

export async function resetDismissed(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DISMISSED_KEY);
  } catch {
    // silent
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useActivationMilestones(input: ActivationInput) {
  const milestones = evaluateMilestones(input);
  const done = completedCount(milestones);
  const total = milestones.length;
  const all = allComplete(milestones);

  const [dismissed, setDismissed] = useState<boolean>(false);
  useEffect(() => {
    let cancelled = false;
    isDismissed().then((v) => { if (!cancelled) setDismissed(v); });
    return () => { cancelled = true; };
  }, []);

  // Visible when: at least one step still open AND not explicitly dismissed.
  // Auto-hides on completion without needing an explicit dismiss.
  const visible = !dismissed && !all;

  return {
    milestones,
    completedCount: done,
    totalCount: total,
    allComplete: all,
    visible,
    dismiss: async () => {
      await markDismissed();
      setDismissed(true);
    },
  };
}

export const __internal = { DISMISSED_KEY };

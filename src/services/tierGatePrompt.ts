// =============================================================================
// ONE PLACE THAT ASKS "ARE YOU ALLOWED TO CREATE THIS?"
// =============================================================================
// The monthly caps (10 quotes, 10 invoices on Free) and the payment-link
// entitlement were enforced per screen, by hand. A sweep on 2026-09-19 counted
// the result: the quote cap was checked on 1 of 2 entry points, the invoice cap
// on 1 of 8, and the payment-link gate on 1 of 4 — and in each pair the gated
// one was the secondary route. The DEFAULT "new quote" button
// (`contractor/tiered-quote`) and both job-screen invoice buttons had no gate
// at all, so Free was effectively unlimited for anyone who used the obvious
// path.
//
// Worse, `state.quotesUsedThisMonth` / `invoicesUsedThisMonth` have never been
// incremented — `recordQuoteUsage` / `recordInvoiceUsage` have zero callers —
// so the two screens that DID gate had to count AppState themselves, and that
// count read `createdAt`, which none of the create-mutators set on the
// optimistic object. The number was 0 for everything made in this session, and
// permanently 0 on an install with no backend. Both "gated" routes let
// everything through.
//
// So: one helper, one count, used everywhere. A cap enforced in one of eight
// places is not a cap, and eight copies of the counting rule is how the rule
// drifts.
import { Alert } from 'react-native';
import { router } from 'expo-router';
import i18n from '../i18n/i18n';
import {
  loadSubscription, canCreateQuote, canCreateInvoice, canUseFeature,
  type GateResult,
} from './subscriptionService';

/** Anything with a creation timestamp — quotes and invoices both qualify. */
export interface CreatedLike { createdAt?: string | null }

/** How many of `rows` were created in the current calendar month. */
export function createdThisMonth(rows: readonly CreatedLike[] | null | undefined, now: Date = new Date()): number {
  if (!rows?.length) return 0;
  const monthStart = new Date(now);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  return rows.filter((r) => {
    if (!r?.createdAt) return false;
    const created = new Date(r.createdAt);
    return !Number.isNaN(created.getTime()) && created >= monthStart;
  }).length;
}

function promptUpgrade(gate: GateResult): void {
  if (gate.allowed) return;
  Alert.alert(
    i18n.t('billing.upgradeRequired', 'Upgrade required'),
    gate.reason,
    [
      { text: i18n.t('common.cancel', 'Cancel'), style: 'cancel' },
      { text: i18n.t('billing.viewPlans', 'View plans'), onPress: () => router.push('/contractor/profile' as never) },
    ],
  );
}

/**
 * True when the contractor may create one more of `kind`. Shows the upgrade
 * prompt itself when the answer is no, so a caller is three lines:
 *
 *   if (!(await ensureCanCreate('invoice', invoices))) return;
 *
 * Fails OPEN on an unexpected error — a broken gate must never stop someone
 * from invoicing their own work. It does NOT fail open on a refusal.
 */
export async function ensureCanCreate(
  kind: 'quote' | 'invoice',
  rows: readonly CreatedLike[] | null | undefined,
): Promise<boolean> {
  try {
    const sub = await loadSubscription();
    const used = createdThisMonth(rows);
    const gate = kind === 'quote' ? canCreateQuote(sub, used) : canCreateInvoice(sub, used);
    if (gate.allowed) return true;
    promptUpgrade(gate);
    return false;
  } catch {
    return true;
  }
}

/** Same contract for the payment-link entitlement (`hasPaymentProcessing`). */
export async function ensureCanUsePaymentLink(): Promise<boolean> {
  try {
    const sub = await loadSubscription();
    const gate = canUseFeature(sub, 'hasPaymentProcessing');
    if (gate.allowed) return true;
    promptUpgrade(gate);
    return false;
  } catch {
    return true;
  }
}

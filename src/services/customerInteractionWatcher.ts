// =============================================================================
// CUSTOMER INTERACTION WATCHER — realtime subscriber for portal events
// =============================================================================
// Listens to INSERTs on customer_interactions scoped to the current user's
// quotes. Fires a local notification when a customer accepts a quote, makes
// a decision, or requests a change — the contractor sees it in seconds.
// =============================================================================

import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { sendInstantNotification, isInQuietHours } from './pushNotificationService';
import i18n from '../i18n/i18n';

type Unsubscribe = () => void;
let active: ReturnType<typeof supabase.channel> | null = null;

interface InteractionRow {
  id: string;
  quote_id: string;
  customer_id: string | null;
  type: 'view' | 'tier_select' | 'accept' | 'reject' | 'change_request' | 'decision';
  data: Record<string, unknown>;
  created_at: string;
}

export function watchCustomerInteractions(
  userId: string,
  userQuoteIds: string[],
  onEvent?: (row: InteractionRow) => void,
): Unsubscribe {
  if (!isSupabaseConfigured || userQuoteIds.length === 0) return () => {};
  stopWatching();

  // Filter by quote_id IN (...) so cross-tenant events don't arrive. We also
  // intentionally only subscribe to INSERT — updates/deletes are rare.
  active = supabase
    .channel(`customer-interactions-${userId}`)
    .on(
      'postgres_changes' as any,
      { event: 'INSERT', schema: 'public', table: 'customer_interactions' },
      (payload: any) => {
        const row = payload.new as InteractionRow;
        if (!row || !userQuoteIds.includes(row.quote_id)) return;
        try {
          surface(row);
          onEvent?.(row);
        } catch {}
      },
    )
    .subscribe();

  return stopWatching;
}

function surface(row: InteractionRow): void {
  if (row.type === 'view') return; // Don't buzz on every open
  // R66r60: respect quiet hours. Pre-r60 customer-interaction watcher pushed
  // through DND/sleep windows because it skipped the shouldDeliver() gate
  // that aiQueueNotifier honors. Customer event still lands in the
  // notifications inbox (write-only, separate from delivery), the push
  // itself just stays silent until quiet hours end.
  if (isInQuietHours()) return;
  // R66 round 2: localized via i18n. Was hardcoded English, leaving a Dutch
  // contractor with English push lines on the 5 most critical customer events.
  const titleKey: Record<string, string> = {
    accept: 'notifications.push.quoteAcceptedTitle',
    reject: 'notifications.push.quoteRejectedTitle',
    change_request: 'notifications.push.changeRequestTitle',
    decision: 'notifications.push.decisionTitle',
    tier_select: 'notifications.push.tierSelectTitle',
  };
  const title = i18n.t(titleKey[row.type] ?? 'notifications.push.genericTitle');
  const body = summarize(row);
  sendInstantNotification(title, body, {
    type: 'customer_interaction',
    quoteId: row.quote_id,
    interactionType: row.type,
  }).catch(() => {});
}

function summarize(row: InteractionRow): string {
  const data = row.data ?? {};
  const ref = row.quote_id;
  switch (row.type) {
    case 'accept': {
      const tierId = (data as any).tierId ?? '';
      const total = (data as any).tierTotal;
      return i18n.t('notifications.push.quoteAcceptedBody', {
        ref,
        tier: tierId ? ` (${tierId})` : '',
        total: total ? ` — €${total}` : '',
      });
    }
    case 'change_request':
      return typeof (data as any).message === 'string'
        ? String((data as any).message).slice(0, 120)
        : i18n.t('notifications.push.changeRequestFallback', { ref });
    case 'decision':
      return i18n.t('notifications.push.decisionBody', {
        question: (data as any).question ?? i18n.t('notifications.push.unknownDecision'),
        value: (data as any).value ?? i18n.t('notifications.push.unknownValue'),
      });
    case 'tier_select':
      return i18n.t('notifications.push.tierSelectBody', {
        tier: (data as any).tierId ?? i18n.t('notifications.push.unknownTier'),
      });
    case 'reject':
      return i18n.t('notifications.push.quoteRejectedBody', { ref });
    default:
      return i18n.t('notifications.push.genericBody', { ref });
  }
}

export function stopWatching(): void {
  if (active) {
    try { supabase.removeChannel(active); } catch {}
    active = null;
  }
}

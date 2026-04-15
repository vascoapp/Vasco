// =============================================================================
// CUSTOMER INTERACTION WATCHER — realtime subscriber for portal events
// =============================================================================
// Listens to INSERTs on customer_interactions scoped to the current user's
// quotes. Fires a local notification when a customer accepts a quote, makes
// a decision, or requests a change — the contractor sees it in seconds.
// =============================================================================

import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { sendInstantNotification } from './pushNotificationService';

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
  const titles: Record<string, string> = {
    accept: 'Quote accepted',
    reject: 'Quote rejected',
    change_request: 'Customer requested changes',
    decision: 'Customer made a decision',
    tier_select: 'Customer selected a tier',
  };
  const title = titles[row.type] ?? 'Customer update';
  const body = summarize(row);
  sendInstantNotification(title, body, {
    type: 'customer_interaction',
    quoteId: row.quote_id,
    interactionType: row.type,
  }).catch(() => {});
}

function summarize(row: InteractionRow): string {
  const data = row.data ?? {};
  switch (row.type) {
    case 'accept': {
      const tier = (data as any).tierId ?? '';
      const total = (data as any).tierTotal;
      return `Quote ${row.quote_id} accepted${tier ? ` (${tier})` : ''}${total ? ` — €${total}` : ''}`;
    }
    case 'change_request':
      return typeof (data as any).message === 'string'
        ? String((data as any).message).slice(0, 120)
        : `Customer asked to revise ${row.quote_id}`;
    case 'decision':
      return `${(data as any).question ?? 'Decision'}: ${(data as any).value ?? '—'}`;
    case 'tier_select':
      return `Considering ${(data as any).tierId ?? 'a tier'}`;
    case 'reject':
      return `Quote ${row.quote_id} declined`;
    default:
      return `Event on quote ${row.quote_id}`;
  }
}

export function stopWatching(): void {
  if (active) {
    try { supabase.removeChannel(active); } catch {}
    active = null;
  }
}

// =============================================================================
// REALTIME WATCHERS — invoices (payments), jobs, quotes, customers
// =============================================================================
// Subscribes to Supabase realtime changes so the app is instantly consistent
// across devices and when webhooks flip invoice status to `paid`. Fires a
// local push for payment events.
// =============================================================================

import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { sendInstantNotification } from './pushNotificationService';

type Unsubscribe = () => void;

export interface InvoicePaidEvent {
  invoiceId: string;
  amount: number | null;
  paymentId: string | null;
  paymentProvider: 'mollie' | 'stripe' | null;
  paidAt: string | null;
}

let activeChannel: ReturnType<typeof supabase.channel> | null = null;

/**
 * Start watching for invoice.paid transitions for the current user.
 * Returns an unsubscribe function. Safe to call multiple times — the previous
 * subscription is torn down first.
 */
export function watchInvoicePayments(
  userId: string,
  onPaid?: (event: InvoicePaidEvent) => void,
): Unsubscribe {
  if (!isSupabaseConfigured) return () => {};
  stopWatching();

  activeChannel = supabase
    .channel(`invoice-payments-${userId}`)
    .on(
      'postgres_changes' as any,
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'invoices',
        filter: `user_id=eq.${userId}`,
      },
      (payload: any) => {
        try {
          const next = payload.new;
          const prev = payload.old;
          if (!next || next.status !== 'paid' || prev?.status === 'paid') return;

          const event: InvoicePaidEvent = {
            invoiceId: next.id,
            amount: typeof next.total === 'number' ? next.total : null,
            paymentId: next.payment_id ?? null,
            paymentProvider: next.payment_provider ?? null,
            paidAt: next.paid_at ?? null,
          };

          // Fire a local push (user sees it on lock screen)
          const title = 'Payment received';
          const amountDisplay = event.amount != null ? ` (€${event.amount.toFixed(2)})` : '';
          const body = `Invoice ${next.reference ?? next.id}${amountDisplay} marked as paid.`;
          sendInstantNotification(title, body, { type: 'invoice_paid', invoiceId: event.invoiceId }).catch(() => {});

          onPaid?.(event);
        } catch {
          // Never let a listener error take down the app
        }
      },
    )
    .subscribe();

  return stopWatching;
}

export function stopWatching(): void {
  if (activeChannel) {
    try { supabase.removeChannel(activeChannel); } catch {}
    activeChannel = null;
  }
}

// ---------------------------------------------------------------------------
// Multi-table realtime sync for jobs/quotes/customers
// ---------------------------------------------------------------------------

type SyncEvent = { table: string; eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: any; old: any };
let syncChannel: ReturnType<typeof supabase.channel> | null = null;

export function watchUserTables(
  userId: string,
  onChange: (event: SyncEvent) => void,
): Unsubscribe {
  if (!isSupabaseConfigured) return () => {};
  stopTableSync();

  const tables = ['jobs', 'quotes', 'customers', 'documents'];
  let ch = supabase.channel(`user-tables-${userId}`);
  for (const table of tables) {
    ch = ch.on(
      'postgres_changes' as any,
      { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` },
      (payload: any) => {
        try {
          onChange({
            table,
            eventType: payload.eventType as SyncEvent['eventType'],
            new: payload.new,
            old: payload.old,
          });
        } catch {}
      },
    );
  }
  syncChannel = ch.subscribe();
  return stopTableSync;
}

export function stopTableSync(): void {
  if (syncChannel) {
    try { supabase.removeChannel(syncChannel); } catch {}
    syncChannel = null;
  }
}

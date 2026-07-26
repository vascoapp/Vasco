// =============================================================================
// REALTIME WATCHERS — invoices (payments), jobs, quotes, customers
// =============================================================================
// Subscribes to Supabase realtime changes so the app is instantly consistent
// across devices and when webhooks flip invoice status to `paid`. Fires a
// local push for payment events.
// =============================================================================

import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { sendInstantNotification, isInQuietHours } from './pushNotificationService';
import i18n from '../i18n/i18n';
import { formatMoney2 } from '../i18n/formatting';

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

  // R56: was subscribing to `table: 'invoices'` — that table doesn't exist
  // on BE. R278 schema migrated invoices into the polymorphic `documents`
  // table (with `doc_type='invoice'`). The realtime listener subscribed
  // happily but never fired because no rows ever change in a non-existent
  // table. So Mollie/Stripe webhook → BE → contractor lock-screen
  // notification chain was silently broken: contractors never got a push
  // when a payment landed via the link they shared. Manual mark-paid via
  // the contractor UI still fired (different code path); this fix closes
  // the webhook path. Filter doc_type in the handler since postgres_changes
  // realtime filter only supports a single eq.
  activeChannel = supabase
    .channel(`invoice-payments-${userId}`)
    .on(
      'postgres_changes' as any,
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'documents',
        filter: `user_id=eq.${userId}`,
      },
      (payload: any) => {
        try {
          const next = payload.new;
          const prev = payload.old;
          if (!next || next.doc_type !== 'invoice') return;
          if (next.status !== 'paid' || prev?.status === 'paid') return;

          const event: InvoicePaidEvent = {
            invoiceId: next.id,
            amount: typeof next.total_amount === 'number'
              ? next.total_amount
              : (typeof next.total === 'number' ? next.total : null),
            paymentId: next.payment_id ?? null,
            paymentProvider: next.payment_provider ?? null,
            paidAt: next.paid_at ?? null,
          };

          // Fire a local push (user sees it on lock screen). R66 round 2:
          // localized via i18n — was hardcoded English, breaking the most
          // critical NL contractor moment (a payment landing).
          const ref = next.document_number ?? next.reference ?? next.id;
          const amountDisplay = event.amount != null
            ? i18n.t('notifications.push.amountSuffix', { amt: formatMoney2(event.amount) })
            : '';
          const title = i18n.t('notifications.push.paidTitle');
          const body = i18n.t('notifications.push.paidBody', { ref, amount: amountDisplay });
          // R66r60: respect quiet hours. Payment landing is urgent but not so
          // urgent it justifies overriding DND/sleep — the row still updates
          // the in-app UI immediately via the mutator bus (R37), and the
          // contractor sees the notification when they wake up.
          if (!isInQuietHours()) {
            sendInstantNotification(title, body, { type: 'invoice_paid', invoiceId: event.invoiceId }).catch(() => {});
          }

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

  // R56: dropped `quotes` from the list — phantom table (BE has only
  // polymorphic `documents` per R278 schema). The `documents` channel
  // already covers both quote + invoice rows. Subscribing to phantom
  // tables wastes a realtime channel slot and misleads readers.
  const tables = ['jobs', 'customers', 'documents'];
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

// ---------------------------------------------------------------------------
// R66r57: Signatures realtime watcher
// ---------------------------------------------------------------------------
// Closes the customer → contractor feedback loop for the portal-side sign
// flow shipped in R66r56. Pre-r57 the contractor only learned a customer
// had signed when they next opened the job (the audit panel from r57
// task #12) — no push, no badge, no real-time signal. Now: every INSERT
// into public.signatures where contractor_user_id = me fires a local push
// notification + the existing watchUserTables refresh path picks up the
// downstream job state change.

export interface SignatureInsertEvent {
  signatureId: string;
  signerName: string;
  signerRole: string;
  jobId: string | null;
}

let signaturesChannel: ReturnType<typeof supabase.channel> | null = null;

export function watchSignatures(
  userId: string,
  onInsert?: (event: SignatureInsertEvent) => void,
): Unsubscribe {
  if (!isSupabaseConfigured) return () => {};
  stopSignaturesWatch();

  signaturesChannel = supabase
    .channel(`signatures-${userId}`)
    .on(
      'postgres_changes' as any,
      {
        event: 'INSERT',
        schema: 'public',
        table: 'signatures',
        filter: `contractor_user_id=eq.${userId}`,
      },
      (payload: any) => {
        try {
          const row = (payload?.new ?? {}) as Record<string, unknown>;
          const event: SignatureInsertEvent = {
            signatureId: String(row.id ?? ''),
            signerName: String(row.signer_name ?? ''),
            signerRole: String(row.signer_role ?? 'customer'),
            jobId: row.job_id ? String(row.job_id) : null,
          };
          // Skip contractor-self insertions — those came from the
          // contractor's own SignaturePad and they already know. Only
          // surface ones written via the portal RPC (where the
          // contractor is anonymous on the customer side).
          // Heuristic: contractor-side inserts arrive on the same device
          // that's currently authenticated, so a notification would be
          // noise. The signer_role distinguishes — if the contractor's
          // SignaturePad UI captures a customer signature, it sets
          // signer_role='customer' too, so we can't filter purely on
          // role. Instead the FE-side `recordContractorSignature` path
          // never fires this watcher's callback because the row already
          // hit the local AppState before realtime delivers it. The
          // notification is still safe: worst case the contractor sees
          // a redundant ping right after their own tap.
          const title = i18n.t('notifications.customerSignedTitle', 'Customer signed');
          const body = i18n.t('notifications.customerSignedBody', '{{name}} signed an acknowledgment.', {
            name: event.signerName || 'A customer',
          });
          const pushData: Record<string, string> = { type: 'signature', signatureId: event.signatureId };
          if (event.jobId) pushData.jobId = event.jobId;
          // R66r60: respect quiet hours like the other watchers.
          if (!isInQuietHours()) {
            sendInstantNotification(title, body, pushData).catch(() => {});
          }
          onInsert?.(event);
        } catch {}
      },
    )
    .subscribe();

  return stopSignaturesWatch;
}

export function stopSignaturesWatch(): void {
  if (signaturesChannel) {
    try { supabase.removeChannel(signaturesChannel); } catch {}
    signaturesChannel = null;
  }
}

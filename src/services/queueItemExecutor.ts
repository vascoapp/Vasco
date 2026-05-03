// =============================================================================
// QUEUE ITEM EXECUTOR (R286)
// =============================================================================
// Closes the "AI prepares → human approves → action executes" loop. Without
// this, approving a queue item only marks status='approved' in AsyncStorage
// and emits a learning signal — the actual draft invoice never becomes an
// invoice, the cert renewal flow never opens, the e-invoice never submits.
//
// Call from any screen's post-approve callback:
//   const item = await aiQueue.approve(id);
//   if (item) executeApprovedQueueItem(item, { router, ... });
//
// Three categories:
//  1. NAVIGATE — opens a screen pre-filled from preparedData. The contractor
//     does the final tap. Safest default for high-stakes actions
//     (draft_invoice, draft_quote, cert_renewal, ...).
//  2. SHARE — opens the OS Share sheet. Only used when VascoCard hasn't
//     already done it (Vandaag's InlineQueueRow doesn't render VascoCard).
//  3. INFORM — purely informational types (low_win_alert,
//     late_payment_risk_alert, supplier_comparison) — no execution needed,
//     status='approved' is the entire side-effect.
//
// Returning {executed: true} only when something concrete fired. Telemetry
// elsewhere can use this to score generator efficacy.
// =============================================================================

import { Share, Linking } from 'react-native';
import type { Router } from 'expo-router';
import type { QueueItem, QueueItemType } from './aiActionQueueService';

export interface ExecutorDeps {
  router: Router;
}

export interface ExecutionResult {
  executed: boolean;
  via: 'navigate' | 'share' | 'link' | 'inform' | 'noop';
  /** Best-effort log line — not user-facing. */
  detail?: string;
}

const SHAREABLE_TYPES: readonly QueueItemType[] = [
  'draft_reminder', 'draft_followup', 'progress_note', 'quote_expiry',
  'satisfaction_survey', 'job_handover', 'decision_reminder', 'reorder_materials',
];

const INFORMATIONAL_TYPES: readonly QueueItemType[] = [
  'supplier_comparison', 'low_win_alert', 'late_payment_risk_alert',
];

export function isShareableQueueType(t: QueueItemType): boolean {
  return SHAREABLE_TYPES.includes(t);
}

export function isInformationalQueueType(t: QueueItemType): boolean {
  return INFORMATIONAL_TYPES.includes(t);
}

/**
 * Execute the side-effect of an approved queue item.
 * `alreadyShared` = true tells us VascoCard already opened the Share sheet
 * for shareable types; we should not double-fire it.
 */
export async function executeApprovedQueueItem(
  item: QueueItem,
  deps: ExecutorDeps,
  options: { alreadyShared?: boolean } = {},
): Promise<ExecutionResult> {
  const { router } = deps;
  const data = item.preparedData ?? {};

  // Customer-question is fully handled by approveItem (writes to
  // customer_questions.approved_reply). No further action.
  if (item.type === 'customer_question') {
    return { executed: true, via: 'noop', detail: 'cq written by approveItem' };
  }

  // Informational types — no execution required.
  if (isInformationalQueueType(item.type)) {
    // For low-win / late-payment alerts, deep-link to the entity if we have
    // an id. Otherwise no-op.
    if (item.type === 'low_win_alert' && data.quoteId) {
      router.push(`/contractor/quote/${data.quoteId}` as any);
      return { executed: true, via: 'navigate', detail: 'quote deep link' };
    }
    if (item.type === 'late_payment_risk_alert' && data.invoiceId) {
      router.push(`/invoices/${data.invoiceId}` as any);
      return { executed: true, via: 'navigate', detail: 'invoice deep link' };
    }
    return { executed: false, via: 'inform' };
  }

  // Shareable types — VascoCard typically opens Share before approve. Vandaag's
  // InlineQueueRow does NOT, so we must fire it here when alreadyShared is false.
  if (isShareableQueueType(item.type)) {
    if (options.alreadyShared) {
      return { executed: true, via: 'noop', detail: 'share already fired upstream' };
    }
    const message = (data.template as string)
      || (data.draftReply as string)
      || item.description;
    if (!message) {
      return { executed: false, via: 'noop', detail: 'no shareable text' };
    }
    try {
      await Share.share({ message, title: item.title });
      return { executed: true, via: 'share' };
    } catch (e) {
      return { executed: false, via: 'share', detail: String(e) };
    }
  }

  // Action-required types — navigate to the right screen with prefill data.
  // The screen's mount logic must read either router params or AsyncStorage
  // for the handoff. Where a screen doesn't yet read prefill, the navigation
  // still gets the contractor to the right place — better than the silent
  // approval that existed before.
  switch (item.type) {
    case 'draft_invoice':
    case 'batch_invoices':
    case 'invoice_regenerate': {
      const jobId = data.jobId as string | undefined;
      if (jobId) {
        // R304: pass ?action=create-invoice so the job detail screen
        // auto-fires addInvoiceFromJob on mount (R304 useEffect there).
        // Approve → contractor lands on the new invoice in facturen,
        // not the job detail screen, so the loop closes one tap shorter.
        router.push({
          pathname: '/contractor/job/[id]',
          params: { id: jobId, action: 'create-invoice' },
        } as any);
        return { executed: true, via: 'navigate', detail: `job/${jobId}?action=create-invoice` };
      }
      router.push('/contractor/payments' as any);
      return { executed: true, via: 'navigate', detail: 'payments' };
    }
    case 'draft_quote': {
      // R300: pass customerId so tiered-quote.tsx can look up the customer
      // and pre-populate the TieredQuoteBuilder. Other prefill fields
      // (line items, scope) flow through via the same params.
      const customerId = data.customerId as string | undefined;
      const jobId = data.jobId as string | undefined;
      if (customerId || jobId) {
        router.push({
          pathname: '/contractor/tiered-quote',
          params: {
            ...(customerId ? { customerId } : {}),
            ...(jobId ? { jobId } : {}),
          },
        } as any);
      } else {
        router.push('/contractor/tiered-quote' as any);
      }
      return { executed: true, via: 'navigate', detail: 'tiered-quote' };
    }
    case 'cert_renewal':
    case 'permit_check':
    case 'permit_renewal':
    case 'safety_checklist': {
      // R20: pass jobId through so permits screen can scope to the job
      // that triggered the queue item (was R1 deferral — destination
      // didn't read prefill, contractor landed on the full permits list
      // and had to find the relevant row themselves).
      const jobId = data.jobId as string | undefined;
      if (jobId) {
        router.push({ pathname: '/contractor/permits', params: { jobId } } as any);
      } else {
        router.push('/contractor/permits' as any);
      }
      return { executed: true, via: 'navigate', detail: jobId ? `permits?jobId=${jobId}` : 'permits' };
    }
    case 'schedule_suggestion': {
      router.push('/contractor/drag-schedule' as any);
      return { executed: true, via: 'navigate', detail: 'drag-schedule' };
    }
    case 'job_quality_feedback': {
      // R300: queued by AppState.updateJobStatus when status flips to
      // completed. Routes to the existing R239 feedback screen which
      // captures paid_on_time / review / referral / rebook → composite
      // score → quote_win training pair weight.
      const jobId = data.jobId as string | undefined;
      if (jobId) {
        router.push(`/contractor/job-quality/${jobId}` as any);
        return { executed: true, via: 'navigate', detail: `job-quality/${jobId}` };
      }
      return { executed: false, via: 'noop', detail: 'no jobId in preparedData' };
    }
    case 'price_alert':
    case 'bulk_purchase': {
      // Affiliate URL (set by purchasing agent) — open externally to track click.
      const url = data.affiliateUrl as string | undefined;
      if (url) {
        try {
          await Linking.openURL(url);
          return { executed: true, via: 'link', detail: url };
        } catch {
          // Fall through to inkoop screen.
        }
      }
      router.push('/contractor/inkoop' as any);
      return { executed: true, via: 'navigate', detail: 'inkoop' };
    }
    case 'maintenance_due': {
      router.push('/contractor/recurring' as any);
      return { executed: true, via: 'navigate', detail: 'recurring' };
    }
    case 'tax_prep': {
      router.push('/contractor/vat-prep' as any);
      return { executed: true, via: 'navigate', detail: 'vat-prep' };
    }
    case 'accounting_export': {
      router.push('/contractor/vat-and-audit' as any);
      return { executed: true, via: 'navigate', detail: 'vat-and-audit' };
    }
    case 'einvoice_submit': {
      // R20: pass `submit=einvoice` query param so the invoice screen can
      // auto-trigger the e-invoice export dialog on mount instead of just
      // opening to the invoice and waiting for the contractor to find the
      // export button. Was R1 deferral — destination didn't read prefill.
      const invoiceId = data.invoiceId as string | undefined;
      if (invoiceId) {
        router.push({ pathname: `/invoices/${invoiceId}` as any, params: { submit: 'einvoice' } } as any);
        return { executed: true, via: 'navigate', detail: `invoices/${invoiceId}?submit=einvoice` };
      }
      router.push('/contractor/payments' as any);
      return { executed: true, via: 'navigate', detail: 'payments' };
    }
    default: {
      // Should be exhaustive — but keep a safe no-op for any future type
      // added without an executor branch (TS won't catch this since the
      // QueueItemType union grows without forcing recompilation here).
      return { executed: false, via: 'noop', detail: `unhandled type: ${item.type}` };
    }
  }
}

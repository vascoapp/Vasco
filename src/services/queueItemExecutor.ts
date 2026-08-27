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
//     late_payment_risk_alert) when their producer supplied no id to deep-link
//     to; status='approved' is then the entire side-effect. NOT
//     supplier_comparison — its buttons name a screen, so it navigates.
//
// Returning {executed: true} only when something concrete fired. Telemetry
// elsewhere can use this to score generator efficacy.
// =============================================================================

import { Share, Linking } from 'react-native';
import type { Router } from 'expo-router';
import type { QueueItem, QueueItemType } from './aiActionQueueService';
import { wasShareDismissed } from '../utils/shareOutcome';

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

// `supplier_comparison` was here and should never have been. Its two producers
// label the button "Compare" and "View savings" — both promise a destination —
// while this list routed it to {executed:false, via:'inform'}, so the contractor
// tapped a button that named a screen and nothing happened. The other two DO
// deep-link whenever their producer supplies an id, which lateRiskAlertGenerator
// and lowWinAlertGenerator always do.
const INFORMATIONAL_TYPES: readonly QueueItemType[] = [
  'low_win_alert', 'late_payment_risk_alert',
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
  const result = await runExecution(item, deps, options);
  // Tell the action ledger what actually fired. approveItem has already
  // recorded the approval; this is what makes it COUNTABLE — an approval whose
  // execution never reported back is deliberately not counted as work done.
  try {
    const { attachExecution } = await import('./actionLedgerService');
    await attachExecution(item.id, { executed: result.executed, via: result.via });
  } catch { /* never let bookkeeping break the action the contractor asked for */ }
  return result;
}

async function runExecution(
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
    // R39: schedule a "Did the customer respond?" follow-up push 4 days
    // later. Tap → opens AI tab where contractor confirms Yes/No →
    // recordOutcome fires. Was the EVE-gap-1 deferral: VascoCard's
    // followup alert only mounted on enterprise SiteLeadDashboard so
    // contractors never got the high-quality positive/negative outcome
    // signal. Fire-and-forget — the push registration may fail silently
    // (e.g. no push permission), the share itself still proceeds.
    try {
      const customerName = (data.customerName as string)
        || (item.title.match(/:\s*(.+)$/)?.[1] ?? '');
      const { scheduleOutcomeFollowup } = await import('./pushNotificationService');
      scheduleOutcomeFollowup({
        itemId: item.id,
        itemType: item.type,
        customerName,
        daysAfter: 4,
      }).catch(() => {});
    } catch {}
    if (options.alreadyShared) {
      return { executed: true, via: 'noop', detail: 'share already fired upstream' };
    }
    // R66r49 #6: WhatsApp deep-link preferred when affiliateUrl is a wa.me URL.
    // workflowPackService attaches `affiliateUrl: https://wa.me/{e164}?text=...`
    // when customer phone is resolvable. 1-tap into WA Business chat with the
    // text pre-filled — vs. 3 taps through the iOS share sheet.
    const waUrl = data.affiliateUrl as string | undefined;
    if (waUrl && waUrl.startsWith('https://wa.me/')) {
      try {
        await Linking.openURL(waUrl);
        return { executed: true, via: 'link', detail: 'wa.me' };
      } catch {
        // Fall through to Share if WA isn't installed.
      }
    }
    const message = (data.template as string)
      || (data.draftReply as string)
      || item.description;
    if (!message) {
      return { executed: false, via: 'noop', detail: 'no shareable text' };
    }
    try {
      // `Share.share` RESOLVES with `dismissedAction` — it does not throw — so
      // `executed: true` used to be returned for a sheet the contractor backed
      // out of. The caller marks the queue item DONE on that, which is how a
      // payment chase disappears from the queue without ever being sent.
      //
      // This is the same defect that was fixed in `actionExecutor` (R71,
      // ai.tsx, bedrijf) and never carried across to its twin here.
      const res = await Share.share({ message, title: item.title });
      if (wasShareDismissed(res)) {
        return { executed: false, via: 'share', detail: 'dismissed' };
      }
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
    case 'permit_renewal': {
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
    case 'safety_checklist': {
      // R23: route safety_checklist to the job detail (per-job context)
      // instead of the permits list. Was R1 deferral — the job-scoped
      // safety checklist lives at /contractor/job/{id} (the closeout +
      // safety blocks are sections of the job detail screen). Falls
      // through to permits if no jobId in preparedData.
      const jobId = data.jobId as string | undefined;
      if (jobId) {
        router.push({ pathname: '/contractor/job/[id]', params: { id: jobId, focus: 'safety' } } as any);
        return { executed: true, via: 'navigate', detail: `job/${jobId}?focus=safety` };
      }
      router.push('/contractor/permits' as any);
      return { executed: true, via: 'navigate', detail: 'permits' };
    }
    case 'schedule_suggestion': {
      // R21: pass jobId from preparedData so the schedule board can highlight the
      // suggested unassigned job (ring + scroll into view) instead of just
      // dropping the contractor on the board with no orientation. Was R1
      // deferral. Date axis stays today-only — multi-day support is a
      // bigger lift than this round.
      const jobId = data.jobId as string | undefined;
      if (jobId) {
        router.push({ pathname: '/contractor/schedule', params: { jobId } } as any);
        return { executed: true, via: 'navigate', detail: `schedule?jobId=${jobId}` };
      }
      router.push('/contractor/schedule' as any);
      return { executed: true, via: 'navigate', detail: 'schedule' };
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
    case 'supplier_comparison': {
      // Two shapes: a single material found cheaper elsewhere ("Compare"), and
      // the monthly overpaying-items roll-up ("View savings"). market-prices
      // does not read a material param today, so the per-material card lands on
      // the comparison screen unscoped — still the screen its button names,
      // which is the standing bar here for a destination that lacks prefill.
      if (data.overpayingItems || data.totalMonthlySavings) {
        router.push('/(contractor)/besparen' as any);
        return { executed: true, via: 'navigate', detail: 'besparen' };
      }
      router.push('/contractor/market-prices' as any);
      return { executed: true, via: 'navigate', detail: 'market-prices' };
    }
    case 'tax_prep': {
      // R21: pass `period=previous` — the queue fires in the last 11 days
      // of each quarter end month with the just-ending quarter in mind.
      // vat-prep already defaults to 'previous'; the explicit param means
      // a contractor who toggled to 'current' previously gets re-pinned to
      // 'previous' on this entry. Was R1 deferral.
      router.push({ pathname: '/contractor/vat-prep', params: { period: 'previous' } } as any);
      return { executed: true, via: 'navigate', detail: 'vat-prep?period=previous' };
    }
    case 'accounting_export': {
      // Was building `format`/`period` params here "ready when the upstream
      // generator ships them". Nothing has ever sent them, and
      // vat-and-audit.tsx reads no params at all — so the branch was
      // scaffolding on both ends, and its presence implied a prefill that
      // does not exist. Wire the producer AND the reader together if this is
      // ever wanted; a passed param no screen consumes is not half-done, it
      // is undone (learnings #83 / the 5-file rule, same shape).
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

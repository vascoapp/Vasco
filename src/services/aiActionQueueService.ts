// =============================================================================
// AI ACTION QUEUE — EVE-inspired proactive work preparation
// =============================================================================
// AI prepares work items proactively. Contractor reviews and approves.
// Pattern: AI does the thinking → queues result → human approves → action executes
// =============================================================================

import { formatMoney, formatMoney2, formatDateShortAuto } from '../i18n/formatting';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback, useRef } from 'react';
import { getCurrentUserId } from '../lib/currentUser';
import i18n from '../i18n/i18n';
import { applySavedLanguage } from '../i18n/savedLanguage';
import { getScanHistory, getFirstScanInsights } from './invoiceScanService';
import { getTradeBaselines } from './cohortBenchmarkService';
import { getCustomerIntelligence } from '../intelligence/tradeContext';
import { MS_PER_DAY } from '../utils/timeConstants';
import { logWarn } from '../utils/errorHandler';
import { loadOnboardingPreferences, type OnboardingPreferences, wantsPaymentFocus, wantsQuotingHelp, wantsComplianceFocus, wantsAutomationFocus, wantsGrowthFocus } from './onboardingPreferencesService';
import {
  fetchPendingCustomerQuestions,
  approveCustomerQuestionReply,
  rejectCustomerQuestionReply,
  questionIdFromQueueItemId,
} from './customerQuestionQueueBridge';
import { computeLateFee, type LateFeeCountry } from './lateFeeService';
import { emitBusinessEvent } from '../intelligence/dataCollector';

const QUEUE_KEY = '@vasco_ai_queue';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type QueueItemStatus = 'pending' | 'approved' | 'rejected' | 'expired';
export type QueueItemType =
  | 'draft_invoice'        // AI prepared an invoice from completed job
  | 'draft_reminder'       // AI prepared a payment reminder
  | 'draft_followup'       // AI prepared a quote follow-up
  | 'draft_quote'          // AI prepared a quote from template
  | 'cert_renewal'         // AI flagged expiring cert with renewal link
  | 'schedule_suggestion'  // AI suggests filling a schedule gap
  | 'price_alert'          // AI found cheaper supplier
  | 'maintenance_due'      // AI detected annual maintenance opportunity
  | 'reorder_materials'    // AI detected materials needed for upcoming job
  | 'decision_reminder'    // AI detected pending customer decision
  | 'bulk_purchase'        // AI detected bulk buying opportunity
  // EVE automation types
  | 'progress_note'        // End-of-day progress update to customer
  | 'batch_invoices'       // Weekly batch of unbilled completed jobs
  | 'invoice_regenerate'   // Regenerate invoice with late fee for 30+ day overdue
  | 'permit_check'         // Country-specific permit requirements for new job
  | 'permit_renewal'       // Expired/expiring permit resubmission
  | 'quote_expiry'         // Quote validity expiring soon — follow up
  | 'job_handover'         // Completion package (photos + hours + materials)
  | 'satisfaction_survey'  // Post-payment customer satisfaction ping
  | 'supplier_comparison'  // Material purchased above last known price
  | 'safety_checklist'     // Pre-fill safety checklist for new site
  | 'tax_prep'             // Quarter-end tax document preparation
  | 'accounting_export'    // Export paid invoices to accounting software
  | 'einvoice_submit'      // Submit e-invoice in country-specific format
  | 'customer_question'    // High-stakes customer question from decision portal (R170)
  | 'low_win_alert'        // R209 — trained quote-win model flags a sent quote as low probability
  | 'late_payment_risk_alert' // R213 — predictPaymentTiming flags a sent invoice as high-risk-late
  | 'job_quality_feedback'; // R300 — prompt contractor to rate completed job (paid_on_time / review / referral / rebook)

export interface QueueItem {
  id: string;
  type: QueueItemType;
  status: QueueItemStatus;
  title: string;           // "Factuur voor Fam. de Vries"
  description: string;     // "CV-ketel onderhoud afgerond op 20 maart"
  preparedData: Record<string, any>; // The actual draft data (invoice lines, reminder text, etc.)
  actionLabel: string;     // "Versturen" / "Aanmaken" / "Vernieuwen"
  estimatedImpact: string; // "€450 omzet" / "5 min bespaard"
  createdAt: string;
  expiresAt?: string;      // Auto-expire after X days
  sourceGeneratorId?: string; // Which AI generator created this
  snoozedUntil?: string;   // ISO date — item hidden until this time
  snoozeCount?: number;    // How many times snoozed
  /** Stable dedup key. Same key = same underlying entity (invoice id, etc.) */
  entityKey?: string;
  /**
   * entityKeys of the sibling events rolled into this item's count badge.
   * Without this the merged entities lose their identity, so the next
   * scheduler run no longer recognises them and merges them AGAIN — the count
   * then climbs on every run for a fixed set of entities.
   */
  mergedKeys?: string[];
  /** How many similar events rolled into this item (e.g. "3 overdue invoices"). */
  count?: number;
  /**
   * The title as its producer wrote it, before any "+N more" suffix. Kept so a
   * second merge recomposes from the original instead of re-suffixing an
   * already-suffixed string. Not parsed back out of `title`: that suffix is
   * localised, so a regex would only strip it in whichever language happened to
   * be active when it was written.
   */
  titleBase?: string;
}

// ---------------------------------------------------------------------------
// Queue management
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Change notification
// ---------------------------------------------------------------------------
// `useAIQueue` used to read the queue exactly once on mount. The background
// scheduler populates the queue a few seconds AFTER mount, and Expo Router
// keeps tab screens mounted, so the mount effect never re-ran: on a fresh
// install the contractor logged in, saw no AI actions at all, and the work the
// engine had generated stayed invisible until the app was restarted.
// Mutations now notify subscribers so any mounted view re-reads.

type QueueListener = () => void;
const queueListeners = new Set<QueueListener>();
let notifyScheduled = false;

/** Coalesced so populateQueue adding N items triggers ONE re-read, not N. */
function notifyQueueChanged(): void {
  if (notifyScheduled) return;
  notifyScheduled = true;
  setTimeout(() => {
    notifyScheduled = false;
    for (const listener of [...queueListeners]) {
      try { listener(); } catch { /* a bad subscriber must not break the rest */ }
    }
  }, 150);
}

/** Subscribe to queue mutations. Returns an unsubscribe fn. */
export function subscribeQueueChanges(listener: QueueListener): () => void {
  queueListeners.add(listener);
  return () => { queueListeners.delete(listener); };
}

export async function getQueue(): Promise<QueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const items: QueueItem[] = raw ? JSON.parse(raw) : [];
    const now = new Date().toISOString();
    // Filter expired and snoozed, return only pending items
    const pending = items.filter(i =>
      i.status === 'pending' &&
      (!i.expiresAt || i.expiresAt > now) &&
      (!i.snoozedUntil || i.snoozedUntil <= now)
    );
    // Prune old non-pending items (keep last 7 days for history)
    const cutoff = new Date(Date.now() - 7 * MS_PER_DAY).toISOString();
    const pruned = items.filter(i =>
      i.status === 'pending' || i.createdAt > cutoff
    );
    if (pruned.length < items.length) {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(pruned)).catch(() => {});
    }
    // Merge in remote high-stakes customer questions (R170). Dedup by id.
    const remoteQuestions = await fetchPendingCustomerQuestions().catch(() => [] as QueueItem[]);
    const existingIds = new Set(pending.map((i) => i.id));
    const merged = [
      ...remoteQuestions.filter((q) => !existingIds.has(q.id)),
      ...pending,
    ];
    // R268: priority matrix always runs. Onboarding prefs are an optional
    // boost but the core type/€/age signals work without them.
    const prefs = await loadOnboardingPreferences().catch(() => null);
    return [...merged].sort((a, b) => scoreQueueItem(b, prefs) - scoreQueueItem(a, prefs));
  } catch (e) {
    // Never swallow this silently: returning [] here means the contractor sees
    // NO AI actions at all while the queue on disk is full, which looks like
    // "the feature is off" rather than an error. Log loudly so it's diagnosable.
    logWarn('aiQueue', `getQueue failed — returning empty queue: ${String((e as Error)?.message ?? e)}`);
    return [];
  }
}

// =============================================================================
// PRIORITY MATRIX (R268)
// =============================================================================
// Each QueueItem gets a composite score from four signals:
//
//   1. BASE URGENCY by type (0-100):
//      - Customer-facing money risk (overdue, customer questions) ranks highest
//      - Compliance with hard deadlines (cert/permit expiry) next
//      - Drafts that unblock revenue (invoice/quote/followup) middle
//      - Pure efficiency (reorder, accounting export) lower
//      - Informational (satisfaction survey, supplier comparison) lowest
//
//   2. €-IMPACT (0-25): parsed from estimatedImpact string. Money on the
//      line drives priority — €1500 invoice ranks above €50 reminder.
//
//   3. AGE BOOST (0-15): items pending >24h get up-weighted so we don't
//      let actionable work decay. Caps at +15 after 5 days.
//
//   4. ONBOARDING GOAL MATCH (0-10): user's stated focus boosts matching
//      types. Carried over from the original prioritizeQueue.
//
// The 4 components are added (not multiplied) so a high-€ stale draft
// outranks a low-€ urgent type-1.
// =============================================================================

const BASE_URGENCY: Record<QueueItemType, number> = {
  // Tier 1 — money/compliance with hard deadlines
  late_payment_risk_alert: 95,
  customer_question: 90,
  invoice_regenerate: 85,           // 30+ day overdue with late fee
  draft_reminder: 85,               // overdue payment reminder
  cert_renewal: 80,
  permit_renewal: 80,
  permit_check: 75,
  einvoice_submit: 75,
  // Tier 2 — revenue draft, low-friction approve to ship
  draft_invoice: 70,
  batch_invoices: 70,
  draft_quote: 65,
  draft_followup: 65,
  quote_expiry: 65,
  decision_reminder: 65,
  low_win_alert: 60,
  // Tier 3 — operations
  job_handover: 55,
  schedule_suggestion: 50,
  reorder_materials: 50,
  maintenance_due: 50,
  safety_checklist: 50,
  // Tier 4 — efficiency / admin
  tax_prep: 45,
  accounting_export: 40,
  progress_note: 40,
  bulk_purchase: 35,
  supplier_comparison: 35,
  price_alert: 35,
  // Tier 5 — informational
  satisfaction_survey: 20,
  job_quality_feedback: 25, // R300 — trains the moat but not time-sensitive
};

/** Parse estimatedImpact strings like "€450 omzet" / "5 min bespaard" → score boost */
function impactScore(impact: string | undefined): number {
  if (!impact) return 0;
  const euroMatch = impact.match(/€\s*([\d.,]+)/);
  if (euroMatch) {
    const num = parseFloat(euroMatch[1].replace(/[.,]/g, '')) || 0;
    // €100 = 5pts, €500 = 12pts, €2000 = 20pts, €10k+ = 25pts (capped)
    return Math.min(25, Math.log10(Math.max(num, 10)) * 6);
  }
  // Time-saved fallback: each "X min" is small but non-zero
  const minMatch = impact.match(/(\d+)\s*min/i);
  if (minMatch) return Math.min(8, parseFloat(minMatch[1]) / 10);
  return 0;
}

/** Age in hours since createdAt → diminishing-returns boost */
function ageBoost(createdAt: string): number {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  if (ageHours < 24) return 0;
  // 1d → +3, 2d → +6, 5d → +15 (capped). Scales linearly then plateaus.
  return Math.min(15, ((ageHours - 24) / 24) * 3);
}

function goalScore(item: QueueItem, prefs: OnboardingPreferences | null): number {
  if (!prefs || prefs.goals.length === 0) return 0;
  if (wantsPaymentFocus(prefs) && ['draft_invoice', 'draft_reminder', 'batch_invoices', 'invoice_regenerate'].includes(item.type)) return 10;
  if (wantsQuotingHelp(prefs) && ['draft_quote', 'draft_followup', 'quote_expiry'].includes(item.type)) return 10;
  if (wantsComplianceFocus(prefs) && ['cert_renewal', 'permit_check', 'permit_renewal', 'safety_checklist', 'einvoice_submit'].includes(item.type)) return 10;
  if (wantsAutomationFocus(prefs) && ['batch_invoices', 'accounting_export', 'tax_prep', 'reorder_materials'].includes(item.type)) return 10;
  if (wantsGrowthFocus(prefs) && ['schedule_suggestion', 'maintenance_due', 'satisfaction_survey'].includes(item.type)) return 10;
  return 0;
}

/**
 * Public scorer — exported for testing + consumers that want the priority value.
 *
 * R269: when sourceGeneratorId is set, the additive (base+impact+age+goal)
 * score is multiplied by the generator's trust score from insightScorer.
 * Generators the user consistently approves/calibrates well get boosted
 * (~×1.3-1.7); dismissed/inaccurate ones get dampened (~×0.5-0.7).
 * This bridges the 14-dim insight matrix into the queue without bloating
 * the queue's own dimensions.
 */
export function scoreQueueItem(item: QueueItem, prefs: OnboardingPreferences | null = null): number {
  const base = BASE_URGENCY[item.type] ?? 50;
  const impact = impactScore(item.estimatedImpact);
  const age = ageBoost(item.createdAt);
  const goal = goalScore(item, prefs);
  const additive = base + impact + age + goal;
  // R269: bridge to insight calibration when generator is known. Sync require
  // so the queue scorer stays sync — the underlying caches are pre-populated.
  if (item.sourceGeneratorId) {
    try {
      // Lazy require to avoid pulling intelligence layer into queue tests.
      const scorer = require('../intelligence/insightScorer');
      const mult = scorer.getGeneratorTrustMultiplier?.(item.sourceGeneratorId) ?? 1;
      return additive * mult;
    } catch {
      return additive;
    }
  }
  return additive;
}

/** Reorder queue items by composite priority score (R268). */
function prioritizeQueue(items: QueueItem[], prefs: OnboardingPreferences): QueueItem[] {
  return [...items].sort((a, b) => scoreQueueItem(b, prefs) - scoreQueueItem(a, prefs));
}

/**
 * Types where a given entity warrants at most ONE pending action, so a second
 * proposal for the same entity is duplicate work regardless of which generator
 * produced it. Deliberately excludes multi-message types like `progress_note`.
 */
const SINGLE_ACTION_PER_ENTITY_TYPES: readonly QueueItemType[] = [
  'draft_invoice', 'draft_reminder', 'draft_followup', 'draft_quote',
  'late_payment_risk_alert', 'low_win_alert', 'job_handover',
  'satisfaction_survey', 'invoice_regenerate', 'quote_expiry',
];

export async function addToQueue(item: Omit<QueueItem, 'id' | 'status' | 'createdAt'>): Promise<string> {
  const t = i18n.t.bind(i18n);
  const id = `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const full: QueueItem = {
    ...item,
    id,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const existing: QueueItem[] = raw ? JSON.parse(raw) : [];
    // If there's an identical entity (type + entityKey), skip it. `mergedKeys`
    // is checked too: an entity that was previously rolled into a count badge
    // is still "already queued", and forgetting that made it re-merge (and
    // re-bump the count) on every subsequent run.
    if (item.entityKey) {
      const match = existing.find(q =>
        q.status === 'pending'
        && q.type === item.type
        && (q.entityKey === item.entityKey || q.mergedKeys?.includes(item.entityKey!)),
      );
      if (match) return ''; // same event, skip
    }

    // Cross-producer dedup on the TARGET ENTITY. Two generators can propose the
    // same work through different entityKey conventions — e.g. the EVE agent's
    // `eve-draft_invoice-j-seed-4` and populateQueue's `invoice-for-job:j-seed-4`
    // both mean "invoice job j-seed-4", so the contractor saw two cards for one
    // job. entityKey equality can't catch that because the prefixes differ.
    //
    // Restricted to types where one action per entity is definitionally true.
    // `progress_note` is deliberately EXCLUDED: job-started, appointment
    // reminder and invoice-sent are distinct messages that legitimately share a
    // jobId, and collapsing them would drop real work.
    const targetOf = (d: any): string | undefined =>
      d?.jobId ?? d?.invoiceId ?? d?.quoteId;
    const target = targetOf(item.preparedData);
    if (target && SINGLE_ACTION_PER_ENTITY_TYPES.includes(item.type)) {
      const dupe = existing.find(q =>
        q.status === 'pending'
        && q.type === item.type
        && targetOf(q.preparedData) === target,
      );
      if (dupe) return ''; // same work, different producer
    }
    // Same KIND of alert, different entities → roll into a single count badge.
    //
    // Scoped to the same sourceGeneratorId on purpose. A QueueItemType is much
    // coarser than the action it represents — `progress_note` alone covers EVE's
    // appointment reminder, job-started, quote-sent and invoice-sent triggers —
    // and a merged item is DISCARDED, not stored, so a type-only match silently
    // swallowed unrelated actions into whichever card happened to be first and
    // relabelled it with their combined count ("14× Incasso Automatisch" for a
    // contractor with three incasso actions). Same generator + same type is a
    // genuine batch ("3× overdue invoice"); across generators it is data loss.
    //
    // The `!!q.entityKey` clause also fixes a wrong-variable slip: it read
    // `!!item.entityKey` — a term constant w.r.t. `q`, so the predicate matched
    // the first pending item of that type whether or not IT was entity-keyed.
    const siblingIdx = existing.findIndex(q =>
      q.status === 'pending'
      && q.type === item.type
      && !!q.entityKey
      && q.sourceGeneratorId === item.sourceGeneratorId,
    );
    if (item.entityKey && siblingIdx >= 0) {
      const sibling = existing[siblingIdx];
      sibling.count = (sibling.count ?? 1) + 1;
      // Remember what got folded in, so this entity is recognised as already
      // queued on the next run instead of merging (and counting) a second time.
      sibling.mergedKeys = [...(sibling.mergedKeys ?? []), item.entityKey!];
      // A count PREFIX multiplies whatever the title says, and these titles are
      // entity-specific — so folding the Bouwgroep Atlas alert into the Hotel NH
      // one produced "2× Factuur Hotel NH 14d te laat" above a body still
      // reading "€ 350 openstaand". That claims two Hotel NH invoices at 14 days
      // and prices the pair at one invoice's amount; the real exposure was €800
      // across two customers, which the Geld header showed correctly on the same
      // screen.
      //
      // The card can only speak for the entity it actually describes, so the
      // count becomes a separate "+N more like this" note rather than a
      // multiplier on that description. Recomposed from `titleBase` so repeat
      // merges don't stack suffixes.
      sibling.titleBase = sibling.titleBase ?? stripCount(sibling.title);
      sibling.title = sibling.count > 1
        ? t('automation.plusMoreLikeThis', {
            defaultValue: '{{title}} · +{{count}} more like this',
            title: sibling.titleBase,
            count: sibling.count - 1,
          })
        : sibling.titleBase;
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(existing));
      notifyQueueChanged();
      return sibling.id;
    }
    // Legacy dedup fallback for items without entityKey
    if (!item.entityKey && existing.some(q =>
      q.status === 'pending' && q.type === item.type && (
        q.title === item.title ||
        (item.sourceGeneratorId && q.sourceGeneratorId === item.sourceGeneratorId)
      )
    )) return '';
    existing.unshift({ ...full, count: 1 });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(existing.slice(0, 50)));
    notifyQueueChanged();
  } catch {}
  return id;
}

function stripCount(title: string): string {
  return title.replace(/^\d+×\s+/, '');
}

export async function approveItem(itemId: string, options?: { editedText?: string }): Promise<QueueItem | null> {
  // Customer-question items are sourced from Supabase, not AsyncStorage — write
  // the approved reply back so the portal poller renders it to the customer.
  if (itemId.startsWith('cq:')) {
    const questionId = questionIdFromQueueItemId(itemId);
    if (!questionId) return null;
    // Rebuild a shape the learning layer can still use for emitBusinessEvent.
    // We pass through whatever edited text is available; if the contractor did
    // not edit, fall back to the AI draft the bridge stashed in description.
    const replyText = (options?.editedText ?? '').trim();
    const ok = await approveCustomerQuestionReply(questionId, replyText);
    if (!ok) return null;
    try {
      const { emitBusinessEvent } = await import('../intelligence/dataCollector');
      await emitBusinessEvent(getCurrentUserId(), {
        eventType: 'queue_item_approved',
        entityType: 'job' as any,
        entityId: questionId,
        payload: { queueType: 'customer_question', edited: Boolean(options?.editedText) },
      });
      const { refreshApprovalRateCache } = await import('../intelligence/insightScorer');
      refreshApprovalRateCache().catch(() => {});
    } catch {}
    // Separate try: sharing the block above meant a throwing emitBusinessEvent
    // silently cost the ledger entry, so an approved customer reply would not
    // be counted as work Vasco did.
    try {
      const { recordApproval } = await import('./actionLedgerService');
      await recordApproval({ id: itemId, type: 'customer_question' });
    } catch {}
    return {
      id: itemId,
      type: 'customer_question',
      status: 'approved',
      title: '',
      description: replyText,
      preparedData: { questionId, approvedReply: replyText },
      actionLabel: '',
      estimatedImpact: '',
      createdAt: new Date().toISOString(),
    };
  }
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const items: QueueItem[] = raw ? JSON.parse(raw) : [];
    const item = items.find(i => i.id === itemId);
    if (item) {
      item.status = 'approved';
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
      notifyQueueChanged();
      // Durable record of the approval. This store prunes non-pending items
      // after 7 days (see getQueue), so without a separate ledger there is no
      // month-scale evidence that Vasco did any work at all.
      try {
        const { recordApproval } = await import('./actionLedgerService');
        await recordApproval({
          id: itemId,
          type: item.type,
          // A NAME by construction — never fall back to an entity id (#452).
          label: typeof item.preparedData?.customerName === 'string'
            ? item.preparedData.customerName
            : undefined,
        });
      } catch { /* the approval itself must not fail because logging did */ }
      // Feedback loop: emit to learning layer so insightScorer approval-rate
      // cache picks up the signal on next refresh + force-refresh now so the
      // next generator tick within this session sees it (not stuck on TTL).
      try {
        const { emitBusinessEvent, emitPackApproved } = await import('../intelligence/dataCollector');
        await emitBusinessEvent(getCurrentUserId(), {
          eventType: 'queue_item_approved',
          entityType: 'job' as any,
          entityId: item.entityKey ?? itemId,
          payload: {
            queueType: item.type,
            generatorId: item.sourceGeneratorId,
            count: item.count ?? 1,
          },
        });
        // R66r49 #6: pack-specific approve telemetry. Only fires for
        // workflow-pack-sourced items (sourceGeneratorId starts with
        // `workflow_`). Lets the admin dashboard compute per-pack
        // approve-rate without inferring from queue-type alone.
        if (item.sourceGeneratorId?.startsWith('workflow_')) {
          const packId = item.sourceGeneratorId.replace(/^workflow_/, '');
          const createdMs = Date.parse(item.createdAt);
          const latency = Number.isFinite(createdMs) ? Date.now() - createdMs : undefined;
          emitPackApproved(getCurrentUserId(), itemId, {
            packId,
            via: 'navigate', // refined by queueItemExecutor when available
            approvalLatencyMs: latency,
          }).catch(() => {});
        }
        const { refreshApprovalRateCache } = await import('../intelligence/insightScorer');
        refreshApprovalRateCache().catch(() => {});
      } catch {}
      return item;
    }
  } catch {}
  return null;
}

export async function rejectItem(itemId: string): Promise<void> {
  if (itemId.startsWith('cq:')) {
    const questionId = questionIdFromQueueItemId(itemId);
    if (questionId) await rejectCustomerQuestionReply(questionId);
    return;
  }
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const items: QueueItem[] = raw ? JSON.parse(raw) : [];
    const item = items.find(i => i.id === itemId);
    if (item) {
      item.status = 'rejected';
      // Dormant for any future sibling of this entity: if the contractor has
      // rejected 3+ items with the same entityKey, silence that entity for
      // 14 days to stop nagging (e.g. a customer who always pays late but
      // the contractor doesn't want automated reminders).
      if (item.entityKey) {
        const siblings = items.filter((i) => i.entityKey === item.entityKey && i.status === 'rejected');
        if (siblings.length >= 3) {
          const mutedUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
          for (const i of items) {
            if (i.entityKey === item.entityKey && i.status === 'pending') {
              i.snoozedUntil = mutedUntil;
              i.snoozeCount = (i.snoozeCount ?? 0) + 1;
            }
          }
        }
      }
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
      notifyQueueChanged();
      try {
        const { emitBusinessEvent, emitPackDismissed } = await import('../intelligence/dataCollector');
        await emitBusinessEvent(getCurrentUserId(), {
          eventType: 'queue_item_rejected',
          entityType: 'job' as any,
          entityId: item.entityKey ?? itemId,
          payload: {
            queueType: item.type,
            generatorId: item.sourceGeneratorId,
          },
        });
        if (item.sourceGeneratorId?.startsWith('workflow_')) {
          emitPackDismissed(getCurrentUserId(), itemId, {
            packId: item.sourceGeneratorId.replace(/^workflow_/, ''),
            reason: 'manual_dismiss',
          }).catch(() => {});
        }
        const { refreshApprovalRateCache } = await import('../intelligence/insightScorer');
        refreshApprovalRateCache().catch(() => {});
      } catch {}
    }
  } catch {}
}

export async function snoozeQueueItem(itemId: string, hours: number): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const items: QueueItem[] = raw ? JSON.parse(raw) : [];
    const item = items.find(i => i.id === itemId);
    if (item) {
      item.snoozedUntil = new Date(Date.now() + hours * 3600000).toISOString();
      item.snoozeCount = (item.snoozeCount ?? 0) + 1;
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
      notifyQueueChanged();
    }
  } catch {}
}

// ---------------------------------------------------------------------------
// Outcome recording — feeds back into insightScorer's approval-rate learning
// ---------------------------------------------------------------------------

const OUTCOMES_KEY = '@vasco_queue_outcomes';

export async function recordOutcome(
  itemId: string,
  outcome: 'positive' | 'negative' | 'neutral',
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(OUTCOMES_KEY);
    const outcomes: Array<{ itemId: string; type: string; outcome: string; timestamp: string }> = raw ? JSON.parse(raw) : [];
    // Find the item type from the queue (check both pending and history)
    const queueRaw = await AsyncStorage.getItem(QUEUE_KEY);
    const queueItems: QueueItem[] = queueRaw ? JSON.parse(queueRaw) : [];
    const item = queueItems.find(i => i.id === itemId);
    // Emit to learning layer — customer-responded vs didn't-respond is a
    // higher-quality signal than mere approve/reject (contractor may approve
    // to dismiss, but customer reply proves the message worked).
    // R50: switched from dynamic import to static for testability + perf
    // (no circular dep — dataCollector doesn't reach back into the queue).
    try {
      await emitBusinessEvent(getCurrentUserId(), {
        eventType: `queue_outcome_${outcome}`,
        entityType: 'job' as any,
        entityId: item?.entityKey ?? itemId,
        payload: {
          queueType: item?.type ?? 'unknown',
          generatorId: item?.sourceGeneratorId,
        },
      });
    } catch {}
    outcomes.push({
      itemId,
      type: item?.type ?? 'unknown',
      outcome,
      timestamp: new Date().toISOString(),
    });
    // Keep last 200 outcomes
    await AsyncStorage.setItem(OUTCOMES_KEY, JSON.stringify(outcomes.slice(-200)));
    // Mirror onto the action ledger: a customer reply is the only evidence the
    // approved message actually landed, so it is what "confirmed" counts.
    try {
      const { attachOutcome } = await import('./actionLedgerService');
      await attachOutcome(itemId, outcome);
    } catch {}
  } catch {}
}

export async function getOutcomes(): Promise<Array<{ itemId: string; type: string; outcome: string; timestamp: string }>> {
  try {
    const raw = await AsyncStorage.getItem(OUTCOMES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Queue history — returns last 50 approved/rejected items for learning
// ---------------------------------------------------------------------------

export async function getQueueHistory(): Promise<QueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const items: QueueItem[] = raw ? JSON.parse(raw) : [];
    return items
      .filter(i => i.status === 'approved' || i.status === 'rejected')
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 50);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Proactive queue population — called on app open
// ---------------------------------------------------------------------------

interface PopulateQueueContext {
  completedJobs: Array<Record<string, any>>;
  overdueInvoices: Array<Record<string, any>>;
  sentQuotes: Array<Record<string, any>>;
  expiringCerts: Array<Record<string, any>>;
  allJobs?: Array<Record<string, any>>;
  allInvoices?: Array<Record<string, any>>;
  allQuotes?: Array<Record<string, any>>;
  customers?: Array<{ id: string; name?: string }>;
  certs?: Array<Record<string, any>>;
  country?: string;
  trade?: string;
}

/**
 * Human label for an invoice/quote in a queue TITLE. Never returns a row id.
 *
 * Queue titles are read by the contractor, and the same shapes feed the
 * customer-facing share templates, so a leaked `inv-seed-1` / `q-104` is
 * user-visible. Preference order is most-recognisable first: the document's
 * own reference, then the job it belongs to, then the customer name.
 */
export function queueEntityLabel(
  entity: Record<string, any> | null | undefined,
  customers?: Array<{ id: string; name?: string }>,
): string {
  if (!entity) return '';
  const byId = entity.customerId
    ? customers?.find((c) => c.id === entity.customerId)?.name
    : undefined;
  const candidates = [
    entity.reference,
    entity.invoiceNumber,
    entity.job,
    entity.title,
    byId,
    // `customer` holds a NAME on these shapes, but older rows sometimes carry
    // an id — only accept it when it doesn't look like one.
    typeof entity.customer === 'string' && !/^(?:cust|c)-/.test(entity.customer)
      ? entity.customer
      : undefined,
    entity.customerName,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}

export async function populateQueue(context: PopulateQueueContext): Promise<number> {
  let added = 0;

  // Every title/description below is resolved HERE and then PERSISTED into
  // @vasco_ai_queue by addToQueue — nothing re-translates them on read. So the
  // language must be settled before the first t(), or the card keeps the
  // device language for the rest of its life. i18n.ts boots on the device
  // locale and AuthContext applies the saved preference asynchronously; the
  // scheduler can run inside that gap.
  await applySavedLanguage();

  const t = i18n.t.bind(i18n);
  const now = Date.now();
  const dayMs = MS_PER_DAY;

  // ─── EXISTING: Draft invoices for completed jobs ───
  for (const job of (context.completedJobs ?? []).slice(0, 3)) {
    if (!job || !job.id) continue;
    const amountStr = `${formatMoney((job.quotedAmount ?? 0))}`;
    const id = await addToQueue({
      type: 'draft_invoice',
      title: t('aiQueue.invoiceFor', { title: job.title || '' }),
      description: `${t('aiQueue.jobCompleted')} · ${amountStr}`,
      preparedData: {
        jobId: job.id, amount: job.quotedAmount, customer: job.customerId,
        reasoning: `Job completed. Invoice promptly to maintain cash flow — average time-to-invoice for your trade is 2 days.`,
      },
      actionLabel: t('aiQueue.createInvoice'),
      estimatedImpact: t('aiQueue.revenueAmount', { amount: amountStr }),
      expiresAt: new Date(now + 7 * dayMs).toISOString(),
      entityKey: `invoice-for-job:${job.id}`,
    });
    if (id) added++;
  }

  // ─── EXISTING: Draft reminders for overdue invoices ───
  for (const inv of (context.overdueInvoices ?? []).slice(0, 3)) {
    if (!inv || !inv.id) continue;
    const amountStr = `${formatMoney((inv.amount ?? 0))}`;
    const custId = (inv as any).customerId || inv.customer || '';
    const custIntel = custId ? getCustomerIntelligence(custId, context.allJobs ?? [], context.allInvoices ?? context.overdueInvoices) : null;
    const id = await addToQueue({
      type: 'draft_reminder',
      // Human label, never the row id — this title is what the contractor reads
      // in the queue ("Herinnering voor inv-seed-1" was leaking the id).
      title: t('aiQueue.reminderFor', { ref: queueEntityLabel(inv, context.customers) }).trim(),
      description: t('aiQueue.amountOverdue', { amount: amountStr }),
      preparedData: {
        invoiceId: inv.id, amount: inv.amount, customer: inv.customer,
        ...(custIntel?.contextLine ? { customerContext: custIntel.contextLine } : {}),
        reasoning: custIntel?.contextLine
          ? `${inv.customer || 'Customer'} — ${custIntel.contextLine}. A timely reminder improves collection.`
          : `${amountStr} overdue. Sending a reminder now increases chance of payment this week.`,
      },
      actionLabel: t('aiQueue.sendReminder'),
      estimatedImpact: t('aiQueue.speedsUpPayment'),
      expiresAt: new Date(now + 3 * dayMs).toISOString(),
      entityKey: `reminder-for-invoice:${inv.id}`,
    });
    if (id) added++;
  }

  // ─── EXISTING: Follow-ups for unanswered quotes ───
  for (const quote of (context.sentQuotes ?? []).slice(0, 2)) {
    if (!quote || !quote.id) continue;
    const followupCustId = (quote as any).customerId || quote.customer || '';
    const followupIntel = followupCustId ? getCustomerIntelligence(followupCustId, context.allJobs ?? [], context.allInvoices ?? []) : null;
    const id = await addToQueue({
      type: 'draft_followup',
      title: t('aiQueue.quoteFollowUp', { ref: queueEntityLabel(quote, context.customers) }).trim(),
      description: `${quote.customer || ''} · ${formatMoney((quote.amount ?? 0))}`,
      preparedData: {
        quoteId: quote.id, customer: quote.customer, amount: quote.amount,
        ...(followupIntel?.contextLine ? { customerContext: followupIntel.contextLine } : {}),
        reasoning: `Quote sent but no response yet. Following up increases acceptance rate by ~20%.`,
      },
      actionLabel: t('aiQueue.sendFollowUp'),
      estimatedImpact: t('aiQueue.increasesAcceptance'),
      expiresAt: new Date(now + 5 * dayMs).toISOString(),
    });
    if (id) added++;
  }

  // ─── NEW: Daily progress note to customer ───
  // Jobs worked on today → prepare end-of-day update message
  const todaysActiveJobs = (context.allJobs ?? []).filter((j: any) => {
    if (j.status !== 'in-progress' && j.status !== 'bezig') return false;
    const entries = j.timeEntries ?? [];
    const today = new Date().toISOString().split('T')[0];
    return entries.some((e: any) => (e.date || '').startsWith(today));
  });
  for (const job of todaysActiveJobs.slice(0, 2)) {
    if (!job || !job.id) continue;
    const hours = (job.timeEntries ?? [])
      .filter((e: any) => (e.date || '').startsWith(new Date().toISOString().split('T')[0]))
      .reduce((s: number, e: any) => s + (e.hours ?? 0), 0);
    const cust = (context.customers ?? []).find((c: any) => c.id === job.customerId);
    const message = t('automation.progressNote', {
      defaultValue: 'Hi {{customer}}, update on {{job}}: {{hours}}h worked today. Progress is on track. Any questions, let me know!',
      customer: cust?.name || job.customerId || '',
      job: job.title || '',
      hours: hours.toFixed(1),
    });
    const id = await addToQueue({
      type: 'progress_note',
      title: t('automation.progressTitle', { defaultValue: 'Progress update: {{title}}', title: job.title || '' }),
      description: `${cust?.name || ''} · ${hours.toFixed(1)}h`,
      preparedData: {
        jobId: job.id, customerId: job.customerId, template: message, hours,
        reasoning: `You logged ${hours.toFixed(1)}h on this job today. Customers who receive daily updates rate satisfaction 40% higher.`,
      },
      actionLabel: t('common.send', 'Verstuur'),
      estimatedImpact: t('automation.customerSatisfaction', 'Customer satisfaction'),
      expiresAt: new Date(now + 1 * dayMs).toISOString(),
      sourceGeneratorId: 'automation_progress_note',
    });
    if (id) added++;
  }

  // ─── NEW: Invoice regeneration for 30+ day overdue ───
  const severelyOverdue = (context.allInvoices ?? context.overdueInvoices).filter((inv: any) => {
    if (inv.status !== 'overdue') return false;
    const due = new Date(inv.dueDate || '').getTime();
    return due && (now - due) > 30 * dayMs;
  });
  const supportedFeeCountries: LateFeeCountry[] = ['NL', 'DE', 'FR', 'ES', 'IT', 'UK'];
  const feeCountry: LateFeeCountry = supportedFeeCountries.includes((context.country ?? 'NL') as LateFeeCountry)
    ? ((context.country ?? 'NL') as LateFeeCountry)
    : 'NL';
  for (const inv of severelyOverdue.slice(0, 2)) {
    const daysOverdue = Math.ceil((now - new Date(inv.dueDate || '').getTime()) / dayMs);
    // EU Directive 2011/7/EU: statutory interest + €40 (or UK tiered) recovery
    // fee. Assumes B2B — we only auto-populate for overdue invoices on a
    // customer record, which for most trades is business-to-business work.
    // Contractor can strip the interest line if the end customer is a consumer.
    const feeBreakdown = computeLateFee({
      invoiceAmount: inv.amount || 0,
      daysOverdue,
      country: feeCountry,
      customerType: 'business',
    });
    const interest = feeBreakdown.interest;
    const recoveryFee = feeBreakdown.recoveryFee;
    const lateFee = Math.round((interest + recoveryFee) * 100) / 100;
    const id = await addToQueue({
      type: 'invoice_regenerate',
      title: t('automation.regenerateInvoice', { defaultValue: 'Regenerate invoice {{id}}', id: queueEntityLabel(inv, context.customers) }),
      description: t('automation.daysOverdueWithFee', {
        defaultValue: '{{days}} days overdue · +{{fee}} late fee',
        days: daysOverdue,
        fee: formatMoney2(lateFee),
      }),
      preparedData: {
        invoiceId: inv.id,
        originalAmount: inv.amount,
        lateFee,
        interest,
        recoveryFee,
        ratePct: feeBreakdown.effectiveRatePct,
        currency: feeBreakdown.currency,
        disclosureLine: feeBreakdown.disclosureLine,
        newTotal: (inv.amount || 0) + lateFee,
        customer: inv.customer,
        reasoning: `${daysOverdue} days overdue. EU Directive 2011/7/EU entitles you to ${feeBreakdown.effectiveRatePct.toFixed(2)}% statutory interest (${formatMoney2(interest)}) + ${formatMoney(recoveryFee)} fixed recovery fee.`,
      },
      actionLabel: t('automation.regenerate', 'Regenerate'),
      estimatedImpact: formatMoney2((inv.amount || 0) + lateFee),
      expiresAt: new Date(now + 7 * dayMs).toISOString(),
      sourceGeneratorId: 'automation_invoice_regen',
    });
    if (id) added++;
  }

  // ─── NEW: Quote expiry follow-up ───
  const expiringQuotes = (context.allQuotes ?? context.sentQuotes).filter((q: any) => {
    if (q.status !== 'sent') return false;
    const validUntil = q.validUntil ? new Date(q.validUntil).getTime() : 0;
    return validUntil && (validUntil - now) > 0 && (validUntil - now) < 3 * dayMs;
  });
  for (const q of expiringQuotes.slice(0, 2)) {
    const expiryDate = formatDateShortAuto(new Date(q.validUntil));
    const cust = (context.customers ?? []).find((c: any) => c.id === q.customerId);
    const message = t('automation.quoteExpiryMsg', {
      defaultValue: 'Hi {{customer}}, your quote for {{job}} ({{amount}}) expires on {{date}}. Would you like to proceed?',
      customer: cust?.name || q.customer || '',
      job: q.description || q.job || '',
      amount: formatMoney2(q.amount ?? 0),
      date: expiryDate,
    });
    const id = await addToQueue({
      type: 'quote_expiry',
      title: t('automation.quoteExpiring', { defaultValue: 'Quote expiring: {{customer}}', customer: cust?.name || q.customer || '' }),
      description: `${formatMoney((q.amount ?? 0))} · ${expiryDate}`,
      preparedData: {
        quoteId: q.id, customerId: q.customerId, template: message,
        reasoning: `Quote expires on ${expiryDate}. A gentle reminder before expiry converts 30% more quotes.`,
      },
      actionLabel: t('common.send', 'Verstuur'),
      estimatedImpact: t('automation.recoverRevenue', 'Recover revenue'),
      expiresAt: new Date(now + 3 * dayMs).toISOString(),
      sourceGeneratorId: 'automation_quote_expiry',
    });
    if (id) added++;
  }

  // ─── NEW: Material reorder for upcoming jobs ───
  const upcomingJobs = (context.allJobs ?? []).filter((j: any) => {
    if (j.status !== 'scheduled' && j.status !== 'ingepland') return false;
    const startDate = new Date(j.scheduledDate || j.startDate || '').getTime();
    return startDate && (startDate - now) > 0 && (startDate - now) < 3 * dayMs;
  });
  for (const job of upcomingJobs.slice(0, 2)) {
    if (!job || !job.id) continue;
    const materials = job.materials ?? [];
    if (materials.length === 0) continue;
    const materialList = materials.map((m: any) => `${m.name || m.description || ''}: ${m.quantity ?? 1}x`).join(', ');
    const totalCost = materials.reduce((s: number, m: any) => s + (m.totalCost ?? m.unitPrice ?? 0), 0);
    const id = await addToQueue({
      type: 'reorder_materials',
      title: t('automation.materialsFor', { defaultValue: 'Materials for {{title}}', title: job.title || '' }),
      description: `${materials.length} items · ${formatMoney(totalCost)}`,
      preparedData: {
        jobId: job.id, materials, totalCost, materialList,
        reasoning: `Job starts within 3 days. Order now to ensure delivery in time — typical supplier lead time is 1-2 days.`,
      },
      actionLabel: t('automation.orderMaterials', 'Order materials'),
      estimatedImpact: t('automation.preventsDelay', 'Prevents delay'),
      expiresAt: new Date(now + 3 * dayMs).toISOString(),
      sourceGeneratorId: 'automation_material_reorder',
    });
    if (id) added++;
  }

  // ─── NEW: Weekly invoice batch (Friday only) ───
  const dayOfWeek = new Date().getDay();
  if (dayOfWeek === 5) { // Friday
    const unbilledCompleted = (context.allJobs ?? context.completedJobs).filter((j: any) =>
      (j.status === 'completed' || j.status === 'gereed') && !j.invoiceId
    );
    if (unbilledCompleted.length >= 2) {
      const totalRevenue = unbilledCompleted.reduce((s: number, j: any) => s + (j.quotedAmount ?? j.agreedAmount ?? 0), 0);
      const id = await addToQueue({
        type: 'batch_invoices',
        title: t('automation.weeklyBatch', { defaultValue: 'Weekly invoice batch: {{count}} jobs', count: unbilledCompleted.length }),
        description: `${formatMoney(totalRevenue)} ${t('automation.totalRevenue', 'total revenue')}`,
        preparedData: {
          jobIds: unbilledCompleted.map((j: any) => j.id),
          jobs: unbilledCompleted.map((j: any) => ({ id: j.id, title: j.title || '', amount: j.quotedAmount ?? j.agreedAmount ?? 0 })),
          totalRevenue,
        },
        actionLabel: t('automation.createAll', 'Create all'),
        estimatedImpact: `${formatMoney(totalRevenue)}`,
        expiresAt: new Date(now + 3 * dayMs).toISOString(),
        sourceGeneratorId: 'automation_batch_invoices',
      });
      if (id) added++;
    }
  }

  // ─── NEW: Job completion handover package ───
  const recentlyCompleted = (context.allJobs ?? context.completedJobs).filter((j: any) => {
    if (j.status !== 'completed' && j.status !== 'gereed') return false;
    const completedAt = new Date(j.completedAt || '').getTime();
    return completedAt && (now - completedAt) < 2 * dayMs; // Completed in last 2 days
  });
  for (const job of recentlyCompleted.slice(0, 2)) {
    const photos = (job.photos ?? []).length;
    const hours = (job.timeEntries ?? []).reduce((s: number, e: any) => s + (e.hours ?? 0), 0);
    const cust = (context.customers ?? []).find((c: any) => c.id === job.customerId);
    const id = await addToQueue({
      type: 'job_handover',
      title: t('automation.handoverPackage', { defaultValue: 'Handover: {{title}}', title: job.title || '' }),
      description: `${photos} ${t('automation.photos', 'photos')} · ${hours.toFixed(1)}h · ${cust?.name || ''}`,
      preparedData: {
        jobId: job.id,
        customerId: job.customerId,
        photoCount: photos,
        totalHours: hours,
        materials: job.materials ?? [],
        customerName: cust?.name,
        reasoning: `Job recently completed. Sending a professional handover package (${photos} photos, ${hours.toFixed(1)}h logged) builds trust and prompts referrals.`,
      },
      actionLabel: t('automation.sendHandover', 'Send handover'),
      estimatedImpact: t('automation.professionalFinish', 'Professional finish'),
      expiresAt: new Date(now + 5 * dayMs).toISOString(),
      sourceGeneratorId: 'automation_handover',
    });
    if (id) added++;
  }

  // ─── NEW: Cert renewal reminders ───
  const expiringCerts = context.expiringCerts ?? (context.certs ?? []).filter((c: any) => {
    const exp = new Date(c.expiryDate || '').getTime();
    return exp && (exp - now) > 0 && (exp - now) < 30 * dayMs;
  });
  for (const cert of expiringCerts.slice(0, 2)) {
    const daysLeft = Math.ceil((new Date(cert.expiryDate || '').getTime() - now) / dayMs);
    const id = await addToQueue({
      type: 'cert_renewal',
      title: t('automation.certExpiring', { defaultValue: '{{name}} expires in {{days}} days', name: cert.name || cert.type || '', days: daysLeft }),
      description: cert.issuedBy || cert.authority || '',
      preparedData: {
        certId: cert.id, name: cert.name, expiryDate: cert.expiryDate, renewalUrl: cert.renewalUrl,
        reasoning: `Expires in ${daysLeft} days. Renewal typically takes 5-10 business days — start now to avoid a compliance gap.`,
      },
      actionLabel: t('automation.renew', 'Renew'),
      estimatedImpact: t('automation.staysCompliant', 'Stays compliant'),
      expiresAt: new Date(now + Math.min(daysLeft, 14) * dayMs).toISOString(),
      sourceGeneratorId: 'automation_cert_renewal',
    });
    if (id) added++;
  }

  // ─── NEW: Predictive maintenance — annual maintenance window (10-12 months) ───
  const maintenanceCandidates = (context.allJobs ?? []).filter((j: any) => {
    if (j.status !== 'completed' && j.status !== 'gereed') return false;
    const completedAt = new Date(j.completedAt || j.lastUpdated || '').getTime();
    if (!completedAt || isNaN(completedAt)) return false;
    const monthsAgo = (now - completedAt) / (30 * dayMs);
    return monthsAgo >= 10 && monthsAgo <= 12;
  });
  for (const job of maintenanceCandidates.slice(0, 3)) {
    const cust = (context.customers ?? []).find((c: any) => c.id === job.customerId);
    const monthsAgo = Math.round((now - new Date(job.completedAt || job.lastUpdated || '').getTime()) / (30 * dayMs));
    const id = await addToQueue({
      type: 'maintenance_due',
      title: t('automation.maintenanceDue', { defaultValue: 'Annual maintenance: {{customer}}', customer: cust?.name || '' }),
      description: t('automation.maintenanceDesc', {
        defaultValue: '{{title}} completed {{months}} months ago',
        title: job.title || '',
        months: monthsAgo,
      }),
      preparedData: {
        jobId: job.id, customerId: job.customerId, customerName: cust?.name, jobTitle: job.title, monthsAgo,
        reasoning: `"${job.title || ''}" was completed ${monthsAgo} months ago. Annual maintenance keeps ${cust?.name || 'the customer'} loyal and generates recurring revenue.`,
      },
      actionLabel: t('automation.scheduleMaintenance', 'Schedule'),
      estimatedImpact: t('automation.recurringRevenue', 'Recurring revenue'),
      expiresAt: new Date(now + 14 * dayMs).toISOString(),
      sourceGeneratorId: `automation_maintenance_${job.id}`,
    });
    if (id) added++;
  }

  // ─── R13.4: explicit recurring-template maintenance (R246/R253 contracts) ───
  // The block above auto-detects implicit annual maintenance from completed jobs
  // 10-12 months old. But contractors who explicitly set up monthly/quarterly
  // contracts via /contractor/recurring (AsyncStorage templates) had no path
  // to the queue — their templates sat as a static list, with nothing
  // materializing a job when one came due. Now reads the templates and surfaces
  // maintenance_due items for any non-paused template due within 7 days.
  try {
    const { getRecurringInstances } = await import('./recurringJobsService');
    const upcoming = await getRecurringInstances({ withinDays: 7 });
    for (const inst of upcoming.slice(0, 3)) {
      const t2 = inst.template;
      const cust = (context.customers ?? []).find((c: any) => c.id === t2.customerId);
      const id = await addToQueue({
        type: 'maintenance_due',
        title: t('automation.recurringDue', { defaultValue: '{{title}} due — {{customer}}', title: t2.title, customer: t2.customerName ?? cust?.name ?? '' }),
        description: inst.overdue
          ? t('automation.recurringOverdue', { defaultValue: 'Overdue by {{days}}d', days: Math.abs(inst.daysUntilDue) })
          : t('automation.recurringDays', { defaultValue: 'Due in {{days}}d', days: inst.daysUntilDue }),
        preparedData: {
          recurringTemplateId: t2.id,
          customerId: t2.customerId,
          customerName: t2.customerName ?? cust?.name,
          jobTitle: t2.title,
          estimatedDuration: t2.estimatedDurationHours,
          estimatedAmount: t2.estimatedAmount,
          reasoning: `Recurring contract "${t2.title}" — cadence ${t2.cadence}. Approving creates the next job and bumps lastRunDate.`,
        },
        actionLabel: t('automation.scheduleMaintenance', 'Schedule'),
        estimatedImpact: t('automation.recurringRevenue', 'Recurring revenue'),
        expiresAt: new Date(now + 14 * dayMs).toISOString(),
        sourceGeneratorId: `automation_recurring_${t2.id}`,
      });
      if (id) added++;
    }
  } catch {
    // Non-critical — don't block the rest of the queue population
  }

  // ─── NEW: Customer satisfaction ping (7 days after payment) ───
  const recentlyPaid = (context.allInvoices ?? []).filter((inv: any) => {
    if (inv.status !== 'paid') return false;
    const paidAt = new Date(inv.paidAt || inv.lastUpdated || '').getTime();
    return paidAt && (now - paidAt) >= 7 * dayMs && (now - paidAt) < 8 * dayMs;
  });
  for (const inv of recentlyPaid.slice(0, 2)) {
    const cust = (context.customers ?? []).find((c: any) => c.id === inv.customerId);
    const satIntel = inv.customerId ? getCustomerIntelligence(inv.customerId, context.allJobs ?? [], context.allInvoices ?? []) : null;
    const message = t('automation.satisfactionMsg', {
      defaultValue: 'Hi {{customer}}, we hope you\'re happy with the work. Would you recommend us? Your feedback helps us improve!',
      customer: cust?.name || inv.customer || '',
    });
    const id = await addToQueue({
      type: 'satisfaction_survey',
      title: t('automation.feedbackRequest', { defaultValue: 'Feedback: {{customer}}', customer: cust?.name || inv.customer || '' }),
      description: t('automation.sevenDaysAfterPayment', '7 days after payment'),
      preparedData: {
        invoiceId: inv.id, customerId: inv.customerId, template: message,
        ...(satIntel?.contextLine ? { customerContext: satIntel.contextLine } : {}),
        reasoning: `7 days since payment — the ideal moment to ask for feedback. Satisfied customers are 3x more likely to refer.`,
      },
      actionLabel: t('common.send', 'Verstuur'),
      estimatedImpact: t('automation.buildsReputation', 'Builds reputation'),
      expiresAt: new Date(now + 3 * dayMs).toISOString(),
      sourceGeneratorId: 'automation_satisfaction',
    });
    if (id) added++;
  }

  // ─── NEW: Permit requirement check for new jobs ───
  const newJobs = (context.allJobs ?? []).filter((j: any) => {
    const created = new Date(j.createdAt || '').getTime();
    return created && (now - created) < 1 * dayMs && j.status !== 'completed';
  });
  const country = context.country || 'NL';
  for (const job of newJobs.slice(0, 2)) {
    const permits = getRequiredPermits(job.trade || 'general', country);
    if (permits.length === 0) continue;
    const id = await addToQueue({
      type: 'permit_check',
      title: t('automation.permitCheck', { defaultValue: 'Permit check: {{title}}', title: job.title || '' }),
      description: `${permits.length} ${t('automation.permitsRequired', 'permits required')} (${country})`,
      preparedData: { jobId: job.id, trade: job.trade, country, permits },
      actionLabel: t('automation.reviewPermits', 'Review permits'),
      estimatedImpact: t('automation.staysCompliant', 'Stays compliant'),
      expiresAt: new Date(now + 7 * dayMs).toISOString(),
      sourceGeneratorId: 'automation_permit_check',
    });
    if (id) added++;
  }

  // ─── NEW: Supplier price comparison ───
  // Check if any recent material purchases were significantly more expensive
  const allMaterials = (context.allJobs ?? []).flatMap((j: any) => (j.materials ?? []).map((m: any) => ({ ...m, jobId: j.id, jobTitle: j.title })));
  const materialsByName = new Map<string, any[]>();
  for (const m of allMaterials) {
    const key = (m.name || m.description || '').toLowerCase();
    if (!key) continue;
    const group = materialsByName.get(key) ?? [];
    group.push(m);
    materialsByName.set(key, group);
  }
  for (const [name, items] of materialsByName) {
    if (items.length < 2) continue;
    const sorted = items.sort((a: any, b: any) => (b.unitPrice ?? 0) - (a.unitPrice ?? 0));
    const mostExpensive = sorted[0];
    const cheapest = sorted[sorted.length - 1];
    if (mostExpensive.unitPrice > cheapest.unitPrice * 1.1 && mostExpensive.unitPrice > 10) {
      const savings = mostExpensive.unitPrice - cheapest.unitPrice;
      const id = await addToQueue({
        type: 'supplier_comparison',
        title: t('automation.supplierComparison', { defaultValue: 'Better price: {{name}}', name }),
        description: `${formatMoney2(mostExpensive.unitPrice)} → ${formatMoney2(cheapest.unitPrice)} (${t('automation.save', 'save')} ${formatMoney(savings)})`,
        preparedData: { materialName: name, currentPrice: mostExpensive.unitPrice, bestPrice: cheapest.unitPrice, savings },
        actionLabel: t('automation.compareSuppliers', 'Compare'),
        estimatedImpact: `${formatMoney(savings)} ${t('automation.perUnit', 'per unit')}`,
        expiresAt: new Date(now + 7 * dayMs).toISOString(),
        sourceGeneratorId: 'automation_supplier_compare',
      });
      if (id) added++;
      if (added > 20) break; // Don't overflow the queue
    }
  }

  // ─── NEW: Schedule gap suggestion ───
  // If contractor has 0 jobs tomorrow, suggest filling the gap
  const tomorrow = new Date(now + dayMs);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const tomorrowJobs = (context.allJobs ?? []).filter((j: any) => {
    const sched = j.scheduledDate || j.startDate || '';
    return sched.startsWith(tomorrowStr) && j.status !== 'completed' && j.status !== 'gereed';
  });
  if (tomorrowJobs.length === 0) {
    const leadJobs = (context.allJobs ?? []).filter((j: any) => j.status === 'lead' || j.status === 'accepted');
    if (leadJobs.length > 0) {
      const bestLead = leadJobs[0];
      const id = await addToQueue({
        type: 'schedule_suggestion',
        title: t('automation.emptyTomorrow', { defaultValue: 'No jobs tomorrow — schedule {{title}}?', title: bestLead.title || '' }),
        description: t('automation.leadsAvailable', { count: leadJobs.length }),
        preparedData: { jobId: bestLead.id, date: tomorrowStr, leadCount: leadJobs.length },
        actionLabel: t('automation.planSchedule', 'Plan'),
        estimatedImpact: t('automation.fillsGap', 'Fills schedule gap'),
        expiresAt: new Date(now + 1 * dayMs).toISOString(),
        sourceGeneratorId: 'automation_schedule_gap',
      });
      if (id) added++;
    }
  }

  // ─── NEW: Tax prep reminder (quarter-end) ───
  const month = new Date().getMonth();
  const day = new Date().getDate();
  const isQuarterEnd = (month === 2 || month === 5 || month === 8 || month === 11) && day >= 20;
  if (isQuarterEnd) {
    const quarterName = `Q${Math.floor(month / 3) + 1}`;
    const paidInvoiceCount = (context.allInvoices ?? []).filter((i: any) => i.status === 'paid').length;
    const id = await addToQueue({
      type: 'tax_prep',
      title: t('automation.taxPrep', { defaultValue: '{{quarter}} tax prep', quarter: quarterName }),
      description: `${paidInvoiceCount} ${t('automation.invoicesToExport', 'invoices to export')}`,
      preparedData: { quarter: quarterName, invoiceCount: paidInvoiceCount },
      actionLabel: t('automation.exportDocs', 'Export'),
      estimatedImpact: t('automation.taxCompliance', 'Tax compliance'),
      expiresAt: new Date(now + 10 * dayMs).toISOString(),
      sourceGeneratorId: 'automation_tax_prep',
    });
    if (id) added++;
  }

  // ─── WIRED: Decision reminder — pending customer decisions > 3 days ───
  try {
    const trackersRaw = await AsyncStorage.getItem('@vasco_decision_trackers');
    const trackers: any[] = trackersRaw ? JSON.parse(trackersRaw) : [];
    for (const tracker of trackers) {
      if (!tracker || tracker.status !== 'active' || !Array.isArray(tracker.categories)) continue;
      for (const cat of tracker.categories) {
        if (!Array.isArray(cat.items)) continue;
        const pendingItems = cat.items.filter((item: any) => item.status === 'pending');
        // Check if any pending item is overdue (category dueDate passed by 3+ days, or tracker created 3+ days ago)
        const dueDate = new Date(cat.dueDate || tracker.createdAt || '').getTime();
        if (!dueDate || (now - dueDate) < 3 * dayMs) continue;
        const daysOverdue = Math.ceil((now - dueDate) / dayMs);
        if (pendingItems.length === 0) continue;
        const pendingNames = pendingItems.slice(0, 3).map((item: any) => item.name || '').filter(Boolean).join(', ');
        const customerName = tracker.customerName || '';
        const jobTitle = tracker.templateName || '';
        const decIntel = tracker.customerId ? getCustomerIntelligence(tracker.customerId, context.allJobs ?? [], context.allInvoices ?? []) : null;
        const message = t('automation.decisionReminderMsg', {
          defaultValue: 'Hi {{customer}}, we need your decisions on {{items}} for {{job}} to keep the project on schedule. Could you let us know?',
          customer: customerName,
          items: pendingNames,
          job: jobTitle,
        });
        const id = await addToQueue({
          type: 'decision_reminder',
          title: t('automation.decisionReminder', { defaultValue: 'Decision needed: {{customer}}', customer: customerName }),
          description: `${pendingItems.length} ${t('automation.pendingDecisions', 'pending decisions')} · ${daysOverdue} ${t('automation.daysOverdue', 'days overdue')}`,
          preparedData: {
            trackerId: tracker.id,
            jobId: tracker.jobId,
            customerId: tracker.customerId,
            customerName,
            categoryName: cat.name,
            pendingItems: pendingNames,
            template: message,
            ...(decIntel?.contextLine ? { customerContext: decIntel.contextLine } : {}),
          },
          actionLabel: t('common.send', 'Verstuur'),
          estimatedImpact: t('automation.preventsDelay', 'Prevents delay'),
          expiresAt: new Date(now + 3 * dayMs).toISOString(),
          sourceGeneratorId: `automation_decision_${tracker.id}_${cat.id}`,
        });
        if (id) added++;
        if (added > 25) break;
      }
      if (added > 25) break;
    }
  } catch {
    // Decision tracking is best-effort — never block queue population
  }

  // ─── WIRED: Draft quote from repeat customer ───
  // If a customer had a completed job but no active quote, suggest a repeat quote
  const completedCustomerIds = new Set(
    (context.allJobs ?? [])
      .filter((j: any) => (j.status === 'completed' || j.status === 'gereed') && j.customerId)
      .map((j: any) => j.customerId)
  );
  const activeCustomerIds = new Set(
    (context.allJobs ?? [])
      .filter((j: any) => !['completed', 'gereed', 'paid', 'cancelled'].includes(j.status) && j.customerId)
      .map((j: any) => j.customerId)
  );
  for (const custId of completedCustomerIds) {
    if (activeCustomerIds.has(custId)) continue; // Already has active work
    const lastJob = (context.allJobs ?? [])
      .filter((j: any) => j.customerId === custId && (j.status === 'completed' || j.status === 'gereed'))
      .sort((a: any, b: any) => (b.completedAt || '').localeCompare(a.completedAt || ''))[0];
    if (!lastJob) continue;
    const completedAt = new Date(lastJob.completedAt || '').getTime();
    if (!completedAt || (now - completedAt) < 30 * dayMs) continue; // Wait 30 days
    const cust = (context.customers ?? []).find((c: any) => c.id === custId);
    const id = await addToQueue({
      type: 'draft_quote',
      title: t('automation.repeatQuote', { defaultValue: 'Repeat quote: {{customer}}', customer: cust?.name || '' }),
      description: `${t('automation.lastJob', 'Last job')}: ${lastJob.title || ''}`,
      preparedData: { customerId: custId, lastJobId: lastJob.id, lastJobTitle: lastJob.title },
      actionLabel: t('automation.createQuote', 'Create quote'),
      estimatedImpact: t('automation.repeatBusiness', 'Repeat business'),
      expiresAt: new Date(now + 14 * dayMs).toISOString(),
      sourceGeneratorId: 'automation_repeat_quote',
    });
    if (id) added++;
    if (added > 25) break;
  }

  // ─── WIRED: Bulk purchase opportunity ───
  // If 3+ upcoming jobs need the same material category, suggest bulk order
  const upcomingMaterials: Map<string, { jobs: string[]; totalQty: number; unitPrice: number }> = new Map();
  for (const job of (context.allJobs ?? []).filter((j: any) => ['scheduled', 'in-progress', 'ingepland', 'bezig'].includes(j.status))) {
    for (const m of (job.materials ?? [])) {
      const key = (m.name || m.description || '').toLowerCase();
      if (!key) continue;
      const entry = upcomingMaterials.get(key) ?? { jobs: [] as string[], totalQty: 0, unitPrice: m.unitPrice ?? 0 };
      entry.jobs.push(job.id);
      entry.totalQty += m.quantity ?? 1;
      upcomingMaterials.set(key, entry);
    }
  }
  for (const [name, data] of upcomingMaterials) {
    if (data.jobs.length < 2) continue; // Need 2+ jobs
    const savings = Math.round(data.totalQty * data.unitPrice * 0.1); // ~10% bulk discount
    if (savings < 20) continue; // Not worth it
    const id = await addToQueue({
      type: 'bulk_purchase',
      title: t('automation.bulkOpportunity', { defaultValue: 'Bulk order: {{name}}', name }),
      description: `${data.jobs.length} ${t('automation.jobsNeed', 'jobs need')} ${data.totalQty}x · ${t('automation.save', 'save')} ${formatMoney(savings)}`,
      preparedData: { materialName: name, jobCount: data.jobs.length, totalQty: data.totalQty, estimatedSavings: savings },
      actionLabel: t('automation.orderBulk', 'Order bulk'),
      estimatedImpact: `${formatMoney(savings)} ${t('automation.savings', 'savings')}`,
      expiresAt: new Date(now + 7 * dayMs).toISOString(),
      sourceGeneratorId: 'automation_bulk_purchase',
    });
    if (id) added++;
    if (added > 25) break;
  }

  // ─── NEW: Accounting export for unexported paid invoices ───
  const unexportedPaid = (context.allInvoices ?? []).filter((i: any) => i.status === 'paid' && !i.exportedAt);
  if (unexportedPaid.length > 0) {
    const totalAmount = unexportedPaid.reduce((s: number, i: any) => s + (i.amount ?? 0), 0);
    const id = await addToQueue({
      type: 'accounting_export',
      title: t('automation.accountingExport', { defaultValue: 'Export {{count}} invoices to accounting', count: unexportedPaid.length }),
      description: `${formatMoney(totalAmount)} ${t('automation.revenue', 'revenue')}`,
      preparedData: {
        invoiceIds: unexportedPaid.map((i: any) => i.id), count: unexportedPaid.length, totalAmount,
        reasoning: `${unexportedPaid.length} paid invoices not yet in your accounting system. Export now to keep books current.`,
      },
      actionLabel: t('automation.export', 'Export'),
      estimatedImpact: t('automation.savesAdmin', 'Saves admin time'),
      expiresAt: new Date(now + 7 * dayMs).toISOString(),
      sourceGeneratorId: 'automation_accounting_export',
    });
    if (id) added++;
  }

  // ─── NEW: E-invoice submission for countries that require it ───
  const EINVOICE_COUNTRIES: Record<string, string> = { DE: 'XRechnung', FR: 'Factur-X', IT: 'FatturaPA', ES: 'Facturae' };
  const einvoiceCountry = context.country || 'NL';
  const einvoiceFormat = EINVOICE_COUNTRIES[einvoiceCountry];
  if (einvoiceFormat) {
    const sentInvoices = (context.allInvoices ?? []).filter((i: any) => i.status === 'sent' && !i.einvoiceSubmitted);
    for (const inv of sentInvoices.slice(0, 3)) {
      const id = await addToQueue({
        type: 'einvoice_submit',
        title: `${einvoiceFormat}: ${queueEntityLabel(inv, context.customers)}`,
        description: `${formatMoney((inv.amount ?? 0))} · ${einvoiceFormat} format`,
        preparedData: { invoiceId: inv.id, format: einvoiceFormat, country: einvoiceCountry },
        actionLabel: t('automation.submit', 'Submit'),
        estimatedImpact: t('automation.legalCompliance', 'Legal compliance'),
        expiresAt: new Date(now + 5 * dayMs).toISOString(),
        sourceGeneratorId: `automation_einvoice_${inv.id}`,
      });
      if (id) added++;
    }
  }

  // ─── NEW: Price alerts from invoice scans (pricing moat) ───
  // Check recent scans for materials priced above market baseline
  try {
    const scanHistory = await getScanHistory();
    if (scanHistory.length > 0) {
      // Use the most recent scan's trade category, fall back to 'general'
      const recentTrade = scanHistory[0]?.lineItems?.[0]?.category || 'general';
      const allScannedItems = scanHistory
        .slice(0, 5) // Check last 5 scans
        .flatMap(s => s.lineItems);
      const insights = getFirstScanInsights(allScannedItems, recentTrade);

      for (const item of insights.slice(0, 3)) {
        if (item.priceVsMarket <= 1.1) continue; // Only alert if 10%+ above market
        const pctAbove = Math.round((item.priceVsMarket - 1) * 100);
        const id = await addToQueue({
          type: 'price_alert',
          title: t('automation.overpaying', {
            defaultValue: 'Overpaying for {{name}}',
            name: item.name,
          }),
          description: `${formatMoney(item.scannedPrice)} → ${formatMoney(item.marketAvg)} (${pctAbove}% ${t('automation.aboveMarket', 'above market')})`,
          preparedData: {
            materialName: item.name,
            scannedPrice: item.scannedPrice,
            marketAvg: item.marketAvg,
            savings: item.savings,
            cheaperSupplier: item.cheaperSupplier,
            priceVsMarket: item.priceVsMarket,
            reasoning: `${item.name} costs ${formatMoney(item.scannedPrice)} — ${pctAbove}% above the market average of ${formatMoney(item.marketAvg)}. ${item.cheaperSupplier ? `${item.cheaperSupplier} offers better rates.` : 'Switching suppliers could save significantly.'}`,
          },
          actionLabel: t('automation.compareSuppliers', 'Compare'),
          estimatedImpact: `${formatMoney(item.savings)} ${t('automation.savings', 'savings')}`,
          expiresAt: new Date(now + 7 * dayMs).toISOString(),
          sourceGeneratorId: `automation_price_alert_${item.name.slice(0, 20)}`,
        });
        if (id) added++;
      }

      // ─── Monthly savings summary ───
      // After 30+ days of use, summarize all overpaying items
      const oldestScan = scanHistory[scanHistory.length - 1];
      const oldestScanAge = oldestScan ? now - new Date(oldestScan.scannedAt).getTime() : 0;
      if (oldestScanAge >= 30 * dayMs && insights.length > 0) {
        const overpayingItems = insights.filter(i => i.priceVsMarket > 1.05);
        const totalMonthlySavings = overpayingItems.reduce((s, i) => s + i.savings, 0);
        if (overpayingItems.length > 0 && totalMonthlySavings > 10) {
          const id = await addToQueue({
            type: 'supplier_comparison',
            title: t('automation.monthlySavings', {
              defaultValue: 'Monthly savings report: {{count}} items',
              count: overpayingItems.length,
            }),
            description: t('automation.monthlySavingsDesc', {
              defaultValue: 'Switch suppliers to save {{amount}}/month',
              amount: formatMoney(totalMonthlySavings),
            }),
            preparedData: {
              overpayingItems: overpayingItems.map(i => ({
                name: i.name,
                scannedPrice: i.scannedPrice,
                marketAvg: i.marketAvg,
                savings: i.savings,
                cheaperSupplier: i.cheaperSupplier,
              })),
              totalMonthlySavings: Math.round(totalMonthlySavings),
              itemCount: overpayingItems.length,
            },
            actionLabel: t('automation.viewSavings', 'View savings'),
            estimatedImpact: `${formatMoney(totalMonthlySavings)} / ${t('automation.month', 'month')}`,
            expiresAt: new Date(now + 14 * dayMs).toISOString(),
            sourceGeneratorId: 'automation_monthly_savings',
          });
          if (id) added++;
        }
      }
    }
  } catch {
    // Price intelligence is best-effort — never block queue population
  }

  // ─── Permit renewal for expired/expiring permits ───
  const certs = (context as any).certs ?? [];
  for (const cert of certs) {
    if (!cert || !cert.expiryDate) continue;
    const expiry = new Date(cert.expiryDate).getTime();
    if (isNaN(expiry)) continue;
    const daysLeft = Math.ceil((expiry - now) / dayMs);
    if (daysLeft > 30 || daysLeft < -365) continue; // Only within 30 days of expiry or up to 1 year expired
    const id = await addToQueue({
      type: 'permit_renewal',
      title: daysLeft < 0
        ? t('automation.permitExpired', { defaultValue: '{{name}} expired {{days}} days ago', name: cert.name || cert.type || 'Permit', days: Math.abs(daysLeft) })
        : t('automation.permitExpiring', { defaultValue: '{{name}} expires in {{days}} days', name: cert.name || cert.type || 'Permit', days: daysLeft }),
      description: cert.issuedBy || cert.authority || '',
      preparedData: { certId: cert.id, certName: cert.name, expiryDate: cert.expiryDate, renewalUrl: cert.renewalUrl, daysLeft },
      actionLabel: daysLeft < 0 ? t('automation.renewNow', 'Renew now') : t('automation.planRenewal', 'Plan renewal'),
      estimatedImpact: t('automation.staysCompliant', 'Stays compliant'),
      expiresAt: new Date(now + 14 * dayMs).toISOString(),
      sourceGeneratorId: `automation_permit_renewal_${cert.id || cert.name}`,
    });
    if (id) added++;
    if (added > 30) break;
  }

  // ─── Safety checklist for site lead jobs ───
  const siteLeadJobs = (context.allJobs ?? []).filter((j: any) => {
    const created = new Date(j.createdAt || '').getTime();
    return created && (now - created) < 2 * dayMs && j.siteId && j.status !== 'completed';
  });
  for (const job of siteLeadJobs.slice(0, 2)) {
    const id = await addToQueue({
      type: 'safety_checklist',
      title: t('automation.safetyChecklist', { defaultValue: 'Safety checklist: {{title}}', title: job.title || '' }),
      description: t('automation.safetyChecklistDesc', 'Review safety requirements before starting work'),
      preparedData: { jobId: job.id, siteId: job.siteId, trade: job.trade },
      actionLabel: t('automation.reviewSafety', 'Review'),
      estimatedImpact: t('automation.safetyCompliance', 'Safety compliance'),
      expiresAt: new Date(now + 3 * dayMs).toISOString(),
      sourceGeneratorId: `automation_safety_${job.id}`,
    });
    if (id) added++;
  }

  // ─── TRADE-SPECIFIC AI SUGGESTIONS ───────────────────────────────────────
  // Load user's trade from onboarding preferences to generate relevant suggestions
  const userPrefs = await loadOnboardingPreferences().catch(() => null);
  const userTrade = userPrefs?.trades?.[0] ?? '';

  // Solar: grid connection + subsidy reminders
  if (userTrade === 'solar') {
    const id = await addToQueue({
      type: 'permit_check',
      title: t('automation.solarGridApp', { defaultValue: 'Grid connection application' }),
      description: t('automation.solarGridAppDesc', { defaultValue: 'Check if grid operator notification is needed for this installation' }),
      preparedData: { trade: 'solar', checkType: 'grid_connection' },
      actionLabel: t('automation.check', 'Check'),
      estimatedImpact: t('automation.complianceRequired', 'Required for commissioning'),
      expiresAt: new Date(now + 14 * dayMs).toISOString(),
      sourceGeneratorId: 'trade_solar_grid',
    });
    if (id) added++;
  }

  // Roofing: weather check before roof work
  if (userTrade === 'roofing') {
    const id = await addToQueue({
      type: 'schedule_suggestion',
      title: t('automation.roofWeatherCheck', { defaultValue: 'Weather check for upcoming roof work' }),
      description: t('automation.roofWeatherCheckDesc', { defaultValue: 'Rain or high winds forecast — review schedule for outdoor roof work' }),
      preparedData: { trade: 'roofing', checkType: 'weather' },
      actionLabel: t('automation.reviewSchedule', 'Review schedule'),
      estimatedImpact: t('automation.avoidDelay', 'Avoid weather delays'),
      expiresAt: new Date(now + 2 * dayMs).toISOString(),
      sourceGeneratorId: 'trade_roofing_weather',
    });
    if (id) added++;
  }

  // Insulation: subsidy deadline tracking (ISDE in NL, RGE in FR, KfW in DE)
  if (userTrade === 'insulation') {
    const subsidyName = context.country === 'NL' ? 'ISDE' : context.country === 'FR' ? 'MaPrimeRénov' : context.country === 'DE' ? 'KfW/BEG' : 'Energy subsidy';
    const id = await addToQueue({
      type: 'permit_check',
      title: t('automation.subsidyDeadline', { defaultValue: '{{subsidy}} subsidy deadline approaching', subsidy: subsidyName }),
      description: t('automation.subsidyDeadlineDesc', { defaultValue: 'Remind customers about energy renovation subsidies — drives conversions' }),
      preparedData: { trade: 'insulation', checkType: 'subsidy', subsidyProgram: subsidyName, country: context.country },
      actionLabel: t('automation.viewDetails', 'View details'),
      estimatedImpact: t('automation.customerConversion', 'Customer conversion'),
      expiresAt: new Date(now + 30 * dayMs).toISOString(),
      sourceGeneratorId: 'trade_insulation_subsidy',
    });
    if (id) added++;
  }

  // Landscaping: seasonal planting window
  if (userTrade === 'landscaping') {
    const month = new Date().getMonth(); // 0-11
    const isPlantingSeason = month >= 2 && month <= 4 || month >= 8 && month <= 10;
    if (isPlantingSeason) {
      const id = await addToQueue({
        type: 'schedule_suggestion',
        title: t('automation.plantingSeason', { defaultValue: 'Planting season — schedule garden projects' }),
        description: t('automation.plantingSeasonDesc', { defaultValue: 'Optimal planting window open — reach out to pending quotes for garden work' }),
        preparedData: { trade: 'landscaping', checkType: 'seasonal' },
        actionLabel: t('automation.followUpQuotes', 'Follow up quotes'),
        estimatedImpact: t('automation.seasonalRevenue', 'Seasonal revenue boost'),
        expiresAt: new Date(now + 14 * dayMs).toISOString(),
        sourceGeneratorId: 'trade_landscaping_season',
      });
      if (id) added++;
    }
  }

  // Glazing: energy label improvement suggestion
  if (userTrade === 'glazing') {
    const id = await addToQueue({
      type: 'draft_quote',
      title: t('automation.energyLabelUpgrade', { defaultValue: 'HR++ upgrade campaign' }),
      description: t('automation.energyLabelUpgradeDesc', { defaultValue: 'Customers with single glazing may qualify for energy subsidies — send upgrade offers' }),
      preparedData: { trade: 'glazing', checkType: 'energy_upgrade' },
      actionLabel: t('automation.createCampaign', 'Create campaign'),
      estimatedImpact: t('automation.leadGeneration', 'Lead generation'),
      expiresAt: new Date(now + 30 * dayMs).toISOString(),
      sourceGeneratorId: 'trade_glazing_energy',
    });
    if (id) added++;
  }

  return added;
}

// ---------------------------------------------------------------------------
// Permit requirements by trade + country
// ---------------------------------------------------------------------------

/** Exported so workflowPackService can populate its permit-check copy with a
 * REAL requirement count instead of leaving {{permitCount}} empty. */
export function getRequiredPermits(trade: string, country: string): { name: string; authority: string; url: string }[] {
  // Common permits required for ALL trades in each country
  const commonPermits: Record<string, { name: string; authority: string; url: string }[]> = {
    NL: [
      { name: 'KvK Registration', authority: 'Kamer van Koophandel', url: 'https://www.kvk.nl' },
      { name: 'AVB Aansprakelijkheidsverzekering', authority: 'Verbond van Verzekeraars', url: 'https://www.verzekeraars.nl' },
    ],
    DE: [
      { name: 'Handwerksrolle Registration', authority: 'Handwerkskammer', url: 'https://www.handwerkskammer.de' },
      { name: 'Betriebshaftpflichtversicherung', authority: 'GDV', url: 'https://www.gdv.de' },
      { name: 'BG Bau Membership', authority: 'Berufsgenossenschaft der Bauwirtschaft', url: 'https://www.bgbau.de' },
    ],
    FR: [
      { name: 'SIRET/SIREN Registration', authority: 'INSEE', url: 'https://www.insee.fr' },
      { name: 'Chambre des Métiers Registration', authority: 'Chambre de Métiers et de l\'Artisanat', url: 'https://www.artisanat.fr' },
      { name: 'Assurance Décennale', authority: 'FFSA', url: 'https://www.ffa-assurance.fr' },
    ],
    ES: [
      { name: 'NIF/CIF Registration', authority: 'Agencia Tributaria', url: 'https://www.agenciatributaria.es' },
      { name: 'RETA Registration', authority: 'Seguridad Social', url: 'https://www.seg-social.es' },
      { name: 'Seguro de Responsabilidad Civil', authority: 'DGSFP', url: 'https://www.dgsfp.mineco.es' },
    ],
    IT: [
      { name: 'Partita IVA', authority: 'Agenzia delle Entrate', url: 'https://www.agenziaentrate.gov.it' },
      { name: 'DURC (Regolarità Contributiva)', authority: 'INPS/INAIL', url: 'https://www.inps.it' },
      { name: 'Iscrizione Albo Artigiani', authority: 'Camera di Commercio', url: 'https://www.camcom.gov.it' },
    ],
    UK: [
      { name: 'Companies House Registration (Ltd) or HMRC Self-Employment', authority: 'HMRC / Companies House', url: 'https://www.gov.uk/set-up-business' },
      { name: 'Public Liability Insurance', authority: 'FCA', url: 'https://www.fca.org.uk' },
    ],
  };

  // Trade-specific permits per country (on top of common permits)
  const tradePermits: Record<string, Record<string, { name: string; authority: string; url: string }[]>> = {
    plumbing: {
      NL: [
        { name: 'KIWA Certification', authority: 'Kiwa Nederland', url: 'https://www.kiwa.com/nl' },
        { name: 'Scios Scope 8 (Gas Work)', authority: 'Scios Certificatie', url: 'https://www.scios.nl' },
      ],
      DE: [
        { name: 'Meisterbrief (Anlage A)', authority: 'Handwerkskammer', url: 'https://www.handwerkskammer.de' },
        { name: 'DVGW Certification', authority: 'Deutscher Verein des Gas- und Wasserfaches', url: 'https://www.dvgw.de' },
      ],
      FR: [
        { name: 'Qualification RGE (Energy Work)', authority: 'Qualibat', url: 'https://www.qualibat.com' },
      ],
      ES: [
        { name: 'Licencia de Actividad', authority: 'Ayuntamiento', url: 'https://administracion.gob.es' },
        { name: 'Carné de Instalador', authority: 'Comunidad Autónoma', url: 'https://administracion.gob.es' },
      ],
      IT: [
        { name: 'DM 37/08 (Lettera A) — Impianti Idraulici', authority: 'Camera di Commercio', url: 'https://www.camcom.gov.it' },
      ],
      UK: [
        { name: 'City & Guilds Plumbing Qualification', authority: 'City & Guilds', url: 'https://www.cityandguilds.com' },
        { name: 'Unvented Hot Water Certificate', authority: 'City & Guilds / BPEC', url: 'https://www.bpec.org.uk' },
      ],
    },
    electrical: {
      NL: [
        { name: 'NEN 1010 Certification', authority: 'NEN (Nederlands Normalisatie-instituut)', url: 'https://www.nen.nl' },
      ],
      DE: [
        { name: 'Meisterbrief (Anlage A)', authority: 'Handwerkskammer', url: 'https://www.handwerkskammer.de' },
        { name: 'Elektrofachkraft Certification', authority: 'VDE', url: 'https://www.vde.com' },
      ],
      FR: [
        { name: 'Consuel Certification', authority: 'Consuel', url: 'https://www.consuel.com' },
        { name: 'Habilitation Electrique', authority: 'INRS', url: 'https://www.inrs.fr' },
      ],
      ES: [
        { name: 'REBT Certification', authority: 'Ministerio de Industria', url: 'https://industria.gob.es' },
        { name: 'Certificado Instalador Electricista', authority: 'Comunidad Autónoma', url: 'https://administracion.gob.es' },
      ],
      IT: [
        { name: 'DM 37/08 (Lettera A) — Impianti Elettrici', authority: 'Camera di Commercio', url: 'https://www.camcom.gov.it' },
        { name: 'CEI Certification', authority: 'Comitato Elettrotecnico Italiano', url: 'https://www.ceinorme.it' },
      ],
      UK: [
        { name: 'Part P (Building Regulations) Competent Person', authority: 'DCLG', url: 'https://www.gov.uk/building-regulations-competent-person-schemes' },
        { name: 'NICEIC or ELECSA Registration', authority: 'NICEIC / ELECSA', url: 'https://www.niceic.com' },
      ],
    },
    gas: {
      NL: [
        { name: 'Scios Scope 8', authority: 'Scios Certificatie', url: 'https://www.scios.nl' },
        { name: 'F-gassen Certificering', authority: 'STEK / Rijksoverheid', url: 'https://www.rijksoverheid.nl' },
      ],
      DE: [
        { name: 'Meisterbrief (Anlage A)', authority: 'Handwerkskammer', url: 'https://www.handwerkskammer.de' },
        { name: 'DVGW Certification', authority: 'Deutscher Verein des Gas- und Wasserfaches', url: 'https://www.dvgw.de' },
      ],
      FR: [
        { name: 'Qualigaz Certification', authority: 'Qualigaz', url: 'https://www.qualigaz.com' },
        { name: 'PG Certification (Professionnel du Gaz)', authority: 'PG / Qualigaz', url: 'https://www.qualigaz.com' },
      ],
      ES: [
        { name: 'Certificado Instalador Gas (Tipo A/B)', authority: 'Ministerio de Industria', url: 'https://industria.gob.es' },
      ],
      IT: [
        { name: 'DM 37/08 (Lettera C) — Impianti Gas', authority: 'Camera di Commercio', url: 'https://www.camcom.gov.it' },
        { name: 'Certificato Prevenzione Incendi', authority: 'Vigili del Fuoco', url: 'https://www.vigilfuoco.it' },
      ],
      UK: [
        { name: 'Gas Safe Register (MANDATORY)', authority: 'Gas Safe Register', url: 'https://www.gassaferegister.co.uk' },
      ],
    },
    painting: {
      NL: [
        { name: 'VCA-VOL Safety Certificate', authority: 'SSVV', url: 'https://www.vca.nl' },
      ],
      DE: [
        { name: 'Meisterbrief (Anlage A)', authority: 'Handwerkskammer', url: 'https://www.handwerkskammer.de' },
      ],
      FR: [
        { name: 'Qualification Qualibat', authority: 'Qualibat', url: 'https://www.qualibat.com' },
      ],
      ES: [
        { name: 'Licencia de Actividad', authority: 'Ayuntamiento', url: 'https://administracion.gob.es' },
      ],
      IT: [
        { name: 'Attestazione SOA (Public Works)', authority: 'Organismi di Attestazione', url: 'https://www.anticorruzione.it' },
      ],
      UK: [
        { name: 'CSCS Card (Construction Skills)', authority: 'CSCS', url: 'https://www.cscs.uk.com' },
      ],
    },
    carpentry: {
      NL: [
        { name: 'VCA-VOL Safety Certificate', authority: 'SSVV', url: 'https://www.vca.nl' },
      ],
      DE: [
        { name: 'Meisterbrief (Anlage A)', authority: 'Handwerkskammer', url: 'https://www.handwerkskammer.de' },
      ],
      FR: [
        { name: 'Qualification Qualibat', authority: 'Qualibat', url: 'https://www.qualibat.com' },
      ],
      ES: [
        { name: 'Licencia de Actividad', authority: 'Ayuntamiento', url: 'https://administracion.gob.es' },
      ],
      IT: [
        { name: 'Attestazione SOA (Public Works)', authority: 'Organismi di Attestazione', url: 'https://www.anticorruzione.it' },
      ],
      UK: [
        { name: 'CSCS Card (Construction Skills)', authority: 'CSCS', url: 'https://www.cscs.uk.com' },
        { name: 'NVQ Level 2+ in Carpentry', authority: 'City & Guilds', url: 'https://www.cityandguilds.com' },
      ],
    },
    general: {
      NL: [],
      DE: [
        { name: 'Gewerbeanmeldung', authority: 'Gewerbeamt', url: 'https://www.gewerbeanmeldung.de' },
      ],
      FR: [],
      ES: [],
      IT: [],
      UK: [],
    },
  };

  const common = commonPermits[country] ?? [];
  const specific = tradePermits[trade]?.[country] ?? tradePermits['general']?.[country] ?? [];
  return [...common, ...specific];
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useAIQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const processingRef = useRef(new Set<string>());

  const refresh = useCallback(() => {
    getQueue().then(setItems).finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Re-read when anything mutates the queue. The background scheduler populates
  // the queue seconds AFTER this hook mounts, and Expo Router keeps tab screens
  // mounted so the effect above never re-runs — without this subscription a
  // fresh install shows an empty AI queue until the app is restarted.
  useEffect(() => subscribeQueueChanges(refresh), [refresh]);

  const approve = useCallback(async (id: string, editedText?: string) => {
    if (processingRef.current.has(id)) return null; // Prevent double-tap
    processingRef.current.add(id);
    try {
      const item = await approveItem(id, editedText ? { editedText } : undefined);
      setItems(prev => prev.filter(i => i.id !== id));
      return item;
    } finally {
      processingRef.current.delete(id);
    }
  }, []);

  const reject = useCallback(async (id: string) => {
    if (processingRef.current.has(id)) return; // Prevent double-tap
    processingRef.current.add(id);
    try {
      await rejectItem(id);
      setItems(prev => prev.filter(i => i.id !== id));
    } finally {
      processingRef.current.delete(id);
    }
  }, []);

  const snooze = useCallback(async (id: string, hours: number) => {
    if (processingRef.current.has(id)) return;
    processingRef.current.add(id);
    try {
      await snoozeQueueItem(id, hours);
      setItems(prev => prev.filter(i => i.id !== id));
    } finally {
      processingRef.current.delete(id);
    }
  }, []);

  return { items, loading, approve, reject, snooze, refresh, count: items.length };
}

// =============================================================================
// R25: business-event helpers — queue customer-facing message drafts when
// real business events fire (clock-in, mark-invoice-sent, etc). Closes the
// last R3 deferrals where these triggers were defined in the MessageTrigger
// taxonomy but never auto-fired anywhere. Each helper queues a `progress_note`
// or `draft_reminder` item with a pre-rendered template so R286's executor
// opens the Share sheet directly on Approve.
// =============================================================================

/**
 * Fired when contractor clocks in to a job. Queues a one-tap "On my way"
 * customer-facing notice with the customer's name + ETA.
 */
export async function queueOnMyWay(args: {
  jobId: string;
  jobTitle: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
}): Promise<string> {
  const t = i18n.t.bind(i18n);
  const customerLabel = args.customerName?.trim() || args.customerId || '';
  const template = t('messageTrigger.onMyWayBody', {
    defaultValue: 'Hi {{customer}}, I\'m on my way to start work on {{title}} now. See you shortly.',
    customer: customerLabel,
    title: args.jobTitle,
  });
  return addToQueue({
    type: 'progress_note',
    title: t('messageTrigger.onMyWayTitle', {
      defaultValue: 'Notify {{customer}}: on my way',
      customer: customerLabel || t('messageTrigger.theCustomer', 'the customer'),
    }),
    description: t('messageTrigger.onMyWayDesc', { defaultValue: 'You just clocked in — quick courtesy heads-up.' }),
    preparedData: { jobId: args.jobId, customerId: args.customerId, customerPhone: args.customerPhone, template },
    actionLabel: t('common.send', 'Send'),
    estimatedImpact: t('messageTrigger.onMyWayImpact', { defaultValue: 'Builds trust' }),
    expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4h — beyond that the visit is stale
    sourceGeneratorId: 'event_on_my_way',
    entityKey: `on_my_way:${args.jobId}`,
  });
}

/**
 * Fired when an invoice flips to paid (manual mark-paid OR Mollie/Stripe
 * webhook). Queues a same-day thank-you draft. The eveLiveActionService
 * also sleeps a 24h-window thanks for daily-cadence catchup; this immediate
 * one fires for contractors who watch the app.
 */
export async function queuePaymentReceivedThanks(args: {
  invoiceId: string;
  customerId?: string;
  customerName?: string;
  amount?: number;
}): Promise<string> {
  const t = i18n.t.bind(i18n);
  const customerLabel = args.customerName?.trim() || args.customerId || '';
  const template = t('messageTrigger.paidThanksBody', {
    defaultValue: 'Thanks {{customer}} — payment received for invoice {{invoice}} ({{amount}}). Receipt on its way.',
    customer: customerLabel,
    invoice: args.invoiceId,
    amount: formatMoney2(args.amount ?? 0),
  });
  return addToQueue({
    type: 'satisfaction_survey',
    title: t('messageTrigger.paidThanksTitle', {
      defaultValue: 'Thank {{customer}} for payment',
      customer: customerLabel || t('messageTrigger.theCustomer', 'the customer'),
    }),
    description: t('messageTrigger.paidThanksDesc', { defaultValue: 'Payment received — quick thanks builds repeat business.' }),
    preparedData: { invoiceId: args.invoiceId, customerId: args.customerId, template },
    actionLabel: t('common.send', 'Send'),
    estimatedImpact: t('messageTrigger.paidThanksImpact', { defaultValue: 'Builds repeat business' }),
    expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    sourceGeneratorId: 'event_payment_received',
    entityKey: `paid_thanks:${args.invoiceId}`,
  });
}

/**
 * Fired when contractor marks an invoice as sent. Queues a customer-facing
 * "Invoice on its way" heads-up so the customer expects it. Sits alongside
 * the existing `schedulePaymentReminder` push (contractor-side reminder).
 */
export async function queueInvoiceSentNotice(args: {
  invoiceId: string;
  customerId?: string;
  customerName?: string;
  amount?: number;
  dueInDays?: number;
}): Promise<string> {
  const t = i18n.t.bind(i18n);
  const customerLabel = args.customerName?.trim() || args.customerId || '';
  const template = t('messageTrigger.invoiceSentBody', {
    defaultValue: 'Hi {{customer}}, invoice {{invoice}} ({{amount}}) is on its way. Payment terms: {{days}} days. Thanks!',
    customer: customerLabel,
    invoice: args.invoiceId,
    amount: formatMoney2(args.amount ?? 0),
    days: args.dueInDays ?? 14,
  });
  return addToQueue({
    type: 'draft_reminder',
    title: t('messageTrigger.invoiceSentTitle', {
      defaultValue: 'Notify {{customer}}: invoice sent',
      customer: customerLabel || t('messageTrigger.theCustomer', 'the customer'),
    }),
    description: t('messageTrigger.invoiceSentDesc', { defaultValue: 'Heads-up so the customer expects the invoice.' }),
    preparedData: { invoiceId: args.invoiceId, customerId: args.customerId, template },
    actionLabel: t('common.send', 'Send'),
    estimatedImpact: t('messageTrigger.invoiceSentImpact', { defaultValue: 'Faster payment' }),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h — after that the invoice is no-longer-fresh
    sourceGeneratorId: 'event_invoice_sent',
    entityKey: `invoice_sent:${args.invoiceId}`,
  });
}

// =============================================================================
// AI DATA COLLECTOR — feeds the data moat from every user action
// =============================================================================
// Captures business events from the accounting loop + daily operations
// Stores locally (AsyncStorage) + syncs to Supabase for cross-user learning
// =============================================================================

import { supabase as _supabase, isSupabaseConfigured } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
const supabase: any = _supabase;

const LOCAL_QUEUE_KEY = '@vasco_event_queue';
const MAX_LOCAL_QUEUE = 500;
const BATCH_SIZE = 50;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BusinessEvent {
  eventType: string;
  entityType: 'quote' | 'job' | 'invoice' | 'customer' | 'material' | 'payment' | 'user';
  entityId: string;
  payload: Record<string, any>;
  trade?: string;
  country?: string;
  screenContext?: string;
}

interface QueuedEvent extends BusinessEvent {
  id: string;
  userId: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Event emission — call from anywhere in the app
// ---------------------------------------------------------------------------

export async function emitBusinessEvent(
  userId: string,
  event: BusinessEvent,
): Promise<void> {
  const queuedEvent: QueuedEvent = {
    ...event,
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    timestamp: new Date().toISOString(),
  };

  // Always store locally first (offline-first)
  await enqueueLocally(queuedEvent);

  // Try to sync to cloud
  if (isSupabaseConfigured) {
    await flushToCloud(userId);
  }
}

// ---------------------------------------------------------------------------
// Convenience emitters for common events
// ---------------------------------------------------------------------------

export async function emitQuoteCreated(userId: string, quoteId: string, data: {
  customerId: string;
  totalAmount: number;
  lineItemCount: number;
  trade: string;
  jobType?: string;
}): Promise<void> {
  await emitBusinessEvent(userId, {
    eventType: 'quote_created',
    entityType: 'quote',
    entityId: quoteId,
    payload: data,
    trade: data.trade,
  });
}

export async function emitQuoteAccepted(userId: string, quoteId: string, data: {
  customerId: string;
  quotedAmount: number;
  acceptedAmount: number;
  daysToAccept: number;
  tierChosen?: string; // 'good', 'better', 'best' from TieredQuoteBuilder
}): Promise<void> {
  await emitBusinessEvent(userId, {
    eventType: 'quote_accepted',
    entityType: 'quote',
    entityId: quoteId,
    payload: data,
  });
}

export async function emitQuoteRejected(userId: string, quoteId: string, data: {
  customerId: string;
  quotedAmount: number;
  reason?: string;
}): Promise<void> {
  await emitBusinessEvent(userId, {
    eventType: 'quote_rejected',
    entityType: 'quote',
    entityId: quoteId,
    payload: data,
  });
}

export async function emitJobStarted(userId: string, jobId: string, data: {
  trade: string;
  jobType?: string;
  estimatedHours: number;
  crewSize: number;
}): Promise<void> {
  await emitBusinessEvent(userId, {
    eventType: 'job_started',
    entityType: 'job',
    entityId: jobId,
    payload: data,
    trade: data.trade,
  });
}

export async function emitJobCompleted(userId: string, jobId: string, data: {
  trade: string;
  jobType?: string;
  estimatedHours: number;
  actualHours: number;
  estimatedCost: number;
  actualCost: number;
  marginPercent: number;
  scopeChanges: number;
  materialDelays: boolean;
}): Promise<void> {
  await emitBusinessEvent(userId, {
    eventType: 'job_completed',
    entityType: 'job',
    entityId: jobId,
    payload: data,
    trade: data.trade,
  });
}

export async function emitInvoiceSent(userId: string, invoiceId: string, data: {
  customerId: string;
  amount: number;
  dueDate: string;
  paymentMethod?: string;
}): Promise<void> {
  await emitBusinessEvent(userId, {
    eventType: 'invoice_sent',
    entityType: 'invoice',
    entityId: invoiceId,
    payload: data,
  });
}

export async function emitPaymentReceived(userId: string, invoiceId: string, data: {
  customerId: string;
  amount: number;
  daysToPayment: number;
  paymentMethod: string;
  wasOverdue: boolean;
}): Promise<void> {
  await emitBusinessEvent(userId, {
    eventType: 'payment_received',
    entityType: 'payment',
    entityId: invoiceId,
    payload: data,
  });
}

export async function emitSignupCompleted(userId: string, data: {
  email: string;
  method: 'email' | 'demo' | 'oauth';
  source?: string; // e.g., 'landing_page', 'referral_link'
}): Promise<void> {
  await emitBusinessEvent(userId, {
    eventType: 'signup_completed',
    entityType: 'user',
    entityId: userId,
    payload: data,
  });
}

export async function emitOnboardingCompleted(userId: string, data: {
  country: string;
  trade: string;
  teamSize: string;
  tierSelected: string;
  stepsCompleted: number;
  durationSeconds: number;
}): Promise<void> {
  await emitBusinessEvent(userId, {
    eventType: 'onboarding_completed',
    entityType: 'user',
    entityId: userId,
    payload: data,
    trade: data.trade,
  });
}

export async function emitMaterialPurchased(userId: string, data: {
  materialName: string;
  supplierId: string;
  supplierName: string;
  price: number;
  quantity: number;
  unit: string;
  trade: string;
  jobId?: string;
}): Promise<void> {
  await emitBusinessEvent(userId, {
    eventType: 'material_purchased',
    entityType: 'material',
    entityId: `${data.supplierId}_${data.materialName}`,
    payload: data,
    trade: data.trade,
  });
}

// ---------------------------------------------------------------------------
// Pricing intelligence collection
// ---------------------------------------------------------------------------

export async function recordPricingData(userId: string, data: {
  trade: string;
  country: string;
  jobType?: string;
  lineDescription: string;
  quotedUnitPrice: number;
  quotedQuantity: number;
  vatRate: number;
  customerType?: string;
  region?: string;
  // R188: contractor segment for cohort slicing (additive, optional)
  contractorSegment?: ContractorSegment;
}): Promise<void> {
  if (!isSupabaseConfigured) return;

  const season = getSeason();
  try {
    const row: Record<string, unknown> = {
      user_id: userId,
      trade: data.trade,
      country: data.country,
      job_type: data.jobType,
      line_description: data.lineDescription,
      quoted_unit_price: data.quotedUnitPrice,
      quoted_quantity: data.quotedQuantity,
      quoted_total: data.quotedUnitPrice * data.quotedQuantity,
      vat_rate: data.vatRate,
      customer_type: data.customerType,
      region: data.region,
      season,
    };
    if (data.contractorSegment !== undefined) row.contractor_segment = data.contractorSegment;
    await supabase.from('pricing_intelligence').insert(row as any);
  } catch {
    // Silent fail — don't block the UI
  }
}

export type DeclineReason =
  | 'price_too_high'
  | 'chose_competitor'
  | 'scope_changed'
  | 'no_response'
  | 'timing'
  | 'customer_declined'
  | 'other';

export type ContractorSegment = 'solo' | 'small_team' | 'medium' | 'large';

export async function recordPricingOutcome(userId: string, quoteId: string, data: {
  wasAccepted: boolean;
  acceptedPrice?: number;
  actualCost?: number;
  actualHours?: number;
  marginPercent?: number;
  // R188: moat enrichment — all additive, all optional
  declineReason?: DeclineReason;
  timeToDecisionHours?: number;
  reminderCountBeforeDecision?: number;
  counterOfferAmount?: number;
  contractorSegment?: ContractorSegment;
}): Promise<void> {
  if (!isSupabaseConfigured) return;

  try {
    const patch: Record<string, unknown> = {
      was_accepted: data.wasAccepted,
      accepted_price: data.acceptedPrice,
      actual_cost: data.actualCost,
      actual_hours: data.actualHours,
      margin_percent: data.marginPercent,
      [data.wasAccepted ? 'accepted_at' : 'completed_at']: new Date().toISOString(),
    };
    // Only include new columns when the caller supplied them, so we don't
    // overwrite a previously-written value with null on a re-decision.
    if (data.declineReason !== undefined)               patch.decline_reason = data.declineReason;
    if (data.timeToDecisionHours !== undefined)         patch.time_to_decision_hours = data.timeToDecisionHours;
    if (data.reminderCountBeforeDecision !== undefined) patch.reminder_count_before_decision = data.reminderCountBeforeDecision;
    if (data.counterOfferAmount !== undefined)          patch.counter_offer_amount = data.counterOfferAmount;
    if (data.contractorSegment !== undefined)           patch.contractor_segment = data.contractorSegment;

    await supabase.from('pricing_intelligence')
      .update(patch)
      .eq('quote_id', quoteId)
      .eq('user_id', userId);

    // R239: also persist a labeled training pair for the retrain pipeline.
    // Decouples training data from live event tables — the schema can
    // evolve without breaking historical training reproducibility.
    try {
      const { data: piRow } = await (supabase.from as any)('pricing_intelligence')
        .select('trade, country, total_amount, customer_type, contractor_segment, line_count, quoted_at')
        .eq('quote_id', quoteId)
        .eq('user_id', userId)
        .maybeSingle();
      if (piRow) {
        await (supabase.rpc as any)('write_training_pair', {
          p_model_name: 'quote_win',
          p_user_id: userId,
          p_trade: piRow.trade ?? null,
          p_country: piRow.country ?? null,
          p_features: {
            total_amount: piRow.total_amount,
            customer_type: piRow.customer_type,
            contractor_segment: piRow.contractor_segment,
            line_count: piRow.line_count,
            month_num: new Date(piRow.quoted_at ?? Date.now()).getMonth() + 1,
            time_to_decision_hours: data.timeToDecisionHours ?? null,
            reminder_count: data.reminderCountBeforeDecision ?? null,
          },
          p_target: data.wasAccepted ? 1 : 0,
          p_target_label: data.wasAccepted ? 'accepted' : 'rejected',
          p_source: 'auto',
          p_weight: 1.0,
        });
      }
    } catch {
      // Best-effort — training-pair write failures must not block the outcome.
    }
  } catch {
    // Silent fail
  }
}

// ---------------------------------------------------------------------------
// Local queue management (offline-first)
// ---------------------------------------------------------------------------

async function enqueueLocally(event: QueuedEvent): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_QUEUE_KEY);
    const queue: QueuedEvent[] = raw ? JSON.parse(raw) : [];
    queue.push(event);

    // Trim if over limit
    const trimmed = queue.length > MAX_LOCAL_QUEUE ? queue.slice(-MAX_LOCAL_QUEUE) : queue;
    await AsyncStorage.setItem(LOCAL_QUEUE_KEY, JSON.stringify(trimmed));
  } catch {
    // Silent fail
  }
}

async function flushToCloud(userId: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  try {
    const raw = await AsyncStorage.getItem(LOCAL_QUEUE_KEY);
    if (!raw) return;

    const queue: QueuedEvent[] = JSON.parse(raw);
    if (queue.length === 0) return;

    // Take a batch
    const batch = queue.slice(0, BATCH_SIZE);
    const rows = batch.map(e => ({
      user_id: e.userId,
      event_type: e.eventType,
      entity_type: e.entityType,
      entity_id: e.entityId,
      payload: e.payload,
      trade: e.trade,
      country: e.country,
      screen_context: e.screenContext,
      created_at: e.timestamp,
    }));

    const { error } = await supabase.from('business_events').insert(rows);
    if (!error) {
      // Remove flushed events
      const remaining = queue.slice(BATCH_SIZE);
      await AsyncStorage.setItem(LOCAL_QUEUE_KEY, JSON.stringify(remaining));
    }
  } catch {
    // Will retry on next flush
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSeason(): string {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

// ---------------------------------------------------------------------------
// Flush timer (call from app root alongside cloudSync)
// ---------------------------------------------------------------------------

let flushTimer: ReturnType<typeof setInterval> | null = null;

export function startEventFlushing(userId: string): void {
  if (flushTimer) return;
  flushTimer = setInterval(() => flushToCloud(userId), 30_000); // every 30s
  flushToCloud(userId); // initial flush
}

export function stopEventFlushing(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

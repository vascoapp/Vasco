// =============================================================================
// AI DATA COLLECTOR — feeds the data moat from every user action
// =============================================================================
// Captures business events from the accounting loop + daily operations
// Stores locally (AsyncStorage) + syncs to Supabase for cross-user learning
// =============================================================================

import { supabase as _supabase, isSupabaseConfigured } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentTrade, getCurrentCountry } from '../lib/currentUser';
import { subscribeIdRemap, type IdRemapEvent } from '../services/idRemapBus';
import { isTempIdFast } from '../lib/idShape';
const supabase: any = _supabase;

const LOCAL_QUEUE_KEY = '@vasco_event_queue';
const MAX_LOCAL_QUEUE = 500;
const BATCH_SIZE = 50;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BusinessEvent {
  // Note: `business_events.entity_type` is a plain `text` column on the DB
  // (no CHECK constraint per SCHEMA_LOCK v1.6 Tier 2). Widening this FE
  // union is migration-free; the moat just gets new entity rows.
  eventType: string;
  entityType:
    | 'quote'
    | 'job'
    | 'invoice'
    | 'customer'
    | 'material'
    | 'payment'
    | 'user'
    | 'workflow_pack'
    | 'lead'      // R81 pipeline — new→qualified→won/lost transitions feed quote-win ML
    | 'worker'    // R86 crew — assignment + utilization feed duration ML + cohort benchmarks
    | 'license';  // R80 compliance — expiry events power renewal action queue
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

// R58: central gate against the legacy `'current-user'` placeholder. If
// any caller threads it (race-condition before login, or a stale
// closure that was missed in the audit), we drop the emit instead of
// writing a corrupt cohort row to the moat. business_events.user_id
// has a NOT NULL FK → auth.users(id) constraint anyway, so the BE
// would reject the row — this just keeps the local AsyncStorage queue
// from filling with permanently-rejected entries.
const PLACEHOLDER_USER_ID = 'current-user';

function isPlaceholderUserId(userId: string | null | undefined): boolean {
  return !userId || userId === PLACEHOLDER_USER_ID;
}

export async function emitBusinessEvent(
  userId: string,
  event: BusinessEvent,
): Promise<void> {
  if (isPlaceholderUserId(userId)) return;
  // R281: every business_events row needs (trade, country) for cohort
  // slicing — a painter in DE and FR are different markets entirely. Most
  // convenience emitters pass trade but not country, and several pass
  // neither. Default both from the currentUser ref so every emit, present
  // and future, is automatically cohort-attributed without each call site
  // having to thread it.
  const trade = event.trade ?? getCurrentTrade() ?? undefined;
  const country = event.country ?? getCurrentCountry() ?? undefined;
  const queuedEvent: QueuedEvent = {
    ...event,
    trade,
    country,
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

// ---------------------------------------------------------------------------
// Lead pipeline emitters (R81 + intelligence retrofit)
// Lead transitions feed the quote-win predictor: new→contacted→estimate_sent
// → won/lost. Source matters too (google_lsa vs referral have very different
// acceptance rates). All emits cohort-attributed via trade/country defaults.
// ---------------------------------------------------------------------------

export async function emitLeadCreated(userId: string, leadId: string, data: {
  source: string;
  estimatedValue?: number;
  customerId?: string;
  hasJobDescription: boolean;
}): Promise<void> {
  await emitBusinessEvent(userId, {
    eventType: 'lead_created',
    entityType: 'lead',
    entityId: leadId,
    payload: data,
  });
}

export async function emitLeadStatusChanged(userId: string, leadId: string, data: {
  fromStatus: string;
  toStatus: string;
  source: string;
  estimatedValue?: number;
  hoursInPreviousStatus?: number;
  sourceQuoteId?: string;
}): Promise<void> {
  await emitBusinessEvent(userId, {
    eventType: 'lead_status_changed',
    entityType: 'lead',
    entityId: leadId,
    payload: data,
  });
}

export async function emitLeadConverted(userId: string, leadId: string, data: {
  source: string;
  outcome: 'won' | 'lost';
  estimatedValue?: number;
  actualQuoteAmount?: number;
  sourceQuoteId?: string;
  hoursFromCreatedToConverted: number;
}): Promise<void> {
  await emitBusinessEvent(userId, {
    eventType: 'lead_converted',
    entityType: 'lead',
    entityId: leadId,
    payload: data,
  });
}

// ---------------------------------------------------------------------------
// Worker / crew emitters (R86 + intelligence retrofit)
// Worker assignment + job actual duration train the per-worker duration
// predictor ("Bas always takes 20% longer on tile work"). Solo contractors
// never emit these.
// ---------------------------------------------------------------------------

export async function emitWorkerAdded(userId: string, workerId: string, data: {
  role: string;
  trade?: string;
  hourlyCost?: number;
}): Promise<void> {
  await emitBusinessEvent(userId, {
    eventType: 'worker_added',
    entityType: 'worker',
    entityId: workerId,
    payload: data,
    trade: data.trade,
  });
}

export async function emitWorkerAssigned(userId: string, workerId: string, data: {
  jobId: string;
  trade?: string;
  estimatedHours?: number;
}): Promise<void> {
  await emitBusinessEvent(userId, {
    eventType: 'worker_assigned',
    entityType: 'worker',
    entityId: workerId,
    payload: data,
    trade: data.trade,
  });
}

// ---------------------------------------------------------------------------
// License / compliance emitters (R80 + intelligence retrofit)
// Licenses live as JSONB on business_settings, not their own table. We synth
// a stable `entityId` from `${type}_${state||country}_${number}` so renewal
// outcomes can be reattributed deterministically.
// ---------------------------------------------------------------------------

export async function emitLicenseAdded(userId: string, licenseEntityId: string, data: {
  type: string;
  state?: string;
  number: string;
  expiryDate: string;
  issuingAuthority?: string;
}): Promise<void> {
  await emitBusinessEvent(userId, {
    eventType: 'license_added',
    entityType: 'license',
    entityId: licenseEntityId,
    payload: data,
  });
}

export async function emitLicenseExpiringSoon(userId: string, licenseEntityId: string, data: {
  type: string;
  state?: string;
  expiryDate: string;
  daysUntilExpiry: number;
}): Promise<void> {
  await emitBusinessEvent(userId, {
    eventType: 'license_expiring_soon',
    entityType: 'license',
    entityId: licenseEntityId,
    payload: data,
  });
}

export async function emitLicenseRenewed(userId: string, licenseEntityId: string, data: {
  type: string;
  state?: string;
  oldExpiryDate: string;
  newExpiryDate: string;
  daysBeforeOldExpiry: number;  // negative if renewed after expiry
}): Promise<void> {
  await emitBusinessEvent(userId, {
    eventType: 'license_renewed',
    entityType: 'license',
    entityId: licenseEntityId,
    payload: data,
  });
}

// ---------------------------------------------------------------------------
// Workflow pack telemetry (R66r49 #6) — closes the data-blind problem.
// Pre-fix we had no way to tell which packs contractors actually used,
// which templates got approved, which got dismissed. ROI was estimated
// from a hardcoded 30%-recovery assumption. With these 4 events the
// admin dashboard can compute real per-pack approve-rate, dismiss-rate,
// expire-rate per locale + country.
// ---------------------------------------------------------------------------

export async function emitPackQueued(userId: string, queueItemId: string, data: {
  packId: string;
  stepIndex: number;
  trigger: string;
  channel: 'email' | 'sms' | 'push' | 'in_app';
  locale: string;
  customerId?: string;
  entityId?: string;
}): Promise<void> {
  await emitBusinessEvent(userId, {
    eventType: 'pack_queued',
    entityType: 'workflow_pack',
    entityId: queueItemId,
    payload: data,
  });
}

export async function emitPackApproved(userId: string, queueItemId: string, data: {
  packId: string;
  stepIndex?: number;
  via: 'share' | 'link' | 'navigate' | 'inform' | 'noop';
  approvalLatencyMs?: number; // time from queue → approve
}): Promise<void> {
  await emitBusinessEvent(userId, {
    eventType: 'pack_approved',
    entityType: 'workflow_pack',
    entityId: queueItemId,
    payload: data,
  });
}

export async function emitPackDismissed(userId: string, queueItemId: string, data: {
  packId: string;
  stepIndex?: number;
  reason?: 'manual_dismiss' | 'mute_customer' | 'mute_pack';
}): Promise<void> {
  await emitBusinessEvent(userId, {
    eventType: 'pack_dismissed',
    entityType: 'workflow_pack',
    entityId: queueItemId,
    payload: data,
  });
}

export async function emitPackExpired(userId: string, queueItemId: string, data: {
  packId: string;
  stepIndex?: number;
  ageDays: number;
}): Promise<void> {
  await emitBusinessEvent(userId, {
    eventType: 'pack_expired',
    entityType: 'workflow_pack',
    entityId: queueItemId,
    payload: data,
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
  // R241: optional fields needed by predictors but missing from many call sites.
  country?: string;
  materialCategory?: string;
  deliveryDays?: number;
  postcode?: string;
  // R283: OCR-specific enrichment so feedPricingMoat can drop its
  // direct material_price_history insert. Without these, OCR-derived
  // rows would lose brand/ean/currency/vat data — the cohort statistics
  // are richer when these are kept. Default `source: 'manual'` flips the
  // R241 hardcode (which mis-tagged manual writes from addJobMaterial as
  // 'invoice_scan') to truthful attribution; OCR callers pass
  // `source: 'invoice_scan'` explicitly.
  brand?: string;
  eanCode?: string;
  currency?: string;
  vatRate?: number;
  observedAt?: string;
  source?: 'manual' | 'api' | 'invoice_scan' | 'catalog';
}): Promise<void> {
  await emitBusinessEvent(userId, {
    eventType: 'material_purchased',
    entityType: 'material',
    entityId: `${data.supplierId}_${data.materialName}`,
    payload: data,
    trade: data.trade,
  });

  // R241: cloud-sync emit audit fix. emitBusinessEvent only writes to
  // business_events; the material price spike + supplier lead-time
  // predictors read from material_price_history directly. Without a
  // direct insert here, those models get zero training data forever.
  // R58: gate against the placeholder uid — material_price_history.observed_by
  // is a FK→auth.users(id), so writing 'current-user' would fail the FK
  // constraint and corrupt the local-queue retry chain.
  if (isSupabaseConfigured && !isPlaceholderUserId(userId)) {
    // R275: column-level audit found the previous insert wrote columns that
    // don't exist on material_price_history (user_id, unit_price, quantity,
    // total_price, delivery_days). Aligned to actual schema:
    //   observed_by (FK→auth.users), price_excl_vat, lead_time_days, source.
    // Per-purchase quantity/total are recorded in business_events.
    try {
      const { error } = await supabase.from('material_price_history').insert({
        observed_by: userId,
        supplier_id: data.supplierId,
        supplier_name: data.supplierName,
        material_name: data.materialName,
        material_category: data.materialCategory ?? null,
        brand: data.brand ?? null,
        ean_code: data.eanCode ?? null,
        unit: data.unit,
        price_excl_vat: data.price,
        currency: data.currency ?? 'EUR',
        vat_rate: data.vatRate ?? null,
        trade: data.trade,
        country: data.country ?? getCurrentCountry() ?? 'NL',
        lead_time_days: data.deliveryDays ?? null,
        postcode: data.postcode ?? null,
        source: data.source ?? 'manual',
        observed_at: data.observedAt ?? new Date().toISOString(),
      } as any);
      if (error) throw error;
    } catch (err) {
      await logIntelligenceWriteFailure('material_price_history.insert', userId, err);
    }
  }
}

// ---------------------------------------------------------------------------
// Observability — moat-layer write failures must leave a trail.
// Routes through eve_telemetry (already wired, fire-and-forget).
// ---------------------------------------------------------------------------

// R53: exported so the other AI-moat capture services
// (intelligenceCaptureService, decisionSyncService, supplierBacklink, etc.)
// can route their write failures through the same eve_telemetry trail
// instead of swallowing silently. Single observability hook for the
// whole moat.
export async function logIntelligenceWriteFailure(
  op: string,
  userId: string,
  err: unknown,
): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const message = err instanceof Error ? err.message : String(err);
    await supabase.from('eve_telemetry').insert({
      id: `intel_fail_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      user_id: userId,
      action_type: 'intelligence_write_failure',
      agent_type: 'analyst',
      entity_key: op,
      outcome: 'rejected',
      meta: { op, error: message.slice(0, 500) },
    } as any);
  } catch {
    // If telemetry itself fails we have nowhere left to go.
  }
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
  // R240: full postcode for cell-level cohort training. Captured server-side
  // for granularity but never exposed to other contractors (k-anonymity gates).
  postcode?: string;
}): Promise<void> {
  if (!isSupabaseConfigured) return;
  if (isPlaceholderUserId(userId)) return;

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
    if (data.postcode !== undefined) row.postcode = data.postcode;
    const { error } = await supabase.from('pricing_intelligence').insert(row as any);
    if (error) throw error;
  } catch (err) {
    // R275: don't block the UI, but DO leave a trail. Without observability
    // here, the moat layer can silently regress (no rows = no cohort stats).
    await logIntelligenceWriteFailure('pricing_intelligence.insert', userId, err);
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
  if (isPlaceholderUserId(userId)) return;

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
        // R242: enrich training features with portal engagement signals.
        // The quote-win retrain learns "high engagement → high accept" patterns
        // automatically once these land in model_training_pairs.features.
        let engagementFeatures: Record<string, any> = {};
        try {
          const { data: engData } = await (supabase.rpc as any)(
            'get_quote_engagement_features',
            { p_quote_id: quoteId },
          );
          if (engData && typeof engData === 'object') engagementFeatures = engData;
        } catch {
          // Best-effort — pair still writes without engagement features.
        }
        // R243: weight training pair by customer quality score so good
        // customers (paid on time + reviewed + referred + rebooked) train
        // the model harder than disputed/poor jobs.
        let pairWeight = 1.0;
        try {
          const customerId = (piRow as any).customer_id ?? null;
          if (customerId) {
            const { data: weightData } = await (supabase.rpc as any)(
              'get_customer_quality_weight',
              { p_customer_id: customerId },
            );
            if (typeof weightData === 'number' && Number.isFinite(weightData)) {
              pairWeight = Math.max(0.5, Math.min(1.5, weightData));
            }
          }
        } catch {
          // Default weight 1.0 stands.
        }
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
            ...engagementFeatures,
          },
          p_target: data.wasAccepted ? 1 : 0,
          p_target_label: data.wasAccepted ? 'accepted' : 'rejected',
          p_source: 'auto',
          p_weight: pairWeight,
        });
      }
    } catch (err) {
      await logIntelligenceWriteFailure('write_training_pair', userId, err);
    }
  } catch (err) {
    await logIntelligenceWriteFailure('pricing_intelligence.update', userId, err);
  }
}

// ---------------------------------------------------------------------------
// Local queue management (offline-first)
// ---------------------------------------------------------------------------

// R59: when offlineWriteQueue captures a temp→real id mapping (R49), rewrite
// any queued business_events that reference the temp id in `entityId` or
// in `payload.*Id` fields. Without this, an offline-created job that gets
// `emitJobStarted(...)` fired before flush leaves business_events.entity_id
// pinned to the temp id forever — cohort RPCs joining
// business_events.entity_id ↔ jobs.id miss every event for offline-created
// entities. Same hazard as R54's customer_embeddings rekey, applied to the
// dataCollector's separate event queue.
async function rewriteQueuedEventIds(tempId: string, realId: string): Promise<void> {
  if (!tempId || !realId || tempId === realId) return;
  try {
    const raw = await AsyncStorage.getItem(LOCAL_QUEUE_KEY);
    if (!raw) return;
    const queue: QueuedEvent[] = JSON.parse(raw);
    let touched = false;
    const rewritten = queue.map((e) => {
      let entityId = e.entityId;
      let payload = e.payload;
      if (entityId === tempId) {
        entityId = realId;
        touched = true;
      }
      // entityId for materials is `${supplierId}_${materialName}` — only
      // rewrite if the supplierId portion matches the temp id.
      if (typeof entityId === 'string' && entityId.startsWith(`${tempId}_`)) {
        entityId = `${realId}_${entityId.slice(tempId.length + 1)}`;
        touched = true;
      }
      // Recursively swap temp id within payload string fields (mirrors
      // offlineWriteQueue's payload rewriter).
      if (payload && typeof payload === 'object') {
        const swap = (v: unknown): unknown => {
          if (typeof v === 'string') return v === tempId ? realId : v;
          if (Array.isArray(v)) return v.map(swap);
          if (v && typeof v === 'object') {
            const out: Record<string, unknown> = {};
            for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
              out[k] = swap(val);
            }
            return out;
          }
          return v;
        };
        const newPayload = swap(payload) as Record<string, any>;
        if (newPayload !== payload) {
          payload = newPayload;
          touched = true;
        }
      }
      return touched ? { ...e, entityId, payload } : e;
    });
    if (touched) {
      await AsyncStorage.setItem(LOCAL_QUEUE_KEY, JSON.stringify(rewritten));
    }
  } catch {
    // Silent — queue rewrite is best-effort.
  }
}

let _eventQueueRemapInit = false;
function initEventQueueRemapListener(): void {
  if (_eventQueueRemapInit) return;
  _eventQueueRemapInit = true;
  subscribeIdRemap((e: IdRemapEvent) => {
    void rewriteQueuedEventIds(e.tempId, e.realId);
  });
}

initEventQueueRemapListener();

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

    // R58: drop placeholder-uid events sitting in the queue from before
    // the gate was added — business_events.user_id is a NOT NULL FK to
    // auth.users(id), so 'current-user' would fail the constraint and
    // block the entire batch from advancing. Filter them out so real
    // events behind them aren't permanently blocked.
    const filtered = queue.filter((e) => !isPlaceholderUserId(e.userId));
    if (filtered.length !== queue.length) {
      await AsyncStorage.setItem(LOCAL_QUEUE_KEY, JSON.stringify(filtered));
    }
    if (filtered.length === 0) return;

    // Take a batch
    const batch = filtered.slice(0, BATCH_SIZE);
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
      // R58: was `queue.slice(BATCH_SIZE)` — but we already rewrote the
      // queue to `filtered` above (placeholder uids dropped). Slicing
      // the original `queue` would re-introduce dropped placeholders.
      // Slice from `filtered` instead.
      const remaining = filtered.slice(BATCH_SIZE);
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

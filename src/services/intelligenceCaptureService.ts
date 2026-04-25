// =============================================================================
// INTELLIGENCE CAPTURE SERVICE (R238)
// =============================================================================
// Thin wrappers for the four new capture surfaces:
//   1. generator dismissals  — UI swipe-away signal
//   2. portal events         — customer-side telemetry
//   3. photo analyses        — persist analyze-photo output for re-querying
//   4. job quality signals   — review/on-time/referral composite
//
// All best-effort. Failures are swallowed so capture never blocks the UX.
// =============================================================================

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getCurrentUserId } from '../lib/currentUser';

// ---------------------------------------------------------------------------
// 1. Generator dismissals
// ---------------------------------------------------------------------------

export async function recordGeneratorDismissal(input: {
  generatorId: string;
  insightId?: string;
  screen?: string;
  reason?: string;
}): Promise<void> {
  if (!isSupabaseConfigured) return;
  const userId = getCurrentUserId();
  if (!userId) return;
  try {
    await (supabase.from as any)('generator_dismissals').insert({
      user_id: userId,
      generator_id: input.generatorId,
      insight_id: input.insightId ?? null,
      screen: input.screen ?? null,
      reason: input.reason ?? null,
    });
  } catch {
    // silent
  }
}

// ---------------------------------------------------------------------------
// 2. Customer portal telemetry
// ---------------------------------------------------------------------------
// Called from the customer-facing portal. Anon writes — no auth required.

export type PortalEventType =
  | 'portal_opened'
  | 'quote_viewed'
  | 'price_expanded'
  | 'line_clicked'
  | 'photo_viewed'
  | 'accept_hovered'
  | 'decline_hovered'
  | 'question_started'
  | 'question_sent'
  | 'accepted'
  | 'declined'
  | 'session_ended';

export async function recordPortalEvent(input: {
  portalToken: string;
  contractorUserId?: string | null;
  quoteId?: string | null;
  decisionId?: string | null;
  eventType: PortalEventType;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await (supabase.from as any)('customer_portal_events').insert({
      portal_token: input.portalToken,
      contractor_user_id: input.contractorUserId ?? null,
      quote_id: input.quoteId ?? null,
      decision_id: input.decisionId ?? null,
      event_type: input.eventType,
      duration_ms: input.durationMs ?? null,
      metadata: input.metadata ?? null,
    });
  } catch {
    // silent
  }
}

// ---------------------------------------------------------------------------
// 3. Photo analysis persistence
// ---------------------------------------------------------------------------

export interface PhotoAnalysisRow {
  jobId?: string;
  quoteId?: string;
  storagePath?: string;
  trade?: string;
  detectedRooms?: string[];
  detectedMaterials?: Record<string, unknown>;
  estimatedComplexity?: 'simple' | 'moderate' | 'complex';
  estimatedDurationHours?: number;
  estimatedCostEur?: number;
  rawResponse?: Record<string, unknown>;
}

export async function persistPhotoAnalysis(input: PhotoAnalysisRow): Promise<void> {
  if (!isSupabaseConfigured) return;
  const userId = getCurrentUserId();
  if (!userId) return;
  try {
    await (supabase.from as any)('photo_analyses').insert({
      user_id: userId,
      job_id: input.jobId ?? null,
      quote_id: input.quoteId ?? null,
      storage_path: input.storagePath ?? null,
      trade: input.trade ?? null,
      detected_rooms: input.detectedRooms ?? null,
      detected_materials: input.detectedMaterials ?? null,
      estimated_complexity: input.estimatedComplexity ?? null,
      estimated_duration_hours: input.estimatedDurationHours ?? null,
      estimated_cost_eur: input.estimatedCostEur ?? null,
      raw_response: input.rawResponse ?? null,
    });
  } catch {
    // silent
  }
}

// ---------------------------------------------------------------------------
// 4. Job quality signals
// ---------------------------------------------------------------------------

export interface JobQualityInput {
  jobId: string;
  customerId?: string;
  paidOnTime?: boolean;
  customerReviewScore?: number;
  customerReviewText?: string;
  referralGenerated?: boolean;
  rebookWithin180d?: boolean;
}

export async function upsertJobQualitySignal(input: JobQualityInput): Promise<void> {
  if (!isSupabaseConfigured) return;
  const userId = getCurrentUserId();
  if (!userId) return;
  try {
    await (supabase.from as any)('job_quality_signals').upsert({
      job_id: input.jobId,
      user_id: userId,
      customer_id: input.customerId ?? null,
      paid_on_time: input.paidOnTime ?? null,
      customer_review_score: input.customerReviewScore ?? null,
      customer_review_text: input.customerReviewText ?? null,
      referral_generated: input.referralGenerated ?? false,
      rebook_within_180d: input.rebookWithin180d ?? false,
    });
  } catch {
    // silent
  }
}

// ---------------------------------------------------------------------------
// 5. Read helpers — predictions cached by train-extra-models
// ---------------------------------------------------------------------------

export interface CashflowGapPrediction {
  predictedGapEur: number;
  horizonDays: number;
  confidence: number;
  computedAt: string;
}

export async function getCashflowGapPrediction(): Promise<CashflowGapPrediction | null> {
  if (!isSupabaseConfigured) return null;
  const userId = getCurrentUserId();
  if (!userId) return null;
  try {
    const { data, error } = await (supabase.from as any)('ml_cashflow_gap_predictions')
      .select('horizon_days, predicted_gap_eur, confidence, computed_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return null;
    return {
      predictedGapEur: Number(data.predicted_gap_eur),
      horizonDays: Number(data.horizon_days),
      confidence: Number(data.confidence),
      computedAt: data.computed_at,
    };
  } catch {
    return null;
  }
}

export interface CapacityOverrunPrediction {
  overrunProbability: number;
  predictedOverrunDays: number;
  horizonDays: number;
  computedAt: string;
}

export async function getCapacityOverrunPrediction(): Promise<CapacityOverrunPrediction | null> {
  if (!isSupabaseConfigured) return null;
  const userId = getCurrentUserId();
  if (!userId) return null;
  try {
    const { data, error } = await (supabase.from as any)('ml_capacity_overrun_predictions')
      .select('overrun_probability, predicted_overrun_days, horizon_days, computed_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return null;
    return {
      overrunProbability: Number(data.overrun_probability),
      predictedOverrunDays: Number(data.predicted_overrun_days),
      horizonDays: Number(data.horizon_days),
      computedAt: data.computed_at,
    };
  } catch {
    return null;
  }
}

export interface SupplierLeadtimePrediction {
  supplierId: string;
  predictedDelayDays: number;
  delayProbability: number;
  confidence: number;
}

export async function getSupplierLeadtimePredictions(): Promise<SupplierLeadtimePrediction[]> {
  if (!isSupabaseConfigured) return [];
  const userId = getCurrentUserId();
  if (!userId) return [];
  try {
    const { data, error } = await (supabase.from as any)('ml_supplier_leadtime_predictions')
      .select('supplier_id, predicted_delay_days, delay_probability, confidence')
      .eq('user_id', userId);
    if (error || !Array.isArray(data)) return [];
    return data.map((r: any) => ({
      supplierId: String(r.supplier_id),
      predictedDelayDays: Number(r.predicted_delay_days),
      delayProbability: Number(r.delay_probability),
      confidence: Number(r.confidence),
    }));
  } catch {
    return [];
  }
}

export interface MaterialPriceForecast {
  trade: string;
  country: string;
  materialCategory: string;
  predictedPriceChangePct: number;
  forecastHorizonDays: number;
  confidence: number;
}

export async function getMaterialPriceForecasts(trade: string, country: string): Promise<MaterialPriceForecast[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await (supabase.from as any)('ml_material_price_forecasts')
      .select('trade, country, material_category, predicted_price_change_pct, forecast_horizon_days, confidence')
      .eq('trade', trade)
      .eq('country', country);
    if (error || !Array.isArray(data)) return [];
    return data.map((r: any) => ({
      trade: String(r.trade),
      country: String(r.country),
      materialCategory: String(r.material_category),
      predictedPriceChangePct: Number(r.predicted_price_change_pct),
      forecastHorizonDays: Number(r.forecast_horizon_days),
      confidence: Number(r.confidence),
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// 6. Queryable layer — wrappers around describe_moat_schema + query_* RPCs
// ---------------------------------------------------------------------------

export interface SchemaColumn {
  tableName: string;
  columnName: string;
  businessMeaning: string;
  dataType: string;
  unit: string | null;
  validRange: string | null;
  exampleValue: string | null;
}

export async function describeMoatSchema(): Promise<SchemaColumn[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await (supabase.rpc as any)('describe_moat_schema');
    if (error || !Array.isArray(data)) return [];
    return (data as any[]).map((r) => ({
      tableName: String(r.table_name),
      columnName: String(r.column_name),
      businessMeaning: String(r.business_meaning),
      dataType: String(r.data_type),
      unit: r.unit ?? null,
      validRange: r.valid_range ?? null,
      exampleValue: r.example_value ?? null,
    }));
  } catch {
    return [];
  }
}

export async function queryMarginTrend(trade: string, country: string, months = 12): Promise<Array<{ month: string; avgMargin: number; medianMargin: number; quotes: number }>> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await (supabase.rpc as any)('query_margin_trend', {
      p_trade: trade, p_country: country, p_months: months,
    });
    if (error || !Array.isArray(data)) return [];
    return (data as any[]).map((r) => ({
      month: String(r.month),
      avgMargin: Number(r.avg_margin),
      medianMargin: Number(r.median_margin),
      quotes: Number(r.quotes),
    }));
  } catch {
    return [];
  }
}

export interface QuoteEngagement {
  totalEvents: number;
  uniqueSessions: number;
  portalOpenedCount: number;
  quoteViewedCount: number;
  priceExpandedCount: number;
  lineClickedCount: number;
  photoViewedCount: number;
  acceptHoveredCount: number;
  declineHoveredCount: number;
  questionStartedCount: number;
  questionSentCount: number;
  totalEngagementSeconds: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  decided: boolean;
  decision: string | null;
}

export async function getQuoteEngagement(quoteId: string): Promise<QuoteEngagement | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await (supabase.rpc as any)('get_quote_engagement', { p_quote_id: quoteId });
    if (error || !Array.isArray(data) || data.length === 0) return null;
    const r = data[0] as any;
    return {
      totalEvents: Number(r.total_events) || 0,
      uniqueSessions: Number(r.unique_sessions) || 0,
      portalOpenedCount: Number(r.portal_opened_count) || 0,
      quoteViewedCount: Number(r.quote_viewed_count) || 0,
      priceExpandedCount: Number(r.price_expanded_count) || 0,
      lineClickedCount: Number(r.line_clicked_count) || 0,
      photoViewedCount: Number(r.photo_viewed_count) || 0,
      acceptHoveredCount: Number(r.accept_hovered_count) || 0,
      declineHoveredCount: Number(r.decline_hovered_count) || 0,
      questionStartedCount: Number(r.question_started_count) || 0,
      questionSentCount: Number(r.question_sent_count) || 0,
      totalEngagementSeconds: Number(r.total_engagement_seconds) || 0,
      firstSeenAt: r.first_seen_at ?? null,
      lastSeenAt: r.last_seen_at ?? null,
      decided: Boolean(r.decided),
      decision: r.decision ?? null,
    };
  } catch {
    return null;
  }
}

export async function queryWinrateDistribution(trade: string, country: string): Promise<Array<{ amountBucket: string; winRate: number; quotes: number; contractors: number }>> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await (supabase.rpc as any)('query_winrate_distribution', {
      p_trade: trade, p_country: country,
    });
    if (error || !Array.isArray(data)) return [];
    return (data as any[]).map((r) => ({
      amountBucket: String(r.amount_bucket),
      winRate: Number(r.win_rate),
      quotes: Number(r.quotes),
      contractors: Number(r.contractors),
    }));
  } catch {
    return [];
  }
}

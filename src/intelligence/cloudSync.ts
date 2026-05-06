// =============================================================================
// INTELLIGENCE CLOUD SYNC
// =============================================================================
// Syncs local AsyncStorage learning profiles → Supabase for:
// 1. Cross-device persistence (switch phones, don't lose learning)
// 2. Cohort benchmarking (anonymized cross-user aggregation)
// 3. Calibration data for improving generators
// =============================================================================

import { supabase as _supabase, isSupabaseConfigured } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ContractorLearningProfile } from './learningStorage';
import { logWarn } from '../utils/errorHandler';
import { isTempIdFast } from '../lib/idShape';

// R59: nullify temp ids before writing FK columns. Same hazard as the
// intelligenceCaptureService writes — `job_outcomes.job_id`, etc. are
// FK to real BE rows. Writing a temp id either fails the FK or stores
// a stale string that no cohort RPC can join. Better to write null so
// the row at least lands with the analysis payload that has cohort
// value; the caller can retry once flush completes.
function nullifyTempId(id: string | null | undefined): string | null {
  if (!id) return null;
  return isTempIdFast(id) ? null : id;
}

// Cast to any so insert/select calls don't hit typegen drift while the real
// Supabase schema lives server-side. Regenerate types post-launch to remove.
const supabase: any = _supabase;

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const LAST_SYNC_KEY = '@vasco_last_cloud_sync';

// ---------------------------------------------------------------------------
// Profile sync: AsyncStorage → Supabase
// ---------------------------------------------------------------------------

export async function syncProfileToCloud(
  userId: string,
  role: string,
  trade?: string,
  country?: string,
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    const storageKey = `@vasco_learning_profile_${role}`;
    const raw = await AsyncStorage.getItem(storageKey);
    if (!raw) return false;

    const profile: ContractorLearningProfile = JSON.parse(raw);

    const { error } = await supabase
      .from('learning_profiles')
      .upsert({
        user_id: userId,
        role,
        trade,
        country,
        profile_data: profile,
        schema_version: profile.schemaVersion ?? 2,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,role' });

    if (error) {
      // Silent fail — Supabase may be unreachable (offline/paused project)
      return false;
    }

    await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    return true;
  } catch (e) {
    logWarn('cloudSync', `Profile sync error: ${e}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Profile restore: Supabase → AsyncStorage (on new device)
// ---------------------------------------------------------------------------

export async function restoreProfileFromCloud(
  userId: string,
  role: string,
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    const { data, error } = await supabase
      .from('learning_profiles')
      .select('profile_data')
      .eq('user_id', userId)
      .eq('role', role)
      .single();

    if (error || !data?.profile_data) return false;

    const storageKey = `@vasco_learning_profile_${role}`;
    await AsyncStorage.setItem(storageKey, JSON.stringify(data.profile_data));
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Interaction sync: batch upload insight interactions
// ---------------------------------------------------------------------------

export async function syncInteractionsToCloud(
  userId: string,
  interactions: Array<{
    insightId: string;
    generatorId: string;
    action: string;
    screenContext?: string;
    category?: string;
    dwellTimeMs?: number;
    outcome?: string;
    timestamp: string;
  }>,
): Promise<boolean> {
  if (!isSupabaseConfigured || interactions.length === 0) return false;

  try {
    const rows = interactions.map(i => ({
      user_id: userId,
      insight_id: i.insightId,
      generator_id: i.generatorId,
      action: i.action,
      screen_context: i.screenContext,
      category: i.category,
      dwell_time_ms: i.dwellTimeMs,
      outcome: i.outcome,
      created_at: i.timestamp,
    }));

    const { error } = await supabase.from('insight_interactions').insert(rows);
    return !error;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Job outcome sync
// ---------------------------------------------------------------------------

export async function syncJobOutcome(
  userId: string,
  outcome: {
    jobId: string;
    jobType?: string;
    trade?: string;
    estimatedHours: number;
    actualHours: number;
    estimatedCost: number;
    actualCost: number;
    marginPercent: number;
    customerId?: string;
    completedAt: string;
  },
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  // R59: skip if jobId is temp — job_outcomes.job_id is the cohort key,
  // null isn't useful here. Caller retries post-flush.
  if (isTempIdFast(outcome.jobId)) return false;
  try {
    const { error } = await supabase.from('job_outcomes').insert({
      user_id: userId,
      job_id: outcome.jobId,
      job_type: outcome.jobType,
      trade: outcome.trade,
      estimated_hours: outcome.estimatedHours,
      actual_hours: outcome.actualHours,
      estimated_cost: outcome.estimatedCost,
      actual_cost: outcome.actualCost,
      margin_percent: outcome.marginPercent,
      customer_id: nullifyTempId(outcome.customerId),
      completed_at: outcome.completedAt,
    });
    return !error;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Invoice outcome sync
// ---------------------------------------------------------------------------

export async function syncInvoiceOutcome(
  userId: string,
  outcome: {
    invoiceId: string;
    customerId?: string;
    amount: number;
    issuedAt: string;
    dueAt: string;
    paidAt?: string;
    daysToPayment?: number;
    isOverdue: boolean;
  },
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  // R59: invoiceId is the cohort key — must be non-temp. The FE id for
  // invoices is the docNumber (e.g. INV-260001) which is a stable string,
  // not a temp pattern, so this guard normally passes; defensive only.
  if (isTempIdFast(outcome.invoiceId)) return false;
  try {
    const { error } = await supabase.from('invoice_outcomes').insert({
      user_id: userId,
      invoice_id: outcome.invoiceId,
      customer_id: nullifyTempId(outcome.customerId),
      amount: outcome.amount,
      issued_at: outcome.issuedAt,
      due_at: outcome.dueAt,
      paid_at: outcome.paidAt,
      days_to_payment: outcome.daysToPayment,
      is_overdue: outcome.isOverdue,
    });
    return !error;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Accounting loop sync
// ---------------------------------------------------------------------------

export async function syncAccountingLoop(
  userId: string,
  loop: {
    jobId: string;
    customerId: string;
    quoteId?: string;
    invoiceId?: string;
    paymentId?: string;
    externalInvoiceId?: string;
    currentStage: string;
    amounts: Record<string, number>;
    history: any[];
  },
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  // R59: job_id is the upsert key — must be non-temp.
  if (isTempIdFast(loop.jobId)) return false;
  try {
    const { error } = await supabase.from('accounting_loops').upsert({
      user_id: userId,
      job_id: loop.jobId,
      customer_id: nullifyTempId(loop.customerId),
      quote_id: nullifyTempId(loop.quoteId),
      invoice_id: nullifyTempId(loop.invoiceId),
      payment_id: nullifyTempId(loop.paymentId),
      external_invoice_id: loop.externalInvoiceId,
      current_stage: loop.currentStage,
      amounts: loop.amounts,
      history: loop.history,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,job_id' })
    // Note: needs unique constraint on (user_id, job_id) — add via migration if needed
    ;
    return !error;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Cohort benchmarks: fetch anonymized averages for comparison
// ---------------------------------------------------------------------------

export async function getCohortBenchmark(
  trade: string,
  country: string,
  metric: string,
): Promise<{ median: number; p25: number; p75: number; sampleSize: number } | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from('cohort_benchmarks')
      .select('median, p25, p75, sample_size')
      .eq('trade', trade)
      .eq('country', country)
      .eq('metric', metric)
      .order('computed_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    return {
      median: data.median ?? 0,
      p25: data.p25 ?? 0,
      p75: data.p75 ?? 0,
      sampleSize: data.sample_size ?? 0,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Auto-sync scheduler (call from app root)
// ---------------------------------------------------------------------------

let syncTimer: ReturnType<typeof setInterval> | null = null;

export function startAutoSync(userId: string, role: string, trade?: string, country?: string): void {
  if (syncTimer) return;
  syncTimer = setInterval(() => {
    syncProfileToCloud(userId, role, trade, country);
  }, SYNC_INTERVAL_MS);

  // Initial sync on start
  syncProfileToCloud(userId, role, trade, country);
}

export function stopAutoSync(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}

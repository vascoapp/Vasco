// =============================================================================
// REASON CODE SERVICE — learning signal capture for the pricing moat
// =============================================================================
// Whenever the contractor edits a quote line that the AI pre-filled, we
// record the delta + the contractor's reason ("why did you change this?")
// in `quote_line_deltas`. Aggregation into regional waste factors / labor
// multipliers happens downstream (edge jobs / views).
//
// Offline-first: local queue first, best-effort flush to Supabase.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getCurrentUserId } from '../lib/currentUser';

const LOCAL_KEY = '@vasco_quote_line_deltas';
const PENDING_FLUSH_KEY = '@vasco_quote_line_deltas_pending';

export type DeltaSource = 'photo_handoff' | 'ai_draft' | 'template' | 'cohort' | 'manual';

export type ReasonCode =
  | 'waste_underestimated'
  | 'measurement_correction'
  | 'labor_underestimated'
  | 'customer_upgrade'
  | 'local_supplier_cheaper'
  | 'site_condition_harder'
  | 'other';

export interface LineEditDelta {
  id: string;
  userId: string;
  quoteId?: string;
  lineItemId: string;
  sku?: string;
  description?: string;
  originalQty?: number;
  newQty?: number;
  originalUnitPrice?: number;
  newUnitPrice?: number;
  source: DeltaSource;
  trade?: string;
  country?: string;
  postcode?: string;
  reasonCode?: ReasonCode;
  freeTextReason?: string;
  createdAt: string;
}

/**
 * Ordered list of reason codes for UI chips. Chip order adapts to recent
 * contractor usage (most-used first) with a sensible default tail.
 */
export const REASON_CODES: ReasonCode[] = [
  'waste_underestimated',
  'measurement_correction',
  'labor_underestimated',
  'customer_upgrade',
  'local_supplier_cheaper',
  'site_condition_harder',
  'other',
];

async function loadLocal(): Promise<LineEditDelta[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveLocal(deltas: LineEditDelta[]): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(deltas.slice(-500)));
  } catch {}
}

/** Record a single line-edit delta. Optional reasonCode — can be annotated later. */
export async function recordDelta(input: Omit<LineEditDelta, 'id' | 'createdAt' | 'userId'> & { userId?: string }): Promise<string> {
  const id = `delta_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const delta: LineEditDelta = {
    ...input,
    id,
    userId: input.userId ?? getCurrentUserId(),
    createdAt: new Date().toISOString(),
  };

  const all = await loadLocal();
  all.push(delta);
  await saveLocal(all);

  // Best-effort Supabase sync
  if (isSupabaseConfigured) {
    try {
      const { error } = await (supabase.from as any)('quote_line_deltas').insert({
        user_id: delta.userId,
        quote_id: delta.quoteId,
        line_item_id: delta.lineItemId,
        sku: delta.sku,
        description: delta.description,
        original_qty: delta.originalQty,
        new_qty: delta.newQty,
        original_unit_price: delta.originalUnitPrice,
        new_unit_price: delta.newUnitPrice,
        source: delta.source,
        trade: delta.trade,
        country: delta.country,
        postcode: delta.postcode,
        reason_code: delta.reasonCode,
        free_text_reason: delta.freeTextReason,
      });
      if (error) await queuePending(id);
    } catch {
      await queuePending(id);
    }
  } else {
    await queuePending(id);
  }

  return id;
}

/** Add / update the reason code on an existing local delta (post-hoc annotation). */
export async function annotateDelta(deltaId: string, reasonCode: ReasonCode, freeText?: string): Promise<void> {
  const all = await loadLocal();
  const idx = all.findIndex((d) => d.id === deltaId);
  if (idx === -1) return;
  all[idx] = { ...all[idx], reasonCode, freeTextReason: freeText };
  await saveLocal(all);

  if (isSupabaseConfigured) {
    try {
      await (supabase.from as any)('quote_line_deltas')
        .update({ reason_code: reasonCode, free_text_reason: freeText })
        .eq('id', all[idx].id);
    } catch {}
  }
}

/** List recent deltas for a contractor (local + cached). */
export async function listRecentDeltas(limit = 50): Promise<LineEditDelta[]> {
  const all = await loadLocal();
  return all.slice(-limit).reverse();
}

/** Reorder chips so the contractor's most-used reason floats to the top. */
export async function getChipOrder(): Promise<ReasonCode[]> {
  const all = await loadLocal();
  const counts = new Map<ReasonCode, number>();
  for (const d of all) {
    if (d.reasonCode) counts.set(d.reasonCode, (counts.get(d.reasonCode) ?? 0) + 1);
  }
  const used = REASON_CODES.slice().sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
  return used;
}

// ─── pending-flush plumbing (best-effort, non-blocking) ────────────────────

async function queuePending(id: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_FLUSH_KEY);
    const pending: string[] = raw ? JSON.parse(raw) : [];
    if (!pending.includes(id)) pending.push(id);
    await AsyncStorage.setItem(PENDING_FLUSH_KEY, JSON.stringify(pending.slice(-500)));
  } catch {}
}

export async function flushPendingDeltas(): Promise<{ sent: number; remaining: number }> {
  if (!isSupabaseConfigured) return { sent: 0, remaining: 0 };
  let sent = 0;
  try {
    const raw = await AsyncStorage.getItem(PENDING_FLUSH_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    if (ids.length === 0) return { sent: 0, remaining: 0 };
    const all = await loadLocal();
    const byId = new Map(all.map((d) => [d.id, d]));
    const stillPending: string[] = [];
    for (const id of ids) {
      const d = byId.get(id);
      if (!d) continue;
      try {
        const { error } = await (supabase.from as any)('quote_line_deltas').insert({
          user_id: d.userId,
          quote_id: d.quoteId,
          line_item_id: d.lineItemId,
          sku: d.sku,
          description: d.description,
          original_qty: d.originalQty,
          new_qty: d.newQty,
          original_unit_price: d.originalUnitPrice,
          new_unit_price: d.newUnitPrice,
          source: d.source,
          trade: d.trade,
          country: d.country,
          postcode: d.postcode,
          reason_code: d.reasonCode,
          free_text_reason: d.freeTextReason,
        });
        if (error) stillPending.push(id);
        else sent += 1;
      } catch {
        stillPending.push(id);
      }
    }
    await AsyncStorage.setItem(PENDING_FLUSH_KEY, JSON.stringify(stillPending));
    return { sent, remaining: stillPending.length };
  } catch {
    return { sent, remaining: 0 };
  }
}

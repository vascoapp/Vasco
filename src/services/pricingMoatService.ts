// =============================================================================
// PRICING MOAT SERVICE — close the reverse loop (R190)
// =============================================================================
// The cohort learns from every contractor edit (quote_line_deltas). This
// service feeds that learning back into NEW AI-drafted quotes so contractors
// see cohort-tuned baselines on day one — instead of raw AI output that
// systematically under/over-estimates.
//
// Input:  AI-drafted line items + (trade, country, userId)
// Output: cohort-adjusted line items with preserved "pre-adjustment" baseline
//         so downstream delta capture still works.
// =============================================================================

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getContractorCalibration } from './cohortBenchmarkService';

// Safety cap — cohort adjustments never move a line by more than ±50%. Protects
// against pathological averages on thin cells and against one weird outlier
// line blowing up a whole quote.
const ADJUSTMENT_CAP_PCT = 50;

// Minimum sample size (per-cell contractors) below which we don't trust the
// distribution. Server RPC already enforces >=5; keeping the client check as
// a defensive floor in case of future server-side relaxations.
const MIN_COHORT_CONTRACTORS = 5;

// Minimum confidence (0-1) for contractor calibration to affect the baseline.
// Below this, we only use raw cohort deltas (no personalization).
const MIN_CALIBRATION_CONFIDENCE = 0.3;

export interface AdjustableLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface AdjustedLine extends AdjustableLine {
  // Preserved originals — feed into baselinesRef for delta capture.
  originalQuantity: number;
  originalUnitPrice: number;
  // Diagnostics — surfaced in the UI as "tuned from N decisions".
  adjustmentApplied: boolean;
  cohortContractors: number;
  qtyDeltaPct: number;
  priceDeltaPct: number;
}

export interface CohortAdjustmentSummary {
  linesAdjusted: number;
  totalLines: number;
  totalCohortContractors: number; // max across lines — best guess at cohort depth
  calibrationApplied: boolean;
  calibrationConfidence: number;
}

interface BatchRow {
  input_index: number;
  description_like: string;
  sample_size: number;
  contractor_count: number;
  median_qty_delta_pct: number | null;
  median_unit_price_delta_pct: number | null;
  top_reason_code: string | null;
  top_reason_share: number | null;
}

function tokenKey(desc: string): string {
  return desc.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 3).join(' ');
}

function clamp(pct: number, cap: number = ADJUSTMENT_CAP_PCT): number {
  if (!Number.isFinite(pct)) return 0;
  return Math.max(-cap, Math.min(cap, pct));
}

async function fetchBatch(
  trade: string,
  country: string,
  keys: string[],
): Promise<Map<string, BatchRow>> {
  const out = new Map<string, BatchRow>();
  if (!isSupabaseConfigured || keys.length === 0) return out;
  try {
    const { data, error } = await (supabase.rpc as any)('get_line_adjustments_batch', {
      p_trade: trade,
      p_country: country,
      p_descriptions: keys,
    });
    if (error || !Array.isArray(data)) return out;
    for (const row of data as BatchRow[]) {
      if (row && typeof row.description_like === 'string') {
        out.set(row.description_like, row);
      }
    }
  } catch {
    // silent fail — caller just gets the raw AI baseline back
  }
  return out;
}

/**
 * Apply cohort-typical edits + contractor calibration to AI-baseline lines.
 * Safe to call with empty input or without Supabase — in both cases the
 * input is returned unchanged (with diagnostic fields zeroed out).
 *
 * @param lines AI-baseline line items
 * @param opts.trade contractor's trade (from user/businessProfile)
 * @param opts.country contractor's country (from user/businessProfile)
 * @param opts.userId contractor's auth uid (enables personalization)
 */
export async function applyCohortAdjustments(
  lines: AdjustableLine[],
  opts: { trade: string; country: string; userId?: string | null },
): Promise<{ lines: AdjustedLine[]; summary: CohortAdjustmentSummary }> {
  const { trade, country, userId } = opts;

  // Fast-path for empty input.
  if (!lines || lines.length === 0) {
    return {
      lines: [],
      summary: {
        linesAdjusted: 0,
        totalLines: 0,
        totalCohortContractors: 0,
        calibrationApplied: false,
        calibrationConfidence: 0,
      },
    };
  }

  // Dedupe keys so we make one RPC call for repeated line types.
  const keys = Array.from(new Set(lines.map(l => tokenKey(l.description)))).filter(Boolean);
  const [batch, calibration] = await Promise.all([
    fetchBatch(trade, country, keys),
    userId ? getContractorCalibration(userId, trade, country) : Promise.resolve(null),
  ]);

  // Calibration: if the contractor historically prices X% above cohort median,
  // we keep the cohort-tuned baseline but shift it back toward the contractor's
  // comfort zone by HALF of X%. Half because the cohort also represents
  // winning quotes — we don't want to over-correct toward the contractor's
  // own pricing bias.
  const calibConfident =
    calibration !== null &&
    calibration.confidence >= MIN_CALIBRATION_CONFIDENCE &&
    calibration.medianPriceVsCohortPct !== null;
  const calibPriceShift = calibConfident
    ? clamp((calibration!.medianPriceVsCohortPct ?? 0) / 2, ADJUSTMENT_CAP_PCT / 2)
    : 0;

  let linesAdjusted = 0;
  let maxContractors = 0;

  const adjusted: AdjustedLine[] = lines.map(line => {
    const key = tokenKey(line.description);
    const row = batch.get(key);
    const hasData = row && row.contractor_count >= MIN_COHORT_CONTRACTORS;

    if (!hasData) {
      return {
        ...line,
        originalQuantity: line.quantity,
        originalUnitPrice: line.unitPrice,
        adjustmentApplied: false,
        cohortContractors: row?.contractor_count ?? 0,
        qtyDeltaPct: 0,
        priceDeltaPct: 0,
      };
    }

    maxContractors = Math.max(maxContractors, row!.contractor_count);

    const qtyDelta = clamp(row!.median_qty_delta_pct ?? 0);
    const priceDelta = clamp((row!.median_unit_price_delta_pct ?? 0) + calibPriceShift);

    const newQty = line.quantity * (1 + qtyDelta / 100);
    const newPrice = line.unitPrice * (1 + priceDelta / 100);

    // Only flag as "adjusted" if we actually moved the needle by >=1% on
    // something — avoids showing the UI badge when the cohort basically
    // agrees with the raw AI output.
    const applied = Math.abs(qtyDelta) >= 1 || Math.abs(priceDelta) >= 1;
    if (applied) linesAdjusted += 1;

    return {
      ...line,
      quantity: Number.isFinite(newQty) && newQty > 0 ? newQty : line.quantity,
      unitPrice: Number.isFinite(newPrice) && newPrice > 0 ? newPrice : line.unitPrice,
      originalQuantity: line.quantity,
      originalUnitPrice: line.unitPrice,
      adjustmentApplied: applied,
      cohortContractors: row!.contractor_count,
      qtyDeltaPct: qtyDelta,
      priceDeltaPct: priceDelta,
    };
  });

  return {
    lines: adjusted,
    summary: {
      linesAdjusted,
      totalLines: lines.length,
      totalCohortContractors: maxContractors,
      calibrationApplied: calibConfident && calibPriceShift !== 0,
      calibrationConfidence: calibration?.confidence ?? 0,
    },
  };
}

// Exported for test fixtures — never import in production code.
export const __internal = { clamp, tokenKey, ADJUSTMENT_CAP_PCT, MIN_COHORT_CONTRACTORS };

// =============================================================================
// ML HEALTH CHECK (R302)
// =============================================================================
// Startup probe that flags stale ML predictions. The 4 predictors written by
// `train-extra-models` daily cron should refresh every 24h. If any of them is
// >14d old (or missing), it's a strong signal that pg_cron isn't running on
// prod (R8/R293 finding) or the train-extra-models edge fn is failing.
//
// Fires a Sentry warning with `cron_likely_dormant` tag so ops can
// distinguish from regular errors.
//
// Called once from app/_layout.tsx after auth is settled. Throttled via
// AsyncStorage (1 check per 24h per device) to avoid noise.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureMessage } from '../lib/errorReporting';
import {
  getCashflowGapPrediction,
  getCapacityOverrunPrediction,
  getSupplierLeadtimePredictions,
  getMaterialPriceForecasts,
} from './intelligenceCaptureService';

const STALE_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000;
const LAST_CHECK_KEY = '@vasco_ml_health_last_check';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

interface PredictorStatus {
  name: string;
  computedAt: string | null;
  staleDays: number | null;
  hasData: boolean;
}

/**
 * Run the health check at most once per 24h per device. Calling this on every
 * app cold-start is fine — the throttle keeps it cheap.
 */
export async function maybeRunMlHealthCheck(opts: {
  trade?: string;
  country?: string;
} = {}): Promise<void> {
  try {
    const last = await AsyncStorage.getItem(LAST_CHECK_KEY);
    if (last && Date.now() - Number(last) < CHECK_INTERVAL_MS) return;
  } catch {}

  const now = Date.now();
  const statuses: PredictorStatus[] = [];

  // Cashflow gap — 1 row per user
  try {
    const p = await getCashflowGapPrediction();
    statuses.push({
      name: 'ml_cashflow_gap_predictions',
      computedAt: p?.computedAt ?? null,
      staleDays: p?.computedAt ? Math.floor((now - new Date(p.computedAt).getTime()) / (24 * 60 * 60 * 1000)) : null,
      hasData: Boolean(p),
    });
  } catch {}

  // Capacity overrun — 1 row per user
  try {
    const p = await getCapacityOverrunPrediction();
    statuses.push({
      name: 'ml_capacity_overrun_predictions',
      computedAt: p?.computedAt ?? null,
      staleDays: p?.computedAt ? Math.floor((now - new Date(p.computedAt).getTime()) / (24 * 60 * 60 * 1000)) : null,
      hasData: Boolean(p),
    });
  } catch {}

  // Supplier lead-time — N rows per user; predictor doesn't expose computedAt
  // on each row, so we just check whether ANY rows exist.
  try {
    const rows = await getSupplierLeadtimePredictions();
    statuses.push({
      name: 'ml_supplier_leadtime_predictions',
      computedAt: null,
      staleDays: null,
      hasData: rows.length > 0,
    });
  } catch {}

  // Material price forecasts — likewise per-row without a computedAt
  if (opts.trade && opts.country) {
    try {
      const rows = await getMaterialPriceForecasts(opts.trade, opts.country);
      statuses.push({
        name: 'ml_material_price_forecasts',
        computedAt: null,
        staleDays: null,
        hasData: rows.length > 0,
      });
    } catch {}
  }

  const stale = statuses.filter(
    (s) => !s.hasData || (s.staleDays !== null && s.staleDays * 24 * 60 * 60 * 1000 >= STALE_THRESHOLD_MS),
  );

  if (stale.length > 0) {
    captureMessage(
      `ML predictions stale or missing: ${stale.map((s) => s.name).join(', ')}`,
      {
        tags: { cron_likely_dormant: 'true' },
        extras: {
          stale: stale.map((s) => ({ name: s.name, staleDays: s.staleDays, hasData: s.hasData })),
          all: statuses,
        },
      } as any,
    );
  }

  try {
    await AsyncStorage.setItem(LAST_CHECK_KEY, String(now));
  } catch {}
}

// Test/utility seam — clears the throttle key so the next call always runs.
export async function __resetMlHealthCheckThrottle(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LAST_CHECK_KEY);
  } catch {}
}

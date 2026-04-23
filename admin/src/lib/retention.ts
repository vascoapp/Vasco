// =============================================================================
// RETENTION ANALYTICS (R224)
// =============================================================================
// Fetches week-by-week cohort retention from the `get_signup_cohort_retention`
// RPC and shapes it into a grid the admin dashboard can render.
//
// Cohorts = ISO weeks of signup. Retention = any business_event that week.
// =============================================================================

import { getSupabase, isSupabaseConfigured } from "./supabase";

export interface RetentionRow {
  cohortWeek: string; // e.g. "2026-W15"
  cohortSize: number;
  weeksSinceSignup: number;
  activeUsers: number;
  retentionPct: number; // 0.0 – 1.0
}

export interface RetentionGrid {
  // One cohort per row.
  cohorts: Array<{
    cohortWeek: string;
    cohortSize: number;
    // Keyed by week offset: { 0: 1.0, 1: 0.72, 2: 0.61, ... }
    retentionByWeek: Record<number, number>;
  }>;
  // Flat list — convenient for CSV export.
  rows: RetentionRow[];
  maxWeekOffset: number;
  fetchedAt: string;
  live: boolean;
}

function empty(live: boolean): RetentionGrid {
  return {
    cohorts: [],
    rows: [],
    maxWeekOffset: 0,
    fetchedAt: new Date().toISOString(),
    live,
  };
}

// ---------------------------------------------------------------------------
// Pure shaper — exported for unit tests
// ---------------------------------------------------------------------------

export function shapeRows(rows: RetentionRow[]): RetentionGrid {
  const byCohort = new Map<string, { cohortWeek: string; cohortSize: number; retentionByWeek: Record<number, number> }>();
  let maxOffset = 0;
  for (const r of rows) {
    let entry = byCohort.get(r.cohortWeek);
    if (!entry) {
      entry = { cohortWeek: r.cohortWeek, cohortSize: r.cohortSize, retentionByWeek: {} };
      byCohort.set(r.cohortWeek, entry);
    }
    entry.retentionByWeek[r.weeksSinceSignup] = r.retentionPct;
    if (r.weeksSinceSignup > maxOffset) maxOffset = r.weeksSinceSignup;
  }
  // Most recent cohort first (DESC). RPC already orders this way; we preserve.
  const cohorts = Array.from(byCohort.values()).sort((a, b) => b.cohortWeek.localeCompare(a.cohortWeek));
  return {
    cohorts,
    rows,
    maxWeekOffset: maxOffset,
    fetchedAt: new Date().toISOString(),
    live: true,
  };
}

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

export async function fetchRetentionCohorts(
  opts: { weeksBack?: number; maxWeekOffset?: number; country?: string | null; trade?: string | null } = {},
): Promise<RetentionGrid> {
  if (!isSupabaseConfigured()) return empty(false);
  const client = getSupabase();
  if (!client) return empty(false);

  try {
    const { data, error } = await client.rpc("get_signup_cohort_retention", {
      p_weeks_back: opts.weeksBack ?? 12,
      p_max_week_offset: opts.maxWeekOffset ?? 12,
      p_country: opts.country ?? null,
      p_trade: opts.trade ?? null,
    });
    if (error || !Array.isArray(data)) return empty(true);

    const rows: RetentionRow[] = (data as any[]).map((r) => ({
      cohortWeek: String(r.cohort_week ?? ""),
      cohortSize: Number(r.cohort_size ?? 0),
      weeksSinceSignup: Number(r.weeks_since_signup ?? 0),
      activeUsers: Number(r.active_users ?? 0),
      retentionPct: Number(r.retention_pct ?? 0),
    }));
    return shapeRows(rows);
  } catch {
    return empty(true);
  }
}

// ---------------------------------------------------------------------------
// Heatmap colour helper — shared by the dashboard card
// ---------------------------------------------------------------------------

/** Maps a retention fraction (0–1) to a subtle background tint. */
export function retentionTint(pct: number | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return "transparent";
  if (pct >= 0.7) return "rgba(16, 185, 129, 0.35)";  // green
  if (pct >= 0.4) return "rgba(249, 115, 22, 0.30)";  // amber
  if (pct > 0)    return "rgba(239, 68, 68, 0.28)";   // red
  return "transparent";
}

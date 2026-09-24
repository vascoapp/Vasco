// =============================================================================
// ANALYTICS SNAPSHOT — read last-30-day event volume for the admin card
// =============================================================================

import { getSupabase, isSupabaseConfigured } from "./supabase";

export interface EventCount {
  name: string;
  count: number;
}

export interface AnalyticsSnapshot {
  totalEventsLast30d: number;
  uniqueUsersLast30d: number;
  topEvents: EventCount[];
  live: boolean;
  fetchedAt: string;
}

function empty(live: boolean): AnalyticsSnapshot {
  return {
    totalEventsLast30d: 0,
    uniqueUsersLast30d: 0,
    topEvents: [],
    live,
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchAnalyticsSnapshot(): Promise<AnalyticsSnapshot> {
  if (!isSupabaseConfigured()) return empty(false);
  const supabase = getSupabase();
  if (!supabase) return empty(false);

  try {
    // Aggregates only (migration 20260924000001): the table is not readable
    // from a browser, and it used to be read here as `analytics_events` with a
    // `user_context` column — a table that did not exist, with a column the
    // app never wrote. The admin dashboard showed nothing, forever.
    // service_role only (20260924000003) — this browser client cannot read it
    // until the admin has real server-side auth. Say so: `live: false`, never
    // zeros dressed as live numbers.
    const { data, error } = await supabase.rpc("get_analytics_summary", { p_days: 30 });
    if (error || !data) return empty(false);
    const summary = (data ?? { total: 0, top: [], distinctUsers: 0 }) as { total: number; top: Array<{ name: string; count: number }>; distinctUsers: number };

    return {
      totalEventsLast30d: summary.total ?? 0,
      uniqueUsersLast30d: summary.distinctUsers ?? 0,
      topEvents: summary.top ?? [],
      live: true,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return empty(true);
  }
}

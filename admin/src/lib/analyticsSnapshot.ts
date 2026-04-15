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
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("analytics_events")
      .select("name, user_context")
      .gte("timestamp", since);

    const rows = (data ?? []) as Array<{ name: string; user_context: { userId?: string } | null }>;
    const byName = new Map<string, number>();
    const userIds = new Set<string>();
    for (const r of rows) {
      byName.set(r.name, (byName.get(r.name) ?? 0) + 1);
      if (r.user_context?.userId) userIds.add(r.user_context.userId);
    }
    const topEvents = [...byName.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return {
      totalEventsLast30d: rows.length,
      uniqueUsersLast30d: userIds.size,
      topEvents,
      live: true,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return empty(true);
  }
}

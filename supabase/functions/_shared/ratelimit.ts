// =============================================================================
// Shared rate limiter for Supabase Edge Functions
// =============================================================================
// Per-key sliding-window limiter backed by in-memory map. Survives warm
// invocations within the same function instance but resets on cold boot —
// acceptable for abuse throttling; anything harder should live in Postgres.
// =============================================================================

interface Bucket { windowStart: number; count: number }

const buckets: Map<string, Bucket> = new Map();

export interface LimiterConfig {
  windowMs: number;
  max: number;
}

export function rateLimit(key: string, config: LimiterConfig): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || now - existing.windowStart >= config.windowMs) {
    buckets.set(key, { windowStart: now, count: 1 });
    return { ok: true, retryAfter: 0 };
  }
  if (existing.count >= config.max) {
    const retryAfter = Math.ceil((existing.windowStart + config.windowMs - now) / 1000);
    return { ok: false, retryAfter };
  }
  existing.count += 1;
  return { ok: true, retryAfter: 0 };
}

/** Best-effort garbage collect old buckets so the map doesn't grow forever. */
export function gcBuckets(maxAgeMs: number = 10 * 60 * 1000): void {
  const cutoff = Date.now() - maxAgeMs;
  for (const [k, v] of buckets) {
    if (v.windowStart < cutoff) buckets.delete(k);
  }
}

/**
 * Will retrying this database error ever help?
 *
 * A webhook answers 503 ("deliver again") only for TRANSIENT failures. A
 * permanent one — bad input (22xxx, e.g. a non-uuid in a uuid column),
 * a constraint (23xxx: NOT NULL, FK, CHECK), a schema mismatch (42xxx), or a
 * PostgREST request error (PGRST2xx) — fails identically on every retry, and
 * a 503 then turns it into days of redelivery: Stripe retries for 3 days and
 * may disable the endpoint, which would also cut off subscription events
 * (review 2026-10-05). Those are answered 200 and reported loudly instead.
 *
 * Pure TypeScript: jest imports it too.
 */
export function isPermanentDbError(error: { code?: unknown } | null | undefined): boolean {
  const code = typeof error?.code === 'string' ? error.code : '';
  return /^(22|23|42)/.test(code) || /^PGRST2/.test(code);
}

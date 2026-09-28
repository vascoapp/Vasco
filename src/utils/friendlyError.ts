// =============================================================================
// What a builder may read from an error — our own reasons yes, machine text no.
// =============================================================================
// Emulator walk 2026-09-28: tapping an upgrade showed "Edge Function returned a
// non-2xx status code". ~20 alerts passed `err.message` / `result.error`
// straight through. Many of those errors are OUR reasons, already localized
// ("jobBillingBasis refuses, with the reason") and must stay visible; the rest
// are supabase-js / fetch / JS / Postgres text in English. This keeps the
// first and swaps the second for the caller's localized fallback, logging the
// technical text. Guard: src/__tests__/alertsShowNoMachineErrors.test.ts.
import { logError } from './errorHandler';

const MACHINE = [
  /edge function/i, /non-2xx/i, /status code/i, /network request failed/i, /failed to fetch/i,
  /\bfetch\b/i, /typeerror|referenceerror|syntaxerror|rangeerror/i,
  // Code-shaped only: in German "null" is ZERO ("ergibt null oder weniger").
  /\bundefined\b|\bNaN\b|\bnull\b(?=[,.)\]]|\s*$)|reading '|of null|of undefined/,
  /\bJSON\b/, /PGRST\d*/, /\b\d{5}\b.*(violates|constraint)|violates .* constraint/i,
  /duplicate key/i, /permission denied|row-level security|\bRLS\b/i, /timeout|timed out|ECONN|ENOTFOUND|aborted/i,
  /supabase|postgrest|jwt|token (expired|invalid)\b|invalid (api key|session)|unauthori[sz]ed/i,
  // English internals thrown by our own services / Supabase auth (review
  // 2026-09-28) — translate at the throw site when one of these needs to be seen.
  /->|\bnot found\b|illegal transition|refusing to|returned$|invalid login credentials|for security purposes|has already been invoiced|is invalid:/i, /\b(status|HTTP)\s*(code\s*)?\d{3}\b/i,
  /server misconfigured|not configured|missing auth|price id/i, /\[object /, /^Error:/, /stack|at .*\(.*:\d+:\d+\)/,
];

/** True when `message` is machine text, not something written for a person. */
export function isMachineMessage(message: string): boolean {
  const m = message.trim();
  if (!m) return true;
  return MACHINE.some((re) => re.test(m));
}

/**
 * The message to show for `err`: its own text when that reads as a sentence
 * for people, otherwise `fallback`. Accepts an Error, a string, or a
 * `{ error | message }` result object.
 */
export function friendlyError(err: unknown, fallback: string, context = 'friendlyError'): string {
  const raw =
    typeof err === 'string' ? err
    : err instanceof Error ? err.message
    : err && typeof err === 'object' ? String((err as any).error ?? (err as any).message ?? '')
    : '';
  if (raw && !isMachineMessage(raw)) return raw;
  if (raw) logError(context, raw);
  return fallback;
}

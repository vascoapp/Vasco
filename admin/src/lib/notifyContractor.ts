import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Push the contractor about the decision just made (W119).
 *
 * Both decision pages (/quote/[id] and /accept/[token]) tell the customer
 * "your tradesperson has been notified"; this call is what makes that true.
 * `decide_acceptance_link` already wrote the job and the outcome event, so the
 * customer's screen never waits on this. One retry for a transient failure —
 * `quote-decided` pushes at most once per decision however often it is called.
 */
export function notifyContractor(supabase: SupabaseClient, token: string, attempt = 0): void {
  const retry = () => { if (attempt === 0) setTimeout(() => notifyContractor(supabase, token, 1), 2000); };
  supabase.functions
    .invoke('quote-decided', { body: { token } })
    .then(({ error }) => { if (error) retry(); })
    .catch(retry);
}

/**
 * Is this request the scheduler (or another server job), not a user?
 *
 * Cron-only functions — digests that push/email EVERY contractor, model
 * training, referral credits — had no caller check at all: anyone holding the
 * public anon key (it ships in the app) could fire them (2026-10-04).
 *
 * The one function that did check, weekly-digest, compared the header to the
 * SUPABASE_SERVICE_ROLE_KEY string and returned 403 to the real cron job: the
 * scheduler sends a service-role JWT that is not that exact string (both are
 * valid service-role credentials). So the role is read from the token.
 *
 * Safe ONLY because these functions run with verify_jwt on: the gateway has
 * checked the signature before this code runs (a request without a JWT gets
 * 401 at the gateway — verified 2026-10-04 for every function using this).
 * Never use this in a function deployed with --no-verify-jwt.
 *
 * Pure TypeScript (atob only): jest imports it too.
 */
export function isServiceRoleCall(authorization: string | null | undefined, serviceKey?: string | null): boolean {
  const token = String(authorization ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;
  if (serviceKey && token === serviceKey) return true;
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return false;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { role?: unknown };
    return payload.role === 'service_role';
  } catch {
    return false;
  }
}

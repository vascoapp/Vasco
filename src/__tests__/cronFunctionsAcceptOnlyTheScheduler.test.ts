/**
 * Cron-only edge functions answer the scheduler, not the public.
 *
 * Six of them (push/email to every contractor, model training, referral
 * credits) had NO caller check — the anon key ships in the app. The one that
 * checked, weekly-digest, compared the header to SUPABASE_SERVICE_ROLE_KEY as a
 * string and returned 403 to the real cron job, which sends a service-role JWT
 * that is not that string (cron_http_calls, 2026-09-28). One helper now reads
 * the role from the gateway-verified token.
 */
import * as fs from 'fs';
import * as path from 'path';
import { isServiceRoleCall } from '../../supabase/functions/_shared/cronAuth';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const b64url = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const token = (payload: object) => `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.sig`;

describe('isServiceRoleCall', () => {
  it('accepts the scheduler: a service-role token, or the exact service key', () => {
    expect(isServiceRoleCall(`Bearer ${token({ role: 'service_role', iss: 'supabase' })}`, 'some-other-key')).toBe(true);
    expect(isServiceRoleCall('Bearer the-key', 'the-key')).toBe(true);
  });

  it('refuses the public: the anon key, a user session, nothing, junk', () => {
    expect(isServiceRoleCall(`Bearer ${token({ role: 'anon' })}`, 'k')).toBe(false);
    expect(isServiceRoleCall(`Bearer ${token({ role: 'authenticated', sub: 'u1' })}`, 'k')).toBe(false);
    expect(isServiceRoleCall('', 'k')).toBe(false);
    expect(isServiceRoleCall(null, 'k')).toBe(false);
    expect(isServiceRoleCall('Bearer not-a-jwt', 'k')).toBe(false);
    expect(isServiceRoleCall('Bearer a.!!!.c', 'k')).toBe(false);
  });
});

describe('every function the scheduler calls checks its caller', () => {
  // Called by someone other than the scheduler, each with its reason.
  const EXEMPT = new Map([
    ['drain-account-deletions', 'the app invokes it right after a deletion request (user JWT)'],
    ['watchdog-daily', 'the GitHub watchdog workflow calls ?dry=1 with the anon key'],
  ]);
  const cron = fs.readFileSync(path.join(ROOT, 'supabase/cron.sql'), 'utf8');
  const targets = [...new Set([...cron.matchAll(/\/functions\/v1\/([a-z0-9-]+)/g)].map((m) => m[1]))];

  it('finds the cron targets', () => {
    expect(targets).toEqual(expect.arrayContaining(['weekly-digest', 'daily-push-digest', 'train-extra-models']));
  });

  it.each(targets.filter((t) => !EXEMPT.has(t)))('%s', (fn) => {
    const src = stripComments(fs.readFileSync(path.join(ROOT, `supabase/functions/${fn}/index.ts`), 'utf8'));
    expect(src).toMatch(/if \(!isServiceRoleCall\(req\.headers\.get\('authorization'\)/);
    // …and nothing compares the raw header to the key string any more.
    expect(src).not.toMatch(/!==\s*`Bearer \$\{serviceKey\}`/);
  });
});

describe('weekly-digest stays off until its email is fit to send', () => {
  it('returns before any query or email unless WEEKLY_DIGEST_ENABLED=true', () => {
    const src = stripComments(fs.readFileSync(path.join(ROOT, 'supabase/functions/weekly-digest/index.ts'), 'utf8'));
    const gate = src.indexOf("Deno.env.get('WEEKLY_DIGEST_ENABLED') !== 'true'");
    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(src.indexOf("from('business_settings')"));
    expect(gate).toBeLessThan(src.indexOf('api.resend.com'));
  });
});

/**
 * @jest-environment node
 */
// On 2026-09-20 production had ONE of eleven cron jobs registered. Nothing
// reported it, for two reasons that are the same reason:
//
//  • the watchdog asked `!cron.length` — "are there ANY?" — and one is not
//    zero, so no finding fired while the GDPR deletion drain, the push digest,
//    all ten automation packs and the referral-credit grant were dormant;
//  • `cron-health.sql` listed the expected jobs in a COMMENT, expected 10 when
//    cron.sql defines 11, and the job it OMITTED — `vasco-watchdog-daily` —
//    was the only one actually registered. The single job that existed was the
//    one nothing checked for.
//
// Three lists of the same names, authored separately, drifting in both
// directions (#170). This fails the moment any two disagree.
//
// 2026-09-21: there was a FOURTH. `scripts/register-crons.mjs` — the script
// whose whole job is to register these schedules — carried its own array of
// nine while cron.sql defined eleven, so a successful run would register all
// eleven and then verify nine, reporting success. The two it omitted included
// `vasco-pack-trigger-tick`, which drives all ten automation packs. The fix is
// not a fourth correct list: the script now DERIVES the names from cron.sql,
// and the test below fails if anyone writes them out by hand again.
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** The names cron.sql actually schedules — the source of truth. */
function jobsInCronSql(): string[] {
  const src = read('supabase/cron.sql');
  const names = new Set<string>();
  // `select cron.schedule(\n  'name',` — the name is the first argument.
  for (const m of src.matchAll(/cron\.schedule\(\s*'([^']+)'/g)) names.add(m[1]);
  return [...names].sort();
}

/** The array the watchdog edge function checks against. */
function jobsInWatchdog(): string[] {
  const src = read('supabase/functions/watchdog-daily/index.ts');
  const at = src.indexOf('const EXPECTED_CRON_JOBS');
  if (at < 0) return [];
  const block = src.slice(at, src.indexOf('] as const', at));
  return [...block.matchAll(/'(vasco-[^']+)'/g)].map((m) => m[1]).sort();
}

/** The array cron-health.sql asserts on. */
function jobsInCronHealth(): string[] {
  const src = read('supabase/cron-health.sql');
  const at = src.indexOf('expected text[] := array[');
  if (at < 0) return [];
  const block = src.slice(at, src.indexOf('];', at));
  return [...block.matchAll(/'(vasco-[^']+)'/g)].map((m) => m[1]).sort();
}

describe('the three lists of cron jobs agree', () => {
  const fromSql = jobsInCronSql();

  it('cron.sql is parsed at all', () => {
    // Without this the comparisons below are vacuously true — two empty
    // arrays are equal, which is exactly how a toothless guard passes.
    expect(fromSql.length).toBeGreaterThanOrEqual(11);
    expect(fromSql).toContain('vasco-watchdog-daily');
    expect(fromSql).toContain('vasco-drain-account-deletions');
  });

  it('the watchdog expects exactly what cron.sql registers', () => {
    expect(jobsInWatchdog()).toEqual(fromSql);
  });

  it('cron-health.sql expects exactly what cron.sql registers', () => {
    expect(jobsInCronHealth()).toEqual(fromSql);
  });

  it('the job that hid this one is in every list', () => {
    // `vasco-watchdog-daily` was in cron.sql and absent from cron-health.sql's
    // expected set. It is the watchdog's OWN schedule, so it is the job most
    // likely to be registered and least likely to be checked.
    for (const [name, list] of [['watchdog', jobsInWatchdog()], ['cron-health', jobsInCronHealth()]] as const) {
      expect({ name, has: list.includes('vasco-watchdog-daily') }).toEqual({ name, has: true });
    }
  });
});

describe('a partial application is reported, not just a total one', () => {
  const WATCHDOG = read('supabase/functions/watchdog-daily/index.ts');

  it('the watchdog compares against the expected SET, not a count', () => {
    expect(WATCHDOG).toMatch(/const missing = EXPECTED_CRON_JOBS\.filter\(\(j\) => !registered\.has\(j\)\)/);
    expect(WATCHDOG).toMatch(/cron schedules are NOT registered/);
  });

  it('the missing jobs are NAMED', () => {
    // Which ones are missing decides how bad it is: an undrained erasure
    // queue is a legal deadline, a missed retrain is not.
    expect(WATCHDOG).toMatch(/\$\{missing\.join\(', '\)\}/);
  });

  it('it is a critical, not a warning', () => {
    const at = WATCHDOG.indexOf('const missing = EXPECTED_CRON_JOBS');
    const body = WATCHDOG.slice(at, at + 600);
    expect(body).toMatch(/add\(\s*'critical'/);
  });

  it('the digest prints a denominator', () => {
    // "1 schedules" reads as healthy; "1/11" does not.
    expect(WATCHDOG).toMatch(/\$\{cron\.length\}\/\$\{EXPECTED_CRON_JOBS\.length\} schedules/);
  });

  it('cron-health.sql raises rather than printing rows to be eyeballed', () => {
    const SQL = read('supabase/cron-health.sql');
    expect(SQL).toMatch(/raise exception/);
    expect(SQL).toMatch(/CRON HEALTH FAILED/);
    // …and catches drift the other way too.
    expect(SQL).toMatch(/not \(j\.jobname = any\(expected\)\)/);
  });
});

describe('the registration script does not keep its own copy of the list', () => {
  const SCRIPT = read('scripts/register-crons.mjs');

  it('names no job literally', () => {
    // The whole defect in one assertion: a `'vasco-…'` literal in this file is
    // a list that can drift from cron.sql. There must not be one.
    const literals = [...SCRIPT.matchAll(/'(vasco-[^']+)'/g)].map((m) => m[1]);
    expect(literals).toEqual([]);
  });

  it('derives the expected set from cron.sql', () => {
    expect(SCRIPT).toMatch(/function jobsInCronSql/);
    expect(SCRIPT).toContain("cron\\.schedule\\(");
    expect(SCRIPT).toMatch(/const REQUIRED_JOBS = jobsInCronSql\(cronSql\)/);
  });

  it('refuses to run when the parse comes back empty', () => {
    // Verifying against an empty expected set "passes" whatever happened —
    // the same vacuous shape the first test in this file guards against.
    expect(SCRIPT).toMatch(/REQUIRED_JOBS\.length === 0/);
    expect(SCRIPT).toMatch(/refusing to run/);
  });

  it('sends cron.sql as a FILE, not as a positional argument', () => {
    // `supabase db query <sql>` is parsed by Cobra, which reads a leading `-`
    // as a flag. cron.sql opens with `-- ====`, so the real run died on
    // `unknown flag: --` while a stubbed CLI — which read argv directly and
    // never parsed flags — reported success. A stub cannot verify the
    // interface to the thing it replaces.
    expect(SCRIPT).toMatch(/'db', 'query', '--linked', '-f', tmp/);
    expect(SCRIPT).toMatch(/await runSqlFile\(expanded\)/);
    // …and the key must not go back onto the command line, where `ps` sees it.
    expect(SCRIPT).not.toMatch(/runViaSupabaseCli\(expanded\)/);
  });

  it('does not leave the key in a temp file after the run', () => {
    expect(SCRIPT).toMatch(/mode: 0o600/);
    expect(SCRIPT).toMatch(/finally \{[\s\S]*?unlinkSync\(tmp\)/);
  });

  it('does not call an RPC this project has never defined', () => {
    // `executeSql` POSTed to /rest/v1/rpc/exec, which exists in no migration.
    // It was dead — every path went through the CLI — but it read as the
    // mechanism, which is how it survived.
    expect(SCRIPT).not.toMatch(/rpc\/exec/);
  });
});

// #359 — pg_cron records a run as `succeeded` when the statement enqueued an
// HTTP request, whatever came back. Eleven schedules registered with a key
// that had never been exercised would have reported healthy either way.
describe('a scheduled call is judged by its OUTCOME, not by pg_cron', () => {
  const CRON = read('supabase/cron.sql');
  const WATCHDOG = read('supabase/functions/watchdog-daily/index.ts');

  /** Each `select cron.schedule('name', …)` block, split on the call itself. */
  function scheduleBlocks(): { job: string; body: string }[] {
    return CRON.split(/select cron\.schedule\(/).slice(1).map((b) => ({
      job: (b.match(/^\s*'([^']+)'/) ?? [, '?'])[1] as string,
      body: b,
    }));
  }

  it('cron.sql is parsed into blocks at all', () => {
    // Without this the per-block assertions below are vacuously true.
    const blocks = scheduleBlocks();
    expect(blocks.length).toBeGreaterThanOrEqual(12);
    expect(blocks.filter((b) => b.body.includes('net.http_post')).length).toBeGreaterThanOrEqual(9);
  });

  it('EVERY job that fires an HTTP call records its request id', () => {
    // This is the guard that matters for jobs written LATER. A new schedule
    // with a bare `select net.http_post(…)` is invisible again: pg_net's
    // response carries no url, and the request queue is emptied on completion,
    // so an unrecorded id can never be attributed back to its job.
    const unrecorded = scheduleBlocks()
      .filter((b) => b.body.includes('net.http_post'))
      .filter((b) => !b.body.includes('insert into public.cron_http_calls'))
      .map((b) => b.job);
    expect(unrecorded).toEqual([]);
  });

  it('no call is judged by pg_net\'s 5-second default timeout (#361)', () => {
    // Without an explicit timeout pg_net gives up after 5000 ms and records
    // `timed_out` — while the function carries on and returns 200. Three
    // healthy jobs were raised as criticals that way on the detector's first
    // day. The timeout must clear the edge-function wall clock (150 s).
    for (const b of scheduleBlocks().filter((x) => x.body.includes('net.http_post'))) {
      const ms = Number((b.body.match(/timeout_milliseconds\s*:=\s*(\d+)/) ?? [])[1] ?? 0);
      expect({ job: b.job, clearsWallClock: ms > 150_000 }).toEqual({ job: b.job, clearsWallClock: true });
    }
  });

  it('each recorded call is filed under its OWN job name', () => {
    // A copy-paste that files job B's call under job A's name is worse than
    // no attribution: it points the operator at a healthy job.
    for (const b of scheduleBlocks().filter((x) => x.body.includes('net.http_post'))) {
      expect({ job: b.job, filesItselfCorrectly: b.body.includes(`select '${b.job}', request_id`) })
        .toEqual({ job: b.job, filesItselfCorrectly: true });
    }
  });

  it('the outcomes are copied out of pg_net before it prunes them', () => {
    // pg_net's TTL is hours; the erasure drain fires at 02:00 and the watchdog
    // reads at 07:00. A join at digest time finds nothing and calls it health.
    const reconciler = scheduleBlocks().find((b) => b.job === 'vasco-reconcile-http-outcomes');
    expect(reconciler).toBeDefined();
    expect(reconciler!.body).toMatch(/reconcile_cron_http_outcomes/);
    expect(reconciler!.body).toMatch(/'\*\/10 \* \* \* \*'/);
  });

  it('the watchdog reads outcomes and raises a CRITICAL naming the job', () => {
    expect(WATCHDOG).toMatch(/get_cron_http_failures/);
    const at = WATCHDOG.indexOf('REGISTERED IS NOT WORKING (#359)');
    expect(at).toBeGreaterThan(-1);
    const body = WATCHDOG.slice(at, at + 1200);
    expect(body).toMatch(/add\(\s*'critical'/);
    expect(body).toMatch(/\$\{jobname\}/);
  });

  it('an unreadable outcome source degrades loudly instead of reading as zero', () => {
    // "No failures" and "could not check for failures" must never look alike.
    expect(WATCHDOG).toMatch(/Scheduled HTTP outcomes could not be read/);
  });

  it('the RPC never returns pg_net headers or body', () => {
    // net._http_response.headers carries the service-role JWT; .content can
    // carry customer data. Only the verdict may cross that boundary.
    const MIG = read('supabase/migrations/20260921000001_cron_http_outcomes.sql');
    const rpc = MIG.slice(MIG.indexOf('function public.get_cron_http_failures'));
    expect(rpc).not.toMatch(/r\.headers|r\.content|\bcontent\b/);
  });
});

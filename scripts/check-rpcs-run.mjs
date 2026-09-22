#!/usr/bin/env node
// =============================================================================
// check:rpcs — does every set-returning PL/pgSQL RPC in production PLAN? (#361)
// =============================================================================
// Eight RPCs failed on every call for months — grant_referral_credits, the
// quote-win training feed, material drift, seasonality, retention, and all
// three match_similar_* — with 42702 "column reference is ambiguous" (an OUT
// column of RETURNS TABLE shadowing a table column) or 42804 (declared `real`,
// returned `double precision`). PL/pgSQL is only checked when a statement
// RUNS, so a migration applies cleanly and a static read cannot see it; the
// callers swallowed the error and fell back. The one that surfaced did so
// only because pg_cron's HTTP outcome became visible (#359).
//
// So: call every RETURNS TABLE plpgsql function in `public` with NULL
// arguments, inside ONE transaction that always rolls back (the DO block ends
// by raising), and fail on any SQLSTATE that is a defect in the function
// rather than a refusal of the caller.
//
// ⚠️ This proves only the statements that EXECUTE. A function that returns
// early on NULL input (a k-anonymity gate, a missing query embedding) never
// plans its main query here. When you fix one, reach its deep path with
// seeded rows in a rolled-back transaction — see learnings #361.
//
// Runs through `supabase db query --linked -f` (Management API): no keys in
// argv, nothing committed. `--decoy` creates a deliberately ambiguous function
// in the same rolled-back transaction and asserts the check catches it.
// =============================================================================

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// SQLSTATEs that mean "this caller may not", not "this function is broken".
const REFUSALS = new Set([
  '42501', // insufficient_privilege — e.g. predict_customer_dso's own auth.uid() gate
  '22004', // null_value_not_allowed — an explicit NULL-argument guard
  'P0001', // raise_exception — a function's own validation message
]);

const DECOY = process.argv.includes('--decoy');

const decoySql = DECOY
  ? `execute $d$create function public.zz_check_rpcs_decoy()
       returns table (referrer_user_id uuid) language plpgsql as $b$
       begin return query select referrer_user_id from public.referral_attributions; end $b$$d$;`
  : '';

const sql = `do $probe$
declare f record; rep text := ''; args text;
begin
  ${decoySql}
  for f in
    select p.proname, p.pronargs
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
    where n.nspname = 'public' and l.lanname = 'plpgsql' and p.proretset
      and p.proargmodes is not null and 't' = any (p.proargmodes::text[])
    order by 1
  loop
    args := coalesce((select string_agg('null', ',') from generate_series(1, f.pronargs)), '');
    begin
      execute format('select count(*) from public.%I(%s)', f.proname, args);
      rep := rep || f.proname || '=ok|';
    exception when others then
      rep := rep || f.proname || '=' || sqlstate || '~' || translate(left(sqlerrm, 100), '"''|~', '____') || '|';
    end;
  end loop;
  raise exception 'CHECK_RPCS[%]', rep;
end $probe$;`;

const dir = mkdtempSync(join(tmpdir(), 'check-rpcs-'));
const file = join(dir, 'probe.sql');
writeFileSync(file, sql, { mode: 0o600 });

let out = '';
try {
  out = execFileSync('npx', ['supabase', 'db', 'query', '--linked', '-f', file], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (e) {
  // The probe ALWAYS raises (that is the rollback), so a non-zero exit is normal.
  out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
} finally {
  rmSync(dir, { recursive: true, force: true });
}

const m = out.match(/CHECK_RPCS\[([^\]]*)\]/);
if (!m) {
  // No report means the probe never ran — never read that as "all clean".
  console.error('check:rpcs could not run the probe:\n' + out.slice(0, 800));
  process.exit(2);
}

const results = m[1].split('|').filter(Boolean).map((entry) => {
  const [name, rest] = entry.split('=');
  const [state, msg] = rest === 'ok' ? ['ok', ''] : rest.split('~');
  return { name, state, msg };
});

if (results.length < 20) {
  console.error(`check:rpcs probed only ${results.length} functions — expected 20+. Refusing to call that clean.`);
  process.exit(2);
}

const broken = results.filter((r) => r.state !== 'ok' && !REFUSALS.has(r.state));
const refused = results.filter((r) => REFUSALS.has(r.state));

console.log(`check:rpcs — ${results.length} set-returning plpgsql functions probed (rolled back)`);
for (const r of refused) console.log(`  · ${r.name}: refused the caller (${r.state}) — not a defect`);

if (DECOY) {
  const caught = broken.some((r) => r.name === 'zz_check_rpcs_decoy' && r.state === '42702');
  console.log(caught ? '✅ decoy caught (42702) — the check bites' : '🔴 DECOY NOT CAUGHT — the check is blind');
  process.exit(caught ? 0 : 1);
}

if (broken.length) {
  console.error(`🔴 ${broken.length} function(s) fail on every call:`);
  for (const r of broken) console.error(`  ✗ ${r.name}: ${r.state} ${r.msg}`);
  process.exit(1);
}
console.log('✅ every one plans and runs');

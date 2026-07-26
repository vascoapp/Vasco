#!/usr/bin/env node
// =============================================================================
// GRANT CHECK — every table the client calls must be reachable by `authenticated`
// =============================================================================
// R324. This exists because the bug it checks for is invisible from every other
// angle we had:
//
//   - the migrations were RIGHT (RLS enabled, correct owner-scoped policies)
//   - tsc, jest and the OTA preflight were all green
//   - the app did not crash or show an error, because the R52/R54 offline path
//     caught the 42501 and queued the write
//
// …while 19 of the 21 tables the client calls had NO grant to `authenticated`,
// so nothing a signed-in contractor did ever reached the database. It lived in
// AsyncStorage and died on reinstall. GRANT is checked BEFORE RLS, so correct
// policies over a missing grant is a silent, total persistence failure.
//
// It was found by querying prod, not by reading SQL — and that is the point:
// 20260527000003 fixed exactly this for `leads`/`workers` two months earlier
// and nobody asked whether the other 86 tables had the same hole.
//
// Usage:
//   npm run check:grants
// Needs a Supabase management token. Locally it reads the macOS keychain, or
// pass one explicitly:
//   SUPABASE_ACCESS_TOKEN=sbp_... npm run check:grants
// =============================================================================

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT_REF = 'gblhqhorkarocmputhte';
const SCAN_DIRS = ['src/lib', 'src/state', 'src/services', 'src/intelligence'];

// Tables the client references that deliberately do NOT exist yet. Allowlisted
// with a reason so a NEW missing table is a real finding rather than noise in a
// permanently-red check — the same convention as OTA preflight checks 7-9.
const MISSING_TABLE_OK = new Map([
  ['user_settings', 'emailImportService:84 — email import was scaffolded FE-first; no migration ever created this table. The upsert is try/catch-wrapped behind an AsyncStorage-first write, so config survives locally and is lost on reinstall. Creating it is a SCHEMA_LOCK bump + a product call on whether email import ships.'],
  ['email_imports', 'emailImportService:147 — same feature, read half. Returns [] on error, so the feature is inert rather than broken. Needs the edge function too, not just a table.'],
]);

function token() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN;
  try {
    const raw = execSync(
      'security find-generic-password -s "Supabase CLI" -a supabase -w',
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    return Buffer.from(raw.replace(/^go-keyring-base64:/, ''), 'base64').toString('utf8').trim();
  } catch {
    return null;
  }
}

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      if (e === 'node_modules' || e === '__tests__') continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

// Tables the client reaches over PostgREST.
function clientTables() {
  const found = new Set();
  for (const d of SCAN_DIRS) {
    for (const f of walk(join(ROOT, d))) {
      const text = readFileSync(f, 'utf8');
      for (const m of text.matchAll(/\.from\(\s*['"]([a-z_][a-z0-9_]*)['"]\s*\)/g)) {
        found.add(m[1]);
      }
    }
  }
  return [...found].sort();
}

async function query(tok, sql) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
    },
  );
  if (!res.ok) throw new Error(`Management API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

const tok = token();
if (!tok) {
  console.error('No Supabase management token (keychain miss and SUPABASE_ACCESS_TOKEN unset).');
  process.exit(2);
}

const tables = clientTables();
const list = tables.map((t) => `'${t}'`).join(',');
console.log(`Client calls ${tables.length} table(s) over PostgREST.\n`);

// 1. Missing grants — the R324 bug.
const missing = await query(tok, `
  select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and c.relname in (${list})
     and not (has_table_privilege('authenticated', c.oid, 'SELECT')
          and has_table_privilege('authenticated', c.oid, 'INSERT'))`);

// 2. Tables the client calls that do not exist at all — same symptom to a user
//    (every call fails), different cause, and equally invisible to tsc.
const existing = await query(tok, `
  select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and c.relname in (${list})`);
const existingNames = new Set(existing.map((r) => r.relname));
const absent = tables
  .filter((t) => !existingNames.has(t))
  .filter((t) => !MISSING_TABLE_OK.has(t));
for (const [t, why] of MISSING_TABLE_OK) {
  if (!existingNames.has(t)) console.log(`  (known-absent) ${t} — ${why.split(' — ')[0]}`);
}

// 3. A grant without RLS is the opposite failure: a cross-tenant leak.
const ungoverned = await query(tok, `
  select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and has_table_privilege('authenticated', c.oid, 'SELECT')
     and c.relrowsecurity = false`);

// 4. anon should hold no table grants at all — the portal reads via
//    SECURITY DEFINER RPCs, never a broad table grant (see R17).
const anonGrants = await query(tok, `
  select distinct table_name from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'anon'`);

// 5. SECURITY DEFINER with a mutable search_path = privilege escalation, since
//    the function runs as its owner and an unqualified name can be shadowed.
const unpinnedSecdef = await query(tok, `
  select p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef and p.proconfig is null`);

// 6. CREATE on schema public is the precondition that makes #5 exploitable.
//    Postgres 15+ revokes it from PUBLIC by default; app roles never do DDL.
const schemaCreate = await query(tok, `
  select r.rolname from pg_roles r
   where r.rolname in ('anon','authenticated')
     and has_schema_privilege(r.rolname, 'public', 'CREATE')`);

// 7. The anon-callable SECURITY DEFINER surface. Those bypass RLS entirely, so
//    the list must stay short and deliberate. NOTE the `prosecdef` filter: a
//    plain function runs as the CALLER, so RLS still applies and it is not a
//    bypass vector — without this filter the check flags ~200 harmless things
//    including pgvector's math helpers. Also note that anon reaching a function
//    usually means PostgreSQL's DEFAULT `PUBLIC EXECUTE`, not an explicit
//    grant: R18 of the audit counted only explicit grants, concluded there were
//    "4 anon-executable RPCs", and missed 59.
const ANON_RPC_OK = new Map([
  ['get_portal_by_access_code', 'customer portal entry point, scoped by the access code itself'],
  ['get_customer_question_status', 'portal Q&A poll, scoped by the tracker access token (R17)'],
  ['write_signature_via_portal', 'customer signs from the portal, scoped by access token'],
  ['get_cron_health', 'cron liveness for the admin dashboard; exposes job names + timestamps only'],
]);
const anonRpcs = await query(tok, `
  select p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef
     and has_function_privilege('anon', p.oid, 'EXECUTE')
   order by 1`);
const unexpectedAnonRpc = anonRpcs.filter((r) => !ANON_RPC_OK.has(r.proname));

let bad = 0;
const report = (label, rows, fmt) => {
  if (rows.length === 0) { console.log(`✓ ${label}`); return; }
  bad++;
  console.log(`✗ ${label} (${rows.length})`);
  for (const r of rows.slice(0, 20)) console.log(`    ${fmt(r)}`);
};

report('every client table is readable+writable by authenticated', missing, (r) => `${r.relname} — no grant; every read/write returns 42501 and is silently queued offline`);
report('every client table exists', absent.map((t) => ({ t })), (r) => `${r.t} — client calls .from('${r.t}') but no such table`);
report('no table is granted to authenticated without RLS', ungoverned, (r) => `${r.relname} — granted but RLS off: cross-tenant read`);
report('anon holds no table grants', anonGrants, (r) => `${r.table_name} — anon should read via SECURITY DEFINER RPC only`);
report('every SECURITY DEFINER function pins search_path', unpinnedSecdef, (r) => `${r.proname} — runs as owner with a mutable search_path: privilege escalation`);
report('anon/authenticated cannot CREATE in schema public', schemaCreate, (r) => `${r.rolname} holds CREATE — lets an attacker shadow an unqualified name`);
report('no unexpected anon-callable RPC', unexpectedAnonRpc, (r) => `${r.proname} — executable by anon; if SECURITY DEFINER it bypasses RLS. Add to ANON_RPC_OK with a reason, or revoke.`);

console.log('');
if (bad > 0) {
  console.log('❌ Grant check failed. The app cannot persist to the tables listed above.');
  process.exit(1);
}
console.log('✅ Grants are correct — client tables reachable, anon closed, RLS governs every grant.');

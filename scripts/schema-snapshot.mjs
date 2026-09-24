#!/usr/bin/env node
// Snapshot the LIVE public schema for the unit-test fake backend
// (src/test-utils/fakeSupabase.ts). database.types.ts is hand-written and
// covers ~20 of ~90 tables; the fake must reject exactly what production
// rejects, so it reads the database's own column list.
//
//   npm run schema:snapshot      (needs `npx supabase` linked to prod)
//
// Re-run after applying a migration; check:drift covers types-vs-live.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const sql = `select table_name as t, column_name as c, is_nullable as n, column_default as d, data_type as ty
  from information_schema.columns
  where table_schema = 'public'
    -- Views too: price_references / material_price_benchmarks are read like
    -- tables, and leaving them out made every read of them look unknown.
    and table_name in (select table_name from information_schema.tables where table_schema = 'public' and table_type in ('BASE TABLE', 'VIEW'))
  order by table_name, ordinal_position`;
const out = execFileSync('npx', ['supabase', 'db', 'query', '--linked', sql], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const rows = JSON.parse(out.slice(out.indexOf('{'))).rows;

const tables = {};
for (const r of rows) {
  (tables[r.t] ??= {})[r.c] = { nullable: r.n === 'YES', hasDefault: r.d != null, type: r.ty, ...(r.d ? { default: String(r.d) } : {}) };
}
// RPCs: PostgREST resolves a function by NAME + ARGUMENT NAMES, so a call
// with a misspelt argument is PGRST202 just like a missing function (#355).
const fnSql = `select p.proname as name, coalesce(array_to_json(p.proargnames), '[]'::json) as args, p.pronargs as n, p.pronargdefaults as d, p.proargmodes::text as modes
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public' and p.prokind = 'f'`;
const fnOut = execFileSync('npx', ['supabase', 'db', 'query', '--linked', fnSql], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const functions = {};
for (const f of JSON.parse(fnOut.slice(fnOut.indexOf('{'))).rows) {
  const names = (Array.isArray(f.args) ? f.args : []).slice(0, f.n); // IN args come first
  const required = names.slice(0, f.n - (f.d ?? 0));
  (functions[f.name] ??= []).push({ args: names, required });  // overloads
}
// What a signed-in user may do per table. PostgREST needs SELECT for any
// `.select()` AND for an upsert's ON CONFLICT target — a table granted INSERT
// only rejects `upsert(onConflict)` with 42501 (review 2026-09-24, H1).
const grSql = `select table_name as t, string_agg(privilege_type, ',') as p
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee = 'authenticated' group by table_name`;
const grOut = execFileSync('npx', ['supabase', 'db', 'query', '--linked', grSql], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const grants = {};
for (const g of JSON.parse(grOut.slice(grOut.indexOf('{'))).rows) grants[g.t] = g.p.split(',').sort();
// What happens to a public row when its auth user is deleted. SET NULL keeps
// the row — the erasure worker must delete those itself (review 2026-09-24:
// five tables kept free text past "everything is erased").
const fkSql = `select c.conrelid::regclass::text as t, c.confdeltype as a
  from pg_constraint c
  where c.contype = 'f' and c.confrelid = 'auth.users'::regclass
    and c.connamespace = 'public'::regnamespace`;
const fkOut = execFileSync('npx', ['supabase', 'db', 'query', '--linked', fkSql], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const ACTION = { a: 'NO ACTION', r: 'RESTRICT', c: 'CASCADE', n: 'SET NULL', d: 'SET DEFAULT' };
const authUserFks = {};
for (const f of JSON.parse(fkOut.slice(fkOut.indexOf('{'))).rows) {
  const t = f.t.replace(/^public\./, '');
  (authUserFks[t] ??= []).push(ACTION[f.a] ?? f.a);
}
const file = new URL('../src/test-utils/schema.snapshot.json', import.meta.url);
writeFileSync(file, JSON.stringify({ takenAt: new Date().toISOString().slice(0, 10), tables, functions, grants, authUserFks }, null, 1) + '\n');
console.log(`schema snapshot: ${Object.keys(tables).length} tables, ${rows.length} columns, ${Object.keys(functions).length} functions, grants on ${Object.keys(grants).length} tables`);

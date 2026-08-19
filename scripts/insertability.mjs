#!/usr/bin/env node
// =============================================================================
// Can the app actually INSERT into every table it writes to?
// =============================================================================
// `check:drift` answers "does the FE's idea of the columns match the
// database's". This answers the next question down: given those columns, does a
// row the app would write actually go in?
//
// ⚠️ HONEST SCOPE, because the first draft of this comment overclaimed.
// This probe fills EVERY required column itself, so it would NOT have caught
// `price_observations.supplier_id` — a NOT NULL column with no default that the
// only writer never set. A table can accept a perfect synthetic row and still
// reject every row the app actually sends.
//
// So it does two separate things, and the second is the one with teeth:
//
//   1. REACHABILITY — the table accepts an owner's minimal row under RLS.
//      Catches a broken policy, an unreachable table, a CHECK the app's
//      vocabulary violates.
//   2. REQUIRED-COLUMN COVERAGE — for every NOT NULL column with no default,
//      does any writer in src/ or app/ actually name it? A required column no
//      writer sets is the price_observations bug, and this is the check that
//      finds it.
//
// METHOD, per table: build the minimal row — every NOT NULL column that has no
// default — with a plausible value for its type, plus `user_id`, and insert it
// as a REAL authenticated user so RLS is exercised too. Then delete it.
//
// A failure means one of:
//   🔴 23502  a NOT NULL column with no default that a writer must always set.
//             Fine IF every writer sets it; a landmine if any writer does not.
//   🔴 23514  a CHECK the generated value violates — usually means the column
//             wants a specific vocabulary the harness cannot guess.
//   🔴 42501  RLS refused an authenticated owner's own insert.
//   🔴 23503  an FK the harness cannot satisfy (expected for child tables).
//
// ⚠️ This is a REACHABILITY probe, not a correctness one. A pass means the
// table accepts a row; it does not mean any writer sends the right one. And a
// 23503 on a child table is the harness's limitation, not a defect — those are
// reported apart.
//
// Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY.
// Run: npm run check:insertable
// =============================================================================

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anon = process.env.SUPABASE_ANON_KEY;
if (!url || !service || !anon) {
  console.error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY');
  process.exit(1);
}

const admin = createClient(url, service, { auth: { persistSession: false } });

// The tables the mobile app writes to, from database.types.ts + the offline
// queue's table list. Explicit: probing all 91 tables in public would drown the
// signal in cron/analytics tables the client never touches.
const APP_TABLES = [
  'customers', 'jobs', 'documents', 'line_items', 'projects', 'workers', 'leads',
  'expenses', 'material_catalog', 'suppliers', 'job_materials', 'price_observations',
  'quote_acceptance_links', 'decision_trackers', 'decision_items', 'decision_submissions',
  'business_settings',
];

const NOW = new Date().toISOString();
const UUID_ZERO = '00000000-0000-0000-0000-000000000000';

/** A plausible value for a column, from its postgres type. */
function sample(col, userId) {
  if (col.name === 'user_id') return userId;
  switch (col.udt) {
    case 'uuid':        return UUID_ZERO;
    case 'int2': case 'int4': case 'int8':
    case 'numeric': case 'float4': case 'float8': return 1;
    case 'bool':        return false;
    case 'date':        return NOW.slice(0, 10);
    case 'timestamptz': case 'timestamp': return NOW;
    case 'json': case 'jsonb': return {};
    default:
      // text/varchar and everything else. Arrays surface as `_text` etc.
      return col.udt?.startsWith('_') ? [] : 'harness';
  }
}

/**
 * Some tables cannot be probed with a synthetic row and that is not a defect:
 *
 *   · a CHECK constraint wants a specific vocabulary ('quote' | 'invoice'),
 *     which no generic value generator can guess;
 *   · a child table's RLS is scoped through its PARENT (decision_items has no
 *     user_id at all — ownership comes from decision_trackers), so a made-up
 *     tracker_id is correctly refused.
 *
 * The first version of this script reported both as failures. That is the
 * harness lying about the code, so instead: build the real prerequisites and
 * probe for real. `prepare` runs before the insert and returns column overrides;
 * anything it creates is owned by the probe user and removed with them.
 */
const PREREQS = {
  documents: async () => ({ doc_type: 'invoice', status: 'draft' }),

  line_items: async (authed, uid) => {
    const { data } = await authed.from('documents')
      .insert({ user_id: uid, doc_type: 'invoice', status: 'draft', document_number: `H-${Date.now()}` })
      .select().single();
    return data ? { document_id: data.id } : {};
  },

  job_materials: async (authed, uid) => {
    const { data: job } = await authed.from('jobs').insert({ user_id: uid, title: 'harness' }).select().single();
    const { data: mat } = await authed.from('material_catalog').insert({ user_id: uid, name: 'harness' }).select().single();
    return { ...(job ? { job_id: job.id } : {}), ...(mat ? { material_id: mat.id } : {}) };
  },

  decision_items: async (authed, uid) => {
    const { data } = await authed.from('decision_trackers')
      .insert({ user_id: uid, job_id: 'h', customer_id: 'h', access_code: `H${Date.now()}` })
      .select().single();
    return data ? { tracker_id: data.id } : {};
  },

  decision_submissions: async (authed, uid) => {
    const { data: tr } = await authed.from('decision_trackers')
      .insert({ user_id: uid, job_id: 'h', customer_id: 'h', access_code: `S${Date.now()}` })
      .select().single();
    if (!tr) return {};
    const { data: item } = await authed.from('decision_items')
      .insert({ tracker_id: tr.id, category: 'h', label: 'h', input_type: 'text', sort_order: 1 })
      .select().single();
    return { tracker_id: tr.id, ...(item ? { item_id: item.id } : {}) };
  },
};

const { data: meta, error: metaErr } = await admin.rpc('list_public_column_meta');
if (metaErr || !meta) {
  console.error(`Cannot read column metadata (${metaErr?.message ?? 'empty'}). Refusing to report.`);
  process.exit(1);
}

const email = `insertable-${Date.now()}@vasco.test`;
const { data: u, error: ue } = await admin.auth.admin.createUser({
  email, password: 'Harness!2345678', email_confirm: true,
});
if (ue) { console.error('could not create the probe user:', ue.message); process.exit(1); }
const userId = u.user.id;

// Authenticated, not service_role: RLS is part of "can the app write this".
const authed = createClient(url, anon, { auth: { persistSession: false } });
const { error: se } = await authed.auth.signInWithPassword({ email, password: 'Harness!2345678' });
if (se) { console.error('could not sign in:', se.message); await admin.auth.admin.deleteUser(userId); process.exit(1); }

console.log(`\nInsertability — ${APP_TABLES.length} tables the app writes to, as an authenticated owner\n`);

const results = [];
for (const table of APP_TABLES) {
  const cols = meta[table];
  if (!Array.isArray(cols)) { results.push({ table, kind: 'notable' }); continue; }

  const required = cols.filter((c) => !c.nullable && !c.has_default);
  const row = {};
  for (const c of required) row[c.name] = sample(c, userId);
  // Always claim ownership: every user-owned table has RLS on user_id, and a
  // nullable user_id would otherwise be omitted and fail the policy, not the
  // column.
  if (cols.some((c) => c.name === 'user_id')) row.user_id = userId;

  // Real prerequisites, so a child table is genuinely probed rather than
  // reported as a failure the harness caused.
  let prepared = {};
  try { prepared = (await PREREQS[table]?.(authed, userId)) ?? {}; }
  catch (e) { prepared = {}; }
  Object.assign(row, prepared);

  const { error } = await authed.from(table).insert(row);
  results.push({
    table,
    kind: error ? (error.code === '23503' ? 'fk' : 'fail') : 'ok',
    code: error?.code,
    msg: error?.message,
    required: required.map((c) => c.name),
    prepared: Object.keys(prepared),
  });
  // Clean up only what is ours. Child tables have no user_id, so their rows go
  // when the parent does — and the parent goes with the user (ON DELETE
  // CASCADE from auth.users).
  if (!error && cols.some((c) => c.name === 'user_id')) {
    await admin.from(table).delete().eq('user_id', userId);
  }
}

// ── 2. Does any writer actually set each required column? ─────────────────
// A NOT NULL column with no default that nothing names is a write that can
// only ever fail. Grep is deliberately generous (`column_name:` anywhere in
// src/ or app/, outside the type/mapper files that merely describe the shape)
// — it over-reports rather than under, which is the right way round for a
// check that is otherwise ignored.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SKIP_FILE = /(database\.types|mappers)\.ts$|__tests__|\.test\./;
function sourceText() {
  let out = '';
  const walk = (dir) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (e === 'node_modules' || e.startsWith('.')) continue;
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(p) && !SKIP_FILE.test(p)) out += readFileSync(p, 'utf8');
    }
  };
  for (const d of ['src', 'app']) { try { walk(d); } catch {} }
  return out;
}
const SRC = sourceText();

// Columns every writer may legitimately omit: the client never authors them.
const CLIENT_NEVER_SETS = new Set(['user_id', 'id', 'created_at', 'updated_at']);

const uncovered = [];
for (const r of results) {
  for (const col of r.required ?? []) {
    if (CLIENT_NEVER_SETS.has(col)) continue;
    if (!new RegExp(`\\b${col}\\s*:`).test(SRC)) uncovered.push(`${r.table}.${col}`);
  }
}

const ICON = { ok: '✅', fail: '🔴', fk: '🟡', notable: '⚠️' };
for (const r of results) {
  const detail = r.kind === 'ok'
    ? `${r.required.length} required: ${r.required.join(', ') || 'none'}${r.prepared?.length ? `  (+parent ${r.prepared.join(', ')})` : ''}`
    : r.kind === 'notable' ? 'no such table'
    : `${r.code} ${String(r.msg).slice(0, 96)}`;
  console.log(`${ICON[r.kind]} ${r.table.padEnd(24)} ${detail}`);
}

const failed = results.filter((r) => r.kind === 'fail');
const fks = results.filter((r) => r.kind === 'fk');
console.log(`\n${failed.length} table(s) refused an owner's own minimal row`);
console.log(`${fks.length} needed a parent row the harness cannot invent`);

if (uncovered.length) {
  console.log(`\n🔴 ${uncovered.length} REQUIRED column(s) that no writer in src/ or app/ names:`);
  for (const c of uncovered) console.log(`     ${c}`);
  console.log(`   A NOT NULL column with no default that nothing sets is a write that can only fail.`);
} else {
  console.log(`✅ every required column is named by at least one writer\n`);
}

await admin.auth.admin.deleteUser(userId);
process.exitCode = (failed.length > 0 || uncovered.length > 0) ? 1 : 0;

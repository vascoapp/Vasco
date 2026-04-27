#!/usr/bin/env node
// =============================================================================
// MIGRATION SMOKE (R266)
// =============================================================================
// Static-only smoke check for unpushed Supabase migrations. Catches the bugs
// that bite hardest in production:
//
//  1. Unclosed dollar-quoted bodies ($$ ... $$) — most common syntax error
//  2. Unbalanced parens at function/CTE boundaries
//  3. Missing GRANT EXECUTE on RPCs (callers will get permission-denied)
//  4. RPC return-column drift vs consumer destructuring (e.g. RPC returns
//     `paid_rate` but TS reads `r.paidRate` — silently null)
//
// Doesn't run any SQL. Pure parse-and-grep. Fast enough to run in CI.
//
// Usage: node scripts/migration-smoke.mjs [migration-glob]
//   default: 20260427000001_time_of_day_capture.sql + 20260427000002_invoice_payment_timing.sql
// =============================================================================

import { readFile, readdir } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const TARGETS = process.argv.length > 2
  ? process.argv.slice(2)
  : [
      '20260427000001_time_of_day_capture.sql',
      '20260427000002_invoice_payment_timing.sql',
    ];

const errors = [];
const warns = [];

function err(file, msg) { errors.push(`${file}: ${msg}`); }
function warn(file, msg) { warns.push(`${file}: ${msg}`); }

// ---------------------------------------------------------------------------
// Check 1 — dollar-quoted body balance
// ---------------------------------------------------------------------------
function checkDollarQuotes(file, sql) {
  // Default body marker is $$ — count occurrences. Should be even.
  const matches = sql.match(/\$\$/g) ?? [];
  if (matches.length % 2 !== 0) {
    err(file, `unbalanced $$ delimiters (${matches.length} found, must be even)`);
  }
}

// ---------------------------------------------------------------------------
// Check 2 — paren balance
// ---------------------------------------------------------------------------
function checkParens(file, sql) {
  // Strip strings + line comments + block comments first.
  const stripped = sql
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/\$\$[\s\S]*?\$\$/g, '$$$$'); // collapse function bodies
  let depth = 0;
  for (const ch of stripped) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (depth < 0) { err(file, `paren went negative — extra ')' somewhere`); return; }
  }
  if (depth !== 0) err(file, `unbalanced parens: net depth ${depth}`);
}

// ---------------------------------------------------------------------------
// Check 3 — every CREATE FUNCTION has a GRANT EXECUTE
// ---------------------------------------------------------------------------
function checkGrants(file, sql) {
  // Match function definitions and capture both name and return-type clause so
  // we can skip TRIGGER functions (returns trigger) — those run via triggers,
  // never need GRANT EXECUTE.
  const fnMatches = [...sql.matchAll(
    /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?(\w+)\s*\([^)]*\)\s*returns\s+(\w+)/gi,
  )];
  const grants = [...sql.matchAll(/grant\s+execute\s+on\s+function\s+(?:public\.)?(\w+)/gi)]
    .map((m) => m[1]);
  for (const [, fn, returnType] of fnMatches) {
    if (returnType.toLowerCase() === 'trigger') continue;
    if (!grants.includes(fn)) {
      warn(file, `function ${fn}() has no GRANT EXECUTE — callers will get permission-denied`);
    }
  }
}

// ---------------------------------------------------------------------------
// Check 4 — RPC return-column drift vs consumer destructuring
// ---------------------------------------------------------------------------
async function findConsumerCallSites() {
  const candidates = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) candidates.push(path);
    }
  }
  // Scan src/ (mobile app), admin/src/ (web admin), and supabase/functions/
  // (Deno edge functions). RPCs may be consumed from any of these surfaces.
  await walk(join(ROOT, 'src'));
  try { await walk(join(ROOT, 'admin/src')); } catch { /* admin optional */ }
  try { await walk(join(ROOT, 'supabase/functions')); } catch { /* edge optional */ }
  return candidates;
}

function extractReturnColumns(sql) {
  // Match `returns table ( col1 type, col2 type, ... )` — but only for
  // top-level function declarations, not triggers. Greedy match between
  // function name and its `returns table` clause.
  const fnMatches = [...sql.matchAll(
    /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?(\w+)\s*\([^)]*\)\s*returns\s+table\s*\(([^)]+)\)/gi,
  )];
  const out = {};
  for (const [, name, body] of fnMatches) {
    const cols = body
      .split(',')
      .map((s) => s.trim().split(/\s+/)[0])
      .filter(Boolean);
    out[name] = cols;
  }
  return out;
}

async function checkConsumerColumns(file, sql) {
  const fnReturns = extractReturnColumns(sql);
  if (Object.keys(fnReturns).length === 0) return;

  const sources = await findConsumerCallSites();
  for (const [fn, cols] of Object.entries(fnReturns)) {
    let found = false;
    for (const path of sources) {
      const text = await readFile(path, 'utf8');
      if (!text.includes(`'${fn}'`) && !text.includes(`"${fn}"`)) continue;
      found = true;
      // Look for `r.col_x` or `row.col_x` or destructuring `{ col_x }`
      const referenced = new Set();
      const dotMatches = [...text.matchAll(/\b(?:r|row|data|d)\.([a-z_][a-z0-9_]*)/gi)];
      for (const m of dotMatches) referenced.add(m[1]);
      // Heuristic: only flag if it looks like the consumer actually destructured
      // the row at all — skip when nothing matches our `r.x` pattern.
      if (referenced.size === 0) continue;
      // Now look for column drift: caller references something not in cols.
      // This is fuzzy — many `r.x` accesses are unrelated to this RPC. Only
      // flag if a column the migration NAMED isn't read at all by anyone.
      const noneFound = cols.every((c) => !text.includes(c));
      if (noneFound) {
        warn(file, `consumer ${path.replace(ROOT, '.')} calls ${fn} but doesn't reference any of [${cols.join(', ')}]`);
      }
    }
    if (!found) {
      warn(file, `RPC ${fn} has no consumer in src/ — dormant feature`);
    }
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
const migDir = join(ROOT, 'supabase/migrations');
for (const target of TARGETS) {
  const full = join(migDir, target);
  let sql;
  try { sql = await readFile(full, 'utf8'); }
  catch { err(target, `not found at ${full}`); continue; }
  checkDollarQuotes(target, sql);
  checkParens(target, sql);
  checkGrants(target, sql);
  await checkConsumerColumns(target, sql);
}

console.log(`\nMIGRATION SMOKE — ${TARGETS.length} file(s)`);
console.log(`────────────────────────────────────`);
if (errors.length === 0 && warns.length === 0) {
  console.log('✓ all checks passed');
  process.exit(0);
}
if (errors.length > 0) {
  console.log(`\n❌ ${errors.length} error(s):`);
  for (const e of errors) console.log(`  ${e}`);
}
if (warns.length > 0) {
  console.log(`\n⚠ ${warns.length} warning(s):`);
  for (const w of warns) console.log(`  ${w}`);
}
process.exit(errors.length > 0 ? 1 : 0);

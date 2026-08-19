#!/usr/bin/env node
// =============================================================================
// FE ↔ BE schema drift — is database.types.ts still telling the truth?
// =============================================================================
// `src/lib/database.types.ts` is HAND-MAINTAINED (workflow rule 8, the 5-file
// rule) and it is the file the whole app believes about the shape of the
// database. Nothing has ever compared it to the database.
//
// A hand-maintained registry drifts in BOTH directions and both are silent
// (learnings #170):
//
//   · a field in the Row type that is NOT a column — every read of it is
//     `undefined` forever, and every write naming it makes PostgREST reject
//     the whole statement. This is exactly how verify-quote-token selected
//     `documents.metadata` and returned "not found" for every valid quote for
//     its entire life (#174).
//   · a column that is NOT in the Row type — invisible to the app. Data the
//     backend holds and the FE cannot see; the 5-file rule's "data vanishes on
//     reload" failure, from the read side.
//
// This only checks SHAPE. It cannot see whether a mapper actually carries a
// field through, or whether anything ever writes one — `audit-dead-fields.py`
// covers that direction.
//
// Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Run: npm run check:drift
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Row type → table. Explicit rather than derived from the name: several do not
// follow a rule (BusinessSettingsRow → business_settings, GobdAuditLogRow →
// gobd_audit_log, singular). An explicit map is a list someone chose; a clever
// derivation would silently skip whatever it failed to guess.
const TABLES = {
  BusinessSettingsRow: 'business_settings',
  CustomerRow: 'customers',
  JobRow: 'jobs',
  WorkerRow: 'workers',
  LeadRow: 'leads',
  DocumentRow: 'documents',
  LineItemRow: 'line_items',
  DocumentCounterRow: 'document_counters',
  MaterialCatalogRow: 'material_catalog',
  SupplierRow: 'suppliers',
  PriceObservationRow: 'price_observations',
  JobMaterialRow: 'job_materials',
  ExpenseRow: 'expenses',
  QuoteAcceptanceLinkRow: 'quote_acceptance_links',
  GobdAuditLogRow: 'gobd_audit_log',
  DecisionTrackerRow: 'decision_trackers',
  DecisionItemRow: 'decision_items',
  DecisionSubmissionRow: 'decision_submissions',
  ProjectRow: 'projects',
};

// Columns the DB owns and the FE has no business reading. Absence from a Row
// type is correct for these, so they are not reported as drift.
const BACKEND_ONLY = new Set([
  'search_vector', 'embedding', 'tsv', 'fts',
]);

// Columns deliberately left with no Row field, and why. Adding a field for a
// column nothing populates is how dead fields are born (rule 8), so a decision
// belongs here rather than in the type.
const ACCEPTED_UNSEEN = {
  // Nothing writes it — verified 2026-08-19, zero call sites in src/ or app/.
  // Projects link to jobs the other way, via `project.jobIds`. A `projectId` on
  // Job would be a field only a migration ever filled.
  jobs: new Set(['project_id']),
};

function parseRowTypes(src) {
  const out = {};
  const re = /^export type (\w+Row) = \{$/gm;
  let m;
  while ((m = re.exec(src)) !== null) {
    const name = m[1];
    const start = re.lastIndex;
    const end = src.indexOf('\n};', start);
    if (end === -1) continue;
    const body = src.slice(start, end);
    const fields = new Set();
    for (const line of body.split('\n')) {
      // `  foo?: string | null;` — ignore comments and nested object literals.
      const f = line.match(/^\s{2}(\w+)\??\s*:/);
      if (f) fields.add(f[1]);
    }
    out[name] = fields;
  }
  return out;
}

const src = fs.readFileSync(path.join(ROOT, 'src/lib/database.types.ts'), 'utf8');
const rowTypes = parseRowTypes(src);

const admin = createClient(url, key, { auth: { persistSession: false } });

// Column lists from the catalog, in one round-trip. Reading them off a
// returned ROW only works on a table that HAS a row, and every table here is
// currently empty — which left the "column with no Row field" direction
// structurally unprovable on the first version of this script. See migration
// 20260819000008.
const { data: catalog, error: catErr } = await admin.rpc('list_public_columns');
if (catErr || !catalog || typeof catalog !== 'object') {
  console.error(`\nCannot read the column catalog (${catErr?.message ?? 'empty result'}).`);
  console.error('Refusing to report: without it only half the drift is visible, and a');
  console.error('half-check that prints like a full one is worse than no check.\n');
  process.exit(1);
}

console.log(`\nFE \u2194 BE schema drift \u2014 ${Object.keys(TABLES).length} row types, ${Object.keys(catalog).length} tables in public\n`);

let phantomFields = 0;
let unseenColumns = 0;
const report = [];

for (const [typeName, table] of Object.entries(TABLES)) {
  const feFields = rowTypes[typeName];
  if (!feFields) {
    report.push({ table, kind: 'notype', detail: `${typeName} not found in database.types.ts` });
    continue;
  }
  const dbList = catalog[table];
  if (!Array.isArray(dbList)) {
    report.push({ table, kind: 'notable', detail: `no such table in public` });
    continue;
  }
  const dbCols = new Set(dbList);

  const phantom = [...feFields].filter((f) => !dbCols.has(f));
  const unseen = [...dbCols].filter((c) => !feFields.has(c) && !BACKEND_ONLY.has(c) && !(ACCEPTED_UNSEEN[table]?.has(c)));

  if (phantom.length) { phantomFields += phantom.length; report.push({ table, kind: 'phantom', detail: phantom.join(', ') }); }
  if (unseen.length) { unseenColumns += unseen.length; report.push({ table, kind: 'unseen', detail: unseen.join(', ') }); }
  if (!phantom.length && !unseen.length) report.push({ table, kind: 'ok', detail: `${dbCols.size} columns` });
}

const ICON = { ok: '✅', phantom: '🔴', unseen: '🟡', notable: '⚠️', notype: '⚠️' };
for (const r of report) {
  console.log(`${ICON[r.kind]} ${r.table.padEnd(24)} ${r.kind === 'ok' ? '' : r.kind.toUpperCase().padEnd(11)} ${r.detail}`);
}

console.log(`\n🔴 ${phantomFields} field(s) in database.types.ts that are NOT columns`);
console.log(`   — every read is undefined forever; any write naming one makes PostgREST reject the whole statement.`);
console.log(`🟡 ${unseenColumns} column(s) the app has no Row field for`);
console.log(`   — data the backend holds that the FE cannot see. Not always wrong; each needs a decision.\n`);

process.exitCode = phantomFields > 0 ? 1 : 0;

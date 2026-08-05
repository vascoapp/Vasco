#!/usr/bin/env node
// =============================================================================
// UNMOUNTED-COMPONENT AUDIT — what is built, and what a contractor can reach
// =============================================================================
// This codebase's dominant defect is not broken code. It is finished code that
// nothing reaches: 45 generators, an ontology, ML models and a cohort moat, all
// reasoning over data the app never collected or rendering into screens nobody
// can open. Learnings #107 ("mounted" beats "imported"), #106, #109, #110 and
// #111 are all the same animal seen from different sides.
//
// -----------------------------------------------------------------------------
// WHY A SIMPLE "IS IT IMPORTED?" GREP IS NOT ENOUGH
// -----------------------------------------------------------------------------
// On 2026-08-06 I nearly mounted `QuoteOptimizer`. It consumed the real cohort
// service, was imported by nothing, and — the part that matters — came back
// CLEAN from the usual `grep MOCK_` over the component file. It read as
// finished work that was merely unreachable.
//
// The fabrication was one layer down, in the service the component's hook
// called: MOCK_MARKET_DATA, correctly DEMO_MODE-gated and therefore EMPTY in
// production. Mounting it would have shipped an analysis screen with no data.
//
// 🔑 So this audit FOLLOWS THE DATA PATH. For every unreached component it also
// greps the services that component imports. The fabrication lives wherever it
// is furthest from the eye, which is never the file you are about to open.
//
// -----------------------------------------------------------------------------
// HOW TO READ THE OUTPUT
// -----------------------------------------------------------------------------
//   🔴 MOCK-BACKED   — the component is clean but its service is not. THE TRAP.
//                      Wiring this ships an empty screen (#106). Either give it
//                      a real source first, or leave it dormant and say so IN
//                      THE COMPONENT — a warning on only the service is a
//                      warning you walk past.
//   🟡 SELF-MOCKED   — fabrication visible in the component itself. Honest
//                      prototype; the work is "wire it or delete it", never
//                      "polish it".
//   🟢 CLEAN PATH    — no fabrication found either layer. A genuine orphan and
//                      the only category worth considering mounting. STILL
//                      check by hand that a canonical surface does not already
//                      do the job (TieredQuoteBuilder did, and I missed it).
//
// This reports; it does not fail a build. Several orphans are deliberate —
// LeadGeneration is dormant by an explicit user decision, RouteOptimizer sits
// behind a kill switch, JobDetailScreen is superseded. Deadness is a question
// for a human; this only makes it cheap to ask.
//
// Usage:  node scripts/audit-unmounted.mjs [--min-lines N] [--json]
// =============================================================================

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, basename, extname } from 'path';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const MIN_LINES = Number(args[args.indexOf('--min-lines') + 1]) || 0;
const AS_JSON = args.includes('--json');

const MOCK_RE = /MOCK_[A-Z_]+|mock[A-Z][a-zA-Z]*/g;

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '__tests__') continue;
      walk(p, out);
    } else if (['.ts', '.tsx'].includes(extname(entry))) {
      out.push(p);
    }
  }
  return out;
}

const componentFiles = walk(join(ROOT, 'src/components')).filter((f) => f.endsWith('.tsx'));
const searchFiles = [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'app'))];

// Cache file contents once — this runs over a few thousand files.
const contents = new Map();
const read = (f) => {
  if (!contents.has(f)) {
    try { contents.set(f, readFileSync(f, 'utf8')); } catch { contents.set(f, ''); }
  }
  return contents.get(f);
};

/** Count fabrication markers, ignoring lines that merely TALK about them. */
function mockHits(src) {
  return src
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      // Comments explaining the gating are not fabrication.
      return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'));
    })
    .join('\n')
    .match(MOCK_RE)?.length ?? 0;
}

/** Services a component imports, resolved to files under src/services. */
function importedServices(src) {
  const out = new Set();
  for (const m of src.matchAll(/from\s+'[^']*\/services\/([a-zA-Z0-9_]+)'/g)) {
    const p = join(ROOT, 'src/services', `${m[1]}.ts`);
    if (existsSync(p)) out.add(p);
  }
  return [...out];
}

const findings = [];

for (const file of componentFiles) {
  const name = basename(file, '.tsx');
  const src = read(file);
  const lines = src.split('\n').length;
  if (lines < MIN_LINES) continue;

  // Reached = the identifier appears in some other real file. Barrel index
  // files are excluded deliberately: re-exporting a component from index.ts
  // makes it look used while reaching no screen, which is exactly how these
  // stay invisible.
  const reachedBy = searchFiles.filter((f) => {
    if (f === file) return false;
    if (f.endsWith('/index.ts')) return false;
    return new RegExp(`\\b${name}\\b`).test(read(f));
  });
  if (reachedBy.length > 0) continue;

  const ownMock = mockHits(src);
  const services = importedServices(src);
  const serviceMock = services.reduce((n, s) => n + mockHits(read(s)), 0);

  findings.push({
    file: file.replace(`${ROOT}/`, ''),
    lines,
    ownMock,
    serviceMock,
    services: services.map((s) => basename(s, '.ts')),
    // The trap: clean component, fabricated source.
    verdict: ownMock === 0 && serviceMock > 0 ? 'MOCK-BACKED'
      : ownMock > 0 ? 'SELF-MOCKED'
      : 'CLEAN PATH',
  });
}

findings.sort((a, b) => {
  const rank = { 'MOCK-BACKED': 0, 'SELF-MOCKED': 1, 'CLEAN PATH': 2 };
  return rank[a.verdict] - rank[b.verdict] || b.lines - a.lines;
});

if (AS_JSON) {
  console.log(JSON.stringify(findings, null, 2));
  process.exit(0);
}

const icon = { 'MOCK-BACKED': '🔴', 'SELF-MOCKED': '🟡', 'CLEAN PATH': '🟢' };
const totalLines = findings.reduce((n, f) => n + f.lines, 0);

console.log('='.repeat(78));
console.log('COMPONENTS NO SCREEN REACHES');
console.log('='.repeat(78));
console.log(`${findings.length} components · ${totalLines.toLocaleString()} lines\n`);

for (const group of ['MOCK-BACKED', 'SELF-MOCKED', 'CLEAN PATH']) {
  const rows = findings.filter((f) => f.verdict === group);
  if (rows.length === 0) continue;
  console.log(`\n${icon[group]} ${group} — ${rows.length}`);
  if (group === 'MOCK-BACKED') {
    console.log('   Clean component, fabricated service. Wiring these ships an empty');
    console.log('   screen (#106). This is the class that nearly caught me (#111).');
  }
  for (const f of rows) {
    console.log(`   ${f.file}  (${f.lines} lines)`);
    if (f.serviceMock > 0) {
      console.log(`      └─ ${f.serviceMock} fabrication marker(s) in: ${f.services.join(', ')}`);
    }
  }
}

console.log('\nDeadness is a judgement call — several of these are dormant on purpose.');
console.log('This only makes the question cheap to ask. Verify a canonical surface');
console.log('does not already do the job before mounting anything.');

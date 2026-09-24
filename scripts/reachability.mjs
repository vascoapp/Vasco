#!/usr/bin/env node
// =============================================================================
// REACHABILITY — what can a signed-in contractor actually open?
// =============================================================================
// Convergence plan P1.1 (docs/CONVERGENCE_PLAN.md). audit:unmounted asks
// "which component is imported by nothing". This asks the question a sweep
// needs first: starting from the screens a contractor lands on, following
// every navigation literal (router.push/replace/navigate, href, pathname) to
// other screens, and every import from those screens — which files are
// REACHED, and which exist only for screens nobody can open?
//
// Screens under a group app/_layout.tsx redirects signed-in users away from
// ((tabs), worker, sitelead) are unreachable by construction, however many
// links point at them.
//
//   node scripts/reachability.mjs            summary + unreachable files
//   node scripts/reachability.mjs --json     machine-readable
//
// Approximate on purpose: a route built from a variable is not followed
// (its literal prefix is). It errs toward REACHABLE — a file it calls
// unreachable has no literal path to it from a contractor's screens.
// =============================================================================
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname, relative, resolve, extname } from 'path';

const ROOT = process.cwd();
const AS_JSON = process.argv.includes('--json');

/** Route groups _layout.tsx sends every signed-in user away from. */
const REDIRECTED = ['(tabs)', 'worker', 'sitelead'];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (['node_modules', '__tests__', '__screenwalk__', 'test-utils', '__mocks__'].includes(e)) continue;
      walk(p, out);
    } else if (/\.(ts|tsx|js|jsx)$/.test(e) && !/\.test\./.test(e) && !e.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const read = (() => { const c = new Map(); return (f) => { if (!c.has(f)) { try { c.set(f, readFileSync(f, 'utf8')); } catch { c.set(f, ''); } } return c.get(f); }; })();

// ── Routes ───────────────────────────────────────────────────────────────────
const APP = join(ROOT, 'app');
const routeFiles = walk(APP).filter((f) => !/\/_layout\./.test(f));
/** app/(contractor)/werk.tsx → { segs: ['werk'], groups: ['(contractor)'] } */
function routeOf(file) {
  const rel = relative(APP, file).replace(/\.(tsx|ts|jsx|js)$/, '');
  const parts = rel.split('/');
  const groups = parts.filter((p) => /^\(.*\)$/.test(p));
  const segs = parts.filter((p) => !/^\(.*\)$/.test(p) && p !== 'index');
  return { file, segs, groups, redirected: parts.some((p) => REDIRECTED.includes(p)) };
}
const ROUTES = routeFiles.map(routeOf);

function matchRoute(path) {
  // path: '/contractor/job/' (prefix from a template) or '/contractor/job/123'
  const isPrefix = path.endsWith('*');
  const clean = path.replace(/\*$/, '').split('?')[0].replace(/\/+$/, '');
  const want = clean.split('/').filter((s) => s && !/^\(.*\)$/.test(s));
  const explicitGroups = clean.split('/').filter((s) => /^\(.*\)$/.test(s));
  return ROUTES.filter((r) => {
    if (explicitGroups.length && !explicitGroups.every((g) => r.groups.includes(g))) return false;
    if (isPrefix) {
      if (r.segs.length < want.length) return false;
      return want.every((w, i) => r.segs[i] === w || /^\[.*\]$/.test(r.segs[i]));
    }
    if (r.segs.length !== want.length) return false;
    return want.every((w, i) => r.segs[i] === w || /^\[.*\]$/.test(r.segs[i]));
  });
}

/** Navigation literals in a source file. Template literals become prefixes. */
function navTargets(src) {
  const out = new Set();
  const re = /(?:push|replace|navigate|href|pathname|router\.\w+)\s*[:(=]\s*\{?\s*(?:pathname\s*:\s*)?(['"`])(\/[^'"`]*)\1?/g;
  let m;
  while ((m = re.exec(src))) {
    let p = m[2];
    if (m[1] === '`' && p.includes('${')) p = p.slice(0, p.indexOf('${')) + '*';
    out.add(p);
  }
  // Bare route strings in route tables ({ route: '/contractor/x' }) — common here.
  for (const r of src.matchAll(/(?:route|path|to|screen)\s*:\s*['"](\/[\w\-/()[\].]+)['"]/g)) out.add(r[1]);
  return out;
}

// ── Imports ──────────────────────────────────────────────────────────────────
const EXTS = ['.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts', '/index.js'];
function resolveImport(from, spec) {
  if (!spec.startsWith('.')) return null;
  const base = resolve(dirname(from), spec);
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const e of EXTS) if (existsSync(base + e)) return base + e;
  return null;
}
function importsOf(file) {
  const src = read(file);
  const out = [];
  for (const m of src.matchAll(/(?:import\s[^'"]*?from\s*|import\s*\(\s*|require\s*\(\s*|export\s[^'"]*?from\s*)['"]([^'"]+)['"]/g)) {
    const r = resolveImport(file, m[1]);
    if (r) out.push(r);
  }
  return out;
}

// ── BFS over screens + imports ───────────────────────────────────────────────
const layoutFiles = walk(APP).filter((f) => /\/_layout\./.test(f) && !REDIRECTED.some((g) => f.includes(`/${g}/`)));
const entryScreens = ROUTES.filter((r) => !r.redirected && (
  (r.groups.includes('(contractor)') && r.segs.length === 1) // the tabs
  || ['login', 'onboarding', 'register', 'forgot-password', 'reset-password'].includes(r.segs[0])
  // Opened from OUTSIDE the app — email links, referral links, the customer's
  // quote link, the OAuth callback — so no in-app navigation leads to them.
  || ['auth', 'accept', 'ref', 'quote'].includes(r.segs[0])
  || /\/\+not-found\./.test(r.file)
  || r.segs.length === 0 // app/index
)).map((r) => r.file);

const reachedFiles = new Set();
const reachedScreens = new Set();
const queue = [...layoutFiles, ...entryScreens];
for (const f of entryScreens) reachedScreens.add(f);
while (queue.length) {
  const f = queue.pop();
  if (reachedFiles.has(f)) continue;
  reachedFiles.add(f);
  for (const i of importsOf(f)) if (!reachedFiles.has(i)) queue.push(i);
  for (const t of navTargets(read(f))) {
    for (const r of matchRoute(t)) {
      if (r.redirected) continue;
      if (!reachedScreens.has(r.file)) { reachedScreens.add(r.file); queue.push(r.file); }
    }
  }
}

const all = [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'src'))];
const lines = (f) => read(f).split('\n').length;
const unreached = all.filter((f) => !reachedFiles.has(f));
const byArea = {};
for (const f of unreached) {
  const rel = relative(ROOT, f);
  const area = rel.startsWith('app/') ? 'screens' : rel.split('/').slice(0, 2).join('/');
  (byArea[area] ??= []).push({ file: rel, lines: lines(f) });
}
const totalLines = unreached.reduce((s, f) => s + lines(f), 0);
const allLines = all.reduce((s, f) => s + lines(f), 0);

if (AS_JSON) {
  console.log(JSON.stringify({ reached: reachedFiles.size, total: all.length, unreachedLines: totalLines, allLines, byArea }, null, 1));
} else {
  console.log(`Reachable from a signed-in contractor: ${reachedFiles.size} of ${all.length} files`);
  console.log(`Unreachable: ${unreached.length} files, ${totalLines} of ${allLines} lines (${Math.round(100 * totalLines / allLines)}%)\n`);
  for (const [area, files] of Object.entries(byArea).sort((a, b) => b[1].reduce((s, x) => s + x.lines, 0) - a[1].reduce((s, x) => s + x.lines, 0))) {
    const n = files.reduce((s, x) => s + x.lines, 0);
    console.log(`${area}  — ${files.length} files, ${n} lines`);
    for (const x of files.sort((a, b) => b.lines - a.lines).slice(0, 12)) console.log(`   ${x.file} (${x.lines})`);
    if (files.length > 12) console.log(`   … ${files.length - 12} more`);
  }
}

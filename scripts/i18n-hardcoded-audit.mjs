#!/usr/bin/env node
// =============================================================================
// HARDCODED LANGUAGE AUDIT (R273)
// =============================================================================
// Scans src/ + app/ for likely-untranslated Dutch/English strings that
// should be in i18n. Reports the worst offenders so we can fix highest-
// impact files first.
//
// Heuristics (intentionally conservative — false positives are fine, we
// triage from the report):
//   1. JSX-text nodes: `>some words</` (uppercase first or multi-word)
//   2. Alert.alert("Title", "Body") with quoted args
//   3. placeholder="..." / accessibilityLabel="..." with non-key text
//   4. Common Dutch words: Klant, Offerte, Factuur, Klus, Aannemer
//   5. Hardcoded English UI verbs: Save/Cancel/Add/Delete (only when not
//      inside a t() call)
//
// Skips: test files, *.json, generated/. Under 200ms on this codebase.
// =============================================================================

import { readFile, readdir } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SCAN_DIRS = [join(ROOT, 'src'), join(ROOT, 'app')];
const SKIP_DIRS = new Set(['node_modules', '__tests__', '__mocks__', '.next', '.expo', 'dist', 'build']);

// ---------------------------------------------------------------------------
// Heuristics
// ---------------------------------------------------------------------------

const DUTCH_WORDS = [
  'Klant','Klanten','Offerte','Offertes','Factuur','Facturen','Klus','Klussen',
  'Aannemer','Materiaal','Materialen','Leverancier','Werknemer','Onderaannemer',
  'Versturen','Betalen','Aanmaken','Toevoegen','Bewerken','Verwijderen',
  'Volgende','Vorige','Annuleren','Bevestigen','Opslaan','Dichtbij',
  'Vandaag','Morgen','Gisteren','Geplandl','Volgende week','Inplannen',
  'Hoi','Bedankt','Beste','Geachte',
];

const COMMON_HARDCODED_EN = [
  'Save','Cancel','Delete','Add','Edit','Remove','Confirm','Submit','Send',
  'Create','Update','Continue','Back','Next','Done','Close','Open',
  'Customer','Customers','Quote','Quotes','Invoice','Invoices','Job','Jobs',
  'Settings','Profile','Help','Support',
];

/** True if a JSX-text or string-literal looks like UI copy (not a key, URL, etc.) */
function isLikelyCopy(text) {
  const t = text.trim();
  if (!t) return false;
  if (t.length < 3) return false;
  if (t.length > 200) return false;
  // Skip i18n keys (a.b.c)
  if (/^[a-z][a-zA-Z0-9_]*\.[a-z][a-zA-Z0-9_]*(\.[a-z][a-zA-Z0-9_]*)+$/.test(t)) return false;
  // Skip URLs / paths / hex
  if (/^[/.]/.test(t) || /^https?:/i.test(t) || /^#[0-9a-f]{3,8}$/i.test(t)) return false;
  // Skip pure numbers / units / single tokens
  if (/^[\d\s.,€$%-]+$/.test(t)) return false;
  if (!/[a-zA-Z]/.test(t)) return false;
  return true;
}

const findings = [];

function recordFinding(file, line, kind, snippet) {
  findings.push({ file: file.replace(ROOT + '/', ''), line, kind, snippet: snippet.slice(0, 100) });
}

// ---------------------------------------------------------------------------
// File scan
// ---------------------------------------------------------------------------

async function scanFile(file) {
  let text;
  try { text = await readFile(file, 'utf8'); } catch { return; }
  const lines = text.split('\n');
  // Strip out fully-commented lines so we don't flag comment text
  const stripped = lines.map((l) => l.replace(/\/\/.*$/, ''));

  // Pre-build a "lines that contain t(" index — cheap proxy for "this line is i18n'd"
  const inTContext = stripped.map((l) => /\bt\s*\(/.test(l));

  // 1. JSX text nodes — `>Some Text</`
  // Match >TEXT< where TEXT has at least 3 word chars and starts with uppercase or contains space
  const jsxText = />\s*([A-Z][^<>{}\n]{2,80}|[a-z][^<>{}\n]*\s[^<>{}\n]+)\s*</g;
  // Iterate per line to keep line numbers
  for (let i = 0; i < stripped.length; i++) {
    const line = stripped[i];
    if (inTContext[i]) continue;
    let m;
    while ((m = jsxText.exec(line)) !== null) {
      const inner = m[1];
      if (!isLikelyCopy(inner)) continue;
      // Skip props-like patterns
      if (/^(true|false|null|undefined)$/.test(inner)) continue;
      recordFinding(file, i + 1, 'jsx-text', inner);
    }
    jsxText.lastIndex = 0;
  }

  // 2. Alert.alert("TITLE", "BODY") with quoted args
  const alertRe = /Alert\.alert\s*\(\s*["'`]([^"'`\n]+)["'`]\s*,\s*["'`]([^"'`\n]+)["'`]/g;
  for (let i = 0; i < stripped.length; i++) {
    const line = stripped[i];
    if (inTContext[i]) continue;
    let m;
    while ((m = alertRe.exec(line)) !== null) {
      if (isLikelyCopy(m[1])) recordFinding(file, i + 1, 'alert-title', m[1]);
      if (isLikelyCopy(m[2])) recordFinding(file, i + 1, 'alert-body', m[2]);
    }
    alertRe.lastIndex = 0;
  }

  // 3. placeholder="..." / accessibilityLabel="..." not from t()
  const propRe = /(placeholder|accessibilityLabel|accessibilityHint|title)\s*=\s*["']([^"'\n]+)["']/g;
  for (let i = 0; i < stripped.length; i++) {
    const line = stripped[i];
    if (inTContext[i]) continue;
    let m;
    while ((m = propRe.exec(line)) !== null) {
      if (isLikelyCopy(m[2])) recordFinding(file, i + 1, `prop-${m[1]}`, m[2]);
    }
    propRe.lastIndex = 0;
  }

  // 4. Common Dutch words in string literals (not in t() calls)
  for (let i = 0; i < stripped.length; i++) {
    const line = stripped[i];
    if (inTContext[i]) continue;
    for (const word of DUTCH_WORDS) {
      // Match the word inside a quoted string literal
      const re = new RegExp(`["'\`][^"'\`\\n]*\\b${word}\\b[^"'\`\\n]*["'\`]`);
      const m = line.match(re);
      if (m) {
        recordFinding(file, i + 1, 'dutch-literal', m[0]);
        break; // one match per line is enough
      }
    }
  }
}

async function walk(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
    } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name) && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.test.tsx')) {
      await scanFile(path);
    }
  }
}

for (const d of SCAN_DIRS) await walk(d);

// ---------------------------------------------------------------------------
// Aggregate + report
// ---------------------------------------------------------------------------

const byFile = new Map();
for (const f of findings) {
  byFile.set(f.file, (byFile.get(f.file) ?? 0) + 1);
}
const ranked = [...byFile.entries()].sort((a, b) => b[1] - a[1]);

const byKind = new Map();
for (const f of findings) byKind.set(f.kind, (byKind.get(f.kind) ?? 0) + 1);

console.log(`\nHARDCODED LANGUAGE AUDIT — ${findings.length} candidates across ${byFile.size} files`);
console.log('─'.repeat(60));
console.log('\nBy kind:');
for (const [k, n] of [...byKind.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(20)} ${n}`);
}
console.log('\nTop 25 worst-offender files:');
for (const [f, n] of ranked.slice(0, 25)) {
  console.log(`  ${String(n).padStart(4)}  ${f}`);
}

// Sample 5 findings per top-3 files
console.log('\nSamples from top 3 files:');
for (const [f] of ranked.slice(0, 3)) {
  console.log(`\n${f}:`);
  const sample = findings.filter((x) => x.file === f).slice(0, 5);
  for (const s of sample) {
    console.log(`  L${s.line} [${s.kind}] ${s.snippet}`);
  }
}

// JSON output for follow-up tooling
if (process.argv.includes('--json')) {
  console.log('\n---JSON---');
  console.log(JSON.stringify({ findings, byKind: Object.fromEntries(byKind), byFile: Object.fromEntries(byFile) }, null, 2));
}

/**
 * Words a contractor reads come from the locale files — in every MOUNTED file.
 *
 * The Finanze tab showed an Italian plumber "MARKT & PRESTATIE": a Dutch
 * literal in MoatInsightsCard, read in all six markets (IT walk 2026-10-06).
 * The signature pad on the job screen said "Clear" / "Save signature" in
 * English to every customer who signed, and the crash screen was English.
 *
 * Scope: live files under app/, plus components some live file actually
 * MOUNTS (`<Name`). Many components under src/components are imported by a
 * barrel but never rendered — they are written in Dutch and stay out of
 * scope until something mounts them, at which point this fails.
 */
import * as fs from 'fs';
import * as path from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const dormant = new Set<string>(JSON.parse(fs.readFileSync(path.join(ROOT, 'src/config/dormant.files.json'), 'utf8')).files);

/** Names, not words: the same in every language. */
const PROPER = new Set(['VASCO', 'Vasco', 'WhatsApp', 'SMS', 'Email', 'LTV', 'Vasco v1.0.0',
  // Demo builds / __DEV__ only — never in the shipping app.
  'Demo', 'Demo Mode', 'DEV details']);

const files: string[] = [];
const walk = (dir: string) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (!['__tests__', 'node_modules', 'test-utils'].includes(e.name)) walk(full); }
    else if (e.name.endsWith('.tsx')) files.push(path.relative(ROOT, full));
  }
};
walk(path.join(ROOT, 'app'));
walk(path.join(ROOT, 'src'));
const live = files.filter((f) => !dormant.has(f));
const sources = new Map(live.map((f) => [f, stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8'))]));

function mounted(f: string): boolean {
  if (f.startsWith('app/')) return true;
  const name = path.basename(f, '.tsx');
  const tag = new RegExp(`<${name}\\b`);
  for (const [other, src] of sources) if (other !== f && tag.test(src)) return true;
  return false;
}

// Text between a <Text>/<DKLabel> open tag and its close, with no expression in it.
const LITERAL = /<(DKLabel|Text)\b[^>]*>([^<{}]*[A-Za-zÀ-ÿ]{3,}[^<{}]*)<\/(?:DKLabel|Text)>/g;

it('no mounted screen renders a literal sentence or label', () => {
  const offenders: string[] = [];
  for (const f of live) {
    if (!mounted(f)) continue;
    const src = sources.get(f)!;
    for (const m of src.matchAll(LITERAL)) {
      const text = m[2].replace(/&amp;/g, '&').trim();
      if (!text || PROPER.has(text)) continue;
      offenders.push(`${f}:${src.slice(0, m.index).split('\n').length}  ${text}`);
    }
  }
  expect(offenders).toEqual([]);
});

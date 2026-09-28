/**
 * @jest-environment node
 */
// No Alert shows machine text to a builder. Every error that reaches an Alert
// goes through friendlyError() (src/utils/friendlyError.ts): our own reasons
// stay, "Edge Function returned a non-2xx status code" does not (emulator walk
// 2026-09-28, Profiel → upgrade). Reachable screens + components only.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';
import manifest from '../config/dormant.files.json';

const ROOT = path.resolve(__dirname, '../..');
const dormant = new Set((manifest as any).files as string[]);
// Allowed on purpose, with the reason.
const ALLOWED: Record<string, string> = {
  'app/login.tsx': 'hidden support diagnostic (logo tapped repeatedly) — technical by design',
};
// Also `(e as Error).message` — the cast put ")" before ".message" and the
// first version of this guard walked straight past it (vat-and-audit).
const RAW = /(\b(err|error|e|result|res)\??\.(message|error)\b)|(\bas Error\)\??\.message\b)|String\(\s*\(?\s*(err|e|error)\b/;

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

/** The full argument text of each Alert.alert( … ) call, parentheses balanced. */
function alertCalls(src: string): string[] {
  const out: string[] = [];
  let i = src.indexOf('Alert.alert(');
  while (i >= 0) {
    let depth = 0; let j = i + 'Alert.alert'.length;
    for (; j < src.length; j++) {
      if (src[j] === '(') depth++;
      else if (src[j] === ')') { depth--; if (depth === 0) break; }
    }
    out.push(src.slice(i, j + 1));
    i = src.indexOf('Alert.alert(', j);
  }
  return out;
}

it('no reachable Alert passes raw error text', () => {
  const files = ['app', 'src/components'].flatMap((d) => walk(path.join(ROOT, d)))
    .map((f) => path.relative(ROOT, f))
    .filter((f) => !dormant.has(f) && !ALLOWED[f]);
  expect(files.length).toBeGreaterThan(100);
  const bad: string[] = [];
  for (const f of files) {
    for (const call of alertCalls(stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8')))) {
      // Remove every friendlyError( … ) argument, then look for raw text.
      const stripped = call.replace(/friendlyError\([^()]*(\([^()]*\)[^()]*)*\)/g, 'FE');
      if (RAW.test(stripped)) bad.push(`${f}: ${call.replace(/\s+/g, ' ').slice(0, 110)}`);
    }
  }
  expect(bad).toEqual([]);
});

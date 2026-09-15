/**
 * @jest-environment node
 */
// A hook called after an early `return` runs on some renders and not others.
// React throws "Rendered more hooks than during the previous render" the moment
// the condition flips — and here the conditions flip on HYDRATE:
//
//   - app/invoices/[id].tsx had `useRef` + `useEffect` below
//     `if (!invoice) return`. Any mount before the invoice was in state — the AI
//     queue's `?submit=einvoice` executor, a link on a cold start, a real
//     account whose invoices load after mount — crashed the screen. Since R20
//     (2026-05). Found by a flow test that seeded the invoice through storage.
//   - app/contractor/purchase-orders.tsx called `useProcurementAgent` below a
//     team gate on `businessProfile.teamSize`, which arrives with hydrate.
//
// The repo has no ESLint, so `react-hooks/rules-of-hooks` has never run. This
// is the narrow version of it: in a top-level component (2-space body), no hook
// call at body level after a body-level `if (…) return`. It does not see hooks
// inside nested blocks or loops — those are the other half of the rule.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const DIRS = ['app/contractor', 'app/(contractor)', 'app/(modals)', 'app/invoices', 'app/quotes', 'src/components/contractor', 'src/components/shared'];

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(p);
    return e.name.endsWith('.tsx') ? [p] : [];
  });
}

const COMPONENT_START = /^(export default )?function [A-Z]\w*\(|^(export )?const [A-Z]\w* = \(|^export function [A-Z]\w*\(/;
const BODY_HOOK = /^ {2}(?:(?:const|let) +(?:\[[^\]]*\]|\{[^}]*\}|\w+)(?:: [^=]+)? *= *)?use[A-Z]\w*\(/;

export function hooksAfterEarlyReturn(src: string): { line: number; returnLine: number; text: string }[] {
  const lines = stripComments(src).split('\n');
  const hits: { line: number; returnLine: number; text: string }[] = [];
  let inComponent = false;
  let returnLine: number | null = null;
  lines.forEach((l, i) => {
    if (COMPONENT_START.test(l)) { inComponent = true; returnLine = null; return; }
    if (/^\}/.test(l)) { inComponent = false; return; }
    if (!inComponent) return;
    if (returnLine === null && (/^ {2}if \(.*\) return\b/.test(l) || (/^ {2}if \(.*\) \{\s*$/.test(l) && /^ {4}return\b/.test(lines[i + 1] ?? '')))) {
      returnLine = i + 1;
    }
    if (returnLine !== null && BODY_HOOK.test(l)) hits.push({ line: i + 1, returnLine, text: l.trim() });
  });
  return hits;
}

describe('no hook below an early return', () => {
  const files = DIRS.flatMap((d) => walk(path.join(ROOT, d)));

  it('scans the screens it claims to', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('sees the shape it exists for', () => {
    const shape = [
      'export default function S() {',
      '  const x = useThing();',
      '  if (!x) {',
      '    return null;',
      '  }',
      '  const submitFiredRef = useRef(false);',
      '  useEffect(() => {}, []);',
      '  return null;',
      '}',
    ].join('\n');
    expect(hooksAfterEarlyReturn(shape).map((h) => h.line)).toEqual([6, 7]);
  });

  it('finds none in contractor surfaces', () => {
    const hits = files.flatMap((f) =>
      hooksAfterEarlyReturn(fs.readFileSync(f, 'utf8')).map(
        (h) => `${path.relative(ROOT, f)}:${h.line} (return at ${h.returnLine}): ${h.text}`,
      ),
    );
    expect(hits).toEqual([]);
  });
});

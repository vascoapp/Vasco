// A full-screen (pageSheet) Modal must start with ModalSafeArea. Android
// ignores `pageSheet` and draws the modal over the whole window; under forced
// edge-to-edge its header (Cancel / title / Save) sat under the status bar —
// "Mijlpaal toevoegen" on the aannemer's project (emulator, 2026-09-29).
// Per MODAL BLOCK, not per file: a screen's own SafeAreaView says nothing
// about the modal inside it (defect-class-sweeps).
import fs from 'fs';
import path from 'path';
import manifest from '../config/dormant.files.json';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const dormant = new Set((manifest as any).files as string[]);
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(p);
  return /\.tsx$/.test(e.name) ? [p] : [];
});

/** Index of the '>' that closes the opening tag at `i` (skips `=>` inside {}). */
function tagEnd(s: string, i: number): number {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return j;
  }
  return -1;
}

const sheets = ['app', 'src/components'].flatMap((d) => walk(path.join(ROOT, d)))
  .map((f) => path.relative(ROOT, f))
  .filter((f) => !dormant.has(f) && !f.startsWith('app/hub/'))
  .flatMap((f) => {
    const s = stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    const out: { at: string; first: string }[] = [];
    let i = 0;
    while ((i = s.indexOf('<Modal', i)) !== -1) {
      const end = tagEnd(s, i);
      const open = s.slice(i, end);
      if (/presentationStyle="pageSheet"/.test(open)) {
        // First JSX element inside, skipping `{cond && (` wrappers.
        const first = s.slice(end + 1).match(/<\s*([A-Za-z.]+)/)?.[1] ?? '';
        out.push({ at: `${f}:${s.slice(0, i).split('\n').length}`, first });
      }
      i = end;
    }
    return out;
  });

it('finds the full-screen sheets', () => { expect(sheets.length).toBeGreaterThanOrEqual(8); });

it('every live pageSheet Modal starts with ModalSafeArea (or a SafeAreaView)', () => {
  expect(sheets.filter((m) => !/^(ModalSafeArea|SafeAreaView)$/.test(m.first)).map((m) => `${m.at} → ${m.first}`)).toEqual([]);
});

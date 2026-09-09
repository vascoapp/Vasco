/**
 * No Alert anywhere may offer more than THREE buttons.
 *
 * RN's Android Alert maps onto AlertDialog, which has exactly three button
 * slots — positive, negative, neutral. Buttons past the third are **silently
 * dropped**: no error, no truncation indicator, nothing. On iOS all of them
 * render, so the defect is invisible to anyone developing on a simulator.
 *
 * `__screenwalk__/scheduleMenuNotAlert.test.tsx` guards this for ONE screen.
 * That is why the same shape was still shipping in `timesheet.tsx` and
 * `permits.tsx` months later, and why `VascoCard` — the component the whole
 * product leads with — carried a four-to-five button snooze sheet in which
 * **Cancel itself** sat past the cap on Android. This file is the repo-wide
 * version.
 *
 * A violation is:
 *   - more than three literal `{ text: … }` entries, or
 *   - a spread of anything whose length is not statically obvious
 *     (`[...workers, cancel]`) — unbounded by construction.
 *
 * NOT a violation (each of these produced a false positive when the same sweep
 * was run by hand — twelve candidates collapsed to one real defect):
 *   - an Alert described in a doc comment about the OLD code
 *   - an array spread into the MESSAGE argument and `.join()`ed
 *   - object spreads (`{ ...p, closedAt }`) inside an `onPress` body
 *   - a nested `Alert.alert` inside an `onPress`, which is counted separately
 *   - `...(cond ? [oneItem] : [])`, bounded by its literal branch
 */
import fs from 'fs';
import path from 'path';

const ROOTS = ['app', 'src'];
const REPO = path.join(__dirname, '..', '..');

/** Android's AlertDialog has three button slots. Not a style preference. */
const ANDROID_BUTTON_CAP = 3;

/**
 * Sites allowed to exceed the cap, each with its reason. Empty, and it should
 * stay that way: the fix for a menu is DKMenu, never an entry here.
 */
const ALLOWED: Array<{ file: string; line: number; why: string }> = [];

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('__')) continue;
        walk(p);
      } else if (/\.tsx?$/.test(entry.name)) {
        out.push(p);
      }
    }
  };
  for (const r of ROOTS) walk(path.join(REPO, r));
  return out;
}

/**
 * Prose describing a bug is not the bug — but a naive stripper is worse than
 * none.
 *
 * `src.replace(/\/\*[\s\S]*?\*\//g, '')` looks obviously correct and is not:
 * `permits.tsx` passes a MIME wildcard (`'application/*'`) to the document
 * picker, and that `/*` inside a STRING opens a phantom block comment which
 * runs to the next real `*​/` — deleting 3,284 characters of live code,
 * including all four of that file's `Alert.alert` calls. The detector then
 * scanned a mangled file, found nothing, and reported green. A guard that
 * silently stops seeing its own subject is worse than no guard.
 *
 * So: walk the source, and only treat `//` and `/*` as comment starts when
 * genuinely outside a string or template literal.
 */
function stripComments(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    // Strings and template literals are copied through untouched.
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      out += c;
      i++;
      while (i < src.length) {
        out += src[i];
        if (src[i] === '\\') {
          i += 2;
          continue;
        }
        if (src[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    if (c === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? src.length : end + 2;
      continue;
    }
    if (c === '/' && next === '/') {
      const end = src.indexOf('\n', i);
      i = end === -1 ? src.length : end;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** Split a call's argument list on top-level commas. */
function topLevelArgs(call: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let start = 0;
  let str: string | null = null;
  for (let i = 0; i < call.length; i++) {
    const c = call[i];
    if (str) {
      if (c === '\\') i++;
      else if (c === str) str = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') str = c;
    else if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (c === ',' && depth === 0) {
      args.push(call.slice(start, i));
      start = i + 1;
    }
  }
  args.push(call.slice(start));
  return args;
}

/** Count `{ text: …}` objects that are DIRECT children of an array literal. */
function countButtons(arr: string, childDepth: number): number {
  let d = 0;
  let n = 0;
  for (let k = 0; k < arr.length; k++) {
    const c = arr[k];
    if ('([{'.includes(c)) {
      d++;
      if (c === '{' && d === childDepth && /^\{\s*text\s*:/.test(arr.slice(k, k + 40))) n++;
    } else if (')]}'.includes(c)) d--;
  }
  return n;
}

interface Violation {
  file: string;
  line: number;
  literal: number;
  bounded: number;
  unbounded: string[];
}

function scan(file: string): Violation[] {
  const code = stripComments(fs.readFileSync(file, 'utf8'));
  const found: Violation[] = [];
  const re = /Alert\.alert\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    // Balance parentheses to get the whole call.
    let depth = 0;
    let i = m.index + m[0].length - 1;
    for (; i < code.length; i++) {
      if (code[i] === '(') depth++;
      else if (code[i] === ')') {
        depth--;
        if (depth === 0) break;
      }
    }
    const call = code.slice(m.index + m[0].length, i);

    // Buttons are whichever top-level ARGUMENT is an array literal — not the
    // first `[` in the call, which may belong to the message expression.
    const arr = topLevelArgs(call)
      .map((a) => a.trim())
      .find((a) => a.startsWith('['));
    if (!arr) continue;

    const literal = countButtons(arr, 2);

    // Only spreads that are DIRECT children of the button array count. A
    // `setUnassigned(prev => [...prev, …])` inside an onPress body sits several
    // levels deeper and is not a button — that shape produced three false
    // positives before this walked the depth instead of regex-ing the text.
    let bounded = 0;
    const unbounded: string[] = [];
    let d = 0;
    for (let k = 0; k < arr.length; k++) {
      const c = arr[k];
      if ('([{'.includes(c)) {
        d++;
        continue;
      }
      if (')]}'.includes(c)) {
        d--;
        continue;
      }
      if (d !== 1 || c !== '.' || arr.slice(k, k + 3) !== '...') continue;
      const tail = arr.slice(k);
      const ternary = tail.match(
        /^\.\.\.\(\s*[^?]{0,160}\?\s*\[([\s\S]{0,800}?)\]\s*:\s*\[\s*\]\s*\)/,
      );
      if (ternary) {
        bounded += countButtons(ternary[1], 1);
        continue;
      }
      const bare = tail.match(/^\.\.\.\s*([A-Za-z_$][\w$]*)/);
      if (bare) unbounded.push(`...${bare[1]}`);
    }

    if (literal + bounded > ANDROID_BUTTON_CAP || unbounded.length > 0) {
      found.push({
        file: path.relative(REPO, file),
        line: code.slice(0, m.index).split('\n').length,
        literal,
        bounded,
        unbounded,
      });
    }
  }
  return found;
}

describe('every Alert stays inside the Android three-button cap', () => {
  it('has no Alert offering a fourth button', () => {
    const violations = sourceFiles()
      .flatMap(scan)
      .filter((v) => !ALLOWED.some((a) => a.file === v.file && a.line === v.line));

    const report = violations.map(
      (v) =>
        `  ${v.file}:${v.line} — ${v.literal} literal` +
        `${v.bounded ? ` + ${v.bounded} conditional` : ''}` +
        `${v.unbounded.length ? ` + unbounded spread ${v.unbounded.join(', ')}` : ''}\n` +
        `      Android renders the first ${ANDROID_BUTTON_CAP}; the rest vanish silently.\n` +
        `      Picking one of N is a DKMenu (src/components/shared/DKMenu.tsx), not an Alert.`,
    );
    expect(report.join('\n')).toBe('');
  });

  it('scans a believable amount of source', () => {
    // Guards the guard: a walker that found nothing would pass the test above.
    expect(sourceFiles().length).toBeGreaterThan(400);
  });
});

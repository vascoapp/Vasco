/**
 * REPO-WIDE: picking one of N is never an `Alert.alert`.
 *
 * Android's Alert renders at most THREE buttons and silently drops the rest —
 * no error, no truncation indicator, nothing on screen that says options are
 * missing. `scheduleMenuNotAlert.test.tsx` pins this for ONE screen, which is
 * precisely why it kept recurring: learnings #219 found the same shape live in
 * `timesheet.tsx` after the schedule board was fixed, and #221 records that the
 * rule has no detector and therefore "holds only where someone happened to read
 * it". This is that detector.
 *
 * What it found on the day it was written, none of which any harness had seen:
 *
 *   • profile.tsx — the LANGUAGE picker. Six languages, no cancel button. On
 *     Android it offered Nederlands / English / Deutsch and withheld Français,
 *     Español and Italiano: three of the six markets this product ships to
 *     could not select their own language, on the settings screen.
 *   • vat-prep.tsx — six export options, of which "Open ELSTER" (the button
 *     that actually files the German return) was the fifth.
 *   • projects/[id].tsx — four project statuses; "Completed" was the fourth, so
 *     an aannemer could not close a project from its own screen.
 *   • job/[id].tsx — the crew picker, the ETA picker, and a completion dialog
 *     whose fourth button was "Complete".
 *   • purchase-orders.tsx and pipeline.tsx — unbounded, mapped from a list.
 *
 * ── Why the parsing is fussy ────────────────────────────────────────────────
 * Two shapes matter and a naive regex catches neither reliably:
 *
 *   1. Nested Alerts. An `onPress` may open a second Alert with its own
 *      buttons. Counting `{ text:` across the whole call reports a 2-button
 *      confirmation as a 5-button menu — a FALSE finding, which is worse than
 *      no detector, because it trains people to ignore the guard.
 *   2. A button array that is not a literal. `Alert.alert(title, undefined,
 *      LANG_OPTIONS.map(...))` has no `[` to find. The language picker above
 *      survived every previous sweep for exactly this reason.
 *
 * So: split the call into top-level arguments, take the third, and count only
 * braces at the array's own depth.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const ROOTS = ['app', 'src'];
const SKIP = ['node_modules', '__tests__', '__screenwalk__'];

/**
 * Android's cap. Three is not a style preference — it is what the platform
 * renders. A fourth button is a control the user cannot reach.
 */
const ANDROID_BUTTON_CAP = 3;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (SKIP.some((s) => p.includes(s))) continue;
    if (entry.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(p);
  }
  return out;
}

// Was the naive `replace(/\/\*[\s\S]*?\*\//g, '')`. A MIME wildcard in a
// STRING (`'image/*'` in permits.tsx) opened a phantom block comment that ate
// 3,284 characters of real code — and with them all four of that file's
// Alert.alert calls. Across the repo the naive version hid 11 alerts (7 more in
// ReceiptScanner.tsx) from THIS detector, which reported green throughout.
import { stripComments } from '../src/utils/stripComments';

/** `i` points at an opening bracket; returns the index of its match. */
function matchBracket(code: string, i: number): number {
  let depth = 0;
  for (let j = i; j < code.length; j += 1) {
    const c = code[j];
    if (c === '(' || c === '[' || c === '{') depth += 1;
    else if (c === ')' || c === ']' || c === '}') {
      depth -= 1;
      if (depth === 0) return j;
    }
  }
  return code.length - 1;
}

/** Top-level arguments of a `fn(...)` call, given the whole call text. */
function callArgs(call: string): string[] {
  const open = call.indexOf('(');
  const end = matchBracket(call, open);
  const out: string[] = [];
  let depth = 0;
  let start = open + 1;
  for (let j = open; j < end; j += 1) {
    const c = call[j];
    if (c === '(' || c === '[' || c === '{') depth += 1;
    else if (c === ')' || c === ']' || c === '}') depth -= 1;
    else if (c === ',' && depth === 1) {
      out.push(call.slice(start, j));
      start = j + 1;
    }
  }
  out.push(call.slice(start, end));
  return out;
}

type Finding = { file: string; line: number; why: string };

function findingsIn(file: string): Finding[] {
  const raw = fs.readFileSync(file, 'utf8');
  if (!raw.includes('Alert.alert')) return [];
  const code = stripComments(raw);
  const found: Finding[] = [];
  const re = /Alert\.alert\s*\(/g;
  let m: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((m = re.exec(code))) {
    const call = code.slice(m.index, matchBracket(code, m.index + m[0].length - 1) + 1);
    const args = callArgs(call);
    if (args.length < 3) continue;
    const buttons = args[2].trim();
    if (!buttons || buttons === 'undefined') continue;
    const line = code.slice(0, m.index).split('\n').length;
    const rel = path.relative(ROOT, file);

    if (!buttons.startsWith('[')) {
      // An expression, not a literal. Its length is unknowable here, which is
      // the point: it is unbounded, so it WILL exceed the cap for some user.
      if (buttons.includes('.map(')) {
        found.push({ file: rel, line, why: 'button array is a mapped expression (unbounded)' });
      }
      continue;
    }

    let depth = 0;
    let count = 0;
    let mapped = false;
    let spread: string | null = null;
    for (let j = 0; j < buttons.length; j += 1) {
      const c = buttons[j];
      if (c === '(' || c === '[' || c === '{') {
        // Only count buttons belonging to THIS array, never a nested Alert's.
        if (c === '{' && depth === 1 && /^\{\s*text\s*:/.test(buttons.slice(j, j + 20))) count += 1;
        depth += 1;
      } else if (c === ')' || c === ']' || c === '}') {
        depth -= 1;
      } else if (depth === 1 && buttons.startsWith('...', j)) {
        const rest = buttons.slice(j);
        if (/^\.\.\.[\s\S]{0,120}?\.map\(/.test(rest.slice(0, 160))) {
          mapped = true;
          continue;
        }
        // `...(cond ? [ … ] : [])` adds at most the length of its literal
        // branch, so it is bounded and can simply be counted.
        // The condition may itself contain `?.` — `...(appJob?.workerId ? …`
        // is the shape in job/[id].tsx — so the scan for the ternary's own `?`
        // has to step over optional chaining rather than stop at the first
        // question mark, which would drop the spread on the floor unexamined.
        const ternary = rest.match(
          /^\.\.\.\(\s*(?:[^?]|\?\.){0,200}?\?\s*\[([\s\S]{0,800}?)\]\s*:\s*\[\s*\]\s*\)/,
        );
        if (ternary) {
          count += (ternary[1].match(/\{\s*text\s*:/g) ?? []).length;
          continue;
        }
        // A bare `...name`. VascoCard's snooze sheet was exactly this —
        // `[...baseOptions, ...muteOption, cancel]`, four buttons and five when
        // the item was pack-sourced — and it read here as ONE literal button,
        // because only `.map(` spreads were treated as unbounded. On Android
        // that sheet hid its own Cancel. The length of a named array is not
        // knowable from this file, so it is unbounded by the same argument that
        // already condemns a mapped one.
        const named = rest.match(/^\.\.\.\s*([A-Za-z_$][\w$]*)/);
        if (named) spread = named[1];
      }
    }
    if (mapped) found.push({ file: rel, line, why: 'spreads a mapped collection into the button array (unbounded)' });
    else if (spread) found.push({ file: rel, line, why: `spreads \`${spread}\` into the button array (unbounded)` });
    else if (count > ANDROID_BUTTON_CAP) found.push({ file: rel, line, why: `${count} buttons; Android shows ${ANDROID_BUTTON_CAP}` });
  }
  return found;
}

describe('Alert.alert is a confirmation, never a menu', () => {
  const files = ROOTS.flatMap((r) => walk(path.join(ROOT, r)));

  it('scans a meaningful number of files (guards against a broken walk)', () => {
    // A detector that silently scans nothing passes forever. #177: my own
    // tooling mis-measuring the codebase is its own recurring defect.
    expect(files.length).toBeGreaterThan(200);
    expect(files.filter((f) => fs.readFileSync(f, 'utf8').includes('Alert.alert')).length)
      .toBeGreaterThan(20);
  });

  it('has no Alert offering more choices than Android will render', () => {
    const findings = files.flatMap(findingsIn);
    // Printed in full rather than as a count: the failure message has to say
    // WHICH screen loses WHICH option, or the next person just bumps the cap.
    expect(findings.map((f) => `${f.file}:${f.line} — ${f.why}`)).toEqual([]);
  });

  it('detects the shape when it is reintroduced (decoy)', () => {
    // Pins the parser itself. Without this the test above passes when the
    // scanner is broken, which is the same failure as having no test.
    const decoy = path.join(ROOT, 'app', '__alert_decoy__.tsx');
    fs.writeFileSync(
      decoy,
      [
        'const opts = [1, 2, 3];',
        'Alert.alert("t", "m", [',
        '  { text: "a" }, { text: "b" }, { text: "c" }, { text: "d" },',
        ']);',
        'Alert.alert("t2", undefined, opts.map((o) => ({ text: String(o) })));',
        'Alert.alert("t3", "m", [ { text: "ok", onPress: () => Alert.alert("n", "m", [',
        '  { text: "1" }, { text: "2" }, { text: "3" } ]) }, { text: "cancel" } ]);',
        // The VascoCard shape: a spread of a NAMED array, which read as one
        // button until this was fixed.
        'Alert.alert("t4", "m", [...baseOptions, { text: "cancel" }]);',
        // Bounded conditional spread — adds at most one, must NOT be reported.
        'Alert.alert("t5", "m", [{ text: "a" }, ...(phone ? [{ text: "call" }] : []), { text: "c" }]);',
        // The string that broke the old comment stripper. Everything below it
        // was invisible; the alert that follows proves it no longer is.
        'const pick = { type: ["application/pdf", "image/*"] };',
        'Alert.alert("t6", "m", [ { text: "a" }, { text: "b" }, { text: "c" }, { text: "d" } ]);',
      ].join('\n'),
      'utf8',
    );
    try {
      const found = findingsIn(decoy);
      // The 4-button literal, the mapped expression, the named spread, and the
      // 4-button literal sitting AFTER a MIME wildcard. The third Alert is a
      // 2-button confirmation whose onPress opens a legal 3-button one, and the
      // fifth is bounded — neither may be reported.
      expect(found.map((f) => f.why)).toEqual([
        `4 buttons; Android shows ${ANDROID_BUTTON_CAP}`,
        'button array is a mapped expression (unbounded)',
        'spreads `baseOptions` into the button array (unbounded)',
        `4 buttons; Android shows ${ANDROID_BUTTON_CAP}`,
      ]);
    } finally {
      fs.unlinkSync(decoy);
    }
  });
});

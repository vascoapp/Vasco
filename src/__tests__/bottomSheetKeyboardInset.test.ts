/**
 * @jest-environment node
 */
// ANDROID: a bottom sheet needs the keyboard's HEIGHT, not a KeyboardAvoidingView.
//
// On a real device (API 36, Gboard) the "Neuer Kunde" sheet opened with every
// field and its Add button behind the keyboard — taps landed on keys. It had a
// KeyboardAvoidingView, which is why `bottomSheetKeyboard.test.tsx` (presence
// check) was green on it.
//
// Why KAV cannot work there: an RN <Modal> is its own window, and with
// edge-to-edge enforced (Android 15+/targetSdk 36, `edgeToEdgeEnabled: true`)
// the dialog window calls enableEdgeToEdge(), so it never gets the activity's
// adjustResize. KAV's `height` behaviour measures the keyboard against the
// ACTIVITY's visible frame while its own frame is inside the Modal window, so
// it computes 0 and applies nothing.
//
// The pattern that IS device-verified (job/[id].tsx site-contact sheet,
// 2026-09-12): `const kbInset = useKeyboardInset()` and
// `paddingBottom: kbInset ? kbInset + <spacing> : undefined` on the sheet.
// iOS keeps the KAV (`behavior="padding"`), which does work there.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const DIRS = ['app/contractor', 'app/(contractor)', 'app/(modals)', 'app/invoices', 'app/quotes', 'src/components/contractor', 'src/components/shared'];

/**
 * Modal blocks that hold a TextInput but are NOT bottom sheets — a full-screen
 * presentation scrolls, so nothing is trapped behind the keyboard.
 * ⚠️ On Android `presentationStyle` is ignored, so only list one here when the
 * modal is full-screen by LAYOUT, not by prop.
 */
const NOT_A_BOTTOM_SHEET = /presentationStyle=["']pageSheet["']|presentationStyle=["']fullScreen["']|animationType=["']none["']/;

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(p);
    return e.name.endsWith('.tsx') ? [p] : [];
  });
}

/** Every `<Modal …>…</Modal>` block, nesting-aware. */
export function modalBlocks(src: string): { start: number; body: string }[] {
  const out: { start: number; body: string }[] = [];
  const open = /<Modal[\s>]/g;
  let m: RegExpExecArray | null;
  while ((m = open.exec(src))) {
    let depth = 0;
    let i = m.index;
    while (i < src.length) {
      const nextOpen = src.indexOf('<Modal', i + 1);
      const nextClose = src.indexOf('</Modal>', i + 1);
      if (nextClose < 0) break;
      if (nextOpen >= 0 && nextOpen < nextClose) { depth += 1; i = nextOpen; continue; }
      if (depth === 0) { out.push({ start: m.index, body: src.slice(m.index, nextClose) }); break; }
      depth -= 1; i = nextClose;
    }
  }
  return out;
}

/**
 * A sheet the keyboard can cover: a TRANSPARENT modal drawn over the screen.
 * Matching on an inline `justifyContent` missed every sheet whose layout lives
 * in `StyleSheet.create` — insurance.tsx and the two centred cards in the quote
 * builder among them.
 */
const isOverlaySheet = (body: string) => /\btransparent\b/.test(body.slice(0, 400));

const hasTextInput = (body: string) => /<TextInput|<DecimalInput/.test(body);

describe('a bottom sheet with a field pads for the keyboard', () => {
  const files = DIRS.flatMap((d) => walk(path.join(ROOT, d))).map((f) => ({
    rel: path.relative(ROOT, f),
    src: stripComments(fs.readFileSync(f, 'utf8')),
  }));

  it('sees the sheets it claims to', () => {
    const sheets = files.flatMap(({ rel, src }) =>
      modalBlocks(src).filter((b) => hasTextInput(b.body) && isOverlaySheet(b.body) && !NOT_A_BOTTOM_SHEET.test(b.body)).map(() => rel));
    // AddCustomerSheet (THE customer form since #365 — customer-crm's and the
    // modal's own forms were folded into it), customer/[id], werk, expenses,
    // message-templates, insurance, job/[id], projects, project-billing ×3, …
    expect(sheets.length).toBeGreaterThanOrEqual(12);
    expect(sheets).toContain(path.join('src', 'components', 'shared', 'AddCustomerSheet.tsx'));
  });

  it('every one applies the keyboard inset to its own sheet', () => {
    const hits: string[] = [];
    for (const { rel, src } of files) {
      for (const block of modalBlocks(src)) {
        if (!hasTextInput(block.body) || !isOverlaySheet(block.body)) continue;
        if (NOT_A_BOTTOM_SHEET.test(block.body)) continue;
        const declaresHook = /const\s+(\w+)\s*=\s*useKeyboardInset\(/.exec(src);
        const line = src.slice(0, block.start).split('\n').length;
        if (!declaresHook) { hits.push(`${rel}:${line} — no useKeyboardInset() in the file`); continue; }
        // The padding may come through one derived name (DKSelect adds the
        // keyboard height to the safe-area pad it already applies).
        const names = [declaresHook[1]];
        for (const d of src.matchAll(/const\s+(\w+)\s*=\s*[^;\n]*\b(\w+)\b[^;\n]*;/g)) {
          if (names.includes(d[2]) && !names.includes(d[1])) names.push(d[1]);
        }
        const used = names.some((n) =>
          new RegExp(String.raw`(paddingBottom|marginBottom|bottom)\s*:\s*[^,}]*\b${n}\b`).test(block.body));
        if (!used) hits.push(`${rel}:${line} — ${names[0]} never reaches this sheet's padding`);
      }
    }
    expect(hits).toEqual([]);
  });

  // DEVICE, 2026-09-17: the inset and a KeyboardAvoidingView are two lifts.
  // A KAV at the Modal's ROOT does move the sheet on this Android build, so
  // "New job" (root KAV + inset) was pushed a whole keyboard height too high —
  // its title and field off the top, a blank gap above the keyboard — while
  // "Neuer Kunde" (KAV nested in the overlay, inert) sat exactly right on the
  // inset alone. One mechanism per platform: the inset on Android, KAV on iOS.
  it('never lifts a sheet twice on Android — a KAV beside the inset is iOS-only', () => {
    const doubled: string[] = [];
    let checked = 0;
    for (const { rel, src } of files) {
      if (!/useKeyboardInset\s*\(/.test(src)) continue;
      for (const m of src.matchAll(/<KeyboardAvoidingView\b[^>]*>/g)) {
        checked += 1;
        if (!/enabled=\{Platform\.OS === 'ios'\}/.test(m[0])) {
          doubled.push(`${rel}:${src.slice(0, m.index!).split('\n').length}`);
        }
      }
    }
    // 12 since #365: customer-crm's duplicate customer form (and its KAV) went.
    expect(checked).toBeGreaterThanOrEqual(12);
    expect(doubled).toEqual([]);
  });

  // RN 0.81 `flattenStyle` copies `undefined` like any value, so
  // `{ paddingBottom: kbInset ? kbInset + 16 : undefined }` ERASES the sheet's
  // own stylesheet padding whenever the keyboard is closed — buttons land on the
  // home indicator. Apply the inset as a whole object or not at all.
  it('the inset never overrides the sheet padding with undefined', () => {
    const erasing = files.flatMap(({ rel, src }) =>
      [...src.matchAll(/(paddingBottom|marginBottom|bottom)\s*:\s*[^,}]*\bkbInset\b[^,}]*(:\s*undefined|\|\|\s*undefined)/g)]
        .map((m) => `${rel}:${src.slice(0, m.index!).split('\n').length}`));
    expect(erasing).toEqual([]);
  });
});

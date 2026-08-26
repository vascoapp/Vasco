/**
 * REPO-WIDE: a bottom sheet with a text field needs a KeyboardAvoidingView.
 *
 * `justifyContent: 'flex-end'` pins a Modal's card to the bottom of the screen,
 * and iOS does NOT lift a Modal above the keyboard. Focusing any field then
 * puts the inputs AND the save button behind it — the form cannot be completed
 * on a real device at all.
 *
 * This has now been found and fixed FOUR times by hand: expenses.tsx
 * ("The expense could not be recorded on a real device at all"),
 * customer-crm.tsx, all three sheets in project-billing/[id].tsx (no instalment,
 * retention rate or meerwerk could be recorded), and the "New project" sheet
 * plus ReasonCodeSheet. Learnings #237.
 *
 * It survived every screen walk because the iOS Simulator attaches the HARDWARE
 * keyboard by default: tapping a field raises no soft keyboard, so the sheet
 * looks perfect in every screenshot. Nothing but a static check catches it.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const ROOTS = ['app', 'src/components'];
const SKIP = ['node_modules', '__tests__', '__screenwalk__'];

/**
 * Files whose bottom sheet genuinely needs no keyboard handling, with the
 * reason. A NEW offender fails until it is fixed or classified here; a stale
 * entry fails too, so this cannot rot into a blanket exemption.
 *
 * Currently EMPTY, and that is the finding. A first pass at this detector
 * matched per FILE and reported four portfolio dashboards as offenders; every
 * one was a false positive — their `flex-end` style and their TextInput live
 * in different modals. Resolving per modal block cleared all four, so there
 * was nothing to exempt and no "known deviation" worth writing down. #232 is
 * the warning here: a deviation recorded beside a bug is often worse than the
 * bug, and four invented ones would have been four lies.
 */
const EXEMPT: Record<string, string> = {};

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.some((s) => e.name === s)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

const files = ROOTS.flatMap((r) => walk(path.join(ROOT, r)));

/**
 * The shape, resolved PER MODAL BLOCK rather than per file.
 *
 * A file-level check is both too loose and too tight: it flagged
 * `projects/[id].tsx`, whose `flex-end` overlay belongs to a different modal
 * than its TextInput (that one is a full-height `pageSheet`), and it would
 * MISS a real offender in any file that happens to use a
 * KeyboardAvoidingView somewhere else. Same trap as #231 — a detector that
 * matches only the literal form walks past the worst instance.
 *
 * So: for each <Modal>…</Modal>, is it bottom-anchored (a style it references
 * is defined with `justifyContent: 'flex-end'`), does it contain a TextInput,
 * and does it lack a KeyboardAvoidingView?
 */
function bottomAnchoredStyles(src: string): Set<string> {
  const out = new Set<string>();
  // `name: { … justifyContent: 'flex-end' … }` — non-greedy to the closing brace.
  const re = /(\w+):\s*\{[^{}]*justifyContent:\s*'flex-end'[^{}]*\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.add(m[1]);
  return out;
}

function modalBlocks(src: string): string[] {
  const blocks: string[] = [];
  const re = /<Modal\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const end = src.indexOf('</Modal>', m.index);
    blocks.push(end > 0 ? src.slice(m.index, end) : src.slice(m.index));
  }
  return blocks;
}

function offendingBlocks(src: string): number {
  const anchored = bottomAnchoredStyles(src);
  if (anchored.size === 0) return 0;
  return modalBlocks(src).filter((b) => {
    // A full-height presentation is not a bottom sheet.
    if (/presentationStyle=["'](pageSheet|fullScreen|formSheet)["']/.test(b)) return false;
    if (!/<TextInput\b/.test(b)) return false;
    if (/KeyboardAvoidingView/.test(b)) return false;
    return [...anchored].some((name) => b.includes(`.${name}`));
  }).length;
}

function offends(src: string): boolean {
  return offendingBlocks(src) > 0;
}

describe('a bottom sheet with a text field lifts above the keyboard', () => {
  const offenders = files
    .filter((f) => offends(fs.readFileSync(f, 'utf8')))
    .map((f) => path.relative(ROOT, f));

  it('has no unclassified offender', () => {
    const unclassified = offenders.filter((f) => !(f in EXEMPT));
    expect(unclassified).toEqual([]);
  });

  it('has no stale exemption', () => {
    const stale = Object.keys(EXEMPT).filter((f) => !offenders.includes(f));
    expect(stale).toEqual([]);
  });

  it('detects the shape it is looking for', () => {
    // Decoy, both ways — a detector that cannot fail is not a detector.
    const bad = `
      const styles = { overlay: { flex: 1, justifyContent: 'flex-end' } };
      export const X = () => (
        <Modal><View style={styles.overlay}><TextInput /></View></Modal>
      );
    `;
    expect(offends(bad)).toBe(true);
    // A KeyboardAvoidingView inside that same modal clears it.
    expect(offends(bad.replace('<View style', '<KeyboardAvoidingView><View style'))).toBe(false);
    // A full-height presentation is not a bottom sheet, even with flex-end nearby.
    expect(offends(bad.replace('<Modal>', '<Modal presentationStyle="pageSheet">'))).toBe(false);
    // A bottom sheet with no text field is not this shape.
    expect(offends(bad.replace('<TextInput />', '<Text>hi</Text>'))).toBe(false);
    // A modal that does not reference the bottom-anchored style is not it.
    expect(offends(bad.replace('styles.overlay', 'styles.somethingElse'))).toBe(false);
  });
});

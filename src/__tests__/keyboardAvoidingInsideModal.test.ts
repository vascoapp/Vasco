/**
 * A text-entry sheet inside a `<Modal>` must move for the ANDROID keyboard.
 *
 * ── What does NOT work, verified on a device ────────────────────────────────
 * `KeyboardAvoidingView` cannot do this inside a `<Modal>` on Android, and **no
 * `behavior` value fixes it**. The activity is `adjustResize`
 * (AndroidManifest), but a Modal is its **own window** and never receives that
 * treatment, so the frame KAV measures never changes. Both of these were built,
 * installed and re-tested on the emulator, and the sheet stayed fully behind the
 * keyboard both times:
 *
 *    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
 *    behavior={...'height'} + style={{ flex: 1, justifyContent: 'flex-end' }}
 *
 * ── What does work ─────────────────────────────────────────────────────────
 * Reading the keyboard height from the event and padding the sheet:
 * `useKeyboardInset()` (src/hooks/useKeyboardInset.ts). Verified on the device —
 * both inputs, Speichern and Abbrechen visible while typing.
 *
 * ── Why this guard is shaped the way it is ─────────────────────────────────
 * The first version of this file asserted "a KAV inside a Modal must set an
 * Android behavior". That premise was wrong, and worse: every site satisfied it
 * while 11 of 12 were still broken. **A guard that passes over a live defect is
 * the thing this codebase keeps getting bitten by** (see learnings #298, #302,
 * #303). So it now asserts the fix that actually works, and lists the sheets
 * that still need it rather than pretending they are done.
 */
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const REPO = path.join(__dirname, '..', '..');

/**
 * Sheets known to still lack `useKeyboardInset`. Each is a real defect: the save
 * button sits under the keyboard on Android. The fix is mechanical — call the
 * hook and add `paddingBottom: inset` to the sheet's own container — but it is
 * a LAYOUT change and layout cannot be verified by a harness, so each needs a
 * device pass. Deliberately not done blind in one sweep, which is how the
 * iOS-only "fix" that caused all of this got written.
 *
 * ⚠️ Shrink this list. Never grow it.
 */
const AWAITING_DEVICE_PASS = [
  'app/(contractor)/bedrijf.tsx',
  'app/(contractor)/werk.tsx',
  'app/contractor/crew.tsx',
  'app/contractor/customer-crm.tsx',
  'app/contractor/customer/[id].tsx',
  'app/contractor/expenses.tsx',
  'app/contractor/insurance.tsx',
  'app/contractor/job-forms.tsx',
  'app/contractor/licenses.tsx',
  'app/contractor/message-templates.tsx',
  'app/contractor/project-billing/[id].tsx',
  'app/contractor/projects.tsx',
  'app/contractor/projects/[id].tsx',
  'src/components/contractor/AddJobMaterialModal.tsx',
  'src/components/contractor/ReasonCodeSheet.tsx',
  'src/components/contractor/RecommendationFeedback.tsx',
  'src/components/contractor/TieredQuoteBuilder.tsx',
  'src/components/customer/CustomerDecisionPortal.tsx',
  'src/components/dashboards/CFODashboard.tsx',
  'src/components/shared/DKSelect.tsx',
];

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('__')) continue;
        walk(p);
      } else if (entry.name.endsWith('.tsx')) out.push(p);
    }
  };
  for (const r of ['app', 'src']) walk(path.join(REPO, r));
  return out;
}

/** Files rendering a text input inside a `<Modal>`. */
function sheetsWithInputInsideModal(): string[] {
  const hits: string[] = [];
  for (const file of sourceFiles()) {
    const code = stripComments(fs.readFileSync(file, 'utf8'));
    const re = /<TextInput/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(code))) {
      const before = code.slice(0, m.index);
      const opens = (before.match(/<Modal[\s>]/g) ?? []).length;
      const closes = (before.match(/<\/Modal>/g) ?? []).length;
      if (opens > closes) {
        hits.push(path.relative(REPO, file));
        break;
      }
    }
  }
  return hits;
}

describe('a text sheet inside a Modal moves for the Android keyboard', () => {
  const sheets = sheetsWithInputInsideModal();

  it('finds the sheets at all (guards the walker)', () => {
    expect(sheets.length).toBeGreaterThan(5);
  });

  it('no NEW sheet appears without the keyboard inset', () => {
    const unfixed = sheets.filter((f) => {
      const src = fs.readFileSync(path.join(REPO, f), 'utf8');
      // A CALL, not the identifier: an unused `import { useKeyboardInset }`
      // satisfied the first version of this check while the hook was never
      // invoked — the same "presence not effect" error that let the August
      // audit file these sheets as clean.
      return !/useKeyboardInset\s*\(/.test(stripComments(src));
    });
    const unexpected = unfixed.filter((f) => !AWAITING_DEVICE_PASS.includes(f));
    expect(unexpected).toEqual([]);
  });

  it('the outstanding list stays honest — no entry that is already fixed', () => {
    // A stale allowlist is how a finished job keeps looking outstanding, and how
    // an outstanding one hides behind an entry nobody rechecks.
    const stale = AWAITING_DEVICE_PASS.filter((f) => {
      const p = path.join(REPO, f);
      return fs.existsSync(p)
        && /useKeyboardInset\s*\(/.test(stripComments(fs.readFileSync(p, 'utf8')));
    });
    expect(stale).toEqual([]);
  });
});

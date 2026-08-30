/**
 * =============================================================================
 * PRESSING A CONTROL MUST DO SOMETHING
 * =============================================================================
 * The missing link in this repo's evidence chain.
 *
 *   screen → service    ← nothing proved this until now
 *   service → backend   ← smoke:golden, smoke:customer (live)
 *   backend → database  ← check:drift, check:insertable (live)
 *
 * `npm run walk` mounts all 79 screens and has never pressed a button, so it
 * cannot see a handler that exists and does nothing. The static sweep for
 * `<Pressable>` with no `onPress` cannot see one either — the handler IS there;
 * it just leads nowhere. That is the shape behind a whole family of findings in
 * this codebase: the CTA that marked a job invoiced and created no invoice, the
 * confirmation dialog whose only job was to lie, the ten buttons that did
 * nothing, the warranty claim nobody filed.
 *
 * Method: mount a screen, fire every `onPress` in its tree, and ask whether
 * ANYTHING happened — navigation, an alert, a share, a backend call, a write to
 * storage, or a visible change to the rendered output. A control that produces
 * none of those did nothing at all.
 *
 * ⚠️ What this CANNOT prove: that the thing it did was the RIGHT thing. A
 * button that navigates to the wrong screen passes here. It answers "is this
 * wired", not "is this correct" — the second still needs reading and walking.
 */
import path from 'path';
import { Alert, Linking } from 'react-native';
import { walkScreen, teardown, resetWalkSession } from '../src/test-utils/screenWalk';
import fs from 'fs';
import { APP_DIR, PARAMS, listScreens, routeId } from './screens';

jest.setTimeout(600_000);

type Observed = { kind: string; detail: string };

/** Everything a press could do that counts as "wired". */
function installProbes() {
  const nav = (globalThis as any).__navSpies ?? {};
  Object.values(nav).forEach((fn: any) => fn?.mockClear?.());

  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  // Opening an external URL is a real action. The government-portal rows on
  // `certificaten` are `Linking.openURL(portal.url)` and nothing else, so
  // without this probe all seven of them read as controls that did nothing.
  const linkSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);

  // The supabase client is mocked in jest.screens.setup.ts; count any use of it.
  const supabase = require('../src/lib/supabase').supabase;
  // `.default` is what `react-native`'s index hands the screens; the named
  // export is the same jest.fn, but read the one the app actually calls.
  const shareMod = require('react-native/Libraries/Share/Share').default;
  const storage = require('@react-native-async-storage/async-storage').default;

  const before = {
    nav: Object.values(nav).reduce((n: number, f: any) => n + (f?.mock?.calls?.length ?? 0), 0),
    alert: 0,
    share: shareMod.share?.mock?.calls?.length ?? 0,
    from: supabase?.from?.mock?.calls?.length ?? 0,
    rpc: supabase?.rpc?.mock?.calls?.length ?? 0,
    invoke: supabase?.functions?.invoke?.mock?.calls?.length ?? 0,
    write: (storage.setItem?.mock?.calls?.length ?? 0)
      + (storage.multiSet?.mock?.calls?.length ?? 0)
      + (storage.removeItem?.mock?.calls?.length ?? 0),
  };

  return {
    alertSpy,
    linkSpy,
    read(): Observed[] {
      const out: Observed[] = [];
      const navNow = Object.values(nav).reduce((n: number, f: any) => n + (f?.mock?.calls?.length ?? 0), 0);
      if (navNow > before.nav) out.push({ kind: 'navigate', detail: `${navNow - before.nav}` });
      if (alertSpy.mock.calls.length > 0) out.push({ kind: 'alert', detail: String(alertSpy.mock.calls[0]?.[0] ?? '') });
      if (linkSpy.mock.calls.length > 0) out.push({ kind: 'openURL', detail: String(linkSpy.mock.calls[0]?.[0] ?? '') });
      if ((shareMod.share?.mock?.calls?.length ?? 0) > before.share) out.push({ kind: 'share', detail: '' });
      if ((supabase?.from?.mock?.calls?.length ?? 0) > before.from) out.push({ kind: 'supabase.from', detail: '' });
      if ((supabase?.rpc?.mock?.calls?.length ?? 0) > before.rpc) out.push({ kind: 'supabase.rpc', detail: '' });
      if ((supabase?.functions?.invoke?.mock?.calls?.length ?? 0) > before.invoke) out.push({ kind: 'edge fn', detail: '' });
      const writeNow = (storage.setItem?.mock?.calls?.length ?? 0)
        + (storage.multiSet?.mock?.calls?.length ?? 0)
        + (storage.removeItem?.mock?.calls?.length ?? 0);
      if (writeNow > before.write) out.push({ kind: 'storage write', detail: '' });
      return out;
    },
  };
}

/**
 * Every control with an `onPress`, found on the INSTANCE tree.
 *
 * ⚠️ Not `tree.toJSON()`. A `Pressable`'s `onPress` never reaches the host
 * output — measured, not assumed: rendering one Pressable and one
 * TouchableOpacity gives `viaToJSON=0, viaRootFindAll=3`. A toJSON-based
 * version of this harness would have pressed NOTHING and reported a clean
 * sweep, which is why the assertions below require a minimum press count.
 *
 * findAll returns a node per layer, so the same handler appears more than once;
 * dedupe on the function identity.
 */
function pressables(tree: any): { press: () => void; label: string; key: string }[] {
  const seen = new Set<unknown>();
  const out: { press: () => void; label: string; key: string }[] = [];
  const seenLabels = new Map<string, number>();
  let nodes: any[] = [];
  try {
    nodes = tree.root.findAll((n: any) => typeof n?.props?.onPress === 'function', { deep: true });
  } catch { return out; }
  for (const n of nodes) {
    const fn = n.props.onPress;
    if (seen.has(fn)) continue;
    seen.add(fn);
    if (n.props.disabled === true || n.props.accessibilityState?.disabled === true) continue;
    // accessibilityLabel FIRST. An icon-only control renders an Ionicons glyph
    // from the Unicode private-use area, which is a perfectly good non-empty
    // string and prints as nothing at all — every such control was reported as
    // `screen :: ` with an invisible name.
    const raw = n.props.accessibilityLabel
      || n.props.testID
      || stripGlyphs(instanceText(n))
      || (typeof n.type === 'string' ? n.type : n.type?.displayName ?? n.type?.name);
    // Icon-only controls have no text, no a11y label and no testID. Reporting
    // them as `screen :: ` is useless in a findings list and unusable as a
    // KNOWN_INERT key, so they get a name.
    const label = (typeof raw === 'string' && raw.trim()) || 'icon-only';
    // A STABLE key. Handlers are arrow functions recreated on every render, so
    // deduping on function identity re-presses the same button after the tree
    // changes — "bedrijf :: OVERZICHT" was pressed twice and reported twice.
    // Label + ordinal survives re-renders.
    const ord = (seenLabels.get(label) ?? 0) + 1;
    seenLabels.set(label, ord);
    out.push({ press: fn, label, key: `${label}#${ord}` });
  }
  return out;
}

/** Drop private-use-area glyphs (icon fonts) — they print as nothing. */
function stripGlyphs(t: string): string {
  return t.replace(/[\uE000-\uF8FF]/g, '').trim();
}

/**
 * The first NON-EMPTY rendered string under a test instance, for reporting.
 *
 * Stopping at the first string of any kind meant an empty text node ended the
 * search and the control was reported as `screen :: ` with nothing after it —
 * useless in a findings list and impossible to put in KNOWN_INERT.
 */
function instanceText(node: any): string {
  const found: string[] = [];
  const walk = (n: any) => {
    if (found.length) return;
    if (typeof n === 'string') {
      const t = n.trim();
      if (t) found.push(t);
      return;
    }
    (n?.children ?? []).forEach(walk);
  };
  try { walk(node); } catch { /* unreadable subtree */ }
  return found[0]?.slice(0, 40) ?? '';
}

/**
 * A signature of what the screen currently SHOWS.
 *
 * Not `JSON.stringify(tree.toJSON())` — that throws "Converting circular
 * structure to JSON" as soon as a prop holds a React element.
 *
 * Includes STYLE, not just text. Tabs and filter chips in this codebase express
 * their selected state through `style` alone — `facturen`'s tab bar is
 * `style={[styles.tab, activeTab === 'offertes' && styles.tabActive]}` with no
 * `accessibilityRole` and no `accessibilityState.selected` — so a text-only
 * signature reported every one of them as a control that "did nothing", when
 * the press had re-rendered the screen exactly as intended. Style is the only
 * evidence those presses leave.
 *
 * (That they carry no a11y state is a real defect for screen readers, but a
 * different one: it is about being announced, not about being wired.)
 */
function screenSignature(json: any, out: string[] = [], depth = 0): string {
  if (depth > 40) return out.join('\u0001');
  if (typeof json === 'string') { out.push(json); return out.join('\u0001'); }
  if (Array.isArray(json)) { json.forEach((c) => screenSignature(c, out, depth + 1)); return out.join('\u0001'); }
  if (json && typeof json === 'object') {
    const p = json.props ?? {};
    if (p.style !== undefined) {
      try { out.push(JSON.stringify(p.style)); } catch { /* unserialisable style */ }
    }
    const a = p.accessibilityState;
    if (a && typeof a === 'object') {
      for (const k of ['checked', 'selected', 'expanded', 'disabled', 'busy']) {
        if (typeof a[k] === 'boolean') out.push(`${k}:${a[k]}`);
      }
    }
    if (typeof p.value === 'string') out.push(`val:${p.value}`);
    (json.children ?? []).forEach((c: any) => screenSignature(c, out, depth + 1));
  }
  return out.join('\u0001');
}

/**
 * Controls this harness must not press.
 *
 * Every screen is mounted fresh, but the signed-in user lives in module scope
 * (`src/lib/currentUser`) and the mock AsyncStorage is shared for the whole
 * run — so a press that signs out or wipes storage would corrupt every screen
 * after it and make their controls look inert. A harness that manufactures
 * findings is worse than one that misses some. These are covered by the suites
 * that own them, where the blast radius is one test.
 */
const DESTRUCTIVE = /uitlog|log\s?out|logout|afmelden|abmelden|d\u00e9connex|cerrar sesi\u00f3n|esci|sign out|verwijder|delete|l\u00f6schen|supprimer|eliminar|elimina|reset|wis alles/i;

/**
 * Controls that legitimately do nothing observable HERE. Each needs a reason —
 * this list is the finding list, not a silencer.
 */
const KNOWN_INERT = new Set<string>([
  // Each of these is the tab or filter that is ALREADY selected when the screen
  // mounts. Pressing the tab you are on is correctly a no-op — there is nothing
  // for it to change. Verified individually: each has a live `onPress` that
  // sets the same value the screen already holds.
  '(contractor)/ai :: WACHTRIJ#1',        // queue tab, the default
  '(contractor)/bedrijf :: OVERZICHT#1',  // overview tab, the default
  '(contractor)/certificaten :: TabButton#1', // "Resumen"/"Overzicht", the default
  '(contractor)/decisions :: Actief#1',   // "Active" filter, the default
  '(contractor)/werk :: VANDAAG#1',       // "Today" filter, the default
]);

/**
 * A WIDER list than `listScreens()`.
 *
 * `listScreens()` is shared with the walk and detector suites, and its
 * IN_SCOPE list stops at the contractor surface — 80 of the app's 166 screens.
 * Widening it there would change what every one of those suites walks, which is
 * a different decision from widening what this one PRESSES. So this harness
 * scans `app/` itself and excludes only what is genuinely out of scope.
 *
 * `hub/` is excluded by a standing product decision (memory:
 * feedback_contractor_aannemer_only) — the portfolio roles ship to nobody.
 */
function listPressableScreens(): string[] {
  const shared = new Set(listScreens());
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${e.name}`;
      if (e.isDirectory()) { walk(full); continue; }
      if (!e.name.endsWith('.tsx')) continue;
      if (e.name === '_layout.tsx' || e.name.startsWith('+') || e.name === 'error.tsx') continue;
      const rel = full.slice(APP_DIR.length + 1);
      if (rel.startsWith('hub/') || rel.includes('/hub/')) continue;
      out.push(rel);
    }
  };
  walk(APP_DIR);
  // Shared ones first so a failure surfaces on the contractor surface first.
  return out.sort((a, b) => Number(shared.has(b)) - Number(shared.has(a)) || a.localeCompare(b));
}

describe('every control does something', () => {
  // WIRING_SCOPE=<substring> narrows the run while developing the harness — a
  // full pass mounts 79 screens and fires hundreds of handlers, which is too
  // slow to iterate against. CI runs it unscoped.
  const scope = process.env.WIRING_SCOPE;
  const screens = listPressableScreens().filter((r) => !scope || r.includes(scope));

  afterAll(async () => { await resetWalkSession(); });

  it('fires every onPress and reports the ones that do nothing at all', async () => {
    const inert: string[] = [];
    let pressed = 0;
    let screensCovered = 0;

    for (const rel of screens) {
      const id = routeId(rel);
      let Screen: any;
      try {
        Screen = require(path.join(APP_DIR, rel)).default;
      } catch {
        continue;
      }
      if (typeof Screen !== 'function') continue;

      const r = await walkScreen(Screen, { params: PARAMS[id] ?? {} });
      if (r.error || !r.tree) { teardown(r); continue; }
      screensCovered += 1;

      // Controls are RE-COLLECTED from the live tree before each press.
      //
      // Collecting once and then firing the whole list in sequence looks
      // equivalent and is not: the first press re-renders, and every handler
      // captured beforehand becomes a STALE closure over the old render. Firing
      // a stale `handleDismiss(id)` for a card already dismissed produces a new
      // Set with the same contents — React re-renders, the output is identical,
      // and the control is reported as doing nothing. Verified on
      // `(contractor)/ai :: LATER`, which a direct probe showed changing the
      // tree from 798 to 684 characters while the harness called it inert.
      const pressedKeys = new Set<string>();
      // No practical cap: the loop ends when every control has been pressed
      // once. The bound only stops a screen whose presses keep minting new
      // controls from running away. The largest screen here has 32 handlers.
      for (let i = 0; i < 80; i += 1) {
        let controls: { press: () => void; label: string; key: string }[] = [];
        try {
          controls = pressables(r.tree as any);
        } catch { break; }
        const next = controls.find((c) => !pressedKeys.has(c.key));
        if (!next) break;
        pressedKeys.add(next.key);

        const key = `${id} :: ${next.key}`;
        if (KNOWN_INERT.has(key) || DESTRUCTIVE.test(next.label)) continue;

        const probes = installProbes();
        const beforeSig = screenSignature((r.tree as any).toJSON());
        let threw = false;
        try {
          const { act } = require('react-test-renderer');
          await act(async () => {
            next.press();
            await Promise.resolve();
          });
        } catch {
          threw = true; // a handler that throws is doing something
        }
        pressed += 1;
        const observed = probes.read();
        const changed = screenSignature((r.tree as any).toJSON()) !== beforeSig;
        probes.alertSpy.mockRestore();
        probes.linkSpy.mockRestore();
        if (!threw && observed.length === 0 && !changed) inert.push(key);
      }
      teardown(r);
    }

    // A harness that silently pressed nothing passes forever. This is not
    // decoration: the first version read `tree.toJSON()`, where a Pressable's
    // onPress does not appear, so it pressed 0 controls and would have reported
    // a clean sweep. These two lines are what caught that.
    // eslint-disable-next-line no-console
    console.log(`[wiring] ${screensCovered} screens, ${pressed} controls pressed, ${inert.length} inert`);
    const minScreens = scope ? 1 : 40;
    const minPressed = scope ? 5 : 150;
    expect(screensCovered).toBeGreaterThanOrEqual(minScreens);
    expect(pressed).toBeGreaterThanOrEqual(minPressed);

    if (inert.length) {
      throw new Error(
        `${inert.length} control(s) did nothing when pressed — no navigation, alert, share, ` +
        `backend call, storage write, or visible change:\n  ` + inert.join('\n  '),
      );
    }
  });
});

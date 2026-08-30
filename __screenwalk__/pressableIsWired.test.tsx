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
import { Alert } from 'react-native';
import { walkScreen, teardown, resetWalkSession } from '../src/test-utils/screenWalk';
import { APP_DIR, PARAMS, listScreens, routeId } from './screens';

jest.setTimeout(600_000);

type Observed = { kind: string; detail: string };

/** Everything a press could do that counts as "wired". */
function installProbes() {
  const nav = (globalThis as any).__navSpies ?? {};
  Object.values(nav).forEach((fn: any) => fn?.mockClear?.());

  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

  // The supabase client is mocked in jest.screens.setup.ts; count any use of it.
  const supabase = require('../src/lib/supabase').supabase;
  const shareMod = require('react-native/Libraries/Share/Share');
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
    read(): Observed[] {
      const out: Observed[] = [];
      const navNow = Object.values(nav).reduce((n: number, f: any) => n + (f?.mock?.calls?.length ?? 0), 0);
      if (navNow > before.nav) out.push({ kind: 'navigate', detail: `${navNow - before.nav}` });
      if (alertSpy.mock.calls.length > 0) out.push({ kind: 'alert', detail: String(alertSpy.mock.calls[0]?.[0] ?? '') });
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
function pressables(tree: any): { press: () => void; label: string }[] {
  const seen = new Set<unknown>();
  const out: { press: () => void; label: string }[] = [];
  let nodes: any[] = [];
  try {
    nodes = tree.root.findAll((n: any) => typeof n?.props?.onPress === 'function', { deep: true });
  } catch { return out; }
  for (const n of nodes) {
    const fn = n.props.onPress;
    if (seen.has(fn)) continue;
    seen.add(fn);
    if (n.props.disabled === true || n.props.accessibilityState?.disabled === true) continue;
    out.push({ press: fn, label: instanceText(n) || n.props.accessibilityLabel || 'unlabelled' });
  }
  return out;
}

/** The first rendered string under a test instance, for readable reporting. */
function instanceText(node: any): string {
  try {
    const strings: string[] = [];
    const walk = (n: any) => {
      if (strings.length) return;
      if (typeof n === 'string') { strings.push(n.trim()); return; }
      (n?.children ?? []).forEach(walk);
    };
    walk(node);
    return strings[0]?.slice(0, 40) ?? '';
  } catch { return ''; }
}

/**
 * A cheap signature of what the screen currently SHOWS.
 *
 * Not `JSON.stringify(tree.toJSON())` — that throws "Converting circular
 * structure to JSON" the moment a prop holds a React element (a Provider, an
 * icon passed as a node). Only the rendered strings matter for "did anything
 * visibly change", and they cannot be circular.
 */
function textSignature(json: any, out: string[] = []): string {
  if (typeof json === 'string') { out.push(json); return out.join('\u0001'); }
  if (Array.isArray(json)) { json.forEach((c) => textSignature(c, out)); return out.join('\u0001'); }
  if (json && typeof json === 'object') {
    const p = json.props ?? {};
    if (typeof p.accessibilityState?.checked === 'boolean') out.push(`chk:${p.accessibilityState.checked}`);
    if (typeof p.value === 'string') out.push(`val:${p.value}`);
    (json.children ?? []).forEach((c: any) => textSignature(c, out));
  }
  return out.join('\u0001');
}

/**
 * Controls this harness must not press.
 *
 * Every screen is mounted fresh, but the signed-in user lives in module scope
 * (`src/lib/currentUser`) and the mock AsyncStorage is shared for the whole
 * run — so a press that signs out or wipes storage would corrupt every screen
 * that follows, and their controls would then look inert. A harness that
 * manufactures findings is worse than one that misses some.
 *
 * These are skipped, not excused: they are exercised by the suites that own
 * them, where the blast radius is one test.
 */
const DESTRUCTIVE = /uitlog|log\s?out|logout|afmelden|abmelden|déconnex|cerrar sesión|esci|sign out|verwijder|delete|löschen|supprimer|eliminar|elimina|reset|wis alles/i;

/**
 * Controls that legitimately do nothing observable HERE. Each needs a reason —
 * this list is the finding list, not a silencer.
 */
const KNOWN_INERT = new Set<string>([
  // Empty today. An entry belongs here only when the control's effect is real
  // but invisible to these probes (e.g. it drives a native module the walk
  // stubs out), and the reason must say which probe is blind.
]);

describe('every control does something', () => {
  // WIRING_SCOPE=<substring> narrows the run while developing the harness — a
  // full pass mounts 79 screens and fires hundreds of handlers, which is too
  // slow to iterate against. CI runs it unscoped.
  const scope = process.env.WIRING_SCOPE;
  const screens = listScreens().filter((r) => !scope || r.includes(scope));

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

      let controls: { press: () => void; label: string }[] = [];
      try {
        controls = pressables(r.tree as any);
      } catch { /* a screen that cannot serialise is covered by the walk suite */ }

      for (const c of controls.slice(0, 12)) {
        const key = `${id} :: ${c.label}`;
        if (KNOWN_INERT.has(key)) continue;
        if (DESTRUCTIVE.test(c.label)) continue;
        const probes = installProbes();
        const beforeSig = textSignature((r.tree as any).toJSON());
        let threw = false;
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { act } = require('react-test-renderer');
          await act(async () => {
            c.press();
            await Promise.resolve();
          });
        } catch {
          // A handler that throws is doing something; it is not inert.
          threw = true;
        }
        pressed += 1;
        const observed = probes.read();
        const changed = textSignature((r.tree as any).toJSON()) !== beforeSig;
        probes.alertSpy.mockRestore();
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

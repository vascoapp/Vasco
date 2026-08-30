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
      // Strip icon glyphs HERE, not downstream: an Ionicons glyph is a non-empty
      // string, so collecting it ended the search and the later icon-name
      // fallback could never run.
      const t = n.replace(/[\uE000-\uF8FF]/g, '').trim();
      if (t) found.push(t);
      return;
    }
    (n?.children ?? []).forEach(walk);
  };
  try { walk(node); } catch { /* unreadable subtree */ }
  if (found.length) return found[0].slice(0, 40);
  // Icon-only controls render an Ionicons private-use glyph, which the label
  // stripper removes, leaving `Pressable#7` — unidentifiable in a findings
  // list. The icon NAME is the only human-readable thing such a button has.
  const icons: string[] = [];
  const walkIcon = (n: any) => {
    if (icons.length || typeof n === 'string') return;
    const nm = n?.props?.name;
    if (typeof nm === 'string' && nm) { icons.push(nm); return; }
    (n?.children ?? []).forEach(walkIcon);
  };
  try { walkIcon(node); } catch { /* unreadable subtree */ }
  return icons.length ? `icon:${icons[0]}`.slice(0, 40) : '';
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
  // Pressing the tab/filter/segment that is ALREADY selected on mount. Verified
  // individually: each sets the value the screen already holds (e.g.
  // `viewMode` defaults to `'list'`, `severity` to `'Laag'`, `period` to
  // `'week'`). No signature can tell this from a dead control.
  '(contractor)/ai :: WACHTRIJ#1',        // queue tab, the default
  '(contractor)/bedrijf :: OVERZICHT#1',  // overview tab, the default
  '(contractor)/certificaten :: Overzicht#1',
  '(contractor)/decisions :: Actief#1',   // "Active" filter, the default
  '(contractor)/werk :: VANDAAG#1',       // "Today" filter, the default
  'contractor/ai-assistant :: Chat#1',
  'contractor/cashflow :: Overzicht#1',
  'contractor/expenses :: Alle#1',
  'contractor/material-search :: Alles#1',
  'contractor/message-templates :: Alle#1',
  'contractor/notifications :: Inbox#1',
  'contractor/payments :: Openstaand#1',
  'contractor/payroll :: Week#1',
  'contractor/permits :: Overzicht#1',
  'contractor/projects :: Alle#1',
  'contractor/quote-templates :: Alle#1',
  'contractor/reports :: Maandelijks#1',
  'contractor/timesheet :: Vandaag#1',
  'contractor/vat-and-audit :: Standaard BTW#1',
  'contractor/vat-prep :: Afgelopen kwartaal#1',
  'contractor/warranty :: Actief#1',
  'sitelead/close-defect :: Alle#1',
  'sitelead/daily-report :: Zonnig#1',
  'sitelead/dispatch :: icon:list#1',
  'sitelead/incident-report :: Incident#1',
  'sitelead/incident-report :: Laag#1',
  'sitelead/log-defect :: Gebrek#1',
  'sitelead/reports :: Deze Week#1',
  'sitelead/worker-certs :: Alle#1',

  // `expo-document-picker` / `expo-image-picker` are mocked to resolve
  // `{canceled:true}`, so the handler returns early and nothing changes. Real
  // in the app. ⚠️ Check the early return happens BEFORE any loading flag is
  // set, or resets it in a `finally` — otherwise cancelling really does wedge
  // the button, and that IS a bug.
  '(modals)/ingestion :: Bestand kiezen#1',
  '(modals)/ingestion :: PDF uploaden#1',
  'contractor/inkoop :: DATANORM#1',
  'contractor/inkoop :: E-factuur inlezen#1',
  'contractor/job/[id]/photos :: Gebrek-foto toevoegen#1',
  'contractor/job/[id]/photos :: Na-foto toevoegen#1',
  'contractor/job/[id]/photos :: Oplevering-foto toevoegen#1',
  'contractor/job/[id]/photos :: Tijdens-foto toevoegen#1',
  'contractor/job/[id]/photos :: Voor-foto toevoegen#1',

  // A SECOND entry point to a modal the harness already opened. The header `+`
  // is pressed before the empty-state CTA, so `setShowAdd(true)` is idempotent
  // by the time the CTA runs. A direct probe showed the crew CTA is fine:
  // controls 3->10, signature 241->634. READ THE PRESS TRAIL before believing
  // any inert verdict — order is everything.
  'contractor/crew :: Eerste teamlid toevoegen#1',
  'contractor/inkoop :: Bon scanner#2',
  'contractor/pipeline :: Lead toevoegen#1',

  // `HandoverPackBuilder`'s step indicator navigates only
  // `if (isCompleted || index === currentStepIndex)`. On mount you are on step
  // 0, so step 0 re-selects itself and steps 1-4 are forward skips the wizard
  // blocks by design.
  'contractor/handover/[jobId] :: Certificaat#1',
  'contractor/handover/[jobId] :: Checklist#1',
  'contractor/handover/[jobId] :: Documenten#1',
  'contractor/handover/[jobId] :: Foto\'s#1',
  'contractor/handover/[jobId] :: Voorbeeld#1',

  // Guarded by an empty input or an empty collection — the harness types
  // nothing and adds nothing, so the guard correctly refuses.
  // `if (newItemText.trim())` and `if (cart.length > 0)`.
  'contractor/material-search :: Winkelwagen#1',
  'sitelead/inspection :: Toevoegen#1',

  // A hidden multi-tap affordance: the logo opens the auth event log only on
  // the FIFTH tap (`if (next >= 5)`). One press correctly shows nothing.
  'login :: VascoBuild#1',

  // The SAME control pressed twice under two names. Its label is derived from
  // state: pressing `icon:star-outline#1` sets the rating to 1, so that star
  // re-renders as `icon:star`, which is then treated as a new key and pressed
  // again — setting 1 to 1. `label#ordinal` is stable across re-renders only
  // while the LABEL is.
  'contractor/job-quality/[id] :: icon:star#1',
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
 * feedback_contractor_aannemer_only) — the portfolio roles ship to nobody. The
 * CFO/director screens under `(tabs)/` are the same decision wearing a
 * different path: `enterprise_portfolio` is false, so they ship to nobody
 * either. They are excluded rather than listed in KNOWN_INERT because
 * recording them as known-GOOD would be a claim — `cfo-returns` selects a
 * project into state its own view may never read — and that is a claim about
 * code nobody is allowed to fix.
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
      if (/^\(tabs\)\/(cfo-|dir-|buildos)/.test(rel)) continue;
      out.push(rel);
    }
  };
  walk(APP_DIR);
  // Shared ones first so a failure surfaces on the contractor surface first.
  return out.sort((a, b) => Number(shared.has(b)) - Number(shared.has(a)) || a.localeCompare(b));
}

// Where the press trail is written. ALWAYS on, and synchronous.
//
// A press that starves the microtask queue (a handler that recurses into
// itself) cannot be bounded in-process: Promise.race and jest's own timeout
// both need a timer, and a starved loop never yields to one. Verified by
// decoy on `contractor/inkoop`. So the harness does not try to survive a
// hang — it makes one DIAGNOSABLE. appendFileSync has already hit disk when
// the process is killed, so the last line names the exact control.
// Without this, a hang cost an hour and produced no output at all.
const PROGRESS = process.env.WIRING_PROGRESS
  || require('path').join(require('os').tmpdir(), 'vasco-wiring-progress.log');
try { fs.writeFileSync(PROGRESS, ''); } catch { /* trail is best-effort */ }

describe('every control does something', () => {
  // WIRING_SCOPE=<substring> narrows the run while developing the harness — a
  // full pass mounts 79 screens and fires hundreds of handlers, which is too
  // slow to iterate against. CI runs it unscoped.
  const scope = process.env.WIRING_SCOPE;
  const screens = listPressableScreens().filter((r) => !scope || r.includes(scope));

  afterAll(async () => { await resetWalkSession(); });

  it('fires every onPress and reports the ones that do nothing at all', async () => {
    const inert: string[] = [];
    // Controls with NO accessible name at all. A label of `icon:<name>` means
    // the harness found no accessibilityLabel, no testID and no text under the
    // control — it fell back to naming the Ionicons glyph. That is precisely
    // what a screen-reader user gets: an unlabelled button.
    //
    // This is observed from a real render, not grepped, so it cannot be fooled
    // by a label that is present in source but never reaches the tree.
    const unlabelled = new Set<string>();
    let pressed = 0;
    let screensCovered = 0;

    for (const rel of screens) {
      const id = routeId(rel);
      const _prog = PROGRESS;
      if (_prog) fs.appendFileSync(_prog, `${new Date().toISOString()} START ${id}\n`);
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
        if (next.label.startsWith('icon:')) unlabelled.add(key);
        if (KNOWN_INERT.has(key) || DESTRUCTIVE.test(next.label)) continue;

        if (_prog) fs.appendFileSync(_prog, `${new Date().toISOString()}   press ${key}\n`);
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
      if (_prog) fs.appendFileSync(_prog, `${new Date().toISOString()} DONE  ${id} (${pressedKeys.size} pressed)\n`);
      teardown(r);
    }

    // A harness that silently pressed nothing passes forever. This is not
    // decoration: the first version read `tree.toJSON()`, where a Pressable's
    // onPress does not appear, so it pressed 0 controls and would have reported
    // a clean sweep. These two lines are what caught that.
    // eslint-disable-next-line no-console
    console.log(`[wiring] ${screensCovered} screens, ${pressed} controls pressed, ${inert.length} inert`);
    // eslint-disable-next-line no-console
    console.log(`[wiring] press trail: ${PROGRESS}`);
    // eslint-disable-next-line no-console
    console.log(`[wiring] ${unlabelled.size} controls have no accessible name`);

    // Persist the findings SYNCHRONOUSLY, before any assertion can throw.
    // A stray timer firing after Jest tears the environment down crashes the
    // process outright (`FadeIn` scheduling past teardown did exactly this),
    // and a 127-screen run that took minutes then reported its counts and lost
    // its entire findings list. Same lesson as the press trail: get it to disk.
    try {
      fs.appendFileSync(PROGRESS, '\n=== INERT (' + inert.length + ') ===\n' + inert.join('\n') + '\n');
      fs.appendFileSync(PROGRESS, '\n=== UNLABELLED (' + unlabelled.size + ') ===\n' + [...unlabelled].join('\n') + '\n');
    } catch { /* best-effort */ }
    const minScreens = scope ? 1 : 40;
    const minPressed = scope ? 5 : 150;
    expect(screensCovered).toBeGreaterThanOrEqual(minScreens);
    expect(pressed).toBeGreaterThanOrEqual(minPressed);

    // A RATCHET, not a target. An icon-only control with no accessibilityLabel,
    // no testID and no text is an unlabelled button to a screen-reader user —
    // "button" is all VoiceOver can say. This started at 111 and comes down as
    // the classes are fixed (back 42, close 15, CRM contact actions 24 so far).
    // Lower the number when you fix more; never raise it.
    //
    // Scoped to the surface this harness presses, so it cannot be gamed by
    // adding a labelled control elsewhere.
    const UNLABELLED_BASELINE = 34;
    if (unlabelled.size > UNLABELLED_BASELINE) {
      throw new Error(
        `${unlabelled.size} controls have no accessible name, up from ${UNLABELLED_BASELINE}. ` +
        `New unlabelled icon-only controls:\n  ` + [...unlabelled].join('\n  '),
      );
    }

    if (inert.length) {
      throw new Error(
        `${inert.length} control(s) did nothing when pressed — no navigation, alert, share, ` +
        `backend call, storage write, or visible change:\n  ` + inert.join('\n  '),
      );
    }
  });
});

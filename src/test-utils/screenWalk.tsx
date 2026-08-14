/**
 * Headless screen walk.
 *
 * Mounts a real screen with the real providers and the real Dutch locale, then
 * flattens everything it rendered into the strings a contractor would read.
 *
 * This is the simulator walk without the simulator: the bugs that walk finds
 * (raw enum leaks, English on a Dutch screen, two numbers on one screen that
 * contradict each other) all live in the rendered text, not in the types.
 */
import React from 'react';
import renderer, { ReactTestRenderer, act } from 'react-test-renderer';

// Real i18n — NOT the key-returning mock. Importing it initialises i18next
// with all six locale files.
import i18n from '../i18n/i18n';
import { AppStateProvider } from '../state/AppState';
import { AuthProvider, useAuth } from '../context/AuthContext';

export interface WalkResult {
  /** Every string the screen rendered, in tree order. */
  texts: string[];
  /** All accessibilityLabel values — a separate untranslated-string surface. */
  a11yLabels: string[];
  /** Anything thrown while mounting. */
  error: Error | null;
  tree: ReactTestRenderer | null;
}

/** Collect the text children of every <Text>, plus a11y labels, in tree order. */
function collect(node: any, texts: string[], a11y: string[]): void {
  if (node == null || node === false) return;
  if (typeof node === 'string') {
    const s = node.trim();
    if (s) texts.push(s);
    return;
  }
  if (typeof node === 'number') {
    texts.push(String(node));
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((n) => collect(n, texts, a11y));
    return;
  }
  const props = node.props ?? {};
  if (typeof props.accessibilityLabel === 'string' && props.accessibilityLabel.trim()) {
    a11y.push(props.accessibilityLabel.trim());
  }
  collect(node.children ?? props.children, texts, a11y);
}

export interface WalkOptions {
  /** Route params the screen reads via useLocalSearchParams. */
  params?: Record<string, string>;
  /** Locale to render in. Defaults to nl — walk in the target language. */
  language?: string;
  /** Extra async settle passes. Screens that load from AsyncStorage need a few. */
  settlePasses?: number;
  /**
   * Who is signed in.
   *
   * Without this the tree renders with `user === null`, so every
   * `user?.isAannemer` branch is false and the entire aannemer surface —
   * the projects tab, ProjectSwitcher, multi-site crew — silently renders its
   * solo-contractor variant instead. A walk that never signs in cannot see it.
   *
   * `handwerker` signs in the GERMAN demo contractor, which is a different
   * posture again, not just a different language: ~53 surfaces read
   * `businessProfile?.country ?? 'NL'`, and the DE-gated ones (VAT card,
   * XRechnung/ZUGFeRD export) test `country === 'DE'`. Walking in German
   * WITHOUT signing in as a German account renders German chrome over Dutch
   * country logic and shows none of the e-invoice surfaces that are the
   * entire German wedge. It also defaults `language` to 'de' — walking the
   * beachhead in Dutch is how the all-generators-were-Dutch bug survived.
   */
  as?: 'contractor' | 'aannemer' | 'handwerker' | 'plombier' | 'fontanero' | 'idraulico';
}

/**
 * Each posture is a COUNTRY, not just a language. 44 surfaces read
 * `businessProfile?.country ?? 'NL'` and 72 read `user?.country`, so signing in
 * the Dutch account and switching i18n renders foreign chrome over Dutch
 * country logic — which is how five markets ended up being shown the Dutch tax
 * office and how the German demo shipped Dutch job names.
 */
const POSTURE_EMAIL: Record<string, string> = {
  contractor: 'contractor@vasco.dev',
  aannemer: 'aannemer@vasco.dev',
  handwerker: 'handwerker@vasco.de.dev',
  plombier: 'plombier@vasco.fr.dev',
  fontanero: 'fontanero@vasco.es.dev',
  idraulico: 'idraulico@vasco.it.dev',
};

/** Language each posture must render in — walking a market in Dutch hides its bugs. */
const POSTURE_LANGUAGE: Record<string, string> = {
  handwerker: 'de', plombier: 'fr', fontanero: 'es', idraulico: 'it',
};

/** Signs a demo account in through the real login path, as the app does. */
function SignIn({ as, children }: { as: NonNullable<WalkOptions['as']>; children: React.ReactNode }) {
  const { login, isAuthenticated } = useAuth();
  const done = React.useRef(false);
  React.useEffect(() => {
    if (done.current) return;
    done.current = true;
    const email = POSTURE_EMAIL[as] ?? 'contractor@vasco.dev';
    login(email, 'walk').catch(() => {});
  }, [as, login]);
  return <>{isAuthenticated ? children : null}</>;
}

/**
 * Mount `Screen` and return everything it rendered.
 *
 * Never throws on a screen crash — the error is returned so one broken screen
 * does not end the walk.
 */
export async function walkScreen(
  Screen: React.ComponentType<any>,
  options: WalkOptions = {},
): Promise<WalkResult> {
  const { params = {}, settlePasses = 6, as } = options;
  // The German posture defaults to German. Passing `as:'handwerker'` and then
  // reading Dutch would reproduce the exact blind spot that hid #155.
  const language = options.language ?? (as ? POSTURE_LANGUAGE[as] ?? 'nl' : 'nl');

  (globalThis as any).__routeParams = params;
  if (i18n.language !== language) {
    await i18n.changeLanguage(language);
  }

  let tree: ReactTestRenderer | null = null;
  let error: Error | null = null;

  try {
    await act(async () => {
      const body = (
        <AppStateProvider>
          <Screen />
        </AppStateProvider>
      );
      tree = renderer.create(
        <AuthProvider>
          {as ? <SignIn as={as}>{body}</SignIn> : body}
        </AuthProvider>,
      );
    });
    // Screens hydrate from AsyncStorage and fire effects on mount; let the
    // microtask queue drain so we read the settled screen, not the spinner.
    for (let i = 0; i < settlePasses; i++) {
      await act(async () => {
        await Promise.resolve();
        await new Promise((r) => setTimeout(r, 0));
      });
    }
  } catch (e) {
    error = e instanceof Error ? e : new Error(String(e));
  }

  const texts: string[] = [];
  const a11yLabels: string[] = [];
  if (tree) {
    try {
      collect((tree as ReactTestRenderer).toJSON(), texts, a11yLabels);
    } catch (e) {
      error = error ?? (e instanceof Error ? e : new Error(String(e)));
    }
  }

  return { texts, a11yLabels, error, tree };
}

/** Unmount so the next screen starts from a clean tree. */
/**
 * Clear the signed-in session between POSTURES.
 *
 * Auth state lives in module scope (src/lib/currentUser) and in AsyncStorage,
 * neither of which a re-render resets. Walking FR then ES in one file left the
 * FR user in place, so the Spanish screens rendered Spanish chrome over FRENCH
 * country logic and the compliance screen listed URSSAF and Chorus Pro. That
 * looked exactly like a real bug — Spain being shown France's tax office — and
 * was not: run alone, ES passes. A harness that leaks posture manufactures
 * findings, which is worse than missing them.
 */
export async function resetWalkSession(): Promise<void> {
  const { setCurrentUser } = await import('../lib/currentUser');
  setCurrentUser(null);
  const AsyncStorage: any = (await import('@react-native-async-storage/async-storage')).default;
  // The jest mock implements getAllKeys/multiRemove but NOT clear(), so
  // calling clear() throws and takes the whole posture down with it.
  try {
    if (typeof AsyncStorage.clear === 'function') {
      await AsyncStorage.clear();
    } else if (typeof AsyncStorage.getAllKeys === 'function') {
      const keys = await AsyncStorage.getAllKeys();
      if (keys?.length) await AsyncStorage.multiRemove(keys);
    }
  } catch { /* a stubborn key must not fail the walk */ }
}

export function teardown(result: WalkResult): void {
  try {
    result.tree?.unmount();
  } catch {
    /* a screen that throws on unmount is not what this harness is measuring */
  }
}

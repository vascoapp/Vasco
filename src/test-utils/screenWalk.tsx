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
  as?: 'contractor' | 'aannemer' | 'handwerker';
}

/** Signs a demo account in through the real login path, as the app does. */
function SignIn({ as, children }: { as: NonNullable<WalkOptions['as']>; children: React.ReactNode }) {
  const { login, isAuthenticated } = useAuth();
  const done = React.useRef(false);
  React.useEffect(() => {
    if (done.current) return;
    done.current = true;
    const email =
      as === 'aannemer' ? 'aannemer@vasco.dev'
      : as === 'handwerker' ? 'handwerker@vasco.de.dev'
      : 'contractor@vasco.dev';
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
  const language = options.language ?? (as === 'handwerker' ? 'de' : 'nl');

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
export function teardown(result: WalkResult): void {
  try {
    result.tree?.unmount();
  } catch {
    /* a screen that throws on unmount is not what this harness is measuring */
  }
}

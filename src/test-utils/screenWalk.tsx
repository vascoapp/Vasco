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
import { AuthProvider } from '../context/AuthContext';

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
  const { params = {}, language = 'nl', settlePasses = 6 } = options;

  (globalThis as any).__routeParams = params;
  if (i18n.language !== language) {
    await i18n.changeLanguage(language);
  }

  let tree: ReactTestRenderer | null = null;
  let error: Error | null = null;

  try {
    await act(async () => {
      tree = renderer.create(
        <AuthProvider>
          <AppStateProvider>
            <Screen />
          </AppStateProvider>
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

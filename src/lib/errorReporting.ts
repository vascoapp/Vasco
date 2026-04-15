// =============================================================================
// ERROR REPORTING — thin provider-agnostic wrapper
// =============================================================================
// Designed to be swapped for Sentry (or Bugsnag/Rollbar) without touching
// callers. Initialize with `initErrorReporting()` once at app boot. If
// EXPO_PUBLIC_SENTRY_DSN is not set we no-op in prod and log to the console
// in dev — so callers are always safe to invoke `captureException()`.
//
// To enable Sentry later:
//   1. `npx expo install @sentry/react-native`
//   2. `npx sentry-wizard -i reactNative` (adds Sentry plugin to app.json)
//   3. Set EXPO_PUBLIC_SENTRY_DSN in .env / EAS secrets.
//   4. Uncomment the dynamic import below.
// =============================================================================

import { logWarn } from '../utils/errorHandler';

let initialized = false;
let sentryModule: any = null;

export interface ErrorContext {
  userId?: string;
  route?: string;
  extra?: Record<string, unknown>;
  tags?: Record<string, string>;
}

/** Call once at app startup. Safe to call with no DSN — it no-ops. */
export async function initErrorReporting(): Promise<void> {
  if (initialized) return;
  initialized = true;

  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  try {
    // Lazy require so the module isn't a hard dependency of the app bundle
    // until @sentry/react-native has been installed.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sentryModule = require('@sentry/react-native');
    sentryModule?.init?.({
      dsn,
      tracesSampleRate: 0.2,
      enableAutoSessionTracking: true,
      environment: __DEV__ ? 'development' : 'production',
    });
  } catch {
    logWarn('errorReporting', 'Sentry SDK not installed — skipping init. Run `npx expo install @sentry/react-native`.');
  }
}

/** Report a caught error with optional context. Never throws. */
export function captureException(error: unknown, context: ErrorContext = {}): void {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.warn('[errorReporting]', error, context);
  }
  try {
    if (sentryModule?.captureException) {
      sentryModule.captureException(error, {
        user: context.userId ? { id: context.userId } : undefined,
        tags: { route: context.route ?? 'unknown', ...(context.tags ?? {}) },
        extra: context.extra,
      });
    }
  } catch {}
}

/** Report a non-error event (useful for logical error paths). */
export function captureMessage(message: string, context: ErrorContext = {}): void {
  try {
    if (sentryModule?.captureMessage) {
      sentryModule.captureMessage(message, {
        tags: { route: context.route ?? 'unknown', ...(context.tags ?? {}) },
        extra: context.extra,
      });
    }
  } catch {}
}

/** Identify current user for error grouping. Called after login. */
export function setUser(userId: string | null): void {
  try {
    if (sentryModule?.setUser) {
      sentryModule.setUser(userId ? { id: userId } : null);
    }
  } catch {}
}

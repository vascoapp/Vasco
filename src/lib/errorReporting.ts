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
//
// R66r71: PII scrubbing applied to every captured surface (error message,
// breadcrumb message, context.extra) before it leaves the device. The
// privacy questionnaire in docs/app-privacy-questionnaire.md claims we
// don't ship email/phone/IBAN/VAT to Sentry — `scrubPii()` makes the
// claim true. Tested in `__tests__/errorReporting.test.ts`.
// =============================================================================

import { logWarn } from '../utils/errorHandler';

// ─── PII scrubbing ─────────────────────────────────────────────────────────
// Patterns chosen for high-confidence matches only — false positives are
// preferred over false negatives because the cost of leaking PII to Sentry
// is real-world (GDPR breach reporting) while a redacted log line is
// merely less useful for debugging.

// Order matters: VAT before IBAN (FR/IT/NL VAT numbers can otherwise
// match the IBAN shape). IBAN before phone (IBANs contain digits the
// phone regex would catch).
const PII_PATTERNS: ReadonlyArray<{ re: RegExp; placeholder: string }> = [
  // Email: standard RFC-5322-lite
  { re: /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g, placeholder: '<email>' },
  // EU VAT / BTW number: country prefix + digits + optional suffix.
  // Examples: NL123456789B01, DE123456789, FR12345678901, IT12345678901
  // Checked BEFORE IBAN because FR/IT VAT formats look like 13-char IBAN starts.
  { re: /\b(?:NL\d{9}B\d{2}|DE\d{9}|FR[A-Z0-9]{2}\d{9}|ES[A-Z0-9]\d{7}[A-Z0-9]|IT\d{11}|GB\d{9}|BE\d{10})\b/g, placeholder: '<vat>' },
  // IBAN: 2 letters + 2 digits + 4-30 alphanumeric (with optional spaces).
  // Checked BEFORE phone because IBAN digits would otherwise match phone.
  { re: /\b[A-Z]{2}\d{2}[ ]?(?:[A-Z0-9]{4}[ ]?){2,7}[A-Z0-9]{1,4}\b/g, placeholder: '<iban>' },
  // International phone (loose): + or 00 prefix, 8-15 digits with optional spaces/dashes
  { re: /(?:\+|00)\d[\d\s\-()]{7,18}\d/g, placeholder: '<phone>' },
  // Supabase / Mollie / Stripe JWTs (eyJ...). Three base64url segments.
  // Min length on the header is 10 chars — real JWTs can have very short
  // headers (just `{"alg":"HS256"}` → ~26 b64 chars) but artificially short
  // tokens in test fixtures may be smaller.
  { re: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, placeholder: '<jwt>' },
];

export function scrubPii(input: unknown): unknown {
  if (input == null) return input;
  if (typeof input === 'string') {
    let scrubbed = input;
    for (const { re, placeholder } of PII_PATTERNS) {
      scrubbed = scrubbed.replace(re, placeholder);
    }
    return scrubbed;
  }
  if (input instanceof Error) {
    // Errors are immutable from the caller's perspective for the
    // .message property — return a new Error with scrubbed contents.
    const out = new Error(scrubPii(input.message) as string);
    out.name = input.name;
    if (input.stack) out.stack = scrubPii(input.stack) as string;
    return out;
  }
  if (Array.isArray(input)) {
    return input.map((item) => scrubPii(item));
  }
  if (typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      out[k] = scrubPii(v);
    }
    return out;
  }
  // Numbers, booleans, etc — pass through.
  return input;
}

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

/** Report a caught error with optional context. Never throws. PII scrubbed. */
export function captureException(error: unknown, context: ErrorContext = {}): void {
  const scrubbedError = scrubPii(error);
  const scrubbedExtra = context.extra ? (scrubPii(context.extra) as Record<string, unknown>) : undefined;
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.warn('[errorReporting]', scrubbedError, { ...context, extra: scrubbedExtra });
  }
  try {
    if (sentryModule?.captureException) {
      sentryModule.captureException(scrubbedError, {
        user: context.userId ? { id: context.userId } : undefined,
        tags: { route: context.route ?? 'unknown', ...(context.tags ?? {}) },
        extra: scrubbedExtra,
      });
    }
  } catch {}
}

/** Report a non-error event (useful for logical error paths). PII scrubbed. */
export function captureMessage(message: string, context: ErrorContext = {}): void {
  const scrubbedMessage = scrubPii(message) as string;
  const scrubbedExtra = context.extra ? (scrubPii(context.extra) as Record<string, unknown>) : undefined;
  try {
    if (sentryModule?.captureMessage) {
      sentryModule.captureMessage(scrubbedMessage, {
        tags: { route: context.route ?? 'unknown', ...(context.tags ?? {}) },
        extra: scrubbedExtra,
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

// R66 round 49: breadcrumbs. When a Sentry crash report lands in week 1
// of NL launch, we want to see the trail of screens + user actions that
// led there. Pre-R49 the wrapper had no breadcrumb surface, so production
// crashes arrived as bare stack traces with no route context. Now every
// screen-mount + critical action (invoice send, quote create, etc.) drops
// a breadcrumb. Categories follow Sentry conventions — the SDK accepts
// any string, so we keep the type open and use convention-by-naming
// (auth, transaction, job, lead, crew, compliance, ai, onboarding,
// commerce, navigation, user, http, info).
export interface Breadcrumb {
  category: string;
  message: string;
  level?: 'info' | 'warning' | 'error';
  data?: Record<string, unknown>;
}

export function addBreadcrumb(crumb: Breadcrumb): void {
  // R66r71: scrub PII before the crumb reaches Sentry. Customer emails
  // / phones / IBANs that landed in error messages during dev showed
  // up verbatim in Sentry breadcrumbs pre-r71.
  const scrubbedMessage = scrubPii(crumb.message) as string;
  const scrubbedData = crumb.data ? (scrubPii(crumb.data) as Record<string, unknown>) : undefined;
  try {
    if (sentryModule?.addBreadcrumb) {
      sentryModule.addBreadcrumb({
        category: crumb.category,
        message: scrubbedMessage,
        level: crumb.level ?? 'info',
        data: scrubbedData,
        timestamp: Date.now() / 1000,
      });
    } else if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(`[breadcrumb:${crumb.category}]`, scrubbedMessage, scrubbedData ?? '');
    }
  } catch {}
}

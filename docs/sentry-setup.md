# Sentry Setup

R66r69. Wires Sentry crash reporting end-to-end: SDK in the app + DSN
in `.env` + sourcemap uploads from each release build.

Time: ~20 minutes once you have a Sentry account.

---

## State of play

| Piece | Status |
|---|---|
| `@sentry/react-native` SDK installed | ✅ in package.json since R6 |
| Auto-registered as Expo config plugin | ✅ in app.json |
| Wrapped in `src/lib/errorReporting.ts` | ✅ lazy-loads SDK if DSN set; no-op otherwise |
| Hooked into `app/_layout.tsx` ErrorBoundary | ✅ R6 |
| `setUser(user.id)` on auth + clears on logout | ✅ R6 |
| `addBreadcrumb` on every route change | ✅ R66r49 |
| Crash reports go to Sentry | ⚠ only if `EXPO_PUBLIC_SENTRY_DSN` is set |
| Stack traces are readable (not minified) | ❌ needs sourcemap upload per release |
| Native crashes resolve | ❌ needs dSYM (iOS) + Proguard (Android) upload |

---

## 1. Create the Sentry project

1. Sign up at https://sentry.io (free tier: 5k events/month, plenty for
   pre-launch + early users)
2. Create organization (e.g. `vasco-bv`)
3. Create project: **Platform = React Native**, name `vasco-mobile`
4. Copy the DSN from the "Configure SDK" page — it looks like
   `https://<key>@<org>.ingest.sentry.io/<project-id>`

---

## 2. Set the DSN

Local dev (`.env`):
```bash
EXPO_PUBLIC_SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project-id>
```

Production / preview builds (EAS):
```bash
eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value "https://..."
```

Verify on next `eas build` — the build log should print
`Sentry SDK initialized` near the start.

Without the DSN set, the SDK runtime is a no-op (zero overhead). This is
why preview builds don't accidentally pollute the prod Sentry project.

---

## 3. Generate an auth token for sourcemap uploads

Settings → Account → API → Auth Tokens → Create New Token.

Scopes needed:
- `project:releases`
- `project:write`
- `org:read`

Save as `SENTRY_AUTH_TOKEN`. Set locally + as a CI secret.

---

## 4. Install sentry-cli

```bash
brew install getsentry/tools/sentry-cli
```

Verify: `sentry-cli --version` (should print 2.x).

---

## 5. Run an upload after a build

Set the env vars once in your shell rc:

```bash
export SENTRY_AUTH_TOKEN="..."
export SENTRY_ORG="vasco-bv"
export SENTRY_PROJECT="vasco-mobile"
```

Then after each `eas build --profile production`:

```bash
# iOS
PLATFORM=ios bash scripts/sentry-upload.sh

# Android
PLATFORM=android bash scripts/sentry-upload.sh
```

The script:
1. Creates the Sentry release row (idempotent)
2. Associates the commit being shipped
3. Re-builds the JS bundle + sourcemap via `expo export:embed`
4. Uploads via `sentry-cli sourcemaps upload --strip-prefix`
5. Optionally uploads native debug symbols if `IOS_DSYM_PATH` /
   `ANDROID_MAPPING_TXT` env vars are set
6. Marks the release as deployed + finalized

If a crash arrives in Sentry within minutes of upload, you'll see file
paths like `src/services/aiActionQueueService.ts:212` instead of
minified bundle offsets.

---

## 6. iOS native crash symbolication

Native crashes (Swift / Obj-C / RN bridge) need the iOS .dSYM bundle.
EAS exposes it post-build:

```bash
# After eas build --profile production --platform ios, find the dSYM:
eas build:list --platform ios --limit 1 --json | jq '.[0].artifacts.applicationArchiveUrl'

# Download the .ipa, extract the dSYM, then upload:
IOS_DSYM_PATH="./build.dSYM" PLATFORM=ios bash scripts/sentry-upload.sh
```

EAS also exposes a Sentry post-build hook in `eas.json` (not yet wired
— add `"prebuildCommand"` and friends when you ship the first prod
build).

---

## 7. Android native crash symbolication

Android needs the Proguard `mapping.txt`. EAS keeps it server-side:

```bash
# After eas build --profile production --platform android
ANDROID_MAPPING_TXT="./mapping.txt" PLATFORM=android bash scripts/sentry-upload.sh
```

---

## 8. Sanity test before launching

Trigger a test crash from inside the app (with the preview build
installed and `EXPO_PUBLIC_SENTRY_DSN` set):

```ts
// Add this temporarily to app/(contractor)/index.tsx in a Pressable
import { captureException } from '../../src/lib/errorReporting';
captureException(new Error('Sentry sanity test from contractor home'));
```

Tap the Pressable → wait 30 seconds → check Sentry dashboard. If the
event arrives with a readable stack trace and the user ID set, the
pipeline is wired correctly. Remove the test code before shipping.

---

## What we explicitly DO NOT capture in Sentry

The `src/lib/errorReporting.ts` wrapper filters out:
- Email, phone, IBAN, KvK, customer names from breadcrumb messages
- Supabase auth tokens
- API request bodies (could contain PII)

Only:
- User ID (the supabase `auth.uid()` — opaque)
- Stack traces
- React component stack (when ErrorBoundary fires)
- Route name + segment changes (no query params)

This matches the privacy disclosure in
`docs/app-privacy-questionnaire.md` (Diagnostics → Crash Data, opt-in
via consent banner).

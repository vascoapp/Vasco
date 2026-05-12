#!/usr/bin/env bash
# Upload JS bundle + sourcemap + native debug symbols to Sentry after EAS build.
#
# R66r69. Without this, a crash in production shows minified stack
# traces like "at $.r (index.android.bundle:42:9128)" — useless.
# With this, you get "at recordPriceObservation (src/api/pricingApi.ts:120)".
#
# When to run:
#   - After every `eas build --profile production --platform ios` or
#     `--platform android` that you intend to ship.
#   - For TestFlight Internal you can skip; the Sentry SDK still
#     captures crashes, you just won't get readable stack traces.
#
# Requirements:
#   1. Sentry organization + project exist
#   2. SENTRY_AUTH_TOKEN env var set (Sentry → Settings → Account → API → Auth Tokens)
#   3. SENTRY_ORG + SENTRY_PROJECT env vars set
#   4. EXPO_PUBLIC_SENTRY_DSN already in .env (controls runtime opt-in)
#   5. sentry-cli installed:  brew install getsentry/tools/sentry-cli
#
# Usage:
#   PLATFORM=ios bash scripts/sentry-upload.sh
#   PLATFORM=android bash scripts/sentry-upload.sh
#
#   # Or override the release name (defaults to version+buildNumber from app.json):
#   RELEASE="com.vasco.app@1.0.0+1" bash scripts/sentry-upload.sh

set -euo pipefail

if ! command -v sentry-cli >/dev/null 2>&1; then
  echo "✗ sentry-cli not installed."
  echo "  brew install getsentry/tools/sentry-cli"
  exit 1
fi

: "${SENTRY_AUTH_TOKEN:?SENTRY_AUTH_TOKEN env var required}"
: "${SENTRY_ORG:?SENTRY_ORG env var required}"
: "${SENTRY_PROJECT:?SENTRY_PROJECT env var required (e.g. vasco-mobile)}"
PLATFORM="${PLATFORM:-ios}"

# Read version + buildNumber from app.json so release name matches what
# the SDK reports at runtime.
VERSION=$(node -e "console.log(require('./app.json').expo.version)")
if [[ "$PLATFORM" == "ios" ]]; then
  BUILD=$(node -e "console.log(require('./app.json').expo.ios.buildNumber)")
else
  BUILD=$(node -e "console.log(require('./app.json').expo.android.versionCode)")
fi
RELEASE="${RELEASE:-com.vasco.app@${VERSION}+${BUILD}}"

echo "═══════════════════════════════════════════════════"
echo "  Sentry upload"
echo "  Platform: $PLATFORM"
echo "  Release:  $RELEASE"
echo "  Org:      $SENTRY_ORG"
echo "  Project:  $SENTRY_PROJECT"
echo "═══════════════════════════════════════════════════"

# 1. Create the release row in Sentry (idempotent — does nothing if exists)
sentry-cli releases new "$RELEASE"

# 2. Associate the commit that's about to ship (idempotent)
sentry-cli releases set-commits "$RELEASE" --auto || true

# 3. Build the JS bundle + sourcemap with metro
mkdir -p .sentry-build
echo
echo "→ Building JS bundle + sourcemap…"
npx expo export:embed \
  --platform "$PLATFORM" \
  --bundle-output ".sentry-build/index.${PLATFORM}.bundle" \
  --sourcemap-output ".sentry-build/index.${PLATFORM}.bundle.map" \
  --dev false

# 4. Upload the bundle + sourcemap
echo
echo "→ Uploading JS sourcemap…"
sentry-cli sourcemaps upload \
  --release "$RELEASE" \
  --strip-prefix "$PWD" \
  --rewrite \
  .sentry-build

# 5. Native debug symbols (only meaningful when you have a built .ipa / .aab)
if [[ -n "${IOS_DSYM_PATH:-}" ]]; then
  echo
  echo "→ Uploading iOS dSYM at $IOS_DSYM_PATH …"
  sentry-cli debug-files upload --include-sources "$IOS_DSYM_PATH"
fi

if [[ -n "${ANDROID_MAPPING_TXT:-}" ]]; then
  echo
  echo "→ Uploading Android Proguard mapping at $ANDROID_MAPPING_TXT …"
  sentry-cli upload-proguard \
    --android-manifest android/app/src/main/AndroidManifest.xml \
    "$ANDROID_MAPPING_TXT"
fi

# 6. Mark the release as deployed
sentry-cli releases deploys "$RELEASE" new -e "${ENVIRONMENT:-production}"

# 7. Finalize (locks the release; new errors after this re-open the issue)
sentry-cli releases finalize "$RELEASE"

echo
echo "✓ Sentry release $RELEASE uploaded."
echo "  Verify at: https://${SENTRY_ORG}.sentry.io/releases/${RELEASE}/?project=${SENTRY_PROJECT}"

#!/usr/bin/env bash
# Capture App Store + Play Store screenshots in all 6 EU locales.
#
# R66r67. Drives the .maestro/screenshots.yaml flow over (locale × variant)
# combinations and renames the outputs to match Apple's required filename
# pattern for fastlane / xcrun simctl screenshots-upload.
#
# Prerequisites:
#   1. Install Maestro CLI:  curl -sL https://get.maestro.mobile.dev | bash
#   2. A running iOS simulator OR connected device with Vasco preview build
#      installed (eas build --profile preview).
#   3. macOS with simctl (Xcode Command Line Tools).
#
# Usage:
#   bash scripts/capture-screenshots.sh
#
# Optional env:
#   LOCALES="en nl"             override the locale list
#   VARIANTS="iPhone-15-Pro-Max" override the simulator-device list
#   OUTPUT_DIR="./screenshots"  where the renamed PNGs land
#
# Output:
#   ./screenshots/${variant}/${locale}/1_vandaag.png
#   ./screenshots/${variant}/${locale}/2_quote_builder.png
#   ... (5 screens × 6 locales × N variants)
#
# Pipe these into Fastlane via:
#   fastlane deliver --screenshots_path ./screenshots --skip_metadata true
# or upload manually via App Store Connect's Screenshots tab.

set -euo pipefail

LOCALES="${LOCALES:-en nl de fr es it}"
VARIANTS="${VARIANTS:-iPhone-16-Pro-Max iPhone-15-Pro-Max iPad-Pro-13-inch-M4}"
OUTPUT_DIR="${OUTPUT_DIR:-./screenshots}"

# Locale → display name in the in-app language picker.
# Must match the labels in app/contractor/profile.tsx → Language section.
declare -A LOCALE_DISPLAY=(
  [en]="English"
  [nl]="Nederlands"
  [de]="Deutsch"
  [fr]="Français"
  [es]="Español"
  [it]="Italiano"
)

# Variant → ASC slot name (used for the device-size grouping in the upload).
declare -A VARIANT_SLOT=(
  [iPhone-16-Pro-Max]="6_9inch"
  [iPhone-15-Pro-Max]="6_5inch"
  [iPad-Pro-13-inch-M4]="ipad_13inch"
)

if ! command -v maestro >/dev/null 2>&1; then
  echo "✗ maestro CLI not installed."
  echo
  echo "Install with:"
  echo "  curl -sL https://get.maestro.mobile.dev | bash"
  echo
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

for variant in $VARIANTS; do
  slot="${VARIANT_SLOT[$variant]:-$variant}"
  echo
  echo "═══════════════════════════════════════════════════"
  echo "  Variant: $variant  (slot: $slot)"
  echo "═══════════════════════════════════════════════════"

  # Boot the iOS simulator if needed (no-op if already booted).
  xcrun simctl boot "$variant" 2>/dev/null || true

  for locale in $LOCALES; do
    display="${LOCALE_DISPLAY[$locale]:-$locale}"
    echo
    echo "── $locale ($display) ──"

    # Run the Maestro flow with locale + variant env vars.
    maestro test .maestro/screenshots.yaml \
      -e LOCALE="$locale" \
      -e LOCALE_DISPLAY="$display" \
      -e VARIANT="$slot"

    # Move Maestro's output PNGs into the structured tree.
    # Maestro writes to ~/.maestro/tests/<runId>/screenshots/${name}.png
    # — we glob the most-recent runId's screenshots/ dir.
    latest_run=$(ls -td ~/.maestro/tests/*/ 2>/dev/null | head -1)
    if [[ -d "${latest_run}screenshots" ]]; then
      dest="$OUTPUT_DIR/$slot/$locale"
      mkdir -p "$dest"
      cp "${latest_run}screenshots/"*.png "$dest/"
      echo "  ✓ moved $(ls "$dest" | wc -l | xargs) screenshots → $dest"
    else
      echo "  ⚠ no screenshots found for $variant/$locale — flow may have crashed"
    fi
  done
done

echo
echo "═══════════════════════════════════════════════════"
echo "  Done. Captured screenshots in $OUTPUT_DIR/"
echo "═══════════════════════════════════════════════════"
echo
find "$OUTPUT_DIR" -name "*.png" | wc -l | xargs echo "Total screenshots:"
echo
echo "Upload via fastlane:"
echo "  fastlane deliver --screenshots_path $OUTPUT_DIR --skip_metadata true"
echo
echo "Or manually in App Store Connect → My Apps → Vasco → iOS Builds → Screenshots tab."

#!/usr/bin/env bash
# Capture App Store + Play Store screenshots in all 6 EU locales.
#
# R66r67. Drives the .maestro/screenshots.yaml flow over (locale × variant)
# combinations and renames the outputs to match Apple's required filename
# pattern for fastlane / xcrun simctl screenshots-upload.
#
# Prerequisites:
#   1. Install Maestro CLI:  curl -sL https://get.maestro.mobile.dev | bash
#   2. Xcode + simulators for the target devices (iPhone 16 Pro Max = 6.9",
#      iPhone 15 Pro Max = 6.5", iPad Pro 13-inch). The script resolves each
#      by real device name and boots it; it errors clearly if one is missing.
#   3. The Vasco **preview** build installed on those simulators
#      (a simulator build, or `xcrun simctl install <udid> Vasco.app`). The
#      script verifies com.vascobuild.app is present and skips the slot if not.
#
#      Build it FREE and locally — no EAS credit — with BOTH flags:
#        EXPO_PUBLIC_DEMO_MODE=true EXPO_PUBLIC_SCREENSHOT_MODE=true \
#          npx expo run:ios --configuration Release --device <udid>
#
#      DEMO_MODE alone is not enough and DEMO_MODE alone is wrong:
#        - without it the app renders EMPTY (no fixtures) and every shot is a
#          blank state;
#        - with it and nothing else, an orange "Demo Mode" strip sits across the
#          top of all 90 images, on the App Store product page.
#      SCREENSHOT_MODE keeps the fixtures and drops the strip. Release matters
#      too: a Debug build embeds no JS bundle and needs Metro running.
#   4. macOS with simctl (Xcode Command Line Tools).
#
# Usage:
#   bash scripts/capture-screenshots.sh
#
# Optional env:
#   LOCALES="en nl"             override the locale list (default: en nl de fr es it)
#   SLOTS="6_9inch"             override the device slots (default: 6_9inch 6_5inch ipad_13inch)
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
OUTPUT_DIR="${OUTPUT_DIR:-./screenshots}"

# Locale → display name in the in-app language picker.
# Must match the labels in app/contractor/profile.tsx → Language section.
# NOTE: plain `case` (not `declare -A`) — macOS ships bash 3.2, which has no
# associative arrays; `declare -A` there fails with "unbound variable".
locale_display() {
  case "$1" in
    en) echo "English" ;;
    nl) echo "Nederlands" ;;
    de) echo "Deutsch" ;;
    fr) echo "Français" ;;
    es) echo "Español" ;;
    it) echo "Italiano" ;;
    *)  echo "$1" ;;
  esac
}

# ASC slot → simulator device-NAME pattern (matched against the real names
# `xcrun simctl` reports, e.g. "iPhone 16 Pro Max", "iPad Pro 13-inch (M5)").
# NOTE: the pattern must be the *actual* device name — hyphenated forms like
# "iPhone-16-Pro-Max" NEVER match simctl and silently boot the wrong device.
# The iPad pattern is M-generation-agnostic so it resolves on M4/M5/etc.
slot_device_pattern() {
  case "$1" in
    6_9inch)     echo "iPhone 16 Pro Max" ;;
    6_5inch)     echo "iPhone 15 Pro Max" ;;
    ipad_13inch) echo "iPad Pro 13-inch" ;;
    *)           echo "" ;;
  esac
}

# Which ASC slots to capture. Override: SLOTS="6_9inch" bash scripts/capture-screenshots.sh
# (6.9" iPhone × your locales is the minimum App Store hard requirement.)
SLOTS="${SLOTS:-6_9inch 6_5inch ipad_13inch}"

# Maestro is a JVM tool; resolve a JAVA_HOME if the caller hasn't set one.
# openjdk installed via Homebrew is keg-only (not symlinked into /usr/bin), so
# the bare `java` wrapper errors "Unable to locate a Java Runtime". Point
# JAVA_HOME at the brew keg (Apple-silicon and Intel prefixes) or /usr/libexec.
if [[ -z "${JAVA_HOME:-}" ]]; then
  for cand in \
    "$(/usr/libexec/java_home 2>/dev/null)" \
    "/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home" \
    "/usr/local/opt/openjdk/libexec/openjdk.jdk/Contents/Home"; do
    if [[ -n "$cand" && -x "$cand/bin/java" ]]; then
      export JAVA_HOME="$cand"
      break
    fi
  done
fi
[[ -n "${JAVA_HOME:-}" ]] && export PATH="$JAVA_HOME/bin:$PATH"
export PATH="$PATH:$HOME/.maestro/bin"

if ! command -v maestro >/dev/null 2>&1; then
  echo "✗ maestro CLI not installed."
  echo
  echo "Install with:"
  echo "  curl -sL https://get.maestro.mobile.dev | bash"
  echo
  exit 1
fi

# Resolve the first available simulator UDID whose name matches a pattern.
resolve_udid() {
  xcrun simctl list devices available 2>/dev/null \
    | grep -F "$1" \
    | grep -oiE '[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}' \
    | head -1
}

mkdir -p "$OUTPUT_DIR"

for slot in $SLOTS; do
  pattern="$(slot_device_pattern "$slot")"
  if [[ -z "$pattern" ]]; then
    echo "✗ Unknown slot '$slot' — valid: 6_9inch 6_5inch ipad_13inch"
    exit 1
  fi

  udid="$(resolve_udid "$pattern")"
  if [[ -z "$udid" ]]; then
    echo "✗ No available simulator matching \"$pattern\" (slot $slot)."
    echo "  Available devices:"
    xcrun simctl list devices available | grep -E "iPhone|iPad" | sed 's/^/    /'
    echo
    echo "  Create the missing device in Xcode → Window → Devices and Simulators,"
    echo "  or adjust SLOT_DEVICE_PATTERN / pass SLOTS=... for what you have."
    exit 1
  fi

  echo
  echo "═══════════════════════════════════════════════════"
  echo "  Slot: $slot  →  $pattern  ($udid)"
  echo "═══════════════════════════════════════════════════"

  # Boot the resolved device by UDID and wait until it's ready.
  xcrun simctl boot "$udid" 2>/dev/null || true
  xcrun simctl bootstatus "$udid" -b 2>/dev/null || true

  # Guard: the Vasco preview build must be installed on THIS device, else the
  # flow just screenshots a blank home screen.
  if ! xcrun simctl get_app_container "$udid" com.vascobuild.app >/dev/null 2>&1; then
    echo "  ⚠ com.vascobuild.app is NOT installed on this simulator."
    echo "    Install the preview build first, e.g.:"
    echo "      xcrun simctl install $udid /path/to/Vasco.app"
    echo "    (from an 'eas build --profile preview --platform ios' artifact,"
    echo "     or a simulator build). Skipping slot $slot."
    continue
  fi

  for locale in $LOCALES; do
    display="$(locale_display "$locale")"
    echo
    echo "── $locale ($display) ──"

    # Run the Maestro flow against THIS specific device (never "whatever's booted").
    maestro --device "$udid" test .maestro/screenshots.yaml \
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
      echo "  ⚠ no screenshots found for $slot/$locale — flow may have crashed"
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

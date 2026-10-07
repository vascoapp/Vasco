#!/usr/bin/env bash
# Store screenshots on the iOS simulator WITHOUT a UI test driver.
#
# Maestro's XCUITest driver would not start on this machine (2 h, zero shots,
# 2026-10-07), and iOS 26 puts an "Open in Vasco?" prompt in front of every
# `simctl openurl`. So: the app reads the demo account and the target screen
# from its own preferences (app/login.tsx, SCREENSHOT_MODE builds only), this
# script writes them with `defaults`, relaunches, waits and screenshots.
#
# Needs a SCREENSHOT_MODE + DEMO_MODE Release sim build installed:
#   EXPO_PUBLIC_DEMO_MODE=true EXPO_PUBLIC_SCREENSHOT_MODE=true \
#     npx expo run:ios --configuration Release --device <udid>
#
# Usage: UDID=<sim> SLOT=6_9inch LOCALES="nl de" bash scripts/shoot-ios.sh
set -uo pipefail
UDID="${UDID:?simulator udid}"
SLOT="${SLOT:-6_9inch}"
LOCALES="${LOCALES:-en nl de fr es it}"
OUT="${OUT_DIR:-./screenshots}"
WAIT="${WAIT:-35}"
APP=com.vascobuild.app
# The built .app — reinstalled per locale so no market inherits the previous
# one's cached data (an NL run showed Italian customers otherwise).
APP_PATH="${APP_PATH:?path to the built Vasco.app}"

account() { case "$1" in
  nl) echo contractor@vasco.dev ;; de) echo handwerker@vasco.de.dev ;; fr) echo plombier@vasco.fr.dev ;;
  es) echo fontanero@vasco.es.dev ;; it) echo idraulico@vasco.it.dev ;; en) echo plumber@vasco.uk.dev ;; esac; }
quote() { case "$1" in nl) echo Q-2026-0033 ;; de) echo AN-2026-0041 ;; fr) echo DE-2026-0041 ;; es) echo PR-2026-0041 ;; it) echo PV-2026-0041 ;; en) echo QT-2026-0041 ;; esac; }
invoice() { case "$1" in nl) echo i-1043 ;; de) echo inv-de-1 ;; fr) echo inv-fr-1 ;; es) echo inv-es-1 ;; it) echo inv-it-3 ;; en) echo inv-uk-1 ;; esac; }
region() { case "$1" in en) echo GB ;; nl) echo NL ;; de) echo DE ;; fr) echo FR ;; es) echo ES ;; it) echo IT ;; esac; }

xcrun simctl boot "$UDID" 2>/dev/null; xcrun simctl bootstatus "$UDID" -b >/dev/null 2>&1
xcrun simctl status_bar "$UDID" override --time "9:41" --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3 --dataNetwork wifi

shoot() { # locale name route
  local loc="$1" name="$2" route="$3" dir="$OUT/$SLOT/$1"
  mkdir -p "$dir"
  xcrun simctl terminate "$UDID" "$APP" >/dev/null 2>&1
  xcrun simctl spawn "$UDID" defaults write "$APP" vascoShotAccount -string "$(account "$loc")"
  if [ -n "$route" ]; then xcrun simctl spawn "$UDID" defaults write "$APP" vascoShotRoute -string "$route"
  else xcrun simctl spawn "$UDID" defaults delete "$APP" vascoShotRoute >/dev/null 2>&1; fi
  xcrun simctl launch "$UDID" "$APP" >/dev/null
  sleep "$WAIT"
  xcrun simctl io "$UDID" screenshot "$dir/$name.png" >/dev/null 2>&1 && echo "  ✓ $SLOT/$loc/$name"
}

for loc in $LOCALES; do
  echo "── $loc"
  xcrun simctl uninstall "$UDID" "$APP" >/dev/null 2>&1
  xcrun simctl install "$UDID" "$APP_PATH"
  # The device language only reaches the login screen; the account sets the app's.
  xcrun simctl spawn "$UDID" defaults write -g AppleLanguages -array "$loc"
  xcrun simctl spawn "$UDID" defaults write -g AppleLocale -string "${loc}_$(region "$loc")"
  shoot "$loc" 1_today ""
  shoot "$loc" 2_quote "/quotes/$(quote "$loc")"
  shoot "$loc" 3_money "/geld"
  shoot "$loc" 4_invoice "/invoices/$(invoice "$loc")"
  shoot "$loc" 5_customers "/bedrijf"
  shoot "$loc" 6_work "/werk"
done
xcrun simctl terminate "$UDID" "$APP" >/dev/null 2>&1
xcrun simctl spawn "$UDID" defaults delete "$APP" vascoShotAccount >/dev/null 2>&1
xcrun simctl spawn "$UDID" defaults delete "$APP" vascoShotRoute >/dev/null 2>&1

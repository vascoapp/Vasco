#!/usr/bin/env bash
# =============================================================================
# PLAY STORE PHONE SCREENSHOTS — reframe the iOS captures to 9:16
# =============================================================================
# Play requires phone screenshots at 16:9 or 9:16, 320–3840px per side. The 48
# App Store captures in screenshots/ are 1320×2868 (1:2.17) — too tall — so
# fastlane/metadata/android/*/images/phoneScreenshots was EMPTY in all six
# locales, which is a hard submission blocker.
#
# This does not re-shoot. It takes the 6.9" captures (the highest-resolution
# set), removes the iOS status bar, and pads to an exact 9:16 canvas in the
# app's own background colour so the padding is invisible.
#
#   source   1320×2868   6.9" capture
#   crop     1320×2681   from y=186 — drops the iOS status bar
#   pad      1512×2688   exact 9:16 (1512 × 16/9 = 2688), bg #0B0E11
#
# ⚠️ sips FAILS SILENTLY. `-c 2682 1320 --cropOffset 186 0` on a 2868-tall
# source returns the ORIGINAL image at its original size, because the crop
# origin plus height must be strictly LESS than the source height. Nothing is
# printed and the exit status is 0. Every output is therefore dimension-checked
# below; a wrong size is fatal. Without that check this script would happily
# emit 24 uncropped, wrong-ratio images and report success.
#
#   ./scripts/make-play-screenshots.sh
set -euo pipefail

SRC_DPI="6_9inch"
CROP_W=1320; CROP_H=2681; CROP_Y=186
OUT_W=1512;  OUT_H=2688
BG="0B0E11"   # DK PAGE_BG — matches the app, so the side bars do not read as bars

declare -a LOCALES=("de:de-DE" "en:en-US" "es:es-ES" "fr:fr-FR" "it:it-IT" "nl:nl-NL")
# Only two of the four captures are fit to ship. Play's minimum is 2.
#
# EXCLUDED — do not re-add without fixing the underlying capture:
#
#   4_photo_to_quote — 🔴 POLICY, not taste. The screen is titled "KI-Angebot"
#     and pitches photo→AI quote generation. The Play listing DELIBERATELY
#     claims no AI features, because ANTHROPIC_API_KEY / MOONSHOT_API_KEY are
#     unset in production and that flow throws. Advertising it in a screenshot
#     is "does not function as described" — the exact risk the listing copy was
#     written to avoid. It ships only once a provider key is funded.
#
#   2_quote_builder — an empty-state capture: ~60% of the frame is blank
#     because a new quote starts with no line items. It reads as an unfinished
#     app. Re-shoot with items added and it is a good screenshot.
declare -a SHOTS=("1_vandaag" "3_geld_outstanding")
declare -a EXCLUDED=("2_quote_builder" "4_photo_to_quote")

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

made=0; failed=0
for pair in "${LOCALES[@]}"; do
  short="${pair%%:*}"; play="${pair##*:}"
  outdir="fastlane/metadata/android/${play}/images/phoneScreenshots"
  mkdir -p "$outdir"
  # This script OWNS the directory: fastlane uploads whatever it finds there, so
  # anything not in SHOTS is removed. Deleting only a known-bad list is not
  # enough — it leaves stray files (a rename, an experiment, a half-finished
  # capture) to ship silently. Learned the hard way: a decoy file survived a
  # "restore" because the cleanup only knew about EXCLUDED.
  for existing in "$outdir"/*.png; do
    [ -e "$existing" ] || continue
    base="$(basename "$existing" .png)"
    keep=0
    for want in "${SHOTS[@]}"; do [ "$base" = "$want" ] && keep=1; done
    [ "$keep" -eq 0 ] && rm -f "$existing"
  done
  for shot in "${SHOTS[@]}"; do
    in="screenshots/${SRC_DPI}/${short}/${SRC_DPI}_${short}_${shot}.png"
    out="${outdir}/${shot}.png"
    if [ ! -f "$in" ]; then
      echo "  ✕ missing source: $in"; failed=$((failed+1)); continue
    fi
    tmp="$(mktemp -t playshot).png"
    sips -c "$CROP_H" "$CROP_W" --cropOffset "$CROP_Y" 0 "$in" --out "$tmp" >/dev/null
    sips -p "$OUT_H" "$OUT_W" --padColor "$BG" "$tmp" --out "$out" >/dev/null 2>&1  # 2>&1: sips dumps the parsed CGColor to stderr
    rm -f "$tmp"

    w=$(sips -g pixelWidth  "$out" | awk '/pixelWidth/{print $2}')
    h=$(sips -g pixelHeight "$out" | awk '/pixelHeight/{print $2}')
    if [ "$w" != "$OUT_W" ] || [ "$h" != "$OUT_H" ]; then
      echo "  ✕ ${play}/${shot}: got ${w}×${h}, expected ${OUT_W}×${OUT_H}"
      failed=$((failed+1))
    else
      made=$((made+1))
    fi
  done
  n=$(ls "$outdir" | wc -l | tr -d ' ')
  echo "  ${play}: ${n} screenshot(s)"
done

echo
if [ "$failed" -gt 0 ]; then
  echo "✕ ${failed} screenshot(s) wrong or missing (${made} ok)"; exit 1
fi
echo "✓ ${made} Play screenshots at ${OUT_W}×${OUT_H} (9:16)"

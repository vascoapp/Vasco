# Fastlane — Vasco App Store automation

R66r68 (2026-05-12). Avoids paste-into-ASC by hand for the ~80
metadata fields × 6 locales.

## What's here

- `Fastfile` — three lanes: `metadata`, `screenshots`, `release`
- `metadata/` — paste-into-ASC fields per locale (6 locales × 8 files)
- `metadata/review_information/` — App Review reviewer-info form values
- `screenshots/` — where `scripts/capture-screenshots.sh` outputs PNGs;
  fastlane picks them up automatically

## One-time setup

```bash
# 1. Install fastlane (Homebrew preferred)
brew install fastlane

# 2. Authenticate with App Store Connect
#    Two options:
#    A) Username + app-specific password (simple but expires)
#       Set FASTLANE_USER + FASTLANE_PASSWORD env vars
#    B) App Store Connect API key (recommended, no expiry)
#       Create at https://appstoreconnect.apple.com/access/users → Keys → +
#       Save the .p8 file. Set FASTLANE_API_KEY_PATH + FASTLANE_API_KEY_ID +
#       FASTLANE_API_ISSUER_ID env vars.
```

## Upload metadata + screenshots (everything except the binary)

```bash
cd fastlane
fastlane release
```

Fastlane:
1. Reads all `metadata/{locale}/*.txt` and pushes to ASC.
2. Reads `screenshots/{variant}/{locale}/*.png` and pushes them.
3. Leaves the binary alone (`skip_binary_upload: true`) — EAS owns that.
4. Leaves submission alone (`submit_for_review: false`) — operator
   clicks Submit in ASC when ready.

## Just metadata or just screenshots

```bash
fastlane metadata     # txt files only
fastlane screenshots  # PNG files only
```

## ⚠️ DRAFT status

Per `docs/SHIP-READINESS.md` §4, **all .txt files except `name.txt` and
URL files** are machine-quality drafts. Native speakers should review
each `metadata/{locale}/description.txt` + `promotional_text.txt` before
running `fastlane release`. The release-notes for v1.0 launch are also
drafts — they describe what shipped, but tone may need a brand pass.

Specifically draft:
- ❓ All `description.txt` (NL/DE/FR/ES/IT copy quality)
- ❓ All `promotional_text.txt` (one-liner pitches)
- ❓ All `release_notes.txt` (what's-new for v1.0)
- ❓ All `keywords.txt` (ASO research not done)
- ✅ `review_information/phone_number.txt` (+31655135577)
- ❓ `review_information/first_name.txt` + `last_name.txt` (operator name)

EN-US copy is the canonical "source" — translations are mechanical.

## Mapping to ASC fields

| Fastlane file | App Store Connect form field |
|---|---|
| `metadata/{locale}/name.txt` | App Information → Name (30 chars) |
| `metadata/{locale}/subtitle.txt` | App Information → Subtitle (30 chars) |
| `metadata/{locale}/description.txt` | Version Information → Description (4000 chars) |
| `metadata/{locale}/promotional_text.txt` | Version Information → Promotional Text (170 chars, refreshable) |
| `metadata/{locale}/keywords.txt` | Version Information → Keywords (100 chars) |
| `metadata/{locale}/release_notes.txt` | Version Information → What's New (4000 chars) |
| `metadata/{locale}/support_url.txt` | App Information → Support URL |
| `metadata/{locale}/marketing_url.txt` | App Information → Marketing URL (optional) |
| `metadata/{locale}/privacy_url.txt` | App Information → Privacy Policy URL |
| `metadata/copyright.txt` | App Information → Copyright (e.g. "© 2026 Vasco B.V.") |
| `metadata/primary_category.txt` | App Information → Primary Category |
| `metadata/secondary_category.txt` | App Information → Secondary Category |
| `metadata/review_information/*` | App Review Information form (demo creds + reviewer contact) |

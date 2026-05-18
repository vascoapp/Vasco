# TestFlight Checklist

Goal: get a real Vasco build into the operator's hands via TestFlight on
their iPhone within ~24 hours of executing this list. TestFlight is Apple's
beta-distribution channel — apps in TestFlight don't go through full App
Store review (just a quick automated check), so this is the fastest path
from "code merged" to "running on a real device under a real Apple ID."

R66r65 baseline. **For the consolidated "what's still missing per
milestone" view see [`SHIP-READINESS.md`](./SHIP-READINESS.md)** — this
doc is just the TestFlight Internal walk-through. Cross-references
`release-runbook.md` §5 (preview build) and `launch-checklist.md`.

---

## 0. Prerequisites — you (or someone with the org's Apple account) must do these

These are one-time, blocking, no-code:

- [ ] **Apple Developer Program enrollment** ($99/yr) — sign up at
  https://developer.apple.com. Approval takes 1–2 business days for
  individual accounts, 2–4 weeks for new Org enrollments (D-U-N-S number).
  If you already have a personal Apple Developer account, you can use that
  for TestFlight while the Org enrollment lands.
- [ ] **Create the app record in App Store Connect** at
  https://appstoreconnect.apple.com → My Apps → "+". Bundle ID must
  match `app.json:expo.ios.bundleIdentifier` exactly → `com.vascobuild.app`.
  Name: "Vasco". Primary language: Dutch (or English, switchable later).
  This action returns the **ASC App ID** (10-digit number) — write it
  down.
- [ ] Note your **Apple Team ID** (10-char alphanumeric) from
  https://developer.apple.com/account/#!/membership.
- [ ] **The Apple ID email** you'll submit builds with.

---

## 1. Repo state — DONE (no operator action)

These were finalized in earlier rounds and verified for R66r65:

- ✅ EAS project linked: `@collectai/VascoApp` ID `eebc2577-cbf8-4252-9b6c-f91119c17b7d` (`app.json:280`).
- ✅ Bundle ID `com.vascobuild.app` (`app.json:24`).
- ✅ iOS version `1.0.0`, buildNumber `1` (`app.json:6,26`). EAS `production` profile auto-increments buildNumber on each build (`eas.json:32`).
- ✅ iOS privacy manifest declared (`app.json:47`, R66r49). 4 accessed-API reasons + 9 collected-data-types match what Vasco actually reads.
- ✅ `ITSAppUsesNonExemptEncryption: false` (`app.json:33`) — skips Apple export-compliance prompt because we only use HTTPS/standard crypto.
- ✅ Camera + photo-library + Face ID usage strings declared (Apple rejects builds that prompt without strings).
- ✅ Associated domains for deep links (`vascobuild.com`, `pay.vascobuild.com`, `admin.vascobuild.com`).
- ✅ Sentry plugin auto-registered (activates when `EXPO_PUBLIC_SENTRY_DSN` is set; otherwise no-op).
- ✅ `eas.json` submit block now has iOS section using `$EXPO_APPLE_ID` / `$EXPO_ASC_APP_ID` / `$EXPO_APPLE_TEAM_ID` env-var placeholders (R66r65).

---

## 2. Brand assets — placeholder, replace before TestFlight

Apple checks `icon.png` is not the Expo placeholder. The current asset is the
Expo template crosshair grid. **You can submit to TestFlight with a
placeholder, but reviewers see it and may reject the eventual App Store
submission** — so fix this before the build if a real icon is ready.

- [ ] `assets/icon.png` — 1024×1024, no transparency, no alpha channel for iOS
- [ ] `assets/adaptive-icon.png` — 1024×1024, foreground centered in 66% safe-zone (Android)
- [ ] After replacing, flip `app.json:219 android.adaptiveIcon.backgroundColor` to `#0B0E11` (DK theme)

If the brand-team assets aren't ready, ship the placeholder for TestFlight
**internal testing only** (no external testers). Apple won't reject internal
TestFlight builds for icon quality.

---

## 3. Build the preview profile

```bash
# One-time per repo
npm i -g eas-cli
eas login

# Provide your ASC creds via env vars (or skip — eas-cli will prompt)
export EXPO_APPLE_ID="you@example.com"
export EXPO_APPLE_TEAM_ID="ABCDEFGHIJ"
export EXPO_ASC_APP_ID="1234567890"

# Build the preview profile (DEMO_MODE=true, internal distribution)
eas build --profile preview --platform ios
```

EAS will:
1. Prompt you to log in to Apple if not authenticated. The first run
   creates an iOS distribution certificate + a provisioning profile on
   your behalf — accept the defaults.
2. Build on Expo's servers (~10–25 min).
3. Print a `.ipa` URL when done.

If the EAS build fails with "Apple credentials expired" or "no team
found", run `eas credentials` and follow the prompts to refresh.

---

## 4. Push to TestFlight

```bash
# After build #3 completes, submit it
eas submit --profile preview --platform ios
```

EAS will:
1. Upload the `.ipa` to App Store Connect (~5 min).
2. Apple's automated "processing" runs (~10–20 min). You'll get an email
   when it finishes.
3. Build appears in App Store Connect → TestFlight → iOS builds.

If `eas submit` errors with "ASC App ID not found" — go back to step 0
and create the App Store Connect app record. The ID has to match exactly.

---

## 5. Add internal testers

App Store Connect → TestFlight → Internal Testing → Create a Group.

- [ ] Add your Apple ID email as a tester
- [ ] Add up to 99 more internal testers (anyone with an Apple ID in your
  Apple Developer team — no separate review needed)
- [ ] Each tester gets an email + a TestFlight install link
- [ ] Install the TestFlight app on the test device → tap the email link → install Vasco

Internal builds are available **immediately** (no Apple review).

---

## 6. Beyond internal — external testers (optional, requires Apple review)

If you want to ship to people outside your Apple Developer team (e.g., a
real plumbing contractor for early validation):

- [ ] App Store Connect → TestFlight → External Testing → Add Group
- [ ] Add testers by email (they don't need a Developer account)
- [ ] Submit to **Beta App Review** — usually approved in 24–48h
- [ ] Provide:
  - **Beta App Description** — what testers should focus on (the EVE
    queue, the offline quote flow, the photo-to-quote feature)
  - **Test account credentials** — a demo contractor login (see
    CLAUDE.md "Demo Accounts": `contractor@vasco.dev` / any password
    when `EXPO_PUBLIC_DEMO_MODE=true`)
  - **Beta feedback email** — where testers send bug reports
- [ ] Once approved, external testers get a TestFlight link

---

## 7. Verify on a real device (acceptance test)

Once installed via TestFlight, walk the golden path:

- [ ] Login with `contractor@vasco.dev` / any password (preview profile
  has `EXPO_PUBLIC_DEMO_MODE=true`)
- [ ] Vandaag tab loads, EVE card shows demo actions
- [ ] Create a quote: Werk → New Quote → pick customer + service → tiers calculate
- [ ] Sign with finger on the SignaturePad (job-handover flow)
- [ ] Customer portal: open the share-link flow, enter the access code on a second device or browser
- [ ] Offline test: airplane mode → create a quote → reconnect → flushQueue picks up + canonical Q-number assigned
- [ ] Force-quit + reopen → state persisted
- [ ] Photo capture: Job detail → Add Photo → camera works → photo lands in gallery
- [ ] Push notifications: trigger a payment-received demo, verify the banner

If anything in this list breaks, capture a Sentry trace (`EXPO_PUBLIC_SENTRY_DSN`
should be set in `.env` so the TestFlight build reports errors) and triage
before promoting to external testers.

---

## What's NOT needed for TestFlight (but blocks App Store production)

- Real production Supabase project — TestFlight works against the same
  preview/staging Supabase as dev (preview profile already env'd that way).
- Live Mollie + Stripe keys — payment-link minting will fail gracefully
  with a placeholder error; UI tests don't depend on live billing.
- Real brand icons — see §2. TestFlight internal testers can run with the
  Expo placeholder.
- Store listings (descriptions, screenshots × 6 locales) — those are App
  Store production-only.
- pg_cron registration — TestFlight builds don't trigger any cron job that
  hasn't already fired on the server side.

---

## Common gotchas

- **"Invalid provisioning profile"** on first `eas build` → run
  `eas credentials --platform ios` and let EAS recreate them.
- **"buildNumber must be greater than"** → the `production` profile has
  `autoIncrement: true` so this self-corrects. For `preview` builds, bump
  `app.json:expo.ios.buildNumber` manually before the next build.
- **TestFlight processing stuck > 1 hour** → almost always an icon issue
  (transparency, wrong size). Check the App Store Connect "Activity" tab
  for the actual error.
- **External tester can't install** → they need to install the TestFlight
  app on iOS first, THEN tap the invite link. The link from the email
  fails if TestFlight isn't installed.
- **"This build is unable to be opened"** on the device → 99% of the
  time the app crashed at launch. Connect the device, view Console.app
  on macOS, filter for "Vasco" — the crash log is usually a missing env
  var (Supabase URL, Sentry DSN, etc.).

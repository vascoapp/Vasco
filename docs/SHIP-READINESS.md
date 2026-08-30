# Vasco Ship-Readiness — single source of truth

What's NOT in the repo today and needs to land before each ship milestone.
Reflects state as of R93 (2026-05-22).

> **Scope note**: this doc covers **TestFlight Internal** readiness for
> any market. EU6 launch + US expansion are largely complete on the code
> side; what remains is operator-side activation. See
> [`us-expansion-plan.md`](./us-expansion-plan.md) for the US phase
> tracker and [`e2e-audit-r88-2026-05-20.md`](./e2e-audit-r88-2026-05-20.md)
> for the latest FE↔BE↔DB audit.

## Fastest path to TestFlight Internal

```bash
# 1. Verify with the preflight script
npm run preflight:tf

# 2. Apply pending migrations (operator's Supabase)
supabase db push

# 3. Build + submit
eas build --profile preview --platform ios
eas submit --profile preview --platform ios
```

Internal TF is live immediately after Apple finishes binary processing
(5–15 min). No App Review needed for internal team distribution.

**Two milestones, two checklists:**
- **TestFlight Internal** — a build on your iPhone, only people in your
  Apple Dev team can install. No Apple review.
- **TestFlight External** / **App Store Production** — anyone with the
  invite link / general public. Apple reviews. Brand-asset + metadata
  bar applies.

The repo's code is ready for both. Most of the operator-side prep is
also done — what's left below is the short list of remaining items.

---

## 1. Apple credentials — ⚠️ ASC key REVOKED — use Transporter to submit

Authentication uses **App Store Connect API key**, not Apple-ID/2FA.
All four submit values are wired into `eas.json`; the `.p8` key file
sits in `secrets/` (gitignored).

> ⚠️ **The ASC API key `LAU7D8HU29` is REVOKED (returns 401)** — confirmed
> against build 33 (2026-06-17). Non-interactive `eas submit` and `altool`
> uploads FAIL. Until a new key is generated in App Store Connect
> (Users and Access → Integrations → App Store Connect API → generate a new
> key, download the `.p8`, update the three `eas.json` values + drop the file
> in `secrets/`), **upload builds via Transporter.app** (drag the `.ipa`,
> sign in with the operator Apple ID + 2FA). Builds 33/36/37 all shipped
> this way (see memory note `free-testflight-build-path.md`).

| Item | Where it lives | Status |
|---|---|---|
| Apple Developer Program enrollment ($99/yr) | operator's account | ✅ |
| **ASC API Key (.p8)** | `secrets/AuthKey_LAU7D8HU29.p8` | ⚠️ present but **REVOKED (401)** |
| **ASC API Key ID** | `eas.json:submit.{preview,production}.ios.ascApiKeyId` = `LAU7D8HU29` | ⚠️ points at revoked key |
| **ASC API Key Issuer ID** | `eas.json:...ascApiKeyIssuerId` = `215c3feb-76f3-4399-a0bb-d2385003e1b1` | ✅ (issuer unchanged) |
| **Apple Team ID** | `eas.json:...appleTeamId` = `3DX8FBF7S6` | ✅ |

Submit path today: build the `.ipa` (`eas build --local` = $0 native build,
no EAS credits), then **upload via Transporter.app**. The `eas submit` lane
resumes working only after the ASC key is regenerated.
Full walk-through: [`testflight-checklist.md`](./testflight-checklist.md).

`app.json` is at `buildNumber: 40` (as of 2026-07-15) — many prior
iterations have run; bump on every new binary.

---

## 2. Brand assets — ✅ branded PNGs shipped (final art = optional polish)

R66r67 replaced the Expo crosshair with a branded sunset-orange V mark
on DK slate. Suitable for TestFlight Internal + External *and* App
Store production. Brand-team final art is a polish item, not a gate.

| Asset | Path | Spec | Status |
|---|---|---|---|
| iOS app icon | `assets/icon.png` | 1024×1024 PNG, no alpha, sRGB | ✅ branded DK V mark |
| Android adaptive foreground | `assets/adaptive-icon.png` | 1024×1024, transparent bg, 66% safe-zone | ✅ branded DK V mark |
| Splash logo | `assets/splash-icon.png` | 1242×2436+ PNG transparent, centered | ✅ branded DK V mark |
| Admin/web favicon | `assets/favicon.png` | 48–192px | ✅ branded DK V mark |
| Play Store feature graphic | `assets/feature-graphic.png` | 1024×500 PNG | ✅ branded |
| Android notification small-icon | (removed in R66.24 — no dangling ref) | — | — |
| App Store preview video (optional) | — | 15–30s vertical mp4 per locale | ❌ skip for v1 |

**Swap-in path for brand-team final art** (when/if you decide to upgrade):
replace SVG sources in `assets/source/{icon-ios,adaptive-foreground,splash-mark,favicon}.svg`
then run `npm run render:icons` (uses `sharp`, already a dev dep).
PNGs regenerate deterministically; don't hand-edit the PNG outputs.

---

## 3. Screenshots — 🟡 pipeline ready, capture still pending

The only operator action that meaningfully blocks External TF + App
Store submission. Pipeline is fully automated — just needs to run.

**Code-side (done R66r67):**
- ✅ `.maestro/screenshots.yaml` — login + locale-switch + nav-to-5-hero-screens
- ✅ `scripts/capture-screenshots.sh` — loops 6 locales × 3 device variants
- ✅ `npm run capture:screenshots` registered

**To run** (~10–15 min wall-clock for all 90 files):
1. `curl -sL https://get.maestro.mobile.dev | bash` — install Maestro CLI
2. Boot iOS simulator with the latest preview build loaded
3. `npm run capture:screenshots`
4. Output lands in `./screenshots/${variant}/${locale}/` ready for ASC upload via `bundle exec fastlane ios screenshots`

### Required device sizes

| Apple device class | Resolution | Required? |
|---|---|---|
| 6.9" iPhone (16 Pro Max / 17 Pro Max) | 1320×2868 | ✅ required |
| 6.5" iPhone (XS Max / 11 Pro Max) | 1242×2688 | ✅ required (fallback) |
| 5.5" iPhone (8 Plus) | 1242×2208 | ⚠️ deprecated but accepted |
| iPad 13" (M4 / Pro 12.9") | 2064×2752 | only if "Supports iPad" on (it is) |

### Required hero set — 5 per device × 6 locales

App Store puts the first 3 in search results, so order matters:

1. **Vandaag tab** — EVE card + today's jobs + "Vasco saved you €X" banner
2. **Tiered quote builder** — preview step with Good/Better/Best cards + cohort badge
3. **Geld tab** — outstanding invoices list with payment-link CTA, big € amounts
4. **Photo → quote** — AI capturing job photos with line-item extraction overlay
5. **Compliance / VAT prep** — Q-end summary with rubriek breakdown

### Google Play

- Phone: 1080×1920+ (at least 2, up to 8) ✅ required
- 7" tablet: 1200×1920+ ⚠️ recommended
- 10" tablet: 1600×2560+ ⚠️ recommended
- Feature graphic 1024×500 ✅ already in `assets/feature-graphic.png`

---

## 4. Store metadata — ✅ all 6 locales scaffolded + reviewer info populated

**`fastlane/metadata/` fully populated:**

| Group | Files per locale | Locales | Status |
|---|---|---|---|
| `name.txt`, `subtitle.txt`, `description.txt`, `keywords.txt`, `promotional_text.txt`, `release_notes.txt`, `marketing_url.txt`, `support_url.txt`, `privacy_url.txt` | 9 | en-US, nl-NL, de-DE, fr-FR, es-ES, it-IT | ✅ all 54 files present |
| `copyright.txt`, `primary_category.txt`, `secondary_category.txt` | shared | — | ✅ "© 2026 Vasco B.V." / BUSINESS / PRODUCTIVITY |
| `review_information/{demo_user,demo_password,first_name,last_name,email_address,notes}.txt` | shared | — | ✅ real values (Merle Slendebroek, support@vascobuild.com, contractor@vasco.dev / "review") |

Reviewer notes (`fastlane/metadata/review_information/notes.txt`) include
a 3-minute walkthrough, 4 demo personas, GDPR/data-residency disclosure,
and explicit demo-mode framing. Apple will not need to ask follow-ups.

Upload in one shot: `bundle exec fastlane ios metadata` (after `brew install fastlane`).

**What's still soft / nice-to-have:**
- [ ] **Native-speaker review** of NL/DE/FR/ES/IT descriptions + promotional
      text + release notes — current drafts are machine-quality. Not a
      hard gate (Apple won't reject), but lifts conversion.
- [ ] **Keyword research per locale** — run AppRadar / SearchMan before
      Production publish; today's keyword bag is `contractor,invoice,quote,
      payment,trades,plumber,electrician,carpenter,aannemer,factuur,offerte`
      — a reasonable starting set, not a researched one.
- [ ] **Real reviewer phone number** in `fastlane/metadata/review_information/phone_number.txt`
      — placeholder `+31655135577` today. Apple sometimes calls; use a
      number you actually answer.

---

## 5. Live URLs — ✅ all live (verified 2026-05-19)

All store-required URLs return 200/308:

| URL | HTTP | Used by |
|---|---|---|
| https://vascobuild.com | 200 | Marketing URL field in ASC |
| https://vascobuild.com/support | 200 | Support URL field in ASC |
| https://vascobuild.com/privacy | 308 → live | Privacy URL (legally required) |
| https://vascobuild.com/terms | 308 → live | Terms URL |
| https://vascobuild.com/legal/privacy-policy | 200 | (admin canonical) |
| https://vascobuild.com/legal/terms-of-service | 200 | (admin canonical) |
| https://vascobuild.com/legal/eula | 200 | EULA URL |
| https://admin.vascobuild.com/legal/{privacy-policy,terms-of-service,eula} | 200 | mirror |
| support@vascobuild.com | n/a | Support email + reviewer contact |

Production EAS env (`eas.json:build.production.env`) points
`EXPO_PUBLIC_PRIVACY_URL` + `EXPO_PUBLIC_TERMS_URL` at the correct
vascobuild.com paths — the stale `vasco.app` values in local `.env`
only affect dev builds. (Cleanup of stale `.env` values is housekeeping
not gating; production override wins.)

---

## 6. Payment + integration credentials — Production-only gate

TestFlight builds run `EXPO_PUBLIC_DEMO_MODE=true` and mock the whole
payment + accounting stack — these only matter when flipping to
Production for paying customers.

| Service | Used for | Where it lives | Status |
|---|---|---|---|
| Live Supabase project | All BE | `EXPO_PUBLIC_SUPABASE_URL` in `.env` + `eas.json` | ✅ `gblhqhorkarocmputhte` populated |
| Supabase migrations push | Schema parity | run `supabase db push` once on prod | ❓ verify via `docs/supabase-go-live.md` |
| pg_cron registration | Scheduled fns (daily digests, pack triggers, deletion drain) | run `supabase/cron.sql` with service-role JWT | ❓ verify via `supabase/cron-health.sql` |
| Resend API key | Outbound email (invoices, reminders) | `supabase secrets set RESEND_API_KEY=...` | ❓ verify with operator |
| Mollie live API key | EU payments | `supabase secrets set MOLLIE_API_KEY=live_...` | ❓ verify with operator |
| Stripe live API key + webhook secret | UK payments | `supabase secrets set STRIPE_API_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_...` | ❓ verify with operator |
| Sentry DSN | Crash reporting | `EXPO_PUBLIC_SENTRY_DSN=` in production env | ❌ empty in `.env`; set via `eas secret:create` |
| FCM server key | Android push | `eas credentials` upload | ❓ verify with operator |
| APNs p8 key | iOS push | `eas credentials` upload | ❓ verify with operator |

Secrets that live in Supabase or EAS aren't visible from the repo;
`docs/release-runbook.md` §4c "Endpoint-health check" (`npm run check:endpoints`)
can probe most of these end-to-end against the live project.

---

## 7. Beta App Review (External TestFlight) — ✅ ready

Everything External-TF needs is pre-filled in `fastlane/metadata/review_information/`:

- ✅ **Beta App Description** — paste-ready text in [`docs/beta-app-description.md`](./beta-app-description.md)
- ✅ **Test account credentials** — `contractor@vasco.dev` / `review`; alternates: `aannemer@vasco.dev`, `site@vasco.dev`, `new@vasco.dev`
- ✅ **Beta feedback email** — `support@vascobuild.com`
- ✅ **Demo build URL/version** — auto-filled by EAS at submit time
- ✅ **Reviewer walkthrough** — 3-minute scripted flow in `review_information/notes.txt`
- ✅ **Privacy + tracking disclosure** — `notes.txt` declares no AppTrackingTransparency, EU data residency (Supabase Frankfurt), in-app GDPR rights

---

## 8. Production App Store submission — gates only the public launch

What still needs to happen to flip from External TF to Production:

- [ ] **§3 screenshots captured + uploaded** (the only remaining hard gate from §3 — at least 6.9" iPhone × 6 locales)
- [ ] **§4 native-speaker pass** on NL/DE/FR/ES/IT metadata (soft; lifts conversion, won't block)
- [ ] **§4 reviewer phone number** replaced with real number
- [ ] **§4 keyword research** per locale (soft)
- [ ] **§6 production credentials verified live** via `npm run check:endpoints`
- [ ] **§6 `docs/supabase-go-live.md` walked end-to-end** — migrations pushed, edge fns deployed, cron registered, idempotency keys set
- [ ] **§6 Sentry DSN populated** (`eas secret:create --name EXPO_PUBLIC_SENTRY_DSN --value https://...`)
- [ ] **App Privacy section** in ASC filled in — values pre-staged in [`docs/app-privacy-questionnaire.md`](./app-privacy-questionnaire.md)
- [ ] **Age rating questionnaire** in ASC (suggested: 4+, no objectionable content)
- [ ] **Pricing + availability** in ASC (Free with In-App Purchases; NL/DE/FR/ES/IT/GB initially)

---

## What IS in the repo + IS ready

So you can plan: everything below is code-side done. No operator action.

- ✅ EAS project linked + production push tokens work
- ✅ Bundle ID `com.vascobuild.app` + iOS scheme `vasco` + Android associations
- ✅ iOS privacy manifest declared (4 APIs + 9 collected data types)
- ✅ `ITSAppUsesNonExemptEncryption: false` (skips export compliance)
- ✅ Camera + photo + Face ID usage strings declared in 6 locales
- ✅ Sentry plugin auto-registered (no-op when DSN unset)
- ✅ EAS submit.preview.ios + submit.production.ios configs ready with
      hardcoded ASC API key (not env-var placeholders — actual values)
- ✅ Mollie + Stripe webhooks built with HMAC signature verification +
      idempotency (R66r41)
- ✅ Drain-account-deletions Edge Function for GDPR Art. 17
- ✅ Push-token persistence into Supabase + unregister on logout
- ✅ Sign-in with email/password, real signup, password reset (R155-R157)
- ✅ Cookie banner + consent layer + GDPR portability export (R66r61)
- ✅ Offline write queue with temp-id rewriting + doc-number swap (R66r62)
- ✅ Signatures audit trail table + RPC + UI panel + realtime watcher
      (R66r55-r57)
- ✅ PII scrubbing in errorReporting (email/IBAN/VAT/phone/JWT) + 21
      regression tests so the privacy questionnaire's claim stays true
      (R66r71)
- ✅ AuthContext tests — login success / wrong password / network /
      demo-bypass / logout cleanup, 9 cases (R66r71)
- ✅ ASC + Play listing validator (`npm run check:listings`) wired into
      `preflight` so ITMS-90000 char-limit overruns fail CI, not Apple
      review (R66r71)
- ✅ Bundle-size audit (`npm run analyze:bundle`) — heaviest modules +
      per-package weights + suspicious-import detection +/-10%
      baseline gate (R66r71)
- ✅ Release workflow (`.github/workflows/release.yml`) triggered by
      `v*` tags or manual dispatch; gates EAS build on full preflight +
      uploads Sentry sourcemaps in parallel (R66r71)
- ✅ EAS `postBuildCommand` wired to `sentry-upload.sh` for production
      profile so sourcemaps upload automatically per build on EAS
      workers, with graceful skip when `SENTRY_AUTH_TOKEN` not set
      (R66r71)
- ✅ Branded DK app icons + splash + feature-graphic shipped (R66r67/r69)
- ✅ Fastlane lanes for both iOS (`metadata` / `screenshots` / `release`)
      and Android (`metadata` / `release`) — one-command upload
- ✅ All store-required URLs live on vascobuild.com (2026-05-19 curl check)
- ✅ 910/910 tests across 86 suites, 0 TS errors

---

## TL;DR — what's actually left

**To get on TestFlight Internal (a build on your iPhone):**
nothing in this doc. Just `eas build --profile preview --platform ios`
then `eas submit --profile preview --platform ios`.

**To get on TestFlight External or App Store Production:**
1. Capture screenshots (`npm run capture:screenshots`, ~15 min)
2. Replace `+31655135577` placeholder phone with real number
3. Set Sentry DSN (`eas secret:create --name EXPO_PUBLIC_SENTRY_DSN ...`)
4. Verify Mollie/Stripe/Resend live keys + cron registered with the
   operator (or run `npm run check:endpoints` against prod)
5. (optional polish) Native-speaker review of 5 non-English locales,
   per-locale keyword research

Everything else is done.

---

## Quick-reference: which doc owns what

- [`go-live-deploy-runbook.md`](./go-live-deploy-runbook.md) — **master
  ordered sequence** (git push → Supabase → SMTP → Sentry → payments → iOS)
  to take `main` from code-done to live. Start here for the deploy.
- **This file** — what's STILL missing, per milestone
- [`testflight-checklist.md`](./testflight-checklist.md) — exact commands
  to go from creds-in-hand to a build on your iPhone
- [`launch-checklist.md`](./launch-checklist.md) — rolling log of what's
  shipped + the operator-action sequence
- [`release-runbook.md`](./release-runbook.md) — end-to-end production
  release (preview build → submit → kill-switch → hotfix)
- [`supabase-go-live.md`](./supabase-go-live.md) — Supabase project setup
  (migrations, edge fns, cron, secrets)
- [`store-listings.md`](./store-listings.md) — store-metadata copy in 6
  locales (drafts, needs native review)
- [`app-review-info.md`](./app-review-info.md) — paste-into-ASC values
  for App Review form
- [`SCHEMA_LOCK.md`](./SCHEMA_LOCK.md) — BE↔FE schema contract (v1.6)
- [`DORMANT_AUDIT.md`](./DORMANT_AUDIT.md) — rolling log of dormant
  features + cleanup rounds

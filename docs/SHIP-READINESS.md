# Vasco Ship-Readiness — single source of truth

What's NOT in the repo today and needs to land before each ship milestone.
Reflects state as of R66r65 (2026-05-12).

**Two milestones, two checklists:**
- **TestFlight Internal** — a build on your iPhone, only people in your
  Apple Dev team can install. No Apple review.
- **TestFlight External** / **App Store Production** — anyone with the
  invite link / general public. Apple reviews. Brand-asset + metadata
  bar applies.

The repo's code is ready for both. Everything below is **operator-side**
or **brand-team-side** work. Each item flags which milestone it gates.

---

## 1. Apple credentials — gates TestFlight Internal

| Item | Where to get | Where it goes | TF | Prod |
|---|---|---|---|---|
| Apple Developer Program enrollment ($99/yr) | developer.apple.com | — | ✅ | ✅ |
| **ASC App ID** (10-digit) | After creating app record at appstoreconnect.apple.com | `$EXPO_ASC_APP_ID` | ✅ | ✅ |
| **Apple Team ID** (10-char) | developer.apple.com/account/#!/membership | `$EXPO_APPLE_TEAM_ID` | ✅ | ✅ |
| **Apple ID email** | Your account | `$EXPO_APPLE_ID` | ✅ | ✅ |

Once you have these 4, `eas build --profile preview --platform ios` →
`eas submit --profile preview --platform ios` works.
Full walk-through: [`testflight-checklist.md`](./testflight-checklist.md).

---

## 2. Brand assets — gates TestFlight External + App Store

R66r67 replaced the Expo crosshair with a branded sunset-orange V mark
on DK slate. Suitable for TestFlight Internal + External. Brand-team
final art still recommended before App Store production launch.

| Asset | Required for | Spec | Status |
|---|---|---|---|
| `assets/icon.png` (iOS) | TF external, App Store | 1024×1024 PNG, no transparency, no alpha, sRGB | 🟡 R66r67 branded placeholder |
| `assets/adaptive-icon.png` (Android foreground) | Play Store | 1024×1024, transparent bg, content in 66% safe-zone (centered circle) | 🟡 R66r67 branded placeholder |
| `assets/splash-icon.png` (splash logo) | TF + Prod | 1242×2436+ PNG transparent, centered | 🟡 R66r67 branded placeholder |
| `assets/favicon.png` (admin web) | admin dashboard | 48×48 / 192×192 | 🟡 R66r67 branded placeholder |
| Notification small-icon (Android) | Prod push UX | 96×96 dp monochrome transparent PNG | ❌ removed in R66.24 (dangling ref) |
| Play Store **feature graphic** | Play Store | 1024×500 PNG | 🟡 R66r69 branded placeholder |
| App Store **preview video** (optional) | Bumps conversion | 15-30s vertical mp4 per locale | ❌ |

**To swap in brand-team final art:** replace the SVG sources in
`assets/source/{icon-ios,adaptive-foreground,splash-mark,favicon}.svg`,
then run `npm run render:icons` (uses `sharp`, already a dev dep).
PNGs regenerate deterministically; don't hand-edit the PNG outputs.
`app.json:219 android.adaptiveIcon.backgroundColor` is `#0B0E11` (DK
slate) — pair with transparent-bg foreground.

---

## 3. Screenshots — gates TestFlight External + App Store

Apple requires screenshots at submission. **Zero captured today**, but
capture is fully automated post-build:

**R66r67 shipped the capture pipeline:**
- `.maestro/screenshots.yaml` — one Maestro flow that logs in, switches
  locale via in-app picker, navigates to the 5 hero screens, and takes
  a screenshot at each
- `scripts/capture-screenshots.sh` — bash wrapper that loops 6 locales ×
  3 device variants (6.9" iPhone, 6.5" iPhone, iPad 13"), boots the
  simulator, and renames outputs into `./screenshots/${variant}/${locale}/`
  ready for App Store Connect upload
- `npm run capture:screenshots` once Maestro CLI is installed
  (`curl -sL https://get.maestro.mobile.dev | bash`) and a TestFlight
  build is loaded on the simulator

What's left for the operator: install Maestro, boot a sim with the
preview build, run the script. ~10-15 min for all 90 screenshots
(6 locales × 3 variants × 5 screens).

### Required device sizes

| Apple device class | Resolution | Required? |
|---|---|---|
| 6.9" iPhone (16 Pro Max / 17 Pro Max) | 1320×2868 | ✅ required |
| 6.5" iPhone (XS Max / 11 Pro Max) | 1242×2688 | ✅ required (used as fallback) |
| 5.5" iPhone (8 Plus) | 1242×2208 | ⚠️ deprecated but still accepted |
| iPad 13" (M4 / Pro 12.9") | 2064×2752 | only if "Supports iPad" is on (it is) |

### Required screenshots — 5 per device × 6 locales = 30 per device class

Recommended hero set, in this order (App Store puts the first 3 in
search results):

1. **Vandaag tab** — EVE card + today's jobs visible, "Vasco saved you €X" banner
2. **Tiered quote builder** — preview step showing Good/Better/Best cards with cohort badge
3. **Geld tab** — outstanding invoices list with payment-link CTA, big € amounts
4. **Photo → quote** — AI capturing job photos with line-item extraction overlay
5. **Compliance / VAT prep** — Q-end summary with rubriek breakdown

### Google Play

Play Store screenshots are looser:
- Phone: 1080×1920+ (at least 2, up to 8) ✅ required
- 7" tablet: 1200×1920+ ⚠️ recommended
- 10" tablet: 1600×2560+ ⚠️ recommended
- Feature graphic 1024×500 ✅ required

---

## 4. Store metadata copy — drafts in repo, needs brand review

**Drafts exist** at [`store-listings.md`](./store-listings.md) for all 6
locales. Each has short-name, subtitle, short-description, long-description
(<4000 chars), keywords (<100 chars). Voice is plain-language trade, not
marketing gloss.

**R66r68 (2026-05-12) added:**
- ✅ `fastlane/metadata/{locale}/` scaffolding — all 6 locales × 9 files
  ready for `fastlane release` to upload in one command
- ✅ `promotional_text.txt` × 6 locales (170-char one-liners) drafted
- ✅ `release_notes.txt` × 6 locales (v1.0 launch "What's New") drafted
- ✅ `review_information/` folder with reviewer demo creds + 3-min
  walkthrough notes
- ✅ `docs/beta-app-description.md` — paste-into-ASC for External
  TestFlight Beta App Review form
- ✅ `docs/app-privacy-questionnaire.md` — pre-filled answers for both
  ASC App Privacy + Play Console Data Safety questionnaires

**What still needs your input:**
- [ ] **Native-speaker review** of NL/DE/FR/ES/IT descriptions +
      promotional text + release notes (drafts are machine-quality)
- [ ] **Keyword research** — current keywords are educated guesses;
      run AppRadar / SearchMan for each locale before publish
- [ ] **`fastlane/metadata/review_information/{first_name,last_name,phone_number}.txt`** —
      operator's real contact info (placeholders today)

---

## 5. Live URLs — gates TF External + App Store review

App Store + Play Store require working URLs for these. `app-review-info.md`
references all of them but none are verified live.

| URL | Status | Used by |
|---|---|---|
| https://vasco.app | ❓ unverified | Marketing URL field in ASC |
| https://vasco.app/support | ❓ unverified | Support URL field in ASC |
| https://admin.vasco.app/legal/privacy-policy | ❓ unverified | Privacy URL (legally required) |
| https://admin.vasco.app/legal/eula | ❓ unverified | EULA URL |
| https://admin.vasco.app/legal/terms-of-service | ❓ unverified | Terms URL |
| support@vasco.dev | ❓ unverified | Support email |
| review@vasco.dev | ❓ unverified | Reviewer contact email |

Note: `admin/src/app/legal/[slug]/page.tsx` exists and renders the legal
markdown — verify it's deployed to Vercel + reachable at the URL above
**before** submitting to App Review.

---

## 6. Payment + integration credentials — gates Production only

TestFlight builds use `EXPO_PUBLIC_DEMO_MODE=true` (mocked responses).
Real keys only matter for Production submission.

| Service | Used for | Status |
|---|---|---|
| Live Supabase project | All BE | ✅ project exists (`gblhqhorkarocmputhte`); 8 migrations pending push |
| pg_cron registration | Scheduled features | ❌ requires operator to run `supabase/cron.sql` with service-role JWT |
| Resend API key | Outbound email (invoices, reminders) | ❌ `supabase secrets set RESEND_API_KEY=...` |
| Mollie live API key | EU payments | ❌ `supabase secrets set MOLLIE_API_KEY=live_...` |
| Stripe live API key + webhook secret | UK payments | ❌ `supabase secrets set STRIPE_API_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_...` |
| Sentry DSN | Crash reporting | ❌ `EXPO_PUBLIC_SENTRY_DSN` in `.env` |
| FCM server key | Android push | ❌ upload via `eas credentials` |
| APNs p8 key | iOS push | ❌ upload via `eas credentials` |
| Apple Maps key | (not used today) | — |
| OpenWeather API key | (not used today — uses Open-Meteo free) | — |

---

## 7. Beta App Review (only if you want External TestFlight, not Internal)

Internal TestFlight = anyone in your Apple Dev team (up to 100 internal),
no review. **External TestFlight = unrelated people**, requires a quick
review (24-48h typical).

For External TestFlight submission you'll need to fill in:

- [ ] **Beta App Description** — what testers should focus on
  - Suggested: "Vasco is an AI-native admin app for construction trades.
    Beta testers: please walk through (1) creating a quote with the
    tiered builder, (2) capturing a job photo and watching AI extract
    line items, (3) sending an invoice from a completed job, (4) the
    offline → online sync flow with airplane mode toggled."
- [ ] **Test account credentials** — already documented in
      [`app-review-info.md`](./app-review-info.md) — paste those into
      the ASC review-info form
- [ ] **Beta feedback email** — `support@vasco.dev` or wherever you'll
      triage bug reports
- [ ] **Demo build URL or version** — auto-filled by EAS once submitted

---

## 8. Production App Store submission — gates only the public launch

After External TestFlight is comfortable, submit to App Store proper:

- [ ] **All §2 brand assets in place** (real icons, not placeholders)
- [ ] **All §3 screenshots uploaded** for at least 6.9" iPhone × 6 locales
- [ ] **All §4 store metadata reviewed by native speakers** and pasted
      into ASC
- [ ] **All §5 URLs verified live** and returning 200
- [ ] **All §6 production credentials configured** + verified via
      `docs/release-runbook.md` §4c "Endpoint-health check"
- [ ] **`docs/supabase-go-live.md` followed end-to-end** — migrations
      pushed, edge functions deployed, cron registered, idempotency
      keys set
- [ ] **App Privacy section** in ASC filled in — already documented in
      [`app-review-info.md`](./app-review-info.md) §"Data collection
      disclosure"
- [ ] **Age rating questionnaire** completed in ASC (suggested: 4+,
      no objectionable content)
- [ ] **Pricing + availability** chosen in ASC (Free with In-App
      Purchases; available NL/DE/FR/ES/IT/GB initially)

---

## What IS in the repo + IS ready

So you can plan: everything below is code-side done. No operator action.

- ✅ EAS project linked + production push tokens work
- ✅ Bundle ID `com.vasco.app` + iOS scheme `vasco` + Android associations
- ✅ iOS privacy manifest declared (4 APIs + 9 collected data types)
- ✅ `ITSAppUsesNonExemptEncryption: false` (skips export compliance)
- ✅ Camera + photo + Face ID usage strings declared in 6 locales
- ✅ Sentry plugin auto-registered (no-op when DSN unset)
- ✅ EAS submit.preview.ios + submit.production.ios configs ready with
      env-var placeholders
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
- ✅ 910/910 tests across 86 suites, 0 TS errors

---

## Quick-reference: which doc owns what

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

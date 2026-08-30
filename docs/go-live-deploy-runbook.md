# Vasco Go-Live Deploy Runbook (master sequence)

**One ordered checklist to take Vasco from "code done on `main`" to "live in
production + submittable to the App Store."** Execute top-to-bottom. Compiled
2026-07-15 from a full codebase audit.

> **Premise (audit finding, 2026-07-15):** there is **no missing feature work**.
> `app/` is 0 TS errors, no dev-URL leaks, demo-mode prod guard is solid. Every
> blocker below is **deployment / operator state**, not code. The master gate is
> that `main` is **98 commits ahead of `origin/main`** (0 behind) — production
> rides on origin, so nothing below is live until step 1.

Owner legend: **[dev]** = anyone with repo push + CLI, **[op]** = account owner
(Apple / Supabase / Stripe / DNS dashboards).

Cross-references (do not duplicate — follow the linked doc at that step):
- Portal security 3-part deploy ordering → [`security-deploy-2026-07.md`](./security-deploy-2026-07.md)
- Supabase project setup detail → [`supabase-go-live.md`](./supabase-go-live.md)
- Stripe billing + iOS link-out → [`go-live-checklist.md`](./go-live-checklist.md)
- iOS store submission → [`SHIP-READINESS.md`](./SHIP-READINESS.md) + [`testflight-checklist.md`](./testflight-checklist.md)

---

## Blocker summary (what's between here and live)

| # | Blocker | Severity | Owner | Gated by |
|---|---|---|---|---|
| 1 | 98 commits unpushed to `origin/main` | 🔴 master gate | [dev] w/ write | repo write access |
| 2 | Portal security fixes (HIGH leak) not deployed | 🔴 | [dev]+[op] | #1 |
| 3 | Supabase prod deploy (migrations/fns/cron) | 🔴 | [dev]+[op] | #1 |
| 4 | Auth email deliverability (custom SMTP) | 🔴 login-in-prod | [op] | — |
| 5 | Sentry DSN empty (no crash reporting) | 🟡 | [dev]+[op] | — |
| 6 | Live payment keys + Stripe billing setup | 🟡 revenue | [op] | — |
| 7 | iOS: screenshots + submit (ASC key revoked) | 🟡 App Store | [op] | — |

---

## Step 0 — Preflight (before any deploy) [dev]

```bash
npm run preflight            # full gate (TS, tests, listings, bundle)
npm run ota:preflight:fast   # must be GREEN before any eas update
npx tsc --noEmit | grep '^app/'   # expect empty
```
If any is red, stop and fix — do not deploy a red preflight.

---

## Step 1 — Push (MASTER GATE) [dev, needs write access]

```bash
git push origin main
```
`origin` is `github.com/vascoapp/Vasco`. Prior sessions noted `SammySam*`
**lacks write access** — this must run from an account with push rights, or land
the 98 commits via a PR from a write-enabled account. **Nothing downstream is
live until this succeeds.** Confirm:
```bash
git rev-list --left-right --count origin/main...HEAD   # want: 0  0
```

---

## Step 2 — Supabase database + edge functions [dev + op]

The portal security fix is a **3-part co-dependent deploy with a strict order**
(edge fn → web → migration) to avoid a broken window. **Follow
[`security-deploy-2026-07.md`](./security-deploy-2026-07.md) §"Portal fix" and
§"Step-by-step" exactly** — do not run `supabase db push` before the admin
redeploy (step 3) or you break live portal reads.

Quick shape (detail in that doc):
```bash
# 2a. Edge fns first (additive, breaks nothing)
supabase functions deploy sign-customer-upload   # NEW — required
supabase functions deploy daily-push-digest drain-account-deletions \
  send-invoice mollie-webhook stripe-webhook capture-lead ai-command tax-lookup send-sms
# 2b. (admin web redeploy happens in Step 3)
# 2c. Migrations LAST, after admin is live:
supabase db push          # applies 20260709* / 20260710* / 20260711000001..000004
```
[op] Confirm function secrets are set (per `supabase-go-live.md`):
`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY` **and** `STRIPE_API_KEY` (both —
webhook reads a different name), `STRIPE_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`,
`RESEND_API_KEY`, `MOLLIE_API_KEY`, `TWILIO_*`, `TAXJAR_API_KEY`.

[op] **pg_cron registration** (scheduled digests / pack-triggers / deletion drain):
```bash
# run supabase/cron.sql with a service-role connection, then verify:
# supabase/cron-health.sql  (or npm run check:endpoints)
```

---

## Step 3 — Web (admin + customer portal) on Vercel [op]

Redeploy `admin/` to Vercel. Set `NEXT_PUBLIC_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. This ships the customer portal `page.tsx` that
uses the new RPC + `sign-customer-upload` — **required before** the Step-2c
migration drops the old anon-SELECT policies (see security runbook ordering).

Confirm live (should all be 200 — verified 2026-07-15):
```bash
for u in https://vascobuild.com/support \
  https://admin.vascobuild.com/legal/privacy-policy \
  https://admin.vascobuild.com/legal/terms-of-service \
  https://admin.vascobuild.com/legal/eula; do
  echo "$(curl -s -o /dev/null -w '%{http_code}' -L "$u")  $u"; done
```

---

## Step 4 — Mobile OTA [dev]

```bash
eas update    # ships the JS-only fixes in the 98 commits (R7/R10/R13 etc.)
```
JS-only. A **native build** is only needed if native config changed
(it hasn't for this batch — see `SHIP-READINESS.md` §"What IS ready").

---

## Step 5 — Auth email deliverability [op] 🔴

The documented "login fails in production" root cause
(`memory/auth-login-testflight-blocker`). Without custom SMTP, signup/reset
emails hit spam and rate-limit (~2/hr).

1. Custom SMTP (Supabase → Project Settings → Auth → SMTP): point at
   Resend/Postmark/SES, sender **`Vasco` `noreply@vascobuild.com`**, with
   SPF/DKIM/DMARC DNS records on `vascobuild.com`.
2. Paste the 6 branded HTML templates from `supabase/email-templates/`
   (Authentication → Emails → Templates) + set NL subjects per its README.
3. Raise the auth rate limit after SMTP is custom.
4. Verify the `support@vascobuild.com` inbox actually **receives** (MX records) —
   it's also the App Store reviewer contact.

---

## Step 6 — Observability: Sentry DSN [dev + op] 🟡

Currently **empty** → no crash reporting on launch day. `.env` has the key blank
and `eas.json` production env does not set it.
```bash
eas secret:create --name EXPO_PUBLIC_SENTRY_DSN --value https://<dsn>@sentry.io/<id>
```
(The Sentry plugin is already registered and no-ops when unset — this just turns
it on. `SENTRY_AUTH_TOKEN` for sourcemap upload is handled by the build workflow.)

---

## Step 7 — Payments + subscription billing [op] 🟡 (revenue gate)

Not needed to *launch the app*, but needed before charging anyone. Follow
[`go-live-checklist.md`](./go-live-checklist.md) §1–2:
- Stripe: one Product + 4 recurring Prices (Pro/Contractor × monthly/yearly),
  enable **Stripe Tax**, activate **Customer Portal**, add the webhook endpoint
  (`stripe-webhook`) subscribed to the 6 events, copy `STRIPE_WEBHOOK_SECRET`.
- Set the `STRIPE_PRICE_*` secrets (Step 2 secret list).
- Live keys: `MOLLIE_API_KEY=live_…` (EU), `STRIPE_SECRET_KEY=sk_live_…` (UK/US).
- Verify end-to-end: `npm run check:endpoints` against prod.

---

## Step 8 — iOS App Store submission [op] 🟡

See [`SHIP-READINESS.md`](./SHIP-READINESS.md) + [`testflight-checklist.md`](./testflight-checklist.md).
Config/manifest/metadata/URLs are **ready**. Remaining:

1. **Screenshots** (only hard code-adjacent gate) — pipeline fully fixed & committed 2026-07-17
   (device-name resolution 07-15; bash-3.2 `case` + `JAVA_HOME` fix 07-17):
   ```bash
   curl -sL https://get.maestro.mobile.dev | bash     # install maestro (already installed)
   # Install a sim build with the PRODUCTION bundle id com.vascobuild.app on the 3 sims.
   # GOTCHA: the app must be com.vascobuild.app — a com.vasco.app build installs but the
   # capture script's install-guard silently skips it. Build fresh, don't reuse old DerivedData.
   xcrun simctl install <udid> /path/to/Vasco.app
   npm run capture:screenshots                          # 6.9"/6.5"/iPad × 6 locales
   ```
2. **Submit — ASC key `LAU7D8HU29` is REVOKED (401)**, so `eas submit` fails.
   Build `$0` locally and upload via **Transporter.app**:
   ```bash
   eas build --profile preview --platform ios --local
   # → open Transporter.app, sign in (Apple ID + 2FA), drag the .ipa, Deliver
   ```
   (Or regenerate the ASC key in App Store Connect → Users and Access →
   Integrations, update the 3 `eas.json` values, then `eas submit` works again.)
3. **Reviewer phone** — replace placeholder `+31655135577` in
   `fastlane/metadata/review_information/phone_number.txt` with a real number.
4. Upload metadata + screenshots: `bundle exec fastlane ios metadata` /
   `... screenshots` (or manually in App Store Connect).

---

## Post-deploy smoke tests

Run the full checklist in [`security-deploy-2026-07.md`](./security-deploy-2026-07.md)
§"Smoke tests" — critically:
- [ ] Portal loads, Q&A reply round-trips (~8s), photo upload attaches.
- [ ] **Leak closed:** anon `GET /rest/v1/customer_questions?select=tracker_access_token`
      → 0 rows / denied. Anon `list('customer-uploads')` → nothing.
- [ ] Quote→reject persists a Lead; Project survives cold reload; job→invoice persists.
- [ ] Real signup email arrives (not spam) + password reset link works (Step 5).
- [ ] A test payment reflects in the app (Step 7).

---

## TL;DR execution order

```
0. preflight (green)          [dev]
1. git push origin main       [dev, write access]   ← master gate
2. edge fns deploy            [dev+op]
3. admin redeploy on Vercel   [op]
4. supabase db push           [dev+op]              ← AFTER step 3 (portal order!)
5. eas update (OTA)           [dev]
6. custom SMTP + templates    [op]
7. Sentry DSN                 [dev+op]
8. Stripe/Mollie live keys    [op]
9. iOS screenshots + Transporter submit   [op]
→ smoke tests
```
Steps 5–9 are order-independent among themselves; steps 1→4 are strictly ordered.

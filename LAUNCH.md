# Vasco Launch Runbook

Last updated: 2026-05-02 (after R284 — semantic search live).
Single source of truth for everything that must be true before Vasco hits TestFlight + Play Store.

Status legend: ✅ done · ⚠️ partial · ❌ not started · ⏸ waiting on user

---

## 0. Snapshot

- Code: **main** of `https://github.com/VascoBuild/vasco`
- TypeScript: **0 errors**
- Jest: **596 / 596 passing** across 55 suites
- Supabase project: `gblhqhorkarocmputhte` (live; **all migrations pushed** as of R284)
- Edge functions deployed in repo: 22 (analyze-photo, churn-winback-email, classify-customer-question, create-subscription-checkout, daily-push-digest, draft-customer-reply, drain-account-deletions, embed-text, generate-embedding, grant-referral-credits, mollie-webhook, place-supplier-order, predict-duration, predict-price, send-invoice, send-push, sign-quote-token, stripe-webhook, train-extra-models, verify-quote-token, weekly-digest, weekly-retrain-models)
- Cron jobs: **0 registered** in production as of R293. `supabase/cron.sql` documents 9 schedules but pg_cron extension wasn't installed. Migration `20260502000002_enable_pg_cron.sql` (R293) enables it; cron.sql still needs a manual one-time run with real `SUPABASE_URL` + service-role JWT to register the 9 schedules.

---

## 1. Code-side launch readiness — ✅ done

Every item below is shipped. Do **not** redo.

| Layer | Status |
|---|---|
| Backend Supabase project linked + 50+ migrations pushed | ✅ |
| Demo-mode gating (`EXPO_PUBLIC_DEMO_MODE=false` in production) | ✅ |
| RLS policies + service-role grants on all intel tables | ✅ |
| 18 edge functions + 9 cron jobs | ✅ |
| Country registry (10 countries: NL/DE/FR/ES/IT/UK + SE/NO/DK/FI) | ✅ |
| 6 accounting integrations (Moneybird, Exact, e-Boekhouden, Lexoffice, DATEV, SevDesk) | ✅ |
| Mollie + Stripe wired (need live keys) | ✅ |
| 6 e-invoice formats (Peppol, XRechnung, ZUGFeRD, Factur-X, Facturae, FatturaPA) | ✅ |
| Inbound XRechnung/ZUGFeRD parser (DE B2B mandate) | ✅ |
| KOR + Kleinunternehmer VAT scheme rendering | ✅ |
| GoBD hash-chained audit trail with verify + export | ✅ |
| ICP-aangifte (NL intra-community supply declaration) | ✅ |
| VIES VAT validation + KvK + Handelsregister + UBO lookup | ✅ |
| Optimal scheduler (EU postcode-aware) wired into 3 surfaces | ✅ |
| Maintenance contracts UI + Vandaag widget | ✅ |
| Closed-loop intelligence (47 generators, 4 ML predictors, weekly retrain) | ✅ |
| Referral loop end-to-end (R229–R234) | ✅ |
| Subscription credit redemption (R234, behind feature flag) | ✅ |
| GDPR — consent gating on 231 trackEvent call sites + Art. 17 deletion drain cron | ✅ |
| Push notifications scaffolded (need APNs/FCM certs at submission) | ✅ |
| Per-route `error.tsx` for 5 route groups | ✅ |
| Skeleton loaders + a11y labels on Vandaag widgets | ✅ |
| Universal-link `apple-app-site-association` + `assetlinks.json` scaffolds | ✅ (placeholders) |

---

## 2. ⏸ Operational items — your action required

Items 2.1 through 2.6 must all be done before App Store / Play Store can accept the binary. They are sequential — don't skip ahead.

### 2.1 Live Mollie account (~30 min)

1. Sign up at https://my.mollie.com (free)
2. Complete KYC (passport + bank verification — 1-2 days for approval, can use test mode meanwhile)
3. Developers → API keys → copy **Test API key** first (`test_...`)
4. In Supabase dashboard → Project Settings → Edge Functions → Manage secrets:
   - Add `MOLLIE_API_KEY` = `test_...`
5. Once KYC approves: replace with `live_...` key
6. Developers → Webhooks → Add: `https://gblhqhorkarocmputhte.supabase.co/functions/v1/mollie-webhook`
7. **Test:** trigger a quote → "Pay online" link → completes in Mollie sandbox

### 2.2 Live Stripe account — UK (~20 min)

1. Sign up at https://stripe.com (UK only; Mollie covers EU)
2. Test mode immediately available; activate live with KYC later
3. Developers → API keys → copy `sk_test_...`
4. Developers → Webhooks → Add endpoint:
   - URL: `https://gblhqhorkarocmputhte.supabase.co/functions/v1/stripe-webhook`
   - Events: `payment_intent.succeeded`, `checkout.session.completed`, `customer.subscription.{created,updated,deleted}`
5. After creating, copy the signing secret (`whsec_...`)
6. In Supabase secrets:
   - `STRIPE_API_KEY` = `sk_test_...`
   - `STRIPE_WEBHOOK_SECRET` = `whsec_...`

### 2.3 Sentry signup + DSN (~10 min)

1. Sign up at https://sentry.io (free 5k events/mo)
2. Create new project → Platform: React Native
3. Copy the DSN (`https://...@sentry.io/...`)
4. In Supabase secrets:
   - `EXPO_PUBLIC_SENTRY_DSN` = the DSN string
5. Locally, in `.env`:
   ```
   EXPO_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
   ```
6. The `errorReporting.ts` wrapper already calls Sentry once the env var is set. Zero code changes needed.

### 2.4 Legal pages hosted (~30 min)

1. Pick a host: Cloudflare Pages, Netlify, or Vercel (all free for static)
2. Repo `docs/legal/` has `privacy.md` + `terms.md` (existing)
3. Convert to HTML or use a markdown-rendering host
4. Point a subdomain: `vasco.app/privacy` and `vasco.app/terms` (or whatever your domain is)
5. Update App Store Connect listing with these URLs (required field)

### 2.5 Universal-link cert fingerprints (~15 min)

1. **iOS:** in Apple Developer portal → your App ID → copy the **Team ID** (10-char alphanumeric)
2. Edit `public/.well-known/apple-app-site-association`:
   ```json
   { "appID": "<TEAMID>.com.vasco.app" }
   ```
3. **Android:** generate signing key SHA-256:
   ```bash
   keytool -list -v -keystore ~/.gradle/vasco-release.jks
   ```
   (Or use the EAS-managed cert; `eas credentials --platform android` shows it)
4. Edit `public/.well-known/assetlinks.json` — replace placeholder SHA-256 with the real fingerprint
5. Deploy `public/.well-known/*` behind your domain root (same host as 2.4)
6. **Verify:** `curl https://vasco.app/.well-known/apple-app-site-association` returns JSON with `application/json` content-type

### 2.6.5 Register cron jobs (~5 min) — REQUIRED, not yet done

Before submitting the app, register the 9 schedules so push digests, ML retrains, GDPR drain, churn winback, and referral credit grants actually fire:

1. Push the latest migrations (`supabase db push --include-all`) so `pg_cron` + `pg_net` are enabled (migration `20260502000002_enable_pg_cron.sql` from R293).
2. Open `supabase/cron.sql`, replace `<SUPABASE_URL>` (currently `https://gblhqhorkarocmputhte.supabase.co`) and `<SERVICE_ROLE_KEY>` (from Supabase dashboard → API → service_role).
3. Run the patched cron.sql once via `supabase db query --linked` or psql. Idempotent — safe to re-run.
4. Verify: `select jobid, schedule, jobname from cron.job order by jobname;` should return 9 rows.

Without this step every documented cron-driven feature is dormant: no daily push digest, no ML retraining, no churn winback, no GDPR Art. 17 deletion drain, no referral credit grants, no stale-draft cleanup, no generator approval-rate refresh, no weekly digest. The contractor sees increasingly stale ML predictions and never receives any cron-triggered communication.

### 2.6 EAS build → TestFlight / Play Store (~2 hours first time)

Prerequisites: Apple Developer account ($99/yr) + Google Play Console ($25 one-time).

```bash
cd "/Users/merle/Library/CloudStorage/GoogleDrive-ccollect.ai@gmail.com/Mijn Drive/Vasco/VascoApp"

# 1. Initialize EAS project (writes projectId into app.json)
eas init

# 2. Push the time-of-day-capture migration (only if not yet pushed)
supabase db push --include-all

# 3. iOS preview build → TestFlight
eas build --platform ios --profile preview
# Wait ~20 min. Once done:
eas submit --platform ios --profile production

# 4. Android internal track
eas build --platform android --profile preview
eas submit --platform android --profile production
```

5. App Store Connect:
   - Create app listing (use `docs/store-listings.md` for copy in EN/NL/DE)
   - Upload 6 screenshots × iPhone 6.7" (use any contractor-flow demo screenshot)
   - Set category: Business
   - Privacy nutrition facts: see `ios/PrivacyInfo.xcprivacy` (already authored R160)
6. Google Play Console:
   - Same listing copy
   - Upload AAB
   - Internal testing track first → invite 10 testers via email

---

## 3. Day-of-launch checklist

When all of section 2 is complete and the app is on real devices:

- [ ] Demo accounts (`contractor@vasco.dev`, etc.) still work in dev but are excluded from production builds (`EXPO_PUBLIC_DEMO_MODE=false`)
- [ ] First test: sign up a new account via real email → onboard 14 steps → create quote → send to a real email → mark paid
- [ ] Verify Mollie webhook fires (Supabase logs → `mollie-webhook` shows 200)
- [ ] Verify Stripe webhook fires
- [ ] Sentry receives a test exception (intentional `throw` somewhere → confirm in Sentry dashboard)
- [ ] Universal link from email opens app correctly (not browser)
- [ ] Push notification permission prompt fires after first job creation (not on launch)
- [ ] Compare DEMO_MODE off behavior: zero seed data visible

If any check fails, fix before opening to wider testers.

---

## 4. First 10 contractors plan

- Direct outreach via LinkedIn / trade groups / your network
- Free Pro tier for first 50 → the data they generate is worth more than the subscription
- Set up a Telegram or WhatsApp group for direct feedback in week 1
- Ask: "what would make you uninstall?" — the answer is the next priority list

---

## 5. Post-launch monitoring (week 1)

| Signal | Source | Threshold |
|---|---|---|
| Crash-free session % | Sentry | <99.5% = investigate |
| Edge function error rate | Supabase logs | >2% on any function = investigate |
| First-quote completion rate | analytics | <40% = onboarding friction |
| Push delivery rate | Expo dashboard | <90% = APNs/FCM cert issue |
| Time to first invoice paid | analytics | >7 days median = payment-flow friction |
| RLS leak alerts | Supabase RLS | any 401 on owned data = critical, page yourself |

---

## 6. Code-side follow-ups (post first 10 users)

In rough priority. Build only when justified by user feedback.

- ~~Stripe Coupon Option A~~ — wired R260 behind `STRIPE_COUPON_REDEMPTION`; awaits live Stripe creds to validate end-to-end
- ~~Time-of-day acceptance prediction surfaces in TieredQuoteBuilder~~ — wired R260 (quotes) + R261 (invoices)
- Snelstart + Twinfield (NL accounting) when first user requests
- Embedded insurance via Hokodo (revenue play)
- Optimize scheduling v2 with real Mapbox routing (not just postcode prefix)
- Per-country onboarding flow polish (auto-suggest VAT scheme from declared turnover)
- Customer churn risk classifier (skipped twice; revisit when retention data accrues)
- Worker app expansion beyond schedule + timesheet (only if multi-employee contractors land)
- **R285 — wire a real supplier API.** Scaffold landed (`src/integrations/supplierLiveApi.ts`). To activate: implement a `LiveSupplierClient` adapter, register it in `loadConfiguredClient()`, set `EXPO_PUBLIC_LIVE_SUPPLIER_API=1` and the provider's API key. Best first targets: Bouwmaat (NL — contractor account required), Hornbach Pro (DE — contractor account required), Rexel (NL/FR — has B2B XML feed). Until activated, `searchCatalog`/`comparePrices` keep using cohort baselines + scan history — the cohort moat itself works; only the per-supplier live price feed is missing.

---

## 7. Reference

- Repo: https://github.com/VascoBuild/vasco
- Supabase project: https://supabase.com/dashboard/project/gblhqhorkarocmputhte
- Production launch memory: `~/.claude/projects/.../memory/production-launch.md` (rolling round log)
- Architecture overview: `CLAUDE.md` (project root)
- 6-language i18n: `src/i18n/locales/{en,nl,de,fr,es,it}.json` (3,200+ keys each)
- Country registry: `src/data/countries.ts`

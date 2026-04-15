# Vasco Launch Checklist

Tracks everything required to publish Vasco to App Store + Google Play and enable live Supabase for EU6 markets.

## ✅ Done (autonomous — no credentials needed)
- [x] Root `tsconfig.json` scoped so `npx tsc --noEmit | grep "^app/"` is a reliable gate (0 errors).
- [x] Demo mode properly gated — `DEMO_MODE` false in prod blocks demo accounts.
- [x] Hardcoded `DEMO_PASSWORD` constant removed.
- [x] `MOCK_QUOTE` → real quote loader in customer-view (falls back to `DEMO_QUOTE` only when no `quoteId` param).
- [x] Mollie mock checkout gated behind `__DEV__` / `EXPO_PUBLIC_DEMO_MODE`; returns explicit error in prod.
- [x] Payment success URL → `EXPO_PUBLIC_PAYMENT_SUCCESS_URL` env var.
- [x] `npm audit`: 14 vulns → 5 (dev-only). xlsx replaced with SheetJS CDN build.
- [x] `app.json`: full iOS `infoPlist` (camera/photos/face id usage strings, `ITSAppUsesNonExemptEncryption`, CFBundleLocalizations), Android permissions + blocked permissions, `runtimeVersion` policy, `assetBundlePatterns`, notification/image-picker plugin configs.
- [x] `eas.json` scaffolded (dev, preview, production profiles; submit placeholders).
- [x] `.env.example` expanded with server-vs-client secret guidance + Sentry/legal/demo flags.
- [x] `.gitignore` updated (secrets/, google-services files, admin/.next).

## 🔐 User must provide credentials
- [ ] Run `npx eas init` after `eas login` — fills `expo.extra.eas.projectId` in `app.json`.
- [ ] Create live Supabase project (or unpause current). Provide URL + anon key in `.env`.
- [ ] Push all `supabase/migrations` in order via `supabase db push`. Regenerate types: `supabase gen types typescript --linked > src/types/supabase.ts`.
- [ ] Mollie: live OAuth app + webhook secret. Connect per-user via in-app OAuth.
- [ ] Stripe (UK market): publishable + secret keys, webhook secret. (Round 8 adds stub integration.)
- [ ] Sentry: create org + project, paste DSN into `EXPO_PUBLIC_SENTRY_DSN`.
- [ ] Push notifications: FCM server key (Android), APNs p8 key (iOS) — upload to Expo via `eas credentials`.
- [ ] App Store Connect: create app record, set bundle ID `com.vasco.app`, provide Apple Team ID + ASC App ID into `eas.json` submit block.
- [ ] Google Play Console: create app, generate service account JSON, save as `./secrets/play-service-account.json`.

## ✅ Rounds 5-22 complete (autonomous)
### Infrastructure (5-14)
- Round 5 — Legal/GDPR wiring (login footer, cookie banner, analytics consent gate)
- Round 6 — Sentry-ready error reporting (no-op until DSN provided)
- Round 7 — Push token persistence (`push_tokens` table + upsert on login, unregister on logout)
- Round 8 — Payment hardening: Stripe mock-gated like Mollie, webhooks production-ready
- Round 9 — `docs/store-listings.md`: App Store + Play Store copy in EN/NL/DE/FR/ES/IT
- Round 10 — Public legal pages served from admin (`/legal/[slug]`, `/privacy`, `/terms`)
- Round 11 — `supabase/README.md` + `npm run supabase:types / supabase:push / supabase:reset`
- Round 12 — `.github/workflows/ci.yml` (tsc + admin build + npm audit on every push)
- Round 13 — Feature flags: `feature_flags` table + `useFeatureFlag` hook + kill-switch
- Round 14 — `docs/release-runbook.md` (end-to-end ship sequence)

### Deep features + forecasting (73-80)
- Round 73 — Public quote portal consumes signed `verify-quote-token`
- Round 74 — SignaturePad SVG capture
- Round 75 — Job photo gallery screen
- Round 76 — `supabase/cron.sql` registration script
- Round 77 — WhatsApp Business templates + consent + `wa.me` deep-link
- Round 78 — Receipt PDF share-sheet flow
- Round 79 — Customer VIP tagging (LTV + on-time + freshness composite)
- Round 80 — 30-day cash-flow forecast using ML payment predictor

### Portal, admin, receipts, photos, digests, checklist (67-72)
- Round 67 — Signed quote portal tokens (HMAC, 90d TTL)
- Round 68 — Admin dashboard pulls real MRR + country breakdown
- Round 69 — Payment webhook fires receipt email + contractor push
- Round 70 — Job photo upload to `job-photos` bucket + `job_photos` table
- Round 71 — Weekly Monday-morning digest Edge Function
- Round 72 — Job completion checklist (per-trade required items)

### Server-side push + offline scans (65-66)
- Round 65 — `send-push` Edge Function fan-outs to Expo Push API with dead-token pruning
- Round 66 — `offlineScanQueue` with AsyncStorage + foreground flush

### Live function wiring (57-64)
- Round 57 — withTimeout on addCustomer / addQuote / addInvoice writes
- Round 58 — 3 generators emit enqueueHint (overdue, cert renewal, margin drift)
- Round 59 — vascoGuidance hook auto-enqueues hinted insights into the action queue
- Round 60 — invoiceScanService syncs scans to Supabase `scanned_invoices`
- Round 61 — aiQueueNotifier fires local push on first-time queue items
- Round 62 — business_settings extended with iban/bic/country/postcode/prefixes
- Round 63 — Vandaag AI queue already prioritized by onboarding prefs (confirmed)
- Round 64 — `npm run smoke:golden` CLI runner hits Supabase end-to-end

### Production polish (31-40)
- Round 31 — Stripe subscription webhook → `subscriptions` table sync
- Round 32 — Admin revenue dashboard driven by Supabase (`admin/src/lib/revenue.ts`)
- Round 33 — `A11yButton` wrapper for accessibility contract
- Round 34 — `npm run i18n:audit` (0 gaps across 6 locales)
- Round 35 — Notification plugin icon + androidMode
- Round 36 — `app/auth/callback.tsx` for Supabase reset/verify/magiclink
- Round 37 — `scanned_invoices` table + RLS (cross-device OCR history)
- Round 38 — Invoice PDF prints country-specific registration + VAT label
- Round 39 — `supabase/functions/_shared/ratelimit.ts`
- Round 40 — expo-doctor passes (scripts renamed, jest-expo pinned)
- Bonus — Legal screen compliance section filters by user.country (not all 6)

### Consistency, billing, review prep (23-30)
- Round 23 — Realtime multi-device sync for jobs/quotes/customers/documents
- Round 24 — Offline write queue (AsyncStorage) + foreground flush
- Round 25 — Deep linking (iOS associatedDomains, Android intentFilters, AASA/assetlinks endpoints)
- Round 26 — Unit tests: featureFlagService, offlineWriteQueue + CI job
- Round 27 — `create-subscription-checkout` Edge Function + `billingService`
- Round 28 — Maestro E2E smoke `.maestro/golden-path.yaml`
- Round 29 — Rate-limit + validated-insert on `customer_interactions`
- Round 30 — `docs/app-review-info.md` (App Store / Play Console paste-ready)

### Golden path & integrations (15-22)
- Round 15 — Quote accept → `convertQuoteToJob()` + `customer_interactions` table
- Round 16 — `send-invoice` Edge Function (Resend, EU6 HTML) + client wrapper wired
- Round 17 — Invoice payment realtime watcher → local push on `status=paid`
- Round 18 — `analyze-photo` Edge Function confirmed real (Claude Haiku Vision); prod mock fallback removed
- Round 19 — `EmptyState` on geld invoice + quote lists with CTAs
- Round 20 — Onboarding persists tier to `subscriptions` table
- Round 21 — XRechnung + Factur-X export buttons on invoice detail (DE/FR)
- Round 22 — Moneybird export is real end-to-end (find-or-create contact → POST invoice with tax-rate lookup)

## 📱 Store listing assets (user task)
- [ ] App Store screenshots: 6.7" iPhone (1290×2796), 6.5" iPhone, iPad 12.9" (for each EN/NL/DE/FR/ES/IT).
- [ ] Play Store screenshots (phone, 7" tablet, 10" tablet).
- [ ] Feature graphic (1024×500).
- [ ] App icon 1024×1024.
- [ ] Description copy per locale (short + long).
- [ ] Keywords per locale.
- [ ] Privacy policy + terms live at public URLs (configured via `EXPO_PUBLIC_PRIVACY_URL` / `EXPO_PUBLIC_TERMS_URL`).
- [ ] Support email, marketing URL.

## 🚢 Release process
1. `eas build --profile preview --platform all` → internal TestFlight / APK for QA.
2. `eas build --profile production --platform all` → signed binary.
3. `eas submit --profile production --platform ios` → App Store Connect.
4. `eas submit --profile production --platform android` → Play internal track.
5. Promote through closed → open testing → production.

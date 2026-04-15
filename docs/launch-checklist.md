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

## ✅ Rounds 5-14 complete (autonomous)
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

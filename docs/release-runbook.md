# Vasco Release Runbook

End-to-end steps to ship Vasco from repo → App Store + Play Store. Assumes
you have the credentials listed below.

> 📋 For a single-page "what's still missing per milestone" view see
> [`SHIP-READINESS.md`](./SHIP-READINESS.md). This runbook is the actual
> step-by-step command sequence once the credentials + assets are ready.
> For TestFlight Internal specifically, see [`testflight-checklist.md`](./testflight-checklist.md).

---

## R66r49 launch-readiness state (2026-05-09)

**Already done in repo** (no operator action needed):
- ✅ EAS project linked: `@collectai/VascoApp` id `eebc2577-cbf8-4252-9b6c-f91119c17b7d`. Skip §1's `eas init`.
- ✅ EAS Update URL: `https://u.expo.dev/eebc2577-cbf8-4252-9b6c-f91119c17b7d`. Already in `app.json:expo.updates.url`.
- ✅ All 4 R66r49 migrations pushed to remote DB (20260507000007 / 8 / 9 + 20260508000001).
- ✅ Edge functions deployed: 22 total as of R66r49 #8 (was 15 in R220), including the new `pack-trigger-tick` + `send-automation-preview`.
- ✅ `@sentry/react-native` installed + auto-registered as a config plugin in app.json. Just needs `EXPO_PUBLIC_SENTRY_DSN` to fire.
- ✅ Privacy manifest moved from un-registered `ios/PrivacyInfo.xcprivacy` to `app.json:expo.ios.privacyManifests` (Expo regenerates it on next prebuild and registers it correctly).
- ✅ Webhook idempotency on Mollie + Stripe (R41) — redeployed at v2 dated 2026-05-02.
- ✅ 749/749 tests across 72 suites + 0 TS errors at R66r49 #8 commit `2e4f312`.

**Still gating on operator action** (each is independent; pick any order):
1. Sign up Resend → `supabase secrets set RESEND_API_KEY=re_xxx`
2. Get prod Mollie + Stripe keys → `supabase secrets set MOLLIE_API_KEY=live_... STRIPE_API_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_... MOLLIE_WEBHOOK_SECRET=...`
3. Sign up Sentry → set `EXPO_PUBLIC_SENTRY_DSN` in `.env`
4. Apple Developer signup → fill `eas.json:submit.production.ios` with `appleId` / `ascAppId` / `appleTeamId`
5. Play Console signup → drop service-account JSON at `secrets/play-service-account.json`
   ⚠️ **Verified 2026-08-20: that file does not exist, `android.versionCode` is still 1, and no AAB has ever been built — Android has never shipped.** State + blockers: `memory/android-submission-status.md`. Also drop the unused `RECORD_AUDIO` permission from `app.json` before the data-safety form.
6. App Store Connect + Play Console listings (icons, screenshots ×6 locales, descriptions ×6 — see `docs/store-listings.md`)
7. Re-run `supabase/cron.sql` with substituted SUPABASE_URL + SERVICE_ROLE_KEY. **New entry in this round**: `vasco-pack-trigger-tick` (09:00 UTC daily — server-side eval of Incasso + Quote followup + Maintenance + Handover-survey packs)
8. Run `npx expo prebuild --clean` (regenerates `ios/`/`android/` to pick up the moved privacy manifest + Sentry plugin) **before** the first `eas build`
9. Live HTML for `vascobuild.com/privacy` + `vascobuild.com/terms` (URLs already in `.env` skeleton)

After items 1-9 are done: jump to §5 (preview build) — §0-§4 are covered.

---

## 0. Credentials you need

| Item | Where to get | Where it goes |
|---|---|---|
| Apple Developer account ($99/yr) | developer.apple.com | App Store Connect |
| Google Play Developer ($25 one-time) | play.google.com/console | Play Console |
| Expo account (free) | expo.dev | `eas login` |
| Supabase project | supabase.com | `.env` + `supabase link` |
| Mollie account | mollie.com | In-app connection flow |
| Stripe account (for UK) | dashboard.stripe.com | Admin settings |
| Sentry project | sentry.io | `EXPO_PUBLIC_SENTRY_DSN` |

## 1. One-time EAS setup

```bash
npm i -g eas-cli
eas login
eas init                              # creates project + fills app.json expo.extra.eas.projectId
eas credentials                       # upload APNs p8 + FCM server key
```

## 2. Supabase

```bash
npm i -g supabase
supabase login
supabase link --project-ref <your-ref>

# Apply migrations
npm run supabase:push

# Regenerate client types (do this after every schema change)
npm run supabase:types

# Set Edge Function secrets
supabase secrets set \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  MOLLIE_API_KEY=live_... \
  MOLLIE_WEBHOOK_SECRET=... \
  RESEND_API_KEY=re_... \
  ANTHROPIC_API_KEY=sk-ant-...

# Deploy all Edge Functions (22 total as of R66r49 #8).
# Safer than listing each one since the set grows over time.
for fn in supabase/functions/*/; do
  name=$(basename "$fn")
  [ "$name" = "_shared" ] && continue
  supabase functions deploy "$name"
done

# Register cron jobs (weekly-digest, stale-draft-cleanup,
# drain-account-deletions). Open supabase/cron.sql, replace the two
# placeholders (<SUPABASE_URL> + <SERVICE_ROLE_KEY>) and run it against
# the project DB via Dashboard → SQL Editor or `psql $PG_URL -f supabase/cron.sql`.
```

Then copy project URL + anon key into `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
EXPO_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
EXPO_PUBLIC_PRIVACY_URL=https://admin.vascobuild.com/legal/privacy-policy
EXPO_PUBLIC_TERMS_URL=https://admin.vascobuild.com/legal/terms-of-service
EXPO_PUBLIC_DEMO_MODE=false
```

## 3. Admin dashboard (Vercel)

```bash
cd admin
vercel link
vercel env add EXPO_PUBLIC_ADMIN_PIN  # production
vercel env add NEXT_PUBLIC_ADMIN_PIN  # preview
vercel --prod
```

Point `admin.vascobuild.com` DNS CNAME at the Vercel project. Privacy + terms
pages live at `/legal/privacy-policy` and `/legal/terms-of-service`.

## 4. Store listings (do once)

- **App Store Connect:** create app record, bundle ID `com.vascobuild.app`, category
  "Business", age rating 4+. Paste copy from `docs/store-listings.md`.
- **Play Console:** create app, set content rating questionnaire, data-safety
  form (we do NOT sell data; we DO collect: email, name, trade data). Paste copy.
- Upload screenshots (user task — see `docs/launch-checklist.md`).
- Upload app icon 1024×1024.
- Add privacy-policy URL: `https://admin.vascobuild.com/legal/privacy-policy`.
- Fill Apple Team ID + ASC App ID in `eas.json` submit block.
- Save Play service account JSON to `./secrets/play-service-account.json`.

## 4b. Pre-build sanity checks

```bash
npx tsc --noEmit                       # must be 0 errors project-wide
(cd admin && npx tsc --noEmit)         # must be 0 errors
npm test                               # full jest — all suites green (749 tests / 72 suites as of R66r49 #8)
npm run i18n:audit                     # all 6 locales aligned; exits non-zero if gaps
```

## 4c. Endpoint-health check (run after every deploy)

Asserts 2xx / allowed-4xx on every Edge Function + representative
RLS-protected reads + a couple of moat RPCs. Exit 1 on any 5xx or
unexpected status. Needs a real user JWT.

```bash
SUPABASE_URL=https://xxx.supabase.co \
SUPABASE_ANON_KEY=eyJ... \
TEST_USER_JWT=$(supabase auth ... )        # or grab from the app
npm run smoke:endpoints
```

Skips the three service-role / signed-webhook endpoints by default
(mollie-webhook, stripe-webhook, weekly-digest, drain-account-deletions).
Override via `SKIP_FUNCTIONS=name1,name2`.

## 5. Preview build (internal QA)

```bash
eas build --profile preview --platform all
# → TestFlight (iOS) + APK download link (Android)
```

Test on a real device. Verify: login, create job, create quote, send quote,
mark paid, offline behaviour, push notifications fire.

## 6. Production build + submit

```bash
eas build --profile production --platform all
eas submit --profile production --platform ios      # → App Store Connect
eas submit --profile production --platform android  # → Play internal track
```

Then in each console:
- **Apple:** TestFlight → external testing → submit for review.
- **Play:** internal → closed testing → open testing → production (gradual rollout 10 → 50 → 100%).

## 7. Post-launch monitoring (first 48h)

- [ ] Sentry dashboard: error rate < 1% of sessions.
- [ ] Supabase dashboard: DB CPU < 40%, no slow queries > 500ms.
- [ ] Mollie + Stripe: webhook delivery 100% success.
- [ ] App Store Connect: crash-free users > 99%.
- [ ] Admin `/admin` → Vasco Overview: signups, MRR, active markets.

## 8. Kill switch

If a feature misbehaves in production, toggle it off without a redeploy:

```sql
update public.feature_flags
set enabled = false
where key = 'payments_stripe_uk';
```

Clients pick it up within 30 minutes (or immediately on next foreground → cache TTL).

## 9. Hotfix release

1. Fix on `main`.
2. Bump `"version"` in `app.json` (semver patch).
3. `eas build --profile production --platform all --auto-submit`.
4. For JS-only fixes: `eas update --branch production --message "fix: ..."` (OTA).

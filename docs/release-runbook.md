# Vasco Release Runbook

End-to-end steps to ship Vasco from repo → App Store + Play Store. Assumes
you have the credentials listed below.

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

# Deploy all Edge Functions (15 total as of R220).
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
EXPO_PUBLIC_PRIVACY_URL=https://admin.vasco.app/legal/privacy-policy
EXPO_PUBLIC_TERMS_URL=https://admin.vasco.app/legal/terms-of-service
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

Point `admin.vasco.app` DNS CNAME at the Vercel project. Privacy + terms
pages live at `/legal/privacy-policy` and `/legal/terms-of-service`.

## 4. Store listings (do once)

- **App Store Connect:** create app record, bundle ID `com.vasco.app`, category
  "Business", age rating 4+. Paste copy from `docs/store-listings.md`.
- **Play Console:** create app, set content rating questionnaire, data-safety
  form (we do NOT sell data; we DO collect: email, name, trade data). Paste copy.
- Upload screenshots (user task — see `docs/launch-checklist.md`).
- Upload app icon 1024×1024.
- Add privacy-policy URL: `https://admin.vasco.app/legal/privacy-policy`.
- Fill Apple Team ID + ASC App ID in `eas.json` submit block.
- Save Play service account JSON to `./secrets/play-service-account.json`.

## 4b. Pre-build sanity checks

```bash
npx tsc --noEmit                       # must be 0 errors project-wide
(cd admin && npx tsc --noEmit)         # must be 0 errors
npm test                               # full jest — all suites green (259+ tests as of R219)
npm run i18n:audit                     # all 6 locales aligned; exits non-zero if gaps
```

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

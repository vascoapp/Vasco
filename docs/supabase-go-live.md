# Supabase Go-Live — Step-by-Step

Last updated: 2026-05-12 (R66r66)

Everything the app needs deployed on the Supabase side, in the exact order to
run it. Assumes you already have a Supabase project created at https://supabase.com/dashboard.

> 📋 For the cross-cutting "what's still missing per milestone" view see
> [`SHIP-READINESS.md`](./SHIP-READINESS.md). This doc owns the
> Supabase-side sequence only.

## 0. Prereqs (one-time, on your machine)

```bash
npm i -g supabase
supabase login          # opens browser → approve
```

Confirm with `supabase --version` → should print ≥ 1.x.

## 1. Link this repo to your project

From the repo root:

```bash
cd "VascoApp"
supabase link --project-ref <YOUR_PROJECT_REF>
```

`<YOUR_PROJECT_REF>` is the slug in your dashboard URL:
`https://supabase.com/dashboard/project/<THIS_PART>`.

It will ask for your database password (set during project creation — if you
lost it, reset under Settings → Database → "Reset database password").

## 2. Push all migrations

```bash
supabase db push
```

This runs every file in `supabase/migrations/` in chronological order, up to
the most recent: `20260424_subscription_credits_rpcs.sql`.

If it complains about conflicts, the project already has some of these
migrations from a prior push — run `supabase db push --include-all` to force, or
check the Supabase Dashboard → Database → Migrations to see what's already
applied.

## 3. Deploy all Edge Functions

```bash
supabase functions deploy analyze-photo
supabase functions deploy churn-winback-email
supabase functions deploy classify-customer-question
supabase functions deploy create-subscription-checkout
supabase functions deploy daily-push-digest
supabase functions deploy drain-account-deletions
supabase functions deploy grant-referral-credits
supabase functions deploy mollie-webhook --no-verify-jwt
supabase functions deploy place-supplier-order
supabase functions deploy predict-duration
supabase functions deploy predict-price
supabase functions deploy send-invoice
supabase functions deploy send-push
supabase functions deploy sign-quote-token
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy verify-quote-token
supabase functions deploy weekly-digest
```

`--no-verify-jwt` on the two webhooks is required — Mollie and Stripe don't
send Supabase JWTs, they authenticate via their own signatures (Mollie by
round-tripping to their API, Stripe via `stripe-signature` header, both already
implemented in the handlers).

## 4. Set secrets

Either via Dashboard (Project Settings → Edge Functions → Secrets) or CLI:

```bash
# Claude (AI)
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

# Resend (email)
supabase secrets set RESEND_API_KEY=re_...
supabase secrets set RESEND_FROM_EMAIL=noreply@yourdomain.com

# Expo Push
supabase secrets set EXPO_ACCESS_TOKEN=...   # optional, improves rate limits

# Mollie
supabase secrets set MOLLIE_API_KEY=live_... # or test_... for test mode

# Stripe
supabase secrets set STRIPE_API_KEY=sk_live_...  # or sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...

# Supabase (auto-present for Edge Functions, listed for completeness)
# SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY — injected automatically
```

`RESEND_API_KEY` is used by `send-invoice`, `churn-winback-email`,
`drain-account-deletions`. `EXPO_ACCESS_TOKEN` is used by `send-push` and the
daily digest. Without Mollie/Stripe keys, payment webhooks will log-and-skip
(they won't crash).

## 5. Register cron jobs

Open the SQL Editor in the Dashboard (Project → SQL → New query) and paste the
contents of `supabase/cron.sql`, first replacing both placeholders:

- `<SUPABASE_URL>` → your project URL, e.g. `https://abcd1234.supabase.co`
- `<SERVICE_ROLE_KEY>` → the service_role JWT from Project Settings → API

Run it. Then verify:

```sql
select jobname, schedule, active from cron.job;
```

Should list 6 jobs:
- `vasco-weekly-digest` — Mondays 08:00 UTC
- `vasco-stale-draft-cleanup` — daily 03:00 UTC
- `vasco-drain-account-deletions` — daily 02:00 UTC
- `vasco-daily-push-digest` — daily 18:00 UTC
- `vasco-churn-winback` — Mondays 10:00 UTC
- `vasco-grant-referral-credits` — daily 04:00 UTC

## 6. Configure webhooks in provider dashboards

**Mollie** (https://my.mollie.com → Developers → Webhooks):
- URL: `https://<YOUR_PROJECT>.supabase.co/functions/v1/mollie-webhook`
- Events: all payment events (Mollie doesn't do granular event selection — they fire on any status change)

**Stripe** (https://dashboard.stripe.com → Developers → Webhooks → Add endpoint):
- URL: `https://<YOUR_PROJECT>.supabase.co/functions/v1/stripe-webhook`
- Events to send:
  - `payment_intent.succeeded`
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- After creation, copy the "Signing secret" (`whsec_...`) and set it as
  `STRIPE_WEBHOOK_SECRET` via step 4 if you haven't already.

## 7. Configure Storage buckets

In Dashboard → Storage, create these buckets if they don't exist:

| Bucket | Public | Purpose |
|---|---|---|
| `job-photos` | false | Contractor before/after photos |
| `customer-uploads` | false | Photos customers attach to decision requests |
| `quote-attachments` | false | Files attached to outbound quotes |
| `invoice-pdfs` | false | Generated invoice PDFs |

RLS policies on each bucket are in `supabase/migrations/*_storage_*.sql` and
auto-apply on `db push`.

## 8. Configure auth email templates

Dashboard → Authentication → Email Templates — customize:
- Confirm signup
- Reset password
- Magic link (if enabled)

The redirect URL in all three should be your production domain + the app scheme:
- For magic link / reset: `https://yourapp.com/reset-password?token={token}`
- For confirm signup: `https://yourapp.com/auth/callback?token={token}`

Both routes exist in the app (`app/reset-password.tsx`, `app/auth/callback.tsx`).

## 9. Enable universal links

Replace placeholder values in:
- `public/.well-known/apple-app-site-association` → set `appID` to `<TEAMID>.com.vascobuild.app`
- `public/.well-known/assetlinks.json` → set `sha256_cert_fingerprints` to your Play signing cert SHA-256

Deploy `public/` behind `yourapp.com` (Cloudflare Pages / Netlify / whatever
static host). Confirm with:
- iOS: `curl https://yourapp.com/.well-known/apple-app-site-association` → must return JSON with `Content-Type: application/json`
- Android: `curl https://yourapp.com/.well-known/assetlinks.json`

## 10. Smoke-test the harness

```bash
# From the repo root
EXPO_PUBLIC_SUPABASE_URL=https://<YOUR_PROJECT>.supabase.co \
EXPO_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY> \
TEST_USER_EMAIL=<a real demo user email> \
TEST_USER_PASSWORD=<their password> \
node scripts/endpoint-health.mjs
```

All green = ready to submit to stores.

---

## What's NOT automated (still needs human judgement)

- **Billing credit redemption at renewal** — see `docs/billing-integration.md`.
  Primitives are ready; choose Option A or B when you have live Stripe creds
  and can test against Stripe test mode.
- **Sentry** — set `EXPO_PUBLIC_SENTRY_DSN` in `app.config.ts` extra + run `npx expo install @sentry/react-native`. The wrapper in `src/lib/sentry.ts` no-ops until the DSN is set.
- **App Store / Play Store listings** — `docs/store-listings.md`.
- **Legal docs hosted at /privacy and /terms** — `docs/legal/` has the content, needs a host.

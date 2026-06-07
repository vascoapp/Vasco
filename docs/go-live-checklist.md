# Vasco Go-Live Checklist (web-only billing, iOS link-out)

Decision (2026-05-31): subscriptions are sold on the **web** (Stripe), the iOS app
**links out** to that web checkout via the StoreKit External Purchase Link API.
No Apple In-App Purchase. Customer invoice/deposit payments are unaffected.

---

## 1. Stripe setup (operator — do this in the Stripe Dashboard)

### a. Products & prices
Create one Product with 4 recurring Prices (the edge fn maps tier×cycle → price ID):

| Tier        | Monthly                         | Yearly                          |
|-------------|---------------------------------|---------------------------------|
| Pro (€39)   | `STRIPE_PRICE_PRO_MONTHLY`       | `STRIPE_PRICE_PRO_YEARLY`        |
| Contractor (€69) | `STRIPE_PRICE_CONTRACTOR_MONTHLY` | `STRIPE_PRICE_CONTRACTOR_YEARLY` |

Currency EUR (the checkout collects billing address → Stripe Tax handles per-country VAT).

### b. Enable Stripe Tax
Dashboard → Settings → Tax → enable. Required: EU B2C SaaS owes VAT in the buyer's
country (OSS). The checkout already sets `automatic_tax`, `billing_address_collection:
required`, and `tax_id_collection` (B2B reverse-charge) — it just needs Tax switched on.

### c. Customer Portal
Dashboard → Settings → Billing → Customer portal → activate. Enable: update payment
method, cancel, switch plan, invoice history. (EU consumer law requires a reachable
cancel path — this is it. `create-billing-portal-session` opens it.)

### d. Webhook endpoint
Add endpoint → `https://<project>.supabase.co/functions/v1/stripe-webhook`
Subscribe to these events (all consumed by the function):
- `checkout.session.completed`
- `customer.subscription.created` / `.updated` / `.deleted`
- `invoice.payment_failed`  (dunning → past_due)
- `invoice.upcoming`        (referral-credit coupon, optional feature)
- `payment_intent.succeeded` (invoice + tracker-deposit payments)
Copy the signing secret → `STRIPE_WEBHOOK_SECRET`.

### e. (Optional) referral-credit coupon
If using referral free-months as Stripe coupons: create the coupon, set
`STRIPE_COUPON_REDEMPTION=true` and `STRIPE_COUPON_ID`.

---

## 2. Supabase function secrets (operator)

`supabase secrets set KEY=value` for each, then deploy.

| Secret | Used by | Notes |
|--------|---------|-------|
| `STRIPE_SECRET_KEY` | checkout + portal fns | live `sk_live_…` |
| `STRIPE_API_KEY`    | **stripe-webhook**   | ⚠️ SAME value as above — webhook reads a *different* env name. Set BOTH or referral coupons break. |
| `STRIPE_WEBHOOK_SECRET` | stripe-webhook | from step 1d |
| `STRIPE_PRICE_PRO_MONTHLY` / `_PRO_YEARLY` / `_CONTRACTOR_MONTHLY` / `_CONTRACTOR_YEARLY` | checkout | from step 1a |
| `STRIPE_SUCCESS_URL` / `STRIPE_CANCEL_URL` | checkout | optional; default `vascobuild.com/billing/{success,cancel}` |
| `STRIPE_PORTAL_RETURN_URL` | portal | optional; default `vascobuild.com/billing` |
| `STRIPE_COUPON_REDEMPTION` / `STRIPE_COUPON_ID` | webhook | optional referral feature |

Deploy: `supabase functions deploy create-subscription-checkout create-billing-portal-session stripe-webhook mollie-webhook`

Build the web pages the URLs point at (success / cancel / billing landing / `/billing/upgrade?country=` — the iOS link-out target). The upgrade page should call `create-subscription-checkout` (or a public variant) and redirect to Stripe.

---

## 3. Apple — External Purchase Link program (operator, takes days)

1. App Store Connect → Agreements → accept the **EU alternative business terms**
   (required for external purchase links in the EU; note Apple's Core Technology Fee
   + Store Services Fee apply even to web purchases).
2. Request the entitlement `com.apple.developer.storekit.external-purchase-link`
   for your regions (EU + US). Apple reviews/approves per region.
3. Once granted, regenerate provisioning profiles so the entitlement is in the profile.

Already done in code (`app.json`):
- `ios.entitlements["com.apple.developer.storekit.external-purchase-link"] = true`
- `ios.infoPlist.SKExternalPurchaseLink` → per-country `vascobuild.com/billing/upgrade?country=…`
  (nl/de/fr/es/it/us — **UK omitted**: not covered by DMA, link-out is still against
  guidelines there; sell UK on web only, keep iOS UK on free tier or silent).

---

## 4. iOS native module (dev — needed before the link-out actually shows the disclosure sheet)

`billingService.openCheckoutUrl` calls a native StoreKit `ExternalPurchaseLink.open(url)`
via `globalThis.__VascoExternalPurchaseLink` if present, else falls back to `Linking.openURL`.
Build an Expo config plugin + a tiny Swift module (iOS 17.4+) that:
- calls `ExternalPurchaseLink.open(url:)` (presents Apple's required disclosure sheet)
- registers itself on `global.__VascoExternalPurchaseLink`
Ship it in a **new native build** (not OTA — entitlement + native code change).
Until then the fallback works for Android + TestFlight internal testing.

---

## 5. Standard deploy steps (queued — independent of billing)

- `git push` `main` — only an account with write to `vascoapp/Vasco` can (SammySam/SammySamEU can't). Commit the current working tree (R310 webhooks + R311 i18n) first.
- `eas update` — ships mobile JS/OTA (preflight GREEN).
- `supabase db push` — migration `20260530000001` (Q&A realtime + tracker payment cols).
- Deploy **admin** on Vercel + set `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` → makes the
  web customer portal **and** the web subscription checkout live.

---

## 6. Supabase auth emails (operator — Dashboard, ~20 min)

The default Supabase auth emails are unbranded plain text from
`noreply@mail.app.supabase.io` — they read as spam and are rate-limited to ~2/hour.
Branded HTML templates are ready in **`supabase/email-templates/`** (see its README
for the exact table of template → subject).

1. Dashboard → **Authentication → Emails → Templates**: paste each of the 6 HTML
   files (confirm signup, reset password, magic link, change email, invite,
   reauthentication) + set the NL subjects from the README.
2. **Custom SMTP** (Project Settings → Auth → SMTP): point at Resend/Postmark/SES
   with a verified `vascobuild.com` sender + SPF/DKIM/DMARC DNS records.
   Sender name **`Vasco`**, address `noreply@vascobuild.com`.
3. Raise the email rate limit (Auth → Rate Limits) after SMTP is custom.

Without step 2 the templates help, but deliverability stays poor — the sender
domain is the main spam signal.

---

## Critical path summary
Go-live blockers, in order: (1) Stripe products+secrets+webhook+Tax+portal,
(2) web checkout pages incl. `/billing/upgrade`, (3) deploy admin+functions+push+OTA.
The iOS link-out (Apple entitlement + native module, §3–4) can trail behind a
first **Android + web** launch — that path needs zero Apple approval.

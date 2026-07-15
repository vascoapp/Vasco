# Vasco Launch Smoke Test — the core-loop gate

**Purpose:** prove the one loop that matters works end-to-end on **production**,
with a **fresh real account** (not demo mode). If this passes, Vasco is
launchable for a solo contractor. If any ❌ step fails, it's a launch blocker.

Run it three ways — it's the same script:
1. **You**, before flipping public — as the go/no-go gate.
2. **A design-partner contractor** — watch them, don't coach. Where they hesitate = your real backlog.
3. **Apple reviewer** — the < 3-min walkthrough (demo creds in `app-review-info.md`).

> Scope: **NL, solo contractor, one trade.** Don't test aannemer / site-lead /
> US / 6 locales here — that breadth is post-launch. One persona, one country.

---

## Pre-req: environment is real, not demo

- [ ] Build is the **production** profile (`EXPO_PUBLIC_DEMO_MODE=false`).
- [ ] Prod Supabase project is **ACTIVE_HEALTHY** (not paused).
- [ ] Migrations applied (`supabase db push` done) + edge fns deployed.
- [ ] Custom SMTP live (or you'll fail step 2 on email delivery).

---

## The loop (10 steps — the whole business in one pass)

| # | Step | Pass criteria | Instrumented event |
|---|------|---------------|--------------------|
| 1 | **Sign up** with a brand-new real email | Account created; no crash | `signup` |
| 2 | **Confirm email** — open the real inbox | Confirmation email arrives **in inbox, not spam**, link opens the app | — |
| 3 | **Onboard** — business details, trade, country=NL | Reaches home (Vandaag) with empty state | `onboarding_step` |
| 4 | **Create a customer** | Persists; visible after a **cold app restart** | — |
| 5 | **Build a quote** (tiered) and **send** it | PDF renders; share sheet opens | `quote_created`, `quote_sent` |
| 6 | **Customer accepts** (open the quote/portal link on another device) | Contractor sees it as accepted | `quote_accepted` ⚠️ *(see gaps)* |
| 7 | **Convert to invoice** and **send** | Invoice PDF correct (VAT, seller info); share works | `invoice_created`, `invoice_sent` |
| 8 | **Get paid** — pay via the Mollie/Stripe link *or* long-press → Mark as paid | Invoice flips to **paid**; toast confirms | `payment_received` |
| 9 | **Customer portal** — open the decision/portal link as the customer | Loads; Q&A reply round-trips; photo upload attaches | — |
| 10 | **Cold restart** the app | Everything from steps 4–8 is still there (persisted, not just React state) | — |

**The single number that matters:** did a fresh account get from **step 1 → step 8**
(signup → got paid) without you intervening? That's activation. Everything else is detail.

---

## Verify it was actually recorded (not just shown on screen)

After the run, confirm the funnel events reached prod (they persist to
`analytics_events` via batch flush):

```sql
-- Run in Supabase SQL editor (service role):
select name, count(*), max(created_at)
from analytics_events
where created_at > now() - interval '1 hour'
group by name order by 2 desc;
```
- [ ] You see `signup`, `quote_sent`, `invoice_sent`, `payment_received` rows.
- [ ] If a row is missing, the event didn't fire OR flush didn't run → instrumentation gap, fix before relying on funnel data.

> ⚠️ **Known visibility gap:** the admin dashboard reads with the anon key and
> currently **can't read `analytics_events`** (see `audit-2026-07-findings`).
> Until that's fixed, query the funnel via the SQL editor above, not the admin UI.

---

## Instrumentation gaps found 2026-07-15 (funnel coverage)

Wired this session:
- ✅ `signup` — now fires on account creation (`AuthContext.signUp`).
- ✅ `payment_received` — now fires on `markInvoicePaid` (both manual mark-paid
  AND Mollie/Stripe webhook-driven payments route through it).

Still open (lower priority):
- ⚠️ `quote_accepted` — declared in the `EventName` union but **not fired** yet.
  Wire it where a quote flips to accepted (customer portal accept + manual
  status change) to close the mid-funnel measurement.
- ⚠️ `analytics_events` not readable from admin (anon-key model) — use SQL editor.

---

## If you only have 60 seconds (the reviewer / demo path)

Demo mode (`contractor@vasco.dev` / any password) → Vandaag → Geld → open an
invoice → View & share PDF → long-press → Mark as paid. Confirms the money
surface renders without needing a real payment provider.

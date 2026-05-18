# Beta App Description — External TestFlight

R66r68 (2026-05-12). Paste-into-ASC for the External Testing → Build
information form. Gets the build past Apple's quick "Beta App Review"
(usually 24-48h).

> ⚠️ **DRAFT.** Brand team may want to tighten tone before submission.
> All copy here is operator-functional, not marketing.

---

## What to test (4000 chars max — used in External Tester invite email)

```
Vasco is an AI-native admin app for construction trades — plumbers,
electricians, carpenters, painters, and small renovation contractors
across NL/DE/FR/ES/IT/UK.

For this beta, please walk through 4 hero flows and tell us where it
feels broken, slow, or confusing.

1. CREATE A TIERED QUOTE
   - Tap Werk → "Nieuwe offerte"
   - Pick a customer (or add one), pick services from the pricebook
   - Tap "Preview" to see the Good / Better / Best tier preview cards
   - Send via WhatsApp/email; customer accepts on their phone

2. PHOTO → QUOTE
   - Tap "Photo" on the new-quote flow
   - Take a photo of a real job site (a leaky tap, a fuse box, a wall
     that needs painting)
   - AI extracts line items in 5-10 seconds
   - Edit any lines that look wrong — your edits train the model

3. INVOICE + PAYMENT
   - From a completed job, tap "Create invoice"
   - Tap "Share PDF" — verify the invoice renders with your KvK/VAT
     info correctly
   - Tap "Add payment link" — should generate a Mollie/Stripe checkout
     URL

4. OFFLINE → ONLINE SYNC
   - Turn airplane mode ON
   - Create a quote — note the Q-OFF-XXXXXX placeholder number
   - Turn airplane mode OFF
   - Wait 10 seconds — the placeholder swaps to the canonical Q0008-
     style number, no error toast

WHAT TO REPORT
- Any crash (we collect via Sentry if you've allowed analytics)
- UI text in the wrong language
- Currency shown in wrong symbol (€ vs £)
- Buttons that don't do anything
- Anything that looks unfinished or "demo-y"

EMAIL bugs to support@vascobuild.com. Include the build number from
Profile → About (top of the screen).

DEMO MODE: this build runs with mock data so you can test without
connecting Mollie / Moneybird / Supabase. All payment + accounting
integration screens open but every action simulates success.
```

(Character count: ~1700 — well under the 4000 limit.)

---

## App Review Information form fields

### Demo account
- **Email:** `contractor@vasco.dev`
- **Password:** `review` (any non-empty string works in demo mode)
- **Notes for reviewer:** see `docs/app-review-info.md` §3-minute walkthrough

### Beta feedback email
`support@vascobuild.com`

### Beta App Review submission contact
(operator's real email — placeholder `support@vascobuild.com`)

### "Beta App Review notes" field (700 chars)

```
This build uses EXPO_PUBLIC_DEMO_MODE=true so reviewers can exercise
all flows without connecting real payment providers. Mollie, Stripe,
Moneybird, DATEV, and Lexoffice integration buttons all open OAuth
screens but simulate success. No real money moves.

Reviewer login: contractor@vasco.dev / any password.

The app supports 6 EU languages (EN, NL, DE, FR, ES, IT) switchable
via Profile → Language. Default depends on device locale.

If anything errors with "Could not connect", that's the demo mode
catching itself — re-launch the app to retry.

Privacy: vascobuild.com/privacy. EU datacenters only.
```

---

## What's New for the External tester email

```
v1.0 (Build 1) — First TestFlight beta

Welcome to Vasco. This is the build we'd like you to test:

- Tiered quotes (Goed / Beter / Best) customers accept from their phone
- AI photo → invoice scanner with line-item extraction
- Mollie + Stripe payment links across 6 EU countries
- EVE — 3 AI agents that prepare your work for one-tap approval
- Offline-first: works on site without signal, syncs on reconnect
- Full GDPR: in-app export + delete

Known limitations:
- App icon + screenshots are placeholders pending brand-team final art
- Sentry crash reporting only fires if you opt in via the consent banner
- Live Mollie/Stripe billing is gated behind real account keys
  (this build runs in demo mode — all payment flows simulate success)

Bug reports + feedback: support@vascobuild.com — please include the build
number from Profile → About.
```

(Send this in the External Testing → Builds → "Add internal/external
testers" → Test Information section.)

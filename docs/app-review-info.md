# App Review Information

Paste these values into App Store Connect → App Information → App Review and
Google Play Console → App Content → App access.

## Demo account

Because Vasco requires contractors to connect their real Mollie / Moneybird /
payment provider before most flows work, reviewers should use the built-in
demo mode, which seeds realistic data and gates the entire payment stack
behind deterministic mock responses.

Build for review: `preview` profile (`EXPO_PUBLIC_DEMO_MODE=true`).

**Demo credentials** (accept any non-empty password in demo mode):
- Email: `contractor@vasco.dev`
- Password: `review` *(any non-empty string works)*

Additional personas available if reviewer wants to test other flows:
- `aannemer@vasco.dev` — multi-trade renovation GC
- `site@vasco.dev` — site lead (enterprise view)
- `new@vasco.dev` — fresh user with empty state + onboarding

## What to test (< 3 minutes)

1. **Launch** → tap `contractor@vasco.dev` → any password → **Sign in**.
2. **Vandaag** (home) → scroll to see today's jobs, schedule, Vasco AI card.
3. **Geld** → **Offertes** → tap **Nieuwe offerte** → tiered quote builder loads (no submission required).
4. **Geld** → any invoice row → **View & share PDF** → confirm PDF renders.
5. Long-press invoice row → **Mark as paid** → toast confirms.

Everything labelled "Connect Mollie", "Connect Stripe", "Export to Moneybird"
etc. leads to an OAuth-style connection screen — reviewers can skip these;
all payment flows simulate success in demo mode.

## Data collection disclosure (Apple)

| Category | Linked to user? | Used for tracking? |
|---|---|---|
| Contact info (email, phone) | Yes | No |
| Financial info (invoices, revenue) | Yes | No |
| Identifiers (user id) | Yes | No |
| Usage data (analytics) | Opt-in only | No |
| Diagnostics (crash logs, Sentry) | Yes, when opt-in | No |

Vasco **does not** collect: location, contacts, browsing history, search
history, health/fitness data, sensitive info.

Vasco **does not use** any third-party ad networks. No tracking frameworks
(AppTrackingTransparency prompt not required).

## Age rating

- **Apple 4+** — Business utility, no user-generated content visible to others.
- **Google PEGI 3 / ESRB Everyone** — Same rationale.

## Sign-in options

- Email + password (Supabase auth).
- No "Sign in with Apple" required per Apple's guidelines because Vasco does
  not offer any third-party social logins.

## Support contacts

- Marketing URL: https://vasco.app
- Support URL: https://vasco.app/support
- Privacy policy: https://admin.vasco.app/legal/privacy-policy
- EULA: https://admin.vasco.app/legal/eula
- Support email: support@vasco.dev
- Review question contact: review@vasco.dev

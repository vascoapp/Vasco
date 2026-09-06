# Auth / Login Fix Runbook

**Problem:** Login features don't work in TestFlight (prod build, `DEMO_MODE=false`).
**Root cause:** NOT code, NOT the IPA. Real accounts require email (signup confirm + password
reset), and Supabase auth emails currently don't deliver — no custom SMTP + no SPF/DKIM/DMARC on
`vascobuild.com`, so Gmail/Outlook spam-drop them and Supabase's default sender is rate-limited.

Project ref: `gblhqhorkarocmputhte` · Domain: `vascobuild.com` · Team: `3DX8FBF7S6`

---

## ✅ Verified already correct (no action needed)

| Item | Status |
|---|---|
| Auth code (`login.tsx`, `AuthContext.login/signUp`, forgot-password) | clean, no bug |
| Supabase env on EAS production (URL + anon key) | present → `isSupabaseConfigured=true` in build |
| 6 branded email templates | correct Go-template vars (`{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .Email }}`) |
| `scripts/configure-auth-emails.mjs` | dry-run valid, emits correct management-API payload |
| iOS universal link (`apple-app-site-association`) | appID `3DX8FBF7S6.com.vascobuild.app` + `/auth/callback*` ✅ |
| App + web callback handlers | `app/auth/callback.tsx` (R107 fragment parse) + admin web fallback ✅ |
| `app.json` buildNumber | synced to 36 (matches `vasco-ios-build36.ipa`) — committed `ba52302` |

**Known non-blocking gap:** `assetlinks.json` has placeholder Android SHA-256 fingerprints
(`REPLACE:WITH:...`). Affects Android deep-linking only; iOS unaffected. Fix before Android launch:
`eas credentials --platform android` (EAS upload cert) + Play Console App-integrity page (Play cert).

---

## OPTION A — Quick unblock (beta testing today, ~2 min, no DNS)

Supabase Dashboard → **Authentication → Providers → Email** → turn **OFF** "Confirm email" → Save.
Then "Create account" logs straight in — test login in the current TestFlight build, no re-upload.
Also set URL config (Option B step 4) so links resolve when you re-enable confirmation later.
⚠️ Beta only — re-enable "Confirm email" before public launch.

---

## OPTION B — Full deliverability (launch-grade). 3 credential steps are yours; the apply is mine.

> ✅ **Steps 1 and 2 were COMPLETED 2026-09-05.** Resend account `vasco.app.eu@gmail.com`,
> domain `mail.vascobuild.com`, region Ireland (eu-west-1). DKIM/SPF/MX are live and
> verified against `braelyn.ns.cloudflare.com`. What remains is the API key, the SMTP
> apply (step 4) and the DMARC correction noted below. See
> `memory/resend-email-golive.md` for the full picture.

### Step 1 — Resend (you, ~5 min)
1. Create account at resend.com → **Add Domain** → `mail.vascobuild.com`.
   The subdomain is not merely "nicer" — the root already carries
   `v=spf1 include:simplelogin.co ~all` for live SimpleLogin forwarding, and a domain may
   have only ONE SPF record, so the root would need a hand-merge.
2. Copy the account-specific DKIM/SPF/MX records Resend shows.
   ⚠️ **Resend already writes the names relative to the ZONE** (`send.mail`,
   `resend._domainkey.mail`) — do NOT append `.mail` or `.vascobuild.com` yourself.
   ⚠️ **Every value cell in Resend's table IS a copy button** — click the text, don't
   retype. The DKIM value is 216 base64 characters and one wrong character fails silently.
   ⚠️ **Ignore the "Enable Receiving" MX** (`mail` → `inbound-smtp.…amazonaws.com`).
   Vasco only sends. The MX you want is under *Enable Sending*: `send.mail` →
   `feedback-smtp.<region>.amazonses.com`.
   ⚠️ Resend's **Auto configure** button did nothing when tried on 2026-09-05 — it is a
   plain form submit that failed silently. Budget for adding the records by hand.
3. Resend → SMTP tab → grab `SMTP_USER=resend` + `SMTP_PASS=re_...` (API key).

### Step 2 — DNS at Cloudflare (you)
Add Resend's DKIM/SPF/MX records, **and correct the DMARC record that already exists**.

> 🔴 **`vascobuild.com` is ALREADY at `p=quarantine`.** The "start at p=none and tighten
> later" advice that used to be here was wrong — there is no monitoring grace period, and
> the record in place has two faults: no `rua=` (enforcing blind) and `aspf=s`, which
> Resend can **never** satisfy because its bounce domain is `send.mail.vascobuild.com`,
> not an exact match for the From domain. Mail still passes DMARC on DKIM alone, but with
> no SPF fallback.

| Type | Host | Value |
|---|---|---|
| TXT | `_dmarc.vascobuild.com` | `v=DMARC1; p=quarantine; pct=100; adkim=s; aspf=r; fo=1; rua=mailto:dmarc@vascobuild.com` |

`adkim=s` stays — Resend signs `d=mail.vascobuild.com`, an exact match.
If the record refuses to save, check **Email → DMARC Management** in the Cloudflare
sidebar: when that feature is on it owns `_dmarc` and makes it read-only in DNS Records.

DMARC is **not** required for Resend to verify — it checks DKIM/SPF/MX only. Don't stall
on it. Wait for Resend to show the domain **Verified** (minutes–hours), and confirm
independently with `npm run check:email`.

### Step 3 — Supabase access token (you)
Generate at https://supabase.com/dashboard/account/tokens → paste to me.

### Step 4 — Apply (me, one command)
```bash
SUPABASE_ACCESS_TOKEN=sbp_… \
SMTP_HOST=smtp.resend.com SMTP_PORT=465 SMTP_USER=resend SMTP_PASS=re_… \
SMTP_SENDER_EMAIL=noreply@mail.vascobuild.com SMTP_SENDER_NAME=Vasco \
node scripts/configure-auth-emails.mjs
```
Pushes 6 branded templates + custom SMTP + raised rate limit. (`--dry-run` to preview.)

Then Supabase → **Authentication → URL Configuration**:
- Site URL: `https://admin.vascobuild.com/auth/callback`
- Redirect URLs: add `https://admin.vascobuild.com/auth/callback`,
  `https://admin.vascobuild.com/auth/callback**`, `vasco://auth/callback`
- Ensure "Confirm email" is **ON**.

### Step 5 — Verify (us)
App → Forgot password → email lands in **Inbox** (not spam), sender "Vasco", branded.
Gmail → Show original → **SPF/DKIM/DMARC = PASS**. Optional: mail-tester.com → aim 9–10/10.

---

## What only you can do (irreducible)
Create Resend account · edit vascobuild.com DNS · supply Supabase access token · send/receive a real
test email. Everything else (templates, script, callback plumbing, universal links) is done + verified.

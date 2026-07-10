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

### Step 1 — Resend (you, ~5 min)
1. Create account at resend.com → **Add Domain** → `mail.vascobuild.com` (subdomain protects root reputation).
2. Copy the account-specific DKIM/SPF records Resend shows. **Paste them to me** — I'll return the
   complete registrar record set including the exact DMARC record below.
3. Resend → SMTP tab → grab `SMTP_USER=resend` + `SMTP_PASS=re_...` (API key).

### Step 2 — DNS at registrar (you)
Add Resend's DKIM/SPF/MX records **+ this exact DMARC record** (not provider-specific):

| Type | Host | Value |
|---|---|---|
| TXT | `_dmarc.vascobuild.com` | `v=DMARC1; p=none; rua=mailto:dmarc@vascobuild.com; fo=1; adkim=s; aspf=s` |

Start at `p=none`; after ~1–2 weeks of clean `rua` reports, tighten to `quarantine` → `reject`.
Wait for Resend to show the domain **Verified** (minutes–hours).

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

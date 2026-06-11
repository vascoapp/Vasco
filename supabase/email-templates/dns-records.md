# Stopping Vasco auth emails landing in spam

Spam-foldering of Supabase auth emails has **one dominant cause**: the default sender
(`noreply@mail.app.supabase.io`) sends *as* Supabase's shared domain, so the receiving
mail server can't verify the mail is authorised for `vascobuild.com`. No SPF/DKIM/DMARC
alignment → Gmail/Outlook drop it in spam. The branded HTML helps how it *looks*; it does
nothing for *where it lands*. The fix is sender authentication.

There are exactly three moving parts. Two are DNS (your registrar), one is Supabase config.

---

## Step 1 — Pick a transactional provider & verify the domain

Use **Resend** (least setup) — or Postmark / Amazon SES; the shape is identical.

1. Create the account, **Add Domain** → enter **`vascobuild.com`** (or, to protect the
   root domain's reputation, a subdomain like `mail.vascobuild.com` — recommended).
2. Resend shows you a set of DNS records to add. They are **account-specific** (the DKIM
   selector + public key are generated per account) — copy them verbatim. They look like:

   | Type  | Name (host)                          | Value                                  |
   |-------|--------------------------------------|----------------------------------------|
   | TXT   | `send.vascobuild.com`                | `v=spf1 include:amazonses.com ~all`    |
   | TXT   | `resend._domainkey.vascobuild.com`   | `p=MIGfMA0…` (long DKIM public key)    |
   | MX    | `send.vascobuild.com`                | `feedback-smtp.eu-west-1.amazonses.com` (prio 10) |

   ⚠️ Use the exact values **Resend gives you** — the table above is the *shape*, not
   your real keys. The DKIM `p=…` value is unique to your account.

3. Wait for Resend to show the domain as **Verified** (DNS propagation: minutes–hours).

---

## Step 2 — Add a DMARC record (this one IS exact — add as-is)

DMARC is not provider-specific. Add this TXT record at your registrar:

| Type | Name (host)               | Value                                                                 |
|------|---------------------------|-----------------------------------------------------------------------|
| TXT  | `_dmarc.vascobuild.com`   | `v=DMARC1; p=none; rua=mailto:dmarc@vascobuild.com; fo=1; adkim=s; aspf=s` |

- Start at **`p=none`** (monitor only — won't block anything). Watch the `rua` reports
  for ~1–2 weeks, confirm all legit mail passes, then tighten to `p=quarantine` and
  finally `p=reject`.
- Make sure `dmarc@vascobuild.com` is a real, readable mailbox (or point `rua` to one).

---

## Step 3 — Point Supabase at the provider's SMTP

Get the SMTP credentials from the provider (Resend → **SMTP** tab):

```
SMTP_HOST          smtp.resend.com
SMTP_PORT          465
SMTP_USER          resend
SMTP_PASS          re_…              ← your Resend API key
SMTP_SENDER_EMAIL  noreply@vascobuild.com   (or noreply@mail.vascobuild.com)
SMTP_SENDER_NAME   Vasco
```

Then apply everything (templates + SMTP + raised rate limit) in **one command** — no
manual dashboard paste:

```bash
SUPABASE_ACCESS_TOKEN=sbp_…               \
SMTP_HOST=smtp.resend.com SMTP_PORT=465   \
SMTP_USER=resend SMTP_PASS=re_…           \
SMTP_SENDER_EMAIL=noreply@vascobuild.com  \
SMTP_SENDER_NAME=Vasco                    \
node scripts/configure-auth-emails.mjs
```

(`SUPABASE_ACCESS_TOKEN` from https://supabase.com/dashboard/account/tokens. Project ref
defaults to `gblhqhorkarocmputhte`; override with `SUPABASE_PROJECT_REF`.)

Run `node scripts/configure-auth-emails.mjs --dry-run` first to preview the payload.
Run it **without** the `SMTP_*` vars to push *only* the branded templates.

---

## Step 4 — Verify

1. Trigger a real email: app → **Forgot password** → enter your address.
2. Confirm it lands in **Inbox**, not Spam, with sender **"Vasco"** and your branded design.
3. In Gmail: open the message → **Show original** → check **SPF: PASS**, **DKIM: PASS**,
   **DMARC: PASS**. All three PASS = deliverability fixed.
4. (Optional) send a test to https://www.mail-tester.com and aim for 9–10/10.

---

## What's already done vs. what only you can do

| | Status |
|---|---|
| Branded HTML templates (6) | ✅ in repo, deliverability-clean (preheader, text, footer) |
| One-command apply (templates + SMTP) | ✅ `scripts/configure-auth-emails.mjs` |
| DMARC record value | ✅ exact, above |
| Create provider account + get DKIM keys | ⛔ operator (account-specific secrets) |
| Add DNS records at registrar | ⛔ operator (registrar access) |
| Supply `SUPABASE_ACCESS_TOKEN` + run the script | ⛔ operator (holds the token) |

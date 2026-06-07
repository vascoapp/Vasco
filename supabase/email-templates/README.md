# Vasco — Supabase Auth Email Templates

Branded (DraftKings Sunset Slate) replacements for the default Supabase auth emails,
which look like spam: plain text, no logo, generic sender. These are email-safe HTML
(table layout, inline styles, solid-color fallbacks for the gradient) tested against
the Gmail / Apple Mail / Outlook rendering constraints.

Copy is **NL-primary with an EN secondary line** (primary market is NL; the signup
email fires before we know the user's language).

## How to install (operator — Supabase Dashboard)

Dashboard → **Authentication → Emails → Templates** (hosted projects have no
config-file path for this — it's paste-in-dashboard).

For each template: paste the full HTML file contents into **Message body (HTML)**
and set the **Subject**:

| Dashboard template      | File                    | Subject |
|-------------------------|-------------------------|---------|
| Confirm signup          | `confirm-signup.html`   | `Bevestig je e-mailadres · Vasco` |
| Reset password          | `reset-password.html`   | `Wachtwoord opnieuw instellen · Vasco` |
| Magic link              | `magic-link.html`       | `Je inloglink · Vasco` |
| Change email address    | `email-change.html`     | `Bevestig je nieuwe e-mailadres · Vasco` |
| Invite user             | `invite.html`           | `Je bent uitgenodigd voor Vasco` |
| Reauthentication        | `reauthentication.html` | `Je verificatiecode · Vasco` |

Template variables used: `{{ .ConfirmationURL }}` (all link templates),
`{{ .Email }}` + `{{ .NewEmail }}` (email change), `{{ .Token }}` (reauthentication).
Don't rename them — they're Supabase Go-template variables.

## Deliverability — the bigger half of "looks like spam"

The default sender is `noreply@mail.app.supabase.io`, rate-limited to ~2 emails/hour
and a known spam-folder magnet. Before launch, switch to **custom SMTP**:

1. Pick a transactional provider (Resend / Postmark / SES — Resend is the least setup).
2. Verify the `vascobuild.com` domain there → add the **SPF + DKIM** DNS records it
   gives you; add a **DMARC** record (`v=DMARC1; p=none; rua=mailto:...` to start).
3. Dashboard → **Project Settings → Auth → SMTP**: enable custom SMTP, fill in the
   provider's host/port/credentials.
4. Sender address: `noreply@vascobuild.com` (or `mail.vascobuild.com` subdomain to
   protect root-domain reputation). **Sender name: `Vasco`** — this is what shows in
   the inbox list and matters as much as the template.
5. Raise the rate limit (Dashboard → Auth → Rate Limits) once custom SMTP is on.

## Notes

- Dark-themed email: `color-scheme: dark` meta is set; Gmail dark mode preserves it,
  Gmail light mode shows the dark card as designed.
- The CTA gradient (`background-image: linear-gradient`) degrades to solid `#C2410C`
  (`bgcolor` attr) in Outlook — intentional.
- The brand "logo" is a pure-HTML orange circle + V (no hosted image) so nothing is
  blocked by image-loading-off clients and no asset hosting is needed.
- Redirect/Site URL config for these links is documented in `src/context/AuthContext.tsx`
  (R189 comment): Site URL `https://admin.vascobuild.com/auth/callback` + allowlist entries.

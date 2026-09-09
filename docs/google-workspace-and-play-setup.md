# Google Workspace on vascobuild.com + the Play organization account

Written 2026-09-09. Decisions taken: Workspace **on `vascobuild.com`**, Play
account type **organization**.

Read `memory/resend-email-golive.md` before touching DNS. The email surface went
from never-worked to live on 2026-09-06 and `npm run check:email` is **15/15**.
Re-run it after every DNS change; it is the only thing that sees live state.

---

## 1. What is live on the domain today (read 2026-09-09, authoritative NS)

| Record | Value | Owner |
|---|---|---|
| `vascobuild.com` MX | `10 mx1 / 20 mx2 .simplelogin.co` | **SimpleLogin** — inbound aliases |
| `vascobuild.com` TXT | `v=spf1 include:simplelogin.co ~all` | the ONLY SPF allowed on the root |
| `vascobuild.com` TXT | `sl-verification=oflbnlxfblezldfmvrbaaprgvojmxo` | SimpleLogin ownership |
| `_dmarc` TXT | `p=quarantine; adkim=s; aspf=r; fo=1; rua=mailto:dmarc@vascobuild.com` | enforcing, with reporting |
| `send.mail` TXT / MX | `include:amazonses.com` / `feedback-smtp.eu-west-1` | **Resend** — the app's outbound |
| `resend._domainkey.mail` | 218-char DKIM | Resend |
| root / `www` / `admin` A | `76.76.21.21` | Vercel |

DNS is on Cloudflare (`braelyn` / `fred.ns.cloudflare.com`).

### The app's outbound mail is NOT at risk
Every sender lives on the **`mail.` subdomain**. Adding Google to the root does
not touch `send.mail`, the DKIM key, or any of the six sender literals. Invoices,
auth emails, digest and win-back keep working through this migration.

### What IS at risk: inbound
Pointing the root MX at Google **switches off every SimpleLogin alias the moment
it propagates.** This is a migration, not an addition.

🔴 **Enumerate the SimpleLogin aliases before changing the MX.** Nobody can see
them from the repo. The addresses the product publishes, with occurrence counts:

| Address | Refs in repo | Where it is published |
|---|---|---|
| `privacy@vascobuild.com` | 59 | privacy policy — **Google reads this during review** |
| `support@vascobuild.com` | 36 | in-app help, store listings |
| `hello@vascobuild.com` | 11 | marketing |
| `noreply@vascobuild.com` | 6 | — |
| `legal@vascobuild.com` | 4 | terms |
| `dmarc@vascobuild.com` | 4 | **`rua=` target — DMARC reports die silently if this breaks** |
| `abuse@vascobuild.com` | 2 | — |

`dmarc@` is the one that fails invisibly: aggregate reporting was only turned on
2026-09-06, and nothing alerts if the reports stop arriving.

---

## 2. Cost: one paid seat, not seven

Workspace **aliases are free, up to 30 per user.** Buy ONE Business Starter seat
(~€7/user/month) and hang `support@`, `privacy@`, `legal@`, `abuse@`, `hello@`,
`dmarc@`, `noreply@` off it as aliases. Do not buy a seat per address.

Aliases are added in Admin console → Users → the user → *Add alternate emails*,
or as group addresses if more than one person should read them later.

---

## 3. The SPF merge — the one step with a silent failure mode

**Only one SPF record is allowed per domain.** The root already has one. Adding a
second does not add Google; it makes SPF *permerror* and every root-domain send
starts failing DMARC (`p=quarantine` = spam folder).

The earlier session dodged this entirely by verifying the `mail.` subdomain. This
time it must be hand-merged into the existing string:

```
BEFORE  v=spf1 include:simplelogin.co ~all
AFTER   v=spf1 include:_spf.google.com ~all              # if SimpleLogin is retired
   or   v=spf1 include:_spf.google.com include:simplelogin.co ~all   # if kept
```

⚠️ **Cloudflare's DNS edit form is React-controlled.** Setting `.value` directly
is invisible to React — the field looks edited and Save submits the OLD value.
Use the native setter plus an `input` event:
```js
Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')
  .set.call(el, NEW); el.dispatchEvent(new Event('input',{bubbles:true}));
```

Also turn **DKIM on in Workspace** (Admin → Apps → Gmail → Authenticate email →
Generate). It is **off by default**, and the root DMARC is `adkim=s` (strict), so
mail from `support@` relies on SPF alone until the key is published.

---

## 4. Order of operations (no inbound downtime)

1. **List the SimpleLogin aliases** and write them down. ← blocking, operator only
2. Sign up for Workspace on `vascobuild.com`, verify the domain with the TXT
   token Google issues (this does NOT change mail — verification is TXT only).
3. Create the mailbox and **all aliases** in Admin console, while mail still
   flows to SimpleLogin.
4. Publish the Workspace **DKIM** key.
5. **Merge the SPF** record.
6. **Only then swap the MX** to Google's five records. This is the cutover.
7. Send a test to `privacy@` and `dmarc@` and confirm arrival.
8. `npm run check:email` — must stay 15/15.
9. Cancel SimpleLogin only after a week of confirmed delivery.

---

## 5. The Play organization account

Organization was chosen because it is **exempt from the 12-testers rule**. A
personal account created after 2023-11-13 must run a closed test with 12 testers
for 14 continuous days before it can reach production — per app. Vasco has zero
Android testers and has never been run on Android at all.

Required, and all operator-only:
- **D-U-N-S number** — free from Dun & Bradstreet, **5–30 business days**. This
  is the long pole; start it first, before the Workspace work.
- Business registration / incorporation document from a government authority.
- Proof of the organization's **physical** address (not a registered agent).
- The **authorized representative's** personal ID; they must appear on the
  business registration.
- $25 one-time registration fee.

⚠️ **Google signup is undriveable through the Chrome extension** — it redacts
session JWTs, so the SPA sits on "Loading…" and clicks are silent no-ops. Play
Console and Cloudflare read fine. Signup is by hand.

### Which Google account should own it
Five Google accounts are already in play across this product:

| Account | Owns |
|---|---|
| `slendebroekmerle@gmail.com` | Apple ID / Transporter |
| `ccollect.ai@gmail.com` | the Google Drive this repo lives in |
| `eu.sammysam@gmail.com` | Vercel — `admin.vascobuild.com` |
| `vasco.app.eu@gmail.com` | Resend |
| `vascobuild@gmail.com` | a real Supabase user |

Transferring a Play developer account later is a formal, friction-heavy process,
so **this choice is close to permanent.** Use a Workspace address on
`vascobuild.com` (e.g. `play@` or `admin@`), never a personal Gmail — which is
the whole reason to do the Workspace step first.

---

## 6. Then, the Play release itself

Already done and in the repo: `vasco-play-v1.aab` (versionCode 4, signed),
512×512 icon, 1024×500 feature graphic, 2 phone screenshots × 6 locales, listing
copy in six markets (`npm run check:listing` green), deletion URL live at
`https://admin.vascobuild.com/delete-account`, privacy policy at
`https://vascobuild.com/privacy`.

Remaining: create the app entry by hand (a service account cannot), upload the
AAB to Internal testing, **opt into Play App Signing at that first upload** (the
upload key lives on EAS; without this, losing the `collectai` Expo account is
unrecoverable), then the Data safety / content rating / target audience forms —
answers pre-derived at `claude.ai/code/artifact/54db2fb9-d873-471d-aa1b-be06142dfea8`.

🔴 **Nobody has ever run Vasco on Android.** `vasco-real.apk` sits in the repo
root, uninstalled. That is a larger risk than any of the paperwork above.

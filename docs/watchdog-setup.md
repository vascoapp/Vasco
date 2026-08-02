# Daily Watchdog — setup & runbook

**Built 2026-07-25.** Posts one operator digest to Telegram every day at
**09:00 Europe/Amsterdam** covering the last 24 hours.

## What it reports

| Section | Source | Answers |
|---|---|---|
| 🗂 Supabase logs | Management API (`analytics/endpoints/logs.all`) | API 4xx/5xx, top failing routes, edge-function invocations + failures, auth errors, Postgres `ERROR`/`FATAL`/`PANIC` |
| 💰 Paying customers | `subscriptions` + `subscription_audit` | **Good:** new paid, trial→paid, upgrades, recovered from past-due. **Bad:** churned, went past-due, downgraded. **Watch:** periods ending in 3d, trials with no payment method, active-but-expired (unbilled access), paying users silent 14d |
| 🧾 Cash | `documents` | invoices paid/sent + amounts, quotes, open and overdue totals |
| 📱 App backend | `auth.users`, `business_events`, `jobs`, `customers`, `eve_telemetry`, `push_notification_log` | signups, unconfirmed emails, active users, top events, EVE queue outcomes, push failures |
| ⚙️ Automation health | `cron.job` + `cron.job_run_details` via `get_cron_runs_since` | every `vasco-*` schedule: ran? failed? disabled? plus the watchdog's own last run |
| 🧠 Analysis | `_shared/llm.ts` (optional) | 3–5 sentence narrative; falls back to a rule-based summary with no LLM key |

## Components

| Piece | Path |
|---|---|
| Edge function | `supabase/functions/watchdog-daily/index.ts` |
| Telegram sender | `supabase/functions/_shared/telegram.ts` |
| Platform-log reader | `supabase/functions/_shared/supabaseLogs.ts` |
| Migration | `supabase/migrations/20260725000001_watchdog.sql` |
| Cron entry | `supabase/cron.sql` → `vasco-watchdog-daily` |

## Deploy status (prod `gblhqhorkarocmputhte`)

- ✅ Migration applied (`subscription_audit`, `watchdog_runs`, `watchdog_snapshot`, `get_cron_runs_since`, audit trigger)
- ✅ Function deployed
- ✅ Cron registered — `vasco-watchdog-daily`, `0 7,8 * * *`, active
- ⏳ **Secrets not yet set** — see below. Until `TELEGRAM_*` is set, the digest is built but not delivered.

## Required secrets

```bash
# Delivery (required)
supabase secrets set TELEGRAM_BOT_TOKEN='123456:ABC...'   # from @BotFather
supabase secrets set TELEGRAM_CHAT_ID='123456789'         # your numeric id

# Supabase platform logs (optional but recommended — without it the whole
# "SUPABASE LOGS" section reports NOT COLLECTED rather than silently empty)
supabase secrets set WATCHDOG_MGMT_TOKEN='sbp_...'        # personal access token
supabase secrets set WATCHDOG_PROJECT_REF='gblhqhorkarocmputhte'

# LLM narrative (optional — falls back to rule-based)
supabase secrets set ANTHROPIC_API_KEY='sk-ant-...'
```

> **Naming:** secrets may not begin with `SUPABASE_` — that prefix is reserved
> by the platform and `supabase secrets set` rejects it. Hence `WATCHDOG_*`.

> **⚠️ `WATCHDOG_MGMT_TOKEN` is powerful.** Supabase personal access tokens are
> **not scopeable** — any PAT grants full read/write across every project in the
> org. Create a *dedicated* token for the watchdog at
> https://supabase.com/dashboard/account/tokens so it can be revoked without
> breaking your local CLI login. Do not reuse the CLI's token.

### Getting the Telegram credentials

1. Telegram → message **@BotFather** → `/newbot` → name it → copy the token.
2. Message your new bot once (bots cannot open a conversation first).
3. Get your chat id: `curl "https://api.telegram.org/bot<TOKEN>/getUpdates"` and
   read `result[0].message.chat.id`. For a group, add the bot and use the
   `-100...` id.

## Testing

```bash
SRK=$(supabase projects api-keys --project-ref gblhqhorkarocmputhte -o json \
  | python3 -c "import sys,json;[print(k['api_key']) for k in json.load(sys.stdin) if k['name']=='service_role']")

# Build the digest and return it as JSON — sends nothing
curl -s -X POST -H "Authorization: Bearer $SRK" \
  "https://gblhqhorkarocmputhte.supabase.co/functions/v1/watchdog-daily?dry=1" | python3 -m json.tool

# Actually send now, bypassing the 09:00-local gate
curl -s -X POST -H "Authorization: Bearer $SRK" \
  "https://gblhqhorkarocmputhte.supabase.co/functions/v1/watchdog-daily?force=1"
```

## Design notes

**DST.** `pg_cron` runs in UTC, so a fixed UTC time drifts an hour twice a year.
The schedule fires at **both** 07:00 and 08:00 UTC and the function no-ops
unless it is genuinely 09:00 in `Europe/Amsterdam`. Correct in CET and CEST with
no seasonal edit.

**Never lie about missing data.** Every section that fails to collect is listed
explicitly as `DEGRADED` / `UNAVAILABLE`. `watchdog_snapshot` wraps each section
in its own exception block so a renamed column degrades one section instead of
500-ing the digest. A monitoring tool that renders missing data as a reassuring
zero is worse than no monitoring at all — hence also the explicit "change
tracking just went live, these zeroes are not yet evidence of stability" note
until `subscription_audit` has real rows.

**Why `subscription_audit` exists.** Without a change log, "churned today" and
"trial→paid today" can only be inferred from `subscriptions.updated_at`, which
any unrelated write (e.g. the Mollie webhook extending
`current_period_ends_at`) overwrites. The trigger records only real tier/status
transitions, so renewals don't flood it.

**Why `watchdog_runs` exists.** A watchdog that cannot observe its own silence
is not a watchdog. Each run logs itself, so the next one can report "previous
run was 38h ago — a run was missed."

**pg_cron cannot see HTTP failures.** `net.http_post` is asynchronous: it
returns a request id immediately, so `cron.job_run_details` records `succeeded`
even when the function later returns 500. Cron status proves *dispatch*, not
*execution*. `watchdog_runs` is the real proof the function ran.

**Log retention.** The org is on the **free** plan → platform logs are retained
**1 day**. A 24h window is therefore the maximum useful lookback; a longer
window silently returns only the retained slice. Pro extends this to 7 days.

## ⚠️ Open finding from the first run

The watchdog's first execution found that **`cron.job` was completely empty with
zero runs in history** — `supabase/cron.sql` had never been executed against
production, despite `pg_cron` and `pg_net` being installed. Every scheduled
automation had therefore never run:

`vasco-weekly-digest`, `vasco-stale-draft-cleanup`, `vasco-drain-account-deletions`
(GDPR Art. 17!), `vasco-daily-push-digest`, `vasco-churn-winback`,
`vasco-grant-referral-credits`, `vasco-weekly-retrain-models`,
`vasco-train-extra-models`, `vasco-refresh-generator-approval-rates`,
`vasco-pack-trigger-tick`.

Only `vasco-watchdog-daily` has been registered so far — deliberately, because
registering the rest starts sending real customer-facing email and push, and
several of them need `RESEND_API_KEY` (currently unset) so they would fail loudly
on first run. Decide per job before running the rest of `supabase/cron.sql`.

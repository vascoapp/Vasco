# Post-Launch Ops Runbook

R66r70 (2026-05-12). What to do when something breaks in production.
Written as "here's the page you tap to, here's the SQL you run, here's
the command you type" — operator-pragmatic, not theoretical.

> 🚨 If you're reading this during an active incident, scroll straight to
> §"Common incidents" below — skip the orientation.

---

## Daily watch (first 14 days post-launch)

These four tabs open every morning:

1. **Sentry** — https://sentry.io/organizations/vasco-bv/issues/
   - Filter: last 24h, environment=production
   - Target: <5 new issues per day, crash-free users >99%
   - If a single error spikes >20 occurrences in 1h → triage immediately
2. **Supabase** — https://supabase.com/dashboard/project/gblhqhorkarocmputhte
   - Database → CPU usage: should stay <40%
   - Database → slow-query log: anything >500ms is suspect
   - Edge Functions → logs: filter to ERROR, last 24h
3. **App Store Connect** — https://appstoreconnect.apple.com → Vasco → TestFlight
   - Crashes: tap any "x crashes" badge → check stack trace
   - Feedback: external testers can leave inline screenshots
4. **Mollie + Stripe**
   - Mollie dashboard → Payments → "Failed" filter
   - Stripe dashboard → Workbench → Webhook attempts → "Failed deliveries"

Once a week:
- **Admin DeveloperHub Cron tab** — verify all 10 cron schedules are
  registered + recent runs succeeded (`get_cron_health` RPC). If any
  show "failed" or "never run", check Edge Function logs.

---

## Common incidents

### 1. "Everything works, my own crash report isn't in Sentry"

Most common cause: `EXPO_PUBLIC_SENTRY_DSN` not set in the build profile.

```bash
eas secret:list                                          # check it's there
eas build --profile preview --platform ios --clear-cache # force a rebuild if missing
```

Other causes:
- User declined the consent banner on first launch
  → check `consentService.getConsent('analytics')` returns true
- Sourcemaps weren't uploaded → crash arrives but stack trace is minified
  → run `npm run sentry:upload:ios` against the same build

---

### 2. Mollie / Stripe webhook is failing

Symptoms: customer paid but invoice still shows "sent" in-app; receipt
email never went out.

Triage:

```bash
# 1. Was the webhook even received?
supabase logs --type function --tail mollie-webhook
# Look for the relevant invoice_id, expect: "Idempotency check ✓" + "200"

# 2. If 'Signature verification failed' → secret rotated
supabase secrets list | grep WEBHOOK
# Re-set the correct secret from the Mollie/Stripe dashboard
supabase secrets set MOLLIE_WEBHOOK_SECRET=whsec_...

# 3. If 'Idempotency claimed' → webhook fired twice, the second was correctly dropped
#    This is GOOD — R41 idempotency working. Customer was paid once.

# 4. If 'function timeout' → check Supabase Edge Functions cold-start times
#    Workaround: ask Mollie/Stripe to retry from their dashboard
```

Mollie retries failed webhooks for 24h. If you fix the issue within that
window, no manual replay needed.

---

### 3. A specific feature is misbehaving for users — turn it off without a rebuild

Feature flags table (`public.feature_flags`) is the kill switch:

```sql
-- See current state
SELECT key, enabled, country, rollout_percent FROM public.feature_flags;

-- Turn off the EU6-wide
UPDATE public.feature_flags
SET enabled = false
WHERE key = 'payments_stripe_uk';

-- Roll back to 10% rollout while you investigate
UPDATE public.feature_flags
SET rollout_percent = 10
WHERE key = 'photo_to_quote_ai';
```

Clients pick this up on next launch (the AsyncStorage cache TTL is 30 min,
so reach 100% within ~30 min).

---

### 4. Bad release is live — how to revert

Two ways depending on severity:

**A. OTA / hotfix (JS-only changes)** — within minutes, no Apple review

```bash
git checkout <last-known-good-commit>
eas update --branch production --message "Rollback to <commit>"
```

`expo-updates` will fetch the rollback on next app launch. The native
binary doesn't change.

**B. Full rebuild (native changes broken)** — hours, plus Apple review

```bash
# Phased rollout halt in App Store Connect first:
# ASC → Vasco → App Store → 1.0.x → 'Pause Phased Release'

git checkout <last-known-good-commit>
eas build --profile production --platform all --auto-submit
# wait 10-25 min build + 24-48h Apple review
```

For Android (Play Store):
```bash
# Stop rollout immediately:
# Play Console → Vasco → Production → 'Halt Rollout'
# Promote previous release via 'Create new release from existing APK'
```

---

### 5. Specific user reports "I can't login / my data is missing"

Triage:

```sql
-- 1. Did the user actually sign up?
SELECT id, email, created_at, last_sign_in_at
FROM auth.users
WHERE email = 'user@example.com';

-- 2. Is their data scoped correctly? (most common cause of "missing data" — wrong RLS)
SELECT count(*) FROM public.jobs WHERE user_id = '<the-uuid>';
SELECT count(*) FROM public.documents WHERE user_id = '<the-uuid>';
SELECT count(*) FROM public.customers WHERE user_id = '<the-uuid>';

-- 3. Check account_deletion_requests in case they queued deletion
SELECT * FROM public.account_deletion_requests
WHERE user_id = '<the-uuid>' AND status != 'done';
```

If their data exists but they can't see it → they probably switched
devices and AsyncStorage cache is empty. Force a refresh:

```
In-app: Profile → Pull-to-refresh on Vandaag
Or: log out + log in (triggers full refreshData)
```

If their data is gone → check `account_deletion_requests`. If
`status='done'`, deletion completed (GDPR Art. 17, no recovery — this is
working as designed). If `status='processing'` or `'pending'`, you can
update to `'cancelled'` *if it's been <24h*:

```sql
UPDATE public.account_deletion_requests
SET status = 'cancelled', processor_notes = 'user changed mind on ' || now()
WHERE user_id = '<the-uuid>' AND status IN ('pending', 'processing');
```

---

### 6. Cron jobs not running

```sql
SELECT jobname, schedule, active, last_run, last_status
FROM cron.job j
LEFT JOIN LATERAL (
  SELECT start_time AS last_run, status AS last_status
  FROM cron.job_run_details
  WHERE jobid = j.jobid
  ORDER BY start_time DESC LIMIT 1
) r ON true
WHERE jobname LIKE 'vasco-%'
ORDER BY jobname;
```

If a job shows `active=false` or no last_run, re-register:

```bash
# Edit supabase/cron.sql to substitute real SUPABASE_URL + SERVICE_ROLE_KEY
# Then run via the Supabase SQL editor:
\i supabase/cron.sql
```

The 10 cron jobs and what breaks if they stop:
- `vasco-weekly-digest` — Monday 08:00 UTC contractor weekly email
- `vasco-stale-draft-cleanup` — daily quote cleanup (90d old drafts)
- `vasco-drain-account-deletions` — daily GDPR Art. 17 fulfillment (REGULATORY)
- `vasco-daily-push-digest` — daily 17:00 UTC unfinished-work nudge
- `vasco-churn-winback` — Monday 09:00 UTC win-back email
- `vasco-grant-referral-credits` — daily 02:00 UTC credit application
- `vasco-weekly-retrain-models` — Sunday 05:00 UTC ML retrain (4 predictors)
- `vasco-train-extra-models` — Sunday 04:00 UTC additional model training
- `vasco-refresh-generator-approval-rates` — daily 03:30 UTC AI generator scoring
- `vasco-pack-trigger-tick` — daily 09:00 UTC workflow-pack evaluation

**Most critical:** `vasco-drain-account-deletions` — if this stops, GDPR
Art. 17 30-day deletion deadline starts ticking against you with no
processor running. Worth a Sentry alert if it misses 2 consecutive runs.

---

### 7. Disk space / Supabase quota alarm

Most common cause: `customer-uploads` Storage bucket growing unbounded.

```sql
-- Per-bucket size
SELECT bucket_id, count(*), pg_size_pretty(sum(metadata->>'size')::bigint)
FROM storage.objects
GROUP BY bucket_id
ORDER BY 3 DESC;

-- Old customer uploads (>30d) you can purge
SELECT name, created_at FROM storage.objects
WHERE bucket_id = 'customer-uploads'
  AND created_at < now() - interval '30 days'
ORDER BY created_at;
```

---

### 8. App Store rejection

Common Apple rejection reasons + how to address:

| Apple says | Likely fix |
|---|---|
| 4.0 Design — placeholder content | Replace `assets/icon.png` with brand-team final art |
| 5.1.1 Data Collection mismatch | Update `app.json:privacyManifests` to match what we actually collect — cross-check with `docs/app-privacy-questionnaire.md` |
| 2.1 Performance — crashes on launch | Sentry will catch it on first install; check there before resubmitting |
| 4.8 Sign in with Apple required | Only if we add Google/Facebook login. Currently email-only → not required. |
| 5.1.5 Location services | We don't use them. If rejected, re-verify `app.json` permissions list has no `LOCATION_*` permissions enabled |
| Missing privacy URL | Verify https://admin.vascobuild.com/legal/privacy-policy returns 200 |

---

## Kill switches

Quick reference:

| Action | SQL |
|---|---|
| Turn off Stripe UK | `update feature_flags set enabled=false where key='payments_stripe_uk';` |
| Turn off all photo-to-quote | `update feature_flags set enabled=false where key='photo_to_quote_ai';` |
| Pause new signups | `update feature_flags set enabled=false where key='signup_open';` |
| Force minimum app version | `update app_config set value=jsonb_set(value,'{forceUpdateBelow}','"1.0.5"') where key='version_config';` (clients < 1.0.5 see force-update modal on next launch) |

---

## Operator's contact tree

When you're stuck:

| Issue | Where to ask |
|---|---|
| EAS build failure | https://github.com/expo/eas-cli/issues |
| Supabase outage | https://status.supabase.com |
| Mollie / Stripe webhook stuck | Provider's support — Mollie ~4h SLA, Stripe ~2h |
| Apple review escalation | App Store Connect → Resolution Center → "Request review" → 24h |
| Sentry dashboard misbehaving | https://status.sentry.io |

---

## SLO targets (first 6 months)

These are working assumptions, not contractual commitments. Review at
the first 100-user milestone.

| Metric | Target | Watchpoint |
|---|---|---|
| Crash-free users | > 99% | < 98% in 24h |
| Sentry new-error rate | < 5/day | > 20/day |
| Database CPU | < 40% sustained | > 70% for 10 min |
| Slow queries (>500ms) | < 5/hour | > 20/hour |
| Webhook delivery success | > 99% | < 95% for any hour |
| Push delivery success | > 95% | < 80% for any market |
| Cron-job success rate | 100% | any single failure |

---

## Where the bodies are buried

Hidden gotchas to know about, post-launch:

- **`@vasco_*` AsyncStorage keys** survive logout per R46 by design, then
  get wiped on userChange. If you ever see "user B sees user A's data",
  check `sessionCleanup.clearUserScopedStorage()` is firing in
  `AuthContext.logout`.
- **Cohort RPCs return null when `contractor_count < 5`** (k-anonymity).
  This isn't a bug — it's the contract. UI hides cohort hints below threshold.
- **`Q-OFF-XXXXXX` document numbers** appear briefly for offline-minted
  quotes / invoices before the `docNumberRemapBus` swap fires (R66r62).
  If you see them sticking around > 30s after reconnect, the offline
  write queue is stuck — check the device's network logs.
- **The 4-tier subscription gates** (Gratis / Advanced / Pro / Contractor)
  live in `src/services/subscriptionService.ts`. Changing tier limits
  there is live immediately (no migration needed, no app rebuild — tier
  data is per-user in the `subscriptions` table).
- **Sentry consent** is opt-in via the cookie banner. If you see "no
  user is reporting crashes", check the consent rate via the admin
  dashboard's analytics tab — it should be >70% acceptance.

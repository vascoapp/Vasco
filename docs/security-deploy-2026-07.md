# Security Deploy Runbook — 2026-07 Audit Series

Deploy checklist for the FE↔DB + security audit (rounds 1–18, see
`memory/audit-2026-07-findings.md`).

> ## ✅ DEPLOYED 2026-07-26 — this runbook is now a record, not a to-do.
>
> Executed in the required order: edge fn `sign-customer-upload` → Vercel
> `admin` redeploy (prod alias `vascobuild.com`) → `supabase db push` (9 pending
> migrations incl. `20260711000001`–`000004`). All applied clean. Everything is
> pushed to `origin/main`.
>
> **Post-deploy probes all pass** (anon key, live):
> - `GET /rest/v1/customer_questions?select=tracker_access_token` → `42501`
> - anon `list('customer-uploads')` → `[]`, and the broad policy is dropped
> - `get_portal_by_access_code` + `get_customer_question_status` still callable
>   by anon, so the portal keeps working
> - RLS `true` on `extracted_line_items` + `cohort_benchmarks`;
>   `next_document_number` pinned to `search_path=public, pg_temp`
>
> ### ⚠️ The severity in this runbook was wrong — in both directions
> R14/R15/R17 were graded HIGH by reading *policies*. Live, `anon` held **zero
> table GRANTs**, and GRANT is checked *before* RLS, so the broad policy was
> inert and the tables held 0 rows — not exploitable. Meanwhile the one
> genuinely open hole, the `customer-uploads` broad anon SELECT, was barely
> ranked; it was harmless only because the bucket was empty and would have
> leaked every customer's photos on the first upload.
>
> **Grade RLS findings against the live GRANT table, not the migration files.**
> That same blind spot hid a far worse bug in the opposite direction — see
> `learnings.md` #87: 19 of 21 client tables had no grant at all, so the app
> could not persist anything. Recipe for querying prod is in
> `memory/supabase-prod-paused.md`.

---

## What ships, by channel

| Channel | Command | Audit items |
|---|---|---|
| Git | `git push origin main` | everything (blocker for all deploys) |
| Supabase DB | `supabase db push` | migrations `20260711000001`–`000004` (+ ~13 older pending) |
| Supabase edge fns | `supabase functions deploy <name>` | **`sign-customer-upload` (NEW, required)** + webhooks/digest |
| Mobile (OTA) | `eas update` | R7 uuid-FK guards, R10 idRemap fix, R13 deletion-type (all JS-only) |
| Web (Vercel) | redeploy `admin` | **customer portal `page.tsx` (required for the portal fix)** |

The 4 security migrations:

- `20260711000001_rls_hardening.sql` — R13: enable RLS on `extracted_line_items`
  (was a cross-tenant leak) + `cohort_benchmarks` (inert policy).
- `20260711000002_customer_questions_token_leak_mitigation.sql` — R14: partial
  mitigation (revoke `tracker_access_token` from anon). **Superseded by `000003`
  but harmless — apply both, in order.**
- `20260711000003_portal_anon_read_hardening.sql` — R17: adds
  `get_customer_question_status` RPC, **drops** the broad anon SELECT on
  `customer_questions` AND on `customer-uploads`.
- `20260711000004_secdef_search_path_fix.sql` — R18: pin `search_path` on
  `next_document_number`.

---

## ⚠️ Portal fix is a 3-part co-dependent change — deploy in this order

The R14/R15/R17 fix spans **migration + edge fn + web**. The migration drops the
broad anon SELECT policies the *current live* portal depends on, and the *new*
portal code depends on the RPC + edge fn the migration/deploy add. Deploy in the
order below so there is **no broken window** (the worst case is a reply that
arrives a few seconds late, caught silently):

1. **Edge fn first** — `supabase functions deploy sign-customer-upload`
   (additive; breaks nothing; the new portal needs it for photo signing).
2. **Web second** — redeploy `admin` to Vercel (new portal uses the RPC +
   edge fn; it no longer needs any anon SELECT). Between this step and step 3
   the reply-poll RPC doesn't exist yet, so replies just don't appear until
   step 3 — no error, no exposure change (policies still broad, i.e. the
   pre-existing state).
3. **Migration last** — `supabase db push` (adds the RPC → replies work again;
   drops both broad anon SELECT policies → the leaks close).

> Do **not** run the migration while the old portal is still live — dropping
> the anon SELECT policies before the new portal is deployed breaks portal Q&A
> reads and photo `createSignedUrl`.

---

## Step-by-step

### 0. Push
```bash
git push origin main         # needs write access
```

### 1. Preflight the mobile bundle (before eas update)
```bash
npm run ota:preflight:fast   # must be GREEN
npm run i18n:audit           # all 6 locales, 0 placeholder mismatches
npx tsc --noEmit | grep '^app/'   # expect empty
```

### 2. Edge functions
```bash
supabase functions deploy sign-customer-upload   # NEW — required for portal photo upload
# Redeploy the others touched by unpushed commits (safe to re-deploy):
supabase functions deploy daily-push-digest drain-account-deletions \
  send-invoice mollie-webhook stripe-webhook capture-lead ai-command tax-lookup send-sms
```
Secrets to confirm set (see `docs/supabase-go-live.md`): `SUPABASE_SERVICE_ROLE_KEY`
(sign-customer-upload), `STRIPE_SECRET_KEY` + `STRIPE_API_KEY`, `ANTHROPIC_API_KEY`,
`TWILIO_*`, `TAXJAR_API_KEY`.

### 3. Web (admin + customer portal)
Redeploy `admin` to Vercel. Confirm `NEXT_PUBLIC_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_ANON_KEY` are set. This ships the portal `page.tsx` that
uses the RPC + `sign-customer-upload`.

### 4. Database
```bash
supabase db push             # applies 20260711000001..000004 (+ older pending)
```

### 5. Mobile OTA
```bash
eas update                   # ships R7/R10/R13 JS fixes
```

---

## Smoke tests (post-deploy)

**Portal security fix (critical — spans 3 channels):**
- [ ] Open a customer portal link (`/customer/<access_code>`) → it loads.
- [ ] Ask a question → contractor approves the reply in-app → reply appears in
      the portal within ~8s.
- [ ] Upload a photo in the portal → it attaches to the decision (a signed URL
      is returned by `sign-customer-upload`).
- [ ] **Leak closed:** with the public anon key, `GET
      /rest/v1/customer_questions?select=tracker_access_token` returns **0 rows /
      permission denied** (was: every token). Same for
      `GET /rest/v1/customer_questions?select=*`.
- [ ] **Storage leak closed:** anon `list('customer-uploads')` /
      `GET /storage/v1/object/list/customer-uploads` returns **nothing**
      (was: every customer's objects).

**Other audit fixes:**
- [ ] Quote → reject → a Lead row persists (R7 leads FK).
- [ ] Aannemer creates a Project → it survives a cold reload (R7 projects FK).
- [ ] Job → create invoice → invoice persists (R7 addInvoiceFromJob FK).
- [ ] Create a material **offline**, go online → it's findable in material
      search after sync (R10 idRemap).
- [ ] `extracted_line_items` / `cohort_benchmarks` reads still work for the
      contractor (R13 RLS enable didn't over-restrict).
- [ ] Invoice numbering still increments (R18 `next_document_number`).

---

## Rollback

- **Migrations** are additive/hardening. To revert the portal-policy drops in an
  emergency, re-create the old policies:
  ```sql
  create policy "anon reads by tracker token" on public.customer_questions
    for select using (tracker_access_token is not null);
  create policy "customer-uploads anon select" on storage.objects
    for select using (bucket_id = 'customer-uploads');
  ```
  (This re-opens the leaks — only as a last resort if the new portal path fails
  and must be un-blocked while debugging.)
- **Edge fn / web** — redeploy the previous Vercel/Functions version.
- **OTA** — `eas update` is roll-forward; publish a revert update if needed.

---

## Still OUTSTANDING after this deploy (not blockers, tracked separately)

- **Admin uses the anon key** (app-PIN only, no DB auth) → `get_cron_health` is
  anon-readable (R18 info disclosure) and `analytics_events` can't be read.
  Fix = give admin an authenticated/service-role read path, then restrict.
- e-invoice buyer party empty (EN16931 BR-10); `accountingLoop` currency
  hardcoded EUR. See `memory/audit-2026-07-findings.md`.

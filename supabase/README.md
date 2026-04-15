# Vasco Supabase

## Migration order

Supabase CLI applies migrations in filename-lexicographic order. Current order:

```
001_intelligence_tables.sql
002_ai_moat_infrastructure.sql
003_decision_tracker_tables.sql
20260213_enrich_jobs.sql
20260213_extracted_documents.sql
20260213_intelligence_schema.sql
20260213_round2_schema.sql
20260214_job_materials.sql
20260415_push_tokens.sql
```

⚠️ **Known overlap (see learnings #1):** `001_`/`002_` define tables that
`20260213_intelligence_schema.sql` also defines. All migrations use `if not
exists`, so re-running is safe, but on a fresh database the earlier-named
migrations seed the canonical schema and the later ones are mostly no-ops.

If you need to rebuild schema-from-scratch in the future, consolidate to a
single `00000000_initial.sql` — but **only after** the current prod DB is
stable and you can version the reset.

## First deploy

```bash
# 1. Log in
supabase login

# 2. Link this repo to your project (one-time)
supabase link --project-ref <your-ref>

# 3. Push all migrations
npm run supabase:push

# 4. Regenerate typed client
npm run supabase:types

# 5. Set Edge Function secrets (webhooks)
supabase secrets set \
  STRIPE_WEBHOOK_SECRET=whsec_xxx \
  MOLLIE_API_KEY=live_xxx \
  MOLLIE_WEBHOOK_SECRET=xxx

# 6. Deploy Edge Functions
supabase functions deploy mollie-webhook
supabase functions deploy stripe-webhook
supabase functions deploy analyze-photo
supabase functions deploy predict-duration
supabase functions deploy predict-price
```

## Seed data

Dev-only demo seed lives in `src/data/` (TS). When Supabase is unconfigured,
the app uses in-memory seed data (guarded by `USE_SEED_DATA` from
`src/config/demo.ts`).

No SQL seed file is shipped because the product relies on per-user data
(auth-scoped) rather than global demo rows. If you need to load demo rows
into a staging project, use the admin dashboard's "Load demo data" button
(admin → settings) which authenticates as a real user first.

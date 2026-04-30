# SCHEMA LOCK — VascoApp BE↔FE Contract

**Version:** 1.0 — frozen 2026-05-01
**Owner:** changes require explicit version bump + sign-off from BE + FE leads
**Scope:** the contract between mobile app (`src/`, `app/`) and Supabase (`supabase/`). Anything below is locked unless this doc is updated.

---

## VERSIONING

- **Major** bump on breaking changes: column dropped, RPC signature changed, RLS narrowed.
- **Minor** bump on additive changes: new column with default, new RPC, new edge fn.
- **Patch** bump on doc fixes, no schema impact.

When changing: bump version at top of this file, add row to CHANGELOG section, then run `supabase db diff` to confirm migration matches.

---

## TIER 1 — LOCKED (FE writes + BE schema both stable)

### `subscriptions`
PK: `user_id` (uuid)
```
user_id              uuid PK FK→auth.users
tier                 text check (free|advanced|pro|contractor)
billing_cycle        text check (monthly|yearly)
status               text check (trialing|active|past_due|canceled|expired)
trial_ends_at        timestamptz
current_period_ends_at timestamptz
external_id          text
external_provider    text check (mollie|stripe)
created_at           timestamptz NOT NULL default now()
updated_at           timestamptz NOT NULL default now()
```
RLS: owner read; service_role write
Idx: tier, status, external_id
Written by: client SDK (signup), webhook (state changes)

### `subscription_credits`
PK: `id`; UNIQUE `(user_id, source_id)` WHERE source_type='referral'
```
id          uuid PK
user_id     uuid NOT NULL FK→auth.users (cascade)
months_free int NOT NULL check (1-12)
source_type text default 'referral' check (referral|promo|goodwill)
source_id   uuid
granted_at  timestamptz NOT NULL default now()
redeemed_at timestamptz
notes       text
```
RLS: owner read; service_role write
Idx: (user_id, redeemed_at)

### `referral_codes`
PK: `user_id`
```
user_id    uuid PK FK→auth.users
code       text NOT NULL UNIQUE  -- 4-8 chars [A-Z2-9]
created_at timestamptz NOT NULL default now()
```

### `referral_attributions`
UNIQUE: `referred_user_id` (one attribution per referred)
```
id               uuid PK
referrer_user_id uuid NOT NULL FK→auth.users
referred_user_id uuid NOT NULL FK→auth.users UNIQUE
code             text NOT NULL
status           text default 'pending' check (pending|activated|credited|void)
attributed_at    timestamptz NOT NULL default now()
activated_at     timestamptz
credited_at      timestamptz
```

### `webhook_idempotency`
PK: `(provider, event_id)`
```
provider     text NOT NULL
event_id     text NOT NULL
processed_at timestamptz NOT NULL default now()
```
RLS: service_role only

### `business_settings`
UNIQUE: `user_id`
```
id                     uuid PK
user_id                uuid NOT NULL FK→auth.users
business_name          text
kvk_number             text
vat_number             text
address                text
email                  text
phone                  text
logo_url               text
iban                   text
bic                    text
country                text check (NL|DE|FR|ES|IT|UK)
postcode               text
city                   text
website                text
invoice_prefix         text default 'INV'
quote_prefix           text default 'Q'
default_payment_terms  int default 14
created_at             timestamptz NOT NULL default now()
updated_at             timestamptz NOT NULL default now()
```

### `customers`
```
id         uuid PK
user_id    uuid NOT NULL FK→auth.users
name       text NOT NULL
email      text
phone      text
address    text
created_at timestamptz NOT NULL default now()
updated_at timestamptz NOT NULL default now()
```
Idx: (user_id)

### `jobs`
```
id                       uuid PK
user_id                  uuid NOT NULL FK→auth.users
customer_id              uuid FK→customers (set null on delete)
title                    text NOT NULL
description              text
status                   text NOT NULL default 'active'
address_street           text
address_city             text
address_postcode         text
address_country          text default 'NL'
address_access_notes     text
address_parking_notes    text
scheduled_date           date
scheduled_start_time     text
scheduled_end_time       text
estimated_duration       numeric
quoted_amount            numeric
agreed_amount            numeric
trade                    text
priority                 text default 'normal'
rooms_areas              text[]
specifications           text
site_contact             text
site_phone               text
completed_at             timestamptz
created_at               timestamptz NOT NULL default now()
updated_at               timestamptz NOT NULL default now()
```
Idx: (user_id), (customer_id)

### `documents`
```
id                  uuid PK
user_id             uuid NOT NULL FK→auth.users
doc_type            text NOT NULL check (quote|invoice)
status              text NOT NULL check (draft|sent|paid)
customer_id         uuid FK→customers
job_id              uuid FK→jobs
source_document_id  uuid FK→documents
document_number     text  -- generated by next_document_number RPC
issue_date          date
due_date            date
sent_at             timestamptz
paid_at             timestamptz
total_amount        numeric(12,2) NOT NULL default 0
created_at          timestamptz NOT NULL default now()
updated_at          timestamptz NOT NULL default now()
```
Idx: (user_id, doc_type), (customer_id), (job_id)
**Important:** `document_number` MUST come from `next_document_number(p_doc_type)` RPC. Do not generate client-side.

### `line_items`
```
id          uuid PK
user_id     uuid NOT NULL FK→auth.users
document_id uuid NOT NULL FK→documents (cascade)
description text NOT NULL
quantity    numeric(12,2) NOT NULL default 1
unit_price  numeric(12,2) NOT NULL default 0
total_price numeric(12,2) NOT NULL default 0
position    int NOT NULL default 0
created_at  timestamptz NOT NULL default now()
updated_at  timestamptz NOT NULL default now()
```
Idx: (document_id)

### `document_counters`
UNIQUE: `(user_id, doc_type)`
```
id             uuid PK
user_id        uuid NOT NULL FK→auth.users
doc_type       text NOT NULL check (quote|invoice)
current_number bigint NOT NULL default 0
updated_at     timestamptz NOT NULL default now()
```
Written/read only by `next_document_number` RPC.

### `job_materials`
```
id          uuid PK
user_id     uuid NOT NULL FK→auth.users
job_id      uuid NOT NULL FK→jobs (cascade)
material_id uuid NOT NULL FK→material_catalog (cascade)
quantity    numeric(12,3) NOT NULL default 1
unit        text NOT NULL default 'piece'
unit_price  numeric(12,2)
total_price numeric(12,2)
supplier_id uuid FK→suppliers (set null)
status      text NOT NULL default 'planned' check (planned|ordered|delivered|installed)
notes       text
ordered_at  timestamptz
delivered_at timestamptz
created_at  timestamptz NOT NULL default now()
updated_at  timestamptz NOT NULL default now()
```

### `feature_flags`
PK: `(key, country)`
```
key             text NOT NULL
country         text NOT NULL default 'GLOBAL'
enabled         boolean NOT NULL default false
rollout_percent int NOT NULL default 0 check (0-100)
description     text
updated_at      timestamptz NOT NULL default now()
```
RLS: public read; service_role write
**Note:** FE caches 30min in AsyncStorage.

### `push_tokens`
UNIQUE: `(user_id, device_id)`
```
id          uuid PK
user_id     uuid NOT NULL FK→auth.users
device_id   text NOT NULL
token       text NOT NULL
platform    text NOT NULL check (ios|android|web)
app_version text
created_at  timestamptz NOT NULL default now()
updated_at  timestamptz NOT NULL default now()
```

### `account_deletion_requests`
UNIQUE: `(user_id, status)` deferrable
```
id              uuid PK
user_id         uuid NOT NULL FK→auth.users
requested_at    timestamptz NOT NULL default now()
reason          text
status          text NOT NULL default 'pending' check (pending|processing|done|cancelled)
processed_at    timestamptz
processor_notes text
```

### `eve_telemetry`
PK: `id` (text — non-uuid for external correlation)
```
id          text PK
user_id     uuid NOT NULL FK→auth.users
action_type text NOT NULL
agent_type  text NOT NULL check (agent|auditor|analyst)
entity_key  text
outcome     text NOT NULL check (approved|rejected|snoozed|executed|expired)
meta        jsonb default '{}'
created_at  timestamptz NOT NULL default now()
```

### `customer_interactions`
PK: `id` (text)
```
id          text PK
quote_id    text NOT NULL
customer_id text
type        text NOT NULL check (view|tier_select|accept|reject|change_request|decision)
data        jsonb default '{}'
created_at  timestamptz NOT NULL default now()
```
RLS: anon insert allowed (portal)

### `decision_trackers`
UNIQUE: `access_code`
```
id              uuid PK
user_id         uuid NOT NULL FK→auth.users
job_id          text NOT NULL
customer_id     text NOT NULL
access_code     text NOT NULL UNIQUE
template_id     text
status          text NOT NULL default 'active' check (active|completed|expired)
total_items     int NOT NULL default 0
completed_items int NOT NULL default 0
created_at      timestamptz NOT NULL default now()
updated_at      timestamptz NOT NULL default now()
```

### `decision_items`
```
id          uuid PK
tracker_id  uuid NOT NULL FK→decision_trackers (cascade)
category    text NOT NULL
label       text NOT NULL
help_text   text
input_type  text NOT NULL default 'select' check (select|text|multi|date|photo)
options     jsonb default '[]'
is_required boolean default true
due_date    date
sort_order  int default 0
created_at  timestamptz NOT NULL default now()
```

### `decision_submissions`
UNIQUE: `(tracker_id, item_id, submitted_by)`
```
id                       uuid PK
tracker_id               uuid NOT NULL FK→decision_trackers (cascade)
item_id                  uuid NOT NULL FK→decision_items (cascade)
submitted_by             text NOT NULL default 'customer' check (customer|contractor)
value                    text
notes                    text
photos                   text[]
linked_product_url       text
time_to_decide_seconds   int
submitted_at             timestamptz NOT NULL default now()
```

### `decision_activities`
```
id            uuid PK
tracker_id    uuid NOT NULL FK→decision_trackers (cascade)
activity_type text NOT NULL check (portal_accessed|item_viewed|decision_made|help_clicked)
item_id       uuid FK→decision_items
metadata      jsonb default '{}'
created_at    timestamptz NOT NULL default now()
```

### `customer_questions`
```
id                    uuid PK
tracker_id            text NOT NULL
tracker_access_token  text
contractor_user_id    uuid FK→auth.users (cascade)
question              text NOT NULL
question_lang         text default 'nl'
stakes                text NOT NULL default 'unknown' check (low|high|unknown)
ai_reply_draft        text
ai_reply_confidence   numeric(3,2)
ai_reply_reason       text
approved_reply        text
approved_by           uuid FK→auth.users
approved_at           timestamptz
auto_sent             boolean default false
sent_at               timestamptz
status                text NOT NULL default 'pending' check (pending|drafted|approved|sent|declined)
asked_at              timestamptz NOT NULL default now()
created_at            timestamptz NOT NULL default now()
```

---

## TIER 2 — LOCKED schema, FE wiring in progress

These columns are frozen. Outstanding work is FE-side: wiring the writes correctly.

### `business_events`
```
id             uuid PK
user_id        uuid NOT NULL FK→auth.users
event_type     text NOT NULL  -- quote_created, quote_sent, job_started, invoice_paid, signup_completed, onboarding_completed, ...
entity_type    text NOT NULL  -- quote, job, invoice, customer, material, user
entity_id      text NOT NULL
payload        jsonb NOT NULL default '{}'
trade          text
country        text
session_id     text
screen_context text
created_at     timestamptz NOT NULL default now()
```
*FE writes via `dataCollector.flushToCloud()` — 30s batch, max 50/batch. R275 also routes entity-CRUD offline queue through `dataProvider` (was a stub).*

### `pricing_intelligence`
```
id                              uuid PK
user_id                         uuid NOT NULL FK→auth.users
trade                           text NOT NULL
country                         text NOT NULL default 'NL'
job_type                        text
quote_id                        text
line_description                text NOT NULL
quoted_unit_price               real NOT NULL
quoted_quantity                 real NOT NULL
quoted_total                    real NOT NULL
vat_rate                        real default 21.0
was_accepted                    boolean
accepted_price                  real
actual_cost                     real
actual_hours                    real
margin_percent                  real
customer_type                   text check (residential|commercial|government)
region                          text  -- postcode prefix
postcode                        text  -- added 20260426000001
season                          text check (spring|summer|autumn|winter)
-- Moat enrichment (added 20260421000002):
decline_reason                  text check (price_too_high|chose_competitor|scope_changed|no_response|timing|customer_declined|other)
time_to_decision_hours          int
reminder_count_before_decision  int
counter_offer_amount            real
contractor_segment              text check (solo|small_team|medium|large)
-- Time-of-day acceptance (added 20260427000001):
sent_at                         timestamptz
sent_at_hour                    smallint check (0-23)
sent_at_dow                     smallint check (0-6)
quoted_at                       timestamptz NOT NULL default now()
accepted_at                     timestamptz
completed_at                    timestamptz
created_at                      timestamptz NOT NULL default now()
```
*All silent-failure paths now log to `eve_telemetry` with `action_type='intelligence_write_failure'` (R275).*

### `quote_line_deltas`
```
id                  uuid PK
user_id             uuid NOT NULL FK→auth.users
quote_id            text
line_item_id        text NOT NULL
sku                 text
description         text
original_qty        numeric
new_qty             numeric
original_unit_price numeric
new_unit_price      numeric
source              text NOT NULL check (photo_handoff|ai_draft|template|cohort|manual)
trade               text
country             text
postcode            text
reason_code         text check (waste_underestimated|measurement_correction|labor_underestimated|customer_upgrade|local_supplier_cheaper|site_condition_harder|other)
free_text_reason    text
created_at          timestamptz NOT NULL default now()
```

### `job_outcomes`
```
id              uuid PK
user_id         uuid NOT NULL FK→auth.users
job_id          text NOT NULL
job_type        text
trade           text
estimated_hours real
actual_hours    real
estimated_cost  real
actual_cost     real
margin_percent  real
customer_id     text
postcode        text
completed_at    timestamptz NOT NULL
created_at      timestamptz NOT NULL default now()
```

### `invoice_outcomes`
*Seeded by `dispatchPaidSideEffects` in mollie + stripe webhooks (R275). Required for DSO model training.*
```
id              uuid PK
user_id         uuid NOT NULL FK→auth.users
invoice_id      text NOT NULL
customer_id     text
amount          real NOT NULL
issued_at       timestamptz NOT NULL
due_at          timestamptz NOT NULL
paid_at         timestamptz
days_to_payment int
is_overdue      boolean default false
created_at     timestamptz NOT NULL default now()
```
**Blocker:** mollie/stripe webhooks must insert here on payment confirmation.

### `accounting_loops`
UNIQUE: `(user_id, job_id)` — required by FE upsert in `cloudSync.persistAccountingLoop` (added in migration 20260501000002).
```
id                   uuid PK
user_id              uuid NOT NULL FK→auth.users
job_id               text NOT NULL
customer_id          text NOT NULL
quote_id             text
invoice_id           text
payment_id           text
external_invoice_id  text
current_stage        text NOT NULL
amounts              jsonb NOT NULL default '{"quoted":0,"agreed":0,"invoiced":0,"paid":0}'
history              jsonb NOT NULL default '[]'
created_at           timestamptz NOT NULL default now()
updated_at           timestamptz NOT NULL default now()
```

### `affiliate_clicks`
PK: `id` (text)
```
id                    text PK
user_id               uuid NOT NULL FK→auth.users
supplier_id           text NOT NULL
supplier_name         text
clicked_at            timestamptz NOT NULL default now()
converted             boolean default false
order_value           numeric(10,2)
commission            numeric(10,2)
estimated_commission  numeric(10,2)
created_at            timestamptz NOT NULL default now()
```

### `purchase_orders`
```
id                 uuid PK
user_id            uuid NOT NULL FK→auth.users
supplier_name      text
items              jsonb NOT NULL default '[]'
total              numeric(12,2)
status             text NOT NULL default 'draft' check (draft|submitted|confirmed|delivered|cancelled)
external_ref       text
external_provider  text
submitted_at       timestamptz
created_at         timestamptz NOT NULL default now()
updated_at         timestamptz NOT NULL default now()
```

### `supplier_connections`
PK: `(user_id, supplier_id)`
```
user_id           uuid NOT NULL FK→auth.users (cascade)
supplier_id       text NOT NULL check (hornbach|rexel_nl|bouwmaat|technische_unie|solar_nl|bauhaus)
access_token      text NOT NULL
refresh_token     text
expires_at        timestamptz
scopes            text
account_reference text
connected_at      timestamptz NOT NULL default now()
updated_at        timestamptz NOT NULL default now()
```
**Encryption required at rest in production.**

### `scanned_invoices` (mobile photo OCR path)
*Mobile camera → analyze-photo edge fn → direct insert. Line items as JSONB.*
PK: `id` (text)
```
id              text PK
user_id         uuid NOT NULL FK→auth.users
document_type   text NOT NULL check (invoice|receipt|delivery_note|quote)
supplier_name   text
supplier_address text
supplier_vat    text
document_number text
document_date   date
subtotal        numeric(12,2)
vat_amount      numeric(12,2)
total           numeric(12,2)
currency        text default 'EUR'
payment_terms   text
confidence      int
line_items      jsonb default '[]'
image_path      text
scanned_at      timestamptz NOT NULL default now()
created_at      timestamptz NOT NULL default now()
```

### `extracted_documents` + `extracted_line_items` (PDF/spreadsheet bulk-upload path)
*Used by `app/(modals)/ingestion.tsx` for desktop-style bulk receipt upload. Normalized parent+child with `pending|reviewed|imported|rejected` review workflow. Distinct from `scanned_invoices` (single mobile photo). Both flow into `material_price_history`.*

```
extracted_documents.id            uuid PK
extracted_documents.user_id       uuid NOT NULL FK→auth.users
extracted_documents.source_type   text check (pdf|camera|paste|excel|csv)
extracted_documents.source_uri    text
extracted_documents.doc_type      text check (invoice|quote|receipt|unknown)
extracted_documents.supplier_name text
...
extracted_documents.status        text default 'pending' check (pending|reviewed|imported|rejected)

extracted_line_items.id           uuid PK
extracted_line_items.document_id  uuid NOT NULL FK→extracted_documents (cascade)
extracted_line_items.description  text NOT NULL
extracted_line_items.quantity     numeric(10,2)
extracted_line_items.unit_price   numeric(12,2)
extracted_line_items.brand        text
extracted_line_items.category     text
extracted_line_items.article_number text
extracted_line_items.confidence   numeric(3,2)
```

### `material_price_history`
*Cross-contractor pool — owner identifier is `observed_by`, NOT `user_id`. RLS allows all authenticated to read; contributors see their own via `observed_by = auth.uid()`. **Per-purchase quantity/total go to `business_events` (entity_type='material'), NOT here.***
```
id                  uuid PK
trade               text NOT NULL
country             text NOT NULL default 'NL'
material_name       text NOT NULL
material_category   text
brand               text
ean_code            text
unit                text NOT NULL
supplier_id         text NOT NULL
supplier_name       text NOT NULL
price_excl_vat      real NOT NULL
currency            text default 'EUR'
vat_rate            real default 21.0
in_stock            boolean
lead_time_days      int
minimum_order_qty   real
is_promotion        boolean default false
observed_by         uuid FK→auth.users (set null)
postcode            text          -- added 20260426000001
source              text check (manual|api|invoice_scan|catalog)
observed_at         timestamptz NOT NULL default now()
```

### `job_photos` (Storage bucket + table)
Storage path template: `{user_id}/{job_id}/{uuid}.{jpg|png}`
```
id            uuid PK
user_id       uuid NOT NULL FK→auth.users
job_id        uuid FK→jobs
storage_path  text NOT NULL
caption       text
kind          text  -- before|during|after|defect|reference
taken_at      timestamptz
created_at    timestamptz NOT NULL default now()
```

### `projects` (NEW — see P1-6)
*Added in v1.0 to back the aannemer multi-job grouping currently held in AsyncStorage.*
```
id          uuid PK
user_id     uuid NOT NULL FK→auth.users (cascade)
name        text NOT NULL
customer_id uuid FK→customers (set null)
status      text NOT NULL default 'planning' check (planning|active|completed|on_hold|cancelled)
start_date  date
end_date    date
created_at  timestamptz NOT NULL default now()
updated_at  timestamptz NOT NULL default now()
```
RLS: owner read/write
Idx: (user_id, status)

---

## TIER 3 — BE-WRITTEN, RPC-ONLY READS

FE never reads these tables directly. Lock the **RPC return shape**, not the table.

Tables in this tier:
- `learning_profiles`, `calibration_entries`, `feedback_weights`
- `contractor_skill_profiles`, `ai_models`, `ai_predictions`
- `cohort_benchmarks`, `cohort_weekly_stats`
- `data_events` (superseded by `business_events`)
- `model_training_pairs`
- `ml_cashflow_gap_predictions`, `ml_supplier_leadtime_predictions`, `ml_material_price_forecasts`, `ml_capacity_overrun_predictions`
- `customer_embeddings`, `material_embeddings`, `quote_line_embeddings`, `job_embeddings`
- `photo_analyses`, `job_quality_signals`
- `customer_portal_events`, `moat_schema_metadata`, `generator_dismissals`
- `ts_daily_business_metrics`, `churn_winback_log`, `push_notification_log`
- `integration_connections`

---

## RPCs — LOCKED SIGNATURES

```
next_document_number(p_doc_type text) → text
predict_customer_dso(p_user_id uuid, p_customer_id text)
  → { predicted_dso int, confidence numeric, historical_avg numeric, payment_count int, on_time_rate numeric }
  -- Note: customer_id is text (not uuid) — `customers.id` is uuid but pricing_intelligence/job_outcomes hold it as text.
get_trade_pricing_stats(p_trade text, p_country text, p_job_type text DEFAULT NULL, p_months int DEFAULT 6)
  → { avg_hourly_rate, median_hourly_rate, p25_hourly_rate, p75_hourly_rate, avg_margin, acceptance_rate, sample_size }
match_similar_customers(p_user_id uuid, p_query_text text, p_limit int DEFAULT 5)
  → [{ customer_id text, similarity numeric }]
match_similar_materials(p_query_key text, p_limit int DEFAULT 5)
  → [{ material_key text, similarity numeric }]
match_similar_jobs(query_embedding vector(384), match_trade text, match_country text, match_threshold numeric, match_count int)
  → [{ job_id, job_description, job_type, actual_cost, actual_hours, margin_percent, similarity }]
get_or_create_referral_code(p_user_id uuid) → text
attribute_referral(p_code text, p_new_user_id uuid) → uuid (attribution id) | null
  -- FE wrapper `attributeReferral` coerces to boolean for the "did it work" path.
  -- Use `attributeReferralWithId` to keep the id.
get_referral_summary(p_user_id uuid)
  → { code text, total_referrals int, pending_count int, activated_count int, credited_count int }
get_credits_summary(p_user_id uuid)
  → { total_months int, redeemed_months int, available_months int }
consume_subscription_credits(p_user_id uuid, p_max_months int)  -- service_role only
  → [{ id uuid, months_free int }]
restore_subscription_credits(p_consumed_ids uuid[])  -- service_role only
  → int
grant_referral_credits()
  → [{ attribution_id uuid, referrer_user_id uuid, referred_user_id uuid, credits_granted int }]
get_quote_engagement(p_quote_id text)
  → { total_events int, unique_sessions int, portal_opened_count int, quote_viewed_count int,
      price_expanded_count int, line_clicked_count int, photo_viewed_count int,
      accept_hovered_count int, decline_hovered_count int, question_started_count int,
      question_sent_count int, total_engagement_seconds numeric, first_seen_at timestamptz,
      last_seen_at timestamptz, decided boolean, decision text }
get_quote_engagement_features(p_quote_id text) → jsonb
get_postcode_cohort_stats(p_trade text, p_country text, p_postcode_prefix text, p_months int DEFAULT 6)
  → { avg_unit_price, median_unit_price, avg_margin, acceptance_rate, sample_size, contractor_count }
get_time_of_day_acceptance(p_trade text, p_country text, p_months int DEFAULT 6)
  → [{ hour_of_day smallint, day_of_week smallint, acceptance_rate numeric, sample_size int, contractor_count int }]
get_time_of_day_payment_timing(p_trade text, p_country text, p_months int DEFAULT 6)
  → [{ hour_of_day smallint, day_of_week smallint, paid_rate numeric, median_days_to_paid numeric, sample_size int, contractor_count int }]
get_signup_cohort_retention(p_weeks_back int, p_max_week_offset int, p_country text DEFAULT NULL, p_trade text DEFAULT NULL)
  → [{ cohort_week text, cohort_size int, weeks_since_signup int, active_users int, retention_pct numeric }]
get_global_generator_rates()
  → [{ generator_id text, approval_rate numeric, total_events int, contractor_count int }]
get_quote_line_recommendations(p_trade, p_country, p_existing_descriptions text[], p_limit int)
  → [{ recommended_description text, recommended_unit_price numeric, recommendation_rate numeric, contractor_count int, sample_size int }]
get_photo_analysis_cohort(p_trade text, p_country text, p_complexity text)
  → { avg_duration_hours, avg_cost_eur, median_cost_eur, sample_size, contractor_count }
get_customer_quality_weight(p_customer_id text) → numeric
query_daily_metrics(p_user_id uuid, p_days int)
  → [{ day date, quotes_sent int, quotes_accepted int, invoices_sent int, invoices_paid int, total_quoted_eur numeric, total_paid_eur numeric }]
query_margin_trend(p_trade, p_country, p_months)
  → [{ month text, avg_margin numeric, median_margin numeric, quotes int }]
query_winrate_distribution(p_trade, p_country)
  → [{ amount_bucket text, win_rate numeric, quotes int, contractors int }]
describe_moat_schema()
  → [{ table_name, column_name, business_meaning, data_type, unit, valid_range, example_value }]
write_training_pair(...) → uuid  -- service_role only
refresh_intelligence_aggregates() → void  -- service_role only
refresh_generator_approval_rates() → void  -- service_role only
```

**K-anonymity invariant:** every cohort RPC returns `null`/empty when `contractor_count < 5` or `sample_size < 20`. FE must handle null gracefully.

---

## EDGE FUNCTIONS — LOCKED PAYLOADS

```
analyze-photo
  IN  { imagesBase64?: string[], imageUrls?: string[], country?: string, mode: 'quote'|'certificate'|'invoice' }
  OUT { lineItems?: [...], defects?: [...], detectedRooms?: string[], estimatedComplexity?: string }

predict-price
  IN  { trade: string, country: string, jobType?: string, description?: string }
  OUT { low: number, mid: number, high: number, confidence: number, basis: string }

predict-duration
  IN  { trade: string, description: string, ... }
  OUT { hours: number, confidence: number, basis: string }

verify-quote-token  (anon)
  IN  { quoteId: string, token: string }
  OUT { ok: boolean, quote?: PortalQuote, error?: string }

sign-quote-token  (auth required)
  IN  { quoteId: string }
  OUT { ok: boolean, url?: string, token?: string, error?: string }

send-invoice
  IN  { invoiceId: string, recipientEmail: string, subject?: string, message?: string }
  OUT { ok: boolean, messageId?: string, error?: string }

create-subscription-checkout
  IN  { tier: 'advanced'|'pro'|'contractor', billingCycle: 'monthly'|'yearly' }
  OUT { ok: boolean, url?: string, error?: string }

embed-text
  IN  { table: string, key: string, text: string, userId?: string, quoteId?: string }
  OUT { ok: boolean, dimensions?: number, provider?: string, error?: string }

classify-customer-question
  IN  { trackerAccessToken: string, question: string, customerName?: string, language?: string, context?: { trade?: string, country?: string, ... } }
  OUT { ok: boolean, classification?: string, stance?: 'positive'|'neutral'|'negative', error?: string }
  -- Token is required because portal is anon — token authorizes access to the tracker context.

draft-customer-reply
  IN  { question: string, context?: string, tone?: string }
  OUT { ok: boolean, options?: ReplyOption[], error?: string }

request-account-deletion (auth required)
  IN  { userId: string, requestedAt: ISO8601, platform: string }
  OUT { ok: boolean, requestId?: string }
  -- FE-triggered enqueue. Drained server-side by drain-account-deletions cron.

generate-embedding (auth required)
  IN  { text: string }
  OUT { embedding: number[] }

export-invoice (auth required, called from offline-queue drain)
  IN  invoice payload (full Invoice)
  OUT { ok: boolean, externalId?: string }

drain-account-deletions  (cron, service_role)
  IN  {}  OUT { processed: number }

grant-referral-credits  (cron, service_role)
  IN  {}  OUT { granted_count: number, attributions: [...] }

mollie-webhook  (provider-signed)
  IN  { id: string, event_type: string, ... } (Mollie payload)
  OUT 200 (always)
  SIDE EFFECTS: webhook_idempotency dedup → invoice_outcomes insert → business_events insert

stripe-webhook  (provider-signed)
  IN  Stripe.Event
  OUT 200
  SIDE EFFECTS: same as mollie

place-supplier-order
  IN  { supplierId: string, items: [...], purchaseOrderId: uuid }
  OUT { ok: boolean, externalRef?: string, error?: string }

daily-push-digest  (cron, service_role)
weekly-digest  (cron, service_role)
weekly-retrain-models  (cron, service_role)
churn-winback-email  (cron, service_role)
train-extra-models  (cron, service_role)
```

---

## RLS POLICY PATTERNS

1. **Owner-read** (most personal data): `USING (user_id = auth.uid())`
2. **Service_role only** (sensitive ops): `USING (auth.role() = 'service_role')`
3. **Public read, service_role write** (`feature_flags`): `FOR SELECT USING (true); FOR ALL USING (auth.role() = 'service_role')`
4. **Anon insert, owner read** (portal tables): contractor + anon validated via Edge function
5. **Authenticated read aggregate** (`cohort_benchmarks`): readable by all authenticated users; aggregates hide PII

**Test invariant:** logging in as user A and querying user B's `pricing_intelligence`, `quote_line_deltas`, `business_settings`, `subscriptions`, or `documents` MUST return zero rows.

---

## CHANGELOG

- **1.0 (2026-05-01)** — Initial freeze. Added `projects` table. Documented `attribute_referral` returning uuid (FE wrapper exposes both boolean and uuid variants).
- **1.3 (2026-05-01)** — Offline queue coverage closed (R277):
  - New helper `persistOrQueue(table, op, fn, fallback)` in `offlineWriteQueue.ts` for one-line BE-write-with-fallback at AppState mutation sites.
  - Wired into `updateJobStatus`, `updateJob`, `removeJob`, `updateBusinessProfile`, `addMaterial`, `removeMaterial`, `addSupplier`, `removeSupplier`, `updateJobMaterialStatus`, `removeJobMaterial`, `updateQuote`. Coverage: 12 of 35 BE writes now have offline-queue fallback (was 3). Remaining 23 are derived/secondary writes (line_items upsert, document number generation, etc.) — log-only is acceptable.
  - **Temp ID hazard fixed:** `applyWrite` strips client-generated temp IDs (`c-*`, `j-*`, `mat-*`, `sup-*`, `jm-*`, `proj-*`, `q-*`, `inv-*`) from insert payloads so BE generates fresh uuids via column defaults. Update/delete entries targeting temp `rowId` are dropped quietly (BE never persisted the original create — local state remains source of truth until next online-create).
  - 4 new offline queue unit tests (5/5 passing including the existing 2).

- **1.2 (2026-05-01)** — Round 2 wiring:
  - `projects` migration extended with `description`, `target_end_date`, `actual_end_date`, `total_budget/quoted/invoiced/paid`, `address` (jsonb), `milestones` (jsonb).
  - `addProject` / `updateProject` in AppState now BE-persist via `dataProvider.createProject/updateProject` with offline queue fallback.
  - `refreshData` loads `projects` rows from BE into local state on app mount.
  - `export-invoice` removed from syncService action handler — no edge fn deployed; queued actions drop gracefully.

- **1.1 (2026-05-01)** — Column-level audit (R275 second pass):
  - `pricing_intelligence`: documented moat-enrichment columns from migration 20260421000002 (decline_reason, time_to_decision_hours, reminder_count_before_decision, counter_offer_amount, contractor_segment).
  - `material_price_history`: clarified `observed_by` (not `user_id`) is the owner col; FE write fixed to use `price_excl_vat`/`lead_time_days` instead of nonexistent `unit_price`/`delivery_days`/`quantity`/`total_price`.
  - `business_events`: removed FE-WRITE-BLOCKED warning (writes always worked via dataCollector.flushToCloud; the P0-1 fix routed entity-CRUD offline queue through dataProvider).
  - `invoice_outcomes`: removed P0-4 warning — wired in mollie/stripe webhooks via `dispatchPaidSideEffects(paidAt)`.
  - `accounting_loops`: added unique constraint on `(user_id, job_id)` (migration 20260501000002) to back the FE upsert.
  - `predict_customer_dso`: corrected `p_customer_id` type from uuid → text.
  - `classify-customer-question`: corrected payload to match impl (`trackerAccessToken`, `question`, nested `context`).
  - Added `generate-embedding`, `request-account-deletion`, `export-invoice` to edge fn payload list.

# Vasco Launch Checklist

Tracks everything required to publish Vasco to App Store + Google Play and enable live Supabase for EU6 markets.

## ✅ Done R66r49 (NL launch readiness, 2026-05-09 — autonomous)
- [x] **EAS project linked** — `@collectai/VascoApp` (id `eebc2577-cbf8-4252-9b6c-f91119c17b7d`). `app.json:expo.extra.eas.projectId` populated. Production push tokens will work.
- [x] **OTA updates URL** — `https://u.expo.dev/eebc2577-cbf8-4252-9b6c-f91119c17b7d`. Hotfix path open.
- [x] **Migration `20260508000001` pushed** — `documents.delivery_date` + `line_items.vat_rate`. NL Belastingdienst Art. 35 + mixed-VAT quotes durable across cold start.
- [x] **Sentry SDK installed** — `@sentry/react-native` + auto-registered config plugin. Wrapper at `src/lib/errorReporting.ts` lazy-requires the SDK at init.
- [x] **Privacy Manifest moved to app.json** — was at `ios/PrivacyInfo.xcprivacy` but never registered in Xcode. Now at `expo.ios.privacyManifests`; expo prebuild regenerates and registers it correctly. Bonus: deduped `associatedDomains` (6→3) + `CFBundleLocalizations` (12→6).
- [x] **`pack-trigger-tick` edge fn deployed** — server-side daily eval of Incasso (5 buckets) + Quote followup (2) + Handover-survey (1) + Maintenance (2). 10 server-side push touchpoints across 4 packs.
- [x] **`send-automation-preview` edge fn deployed** — emails any pack/step preview to a target inbox. Blocked by missing `RESEND_API_KEY`.
- [x] **Legal docs refreshed** (R66r49 #10): privacy-policy + terms-of-service + cookie-policy + AUP + EULA + DPA + GDPR DSR all updated 2026-05-09. Added Stripe + Resend + Sentry + Expo Push as sub-processors. Wa.me deep-link customer-data flow disclosed. EU 2011/7/EU disclosure on Incasso 14d/30d disclosed in ToS. Domain consistency across all docs (vasco.dev → vasco.app).
- [x] **755 tests / 72 suites** + 0 TS errors at commit `89a5f50`.

## ✅ Done (autonomous — no credentials needed)
- [x] Root `tsconfig.json` scoped so `npx tsc --noEmit | grep "^app/"` is a reliable gate (0 errors).
- [x] Demo mode properly gated — `DEMO_MODE` false in prod blocks demo accounts.
- [x] Hardcoded `DEMO_PASSWORD` constant removed.
- [x] `MOCK_QUOTE` → real quote loader in customer-view (falls back to `DEMO_QUOTE` only when no `quoteId` param).
- [x] Mollie mock checkout gated behind `__DEV__` / `EXPO_PUBLIC_DEMO_MODE`; returns explicit error in prod.
- [x] Payment success URL → `EXPO_PUBLIC_PAYMENT_SUCCESS_URL` env var.
- [x] `npm audit`: 14 vulns → 5 (dev-only). xlsx replaced with SheetJS CDN build.
- [x] `app.json`: full iOS `infoPlist` (camera/photos/face id usage strings, `ITSAppUsesNonExemptEncryption`, CFBundleLocalizations), Android permissions + blocked permissions, `runtimeVersion` policy, `assetBundlePatterns`, notification/image-picker plugin configs.
- [x] `eas.json` scaffolded (dev, preview, production profiles; submit placeholders).
- [x] `.env.example` expanded with server-vs-client secret guidance + Sentry/legal/demo flags.
- [x] `.gitignore` updated (secrets/, google-services files, admin/.next).

## 🗺 Phase-2 roadmap (post-launch, builds on credentials)
- [x] **VAT prep (Truewind pattern)** — R169 (2026-04-16). NL BTW Q-prep: `src/services/vatPrepService.ts` classifies invoices + expenses per rubriek (1a/1b/1c/2a/3a/3b/4a/5b), flags 9% + verleggingsregeling as low-confidence, YoY variance (30%), warnings. `app/contractor/vat-prep.tsx` — period picker (prev/current), safety banner, totals, review. Entry card in geld tab (NL-gated). **Never auto-submits.** Next: DE/FR/ES/IT/UK (+1-2 wks per country).
- [x] **Customer-reply AI in decisions portal (Decagon pattern)** — R168 (2026-04-16). Edge Function `classify-customer-question` (Claude Haiku 4.5), stakes classification, low+≥0.75 auto-send else high→contractor VascoCard. Migration `20260417_customer_questions.sql`. Portal UI card grounded on completed decisions + business context.
- [x] **Supplier-affiliate ledger** — R166 (2026-04-16). `supplierBacklinkService` trackClick/openSupplierLink/getRevenueSummary. Offline queue + foreground flush. Migration `20260417_affiliate_clicks.sql`. Admin revenue dashboard `RevenueSnapshot` includes click + estimated + converted commission.
- [x] **Late-payment autopilot (EU Directive 2011/7/EU)** — R167 (2026-04-17). `lateFeeService.computeLateFee()` ECB refi + 8pp margin (B2B), UK tiered recovery £40/£70/£100, consumer-skip. `reminderCadenceService.renderReminder` appends disclosure on firm/final steps. `send-invoice` Edge Function accepts `bodyOverride`. Invoice detail shows live "Entitled: €X late-fee + recovery" badge. 13/13 unit tests pass.
- [x] ~~**Field Q&A over NEN/DIN/NF/UNE/BS corpus (Hebbia/Harvey pattern)**~~ — **DROPPED (2026-04-17)** after EU fact-check. Blockers: (1) National standards are copyrighted, per-copy €65–€516, licences explicitly bar AI ingestion; EU AI Act + DSM Directive Art. 4(3) require rightsholder authorisation, and standards bodies are building MARSS to enforce opt-outs. (2) Market already served — trade bodies (Techniek Nederland, ZVEH), manufacturer tools (Hager Ready, 60k+ installs) offer free/subsidised compliance lookup. (3) EU installers carry personal liability to inspection — a cited AI answer gives no legal defence, so no risk-reduction wedge. Feasible variant if revisited: RAG over **free** corpora only (government building regs, manufacturer docs, contractor's own job history) + white-label deal with one trade body that holds bulk licences.

## 🕳 Known gaps (blocked on live Supabase or requires data migration)

### Cross-contractor pricing moat — **code-fixed 2026-04-21, validation pending Supabase creds**
Previously 40% operational (audited 2026-04-17). New migration `20260421_cohort_moat_fix.sql` addresses every known defect; end-to-end verification still requires a live Supabase to run the RPCs against real rows.

**Shipped in R187 (2026-04-21):**
- ✅ `get_trade_pricing_stats` rewritten to read from `pricing_intelligence` (not the nonexistent `learning_profiles`). Returns NULLs + `sample_size=0` when fewer than 5 distinct contractors contributed (k-anonymity gate).
- ✅ `compute_weekly_cohort_stats` rewritten to aggregate real columns from `pricing_intelligence`, joined against `job_duration_data` (for duration ratio) and `customer_payment_patterns` (for DSO). `HAVING COUNT(DISTINCT user_id) >= 5`.
- ✅ Trigger `trg_quote_accepted_cohort` on `business_events` fires `compute_weekly_cohort_stats(NULL)` whenever a `quote_accepted` row is inserted (fire-and-forget, wrapped to never block the insert).
- ✅ `material_price_history` raw SELECT policy replaced with owner-only (`auth.uid() = observed_by`). Authenticated clients read aggregates via the new `material_price_benchmarks` VIEW (per trade×country×material×unit, >=5 observers required). New RPC `get_material_cohort_stats` wraps the view for the client.
- ✅ `useCohortBenchmarks` now imported and rendered in `TieredQuoteBuilder.tsx` preview step — shows "Similar {trade} jobs in {country}: €X/u · Y% accept · Based on N quotes from M contractors" inside the Vasco advice card. Hidden when below k-anonymity threshold.
- ✅ `cohortBenchmarkService.fetchCohortFromCloud` consumes the new RPC shapes correctly; previous implementation assumed `.materials`/`.trades` keys that never existed.
- ✅ 3 new i18n keys × 6 locales (`quotes.cohortBenchmark`, `quotes.cohortAcceptance`, `quotes.cohortSample`).

**Still pending live Supabase:**
1. `supabase db push` the new migration on the prod project.
2. Run `SELECT compute_weekly_cohort_stats();` once to backfill the first week's row.
3. Verify `SELECT * FROM get_trade_pricing_stats('plumbing','NL');` returns sample_size>0 once real data lands.
4. Confirm trigger fires by tailing `business_events` and checking `cohort_weekly_stats.computed_at` advances.

### Moat enrichment (R188, 2026-04-21) — additive, schema-stable
Second migration `20260421_moat_enrichment.sql` deepens the signal without any renames/drops/type-changes (every ALTER is `ADD COLUMN IF NOT EXISTS`, every RPC is `CREATE OR REPLACE`).

- **New pricing_intelligence columns** (all optional, CHECK-constrained enums): `decline_reason`, `time_to_decision_hours`, `reminder_count_before_decision`, `counter_offer_amount`, `contractor_segment` (solo/small_team/medium/large). Two partial indexes (`idx_pricing_segment`, `idx_pricing_decline`) only index rows where the column is set, so the cost on legacy rows is zero.
- **New `contractor_pricing_calibration` table** (unique on `user_id+trade+country`). Stores per-user deltas vs cohort median: price %, acceptance pp, margin pp, with confidence score. Owner-only RLS.
- **New RPC `compute_contractor_calibration(user_id, trade, country)`** — upserts calibration from last 12 months of pricing_intelligence, excluding self from cohort (no self-bias), gated by k-anonymity ≥5 cohort contractors + ≥5 own samples.
- **New RPC `get_contractor_calibration(...)`** — thin reader.
- **New RPC `get_line_item_edit_distribution(trade, country, description_like)`** — aggregates `quote_line_deltas` to answer "how does the cohort typically adjust this line?" with median qty/price delta % and top reason code. K-anonymity ≥5.
- **New trigger `trg_quote_outcome_calibration`** on `business_events` fires `compute_contractor_calibration` for the emitting user whenever `quote_accepted` or `quote_rejected` lands. Wrapped so it can't block the insert.

**Client side (same round):**
- `dataCollector.recordPricingOutcome` gains 5 optional fields (`declineReason`, `timeToDecisionHours`, `reminderCountBeforeDecision`, `counterOfferAmount`, `contractorSegment`); patch is built conditionally so re-decisions don't overwrite prior values with null.
- `dataCollector.recordPricingData` gains optional `contractorSegment`.
- `Quote` domain type gains `declineReason?` + `counterOfferAmount?` for future reject-flow UI.
- `AppState.updateQuote` now computes `timeToDecisionHours` from `quote.sentAt` and pipes `declineReason` + `counterOfferAmount` from the update. Hardcoded `'general'/'NL'` replaced with `businessProfile.trade/country` at the `recordPricingData` call site.
- New hook `useContractorCalibration(userId, trade, country)` + plain async `getContractorCalibration`, `getLineEditDistribution` in `cohortBenchmarkService.ts`.
- `TieredQuoteBuilder` preview step shows a personalized pill: "Your pricing vs cohort: +8% · +3pp acceptance · Based on your last 24 quotes (confidence 72%)". Hidden when confidence <30%.
- 3 new i18n keys × 6 locales (`quotes.calibrationLead` / `calibrationAccept` / `calibrationSample`).

**Schema-stability audit**: zero renames, zero drops, zero type changes, zero removed constraints. Existing `updateQuote({ status: 'rejected' })` calls still work without passing reason. The old `recordPricingOutcome({ wasAccepted })` signature is still valid. Migration can be re-applied.

### Moat — line-item hints, reverse loop, quote-win ML (R189–R191, 2026-04-21)
- **R189** Per-line cohort edit-distribution rendered under each service row in `TieredQuoteBuilder` preview step. K-anonymity ≥5 + localized reason-code labels × 6 locales.
- **R190** Reverse loop: `src/services/pricingMoatService.ts` `applyCohortAdjustments` applies cohort-typical qty/price deltas to AI-baseline lines BEFORE the contractor sees them. ±50% outlier cap. Contractor calibration applied at HALF weight. Batch RPC `get_line_adjustments_batch` (additive migration `20260421_moat_reverse_loop.sql`). Green "Vasco tuned N of M lines from K cohort decisions" badge. 10/10 unit tests.
- **R191** Cohort-trained logistic regression replaces heuristic-only `predictQuoteWin`. Migration `20260421_quote_win_model.sql` adds 3 RPCs (`get_quote_win_training_data`, `save_quote_win_model` SECURITY DEFINER, `get_quote_win_model`). Pure-JS LR in `src/services/quoteWinModelService.ts`: 5 features, 250-epoch gradient descent, L2=0.01, feature standardization. Opportunistic 7-day retrain, single-flight. Trained model wins when confidence ≥0.5; else heuristic. 10/10 unit tests.

### Moat — material price drift (R192, 2026-04-22) — second moat dimension
First non-pricing-per-se moat dimension — *supplier* signal instead of *quote* signal. Migration `20260422_material_drift.sql` adds RPC `get_material_drift(trade, country, recent_days=30, baseline_days=90, min_drift_pct=5.0)`: compares recent vs baseline window medians per (material, supplier) cell, emits drift_pct + baseline_price + recent_price + sample sizes + `is_market_wide` flag (true when ≥2 suppliers for the same material all drifted same direction, indicating a market shift vs a single-supplier anomaly). K-anonymity ≥3 recent observers per cell, baseline ≥3 samples.
Client: `src/services/materialDriftService.ts` with 6h AsyncStorage cache, severity bucket (medium 5-11%, high ≥12%, abs-value for drops), `useMaterialDrift` hook + `getMaterialDrift` + `refresh`. New `src/components/contractor/MaterialDriftCard.tsx` DK-themed, hidden when no signal, top 3 alerts with severity tone (amber/red up, green down), tappable to `/contractor/market-prices`. Wired into `geld` tab between VAT-prep and cashflow. 3 new i18n keys × 6 locales. 14/14 unit tests. Combined moat suites: 34/34 pass.

**Schema-stability audit (R192)**: one new RPC, zero table changes, zero column changes, zero renames. Re-runnable.

## 🔐 User must provide credentials
- [ ] Run `npx eas init` after `eas login` — fills `expo.extra.eas.projectId` in `app.json`.
- [ ] Create live Supabase project (or unpause current). Provide URL + anon key in `.env`.
- [ ] Push all `supabase/migrations` in order via `supabase db push`. Regenerate types: `supabase gen types typescript --linked > src/types/supabase.ts`.
- [ ] Mollie: live OAuth app + webhook secret. Connect per-user via in-app OAuth.
- [ ] Stripe (UK market): publishable + secret keys, webhook secret. (Round 8 adds stub integration.)
- [ ] Sentry: create org + project, paste DSN into `EXPO_PUBLIC_SENTRY_DSN`.
- [ ] Push notifications: FCM server key (Android), APNs p8 key (iOS) — upload to Expo via `eas credentials`.
- [ ] App Store Connect: create app record, set bundle ID `com.vasco.app`, provide Apple Team ID + ASC App ID into `eas.json` submit block.
- [ ] Google Play Console: create app, generate service account JSON, save as `./secrets/play-service-account.json`.

## ✅ Rounds 5-150 complete (autonomous)

### Photo-to-Quote Phase 1 (148-151)
- Round 148 — `AIQuoteFromPhoto` multi-photo (up to 5, camera + multi-select gallery)
- Round 149 — `analyze-photo` Edge Function accepts `imagesBase64[]` + cross-photo prompt
- Round 150 — Customer decisions portal: real photo upload → `customer-uploads` bucket → signed URLs on `DecisionSubmission.photoUrls[]`
- Round 151 — Contractor-side `PhotoSubmissionsPanel` + `photoQuoteHandoffService`: customer photos → "Draft quote" CTA → Edge Function with `imageUrls[]` → TieredQuoteBuilder prefilled
- Round 152 — Reason-code learning loop: `quote_line_deltas` migration + `reasonCodeService` + `ReasonCodeSheet` bottom sheet wired to `updateQuantity` — every AI-baseline edit becomes a delta with captured reason for downstream cohort aggregation
- Round 153 — Real-user attribution (`src/lib/currentUser.ts` + 25 call sites migrated off `'current-user'` literal) + onboarding→businessProfile wire so first-invoice legal gate passes for new users; auth expiry audit confirms auto-refresh → sign-out → redirect flow works
- Round 154 — RN-reliable customer photo upload (base64→Uint8Array matches `jobPhotoService`; portal picker now captures base64); cold-start `flushPendingDeltas`/`flushScanQueue` so offline-saved data lands without requiring a foreground cycle
- Round 155 — Structured login error codes (`LoginResult` discriminated union); network outages no longer look like "wrong password"; 5 new `auth.*` keys × 6 locales
- Round 156 — Signup screen at `/signup` (real-user account creation was missing entirely — `signUp()` had zero callers); "Check your email" pending state, DEMO_MODE gate, auth-group widened to include `/signup` + `/forgot-password`, 18 new i18n keys × 6 locales
- Round 157 — Auth callback route-group gate (unauth'd email-link taps no longer redirect before the callback runs) + new `/reset-password` screen so password-recovery emails can actually complete; 10 new i18n keys × 6 locales
- Round 158 — Unified accounting router now covers 7 providers (was 3): moneybird/xero/quickbooks + lexoffice/pennylane/holded/fattureincloud. `exportInvoice()` + `syncPaymentStatus()` routed per-provider using existing helpers.
- Round 159 — Payment providers: `AppState.createPaymentLink` now routes UK contractors to Stripe (GBP) and all others to Mollie (EUR); Mollie webhook normalizes `payment_provider: 'mollie'` for consistent admin revenue breakdown.
- Round 160 — Compliance: `ios/PrivacyInfo.xcprivacy` (Apple App Store requirement since 2024-05-01) + real `account_deletion_requests` table so "Delete my account" actually submits a GDPR Art. 17 request instead of showing a theatrical Alert

### Signature / gallery / share / gates (141-147)
- Round 141 — `SignaturePad` modal on job-detail completion flow
- Round 142 — Job "Photo" button → real `/contractor/job/[id]/photos` gallery
- Round 143 — `ShareQuoteButton` mounted on quote detail (signed portal link)
- Round 144 — 3 new i18n keys × 6 locales for signature flow
- Round 145 — `checkInvoiceReadiness` legal gate on invoice send (country-required fields)
- Round 146 — Tier-limit enforcement on new quote / invoice / job creation
- Round 147 — 5 new i18n keys × 6 locales (+ 6 dead routes repaired)

### EVE loop closed (134-140)
- Round 134 — `approveItem`/`rejectItem` emit `queue_item_approved/rejected` business events
- Round 135 — `recordOutcome` emits `queue_outcome_positive/negative/neutral`
- Round 136 — `insightScorer.refreshApprovalRateCache` merges outcome signal (±10% nudge)
- Round 137 — Force-refresh cache after approve/reject so next generator tick sees it
- Round 138 — `templates.*` block added to all 6 locales (10 keys each — invoice reminder / quote followup / etc.)
- Round 139 — 6 earlier UI keys backfilled to non-EN locales
- Round 140 — i18n:audit: 0 missing across all 6 locales

### Final EVE wiring (129-133)
- Round 129 — Customer auto-tag badges on customer-crm rows
- Round 130 — Customer dedup prompt before addCustomer
- Round 131 — Job completion per-trade checklist with missing-items Alert
- Round 132 — XRechnung/Factur-X export tier-gated via `canUseEInvoiceFormat`
- Round 133 — "On my way" Share via whatsappTemplateService on job detail

### Type clean (122-128)
- Round 122-128 — Project-wide TS 108 → 0 via targeted type drift fixes

### Infrastructure (5-14)
- Round 5 — Legal/GDPR wiring (login footer, cookie banner, analytics consent gate)
- Round 6 — Sentry-ready error reporting (no-op until DSN provided)
- Round 7 — Push token persistence (`push_tokens` table + upsert on login, unregister on logout)
- Round 8 — Payment hardening: Stripe mock-gated like Mollie, webhooks production-ready
- Round 9 — `docs/store-listings.md`: App Store + Play Store copy in EN/NL/DE/FR/ES/IT
- Round 10 — Public legal pages served from admin (`/legal/[slug]`, `/privacy`, `/terms`)
- Round 11 — `supabase/README.md` + `npm run supabase:types / supabase:push / supabase:reset`
- Round 12 — `.github/workflows/ci.yml` (tsc + admin build + npm audit on every push)
- Round 13 — Feature flags: `feature_flags` table + `useFeatureFlag` hook + kill-switch
- Round 14 — `docs/release-runbook.md` (end-to-end ship sequence)

### Supplier orders, offline CRM, analytics, AI replies, hours, decisions (89-97)
- Round 89 — `place-supplier-order` Edge Function + supplier_connections/PO migrations
- Round 90 — Offline-first addCustomer via offlineWriteQueue
- Round 91 — Analytics events snapshot + admin card
- Round 92 — `draft-customer-reply` Edge Function + client wrapper
- Round 93 — `dailyHoursService` per-day + live clock-in summary
- Round 94 — `customerPortfolioFilter` helpers
- Round 95 — Intelligence strict-type pass deferred
- Round 96 — document_number unique index + retry
- Round 97 — Customer decisions → decisionSyncService.submitDecision wired

### Forecast UI, tagging, suppliers, dunning (81-88)
- Round 81 — `CashFlowForecastCard` component for Vandaag/Geld
- Round 82 — `CustomerTagBadge` pill component
- Round 83 — `supplierOAuth` PKCE scaffold for 6 suppliers
- Round 84 — `costVarianceGenerator` flags >20% overruns
- Round 85 — `ShareQuoteButton` (signed URL → Share)
- Round 86 — `reminderCadenceService` day 3/7/14 escalation
- Round 87 — routeOptimizerService (already existed)
- Round 88 — `restockSuggestionService` consumption → PO draft

### Deep features + forecasting (73-80)
- Round 73 — Public quote portal consumes signed `verify-quote-token`
- Round 74 — SignaturePad SVG capture
- Round 75 — Job photo gallery screen
- Round 76 — `supabase/cron.sql` registration script
- Round 77 — WhatsApp Business templates + consent + `wa.me` deep-link
- Round 78 — Receipt PDF share-sheet flow
- Round 79 — Customer VIP tagging (LTV + on-time + freshness composite)
- Round 80 — 30-day cash-flow forecast using ML payment predictor

### Portal, admin, receipts, photos, digests, checklist (67-72)
- Round 67 — Signed quote portal tokens (HMAC, 90d TTL)
- Round 68 — Admin dashboard pulls real MRR + country breakdown
- Round 69 — Payment webhook fires receipt email + contractor push
- Round 70 — Job photo upload to `job-photos` bucket + `job_photos` table
- Round 71 — Weekly Monday-morning digest Edge Function
- Round 72 — Job completion checklist (per-trade required items)

### Server-side push + offline scans (65-66)
- Round 65 — `send-push` Edge Function fan-outs to Expo Push API with dead-token pruning
- Round 66 — `offlineScanQueue` with AsyncStorage + foreground flush

### Live function wiring (57-64)
- Round 57 — withTimeout on addCustomer / addQuote / addInvoice writes
- Round 58 — 3 generators emit enqueueHint (overdue, cert renewal, margin drift)
- Round 59 — vascoGuidance hook auto-enqueues hinted insights into the action queue
- Round 60 — invoiceScanService syncs scans to Supabase `scanned_invoices`
- Round 61 — aiQueueNotifier fires local push on first-time queue items
- Round 62 — business_settings extended with iban/bic/country/postcode/prefixes
- Round 63 — Vandaag AI queue already prioritized by onboarding prefs (confirmed)
- Round 64 — `npm run smoke:golden` CLI runner hits Supabase end-to-end

### Production polish (31-40)
- Round 31 — Stripe subscription webhook → `subscriptions` table sync
- Round 32 — Admin revenue dashboard driven by Supabase (`admin/src/lib/revenue.ts`)
- Round 33 — `A11yButton` wrapper for accessibility contract
- Round 34 — `npm run i18n:audit` (0 gaps across 6 locales)
- Round 35 — Notification plugin icon + androidMode
- Round 36 — `app/auth/callback.tsx` for Supabase reset/verify/magiclink
- Round 37 — `scanned_invoices` table + RLS (cross-device OCR history)
- Round 38 — Invoice PDF prints country-specific registration + VAT label
- Round 39 — `supabase/functions/_shared/ratelimit.ts`
- Round 40 — expo-doctor passes (scripts renamed, jest-expo pinned)
- Bonus — Legal screen compliance section filters by user.country (not all 6)

### Consistency, billing, review prep (23-30)
- Round 23 — Realtime multi-device sync for jobs/quotes/customers/documents
- Round 24 — Offline write queue (AsyncStorage) + foreground flush
- Round 25 — Deep linking (iOS associatedDomains, Android intentFilters, AASA/assetlinks endpoints)
- Round 26 — Unit tests: featureFlagService, offlineWriteQueue + CI job
- Round 27 — `create-subscription-checkout` Edge Function + `billingService`
- Round 28 — Maestro E2E smoke `.maestro/golden-path.yaml`
- Round 29 — Rate-limit + validated-insert on `customer_interactions`
- Round 30 — `docs/app-review-info.md` (App Store / Play Console paste-ready)

### Golden path & integrations (15-22)
- Round 15 — Quote accept → `convertQuoteToJob()` + `customer_interactions` table
- Round 16 — `send-invoice` Edge Function (Resend, EU6 HTML) + client wrapper wired
- Round 17 — Invoice payment realtime watcher → local push on `status=paid`
- Round 18 — `analyze-photo` Edge Function confirmed real (Claude Haiku Vision); prod mock fallback removed
- Round 19 — `EmptyState` on geld invoice + quote lists with CTAs
- Round 20 — Onboarding persists tier to `subscriptions` table
- Round 21 — XRechnung + Factur-X export buttons on invoice detail (DE/FR)
- Round 22 — Moneybird export is real end-to-end (find-or-create contact → POST invoice with tax-rate lookup)

## 📱 Store listing assets (user task)
- [ ] App Store screenshots: 6.7" iPhone (1290×2796), 6.5" iPhone, iPad 12.9" (for each EN/NL/DE/FR/ES/IT).
- [ ] Play Store screenshots (phone, 7" tablet, 10" tablet).
- [ ] Feature graphic (1024×500).
- [ ] App icon 1024×1024.
- [ ] Description copy per locale (short + long).
- [ ] Keywords per locale.
- [ ] Privacy policy + terms live at public URLs (configured via `EXPO_PUBLIC_PRIVACY_URL` / `EXPO_PUBLIC_TERMS_URL`).
- [ ] Support email, marketing URL.

## 🚢 Release process
1. `eas build --profile preview --platform all` → internal TestFlight / APK for QA.
2. `eas build --profile production --platform all` → signed binary.
3. `eas submit --profile production --platform ios` → App Store Connect.
4. `eas submit --profile production --platform android` → Play internal track.
5. Promote through closed → open testing → production.

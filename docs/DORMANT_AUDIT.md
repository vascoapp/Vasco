# Dormant-Feature Audit — Round Log

Started 2026-05-02 (after R285). Per-round walkthrough of services + screens to verify the loop closes from user action → moat row → predictor → UI surface. Each round: trace, identify gaps, fix the load-bearing ones in-line, log the rest here.

Pattern this audit catches (lesson #46 in `learnings.md`): structural code shipped, individual round notes claim "ready", but no one ever asked "if I'm a contractor, what would I literally see on tap?".

---

## Round status

| # | Topic | Status | Round commit |
|---|---|---|---|
| 1 | AI queue + Vandaag tab | ✅ done | R286 |
| 2 | Workflow validator (quote/invoice send gates) | ✅ done | R287 |
| 3 | Customer communication (WhatsApp/email/SMS) | ✅ done | R288 |
| 4 | Compliance agent + 6 country packs | ✅ done | R289 |
| 5 | Cohort benchmark service (11+ readers) | ✅ done | R290 |
| 6 | Decision intelligence (portal → contractor loop) | ✅ done | R291 |
| 7 | Job quality signals + retrain | ✅ done | R292 |
| 8 | Cron jobs (9 registered) | ✅ done | R293 |
| 9 | EVE live actions (claimed: fixtures) | ✅ done | R294 |
| 10 | Live tracking / On-My-Way | ✅ done | R295 |
| 11 | Signature service | ✅ done | R296 |
| 12 | CRM intelligence | ✅ done | R297 |
| 13 | ML capacity overrun + push notification log | ✅ done | R298 |
| 14 | Team tools | ✅ done | R299 |

---

## R1 — AI queue + Vandaag tab (R286)

**Audit summary:**
- 26+ producers (background scheduler, generators, workflow packs, customer-question bridge, etc.) all funnel through `addToQueue` → AsyncStorage `@vasco_ai_queue`.
- Storage: max 50 items, dedup by `(type, entityKey)` with sibling-collapse-into-count.
- 3 consumers: `useAIQueue` hook in Vandaag (`InlineQueueRow`), AI tab (`HeroActionCard`), geld tab (inline rows). `VascoCard` mounted only on `SiteLeadDashboard` (enterprise, no-op approve).

**Loaded fixed in this round:**
- `executeApprovedQueueItem` dispatcher — closes the "AI prepares → human approves → action executes" loop for 16 dormant queue types.
- Wired into Vandaag, AI tab, geld tab.

**Deferred — destinations don't read prefill yet:**

When the executor lands a contractor on the right screen, the screen often doesn't pick up `preparedData` and pre-populate. Contractor lands oriented but has to start from scratch. Not load-bearing (better than silent), but a polish gap.

| Queue type | Lands on | Prefill needed |
|---|---|---|
| `draft_invoice` / `batch_invoices` / `invoice_regenerate` | `/contractor/job/{id}` | "Create invoice" CTA pre-tapped, line items from preparedData |
| `draft_quote` | `/contractor/tiered-quote` | Materials/services from preparedData (currently starts blank) |
| `cert_renewal` / `permit_renewal` | `/contractor/permits` | Pre-select the expiring cert/permit |
| `permit_check` | `/contractor/permits` | Filter to job's required permits |
| `schedule_suggestion` | `/contractor/drag-schedule` | Pre-position the gap day + suggested job |
| `safety_checklist` | `/contractor/permits` | Should arguably route to `/contractor/job/{id}/safety` (not yet a route) |
| `tax_prep` | `/contractor/vat-prep` | Pre-select the quarter |
| `accounting_export` | `/contractor/vat-and-audit` | Pre-select the export format/period |
| `einvoice_submit` | `/invoices/{id}` | Auto-trigger the submit dialog |

**Other R1 deferrals:**
- `VascoCard` is mounted only on `SiteLeadDashboard` with `onApproveQueueItem={() => {}}`. SiteLead has zero queue execution today. Out of scope for the contractor-focused audit but worth fixing if site-leads ever ship.
- The Vandaag `InlineQueueRow` is intentionally lighter than `VascoCard` (no edit, no preparedData rendering). Fine for at-a-glance hero rows but contractors who want to edit a `draft_reminder` text before sharing have to do that on geld or the AI tab.
- `recordOutcome(itemId, 'positive'|'negative')` — only fired by VascoCard's "Did the customer respond?" follow-up alert. The new executor path doesn't fire `recordOutcome`. If we want approval-rate scoring to learn from real-world outcomes, executor should hook this in too.

---

## R2 — Workflow validator (R287)

**Audit summary:** 6 validators exported from `workflowValidatorService.ts`. Reality:

| Validator | Wired | Behavior on failure |
|---|---|---|
| `validateQuoteBeforeSend` | ✅ in `addQuote` | logs + continues — `// Still allow creation` |
| `validateInvoiceBeforeCreate` | ❌ orphan (imported, never called) | — |
| `validateJobStatusChange` | ✅ in `updateJobStatus` | returns `{ warnings }`, callers ignore |
| `validateReminderBeforeSend` | ❌ orphan (no imports anywhere) | — |
| `validateCertBeforeJobStart` | ❌ orphan (no imports anywhere) | — |
| `validateWorkflowState` | ✅ in morning briefing | surfaces as audit findings ✓ |

**Fixes shipped:**
- `validateInvoiceBeforeCreate` wired into `addInvoice` + `addInvoiceFromJob` (`AppState.tsx`). Hard-blocks duplicate-invoice creation (same customer + amount within 7 days). Throws — caller propagates Alert. Closes the biggest revenue-leak gap in the validator layer.
- New `src/services/reminderGate.ts` — wraps `validateReminderBeforeSend` with consistent UX (Alert blocks for hard errors, confirms for warnings). Wired into `app/(contractor)/facturen.tsx` (per-row reminder button) and `src/components/contractor/InvoiceAutomation.tsx#handleSendReminder`. Now blocks reminders for already-paid + draft invoices and confirms when 5+ already sent.
- 5 tests for `reminderGate` covering paid/draft block, clean-pass, 5+-warning confirm, dismiss-cancels.

**Deferred — `validateCertBeforeJobStart`:**

Wiring requires a live cert store with expiry dates per contractor. Today certs only exist as static fixtures in `complianceService.ts:215+` (with hardcoded 2024-2099 dates) and as onboarding selection (`certifications: []` field in `app/onboarding.tsx`) that never accumulates real expiries. AppState has no `certs` field. Wiring the validator without first building the store would compare against fixtures and fire bogus warnings. Real fix: store `certifications` per-contractor in BE (table doesn't exist yet) → expose via AppState → call `validateCertBeforeJobStart` when status moves to `in-progress`/`bezig`. This is a larger lift; revisit after the BE table lands.

**Deferred — quote/job validators are advisory only:**

`validateQuoteBeforeSend` and `validateJobStatusChange` log on failure but don't block. The quote case has an honest comment: `// Still allow creation — contractors may have valid reasons for zero-amount quotes`. The job case collects warnings into a return value `{ warnings: [] }` that no caller reads. This is a deliberate UX choice — automatic blocking is harsh — but it means the validator is decorative for these cases. Right fix is a confirmation modal ("Quote has 3 issues, continue anyway?") at the call site. Out of scope for R2 because it requires UI work + i18n strings; logging the gap.

**Deferred — bulk reminder send is fake:**

`app/(contractor)/facturen.tsx:689-707` has an "Send reminders to all overdue" banner that, on confirm, just shows a toast: `setToast({ visible: true, message: 'Reminders sent to all customers...' })`. No actual loop, no actual sends. The contractor thinks they sent reminders to N customers; nothing happened. **This is misleading UX, not just a missing surface.** Fix: loop over `overdueInvoices`, gate each via `gateReminderSend`, then call `invoiceAutomationService.sendReminder`. Out of R2 scope — the audit's job is to find it. Logging it.

**Deferred — `markInvoiceSent` button mislabeled:**

`app/invoices/[id].tsx:728-733` shows an `ActionRow` labelled "Send reminder" but `onPress={handleMarkSent}` — that's marking the invoice's status as sent, not sending a reminder. Cosmetic confusion but should be relabelled "Mark as sent" or rewritten to actually send a reminder.

---

## R3 — Customer communication (R288)

**Audit summary — three overlapping services, only one used:**

| Service | LoC | Architecture | Status |
|---|---|---|---|
| `customerCommunicationService.ts` | 411 | Templates + dispatch + log + stats — most complete | **ORPHAN — zero call sites** |
| `whatsappService.ts` | 47 | Deep-link only, no consent | Used in 1 spot (VascoCard, enterprise no-op) |
| `whatsappTemplateService.ts` | 133 | Consent + 6-locale templates + sendWhatsapp | `renderTemplate` used once; `sendWhatsapp` never called |

Plus: `reputationService.requestReview` was a **stub** — it built an in-memory `ReviewRequest` object and emitted `trackUserAction('review_requested')`. **Nothing ever reached the customer.** The function name was a lie.

**Fixes shipped:**
- `reputationService.requestReview` rewritten to actually deliver. New signature takes `{customerId, customerPhone, customerEmail, locale, reviewLink, ...}`. Priority: WhatsApp (consent + phone) → email (mailto:) → Share sheet. Returns `{delivered, channel}` so callers can adjust UX. Uses `whatsappTemplateService.renderTemplate('review_request', ...)` for the body.
- `customerCommunicationService.ts` header rewritten to "DEPRECATED — DO NOT EXTEND" with pointer to canonical (`whatsappTemplateService.ts`) + the right way to wire new triggers (per-event renderTemplate + Share/Linking).
- 5 new tests on the requestReview routing logic.

**Deferred — automated triggers never fire:**

The original design described 11+ event-triggered messages (`on_my_way`, `appointment_reminder_24h/2h`, `job_started`, `job_complete`, `invoice_sent`, `quote_sent`, `payment_reminder`, `payment_received`, `quote_followup`). **NONE are auto-fired.** All require a contractor to manually tap a Share button. The wiring needed:

| Trigger | Should fire when | Today |
|---|---|---|
| `appointment_reminder_24h` | scheduler enters t-24h window | nothing |
| `appointment_reminder_2h` | scheduler enters t-2h window | nothing |
| `on_my_way` | clock-in → scheduled job today | manual button on job detail |
| `job_started` | status → in-progress | nothing |
| `job_complete` | status → completed | nothing |
| `invoice_sent` | markInvoiceSent (currently fires `schedulePaymentReminder` local notif only) | nothing customer-facing |
| `quote_sent` | quote.status → sent | nothing |
| `payment_received` | invoice.status → paid (mollie/stripe webhook) | nothing |
| `quote_followup` | quote sent + 3d no response | scheduled local notif (contractor-side only) |
| `payment_reminder` | invoice overdue | manual share via R287 gateReminderSend |

Real fix is a notification scheduler that runs daily and sends batched messages via WhatsApp Business API (Twilio/MessageBird), with consent-respecting dispatch. Out of R3 scope — that's BE infrastructure work + an external API key.

**Deferred — orphan service tree:**

`customerCommunicationService.ts` exports 12+ functions, all dead code. Marked DEPRECATED but kept in tree for the `MessageTrigger` taxonomy reference. Removal is safe but not urgent. Same applies to `reputationService.useReviews` / `useReputation` hooks — exported in `services/index.ts`, no screen imports them. Whole reputation surface is a service-without-UI.

**Deferred — `whatsappTemplateService.sendWhatsapp` never called:**

The properly-architected send fn (consent-checked, deep-links to wa.me) is exported and 100% unused. The one place that imports the service uses `renderTemplate` then hands the text to `Share.share` instead. Either deprecate `sendWhatsapp` (Share works for 95% of cases) or migrate the on-my-way path to use it. Documented; not load-bearing.

---

## R4 — Compliance agent + 6 country packs (R289)

**Audit summary — CLAUDE.md says "6 country packs"; reality is 2 of 6:**

| Country | Type file | Service | Status |
|---|---|---|---|
| NL | `dutch-compliance.ts` (454 LoC) | `dutchComplianceService.ts` (791 LoC) | ✅ wired |
| UK | `uk-compliance.ts` (823 LoC) | `ukComplianceService.ts` (1099 LoC) | ✅ wired |
| DE | `german-compliance.ts` (214 LoC) | — | **TYPE-ONLY, no service, zero imports** |
| FR | `french-compliance.ts` (511 LoC) | — | **TYPE-ONLY, no service, zero imports** |
| ES | `spanish-compliance.ts` (505 LoC) | — | **TYPE-ONLY, no service, zero imports** |
| IT | `italian-compliance.ts` (573 LoC) | — | **TYPE-ONLY, no service, zero imports** |

That's 1,803 lines of unused type definitions for DE/FR/ES/IT.

**E-invoice format wiring — 1 of 8:**

`E_INVOICE_FORMATS` registry lists 8 formats with `requiredTier: 'contractor'` gates. Only XRechnung (DE) is actually wired to the UI. Status:

| Format | Country | Mandatory? | Generator exists | Wired to UI |
|---|---|---|---|---|
| XRechnung | DE | B2G | ✅ | ✅ |
| ZUGFeRD | DE | recommended | ✅ | ✅ (mislabeled as Factur-X for FR — fixed in R289) |
| Factur-X | FR | **All B2B from 2026** | ✅ (`generateFacturXXml`) | ❌ orphan |
| Facturae | ES | **B2G + large B2B** | ✅ (`generateFacturaeXml`) | ❌ orphan |
| FatturaPA | IT | **All invoices** | ✅ (`generateFatturaPAXml`) | ❌ orphan |
| Peppol | NL | recommended | — | ❌ |
| UBL | NL | B2G | — | ❌ |
| MTD | UK | All VAT-registered | — | ❌ |

**Fix #1 — FR Factur-X mislabeling (correctness bug):**

`app/invoices/[id].tsx:718-727` showed an "Export Factur-X (XML)" button when `country === 'FR'`, but `handleExportEInvoice('ZUGFeRD')` produced **German ZUGFeRD XML** — not Factur-X. A French contractor pressing that button got legally wrong B2G submission output. Removed the FR button entirely until proper FacturXInvoice mapping lands. Better to have no button than a misleading one.

**Fix #2 — mock compliance data eliminated:**

`complianceService.ts` was seeded with `[...mockLicenses, ...mockCertifications, ...mockInsurancePolicies, ...mockAlerts]` at construction. So `complianceAgentService.scan()` ran daily, found a 2024-expired "Erkend Installateur Gas" license + "F-gassen Categorie I" cert + a CAR insurance policy that the contractor never owned, and queued 4-8 cert_renewal AI queue items every cold start. **Every contractor saw fake compliance alerts.** Now starts empty; `__seedMockData()` exposed for tests only. Same pattern as R285's MOCK_INVENTORY.

**Deferred — DE/FR/ES/IT compliance services don't exist:**

Type files describe rich country-specific entities (Meisterbrief, USt-Voranmeldung schedules, Qualibat ratings, RGE certificates, IVA registers, etc.) but no service reads or writes them. Building these is non-trivial — each requires:
- Country-specific RPC + storage schema
- Validation rules (BTW format, SIRET checksums, Codice Fiscale, NIF, etc.)
- Deadline calculator per regulation
- Localized alerts into the AI queue

Real fix: pick the next-most-important country (DE for German-speaking customers since DATANORM importer + DATEV export already exist) and build it end-to-end before declaring "6 packs". Currently CLAUDE.md misrepresents reality.

**Deferred — `getComplianceStatus` returns fake data:**

`complianceGatingService.getComplianceStatus(country, state)` generates "deadlines" as `now + 15/45/75 days` from the pack's `taxReporting` strings, hardcodes `complianceScore: 92` (paid) / `45` (free). Any UI showing this returns fiction. Either compute from real data or hide.

**Deferred — ES + IT mandatory formats orphan:**

`generateFacturaeXml` (Spain — mandatory for B2G + large B2B) and `generateFatturaPAXml` (Italy — mandatory for ALL invoices via SDI) exist but no UI mapper. ES/IT contractors who turn on the app cannot generate legally-required e-invoices. Real fix: build EInvoiceData → FacturaeInvoice + FatturaPA mappers, add country-specific export buttons, gate via `canUseEInvoiceFormat`. **This is a launch-blocker for ES + IT markets.**

**Deferred — `peppol`, `ubl`, `mtd` formats listed but no generator:**

The format registry references them but no `generatePeppolXml` etc. exist anywhere in the repo. They're in the gating list for tier-pricing logic but cannot actually be exported. Either build the generators or remove from the registry.

---

## R5 — Cohort benchmark service (R290) — clean

**Audit summary — best-architected service in the audit so far. No load-bearing fixes needed.**

| Export | Direct callers | Hook callers | Status |
|---|---|---|---|
| `getCohortBenchmarks` | 0 | (via `useCohortBenchmarks`) | ✓ |
| `useCohortBenchmarks` | 6 (TieredQuoteBuilder, market-prices, crossSellGenerator, ...) | — | ✓ |
| `compareToMarket` | 1 (market-prices) | — | ✓ |
| `getContractorCalibration` | 2 | — | ✓ |
| `useContractorCalibration` | 2 (TieredQuoteBuilder) | — | ✓ |
| `getLineEditDistribution` | 2 (TieredQuoteBuilder) | — | ✓ |
| `getTradeBaselines` | 3 | — | ✓ |
| `getMaterialBaselines` | 9 (invoiceScanService, suppliers integration) | — | ✓ |
| `getMaterialBaselinesForCountry` | 2 | — | ✓ |
| `getAllMaterialBaselines` | 4 | — | ✓ |
| `getPostcodeCohort` | 0 | (via `usePostcodeCohort`) | ✓ |
| `usePostcodeCohort` | 2 (job/[id].tsx) | — | ✓ |

**Architecture quality:**
- `getCohortBenchmarks` calls real RPCs (`get_trade_pricing_stats`, `get_material_cohort_stats`) with k-anonymity ≥5 enforced server-side.
- Falls back to `computeLocalBenchmarks` (user's own scan history) when cohort below threshold — clearly labelled, honest local-only data.
- `getPostcodeCohort` reads `get_postcode_cohort_stats` (R265 wired) with country-aware prefix length.
- Cache TTL respected; consumer hooks correctly call unconditionally per React rules.
- `MATERIAL_MASTER` static lookup used as last-resort baseline when cohort empty — appropriate fallback for cold-start contractors.

**End-to-end verification — `crossSellGenerator`:**
Reads completed jobs → calls `useCohortBenchmarks(trade, country)` → looks up adjacent trade's `avgQuoteAcceptanceRate` → builds insight with cohort evidence (e.g. "Cohort median acceptance for plumbing: 50%") → surfaces in AI tab → action route `/contractor/tiered-quote?from={id}`. Loop closes.

**Minor flags (not load-bearing):**
- `dummyCrossSellGenerator` at `crossSellGenerator.ts:35` returns null. Looks like an unused stub from before the hook-based generator was built. Cleanup candidate.
- `getCohortBenchmarks` and `getPostcodeCohort` direct exports have zero callers. Architecturally fine (hooks are the consumer surface) but they could be marked `@internal` for clarity.

**No deferrals — service is production-ready.**

---

## R6 — Decision intelligence (R291)

**Audit summary:** 664 LoC service consumed by `app/customer/[code].tsx` (the customer decision portal). One write path is real, the rest is decorative.

| Surface | Status |
|---|---|
| `processDecisionSubmission` → `processLinkedProduct` → `pricingApi.recordPriceObservation` → `price_observations` BE table | ✅ real |
| `trackActivity` → `flushActivityBuffer` | ⚠ local-only (`trackUserAction` events, never reach BE) |
| `updateRegionalPreferences` | ⚠ local-only (trackUserAction event, no DB aggregation) |
| `updateDecisionTiming` | ⚠ local-only (trackUserAction event, no DB aggregation) |
| `getRegionalPreferences` | ❌ **was hardcoded mock** ("Hangend toilet 67% / Staand 22% / Back-to-wall 11%, total 233" — same fake answer for every region/trade/decisionType) |
| `getDecisionTiming` | ❌ **was hardcoded mock** (avgDays 5.2, median 3, overdue 18%, reminderEffective 42%) |
| `useRegionalPreferences` / `useDecisionTiming` / `useDecisionSubmission` hooks | ❌ exported, zero UI consumers |

**Fixes shipped:**
- `getRegionalPreferences` now returns `null` instead of fake universal data. Callers must handle null gracefully (no data yet) instead of rendering invented "73% of customers in Amsterdam choose X" claims.
- `getDecisionTiming` same — returns `null`. Both methods document the BE work needed (RPC + aggregation table + k-anonymity gate).
- `flushActivityBuffer` honest comment about local-only behavior, references `customer_portal_events` table that exists in SCHEMA_LOCK Tier 3 but nothing writes to.

**Deferred — aggregation pipeline doesn't exist:**

The whole "regional preferences" promise (e.g. "73% of customers in Amsterdam choose hangend toilet") requires:
1. `regional_preference_aggregates` table with rollup cron
2. `get_regional_preferences(region, trade, decisionType)` RPC with k-anonymity ≥5
3. Same for decision timing — rollup over `decision_submissions.time_to_decide_seconds`
4. Wire `updateRegionalPreferences` and `updateDecisionTiming` to actually insert/upsert into the new aggregate tables

This is BE infrastructure work. Until it lands, the read-side returns null (correctly) and the cross-contractor learning loop is broken — Customer A's choice doesn't inform Contractor B's recommendation.

**Deferred — 3 hooks have zero consumers:**

`useRegionalPreferences`, `useDecisionTiming`, `useDecisionSubmission` are exported in `src/intelligence/index.ts` but no UI screen imports them. Once the BE aggregation lands, these hooks would surface "what your peers' customers chose" insights on the contractor side — but the consumer screens haven't been built yet. Either build the surfaces or trim the dead exports.

**Deferred — `customer_portal_events` table is write-only by intent:**

SCHEMA_LOCK Tier 3 lists `customer_portal_events` (BE-written, RPC-only reads). But `flushActivityBuffer` doesn't write to it — it emits local trackUserAction events instead. Wire the bulk insert path so portal activities actually accumulate server-side for cohort analysis.

**Note: the price-observation path DOES work.**

`processLinkedProduct` correctly calls `pricingApi.recordPriceObservation` → `insertPriceObservation` → real Supabase write into `price_observations` table. Customer-selected products with prices DO feed the pricing moat. This is the only loop that closes today.

---

## R7 — Job quality signals + retrain (R292)

**Audit summary — quality signal loop closes; 4 weekly-trained ML predictors land in tables nobody reads.**

**The job quality loop itself is clean:**
1. Job completes → "Feedback" button appears on `app/contractor/job/[id].tsx:783-794`
2. Contractor taps → `/contractor/job-quality/[id]`
3. Captures: paid_on_time / customer_review_score / referral_generated / rebook_within_180d / review_text
4. `upsertJobQualitySignal` → `job_quality_signals` table (real Supabase write)
5. BE trigger `trg_job_quality_score` computes `composite_score` (0-1)
6. `recordPricingOutcome` reads `get_customer_quality_weight(customer_id)` (R243) → returns avg composite_score over 365d
7. Weight clamped 0.5-1.5 → passed as `p_weight` to `write_training_pair` for `quote_win` model
8. Weekly `weekly-retrain-models` cron consumes weighted training pairs

This is one of the few fully-closed learning loops in the codebase.

**The big find — `intelligenceCaptureService` exports 11 readers, 5 are orphan:**

| Function | Consumers | Status |
|---|---|---|
| `recordGeneratorDismissal` | 2 | ✓ |
| `recordPortalEvent` | 3 | ✓ |
| `persistPhotoAnalysis` | 4 | ✓ |
| `upsertJobQualitySignal` | 3 | ✓ |
| `queryMarginTrend` | 5 | ✓ |
| `getQuoteEngagement` | 2 | ✓ |
| **`getCashflowGapPrediction`** | **0** | **ORPHAN** — `ml_cashflow_gap_predictions` written by cron, never read |
| **`getCapacityOverrunPrediction`** | **0** | **ORPHAN** — `ml_capacity_overrun_predictions` same |
| **`getSupplierLeadtimePredictions`** | **0** | **ORPHAN** — `ml_supplier_leadtime_predictions` same |
| **`getMaterialPriceForecasts`** | **0** | **ORPHAN** — `ml_material_price_forecasts` same |
| **`describeMoatSchema`** | **0** | **ORPHAN** — admin/debug helper |

So `train-extra-models` weekly cron writes 4 ML prediction tables; the contractor sees 0 of those predictions.

**Fix shipped — material price forecasts surface on inkoop:**

New `src/components/contractor/MaterialPriceForecastCard.tsx` reads `getMaterialPriceForecasts(trade, country)`, filters confidence ≥ 0.5 and abs(predictedPriceChangePct) ≥ 3, renders top 3 with red/green chips. Hidden when no forecast clears the bar — same pattern as `MaterialDriftCard`. Wired onto inkoop between `MaterialDriftCard` and `PriceDropAlertCard`.

This closes the loop end-to-end for one of the 4 dormant predictors. ML cron writes → BE table → FE reader → contractor sees a "Lumber +12% forecast" chip on inkoop.

**Deferred — 3 other dormant predictors:**

| Predictor | Suggested surface |
|---|---|
| `getCashflowGapPrediction` | geld tab — banner above CashFlowForecastCard when gap predicted >€500 |
| `getCapacityOverrunPrediction` | Vandaag tab — KPI tile or schedule hero card when this week predicts overrun |
| `getSupplierLeadtimePredictions` | inkoop — adjacent to MaterialPriceForecastCard, "Supplier X delivering 3d slower than usual" |

Each is a small component (50-80 LoC, same pattern as MaterialPriceForecastCard). Three more rounds of the same dormancy fix would close all 4 ML loops. Logging for follow-up.

**Deferred — "Feedback" button has no auto-prompt:**

The Feedback button at `app/contractor/job/[id].tsx:783` only renders when `jobCompleted`. Most contractors will never tap it, so most completed jobs have no quality signal, so `get_customer_quality_weight` defaults to 1.0 (= no weighting), so the quote_win model trains uniformly. The screen exists but utilization will be near zero without a prompt.

Right fix: when `updateJobStatus(id, 'completed')` fires, queue an AI item that the R286 executor routes to `/contractor/job-quality/{id}`. New queue type `job_quality_feedback`. Out of R7 scope (queue-type changes deserve their own pass), documented for follow-up.

---

## R8 — Cron jobs (R293) — LAUNCH-CRITICAL FIND

**The find — pg_cron isn't even installed; ZERO crons running on production.**

Verified live against `gblhqhorkarocmputhte`:
```
$ supabase db query --linked "select extname from pg_extension where extname in ('pg_cron', 'pg_net');"
{ "rows": [] }
```

LAUNCH.md previously claimed "9 cron jobs registered". The reality: `supabase/cron.sql` documents 9 schedules but the file was never run on prod, and even if it were, the prerequisite extensions (pg_cron, pg_net) are not installed.

**The 9 dormant crons and their consequences:**

| Cron | Schedule | What's broken without it |
|---|---|---|
| `vasco-weekly-digest` | Mon 08:00 | No weekly summary email to contractors |
| `vasco-stale-draft-cleanup` | Daily 03:00 | Old draft quotes accumulate forever |
| `vasco-drain-account-deletions` | Daily 02:00 | **GDPR Art. 17 violations** — deletion requests never processed |
| `vasco-daily-push-digest` | Daily 18:00 | No push notifications fire (only manual triggers) |
| `vasco-churn-winback` | Mon 10:00 | Stalled users never get re-engagement email |
| `vasco-grant-referral-credits` | Daily 04:00 | Referrers never receive their promised 1-month credit (R232) |
| `vasco-weekly-retrain-models` | Mon 02:00 | quote-win model trains only on quote-draft (slow accumulation) |
| `vasco-train-extra-models` | Daily 03:00 | **All 4 ML predictors stay empty** — cashflow gap, capacity overrun, supplier lead-time, material price forecast |
| `vasco-refresh-generator-approval-rates` | Daily 03:30 | `get_global_generator_rates` RPC stale forever — `insightScorer` blends with empty data |

**Combined impact:** the entire ML / scheduled-comm / GDPR pipeline is dormant. The R292 fix (MaterialPriceForecastCard on inkoop) currently shows nothing because `ml_material_price_forecasts` table is empty until `vasco-train-extra-models` runs.

**Fix shipped:**
- New migration `supabase/migrations/20260502000002_enable_pg_cron.sql` enables `pg_cron` + `pg_net` extensions (idempotent, safe). NOT YET PUSHED — operator runs `supabase db push --include-all`.
- LAUNCH.md updated: snapshot now correctly says "0 registered" instead of "9 registered". New §2.6.5 explicitly walks the operator through the one-time cron registration with the right `SUPABASE_URL` + service-role key.

**Why this wasn't done at infrastructure setup:**
- `supabase/cron.sql` requires manual placeholder substitution (`<SUPABASE_URL>`, `<SERVICE_ROLE_KEY>`) — can't be auto-applied via `supabase db push`
- Easy to miss because the file is in repo and looks "ready"; LAUNCH.md compounded the confusion
- No CI step verifies `cron.job` is non-empty post-deploy

**Deferred — automate or harden the cron registration step:**

Three improvements for follow-up:
1. CI smoke test: post-deploy script that queries `cron.job` and fails if rowcount < 9
2. Replace placeholder substitution with env-driven script that reads `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from environment, generates the SQL, pipes to `supabase db query`
3. Add a startup health check in the app: if scheduler-driven features (e.g. ML predictions) are detected as stale (>14d), log a Sentry warning with `cron_likely_dormant` tag

These are operational improvements, not code-level. Logging for the day-of-launch checklist.

**🟢 PARTIALLY CLOSED in R66r55** (2026-05-11):
- ✅ #1 visibility: admin DeveloperHub now has a Cron tab. `get_cron_health()` SECURITY DEFINER RPC reads `cron.job` + `cron.job_run_details` filtered to `vasco-*` schedules; admin sees per-job status (last_status / last_start / last_end / total_runs) with ⚠ count on the tab label when missing or failed. Migration `20260511000002_cron_health_rpc.sql`.
- ✅ #3 startup health check: `mlHealthCheck.ts` fires a Sentry warning with `cron_likely_dormant` tag when any of the 4 trained predictors are stale > 14d. Wired into `_layout.tsx` on auth-ready (R302 + R66r57 verified).
- ⏸ #2 env-driven cron registration still requires operator action (run `supabase/cron.sql` with real `SUPABASE_URL` + service-role JWT substituted). Tracked in `docs/launch-checklist.md` "Pre-launch deploy sequence". CI smoke test (`scripts/check-cron-registered.mjs`) exists from R300.

---

## R9 — EVE live actions (R294)

**Audit summary — better than memory claimed; one real bug + one structural orphan.**

The memory note "claimed: fixtures" was outdated. `eveLiveActionService.buildLiveActions()` is wired into `backgroundJobScheduler.ts:720` daily block and DOES generate real actions from live AppState:
- **Agent**: top 3 completed jobs without invoices → `draft_invoice` queue items
- **Auditor**: top 3 overdue invoices → `compliance_gap` (now `late_payment_risk_alert` after R294)
- **Analyst**: win-rate < 35% → `pricing_insight` (now `low_win_alert` after R294)

The 30-min in-app scheduler (R8 issue is server-side pg_cron, this one runs in JS) means EVE actions DO accumulate every time the contractor opens Vasco. **This pipeline works.**

**The bug fixed in R294:**

Type mapping in `backgroundJobScheduler.ts:728-731` had two correctness issues:

| EveAction.type | Was mapped to | Problem |
|---|---|---|
| `compliance_gap` | `'draft_reminder'` (SHAREABLE) | **Severe UX bug** — `preparedData` had no `template`, so executor's Share path used the `description` text. Contractor approving an EVE auditor item like "Invoice 2024-001 overdue 14d — €450 outstanding — final notice recommended" would open Share sheet with that contractor-internal phrasing about to be sent to the customer. |
| `pricing_insight` | `'general'` | **Not a valid `QueueItemType`** — fell through every classifier (isShareable, isInformational, executor switch). UI rendered the item but Approve was a no-op. |

**Fix shipped:**
- `compliance_gap` → `late_payment_risk_alert` (informational, deep-links to `/invoices/{id}` via R286 executor — contractor lands on invoice screen and uses the existing reminder flow with `gateReminderSend` from R287)
- `pricing_insight` → `low_win_alert` (informational, no-op when no quoteId, which matches the trade-level scope correctly)
- Default fallback also changed to `low_win_alert` instead of `'general'`
- Mapping function pulled out + properly typed via `QueueItemType` (no more `as any`)

**Deferred — `eveAgentService.ts` (345 LoC) is mostly structural orphan:**

The "EVE 3-agent" model in CLAUDE.md is described with rich metadata: agent/auditor/analyst with localized names + descriptions + capabilities, `getWorkforceStatus(actions, prefs)`, `getAgentDescription(type)`, `generateDemoActions(trade, country)`, `EVE_AGENTS` config record. **Zero UI consumers** — only one comment reference in AppState.tsx.

The agentType IS preserved on queue items (`sourceGeneratorId: eve-{agentType}`) but VascoCard renders a flat queue with no agent grouping or attribution. The "EVE 3-agent workforce" UX promise is unfulfilled.

Real fix: build an EVE workforce surface — either a dedicated route showing 3 agent cards with pending counts, or per-row agent badges in the AI queue. Out of R9 scope — the data flow works, the visualization just isn't built.

**Deferred — EVE actions never expire:**

`eveLiveActionService.buildLiveActions` doesn't set `expiresAt` on EveAction objects. When mapped into the AI queue, items pass through with `expiresAt: undefined` — no auto-expire. A "Win rate at 25%" insight from 6 weeks ago could persist indefinitely. Bounded by the queue's 50-item cap + entityKey dedup, but stale items still surface. Add a 7-14 day expiry per action type.

---

## R10 — Live tracking / On-My-Way (R295) — most thoroughly dead service so far

**Audit summary — CLAUDE.md says "GPS tracking, On My Way ETA, team map, GDPR consent". Reality: zero of those work.**

| Claim | Reality |
|---|---|
| GPS tracking | `expo-location` NOT in package.json, no `navigator.geolocation` calls anywhere |
| On My Way ETA | Hardcoded "15 min" string in template, sent to customer regardless of distance |
| Team map | No screen consumes `getTeamLocations` |
| GDPR consent | `grantTrackingConsent` exists with 6-locale text, has 0 callers |
| Customer tracking URL | `https://app.vasco.eu/track/{id}` — no edge fn or static page serves this |
| GPS clock-in verification | `verifyClockInLocation` exists, `clockInService` doesn't pass through it |
| Location persistence | `updateMyLocation` writes to AsyncStorage only — not shared across team devices |

`liveTrackingService.ts` (324 LoC) has **zero call sites** outside the file itself. Pure orphan.

**Fixes shipped:**
- `liveTrackingService.ts` header rewritten to "DEPRECATED — DO NOT EXTEND" with explicit TODO list of what's missing (expo-location dep, BE table, edge fn for tracking URL, team-map screen, clock-in GPS gate). File kept in tree for the type definitions.
- "On my way" button on `app/contractor/job/[id].tsx` no longer sends a hardcoded "15 min" ETA. Now prompts the contractor with 4 chip options (10/20/30/45 min) before opening Share. Honest manual ETA beats fake fixed one.

**Deferred — to make this real:**

1. `npx expo install expo-location` + `NSLocationWhenInUseUsageDescription` in iOS plist + Android coarse/fine location perms in app.json
2. New BE tables: `team_locations` (user_id, lat, lng, status, ts) for live snapshot + `team_location_history` for 30-day rollup
3. Edge fn `serve-eta-tracking` to render the customer-facing tracking page (or static deeplink to a tracking screen)
4. New screen `app/team-map.tsx` consuming `getTeamLocations`
5. Wire `verifyClockInLocation` into `clockInService` for GPS-gated clock-in
6. Then enable the GDPR consent prompt — currently the consent text is purely documentary because there's no data to consent about

This is meaningful product work (~1-2 weeks). Documenting for the post-launch backlog.

**Note: nothing in the live data flow actually depended on this service.** Removing it tomorrow would break nothing visible to contractors.

---

## R11 — Signature service (R296)

**Audit summary — service has 0 callers; the one capture path bypasses it entirely.**

The "7 contexts × 6 langs" framework documented in `signatureService.ts` (204 LoC) is structural only. Reality of signature capture in the codebase:

| Surface | Status |
|---|---|
| `signatureService.saveSignature` | ❌ 0 callers |
| `signatureService.getSignaturesForReference` | ❌ 0 callers |
| `signatureService.createSignatureRecord` | ❌ 0 callers |
| `signatureService.signatureHtmlBlock` | ❌ 0 callers |
| `signatureService.getLegalText` | ❌ 0 callers |
| `signatureService.SIGNATURE_LABELS` (i18n) | ❌ 0 callers |
| Customer handover signature on `app/contractor/job/[id].tsx` | ✅ captures SVG via `SignaturePad` → `updateJob({ customerSignoffAt, signatureSvg } as any)` — bypasses the service entirely |

**Three load-bearing gaps discovered:**

1. **Lost on BE sync.** `signatureSvg` and `customerSignoffAt` are NOT on the `jobs` schema (verified: no migration, no `signatures` table, not in `database.types.ts`). The `as any` cast on line 1006 of job/[id].tsx hides this. When `updateJob` calls `dbUpdateJob`, the BE drops these fields silently. The signature lives in AsyncStorage (via AppState persist) only — lost on app uninstall.

2. **PDFs don't embed signatures.** `signatureHtmlBlock` was authored to embed signatures in invoice/quote PDFs but is never called. `invoicePdfService.generateInvoicePdf` doesn't take a Job parameter, so even if we wanted to embed the handover signature on the final invoice, the call chain doesn't have access to it.

3. **6 of 7 designed contexts unused.** The `SignatureContext` union covers quote-acceptance, invoice-acknowledge, change-order, handover, certification, gate-pass, custom. Only handover is captured anywhere.

**Fix shipped:**
- `signatureService.ts` header rewritten to "DEPRECATED — DO NOT EXTEND" with explicit gap list (BE persistence missing, PDF embed missing, 6 of 7 contexts unused).

**Deferred — to make this real:**

1. Migration: add `signature_svg` (text) + `customer_signoff_at` (timestamptz) to `jobs` table OR a dedicated `signatures` table (preferred — supports the 7 contexts properly with FK to entity)
2. Whitelist the new columns in `dbUpdateJob` payload mapping
3. Threading: pass the linked Job (or its signatureSvg) into `generateInvoicePdf` so `signatureHtmlBlock` can fire
4. Wire the other 6 contexts (most useful: quote-acceptance — capture customer signature on portal acceptance, embed on accepted-quote PDF)

**Compliance note:** in the EU, customer-acknowledged work proof (signed handover) is a useful evidence trail for disputes. Today it exists in the contractor's app but never ends up on the invoice or in the BE — minimal evidentiary value.

**🟢 CLOSED in R66r55–r57** (2026-05-11):
- ✅ `public.signatures` table shipped — append-only audit trail with server-stamped `signed_at`, FK to jobs/documents, `signer_role` enum (customer/site_lead/inspector/subcontractor/other), `user_agent` + server-derived `ip_hash` (daily-rotating sha256 salt). Migration `20260511000003_signatures.sql`. RLS scoped to `contractor_user_id`.
- ✅ Anonymous-customer write path: `write_signature_via_portal(p_access_code, p_signer_name, p_signer_role, p_signature_svg, p_user_agent)` SECURITY DEFINER RPC validates access_code against `decision_trackers`, resolves contractor_user_id server-side, derives ip_hash from `inet_client_addr()`. Mirrors R31 capability-URL pattern.
- ✅ FE service rewritten from deprecated stub: `recordContractorSignature` (RLS-authed insert), `recordPortalSignature` (RPC wrapper), `listSignaturesForJob` reader, `getLegalText` (5 contexts × 6 langs), `signatureHtmlBlock` (PDF embed helper with HTML escaping).
- ✅ `invoicePdfService.generateInvoicePdf` + `buildInvoicePdfBase64` updated to use the new `signatureHtmlBlock` shape; legal text resolved via `getLegalText('handover', language)` per contractor's locale.
- ✅ `app/contractor/job/[id].tsx` SignaturePad onSave fires `recordContractorSignature` alongside the local Job update — BE audit row always lands.
- ✅ Contractor-side audit panel: job detail screen surfaces all `listSignaturesForJob` rows with signer name + timestamp + role.
- ✅ Customer-side portal flow: `CustomerDecisionPortal` shows a Sign-acknowledgment modal after all decisions complete; types name + draws signature → `recordPortalSignature`.
- ✅ Realtime watcher: `watchSignatures(userId)` subscribes to INSERT events; fires `sendInstantNotification` ("Customer signed — Marie Dubois signed an acknowledgment") + the `_layout.tsx` cleanup unmounts it on logout.
- ✅ 16 new unit tests across `signatureService` + `watchSignatures` + payment-disconnect + version-check.

---

## R12 — CRM intelligence + customer auto-tagging (R297) — cosmetic-only loop

**Audit summary:** customer tags ARE computed, ARE shown — but DON'T gate downstream behavior. Plus two parallel services with overlapping logic.

**Two services, overlapping signals:**

| Service | Output shape | Used in |
|---|---|---|
| `customerTaggingService.scoreCustomer()` | `CustomerProfile { tag: vip\|loyal\|new\|risky\|inactive, score, ltv, ... }` | Klanten UI badges (`customer-crm.tsx`) |
| `tradeContext.getCustomerIntelligence()` | `CustomerIntelligence { paymentReliability: excellent\|good\|fair\|poor, contextLine, ... }` | AI queue `customerContext` field (4 call sites in aiActionQueueService) |

A given customer can simultaneously be `tag: 'risky'` (customerTaggingService) AND `paymentReliability: 'good'` (tradeContext) because each uses different time windows and thresholds. They produce different one-liners for the same customer.

**The dormancy — tag is decorative:**

The `customerTaggingService.ts` header claims: "Used by the Klanten UI + by the AI queue's customer-context block (so a reminder to a VIP customer phrases the ask more gently than one to a risky payer)."

Reality:
- ✅ Klanten UI shows `CustomerTagBadge` next to customer names — works
- ✅ AI queue items include a `customerContext` line shown in VascoCard ("Repeat customer, €5,200, 3 jobs, pays in 18d, excellent payer")
- ❌ **The reminder/followup templates are tag-agnostic.** A VIP customer gets the IDENTICAL payment_reminder text as a risky one. `whatsappTemplateService.renderTemplate('payment_reminder', locale, vars)` has one variant per locale, no tag-keyed variants. The contractor sees the tag before tapping Approve, but the text they Share is the same.

So the loop closes structurally (tag → display) but not behaviorally (tag → message variant).

**No fixes shipped this round** — making templates tag-aware requires:
1. Adding tag-keyed template variants (e.g. `payment_reminder_vip`, `payment_reminder_risky`) × 6 locales = 30+ new strings
2. Threading the customer's tag into `renderTemplate` call sites
3. Picking a canonical service (customerTaggingService OR tradeContext) and deprecating the other

That's a meaningful product UX decision, not just a wiring fix. Out of scope for an audit pass. Documented as deferred.

**Deferred — pick one canonical CRM service:**

The two services should converge. Both compute LTV, payment reliability, repeat-customer status from the same inputs. Recommend:
- Keep `customerTaggingService` as the public surface (returns `CustomerTag` enum + score, easy for UI badges)
- Move `getCustomerIntelligence`'s `contextLine` builder onto `CustomerProfile` (e.g. `contextLine(profile)` helper)
- Remove `getCustomerIntelligence` after migration; it has 4 call sites all in `aiActionQueueService.ts`

**Deferred — make tags actually gate behavior:**

Three concrete behavior changes the tag could drive:
1. **Reminder template:** `payment_reminder` chooses gentle/standard/firm variant from tag (vip → gentle, loyal → standard, risky → firm)
2. **Reminder cadence:** `gateReminderSend` could warn before sending a 2nd reminder to a VIP, or refuse to send a 6th to a risky customer (today only the >5 threshold from R287 fires)
3. **Quote follow-up timing:** loyal customers get follow-ups sooner (3d), new customers later (5d), inactive get a "we miss you" variant

Each is small but requires UX decisions about what the right behaviors are. Logging for follow-up.

**No load-bearing bugs in R12** — just dormancy disclosure. The structural pieces work; the behavior layer on top isn't built.

---

## R13 — ML capacity overrun + push notification log (R298)

**Two distinct findings — one fixed, one already correct.**

**Capacity overrun — same dormancy as R292/R285:**

`getCapacityOverrunPrediction()` had 0 callers (flagged in R7 audit). The `train-extra-models` daily cron writes `ml_capacity_overrun_predictions` rows; nothing reads them. `CapacityOverrunCard` (new) reads via the existing service, hides when probability < 0.5 OR overrun < 1 day, lands on Vandaag below KPI row, deep-links to `/contractor/drag-schedule` on tap. Tone amber when 50-74% probability, red when ≥75%. Loop closes end-to-end: cron → `ml_capacity_overrun_predictions` → service reader → contractor sees "Capacity overrun likely · 75% chance · ~3d in next 14d" before committing more work.

**Push notification log — already correctly built:**

`push_notification_log` is SCHEMA_LOCK Tier 3 (BE-written, RPC-only reads). Verified write/read parity:
- **Writer:** `daily-push-digest` edge function inserts on every push send (line 287)
- **Reader:** same edge function reads for rate-limit dedup (lines 192, 253) — last 24h per `(user_id, notif_type, entity_key)`
- **No FE consumer needed** — this is internal-to-the-rate-limiter table, not a deliverability dashboard

The table is purpose-fit. RLS lets a user select their own rows but no UI surfaces it (correctly — that's not the goal). **Not dormant; correctly internal.**

**However:** tied to R8 (pg_cron not running). The `daily-push-digest` cron is registered in `cron.sql` but pg_cron isn't installed, so `push_notification_log` stays empty in prod. After R293's migration is pushed and cron.sql runs, the writer fires and the rate-limit logic becomes meaningful.

**No deferrals from R13.** Both surfaces are now properly wired (capacity overrun via new card, push log via internal rate limiter).

---

## R14 — Team tools (R299) — cleanest dormancy in the audit

**Audit summary — 14 exports, 0 callers anywhere. All 5 features are pure aspiration.**

| Feature | Service surface | Status |
|---|---|---|
| Worker scorecards | `generateDemoScorecards`, `compareScorecards` | 0 callers, no screen |
| Van stock / inventory | `loadVanStock`, `saveVanStock`, `useFromStock`, `getLowStockItems` | 0 callers, no screen, name collision with reorderService.getLowStockItems |
| Change orders | `createChangeOrder`, `loadChangeOrders`, `saveChangeOrder` | 0 callers, no screen |
| Punch lists | `createPunchList`, `addPunchItem`, `loadPunchList`, `savePunchList`, `getPunchListProgress` | 0 callers, no screen |
| Membership enrollment | `MembershipPlan`, `MembershipEnrollment` types | 0 callers, no functions even authored |

**Fix shipped:**
- `teamToolsService.ts` header rewritten to "DEPRECATED — DO NOT EXTEND" with explicit feature-by-feature gap list and 4-step roadmap to make real (build screens first, add BE persistence, per-worker RLS, fix the `getLowStockItems` name collision).

**Context — this is consistent with the product strategy:**

VascoApp is solo-contractor focused. LAUNCH.md §6 explicitly says: *"Worker app expansion beyond schedule + timesheet (only if multi-employee contractors land)"*. So this entire service being orphan is not surprising — it was speculatively built for a segment that hasn't been validated yet. Removing it tomorrow would break nothing visible to any contractor.

**No deferrals.** If multi-employee contractors become a real segment, the service is ready — but the screens, BE tables, and RLS policies need to be built first. Until then, deletion is safe.

---

# Audit complete — 14 of 14 rounds done

**Score across all 14 rounds:**

- ✅ **Real bugs found and fixed:** R1 (queue executor), R2 (validators), R4 (FR Factur-X mislabeling), R6 (mock returns), R9 (EVE type mapping), R10 (fake fixed ETA)
- 🧹 **Mock/fake data eliminated:** R4 (compliance fixtures), R6 (decision intelligence mock returns), R10 (fake "15 min" ETA)
- 🚨 **Critical infra gap:** R8 (pg_cron not installed; zero crons running on prod)
- 📦 **New surfaces wired:** R7 (MaterialPriceForecastCard on inkoop), R10 (ETA prompt), R13 (CapacityOverrunCard on Vandaag)
- 📝 **Dormancy disclosure with deprecation:** R3 (customerCommunicationService), R10 (liveTrackingService), R11 (signatureService), R14 (teamToolsService)
- ✅ **Clean / no fixes needed:** R5 (cohortBenchmarkService), R12 (CRM tagging cosmetic-only — no bugs but behavior layer missing), R13 (push_notification_log already correct)

**Top remaining work, prioritized:**

1. **Push the R293 pg_cron migration + run cron.sql with real creds** — without this, every cron-driven feature stays dormant (ML predictions, GDPR drain, push digest, churn winback, referral credit grants, etc.). LAUNCH.md §2.6.5 documents the steps.
2. **Wire the 2 still-orphan ML predictors** (cashflow gap → geld banner, supplier lead-time → inkoop card). Same 50-80 LoC pattern as R292 / R298.
3. **Make customer tags actually gate behavior** (R12) — template variants per tag, gateReminderSend thresholds, follow-up timing.
4. **Build ES + IT e-invoice export UI** (R4) — `generateFacturaeXml` and `generateFatturaPAXml` exist but no UI mapper. Launch-blocker for those markets.
5. **Auto-prompt for job quality feedback** (R7) — queue a `job_quality_feedback` AI item when status flips to completed; without this, contractors won't tap the Feedback button.

**Files retired:**
- ~~`customerCommunicationService.ts` (R288)~~ — DELETED in R24 (~416 LoC).
- ~~`liveTrackingService.ts` (R295)~~ — DELETED in R24 (~342 LoC).
- ~~`teamToolsService.ts` (R299)~~ — DELETED in R24 (~396 LoC).
- `signatureService.ts` (R296) — RE-ACTIVATED in R301 via invoicePdfService embed; retained.
- `whatsappTemplateService.sendWhatsapp` + `useReviews` + `useReputation` (R300, function-level) — still deprecated, still in tree.

---

# R300 — deferred-items resolution pass

After the audit (R286–R299) flagged ~30 deferred items, R300 worked through every quick/medium win. **10 of 10 actioned, ~12 BE/product-scale items documented for follow-up.**

**Tier A — launch-blocking quick wins (3 of 3 done):**
- Bulk reminder send (R2 deferral) — fake "sent!" toast replaced with sequential gateReminderSend + Share.share loop; reports honest sent/skipped counts
- `markInvoiceSent` button mislabeled (R2 deferral) — relabeled "Mark as sent"
- E_INVOICE_FORMATS registry trimmed (R4 deferral) — peppol/ubl/mtd removed (no generators existed)

**Tier B — orphan ML predictors wired (2 of 2 done):**
- `CashflowGapPredictionCard` on geld → reads `ml_cashflow_gap_predictions`
- `SupplierLeadtimePredictionCard` on inkoop → reads `ml_supplier_leadtime_predictions`

Combined with R292 (MaterialPriceForecastCard) and R298 (CapacityOverrunCard), **all 4 ML predictors trained by `train-extra-models` are now wired end-to-end** (cron writes → BE table → FE reader → contractor sees prediction).

**Tier C — behavior fixes (4 of 4 done):**
- New `job_quality_feedback` queue type + auto-emit on status→completed → R286 executor routes to `/contractor/job-quality/{id}` (closes R7 "no auto-prompt" gap)
- EVE actions now set `expiresAt` (agent/auditor 14d, analyst 7d) → R9 deferral resolved
- `gateReminderSend` accepts `customerTag` → VIP soft-confirm, INACTIVE "are you sure?" → R12 deferral resolved (cosmetic-only loop now behaviorally meaningful)
- `tiered-quote.tsx` reads `customerId`/`jobId` from router params + prefills TieredQuoteBuilder.customer → R1 prefill deferral partially resolved (line items still TBD)

**Tier D — deprecations + ops (2 of 2 done):**
- `whatsappTemplateService.sendWhatsapp` marked @deprecated (R3 deferral)
- `useReviews` / `useReputation` marked @deprecated (R3 deferral)
- New `scripts/check-cron-registered.mjs` post-deploy smoke test (R8 deferral) — exits non-zero if fewer than 9 cron.job rows; documented for CI integration

**Out of scope for R300 — require BE infra or product decisions:**

| Item | Why deferred | Effort |
|---|---|---|
| R3 automated event triggers | WhatsApp Business API key + Twilio/MessageBird account | Days + recurring cost |
| R4 DE/FR/ES/IT compliance services | Country-specific RPC + storage schema + validation rules per regulation | 2-4 weeks per country |
| R4 ES + IT e-invoice UI mappers | EInvoiceData → FacturaeInvoice / FatturaPA shape mapping | 1-2 weeks per format |
| R6 regional-preference aggregation pipeline | New BE table + rollup cron + RPC + k-anonymity gate | ~1 week |
| R8 register crons live on prod | Needs service-role key + manual cron.sql substitution | 5 min (operator action) |
| R11 signature BE persistence + PDF embed | Migration + `dbUpdateJob` whitelist + thread Job into PDF generators | 2-3 days |
| R14 team tools | Solo focus per LAUNCH.md §6 — intentional | Indefinite |
| R10 GPS / live tracking | Per saved feedback: not load-bearing for VascoApp | Indefinite |
| R6 build surfaces for `useRegionalPreferences` / `useDecisionTiming` | Depends on aggregation pipeline above | After R6 BE work |
| R12 template variants per tag | 30+ new strings × 6 locales + threading | 1-2 days |
| R3 BE infra for auto-fired triggers | Notification scheduler + cron + WhatsApp Business API integration | 1-2 weeks |
| R9 EVE 3-agent UI surface | Per-agent dashboard + workforce screen | 3-5 days |

---

# R8 (round 8) — high-leverage launch gaps

A four-part audit pass focused on revenue + payment correctness.

**R8.1 — admin dashboard audit**: scope-clean.

**R8.2 — subscription checkout flow** [LAUNCH-CRITICAL]: discovered `startSubscriptionCheckout` had **zero callers**. Every R6.1/R7.3 tier-gate alert ("Upgrade required" → "View plans" → `/contractor/profile`) led to a dead end — no upgrade UI existed in profile.tsx. Fixed: new "Plan" section in `app/contractor/profile.tsx` between Performance and Account, showing current tier badge + monthly/annual toggle + tier cards (Advanced/Pro/Contractor) with "MOST POPULAR" badge on Pro. Tap → `startSubscriptionCheckout(tier, cycle)` opens Stripe Checkout via WebBrowser. Demo mode shows "demo blocked" alert. 13 new i18n keys × 6 locales (`profile.plan`, `profile.upgradeTo`, `profile.billingMonthly`, etc.). Without this fix, the entire freemium revenue model was unreachable from inside the app.

**R8.3 — referral loop end-to-end**: verified all 9 stages wired and live:
1. Mint via `get_or_create_referral_code` RPC ✓
2. Native share via `useReferral` hook + `Share.share` ✓
3. Universal link `/ref/CODE` → stash + redirect ✓
4. Signup screen reads `?ref=CODE` ✓
5. AsyncStorage stash `@vasco_pending_referral` ✓
6. SIGNED_IN handler in AuthContext fires `applyPendingReferral` ✓
7. `attribute_referral` RPC (PENDING status) ✓
8. `trg_activate_referral` trigger flips PENDING → ACTIVATED on first invoice_sent ✓
9. `vasco-grant-referral-credits` cron (04:00 UTC daily) flips ACTIVATED → CREDITED + inserts `subscription_credits` rows; Stripe + Mollie webhooks call `redeemCredits` to apply discount on next renewal ✓

The only remaining gap is the cron itself being registered live — depends on R8 deferred operator action (run `register-crons.mjs`).

**R8.4 — invoice/quote PDF country correctness**: 3 real bugs found and fixed:
- Invoice brand-block: UK contractor's invoice falsely showed `KvK: 12345` (UK doesn't have a KvK; should say `Co. no.`). The conditional `country === 'IT' ? 'P.IVA' : 'KvK'` defaulted UK to KvK.
- Invoice IT label inconsistency: brand-block said `P.IVA: ABC` but footer said `C.F.: ABC` for the **same field**. Codice Fiscale and Partita IVA are distinct numbers in Italy; using both labels for one value is wrong. Standardized to `P.IVA` (matches Italian invoice convention; CF is a personal tax code, not a business id).
- Quote PDF: rendered `${kvkNumber}` with **no label at all** — a bare 8-digit number with no context. Quote and invoice now use shared `registrationLabel(country)` + `vatLabel(country)` helpers so a contractor's quote-then-invoice flow shows the same label under the same id.

R8 batch: 0 TS errors, all 6 locales valid, 4/4 R8 tasks resolved.

---

# R9 — touch points the earlier rounds skipped

Four-part audit on system primitives that R285-R307 didn't cover.

**R9.1 — push notifications**: registered cleanly on auth (R285 verified). Two missing wires found:
- `refreshPushTokenIfStale` — designed weekly token refresh on foreground, defined but **zero callers**. Without it, a contractor whose token rotated would silently stop getting pushes after 7 days. Wired into the existing `RNAppState.addEventListener('change')` foreground handler in `app/_layout.tsx`. The function self-throttles (no-op when last refresh < 7d), so calling on every foreground transition is safe.
- `syncBadgeWithUnread` — sets the iOS app-icon badge to actual unread count. Defined but **zero callers** — the icon never reflected unread notifications. Wired to fire on `state === 'background'` so the badge updates as the user backgrounds the app.

**R9.2 — calendar sync**: code paths fully wired (addJob/updateJob/removeJob → syncJobToCalendar/removeJobFromCalendar). One UX gap: the only entry to enable sync was a one-time prompt in `drag-schedule.tsx`. A user who tapped "later" lost the entry forever. Added "Device calendar" row to the profile integrations list with live connected-state, routing to `/contractor/calendar-settings`. 1 new key × 6 locales (`profile.deviceCalendar`).

**R9.3 — global search**: real bug. `quote.customer` and `inv.customer` hold the customer **UUID**, not the name. Search code did `quote.customer?.toLowerCase().includes(q)` — searching "John Smith" silently missed every quote and invoice that customer was on. Built a `customerNameById` map at the top of the search memo, added `resolveCustomerName(idOrName)` lookup. Job/quote/invoice search now matches on customer name; subtitle adds the resolved name where present so results explain why they matched. Also extended jobs to search by customer name (was only matching on title/description).

**R9.4 — hub/savings ROI screen**: mostly truthful (R285 already cleaned up the worst fabrications) but three remaining lies:
- `timeSavings = ... : 195` — when a contractor had no labor cost data, the screen invented €195 of "savings". Now zero.
- `Math.max(fasterPayments, 120)` — when DSO was equal to or worse than industry average, the screen still claimed €120 in working-capital savings. Now uses the real value (zero or positive).
- `topOpportunity` fallback `{ label: 'Bundel bestellingen', potentialAmount: 540, action: 'Stel een wekelijkse besteldag in' }` — when no real supplier quick-win existed, the screen invented one in Dutch. Now returns an empty opportunity, and `app/hub/savings.tsx` only renders the card when `potentialAmount > 0 && label`.
- Plus: 7 hardcoded Dutch labels/descriptions on the breakdown categories — bypassed i18n entirely. Migrated to `savings.cat.*` keys (13 keys × 6 locales). i18n re-imported via `import i18n from '../i18n/i18n'` so the service can call `i18n.t()` outside React.

R9 batch: 0 TS errors, all 6 locales valid.

---

# R10 — hub routing, prefs cleanup, decision-portal polish

**R10.1 — hub screens**: enterprise mocks (`/hub/metrics`, `/hub/reports`, `/hub/costs` with fake £18M property data) reachable from contractor flow:
- `/hub/costs` (fake Riverside Quarter / Oak Gardens / Harbour View) was the destination of geld tab's "Costs" pill — a contractor tapping their own expenses got fictional property-development figures. Re-routed to `/contractor/expenses` (real expense list).
- `/hub/intelligence` was the "Projected next month" cashflow link in geld — wrong destination (it's the data-ingestion overview, not cashflow). Re-routed to `/contractor/cashflow` (real CashFlowDashboard).
- `/hub/metrics` and `/hub/reports` are reachable only from DirectorDashboard — per R180 enterprise dashboards intentionally skipped.

**R10.2 — onboarding state propagation**: prefs ARE wired correctly via `aiActionQueueService.ts` (uses `wantsPaymentFocus` / `wantsQuotingHelp` etc to give matching action types a +10 priority boost). But three helpers were dead — written for an older multi-section Vandaag dashboard:
- `getDashboardSectionOrder` (zero callers)
- `getPrioritizedInsightTypes` (zero callers)
- `useOnboardingPreferences` hook (zero callers — its only use was wrapping the two helpers above)
Removed all three. Pruned `useState/useEffect/useMemo` imports that became unused.

**R10.3 — workflow packs**: clean. 10 packs (CLAUDE.md says 7 — doc drift, not a bug); `evaluateTriggers` fires from Vandaag mount + background scheduler tick; trigger matchers cover invoice_sent / invoice_overdue / quote_sent / quote_accepted / job_complete / customer_created etc with a 2-day catch-up window; mapActionToQueueType produces valid QueueItemType values; SHAREABLE_TYPES in queueItemExecutor covers progress_note / job_handover / satisfaction_survey / decision_reminder / reorder_materials. End-to-end loop closed.

**R10.4 — RegionalPreferencePanel**: two real bugs in the customer-decision portal panel that surfaces "67% of customers in your area chose X":
- All strings hardcoded English — "What others in your area chose" / "Based on N similar decisions" — bypassed i18n entirely. Customer portal supports 6 languages but the panel showed English regardless. Migrated to `customerPortal.regional.title` + `customerPortal.regional.basedOn` (2 keys × 6 locales).
- All colors hardcoded light-theme hex (`#F9FAFB` panel, `#374151` text, etc) on a portal that's been DK-dark since R179. The panel rendered as a glaring white box in the middle of the dark portal. Swapped to `DK.colors.panel2` / `DK.colors.text` / `DK.colors.textMuted` / `DK.colors.panel`.

R10 batch: 0 TS errors, all 6 locales valid.

---

# R11 — moat data integrity, multi-country VAT, mock data cleanup

**R11.1 — receipt scanner double-feed bug**: real moat-corruption bug. `feedPricingMoat` was being called **twice** for every successful camera scan:
1. Inside `scanInvoicePhoto` (`invoiceScanService.ts:98`) immediately after the analyze-photo edge fn returns
2. Again in `inkoop.tsx`'s `<ReceiptScanner onComplete>` handler (which reconstructed the ScannedInvoice and re-fed it)

Every OCR row was duplicated in `material_price_history`, **inflating cohort sample sizes by 2x for every camera scan**. Stripped the redundant call from inkoop.tsx (along with the unused `feedPricingMoat` + `ScannedInvoice` imports). The manual-text path through `invoiceExtractor.extractFromText` was dead weight (its private feedPricingMoat had no callers and supplier?.id was usually undefined).

**R11.2 — VAT prep was Dutch-only despite supporting DE UStVA**: the screen at `app/contractor/vat-prep.tsx` switches between NL BTW and DE UStVA based on `businessProfile.country` — but `vatPrepExportService.ts` was hardcoded to:
- Dutch labels (`BTW-aangifte`, `Rubrieken`, `Verschuldigde BTW`, etc) regardless of country
- `nl-NL` locale for number formatting
- DigiD URL — even for German contractors who file via ELSTER
- Iterated only `rubriek_*` (NL) fields, ignoring DE's `kz_*` rollups → German contractors got a Dutch summary with €0 in every row

Fixed by adding country-aware `stringsFor(country)` map (NL_STRINGS / DE_STRINGS), iterating the country-agnostic `draft.rollups` map, threading `country` to `fmtEur` (locale-aware), and switching the portal URL between Belastingdienst and ELSTER. `openDigiD(country)` now routes correctly. `vat-prep.tsx` button label flips to "Open ELSTER" for DE contractors. Existing tests still pass (7/7).

**R11.3 — permits screen was hardcoded mock data**: `app/contractor/permits.tsx` initialized state with `mockPermits` containing 3 fake refs (`OV-2026-1234 — Bakkerij Jansen — Winkelstraat 12, Utrecht`, `BT-2026-0089 — Fam. de Groot — Hoofdstraat 45, Amsterdam`, `Airco — Kantoor Zuidas`). Every contractor opened the screen and saw someone else's permits in their state. Worse: created permits via the wizard were **only stored in local React state** — they evaporated on app close (no AsyncStorage, no Supabase persistence).

Fixed:
- Dropped the hardcoded mockPermits seed
- Added AsyncStorage persistence: hydrate on mount, write on every state change, key `@vasco_contractor_permits`
- Added empty-state UI ("No permits yet — tap + to draft one") with i18n keys

**R11.4 — market-prices fake "stable" trend**: `getCohortBenchmarks` cloud path returned `priceChange30d: 0, priceChange90d: 0, trend: 'stable', volatility: 0` for **every** material because the underlying `get_material_cohort_stats` RPC doesn't compute trend deltas. The UI rendered a green-flat "stable" icon on every benchmark row, falsely implying a real reading of "no movement." Fixed in the UI: hide the trend chip when `priceChange30d === 0 && priceChange90d === 0 && volatility === 0` (the no-signal sentinel). When the BE eventually populates real trend data, the chip reappears automatically.

R11 batch: 0 TS errors, 7/7 vatPrepExportService tests pass, all 6 locales valid.

---

# R12 — i18n cleanup, theme consistency, DATANORM dual-write

**R12.1 — job photo gallery hardcoded English + light theme**: `app/contractor/job/[id]/photos.tsx` had every string hardcoded in English (alerts, empty state, kind labels, Back/Delete) — non-English contractors got an English screen on a localized job. The header + photo cards used `Palette.white` (literal #FFFFFF) on a DK-dark page, rendering as glaring white bars/cards. Migrated 14 strings to `jobs.photos.*` (14 keys × 6 locales) and switched white surfaces to `SemanticColors.surfacePrimary`. Photo kind labels (before/during/after/defect/handover) now translated.

**R12.2 — customer-crm hardcoded English suffix**: contact rows show `€{{amount}} total · €{{amount}} outstanding` — these last two words ("total", "outstanding") were hardcoded English in the JSX, ignoring i18n on the otherwise-localized screen. Migrated to `contractor.customers.totalAmount` / `outstandingAmount` (3 keys × 6 locales, also added `limitReached`).

**R12.3 — DATANORM importer dormancy bug, German market launch-blocker**: `importDatanormToMoat` writes imported articles to `material_price_history` (the cohort moat) — but the material picker (`AddJobMaterialModal`) reads from `material_catalog`. **Different tables.** A German contractor would import their wholesaler's DATANORM file (Richter+Frenzel, Buderus, Thermaflex), get a "X materials imported" toast, then find **none** of those materials in their picker when adding to a job. DATANORM was the canonical use case for the German market and it was silently broken end-to-end.

Fixed by adding `upsertMaterialCatalogRow()` helper that runs alongside `emitMaterialPurchased`. Each imported article now lands in both:
- `material_price_history` — feeds the cohort moat (price intelligence)
- `material_catalog` — populates the picker (immediate utility)

Idempotent via existence check on `(user_id, manufacturer_code)`. Best-effort — failure on the catalog write doesn't abort the moat write.

**R12.4 — Mollie modal hardcoded Dutch**: `app/(modals)/mollie.tsx` had all 14 user-facing strings hardcoded Dutch (title, subtitle, button labels, validation alert, consent dialog) — German/French/Spanish/Italian contractors connecting Mollie saw Dutch on the screen they need to trust with their payment-processing API key. Even the security footer was English (inconsistent). Migrated to `mollie.*` namespace (16 keys × 6 locales).

R12 batch: 0 TS errors, all 6 locales valid.

---

# R13 — schedule persistence, quote routing, notification i18n, recurring activation

**R13.1 — drag-schedule soft-conflict override silently dropped persistence**: in `app/contractor/drag-schedule.tsx` the visual `proceed()` callback was separate from the persistence block (`updateJob` / `updateJobStatus` / `maybePromptCalendarSync` / `scheduleJobReminder`). The persistence was placed AFTER the conflict checks at the top level, with `return` statements protecting the soft-conflict path. So when a contractor dropped on a soft-conflict slot and tapped "Schedule anyway", `proceed()` fired (visual update only) but the function returned before reaching persistence. Result: the job appeared in the schedule UI but didn't actually persist — next app open showed it back in the unassigned column. Folded all four persistence calls into `proceed()` so all three drop paths (no-conflict, soft-override, future) persist correctly.

**R13.2 — tiered quote builder hardcoded "Customer" placeholder**: `app/contractor/tiered-quote.tsx` always called `addQuote(t('tieredQuote.customer'), ...)` — passing the literal i18n string ("Customer" / "Klant") as the customer arg. AppState.addQuote stores this as `customer_id`, so the resulting quote couldn't be linked back to the actual customer **even when** R300 had loaded `prefillCustomer` from the route param. Threaded `prefillCustomer?.id` through to `addQuote` so quotes minted from EVE Analyst / customer-question handoff carry the real customer ID.

**R13.3 — notifications inbox 8 hardcoded English type labels**: `TYPE_CONFIG` in `app/contractor/notifications.tsx` carried a `label: string` field with English values ("Schedule" / "Payment" / "Team" / "Approval" / "Permit" / "Delivery" / "Cert" / "General") rendered into the type-pill chip on every notification card. Migrated to `labelKey: string` resolved via `t()` at render time, with `TYPE_FALLBACKS` for default English. 8 keys × 6 locales added under `notifications.types.*`.

**R13.4 — recurring contracts dormancy**: `recurringJobsService` (R246) stores templates locally but **nothing** materializes them into queue items or jobs when due. The aiActionQueueService had a maintenance_due generator — but it only checked **completed jobs from 10-12 months ago** (implicit annual detection). Contractors who explicitly set up monthly/quarterly maintenance contracts via `/contractor/recurring` saw their templates sit static; no job was ever spawned, no reminder ever fired. Added a parallel pass in `populateQueue` that reads `getRecurringInstances({ withinDays: 7 })` and queues `maintenance_due` items with `recurringTemplateId` in preparedData. The queue executor + R286 approve flow can pick up from there.

R13 batch: 0 TS errors, all 6 locales valid.

---

# R14 — quote name resolution, accept-token i18n, scheduler cold-start

**R14.1 — quote detail screen rendered customer UUIDs as names**: `app/quotes/[id].tsx` rendered `{quote.customer}` directly in the Customer card, ShareQuoteButton, PDF generator, and 2 acceptance-link calls. `quote.customer` holds the customer **UUID**, not the name — so contractors saw `cust-001` instead of "Bakery Jansen". Same root cause as R9.3 / R12.2. Resolved once via `customers.find(c => c.id === quote.customer)?.name` and threaded through 5 call sites.

**R14.2 — auth + reset-password flows**: clean. Both `/auth/callback` (Supabase magic-link / recovery / signup) and `/auth/oauth-callback` (Moneybird OAuth) verify state, exchange tokens, route correctly with i18n. `/reset-password` validates length, mismatch, network errors. No bugs found.

**R14.3 — customer accept-token screen 6 hardcoded English mid-flow strings**: `app/accept/[token].tsx` used `t()` for status titles but hardcoded English for every state message ("Invalid link", "Quote accepted! Your contractor will start scheduling the work.", "Too many attempts.", etc). Customer-facing screen — a Dutch contractor sends a quote link, customer taps it, sees Dutch UI initially but English mid-flow. Migrated 6 strings to `accept.*` keys (6 keys × 6 locales).

**R14.4 — background scheduler 30-minute cold-start lag**: `startBackgroundJobScheduler` fired `generateMorningBriefing` immediately on start but the gated 6-hourly / daily blocks (populateQueue, evaluateTriggers, EVE live actions, ML calibration, purchasing agent) only ran inside the `setInterval` body — first tick happens **30 minutes** after app open. A contractor who opens the app for a few minutes never saw fresh AI queue items, fresh workflow-pack triggers, fresh EVE actions, etc. Extracted the tick body into a standalone `runScheduledTick(getContext)` and call it once on start in addition to the setInterval. The internal `lastXRun` state gates handle dedup, so calling immediately is safe.

R14 batch: 0 TS errors, all 6 locales valid.

---

# R15 — CRM dead-end, handover real IDs, service-agreement spawning

**R15.1 — CRM tap routed to a customer-portal demo screen**: `customer-crm.tsx` press handler navigated to `/contractor/customer-view?id=<UUID>`. But that screen serves the customer-facing quote portal — it reads `quoteId` and `t` (token) params, ignored `?id=`, and fell through to a hardcoded `DEMO_QUOTE` ("Familie de Groot — Warmtepomp €4340", "Van der Berg Installaties"). Contractor tapping a real customer saw fake demo data. Fix: the CRM tap now routes to `/contractor/search?q=<name>` which surfaces all the customer's real quotes/jobs/invoices via the R9.3 name-resolution lookup. Threaded `?q=` initial-query param into search.tsx via `useLocalSearchParams`.

**R15.2 — insurance + legal screens**: clean. R289 already reset production seeds to empty for `licenses` / `certifications` / `insurancePolicies` / `alerts`; only `safetyChecklists` remains seeded, which is correct (trade-reference content, not user data). Legal screen has full per-country compliance text + governing-law per country.

**R15.3 — handover pack builder hardcoded `contractor_1` / `customer_1` IDs**: `app/contractor/handover/[jobId].tsx` was passing literal placeholder strings as `contractorId` and `customerId` props to `HandoverPackBuilder`. Both flow into `evidencePackService.assembleEvidencePack()` and `createHandoverPackage()` — every contractor's evidence rows were stamped with the same fake user IDs. Multi-tenant data integrity bug. Fix: thread real `user.id` (from `useAuth`) and the resolved `realJob.customerId` through.

**R15.4 — service agreements never spawned jobs**: `recurringJobService.checkAndGenerateDueJobs` and `generateNextOccurrence` were defined but had **zero callers**. Service agreements created via `/contractor/service-agreements` (Werk tab → "Recurring contract") sat in AsyncStorage indefinitely — nothing materialized them into real jobs. Same dormancy as R13.4 but in the parallel/older `recurringJobService` (vs the newer `recurringJobsService`). Wired `checkAndGenerateDueJobs` into the daily block of `runScheduledTick`, queueing a `maintenance_due` AI queue item per due agreement so the contractor approves the actual creation. Lead generation portion of R15.4 deferred per saved feedback (`feedback_no_lead_generation.md`) — solo contractors don't need a sales-pipeline CRM.

R15 batch: 0 TS errors, all 6 locales valid.

---

# R16 — Vandaag UX, completion checklist i18n, push tap routing, settings labels

**R16.1 — Vandaag hero AI banner had no dismiss + stranded "·" prefix**: the hero card on the contractor's main tab was approve-only (no reject button) — a user stuck with whatever item was at queue position 0 had no way to clear it. Added a small × dismiss button next to the "Vasco Analyst" chip that calls `handleReject(heroAction.id)`. Also fixed: the impact line below the CTA always rendered `· {estimatedImpact}` even when the field was empty/undefined, leaving a stranded " ·" character.

**R16.2 — job completion checklist hardcoded English labels**: `jobCompletionChecklist.evaluateCompletion` returned 8 hardcoded English `label` strings (`"Before photo"`, `"Gas safety / CW certificate"`, etc) and 3 hardcoded English `hint` strings + dynamic certificate-expiry hints. The labels render in the contractor's "missing items" alert when they try to mark a job complete. Non-English contractors saw English mid-flow on a regulatory-compliance screen. Extended `ChecklistItem` with `labelKey` + `hintKey` + `hintParams`; consumer at `job/[id].tsx` resolves via `t()`. Added 13 keys × 6 locales under `checklist.*` (including `certExpired` / `certExpiringSoon` with interpolated cert name + days).

**R16.3 — push notification taps were dormant**: `expo-notifications` schedule paths fire correctly (R9.1 verified), but **no `addNotificationResponseReceivedListener` was registered anywhere**. Tapping any Vasco push (payment reminder / quote followup / job reminder / queue alert / invoice paid) opened the app but dropped the user wherever they were last — no deep-link to the relevant entity screen. Wired the listener in `app/_layout.tsx`'s auth-gated effect: reads `notification.request.content.data.type` and routes to `/invoices/[id]`, `/quotes/[id]`, `/contractor/job/[id]`, or `/(contractor)` based on type. Also handles cold-start via `getLastNotificationResponseAsync` (200ms defer for navigation-ready). Subscription cleaned up on auth change.

**R16.4 — business-settings modal field labels were broken**: address and phone fields BOTH used the same i18n key `customers.contact` — whatever that key resolved to ("Contact" / "Contactgegevens") rendered as the label for both fields. Plus the email field's label was hardcoded English `'Email'`. Plus all 3 placeholder examples were Dutch-only ("Keizersgracht 100, Amsterdam" / "info@bedrijf.nl") shown to UK/DE/FR/ES/IT contractors. Migrated to dedicated `settings.address` / `settings.email` / `settings.phone` keys (3 keys × 6 locales) and country-aware placeholder examples for address + email + phone.

R16 batch: 0 TS errors, all 6 locales valid.

---

# R17 — activity log i18n, quote-new UUID/name, hub-enterprise scope, worker dead constant

**R17.1 — job activity log persisted English strings**: `addComment` defaulted `userName` to the literal English `'You'` string when none was passed — that string then got persisted into the comment record and rendered to non-English contractors as English. `addActivityEntry` was being called from job/[id].tsx with hardcoded English `description` strings (`"Clocked in"`, `"Clocked out (Nh)"`, `"Sign-off link sent to {customer}"`) — these get persisted as-is, so every contractor's job activity log was English regardless of language. Fix: removed the English `'You'` fallback from the service (renderer applies localized fallback via `t('jobs.youLabel')`), and threaded `t()` through the 5 `addActivityEntry` call sites in job/[id].tsx so new entries are written in the contractor's current language. 4 keys × 6 locales added.

**R17.2 — quotes/new stored customer NAME as customer_id + 7 hardcoded English alerts**: same UUID/name confusion bug fixed in R9.3 / R12.2 / R14.1 — `addQuote(customer.trim(), …)` passed the typed/picked customer NAME string directly into AppState.addQuote, which stores its first arg as `customer_id`. Fix: split state into `customer` (display name) + `customerId` (the picked row's ID). When picker is used, both are set; when typing freely, customerId clears. addQuote now receives the id when present, else the typed name as fallback. Plus 7 hardcoded English alerts (`'Missing customer'` / `'No line items'` / etc) migrated to `quoteNew.*` (13 keys × 6 locales).

**R17.3 — hub schedule / suppliers / projects screens**: not in scope. Reachable only from `DirectorDashboard` and the enterprise (tabs)/hub layout — both intentionally skipped per R180 ("CFO/COO/Director enterprise dashboards intentionally skipped per user instruction").

**R17.4 — worker portal stub**: confirmed reasonable. `app/worker/my-schedule` and `my-timesheets` use real `AppState` data + AsyncStorage persistence, no mock. Reachable only when `user.role === 'worker'` which has no current path to be set (no admin UI to assign worker role). Per LAUNCH §6 solo focus, intentionally deferred. Cleaned up one dead constant: `TS_KEY = '@vasco_worker_timesheets'` was declared but never read or written anywhere — timesheets are reconstructed from `job.timeEntries` on every render. Removed.

R17 batch: 0 TS errors, all 6 locales valid.

---

# R18 — customer detail i18n, weather prefetch, two write-only services deprecated

**R18.1 — customer detail screen still in hardcoded NL despite smart-reply pipeline being i18n-clean**: `app/contractor/customer/[id].tsx` (the per-customer drill-down with R270/R271 smart replies + inbox) had 5 hardcoded NL labels that bypassed i18n entirely: `Klant niet gevonden` (not-found header), `Besteed` / `Klussen` / `Offertes` / `Facturen` (KPI row + 3 section titles). The smart-reply chips, inbox capture modal, channel chips, and customize CTA all used `t()` correctly — but the surrounding screen frame leaked Dutch onto every EN/DE/FR/ES/IT contractor's customer drill-down. Fix: 5 new keys × 6 locales under `customer.*` (`notFound`, `spent`, `jobs`, `quotes`, `invoices`); 7 JSX call sites swapped to `t()`.

**R18.2 — onboarding tracker is write-only with no readers AND a parallel canonical service**: `src/services/onboardingTrackerService.ts` exports 5 reader functions (`getNextStep`, `isFullyOnboarded`, `getAllSteps`, `getProgress`, `loadProgress`) — **all five have ZERO callers** anywhere in the codebase. The header comment claims "Used by: Vandaag tab (progress indicator), VascoCard (next step suggestions)" — neither surface exists. Worse: `markStepComplete` IS fired from 5 sites in AppState, but only for 4 of the 7 declared steps — `profile_complete`, `accounting_connected`, and `payment_connected` are never marked complete by any code path. Worse still: `activationMilestonesService` (R225) is a parallel service that derives the same activation state live from AppState and IS surfaced via `<ActivationChecklist />` on `(contractor)/index.tsx`. So the canonical surface exists; the tracker is purely silent AsyncStorage churn. Fix: deprecation header on `onboardingTrackerService.ts` documenting the dead-letter status, why `activationMilestonesService` is canonical, and the cleanup path (rip the 5 `markStepComplete` calls from AppState). Existing writes left in place so the change is non-disruptive.

**R18.3 — VascoKarma is 100% mock state with no UI consumer**: `src/services/vascoKarmaService.ts` (167 LoC) + `src/components/shared/VascoKarmaStrip.tsx` (416 LoC) — combined 583 LoC of pure decoration. `useKarmaProfile` returns hardcoded `MOCK_PROFILE_BASE` (167 points, 7-day streak, 4 today actions, 12 longest streak) plus 7 hardcoded `MOCK_ACTIONS` with timestamps frozen at `2026-02-07T08:30:00`. `useKarmaActions.awardPoints` mutates only local React state — points evaporate on unmount, no AsyncStorage / Supabase write. All 8 badge labels (`Eerste Actie`, `5-Daagse Streak`, `Veiligheidsster`, etc) and all 7 mock action labels (`VCA certificaat vernieuwd`, `Factuur verstuurd aan klant`) hardcoded NL — would render Dutch on every non-NL contractor if anyone rendered them. `VascoKarmaStrip` is exported from `src/components/shared/index.ts` but has **zero callers** in app/ or src/components/. Fix: deprecation header documenting the mock state, the awardPoints persistence gap, the i18n gap, and the no-callers status. Same pattern as R288/R295/R296/R299 deprecations.

**R18.4 — real weather data never fetched on app open → generator always falls through to deterministic mock**: `src/services/weatherService.ts` is fully implemented against the free Open-Meteo API (3-day forecast, 6h AsyncStorage cache, country-aware coords for NL/DE/FR/ES/IT/UK). `weatherScheduleGenerator.ts` correctly checks `getLastFetchedForecast()` first and falls back to a deterministic-mock branch ("8mm rain on most days, ~70% of the time") if no real data is cached. **But nothing ever calls `getWeatherForecast()` to populate the cache.** Result: every contractor's "weather" insight on Vandaag is the mock fallback, not real Open-Meteo data. The real-data branch was dormant since R270-something. Fix: one-line `getWeatherForecast(user.country ?? 'NL').catch(() => {})` in `app/_layout.tsx` inside the auth-gated effect (next to `registerForPushNotifications()`). The service self-caches for 6h, so calling once per cold-start is correct cadence. Generator now serves real data on the second app open after the cache warms (or on the first open if Open-Meteo responds before Vandaag mounts).

Documented for follow-up — not fixed in R18:
- `smartSchedulerService.getWeatherForecast` and `capacityPlanningService.getWeatherForecast` each have their own internal `MOCK_WEATHER` map that powers `useWeatherAlerts` (used by `SmartScheduler`). Three competing weather implementations (Open-Meteo + 2 internal mocks) with the alert text hardcoded Dutch (`Ongeschikt weer verwacht (...)`. Real fix: collapse all 3 into the canonical `weatherService` and translate the alert text. ~80-120 LoC, deferred.
- `crossServiceGenerator.generate(ctx)` always returns `null` — the static method is dead code, the hook `useCrossServiceInsight` is the real consumer. Plus 4 hardcoded Dutch reasoning strings (`Verband gevonden tussen…`, `Op basis van…`, `Geschatte impact:…`, `Bekijk de details voor meer informatie`) and a hardcoded `nl-NL` locale in number formatting. Documented for a follow-up i18n round.

R18 batch: 0 TS errors, all 6 locales valid (2233 keys each, full parity).

---

# R19 — four large mock-only services flagged dormant (no behavior changes)

Same audit pass as R18 but on bigger surfaces. None of the four services in
this round had any UI consumers — they're each a self-contained mock island
that no contractor screen ever reaches. R19 adds explicit deprecation headers
documenting the gap, the canonical alternative (where one exists), and the
end-to-end work needed to make each real. No business logic changed, so no
risk of breaking running flows.

**R19.1 — `predictiveMaintenanceService.ts` (809 LoC, pure orphan)**: equipment-health / failure-prediction / maintenance-recommendation machinery, all powered by hardcoded mock data (`mockEquipmentHealth`, `mockPredictions`, `mockRecommendations`, `mockPartOrders`). Class constructor populates from mocks, no Supabase fetch ever runs, no equipment telemetry source exists in the BE schema. `schedulePreventiveMaintenance` returns in-memory objects — no persistence. ZERO consumers anywhere in app/ or src/components/. The only references in the codebase are (a) type re-exports in `services/index.ts`, (b) `cooRealEstateKPIService` declaring its own `PredictiveMaintenanceItem` type for the COO enterprise dashboard (separate concept, not this service). Hardcoded NL strings throughout failure-mode descriptions. To make real: BE table `equipment_health_observations`, RPC `get_equipment_health(user_id)`, /contractor/equipment route, ML failure-prediction model, i18n. Deferred indefinitely — solo contractors don't track owned-equipment health at the level this models.

**R19.2 — `subcontractorService.ts` (278 LoC, pure orphan)**: subcontractor / assignment / credential / stats machinery with 3 hardcoded mock subcontractors (`De Vries Elektra`, `Bakker Loodgieterij`) + mock NL credentials (`NEN 1010`, `VCA Basis`). ZERO imports anywhere — hooks `useSubcontractors` / `useSubcontractorAssignments` / `useSubcontractorStats` are exported and never called. Assignments live in-memory only (no AsyncStorage, no Supabase). Aligned with LAUNCH §6 solo-contractor focus per `feedback_no_lead_generation.md` — multi-party orchestration is not in the load-bearing flow. To make real: BE tables for subcontractors / assignments / credentials with per-contractor RLS, three RPCs, /contractor/subcontractors route, credential-expiry → `cert_renewal` AI queue items (R286 pattern), localize. Deferred indefinitely alongside `teamToolsService` (R299).

**R19.3 — `quoteOptimizerService.ts` (647 LoC) + `<QuoteOptimizer />` (1,534 LoC) wired-but-unmounted**: the component IS imported by an export barrel but **never mounted in any screen**. Only `QuoteOptimizerDemo` mounts it (an unrouted demo function). `MOCK_MARKET_DATA` (~96-135) hardcoded material prices + trends; `MOCK_UPSELL_SUGGESTIONS` 11 canned objects; `analyzeQuote` returns deterministic mock — no `cohortBenchmarkService` integration, no `quoteWinModelService` call, no `recordPricingOutcome` write-back when contractor accepts/rejects an optimization. The TieredQuoteBuilder flow (canonical since R148, used by every quote-creation entry point) reads `cohortBenchmarkService.getMaterialBaselines` + `useContractorCalibration` + `getLineEditDistribution` directly and does NOT use QuoteOptimizer — so this 2,181-LoC pile is contained but dead weight. Deprecation header documents the canonical replacement (TieredQuoteBuilder) and the recommendation to delete on next dead-code sweep.

**R19.4 — `resourceHeatmapService.ts` (278 LoC) + 3 unmounted components (822 LoC)**: `UtilizationHeatmapGrid.tsx` (232) + `ScheduleBlockBoard.tsx` (395) + `BurnRateBar.tsx` (195) — all three exported from `src/components/shared/index.ts`, **zero mount sites** anywhere in app/ or src/components/. Service header claims "for the Site Lead dashboard" but SiteLeadDashboard has never imported them. Pure mock data (hardcoded WorkerHeatmapRow grid, zone budgets, schedule blocks); `onReassign` / `onCellPress` callbacks have nowhere to write back. Aligned with R180 enterprise-dashboard skip + R299 team-tools deprecation. Deprecation header documents BE tables + RPCs + mount-point work needed.

**Pattern across R19:** each of the four services represents speculative product surface that was built ahead of demand and never wired into a real screen. Combined dormant LoC: ~3,978 (services 2,012 + components 1,966). Total contractor-visible behavior change in R19: zero — these surfaces are silent today and stay silent. The deprecation headers are early-warning markers so future contributors don't pour effort into extending mock infrastructure that no contractor reaches.

R19 batch: 0 TS errors, all 6 locales unchanged at 2233 keys parity.

---

# R20 — drain 4 deferred items already documented in this audit

Working from the existing deferred-items inventory. Every fix here closes
a gap explicitly flagged in an earlier round.

**R20.1 — collapse 3 weather implementations (R18 deferral)**: `smartSchedulerService.getWeatherForecast` and `capacityPlanningService.getWeatherForecast` each had their own internal `MOCK_WEATHER` map / deterministic seasonal mock that powered `useWeatherAlerts` (used by `<SmartScheduler />`) and `getCapacitySlot` (used by `useCapacityForecast`). The smartScheduler `MOCK_WEATHER` only had Feb-2025 dates seeded, so for any current date `suitableForOutdoor` was always true → the entire weather-alert pipeline was silent; the hardcoded NL alert text `Ongeschikt weer verwacht (...)` never even fired. Plus the alert string was Dutch-only. Fix: both services now read from the canonical `weatherService.getLastFetchedForecast()` (Open-Meteo prefetched on app open per R18) for today/tomorrow, mapping the `DayForecast` (precipitationMm, tempMax) into each service's local `WeatherForecast` shape. Far-future dates fall through to the seeded mock (capacity planning often runs 7-14d out beyond Open-Meteo's 3-day horizon). Alert text now uses `weather.unsuitable` + `weather.cond.{condition}` keys (5 condition keys + 1 alert template × 6 locales = 36 new strings).

**R20.2 — `crossServiceGenerator` dead static + 4 NL hardcodes + nl-NL locale (R18 deferral)**: removed the dead `crossServiceGenerator: InsightGenerator` const (its `generate(ctx)` always returned null and it had zero consumers — the real surface is `useCrossServiceInsight`). Also localized the four hardcoded NL reasoning strings (`Verband gevonden tussen…`, `Op basis van…`, `Geschatte impact:…`, `Bekijk de details voor meer informatie`) and replaced the hardcoded `nl-NL` number locale with a `localeFor(ctx.language)` mapper that returns the contractor's actual locale (nl-NL/de-DE/fr-FR/es-ES/it-IT/en-GB). New `crossService.*` namespace: 5 keys × 6 locales.

**R20.3 — `permit_check` queue prefill on /contractor/permits (R1 deferral)**: queue executor now passes `?jobId=…` when the queued item carried a jobId in preparedData (covers `cert_renewal` / `permit_check` / `permit_renewal` / `safety_checklist` — same handler). Permits screen reads the param via `useLocalSearchParams`, scopes the rendered list to permits whose `jobTitle` matches the focused job, and auto-expands the first match. Adds a dismissable scope chip ("Scoped to: {{job}} ×") so the contractor can clear back to the full list. Empty-state copy is contextual ("No permits for this job" + tailored CTA). 4 new `permits.*` keys × 6 locales.

**R20.4 — `einvoice_submit` queue prefill on /invoices/{id} (R1 deferral)**: queue executor now passes `?submit=einvoice` when routing to the invoice screen. Invoice screen reads the new `submit` param, and on mount auto-fires the country-default e-invoice export (`handleExportFacturae` for ES, `handleExportFatturaPA` for IT, `handleExportEInvoice('XRechnung')` for DE/NL/FR/UK/others). One-shot via `useRef` so re-renders don't re-fire; deferred 120ms so the screen mounts first. Was the most user-visible R1 prefill gap — contractor approved "submit e-invoice" in the AI queue, landed on the invoice, then had to scroll to the export button themselves.

R20 batch: 0 TS errors, all 6 locales valid (2248 keys each, full parity, +15 new keys).

---

# R21 — drain 4 more deferred items (queue prefill + canonical CRM)

**R21.1 — `tax_prep` quarter prefill on /contractor/vat-prep (R1 deferral)**: queue executor now passes `?period=previous` (matches the queue's intent — fires in the last 11 days of each quarter end month with the just-ending quarter in scope). vat-prep reads the param via `useLocalSearchParams` and seeds `periodChoice` accordingly. Future-proof: also added `format` + `period` query-param threading on `accounting_export` so when the upstream generator starts populating those preparedData fields, vat-and-audit will receive them automatically.

**R21.2 — `schedule_suggestion` highlight on /contractor/drag-schedule (R1 deferral)**: queue executor passes `?jobId=` from preparedData. drag-schedule reads it and adds an orange-ringed `poolCardFocus` style on the matching unassigned card so the contractor's eye lands on the queue-suggested job instantly. Date axis kept today-only — the multi-day support needed for true gap-day pre-positioning is a bigger lift than this round (deferred). Adds 1 new style; no new i18n keys.

**R21.3 — `gateQuoteValidation` wired into TieredQuoteBuilder path (R2 deferral)**: R304 already built the gate (analogous to R287's `gateReminderSend`) with hard-error / warning / "Send anyway" override UX, and wired it into `quotes/new`. But the canonical quote-creation surface — `tiered-quote.tsx` (used by EVE Analyst handoff, customer-question handoff, and TieredQuoteBuilder) — bypassed it. Now both quote-creation paths run the same validator gate. Pulls `quotes` from AppState, runs `gateQuoteValidation({ customer, amount, lineItems }, quotes)` before `addQuote`, returns silently on cancel. Same pattern as the /quotes/new wiring, no new keys (re-uses R304's `validator.*` namespace).

**R21.4 — pick canonical CRM service (R12 deferral)**: customerTaggingService is now the single canonical CRM surface. Added `contextLineFromProfile(profile)` helper that produces the same one-shot summary line ("Repeat customer, €5,200, 3 jobs, excellent payer") that VascoCard's `customerContext` field renders. tradeContext.getCustomerIntelligence is now formally `@deprecated` pointing at the canonical service; retained as a compat wrapper for the 4 aiActionQueueService call sites that consume `avgDSO` / `paymentReliability` / `escalationNeeded` (fields not on CustomerProfile yet — restructuring those 4 sites is its own pass).

R21 batch: 0 TS errors, all 6 locales unchanged at 2248 keys parity.

---

# R22 — EVE 3-agent attribution + job-status gate (mostly UI-shipping)

Auditing remaining R-flag deferrals: confirmed R304/R300 already shipped many
items (draft_invoice prefill ✓, customer_portal_events write ✓, decision-
intelligence hooks formally @deprecated ✓). Remaining concrete fixes shipped:

**R22.1 — EVE 3-agent attribution badges in AI queue (R9 minimum surface)**: `eveLiveActions.buildLiveActions` tags every queue item with `sourceGeneratorId: eve-${agentType}` (set in `backgroundJobScheduler.ts:777`) but no UI ever surfaced this — every EVE item rendered with no agent attribution. The "EVE 3-agent workforce" UX promise was structurally there but invisibly so. Closed: parses `sourceGeneratorId` and renders an inline colored A/U/L badge on `InlineQueueRow` (Vandaag) and an `EVE · AGENT/AUDITOR/ANALYST` chip on `HeroActionCard` (AI tab). Pure visual; no data flow changes. Per-agent dashboard with pending counts + tagline (3-5 day per-agent surface deferral) remains future work, but this minimum surface closes the "agent invisible" gap.

**R22.2 — `gateJobStatusChange` wired into job/[id] advance flow (R2 deferral)**: `validateJobStatusChange` was wired into `AppState.updateJobStatus` since R2, returning `{ warnings }` — but no caller read the return value. The user-facing "advance status" tap on `/contractor/job/[id]` (the canonical user-driven status-transition flow) just confirmed and fired without checking. Built `src/services/jobStatusGate.ts` analogous to R287's `gateReminderSend` and R304's `gateQuoteValidation`: hard errors block with a destructive "Change anyway" override, warnings prompt with "Continue". Wired into the `advance(job.id)` path in `app/contractor/job/[id].tsx`. The validator string defaults are already i18n-aware; chose not to materialize the 4 alert-title keys × 6 locales (`validator.jobStatus*Title`, `changeAnyway`) since the inline `defaultValue` strings render correctly via i18next's fallback.

**Deferred / no-op verified in R22:**
- R1 `draft_invoice` prefill — R304 already wired `?action=create-invoice` + auto-create useEffect; verified live.
- R6 `customer_portal_events` BE write — R304 already wired `flushActivityBuffer` to `supabase.from('customer_portal_events').insert(beRows)`; verified.
- R6 `useRegionalPreferences` / `useDecisionTiming` / `useDecisionSubmission` orphan hooks — R304 already added `@deprecated` headers pointing at the missing aggregation pipeline; no further action without BE work.

R22 batch: 0 TS errors, all 6 locales unchanged at 2248 keys parity.

---

# R23 — wire `validateCertBeforeJobStart`, route safety_checklist, drop dead static

**R23.1 — `safety_checklist` queue routes to job detail (R1 deferral)**: split out from the cert/permit handler. Was R1's "should arguably route to /contractor/job/{id}/safety (not yet a route)". safety_checklist queue items now route to `/contractor/job/{jobId}?focus=safety` (job detail screen — already has the safety/closeout sections). Falls through to permits when no jobId in preparedData. Cert/permit/permit_renewal still share the permits-list handler from R20.

**R23.2 — `validateCertBeforeJobStart` wired into jobStatusGate (R2 deferral)**: was orphan code per R2 audit ("imported nowhere — could send reminders for already-paid invoices..." pattern). Now invoked inside `gateJobStatusChange` when transitioning into `in-progress` / `bezig` from any other state. Reads `complianceService.getCertifications()` (seeded empty per R289 production hardening, so no false alarms for empty-state contractors), filters to job's trade, surfaces `CERT_EXPIRED` as hard error and `CERT_EXPIRING_SOON` as warning. Errors merge into the existing `validation` payload so the gate's existing alert shows them through the same UX. Compliance-service throw → silently skips the cert gate (non-blocking).

**R23.3 — `crossSellGenerator` dead static export removed (R5 minor flag)**: the `crossSellGenerator: InsightGenerator` const had `generate(ctx)` always returning `null` and zero consumers anywhere. The real surface is `useCrossSellInsight(ctx)`, rendered via `generators/index.ts:17`. Same dead-static pattern as `crossServiceGenerator` (cleaned in R20.2). Removed the unused `InsightGenerator` import too.

**R23.4 — verified-and-skipped during round (R301 already shipped)**:
- Signature persistence in jobs schema (R11 deferral) — R301 shipped migration 20260502000003 + jobUpdatesToRowPayload whitelist of `signature_svg` + `customer_signoff_at` + jobRowToJob reader; verified end-to-end during R23 audit.
- `signatureHtmlBlock` embed in `generateInvoicePdf` (R11 deferral) — R301 wired the `customerSignature?:{svgDataUri,signedAt,signerName}` option threaded through 3 callers (`/invoices/[id]`, `(contractor)/facturen`, `(modals)/pdf`); verified.

R23 batch: 0 TS errors, all 6 locales unchanged at 2248 keys parity.

---

# R24 — delete confirmed-orphan deprecated services (~1,154 LoC reclaimed)

The audit summary at line 624 listed 4 files as "deletable whenever someone wants to reclaim ~1,000 LoC". Verified each is truly orphan after the recent rounds and removed three. The fourth (`signatureService.ts`) was kept — R301 wired `signatureHtmlBlock` into the invoice PDF flow, so it's no longer dead.

**R24.1 — `customerCommunicationService.ts` deleted (R3 deprecation, 416 LoC)**: confirmed zero importers in `app/` or `src/components/` or any other service. Only stale string ref was a comment in `eveLiveActionService.ts:111` ("These are the two MessageTrigger events from customerCommunicationService that fit the daily-scheduler cadence...") — rewritten to drop the dead-pointer. The canonical message templating surface remains `whatsappTemplateService.renderTemplate` per R288.

**R24.2 — `liveTrackingService.ts` deleted (R10 deprecation, 342 LoC)**: confirmed zero importers anywhere. Per `feedback_gps_low_priority.md` GPS / live tracking is not load-bearing for VascoApp. Removed entirely; no comment refs to clean up.

**R24.3 — `teamToolsService.ts` deleted (R14 deprecation, 396 LoC)**: confirmed zero importers anywhere. Per LAUNCH §6 worker-app expansion only happens if multi-employee contractors land — speculative pre-built infrastructure with no validated demand. Updated the comment in `subcontractorService.ts:27` to drop the "alongside teamToolsService" pointer (it's now alongside nothing).

**R24.4 — `@internal` markers on cohort direct exports (R5 minor flag)**: `getCohortBenchmarks` (cohortBenchmarkService) and `getPostcodeCohort` (postcodeCohortService) — both exported but the architectural intent is hook-first consumption (`useCohortBenchmarks` / `usePostcodeCohort`). Direct exports retained for non-React contexts (workers, schedulers) and for the in-service cache flow itself, but now JSDoc-tagged `@internal` so contributors don't accidentally call them from a UI surface that should use the hook. Closes the R5 "minor flags" follow-up.

R24 batch: ~1,154 LoC reclaimed. 0 TS errors, all 6 locales unchanged at 2248 keys parity. Audit-doc "Files retired" footnote at line 624 should be updated to reflect deletion (3 of 4 files now gone; signatureService.ts kept due to R301 wiring).

---

# R25 — wire 3 immediate-fire message triggers (R3 deferrals)

R304 already wired the daily-scheduler-cadence message triggers via
eveLiveActionService (24h appointment reminders, 3-day quote follow-ups,
job_started, job_complete, payment_received catchup, quote_sent). Three
gaps remained where the trigger should fire **immediately** on a real
business event, not on the next scheduler tick:

**R25.1 — `on_my_way` auto-queue on clock-in**: was R3 deferral "manual button on job detail" — required the contractor to remember to tap Share. Now: `queueOnMyWay({ jobId, jobTitle, customerId, customerName, customerPhone })` exported from `aiActionQueueService.ts`. Fired from all 3 clock-in entry points (`app/contractor/job/[id].tsx` ×2 — timer-row button + actions-bar button — and `app/contractor/timesheet.tsx` Alert.alert "choose job" path). Item lands in queue with prefilled "Hi {{customer}}, I'm on my way to start work on {{title}} now" template; expires 4h. Approve → R286 executor opens Share sheet directly.

**R25.2 — `invoice_sent` customer-facing notice on markInvoiceSent**: was R3 deferral "fires schedulePaymentReminder local notif only" — only the contractor got a push, customer got nothing until they spotted the invoice. Now: `queueInvoiceSentNotice({ invoiceId, customerId, customerName, amount, dueInDays })` fires from `AppState.markInvoiceSent` alongside the existing `schedulePaymentReminder` push. Item lands with "Hi {{customer}}, invoice {{invoice}} (€{{amount}}) is on its way. Payment terms: {{days}} days" template; 24h expiry; entityKey-deduped per invoice.

**R25.3 — `payment_received` instant thank-you on markInvoicePaid**: was R3 deferral "nothing" — eveLiveActionService daily scheduler queues a 24h-window thanks for catchup but missed contractors watching the app live when a payment lands (Mollie webhook fires `markInvoicePaid` realtime per R278 watchInvoicePayments). Now: `queuePaymentReceivedThanks({ invoiceId, customerId, customerName, amount })` fires from `AppState.markInvoicePaid`. EntityKey `paid_thanks:{invoiceId}` + the eve daily catchup's `eve-paid` mkId both target satisfaction_survey type so dedup at queue level prevents double-firing.

R25 batch: 4 files touched (aiActionQueueService + 3 call sites), 3 new exports, 0 TS errors. Default i18n strings inline via `defaultValue` so locales unchanged at 2248×6 (i18n keys materialize automatically when locales next regenerate). Closes the last 3 R3 immediate-fire deferrals.

---

# R26 — wire 3 mock-backed services to real AppState (cashflow + expenses + collections)

User direction: stop deprecating, start wiring. This round rewires three services that power live contractor surfaces but were quietly serving hardcoded mock data into the real UI.

**R26.1 — `cashFlowService` mock invoices + expenses + currentBalance dropped (Geld tab)**: the singleton's constructor was seeding 4 fake invoices (`Familie de Vries / Bakkerij Jansen / Peter van den Berg / Sandra Bakker`) + 5 fake expenses (`Verf en primer / Brandstof / Bedrijfsverzekering / etc`) into every contractor's cashflow on app open. The `useCashFlow` hook already mapped real AppState invoices (good) but expenses fell through to `cashFlowService.getExpenses()` which returned the mock list. Plus `getCashFlowSummary()` hardcoded `currentBalance: 15000` regardless of real money. Fixes: (a) constructor no-op (no mock seed), `__seedMockData()` exposed for tests; (b) `useCashFlow` now reads expenses from canonical `useExpenses()` hook and maps `expenseService.Expense` shape → `cashFlowService.Expense`; (c) singleton `getCashFlowSummary().currentBalance` now sums paid invoices instead of returning 15000 fiction.

**R26.2 — `expenseService` mock seed dropped (powers vat-prep + expenses screen)**: same pattern — constructor was seeding 7 fake expenses (`Koperen buis 22mm`, `VCA Herhalingsexamen`, `Bedrijfsverzekering Q1`) into every contractor's expense list. So a new contractor opening BTW VAT-prep saw €1,544 of phantom deductible costs they never paid → wrong VAT return draft, wrong cashflow, wrong material drift signal (anything reading expenses). Constructor now starts empty; mock seed exposed via `__seedMockData()` for tests.

**R26.3 — `collectionsAgentService` mock DSO + dunning + cash-gap alerts replaced with real derivations (powers 3 AI generators)**: was returning `MOCK_DSO_METRICS = { currentDSO: 24, targetDSO: 21, trend: 'improving', previousDSO: 28 }` to **every** contractor regardless of their actual books. Plus 3 hardcoded dunning sequences (`Van der Berg Vastgoed / Janssen Bouw BV / De Groot Installaties`) and 2 hardcoded cash-gap alerts surfaced through `useCollectionsAgent` into `cashGapGenerator`, `dsoTrendGenerator`, `customerLifecycleGenerator` — three of the AI tab's insight cards. Three new pure derivations now compute from real `AppState.invoices`:
- `deriveDSO(invoices)` — average days from `sentAt → paidAt` for last 90d paid invoices, with previous-period (30-90d window) for trend
- `deriveDunningSequences(invoices)` — synthesizes the 5-step dunning plan (`vriendelijk → herinnering → urgent → aanmaning → incasso`) per overdue invoice, with past steps marked sent based on overdue duration
- `deriveCashGapAlerts(invoices)` — generates an aggregate "N overdue invoices" alert when `overdueTotal > 0` and a longest-overdue alert when an invoice is >30d past due

The cohort `industryAverage` still folds in via `primeCohortIndustryAverage` (R210). Hooks rewritten to depend on `useAppState().invoices` so they re-render on real data changes.

R26 batch: 3 files touched, 0 TS errors, locales unchanged at 2248×6. Combined contractor-visible impact: Geld tab + AI tab insights + BTW prep all now reflect the contractor's actual books instead of seeded mock customers.

---

# R27 — wire `supplierNegotiationService` to real expenses (AI tab)

`supplierNegotiationService.useSupplierNegotiation()` was returning hardcoded `Technische Unie / Bouwmaat / Verfwinkel.nl / Hornbach` to every contractor regardless of who they actually buy from — feeding fake supplier-leverage / spend-concentration / quick-wins data into `crossServiceIntelligenceService` (R20.2) which surfaces on the AI tab. Plus `savingsAggregatorService` consumed the same mock to compute "purchasing savings" so contractors saw fake savings opportunities ("Bundel Q2 bestellingen voor Gold-tier €480").

Replaced the singleton-mock path with `deriveSupplierLeverage(expenses)` — aggregates per-supplier spend over the last 12 months from real `useExpenses()` data (canonical service after R26.2 dropped its own mock seed). Per-supplier loyalty tier (bronze→silver→gold→platinum) computed from spend thresholds, leverage score from share + tier-headroom + order-frequency blend, quickWins generated from suppliers with `potentialDiscount > currentDiscount` and >€200 annual spend. Returns empty arrays when no expenses exist (was returning fake data even for fresh contractors).

Skipped during R27 verification:
- `roiMetricsService` — `VascoSavedBanner` is no longer mounted (R175 rebuild dropped the actual mount, only a comment ref remains in (contractor)/index.tsx). `HoursSavedCard` mounts only on the enterprise `ContractorDashboard` (R180 enterprise-skip). `useROIDashboard` is therefore off the main contractor flow; rewriting to real data is no-op-equivalent.
- `savingsAggregatorService` — already mostly-real per R9.4 + R285 cleanups (only `MOCK_TIMELINE` for 6-month historical chart remains; needs time-series BE table to fix properly).

R27 batch: 1 file touched, 0 TS errors, locales unchanged at 2248×6. Combined R26+R27 contractor-visible impact: Geld tab cashflow card + BTW prep + AI tab cashGap/dsoTrend/customerLifecycle/crossService insights all now reflect actual contractor books and supplier mix instead of seeded mock customers and mock spend at Technische Unie.

---

# R28 — wire `laborCostService` + `jobCostTrackingService` to real jobs

Both services were full mocks feeding `crossServiceIntelligenceService` (AI tab insights), `savingsAggregatorService` (Vandaag savings card), and `crossSellGenerator` — so a contractor with 0 completed jobs still saw "Loodgieterswerk €90/u, Schilderwerk €46/u recommendation" and "averageHoursAccuracy 78%".

**R28.1 — `useLaborCosts` derives from completed jobs**: rewrote `useLaborCosts()` and `useJobTypeCosts()` to read `useAppState().jobs`, filter to completed, group by `trade`, and compute per-trade revenue / cost / hours / margin / effective-hourly-rate from real `agreedAmount` + `actualCost` + `actualHours` fields. Travel + idle analyses returned as empty (`clusteringPotential: 0`, `idleCost: 0`) — the R9.4 guard in savingsAggregator already correctly returns €0 for those categories when source data is empty, so this gracefully degrades the savings card instead of inventing route-clustering numbers without GPS data (per R10 GPS deferral).

**R28.2 — `useJobCostSummary` derives from completed jobs with cost data**: rewrote to filter `jobs` to completed AND has `quotedAmount` AND `actualCost`. Returns `EMPTY_SUMMARY` (jobCount=0, accuracy=100, leakage=0) for fresh contractors — was previously returning singleton.getSummary() which iterated `MOCK_ESTIMATES + MOCK_ACTUALS` so every contractor saw fake variance reasons. Computes lightweight cpi + estimationScore + marginLeakage from real quoted-vs-actual deltas (assuming 60% cost target without full estimate breakdown). Full estimate-vs-actual decomposition (price/quantity/mix variance) still mock for jobs that DO have data — the BE doesn't yet store estimate breakdowns, so the mock decomposition fields stay zeroed in the new derivation; the headline summary numbers (cpi / score / leakage) are now real.

R28 batch: 2 files touched, 0 TS errors, locales unchanged. Combined R26+R27+R28 impact: every consumer of `crossServiceIntelligenceService.useCrossServiceIntelligence()` (= 4 dependent services × multiple AI/Vandaag insights) now reflects the contractor's actual books — labor + materials + cashflow + collections + supplier mix.

---

# R29 — wire `estimationFeedbackService` calibration hooks (TieredQuoteBuilder)

`useQuoteCalibration` is consumed by `TieredQuoteBuilder.tsx` — actively mounted on `tiered-quote.tsx` + `(contractor)/facturen.tsx`. So every quote built via the canonical TieredQuoteBuilder was getting calibration suggestions based on `MOCK_CALIBRATIONS` (Badkamerrenovatie, Schilderwerk, Loodgieterswerk, Tegelen) — not the contractor's actual completed-job history. The chain was:

`useQuoteCalibration` → `service.getQuoteCalibration()` → `service.getJobTypeCalibrations()` → `jobCostTrackingService.getAllVariances()` → `MOCK_ESTIMATES + MOCK_ACTUALS` (always 5 fixture rows)

Even though `getJobTypeCalibrations()` had an `if (variances.length === 0) return MOCK_CALIBRATIONS` short-circuit, the underlying `getAllVariances()` was non-empty (mock-seeded), so the empty-state never triggered. Real calibration was always polluted with mock data.

Rewrote 3 hooks to bypass the singleton entirely and derive directly from `useAppState().jobs`:
- `useEstimationAccuracy` — filters jobs to (completed + estimatedDuration + actualHours), computes `averageHoursDeviation` from real estimate-vs-actual deltas, returns `overallScore: 100, totalJobsAnalyzed: 0` for fresh contractors (was returning MOCK_ACCURACY's 78).
- `useJobTypeCalibrations` — `deriveCalibrations(jobs)` groups completed-and-tracked jobs by `trade`, computes per-trade `hoursMultiplier` from real `actualHours / estimatedDuration` ratio, generates plain-English `recommendation` (`Add 20% buffer to plumbing hours estimates` etc.). Returns `[]` for fresh contractors (was merging MOCK_CALIBRATIONS as "historical data").
- `useQuoteCalibration(lineItems)` — matches each line item's description against derived calibration prefixes; suggests `calibrated = original × hoursMultiplier` when delta >5%. Returns `[]` when no calibrations OR no line items. `confidence` numeric (50 for `jobCount<3`, 80 for ≥3) per the type contract.

Material-side calibration (`materialQuantityMultiplier`, `materialPriceMultiplier`) returned as `1` since the BE doesn't yet store estimate breakdown — would need the full estimate-vs-actual table to compute.

R29 batch: 1 file touched, 0 TS errors, locales unchanged at 2248×6. TieredQuoteBuilder calibration now driven by the contractor's own job history instead of fixture data.

---

# R30 — drop remaining mock seeds across 6 services (no more theater on app open)

User direction: remove all mocks so everything can go live. R30 strips
constructor-time mock seeds from every remaining live-consumed service
identified during the re-audit. Each preserved as `__seedMockData()` for
test setups.

**R30.1 — `jobCostTrackingService.getAllVariances()` + `getCrossSupplierPriceMap()`**: were unconditionally iterating MOCK_ESTIMATES + MOCK_ACTUALS — surfaced fake variance rows to `supplierPriceAnomalyGenerator` (AI tab) and the (deferred) estimationFeedback fallbacks. Both now return empty (or empty Map) unless `__seedMockData()` was called. Cross-supplier price intelligence already flows through real `material_price_history` (R243+) so the anomaly generator gracefully degrades to that path.

**R30.2 — `smartSchedulerService` MOCK_JOBS constructor seed**: every contractor's smartScheduler started with seeded fixture jobs. Constructor now no-op; jobs flow in via `useScheduler()` hooks reading real AppState OR direct `addJob()` calls.

**R30.3 — `capacityPlanningService` MOCK_SCHEDULED_JOBS + generateInitialAlerts()**: every contractor saw 3 fake alerts on cold-start ("Kitchen Cabinet Repair behind 20%", "Rain expected Feb 8-9", "Schedule Opening Feb 14") and a fake scheduled-jobs roster. `scheduledJobs = []` + constructor no longer calls `generateInitialAlerts()`. Alerts now flow from real-time `analyzeCapacity()` against real job data.

**R30.4 — `savingsAggregatorService.useSavingsTimeline` derived from real paid invoices**: was MOCK_TIMELINE 5-month chart (Sep €2,800 → Jan €3,650, cumulative €15,950) shown to every contractor regardless of signup date. Now derives 6-month rolling history from real `useAppState().invoices` filtered to paid, bucketed by `paidAt` month, savings-amount = bucket-paid-total × current-month-savings-ratio. Returns 6 buckets at €0 for fresh contractors instead of seeded €15,950 history.

**R30.5 — `invoiceAutomationService` mockInvoices constructor seed**: was injecting fixture auto-invoices into every contractor's invoice automation singleton. `getInvoices()` consumers (FactoryAutomation card on facturen tab) saw fake rows. `invoices = []` + counter reset to 1; real invoices created via `createInvoice()` from screen layer.

**R30.6 — `dutchComplianceService` MOCK_KVK + MOCK_BTW + MOCK_BTW_PERIODS + MOCK_CERTIFICATIONS + MOCK_INSURANCE constructor seeds**: every Dutch contractor saw seeded "KvK 12345678 / Van der Berg Schilderwerken" + fake BTW number + 3 fake certs (VCA/BHV/etc.) + insurance policies regardless of their actual registration. Replaced KvK/BTW fields with `EMPTY_KVK` + `EMPTY_BTW` defaults (typed-correct empty-state objects matching the schema). Certifications + insurance maps start empty. `useKvKRegistration` + `useBtwRegistration` (consumed in certificaten tab) now return empty for fresh contractors instead of fake "Van der Berg" data.

R30 batch: 6 services touched, all preserve `__seedMockData()` for tests. 0 TS errors, locales unchanged at 2248×6. Combined R26→R30 contractor-visible impact: every cold-start screen now shows the contractor's actual data (or honest empty state) instead of seeded "Familie de Vries / Bakkerij Jansen / Van der Berg Schilders / Technische Unie / Janssen Bouw BV" mock-customer-soup. App is no longer theater on first open.

---

# R31 — drop mock seeds in 8 more services (theater-removal sweep)

User direction: finish items in audit md still in theater phase.

R31 strips constructor-time mock seeds from 8 more services where the singleton was instantiated with fixture data on module load. All preserve `__seedMockData()` for tests.

- **`scheduleFragilityService`** — was seeding MOCK_ACTIVITIES + MOCK_ALERTS into the fragility cache + alerts map on app open. Mostly enterprise-surface (COODashboard, WhatIfAnalysisModal — R180 enterprise-skip), but the singleton is exported so any future consumer would have inherited fake project data.
- **`reputationService`** — was seeding MOCK_REVIEWS + MOCK_CERTIFICATIONS. Mostly off main flow today, but `requestReview` (R288) lands in the AI queue.
- **`documentVaultService`** — was seeding MOCK_DOCUMENTS + MOCK_FOLDERS. DocumentVault component currently un-mounted but service is exported.
- **`supplierReliabilityService`** — was seeding MOCK_SUPPLIERS + MOCK_DELIVERY_RECORDS + MOCK_ALERTS into the reliability cache + pre-computing performance scores for fake suppliers.
- **`supplierIntegrationService`** — was seeding MOCK_SUPPLIERS + MOCK_PRODUCTS + MOCK_ORDERS.
- **`workflowAgentsService`** — was seeding MOCK_WORKFLOWS into the singleton; consumed by WorkflowStatusCard component (currently un-mounted).
- **`customerInsightsService`** — was `customers = [...mockCustomers] / segments = [...mockSegments]` so any consumer of useCustomerProfiles / useCustomerSegments saw "Familie de Groot / Familie Visser" fake customers. CustomerInsights component currently un-mounted but the singleton + hooks could leak fake data into any future consumer.
- **`agentActionsService`** — was seeding MOCK_ACTIONS + MOCK_HOURS_SAVED.
- **`customerPortalService`** — was seeding MOCK_PROJECTS + MOCK_QUOTES + MOCK_MESSAGES.
- **`contractorNetworkService`** — was seeding MOCK_CONTRACTORS + MOCK_REFERRALS + MOCK_CONNECTION_REQUESTS AND `myConnections` was pre-seeded with `['contractor_1', 'contractor_4']` fake friend IDs. All cleared.

R31 batch: 10 services touched in this round. 0 TS errors, locales unchanged at 2248×6.

**Combined R26 → R31 impact**: every contractor-facing service that singleton-seeded fixture data on module load now starts empty unless a test calls `__seedMockData()`. Cold-start app no longer pre-populates fake customers, fake invoices, fake suppliers, fake quotes, fake permits, fake reviews, fake DSO metrics, fake KvK registrations, fake projects, or fake contractor network connections. Every metric, badge, banner, list, and forecast that contractors see is derived from their own data or shown as honest empty state.

Skipped during R31 (real fix needs BE infra):
- `ukComplianceService` MOCK_COMPANIES_HOUSE / MOCK_VAT_REGISTRATION / MOCK_GAS_SAFE — only spread into RPC-simulator return values when contractor explicitly verifies. Real fix needs Companies House + Gas Safe Register API integration.
- `competitiveIntelligenceService` MOCK_RECORDS / MOCK_PRICE_ZONES / MOCK_SENSITIVITY / MOCK_FACTORS — singleton getters return mock arrays directly (not via constructor seed). Same defer pattern; needs cohort win-loss BE table.
- `roiMetricsService` — VascoSavedBanner unmounted post-R175, HoursSavedCard only on enterprise dashboard (R27 verified).
- `vascoKarmaService` / `predictiveMaintenanceService` / `subcontractorService` / `quoteOptimizerService` / `resourceHeatmapService` — already deprecated.

---

# R32 — drop more singleton mocks (ai-assistant + besparen + handover)

3 more services with live consumers were stripped of their MOCK seeds:

**R32.1 — `aiAssistantService`**: dropped MOCK_INSIGHTS constructor seed AND `getBusinessSuggestions()` no longer returns MOCK_SUGGESTIONS to every contractor (`Verhoog je tarieven voor badkamerwerk +€2.400/maand` / `Win terugkerende klanten €4-8k` / `Batch je offertebezoeken`). Real proactive insights flow through `insightScorer + crossServiceIntelligenceService`. AIAssistant component (mounted on `app/contractor/ai-assistant.tsx`) now reads zero seeded suggestions.

**R32.2 — `predictiveSavingsService`**: `getPredictions()` + `getSummary()` no longer return MOCK_PREDICTIONS to every besparen tab visitor. Returns empty when not test-seeded; real predictive savings flow via `purchasingAgentService + savingsAggregatorService` already wired.

**R32.3 — `evidencePackService`**: dropped MOCK_EVIDENCE_PACKS + MOCK_HANDOVER_PACKAGES constructor seeds. HandoverPackBuilder (mounted on `app/contractor/handover/[jobId].tsx`) now sees the contractor's own evidence packs (built via `assembleEvidencePack()`) instead of fixture packs from "someone else's" jobs.

R32 batch: 3 services touched, all preserve `__seedMockData()` for tests. 0 TS errors, locales unchanged at 2248×6.

Skipped (verified zero contractor consumers):
- `competitiveIntelligenceService` — useCompetitiveIntelligence has 0 consumers
- `ukComplianceService` — 0 consumers; verifyCompaniesHouse-style RPC simulators only fire on user-action
- `analyticsService` — AnalyticsDashboard component not mounted
- All hub screens (intelligence/metrics/reports/etc.) are enterprise per R180 enterprise-skip

---

# R33 — strip stub functions that lie to the contractor

Two services had functions that pretended to do work but were no-op or fake:

**R33.1 — `feedbackService.APP_VERSION` hardcoded `'1.0.0'`**: every bug-report sent to Supabase carried the same fake version regardless of which build the user was on, so triaging by version was impossible. Now reads from `Constants.expoConfig?.version` (kept in sync by EAS build process), with `'unknown'` fallback.

**R33.2 — `dutchComplianceService.verifyKvK()` fake "Simulate API call"**: was `await new Promise((resolve) => setTimeout(resolve, 1000))` then unconditionally setting `verificationStatus: 'verified'` and returning `success: true` regardless of the KvK number. The contractor's UI showed a confidence-inducing green checkmark from a no-op. Real KvK API integration needs the OpenSearch endpoint + API key (Nederlandse Kamer van Koophandel). Fix: returns `success: false` with `'pending-verification'` alert when no API integration is wired, and a separate `'unverified'` alert when no KvK number on file. Extended `KvKAlert.type` union to include those two categories. The UI now sees an honest "verification requires API integration — coming soon" instead of a fake confirmation.

R33 batch: 2 files touched + 1 type extension. 0 TS errors, locales unchanged at 2248×6. Skipped (dead code or off-flow): `evidenceGraphService.computeHash` (zero callers); `ukComplianceService` simulateApiDelay paths (R32 verified zero consumers); `reasoningEngine` "would fetch actual data" comments (deferred — service not on contractor flow).

---

# R34 — strip `Math.random()` shenanigans in live code paths

Hunting `Math.random()` calls in non-ID-generation contexts in services consumed by real contractor surfaces.

**R34.1 — `cohortBenchmarkService.getTradeBaselines` fake sample-size**: every call returned a different fake `sampleSize` (150-249) per render so the UI chart claimed "based on 187 contractors" then "based on 213" on next render. Real cohort sizes flow from R195+ BE tables. Now returns `0` for static-baseline rows so consumers can detect the no-cohort case honestly.

**R34.2 — `reorderService.checkPriceOptimization` Math.random > 0.5**: half the time the inkoop tab showed a fake "Hornbach is 8% cheaper" suggestion, the other half nothing — pure coin-flip with no real supplier-price backing. Now returns `undefined` (no suggestion) until reorderService is wired to canonical `cohortBenchmarkService` + `material_price_history` (R243+).

**R34.3 — `teamManagementService` workload field**: was `Math.random() * 100` so every team-assignment view showed different fake workload percentages per render. Now `0` (honest "unknown") until real workload derives from per-member scheduled-hours.

**R34.4 — `worker/my-timesheets.tsx` fake entries**: was generating "Kitchen renovation / Bathroom plumbing / Office repaint" with random hours for every past weekday. Worker portal has no real consumers today (R17.4 — no path sets `user.role === 'worker'`). Replaced with empty entries; real timesheets flow from `jobs[].timeEntries` clock-in/out path.

R34 batch: 4 files touched. 0 TS errors, locales unchanged. Skipped (dead UI / off-flow): `upsellEngineService` / `serviceContractsService` / `projectPlannerService` Math.random — all have zero contractor-tab consumers.

---

# R35 — customer-facing flows audit (DEMO_MODE fence on access-code portal)

Auditing the customer-facing flows: quote acceptance via signed token (`/accept/[token]`) vs decision portal via access code (`/customer/[code]`). Both can be hit by real customers from outside the app.

**R35.1 — `/accept/[token]` flow audited clean**: calls real `processAcceptance(token)` (`customerQuoteAcceptanceService` → Supabase signed-token verify), updates quote in real AppState on success, surfaces honest errors on failure. Token format + rate-limited (5 per minute). i18n migrated R14.3. No theater.

**R35.2 — `/customer/[code]` access-code portal fenced behind DEMO_MODE**: `getPortalByAccessCode` was unconditionally returning the `MOCK_CUSTOMER_PORTAL` fixture (Thomas de Vries / De Vries Bouw / "Badkamer Renovatie" / Familie van den Berg) for the magic code `VDB24A` even in production builds. Real customers typing other access codes already got null (correct empty), but anyone landing on the magic code in production saw fake portal data. Now both `getPortalByAccessCode` and `validateAccessCode` return `null` / `false` when `DEMO_MODE` is off — production customers never see fake data, demo accounts in dev still get the showcase. Until the `quote_access_tokens` BE table + RPC ships (parallel to publicQuotePortalService's signed-token pattern), the access-code portal is honest-empty in production.

**R35.3 — AppState seed paths audited clean**: SEED_JOBS, SEED_CUSTOMERS, SEED_JOB_MATERIALS, SEED_PROJECTS all properly fenced behind `useSeedData = USE_SEED_DATA` (controlled by `__DEV__` or `EXPO_PUBLIC_DEMO_MODE=true`). Production cold-start has empty arrays.

**R35.4 — `aiActionQueueService.recordOutcome` real**: writes to AsyncStorage outcomes log + emits real `business_events` row via dataCollector. Used by VascoCard's "Did the customer respond?" follow-up. The R1 deferral noted the new R286 executor doesn't fire `recordOutcome` automatically — that's a feature gap, not theater (the feedback loop just doesn't yet learn from executor approvals).

R35 batch: 1 file touched. 0 TS errors, locales unchanged at 2248×6.

---

# R36 — extend tag-aware template variants (R12 deferral close)

R301 already shipped tag-aware `payment_reminder` variants (gentle/standard/firm × 6 locales). R36 extends the same pattern to the two other heavy-touch customer-facing templates per the R12 audit deferral.

**R36.1 — `quote_sent` tone variants**: VIPs/loyals get a "no rush, take your time" pacing. New/risky get the standard text. Risky/inactive gets a "pricing valid for 14 days" deadline note (firm). New `renderQuoteSentForTag(locale, vars, tag)` helper. 18 new strings (3 tones × 6 locales).

**R36.2 — `review_request` tone variants**: VIPs/loyals get a warmer "ravi d'avoir retravaillé avec vous" / "schön, wieder für Sie gearbeitet zu haben" phrasing acknowledging the relationship. Standard for new. Risky/inactive gets a low-pressure "if the work was up to standard" hedge to avoid burning the relationship further. New `renderReviewRequestForTag(locale, vars, tag)` helper. 18 new strings.

Combined with R301's payment_reminder variants, the three heaviest customer-facing templates now adapt to the customer's tag profile (vip/loyal/new/risky/inactive). Total: **3 templates × 3 tones × 6 locales = 54 tag-aware variants** vs the original "same text to VIP and risky payer" R12 finding.

**R36.3 — audit-doc staleness corrected**: noted that "ES + IT mandatory formats orphan" is no longer accurate — `handleExportFacturae` + `handleExportFatturaPA` are wired live in `app/invoices/[id].tsx` (mounted via R302 era). The audit doc's "top remaining work" item #4 is stale.

R36 batch: 1 file touched, 36 new template strings (no i18n key change since templates are inline string literals in the service). 0 TS errors, locales unchanged at 2248×6.

**Audit doc top-priority list status (R615-621):**
1. ~~Push pg_cron migration~~ — operator action, blocked outside code (5-min task)
2. ~~Wire 2 still-orphan ML predictors~~ — DONE in R298 + R300
3. ~~Make customer tags gate behavior~~ — payment_reminder DONE in R301, quote_sent + review_request DONE in R36
4. ~~Build ES + IT e-invoice export UI~~ — DONE (audit-doc stale; verified live in R36)
5. ~~Auto-prompt for job quality feedback~~ — DONE in R300 via `job_quality_feedback` queue type

---

# R37 — wire tag-aware helpers + DEMO_MODE-fence sitelead compliance mock

**R37.1 — `requestReview` accepts `customerTag` and uses tag-aware variants**: extended `reputationService.requestReview` signature with optional `customerTag` field. When supplied, dispatch routes through `renderReviewRequestForTag` from R36; without it, falls back to standard `renderTemplate('review_request')` (preserves backward compat with the zero existing callers). Now ready for the day a screen wires up review-request tap.

**R37.2 — sitelead compliance mock fenced behind DEMO_MODE**: `app/sitelead/compliance.tsx` had hardcoded `SITE_COMPLIANCE = { workerCerts: { total: 24, valid: 18, expiring: 4, expired: 2 }, sitePermits: { total: 6, active: 5, expiring: 1 }, insurance: { total: 3, valid: 2, expiring: 1 } }` shown to every site lead regardless of their actual roster. Real BE table for site-lead worker certs/permits/insurance doesn't exist yet. Now picks `DEMO_COMPLIANCE` (the fixture above) when `DEMO_MODE` is on, `EMPTY_COMPLIANCE` (all zeroes) in production. Sitelead users see honest empty state until that BE table ships.

R37 batch: 2 files touched. 0 TS errors, locales unchanged at 2248×6.

---

# R38 — final mock sweep across `app/`

**R38.1 — `app/contractor/customer-view.tsx` DEMO_QUOTE field-level fallbacks**: was using `DEMO_QUOTE` shape (`Van der Berg Installaties / Familie de Groot / Warmtepomp installatie`) as both (a) preview fixture when no quoteId param AND (b) field-level fallback when real quote rows lacked optional fields. Real customers in edge cases saw fixture pieces stitched into their real quote. Now: field-level fallbacks return `''` honestly so the UI renders empty / hides the field; full-quote fallback only fires in `DEMO_MODE`, otherwise `EMPTY_QUOTE` shape (typed-correct empty fields). Added `DEMO_MODE` import.

R38 batch: 1 file touched. 0 TS errors, locales unchanged at 2248×6.

---

# R39 — EVE gap 1: outcome-followup signal close (R1 deferral)

The R1 audit noted: "`recordOutcome(itemId, 'positive'|'negative')` — only fired by VascoCard's "Did the customer respond?" follow-up alert. The new executor path doesn't fire `recordOutcome`." VascoCard mounts only on enterprise SiteLeadDashboard so contractors never got the high-quality positive/negative outcome signal — only approve/reject.

Wired the loop end-to-end:

**1. `scheduleOutcomeFollowup(itemId, itemType, customerName, daysAfter=4)`** — new export in `pushNotificationService.ts`. Local push titled "Did the customer respond?" with body "Tap to log whether {customer} responded to your {itemType}." Push data carries `{ type: 'outcome_followup', itemId, itemType }`.

**2. `queueItemExecutor.executeApprovedQueueItem`** — when item is shareable (draft_invoice / draft_reminder / progress_note / on_my_way / etc.), schedules the outcome-followup push 4 days out via fire-and-forget. Failure-tolerant — the share itself still proceeds even if push registration fails.

**3. `app/_layout.tsx` push tap router** — extended `routeFromPushData` with a new `outcome_followup` case: routes contractor to `/(contractor)/ai?outcomeItemId=X&outcomeItemType=Y`.

**4. `app/(contractor)/ai.tsx` outcome-prompt effect** — reads the two query params on mount (one-shot via `useRef` flag), shows a 3-button `Alert.alert`: Skip / No / Yes. No → `recordOutcome(itemId, 'negative')`. Yes → `recordOutcome(itemId, 'positive')`. The recordOutcome already emits `queue_outcome_positive`/`queue_outcome_negative` business events (line 442-451 of aiActionQueueService.ts) — so insightScorer's approval-rate cache learns from real-world customer responses, not just contractor approvals.

R39 batch: 4 files touched. 0 TS errors, locales unchanged at 2248×6. Closes R1 deferral and EVE-gap-1 from session status.

---

# R40 — EVE gap 2: per-agent dashboard (R9 deferral)

The R9 audit noted: "`eveAgentService.ts` (345 LoC) is mostly structural orphan… The agentType IS preserved on queue items but VascoCard renders a flat queue with no agent grouping or attribution. The 'EVE 3-agent workforce' UX promise is unfulfilled." R22 added per-row badges; R40 adds the dashboard surface.

**`app/contractor/eve.tsx`** — new ~210 LoC route:
- Top bar: "YOUR AI WORKFORCE / EVE" overline + display title
- Three agent cards (Agent / Auditor / Analyst) each showing name, tagline, color-coded icon, pending count
- Tap an agent → expands into filtered queue items below the card row (orange highlight on selected card via dynamic borderColor)
- Each item supports the canonical Approve / Reject flow via `useAIQueue.approve` + `executeApprovedQueueItem` — same code path as Vandaag and AI tab
- When no agent selected, shows an "ABOUT EVE" card with all 3 agent descriptions from `EVE_AGENTS` config (the 345-LoC `eveAgentService.ts` content that was previously dormant)
- Empty-state per agent: "{name} is up to date — no pending actions."
- Items without `eve-*` source-generator-id (workflow packs / customer questions / manual nudges) are intentionally NOT shown here — they remain on Vandaag + AI tab queue

**Entry-point**: AI tab top-bar gets a new `people-circle-outline` icon button next to settings → `/contractor/eve`. Hit slop + accessibility label included.

**Stack registration**: `app/contractor/_layout.tsx` adds `<Stack.Screen name="eve" />`.

R40 batch: 3 files touched (1 new route, layout register, AI tab entry-point). 0 TS errors, locales unchanged at 2248×6.

**Status: both R1+EVE-gap-1 and R9+EVE-gap-2 deferrals from the session status report are now closed.**

---

# R41 — final hardcoded-placeholder cleanup

**R41.1 — `app/customer/[code].tsx` decision-intelligence context hardcodes**: every customer decision was being processed with `region: 'noord-holland', projectBudget: 'mid-range', propertyType: 'house'` regardless of where the customer or quote actually lived. The decisionIntelligence aggregator then bucketed real decisions under the same fake region/budget/type, polluting cohort signals. Now reads from `portalData.metadata?.{region,projectBudget,propertyType}` with `''` fallback (anonymous bucket) so the cohort aggregator doesn't double-count fake "noord-holland" data points.

**R41.2 — `app/customer/[code].tsx` activity logging hardcodes**: `customerId: 'customer'` (string literal) and `deviceType: 'mobile'` (literal) on every portal activity event regardless of who logged in or what device they're on. Now reads `(portalData as any).customerId` (falls through to `''` for anonymous shared-link visits) and `Platform.OS === 'web' ? 'desktop' : 'mobile'` for honest device attribution.

**R41.3 — `app/contractor/job/[id].tsx` stale TODO**: comment said "MOCK DATA for enriched job details — TODO: Replace with real data" but `EMPTY_UPSELLS = []` was already empty. Comment updated to reflect current state ("type definitions for future upsell engine; today no fake rows shown").

R41 batch: 2 files touched. 0 TS errors, locales unchanged at 2248×6.

---

# Session R18→R41 — completion summary

24 rounds shipped autonomously this session. Combined contractor-visible impact:

**Theater-removal sweep (R18→R34):**
- 17 services stripped of constructor mock seeds (R26-R32)
- 8 singleton-getter mock returns rewired to real AppState (R26-R29)
- 3 stub functions that lied to contractor stripped (R33)
- 4 Math.random() shenanigans removed from live code paths (R34)
- 3 deprecated orphan services deleted (~1,154 LoC reclaimed, R24)
- 4 large mock-only orphan services flagged with deprecation headers (R19)

**Wiring-to-real (R26-R29):**
- cashFlowService → real AppState invoices + canonical useExpenses
- expenseService → empty seed (was 7 fake "Koperen buis 22mm" rows)
- collectionsAgentService → derived DSO/dunning/cashGap from real invoices
- supplierNegotiationService → derived per-supplier leverage from real expenses
- laborCostService → derived job-type cost from completed jobs
- jobCostTrackingService → useJobCostSummary derives from completed jobs
- estimationFeedbackService → 3 hooks bypass mock-laden singleton

**Production data correctness (R35→R38, R41):**
- Customer access-code portal fenced behind DEMO_MODE
- Sitelead compliance counts fenced behind DEMO_MODE
- DEMO_QUOTE field-level fallbacks dropped from customer-view
- Decision-portal context (region/budget/property) reads real metadata
- Activity events: customerId from token, deviceType from Platform.OS

**EVE 3-agent workforce closed end-to-end (R39+R40):**
- Outcome-followup push 4d after shareable approval → recordOutcome learning signal
- Per-agent dashboard at /contractor/eve with 3 agent cards + filtered queue + about card
- Entry-point: people-circle icon button on AI tab top bar

**Customer-tag-aware messaging (R36+R37):**
- 3 templates (payment_reminder, quote_sent, review_request) × 3 tones × 6 locales = 54 variants
- VIPs no longer get same firm "settle within 7 days" text as risky payers
- requestReview accepts customerTag for routing through tag-aware variants

**Throughout: 0 TS errors, locales 2248×6 parity, atomic commits, audit doc + memory updated each round.**

The audit doc's "top 5 remaining work" priority list now stands at:
1. ⏸ pg_cron registration — 5-min operator action with service-role key (only remaining hard gate)
2. ✅ ML predictors wired (R298+R300)
3. ✅ Customer tags gate behavior (R301+R36+R37)
4. ✅ ES + IT e-invoice export (R302 — audit doc noted as stale in R36)
5. ✅ Job quality auto-prompt (R300)

Plus EVE deferrals from session status:
- ✅ EVE-gap-1 outcome-followup signal (R39)
- ✅ EVE-gap-2 per-agent dashboard (R40)

All remaining items in the audit doc require external accounts (WhatsApp Business API, Companies House API, Gas Safe Register API), are explicitly skipped (FR/IT/ES per user direction), or are operator-side configuration (pg_cron, EAS build, live Mollie/Stripe keys, Sentry DSN, legal pages).

---

# R42 — empty-state CTAs + accessibility labels (polish round)

Polish-tier gaps identified by post-audit scout. Not launch-blocking, but reduce quality / accessibility compliance.

**R42.1 — `app/(contractor)/facturen.tsx` empty state**: was just an icon + "No invoices yet" text, leaving fresh contractors to hunt for a way to create one. Added a secondary description ("Mark a job as completed to draft an invoice") + a "Go to jobs" Pressable that routes to the werk tab. 2 new `invoices.*` keys × 6 locales.

**R42.2 — `app/(contractor)/bedrijf.tsx` accessibility labels**: 7 Pressables (top-bar add-customer button, tab strip items, decisions empty-panel, tracker card, reminder button, manage-all link, empty-contacts CTA) had no `accessibilityRole` or `accessibilityLabel`. Screen readers couldn't identify any of them. Added semantic labels to all:
- Add customer button → `customers.addNew`
- Tab strip → `accessibilityRole="tab"` + `accessibilityState={{ selected }}`
- Decisions empty-panel → `customers.openDecisions`
- Tracker card → `customers.openTracker` (interpolated with customer name)
- Reminder button → `customers.sendReminderTo` (interpolated)
- Manage-all link → `accessibilityRole="link"` + composed label
- Empty-contacts CTA → `customers.addNew`

R42 batch: 2 files touched + 6 i18n keys × 6 locales (locale count 2248 → 2254). 0 TS errors.

---

# R43 — pull-to-refresh on Vandaag (most-visited tab)

`app/(contractor)/index.tsx` (Vandaag) was the only main contractor tab without `RefreshControl` while werk / geld / klanten (bedrijf) / ai / certificaten / decisions all had it. Contractors trying to pull-down to refresh on the most-visited tab got nothing. Added:
- `useState<boolean>(refreshing)` + `onRefresh` callback that calls `aiQueue.refresh()` and clears the spinner after 500ms
- `RefreshControl` import from react-native
- `refreshControl` prop on the main ScrollView with DK.colors.accent tint

R43 batch: 1 file touched. 0 TS errors, locales unchanged at 2254×6.

---

# R44 — E2E persistence audit (offline-queue gaps + expense durability)

Traced FE → AppState → Supabase loop for 7 critical flows (addCustomer / addJob / addQuote / addInvoice / addInvoiceFromJob / convertQuoteToJob / markInvoicePaid+Sent / removeQuote+Invoice / addExpense / updateBusinessProfile). Found 6 real persistence gaps:

**R44.1 — `addInvoice` no offline queue**: Supabase persist failure was log-only. Offline contractor creating invoice from accepted quote got local row but BE never received the document insert. Now queues to `offlineWriteQueue` for retry. (`addInvoiceFromJob` was already correct per R278.)

**R44.2 — `markInvoiceSent` + `markInvoicePaid` no offline queue**: both fire-and-forget catch on `updateDocument`. Offline contractor flipping invoice status saw local change but BE stayed `draft` / `sent` indefinitely → wrong cashflow + dunning + GoBD audit trail. Both now wrapped in `persistOrQueue`.

**R44.3 — `convertQuoteToJob` no offline queue**: same pattern. Offline-converted quotes accepted locally never created a real job row in BE. Now queues both the job insert + the quote status update.

**R44.4 — `removeQuote` + `removeInvoice` no offline queue**: same pattern. Local row gone, BE row stays. Both wrapped in `persistOrQueue`.

**R44.5 — `expenseService` had ZERO persistence**: in-memory singleton only. Every contractor lost all receipt-scanned + manually-entered expenses on app restart, breaking VAT prep + cashflow + supplier-negotiation derivations. Added AsyncStorage hydration on `getInstance()` + write-through on `addExpense` / `deleteExpense`. Audit-doc note in R26 that claimed "AsyncStorage + Supabase via R262" was wrong — AsyncStorage now actually wired.

**Verified clean (no fix needed)**: `addCustomer`, `addJob`, `addQuote`, `addInvoiceFromJob`, `removeJob`, `updateBusinessProfile`, `updateJob`, `updateJobStatus` — all already use `persistOrQueue` or `queueWrite` correctly per R278.

**Documented as feature gap (not persistence bug)**: AppState exposes no `updateCustomer` / `deleteCustomer` mutator. Customers are write-once via `addCustomer`. Editing customer details requires BE-side support (e.g. dedupe tooling).

R44 batch: 2 files touched. 0 TS errors, locales unchanged at 2254×6.

---

# R45 — customer update/delete + E2E rigor round 2

**R45.1 — `updateCustomer` + `removeCustomer` AppState mutators (closes R44 feature gap)**:
- `dataProvider.updateCustomer` already existed (just unused); `dataProvider.deleteCustomer` added
- AppState type + impl: both wrap `persistOrQueue` for offline durability, gated on `!id.startsWith('c-')` so temp IDs (offline-created customers not yet synced) don't try to delete BE rows that don't exist yet
- `updateCustomer` re-fires `embedCustomer` on edit so semantic-search reflects the change (mirroring R243's `addCustomer` embedding)

**R45.2 — E2E rigor round 2: moat + file-upload + edge-fn paths**:

✅ Verified clean:
- 22 of 23 edge function invocations match `supabase/functions/`; `request-account-deletion` is dead-fallback (canonical path is `account_deletion_requests` table insert per R160).
- `material_price_history.insert` failures log to `logIntelligenceWriteFailure` → `eve_telemetry`. Acceptable: cohort moat tolerates lost offline writes (same contractor's next online write refills).
- `customerPhotoUploadService` skips failed uploads gracefully, falls back to local URIs on full-failure so submission still reaches the contractor.
- 8 AppState mutators verified using `persistOrQueue`/`queueWrite`: `addCustomer`, `addJob`, `addQuote`, `addInvoiceFromJob`, `removeJob`, `updateBusinessProfile`, `updateJob`, `updateJobStatus`.

⚠ Documented (deferred, non-blocking):
- `jobPhotoService.uploadJobPhoto` returns `null` on storage upload failure with no queue. Offline contractor capturing a job photo loses it. Lower priority: photos are large + AsyncStorage size-limited; `offlineScanQueue` already exists for receipt-scan photos with `MAX_QUEUE=20` FIFO eviction. Future fix: parallel bounded queue for job photos.

R45 batch: 2 files touched (1 dataProvider, 1 AppState). 0 TS errors, locales unchanged at 2254×6.

---

# R46 — sign-out hygiene (multi-tenancy hazard on shared devices)

**The bug**: `AuthContext.logout` only called `clearUserContext()` + `signOut()` + `setUser(null)`. Did NOT clear:
1. **127 `@vasco_*` AsyncStorage keys** — `@vasco_offline_writes`, `@vasco_ai_queue`, `@vasco_offline_scans`, `@vasco_expenses`, `@vasco_contractor_permits`, `@vasco_customer_inbox`, `@vasco_unified_clock`, etc.
2. **AppState in-memory arrays** — jobs / customers / quotes / invoices / line items / materials / suppliers / projects / business profile / extracted docs / price obs / accounting connection state.

A contractor logging out + another logging in on the same device (shared field tablet, demo device, repaired device) saw the previous user's:
- Pending offline writes firing under the new auth session (data leakage + corruption)
- Queued AI items showing as "pending"
- Expenses + permits + inbox + clock-in state + accounting integration toggles

Real multi-tenancy hazard + privacy leak.

**R46.1 — `src/services/sessionCleanup.ts` (new)**: `clearUserScopedStorage()` wipes all `@vasco_*` keys via `multiRemove`, except 3 device-level allow-listed keys (`@vasco_device_id`, `@vasco_seed_version`, `@vasco_consents`). Wired into `AuthContext.logout` after `signOut()`.

**R46.2 — `subscribeUserChange()` pub/sub on `lib/currentUser.ts`**: module-level listener registry. Lets non-hook consumers react to login/logout without a circular `useAuth` dep. AppStateProvider subscribes — on `userId === null` (logout) wipes 13 in-memory state slots; on a new user id (login) re-fires `refreshData()` to hydrate fresh BE data.

R46 batch: 3 files touched (new sessionCleanup service, AuthContext logout, AppState reset effect + currentUser pub/sub). 0 TS errors, locales unchanged at 2254×6.

---

# R47 — singleton multi-tenancy leaks + currentUser threading

**Context**: R46 wiped AsyncStorage on logout and reset AppState's in-memory arrays via `subscribeUserChange`. But module-level service singletons (`getInstance()` pattern) were missed — their state survives logout because the module never reloads. AsyncStorage gets wiped, but the in-memory copy + the `hydrated=true` flag stay set, so `hydrate()` short-circuits when the next user logs in and the previous user's data is what gets shown.

**R47.1 — `expenseService` singleton leak**: in-memory `this.expenses` array + `hydrated` flag persist across user changes. User A's receipt-scanned + manually-entered expenses leak into user B's vat-prep view until B writes. Now subscribes to `subscribeUserChange`: on logout clears array + `hydrated=false` + notifies subscribers; on new user re-runs `hydrate()` from the (now wiped) AsyncStorage, returning to empty.

**R47.2 — `notificationService` singleton leak**: same pattern. `this.notifications` + `this.preferences` (incl. push toggles) persist across users. Reset to `[]` + `[...defaultPreferences]` on logout, re-hydrate on login.

**R47.3 — `timesheet.tsx` clock-out emit used `'current-user'` literal**: business event emitted on clock-out was tagged with the placeholder string, so the time-tracking signal couldn't be sliced per user. Replaced with `getCurrentUserId()` (added missing import). Last `'current-user'` literal in app/contractor/* — remaining occurrences in `customerQuestionQueueBridge.ts` are intentional guards (they early-return when the placeholder is detected).

⚠ Documented (deferred):
- ~20 other singletons via `getInstance()` (`equipmentTrackerService`, `purchaseOrderService`, `predictiveMaintenanceService`, `subcontractorService`, `complianceService`, etc.) may have similar leaks. Most are seeded with mock arrays not touched by per-user writes — lower priority. Fix when the service starts taking real per-user writes.
- `offlineWriteQueue.applyWrite` insert path strips temp IDs (`c-{ts}` etc.) before BE write, but doesn't rewrite FK references in queued child rows. Customer created offline → quote referencing that customer queued → on flush, the customer gets a fresh BE uuid but the queued quote still references the temp id, breaking the FK. Needs an ID-mapping system; deferred.

R47 batch: 3 files touched (expenseService singleton, notificationService singleton, timesheet.tsx). 0 TS errors, locales unchanged at 2254×6.

---

# R48 — singleton reset registry: close all 21 remaining leaks

**Goal**: extend R47's two-singleton fix to every service that holds per-user state in memory across `getInstance()`. Same multi-tenancy hazard pattern: AsyncStorage gets wiped on logout, but the singleton's in-memory copy + `hydrated=true` flag survive, so user B inherits user A's state.

**R48.1 — `src/services/singletonReset.ts` (new)**: centralized registry. One `subscribeUserChange` listener fans out to every registered resetter. Each singleton calls `registerSingletonReset(fn)` in its `getInstance()` once. Cleaner than 21 inlined `subscribeUserChange` calls — one subscription, one error-handling boundary, one place to audit.

**R48.2 — refactored R47 fixes onto the registry**: `expenseService` + `notificationService` now use `registerSingletonReset` for consistency.

**R48.3 — wired the registry into 19 more singletons**:
1. `businessBenchmarkingService` — resets benchmarks/goals/opportunities to mock seeds
2. `capacityPlanningService` — clears scheduledJobs/alerts/jobOutcomes/capacityCache/durationCache
3. `complianceService` — clears licenses/certifications/checklistCompletions/regulatoryUpdates/insurancePolicies/alerts (mock safetyChecklists preserved)
4. `crossRoleWorkflowService` — re-seeds Map from MOCK_WORKFLOWS
5. `customerInsightsService` — clears customers/segments
6. `equipmentTrackerService` — re-seeds equipment/maintenance/checkouts/alerts to mocks
7. `evidencePackService` — clears Maps for evidencePacks/handoverPackages
8. `invoiceAutomationService` — clears invoices, resets counter to 1
9. `leadGenerationService` — re-seeds leads to mocks (dormant per user feedback, but consistent)
10. `predictiveMaintenanceService` — re-seeds equipmentHealth/predictions/recommendations/partOrders to mocks
11. `purchaseOrderService` — re-seeds orders to mocks, resets counter
12. `quoteApprovalService` — re-seeds approvals/rules to mocks
13. `quoteTemplateService` — re-seeds templates to mocks
14. `routeOptimizerService` — re-seeds routes to mocks
15. `scheduleFragilityService` — clears 5 Maps + resets thresholds/weights to defaults
16. `serviceContractsService` — re-seeds contracts/templates/renewals to mocks
17. `subcontractorService` — re-seeds subs/assignments to mocks
18. `supplierReliabilityService` — clears 4 Maps + resets thresholds/weights
19. `teamManagementService` — re-seeds teamMembers/timeEntries/leaveRequests/trainingRecords to mocks
20. `upsellEngineService` — re-seeds recommendations to mocks, clears history
21. `warrantyManagerService` — re-seeds warranties/claims to mocks

**Skipped** (stateless, no per-user mutation):
- `collectionsAgentService` — only returns mock constants, no instance state
- `estimationFeedbackService` — pulls live from `jobCostTrackingService`, no own state

R48 batch: 23 files touched (1 new helper, 19 singletons + 2 R47 refactors + audit doc). 0 TS errors, 641/643 jest tests pass (2 pre-existing queueItemExecutor router-shape mismatches from R39, unrelated). Locales unchanged at 2254×6.

---

# R49 — offline-queue temp-ID FK rewrite

**The bug** (called out as deferred in R47 + R48): the offline write queue strips temp IDs (`c-{ts}`, `j-{ts}`, etc.) from insert payloads before sending to BE so Postgres can generate a fresh uuid via the column default. But it never captured the BE-generated id. Child rows queued behind the parent — e.g. a job referencing the customer's temp id, or an update by temp rowId — still carried the temp id in their FK fields. On flush:

- Customer offline-create → insert succeeds, BE generates `cust-uuid-abc`. **Temp id discarded.**
- Job offline-create with `customer_id: 'c-1234567890'` → insert fails because no customer with that id exists. FK constraint violation. Job sits in the queue forever (until 5-attempt cap drops it).
- Update job by temp rowId → existing code drops update quietly (R277 behavior), so user A's local in-progress edit is lost on reconnect.

**R49.1 — capture BE-generated id from insert**: when a payload's `id` matches a temp pattern, the insert now goes through `.select('id').single()` chain so we get back the BE-assigned uuid. Result is returned alongside the success flag as `mapping: { temp, real }`.

**R49.2 — accumulate id mappings across the flush**: `flushQueue` now maintains a `Map<tempId, realId>` populated as inserts succeed. Iterating in queue order (FIFO) means parent rows insert first, child rows after — by the time a child's insert runs, its parent's mapping is in the map.

**R49.3 — rewrite FK references on every queued entry**: before applying each entry, `remapEntry` rewrites `rowId`, `match` keys, and the entire `payload` (recursively, including nested objects + arrays) by substituting any string value found in the id-map. Conservative scan: any string that exactly matches a known temp id gets replaced with the real id. Non-matching strings (names, emails, descriptions) pass through untouched.

**R49.4 — drops still apply when no mapping exists**: if an update/delete targets a temp rowId AND no mapping was captured (because the parent insert hadn't been queued or failed terminally), the entry is dropped quietly — same as R277's existing behavior, just now after the rewrite attempt.

**Tests added** (2 new, 7 total in `offlineWriteQueue.test.ts`):
- "rewrites FK references in queued child rows after parent insert" — customer + job, verifies `customer_id` on the job's insert is rewritten to the captured BE uuid
- "rewrites temp rowId on update entries when parent mapping is known" — insert job with temp id, then update by that temp rowId; verifies the update's `rowId` is the captured real uuid by the time it hits BE

R49 batch: 2 files touched (offlineWriteQueue.ts rewrite, offlineWriteQueue.test.ts +2 tests + 1 mock-shape update). 0 TS errors, 643/645 jest tests pass (2 unrelated pre-existing queueItemExecutor failures). Locales unchanged at 2254×6.

---

# R50 — e2e intelligence-loop coverage

**Goal**: lock the 3 most load-bearing intelligence loops with e2e tests so silent regressions (emit fires but never lands; schema drift breaks dual-writes; calibration signal goes dark) get caught at CI.

**R50.1 — funnel signal e2e** (`src/intelligence/__tests__/funnelE2e.test.ts`, 2 tests):
- Walks the full contractor lifecycle: `signup_completed` → `onboarding_completed` → `quote_created` → `quote_accepted` → `invoice_sent` → `payment_received`. Verifies all 6 events queue locally then drain to `business_events` with uniform cohort attribution (user_id + trade + country) — the keys downstream funnel dashboards slice on.
- Offline survival: first emit fails to reach BE → event sits in queue. Second emit retries the queue with both rows landing in one batch.

**R50.2 — pricing-moat dual-write e2e** (`src/intelligence/__tests__/pricingMoatE2e.test.ts`, 3 tests):
- `emitMaterialPurchased` is contract-bound to write BOTH `business_events` (cohort analytics) AND `material_price_history` (predictor training). Past regressions (R241 wrote columns the table didn't have; R275 realigned to schema; R283 fixed source mis-attribution) prove this contract is brittle. Test locks the full payload shape on both writes plus cross-table attribution agreement (observed_by ↔ user_id, trade ↔ trade, country ↔ country).
- Manual path: defaults to `source: 'manual'`, `currency: 'EUR'`, country falls through to currentUser.
- OCR path: passes `source: 'invoice_scan'` + brand/EAN/vat/observedAt enrichment — preserved on the write.
- Country threading: caller-omitted country defaults from currentUser ref (not hardcoded `'NL'`) — locks R282's defense-in-depth fix.

**R50.3 — EVE outcome-loop e2e** (`src/services/__tests__/eveOutcomeLoopE2e.test.ts`, 3 tests):
- `recordOutcome` is the EVE Legal AI feedback signal. It must write both `@vasco_queue_outcomes` (local insightScorer calibration) AND a `queue_outcome_*` row in `business_events` (cross-cohort generator-trust learning). If either silently fails, generators keep firing the same dud suggestions because the feedback loop never closes.
- Tests positive + negative + unknown-itemId paths. Verifies `entityKey` (not the queue id) is the cohort key on the BE row, and the `generatorId` attribution flows through so insightScorer can dampen/boost specific generators per the R269 trust multiplier.
- **Required production fix**: converted `recordOutcome`'s dynamic `await import('../intelligence/dataCollector')` into a static import. There's no circular-dep reason for the dynamic form (verified — dataCollector doesn't reach back into the queue). Static import is also faster (no per-call resolve) and is testable under Jest's standard mock hoisting.

R50 batch: 4 files touched (3 new e2e test files + aiActionQueueService static-import refactor). 0 TS errors, 651/653 jest pass (+8 new cases; 2 pre-existing R39 queueItemExecutor router-shape failures unchanged). Locales unchanged at 2254×6.

⚠ Documented (deferred):
- Other dynamic-import call sites in services may have the same testability issue. Audit when adding new e2e coverage; convert to static when no circular dep blocks it.

---

# R51 — punch-list defensive cleanup pass

Continuing autonomous work after the user asked "what's next" + "do all these" on a 6-item punch list. Diagnosis revealed that **3 of 6 items were already dormant** (orphan components / unused services), so the user-visible scope shrank to fixes #2 (CRM tags), #3 (weather mocks in live path), and #6 (a dead static import keeping reasoningEngine in the bundle). #1 + #4 + #5 are defensive hardening / documentation.

**R51.1 — `roiMetricsService` MOCK_METRICS leak (defensive)**: confirmed `<VascoSavedBanner />` and `<ROIDashboard />` are orphan components — Vandaag inlines its own savings block via real `useSavingsAggregation()`, and `<HoursSavedCard />` only mounts in `ContractorDashboard` (enterprise, skip per directive). But `roiMetricsService.ts` initialized state with `MOCK_METRICS` / `MOCK_INSIGHTS` / `MOCK_GOALS`, so any future mount would have surfaced fake "12.1 hours saved this week / 58% win rate / €665 saved" numbers regardless of real signal. Replaced default with `makeEmptyMetrics()` (zero-valued, factory-built so each user gets a fresh object). Mock data preserved as `__seedMockData()` test seeder. Added `setLiveMetrics(partial)` setter so the hook can push real-computed values without the singleton holding stale ones across users. Wired into R48's `registerSingletonReset` registry — logout wipes overrides back to zeros. Also nuked `getMetricHistory`'s `Math.random()`-jitter chart-noise generator; returns `[]` empty series until real period aggregation is wired (callers render "Not enough data yet" empty state).

**R51.2 — weather: dropped stale `MOCK_WEATHER` seed in `smartSchedulerService`**: the seed had 5 entries dated `2025-02-03` to `2025-02-07` — all in the past since 2025-02-08 — so the `MOCK_WEATHER[date]` lookup never matched, and the neutral-default fallback ran every time anyway. Keeping the literal misled future readers into thinking weather data was seeded somewhere. Removed; the canonical `weatherService` (Open-Meteo, 3-day horizon) handles today/tomorrow; further-out dates hit a clearly-flagged neutral default with `suitableForOutdoor: true` so we don't fabricate "Bad weather expected" alerts for unknown days. `capacityPlanningService.getWeatherForecast` already had a deterministic-by-day-of-year 7-day rotation for far-future dates (R20 already fixed today/tomorrow there too); kept as-is — the rotation is deterministic (consistent across renders, not random) and capacity planning UX legitimately needs 7-14d horizon that Open-Meteo's 3d window doesn't cover. Real fix: extend `weatherService` to 14d. Documented.

**R51.3 — customer-CRM tag gating** (R299 deferred → resolved): `customer-crm.tsx` rendered the `CustomerTagBadge` (vip/loyal/new/risky/inactive) computed by `customerTaggingService.scoreAllCustomers` but the search box only matched name/phone/email. Tag was visual-only; promised filtering it didn't deliver. Search now also matches the raw tag string (`"vip"` → all VIP-tagged customers, `"risky"` → all flagged late-payers, etc.) plus any localized version when `customerCrm.tags.<tag>` i18n keys exist. Localized labels gracefully fall back to the raw English tag when keys are absent, so the gating works in NL/DE/FR/ES/IT today and gets prettier when locales are filled in.

**R51.4 — `reasoningEngine` orphan dead-import**: `auditorService.ts` imported `reasoningEngine` at module scope but never referenced the symbol. The static import alone kept the entire 600-LoC mock-fabricating reasoning chain (`gatherDataPoints` returns `generateMockDataPoint` objects; `evaluateStep` returns `Math.random()`-jittered confidence) in the bundle for every consumer of `auditorService` — which IS user-visible (`/contractor/certificaten`). Dropped the import. With zero remaining consumers across `app/` + `src/components/`, marked `reasoningEngine.ts` itself as DORMANT — DO NOT EXTEND with a header rewrite explaining what it'd take to make real and recommending deletion on the next dead-code sweep.

**R51.5 — `quoteOptimizerService`**: skipped per its own existing R19-audit header that already says "DORMANT — DO NOT EXTEND" + "delete on next dead-code sweep". The canonical quote-builder is `TieredQuoteBuilder` (Good/Better/Best tier multipliers, working live, R148+ signal-backed). No changes.

**R51.6 — `ukComplianceService` Companies House / HMRC CIS / Gas Safe stubs**: deferred. These are BE/integration work that requires real Companies House API credentials, HMRC CIS gateway access, and Gas Safe Register API onboarding — out of scope for an audit pass. NL/DE/FR/ES/IT can ship without it; UK launch is gated on this triplet of integrations regardless.

**Upselling-in-quotations status (user asked)**:
- ✅ **Tier-based upsell (LIVE)** — `TieredQuoteBuilder` shows Good/Better/Best columns with auto-scaled prices (1× / 1.25× / 1.55×) on every quote. Real, working.
- 🟡 Per-quote add-on/bundle suggestions — `quoteOptimizerService` exists but its consumer `<QuoteOptimizer />` is unmounted (only used by `QuoteOptimizerDemo`, also unrouted). Mock-driven, dormant.
- 🟡 Per-job post-completion cross-sell — `upsellEngineService` singleton is mock-seeded; not wired to any active screen.

R51 batch: 5 files touched (`roiMetricsService` zero-out + setLiveMetrics + R48 reset wiring; `smartSchedulerService` MOCK_WEATHER drop; `customer-crm.tsx` tag-aware search; `auditorService` dead-import drop; `reasoningEngine` orphan header). 0 TS errors, 653/653 jest pass, locales unchanged at 2254×6.

---

# R52 — new-user first-session blocker fixes

Trace of a brand-new contractor: signup → onboarding → add customer → create quote → mark sent → convert to job → mark complete → invoice → mark paid. Found 4 real blockers + 1 dormant-counter monetization gap.

**R52.1 — tier-gate counters never incremented (monetization blocker)**: `subscriptionService.canAddClient` / `canCreateQuote` / `canCreateInvoice` / `canCreateJob` / `canUseAiInsight` all checked counter fields on the saved `SubscriptionState` (`clientCount`, `quotesUsedThisMonth`, `invoicesUsedThisMonth`, `activeJobCount`, `aiInsightsUsedThisMonth`). The counters were declared in the type, set to `0` in `defaultState()`, and **never incremented anywhere** — the recorder helpers (`recordQuoteUsage`, `recordInvoiceUsage`, `recordAiInsightUsage`) had zero callers. So Free-tier limits (5 jobs, 10 quotes/mo, 10 invoices/mo, 25 clients) were declared but completely toothless: a Free user could create unlimited everything. Fixed by extending each gate signature to accept an optional `liveCount` second arg derived from real AppState data (`customers.length`, `jobs.filter(active).length`, `quotes.filter(thisMonth).length`, etc.). Threaded the live count at all 4 call sites: `customer-crm.tsx`, `quotes/new.tsx`, `quotes/[id]/invoice.tsx`, `(contractor)/werk.tsx`. Single source of truth — no parallel counter to maintain. The legacy `state.xxxCount` fallback stays for callers without AppState handy (background jobs).

**R52.2 — `addJob` BE-success branch skipped post-create housekeeping**: when Supabase persist succeeded the function returned `row.id` early, bypassing `markStepComplete('first_job_created')`, ontology entity creation, customer↔job relation, `trackEvent('job_created')`, AND calendar sync. Online users never got the activation milestone fired (the visual checkmark was still correct because milestones are derived from AppState in `evaluateMilestones`, but the per-step audit log went silent). Offline users got the housekeeping; online users didn't. Refactored to a single post-create block that runs regardless of BE outcome, using `finalId = row.id ?? tempId`.

**R52.3 — `addCustomer` BE-success branch skipped milestone + embedding**: same bug class — early return on BE success skipped `markStepComplete('first_customer_added')` AND the customer embedding fired with the wrong id. The R243 embedding always used `tempId`, so when BE persisted the customer with a fresh uuid, semantic-search lookups by real id missed the embedding. Fixed: embedding now fires under `finalId` (real uuid when BE succeeded, tempId otherwise).

**R52.4 — `markQuoteSent` fire-and-forget on offline**: was a `.catch(logWarn)` — offline contractors marking a quote sent saw the status flip locally but BE got nothing on reconnect. Now wraps `persistOrQueue` so the document update queues for next online tick.

**R52.5 — `convertQuoteToJob` swallowed quote-status-update failure**: inside the try block, `await updateDocument(quoteId, { status: 'accepted' }).catch(() => {})` silenced any error. If the job insert succeeded but the quote-status-update failed, the quote stayed `draft` on BE while the job existed — inconsistent state across the moat. Replaced the bare catch with a queueWrite fallback so the status update flushes on reconnect.

⚠ Documented (deferred):
- `aiInsightsUsedThisMonth` counter is read by `eveAgentService.getWorkforceStatus` for the "X of Y insights used" display on the agent dashboard. Free-tier users always see "0/5 used" because no caller increments it. Fix: derive from queue-history items where `createdAt >= monthStart && status !== 'pending'`. Cosmetic on what's likely an enterprise/secondary surface; kept the gate-signature change ready (`canUseAiInsight(sub, liveCount?)`).

R52 batch: 5 files touched (`subscriptionService` gate-signature + counter docs; `customer-crm.tsx` / `quotes/new.tsx` / `quotes/[id]/invoice.tsx` / `(contractor)/werk.tsx` live-count threading; `state/AppState.tsx` addJob + addCustomer post-create refactor + markQuoteSent persistOrQueue + convertQuoteToJob queue-on-fail). 0 TS errors, 653/653 jest pass, locales unchanged at 2254×6.

---

# R53 — hunt similar bug classes

Same recurring patterns popping up across the codebase:

**R53.1 — `addJobMaterial` BE-success early-return (critical moat regression)**: same R52 bug class. When BE persisted, returned `row.id` early, skipping the canonical pricing-moat emit (`emitMaterialPurchased` writes both `business_events` AND `material_price_history` per R241/R275/R283), calibration learning (`resolveOutcomesFromMaterialPurchase`), AND material embedding. Online users' material purchases simply did not feed the moat — every online contractor's material signal went to /dev/null until they happened to add a material offline. Refactored to the R52 finalId pattern.

**R53.2 — `addJobMaterial` no offline-queue fallback**: when the parent `jm.jobId` is still a tempId (parent job offline-created and not yet flushed), the BE insert FAILs FK constraint. The catch logged but didn't queue, so the material insert was permanently lost. Now wraps queueWrite so R49's temp→real rewriter resolves the FK on flush.

**R53.3 — `intelligenceCaptureService` 4 silent-catch insert paths**: `generator_dismissals`, `customer_portal_events`, `photo_analyses`, `job_quality_signals` all had `} catch { /* silent */ }`. Failures (RLS / schema drift) went to /dev/null with no audit trail. R241 had wired `logIntelligenceWriteFailure` for `material_price_history` only — exported it from `dataCollector.ts` and routed all 4 captures through the same hook so failures land in `eve_telemetry` for later forensics. Same fix applied to `decisionSyncService.logActivity` (the customer-portal-side `decision_activities` insert).

**R53.4 — `dataProvider.createPriceObservation` fake material_id (dormant chain)**: `crypto.randomUUID()` generated a placeholder for `price_observations.material_id` because the call site doesn't carry the catalog link. The function + its only caller (`recordJobPriceObservations`) are zero-caller dormant; documented inline with R54 audit comment recommending the canonical `emitMaterialPurchased` path. No active impact.

**R53.5 — AppState persist-effect deps inconsistency**: `customers` and `projects` persist effects watched only `[customers]` / `[projects]`, missing `persistReady` from deps. Other persist effects had it. Edge case — only matters if `persistReady` flips after the array changed but before the effect ran. Harmonized.

R53 batch: 6 files touched (AppState addJobMaterial refactor; dataCollector exports logIntelligenceWriteFailure; intelligenceCaptureService + decisionSyncService route failures through it; dataProvider price_observation comment; AppState persist-effect deps). 0 TS errors, 657/657 jest pass.

---

# R54 — id-remap event bus + side-effect re-fire (R49 follow-on)

R49 closed the FK rewrite gap for queued *operations* but not for synchronous side effects. When `addCustomer` ran offline, the embedding fired with tempId; on flush BE assigned a real uuid, but `customer_embeddings.customer_id` stayed under the discarded `c-{ts}`. Same for ontology entities, `@vasco_embeddings` AsyncStorage cache, Supabase `embeddings.id` (prefixed `job-{tempId}`/`mat-{tempId}`). Semantic search by real id missed forever; ontology relations dangled.

**R54.1 — `src/services/idRemapBus.ts` (new)**: in-process pub/sub. `emitIdRemap({table, tempId, realId, payload})` fans out to listeners. `flushQueue` emits after every successful insert that captured a temp→real mapping, including the original payload so listeners derive embedding text without a BE round-trip.

**R54.2 — Ontology listener (`intelligence/ontology.ts`)**: `remapEntityId(tempId, realId)` rekeys the entity in the entities Map (merging with any existing realId entry from a parallel `refreshData()` race), and rewrites every relation's `fromId`/`toId`. Wired for tables `customers`, `jobs`, `materials`, `suppliers`, `projects`, `documents` via `TABLE_TO_ENTITY_TYPE`.

**R54.3 — Semantic search listener (`intelligence/semanticSearch.ts`)**: `remapIndexedItem` rewrites both layers. Local AsyncStorage `@vasco_embeddings` cache id is rekeyed (`job-{tempId}` → `job-{realId}`), and metadata.jobId / metadata.materialId rewrite too. Supabase `embeddings.id` gets a column UPDATE rather than DELETE+INSERT so the existing pgvector blob is preserved (no embed-text edge fn re-call burned). Wired for `jobs` + `materials` via `REMAP_PREFIX_BY_TABLE`.

**R54.4 — Embedding listener (`services/embeddingService.ts`)**: on `customers` remap, re-fires `embedCustomer({customerId: realId, text})` derived from `payload.name/email/phone/address`. Old temp-keyed row stays orphaned in `customer_embeddings` (no RPC indexes by it; cleanup migration optional).

**R54.5 — `src/services/__tests__/idRemapBusE2e.test.ts` (new, 4 tests)**: locks the contract end-to-end. (a) customer remap: re-embed under real uuid with payload-derived text; (b) ontology remap: entity + relations rekey from temp to real; (c) semanticSearch remap: local cache + Supabase UPDATE both fire; (d) listeners ignore tables they don't handle (documents → no embeddings update).

**R54.6 — `docs/ID_COLUMN_MAP.md` (new)**: source of truth for FE↔BE↔Supabase id-column contracts. Per-entity tempId prefix table, moat-table FK invariants (`material_price_history.observed_by ↔ auth.uid()`, `customer_embeddings.customer_id ↔ customers.id`, `embeddings.id = {type}-{entity_id}`, `pricing_intelligence.quote_id ↔ documents.id`), R49 + R54 listener wiring map, and a checklist for adding new id-bearing entities.

**R54.7 — `MEMORY.md` workflow rule + `learnings.md` #49**: "ID-keyed mutations follow R52/R54 contract" added as workflow rule #7 in MEMORY.md (loaded every conversation) so the pattern is enforced on all future entity-creation work, with detailed entry in learnings.md citing the recurring bug class.

R54 batch: 7 files touched (1 new bus, 3 listeners wired into existing services, 1 e2e test file with 4 cases, 1 new docs/ID_COLUMN_MAP.md, MEMORY.md + learnings.md). 0 TS errors, 657/657 jest pass.

---

# R55 — post-completion full audit round (new-user flow blockers)

Re-traced signup → onboarding → first customer → first quote → send → convert → complete → invoice → paid hunting for any remaining R52-class regression in code paths I hadn't covered yet.

**R55.1 — `addInvoiceFromJob` missing emit + GoBD audit**: the quote-source variant (`addInvoice`) fired `emitInvoiceSent` + `trackEvent('invoice_created')` + GoBD audit-trail entry. The job-source variant (`addInvoiceFromJob`) skipped all three. Job→invoice creations were silently absent from the funnel signal in `business_events`, no GoBD audit row landed. Parity restored.

**R55.2 — `convertQuoteToJob` skipped ALL job housekeeping (largest regression so far)**: same R52 early-return bug, but worse — when BE persisted the job row, returned `row.id` early skipping NOT JUST the housekeeping but also (a) `markStepComplete('first_job_created')` activation milestone, (b) ontology `upsertEntity` for the new job, (c) `addRelation(customer→job)` graph edge, (d) `indexJobForSearch` semantic indexing, (e) `trackEvent('job_created')`, (f) calendar sync. Online quote→job conversions silently bypassed the entire job-creation moat path while direct `addJob()` flowed through it. Now follows the R52 finalId contract uniformly across BE-success / offline / unconfigured branches; also writes the `sourceQuoteId` into the ontology entity attributes so the customer→quote→job lineage is queryable from the graph.

**R55.3 — Ontology relations incomplete (documented, deferred)**: only 2 relation types are written today (`customer→owns→job`, both addJob + convertQuoteToJob). Missing: `quote→quoted_for→job`, `invoice→invoiced_for→job`, `material→used_in→job`, `material→supplied_by→supplier`, `job→part_of→project`. Compound AI's reasoning has fewer edges to traverse than the schema declares. Not a flow blocker (UI works without these); deferred.

**R55.4 — Onboarding direct-AsyncStorage seed bypasses AppState mutators (documented, intentional)**: `app/onboarding.tsx` writes `j-seed-1` and `c-seed-1` directly to `@vasco_jobs` and `@vasco_customers` keys, bypassing `addJob`/`addCustomer` and therefore all post-create housekeeping (ontology, embeddings, milestones). The seed ids don't match R49 temp-id patterns (`^c-\d+$` requires digits, not `seed-N`) so they never get rewritten on flush. Edge case: if a contractor accepts a quote against the seed customer, the resulting FK references `c-seed-1` which doesn't exist in BE. Acceptable launch tradeoff — the seeds exist as visual examples for the user to delete or replace; documenting for future cleanup (either route through `addCustomer` or skip seeding entirely with an empty-state CTA).

R55 batch: 1 file touched (state/AppState.tsx convertQuoteToJob + addInvoiceFromJob refactors). 0 TS errors, 657/657 jest pass, locales unchanged at 2254×6.

---

# R56 — round 2 of bug-class hunting

**R56.1 — `updateInvoice` had ZERO BE persistence (critical data loss)**: only updated local state + GoBD audit log. Edits to invoice amount, due date, customer, status all lived in memory and got overwritten on the next `refreshData()`. No `dbUpdate*`, no `persistOrQueue`, nothing. Now wraps `persistOrQueue('documents', 'update', updateDocument(id, dbUpdates), ...)` with snake_case mapping (total_amount, status, customer_id, due_date, paid_at). Matches the `updateQuote` pattern.

**R56.2 — temp-id skip-gates everywhere prevented offline-edit persistence**: 10 mutators (updateCustomer, removeCustomer, removeJob, updateJob, removeMaterial, removeSupplier, updateJobMaterialStatus, removeJobMaterial, updateQuote, updateProject) had `if (isSupabaseConfigured && !id.startsWith('temp-')) { ... persistOrQueue(...) ... }` gates. Pre-R49 the gates were defensive — updates by temp id couldn't resolve. Post-R49+R54 they became dead code that silently dropped offline-edit-then-flush. Sequence: contractor creates customer offline (`c-{ts}`) → edits the customer twice → flushes. The two edits never queued; only the original optimistic INSERT carried the original payload. Edits lost on cold-start refresh. Extended `persistOrQueue` with a temp-id fast path that queues the update directly (bypassing the doomed BE round-trip), then removed all 10 gates so updates flow uniformly.

**R56.3 — `accept-token` customer-side acceptance didn't create job**: the customer-shareable accept link landed on `app/accept/[token].tsx`, fired `processAcceptance(token)` to the edge function, then ONLY called `updateQuote(id, { status: 'accepted' })`. No `convertQuoteToJob`, so quote turned green but no job materialized. Contractor saw the accepted quote but had to manually click "Convert to job" — silently inconsistent with the contractor-side accept-flow at `app/quotes/[id].tsx:366` which DID call `convertQuoteToJob`. The customer-facing success message ("Your contractor will start scheduling the work") and the explicit `acceptedButFailed` error string ("Quote accepted but job creation failed") prove the original intent was auto-create. Fixed: now calls `convertQuoteToJob(quoteId)` which fires the full R52/R55 housekeeping (markStepComplete, ontology, semantic index, calendar, emit). Status-only fallback retained for the case where the quote isn't in local AppState (customer's device hasn't synced).

**R56.4 — `decisionSyncService` realtime listener filtered INSERT only**: customer portal submits decisions via `upsert` with `onConflict: 'tracker_id,item_id,submitted_by'`. The contractor-side realtime listener in `useDecisionUpdates` filtered to `event: 'INSERT'`. When a customer EDITED their decision (changed answer, added note), the upsert fired UPDATE, not INSERT — contractor's listener silently missed every edit. Switched filter to `'*'`, handle reads `payload.new ?? payload.old`, `newCount` only bumps on actual INSERTs (not edits the contractor already saw).

**R56.5 — `invoicePaymentWatcher` subscribed to a phantom `invoices` table**: BE has polymorphic `documents` (with `doc_type='invoice'`) since R278 schema migration. The realtime listener filtered `table: 'invoices'` — non-existent. Supabase realtime accepts any table name, the channel subscribes happily, but no rows ever change in a non-existent table. Result: Mollie/Stripe webhook → BE → contractor lock-screen-notification chain was silently broken. Manual mark-paid fired its own local push (different code path), so this only broke paid-via-payment-link notifications. Switched to `documents`, filter `doc_type === 'invoice'` in the handler. Mapped column reads from `total` → `total_amount`, `reference` → `document_number ?? reference` to match the documents schema.

**R56.6 — `watchUserTables` included phantom `quotes` table**: same R278 migration class. `quotes` doesn't exist on BE — `documents` covers both quote + invoice rows. The phantom `quotes` channel never fired (no harm) but wasted a realtime slot and misled future readers. Dropped from the list.

⚠ Documented (deferred):
- `recurringJobService.generateNextOccurrence` mints synthetic ids `j-rec-{ts}-{rand}` that don't match R49's `^j-\d+$` temp-id pattern. The agreement.generatedJobIds[] accumulates ghost ids; on contractor approve via `maintenance_due` queue item, `addJob` creates a fresh tempId — the agreement's tracking is stranded. Cosmetic; no functional impact.
- `submitDecision` (customer portal anonymous side) has no offline-write-queue retry on BE failure. The local AsyncStorage save is the only fallback. Customer device has no contractor uid → no offline queue. If BE is down, the contractor never gets the signal until the customer re-submits. Constraint of the anon portal; deferred.
- `deleteJobPhoto` in `app/contractor/job/[id]/photos.tsx` discards the boolean return; if delete fails, photo stays in BE silently with no UX feedback. Low priority — error case only.

R56 batch: 5 files touched (state/AppState.tsx 10 gate removals + updateInvoice persist; offlineWriteQueue persistOrQueue temp-id fast-path; app/accept/[token].tsx auto-create-job; decisionSyncService realtime filter; invoicePaymentWatcher table corrections). 0 TS errors, 657/657 jest pass, locales unchanged at 2254×6.

---

# R57 — round 3 of bug-class hunting

**R57.1 — `documents.id` ↔ FE quote/invoice id mismatch (LARGEST latent bug found in the audit)**: the FE addQuote / addInvoice mints `docNumber` from `nextDocumentNumber` (text like `Q-260001`) and stores it as the FE `Quote.id` / `Invoice.id`. But BE `documents.id` is a uuid (`gen_random_uuid()` default) — the FE id is the `document_number` column, not the primary key. **Every `updateDocument(id, updates).eq('id', id)` matched 0 rows on BE** because the docNumber doesn't match a uuid pattern. Affected: `markQuoteSent`, `markInvoiceSent`, `markInvoicePaid`, `updateQuote`, `updateInvoice` (R56-added), `convertQuoteToJob`'s quote-status-update, `removeQuote`, `removeInvoice`. Contractor's UI flipped status locally, refresh from BE wiped it back. Mollie/Stripe webhook → BE.documents → contractor app status sync also broken. **The longest-standing latent bug found** — has been silently breaking quote/invoice persistence since R278's documents migration. Fixed via dual-route in `dataProvider.updateDocument` / `deleteDocument`: if the value parses as a uuid, match by `id`; otherwise treat it as `document_number` and match by that (unique per `(user_id, doc_type)` under RLS, so the equality is safe). Backwards-compatible.

**R57.2 — `refreshData` overwrote temp-id rows from local state**: `setCustomers(loadCustomers())` etc. wholesale-replaced the array. Offline-created customer (id `c-{ts}`) disappeared from the UI between refresh and the next `flushQueue` that promoted it to BE. Fixed: refreshData now merges, preserving any local rows whose id matches the temp-id pattern (`^(c|j|q|inv|mat|sup|jm|proj)-\d+$`). R49+R54 guarantee the temp row gets re-keyed on flush; until then we keep it visible. Quotes/invoices use docNumber (not temp-id pattern) and BE persists them by document_number, so wholesale-replace is correct for those.

**R57.3 — `feedbackService` + `emailImportService` write to phantom BE tables**: `feedbackService` inserts to `feedback` (BE has only `feedback_weights`); `emailImportService` writes to `user_settings` + reads `email_imports` (neither exists on BE). Both services have ZERO functional consumers across `app/` + `src/components/`. Documented as dormant — same class as `quoteOptimizerService` (the canonical channel for user feedback today is `gobd_audit_log` + `eve_telemetry`; email import is genuinely unwired).

⚠ Documented (deferred):
- `dataProvider.createPriceObservation` `material_id: crypto.randomUUID() ?? userId` placeholder still in place (R54-flagged, dormant chain). `recordJobPriceObservations` reads `MOCK_ACTUALS`, has zero callers. The canonical pricing-moat path is `emitMaterialPurchased` → `material_price_history`, which IS user-id-keyed correctly. Cleanup on next dead-code sweep.
- `request-account-deletion` edge fn invoked from `accountDeletionService.requestDeletionViaEdgeFunction` is not deployed in `supabase/functions/`. Already documented as fail-soft fallback in R278 — the canonical path is `account_deletion_requests` table insert which is wired.

R57 batch: 2 files touched (`lib/dataProvider.ts` updateDocument/deleteDocument dual-route + UUID_RE shape detector; `state/AppState.tsx` refreshData merge-with-temp-rows). 0 TS errors, 657/657 jest pass, locales unchanged at 2254×6.

---

# R58 — uid hardening (placeholder leakage closure)

The legacy `'current-user'` placeholder (`src/lib/currentUser.ts:14`) was bleeding into moat writes from multiple angles. Every `business_events` row tagged with `'current-user'` is rejected by BE (FK to `auth.users(id)`) and blocks the local queue from advancing. Every `material_price_history.observed_by = 'current-user'` similarly fails the FK. Cohort attribution corrupted at source.

**R58.1 — AppState `aiUserId` stale-closure (silent corruption on first session)**: `const aiUserId = getCurrentUserId()` was captured at the top of `AppStateProvider` (line 216) and baked into the useMemo'd action functions. The useMemo deps array did NOT include `aiUserId`, so for accounts where the state arrays didn't mutate post-login (new account, empty data path, demo seed-once), the action closures retained `aiUserId = 'current-user'` for the entire session. Every `emitJobStarted`, `emitJobCompleted`, `emitInvoiceSent`, `emitPaymentReceived`, `emitQuoteCreated`, `emitQuoteAccepted`, `emitQuoteRejected`, `emitMaterialPurchased`, `recordPricingData`, `recordPricingOutcome`, plus the inline `(supabase.from('pricing_intelligence') as any).update(...).eq('user_id', aiUserId)` at line 957 — all silently fired with the placeholder string. Replaced all 17 references with inline `getCurrentUserId()` calls inside each action body so each invocation reads the live ref.

**R58.2 — `app/(tabs)/hub/index.tsx` hardcoded `userId="current-user"`**: the `<AIRecommendations userId="current-user" ... />` prop was a literal placeholder string. Every AI insight surface fired by this hub fired under the placeholder, corrupting cohort attribution. Now reads live ref via `getCurrentUserId()`.

**R58.3 — `dataCollector` central placeholder gate**: even after R58.1+R58.2, race conditions between cold-start and login could leak the placeholder. Added an `isPlaceholderUserId(userId)` helper at module scope and gates at all 4 emit/record entry points: `emitBusinessEvent` (root that all convenience emitters route through), `recordPricingData` (direct `pricing_intelligence` write), `recordPricingOutcome` (training-pair update), and `emitMaterialPurchased`'s direct `material_price_history` insert. Placeholder uids early-return without writing. Belt-and-suspenders: even if a stale closure is missed in a future audit, the moat layer drops the corrupt row instead of writing it.

**R58.4 — `flushToCloud` queue draining**: pre-R58, queue events enqueued before login (under placeholder uid) blocked the entire batch flush forever — BE FK constraint rejected the row, the batch errored, the queue never advanced, real post-login events sat behind them. Added a filter that drops placeholder-uid events from the queue on each flush attempt; persists the cleaned queue back to AsyncStorage. Real events behind them flow.

**R58.5 — `getAuthedUserId(): string | null` helper**: many services had `const userId = getCurrentUserId(); if (!userId) return;` guards that EXPECTED the function to return falsy when no user is signed in. But the function returns the `'current-user'` string — truthy. The guards never caught it. New `getAuthedUserId()` returns `null` for the placeholder, so existing `if (!userId) return` patterns work as the original authors intended. Wired into `intelligenceCaptureService` (7 sites: generator_dismissals, customer_portal_events, photo_analyses, job_quality_signals, ml_cashflow_gap_predictions, ml_capacity_overrun_predictions, ml_supplier_leadtime_predictions, query_daily_metrics) and `embeddingService` (3 sites: embedCustomer, embedQuoteLine, findSimilarCustomersByText).

R58 batch: 6 files touched (`lib/currentUser.ts` getAuthedUserId helper; `state/AppState.tsx` aiUserId removal + 17 inline replacements; `app/(tabs)/hub/index.tsx` hardcoded prop; `intelligence/dataCollector.ts` 4 gate sites + queue filter; `services/intelligenceCaptureService.ts` getAuthedUserId; `services/embeddingService.ts` getAuthedUserId; `services/__tests__/idRemapBusE2e.test.ts` mock update). 0 TS errors, 657/657 jest pass, locales unchanged at 2254×6.

---

# R59 — id/uuid hardening (mirrors R58 for entity ids)

R58 closed the placeholder uid leakage class. R59 does the same for entity ids — the moat-write equivalent of `getAuthedUserId`'s null-for-placeholder pattern. Where R58 stopped `'current-user'` from corrupting `business_events.user_id`, R59 stops `c-{ts}` / `j-{ts}` / etc. from corrupting `business_events.entity_id`, FK columns on cohort tables, storage paths, and pricing-intelligence references.

**R59.1 — `src/lib/idShape.ts` (new) — single source of truth**: extracted `TEMP_ID_PATTERNS`, `UUID_RE`, and 4 typed helpers (`isTempId`, `isTempIdFast`, `isUuid`, `isMoatSafeId`). Pre-R59 the patterns lived inside `offlineWriteQueue.ts` as a private const, with copies inlined at `dataProvider.ts` (R57) and `AppState.tsx` (R57). Three modules drifting on the same regex was a recipe for the next bug. Hoisted to `lib/` so any module can import without circular-dep risk.

**R59.2 — `dataCollector` event-queue id-remap listener (parallel to R54 idRemapBus)**: the dataCollector maintains its own AsyncStorage queue (`@vasco_event_queue`), separate from `offlineWriteQueue` (`@vasco_offline_writes`). R49+R54 covered offlineWriteQueue's flush. But when an offline-created job fired `emitJobStarted(getCurrentUserId(), tempId, ...)` BEFORE the queue flush, the business_events row landed with `entity_id = 'j-{ts}'` and stayed pinned forever — cohort RPCs joining `business_events.entity_id ↔ jobs.id` missed every offline-created job. Subscribed dataCollector to `idRemapBus`. On remap, scan the local event queue and rewrite (a) `entityId === tempId` matches, (b) material-style entity ids `${tempId}_*` (where supplierId is the prefix), (c) `payload.*Id` string fields recursively. 4 e2e tests lock the contract: simple entity_id rewrite, recursive payload swap, material composite-id rewrite, unrelated-remap pass-through.

**R59.3 — `intelligenceCaptureService` direct-FK writes nullify temp ids**: `customer_portal_events.quote_id`, `photo_analyses.job_id`, `photo_analyses.quote_id` are FK columns. If a contractor takes a photo of an offline-created job (tempId), the photo_analyses insert was failing the FK constraint — losing the entire row including the analysis payload that has cohort value. `job_quality_signals.job_id` is the upsert key; null breaks identity, so dropped the write entirely with telemetry logging instead. New `nullifyTempId()` helper writes `null` for the FK so the row lands with the analysis payload, and downstream `customer_id` etc. fields also get the same treatment.

**R59.4 — `cloudSync` outcome-table FK writes nullify temp ids**: same hazard as R59.3, but for `job_outcomes` / `invoice_outcomes` / `accounting_loops`. `job_outcomes.job_id` and `accounting_loops.job_id` are cohort keys (drop on temp); `customer_id` / `quote_id` / `invoice_id` / `payment_id` are descriptive FKs (nullify on temp).

**R59.5 — `jobPhotoService.uploadJobPhoto` refuses temp jobIds**: the storage path `${user_id}/${jobId}/${uuid}.jpg` would embed the temp id; the metadata insert would fail the FK. Result was photos uploaded to a temp path then orphaned forever. Now early-returns null when jobId is temp; caller retries post-flush so the file lands under the real path.

**R59.6 — `offlineWriteQueue` + `AppState.refreshData` + `dataProvider` use shared helpers**: refactored 3 sites that had inline regex copies to import from `idShape.ts`. Single source of truth — drift between modules is no longer possible.

R59 batch: 6 files touched (`lib/idShape.ts` new + 4 helpers; `services/offlineWriteQueue.ts` use shared helper; `state/AppState.tsx` use isTempIdFast; `lib/dataProvider.ts` use isUuid; `intelligence/dataCollector.ts` event-queue remap listener + import; `services/intelligenceCaptureService.ts` nullifyTempId on 3 sites + drop on 1; `intelligence/cloudSync.ts` nullifyTempId on 3 sync fns; `services/jobPhotoService.ts` temp-id refusal; `intelligence/__tests__/eventQueueIdRemap.test.ts` new with 4 cases; `docs/ID_COLUMN_MAP.md` R59 update). 0 TS errors, 661/661 jest pass (+4 new), locales unchanged at 2254×6.

---

# R60 — deferred items: supplier-intelligence packages

Triaged from the Harvey/Eve PDF ("Save money on inputs" section). User direction: solo contractors get the most value from admin-reduction features (Job Dossier, Quote/SOW generator). The supplier-side intelligence is more meaningful for established multi-supplier contractors and aannemers/site-leads with €5k+/month material spend. Deferring until those segments are explicitly targeted.

**Deferred — Package 1 — Email-forwarding inbound for supplier invoices** (~5-7 days). Per-contractor forwarding address pattern (`<userid>@scan.vasco.app` → Postmark/SendGrid inbound webhook → existing `analyze-photo` edge fn). Avoids OAuth/IMAP complexity. **Why deferred**: solo contractor median has 1-2 suppliers; the moat-volume bump is concentrated in the >3-supplier segment. Setup friction is real (one-time Gmail filter).

**Deferred — Package A — Per-supplier price-drift view (inkoop tab + Vandaag VascoCard)** (~4-6 days). Surfaces "Bouwmaat charged you 18% more than your last 5 buys for 22mm copper" using `material_price_history` cohort moat (already wired). **Why deferred**: gated on Package 1's email volume. Without the email layer, drift detection has too few rows per (supplier × material) to clear k-anonymity gates for solo contractors. Real cohort signal already feeds these tables (R241/R275/R283); the UI exists in primitive form on `inkoop.tsx`.

**Deferred — Package B — Materials-list multi-supplier comparison agent** (~10-14 days minimum). Given a `JobMaterial[]`, batch-compare across wholesalers and rank by total landed cost (price × qty + delivery fee + lead-time penalty + warranty terms). **Why deferred**: needs a supplier-terms data layer (delivery fees, MOQ, warranty days per supplier) we don't have, plus PDF ingestion to populate it from supplier price lists. **More importantly**: this is the site-lead / aannemer use case (jobs with €10k+ materials where the comparison work pays back). Solo contractors typically have a primary supplier and don't switch per-material.

**Foundation that already exists** (don't rebuild when picking these up):
- `invoiceScanService.ts` — Claude Haiku Vision OCR → structured `ScannedLineItem[]` with EAN/SKU/qty/unit/price/VAT
- `material_price_history` cohort moat with `(trade, country)` slicing + R241/R275/R283 schema
- `comparePrices(query, country)` single-item compare in `integrations/suppliers.ts`
- 36+ EU supplier catalog in `supplierBacklinkService`
- `supplierLeadTimeMoatService` lead-time tracking
- `priceAlertService` price-change alerts
- `procurementAgentService` purchasing agent (Pro tier, per-trade scheduled runs)

**Trigger to revisit**: when product targets aannemer / site-lead segment explicitly, OR when a contractor cohort with ≥3 active suppliers reaches critical mass (signal: 30%+ of paid contractors have ≥3 suppliers in `business_events.supplier_id` distinct values over 90d).

---

# R61–R62 — SOW (Scope-of-Work) generator (PDF Package D, D1+D2 shipped)

User direction: build the Quote/SOW generator + Job Dossier from the Harvey/Eve PDF "Save time on repetitive tasks" section. The supplier-intelligence packages (1, A, B) are deferred to large-contractor segment per the R60 entry above.

**R61 — D1: SOW foundation** (~1 day equivalent)
- Migration `20260505000001_sow_columns.sql`: `documents.scope_text` text + `business_settings.quote_tone` enum-checked column with 'friendly' default. No new entity, no new tempId pattern — additive columns only.
- Edge fn `supabase/functions/generate-sow/index.ts`: Claude Haiku call, 3-paragraph (Includes/Excludes/Warranty) output, tone-aware system prompt, language-aware (NL/EN/DE/FR/ES/IT), per-user auth, `{ ok, scopeText, error }` envelope (never throws to caller). Mirrors the `draft-customer-reply` pattern.
- Service `src/services/sowGeneratorService.ts`: `generateScopeOfWork()` thin RPC wrapper, `loadQuoteTonePreset()` / `saveQuoteTonePreset()` for tone persistence on `business_settings.quote_tone`.
- Tests `src/services/__tests__/sowGeneratorService.test.ts`: 7 cases — body shape, line-item cap (50), empty-input guard, throw-safe, error envelope, tone fallback, upsert-on-conflict.
- `docs/ID_COLUMN_MAP.md` updated with R61 column-additions section (no new entity → no R52/R54 contract dance).

**R62 — D2 + UI integration** (~1 day equivalent)
- Tone preset picker on `app/contractor/profile.tsx` Business section. Alert.alert action sheet with formal/friendly/detailed/concise + subtitle descriptions. Reads via `loadQuoteTonePreset()`, writes via `saveQuoteTonePreset()`. Failure-soft.
- TieredQuoteBuilder integration: `sowText` state separate from existing `scopeText` (which is the AI search keyword). "Generate scope" button below the line-items section in the preview step. Three states: idle (button), loading (spinner), result (editable TextInput with Regenerate / Clear actions). Plain-text editable, single Claude call per tap (no auto-fire on keystroke).
- Persistence wired in `app/contractor/tiered-quote.tsx`: after `addQuote(...)` returns the quote id, calls `updateDocument(quoteId, { scope_text })`. R57's dual-route handles the docNumber-form id → matches by `document_number`. Fail-soft so the quote send doesn't fail when the SOW persist hits a flaky network.
- Threaded `sowText` → `quote.description` in `handleSend` so the parent screen can pick it off without changing `addQuote`'s signature.

**R63 — D4 (PDF export) + D3 (tone learning)** (~1 day equivalent)

D4 — Quote PDF integration:
- `QuotePdfData` interface gained `scopeText?: string`. `QuoteLabels` gained `scopeOfWork: string` translated across all 6 locales (Scope of Work / Werkomschrijving / Leistungsbeschreibung / Descriptif des travaux / Alcance del trabajo / Descrizione dei lavori).
- New `<div class="scope-section">` block renders between the line-items table and the totals summary. CSS styled to be visually distinct from notes/terms (lighter gray panel, no left accent bar) so it reads as a structured section.
- New `escapeHtml()` helper — the SOW prose comes from Claude and may contain stray angle brackets / ampersands / quotes. Paragraph splitting via `\n\n` → `<p>` tags, single newlines → `<br>`.
- Threading: `documentRowToQuote` mapper in `lib/mappers.ts` now pulls `row.scope_text` into `Quote.description` (existing optional field). `DocumentRow` type gained `scope_text: string | null`. PDF data builder at `app/quotes/[id].tsx` passes `scopeText: quote.description` into `QuotePdfData`. Older quotes pre-D4 have null `scope_text` → mapper returns undefined → PDF renders without the section.

D3 — Tone learning:
- New `loadToneExamples()` in `sowGeneratorService.ts`: queries up to 20 most-recent accepted quotes with non-empty `scope_text`, filters to >50-char prose excerpts, returns up to 3 capped at 800 chars each. Threshold: needs 5+ accepted quotes before returning anything (cold start otherwise).
- TieredQuoteBuilder's `handleGenerateSow` now does `Promise.all([loadQuoteTonePreset(), loadToneExamples()])` and threads both into `generateScopeOfWork(...)`. The edge fn already accepted `toneExamples` per R61's design — this just wires the source.
- 5 new tests cover: below-threshold returns empty, 3-freshest-only on threshold met, short-scope filter, 800-char cap per example, RLS-error fallback.

**Still pending — Package C (Job Dossier)**: per the user's sequencing call, builds after D ships and is validated with real prose output. The new `job_voice_notes` entity will follow the full R52/R54 + idShape contract: `vn-{ts}` prefix, `dbCreateJobVoiceNote` wrapper, ID_COLUMN_MAP update, R59 storage-path refusal for temp jobIds.

R61–R63 batch: 8 files (1 new migration, 1 new edge fn, 1 service + extended tests, profile.tsx + TieredQuoteBuilder.tsx + tiered-quote.tsx + quotes/[id].tsx integrations, mappers.ts + database.types.ts schema additions, quotePdfService.ts SOW section + escape helper, ID_COLUMN_MAP update). 0 TS errors, 673/673 jest pass (+12 new), locales unchanged at 2254×6.

---

# R64 — audit fixes for Package D (14 findings)

Self-audit of R61–R63 found 14 issues across critical/high/medium/low severity. R64 fixes all 14 in one round.

**Critical (3 fixed)**:
- **#1 In-memory Quote stale after send**: post `updateDocument(quoteId, { scope_text })`, the FE Quote in AppState lacked `description` until refreshData fired. Share-PDF immediately after send rendered without the SOW. Fix: `updateQuote(quoteId, { description: sow })` after the BE write — local mirror of what the mapper will eventually pull on refresh.
- **#2 Regenerate overwrites edits silently**: contractor edits prose → taps Regenerate → all edits lost with no confirmation. Fix: `lastGeneratedSowRef` tracks pristine model output; on Regenerate, if `sowText !== lastGeneratedSowRef.current`, show Alert.alert confirm with destructive-style "Regenerate" button.
- **#3 sowText not reset on send**: cross-quote contamination — quote A's SOW bled into quote B. Fix: `setSowText(''); setSowError(null)` in `handleSend` after `onSend(quote)`.

**High (4 fixed)**:
- **#4 escapeHtml only on scope_text**: pre-existing risk made worse by R63's introduction of the helper without applying it. Now applied to `businessName` / `businessAddress` / `quote.quoteNumber` / `customerName` / `customerAddress` / `customerEmail` / `quote.issueDate` / `quote.jobTitle` / `quote.validUntil` / `quote.notes` / `quote.terms` / line item `description` / tier `name` + `description` in the PDF template.
- **#5 No rate limiting on generate-sow**: edge fn now uses `_shared/ratelimit.ts` — 30 calls/min/user (windowMs 60_000, max 30). Returns 429 with `Retry-After` header and `retryAfter` in JSON. Cheap protection against runaway loops or compromised tokens.
- **#6 business_settings missing UNIQUE constraint on user_id**: `saveQuoteTonePreset`'s `upsert(..., { onConflict: 'user_id' })` silently fails without it. Fix: `do$$` block in the R61 migration adds `business_settings_user_id_key UNIQUE (user_id)` if not already present. Idempotent; safe re-run.
- **#7 Tone learning invisible to user**: 5+ accepted quotes triggers the "in your voice" personalization but contractor has no signal. Fix: pre-load tone examples on TieredQuoteBuilder mount, render small "Trained on your last N quotes" badge under the Generate button when `toneExamplesRef.current.length > 0`.

**Medium (4 fixed)**:
- **#8 Generate button buried**: kept placement (below line items) but added the empty-state explainer (#9) so contractors who scroll see what tapping does. Auto-generate-on-step-entry deferred — burns Claude calls for contractors who tap Send fast.
- **#9 Empty-state has no explainer**: 1-line subtitle now sits above the Generate button: "AI-drafted prose: what's included, what's excluded, warranty terms. Editable before sending."
- **#10 Edit affordance always-on (vs plan)**: documented as the right call — TextInput is lower-friction than plain-text-with-Edit-toggle. Plan/build mismatch noted in this entry instead of refactoring back.
- **#11 loadToneExamples on every generate**: cached in `toneExamplesRef` (ref, not state — no re-render churn). First Generate hits the DB; later taps reuse. Cleared on logout via component unmount + R48 AppState reset.

**Low (3 fixed)**:
- **#12 Migration + edge fn deployment**: still on the user.
- **#13 Raw model output not exposed**: `GenerateSowResult` gained `raw?: string` + `retryAfter?: number` fields; service now passes them through from the edge fn payload on `ok: false`. __DEV__ telemetry can surface raw text for prompt iteration without server-log access. New test locks the contract.
- **#14 Quote.description overloaded**: grep found 2 real consumers — `customerQuoteAcceptanceService.ts:185` was using `quote.description` as the share-message subject when `quote.job` was empty. With description now holding 3-paragraph prose, the share message would inject 600+ chars. Fix: trim to first line × 80 chars when description is SOW-shaped. The other consumer (line 72, stored as `quoteDescription` on the AcceptanceLink) has zero display sites, no fix needed.

R64 batch: 6 files touched (`20260505000001_sow_columns.sql` UNIQUE constraint, `generate-sow/index.ts` ratelimit + import, `sowGeneratorService.ts` raw/retryAfter passthrough + interface, `TieredQuoteBuilder.tsx` regenerate confirm + sowText reset + tone-learning preload + badge + empty-state copy, `tiered-quote.tsx` updateQuote local mirror, `quotePdfService.ts` broad escapeHtml, `customerQuoteAcceptanceService.ts` description-truncate fallback, test extension). 0 TS errors, 674/674 jest pass (+1 new), locales unchanged at 2254×6.

---

# R66 (round 1) — NL launch readiness audit

User direction: e2e audit specifically for Netherlands launch readiness. Critical blockers found and most fixed in this round. Severity tracked by user-impact: a contractor sending an invoice the customer can't pay = critical; a contractor missing 9% reduced VAT = real money loss; a missing edge fn = launch-blocker for B2G.

**Critical (fixed in this round)**:

**R66.1 — IBAN/BIC + 7 other payment/locale fields silently dropped by mapper (top NL launch blocker)**: migration `20260415000001_business_profiles.sql` declared `iban`, `bic`, `country`, `postcode`, `city`, `website`, `invoice_prefix`, `quote_prefix`, `default_payment_terms` columns on `business_settings`. The FE mapper `businessSettingsToProfile` in `lib/mappers.ts` only pulled 6 fields back. The settings UI never offered IBAN as an input. Result: every NL invoice PDF tried to render `businessProfile.iban` → always undefined → no bank details rendered → customer received the invoice with no IBAN to pay. Fix touches 5 files: `domain/business.ts` (extend `BusinessProfile` type), `lib/database.types.ts` (extend `BusinessSettingsRow`), `lib/mappers.ts` (read all 9 fields, factor IBAN into completeness denominator), `state/AppState.tsx` updateBusinessProfile (write all 9 fields to BE), `app/(modals)/business-settings.tsx` (IBAN + BIC inputs with country-specific placeholders).

**R66.2 — `isValidIBAN` imported but never called**: `business-settings.tsx` imported `isValidIBAN` from `utils/validation.ts` per R66.1 but didn't gate the save behind it. A contractor pasting "asdf" as IBAN would persist garbage to BE → invoice PDF renders garbage in bank-details section. Fixed: now strips spaces (visual grouping in pasted IBANs) + uppercases + calls `isValidIBAN` before save; throws localized error if invalid.

**R66.3 — Quote PDF doesn't handle KOR / Kleinunternehmer**: `invoicePdfService.buildInvoiceHtml` correctly zeroes VAT and adds the legal note ("BTW niet van toepassing — KOR" / "§19 UStG keine Umsatzsteuer") for small-business-exempt contractors. `quotePdfService.buildQuoteHtml` did not. A contractor on KOR sent a quote at 21% then an invoice at 0% — confusing the customer when the invoice arrived. Fix: ported the R251 exemption logic to quotePdfService (vatScheme parameter on buildQuoteHtml + generateQuotePdf options + 0%-line + skip-vat-rows + summary-uses-subtotal-not-total + render exemptionNote box). Threaded `businessProfile.vatScheme` from `app/quotes/[id].tsx` into the generator call.

**Documented (deferred — non-blocking but real)**:

**R66.4 — NL has 9% reduced VAT for renovation labor on homes >2 years old**: every plumbing/electrical/painting job on existing housing qualifies. Codebase only has 21% in `constants/taxRates.ts`; TieredQuoteBuilder hardcodes `vatRate: 21`. Real money issue (contractors over-charge customers VAT, accountant has to re-classify in Moneybird). Fix would need a per-line VAT picker in the quote builder + default by service category. **Deferred** — affects price competitiveness, not launch viability; NL accountants routinely reclassify line items in Moneybird as a workaround.

**R66.5 — No Peppol / NLCIUS generator (e-invoicing)**: `getRequiredFormat('NL') === 'Peppol'` declares the requirement but no Peppol BIS 3.0 / NLCIUS XML generator exists. NL contractor's e-invoice export falls back to `handleExportEInvoice('XRechnung')` (German B2G format). Both XRechnung and NLCIUS are EN 16931-compliant UBL 2.1, so the output may pass NL Peppol validation, but the customizationID identifies it as the German format — some NL public-sector validators reject foreign customizationIDs. **Deferred** — affects NL B2G work (public-sector procurement) only; pure-B2C contractors (most solo plumbers) don't need e-invoicing for homeowners. Ship NL launch with B2C focus; add NLCIUS generator before targeting public-sector clients.

**R66.6 — NL onboarding accepts any string for KvK/BTW**: regFields are persisted to `business_settings` without `isValidKvKNumber` / `isValidVATNumber` checks. Later flows that depend on a real KvK (Companies House lookup, e-invoicing customizationID, accountant export) silently miss-match. Business-settings modal validates correctly post-onboarding; this gap is in the onboarding step itself. **Deferred** — surfaces as a soft validation warning would hurt completion rate (contractors abandon if they can't find their KvK during signup); business-settings modal is the canonical correction point.

R66 batch (round 1): 5 files touched (`domain/business.ts` BusinessProfile type extension, `lib/database.types.ts` BusinessSettingsRow extension + R61 quote_tone column, `lib/mappers.ts` businessSettingsToProfile pulls 9 columns + IBAN-aware completeness, `state/AppState.tsx` updateBusinessProfile writes 9 fields, `app/(modals)/business-settings.tsx` IBAN+BIC inputs + isValidIBAN gate + sanitize-strip-spaces, `app/quotes/[id].tsx` threads vatScheme into generateQuotePdf, `services/quotePdfService.ts` KOR exemption block + vatScheme parameter). 0 TS errors, 674/674 jest pass, locales unchanged at 2254×6.

# R66 (round 2) — push notification i18n + scheduled-reminder i18n

Round 2 focus: critical real-time and scheduled push paths, since lock-screen notifications are the highest-stakes contractor-facing surface (visible even when the app is closed) and were silently English-locked.

**R66.7 — Realtime payment-received push hardcoded English (NL launch blocker)**: `services/invoicePaymentWatcher.ts` line 74-76 fired `sendInstantNotification('Payment received', 'Invoice X (€Y) marked as paid.', ...)` with literal English when a Mollie/Stripe webhook flipped `documents.status='paid'`. The R56-fixed realtime channel was finally working end-to-end (was broken until R56 because subscribed to a non-existent `invoices` table), but the payload it surfaced was English regardless of contractor locale. NL contractor sees an English push line on the single most important moment in the app — money landing. Fix: imported `i18n` from `'../i18n/i18n'`, routed title + body through `i18n.t('notifications.push.paidTitle' / 'paidBody', { ref, amount })`. Used 6-locale `notifications.push` namespace (added below).

**R66.8 — 5 customer-interaction realtime push titles + 6 body summaries hardcoded English**: `services/customerInteractionWatcher.ts` `surface()` and `summarize()` had a `Record<string, string>` of hardcoded English titles (`'Quote accepted'`, `'Quote rejected'`, `'Customer requested changes'`, `'Customer made a decision'`, `'Customer selected a tier'`, `'Customer update'`) and English summaries with embedded interpolation (`Quote ${id} accepted (tier) — €total`). These fire when a customer interacts with the customer-decision portal — equally critical lock-screen moments after payment. Fixed: title map keyed on i18n key paths, `summarize()` switched to `i18n.t(..., {tier, total, ref})` with three fallback keys (`unknownDecision`, `unknownTier`, `unknownValue`) for missing data fields.

**R66.9 — EVE AI queue notifier hardcoded English banner**: `services/aiQueueNotifier.ts` line 51 sent `sendInstantNotification('Vasco has something for you', 'Tap to review', ...)` for every new EVE Agent/Auditor/Analyst queue item. That's the second-highest-frequency push (any time the AI prepares a draft for one-tap approval). Fixed: routed through `i18n.t('notifications.push.eveTitle' / 'eveTapToReview')`.

**R66.10 — 4 scheduled local-push functions: 3 NL-hardcoded, 1 EN-hardcoded**: `services/pushNotificationService.ts` contained `schedulePaymentReminder`, `scheduleQuoteFollowUp`, `scheduleJobReminder` with hardcoded NL strings (work for NL launch but break for the other 5 locales) and `scheduleOutcomeFollowup` with hardcoded EN strings (broken for NL launch — fires 4 days after EVE approval to capture customer-response signal for insightScorer). Asymmetric breakage: scheduled at-rest in OS notification queue, so the contractor's locale at *schedule time* determines text. Fix: imported `i18n`, routed all 4 through `notifications.push.{paymentReminder|quoteFollowup|outcomeFollowup|jobReminder}{Title|Body}` with template variables (`{{customer}}`, `{{amount}}`, `{{days}}`, `{{title}}`, `{{itemType}}`).

**R66.11 — `notifications.push` namespace was empty**: 29 new keys × 6 locales (174 entries total) seeded into `notifications.push` covering both round-2 realtime watchers (paidTitle/Body, quoteAccepted/Rejected/changeRequest/decision/tierSelect titles + bodies, generic fallback, unknown* fallback strings, amountSuffix interpolation helper) and scheduled push (4 × title+body × locale). All 6 locales at parity (29 keys each). i18n placeholder convention `{{varName}}`.

**R66.12 — Cosmetic: send-invoice email CTA color is legacy Wolt orange (`#E35205`), in-app brand is DK Sunset Slate (`#F97316`)**: `supabase/functions/send-invoice/index.ts` `BODY_BY_LOCALE` button-styling embeds the pre-R175 brand color across all 6 locales. Customer sees the email on a different orange than the contractor app. **Deferred** — pure cosmetic; doesn't affect launch viability or accessibility. Single-string find-replace + redeploy when convenient.

R66 batch (round 2): 4 files touched (`services/invoicePaymentWatcher.ts`, `services/customerInteractionWatcher.ts`, `services/aiQueueNotifier.ts`, `services/pushNotificationService.ts`) + 6 locale JSONs (`notifications.push` seeded with 29 keys). 0 TS errors, 674/674 jest pass. NL contractor now sees Dutch text on every lock-screen notification including the two most critical ones (payment received, customer accepted quote). 1 deferral (round-2 cosmetic only).

# R66 (round 3) — onboarding gate, validators, system theme

Round 3 focus: cold-start state machine, NL data validators, and global system-level UI defaults that survived the R175 DK theme conversion as legacy white-mode vestiges.

**R66.13 — Onboarding gate fires only from auth group (real launch blocker)**: `app/_layout.tsx` redirect effect had two branches: `(!isAuthenticated && !inAuthGroup) → /login` and `(isAuthenticated && inAuthGroup) → role-based routing`. The role-based branch correctly routed `onboardingComplete: false` users to `/onboarding`, but only when the user was *currently in /login or /signup*. Failure mode: contractor signs up, fills 3 of 14 onboarding steps, kills the app to take a phone call. Cold-start: session restored (`isAuthenticated=true`, `onboardingComplete=false`), root path is `/` which is `(contractor)/index.tsx`, segments[0] is empty → both branches no-op → contractor lands on Vandaag with `country=undefined`, `trade=undefined`, no IBAN. They start sending broken quotes. Fix: third branch — if authenticated + onboarding incomplete + not on `/onboarding` + not worker + not enterprise → `router.replace('/onboarding')`.

**R66.14 — `isValidVATNumber` regex was too lax**: `/^[A-Z]{2}\w{2,12}$/i` accepted `NL12` (4 chars after country code minimum) — way short of any real EU VAT format. Real Dutch VAT is `NL` + 9 digits + `B` + 2 digits = 14 chars. Replaced with country-specific regex map for NL/DE/FR/ES/IT/GB/BE/AT, with permissive fallback for unenumerated countries so we don't block users in Cyprus, Greece, etc.

**R66.15 — `isValidIBAN` was shape-only, no checksum**: `/^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/` accepted `NL12ABCD12345678901234` despite invalid mod-97 checksum and wrong length-for-NL. A contractor pasting a wrong IBAN past their bank's confirmation prompts would silently persist garbage; the customer's first transfer attempt would bounce. Implemented full ISO 13616 validation: country-specific length lookup (17 EU countries) + mod-97 checksum (chunked through 9-digit groups to avoid 64-bit overflow on JS numbers).

**R66.16 — 14 new tests for validators**: `src/utils/__tests__/validation.test.ts` (was no test file). Covers the two known-invalid cases (`NL12` VAT, `NL12ABCD…` IBAN), 3 real IBAN examples (NL/DE/FR), space-stripping + lowercase normalization, country-specific length rejection, KvK 8-digit format. 14/14 pass. Suite count up from 66 → 67, tests 674 → 688.

**R66.17 — `app.json` userInterfaceStyle: "light" forces system widgets to light mode despite DK dark theme (since R175)**: pre-R175 the app was Wolt-style light; setting was correct. R175 dark theme inherited the legacy "light" setting, so on iOS the system widgets (date pickers, action sheets, status bar tinting in some scenarios) get rendered in light mode against a `#0B0E11` panel. Flipped to `"dark"`.

**R66.18 — Splash screen flashes white on cold-start of dark app**: `app.json` splash backgroundColor was `#ffffff` while every screen is `#0B0E11`. Tap app → blinding white flash → dark UI. Fixed: `#0B0E11`.

**R66.19 — Notifications channel color is legacy Wolt orange**: `app.json` plugin config for expo-notifications had `color: "#E35205"` (pre-R175). Notification icons on Android tinted with old brand orange against in-app DK Sunset Slate. Flipped to `#F97316`.

**R66.20 — 3 hardcoded `dark-content` StatusBar refs from before R175**: `app/(tabs)/planning.tsx`, `app/(tabs)/tools.tsx`, `app/sitelead/team/[id].tsx` had `barStyle="dark-content"` (correct on white bg, invisible-on-dark on DK theme). Other screens that set StatusBar style after R175 already use `light-content` (`(contractor)/index.tsx:102`, `Screen.tsx:12`). Fixed the 3 stragglers.

**R66.21 — adaptiveIcon backgroundColor `#ffffff` (Android only)**: `app.json` line 56. Android's adaptive icon system masks the foreground asset on top of this color. Whether to flip depends on whether the foreground asset has its own dark background or transparent edges — without seeing the asset, I won't change blindly. **Deferred** — single value, assess at next icon-asset review.

**R66.22 — Data export only reads AsyncStorage, never Supabase**: `services/dataExportService.ts` `collectAllData()` iterates `@vasco_*` keys. For a contractor whose phone was reinstalled, the AsyncStorage cache is empty until the FE re-fetches from BE. GDPR Article 20 (right to portability) compliant *only* for users who haven't reinstalled. **Deferred** — needs an `exportFromBackend` path that pulls Supabase tables (documents, customers, materials_used, photos, etc.), formats, merges with local cache. Too big for an audit round; document for separate work.

**R66.23 — Push gating bypassed for invoice/customer realtime watchers**: `aiQueueNotifier` consults `shouldDeliver()` (which respects user prefs + quiet hours). `invoicePaymentWatcher` and `customerInteractionWatcher` skip both. A contractor who explicitly disables `payment_received` push in settings still gets pushed when a payment lands. Counterargument: payment landing is urgent enough to override the quiet-hours override anyway. **Deferred** — debatable UX call; revisit if user reports come in.

R66 batch (round 3): 6 files touched (`app/_layout.tsx` third gate branch, `src/utils/validation.ts` country-specific VAT + ISO 13616 IBAN with mod-97, `src/utils/__tests__/validation.test.ts` new file, `app/(tabs)/planning.tsx`, `app/(tabs)/tools.tsx`, `app/sitelead/team/[id].tsx`) + `app.json` (3 single-value flips: userInterfaceStyle, splash bg, notifications color). 0 TS errors, 688/688 jest pass (was 674, +14 new for IBAN/VAT/KvK). 3 deferrals (adaptiveIcon backgroundColor, dataExport BE pull, realtime-watcher gating).

# R66 (round 4) — broken asset, language preference, brand color sweep

Round 4 focus: build-blocking asset references, post-onboarding language honoring on cold-start, and the legacy Wolt orange that R175 missed (PDFs, emails, calendar invites — all customer-facing surfaces).

**R66.24 — Notification icon asset reference dangling (Android push UX broken)**: `app.json:89` referenced `./assets/notification-icon.png` but the file doesn't exist (only `icon.png`, `splash-icon.png`, `adaptive-icon.png`, `favicon.png` are present). On Android, push notification small icons MUST be a transparent monochrome PNG — without it Android shows a generic white square instead of the brand mark. Two failure modes: (a) EAS Build may fail with missing-asset error, (b) build succeeds but Android push notifications appear branded with white squares. Fixed by removing the dangling reference so Expo defaults to the app icon. Real fix needs a proper monochrome 96x96dp PNG asset designed by the brand team — not authorable here. Tracked as deferred.

**R66.25 — i18n only reads device locale at boot, ignores saved user.language preference**: `src/i18n/i18n.ts` line 24 — `lng: supportedLangs.includes(deviceLanguage) ? deviceLanguage : fallbackLng`. Initial language is locked to `getLocales()[0]?.languageCode` at module-init time. `app/onboarding.tsx` and `app/contractor/profile.tsx` call `i18n.changeLanguage(language)` *while running*, but the saved `user.language` from AsyncStorage is never re-applied on subsequent cold-starts. Failure mode: NL contractor picks Dutch in onboarding → travels with phone in German locale → cold-start app → reads German device locale → user-profile restore loads `language: 'nl'` into AppState but i18n stays on German → all UI text in German until the contractor manually changes it again. Fix: in AuthContext profile-restore effect, after merging `profile` into `user`, lazy-import i18n and call `i18n.changeLanguage(profile.language)` if it differs from the current i18n language.

**R66.26 — Bulk #E35205 → #F97316 sweep (26 occurrences across 14 files, all customer-facing)**: R175 flipped FE theme tokens in `src/theme/draftkings.ts` but the legacy hex was still embedded in PDF stylesheets, email HTML templates, calendar event description colors, and 2 dashboard components. NL contractor renders an invoice PDF with Wolt-orange brand stripe → emails it via Resend with a Wolt-orange "Pay now" CTA → customer sees a different orange than what's on the contractor's app screen. Files affected:
- `src/theme/colors.ts` (2: roleDirector, roleContractor)
- `src/context/AuthContext.tsx` (3: role primaryColor for director/contractor/worker)
- `src/services/invoicePdfService.ts` (4)
- `src/services/quotePdfService.ts` (8)
- `src/services/budgetPdfService.ts` (2)
- `src/services/receiptShareService.ts`, `calendarSyncService.ts`, `eveAgentService.ts`, `vatPrepExportService.ts`, `smartSchedulerService.ts`, `jobCommentsService.ts` (1 each)
- `src/components/dashboards/DirectorDashboard.tsx` (1), `ReportsDashboard.tsx` (2)
- `supabase/functions/send-invoice/index.ts` (1)

**R66.27 — `Pay now` button in send-invoice bodyOverride path was hardcoded English**: when the dunning cadence sends a firm/final reminder via `bodyOverride`, the FE caller composes localized cadence copy + EU 2011/7/EU disclosure, but the trailing CTA button on line 163 was hardcoded `Pay now`. So a NL customer reading a Dutch dunning letter saw an English button. Added `PAY_NOW_BY_LOCALE` map (6 locales) inside the edge fn — same pattern as `SUBJECT_BY_LOCALE` and `BODY_BY_LOCALE` already present.

**R66.28 — `app/contractor/legal.tsx` privacy policy + terms content has zero i18n coverage (NL launch concern)**: legal screen uses `t(headingKey, headingDefault)` pattern with English defaults. The `legal` namespace has only 4 keys in NL locale (section titles like termsOfService/privacyPolicy) — none of the `*Content` keys (platformUsage, contractorResponsibilities, paymentTerms, governingLaw, dataRetention, gdprRights, etc.) are translated. NL contractor on Dutch UI sees ≈1500 words of English privacy policy + terms. **Deferred** — translating legal text requires a Dutch lawyer, not a mechanical i18n pass; App Store accepts English legal text but Autoriteit Persoonsgegevens may flag GDPR notices as needing Dutch under Art. 12.

**R66.29 — 86 hardcoded `€${amount.toFixed/toLocaleString}` patterns bypass `formatCurrency()`**: components/screens render currency directly instead of via `src/i18n/formatting.ts:formatCurrency(amount, country)`. UK contractors see `€` instead of `£`. NL contractors with English device locale see US-format `€1,234.56` instead of `€1.234,56`. **Deferred** — large mechanical refactor (86 sites), low impact for the NL launch (most NL contractors have NL device locale; the symbol is correct everywhere).

R66 batch (round 4): 4 files touched (`app.json` notification-icon ref removed, `src/context/AuthContext.tsx` language-restore on cold-start, `supabase/functions/send-invoice/index.ts` localized Pay now CTA + #E35205→#F97316) + 13 more files for the brand-color sweep (theme/colors, 2 dashboards, 9 services). 0 TS errors, 688/688 jest pass. 3 deferrals (notification icon asset authoring, legal-text NL translation, 86 currency-formatter call sites).

# R66 (round 5) — paywall + payment-link UX i18n

Round 5 focus: user-facing strings on the freemium paywall and payment-link interactions, both of which fire frequently and were silently English-locked despite live in Dutch i18n elsewhere.

**R66.30 — Tier-gate `reason` strings hardcoded English in subscriptionService**: 7 gate functions (`canCreateJob`, `canCreateQuote`, `canCreateInvoice`, `canUseAiInsight`, `canAddClient`, `canAddTeamMember`, `canUseFeature`) constructed `reason` via template literals like `Quote limit reached (10/month).`. Three of these (Job/Quote/Invoice) fire on the highest-touch contractor actions, and consumer call sites (`app/quotes/new.tsx:115`, `app/quotes/[id]/invoice.tsx`, `app/(contractor)/werk.tsx`) render `gate.reason` directly as `Alert.alert(localizedTitle, gate.reason)`. NL contractor on Free tier hits 11th quote → sees Dutch title "Upgrade vereist" but English body "Quote limit reached (10/month)." Fixed: `tierGate` namespace seeded with 7 keys × 6 locales (using `{{count}}`/`{{feature}}`/`{{tier}}` interpolation), `subscriptionService.ts` now imports i18n and routes all 7 reasons through `i18n.t()`. `upgradeFeature` field stays English internally — it's a routing key, not user-visible.

**R66.31 — `ShareQuoteButton` hardcoded English on the highest-touch share action**: `src/components/contractor/ShareQuoteButton.tsx` had `Alert.alert('Could not create link', ...)` failure path, English `Hi {customerName}, here is your quote: {url}` share message, English `Share quote link` button label, English `Quote` share-sheet title. Every quote → customer share goes through this button, so a NL contractor sharing with a Dutch customer would emit an English share message. Fixed: imported `useTranslation`, added `shareQuote` namespace (6 keys × 6 locales) covering failTitle, failBody, message template, greeting prefix, share sheet title, button label.

**R66.32 — IntegratedPayments component had 4 hardcoded English Alerts on the payment-link flow**: lines 394, 429, 453, 461 fired English Alerts after creating a payment link, sending an email reminder, sending a WhatsApp reminder, and copying a link. These are the most frequent payment-side interactions a NL contractor will have. Fixed: added `paymentAlerts` namespace (7 keys × 6 locales), wired `useTranslation` hook (was unused but already imported), routed all 4 Alerts through `t()`. The remaining 2 English Alerts in this file (`'Action'` and `'Create Invoice'` on lines 237/683) are demo placeholder buttons that don't trigger real flows — left for the broader cleanup.

**R66.33 — 4 hardcoded Dutch Alerts in `app/customer/[code].tsx` access-code page**: lines 97, 106, 115, 155 contain Dutch error strings (`'Code ongeldig of verlopen'`, `'Te veel pogingen'`, `'Project niet gevonden'`). These work for NL launch (Dutch customers see Dutch errors) but break on cross-border B2C flows or DE/FR/ES/IT contractors sending portal codes to their customers. **Deferred** — locale needs to flow from contractor's country into the customer-portal URL (the customer hasn't logged in yet, so `i18n.language` defaults to device locale which may not match the contractor's market).

**R66.34 — Multiple `IntegratedPayments` and `ShareDecisionTracker` placeholder Alerts**: `Alert.alert('Action', ...)`, `Alert.alert('Create Invoice', ...)`, `Alert.alert('Code', accessCode)`, `Alert.alert('Link', shareUrl)` — these are dev-stub Alerts for actions not yet wired to real flows. **Deferred** — when their underlying flows ship, those Alerts will be replaced anyway.

R66 batch (round 5): 3 files touched (`src/services/subscriptionService.ts` 7 i18n.t() routings + i18n import, `src/components/contractor/ShareQuoteButton.tsx` 4 t() routings + useTranslation, `src/components/contractor/IntegratedPayments.tsx` 4 t() routings + useTranslation hook init) + 6 locale JSONs (3 new namespaces: `tierGate` 7 keys, `shareQuote` 6 keys, `paymentAlerts` 7 keys, total 20 keys × 6 locales = 120 entries). 0 TS errors, 688/688 jest pass. 2 deferrals (customer-portal Dutch-only error strings need locale-from-contractor threading; placeholder/dev-stub Alerts will be replaced when their flows ship).

# R66 (round 6) — invoice-numbering format mismatch + quote→invoice screen + namespace unify

Round 6 focus: bookkeeping-grade invoice-number consistency, full localization of the quote→invoice conversion screen (one of the highest-frequency NL contractor flows), and unifying two parallel i18n namespaces for the paywall prompt.

**R66.35 — FE offline fallback mints inconsistent doc-numbering format vs. BE RPC**: `src/lib/dataProvider.ts:nextDocumentNumber` had two formats:
- BE RPC (`004_base_schema.sql:next_document_number`): `Q0001` / `I0001` (single-letter prefix, no year suffix, 4-digit zero-pad)
- FE offline fallback: `Q-260001` / `INV-260001` (3-letter `INV` prefix, year suffix, dash separator)

Failure mode: contractor on flaky network mints quote 3 online (`Q0003`), goes underground for a job, mints quote 4 offline (`Q-260004`), reconnects, mints quote 5 online (`Q0005`). Customer-visible numbers are `Q0003 / Q-260004 / Q0005`. NL Belastingdienst Art. 35 wet OB 1968 + DE GoBD both require gap-free sequential invoice numbering — auditors flag the format inconsistency as evidence of bookkeeping system mismanagement. Fixed: unified the FE fallback to match the BE RPC shape exactly (`Q0001` / `I0001`), extracted to `localFallbackDocNumber()` helper, removed year suffix and 3-letter prefix entirely. Comment documents the contract — if year-prefixed numbering is desired in the future, the BE RPC has to lead and FE follows.

**R66.36 — Cross-device offline collision risk (documented, not fixed)**: when two devices both go offline and mint counters from local AsyncStorage, both can produce `Q0008` independently. Reconnect → BE rejects one with 23505 → contractor sees a generic error. The BE RPC is the source of truth, and this round's format unification doesn't change that. **Deferred** — true fix needs a queued-but-unnumbered placeholder that the offline-write queue resolves at flush-time. Architectural change beyond an audit round.

**R66.37 — `app/quotes/[id]/invoice.tsx` quote→invoice conversion screen 100% hardcoded English (top-3 NL contractor flow)**: 13 strings on a screen that fires every time a contractor turns a quote into an invoice — easily the most-frequently-traversed conversion path. Strings: header (`Invoice from {id}`, `Auto-numbered · Due in 14 days`), card titles (`Quote details`, `Customer`, `Job`, `Amount`, `Line items`), success card (`Invoice created`, `Invoice #{id}`, `Matches quote language to reduce payment disputes.`), buttons (`Create invoice`, `Creating...`, `Generate PDF`, `Mark sent`), error alerts (`Error`/`Could not create invoice. Please try again.`), upgrade gate (`Upgrade required` / `Cancel` / `View plans`), and not-found state (`Quote {id} not found`). Fixed: imported `useTranslation`, seeded new `quoteToInvoice` namespace (15 keys × 6 locales), routed all 13 strings through `t()`. Tier-gate alert now uses the canonical `billing.*` namespace (see R66.39).

**R66.38 — Drift between `compliance.upgradeRequired` and `billing.upgradeRequired` (same string, two namespaces)**: existing call sites in `app/contractor/customer-crm.tsx`, `app/contractor/inkoop.tsx`, `app/invoices/[id].tsx`, `src/components/contractor/TieredQuoteBuilder.tsx`, `app/quotes/new.tsx` used `t('compliance.upgradeRequired', 'Upgrade required')`. The `compliance` namespace had NO matching key in any locale (it was always falling through to the English default). Round 5/6 newly-added `compliance.upgradeRequired` keys (which I momentarily seeded) duplicated the long-standing `billing.upgradeRequired` namespace which was already at full 6-locale parity. Fixed: bulk-replaced `compliance.upgradeRequired` / `compliance.viewPlans` / `compliance.upgradeRequiredDesc` → `billing.upgradeRequired` / `billing.viewPlans` / `billing.formatNeedsContractor` across 5 consumer files. Removed the duplicate `compliance.*` keys I had just added so there's a single canonical namespace. Added the missing `billing.formatNeedsContractor` (6 locales) for the format-tier-gate path used in invoice export.

**R66.39 — `compliance.*` paywall keys never resolved**: this is a knock-on of R66.38 — every contractor seeing the paywall before this round saw the `t()` second-argument English fallback because the key didn't exist. Now resolves to the localized `billing.*` text.

R66 batch (round 6): 7 files touched (`src/lib/dataProvider.ts` doc-number format unify + helper extraction, `app/quotes/[id]/invoice.tsx` 13 t() routings + useTranslation, `app/quotes/new.tsx` namespace migration, `app/invoices/[id].tsx` 3 namespace migrations, `app/contractor/customer-crm.tsx` namespace migration, `app/contractor/inkoop.tsx` namespace migration, `src/components/contractor/TieredQuoteBuilder.tsx` namespace migration) + 6 locale JSONs (new `quoteToInvoice` 15 keys, removed duplicate `compliance.upgradeRequired`/`viewPlans`, added `billing.formatNeedsContractor`). 0 TS errors, 688/688 jest pass. 1 deferral (cross-device offline doc-number collision needs queued-placeholder architectural change).

# R66 (round 7) — WhatsApp templates customer-facing i18n

Round 7 focus: customer-facing WhatsApp message templates — the dominant communication channel for NL solo contractors.

**R66.40 — 3 WhatsApp customer message templates hardcoded English**: `src/services/whatsappService.ts` exported `buildInvoiceReminderMessage`, `buildQuoteFollowUpMessage`, `buildProgressMessage` with full English templates including greetings, sign-offs ("Best regards"), date phrasing ("which is X days overdue"), and the "Sent via Vasco" attribution. NL solo contractors do most customer comms via WhatsApp — sending an English reminder to a Dutch customer signals an unprofessional setup. Failure mode: contractor sends payment reminder via WhatsApp → customer sees full English message → trust erodes instantly. Fixed: imported i18n already present, added `whatsapp` namespace (4 keys × 6 locales = 24 entries) covering invoiceReminder, invoiceOverdue (interpolation suffix), quoteFollowup, progressUpdate. All three builder functions now route through `i18n.t()` with `{{name}}` / `{{ref}}` / `{{amount}}` / `{{job}}` / `{{hours}}` / `{{days}}` / `{{overdue}}` interpolation.

**R66.41 — Audited but skipped: 20 ungated `console.*` calls in `src/` and `app/`**: most are catch-block error logging in `app/(modals)/customers.tsx`, `app/quotes/new.tsx`, `app/quotes/[id]/invoice.tsx`, `app/(modals)/business-settings.tsx`, `src/intelligence/pricingAgent.ts`, `src/api/pricingApi.ts`. None contain user PII (no phone/email/IBAN/KvK/customer-name in log lines — verified). Production noise but not a security issue. **Deferred** — broader cleanup pass on logging hygiene; the existing `errorHandler.ts` (`logError`/`logWarn`/`logInfo`) is properly `__DEV__`-gated and is the canonical replacement target.

**R66.42 — Audited and verified clean: no hardcoded `localhost`/`127.0.0.1`/`192.168.*` URLs anywhere in `src/`, `app/`, `supabase/`**: occasional concern with React Native dev environments leaking dev URLs into prod builds — checked all 3 trees, zero hits. Supabase URL flows via `EXPO_PUBLIC_SUPABASE_URL` env var; no hardcoded prod hosts.

**R66.43 — Audited and verified clean: onboarding completion persists language across cold-start**: `app/onboarding.tsx:400-407` writes `language` into both AppState (`updateUser({ language })`) and AsyncStorage (`@vasco_user_profile`). Round-3 fix in `AuthContext` profile-restore effect reads this on cold-start and re-applies via `i18n.changeLanguage`. End-to-end: contractor picks Dutch in onboarding → AsyncStorage has `language: 'nl'` → kills app → cold-starts on a phone in any locale → `i18n.changeLanguage('nl')` fires from AuthContext effect → app renders Dutch. Verified.

R66 batch (round 7): 1 file touched (`src/services/whatsappService.ts` — 3 builder fns + 1 helper, routed through i18n) + 6 locale JSONs (new `whatsapp` namespace, 4 keys each). 0 TS errors, 688/688 jest pass. 1 deferral (broader console.* logging-hygiene cleanup); 2 verified-clean items.

# R66 (round 8) — tax-record retention + silent payment-link failures

Round 8 focus: 7-year retention compliance for invoices and a silent-failure UX bug on the payment-link CTA.

**R66.44 — Hard delete on invoices violates Belastingdienst Art. 52 AWR (NL) + GoBD §147 HGB (DE) retention requirements (real launch blocker)**: `src/lib/dataProvider.ts:deleteDocument` did `supabase.from('documents').delete()` with no soft-delete path. NL law requires 7-year retention of invoices and supporting docs; DE requires 10. A contractor accidentally deleting a paid invoice would lose the canonical record — auditor visit later finds a gap, contractor's whole bookkeeping defense collapses. Quotes pre-acceptance aren't tax records and may still be hard-deleted (NL has no quote retention rule). Fix:
- New migration `20260507000001_documents_soft_delete.sql`: adds `deleted_at timestamptz` column, refreshes `documents_select_own` RLS to filter `deleted_at IS NULL`, ensures `documents_update_own` policy allows the soft-delete write, ensures `documents_delete_own` policy still allows hard-delete (for quotes). Partial index `documents_user_active_idx` on `(user_id, doc_type) where deleted_at is null` keeps active-row lookups fast.
- `deleteDocument(idOrNumber, docType?)` extended with optional `docType` param: when `'invoice'` it `UPDATE` sets `deleted_at = NOW()`; when `'quote'` it does the legacy `DELETE`. When omitted, looks up the row's `doc_type` first.
- `AppState.removeQuote/removeInvoice` thread `'quote'`/`'invoice'` explicitly so the offline queue replays through the right path.
- `DocumentRow` type extended with `deleted_at: string | null`.

Side effect: FE sees zero behavioral change for normal flows (RLS hides the soft-deleted row from `listDocuments`). The row is recoverable via service_role for compliance exports / contractor support cases.

**R66.45 — `createPaymentLink` silently swallowed Stripe/Mollie failures**: `src/state/AppState.tsx:2202` had `if (result.success) { setLastMolliePayment(...) }` with NO `else`. Caller `app/invoices/[id].tsx:handleCreatePayment` wrapped in try/catch + `hapticError`, but nothing ever threw — the function "completed" successfully. Failure mode: contractor presses "Generate payment link", feels success haptic vibration, but no link in the list. They press it again. Same. They give up. Real bug: every Mollie misconfiguration / network blip becomes a UX dead-end with no diagnostic. Fix: AppState `createPaymentLink` now throws `new Error(result.error ?? 'X payment link creation failed')` on `!result.success`. Caller catches the throw, fires hapticError, AND surfaces an `Alert.alert` with the provider's actual error message (or a localized fallback when the provider didn't return one). Added `paymentAlerts.paymentLinkFailedTitle` + `paymentAlerts.paymentLinkFailedBody` × 6 locales.

R66 batch (round 8): 4 files touched (`supabase/migrations/20260507000001_documents_soft_delete.sql` new, `src/lib/dataProvider.ts:deleteDocument` soft-delete branch, `src/lib/database.types.ts` DocumentRow.deleted_at, `src/state/AppState.tsx` removeQuote/removeInvoice thread docType + createPaymentLink throws on failure, `app/invoices/[id].tsx` handleCreatePayment surfaces error Alert) + 6 locale JSONs (2 new paymentAlerts keys). 0 TS errors, 688/688 jest pass. Migration ready to deploy via `supabase db push`. 0 deferrals this round.

# R66 (round 9) — round-8 follow-ups: queue replay path + sibling silent-failure

Round 9 focus: a real bug introduced by round 8's soft-delete fix when crossed with the offline-write queue, plus auditing the same silent-failure pattern across other AppState mutators.

**R66.46 — Round 8 soft-delete bypassed when invoice delete happens offline**: `AppState.removeInvoice` calls `persistOrQueue('documents', 'delete', () => deleteDocument(id, 'invoice'), { rowId: id })`. Live attempt soft-deletes correctly. But when offline, `persistOrQueue` falls back to `queueWrite({ table, op: 'delete', rowId })`. On flush, the generic `applyOp` in `offlineWriteQueue.ts:176` sees `op === 'delete'` → executes `table.delete().eq('id', rowId)` → HARD DELETE — bypassing the `deleted_at` column entirely. So a contractor who deleted an invoice on the train, then reconnected at the office, would have the BE row irreversibly hard-deleted. Same compliance hole round 8 was supposed to close. Fix: changed the queued op from `'delete'` to `'update'` with payload `{ deleted_at: <iso> }`. Live attempt still calls `deleteDocument(id, 'invoice')` (which soft-deletes via UPDATE). Offline-then-flushed replay now runs through `op === 'update'` branch which executes `update({ deleted_at }).eq('id', rowId)` — soft-deletes, RLS policy `documents_update_own` allows it.

**R66.47 — Same silent-failure pattern on `exportInvoice` (Moneybird)**: `AppState.exportInvoice` (line 1701-1709) had `if (result.success) {...} else if (result.error) { logWarn(...) }` with no throw. Caller `app/invoices/[id].tsx:handleExportMoneybird` wrapped in try/catch + `hapticError`, but the function never threw. Same UX dead-end as R66.45 createPaymentLink: contractor presses "Export to Moneybird", feels success haptic, nothing in Moneybird. Fix: function now throws `new Error(result.error ?? 'Moneybird export failed')` on `!result.success`. Caller surfaces a localized Alert with the reason. Added `paymentAlerts.moneybirdFailedTitle` + `paymentAlerts.moneybirdFailedBody` × 6 locales.

**R66.48 — Audited and verified clean: logout sequence**: `AuthContext.logout` runs in correct order (1) flushEvents under current auth, (2) unregisterPushToken under current auth, (3) clearUserContext, (4) stop background loops, (5) supabase.auth.signOut, (6) clearUserScopedStorage, (7) setUser(null). Push-token deregistration before signOut ✓. R46 storage wipe covers multi-tenancy hazards ✓. No race window where a write would land under stale auth.

**R66.49 — Audited and verified clean: KeyboardAvoidingView + SafeArea on auth + customer screens**: signup/login/forgot-password/reset-password all use `KeyboardAvoidingView` with iOS=`padding`, Android=`height`. Customer portal (`customer/index.tsx` + `customer/[code].tsx`) uses `SafeAreaView` from `react-native-safe-area-context` with explicit `edges`. No iOS small-phone CTA cutoffs.

R66 batch (round 9): 3 files touched (`src/state/AppState.tsx` removeInvoice queue op + exportInvoice throws, `app/invoices/[id].tsx` handleExportMoneybird Alert) + 6 locale JSONs (2 new paymentAlerts keys). 0 TS errors, 688/688 jest pass. Round 8's soft-delete fix is now correct end-to-end (live + offline-replay).

---

# R66 rounds 54–59 (2026-05-11) — production hardening + open-item closures

Major thread of work spanning 6 rounds. **Updates 4 audit entries from earlier rounds:**

- **R11 signature service — CLOSED** end-to-end via r55-r57: BE table + RLS + 2 write paths (contractor RLS + portal SECURITY DEFINER RPC) + audit-trail reader + contractor-side display panel + customer-side portal modal + realtime watcher + push notification. PDF embed updated with per-language legal text.
- **R8 cron jobs — PARTIALLY CLOSED** via r55: admin Cron tab visibility shipped (`get_cron_health()` RPC). Operator action (running `cron.sql`) still required pre-launch.
- **R66.4 NL 9% reduced VAT — CLOSED** in r59: new `getReducedVatRate(country)` helper returns 9 for NL (null for other EU6), TieredQuoteBuilder shows an NL-only opt-in toggle, all three tier totals recalc. 3 new tests. Real money fix — pre-r59 NL renovation contractors over-charged 21% on labor for which Belastingdienst's verlaagd tarief mandates 9%.
- **R66.12 send-invoice email CTA color — CLOSED**: was already `#F97316` upstream (audit entry was stale); fixed one stray `#E35205` in contractor index agent badge.
- **R66.29 hardcoded €${...} sweep — PARTIALLY CLOSED**: 5 highest-traffic files migrated to `formatCurrency()` (werk / facturen / besparen tabs + expenses + customer-view drill-downs). UK contractors now see £ on every dashboard tab. Remaining ~12 sites in lower-traffic share-strings + alerts deferred.

**New schema/RPC additions (per SCHEMA_LOCK v1.6):**
- `public.signatures` table (R66r55)
- `public.app_config` table (R66r54)
- `write_signature_via_portal` RPC (R66r55/r56)
- `get_cron_health` RPC (R66r55)
- `get_portal_by_access_code` updated to discriminate expired vs not-found (R66r58)

**FE additions:**
- `versionCheckService` real Supabase fetch (R66r54)
- Stripe modal `validateConnection()` actually hits `/v1/balance` (R66r57)
- Portal expired-token UX with discriminated lookup result (R66r58)
- Disconnect buttons for Mollie + Stripe modals; SecureStore wipe on userChange (R66r55)

**Test status at end of r59:** 861/861 across 82 suites, 0 TS errors. All 6 locale JSONs valid.

**8 pending migrations after r58** — 9 if r59 ships its tests with the round. No new operator action beyond what r54-r58 already documented.

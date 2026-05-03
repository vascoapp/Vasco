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

**Files retired (deprecated headers, kept in tree):**
- `customerCommunicationService.ts` (R288)
- `liveTrackingService.ts` (R295)
- `signatureService.ts` (R296)
- `teamToolsService.ts` (R299)
- `whatsappTemplateService.sendWhatsapp` + `useReviews` + `useReputation` (R300, function-level)

These four files can be deleted whenever someone wants to reclaim ~1,000 LoC. None of them is referenced by any consumer.

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

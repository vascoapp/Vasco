# P1 — Reachability: what no contractor can open (2026-09-24)

`npm run audit:reach` (scripts/reachability.mjs). From the contractor's tabs, following every navigation literal and every import, plus the external entry points (auth callback, quote-accept, referral and customer-quote links).

**243 of 819 files — 88,143 of 289,047 lines (30%) — cannot be reached by a signed-in contractor.** Every sweep so far has spent time on some of it.

## ✅ Decided 2026-09-24: GATE, don't delete
Kept for future extensions. `src/config/dormant.ts` gates the routes (the
root layout redirects them, deep links included) and
`src/config/dormant.files.json` lists the files sweeps and guards skip.
Guard: `dormantStaysDormant` (both directions). The table below is what is
gated.

## The groups (were: delete, quarantine, or keep)

Recommendation: **delete** the groups marked ✂️ (no one can open them; git keeps the history), **keep** the ones marked 🔒 with a reason.

| Group | Files | Lines | Why unreachable | Recommendation |
|---|---|---|---|---|
| app/hub | 15 | 4,719 | Portfolio/hub role — nothing a contractor opens links to it; memory rule: contractor + aannemer only | ✂️ delete |
| app/(tabs) | 42 | 3,824 | Enterprise/site-lead tab layout — every signed-in user is redirected to (contractor) | ✂️ delete |
| app/sitelead | 12 | 3,720 | Site-lead role — redirected away | ✂️ delete |
| app/(modals) | 4 | 1,165 | ingestion/insights (only linked from (tabs)); moneybird-auth/xero-auth superseded by (modals)/moneybird | ✂️ delete |
| app/worker | 4 | 1,123 | Worker role — redirected away; invite flow not built | ✂️ delete |
| app/contractor | 3 | 494 | closeout, ai-assistant, handover/[jobId] — nothing links to them | ✂️ delete |
| app/contractor/drag-schedule.tsx | 1 | 34 | Legacy REDIRECT for paths already persisted in pushes and queue items (the graph cannot see stored routes) | 🔒 keep |
| app/reset-onboarding.tsx | 1 | 74 | dev-only route | 🔒 keep (dev) |

## Code only those screens use (goes with them)

| Area | Files | Lines | Largest |
|---|---|---|---|
| src/components | 75 | 36,598 | `BudgetOptimizerDashboard.tsx`, `CFODashboard.tsx`, `COODashboard.tsx`, `DirectorDashboard.tsx` |
| src/services | 50 | 22,072 | `crossRoleWorkflowService.ts`, `evidenceGraphService.ts`, `ukComplianceService.ts`, `scheduleFragilityService.ts` |
| src/types | 9 | 4,088 | `workflow-agents.ts`, `evidence-graph.ts`, `agent-actions.ts`, `schedule-fragility.ts` |
| src/modules | 6 | 3,723 | `agentActions.ts`, `riskRegister.ts`, `s106CILTracker.ts`, `successMetrics.ts` |
| src/data | 6 | 2,071 | `mockBudgetWorkbook.ts`, `mockSiteLead.ts`, `mockBuildOS.ts`, `types.ts` |
| src/integrations | 8 | 1,954 | `etim.ts`, `einvoice-fr.ts`, `permitAutofill.ts`, `companyLookup.ts` |
| src/ingestion | 5 | 1,203 | `buildosIngestion.ts`, `intelligenceBridge.ts`, `buildosSchema.ts`, `spreadsheetExtractor.ts` |
| src/intelligence | 2 | 294 | `loopIntelligence.ts`, `index.ts` |
| src/hooks | 2 | 293 | `useRecommendationFeedback.ts`, `index.ts` |
| src/utils | 2 | 278 | `stripComments.ts`, `multiCurrency.ts` |
| src/logic | 1 | 154 | `attentionEngine.ts` |
| src/api | 1 | 147 | `vascoApi.ts` |
| src/i18n | 1 | 79 | `localization.ts` |
| src/domain | 2 | 32 | `types.ts`, `attention.ts` |
| src/theme | 1 | 4 | `index.ts` |

## Limits of the map
A route stored in DATA — a push payload, a persisted queue item, a bookmark —
is invisible to a static graph. `drag-schedule` is exactly that and is kept.
Before deleting any screen, grep for its path in `notificationService`,
`queueItemExecutor` and the action-queue producers.

## Surprises worth knowing before deciding
- `VascoCard.tsx` (918 lines) is **no longer mounted** — Vandaag and Geld replaced it with inline queue rows; only the unreachable site-lead dashboard imports it. Guards still carry allow-list entries for it.
- `HandoverPackBuilder` + `evidencePackService` mint invented URLs (`vascobuild.com/pdf|handover|certificates`) — reachable only from the dead `(tabs)` dashboard.
- `emailImportService`, `reputationService.requestReview`, `documentVaultService.createShareLink`: zero callers.
- `ukComplianceService` (1,112 lines) and `einvoice-fr.ts`: nothing imports them — the UK and FR compliance surfaces the app shows come from elsewhere.

## After the decision
Deleting a group removes its code from every future sweep. The guards that allow-list dead files (linksPointAtRealPages UNREACHABLE, shareIsNotSent NO_CONSEQUENCE, queriesNameLiveColumns KNOWN) shrink with it — each fails on a stale entry, so the deletion will be checked.


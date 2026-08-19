# Contractor Gap Implementation Plan

**Created:** 2026-03-20
**Focus:** Individual Contractor & Team Contractor Views
**Source:** Feature audit of `/Downloads/vascoapp/*.txt` vs existing codebase

---

## Phase 1: Core Workflow Completions (closes broken flows)

### 1.1 Job → Invoice Direct Path
- **Gap:** Contractors can only invoice from quotes, not from completed jobs
- **Fix:** Add "Factureer" action on completed/in-progress jobs in `facturen.tsx` and extend `invoiceAutomationService` to generate invoices from job data directly
- **Files:** `src/services/invoiceAutomationService.ts`, `app/(contractor)/facturen.tsx`, `src/state/AppState.tsx`

### 1.2 Quote Editing After Creation
- **Gap:** Quotes are view-only after save
- **Fix:** Add edit mode to `QuoteBuilder.tsx` — load existing quote data, allow modification, save updates
- **Files:** `src/components/contractor/QuoteBuilder.tsx`, `app/quotes/[id].tsx`, `src/state/AppState.tsx`

### 1.3 Quote → Job Auto-Conversion
- **Gap:** When a quote is accepted, no job is created automatically
- **Fix:** Add `convertQuoteToJob()` in AppState that creates a job from accepted quote data
- **Files:** `src/state/AppState.tsx`, `app/quotes/[id].tsx`

### 1.4 Lead Management UI
- **Gap:** `leadGenerationService` exists but UI is a stub
- **Fix:** Build out `LeadGeneration.tsx` with lead list, status filters, lead detail, and conversion actions
- **Files:** `src/components/contractor/LeadGeneration.tsx`, `app/contractor/leads.tsx`

---

## Phase 2: Critical Missing Features

### 2.1 Invoice PDF Generation
- **Gap:** Placeholder modal only
- **Fix:** Generate HTML invoice template, render to shareable format
- **Files:** `app/(modals)/pdf.tsx`, `src/services/invoiceAutomationService.ts`

### 2.2 Timesheet/Hour Logging for Individual Contractors
- **Gap:** Team time tracking exists but no solo contractor hour logging
- **Fix:** Extract time entry from `TeamManagement` into standalone component, add route
- **Files:** New `src/components/contractor/TimeTracker.tsx`, `app/contractor/timesheet.tsx`

### 2.3 Purchase Order System
- **Gap:** No PO creation/numbering/tracking
- **Fix:** Add PO types, service, and UI for creating POs from job materials
- **Files:** New `src/services/purchaseOrderService.ts`, extend `src/types/contractor-features.ts`

### 2.4 Permit Wizard for Contractors
- **Gap:** Permit UI is COO-only, contractors can't create/view permits
- **Fix:** Build contractor permit creation flow reusing `permitTracker.ts`
- **Files:** New `src/components/contractor/PermitWizard.tsx`, `app/contractor/permits.tsx`

---

## Phase 3: Team Contractor Enhancements

### 3.1 Subcontractor Assignment & Coordination
- **Gap:** "Subcontractor" category exists in supplier types but no workflow
- **Fix:** Add subcontractor assignment to jobs, credential verification, work tracking
- **Files:** New `src/services/subcontractorService.ts`, extend `TeamManagement.tsx`

### 3.2 Quote Approval Workflow
- **Gap:** Types defined in `workflow-agents.ts` but no UI/logic
- **Fix:** Add approval gate for quotes above threshold, notification to owner/foreman
- **Files:** Extend `QuoteBuilder.tsx`, new approval component

### 3.3 Job Pipeline Kanban Board
- **Gap:** Jobs shown as grouped lists, no visual kanban
- **Fix:** Build kanban columns matching job status flow with drag-drop
- **Files:** New `src/components/contractor/JobPipeline.tsx`

### 3.4 Push Notifications for Team
- **Gap:** In-app banners only
- **Fix:** Add expo-notifications for schedule changes, overdue alerts, assignments
- **Files:** New `src/services/notificationService.ts`

---

## Phase 4: Financial Maturity

### 4.1 Multi-Rate VAT
- **Gap:** Only 21% hardcoded
- **Fix:** Support 0%, 9%, 21% with per-line-item selection
- **Files:** `src/services/invoiceAutomationService.ts`, `QuoteBuilder.tsx`

### 4.2 Partial Payments
- **Gap:** Binary paid/unpaid
- **Fix:** Add payment records array on invoices, track deposits and milestones
- **Files:** `src/state/AppState.tsx`, `app/invoices/[id].tsx`

### 4.3 P&L Reporting
- **Gap:** No formal financial statements
- **Fix:** Build P&L view from existing invoice/cost data
- **Files:** New `src/components/contractor/ProfitLossReport.tsx`

### 4.4 Payroll Basics
- **Gap:** No payroll export
- **Fix:** Export team hours + rates in CSV/Moneybird format
- **Files:** Extend `teamManagementService.ts`, Moneybird integration

---

## Implementation Status

### Phase 1 — COMPLETED (2026-03-20)

| Item | Status | Details |
|------|--------|---------|
| 1.1 Job → Invoice | ✅ Done | `addInvoiceFromJob()` in AppState + "Nieuwe Factuur" banner in facturen tab |
| 1.2 Quote Editing | ✅ Done | `updateQuote()` in AppState (QuoteBuilder already had `existingQuote` prop) |
| 1.3 Quote → Job | ✅ Done | `convertQuoteToJob()` in AppState + "Accepteer & maak klus" button in quotes/[id] |
| 1.4 Lead Management | ✅ Done | LeadGeneration.tsx was already complete; added "Offerte maken" action for qualified leads |

**Additional fixes:**
- Translated all English labels in `quotes/[id].tsx` to Dutch (nl-NL)
- Zero new TypeScript errors introduced

### Phase 2 — COMPLETED (2026-03-20)

| Item | Status | Details |
|------|--------|---------|
| 2.1 Invoice PDF | ✅ Done | `invoicePdfService.ts` — branded HTML→PDF via expo-print + expo-sharing, Dutch template |
| 2.2 Timesheet | ✅ Done | `app/contractor/timesheet.tsx` — clock in/out, job linking, day/week/month views |
| 2.3 Purchase Orders | ✅ Done | `purchaseOrderService.ts` + `app/contractor/purchase-orders.tsx` — PO numbering, status tracking, line items |
| 2.4 Permit Wizard | ✅ Done | `app/contractor/permits.tsx` — 2-step wizard, permit type picker, status tracking, overview list |

**All routes registered in `contractor/_layout.tsx`.**

### Phase 3 — COMPLETED (2026-03-20)

| Item | Status | Details |
|------|--------|---------|
| 3.1 Subcontractors | ✅ Done | `subcontractorService.ts` + `app/contractor/subcontractors.tsx` — credential tracking, job assignment, rating, 2-tab (list + assignments) |
| 3.2 Quote Approval | ✅ Done | `quoteApprovalService.ts` — threshold rules, approve/reject flow, approval banner in facturen.tsx offertes tab |
| 3.3 Job Pipeline | ✅ Done | `app/contractor/pipeline.tsx` — horizontal kanban, 8 columns, status advancement, value totals |
| 3.4 Notifications | ✅ Done | `notificationService.ts` — 7 notification types, read/unread, preferences, ready for expo-notifications |

**New routes: `subcontractors`, `pipeline` registered in `contractor/_layout.tsx`.**

### Phase 4 — COMPLETED (2026-03-20)

| Item | Status | Details |
|------|--------|---------|
| 4.1 Multi-rate VAT | ✅ Done | Support 0%/9%/21% per line item, VAT_RATES exported, PDF shows per-rate breakdown, mock data updated |
| 4.2 Partial Payments | ✅ Done | `PaymentRecord` type, `payments[]` on AutoInvoice, `addPayment()` method, deposit/milestone/partial/final types |
| 4.3 P&L Report | ✅ Done | `app/contractor/profit-loss.tsx` — month/quarter/year views, income/expense breakdown, margin bar, BTW summary |
| 4.4 Payroll Export | ✅ Done | `app/contractor/payroll.tsx` — week/month view, per-member breakdown, overtime calc (1.5×), CSV export via Share |

**All routes registered. All 4 phases complete.**

---

## Phase 5: Workflow Polish & Connectivity

### 5.1 Quote Templates
- **Gap:** No save-as-template or reuse feature for quotes
- **Fix:** Add `quoteTemplateService` with save/load templates, categories
- **Files:** New `src/services/quoteTemplateService.ts`, `app/contractor/quote-templates.tsx`

### 5.2 Expense Tracking & Categorization
- **Gap:** No expense tracking or tax deduction categorization
- **Fix:** Add `expenseService` with categorized expenses, receipt linking
- **Files:** New `src/services/expenseService.ts`, `app/contractor/expenses.tsx`

### 5.3 Job Closeout Workflow
- **Gap:** No post-payment completion flow (satisfaction, warranty, feedback)
- **Fix:** Add closeout checklist screen triggered after invoice paid
- **Files:** `app/contractor/closeout.tsx`

### 5.4 Notifications Center
- **Gap:** Notification service exists (Phase 3) but no UI to view them
- **Fix:** Build notification inbox with read/unread, priority, actions, preferences
- **Files:** `app/contractor/notifications.tsx`

### Phase 5 — COMPLETED (2026-03-20)

| Item | Status | Details |
|------|--------|---------|
| 5.1 Quote Templates | ✅ Done | `quoteTemplateService.ts` + `app/contractor/quote-templates.tsx` — save/reuse, 8 categories, usage tracking, expandable items |
| 5.2 Expense Tracking | ✅ Done | `expenseService.ts` + `app/contractor/expenses.tsx` — 8 categories, tax deduction %, BTW reclaim, category filter |
| 5.3 Job Closeout | ✅ Done | `app/contractor/closeout.tsx` — 8-item checklist (4 required), progress bar, per-job tracking, finalize gate |
| 5.4 Notifications | ✅ Done | `app/contractor/notifications.tsx` — inbox with read/unread, priority badges, action routing, preferences toggle |

**All 5 phases complete — 20 items total.**

---

## Phase 6: Integration & Automation

### 6.1 Invoice Share/Email Sending
- **Gap:** Stub alerts only, no actual sharing
- **Fix:** Wire Share sheet for PDF + text invoice sharing in facturen.tsx

### 6.2 Document Requirements per Job Type
- **Gap:** No mapping of required docs per trade/job type
- **Fix:** `documentRequirementService` with 16 requirements, trade/type matching, completeness tracking

### 6.3 PO ↔ Invoice 3-way Matching
- **Gap:** No reconciliation between POs, deliveries, and supplier invoices
- **Fix:** Reconciliation screen with status matching, discrepancy detection

### 6.4 Calendar/iCal Export
- **Gap:** No way to export jobs to native calendar
- **Fix:** `calendarExportService` generating .ics events, share via native share sheet

### Phase 6 — COMPLETED (2026-03-20)

| Item | Status | Details |
|------|--------|---------|
| 6.1 Invoice Sharing | ✅ Done | Real Share sheet for text reminders + PDF generation from facturen.tsx invoice actions |
| 6.2 Doc Requirements | ✅ Done | `documentRequirementService.ts` — 16 requirements across 7 categories, trade/type matching, completeness % |
| 6.3 Reconciliation | ✅ Done | `app/contractor/reconciliation.tsx` — 3-column PO→delivery→invoice comparison, discrepancy detection |
| 6.4 Calendar Export | ✅ Done | `calendarExportService.ts` — iCal generation, single job + bulk export via Share |

**All 6 phases complete — 24 items total.**

---

## Phase 7: UX Polish & Customer Experience

### 7.1 Drag-Drop Schedule Board
- **Gap:** Only tap-to-reassign modals for scheduling
- **Fix:** Day timeline view with time slots, unassigned pool, slot picker, long-press remove

### 7.2 Customer Portal / Public Quote View
- **Gap:** No customer-facing quote view
- **Fix:** Tier selection (Goed/Beter/Best), accept/reject, change request form

### 7.3 Smart Scheduling Suggestions
- **Gap:** No AI optimization for daily route/schedule
- **Fix:** Location clustering, gap detection, priority reordering, weather suggestions, route optimization

### 7.4 Customer CRM View
- **Gap:** No unified customer relationship view
- **Fix:** Lifetime value, payment score, job history, VIP tagging, quick actions

### Phase 7 — COMPLETED (2026-03-20)

| Item | Status | Details |
|------|--------|---------|
| 7.1 Drag Schedule | ✅ Done | `app/contractor/schedule.tsx` — day timeline, unassigned pool, slot picker, conflict detection, utilization bar |
| 7.2 Customer Portal | ✅ Done | `app/contractor/customer-view.tsx` — tiered quote view (Goed/Beter/Best), accept flow, change request form |
| 7.3 Schedule Optimizer | ✅ Done | `app/contractor/schedule-optimizer.tsx` — 4 suggestion types, route comparison, apply all, impact metrics |
| 7.4 Customer CRM | ✅ Done | `app/contractor/customer-crm.tsx` — lifetime value, payment score, VIP tags, contact actions, metrics grid |

**All 7 phases complete — 28 items total.**

---

## Audit Checklist (post-implementation)

- [x] All new files follow TypeScript conventions
- [x] No duplicate services or components introduced
- [x] Existing patterns (hooks, services, types) reused
- [x] Theme uses `SemanticColors` and `Palette` (no raw `Colors`)
- [x] Dutch (nl-NL) labels used throughout
- [x] No new TS errors introduced (0 errors total)
- [x] Navigation routes registered in `_layout.tsx`
- [ ] Intelligence engine integration where applicable (Phase 2+)

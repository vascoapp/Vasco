# Vasco Codebase Gap Analysis

**Date:** February 2026
**Purpose:** Compare existing implementation against planned features from DECISION-GUIDANCE-PLAN.md and AI-NATIVE-TRADES-IMPLEMENTATION-PLAN.md

---

## Executive Summary

The Vasco codebase is **remarkably comprehensive** with 41 services, 15 type definition files, and 110+ components. Many features from the plans are already implemented. However, key gaps remain in:

1. **Reasoning & Explainability** - No step-by-step AI reasoning (Eve pattern)
2. **Continuous Auditing** - No background financial auditor
3. **Evidence Graph** - Flat evidence storage, not graph-based
4. **Country Compliance** - Only Netherlands, missing UK/Germany
5. **Procurement Optimisation** - No MILP/CP-SAT solver integration
6. **Learning Flywheel** - Limited feedback loops to improve models

---

## What's Already Built (Comprehensive)

### 1. Evidence & Document Services ✅ COMPLETE

| Planned | Status | Implementation |
|---------|--------|----------------|
| Evidence Pack Assembly | ✅ Built | `evidencePackService.ts` - assembleEvidencePack, validateCompleteness, generatePDF |
| Handover Package | ✅ Built | `evidencePackService.ts` - createHandoverPackage, recordCustomerSignOff |
| Document Vault | ✅ Built | `documentVaultService.ts` - folders, versioning, sharing, templates |
| Document Intelligence (OCR) | ✅ Built | `documentIntelligenceService.ts` - receipt/invoice/contract extraction |

**Components:**
- ✅ `HandoverPackBuilder.tsx` - Step-by-step handover wizard
- ✅ `JobCompletionEvidence.tsx` - Photo + checklist capture
- ✅ `DocumentVault.tsx` - Document management UI
- ✅ `ReceiptScanner.tsx` - OCR receipt capture

---

### 2. Compliance Services ✅ PARTIALLY COMPLETE

| Planned | Status | Implementation |
|---------|--------|----------------|
| Dutch Compliance (KvK, BTW) | ✅ Built | `dutchComplianceService.ts` - KvK verification, BTW filing, invoice compliance |
| Certifications Tracking | ✅ Built | `complianceService.ts` - VCA, BHV, F-gassen, NEN-1010 |
| Insurance Tracking | ✅ Built | `complianceService.ts` - liability, CAV, disability |
| Expiry Alerts | ✅ Built | `complianceService.ts` - getExpiryCalendar, alerts |
| UK Gas Safe | ❌ Missing | Not implemented |
| Germany Handwerksrolle | ❌ Missing | Not implemented |
| Country Auto-Gates | ❌ Missing | No blocking at workflow points |

**Components:**
- ✅ `ComplianceCenter.tsx` - Full compliance management UI
- ✅ `ComplianceStatusCard.tsx` - Dashboard widget

**Types:**
- ✅ `dutch-compliance.ts` - KvK, BTW, DutchCertification types

---

### 3. Supplier & Procurement ✅ MOSTLY COMPLETE

| Planned | Status | Implementation |
|---------|--------|----------------|
| Supplier Integration | ✅ Built | `supplierIntegrationService.ts` - connect, search, compare, order |
| Reliability Tracking | ✅ Built | `supplierReliabilityService.ts` - 7 KPIs, A-F grading |
| Drift Detection | ✅ Built | `supplierReliabilityService.ts` - detectDrift, alerts |
| Alternative Suggestions | ✅ Built | `supplierReliabilityService.ts` - suggestAlternatives |
| Price Alerts | ✅ Built | `priceAlertService.ts` - track prices, notify |
| MILP/CP-SAT Optimisation | ❌ Missing | No mathematical optimisation |
| Purchase Pack Generation | ❌ Partial | Evidence pack exists, no procurement-specific pack |

**Components:**
- ✅ `SmartPurchasing.tsx` - Price alerts, AI tips, upcoming needs
- ✅ `SupplierHub.tsx` - Supplier management
- ✅ `SupplierTracker.tsx` - Performance tracking
- ✅ `SupplierReliabilityCard.tsx` - Reliability metrics
- ✅ `SupplierAlertBanner.tsx` - Drift alerts
- ✅ `PriceComparison.tsx` - Multi-supplier comparison

**Types:**
- ✅ `supplier-reliability.ts` - Full supplier performance types
- ✅ `pricingDatabase.ts` - Price observation, recommendations

---

### 4. Quoting & Pricing ✅ MOSTLY COMPLETE

| Planned | Status | Implementation |
|---------|--------|----------------|
| Quote Builder | ✅ Built | `QuoteBuilder.tsx` - line items, VAT, terms |
| Tiered Quotes (Good/Better/Best) | ✅ Built | `TieredQuoteBuilder.tsx` - multi-tier pricing |
| Quote Optimisation | ✅ Built | `quoteOptimizerService.ts` - AI suggestions |
| Dynamic Pricing | ✅ Built | `pricingEngineService.ts` - market-based pricing |
| Photo-to-Quote | ✅ Built | `AIQuoteFromPhoto.tsx` - detect items from photos |
| AI BOM Extraction | ❌ Partial | Detects items but no formal BOM generation |
| Historical Job Comparison | ❌ Missing | No benchmark against similar jobs |

**Components:**
- ✅ `QuoteBuilder.tsx` - Manual quote creation
- ✅ `TieredQuoteBuilder.tsx` - Good/Better/Best tiers
- ✅ `QuoteOptimizer.tsx` - AI suggestions
- ✅ `AIQuoteFromPhoto.tsx` - Photo analysis
- ✅ `SmartPricing.tsx` - Pricing recommendations

**Types:**
- ✅ `contractor.ts` - Quote, QuoteLineItem types
- ✅ `contractor-features.ts` - TieredQuote, PricebookItem types

---

### 5. Scheduling & Capacity ✅ COMPLETE

| Planned | Status | Implementation |
|---------|--------|----------------|
| Smart Scheduling | ✅ Built | `smartSchedulerService.ts` - weather-aware, conflict detection |
| Capacity Planning | ✅ Built | `capacityPlanningService.ts` - forecasting, availability |
| Duration Estimation | ✅ Built | `capacityPlanningService.ts` - estimateDuration with confidence |
| Overrun Prediction | ✅ Built | `capacityPlanningService.ts` - predictOverrun |
| Schedule Fragility | ✅ Built | `scheduleFragilityService.ts` - fragility scoring |
| Critical Path | ✅ Built | `scheduleFragilityService.ts` - identifyCriticalPath |
| What-If Analysis | ✅ Built | `scheduleFragilityService.ts` - runWhatIfAnalysis |
| CP Solver Optimisation | ❌ Missing | No constraint programming solver |

**Components:**
- ✅ `SmartScheduler.tsx` - Day/Week/List views
- ✅ `CapacityPlanning.tsx` - Capacity management
- ✅ `FragilityScoreCard.tsx` - Fragility display
- ✅ `CriticalPathView.tsx` - Critical path visualization
- ✅ `WhatIfAnalysisModal.tsx` - Scenario modelling

**Types:**
- ✅ `capacity-planning.ts` - Full capacity types
- ✅ `schedule-fragility.ts` - Fragility, scenarios, alerts

---

### 6. Agent Actions & Workflows ✅ COMPLETE

| Planned | Status | Implementation |
|---------|--------|----------------|
| Agent Actions | ✅ Built | `agentActionsService.ts` - 28 action types |
| Approval Workflow | ✅ Built | Stakes-based approval thresholds |
| Execution Confirmation | ✅ Built | `ExecutionConfirmationModal.tsx` |
| Quote Nurture Workflow | ✅ Built | `workflowAgentsService.ts` - 2/5/7/12/14 day sequence |
| Cash Collection Workflow | ✅ Built | `workflowAgentsService.ts` - friendly→firm→final |
| Job Closeout Workflow | ✅ Built | `workflowAgentsService.ts` - invoice→warranty→review |

**Components:**
- ✅ `AgentActionsPanel.tsx` - Action management
- ✅ `ExecutionConfirmationModal.tsx` - Final confirmation gate

**Types:**
- ✅ `agent-actions.ts` - AgentAction, ActionRule, stakes
- ✅ `workflow-agents.ts` - Workflow types

---

### 7. Analytics & ROI ✅ COMPLETE

| Planned | Status | Implementation |
|---------|--------|----------------|
| Business Analytics | ✅ Built | `analyticsService.ts` - revenue, profitability, customers |
| ROI Metrics | ✅ Built | `roiMetricsService.ts` - hours saved, automation ROI |
| Industry Benchmarks | ✅ Built | `businessBenchmarkingService.ts` - peer comparison |
| Customer Insights | ✅ Built | `customerInsightsService.ts` - behavior analytics |

**Components:**
- ✅ `AnalyticsDashboard.tsx` - Multi-tab analytics
- ✅ `ROIDashboard.tsx` - ROI tracking
- ✅ `BusinessBenchmarking.tsx` - Peer comparison
- ✅ `HoursSavedCard.tsx` - Time savings display

**Types:**
- ✅ `roi-metrics.ts` - Full ROI types

---

### 8. Dashboards ✅ COMPLETE

All role-specific dashboards are implemented:
- ✅ `ContractorDashboard.tsx` - Solo contractor view
- ✅ `CFODashboard.tsx` - Finance focus
- ✅ `COODashboard.tsx` - Operations focus
- ✅ `SiteLeadDashboard.tsx` - Site execution
- ✅ `DirectorDashboard.tsx` - Strategic overview

Plus 15+ specialized dashboards (Cost, Safety, Quality, Permits, etc.)

---

## What's MISSING (Gaps to Fill)

### Gap 1: Reasoning Engine (Eve Pattern) 🔴 HIGH PRIORITY

**From Plan:** Every AI recommendation should explain its reasoning step-by-step

**Missing Services:**
- `reasoningEngine.ts` - Generate reasoning chains for recommendations

**Missing Types:**
- `reasoning.ts` - ReasoningStep, ReasoningChain interfaces

**Missing Components:**
- `ReasoningModeView.tsx` - Step-by-step reasoning display
- "Why?" links on recommendations

**Implementation Needed:**
```typescript
interface ReasoningChain {
  questionOrTrigger: string;
  steps: ReasoningStep[];
  conclusion: string;
  recommendation: string;
  confidence: number;
  alternativeConsiderations: string[];
}
```

---

### Gap 2: Continuous Auditor (Financial Auditor) 🔴 HIGH PRIORITY

**From Plan:** AI that continuously reviews all data for risks, missed value, compliance issues

**Missing Services:**
- `auditorService.ts` - Background audit runner
- `financialAuditorService.ts` - Invoice verification, overpayment detection

**Missing Types:**
- `auditor.ts` - AuditFinding, AuditCategory
- `financial-auditor.ts` - InvoiceVerification, OverpaymentFinding

**Missing Components:**
- `AuditorAlertPanel.tsx` - Audit findings display
- `InvoiceVerificationPanel.tsx` - Invoice vs budget comparison
- `SpendingAnalysisPanel.tsx` - Unnecessary spending detection
- `OverpaymentDetectorPanel.tsx` - Overpayment alerts
- `FinancialAuditDashboard.tsx` - Combined financial auditor view

**Key Functions Needed:**
```typescript
// Invoice verification
verifyInvoiceAgainstBudget(invoice, budgetData): InvoiceVerification
verifyInvoiceAgainstContract(invoice, contractId): InvoiceDiscrepancy[]

// Unnecessary spending
analyzeUnnecessarySpending(projectId): UnnecessarySpendAnalysis
detectRedundantServices(projectId): Finding[]

// Overpayment detection
analyzeOverpayments(projectId): OverpaymentAnalysis
compareToMarketRates(vendor, items): OverpaymentFinding[]
detectRateCreep(vendor, lookbackMonths): Finding[]
```

---

### Gap 3: Evidence Graph Structure 🟡 MEDIUM PRIORITY

**From Plan:** Formal graph linking jobs → evidence → compliance → payments

**Current State:** Evidence is stored flat (photos, documents, checklists in evidence pack)

**Missing Services:**
- `evidenceGraphService.ts` - Graph traversal, completeness validation

**Missing Types:**
- `evidence-graph.ts` - EvidenceNode, EvidenceEdge, EvidenceTrail

**Missing Components:**
- `EvidenceGraphExplorer.tsx` - Visual graph navigation
- `EvidenceTrailView.tsx` - Audit trail display

**Enhancement Needed:**
Transform flat evidence storage to graph-based:
```typescript
interface EvidenceNode {
  id: string;
  type: 'job' | 'photo' | 'test-result' | 'certificate' | 'invoice' | 'payment';
  linkedTo: EvidenceEdge[];
}

interface EvidenceEdge {
  relationship: 'requires' | 'produces' | 'validates' | 'pays-for';
  targetNode: string;
}
```

---

### Gap 4: Country Compliance Modules (UK & Germany) 🟡 MEDIUM PRIORITY

**Current State:** Only Netherlands (KvK, BTW, VCA, BHV, F-gassen)

**Missing for UK:**
- Gas Safe registration verification
- Part P electrical certification
- OFTEC oil certification
- F-Gas UK certification
- CSCS construction skills
- CP12 landlord certificate templates

**Missing for Germany:**
- Handwerksrolle (Crafts Register) verification
- HWK certificate tracking
- TÜV certification
- Meister qualification enforcement

**Missing Services:**
- `ukComplianceService.ts`
- `germanComplianceService.ts`
- `credentialVaultService.ts` - Country-agnostic with auto-gates

**Missing Components:**
- `AutoGateBlocker.tsx` - Block actions when credentials invalid
- `CredentialVerificationCard.tsx` - Registry verification UI
- Country-specific compliance templates (Gas Safe CP12, etc.)

---

### Gap 5: Procurement Optimisation Engine 🟡 MEDIUM PRIORITY

**Current State:** Supplier comparison and reliability tracking exist, but no mathematical optimisation

**Missing Services:**
- `procurementOptimisationService.ts` - MILP/CP-SAT solver integration
- `priceForecastingService.ts` - ML price/lead-time forecasting

**Missing Types:**
- `procurement-optimisation.ts` - ProcurementProblem, OptimisationResult

**Missing Components:**
- `PurchasePackBuilder.tsx` - Evidence-based procurement pack
- `OptimisationResultView.tsx` - Supplier allocation display

**Implementation Needed:**
```typescript
interface ProcurementProblem {
  demands: { itemId: string; quantity: number; requiredBy: string }[];
  supplierOffers: { supplierId: string; price: number; moq: number }[];
  constraints: { maxBudget?: number; preferredSuppliers?: string[] };
}

function optimizeProcurement(problem: ProcurementProblem): OptimisationResult
```

---

### Gap 6: Drill-Down Exploration 🟢 LOWER PRIORITY

**From Plan:** Click any metric to explore underlying data (Salient pattern)

**Missing Services:**
- `explorationService.ts` - Drill-down navigation

**Missing Components:**
- `MetricExplorer.tsx` - Interactive drill-down
- `ExplorableMetric.tsx` - Wrapper for any metric

---

### Gap 8: Decision Queue 🟢 LOWER PRIORITY

**From Plan:** Proactive decision surfacing by role

**Missing Services:**
- `decisionQueueService.ts` - Pending decisions by role

**Missing Components:**
- `DecisionQueuePanel.tsx` - Decision list with AI recommendations
- `DecisionCard.tsx` - Individual decision with options

---

### Gap 9: Learning Flywheel 🟢 LOWER PRIORITY

**Current State:** Some outcome recording exists (`recordJobOutcome` in capacity service)

**Missing Services:**
- `learningFlywheelService.ts` - Centralized feedback collection

**Enhancement Needed:**
- Connect job outcomes to quote estimation models
- Feed delivery outcomes to supplier reliability
- Use price outcomes to improve forecasts

---

## Optimisation Opportunities

### 1. Enhance Existing OCR/Document Intelligence

**Current:** `documentIntelligenceService.ts` extracts receipts, invoices, contracts

**Enhancement:** Add budget comparison layer
```typescript
// After extracting invoice, automatically compare to budget
async function processAndVerifyInvoice(document: File, projectId: string) {
  const extracted = await documentIntelligence.processDocument(document);
  const verification = await financialAuditor.verifyInvoice(extracted, projectId);
  return { extracted, verification };
}
```

### 2. Connect Supplier Reliability to Quote Builder

**Current:** Supplier reliability tracks performance separately from quoting

**Enhancement:** Show reliability in material selection
```typescript
// In SmartPurchasing component
const supplierReliability = useSupplierReliability(supplierId);
// Display reliability badge when selecting suppliers
```

### 3. Add "Why?" Links to Agent Actions

**Current:** Agent actions show what to do, not why

**Enhancement:** Add reasoning preview
```typescript
interface AgentAction {
  // ... existing fields
  reasoning?: {
    summary: string;
    keyFactors: string[];
    confidence: number;
  };
}
```

### 4. Unify Compliance Services

**Current:** Separate `complianceService.ts` and `dutchComplianceService.ts`

**Enhancement:** Create unified compliance interface
```typescript
interface ComplianceService {
  getCredentials(country: Country): Credential[];
  checkAutoGates(userId: string, action: string): GateResult;
  getCountryTemplates(country: Country): Template[];
}

class UnifiedComplianceService implements ComplianceService {
  private countryModules = {
    NL: dutchComplianceService,
    UK: ukComplianceService,  // To build
    DE: germanComplianceService,  // To build
  };
}
```

### 5. Add Fragility Alerts to Contractor Dashboard

**Current:** Fragility scoring exists but mainly used in COO dashboard

**Enhancement:** Show fragility warnings in contractor view when their jobs affect critical path

---

## Implementation Priority

### Phase 1: Financial Auditor (Most Value, Users Requested) 🔴
1. Create `financialAuditorService.ts`
2. Create `InvoiceVerificationPanel.tsx`
3. Integrate with existing document intelligence
4. Add to CFO dashboard

### Phase 2: Reasoning Engine (Differentiator) 🔴
1. Create `reasoningEngine.ts`
2. Add `reasoning` field to AgentAction
3. Create `ReasoningModeView.tsx`
4. Add "Why?" links throughout

### Phase 3: Country Compliance (Market Expansion) 🟡
1. Create `ukComplianceService.ts`
2. Create `germanComplianceService.ts`
3. Build auto-gate system
4. Add country templates

### Phase 4: Evidence Graph (Data Moat) 🟡
1. Refactor evidence storage to graph
2. Create graph traversal service
3. Build explorer UI

### Phase 5: Procurement Optimisation (Advanced) 🟢
1. Integrate OR-Tools or similar
2. Build optimisation service
3. Create purchase pack builder

---

## Files Summary

### Already Exists (No Action Needed)
- 41 services covering most functionality
- 15 type files with comprehensive types
- 110+ components including all dashboards
- Full contractor workflow (quote→job→invoice→payment)
- Supplier reliability with drift detection
- Schedule fragility with what-if analysis
- Evidence pack and handover system
- Dutch compliance (KvK, BTW, certifications)

### Needs Creation (New Files)
| File | Priority | Est. Size |
|------|----------|-----------|
| `src/services/financialAuditorService.ts` | P0 | ~500 lines |
| `src/services/reasoningEngine.ts` | P0 | ~300 lines |
| `src/services/auditorService.ts` | P0 | ~400 lines |
| `src/types/reasoning.ts` | P0 | ~100 lines |
| `src/types/financial-auditor.ts` | P0 | ~150 lines |
| `src/components/financial-auditor/InvoiceVerificationPanel.tsx` | P0 | ~400 lines |
| `src/components/shared/ReasoningModeView.tsx` | P0 | ~200 lines |
| `src/services/ukComplianceService.ts` | P1 | ~400 lines |
| `src/services/germanComplianceService.ts` | P1 | ~400 lines |
| `src/services/credentialVaultService.ts` | P1 | ~350 lines |
| `src/services/evidenceGraphService.ts` | P1 | ~300 lines |
| `src/services/procurementOptimisationService.ts` | P2 | ~500 lines |

### Needs Enhancement (Modify Existing)
| File | Change | Priority |
|------|--------|----------|
| `src/types/agent-actions.ts` | Add `reasoning` field | P0 |
| `src/modules/agentActions.ts` | Generate reasoning with actions | P0 |
| `src/components/dashboards/CFODashboard.tsx` | Add Financial Auditor tab | P0 |
| `src/services/documentIntelligenceService.ts` | Connect to financial auditor | P0 |
| `src/components/contractor/SmartPurchasing.tsx` | Add reliability badges | P1 |
| `src/services/complianceService.ts` | Unify with country modules | P1 |

---

## Conclusion

Vasco has an **impressive foundation** with most core functionality built. The main gaps are:

1. **AI Explainability** - Reasoning engine for "Why?" explanations
2. **Financial Auditing** - Invoice verification and overpayment detection
3. **Country Expansion** - UK and Germany compliance modules
4. **Data Structure** - Evidence graph vs flat storage
5. **Advanced Optimisation** - MILP/CP-SAT for procurement

The recommended approach is to build the Financial Auditor and Reasoning Engine first (high user value), then expand country compliance for market growth, and finally add advanced optimisation features.

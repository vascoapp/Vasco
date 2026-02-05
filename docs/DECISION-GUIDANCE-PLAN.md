# Vasco Decision Guidance System Plan
## Incorporating Learnings from Eve Legal AI & Salient AI

**Goal:** Transform Vasco from a tool that assists users into a proactive AI workforce that guides decisions based on data across all user roles (Contractor, Site Lead, COO, CFO, Director).

---

## Executive Summary

### Key Learnings from Eve Legal AI
1. **Proactive AI Workforce Model** - Three distinct AI roles (Agents, Auditor, Analyst) working continuously
2. **Reasoning Mode** - Step-by-step explanation of analysis and decision rationale
3. **Human-AI Collaboration** - AI handles execution, humans handle strategy and approval
4. **Continuous Background Processing** - AI advances work automatically as new information arrives
5. **Risk & Value Surfacing** - Auditor continuously identifies missed issues, deadline risks, overlooked value

### Key Learnings from Salient AI
1. **Industry-Tailored Analytics** - Pre-built best practices customized by sector (CRE/Construction)
2. **Drill-Down Exploration** - Ability to explore data behind any summary metric
3. **Predictive Forecasting** - ML-powered predictions across multiple dimensions
4. **At-Risk Detection** - Proactive identification of at-risk situations
5. **Opportunity Surfacing** - Identifying improvement and value opportunities

### Current Vasco Intelligence State
Vasco already has strong foundations:
- `intelligenceEngine.ts` - 6 AI models, 15 recommendation types
- `agentActionsService.ts` - 28 action types with approval workflows
- `workflowAgentsService.ts` - Agentic workflow automation
- `decisionIntelligence.ts` - Customer decision tracking
- `analyticsService.ts` - Business analytics and benchmarking

### Gap Analysis
| Capability | Eve/Salient | Vasco Current | Gap |
|------------|-------------|---------------|-----|
| Proactive AI Workforce | 3-role model | Action-based | Missing role separation |
| Reasoning Mode | Step-by-step | None | Full implementation needed |
| Continuous Auditing | Always-on | Event-triggered | Need background auditor |
| Portfolio-Level Analyst | Cross-portfolio | Per-project | Need firm-wide patterns |
| Drill-Down Exploration | Interactive | Static reports | Need exploration UI |
| Decision Explanations | Full rationale | Minimal | Need explanation engine |

---

## Financial Auditor Overview

**The Auditor role has a dedicated Financial Auditor function** that acts as a continuous financial watchdog, ensuring every pound spent is justified, correctly priced, and matches approved budgets.

### Three Core Financial Auditor Functions

| Function | What It Does | How It Helps |
|----------|--------------|--------------|
| **1. Invoice Verification** | Automatically compares every invoice against budget spreadsheets, contracts, and purchase orders | Catches billing errors, unapproved charges, quantity/rate mismatches before payment |
| **2. Unnecessary Spending Detection** | Analyzes spending patterns to find waste | Identifies redundant services, over-specification, scope creep, early procurement |
| **3. Overpayment Detection** | Compares what you're paying vs what you should pay | Flags rates above market, above contract, rate creep over time, missed discounts |

### Financial Auditor Checks

```
INVOICE VERIFICATION
├── Does quantity match budget/PO?
├── Does rate match contract/budget?
├── Is every line item in approved scope?
├── Has this been billed before (duplicate)?
└── Does the math add up correctly?

UNNECESSARY SPENDING
├── Are we paying multiple vendors for the same thing?
├── Are we using premium materials where standard works?
├── Are we buying items not in original scope?
└── Are we procuring too early (cash flow impact)?

OVERPAYMENT DETECTION
├── Are we paying above market rates?
├── Are we paying above contracted rates?
├── Have vendor rates crept up without justification?
└── Are we missing volume/early payment discounts?
```

### Example Financial Audit Findings

| Finding | Impact | Action |
|---------|--------|--------|
| "Invoice INV-2024-892 charges £45/unit for steel brackets, but contract rate is £38/unit" | £2,100 overpayment | Request credit note |
| "Paying both ABC Security and XYZ Security for overlapping guard services" | £15,000/year waste | Consolidate to one vendor |
| "MechServ rates have increased 18% over 12 months vs 3% inflation" | £8,400 overpayment | Renegotiate or find alternative |
| "Premium acoustic ceiling tiles specified for back-of-house storage (standard would suffice)" | £4,500 unnecessary | Substitute if not installed |

---

## Architecture: Vasco AI Workforce

### The Three AI Roles (Eve Pattern)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        VASCO AI WORKFORCE                           │
├─────────────────┬─────────────────────┬─────────────────────────────┤
│     AGENTS      │      AUDITOR        │         ANALYST             │
│   "Executors"   │   "Safety Net"      │    "Strategic Advisor"      │
├─────────────────┼─────────────────────┼─────────────────────────────┤
│ Auto-advance    │ Continuous review   │ Portfolio-level patterns    │
│ work as data    │ of all data for     │ and strategic insights      │
│ arrives         │ risks & missed      │ across entire business      │
│                 │ opportunities       │                             │
├─────────────────┼─────────────────────┼─────────────────────────────┤
│ Queue actions   │ Surface alerts &    │ Answer strategic questions  │
│ for human       │ warnings before     │ with evidence-based         │
│ approval        │ they become         │ recommendations             │
│                 │ problems            │                             │
└─────────────────┴─────────────────────┴─────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  HUMAN CONTROL  │
                    │ Review, Approve │
                    │ Steer Strategy  │
                    └─────────────────┘
```

---

## Implementation Plan

### Phase 1: Reasoning Mode & Decision Explanations (P0)

**Goal:** Every AI recommendation explains its reasoning step-by-step

#### 1.1 Create Reasoning Engine Service
**File:** `src/services/reasoningEngine.ts`

```typescript
interface ReasoningStep {
  id: string;
  stepNumber: number;
  title: string;                    // "Analyzing cost trends"
  description: string;              // What this step examines
  dataPoints: DataPoint[];          // Evidence used
  finding: string;                  // What was found
  confidence: number;               // 0-100
  impact: 'positive' | 'negative' | 'neutral';
}

interface ReasoningChain {
  id: string;
  questionOrTrigger: string;        // "Should we approve this payment?"
  context: ReasoningContext;
  steps: ReasoningStep[];
  conclusion: string;
  recommendation: string;
  confidence: number;
  alternativeConsiderations: string[];
  humanCheckpoints: string[];       // Where human judgment is needed
}

// Functions
generateReasoningChain(question: string, context: any): ReasoningChain
explainRecommendation(recommendation: Recommendation): ReasoningChain
explainAction(action: AgentAction): ReasoningChain
getDataPointsForStep(step: ReasoningStep): DataPoint[]
```

#### 1.2 Create Reasoning Mode UI Component
**File:** `src/components/shared/ReasoningModeView.tsx`

Features:
- Expandable step-by-step reasoning display
- Data point drill-down (click to see source data)
- Confidence indicators per step
- "Why?" links on any recommendation
- Alternative considerations section
- Human checkpoint highlights

#### 1.3 Integrate with Existing Systems
- Add `reasoningChain` field to `AgentAction` type
- Add `explanation` field to `Recommendation` type
- Update `ApprovalQueueDashboard` to show reasoning
- Update `AgentActionsPanel` to show "Why?" links

---

### Phase 2: Continuous Auditor Service (P0)

**Goal:** AI that continuously reviews all data for risks, missed value, and compliance issues. **The Auditor also acts as a Financial Auditor** — verifying invoices against budgets/calculations, detecting unnecessary spending, and identifying overpayments.

#### 2.1 Create Auditor Service
**File:** `src/services/auditorService.ts`

```typescript
interface AuditCategory {
  id: string;
  name: string;
  description: string;
  checkFrequency: 'realtime' | 'hourly' | 'daily' | 'weekly';
  severity: 'critical' | 'high' | 'medium' | 'low';
}

interface AuditFinding {
  id: string;
  category: AuditCategory;
  title: string;
  description: string;
  evidence: DataPoint[];
  impact: {
    financial?: number;
    schedule?: number;        // days
    risk?: number;           // score
    compliance?: string;
  };
  suggestedAction: AgentAction | null;
  reasoning: ReasoningChain;
  createdAt: string;
  status: 'new' | 'acknowledged' | 'resolved' | 'dismissed';
  dismissedReason?: string;
}

// ============================================
// FINANCIAL AUDITOR TYPES
// ============================================

interface FinancialAuditFinding extends AuditFinding {
  auditType: 'invoice-mismatch' | 'unnecessary-spend' | 'overpayment' | 'duplicate-charge' | 'budget-variance';
  financialDetails: {
    invoiceId?: string;
    invoiceAmount?: number;
    expectedAmount?: number;
    variance?: number;
    variancePercent?: number;
    marketRate?: number;
    contractRate?: number;
    budgetLineItem?: string;
    excelReference?: string;        // Cell reference in budget spreadsheet
    comparisonSource?: 'budget' | 'contract' | 'market-rate' | 'historical-avg';
  };
}

interface InvoiceVerification {
  invoiceId: string;
  invoiceNumber: string;
  vendor: string;
  invoiceAmount: number;
  invoiceDate: string;
  lineItems: InvoiceLineItem[];
  verificationResult: {
    status: 'matched' | 'discrepancy' | 'missing-reference' | 'pending-review';
    matchedTo: 'budget' | 'contract' | 'purchase-order' | 'estimate';
    expectedAmount: number;
    variance: number;
    variancePercent: number;
    discrepancies: InvoiceDiscrepancy[];
  };
}

interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  budgetCategory?: string;
  costCode?: string;
}

interface InvoiceDiscrepancy {
  type: 'quantity-mismatch' | 'rate-mismatch' | 'unapproved-item' | 'duplicate-charge' | 'missing-approval' | 'exceeds-budget';
  description: string;
  invoicedValue: number;
  expectedValue: number;
  variance: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  recommendation: string;
}

interface UnnecessarySpendAnalysis {
  projectId: string;
  analysisDate: string;
  findings: UnnecessarySpendFinding[];
  totalPotentialSavings: number;
  prioritizedActions: SavingsAction[];
}

interface UnnecessarySpendFinding {
  id: string;
  type: 'redundant-service' | 'over-specification' | 'unused-subscription' | 'early-procurement' | 'scope-creep' | 'premium-when-standard-sufficient';
  description: string;
  currentSpend: number;
  necessarySpend: number;
  savingsPotential: number;
  evidence: DataPoint[];
  reasoning: ReasoningChain;
  confidence: number;
  actionRequired: string;
}

interface OverpaymentAnalysis {
  projectId: string;
  analysisDate: string;
  findings: OverpaymentFinding[];
  totalOverpaymentAmount: number;
  recoveryActions: RecoveryAction[];
}

interface OverpaymentFinding {
  id: string;
  type: 'above-market-rate' | 'above-contract-rate' | 'above-historical-avg' | 'no-volume-discount' | 'missed-early-payment-discount' | 'rate-creep';
  vendor: string;
  itemOrService: string;
  paidRate: number;
  benchmarkRate: number;
  benchmarkSource: 'market-data' | 'contract' | 'historical' | 'competitor-quote';
  overpaymentAmount: number;
  overpaymentPercent: number;
  invoicesAffected: string[];
  evidence: DataPoint[];
  reasoning: ReasoningChain;
  isRecoverable: boolean;
  recoveryAction?: string;
}

interface SavingsAction {
  id: string;
  title: string;
  savingsAmount: number;
  effort: 'low' | 'medium' | 'high';
  timeline: 'immediate' | 'this-month' | 'this-quarter';
  actionSteps: string[];
}

interface RecoveryAction {
  id: string;
  vendorId: string;
  amount: number;
  basis: string;  // Why we can recover (contract terms, billing error, etc.)
  suggestedApproach: 'credit-note-request' | 'rate-renegotiation' | 'contract-dispute' | 'future-offset';
  templateMessage?: string;
}

// Audit Categories by Role
const AUDIT_CATEGORIES = {
  contractor: [
    'payment-overdue',           // Customer hasn't paid
    'quote-stale',               // Quote sent but no response
    'margin-erosion',            // Job costs exceeding estimate
    'compliance-expiring',       // Certifications/insurance expiring
    'customer-churn-risk',       // Customer engagement dropping
    'missed-upsell',             // Opportunities not captured
    'pricing-below-market',      // Charging below competitors
    // Financial Auditor for Contractors
    'invoice-vs-estimate',       // Check if actuals match quoted amounts
    'supplier-rate-creep',       // Supplier prices increasing beyond agreed
  ],
  siteLead: [
    'safety-trend-negative',     // LTIR trending up
    'quality-defect-spike',      // Defects increasing
    'schedule-slip-risk',        // Activities at risk of delay
    'resource-conflict',         // Double-booked resources
    'inspection-overdue',        // Missed inspection dates
    'rfi-aging',                 // RFIs not responded to
  ],
  coo: [
    'critical-path-risk',        // Activities threatening completion
    'permit-deadline-risk',      // Permit conditions at risk
    'procurement-bottleneck',    // Contracts needed but not awarded
    'supplier-reliability-drift', // Supplier performance declining
    'change-order-backlog',      // Unprocessed change orders
    'handover-blocking-payment', // Handovers incomplete
    // Financial Auditor for COO
    'procurement-overpayment',   // Paying more than contract rates
    'unnecessary-procurement',   // Procuring items not in scope
  ],
  cfo: [
    'cost-overrun-trajectory',   // EAC exceeding budget
    'cashflow-gap-risk',         // Upcoming cash shortfall
    'retention-release-risk',    // Retentions not being released
    'draw-request-delay',        // Draw requests aging
    'invoice-disputes',          // Disputed invoices accumulating
    'contingency-burn-rate',     // Contingency depleting too fast
    // ========== FINANCIAL AUDITOR CATEGORIES ==========
    'invoice-budget-mismatch',   // Invoice doesn't match budget/Excel calculations
    'invoice-contract-mismatch', // Invoice doesn't match contract rates
    'duplicate-invoice',         // Same charge submitted twice
    'unapproved-line-items',     // Items not in approved scope
    'unnecessary-spending',      // Spending on non-essential items
    'overpayment-detection',     // Paying above market/contract rates
    'missing-volume-discounts',  // Not getting agreed bulk discounts
    'early-payment-missed',      // Missed early payment discount opportunities
    'rate-creep-detection',      // Gradual rate increases over time
    'budget-line-variance',      // Actual vs budget by cost code
  ],
  director: [
    'portfolio-concentration',   // Too much risk in one project
    'irr-erosion',              // Returns declining
    'team-bottleneck',          // Key person dependencies
    'market-shift',             // Market conditions changing
    'regulatory-change',        // New regulations affecting portfolio
    // Financial Auditor for Director
    'portfolio-cost-leakage',    // Systemic overspending patterns
    'vendor-consolidation-opportunity', // Same service from multiple vendors
  ],
};

// Standard Audit Functions
runAudit(category: AuditCategory, context: any): AuditFinding[]
runFullAudit(role: UserRole): AuditFinding[]
subscribeToAuditFindings(role: UserRole, callback): Unsubscribe
getAuditHistory(filters: AuditFilters): AuditFinding[]
dismissFinding(findingId: string, reason: string): void
resolveFinding(findingId: string): void

// ============================================
// FINANCIAL AUDITOR FUNCTIONS
// ============================================

// Invoice Verification (matches invoices to budget/Excel/contracts)
verifyInvoice(invoiceId: string, projectId: string): InvoiceVerification
verifyInvoiceAgainstBudget(invoice: Invoice, budgetData: BudgetData): InvoiceDiscrepancy[]
verifyInvoiceAgainstContract(invoice: Invoice, contractId: string): InvoiceDiscrepancy[]
verifyInvoiceAgainstPO(invoice: Invoice, poId: string): InvoiceDiscrepancy[]
batchVerifyInvoices(invoiceIds: string[]): InvoiceVerification[]
getInvoiceVerificationHistory(projectId: string): InvoiceVerification[]
flagInvoiceForReview(invoiceId: string, reason: string): void

// Unnecessary Spending Detection
analyzeUnnecessarySpending(projectId: string): UnnecessarySpendAnalysis
detectRedundantServices(projectId: string): UnnecessarySpendFinding[]
detectOverSpecification(projectId: string): UnnecessarySpendFinding[]  // Premium materials when standard would suffice
detectScopeCreepSpending(projectId: string): UnnecessarySpendFinding[]
detectEarlyProcurement(projectId: string): UnnecessarySpendFinding[]   // Buying too early (cash flow impact)
getSavingsOpportunities(projectId: string): SavingsAction[]

// Overpayment Detection
analyzeOverpayments(projectId: string): OverpaymentAnalysis
compareToMarketRates(vendor: string, items: string[]): OverpaymentFinding[]
compareToContractRates(invoices: Invoice[], contractId: string): OverpaymentFinding[]
compareToHistoricalRates(vendor: string, items: string[], lookbackMonths: number): OverpaymentFinding[]
detectRateCreep(vendor: string, lookbackMonths: number): OverpaymentFinding[]
detectMissedDiscounts(projectId: string): OverpaymentFinding[]
generateRecoveryPlan(findings: OverpaymentFinding[]): RecoveryAction[]

// Budget vs Actual Analysis
compareBudgetToActual(projectId: string, costCode?: string): BudgetVarianceReport
importBudgetFromExcel(filePath: string, projectId: string): BudgetData
reconcileWithExcel(projectId: string, excelFilePath: string): ReconciliationReport
detectBudgetLineAnomalies(projectId: string): FinancialAuditFinding[]

// React Hooks
useAuditFindings(role: UserRole): { findings, loading, refresh }
useAuditStats(role: UserRole): { criticalCount, highCount, ... }
useFinancialAuditFindings(projectId: string): { findings, totalVariance, loading }
useInvoiceVerification(invoiceId: string): { verification, loading }
useUnnecessarySpendAnalysis(projectId: string): { analysis, totalSavings, loading }
useOverpaymentAnalysis(projectId: string): { analysis, totalOverpaid, loading }
useBudgetReconciliation(projectId: string): { variances, status, loading }
```

#### 2.2 Create Financial Auditor Service (Separate for Clarity)
**File:** `src/services/financialAuditorService.ts`

```typescript
// Core Financial Auditor Implementation
// This service specifically handles the financial auditing functions

import { Invoice, BudgetData, Contract } from '@/types';

export class FinancialAuditorService {

  // ========================================
  // INVOICE-TO-BUDGET VERIFICATION
  // ========================================

  /**
   * Verifies an invoice against budget/Excel calculations
   * - Checks if line item quantities match budget allocations
   * - Checks if rates match contracted/budgeted rates
   * - Flags unapproved items not in scope
   * - Detects calculation errors
   */
  async verifyInvoiceAgainstBudget(
    invoice: Invoice,
    budgetData: BudgetData
  ): Promise<InvoiceVerification> {
    const discrepancies: InvoiceDiscrepancy[] = [];

    for (const lineItem of invoice.lineItems) {
      // Find matching budget line
      const budgetLine = budgetData.lineItems.find(
        b => b.costCode === lineItem.costCode || b.description === lineItem.description
      );

      if (!budgetLine) {
        discrepancies.push({
          type: 'unapproved-item',
          description: `Line item "${lineItem.description}" not found in approved budget`,
          invoicedValue: lineItem.total,
          expectedValue: 0,
          variance: lineItem.total,
          severity: 'high',
          recommendation: 'Request approval or reject line item'
        });
        continue;
      }

      // Check quantity
      if (lineItem.quantity > budgetLine.quantity) {
        discrepancies.push({
          type: 'quantity-mismatch',
          description: `Quantity for "${lineItem.description}" exceeds budget`,
          invoicedValue: lineItem.quantity,
          expectedValue: budgetLine.quantity,
          variance: lineItem.quantity - budgetLine.quantity,
          severity: this.calculateSeverity(lineItem.total, budgetLine.total),
          recommendation: `Verify if extra ${lineItem.quantity - budgetLine.quantity} units were approved via change order`
        });
      }

      // Check rate
      const rateVariance = ((lineItem.unitPrice - budgetLine.unitRate) / budgetLine.unitRate) * 100;
      if (Math.abs(rateVariance) > 5) {  // 5% tolerance
        discrepancies.push({
          type: 'rate-mismatch',
          description: `Rate for "${lineItem.description}" differs from budget by ${rateVariance.toFixed(1)}%`,
          invoicedValue: lineItem.unitPrice,
          expectedValue: budgetLine.unitRate,
          variance: lineItem.unitPrice - budgetLine.unitRate,
          severity: rateVariance > 15 ? 'high' : 'medium',
          recommendation: rateVariance > 0
            ? 'Request credit note or justification for rate increase'
            : 'Note: Rate is below budget (favorable variance)'
        });
      }
    }

    // Check for duplicate charges
    const duplicates = this.detectDuplicateCharges(invoice);
    discrepancies.push(...duplicates);

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      vendor: invoice.vendor,
      invoiceAmount: invoice.total,
      invoiceDate: invoice.date,
      lineItems: invoice.lineItems,
      verificationResult: {
        status: discrepancies.length === 0 ? 'matched' : 'discrepancy',
        matchedTo: 'budget',
        expectedAmount: this.calculateExpectedAmount(invoice, budgetData),
        variance: invoice.total - this.calculateExpectedAmount(invoice, budgetData),
        variancePercent: ((invoice.total - this.calculateExpectedAmount(invoice, budgetData)) / this.calculateExpectedAmount(invoice, budgetData)) * 100,
        discrepancies
      }
    };
  }

  // ========================================
  // UNNECESSARY SPENDING DETECTION
  // ========================================

  /**
   * Analyzes project spending for unnecessary costs:
   * - Redundant services (multiple vendors for same thing)
   * - Over-specification (premium when standard suffices)
   * - Scope creep (items not in original scope)
   * - Early procurement (buying before needed, tying up cash)
   */
  async analyzeUnnecessarySpending(projectId: string): Promise<UnnecessarySpendAnalysis> {
    const findings: UnnecessarySpendFinding[] = [];

    // Check for redundant services
    findings.push(...await this.detectRedundantServices(projectId));

    // Check for over-specification
    findings.push(...await this.detectOverSpecification(projectId));

    // Check for scope creep
    findings.push(...await this.detectScopeCreepSpending(projectId));

    // Check for early procurement
    findings.push(...await this.detectEarlyProcurement(projectId));

    // Calculate total savings potential
    const totalPotentialSavings = findings.reduce(
      (sum, f) => sum + f.savingsPotential, 0
    );

    // Generate prioritized actions
    const prioritizedActions = this.generateSavingsActions(findings);

    return {
      projectId,
      analysisDate: new Date().toISOString(),
      findings,
      totalPotentialSavings,
      prioritizedActions
    };
  }

  async detectRedundantServices(projectId: string): Promise<UnnecessarySpendFinding[]> {
    // Identifies when paying multiple vendors for overlapping services
    // e.g., two different security companies, overlapping consulting scopes
  }

  async detectOverSpecification(projectId: string): Promise<UnnecessarySpendFinding[]> {
    // Identifies premium materials/services when standard would work
    // e.g., Grade A finishes in back-of-house areas
  }

  // ========================================
  // OVERPAYMENT DETECTION
  // ========================================

  /**
   * Detects if paying above fair rates:
   * - Compare to market rates (external benchmarks)
   * - Compare to contract rates (what was agreed)
   * - Compare to historical rates (what we paid before)
   * - Detect rate creep (gradual increases)
   * - Find missed discounts
   */
  async analyzeOverpayments(projectId: string): Promise<OverpaymentAnalysis> {
    const findings: OverpaymentFinding[] = [];

    // Compare to market rates
    findings.push(...await this.compareToMarketRates(projectId));

    // Compare to contract rates
    findings.push(...await this.compareToContractRates(projectId));

    // Compare to historical rates
    findings.push(...await this.detectRateCreep(projectId));

    // Check for missed discounts
    findings.push(...await this.detectMissedDiscounts(projectId));

    const totalOverpaymentAmount = findings.reduce(
      (sum, f) => sum + f.overpaymentAmount, 0
    );

    const recoveryActions = this.generateRecoveryPlan(findings);

    return {
      projectId,
      analysisDate: new Date().toISOString(),
      findings,
      totalOverpaymentAmount,
      recoveryActions
    };
  }

  async compareToMarketRates(projectId: string): Promise<OverpaymentFinding[]> {
    // Uses market rate database to compare what we're paying vs market
    // Sources: RSMeans, industry benchmarks, recent competitor quotes
  }

  async compareToContractRates(projectId: string): Promise<OverpaymentFinding[]> {
    // Compares invoiced rates to contracted rates
    // Flags any invoice charging more than contract stipulates
  }

  async detectRateCreep(projectId: string): Promise<OverpaymentFinding[]> {
    // Analyzes rate trends over time
    // Flags vendors whose rates have crept up without justification
  }

  async detectMissedDiscounts(projectId: string): Promise<OverpaymentFinding[]> {
    // Checks for:
    // - Volume discounts not applied
    // - Early payment discounts not taken
    // - Loyalty discounts not applied
  }
}
```

#### 2.3 Create Auditor UI Components
**File:** `src/components/shared/AuditorAlertPanel.tsx`

Features:
- Persistent alert bar showing critical findings count
- Expandable panel with categorized findings
- One-tap actions to address findings
- "Why is this flagged?" with reasoning chain
- Dismiss with reason tracking
- Audit history view

#### 2.4 Create Financial Auditor UI Components

**File:** `src/components/financial-auditor/InvoiceVerificationPanel.tsx`

Features:
- Invoice list with verification status badges (✓ Matched, ⚠ Discrepancy, ? Pending)
- Side-by-side comparison: Invoice vs Budget/Contract/PO
- Line-by-line variance highlighting (red for over, green for under)
- Excel cell reference linking (click to see budget source)
- One-tap actions: Approve, Request Credit, Flag for Review, Reject
- Bulk verification for multiple invoices
- Export discrepancy report

**File:** `src/components/financial-auditor/SpendingAnalysisPanel.tsx`

Features:
- Unnecessary spending dashboard with total savings potential
- Category breakdown: Redundant, Over-spec, Scope Creep, Early Procurement
- Finding cards with evidence and recommended actions
- "Take Action" workflow for each finding
- Savings tracker (identified vs captured)
- Comparison to similar projects

**File:** `src/components/financial-auditor/OverpaymentDetectorPanel.tsx`

Features:
- Overpayment summary with total overpaid amount
- Vendor rate comparison table (Our Rate vs Market vs Contract vs Historical)
- Rate trend charts showing rate creep over time
- Missed discount calculator
- Recovery action queue
- Vendor negotiation templates
- Export report for vendor discussions

**File:** `src/components/financial-auditor/BudgetReconciliationView.tsx`

Features:
- Budget vs Actual comparison grid
- Variance visualization by cost code
- Excel import/sync status
- Drill-down to individual transactions
- Forecast to completion based on current trends
- Alert thresholds for variance limits

**File:** `src/components/financial-auditor/FinancialAuditDashboard.tsx`

Main financial auditor dashboard combining all functions:
```
┌────────────────────────────────────────────────────────────────────┐
│ FINANCIAL AUDITOR                                                   │
├──────────────────┬─────────────────┬───────────────────────────────┤
│ 🔴 5 Invoice     │ 💰 £45,200      │ 💸 £12,800                    │
│   Discrepancies  │ Unnecessary     │ Overpaid                      │
│                  │ Spending        │                               │
├──────────────────┴─────────────────┴───────────────────────────────┤
│                                                                     │
│ INVOICE VERIFICATION QUEUE                                         │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ INV-2024-0892 | BuildCo Ltd | £23,450 | ⚠ 3 discrepancies     ││
│ │ INV-2024-0891 | MechServ    | £8,200  | ⚠ Rate 12% over budget ││
│ │ INV-2024-0890 | ElecPro     | £15,600 | ✓ Matched               ││
│ └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│ TOP SAVINGS OPPORTUNITIES                                          │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ 1. Consolidate security vendors     | Save £15,000/yr | [Act]  ││
│ │ 2. Renegotiate steel rates          | Save £8,200     | [Act]  ││
│ │ │ 3. Switch to standard grade paint   | Save £4,500     | [Act]  ││
│ └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│ OVERPAYMENT ALERTS                                                 │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ SupplierX: Charging £45/unit vs contract rate £38 (18% over)   ││
│ │ VendorY: Rate increased 15% over 6 months without notice       ││
│ └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│ [Full Invoice Audit] [Spending Analysis] [Overpayment Report]      │
└────────────────────────────────────────────────────────────────────┘
```

#### 2.5 Background Audit Runner
**File:** `src/services/auditRunner.ts`

- Scheduled audit runs based on category frequency
- Event-triggered audits (new data triggers relevant checks)
- Batched processing to avoid performance impact
- Notification system for critical findings

---

### Phase 3: Portfolio Analyst Service (P1)

**Goal:** AI that analyzes patterns across the entire business/portfolio and answers strategic questions

#### 3.1 Create Analyst Service
**File:** `src/services/analystService.ts`

```typescript
interface StrategicQuestion {
  id: string;
  question: string;
  category: 'performance' | 'risk' | 'opportunity' | 'comparison' | 'forecast';
  scope: 'project' | 'portfolio' | 'market';
}

interface AnalystInsight {
  id: string;
  type: 'pattern' | 'anomaly' | 'trend' | 'comparison' | 'forecast' | 'recommendation';
  title: string;
  summary: string;
  details: string;
  evidence: DataPoint[];
  reasoning: ReasoningChain;
  confidence: number;
  actionability: 'immediate' | 'short-term' | 'long-term' | 'informational';
  suggestedActions: AgentAction[];
  relatedInsights: string[];
}

interface AnalystReport {
  id: string;
  title: string;
  executiveSummary: string;
  insights: AnalystInsight[];
  recommendations: string[];
  dataSnapshot: any;
  generatedAt: string;
}

// Pre-built Strategic Questions by Role
const STRATEGIC_QUESTIONS = {
  contractor: [
    "Which customer segments are most profitable?",
    "What's causing quote conversion to drop?",
    "Which services should I price higher?",
    "Where am I losing money on jobs?",
    "Which customers are at risk of churning?",
  ],
  siteLead: [
    "Which activities are most likely to slip?",
    "What's driving the defect rate increase?",
    "Where are we over/under-resourced?",
    "Which subcontractors need attention?",
  ],
  coo: [
    "Which projects are most at risk?",
    "Where are the procurement bottlenecks?",
    "What's causing schedule slippage across portfolio?",
    "Which suppliers should we reconsider?",
  ],
  cfo: [
    "Where is cash flow tightest this quarter?",
    "Which projects have the best/worst margins?",
    "What's driving cost overruns?",
    "How does our performance compare to appraisal?",
  ],
  director: [
    "How is portfolio IRR trending vs plan?",
    "Where should we focus improvement efforts?",
    "What patterns predict project success/failure?",
    "How does team performance vary across projects?",
  ],
};

// Functions
askQuestion(question: string, context: any): AnalystInsight[]
getProactiveInsights(role: UserRole): AnalystInsight[]
generateReport(reportType: string, filters: any): AnalystReport
compareEntities(entityType: string, ids: string[]): AnalystInsight[]
forecastMetric(metric: string, horizon: number): AnalystInsight

// React Hooks
useAnalystInsights(role: UserRole): { insights, loading }
useStrategicQuestion(question: string): { answer, reasoning, loading }
```

#### 3.2 Create Analyst UI Components
**File:** `src/components/shared/AnalystPanel.tsx`

Features:
- Natural language question input
- Pre-built strategic questions by role
- Interactive insight cards with drill-down
- Comparison views (project vs project, period vs period)
- Trend visualizations with explanations
- "Ask follow-up" capability

**File:** `src/components/shared/InsightCard.tsx`

Features:
- Insight type indicator (pattern, anomaly, trend, etc.)
- Confidence and actionability badges
- One-tap suggested actions
- "Explain this insight" with reasoning
- Related insights links
- Share/export capability

---

### Phase 4: Drill-Down Exploration Engine (P1)

**Goal:** Every metric can be explored to understand the data behind it (Salient pattern)

#### 4.1 Create Exploration Service
**File:** `src/services/explorationService.ts`

```typescript
interface DrillDownPath {
  metric: string;
  currentValue: any;
  dimensions: DrillDownDimension[];
  filters: DrillDownFilter[];
  depth: number;
}

interface DrillDownDimension {
  name: string;
  type: 'time' | 'category' | 'entity' | 'location' | 'custom';
  values: { value: any; count: number; contribution: number }[];
}

interface ExplorationResult {
  path: DrillDownPath;
  data: any[];
  aggregations: Record<string, any>;
  nextDimensions: string[];    // What can be drilled into next
  insights: string[];          // Auto-generated observations
  anomalies: string[];         // Unusual patterns detected
}

// Functions
startExploration(metric: string, value: any): ExplorationResult
drillDown(current: DrillDownPath, dimension: string, value: any): ExplorationResult
drillUp(current: DrillDownPath): ExplorationResult
addFilter(current: DrillDownPath, filter: DrillDownFilter): ExplorationResult
getAvailableDimensions(metric: string): DrillDownDimension[]
exportExploration(path: DrillDownPath, format: 'csv' | 'pdf'): Blob

// React Hooks
useExploration(metric: string): {
  result,
  drillDown,
  drillUp,
  addFilter,
  reset
}
```

#### 4.2 Create Exploration UI Components
**File:** `src/components/shared/MetricExplorer.tsx`

Features:
- Click any metric to explore
- Breadcrumb navigation showing drill-down path
- Dimension selector (time, category, entity, etc.)
- Filter builder with AND/OR logic
- Auto-generated insights at each level
- Visualization adapts to data type
- "What's unusual here?" auto-analysis
- Export current view

**File:** `src/components/shared/ExplorableMetric.tsx`

A wrapper component that makes any metric explorable:
```tsx
<ExplorableMetric
  metric="revenue"
  value={125000}
  label="This Month"
  explorable={true}
/>
```

---

### Phase 5: Proactive Decision Queue (P1)

**Goal:** AI proactively surfaces decisions that need attention, not just actions

#### 5.1 Create Decision Queue Service
**File:** `src/services/decisionQueueService.ts`

```typescript
interface PendingDecision {
  id: string;
  type: 'approval' | 'choice' | 'prioritization' | 'resource-allocation' | 'strategic';
  title: string;
  description: string;
  urgency: 'immediate' | 'today' | 'this-week' | 'when-convenient';
  impact: 'critical' | 'high' | 'medium' | 'low';
  options: DecisionOption[];
  recommendation: DecisionOption | null;
  reasoning: ReasoningChain;
  deadline?: string;
  blockedBy?: string[];          // What's waiting on this decision
  relatedDecisions?: string[];
  context: DecisionContext;
}

interface DecisionOption {
  id: string;
  label: string;
  description: string;
  pros: string[];
  cons: string[];
  predictedOutcome: string;
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
}

interface DecisionContext {
  dataPoints: DataPoint[];
  historicalOutcomes: HistoricalOutcome[];  // What happened when similar decisions were made
  marketBenchmarks: any;
  stakeholderImpact: Record<string, string>;
}

// Decision Types by Role
const DECISION_TYPES = {
  contractor: [
    'quote-pricing',             // How to price this quote
    'job-scheduling',            // When to schedule this job
    'material-sourcing',         // Which supplier to use
    'customer-negotiation',      // How to respond to customer request
    'resource-allocation',       // Where to assign crew
  ],
  siteLead: [
    'task-prioritization',       // What to focus on today
    'issue-escalation',          // Whether to escalate
    'resource-reallocation',     // Move resources between tasks
    'quality-acceptance',        // Accept or reject work
  ],
  coo: [
    'schedule-recovery',         // How to recover from delay
    'contractor-selection',      // Which contractor to award
    'change-order-approval',     // Approve/reject/negotiate CO
    'risk-response',            // How to respond to risk
  ],
  cfo: [
    'payment-approval',          // Approve payment
    'cash-allocation',           // Where to allocate funds
    'cost-negotiation',          // Whether to negotiate terms
    'draw-timing',              // When to submit draw request
  ],
  director: [
    'project-prioritization',    // Which projects to focus on
    'resource-investment',       // Where to invest resources
    'strategic-direction',       // Strategic choices
    'portfolio-rebalancing',     // How to rebalance risk
  ],
};

// Functions
getDecisionQueue(role: UserRole): PendingDecision[]
makeDecision(decisionId: string, optionId: string): DecisionOutcome
deferDecision(decisionId: string, until: string): void
delegateDecision(decisionId: string, toRole: UserRole): void
getDecisionHistory(filters: any): DecisionRecord[]

// React Hooks
useDecisionQueue(role: UserRole): { decisions, loading, makeDecision }
usePendingDecisionCount(role: UserRole): number
```

#### 5.2 Create Decision Queue UI Components
**File:** `src/components/shared/DecisionQueuePanel.tsx`

Features:
- Prioritized list of pending decisions
- Urgency and impact indicators
- One-tap for AI recommendation
- Side-by-side option comparison
- Historical outcomes for similar decisions
- "Help me decide" with full reasoning
- Defer/delegate capabilities

**File:** `src/components/shared/DecisionCard.tsx`

Features:
- Clear decision statement
- Deadline and blocker indicators
- Options with pros/cons
- AI recommendation highlighted
- Confidence indicator
- Quick decision buttons
- "Why this recommendation?" link

---

### Phase 6: Role-Specific Decision Dashboards (P2)

**Goal:** Each role gets a dedicated decision guidance dashboard

#### 6.1 Contractor Decision Dashboard
**File:** `src/components/dashboards/ContractorDecisionDashboard.tsx`

Sections:
- **Today's Decisions** - What needs your attention now
- **Pricing Guidance** - AI-recommended prices for pending quotes
- **Schedule Optimizer** - Suggested schedule adjustments
- **Customer Insights** - Who needs follow-up and why
- **Cash Flow Forecast** - Predicted income/expenses with decisions to improve
- **Business Health Score** - With drill-down to issues

#### 6.2 Site Lead Decision Dashboard
**File:** `src/components/dashboards/SiteLeadDecisionDashboard.tsx`

Sections:
- **Critical Now** - Safety/quality issues requiring immediate attention
- **Today's Priorities** - AI-ranked task list with reasoning
- **Resource Allocation** - Where to assign people/equipment
- **Escalation Queue** - Issues to escalate with rationale
- **Lookahead Risks** - Problems likely to emerge

#### 6.3 COO Decision Dashboard
**File:** `src/components/dashboards/COODecisionDashboard.tsx`

Sections:
- **Portfolio Health** - Traffic light view with drill-down
- **Decisions Required** - Change orders, contracts, escalations
- **Risk Actions** - Risks requiring response decisions
- **Schedule Recovery Options** - For projects in trouble
- **Procurement Decisions** - Supplier selection, awards

#### 6.4 CFO Decision Dashboard
**File:** `src/components/dashboards/CFODecisionDashboard.tsx`

Sections:
- **Cash Position & Forecast** - With decisions to optimize
- **Payment Queue** - Prioritized approvals with recommendations
- **Cost Variances** - Projects needing attention with reasons
- **Draw Request Status** - Optimization opportunities
- **Investment Decisions** - Where to allocate capital

#### 6.5 Director Decision Dashboard
**File:** `src/components/dashboards/DirectorDecisionDashboard.tsx`

Sections:
- **Strategic Overview** - Portfolio health with insights
- **Critical Decisions** - High-stakes items requiring attention
- **Portfolio Analyst** - Interactive Q&A for strategic questions
- **Performance Patterns** - Cross-project insights
- **Market Intelligence** - External factors affecting decisions

---

## Integration Points

### Dashboard Integration
Every existing dashboard should integrate:
1. **Audit Alert Bar** - Top of screen showing critical findings
2. **Decision Badge** - In header showing pending decisions
3. **"Why?" Links** - On every metric and recommendation
4. **Explorable Metrics** - Click to drill down

### Financial Auditor Integration by Role

| Role | Integration Point | Financial Auditor Features |
|------|-------------------|---------------------------|
| **CFO** | Primary user | Full Financial Audit Dashboard: invoice verification, spending analysis, overpayment detection, budget reconciliation, Excel comparison |
| **COO** | Procurement tab | Vendor rate comparison, procurement overpayment alerts, contract rate compliance |
| **Director** | Portfolio overview | Aggregate financial audit stats, systematic cost leakage, vendor consolidation opportunities |
| **Contractor** | Payments tab | Invoice-vs-estimate comparison, supplier rate tracking, margin protection alerts |
| **Site Lead** | Materials tab | Material price verification, delivery charge auditing |

### Financial Auditor Workflow

```
INVOICE ARRIVES
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│ FINANCIAL AUDITOR AUTO-VERIFICATION                              │
│                                                                  │
│ 1. Match to Budget/Excel → Check quantities & rates             │
│ 2. Match to Contract     → Verify contracted rates applied      │
│ 3. Match to PO           → Ensure within PO limits              │
│ 4. Check for Duplicates  → Scan for prior identical charges     │
│ 5. Compare to Market     → Flag if significantly over market    │
│                                                                  │
│ Result: ✓ Verified | ⚠ Discrepancies Found | 🚨 Reject          │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
  ┌───────────────────────────────────────┐
  │ IF DISCREPANCIES:                     │
  │  → Show variance details              │
  │  → Display Excel cell reference       │
  │  → Suggest action (credit/approve/reject) │
  │  → Require explanation if approving   │
  └───────────────────────────────────────┘
      │
      ▼
  HUMAN DECISION
  (with AI recommendation & reasoning)
```

### Action Integration
Every agent action should include:
1. **Reasoning Chain** - Why this action is proposed
2. **Confidence Score** - How sure the AI is
3. **Alternative Options** - What else was considered
4. **Expected Outcome** - What will happen if approved

### Notification Integration
Proactive notifications for:
1. **New Audit Findings** - Especially critical ones
2. **Decision Deadlines** - Approaching decision points
3. **Insight Updates** - New patterns detected
4. **Recommendation Changes** - AI changed its mind based on new data

---

## Data Requirements

### New Data to Capture
1. **Decision Outcomes** - What was decided and what happened
2. **Reasoning Feedback** - Was the reasoning helpful?
3. **Exploration Paths** - What do users drill into most?
4. **Question Patterns** - What do users ask the analyst?

### New Models to Train
1. **Reasoning Quality Model** - Learn what explanations are most helpful
2. **Decision Prediction Model** - Predict what users will decide
3. **Audit Priority Model** - Learn which findings matter most
4. **Question Understanding Model** - Better interpret natural language questions

---

## Success Metrics

### User Engagement
- Decisions made through decision queue (vs ad-hoc)
- "Why?" links clicked
- Drill-down exploration depth
- Strategic questions asked

### Decision Quality
- Recommendation acceptance rate
- Decision reversal rate
- Outcome accuracy (predicted vs actual)
- Time to decision improvement

### Business Impact
- Issues caught by auditor before escalation
- Value recovered from surfaced opportunities
- Time saved on analysis/reporting
- Decision confidence increase (survey)

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-3)
- [ ] Reasoning Engine Service
- [ ] Reasoning Mode UI Component
- [ ] Integration with existing actions/recommendations

### Phase 2: Auditor (Weeks 4-6)
- [ ] Auditor Service with role-specific categories
- [ ] Background audit runner
- [ ] Auditor Alert Panel UI
- [ ] Integration with dashboards

### Phase 3: Analyst (Weeks 7-9)
- [ ] Analyst Service with strategic questions
- [ ] Analyst Panel UI
- [ ] Insight Cards
- [ ] Pre-built questions by role

### Phase 4: Exploration (Weeks 10-12)
- [ ] Exploration Service
- [ ] Metric Explorer UI
- [ ] Explorable Metric wrapper component
- [ ] Integration across all dashboards

### Phase 5: Decision Queue (Weeks 13-15)
- [ ] Decision Queue Service
- [ ] Decision Queue Panel UI
- [ ] Decision Card component
- [ ] Role-specific decision types

### Phase 6: Role Dashboards (Weeks 16-18)
- [ ] 5 role-specific decision dashboards
- [ ] Full integration testing
- [ ] User feedback incorporation
- [ ] Performance optimization

---

## Files Summary

### New Services
- `src/services/reasoningEngine.ts`
- `src/services/auditorService.ts`
- `src/services/financialAuditorService.ts` *(NEW - Financial Auditing)*
- `src/services/auditRunner.ts`
- `src/services/analystService.ts`
- `src/services/explorationService.ts`
- `src/services/decisionQueueService.ts`

### New Types
- `src/types/reasoning.ts`
- `src/types/auditor.ts`
- `src/types/financial-auditor.ts` *(NEW - Financial Audit types)*
- `src/types/analyst.ts`
- `src/types/exploration.ts`
- `src/types/decision-queue.ts`

### New Shared Components
- `src/components/shared/ReasoningModeView.tsx`
- `src/components/shared/AuditorAlertPanel.tsx`
- `src/components/shared/AnalystPanel.tsx`
- `src/components/shared/InsightCard.tsx`
- `src/components/shared/MetricExplorer.tsx`
- `src/components/shared/ExplorableMetric.tsx`
- `src/components/shared/DecisionQueuePanel.tsx`
- `src/components/shared/DecisionCard.tsx`

### New Financial Auditor Components
- `src/components/financial-auditor/InvoiceVerificationPanel.tsx`
- `src/components/financial-auditor/SpendingAnalysisPanel.tsx`
- `src/components/financial-auditor/OverpaymentDetectorPanel.tsx`
- `src/components/financial-auditor/BudgetReconciliationView.tsx`
- `src/components/financial-auditor/FinancialAuditDashboard.tsx`

### New Decision Dashboards
- `src/components/dashboards/ContractorDecisionDashboard.tsx`
- `src/components/dashboards/SiteLeadDecisionDashboard.tsx`
- `src/components/dashboards/COODecisionDashboard.tsx`
- `src/components/dashboards/CFODecisionDashboard.tsx`
- `src/components/dashboards/DirectorDecisionDashboard.tsx`

### Files to Modify
- `src/types/agent-actions.ts` - Add reasoning fields
- `src/services/agentActionsService.ts` - Integrate reasoning
- `src/intelligence/intelligenceEngine.ts` - Add explanation generation
- All existing dashboards - Add audit alerts, decision badges, explorable metrics

### Financial Auditor Integration Files
- `src/components/dashboards/CFODashboard.tsx` - Add Financial Audit tab with full dashboard
- `src/components/dashboards/COODashboard.tsx` - Add vendor rate alerts to procurement tab
- `src/components/dashboards/DirectorDashboard.tsx` - Add portfolio cost leakage stats
- `src/components/dashboards/ContractorDashboard.tsx` - Add invoice-vs-estimate verification
- `app/(tabs)/cfo-costs.tsx` - Integrate invoice verification workflow
- `app/(tabs)/procurement.tsx` - Add contract rate compliance checking
- `src/services/invoiceService.ts` - Add verification hooks
- `src/services/budgetService.ts` - Add Excel import/comparison functions

---

## Sources

This plan incorporates learnings from:
- [Eve Legal AI](https://www.eve.legal/) - Proactive AI workforce model
- [Eve 2.0 Announcement](https://www.eve.legal/blogs/introducing-eve-2-0-the-proactive-ai-workforce-for-plaintiff-firms) - Agents, Auditor, Analyst roles
- [Eve Reasoning Mode](https://www.eve.legal/blogs/introducing-eves-reasoning-mode-advanced-ai-legal-reasoning) - Step-by-step reasoning
- [Salient Data Solutions](https://www2.salient.com/) - Industry-tailored analytics and drill-down exploration
- [Salient Predictions](https://www.salientpredictions.com/) - Predictive forecasting approach

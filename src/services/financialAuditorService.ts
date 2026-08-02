/**
 * Financial Auditor Service
 *
 * Acts as a financial auditor to:
 * 1. Check if invoices match Excel/budget calculations
 * 2. Detect unnecessary spending
 * 3. Detect if paying too much (overpayments)
 *
 * Based on Eve Legal AI's Auditor pattern - continuous background checking.
 */

import {
  FinancialAuditFinding,
  InvoiceVerification,
  InvoiceDiscrepancy,
  InvoiceLineItem,
  BudgetData,
  BudgetLineItem,
  UnnecessarySpendAnalysis,
  UnnecessarySpendFinding,
  UnnecessarySpendType,
  OverpaymentAnalysis,
  OverpaymentFinding,
  OverpaymentType,
  SavingsAction,
  RecoveryAction,
  BudgetVarianceReport,
  BudgetVariance,
  ReconciliationReport,
  FinancialAuditStats,
  FinancialAuditConfig,
  FinancialAuditFilters,
  InvoiceVerificationRequest,
  SpendingAnalysisRequest,
  OverpaymentAnalysisRequest,
  AuditSeverity,
  AuditStatus,
  DiscrepancyType,
  VerificationStatus,
} from '../types/financial-auditor';

// ============================================
// MOCK DATA - Replace with real data sources
// ============================================

const DEMO_MARKET_RATES: Record<string, number> = {
  'steel-brackets': 38,
  'copper-pipe-15mm': 12.50,
  'electrical-cable-2.5mm': 0.85,
  'plasterboard-12.5mm': 8.20,
  'security-services': 25,  // per hour
  'scaffolding-hire': 150,  // per week
  'skip-hire': 280,         // per week
};

const DEMO_MOCK_INVOICES: Record<string, any> = {
  'INV-2024-0892': {
    id: 'INV-2024-0892',
    number: 'INV-2024-0892',
    vendor: 'BuildCo Ltd',
    vendorId: 'vendor-001',
    amount: 23450,
    date: '2024-02-01',
    dueDate: '2024-03-01',
    projectId: 'project-001',
    lineItems: [
      { lineNumber: 1, description: 'Steel brackets', quantity: 150, unit: 'each', unitPrice: 45, total: 6750, costCode: 'STR-001' },
      { lineNumber: 2, description: 'Installation labour', quantity: 40, unit: 'hours', unitPrice: 65, total: 2600, costCode: 'LAB-001' },
      { lineNumber: 3, description: 'Copper pipe 15mm', quantity: 200, unit: 'metres', unitPrice: 14.50, total: 2900, costCode: 'PLU-001' },
      { lineNumber: 4, description: 'Scaffolding hire', quantity: 4, unit: 'weeks', unitPrice: 180, total: 720, costCode: 'EQP-001' },
    ],
  },
  'INV-2024-0891': {
    id: 'INV-2024-0891',
    number: 'INV-2024-0891',
    vendor: 'MechServ',
    vendorId: 'vendor-002',
    amount: 8200,
    date: '2024-01-28',
    projectId: 'project-001',
    lineItems: [
      { lineNumber: 1, description: 'HVAC maintenance', quantity: 1, unit: 'service', unitPrice: 8200, total: 8200, costCode: 'MEC-001' },
    ],
  },
};

/** Demo fixture — empty in production builds (see src/config/demo.ts). */
const MOCK_INVOICES: Record<string, any> = DEMO_MODE ? DEMO_MOCK_INVOICES : {};

const DEMO_MOCK_BUDGETS: Record<string, BudgetData> = {
  'project-001': {
    id: 'budget-001',
    projectId: 'project-001',
    name: 'Main Building Budget',
    version: 3,
    lineItems: [
      { id: 'bl-001', costCode: 'STR-001', description: 'Steel brackets', category: 'Structural', quantity: 120, unit: 'each', unitRate: 38, total: 4560, committed: 4560, spent: 0, remaining: 4560, variancePercent: 0, status: 'on-budget' },
      { id: 'bl-002', costCode: 'LAB-001', description: 'Installation labour', category: 'Labour', quantity: 35, unit: 'hours', unitRate: 60, total: 2100, committed: 2100, spent: 0, remaining: 2100, variancePercent: 0, status: 'on-budget' },
      { id: 'bl-003', costCode: 'PLU-001', description: 'Copper pipe 15mm', category: 'Plumbing', quantity: 180, unit: 'metres', unitRate: 12.50, total: 2250, committed: 2250, spent: 0, remaining: 2250, variancePercent: 0, status: 'on-budget' },
      { id: 'bl-004', costCode: 'EQP-001', description: 'Scaffolding hire', category: 'Equipment', quantity: 4, unit: 'weeks', unitRate: 150, total: 600, committed: 600, spent: 0, remaining: 600, variancePercent: 0, status: 'on-budget' },
      { id: 'bl-005', costCode: 'MEC-001', description: 'HVAC maintenance', category: 'Mechanical', quantity: 1, unit: 'service', unitRate: 7200, total: 7200, committed: 7200, spent: 0, remaining: 7200, variancePercent: 0, status: 'on-budget' },
    ],
    totalBudget: 250000,
    totalCommitted: 85000,
    totalSpent: 45000,
    totalRemaining: 205000,
    lastUpdated: '2024-01-15',
    source: 'excel',
    excelFilePath: '/budgets/project-001-budget-v3.xlsx',
  },
};

/** Demo fixture — empty in production builds (see src/config/demo.ts). */
const MOCK_BUDGETS: Record<string, BudgetData> = DEMO_MODE ? DEMO_MOCK_BUDGETS : {};

const DEMO_HISTORICAL_RATES: Record<string, { vendor: string; item: string; rates: { date: string; rate: number }[] }[]> = {
  'vendor-002': [
    {
      vendor: 'MechServ',
      item: 'HVAC maintenance',
      rates: [
        { date: '2023-01-01', rate: 6800 },
        { date: '2023-06-01', rate: 7100 },
        { date: '2024-01-01', rate: 7600 },
        { date: '2024-02-01', rate: 8200 },
      ],
    },
  ],
};
// Gated alongside MOCK_INVOICES/MOCK_BUDGETS above, which were already covered.
// These two were not, and detectRateCreep reads DEMO_HISTORICAL_RATES
// ['vendor-002'] with no guard of its own -- so wiring analyzeOverpayments to a
// screen would have emitted a "rate creep" finding about a hardcoded demo
// vendor for every project. Nothing calls it from the UI today; this closes the
// trap rather than relying on that staying true.
const MOCK_MARKET_RATES: Record<string, number> = DEMO_MODE ? DEMO_MARKET_RATES : {};
const MOCK_HISTORICAL_RATES: typeof DEMO_HISTORICAL_RATES = DEMO_MODE ? DEMO_HISTORICAL_RATES : {};

// ============================================
// CONFIGURATION
// ============================================

const DEFAULT_CONFIG: FinancialAuditConfig = {
  autoApprovalMaxVariance: 5,      // 5%
  autoApprovalMaxAmount: 1000,     // €1000
  budgetVarianceAlertThreshold: 10, // 10%
  rateCreepAlertThreshold: 5,      // 5% increase
  marketRateTolerance: 15,         // 15% above market
  requireApprovalAbove: 5000,      // €5000
  runFrequency: 'daily',
  notifyOnCritical: true,
  notifyOnHigh: true,
  notifyRecipients: [],
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function calculateSeverity(variancePercent: number, amount: number): AuditSeverity {
  if (variancePercent > 25 || amount > 10000) return 'critical';
  if (variancePercent > 15 || amount > 5000) return 'high';
  if (variancePercent > 10 || amount > 1000) return 'medium';
  return 'low';
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
}

// ============================================
// INVOICE VERIFICATION
// ============================================

class FinancialAuditorService {
  private config: FinancialAuditConfig;
  private findings: FinancialAuditFinding[] = [];
  private verifications: InvoiceVerification[] = [];
  private subscribers: ((findings: FinancialAuditFinding[]) => void)[] = [];

  constructor(config: Partial<FinancialAuditConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Verify an invoice against budget/contract/PO
   */
  async verifyInvoice(request: InvoiceVerificationRequest): Promise<InvoiceVerification> {
    const invoice = MOCK_INVOICES[request.invoiceId];
    if (!invoice) {
      throw new Error(`Invoice ${request.invoiceId} not found`);
    }

    const discrepancies: InvoiceDiscrepancy[] = [];
    let expectedAmount = 0;

    // Compare against budget
    if (request.compareAgainst.includes('budget')) {
      const budget = request.budgetData || MOCK_BUDGETS[request.projectId];
      if (budget) {
        const budgetDiscrepancies = this.verifyAgainstBudget(invoice.lineItems, budget);
        discrepancies.push(...budgetDiscrepancies);
        expectedAmount = this.calculateExpectedAmount(invoice.lineItems, budget);
      }
    }

    // Check for duplicates
    const duplicates = this.detectDuplicateCharges(invoice);
    discrepancies.push(...duplicates);

    // Calculate variance
    const variance = invoice.amount - expectedAmount;
    const variancePercent = expectedAmount > 0 ? (variance / expectedAmount) * 100 : 0;

    // Determine verification status
    let status: VerificationStatus = 'matched';
    if (discrepancies.length > 0) {
      status = 'discrepancy';
    } else if (expectedAmount === 0) {
      status = 'missing-reference';
    }

    // Check auto-approval eligibility
    const autoApprovalEligible = this.checkAutoApprovalEligibility(
      variancePercent,
      variance,
      discrepancies
    );

    const verification: InvoiceVerification = {
      id: generateId('ver'),
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      vendor: invoice.vendor,
      vendorId: invoice.vendorId,
      invoiceAmount: invoice.amount,
      invoiceDate: invoice.date,
      dueDate: invoice.dueDate,
      lineItems: invoice.lineItems,
      verificationResult: {
        status,
        matchedTo: 'budget',
        expectedAmount,
        variance,
        variancePercent,
        discrepancies,
        autoApprovalEligible,
        autoApprovalBlockers: autoApprovalEligible ? undefined : this.getAutoApprovalBlockers(variancePercent, variance, discrepancies),
      },
      projectId: request.projectId,
      verifiedAt: new Date().toISOString(),
      verifiedBy: 'system',
    };

    this.verifications.push(verification);

    // Create audit findings for discrepancies
    if (discrepancies.length > 0) {
      this.createFindingsFromDiscrepancies(verification, discrepancies);
    }

    return verification;
  }

  /**
   * Compare invoice line items against budget
   */
  private verifyAgainstBudget(
    lineItems: InvoiceLineItem[],
    budget: BudgetData
  ): InvoiceDiscrepancy[] {
    const discrepancies: InvoiceDiscrepancy[] = [];

    for (const lineItem of lineItems) {
      const budgetLine = budget.lineItems.find(
        b => b.costCode === lineItem.costCode ||
             b.description.toLowerCase().includes(lineItem.description.toLowerCase().split(' ')[0])
      );

      if (!budgetLine) {
        // Unapproved item
        discrepancies.push({
          id: generateId('disc'),
          lineNumber: lineItem.lineNumber,
          type: 'unapproved-item',
          description: `Line item "${lineItem.description}" not found in approved budget`,
          invoicedValue: lineItem.total,
          expectedValue: 0,
          variance: lineItem.total,
          variancePercent: 100,
          severity: 'high',
          source: { type: 'budget', documentId: budget.id },
          recommendation: 'Request approval or reject line item. This item was not in the original budget.',
        });
        continue;
      }

      // Check quantity
      if (lineItem.quantity > budgetLine.quantity) {
        const quantityVariance = lineItem.quantity - budgetLine.quantity;
        const quantityVariancePercent = (quantityVariance / budgetLine.quantity) * 100;

        discrepancies.push({
          id: generateId('disc'),
          lineNumber: lineItem.lineNumber,
          type: 'quantity-mismatch',
          description: `Quantity for "${lineItem.description}" exceeds budget by ${quantityVariance} ${lineItem.unit} (${quantityVariancePercent.toFixed(1)}%)`,
          invoicedValue: lineItem.quantity,
          expectedValue: budgetLine.quantity,
          variance: quantityVariance,
          variancePercent: quantityVariancePercent,
          severity: calculateSeverity(quantityVariancePercent, quantityVariance * lineItem.unitPrice),
          source: { type: 'budget', documentId: budget.id, reference: `Cost code: ${budgetLine.costCode}` },
          recommendation: `Verify if extra ${quantityVariance} ${lineItem.unit} were approved via change order`,
        });
      }

      // Check rate
      const rateVariance = lineItem.unitPrice - budgetLine.unitRate;
      const rateVariancePercent = (rateVariance / budgetLine.unitRate) * 100;

      if (Math.abs(rateVariancePercent) > 5) {  // 5% tolerance
        discrepancies.push({
          id: generateId('disc'),
          lineNumber: lineItem.lineNumber,
          type: 'rate-mismatch',
          description: `Rate for "${lineItem.description}" differs from budget: ${formatCurrency(lineItem.unitPrice)} vs ${formatCurrency(budgetLine.unitRate)} (${rateVariancePercent > 0 ? '+' : ''}${rateVariancePercent.toFixed(1)}%)`,
          invoicedValue: lineItem.unitPrice,
          expectedValue: budgetLine.unitRate,
          variance: rateVariance,
          variancePercent: rateVariancePercent,
          severity: rateVariancePercent > 0 ? calculateSeverity(rateVariancePercent, rateVariance * lineItem.quantity) : 'low',
          source: { type: 'budget', documentId: budget.id, reference: `Cost code: ${budgetLine.costCode}` },
          recommendation: rateVariancePercent > 0
            ? 'Request credit note or justification for rate increase'
            : 'Note: Rate is below budget (favorable variance)',
        });
      }

      // Check if exceeds budget allocation
      const totalForLine = lineItem.total;
      if (totalForLine > budgetLine.remaining) {
        discrepancies.push({
          id: generateId('disc'),
          lineNumber: lineItem.lineNumber,
          type: 'exceeds-budget',
          description: `"${lineItem.description}" exceeds remaining budget: ${formatCurrency(totalForLine)} invoiced vs ${formatCurrency(budgetLine.remaining)} remaining`,
          invoicedValue: totalForLine,
          expectedValue: budgetLine.remaining,
          variance: totalForLine - budgetLine.remaining,
          variancePercent: ((totalForLine - budgetLine.remaining) / budgetLine.remaining) * 100,
          severity: 'high',
          source: { type: 'budget', documentId: budget.id, reference: `Cost code: ${budgetLine.costCode}` },
          recommendation: 'Budget reallocation or change order required before approval',
        });
      }
    }

    return discrepancies;
  }

  /**
   * Calculate expected amount from budget
   */
  private calculateExpectedAmount(lineItems: InvoiceLineItem[], budget: BudgetData): number {
    let expected = 0;

    for (const lineItem of lineItems) {
      const budgetLine = budget.lineItems.find(
        b => b.costCode === lineItem.costCode ||
             b.description.toLowerCase().includes(lineItem.description.toLowerCase().split(' ')[0])
      );

      if (budgetLine) {
        expected += Math.min(lineItem.quantity, budgetLine.quantity) * budgetLine.unitRate;
      }
    }

    return expected;
  }

  /**
   * Detect duplicate charges
   */
  private detectDuplicateCharges(invoice: any): InvoiceDiscrepancy[] {
    const duplicates: InvoiceDiscrepancy[] = [];
    const seen = new Map<string, InvoiceLineItem>();

    for (const lineItem of invoice.lineItems) {
      const key = `${lineItem.description.toLowerCase()}-${lineItem.unitPrice}`;

      if (seen.has(key)) {
        const original = seen.get(key)!;
        duplicates.push({
          id: generateId('disc'),
          lineNumber: lineItem.lineNumber,
          type: 'duplicate-charge',
          description: `Potential duplicate: "${lineItem.description}" appears multiple times at same rate`,
          invoicedValue: lineItem.total,
          expectedValue: 0,
          variance: lineItem.total,
          variancePercent: 100,
          severity: 'medium',
          source: { type: 'invoice', reference: `Also on line ${original.lineNumber}` },
          recommendation: 'Verify this is not a duplicate charge',
        });
      } else {
        seen.set(key, lineItem);
      }
    }

    return duplicates;
  }

  /**
   * Check auto-approval eligibility
   */
  private checkAutoApprovalEligibility(
    variancePercent: number,
    variance: number,
    discrepancies: InvoiceDiscrepancy[]
  ): boolean {
    if (Math.abs(variancePercent) > this.config.autoApprovalMaxVariance) return false;
    if (Math.abs(variance) > this.config.autoApprovalMaxAmount) return false;
    if (discrepancies.some(d => d.severity === 'critical' || d.severity === 'high')) return false;
    if (discrepancies.some(d => d.type === 'unapproved-item')) return false;
    return true;
  }

  /**
   * Get auto-approval blockers
   */
  private getAutoApprovalBlockers(
    variancePercent: number,
    variance: number,
    discrepancies: InvoiceDiscrepancy[]
  ): string[] {
    const blockers: string[] = [];

    if (Math.abs(variancePercent) > this.config.autoApprovalMaxVariance) {
      blockers.push(`Variance ${variancePercent.toFixed(1)}% exceeds ${this.config.autoApprovalMaxVariance}% threshold`);
    }
    if (Math.abs(variance) > this.config.autoApprovalMaxAmount) {
      blockers.push(`Variance ${formatCurrency(variance)} exceeds ${formatCurrency(this.config.autoApprovalMaxAmount)} threshold`);
    }
    if (discrepancies.some(d => d.severity === 'critical')) {
      blockers.push('Contains critical severity discrepancies');
    }
    if (discrepancies.some(d => d.severity === 'high')) {
      blockers.push('Contains high severity discrepancies');
    }
    if (discrepancies.some(d => d.type === 'unapproved-item')) {
      blockers.push('Contains unapproved line items');
    }

    return blockers;
  }

  /**
   * Create audit findings from discrepancies
   */
  private createFindingsFromDiscrepancies(
    verification: InvoiceVerification,
    discrepancies: InvoiceDiscrepancy[]
  ): void {
    for (const discrepancy of discrepancies) {
      const finding: FinancialAuditFinding = {
        id: generateId('fnd'),
        auditType: 'invoice-mismatch',
        severity: discrepancy.severity,
        status: 'new',
        title: `Invoice discrepancy: ${discrepancy.type.replace(/-/g, ' ')}`,
        description: discrepancy.description,
        financialDetails: {
          invoiceId: verification.invoiceId,
          invoiceNumber: verification.invoiceNumber,
          vendor: verification.vendor,
          invoicedAmount: discrepancy.invoicedValue,
          expectedAmount: discrepancy.expectedValue,
          variance: discrepancy.variance,
          variancePercent: discrepancy.variancePercent,
          comparisonSource: discrepancy.source.type as any,
        },
        evidence: [{
          type: 'invoice',
          documentId: verification.invoiceId,
          reference: verification.invoiceNumber,
          value: discrepancy.invoicedValue,
        }],
        suggestedAction: {
          type: discrepancy.variance > 0 ? 'request-credit' : 'approve-with-note',
          description: discrepancy.recommendation,
          potentialSavings: discrepancy.variance > 0 ? discrepancy.variance : 0,
        },
        createdAt: new Date().toISOString(),
      };

      this.findings.push(finding);
    }

    this.notifySubscribers();
  }

  // ============================================
  // UNNECESSARY SPENDING DETECTION
  // ============================================

  /**
   * Analyze project for unnecessary spending
   */
  async analyzeUnnecessarySpending(request: SpendingAnalysisRequest): Promise<UnnecessarySpendAnalysis> {
    const findings: UnnecessarySpendFinding[] = [];

    // Check for redundant services
    const redundant = await this.detectRedundantServices(request.projectId);
    findings.push(...redundant);

    // Check for over-specification
    const overSpec = await this.detectOverSpecification(request.projectId);
    findings.push(...overSpec);

    // Check for scope creep
    const scopeCreep = await this.detectScopeCreepSpending(request.projectId);
    findings.push(...scopeCreep);

    // Check for early procurement
    const earlyProcurement = await this.detectEarlyProcurement(request.projectId);
    findings.push(...earlyProcurement);

    // Calculate totals
    const totalCurrentSpend = findings.reduce((sum, f) => sum + f.currentSpend, 0);
    const totalNecessarySpend = findings.reduce((sum, f) => sum + f.necessarySpend, 0);
    const totalPotentialSavings = findings.reduce((sum, f) => sum + f.savingsPotential, 0);

    // Generate prioritized actions
    const prioritizedActions = this.generateSavingsActions(findings);

    // Count by severity and type
    const bySeverity: Record<AuditSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    const byType: Record<string, number> = {};

    for (const finding of findings) {
      bySeverity[finding.severity]++;
      byType[finding.type] = (byType[finding.type] || 0) + 1;
    }

    return {
      id: generateId('usa'),
      projectId: request.projectId,
      analysisDate: new Date().toISOString(),
      findings,
      summary: {
        totalCurrentSpend,
        totalNecessarySpend,
        totalPotentialSavings,
        findingsCount: findings.length,
        bySeverity,
        byType: byType as Record<UnnecessarySpendType, number>,
      },
      prioritizedActions,
    };
  }

  /**
   * Detect redundant services (paying multiple vendors for same thing)
   */
  private async detectRedundantServices(projectId: string): Promise<UnnecessarySpendFinding[]> {
    // Mock detection - in reality would analyze vendor services
    return [{
      id: generateId('usf'),
      type: 'redundant-service',
      severity: 'high',
      title: 'Redundant security services detected',
      description: 'Both ABC Security and XYZ Security are providing overlapping guard services for the same site entrance.',
      currentSpend: 30000,
      necessarySpend: 15000,
      savingsPotential: 15000,
      affectedItems: [
        { description: 'ABC Security - Site guards', vendor: 'ABC Security', amount: 15000 },
        { description: 'XYZ Security - Site guards', vendor: 'XYZ Security', amount: 15000 },
      ],
      evidence: [
        { type: 'contract', description: 'ABC Security contract covers site entrance Monday-Friday' },
        { type: 'contract', description: 'XYZ Security contract covers same site entrance Monday-Friday' },
      ],
      confidence: 85,
      actionRequired: 'Terminate one security contract and consolidate to single provider',
      projectId,
      detectedAt: new Date().toISOString(),
      status: 'new',
    }];
  }

  /**
   * Detect over-specification (premium when standard would work)
   */
  private async detectOverSpecification(projectId: string): Promise<UnnecessarySpendFinding[]> {
    return [{
      id: generateId('usf'),
      type: 'over-specification',
      severity: 'medium',
      title: 'Premium materials in non-visible area',
      description: 'Premium acoustic ceiling tiles specified for back-of-house storage room where standard tiles would suffice.',
      currentSpend: 8500,
      necessarySpend: 4000,
      savingsPotential: 4500,
      affectedItems: [
        { description: 'Premium acoustic ceiling tiles - Storage Room B', vendor: 'BuildCo Ltd', amount: 8500 },
      ],
      evidence: [
        { type: 'specification', description: 'Room is back-of-house storage, not customer-facing' },
        { type: 'quote', description: 'Standard tiles quoted at £4,000 for same area' },
      ],
      confidence: 75,
      actionRequired: 'If not yet installed, substitute with standard specification tiles',
      projectId,
      detectedAt: new Date().toISOString(),
      status: 'new',
    }];
  }

  /**
   * Detect scope creep spending
   */
  private async detectScopeCreepSpending(projectId: string): Promise<UnnecessarySpendFinding[]> {
    // Would compare against original scope document
    return [];
  }

  /**
   * Detect early procurement
   */
  private async detectEarlyProcurement(projectId: string): Promise<UnnecessarySpendFinding[]> {
    // Would analyze delivery dates vs need dates
    return [];
  }

  /**
   * Generate prioritized savings actions
   */
  private generateSavingsActions(findings: UnnecessarySpendFinding[]): SavingsAction[] {
    return findings
      .filter(f => f.savingsPotential > 0)
      .sort((a, b) => b.savingsPotential - a.savingsPotential)
      .map((f, index) => ({
        id: generateId('sa'),
        title: `Action ${index + 1}: ${f.title}`,
        description: f.actionRequired,
        savingsAmount: f.savingsPotential,
        savingsType: 'one-time' as const,
        effort: f.savingsPotential > 10000 ? 'high' : f.savingsPotential > 5000 ? 'medium' : 'low',
        timeline: f.severity === 'critical' ? 'immediate' : f.severity === 'high' ? 'this-week' : 'this-month',
        actionSteps: [f.actionRequired],
        relatedFindingIds: [f.id],
        status: 'suggested' as const,
      }));
  }

  // ============================================
  // OVERPAYMENT DETECTION
  // ============================================

  /**
   * Analyze project for overpayments
   */
  async analyzeOverpayments(request: OverpaymentAnalysisRequest): Promise<OverpaymentAnalysis> {
    const findings: OverpaymentFinding[] = [];

    // Compare to market rates
    const marketFindings = await this.compareToMarketRates(request.projectId);
    findings.push(...marketFindings);

    // Compare to contract rates
    const contractFindings = await this.compareToContractRates(request.projectId);
    findings.push(...contractFindings);

    // Detect rate creep
    if (request.includeRateCreep !== false) {
      const rateCreep = await this.detectRateCreep(request.projectId, request.lookbackMonths || 12);
      findings.push(...rateCreep);
    }

    // Detect missed discounts
    const missedDiscounts = await this.detectMissedDiscounts(request.projectId);
    findings.push(...missedDiscounts);

    // Calculate totals
    const totalOverpaymentAmount = findings.reduce((sum, f) => sum + f.overpaymentAmount, 0);
    const recoverableAmount = findings
      .filter(f => f.isRecoverable)
      .reduce((sum, f) => sum + f.overpaymentAmount, 0);

    // Group by vendor
    const vendorTotals = new Map<string, number>();
    for (const finding of findings) {
      const current = vendorTotals.get(finding.vendor) || 0;
      vendorTotals.set(finding.vendor, current + finding.overpaymentAmount);
    }
    const topVendors = Array.from(vendorTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([vendor, amount]) => ({ vendor, amount }));

    // Count by severity and type
    const bySeverity: Record<AuditSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    const byType: Record<string, number> = {};

    for (const finding of findings) {
      bySeverity[finding.severity]++;
      byType[finding.type] = (byType[finding.type] || 0) + 1;
    }

    // Generate recovery actions
    const recoveryActions = this.generateRecoveryActions(findings);

    return {
      id: generateId('opa'),
      projectId: request.projectId,
      analysisDate: new Date().toISOString(),
      findings,
      summary: {
        totalOverpaymentAmount,
        recoverableAmount,
        findingsCount: findings.length,
        bySeverity,
        byType: byType as Record<OverpaymentType, number>,
        topVendors,
      },
      recoveryActions,
    };
  }

  /**
   * Compare invoice rates to market rates
   */
  private async compareToMarketRates(projectId: string): Promise<OverpaymentFinding[]> {
    const findings: OverpaymentFinding[] = [];
    const budget = MOCK_BUDGETS[projectId];

    if (!budget) return findings;

    // Check steel brackets (mock example)
    const steelLine = budget.lineItems.find(l => l.description.toLowerCase().includes('steel'));
    if (steelLine) {
      const marketRate = MOCK_MARKET_RATES['steel-brackets'];
      const invoicedRate = 45; // From invoice

      if (invoicedRate > marketRate * (1 + this.config.marketRateTolerance / 100)) {
        const overpaymentPercent = ((invoicedRate - marketRate) / marketRate) * 100;

        findings.push({
          id: generateId('opf'),
          type: 'above-market-rate',
          severity: overpaymentPercent > 20 ? 'high' : 'medium',
          title: 'Steel brackets above market rate',
          description: `Paying ${formatCurrency(invoicedRate)}/unit for steel brackets vs market rate of ${formatCurrency(marketRate)}/unit (${overpaymentPercent.toFixed(1)}% over market)`,
          vendor: 'BuildCo Ltd',
          vendorId: 'vendor-001',
          itemOrService: 'Steel brackets',
          paidRate: invoicedRate,
          benchmarkRate: marketRate,
          benchmarkSource: 'market-data',
          benchmarkDetails: 'RSMeans Q1 2024 regional data',
          overpaymentAmount: (invoicedRate - marketRate) * 150,  // 150 units
          overpaymentPercent,
          invoicesAffected: [{
            invoiceId: 'INV-2024-0892',
            invoiceNumber: 'INV-2024-0892',
            amount: 6750,
            date: '2024-02-01',
          }],
          evidence: [
            { type: 'market-data', description: 'RSMeans construction cost data', value: marketRate },
            { type: 'invoice', description: 'BuildCo Ltd invoice', value: invoicedRate },
          ],
          isRecoverable: true,
          recoveryLikelihood: 'medium',
          recoveryAction: 'Renegotiate rate for future orders or request partial credit',
          projectId,
          detectedAt: new Date().toISOString(),
          status: 'new',
        });
      }
    }

    return findings;
  }

  /**
   * Compare to contract rates
   */
  private async compareToContractRates(projectId: string): Promise<OverpaymentFinding[]> {
    // Would compare invoice rates to contracted rates
    return [];
  }

  /**
   * Detect rate creep over time
   */
  private async detectRateCreep(projectId: string, lookbackMonths: number): Promise<OverpaymentFinding[]> {
    const findings: OverpaymentFinding[] = [];

    // Check MechServ rate creep (mock example)
    const historicalData = MOCK_HISTORICAL_RATES['vendor-002'];
    if (historicalData) {
      for (const data of historicalData) {
        const rates = data.rates;
        if (rates.length >= 2) {
          const oldestRate = rates[0].rate;
          const latestRate = rates[rates.length - 1].rate;
          const rateChange = latestRate - oldestRate;
          const rateChangePercent = (rateChange / oldestRate) * 100;

          if (rateChangePercent > this.config.rateCreepAlertThreshold) {
            findings.push({
              id: generateId('opf'),
              type: 'rate-creep',
              severity: rateChangePercent > 20 ? 'high' : 'medium',
              title: `Rate creep detected: ${data.item}`,
              description: `${data.vendor} has increased ${data.item} rate by ${rateChangePercent.toFixed(1)}% over the past year (${formatCurrency(oldestRate)} → ${formatCurrency(latestRate)})`,
              vendor: data.vendor,
              vendorId: 'vendor-002',
              itemOrService: data.item,
              paidRate: latestRate,
              benchmarkRate: oldestRate,
              benchmarkSource: 'historical',
              benchmarkDetails: `Rate 12 months ago: ${formatCurrency(oldestRate)}`,
              overpaymentAmount: rateChange,
              overpaymentPercent: rateChangePercent,
              invoicesAffected: [{
                invoiceId: 'INV-2024-0891',
                invoiceNumber: 'INV-2024-0891',
                amount: latestRate,
                date: '2024-01-28',
              }],
              periodStart: rates[0].date,
              periodEnd: rates[rates.length - 1].date,
              evidence: rates.map(r => ({
                type: 'historical',
                description: `Rate on ${r.date}`,
                value: r.rate,
              })),
              isRecoverable: false,
              recoveryLikelihood: 'low',
              recoveryAction: 'Renegotiate contract or seek competitive quotes',
              projectId,
              detectedAt: new Date().toISOString(),
              status: 'new',
            });
          }
        }
      }
    }

    return findings;
  }

  /**
   * Detect missed discounts
   */
  private async detectMissedDiscounts(projectId: string): Promise<OverpaymentFinding[]> {
    // Would check for volume discounts not applied, early payment discounts missed, etc.
    return [];
  }

  /**
   * Generate recovery actions from overpayment findings
   */
  private generateRecoveryActions(findings: OverpaymentFinding[]): RecoveryAction[] {
    return findings
      .filter(f => f.isRecoverable)
      .map(f => ({
        id: generateId('ra'),
        vendorId: f.vendorId || '',
        vendorName: f.vendor,
        amount: f.overpaymentAmount,
        basis: f.description,
        suggestedApproach: f.type === 'above-contract-rate' ? 'credit-note-request' : 'rate-renegotiation',
        steps: [
          `Review ${f.type.replace(/-/g, ' ')} finding`,
          `Gather supporting evidence`,
          `Contact ${f.vendor} accounts department`,
          f.type === 'above-contract-rate'
            ? 'Request credit note citing contract terms'
            : 'Negotiate revised rates for future orders',
        ],
        relatedFindingIds: [f.id],
        status: 'suggested' as const,
      }));
  }

  // ============================================
  // BUDGET RECONCILIATION
  // ============================================

  /**
   * Compare budget to actual spending
   */
  async compareBudgetToActual(projectId: string, costCode?: string): Promise<BudgetVarianceReport> {
    const budget = MOCK_BUDGETS[projectId];
    if (!budget) {
      throw new Error(`Budget not found for project ${projectId}`);
    }

    const variances: BudgetVariance[] = budget.lineItems
      .filter(line => !costCode || line.costCode === costCode)
      .map(line => {
        const variance = line.spent - line.total;
        const variancePercent = line.total > 0 ? (variance / line.total) * 100 : 0;

        return {
          costCode: line.costCode,
          description: line.description,
          category: line.category,
          budgetAmount: line.total,
          actualAmount: line.spent,
          committedAmount: line.committed,
          variance,
          variancePercent,
          status: variancePercent > 10 ? 'over-budget' : variancePercent > 5 ? 'at-risk' : variancePercent < -10 ? 'under-budget' : 'on-budget',
          trend: 'stable',
          transactions: [],
          forecast: {
            estimatedFinal: line.spent + line.committed,
            forecastVariance: (line.spent + line.committed) - line.total,
            confidence: 80,
          },
        };
      });

    const totalBudget = variances.reduce((sum, v) => sum + v.budgetAmount, 0);
    const totalActual = variances.reduce((sum, v) => sum + v.actualAmount, 0);
    const totalCommitted = variances.reduce((sum, v) => sum + v.committedAmount, 0);
    const totalVariance = totalActual - totalBudget;

    return {
      id: generateId('bvr'),
      projectId,
      projectName: budget.name,
      reportDate: new Date().toISOString(),
      summary: {
        totalBudget,
        totalActual,
        totalCommitted,
        totalVariance,
        totalVariancePercent: totalBudget > 0 ? (totalVariance / totalBudget) * 100 : 0,
        overBudgetCategories: variances.filter(v => v.status === 'over-budget').length,
        atRiskCategories: variances.filter(v => v.status === 'at-risk').length,
      },
      variances,
      alerts: variances
        .filter(v => v.status === 'over-budget' || v.status === 'at-risk')
        .map(v => ({
          type: v.status === 'over-budget' ? 'over-budget' : 'trending-over',
          costCode: v.costCode,
          description: `${v.description}: ${v.variancePercent.toFixed(1)}% ${v.variance > 0 ? 'over' : 'under'} budget`,
          severity: Math.abs(v.variancePercent) > 20 ? 'critical' : Math.abs(v.variancePercent) > 10 ? 'high' : 'medium',
        })),
      recommendations: [
        'Review all over-budget line items before next invoice approval',
        'Request change orders for legitimate scope changes',
        'Investigate rate discrepancies with suppliers',
      ],
    };
  }

  /**
   * Import budget from Excel file
   */
  async importBudgetFromExcel(filePath: string, projectId: string): Promise<BudgetData> {
    // In reality, would parse Excel file
    // For now, return mock data
    return MOCK_BUDGETS[projectId] || {
      id: generateId('bud'),
      projectId,
      name: 'Imported Budget',
      version: 1,
      lineItems: [],
      totalBudget: 0,
      totalCommitted: 0,
      totalSpent: 0,
      totalRemaining: 0,
      lastUpdated: new Date().toISOString(),
      source: 'excel',
      excelFilePath: filePath,
    };
  }

  // ============================================
  // STATISTICS & DASHBOARD
  // ============================================

  /**
   * Get financial audit statistics
   */
  getStats(): FinancialAuditStats {
    const invoiceFindings = this.findings.filter(f => f.auditType === 'invoice-mismatch');
    const unnecessaryFindings = this.findings.filter(f => f.auditType === 'unnecessary-spend');
    const overpaymentFindings = this.findings.filter(f => f.auditType === 'overpayment');

    return {
      invoicesVerified: this.verifications.length,
      invoicesWithDiscrepancies: this.verifications.filter(v => v.verificationResult.discrepancies.length > 0).length,
      discrepancyRate: this.verifications.length > 0
        ? (this.verifications.filter(v => v.verificationResult.discrepancies.length > 0).length / this.verifications.length) * 100
        : 0,
      totalDiscrepancyValue: invoiceFindings.reduce((sum, f) => sum + (f.financialDetails.variance || 0), 0),

      unnecessarySpendFindings: unnecessaryFindings.length,
      potentialSavings: unnecessaryFindings.reduce((sum, f) => sum + (f.suggestedAction?.potentialSavings || 0), 0),
      savingsRealized: 0, // Would track from resolved findings

      overpaymentFindings: overpaymentFindings.length,
      totalOverpaymentValue: overpaymentFindings.reduce((sum, f) => sum + (f.financialDetails.variance || 0), 0),
      recoverableAmount: 0, // Would calculate from recoverable findings
      recoveredAmount: 0,

      projectsOverBudget: 0, // Would calculate from budget reports
      averageVariance: 0,

      criticalFindings: this.findings.filter(f => f.severity === 'critical').length,
      highFindings: this.findings.filter(f => f.severity === 'high').length,
      mediumFindings: this.findings.filter(f => f.severity === 'medium').length,
      lowFindings: this.findings.filter(f => f.severity === 'low').length,

      findingsTrend: 'stable',
      savingsTrend: 'stable',
    };
  }

  /**
   * Get all findings with optional filters
   */
  getFindings(filters?: FinancialAuditFilters): FinancialAuditFinding[] {
    let results = [...this.findings];

    if (filters?.projectId) {
      results = results.filter(f => f.financialDetails.projectId === filters.projectId);
    }
    if (filters?.severity?.length) {
      results = results.filter(f => filters.severity!.includes(f.severity));
    }
    if (filters?.auditType?.length) {
      results = results.filter(f => filters.auditType!.includes(f.auditType));
    }
    if (filters?.status?.length) {
      results = results.filter(f => filters.status!.includes(f.status));
    }
    if (filters?.minAmount) {
      results = results.filter(f => (f.financialDetails.variance || 0) >= filters.minAmount!);
    }

    return results.sort((a, b) => {
      // Sort by severity, then by amount
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return (b.financialDetails.variance || 0) - (a.financialDetails.variance || 0);
    });
  }

  /**
   * Get all verifications
   */
  getVerifications(): InvoiceVerification[] {
    return [...this.verifications];
  }

  /**
   * Acknowledge a finding
   */
  acknowledgeFinding(findingId: string, userId: string): void {
    const finding = this.findings.find(f => f.id === findingId);
    if (finding) {
      finding.status = 'acknowledged';
      finding.acknowledgedAt = new Date().toISOString();
      finding.acknowledgedBy = userId;
      this.notifySubscribers();
    }
  }

  /**
   * Resolve a finding
   */
  resolveFinding(findingId: string, userId: string): void {
    const finding = this.findings.find(f => f.id === findingId);
    if (finding) {
      finding.status = 'resolved';
      finding.resolvedAt = new Date().toISOString();
      finding.resolvedBy = userId;
      this.notifySubscribers();
    }
  }

  /**
   * Dismiss a finding
   */
  dismissFinding(findingId: string, reason: string): void {
    const finding = this.findings.find(f => f.id === findingId);
    if (finding) {
      finding.status = 'dismissed';
      finding.dismissedReason = reason;
      this.notifySubscribers();
    }
  }

  /**
   * Subscribe to findings updates
   */
  subscribe(callback: (findings: FinancialAuditFinding[]) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(s => s !== callback);
    };
  }

  private notifySubscribers(): void {
    for (const subscriber of this.subscribers) {
      subscriber(this.findings);
    }
  }
}

// ============================================
// SINGLETON INSTANCE & HOOKS
// ============================================

export const financialAuditor = new FinancialAuditorService();

// React hooks
import { useState, useEffect, useCallback } from 'react';
import { DEMO_MODE } from '../config/demo';

export function useFinancialAuditFindings(filters?: FinancialAuditFilters) {
  const [findings, setFindings] = useState<FinancialAuditFinding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setFindings(financialAuditor.getFindings(filters));
    setLoading(false);

    const unsubscribe = financialAuditor.subscribe((newFindings) => {
      setFindings(filters ? financialAuditor.getFindings(filters) : newFindings);
    });

    return unsubscribe;
  }, [filters]);

  const totalVariance = findings.reduce((sum, f) => sum + (f.financialDetails.variance || 0), 0);

  return { findings, totalVariance, loading };
}

export function useInvoiceVerification(invoiceId: string, projectId: string) {
  const [verification, setVerification] = useState<InvoiceVerification | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await financialAuditor.verifyInvoice({
        invoiceId,
        projectId,
        compareAgainst: ['budget', 'contract', 'po'],
      });
      setVerification(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  }, [invoiceId, projectId]);

  return { verification, loading, error, verify };
}

export function useUnnecessarySpendAnalysis(projectId: string) {
  const [analysis, setAnalysis] = useState<UnnecessarySpendAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  const analyze = useCallback(async () => {
    setLoading(true);
    try {
      const result = await financialAuditor.analyzeUnnecessarySpending({ projectId });
      setAnalysis(result);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    analyze();
  }, [analyze]);

  const totalSavings = analysis?.summary.totalPotentialSavings || 0;

  return { analysis, totalSavings, loading, refresh: analyze };
}

export function useOverpaymentAnalysis(projectId: string) {
  const [analysis, setAnalysis] = useState<OverpaymentAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  const analyze = useCallback(async () => {
    setLoading(true);
    try {
      const result = await financialAuditor.analyzeOverpayments({ projectId, includeRateCreep: true });
      setAnalysis(result);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    analyze();
  }, [analyze]);

  const totalOverpaid = analysis?.summary.totalOverpaymentAmount || 0;

  return { analysis, totalOverpaid, loading, refresh: analyze };
}

export function useBudgetReconciliation(projectId: string) {
  const [report, setReport] = useState<BudgetVarianceReport | null>(null);
  const [loading, setLoading] = useState(false);

  const reconcile = useCallback(async () => {
    setLoading(true);
    try {
      const result = await financialAuditor.compareBudgetToActual(projectId);
      setReport(result);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    reconcile();
  }, [reconcile]);

  return { report, loading, refresh: reconcile };
}

export function useFinancialAuditStats() {
  const [stats, setStats] = useState<FinancialAuditStats | null>(null);

  useEffect(() => {
    setStats(financialAuditor.getStats());

    const unsubscribe = financialAuditor.subscribe(() => {
      setStats(financialAuditor.getStats());
    });

    return unsubscribe;
  }, []);

  return stats;
}

export default financialAuditor;

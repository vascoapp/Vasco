/**
 * Auditor Service
 *
 * Continuous background auditing service that monitors all data
 * for risks, missed value, and compliance issues.
 *
 * Implements the Eve Legal AI "Auditor" pattern - AI that continuously
 * reviews everything and surfaces alerts before they become problems.
 */

import {
  AuditFinding,
  AuditCategory,
  AuditCategoryId,
  AuditStats,
  AuditRun,
  AuditFilters,
  AuditorConfig,
  UserRole,
  AuditSeverity,
  AuditStatus,
  AUDIT_CATEGORIES,
  DEFAULT_AUDITOR_CONFIG,
} from '../types/auditor';
// R51: dropped `import { reasoningEngine } from './reasoningEngine'` —
// the symbol was never referenced, but the static import kept the entire
// 600-LoC mock-data-fabricating reasoning chain in the bundle for no
// reason. reasoningEngine has zero remaining consumers across app/ +
// src/components/, so its `gatherDataPoints` / `evaluateStep` mocks no
// longer leak into any user-visible surface.
import { logWarn } from '../utils/errorHandler';

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
}

// ============================================
// AUDITOR SERVICE
// ============================================

class AuditorService {
  private config: AuditorConfig;
  private findings: AuditFinding[] = [];
  private auditRuns: AuditRun[] = [];
  private subscribers: ((findings: AuditFinding[]) => void)[] = [];
  private runningAudits: Set<string> = new Set();

  constructor(config: Partial<AuditorConfig> = {}) {
    this.config = { ...DEFAULT_AUDITOR_CONFIG, ...config };
    this.initializeMockFindings();
  }

  // ============================================
  // AUDIT EXECUTION
  // ============================================

  /**
   * Run audit for a specific category
   */
  async runAudit(categoryId: AuditCategoryId): Promise<AuditFinding[]> {
    const category = this.findCategory(categoryId);
    if (!category) {
      throw new Error(`Category ${categoryId} not found`);
    }

    const findings = await this.executeAuditCategory(category);

    for (const finding of findings) {
      this.addFinding(finding);
    }

    return findings;
  }

  /**
   * Run full audit for a role
   */
  async runFullAudit(role: UserRole): Promise<AuditFinding[]> {
    if (this.runningAudits.has(role)) {
      logWarn('Auditor', `Audit for role ${role} is already running`);
      return [];
    }

    this.runningAudits.add(role);
    const auditRun: AuditRun = {
      id: generateId('run'),
      frequency: 'daily',
      startedAt: new Date().toISOString(),
      categoriesChecked: [],
      findingsGenerated: 0,
      findingsAutoResolved: 0,
      status: 'running',
    };

    try {
      const categories = AUDIT_CATEGORIES[role] || [];
      const allFindings: AuditFinding[] = [];

      for (const category of categories) {
        auditRun.categoriesChecked.push(category.id);
        const findings = await this.executeAuditCategory(category);

        for (const finding of findings) {
          this.addFinding(finding);
          allFindings.push(finding);
        }
      }

      auditRun.findingsGenerated = allFindings.length;
      auditRun.status = 'completed';
      auditRun.completedAt = new Date().toISOString();
      auditRun.duration = new Date(auditRun.completedAt).getTime() - new Date(auditRun.startedAt).getTime();

      this.auditRuns.push(auditRun);

      return allFindings;
    } catch (error) {
      auditRun.status = 'failed';
      auditRun.error = error instanceof Error ? error.message : 'Unknown error';
      this.auditRuns.push(auditRun);
      throw error;
    } finally {
      this.runningAudits.delete(role);
    }
  }

  /**
   * Execute audit for a specific category
   */
  private async executeAuditCategory(category: AuditCategory): Promise<AuditFinding[]> {
    // In reality, each category would have specific audit logic
    // For now, use mock detection based on category

    switch (category.id) {
      case 'payment-overdue':
        return this.checkPaymentOverdue(category);
      case 'compliance-expiring':
        return this.checkComplianceExpiring(category);
      case 'margin-erosion':
        return this.checkMarginErosion(category);
      case 'invoice-budget-mismatch':
        return this.checkInvoiceBudgetMismatch(category);
      case 'overpayment-detection':
        return this.checkOverpayments(category);
      case 'supplier-reliability-drift':
        return this.checkSupplierDrift(category);
      case 'critical-path-risk':
        return this.checkCriticalPathRisk(category);
      case 'cashflow-gap-risk':
        return this.checkCashflowGapRisk(category);
      default:
        return [];
    }
  }

  // ============================================
  // SPECIFIC AUDIT CHECKS
  // ============================================

  private async checkPaymentOverdue(category: AuditCategory): Promise<AuditFinding[]> {
    // Mock: Check for overdue payments
    return [{
      id: generateId('fnd'),
      categoryId: category.id,
      category,
      title: 'Payment overdue: Customer ABC',
      description: 'Invoice INV-2024-0845 is 15 days overdue. Amount: £3,450. No response to reminders.',
      severity: 'high',
      status: 'new',
      impact: {
        financial: 3450,
      },
      evidence: [
        { type: 'invoice', description: 'Invoice sent 45 days ago', value: 3450, documentId: 'INV-2024-0845' },
        { type: 'reminder', description: '3 reminder emails sent', value: 3 },
      ],
      relatedEntities: [
        { type: 'customer', id: 'cust-001', name: 'ABC Construction Ltd' },
        { type: 'invoice', id: 'INV-2024-0845', name: 'Invoice #0845' },
      ],
      suggestedAction: {
        type: 'send-final-notice',
        description: 'Send final payment notice with 7-day deadline',
        urgency: 'today',
      },
      detectedAt: new Date().toISOString(),
    }];
  }

  private async checkComplianceExpiring(category: AuditCategory): Promise<AuditFinding[]> {
    // Mock: Check for expiring compliance
    return [{
      id: generateId('fnd'),
      categoryId: category.id,
      category,
      title: 'VCA Certificate expiring in 14 days',
      description: 'VCA Basis certificate expires on 2024-02-15. Renewal required to continue work.',
      severity: 'critical',
      status: 'new',
      impact: {
        compliance: 'VCA certification required for site access',
      },
      evidence: [
        { type: 'certificate', description: 'Current VCA certificate', documentId: 'cert-vca-001' },
      ],
      relatedEntities: [
        { type: 'employee', id: 'emp-001', name: 'Jan de Vries' },
      ],
      suggestedAction: {
        type: 'schedule-renewal',
        description: 'Schedule VCA renewal exam immediately',
        urgency: 'immediate',
      },
      detectedAt: new Date().toISOString(),
    }];
  }

  private async checkMarginErosion(category: AuditCategory): Promise<AuditFinding[]> {
    return [{
      id: generateId('fnd'),
      categoryId: category.id,
      category,
      title: 'Margin erosion on Job #2024-112',
      description: 'Material costs 18% higher than quoted. Current margin at 12% vs target 25%.',
      severity: 'high',
      status: 'new',
      impact: {
        financial: 1250,
      },
      evidence: [
        { type: 'quote', description: 'Original quote: £8,500', value: 8500 },
        { type: 'actual', description: 'Actual costs: £7,480', value: 7480 },
        { type: 'margin', description: 'Current margin: 12%', value: 12 },
      ],
      relatedEntities: [
        { type: 'job', id: 'job-112', name: 'Kitchen Renovation - Smith' },
      ],
      suggestedAction: {
        type: 'review-pricing',
        description: 'Review material sourcing and consider change order for scope additions',
        urgency: 'this-week',
      },
      detectedAt: new Date().toISOString(),
    }];
  }

  private async checkInvoiceBudgetMismatch(category: AuditCategory): Promise<AuditFinding[]> {
    return [{
      id: generateId('fnd'),
      categoryId: category.id,
      category,
      title: 'Invoice exceeds budget: BuildCo Ltd',
      description: 'Invoice INV-2024-0892 for £23,450 exceeds budget allocation by £1,450 (6.6%).',
      severity: 'high',
      status: 'new',
      impact: {
        financial: 1450,
      },
      evidence: [
        { type: 'invoice', description: 'Invoice amount', value: 23450, documentId: 'INV-2024-0892' },
        { type: 'budget', description: 'Budget allocation', value: 22000 },
        { type: 'variance', description: 'Over budget by', value: 1450 },
      ],
      relatedEntities: [
        { type: 'supplier', id: 'vendor-001', name: 'BuildCo Ltd' },
        { type: 'project', id: 'project-001', name: 'Main Building' },
      ],
      suggestedAction: {
        type: 'request-credit',
        description: 'Request credit note for variance or obtain budget approval',
        urgency: 'today',
        estimatedSavings: 1450,
      },
      detectedAt: new Date().toISOString(),
    }];
  }

  private async checkOverpayments(category: AuditCategory): Promise<AuditFinding[]> {
    return [{
      id: generateId('fnd'),
      categoryId: category.id,
      category,
      title: 'Overpayment detected: Steel brackets',
      description: 'Paying £45/unit vs market rate £38/unit. Total overpayment: £1,050 on 150 units.',
      severity: 'high',
      status: 'new',
      impact: {
        financial: 1050,
      },
      evidence: [
        { type: 'invoice', description: 'Invoiced rate', value: 45 },
        { type: 'market', description: 'Market rate (RSMeans)', value: 38 },
        { type: 'quantity', description: 'Units purchased', value: 150 },
      ],
      relatedEntities: [
        { type: 'supplier', id: 'vendor-001', name: 'BuildCo Ltd' },
      ],
      suggestedAction: {
        type: 'renegotiate-rate',
        description: 'Renegotiate rate for future orders or find alternative supplier',
        urgency: 'this-week',
        estimatedSavings: 1050,
      },
      detectedAt: new Date().toISOString(),
    }];
  }

  private async checkSupplierDrift(category: AuditCategory): Promise<AuditFinding[]> {
    return [{
      id: generateId('fnd'),
      categoryId: category.id,
      category,
      title: 'Supplier reliability declining: MechServ',
      description: 'On-time delivery rate dropped from 92% to 78% over past 3 months. 3 quality issues reported.',
      severity: 'high',
      status: 'new',
      impact: {
        risk: 65,
      },
      evidence: [
        { type: 'metric', description: 'On-time rate 3 months ago', value: 92 },
        { type: 'metric', description: 'On-time rate now', value: 78 },
        { type: 'issues', description: 'Quality issues', value: 3 },
      ],
      relatedEntities: [
        { type: 'supplier', id: 'vendor-002', name: 'MechServ' },
      ],
      suggestedAction: {
        type: 'supplier-review',
        description: 'Schedule supplier performance review meeting',
        urgency: 'this-week',
      },
      detectedAt: new Date().toISOString(),
    }];
  }

  private async checkCriticalPathRisk(category: AuditCategory): Promise<AuditFinding[]> {
    return [{
      id: generateId('fnd'),
      categoryId: category.id,
      category,
      title: 'Critical path activity at risk: MEP Rough-in',
      description: 'Activity has 0 float days remaining. Any delay will impact project completion date.',
      severity: 'critical',
      status: 'new',
      impact: {
        schedule: 5,
        financial: 15000,
      },
      evidence: [
        { type: 'schedule', description: 'Float remaining', value: 0 },
        { type: 'dependency', description: 'Successor activities', value: 8 },
      ],
      relatedEntities: [
        { type: 'project', id: 'project-001', name: 'Main Building' },
      ],
      suggestedAction: {
        type: 'add-resources',
        description: 'Consider adding resources to accelerate or crash activity',
        urgency: 'immediate',
      },
      detectedAt: new Date().toISOString(),
    }];
  }

  private async checkCashflowGapRisk(category: AuditCategory): Promise<AuditFinding[]> {
    return [{
      id: generateId('fnd'),
      categoryId: category.id,
      category,
      title: 'Cash flow gap projected: March 2024',
      description: 'Projected shortfall of £45,000 in March due to payment timing mismatch.',
      severity: 'critical',
      status: 'new',
      impact: {
        financial: 45000,
      },
      evidence: [
        { type: 'projection', description: 'Expected inflows', value: 120000 },
        { type: 'projection', description: 'Expected outflows', value: 165000 },
        { type: 'gap', description: 'Projected shortfall', value: -45000 },
      ],
      relatedEntities: [
        { type: 'project', id: 'project-001', name: 'Main Building' },
        { type: 'project', id: 'project-002', name: 'Office Fit-out' },
      ],
      suggestedAction: {
        type: 'accelerate-collections',
        description: 'Accelerate draw request submission and follow up on outstanding receivables',
        urgency: 'today',
      },
      detectedAt: new Date().toISOString(),
    }];
  }

  // ============================================
  // FINDING MANAGEMENT
  // ============================================

  private initializeMockFindings(): void {
    // Add some initial mock findings for demo
    // These would normally come from actual audit runs
  }

  private addFinding(finding: AuditFinding): void {
    // Check for duplicates
    const existing = this.findings.find(f =>
      f.categoryId === finding.categoryId &&
      f.title === finding.title &&
      f.status !== 'resolved' &&
      f.status !== 'dismissed'
    );

    if (!existing) {
      this.findings.push(finding);
      this.notifySubscribers();
    }
  }

  /**
   * Get findings with optional filters
   */
  getFindings(filters?: AuditFilters): AuditFinding[] {
    let results = [...this.findings];

    if (filters?.roles?.length) {
      results = results.filter(f => filters.roles!.includes(f.category.role));
    }
    if (filters?.categories?.length) {
      results = results.filter(f => filters.categories!.includes(f.categoryId));
    }
    if (filters?.severity?.length) {
      results = results.filter(f => filters.severity!.includes(f.severity));
    }
    if (filters?.status?.length) {
      results = results.filter(f => filters.status!.includes(f.status));
    }
    if (filters?.hasFinancialImpact) {
      results = results.filter(f => f.impact.financial && f.impact.financial > 0);
    }
    if (filters?.minFinancialImpact) {
      results = results.filter(f => (f.impact.financial || 0) >= filters.minFinancialImpact!);
    }

    // Sort by severity then date
    const severityOrder: Record<AuditSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return results.sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
    });
  }

  /**
   * Get findings for a specific role
   */
  getFindingsForRole(role: UserRole): AuditFinding[] {
    return this.getFindings({ roles: [role], status: ['new', 'acknowledged', 'in-review'] });
  }

  /**
   * Get finding by ID
   */
  getFinding(findingId: string): AuditFinding | undefined {
    return this.findings.find(f => f.id === findingId);
  }

  /**
   * Acknowledge a finding
   */
  acknowledgeFinding(findingId: string, userId: string): AuditFinding | undefined {
    const finding = this.findings.find(f => f.id === findingId);
    if (finding && finding.status === 'new') {
      finding.status = 'acknowledged';
      finding.acknowledgedAt = new Date().toISOString();
      finding.acknowledgedBy = userId;
      this.notifySubscribers();
    }
    return finding;
  }

  /**
   * Resolve a finding
   */
  resolveFinding(findingId: string, userId: string, resolution: string): AuditFinding | undefined {
    const finding = this.findings.find(f => f.id === findingId);
    if (finding) {
      finding.status = 'resolved';
      finding.resolvedAt = new Date().toISOString();
      finding.resolvedBy = userId;
      finding.resolution = resolution;
      this.notifySubscribers();
    }
    return finding;
  }

  /**
   * Dismiss a finding
   */
  dismissFinding(findingId: string, reason: string): AuditFinding | undefined {
    const finding = this.findings.find(f => f.id === findingId);
    if (finding) {
      finding.status = 'dismissed';
      finding.dismissedReason = reason;
      this.notifySubscribers();
    }
    return finding;
  }

  // ============================================
  // STATISTICS
  // ============================================

  /**
   * Get audit statistics
   */
  getStats(): AuditStats {
    const newFindings = this.findings.filter(f => f.status === 'new').length;
    const acknowledgedFindings = this.findings.filter(f => f.status === 'acknowledged').length;
    const resolvedFindings = this.findings.filter(f => f.status === 'resolved').length;
    const dismissedFindings = this.findings.filter(f => f.status === 'dismissed').length;

    const bySeverity: Record<AuditSeverity, number> = {
      critical: this.findings.filter(f => f.severity === 'critical' && f.status !== 'resolved').length,
      high: this.findings.filter(f => f.severity === 'high' && f.status !== 'resolved').length,
      medium: this.findings.filter(f => f.severity === 'medium' && f.status !== 'resolved').length,
      low: this.findings.filter(f => f.severity === 'low' && f.status !== 'resolved').length,
    };

    const byRole: Record<UserRole, number> = {
      contractor: this.findings.filter(f => f.category.role === 'contractor' && f.status !== 'resolved').length,
      sitelead: this.findings.filter(f => f.category.role === 'sitelead' && f.status !== 'resolved').length,
      coo: this.findings.filter(f => f.category.role === 'coo' && f.status !== 'resolved').length,
      cfo: this.findings.filter(f => f.category.role === 'cfo' && f.status !== 'resolved').length,
      director: this.findings.filter(f => f.category.role === 'director' && f.status !== 'resolved').length,
    };

    const byCategory: Record<string, number> = {};
    for (const finding of this.findings.filter(f => f.status !== 'resolved')) {
      byCategory[finding.categoryId] = (byCategory[finding.categoryId] || 0) + 1;
    }

    const totalFinancialImpact = this.findings
      .filter(f => f.status !== 'resolved' && f.status !== 'dismissed')
      .reduce((sum, f) => sum + (f.impact.financial || 0), 0);

    const potentialSavings = this.findings
      .filter(f => f.status !== 'resolved' && f.status !== 'dismissed')
      .reduce((sum, f) => sum + (f.suggestedAction?.estimatedSavings || 0), 0);

    return {
      totalFindings: this.findings.length,
      newFindings,
      acknowledgedFindings,
      resolvedFindings,
      dismissedFindings,
      bySeverity,
      byRole,
      byCategory,
      findingsLast7Days: this.findings.filter(f =>
        new Date(f.detectedAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
      ).length,
      findingsLast30Days: this.findings.filter(f =>
        new Date(f.detectedAt).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000
      ).length,
      resolutionRate: this.findings.length > 0 ? (resolvedFindings / this.findings.length) * 100 : 0,
      averageResolutionTime: 48, // Mock: 48 hours average
      totalFinancialImpact,
      potentialSavings,
      realizedSavings: 0,
    };
  }

  /**
   * Get stats for a specific role
   */
  getStatsForRole(role: UserRole): { criticalCount: number; highCount: number; totalCount: number; financialImpact: number } {
    const roleFindings = this.findings.filter(f => f.category.role === role && f.status !== 'resolved');

    return {
      criticalCount: roleFindings.filter(f => f.severity === 'critical').length,
      highCount: roleFindings.filter(f => f.severity === 'high').length,
      totalCount: roleFindings.length,
      financialImpact: roleFindings.reduce((sum, f) => sum + (f.impact.financial || 0), 0),
    };
  }

  // ============================================
  // SUBSCRIPTIONS
  // ============================================

  /**
   * Subscribe to finding updates
   */
  subscribe(callback: (findings: AuditFinding[]) => void): () => void {
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

  // ============================================
  // HELPERS
  // ============================================

  private findCategory(categoryId: AuditCategoryId): AuditCategory | undefined {
    for (const role of Object.keys(AUDIT_CATEGORIES) as UserRole[]) {
      const category = AUDIT_CATEGORIES[role].find(c => c.id === categoryId);
      if (category) return category;
    }
    return undefined;
  }

  /**
   * Get all categories for a role
   */
  getCategoriesForRole(role: UserRole): AuditCategory[] {
    return AUDIT_CATEGORIES[role] || [];
  }

  /**
   * Get audit runs history
   */
  getAuditRuns(): AuditRun[] {
    return [...this.auditRuns];
  }
}

// ============================================
// SINGLETON INSTANCE & HOOKS
// ============================================

export const auditorService = new AuditorService();

// React hooks
import { useState, useEffect, useCallback } from 'react';

export function useAuditFindings(role?: UserRole, filters?: AuditFilters) {
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const effectiveFilters = role ? { ...filters, roles: [role] } : filters;
    setFindings(auditorService.getFindings(effectiveFilters));
    setLoading(false);

    const unsubscribe = auditorService.subscribe(() => {
      setFindings(auditorService.getFindings(effectiveFilters));
    });

    return unsubscribe;
  }, [role, filters]);

  const refresh = useCallback(async () => {
    if (role) {
      setLoading(true);
      await auditorService.runFullAudit(role);
      setLoading(false);
    }
  }, [role]);

  return { findings, loading, refresh };
}

export function useAuditStats(role?: UserRole) {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (role) {
      setStats(auditorService.getStatsForRole(role));
    } else {
      setStats(auditorService.getStats());
    }

    const unsubscribe = auditorService.subscribe(() => {
      if (role) {
        setStats(auditorService.getStatsForRole(role));
      } else {
        setStats(auditorService.getStats());
      }
    });

    return unsubscribe;
  }, [role]);

  return stats;
}

export default auditorService;

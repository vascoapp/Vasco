// =============================================================================
// QUOTE APPROVAL SERVICE
// =============================================================================
// Approval gate for quotes above threshold, team review workflow
// =============================================================================

import { useState, useEffect, useCallback } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'auto-approved';

export interface QuoteApproval {
  id: string;
  quoteId: string;
  quoteReference: string;
  customerName: string;
  amount: number;
  status: ApprovalStatus;
  requestedBy: string;
  requestedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  reason?: string;
  notes?: string;
}

export interface ApprovalRule {
  id: string;
  name: string;
  threshold: number; // Amount above which approval is required
  approvers: string[]; // Role IDs
  enabled: boolean;
}

export interface ApprovalStats {
  pending: number;
  approvedThisWeek: number;
  rejectedThisWeek: number;
  avgApprovalTime: string; // e.g. "2.5u"
}

// =============================================================================
// MOCK DATA
// =============================================================================

const mockRules: ApprovalRule[] = [
  { id: 'rule-1', name: 'Standaard goedkeuring', threshold: 2500, approvers: ['owner', 'foreman'], enabled: true },
  { id: 'rule-2', name: 'Grote opdrachten', threshold: 10000, approvers: ['owner'], enabled: true },
];

const mockApprovals: QuoteApproval[] = [
  {
    id: 'qa-1', quoteId: 'q-100', quoteReference: 'Q-2026-0055', customerName: 'Bakkerij Jansen',
    amount: 3800, status: 'pending', requestedBy: 'Monteur', requestedAt: new Date(Date.now() - 3600000 * 4),
  },
  {
    id: 'qa-2', quoteId: 'q-101', quoteReference: 'Q-2026-0054', customerName: 'Hotel Krasnapolsky',
    amount: 12500, status: 'pending', requestedBy: 'Monteur', requestedAt: new Date(Date.now() - 3600000 * 8),
  },
  {
    id: 'qa-3', quoteId: 'q-99', quoteReference: 'Q-2026-0053', customerName: 'Fam. de Groot',
    amount: 1200, status: 'auto-approved', requestedBy: 'Monteur', requestedAt: new Date(Date.now() - 86400000),
    notes: 'Onder drempel (€2.500)',
  },
  {
    id: 'qa-4', quoteId: 'q-98', quoteReference: 'Q-2026-0052', customerName: 'Kantoor Zuidas',
    amount: 5600, status: 'approved', requestedBy: 'Monteur', requestedAt: new Date(Date.now() - 86400000 * 2),
    reviewedBy: 'Eigenaar', reviewedAt: new Date(Date.now() - 86400000),
  },
];

// =============================================================================
// SERVICE
// =============================================================================

type ApprovalListener = () => void;

class QuoteApprovalService {
  private static instance: QuoteApprovalService;
  private listeners: Set<ApprovalListener> = new Set();
  private approvals: QuoteApproval[] = [...mockApprovals];
  private rules: ApprovalRule[] = [...mockRules];

  static getInstance(): QuoteApprovalService {
    if (!QuoteApprovalService.instance) {
      QuoteApprovalService.instance = new QuoteApprovalService();
    }
    return QuoteApprovalService.instance;
  }

  subscribe(listener: ApprovalListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void { this.listeners.forEach(l => l()); }

  getApprovals(status?: ApprovalStatus): QuoteApproval[] {
    if (status) return this.approvals.filter(a => a.status === status);
    return this.approvals;
  }

  getRules(): ApprovalRule[] { return this.rules; }

  requiresApproval(amount: number): boolean {
    return this.rules.some(r => r.enabled && amount >= r.threshold);
  }

  getApplicableRule(amount: number): ApprovalRule | undefined {
    return this.rules
      .filter(r => r.enabled && amount >= r.threshold)
      .sort((a, b) => b.threshold - a.threshold)[0];
  }

  requestApproval(quoteId: string, quoteReference: string, customerName: string, amount: number, requestedBy: string): QuoteApproval {
    const rule = this.getApplicableRule(amount);
    const approval: QuoteApproval = {
      id: `qa-${Date.now()}`,
      quoteId,
      quoteReference,
      customerName,
      amount,
      status: rule ? 'pending' : 'auto-approved',
      requestedBy,
      requestedAt: new Date(),
      notes: !rule ? `Onder drempel (€${this.rules.filter(r => r.enabled).sort((a, b) => a.threshold - b.threshold)[0]?.threshold.toLocaleString('nl-NL') ?? '0'})` : undefined,
    };
    this.approvals.unshift(approval);
    this.notify();
    return approval;
  }

  approve(id: string, reviewedBy: string, notes?: string): void {
    const a = this.approvals.find(x => x.id === id);
    if (a && a.status === 'pending') {
      a.status = 'approved';
      a.reviewedBy = reviewedBy;
      a.reviewedAt = new Date();
      a.notes = notes;
      this.notify();
    }
  }

  reject(id: string, reviewedBy: string, reason: string): void {
    const a = this.approvals.find(x => x.id === id);
    if (a && a.status === 'pending') {
      a.status = 'rejected';
      a.reviewedBy = reviewedBy;
      a.reviewedAt = new Date();
      a.reason = reason;
      this.notify();
    }
  }

  getStats(): ApprovalStats {
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const pending = this.approvals.filter(a => a.status === 'pending').length;
    const approvedWeek = this.approvals.filter(a => a.status === 'approved' && a.reviewedAt && a.reviewedAt >= weekAgo).length;
    const rejectedWeek = this.approvals.filter(a => a.status === 'rejected' && a.reviewedAt && a.reviewedAt >= weekAgo).length;

    return {
      pending,
      approvedThisWeek: approvedWeek,
      rejectedThisWeek: rejectedWeek,
      avgApprovalTime: '2.5u',
    };
  }
}

export const quoteApprovalService = QuoteApprovalService.getInstance();

// =============================================================================
// HOOKS
// =============================================================================

export function useQuoteApprovals(status?: ApprovalStatus) {
  const [approvals, setApprovals] = useState<QuoteApproval[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setApprovals(quoteApprovalService.getApprovals(status));
    setLoading(false);
    return quoteApprovalService.subscribe(() => setApprovals(quoteApprovalService.getApprovals(status)));
  }, [status]);

  const approve = useCallback((id: string, reviewedBy: string, notes?: string) =>
    quoteApprovalService.approve(id, reviewedBy, notes), []);
  const reject = useCallback((id: string, reviewedBy: string, reason: string) =>
    quoteApprovalService.reject(id, reviewedBy, reason), []);
  const request = useCallback((quoteId: string, ref: string, customer: string, amount: number, by: string) =>
    quoteApprovalService.requestApproval(quoteId, ref, customer, amount, by), []);
  const requiresApproval = useCallback((amount: number) =>
    quoteApprovalService.requiresApproval(amount), []);

  return { approvals, loading, approve, reject, request, requiresApproval };
}

export function useApprovalStats() {
  const [stats, setStats] = useState<ApprovalStats>(quoteApprovalService.getStats());
  useEffect(() => quoteApprovalService.subscribe(() => setStats(quoteApprovalService.getStats())), []);
  return stats;
}

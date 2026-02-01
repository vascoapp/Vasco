// BuildOS Agent Actions with Approval Gates
// Human-in-the-loop pattern for high-stakes automated actions

import type { Country, Currency } from '../types/buildos';

// ============================================
// ACTION TYPES
// ============================================

export type ActionCategory =
  | 'financial'
  | 'contractual'
  | 'compliance'
  | 'communication'
  | 'schedule'
  | 'risk';

export type ActionRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type ActionStatus =
  | 'draft'
  | 'pending-review'
  | 'pending-approval'
  | 'approved'
  | 'rejected'
  | 'executed'
  | 'cancelled'
  | 'expired';

export type ApprovalRole =
  | 'site-lead'
  | 'project-manager'
  | 'coo'
  | 'cfo'
  | 'legal'
  | 'director';

// ============================================
// ACTION DEFINITION
// ============================================

export interface ActionDefinition {
  type: string;
  name: string;
  description: string;
  category: ActionCategory;
  riskLevel: ActionRiskLevel;
  requiredApprovals: ApprovalRole[];
  thresholds?: {
    autoApprove?: number; // Amount below which auto-approve
    escalate?: number; // Amount above which escalate
    currency: Currency;
  };
  validityPeriod: number; // Hours before expiry
  auditRequired: boolean;
}

export const ACTION_DEFINITIONS: ActionDefinition[] = [
  // Financial Actions
  {
    type: 'approve-payment',
    name: 'Approve Payment',
    description: 'Approve invoice or payment certificate for payment',
    category: 'financial',
    riskLevel: 'medium',
    requiredApprovals: ['project-manager'],
    thresholds: {
      autoApprove: 5000,
      escalate: 100000,
      currency: 'GBP',
    },
    validityPeriod: 72,
    auditRequired: true,
  },
  {
    type: 'approve-change-order',
    name: 'Approve Change Order',
    description: 'Approve variation or change order request',
    category: 'financial',
    riskLevel: 'high',
    requiredApprovals: ['project-manager', 'cfo'],
    thresholds: {
      autoApprove: 2500,
      escalate: 50000,
      currency: 'GBP',
    },
    validityPeriod: 48,
    auditRequired: true,
  },
  {
    type: 'release-retention',
    name: 'Release Retention',
    description: 'Release retention payment to contractor',
    category: 'financial',
    riskLevel: 'high',
    requiredApprovals: ['project-manager', 'cfo'],
    validityPeriod: 72,
    auditRequired: true,
  },
  {
    type: 'draw-request',
    name: 'Submit Lender Draw',
    description: 'Submit draw request to development lender',
    category: 'financial',
    riskLevel: 'critical',
    requiredApprovals: ['cfo', 'director'],
    validityPeriod: 24,
    auditRequired: true,
  },
  // Contractual Actions
  {
    type: 'issue-instruction',
    name: 'Issue Contract Instruction',
    description: 'Issue architect/contract administrator instruction',
    category: 'contractual',
    riskLevel: 'medium',
    requiredApprovals: ['project-manager'],
    validityPeriod: 48,
    auditRequired: true,
  },
  {
    type: 'certify-completion',
    name: 'Certify Practical Completion',
    description: 'Issue practical completion certificate',
    category: 'contractual',
    riskLevel: 'critical',
    requiredApprovals: ['project-manager', 'coo', 'legal'],
    validityPeriod: 72,
    auditRequired: true,
  },
  {
    type: 'terminate-contract',
    name: 'Terminate Contract',
    description: 'Issue contract termination notice',
    category: 'contractual',
    riskLevel: 'critical',
    requiredApprovals: ['coo', 'cfo', 'legal', 'director'],
    validityPeriod: 24,
    auditRequired: true,
  },
  // Compliance Actions
  {
    type: 'submit-permit',
    name: 'Submit Permit Application',
    description: 'Submit planning or building control application',
    category: 'compliance',
    riskLevel: 'high',
    requiredApprovals: ['project-manager', 'director'],
    validityPeriod: 48,
    auditRequired: true,
  },
  {
    type: 'discharge-condition',
    name: 'Submit Condition Discharge',
    description: 'Submit planning condition discharge application',
    category: 'compliance',
    riskLevel: 'medium',
    requiredApprovals: ['project-manager'],
    validityPeriod: 48,
    auditRequired: true,
  },
  {
    type: 's106-payment',
    name: 'Authorize S106 Payment',
    description: 'Authorize Section 106 obligation payment',
    category: 'compliance',
    riskLevel: 'high',
    requiredApprovals: ['cfo', 'director'],
    validityPeriod: 72,
    auditRequired: true,
  },
  // Communication Actions
  {
    type: 'send-investor-update',
    name: 'Send Investor Update',
    description: 'Send monthly update to investors/stakeholders',
    category: 'communication',
    riskLevel: 'medium',
    requiredApprovals: ['cfo'],
    validityPeriod: 24,
    auditRequired: false,
  },
  {
    type: 'send-authority-letter',
    name: 'Send Authority Communication',
    description: 'Send formal letter to planning/building authority',
    category: 'communication',
    riskLevel: 'medium',
    requiredApprovals: ['project-manager'],
    validityPeriod: 48,
    auditRequired: true,
  },
  // Schedule Actions
  {
    type: 'approve-reforecast',
    name: 'Approve Schedule Reforecast',
    description: 'Approve updated project schedule',
    category: 'schedule',
    riskLevel: 'medium',
    requiredApprovals: ['project-manager', 'coo'],
    validityPeriod: 72,
    auditRequired: true,
  },
  {
    type: 'escalate-delay',
    name: 'Escalate Critical Delay',
    description: 'Escalate critical path delay to stakeholders',
    category: 'schedule',
    riskLevel: 'high',
    requiredApprovals: ['coo'],
    validityPeriod: 24,
    auditRequired: false,
  },
  // Risk Actions
  {
    type: 'escalate-risk',
    name: 'Escalate Risk',
    description: 'Escalate high-priority risk to leadership',
    category: 'risk',
    riskLevel: 'high',
    requiredApprovals: ['project-manager'],
    validityPeriod: 24,
    auditRequired: false,
  },
  {
    type: 'trigger-insurance',
    name: 'Trigger Insurance Claim',
    description: 'Initiate insurance claim notification',
    category: 'risk',
    riskLevel: 'critical',
    requiredApprovals: ['cfo', 'legal', 'director'],
    validityPeriod: 48,
    auditRequired: true,
  },
];

// ============================================
// ACTION INSTANCE
// ============================================

export interface ApprovalRecord {
  role: ApprovalRole;
  userId: string;
  userName: string;
  decision: 'approved' | 'rejected' | 'pending';
  decisionDate?: string;
  comments?: string;
}

export interface ActionInstance {
  id: string;
  type: string;
  projectId: string;
  // Content
  title: string;
  description: string;
  generatedContent?: string; // AI-generated document/content
  attachments?: { name: string; uri: string }[];
  // Metadata
  amount?: number;
  currency?: Currency;
  linkedEntities?: { type: string; id: string }[];
  // Status
  status: ActionStatus;
  riskLevel: ActionRiskLevel;
  // Approvals
  requiredApprovals: ApprovalRole[];
  approvals: ApprovalRecord[];
  // Timestamps
  createdAt: string;
  createdBy: string;
  submittedAt?: string;
  expiresAt?: string;
  executedAt?: string;
  // Audit
  auditTrail: {
    timestamp: string;
    action: string;
    userId: string;
    details?: string;
  }[];
}

// ============================================
// ACTION SERVICE
// ============================================

export function getActionDefinition(type: string): ActionDefinition | undefined {
  return ACTION_DEFINITIONS.find((d) => d.type === type);
}

export function createAction(
  type: string,
  projectId: string,
  userId: string,
  options: {
    title: string;
    description: string;
    generatedContent?: string;
    amount?: number;
    currency?: Currency;
    linkedEntities?: { type: string; id: string }[];
  }
): ActionInstance {
  const definition = getActionDefinition(type);
  if (!definition) {
    throw new Error(`Unknown action type: ${type}`);
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + definition.validityPeriod * 60 * 60 * 1000);

  return {
    id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    projectId,
    title: options.title,
    description: options.description,
    generatedContent: options.generatedContent,
    amount: options.amount,
    currency: options.currency,
    linkedEntities: options.linkedEntities,
    status: 'draft',
    riskLevel: definition.riskLevel,
    requiredApprovals: definition.requiredApprovals,
    approvals: definition.requiredApprovals.map((role) => ({
      role,
      userId: '',
      userName: '',
      decision: 'pending',
    })),
    createdAt: now.toISOString(),
    createdBy: userId,
    expiresAt: expiresAt.toISOString(),
    auditTrail: [
      {
        timestamp: now.toISOString(),
        action: 'created',
        userId,
        details: `Action created: ${options.title}`,
      },
    ],
  };
}

export function submitForApproval(
  action: ActionInstance,
  userId: string
): ActionInstance {
  const now = new Date().toISOString();

  return {
    ...action,
    status: 'pending-approval',
    submittedAt: now,
    auditTrail: [
      ...action.auditTrail,
      {
        timestamp: now,
        action: 'submitted',
        userId,
        details: 'Submitted for approval',
      },
    ],
  };
}

export function recordApproval(
  action: ActionInstance,
  role: ApprovalRole,
  userId: string,
  userName: string,
  decision: 'approved' | 'rejected',
  comments?: string
): ActionInstance {
  const now = new Date().toISOString();

  const updatedApprovals = action.approvals.map((a) =>
    a.role === role
      ? {
          ...a,
          userId,
          userName,
          decision,
          decisionDate: now,
          comments,
        }
      : a
  );

  // Check if all approvals are complete
  const allApproved = updatedApprovals.every((a) => a.decision === 'approved');
  const anyRejected = updatedApprovals.some((a) => a.decision === 'rejected');

  let newStatus: ActionStatus = action.status;
  if (anyRejected) {
    newStatus = 'rejected';
  } else if (allApproved) {
    newStatus = 'approved';
  }

  return {
    ...action,
    status: newStatus,
    approvals: updatedApprovals,
    auditTrail: [
      ...action.auditTrail,
      {
        timestamp: now,
        action: `approval-${decision}`,
        userId,
        details: `${role}: ${decision}${comments ? ` - ${comments}` : ''}`,
      },
    ],
  };
}

export function executeAction(
  action: ActionInstance,
  userId: string
): ActionInstance {
  if (action.status !== 'approved') {
    throw new Error('Action must be approved before execution');
  }

  const now = new Date().toISOString();

  return {
    ...action,
    status: 'executed',
    executedAt: now,
    auditTrail: [
      ...action.auditTrail,
      {
        timestamp: now,
        action: 'executed',
        userId,
        details: 'Action executed',
      },
    ],
  };
}

export function cancelAction(
  action: ActionInstance,
  userId: string,
  reason: string
): ActionInstance {
  const now = new Date().toISOString();

  return {
    ...action,
    status: 'cancelled',
    auditTrail: [
      ...action.auditTrail,
      {
        timestamp: now,
        action: 'cancelled',
        userId,
        details: `Cancelled: ${reason}`,
      },
    ],
  };
}

// ============================================
// APPROVAL GATE CHECKS
// ============================================

export function checkAutoApproval(action: ActionInstance): boolean {
  const definition = getActionDefinition(action.type);
  if (!definition?.thresholds?.autoApprove) return false;

  if (action.amount && action.amount <= definition.thresholds.autoApprove) {
    return true;
  }
  return false;
}

export function checkEscalation(action: ActionInstance): ApprovalRole[] {
  const definition = getActionDefinition(action.type);
  const additionalApprovers: ApprovalRole[] = [];

  if (definition?.thresholds?.escalate && action.amount) {
    if (action.amount >= definition.thresholds.escalate) {
      // Add director approval for high-value actions
      if (!action.requiredApprovals.includes('director')) {
        additionalApprovers.push('director');
      }
    }
  }

  return additionalApprovers;
}

export function canUserApprove(
  action: ActionInstance,
  userRoles: ApprovalRole[]
): boolean {
  // Find pending approvals that match user's roles
  const pendingApprovals = action.approvals.filter((a) => a.decision === 'pending');
  return pendingApprovals.some((a) => userRoles.includes(a.role));
}

// ============================================
// DASHBOARD DATA
// ============================================

export interface ActionDashboard {
  pendingActions: ActionInstance[];
  recentlyExecuted: ActionInstance[];
  upcomingExpiry: ActionInstance[];
  byCategory: Record<ActionCategory, number>;
  byRiskLevel: Record<ActionRiskLevel, number>;
  myPendingApprovals: ActionInstance[];
}

export function generateActionDashboard(
  actions: ActionInstance[],
  userRoles: ApprovalRole[]
): ActionDashboard {
  const now = new Date();

  const pendingActions = actions.filter(
    (a) => a.status === 'pending-approval' || a.status === 'pending-review'
  );

  const recentlyExecuted = actions
    .filter((a) => a.status === 'executed')
    .sort((a, b) => new Date(b.executedAt!).getTime() - new Date(a.executedAt!).getTime())
    .slice(0, 5);

  const upcomingExpiry = pendingActions
    .filter((a) => {
      if (!a.expiresAt) return false;
      const expiry = new Date(a.expiresAt);
      const hoursRemaining = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60);
      return hoursRemaining > 0 && hoursRemaining <= 24;
    })
    .sort((a, b) => new Date(a.expiresAt!).getTime() - new Date(b.expiresAt!).getTime());

  const byCategory = pendingActions.reduce((acc, a) => {
    const def = getActionDefinition(a.type);
    if (def) {
      acc[def.category] = (acc[def.category] || 0) + 1;
    }
    return acc;
  }, {} as Record<ActionCategory, number>);

  const byRiskLevel = pendingActions.reduce((acc, a) => {
    acc[a.riskLevel] = (acc[a.riskLevel] || 0) + 1;
    return acc;
  }, {} as Record<ActionRiskLevel, number>);

  const myPendingApprovals = pendingActions.filter((a) => canUserApprove(a, userRoles));

  return {
    pendingActions,
    recentlyExecuted,
    upcomingExpiry,
    byCategory,
    byRiskLevel,
    myPendingApprovals,
  };
}

// BuildOS Permit Tracker
// Comprehensive permit tracking with alerts, deadlines, and country-specific handling

import type { Permit, PermitCondition, Country } from '../types/buildos';
import {
  PERMIT_CLOCKS,
  calculatePermitStatus,
  calculateTargetDecisionDate,
  getPermitClock,
  type PermitClockConfig,
} from './countryModules';

// ============================================
// ALERT TYPES
// ============================================

export type PermitAlertSeverity = 'info' | 'warning' | 'critical';

export type PermitAlertType =
  | 'decision-due-soon'
  | 'decision-overdue'
  | 'condition-due-soon'
  | 'condition-overdue'
  | 'clock-extension'
  | 'appeal-deadline'
  | 'information-requested';

export interface PermitAlert {
  id: string;
  permitId: string;
  type: PermitAlertType;
  severity: PermitAlertSeverity;
  title: string;
  description: string;
  dueDate?: string;
  daysRemaining?: number;
  actionRequired: string;
  createdAt: string;
}

// ============================================
// PERMIT TIMELINE
// ============================================

export interface PermitTimelineEvent {
  date: string;
  type: 'submission' | 'validation' | 'consultation' | 'committee' | 'decision' | 'condition' | 'appeal';
  description: string;
  completed: boolean;
  outcome?: string;
}

export interface PermitTimeline {
  permitId: string;
  submissionDate: string;
  validationDate?: string;
  targetDecisionDate: string;
  actualDecisionDate?: string;
  clockDays: number;
  clockPaused: boolean;
  clockPausedDays: number;
  events: PermitTimelineEvent[];
}

// ============================================
// PERMIT SUMMARY
// ============================================

export interface PermitSummary {
  permit: Permit;
  clockConfig?: PermitClockConfig;
  status: ReturnType<typeof calculatePermitStatus>;
  alerts: PermitAlert[];
  conditionsSummary: {
    total: number;
    discharged: number;
    pending: number;
    overdue: number;
  };
  timeline?: PermitTimeline;
}

// ============================================
// ALERT GENERATION
// ============================================

function generateAlertId(permitId: string, type: PermitAlertType): string {
  return `${permitId}-${type}-${Date.now()}`;
}

export function generatePermitAlerts(permit: Permit): PermitAlert[] {
  const alerts: PermitAlert[] = [];
  const now = new Date().toISOString().split('T')[0];

  // Check decision deadline
  if (permit.submissionDate && permit.targetDecisionDate && !permit.actualDecisionDate) {
    const status = calculatePermitStatus(permit.submissionDate, permit.targetDecisionDate, now);

    if (status.status === 'overdue') {
      alerts.push({
        id: generateAlertId(permit.id, 'decision-overdue'),
        permitId: permit.id,
        type: 'decision-overdue',
        severity: 'critical',
        title: `${permit.type} decision overdue`,
        description: `Decision is ${Math.abs(status.daysRemaining)} days past statutory deadline`,
        dueDate: permit.targetDecisionDate,
        daysRemaining: status.daysRemaining,
        actionRequired: 'Follow up with authority immediately or consider appeal',
        createdAt: now,
      });
    } else if (status.daysRemaining <= 7) {
      alerts.push({
        id: generateAlertId(permit.id, 'decision-due-soon'),
        permitId: permit.id,
        type: 'decision-due-soon',
        severity: 'warning',
        title: `${permit.type} decision due in ${status.daysRemaining} days`,
        description: `Statutory deadline approaching - target: ${permit.targetDecisionDate}`,
        dueDate: permit.targetDecisionDate,
        daysRemaining: status.daysRemaining,
        actionRequired: 'Contact authority for update on determination',
        createdAt: now,
      });
    }
  }

  // Check condition deadlines
  for (const condition of permit.conditions) {
    if (!condition.dischargedDate && condition.triggerPoint) {
      // Parse trigger points to identify urgent conditions
      const triggerLower = condition.triggerPoint.toLowerCase();
      if (triggerLower.includes('before commencement') || triggerLower.includes('pre-commencement')) {
        alerts.push({
          id: generateAlertId(permit.id, 'condition-due-soon'),
          permitId: permit.id,
          type: 'condition-due-soon',
          severity: 'warning',
          title: 'Pre-commencement condition pending',
          description: condition.description,
          actionRequired: 'Discharge before works commence',
          createdAt: now,
        });
      }
    }
  }

  // Check for information requested status
  if (permit.status === 'information-requested') {
    alerts.push({
      id: generateAlertId(permit.id, 'information-requested'),
      permitId: permit.id,
      type: 'information-requested',
      severity: 'warning',
      title: 'Additional information requested',
      description: `Authority has requested additional information for ${permit.type}`,
      actionRequired: 'Provide requested information to restart clock',
      createdAt: now,
    });
  }

  return alerts;
}

// ============================================
// CONDITION TRACKING
// ============================================

export interface ConditionStatus {
  condition: PermitCondition;
  permitId: string;
  permitType: string;
  status: 'pending' | 'in-progress' | 'discharged' | 'overdue';
  priority: 'high' | 'medium' | 'low';
}

export function getConditionsByStatus(permits: Permit[]): {
  pending: ConditionStatus[];
  discharged: ConditionStatus[];
  overdue: ConditionStatus[];
} {
  const pending: ConditionStatus[] = [];
  const discharged: ConditionStatus[] = [];
  const overdue: ConditionStatus[] = [];

  for (const permit of permits) {
    for (const condition of permit.conditions) {
      const conditionStatus: ConditionStatus = {
        condition,
        permitId: permit.id,
        permitType: permit.type,
        status: condition.dischargedDate ? 'discharged' : 'pending',
        priority: condition.triggerPoint?.toLowerCase().includes('pre-commencement') ? 'high' : 'medium',
      };

      if (condition.dischargedDate) {
        discharged.push(conditionStatus);
      } else {
        pending.push(conditionStatus);
      }
    }
  }

  // Sort pending by priority
  pending.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return { pending, discharged, overdue };
}

// ============================================
// PERMIT SUMMARY GENERATION
// ============================================

export function generatePermitSummary(permit: Permit): PermitSummary {
  const now = new Date().toISOString().split('T')[0];
  const clockConfig = PERMIT_CLOCKS.find(
    (c) => c.country === getCountryFromPermit(permit) && c.permitType.includes(permit.type)
  );

  let status: ReturnType<typeof calculatePermitStatus> = {
    daysElapsed: 0,
    daysRemaining: 0,
    percentElapsed: 0,
    status: 'on-track',
  };

  if (permit.submissionDate && permit.targetDecisionDate) {
    status = calculatePermitStatus(permit.submissionDate, permit.targetDecisionDate, now);
  }

  const alerts = generatePermitAlerts(permit);

  const conditionsSummary = {
    total: permit.conditions.length,
    discharged: permit.conditions.filter((c) => c.dischargedDate).length,
    pending: permit.conditions.filter((c) => !c.dischargedDate).length,
    overdue: 0, // Would need deadline info to calculate
  };

  return {
    permit,
    clockConfig,
    status,
    alerts,
    conditionsSummary,
  };
}

// ============================================
// COUNTRY-SPECIFIC HELPERS
// ============================================

function getCountryFromPermit(permit: Permit): Country {
  // Infer country from permit type
  if (permit.type === 'planning' || permit.type === 'building-control') {
    return 'UK';
  }
  if (permit.type === 'omgevingsvergunning') {
    return 'NL';
  }
  if (permit.type === 'bouwvergunning') {
    return 'DE';
  }
  return 'UK'; // Default
}

// ============================================
// UK-SPECIFIC: S106 & CIL TRACKING
// ============================================

export interface S106Obligation {
  id: string;
  permitId: string;
  category: 'affordable-housing' | 'education' | 'highways' | 'open-space' | 'healthcare' | 'other';
  description: string;
  financialObligation?: number;
  inKindObligation?: string;
  triggerPoint: string;
  dueDate?: string;
  status: 'pending' | 'partially-discharged' | 'discharged';
  paidAmount?: number;
}

export interface CILCalculation {
  permitId: string;
  localAuthority: string;
  zone: string;
  useClass: string;
  grossInternalArea: number; // sqm
  exemptArea: number; // sqm
  chargeableArea: number; // sqm
  cilRate: number; // £ per sqm
  indexation: number;
  totalCharge: number;
  exemptions?: {
    type: string;
    area: number;
    value: number;
  }[];
  reliefClaimed?: {
    type: 'social-housing' | 'charitable' | 'self-build';
    value: number;
  };
  paymentSchedule?: {
    dueDate: string;
    amount: number;
    paid: boolean;
  }[];
}

export function calculateCIL(
  grossArea: number,
  cilRate: number,
  exemptArea: number = 0,
  indexation: number = 1.0
): { chargeableArea: number; baseCharge: number; indexedCharge: number } {
  const chargeableArea = Math.max(0, grossArea - exemptArea);
  const baseCharge = chargeableArea * cilRate;
  const indexedCharge = baseCharge * indexation;

  return {
    chargeableArea,
    baseCharge,
    indexedCharge,
  };
}

// ============================================
// DASHBOARD DATA
// ============================================

export interface PermitDashboardData {
  totalPermits: number;
  byStatus: {
    pending: number;
    approved: number;
    approvedWithConditions: number;
    rejected: number;
    underReview: number;
  };
  urgentAlerts: PermitAlert[];
  upcomingDeadlines: {
    permitId: string;
    permitType: string;
    deadline: string;
    daysRemaining: number;
    type: 'decision' | 'condition';
  }[];
  conditionsProgress: {
    total: number;
    discharged: number;
    percentComplete: number;
  };
}

export function generatePermitDashboard(permits: Permit[]): PermitDashboardData {
  const summaries = permits.map(generatePermitSummary);

  const byStatus = {
    pending: permits.filter((p) => p.status === 'submitted' || p.status === 'under-review').length,
    approved: permits.filter((p) => p.status === 'approved').length,
    approvedWithConditions: permits.filter((p) => p.status === 'approved-with-conditions').length,
    rejected: permits.filter((p) => p.status === 'rejected').length,
    underReview: permits.filter((p) => p.status === 'under-review').length,
  };

  const allAlerts = summaries.flatMap((s) => s.alerts);
  const urgentAlerts = allAlerts.filter((a) => a.severity === 'critical' || a.severity === 'warning');

  const upcomingDeadlines = summaries
    .filter((s) => s.status.daysRemaining > 0 && s.status.daysRemaining <= 14)
    .map((s) => ({
      permitId: s.permit.id,
      permitType: s.permit.type,
      deadline: s.permit.targetDecisionDate || '',
      daysRemaining: s.status.daysRemaining,
      type: 'decision' as const,
    }))
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  const totalConditions = permits.reduce((sum, p) => sum + p.conditions.length, 0);
  const dischargedConditions = permits.reduce(
    (sum, p) => sum + p.conditions.filter((c) => c.dischargedDate).length,
    0
  );

  return {
    totalPermits: permits.length,
    byStatus,
    urgentAlerts,
    upcomingDeadlines,
    conditionsProgress: {
      total: totalConditions,
      discharged: dischargedConditions,
      percentComplete: totalConditions > 0 ? dischargedConditions / totalConditions : 1,
    },
  };
}

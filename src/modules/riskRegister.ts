// BuildOS Risk Register
// Comprehensive risk tracking with escalation workflows

import type { Currency } from '../types/buildos';

// ============================================
// RISK TYPES
// ============================================

export type RiskCategory =
  | 'schedule'
  | 'cost'
  | 'quality'
  | 'safety'
  | 'regulatory'
  | 'commercial'
  | 'environmental'
  | 'stakeholder'
  | 'supply-chain'
  | 'weather';

export type RiskProbability = 'rare' | 'unlikely' | 'possible' | 'likely' | 'almost-certain';
export type RiskImpact = 'negligible' | 'minor' | 'moderate' | 'major' | 'catastrophic';
export type RiskStatus = 'open' | 'mitigating' | 'monitoring' | 'closed' | 'escalated';
export type RiskTrend = 'improving' | 'stable' | 'worsening';

// ============================================
// RISK SCORING
// ============================================

const PROBABILITY_SCORES: Record<RiskProbability, number> = {
  'rare': 1,
  'unlikely': 2,
  'possible': 3,
  'likely': 4,
  'almost-certain': 5,
};

const IMPACT_SCORES: Record<RiskImpact, number> = {
  'negligible': 1,
  'minor': 2,
  'moderate': 3,
  'major': 4,
  'catastrophic': 5,
};

export type RiskRating = 'low' | 'medium' | 'high' | 'critical';

export function calculateRiskScore(probability: RiskProbability, impact: RiskImpact): number {
  return PROBABILITY_SCORES[probability] * IMPACT_SCORES[impact];
}

export function getRiskRating(score: number): RiskRating {
  if (score <= 4) return 'low';
  if (score <= 9) return 'medium';
  if (score <= 16) return 'high';
  return 'critical';
}

// ============================================
// RISK DEFINITION
// ============================================

export interface RiskMitigation {
  id: string;
  description: string;
  owner: string;
  dueDate: string;
  status: 'planned' | 'in-progress' | 'completed' | 'ineffective';
  effectivenessRating?: number; // 1-5
}

export interface RiskEvent {
  id: string;
  timestamp: string;
  type: 'created' | 'updated' | 'escalated' | 'mitigated' | 'closed' | 'comment';
  userId: string;
  details: string;
}

export interface Risk {
  id: string;
  projectId: string;
  // Identification
  title: string;
  description: string;
  category: RiskCategory;
  // Assessment
  probability: RiskProbability;
  impact: RiskImpact;
  score: number;
  rating: RiskRating;
  // Financial impact
  costImpactMin?: number;
  costImpactMax?: number;
  scheduleImpactDays?: number;
  currency?: Currency;
  // Status
  status: RiskStatus;
  trend: RiskTrend;
  // Ownership
  owner: string;
  identifiedBy: string;
  identifiedDate: string;
  lastReviewDate: string;
  nextReviewDate: string;
  // Mitigation
  mitigationStrategy: string;
  mitigations: RiskMitigation[];
  contingencyPlan?: string;
  // Response triggers
  earlyWarningIndicators: string[];
  escalationTrigger?: string;
  // Residual risk
  residualProbability?: RiskProbability;
  residualImpact?: RiskImpact;
  residualScore?: number;
  // History
  events: RiskEvent[];
  linkedRisks?: string[];
}

// ============================================
// RISK SERVICE
// ============================================

export function createRisk(
  projectId: string,
  userId: string,
  data: {
    title: string;
    description: string;
    category: RiskCategory;
    probability: RiskProbability;
    impact: RiskImpact;
    owner: string;
    mitigationStrategy: string;
    costImpactMin?: number;
    costImpactMax?: number;
    scheduleImpactDays?: number;
    currency?: Currency;
  }
): Risk {
  const now = new Date();
  const nextReview = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 2 weeks
  const score = calculateRiskScore(data.probability, data.impact);

  return {
    id: `risk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    projectId,
    title: data.title,
    description: data.description,
    category: data.category,
    probability: data.probability,
    impact: data.impact,
    score,
    rating: getRiskRating(score),
    costImpactMin: data.costImpactMin,
    costImpactMax: data.costImpactMax,
    scheduleImpactDays: data.scheduleImpactDays,
    currency: data.currency,
    status: 'open',
    trend: 'stable',
    owner: data.owner,
    identifiedBy: userId,
    identifiedDate: now.toISOString(),
    lastReviewDate: now.toISOString(),
    nextReviewDate: nextReview.toISOString(),
    mitigationStrategy: data.mitigationStrategy,
    mitigations: [],
    earlyWarningIndicators: [],
    events: [
      {
        id: `event-${Date.now()}`,
        timestamp: now.toISOString(),
        type: 'created',
        userId,
        details: 'Risk identified and registered',
      },
    ],
  };
}

export function updateRiskAssessment(
  risk: Risk,
  userId: string,
  probability: RiskProbability,
  impact: RiskImpact,
  comments?: string
): Risk {
  const now = new Date().toISOString();
  const score = calculateRiskScore(probability, impact);
  const previousScore = risk.score;

  let trend: RiskTrend = 'stable';
  if (score < previousScore) trend = 'improving';
  if (score > previousScore) trend = 'worsening';

  return {
    ...risk,
    probability,
    impact,
    score,
    rating: getRiskRating(score),
    trend,
    lastReviewDate: now,
    events: [
      ...risk.events,
      {
        id: `event-${Date.now()}`,
        timestamp: now,
        type: 'updated',
        userId,
        details: `Assessment updated: ${risk.rating} -> ${getRiskRating(score)}${comments ? `. ${comments}` : ''}`,
      },
    ],
  };
}

export function escalateRisk(risk: Risk, userId: string, reason: string): Risk {
  const now = new Date().toISOString();

  return {
    ...risk,
    status: 'escalated',
    events: [
      ...risk.events,
      {
        id: `event-${Date.now()}`,
        timestamp: now,
        type: 'escalated',
        userId,
        details: `Risk escalated: ${reason}`,
      },
    ],
  };
}

export function addMitigation(
  risk: Risk,
  userId: string,
  mitigation: Omit<RiskMitigation, 'id'>
): Risk {
  const now = new Date().toISOString();
  const newMitigation: RiskMitigation = {
    ...mitigation,
    id: `mit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  };

  return {
    ...risk,
    mitigations: [...risk.mitigations, newMitigation],
    status: risk.status === 'open' ? 'mitigating' : risk.status,
    events: [
      ...risk.events,
      {
        id: `event-${Date.now()}`,
        timestamp: now,
        type: 'mitigated',
        userId,
        details: `Mitigation added: ${mitigation.description}`,
      },
    ],
  };
}

export function closeRisk(risk: Risk, userId: string, reason: string): Risk {
  const now = new Date().toISOString();

  return {
    ...risk,
    status: 'closed',
    events: [
      ...risk.events,
      {
        id: `event-${Date.now()}`,
        timestamp: now,
        type: 'closed',
        userId,
        details: `Risk closed: ${reason}`,
      },
    ],
  };
}

// ============================================
// RISK DASHBOARD
// ============================================

export interface RiskDashboardData {
  totalRisks: number;
  openRisks: number;
  byRating: Record<RiskRating, number>;
  byCategory: Record<RiskCategory, number>;
  byTrend: Record<RiskTrend, number>;
  criticalRisks: Risk[];
  worseningRisks: Risk[];
  overdueMitigations: { risk: Risk; mitigation: RiskMitigation }[];
  upcomingReviews: Risk[];
  totalCostExposure: { min: number; max: number };
  totalScheduleExposure: number;
}

export function generateRiskDashboard(risks: Risk[]): RiskDashboardData {
  const now = new Date();
  const openRisks = risks.filter((r) => r.status !== 'closed');

  const byRating = openRisks.reduce((acc, r) => {
    acc[r.rating] = (acc[r.rating] || 0) + 1;
    return acc;
  }, {} as Record<RiskRating, number>);

  const byCategory = openRisks.reduce((acc, r) => {
    acc[r.category] = (acc[r.category] || 0) + 1;
    return acc;
  }, {} as Record<RiskCategory, number>);

  const byTrend = openRisks.reduce((acc, r) => {
    acc[r.trend] = (acc[r.trend] || 0) + 1;
    return acc;
  }, {} as Record<RiskTrend, number>);

  const criticalRisks = openRisks
    .filter((r) => r.rating === 'critical' || r.rating === 'high')
    .sort((a, b) => b.score - a.score);

  const worseningRisks = openRisks
    .filter((r) => r.trend === 'worsening')
    .sort((a, b) => b.score - a.score);

  const overdueMitigations: { risk: Risk; mitigation: RiskMitigation }[] = [];
  for (const risk of openRisks) {
    for (const mitigation of risk.mitigations) {
      if (
        mitigation.status !== 'completed' &&
        mitigation.status !== 'ineffective' &&
        new Date(mitigation.dueDate) < now
      ) {
        overdueMitigations.push({ risk, mitigation });
      }
    }
  }

  const upcomingReviews = openRisks
    .filter((r) => {
      const reviewDate = new Date(r.nextReviewDate);
      const daysUntil = (reviewDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return daysUntil >= 0 && daysUntil <= 7;
    })
    .sort((a, b) => new Date(a.nextReviewDate).getTime() - new Date(b.nextReviewDate).getTime());

  const totalCostExposure = openRisks.reduce(
    (acc, r) => ({
      min: acc.min + (r.costImpactMin || 0),
      max: acc.max + (r.costImpactMax || 0),
    }),
    { min: 0, max: 0 }
  );

  const totalScheduleExposure = openRisks.reduce(
    (acc, r) => acc + (r.scheduleImpactDays || 0),
    0
  );

  return {
    totalRisks: risks.length,
    openRisks: openRisks.length,
    byRating,
    byCategory,
    byTrend,
    criticalRisks,
    worseningRisks,
    overdueMitigations,
    upcomingReviews,
    totalCostExposure,
    totalScheduleExposure,
  };
}

// ============================================
// RISK REPORT GENERATION
// ============================================

export function generateRiskReport(risks: Risk[], projectName: string): string {
  const dashboard = generateRiskDashboard(risks);
  const now = new Date().toISOString().split('T')[0];

  return `
RISK REGISTER REPORT
${'='.repeat(50)}
Project: ${projectName}
Report Date: ${now}

EXECUTIVE SUMMARY
-----------------
Total Risks Registered: ${dashboard.totalRisks}
Open Risks: ${dashboard.openRisks}
Critical/High Risks: ${(dashboard.byRating['critical'] || 0) + (dashboard.byRating['high'] || 0)}

RISK PROFILE
------------
Critical: ${dashboard.byRating['critical'] || 0}
High: ${dashboard.byRating['high'] || 0}
Medium: ${dashboard.byRating['medium'] || 0}
Low: ${dashboard.byRating['low'] || 0}

TREND ANALYSIS
--------------
Improving: ${dashboard.byTrend['improving'] || 0}
Stable: ${dashboard.byTrend['stable'] || 0}
Worsening: ${dashboard.byTrend['worsening'] || 0}

FINANCIAL EXPOSURE
------------------
Cost Exposure Range: ${dashboard.totalCostExposure.min.toLocaleString()} - ${dashboard.totalCostExposure.max.toLocaleString()}
Schedule Exposure: ${dashboard.totalScheduleExposure} days

TOP RISKS
---------
${dashboard.criticalRisks.slice(0, 5).map((r, i) => `
${i + 1}. ${r.title}
   Rating: ${r.rating.toUpperCase()} (Score: ${r.score})
   Category: ${r.category}
   Owner: ${r.owner}
   Trend: ${r.trend}
   Mitigation: ${r.mitigationStrategy}
`).join('')}

WORSENING RISKS
---------------
${dashboard.worseningRisks.length > 0 ?
  dashboard.worseningRisks.slice(0, 3).map(r => `- ${r.title} (${r.rating})`).join('\n') :
  'No worsening risks identified'}

OVERDUE MITIGATIONS (${dashboard.overdueMitigations.length})
${dashboard.overdueMitigations.length > 0 ?
  dashboard.overdueMitigations.slice(0, 5).map(({ risk, mitigation }) =>
    `- ${risk.title}: ${mitigation.description} (Due: ${mitigation.dueDate})`
  ).join('\n') :
  'No overdue mitigations'}

UPCOMING REVIEWS
----------------
${dashboard.upcomingReviews.length > 0 ?
  dashboard.upcomingReviews.map(r => `- ${r.title}: ${r.nextReviewDate}`).join('\n') :
  'No reviews due in next 7 days'}

RECOMMENDATIONS
---------------
${dashboard.worseningRisks.length > 0 ? '1. Address worsening risks as priority' : ''}
${dashboard.overdueMitigations.length > 0 ? '2. Complete overdue mitigation actions' : ''}
${(dashboard.byRating['critical'] || 0) > 0 ? '3. Schedule review of critical risks with leadership' : ''}
${dashboard.upcomingReviews.length > 0 ? '4. Prepare for upcoming risk reviews' : ''}

Generated by: BuildOS Risk Module
Report Date: ${new Date().toISOString()}
  `.trim();
}

// ============================================
// MOCK DATA
// ============================================

export const MOCK_RISKS: Risk[] = [
  {
    id: 'risk-001',
    projectId: 'uk-001',
    title: 'Planning Condition Discharge Delay',
    description: 'Risk of delays in discharging pre-commencement planning conditions',
    category: 'regulatory',
    probability: 'possible',
    impact: 'major',
    score: 12,
    rating: 'high',
    costImpactMin: 50000,
    costImpactMax: 150000,
    scheduleImpactDays: 30,
    currency: 'GBP',
    status: 'mitigating',
    trend: 'stable',
    owner: 'Project Manager',
    identifiedBy: 'user-001',
    identifiedDate: '2024-12-01T10:00:00Z',
    lastReviewDate: '2025-01-15T10:00:00Z',
    nextReviewDate: '2025-02-01T10:00:00Z',
    mitigationStrategy: 'Early engagement with planning authority, pre-application meetings',
    mitigations: [
      {
        id: 'mit-001',
        description: 'Schedule pre-application meeting with planning officer',
        owner: 'Project Manager',
        dueDate: '2025-01-20',
        status: 'completed',
        effectivenessRating: 4,
      },
      {
        id: 'mit-002',
        description: 'Prepare comprehensive condition discharge package',
        owner: 'Planning Consultant',
        dueDate: '2025-02-05',
        status: 'in-progress',
      },
    ],
    contingencyPlan: 'Engage specialist planning consultant if delays persist',
    earlyWarningIndicators: [
      'No response from planning within 5 working days',
      'Request for additional information',
    ],
    escalationTrigger: 'Delay exceeds 15 days beyond statutory period',
    events: [
      {
        id: 'event-001',
        timestamp: '2024-12-01T10:00:00Z',
        type: 'created',
        userId: 'user-001',
        details: 'Risk identified during planning review',
      },
    ],
  },
  {
    id: 'risk-002',
    projectId: 'uk-001',
    title: 'Main Contractor Insolvency',
    description: 'Risk of main contractor financial failure during construction',
    category: 'commercial',
    probability: 'unlikely',
    impact: 'catastrophic',
    score: 10,
    rating: 'high',
    costImpactMin: 500000,
    costImpactMax: 2000000,
    scheduleImpactDays: 90,
    currency: 'GBP',
    status: 'monitoring',
    trend: 'worsening',
    owner: 'CFO',
    identifiedBy: 'user-002',
    identifiedDate: '2024-11-15T10:00:00Z',
    lastReviewDate: '2025-01-20T10:00:00Z',
    nextReviewDate: '2025-02-03T10:00:00Z',
    mitigationStrategy: 'Quarterly financial health checks, performance bonds in place',
    mitigations: [
      {
        id: 'mit-003',
        description: 'Obtain performance bond (10% contract value)',
        owner: 'CFO',
        dueDate: '2024-11-30',
        status: 'completed',
        effectivenessRating: 5,
      },
      {
        id: 'mit-004',
        description: 'Quarterly credit check on contractor',
        owner: 'Finance Team',
        dueDate: '2025-01-31',
        status: 'in-progress',
      },
    ],
    contingencyPlan: 'Pre-qualified standby contractor list prepared',
    earlyWarningIndicators: [
      'Late payments to subcontractors',
      'Reduction in site labor',
      'Negative credit rating change',
    ],
    escalationTrigger: 'Credit rating drops below BBB or late payment to subs',
    events: [
      {
        id: 'event-002',
        timestamp: '2024-11-15T10:00:00Z',
        type: 'created',
        userId: 'user-002',
        details: 'Risk identified during contractor due diligence',
      },
      {
        id: 'event-003',
        timestamp: '2025-01-20T10:00:00Z',
        type: 'updated',
        userId: 'user-002',
        details: 'Assessment updated: medium -> high. Market conditions deteriorating',
      },
    ],
  },
  {
    id: 'risk-003',
    projectId: 'uk-001',
    title: 'Ground Contamination Discovery',
    description: 'Risk of unforeseen ground contamination requiring remediation',
    category: 'environmental',
    probability: 'possible',
    impact: 'moderate',
    score: 9,
    rating: 'medium',
    costImpactMin: 75000,
    costImpactMax: 300000,
    scheduleImpactDays: 45,
    currency: 'GBP',
    status: 'monitoring',
    trend: 'stable',
    owner: 'Site Manager',
    identifiedBy: 'user-003',
    identifiedDate: '2024-10-01T10:00:00Z',
    lastReviewDate: '2025-01-10T10:00:00Z',
    nextReviewDate: '2025-01-24T10:00:00Z',
    mitigationStrategy: 'Additional ground investigation, contingency allowance in budget',
    mitigations: [
      {
        id: 'mit-005',
        description: 'Commission additional borehole survey',
        owner: 'Site Manager',
        dueDate: '2024-10-15',
        status: 'completed',
        effectivenessRating: 4,
      },
    ],
    contingencyPlan: 'Pre-agreed rates with remediation specialist',
    earlyWarningIndicators: [
      'Unusual odors during excavation',
      'Discolored soil or groundwater',
    ],
    events: [],
  },
  {
    id: 'risk-004',
    projectId: 'uk-001',
    title: 'Material Price Escalation',
    description: 'Risk of significant price increases for key construction materials',
    category: 'cost',
    probability: 'likely',
    impact: 'moderate',
    score: 12,
    rating: 'high',
    costImpactMin: 100000,
    costImpactMax: 400000,
    currency: 'GBP',
    status: 'mitigating',
    trend: 'improving',
    owner: 'Commercial Manager',
    identifiedBy: 'user-002',
    identifiedDate: '2024-09-15T10:00:00Z',
    lastReviewDate: '2025-01-18T10:00:00Z',
    nextReviewDate: '2025-02-01T10:00:00Z',
    mitigationStrategy: 'Early procurement, fixed-price subcontracts where possible',
    mitigations: [
      {
        id: 'mit-006',
        description: 'Lock in steel prices for 6 months',
        owner: 'Commercial Manager',
        dueDate: '2024-10-01',
        status: 'completed',
        effectivenessRating: 5,
      },
      {
        id: 'mit-007',
        description: 'Negotiate fixed-price M&E subcontract',
        owner: 'Commercial Manager',
        dueDate: '2025-02-15',
        status: 'in-progress',
      },
    ],
    earlyWarningIndicators: [
      'Market price index increase > 5%',
      'Supply chain delays reported',
    ],
    events: [],
  },
  {
    id: 'risk-005',
    projectId: 'uk-001',
    title: 'Scaffolding Safety Incident',
    description: 'Risk of injury from scaffolding collapse or fall',
    category: 'safety',
    probability: 'unlikely',
    impact: 'major',
    score: 8,
    rating: 'medium',
    status: 'monitoring',
    trend: 'stable',
    owner: 'H&S Manager',
    identifiedBy: 'user-004',
    identifiedDate: '2024-12-01T10:00:00Z',
    lastReviewDate: '2025-01-22T10:00:00Z',
    nextReviewDate: '2025-02-05T10:00:00Z',
    mitigationStrategy: 'Weekly scaffold inspections, certified scaffold contractors only',
    mitigations: [
      {
        id: 'mit-008',
        description: 'Implement weekly scaffold inspection regime',
        owner: 'H&S Manager',
        dueDate: '2024-12-15',
        status: 'completed',
        effectivenessRating: 5,
      },
    ],
    earlyWarningIndicators: [
      'Near-miss incidents reported',
      'Failed inspection items',
      'Adverse weather conditions',
    ],
    events: [],
  },
];

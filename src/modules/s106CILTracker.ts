// BuildOS S106/CIL Tracker
// UK Planning Obligations and Community Infrastructure Levy Management

// ============================================
// S106 OBLIGATION TYPES
// ============================================

export type S106Category =
  | 'affordable-housing'
  | 'education'
  | 'highways'
  | 'open-space'
  | 'healthcare'
  | 'public-transport'
  | 'employment-training'
  | 'community-facilities'
  | 'environmental'
  | 'heritage'
  | 'other';

export type S106TriggerType =
  | 'before-commencement'
  | 'before-occupation'
  | 'on-occupation'
  | 'phased-payment'
  | 'on-completion'
  | 'annual'
  | 'on-sale';

export type S106ObligationStatus =
  | 'pending'
  | 'triggered'
  | 'partially-discharged'
  | 'discharged'
  | 'overdue'
  | 'in-dispute';

export interface S106Head {
  id: string;
  projectId: string;
  permitId: string;
  category: S106Category;
  description: string;
  // Financial obligation
  financialValue?: number;
  currency: 'GBP';
  indexLinked: boolean;
  indexBase?: string; // e.g., "BCIS All-In TPI Q1 2023"
  currentIndexedValue?: number;
  // In-kind obligation
  inKindDescription?: string;
  inKindValue?: number;
  // Trigger
  triggerType: S106TriggerType;
  triggerDescription: string;
  triggerUnit?: number; // e.g., 50 units for "before occupation of 50th unit"
  // Status
  status: S106ObligationStatus;
  triggeredDate?: string;
  dueDate?: string;
  dischargedDate?: string;
  // Payments
  payments?: S106Payment[];
  // Documents
  deedRef: string;
  clauseRef: string;
  recipientAuthority: string;
  recipientContact?: string;
}

export interface S106Payment {
  id: string;
  headId: string;
  amount: number;
  dueDate: string;
  paidDate?: string;
  reference?: string;
  status: 'pending' | 'paid' | 'overdue';
}

export interface S106Agreement {
  id: string;
  projectId: string;
  permitId: string;
  deedRef: string;
  dateSigned: string;
  parties: string[];
  localAuthority: string;
  totalFinancialValue: number;
  heads: S106Head[];
  variations?: {
    id: string;
    date: string;
    description: string;
    impact: string;
  }[];
}

// ============================================
// CIL TYPES
// ============================================

export type CILExemptionType =
  | 'self-build'
  | 'social-housing'
  | 'charitable'
  | 'residential-annex'
  | 'residential-extension'
  | 'change-of-use';

export type CILReliefType =
  | 'social-housing-relief'
  | 'charitable-relief'
  | 'exceptional-circumstances';

export interface CILChargingSchedule {
  localAuthority: string;
  effectiveDate: string;
  zones: {
    name: string;
    useClass: string;
    rate: number; // £ per sqm
  }[];
  exemptDevelopment: string[];
  mayoPaymentInKind: boolean;
}

export interface CILLiability {
  id: string;
  projectId: string;
  permitId: string;
  localAuthority: string;
  // Area calculations
  grossInternalArea: number;
  existingLawfulArea: number;
  demolitionArea: number;
  netChargeableArea: number;
  // Charging details
  zone: string;
  useClass: string;
  baseRate: number;
  indexedRate: number;
  indexationFactor: number;
  indexDate: string;
  // Calculations
  baseLiability: number;
  indexedLiability: number;
  // Exemptions and relief
  exemptions?: {
    type: CILExemptionType;
    area: number;
    value: number;
    approved: boolean;
    approvalDate?: string;
  }[];
  relief?: {
    type: CILReliefType;
    value: number;
    approved: boolean;
    approvalDate?: string;
  }[];
  // Final amounts
  totalExemptions: number;
  totalRelief: number;
  netLiability: number;
  // Payment schedule
  paymentSchedule: CILPaymentInstalment[];
  // Status
  formSubmitted: boolean;
  commencementNoticeDate?: string;
  status: 'draft' | 'submitted' | 'confirmed' | 'in-payment' | 'paid' | 'in-dispute';
}

export interface CILPaymentInstalment {
  id: string;
  instalmentNumber: number;
  dueDate: string;
  amount: number;
  paidDate?: string;
  paidAmount?: number;
  reference?: string;
  status: 'pending' | 'due' | 'paid' | 'overdue';
  surchargeApplied?: number;
}

// ============================================
// CIL CALCULATION FUNCTIONS
// ============================================

export function calculateNetChargeableArea(
  grossArea: number,
  existingLawful: number,
  demolition: number
): number {
  // CIL Reg 40: Net additional floorspace
  const existingCredit = Math.max(0, existingLawful - demolition);
  return Math.max(0, grossArea - existingCredit);
}

export function calculateCILIndexation(
  baseRate: number,
  currentIndex: number,
  baseIndex: number
): { indexedRate: number; indexationFactor: number } {
  const indexationFactor = baseIndex > 0 ? currentIndex / baseIndex : 1;
  return {
    indexedRate: baseRate * indexationFactor,
    indexationFactor,
  };
}

export function calculateCILLiability(
  chargeableArea: number,
  indexedRate: number,
  exemptions: number = 0,
  relief: number = 0
): { baseLiability: number; netLiability: number } {
  const baseLiability = chargeableArea * indexedRate;
  const netLiability = Math.max(0, baseLiability - exemptions - relief);
  return { baseLiability, netLiability };
}

export function generateCILPaymentSchedule(
  netLiability: number,
  commencementDate: string,
  phasing?: 'small' | 'medium' | 'large'
): CILPaymentInstalment[] {
  // Default payment schedule based on liability size
  // Small: <£10k - 60 days single payment
  // Medium: £10k-£100k - 2 instalments
  // Large: >£100k - up to 4 instalments (phased payments)

  const instalments: CILPaymentInstalment[] = [];
  const commencement = new Date(commencementDate);

  if (!phasing) {
    if (netLiability < 10000) {
      phasing = 'small';
    } else if (netLiability < 100000) {
      phasing = 'medium';
    } else {
      phasing = 'large';
    }
  }

  switch (phasing) {
    case 'small': {
      const dueDate = new Date(commencement);
      dueDate.setDate(dueDate.getDate() + 60);
      instalments.push({
        id: '1',
        instalmentNumber: 1,
        dueDate: dueDate.toISOString().split('T')[0],
        amount: netLiability,
        status: 'pending',
      });
      break;
    }
    case 'medium': {
      const due1 = new Date(commencement);
      due1.setDate(due1.getDate() + 60);
      const due2 = new Date(commencement);
      due2.setDate(due2.getDate() + 240);

      instalments.push({
        id: '1',
        instalmentNumber: 1,
        dueDate: due1.toISOString().split('T')[0],
        amount: netLiability * 0.5,
        status: 'pending',
      });
      instalments.push({
        id: '2',
        instalmentNumber: 2,
        dueDate: due2.toISOString().split('T')[0],
        amount: netLiability * 0.5,
        status: 'pending',
      });
      break;
    }
    case 'large': {
      const percentages = [0.25, 0.25, 0.25, 0.25];
      const dayOffsets = [60, 180, 365, 540];

      percentages.forEach((pct, i) => {
        const dueDate = new Date(commencement);
        dueDate.setDate(dueDate.getDate() + dayOffsets[i]);
        instalments.push({
          id: String(i + 1),
          instalmentNumber: i + 1,
          dueDate: dueDate.toISOString().split('T')[0],
          amount: netLiability * pct,
          status: 'pending',
        });
      });
      break;
    }
  }

  return instalments;
}

// ============================================
// ALERT GENERATION
// ============================================

export interface S106CILAlert {
  id: string;
  type: 's106' | 'cil';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  dueDate?: string;
  daysRemaining?: number;
  amount?: number;
  actionRequired: string;
  projectId: string;
  referenceId: string;
}

export function generateS106Alerts(heads: S106Head[]): S106CILAlert[] {
  const alerts: S106CILAlert[] = [];
  const now = new Date();

  for (const head of heads) {
    if (head.status === 'pending' || head.status === 'triggered') {
      // Check for upcoming trigger dates
      if (head.dueDate) {
        const due = new Date(head.dueDate);
        const daysRemaining = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysRemaining < 0) {
          alerts.push({
            id: `s106-${head.id}-overdue`,
            type: 's106',
            severity: 'critical',
            title: `S106 obligation overdue: ${head.category}`,
            description: head.description,
            dueDate: head.dueDate,
            daysRemaining,
            amount: head.currentIndexedValue || head.financialValue,
            actionRequired: 'Payment/discharge required immediately',
            projectId: head.projectId,
            referenceId: head.id,
          });
        } else if (daysRemaining <= 30) {
          alerts.push({
            id: `s106-${head.id}-due-soon`,
            type: 's106',
            severity: daysRemaining <= 7 ? 'critical' : 'warning',
            title: `S106 due in ${daysRemaining} days: ${head.category}`,
            description: head.description,
            dueDate: head.dueDate,
            daysRemaining,
            amount: head.currentIndexedValue || head.financialValue,
            actionRequired: 'Prepare payment/discharge documentation',
            projectId: head.projectId,
            referenceId: head.id,
          });
        }
      }
    }
  }

  return alerts;
}

export function generateCILAlerts(liabilities: CILLiability[]): S106CILAlert[] {
  const alerts: S106CILAlert[] = [];
  const now = new Date();

  for (const liability of liabilities) {
    for (const instalment of liability.paymentSchedule) {
      if (instalment.status !== 'paid') {
        const due = new Date(instalment.dueDate);
        const daysRemaining = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysRemaining < 0) {
          alerts.push({
            id: `cil-${liability.id}-${instalment.id}-overdue`,
            type: 'cil',
            severity: 'critical',
            title: `CIL instalment ${instalment.instalmentNumber} overdue`,
            description: `${liability.localAuthority} - ${liability.zone}`,
            dueDate: instalment.dueDate,
            daysRemaining,
            amount: instalment.amount,
            actionRequired: 'Pay immediately - surcharges may apply',
            projectId: liability.projectId,
            referenceId: liability.id,
          });
        } else if (daysRemaining <= 14) {
          alerts.push({
            id: `cil-${liability.id}-${instalment.id}-due-soon`,
            type: 'cil',
            severity: daysRemaining <= 7 ? 'critical' : 'warning',
            title: `CIL instalment ${instalment.instalmentNumber} due in ${daysRemaining} days`,
            description: `${liability.localAuthority} - ${liability.zone}`,
            dueDate: instalment.dueDate,
            daysRemaining,
            amount: instalment.amount,
            actionRequired: 'Prepare payment',
            projectId: liability.projectId,
            referenceId: liability.id,
          });
        }
      }
    }
  }

  return alerts;
}

// ============================================
// DASHBOARD DATA
// ============================================

export interface S106CILDashboard {
  totalS106Value: number;
  totalCILValue: number;
  s106ByCategory: { category: S106Category; value: number; status: S106ObligationStatus }[];
  pendingPayments: { type: 's106' | 'cil'; amount: number; dueDate: string; reference: string }[];
  alerts: S106CILAlert[];
  upcomingTriggers: { headId: string; category: S106Category; triggerDescription: string; dueDate?: string }[];
  completionProgress: {
    s106Total: number;
    s106Discharged: number;
    cilPaid: number;
    cilTotal: number;
  };
}

export function generateS106CILDashboard(
  s106Agreements: S106Agreement[],
  cilLiabilities: CILLiability[]
): S106CILDashboard {
  const allHeads = s106Agreements.flatMap((a) => a.heads);

  const totalS106Value = allHeads.reduce(
    (sum, h) => sum + (h.currentIndexedValue || h.financialValue || 0),
    0
  );

  const totalCILValue = cilLiabilities.reduce((sum, l) => sum + l.netLiability, 0);

  const s106ByCategory = Object.values(
    allHeads.reduce((acc, h) => {
      const key = h.category;
      if (!acc[key]) {
        acc[key] = { category: h.category, value: 0, status: h.status };
      }
      acc[key].value += h.currentIndexedValue || h.financialValue || 0;
      return acc;
    }, {} as Record<string, { category: S106Category; value: number; status: S106ObligationStatus }>)
  );

  const pendingPayments: { type: 's106' | 'cil'; amount: number; dueDate: string; reference: string }[] = [];

  // Add pending S106 payments
  for (const head of allHeads) {
    if (head.payments) {
      for (const payment of head.payments.filter((p) => p.status !== 'paid')) {
        pendingPayments.push({
          type: 's106',
          amount: payment.amount,
          dueDate: payment.dueDate,
          reference: head.deedRef,
        });
      }
    }
  }

  // Add pending CIL payments
  for (const liability of cilLiabilities) {
    for (const instalment of liability.paymentSchedule.filter((i) => i.status !== 'paid')) {
      pendingPayments.push({
        type: 'cil',
        amount: instalment.amount,
        dueDate: instalment.dueDate,
        reference: liability.id,
      });
    }
  }

  pendingPayments.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const s106Alerts = generateS106Alerts(allHeads);
  const cilAlerts = generateCILAlerts(cilLiabilities);

  const upcomingTriggers = allHeads
    .filter((h) => h.status === 'pending')
    .map((h) => ({
      headId: h.id,
      category: h.category,
      triggerDescription: h.triggerDescription,
      dueDate: h.dueDate,
    }));

  const s106Discharged = allHeads.filter((h) => h.status === 'discharged').length;
  const cilPaid = cilLiabilities.reduce(
    (sum, l) => sum + l.paymentSchedule.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount, 0),
    0
  );

  return {
    totalS106Value,
    totalCILValue,
    s106ByCategory,
    pendingPayments: pendingPayments.slice(0, 10),
    alerts: [...s106Alerts, ...cilAlerts].sort((a, b) => (a.daysRemaining || 999) - (b.daysRemaining || 999)),
    upcomingTriggers,
    completionProgress: {
      s106Total: allHeads.length,
      s106Discharged,
      cilPaid,
      cilTotal: totalCILValue,
    },
  };
}

// ============================================
// MOCK DATA
// ============================================

export const MOCK_S106_HEADS: S106Head[] = [
  {
    id: 's106-1',
    projectId: 'uk-001',
    permitId: 'perm-001',
    category: 'affordable-housing',
    description: 'Delivery of 35% affordable housing on-site',
    inKindDescription: '35 affordable units (20 social rent, 15 intermediate)',
    inKindValue: 4200000,
    triggerType: 'before-occupation',
    triggerDescription: 'Before occupation of 50th market unit',
    triggerUnit: 50,
    status: 'pending',
    deedRef: 'S106/2023/001',
    clauseRef: 'Schedule 3',
    recipientAuthority: 'Tower Hamlets Council',
    indexLinked: false,
    currency: 'GBP',
  },
  {
    id: 's106-2',
    projectId: 'uk-001',
    permitId: 'perm-001',
    category: 'education',
    description: 'Primary education contribution',
    financialValue: 180000,
    currentIndexedValue: 187200,
    triggerType: 'phased-payment',
    triggerDescription: '50% on commencement, 50% on occupation',
    status: 'triggered',
    triggeredDate: '2024-01-15',
    dueDate: '2024-02-15',
    deedRef: 'S106/2023/001',
    clauseRef: 'Schedule 4, Para 2',
    recipientAuthority: 'Tower Hamlets Council',
    indexLinked: true,
    indexBase: 'BCIS All-In TPI Q1 2023',
    currency: 'GBP',
    payments: [
      {
        id: 'pay-1',
        headId: 's106-2',
        amount: 93600,
        dueDate: '2024-02-15',
        status: 'pending',
      },
    ],
  },
  {
    id: 's106-3',
    projectId: 'uk-001',
    permitId: 'perm-001',
    category: 'highways',
    description: 'Highway improvements contribution',
    financialValue: 250000,
    triggerType: 'before-commencement',
    triggerDescription: 'Prior to commencement of development',
    status: 'discharged',
    dischargedDate: '2023-12-01',
    deedRef: 'S106/2023/001',
    clauseRef: 'Schedule 5',
    recipientAuthority: 'TfL',
    indexLinked: false,
    currency: 'GBP',
  },
];

export const MOCK_CIL_LIABILITY: CILLiability = {
  id: 'cil-001',
  projectId: 'uk-001',
  permitId: 'perm-001',
  localAuthority: 'Tower Hamlets',
  grossInternalArea: 12500,
  existingLawfulArea: 2000,
  demolitionArea: 2000,
  netChargeableArea: 10500,
  zone: 'Zone 1 (Central)',
  useClass: 'C3 Residential',
  baseRate: 200,
  indexedRate: 234,
  indexationFactor: 1.17,
  indexDate: '2024-01-01',
  baseLiability: 2100000,
  indexedLiability: 2457000,
  totalExemptions: 0,
  totalRelief: 0,
  netLiability: 2457000,
  paymentSchedule: [
    {
      id: 'inst-1',
      instalmentNumber: 1,
      dueDate: '2024-03-15',
      amount: 614250,
      status: 'pending',
    },
    {
      id: 'inst-2',
      instalmentNumber: 2,
      dueDate: '2024-07-15',
      amount: 614250,
      status: 'pending',
    },
    {
      id: 'inst-3',
      instalmentNumber: 3,
      dueDate: '2025-01-15',
      amount: 614250,
      status: 'pending',
    },
    {
      id: 'inst-4',
      instalmentNumber: 4,
      dueDate: '2025-07-15',
      amount: 614250,
      status: 'pending',
    },
  ],
  formSubmitted: true,
  commencementNoticeDate: '2024-01-15',
  status: 'in-payment',
};

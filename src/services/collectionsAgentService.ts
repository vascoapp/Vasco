import { useMemo } from 'react';
import { DEMO_MODE } from '../config/demo';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DunningStepType =
  | 'vriendelijk'
  | 'herinnering'
  | 'urgent'
  | 'aanmaning'
  | 'incasso';

export interface DSOMetrics {
  currentDSO: number;       // days
  targetDSO: number;
  trend: 'improving' | 'worsening' | 'stable';
  previousDSO: number;
  industryAverage: number;
}

export interface DunningStep {
  step: DunningStepType;
  scheduledDate: string;
  sentDate?: string;
  status: 'pending' | 'sent' | 'skipped';
}

export interface DunningSequence {
  id: string;
  invoiceId: string;
  customerName: string;
  invoiceAmount: number;
  daysOverdue: number;
  currentStep: DunningStepType;
  steps: DunningStep[];
  autoSendEnabled: boolean;
}

export interface CashGapAlert {
  id: string;
  title: string;
  description: string;
  severity: 'info' | 'waarschuwing' | 'kritiek';
  gapAmount: number;
  suggestedAction: string;
  relatedInvoiceIds: string[];
}

export interface CollectionsAgentSummary {
  totalOutstanding: number;
  sequencesActive: number;
  autoSendCount: number;
  nextActionDate: string;
  estimatedRecovery: number;
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const DEMO_DSO_METRICS: DSOMetrics = {
  currentDSO: 24,
  targetDSO: 21,
  trend: 'improving',
  previousDSO: 28,
  industryAverage: 32,
};

/** Demo fixture — zeroed in production builds (see src/config/demo.ts). A real
 *  contractor's DSO is derived from their own invoices; showing a fabricated
 *  24-day DSO on the facturen tab is worse than showing nothing. */
const ZERO_DSO_METRICS: DSOMetrics = {
  currentDSO: 0,
  targetDSO: 30,
  trend: 'stable',
  previousDSO: 0,
  industryAverage: 0,
};

const MOCK_DSO_METRICS: DSOMetrics = DEMO_MODE ? DEMO_DSO_METRICS : ZERO_DSO_METRICS;

// R210: industryAverage is overridden from the cohort (R195 `get_cohort_dso`)
// when available, so the DSO generator and related insights compare the
// contractor against the real cohort median instead of a static 32.
// R66 round 40: reset on user change so user B doesn't briefly see user A's
// country median on the dashboard before primeCohortIndustryAverage refires
// with B's profile. Module-level state isn't cleared by sessionCleanup
// (AsyncStorage-only) — singleton-reset bus is the right place.
let cohortIndustryAverage: number | null = null;
import { registerSingletonReset } from './singletonReset';
registerSingletonReset(() => { cohortIndustryAverage = null; });

const DEMO_MOCK_DUNNING_SEQUENCES: DunningSequence[] = [
  {
    id: 'dun-001',
    invoiceId: 'INV-2026-0041',
    customerName: 'Van der Berg Vastgoed',
    invoiceAmount: 2350,
    daysOverdue: 7,
    currentStep: 'vriendelijk',
    steps: [
      {
        step: 'vriendelijk',
        scheduledDate: '2026-02-08',
        status: 'pending',
      },
      {
        step: 'herinnering',
        scheduledDate: '2026-02-15',
        status: 'pending',
      },
      {
        step: 'urgent',
        scheduledDate: '2026-02-22',
        status: 'pending',
      },
      {
        step: 'aanmaning',
        scheduledDate: '2026-03-01',
        status: 'pending',
      },
      {
        step: 'incasso',
        scheduledDate: '2026-03-15',
        status: 'pending',
      },
    ],
    autoSendEnabled: true,
  },
  {
    id: 'dun-002',
    invoiceId: 'INV-2026-0038',
    customerName: 'Janssen Bouw BV',
    invoiceAmount: 3800,
    daysOverdue: 18,
    currentStep: 'herinnering',
    steps: [
      {
        step: 'vriendelijk',
        scheduledDate: '2026-01-28',
        sentDate: '2026-01-28',
        status: 'sent',
      },
      {
        step: 'herinnering',
        scheduledDate: '2026-02-04',
        sentDate: '2026-02-04',
        status: 'sent',
      },
      {
        step: 'urgent',
        scheduledDate: '2026-02-11',
        status: 'pending',
      },
      {
        step: 'aanmaning',
        scheduledDate: '2026-02-18',
        status: 'pending',
      },
      {
        step: 'incasso',
        scheduledDate: '2026-03-04',
        status: 'pending',
      },
    ],
    autoSendEnabled: true,
  },
  {
    id: 'dun-003',
    invoiceId: 'INV-2026-0029',
    customerName: 'De Groot Installaties',
    invoiceAmount: 2400,
    daysOverdue: 34,
    currentStep: 'urgent',
    steps: [
      {
        step: 'vriendelijk',
        scheduledDate: '2026-01-12',
        sentDate: '2026-01-12',
        status: 'sent',
      },
      {
        step: 'herinnering',
        scheduledDate: '2026-01-19',
        sentDate: '2026-01-19',
        status: 'sent',
      },
      {
        step: 'urgent',
        scheduledDate: '2026-01-26',
        sentDate: '2026-02-01',
        status: 'sent',
      },
      {
        step: 'aanmaning',
        scheduledDate: '2026-02-10',
        status: 'pending',
      },
      {
        step: 'incasso',
        scheduledDate: '2026-02-24',
        status: 'pending',
      },
    ],
    autoSendEnabled: false,
  },
];

/** Demo fixture — empty in production builds (see src/config/demo.ts). */
const MOCK_DUNNING_SEQUENCES: DunningSequence[] = DEMO_MODE ? DEMO_MOCK_DUNNING_SEQUENCES : [];

const DEMO_MOCK_CASH_GAP_ALERTS: CashGapAlert[] = [
  {
    id: 'cga-001',
    title: 'Kasgat volgende week',
    description:
      'Verwachte uitgaven (€4.200) overschrijden ontvangsten (€1.800). Overweeg betalingsherinnering te versnellen.',
    severity: 'waarschuwing',
    gapAmount: 2400,
    suggestedAction: 'Verstuur herinneringen naar Janssen Bouw BV en De Groot Installaties',
    relatedInvoiceIds: ['INV-2026-0038', 'INV-2026-0029'],
  },
  {
    id: 'cga-002',
    title: 'Langdurig openstaand: De Groot Installaties',
    description:
      'Factuur INV-2026-0029 staat 34 dagen open (€2.400). Incassorisico neemt toe.',
    severity: 'kritiek',
    gapAmount: 2400,
    suggestedAction: 'Schakel over naar aanmaning of neem telefonisch contact op',
    relatedInvoiceIds: ['INV-2026-0029'],
  },
];

/** Demo fixture — empty in production builds (see src/config/demo.ts). */
const MOCK_CASH_GAP_ALERTS: CashGapAlert[] = DEMO_MODE ? DEMO_MOCK_CASH_GAP_ALERTS : [];

// ---------------------------------------------------------------------------
// Service (singleton)
// ---------------------------------------------------------------------------

class CollectionsAgentService {
  private static instance: CollectionsAgentService;

  private constructor() {}

  static getInstance(): CollectionsAgentService {
    if (!CollectionsAgentService.instance) {
      CollectionsAgentService.instance = new CollectionsAgentService();
    }
    return CollectionsAgentService.instance;
  }

  getDSOMetrics(): DSOMetrics {
    // R210: fold the cohort industry average in when primed.
    return {
      ...MOCK_DSO_METRICS,
      industryAverage: cohortIndustryAverage ?? MOCK_DSO_METRICS.industryAverage,
    };
  }

  getDunningSequences(): DunningSequence[] {
    return MOCK_DUNNING_SEQUENCES;
  }

  getCashGapAlerts(): CashGapAlert[] {
    return MOCK_CASH_GAP_ALERTS;
  }

  getSummary(): CollectionsAgentSummary {
    const sequences = this.getDunningSequences();
    const totalOutstanding = sequences.reduce(
      (sum, s) => sum + s.invoiceAmount,
      0,
    );
    const autoSendCount = sequences.filter((s) => s.autoSendEnabled).length;

    // Find earliest pending step date across all sequences
    const pendingDates = sequences
      .flatMap((s) => s.steps)
      .filter((st) => st.status === 'pending')
      .map((st) => st.scheduledDate)
      .sort();

    const nextActionDate = pendingDates[0] ?? '';

    // Estimated recovery: 85% of outstanding (historical average for construction)
    const estimatedRecovery = Math.round(totalOutstanding * 0.85);

    return {
      totalOutstanding,
      sequencesActive: sequences.length,
      autoSendCount,
      nextActionDate,
      estimatedRecovery,
    };
  }
}

// ---------------------------------------------------------------------------
// Hooks — R26: real data from AppState (was MOCK_DSO_METRICS / MOCK_DUNNING /
// MOCK_CASH_GAP_ALERTS — every contractor saw "Van der Berg Vastgoed",
// "Janssen Bouw BV", "De Groot Installaties" mock customers regardless of
// their own books). The 3 generators consuming these (cashGap, dsoTrend,
// customerLifecycle) now reflect actual contractor cashflow.
// ---------------------------------------------------------------------------

import { useAppState } from '../state/AppState';

const DAY_MS = 24 * 60 * 60 * 1000;

function deriveDSO(invoices: any[]): DSOMetrics {
  const paid = invoices.filter((i) => i.status === 'paid' && (i.sentAt || i.createdAt) && (i.paidAt || i.lastUpdated));
  // Average days from sent → paid for last 90 days of paid invoices
  const recentPaid = paid.filter((i) => {
    const paidAt = new Date(i.paidAt || i.lastUpdated).getTime();
    return paidAt > Date.now() - 90 * DAY_MS;
  });
  const days = recentPaid.map((i) => {
    const sent = new Date(i.sentAt || i.createdAt).getTime();
    const paidAt = new Date(i.paidAt || i.lastUpdated).getTime();
    return Math.max(0, (paidAt - sent) / DAY_MS);
  });
  const currentDSO = days.length > 0 ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : 0;
  // Previous-period DSO: 30-90 day window
  const previousPaid = paid.filter((i) => {
    const paidAt = new Date(i.paidAt || i.lastUpdated).getTime();
    return paidAt < Date.now() - 30 * DAY_MS && paidAt > Date.now() - 90 * DAY_MS;
  });
  const prevDays = previousPaid.map((i) => {
    const sent = new Date(i.sentAt || i.createdAt).getTime();
    const paidAt = new Date(i.paidAt || i.lastUpdated).getTime();
    return Math.max(0, (paidAt - sent) / DAY_MS);
  });
  const previousDSO = prevDays.length > 0 ? Math.round(prevDays.reduce((a, b) => a + b, 0) / prevDays.length) : currentDSO;
  const trend: DSOMetrics['trend'] = currentDSO < previousDSO ? 'improving' : currentDSO > previousDSO ? 'worsening' : 'stable';
  return {
    currentDSO,
    targetDSO: 21,
    trend,
    previousDSO,
    industryAverage: cohortIndustryAverage ?? 32,
  };
}

function deriveDunningSequences(invoices: any[]): DunningSequence[] {
  const now = Date.now();
  return invoices
    .filter((i) => i.status === 'overdue' || (i.status === 'sent' && i.dueInDays !== undefined && i.dueInDays < 0))
    .map((inv) => {
      const daysOverdue = Math.max(0, Math.abs(inv.dueInDays ?? 0));
      // Step heuristic: 0-7d vriendelijk, 7-14d herinnering, 14-30d urgent,
      // 30-60d aanmaning, 60+d incasso.
      const currentStep: DunningStepType =
        daysOverdue >= 60 ? 'incasso'
        : daysOverdue >= 30 ? 'aanmaning'
        : daysOverdue >= 14 ? 'urgent'
        : daysOverdue >= 7 ? 'herinnering'
        : 'vriendelijk';
      // Synthesize the 5-step plan (sent for past steps, pending for future).
      const stepOrder: DunningStepType[] = ['vriendelijk', 'herinnering', 'urgent', 'aanmaning', 'incasso'];
      const dayOffsets: Record<DunningStepType, number> = {
        vriendelijk: 0, herinnering: 7, urgent: 14, aanmaning: 30, incasso: 60,
      };
      const baseDue = inv.dueDate ? new Date(inv.dueDate).getTime() : now - daysOverdue * DAY_MS;
      const steps: DunningStep[] = stepOrder.map((step) => {
        const scheduledMs = baseDue + dayOffsets[step] * DAY_MS;
        const isPast = scheduledMs < now && stepOrder.indexOf(step) <= stepOrder.indexOf(currentStep);
        return {
          step,
          scheduledDate: new Date(scheduledMs).toISOString().slice(0, 10),
          ...(isPast ? { sentDate: new Date(scheduledMs).toISOString().slice(0, 10), status: 'sent' as const } : { status: 'pending' as const }),
        };
      });
      return {
        id: `dun-${inv.id}`,
        invoiceId: inv.id,
        customerName: inv.customerName ?? inv.customer ?? '',
        invoiceAmount: inv.amount ?? 0,
        daysOverdue,
        currentStep,
        steps,
        autoSendEnabled: false,
      };
    });
}

function deriveCashGapAlerts(invoices: any[]): CashGapAlert[] {
  const overdue = invoices.filter((i) => i.status === 'overdue' || (i.status === 'sent' && (i.dueInDays ?? 0) < 0));
  if (overdue.length === 0) return [];
  const total = overdue.reduce((sum, i) => sum + (i.amount ?? 0), 0);
  const longest = overdue.reduce((max, i) => {
    const d = Math.abs(i.dueInDays ?? 0);
    return d > max.days ? { days: d, inv: i } : max;
  }, { days: 0, inv: null as any });
  const out: CashGapAlert[] = [];
  if (total > 0) {
    out.push({
      id: 'cga-overdue-total',
      title: `${overdue.length} overdue invoice${overdue.length > 1 ? 's' : ''}`,
      description: `€${Math.round(total)} outstanding past due date.`,
      severity: total > 5000 ? 'kritiek' : 'waarschuwing',
      gapAmount: total,
      suggestedAction: 'Send reminders to overdue customers',
      relatedInvoiceIds: overdue.map((i) => i.id),
    });
  }
  if (longest.days >= 30 && longest.inv) {
    out.push({
      id: `cga-longest-${longest.inv.id}`,
      title: `${longest.days}d overdue: ${longest.inv.customerName ?? longest.inv.customer ?? ''}`,
      description: `Invoice ${longest.inv.id} (€${Math.round(longest.inv.amount ?? 0)}). Collections risk rising.`,
      severity: 'kritiek',
      gapAmount: longest.inv.amount ?? 0,
      suggestedAction: 'Escalate to formal notice or call',
      relatedInvoiceIds: [longest.inv.id],
    });
  }
  return out;
}

export function useDSOMetrics(): DSOMetrics {
  const { invoices } = useAppState();
  return useMemo(() => deriveDSO(invoices), [invoices]);
}

export function useDunningSequences(): DunningSequence[] {
  const { invoices } = useAppState();
  return useMemo(() => deriveDunningSequences(invoices), [invoices]);
}

export function useCollectionsAgent(): {
  summary: CollectionsAgentSummary;
  sequences: DunningSequence[];
  alerts: CashGapAlert[];
  dso: DSOMetrics;
} {
  const { invoices } = useAppState();
  return useMemo(() => {
    const sequences = deriveDunningSequences(invoices);
    const alerts = deriveCashGapAlerts(invoices);
    const dso = deriveDSO(invoices);
    const totalOutstanding = sequences.reduce((sum, s) => sum + s.invoiceAmount, 0);
    const autoSendCount = sequences.filter((s) => s.autoSendEnabled).length;
    const pendingDates = sequences
      .flatMap((s) => s.steps)
      .filter((st) => st.status === 'pending')
      .map((st) => st.scheduledDate)
      .sort();
    const summary: CollectionsAgentSummary = {
      totalOutstanding,
      sequencesActive: sequences.length,
      autoSendCount,
      nextActionDate: pendingDates[0] ?? '',
      estimatedRecovery: Math.round(totalOutstanding * 0.85),
    };
    return { summary, sequences, alerts, dso };
  }, [invoices]);
}

// ---------------------------------------------------------------------------
// R210 — cohort-backed industry average
// ---------------------------------------------------------------------------

/**
 * Prime the cohort industry average so `getDSOMetrics().industryAverage`
 * reflects the R195 `get_cohort_dso` median instead of the hardcoded 32.
 * Safe to call repeatedly (no-op when cohort is thin). Intended to be
 * called from AppState bootstrap once `businessProfile.country` is known.
 */
export async function primeCohortIndustryAverage(
  country: string,
  customerType?: string | null,
): Promise<void> {
  try {
    const mod = await import('./paymentTimingMoatService');
    const cohort = await mod.getCohortDso(country, customerType ?? null);
    if (cohort?.medianDso && cohort.sampleSize > 0) {
      cohortIndustryAverage = cohort.medianDso;
    }
  } catch {
    // silent — heuristic default remains in effect
  }
}

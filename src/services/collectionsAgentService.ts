import { useMemo } from 'react';

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

const MOCK_DSO_METRICS: DSOMetrics = {
  currentDSO: 24,
  targetDSO: 21,
  trend: 'improving',
  previousDSO: 28,
  industryAverage: 32,
};

// R210: industryAverage is overridden from the cohort (R195 `get_cohort_dso`)
// when available, so the DSO generator and related insights compare the
// contractor against the real cohort median instead of a static 32.
let cohortIndustryAverage: number | null = null;

const MOCK_DUNNING_SEQUENCES: DunningSequence[] = [
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

const MOCK_CASH_GAP_ALERTS: CashGapAlert[] = [
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
// Hooks
// ---------------------------------------------------------------------------

export function useDSOMetrics(): DSOMetrics {
  return useMemo(() => {
    const service = CollectionsAgentService.getInstance();
    return service.getDSOMetrics();
  }, []);
}

export function useDunningSequences(): DunningSequence[] {
  return useMemo(() => {
    const service = CollectionsAgentService.getInstance();
    return service.getDunningSequences();
  }, []);
}

export function useCollectionsAgent(): {
  summary: CollectionsAgentSummary;
  sequences: DunningSequence[];
  alerts: CashGapAlert[];
  dso: DSOMetrics;
} {
  return useMemo(() => {
    const service = CollectionsAgentService.getInstance();
    return {
      summary: service.getSummary(),
      sequences: service.getDunningSequences(),
      alerts: service.getCashGapAlerts(),
      dso: service.getDSOMetrics(),
    };
  }, []);
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

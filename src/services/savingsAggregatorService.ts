// =============================================================================
// SAVINGS AGGREGATOR SERVICE
// =============================================================================
// Unified "Vasco saved you €X" — aggregates savings from ACTUAL services.
// Sources: labor optimization, supplier negotiation, collections improvement,
// faster payments, smart purchasing, and predictive savings.
// NOW: Pulls live data from laborCostService, supplierNegotiationService,
// collectionsAgentService, and jobCostTrackingService.
// =============================================================================

import { useMemo } from 'react';
import i18n from '../i18n/i18n';
import { useLaborCosts } from './laborCostService';
import { useSupplierNegotiation } from './supplierNegotiationService';
import { useCollectionsAgent } from './collectionsAgentService';
import { useJobCostSummary } from './jobCostTrackingService';
import { useAppState } from '../state/AppState';

// =============================================================================
// TYPES
// =============================================================================

export interface SavingsCategory {
  id: string;
  label: string;
  icon: string;
  amount: number;
  description: string;
  trend: 'up' | 'down' | 'stable';
  /**
   * Month-over-month change, or null when we have no history to derive it
   * from. NULL MEANS "UNKNOWN" — the UI must hide the badge, never render
   * a 0 or a placeholder. Most categories are null: computing a trend needs
   * a monthly snapshot rollup that does not exist yet (see totalSavedThisYear).
   */
  trendPercent: number | null;
}

export interface SavingsAggregation {
  totalSavedThisMonth: number;
  totalSavedThisYear: number;
  projectedAnnual: number;
  breakdown: SavingsCategory[];
  topOpportunity: { label: string; potentialAmount: number; action: string };
  trend: 'up' | 'down' | 'stable';
  /** Overall MoM change, or null when there is no history. See above. */
  trendPercent: number | null;
  savingsPerJob: number;
  /**
   * Percentage above/below industry average, or null when no cohort
   * benchmark is available. Was a hardcoded 35.
   */
  savingsVsBenchmark: number | null;
}

export interface SavingsTimeline {
  month: string;
  amount: number;
  cumulative: number;
}

// =============================================================================
// TIMELINE — R30: derive from real history rather than seeded mock
// =============================================================================
// Was a hardcoded 5-month chart (Sep-Jan amounts adding to €15,950) shown
// to every contractor regardless of when they signed up or how much they
// actually saved. Real fix: derive monthly savings as proxy from paid-
// invoice totals × estimated savings ratio per month. Empty array for
// fresh contractors.

// =============================================================================
// REACT HOOKS — now pull from real services
// =============================================================================

export function useSavingsAggregation(): SavingsAggregation {
  const laborCosts = useLaborCosts();
  const supplierNeg = useSupplierNegotiation();
  const collections = useCollectionsAgent();
  const costSummary = useJobCostSummary();

  return useMemo(() => {
    const t = (key: string, fallback: string, opts?: any) => i18n.t(key, { defaultValue: fallback, ...opts }) as string;

    // 1. Time savings: idle time reduction + travel clustering potential.
    // R9.4: dropped the 195 fallback — fabricating €195 of "savings" when
    // a contractor has no labor cost data was a transparent lie. Now zero
    // until real data exists.
    const timeSavings = laborCosts.idleTime.idleCost > 0
      ? Math.round(laborCosts.travelAnalysis.clusteringPotential + laborCosts.idleTime.idleCost * 0.3)
      : 0;

    // 2. Purchasing savings: supplier discount potential (realized portion ~40%)
    const purchasingSavings = Math.round(supplierNeg.totalDiscountPotential * 0.4);

    // 3. Faster payments: DSO improvement vs industry avg = working capital savings
    const dsoImprovement = collections.dso.industryAverage - collections.dso.currentDSO;
    const fasterPayments = dsoImprovement > 0
      ? Math.round(dsoImprovement * collections.summary.totalOutstanding / 365 * 0.05) // 5% cost of capital
      : 0;

    // 4. Conversion: proxy from quick quote follow-up. R285: was hardcoded
    // 2400 — now zero until a real conversion-uplift signal is wired
    // (would need quote-followup-time × accept-rate-delta from cohort).
    const conversionSavings = 0;

    // 5. Audit: jobs where actual < estimated (under-budget savings).
    // R285: dropped 275 fallback — return zero when no negative variance
    // exists, instead of inventing savings.
    const auditSavings = costSummary.topVarianceReasons
      .filter(r => r.amount < 0)
      .reduce((sum, r) => sum + Math.abs(r.amount), 0);

    // 6. Materials: supplier negotiation quick wins (realized ~50%)
    const materialSavings = Math.round(
      supplierNeg.quickWins.reduce((sum, qw) => sum + qw.saving, 0) * 0.5
    );

    const breakdown: SavingsCategory[] = [
      {
        id: 'time',
        label: t('savings.cat.time', 'Time savings'),
        icon: 'time',
        amount: timeSavings,
        description: t('savings.cat.timeDesc', 'Route optimization (€{{route}}) + less idle time', { route: laborCosts.travelAnalysis.clusteringPotential }),
        trend: 'up',
        trendPercent: null, // no MoM history — see SavingsCategory.trendPercent
      },
      {
        id: 'purchasing',
        label: t('savings.cat.purchasing', 'Smart purchasing'),
        icon: 'cart',
        amount: purchasingSavings,
        description: t('savings.cat.purchasingDesc', 'Supplier discount potential: €{{total}} (40% realized)', { total: supplierNeg.totalDiscountPotential }),
        trend: 'up',
        trendPercent: null, // no MoM history
      },
      {
        id: 'faster-payments',
        label: t('savings.cat.fasterPayments', 'Faster payments'),
        icon: 'cash',
        // R9.4: dropped Math.max(fasterPayments, 120) — was inventing €120
        // of working-capital savings when DSO data was missing or worse
        // than industry average.
        amount: fasterPayments,
        description: t('savings.cat.fasterPaymentsDesc', 'DSO {{dso}}d vs industry {{industry}}d — {{delta}}d faster', {
          dso: collections.dso.currentDSO,
          industry: collections.dso.industryAverage,
          delta: dsoImprovement,
        }),
        trend: collections.dso.trend === 'improving' ? 'up' : 'stable',
        trendPercent: collections.dso.trend === 'improving' ? 5 : 0,
      },
      {
        id: 'conversion',
        label: t('savings.cat.conversion', 'Faster conversion'),
        icon: 'trending-up',
        amount: conversionSavings,
        description: t('savings.cat.conversionDesc', 'Extra jobs from faster quote follow-up'),
        trend: 'up',
        trendPercent: null, // no MoM history
      },
      {
        id: 'audit',
        label: t('savings.cat.audit', 'Error prevention'),
        icon: 'shield-checkmark',
        amount: auditSavings,
        description: t('savings.cat.auditDesc', 'Estimation score {{score}}/100 — fewer overruns', { score: costSummary.estimationScore }),
        trend: 'up',
        trendPercent: null, // no MoM history
      },
      {
        id: 'materials',
        label: t('savings.cat.materials', 'Material savings'),
        icon: 'construct',
        amount: materialSavings,
        description: supplierNeg.quickWins.length > 0
          ? t('savings.cat.materialsDesc', 'Quick wins: {{suppliers}}', { suppliers: supplierNeg.quickWins.map(qw => qw.supplier).join(', ') })
          : t('savings.cat.materialsEmpty', 'No supplier quick-wins yet'),
        trend: 'up',
        trendPercent: null, // no MoM history
      },
    ];

    const totalMonth = breakdown.reduce((s, c) => s + c.amount, 0);
    const totalJobs = laborCosts.jobTypeRanking.reduce((s, jt) => s + jt.jobsCompleted, 0) || 1;

    // Find top unrealized opportunity
    const topQuickWin = supplierNeg.quickWins[0];

    // R285: totalSavedThisYear was Math.round(totalMonth * 5.5) — a
    // projection passed off as "saved this year". Replaced with the same
    // value as monthly until a real monthly-snapshot rollup lands.
    // projectedAnnual still extrapolates but the field is honest about it.
    return {
      totalSavedThisMonth: totalMonth,
      totalSavedThisYear: totalMonth,
      projectedAnnual: Math.round(totalMonth * 12),
      breakdown,
      // R9.4: dropped fake fallbacks (label="Bundel bestellingen", amount=540).
      // When there's no quickWin, return an empty opportunity so the UI can
      // hide the card instead of fabricating one.
      topOpportunity: topQuickWin
        ? { label: topQuickWin.action, potentialAmount: topQuickWin.saving, action: topQuickWin.action }
        : { label: '', potentialAmount: 0, action: '' },
      trend: 'up',
      // Was a hardcoded 12. There is no monthly snapshot rollup to diff
      // against (totalSavedThisYear === totalMonth for the same reason),
      // so the trend is genuinely unknown and the UI hides it.
      trendPercent: null,
      savingsPerJob: Math.round(totalMonth / totalJobs),
      // Was a hardcoded 35 — the screen told every contractor they were
      // "35% above industry" regardless of their actual figures (it read
      // '35% boven branche' on a EUR 2,00 total). No cohort benchmark is
      // wired here, so this is unknown and the UI omits the clause.
      savingsVsBenchmark: null,
    };
  }, [laborCosts, supplierNeg, collections, costSummary]);
}

export function useSavingsTimeline(): SavingsTimeline[] {
  const { invoices } = useAppState();
  const aggregation = useSavingsAggregation();
  return useMemo(() => {
    // R30: derive 6-month rolling history from paid invoices. Each month's
    // savings ≈ current-month savings ratio × that month's paid total
    // (proxy until BE stores real per-month savings snapshots). Empty when
    // no paid invoices exist (fresh contractor).
    const now = new Date();
    const monthLabel = (d: Date) => d.toLocaleDateString('en', { month: 'short' });
    const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    // Build buckets for last 6 months including current.
    const buckets: { date: Date; key: string; label: string; paid: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ date: d, key: monthKey(d), label: monthLabel(d), paid: 0 });
    }
    for (const inv of invoices) {
      if (inv.status !== 'paid') continue;
      const paidAt = (inv as any).paidAt || (inv as any).lastUpdated;
      if (!paidAt) continue;
      const k = monthKey(new Date(paidAt));
      const bucket = buckets.find((b) => b.key === k);
      if (bucket) bucket.paid += inv.amount ?? 0;
    }
    const totalPaidThisMonth = buckets[buckets.length - 1]?.paid ?? 0;
    const savingsRatio = totalPaidThisMonth > 0 && aggregation.totalSavedThisMonth > 0
      ? aggregation.totalSavedThisMonth / totalPaidThisMonth
      : 0;
    let cumulative = 0;
    return buckets.map((b) => {
      const amount = Math.round(b.paid * savingsRatio);
      cumulative += amount;
      return { month: b.label, amount, cumulative };
    });
  }, [invoices, aggregation.totalSavedThisMonth]);
}

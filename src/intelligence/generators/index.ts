// =============================================================================
// GENERATOR REGISTRY
// =============================================================================
// Barrel export + hook that runs all generators for a given context.
// Hook-based generators use React hooks internally (useCashFlow, etc.)
// so they must be called from within a React component.
// =============================================================================

import { useMemo } from 'react';
import type { GeneratorContext, ScoredInsight, UserRole, ScreenContext } from './types';

// Generator hook imports
import { useOverdueInvoiceInsight } from './overdueInvoiceGenerator';
import { useSavingsOpportunityInsight } from './savingsOpportunityGenerator';
import { useMarginDriftInsight } from './marginDriftGenerator';
import { useComplianceAlertInsight } from './complianceAlertGenerator';
import { useLaborEfficiencyInsight } from './laborEfficiencyGenerator';
import { useEstimationCalibrationInsight } from './estimationCalibrationGenerator';
import { useDSOTrendInsight } from './dsoTrendGenerator';
import { useCertExpiryInsight } from './certExpiryGenerator';
import { useSupplierPriceInsight } from './supplierPriceGenerator';
import { useDailyPlanningInsight } from './dailyPlanningGenerator';
import { useCrossServiceInsight } from './crossServiceGenerator';
import { useCashGapInsight } from './cashGapGenerator';
import { useCapacityInsight } from './capacityGenerator';
import { useGoalProgressInsight } from './goalProgressGenerator';
import { useProfitabilityInsight } from './profitabilityGenerator';
import { useFinancialAuditInsight } from './financialAuditGenerator';

// Cross-service generators
import { useMarginRootCauseInsight } from './marginRootCauseGenerator';
import { useCustomerLifecycleInsight } from './customerLifecycleGenerator';
import { useCascadingDelayInsight } from './cascadingDelayGenerator';

// Static generators (no hooks needed)
import { weatherScheduleGenerator } from './weatherScheduleGenerator';
import { staticTipGenerator } from './staticTipGenerator';

// Re-export types
export type { GeneratorContext, ScoredInsight, UserRole, ScreenContext, ReasoningChain, InsightGenerator } from './types';

// =============================================================================
// Screen relevance mapping — which generators are relevant for which screens
// =============================================================================

interface GeneratorRegistration {
  id: string;
  screens: ScreenContext[];
  roles: UserRole[];
}

const GENERATOR_REGISTRY: GeneratorRegistration[] = [
  { id: 'overdue-invoice', screens: ['today', 'invoices'], roles: ['contractor'] },
  { id: 'savings-opportunity', screens: ['today', 'savings'], roles: ['contractor'] },
  { id: 'margin-drift', screens: ['today', 'savings', 'decisions'], roles: ['contractor'] },
  { id: 'compliance-alert', screens: ['today', 'meer'], roles: ['contractor'] },
  { id: 'labor-efficiency', screens: ['today', 'decisions'], roles: ['contractor'] },
  { id: 'estimation-calibration', screens: ['today', 'savings'], roles: ['contractor'] },
  { id: 'dso-trend', screens: ['today', 'invoices'], roles: ['contractor'] },
  { id: 'cert-expiry', screens: ['today', 'meer'], roles: ['contractor'] },
  { id: 'supplier-price', screens: ['savings', 'meer'], roles: ['contractor'] },
  { id: 'weather-schedule', screens: ['today'], roles: ['contractor'] },
  { id: 'daily-planning', screens: ['today'], roles: ['contractor'] },
  { id: 'cross-service', screens: ['invoices', 'savings', 'decisions'], roles: ['contractor'] },
  { id: 'cash-gap', screens: ['today', 'invoices'], roles: ['contractor'] },
  { id: 'capacity', screens: ['today', 'decisions'], roles: ['contractor'] },
  { id: 'goal-progress', screens: ['today', 'savings'], roles: ['contractor'] },
  { id: 'profitability', screens: ['overview'], roles: ['cfo', 'director'] },
  { id: 'financial-audit', screens: ['today', 'invoices'], roles: ['contractor', 'cfo'] },
  { id: 'margin-root-cause', screens: ['today', 'savings', 'decisions'], roles: ['contractor'] },
  { id: 'customer-lifecycle', screens: ['today', 'invoices', 'decisions'], roles: ['contractor'] },
  { id: 'cascading-delay', screens: ['today', 'schedule', 'decisions'], roles: ['contractor'] },
  { id: 'static-tip', screens: ['today', 'invoices', 'savings', 'decisions', 'meer', 'overview', 'dispatch',
    'costs', 'cashflow', 'returns', 'approvals', 'risks', 'performance',
    'financials', 'efficiency', 'market', 'emerging', 'portfolio', 'safety', 'quality', 'issues'],
    roles: ['contractor', 'sitelead', 'coo', 'cfo', 'director'] },
];

// =============================================================================
// HOOK: useAllGenerators
// =============================================================================
// Runs all generators and returns their insights.
// This is a React hook because generators internally use service hooks.
// =============================================================================

export function useAllGenerators(ctx: GeneratorContext): ScoredInsight[] {
  // Call all hook-based generators unconditionally (React rules of hooks)
  const overdueInvoice = useOverdueInvoiceInsight(ctx);
  const savingsOpp = useSavingsOpportunityInsight(ctx);
  const marginDrift = useMarginDriftInsight(ctx);
  const complianceAlert = useComplianceAlertInsight(ctx);
  const laborEff = useLaborEfficiencyInsight(ctx);
  const estimationCal = useEstimationCalibrationInsight(ctx);
  const dsoTrend = useDSOTrendInsight(ctx);
  const certExpiry = useCertExpiryInsight(ctx);
  const supplierPrice = useSupplierPriceInsight(ctx);
  const dailyPlanning = useDailyPlanningInsight(ctx);
  const crossService = useCrossServiceInsight(ctx);
  const cashGap = useCashGapInsight(ctx);
  const capacity = useCapacityInsight(ctx);
  const goalProgress = useGoalProgressInsight(ctx);
  const profitability = useProfitabilityInsight(ctx);
  const financialAudit = useFinancialAuditInsight(ctx);

  // Cross-service generators
  const marginRootCause = useMarginRootCauseInsight(ctx);
  const customerLifecycle = useCustomerLifecycleInsight(ctx);
  const cascadingDelay = useCascadingDelayInsight(ctx);

  // Static generators (no hooks)
  const weather = weatherScheduleGenerator.generate(ctx);
  const staticTip = staticTipGenerator.generate(ctx);

  return useMemo(() => {
    // Map generator IDs to their results
    const allResults: { id: string; insight: ScoredInsight | null }[] = [
      { id: 'overdue-invoice', insight: overdueInvoice },
      { id: 'savings-opportunity', insight: savingsOpp },
      { id: 'margin-drift', insight: marginDrift },
      { id: 'compliance-alert', insight: complianceAlert },
      { id: 'labor-efficiency', insight: laborEff },
      { id: 'estimation-calibration', insight: estimationCal },
      { id: 'dso-trend', insight: dsoTrend },
      { id: 'cert-expiry', insight: certExpiry },
      { id: 'supplier-price', insight: supplierPrice },
      { id: 'weather-schedule', insight: weather },
      { id: 'daily-planning', insight: dailyPlanning },
      { id: 'cross-service', insight: crossService },
      { id: 'cash-gap', insight: cashGap },
      { id: 'capacity', insight: capacity },
      { id: 'goal-progress', insight: goalProgress },
      { id: 'profitability', insight: profitability },
      { id: 'financial-audit', insight: financialAudit },
      { id: 'margin-root-cause', insight: marginRootCause },
      { id: 'customer-lifecycle', insight: customerLifecycle },
      { id: 'cascading-delay', insight: cascadingDelay },
      { id: 'static-tip', insight: staticTip },
    ];

    // Filter: only include generators relevant for current role + screen
    const relevant = allResults.filter(r => {
      const reg = GENERATOR_REGISTRY.find(g => g.id === r.id);
      if (!reg) return false;
      return reg.roles.includes(ctx.role) && reg.screens.includes(ctx.screen);
    });

    // Collect non-null insights
    return relevant
      .map(r => r.insight)
      .filter((i): i is ScoredInsight => i !== null);
  }, [
    overdueInvoice, savingsOpp, marginDrift, complianceAlert, laborEff,
    estimationCal, dsoTrend, certExpiry, supplierPrice, weather,
    dailyPlanning, crossService, cashGap, capacity, goalProgress,
    profitability, financialAudit, marginRootCause, customerLifecycle,
    cascadingDelay, staticTip, ctx.role, ctx.screen,
  ]);
}

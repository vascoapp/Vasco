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
import { useCostVarianceInsight } from './costVarianceGenerator';
import { useCrossSellInsight } from './crossSellGenerator';
import { useComplianceAlertInsight } from './complianceAlertGenerator';
import { useLaborEfficiencyInsight } from './laborEfficiencyGenerator';
import { useEstimationCalibrationInsight } from './estimationCalibrationGenerator';
import { useDSOTrendInsight } from './dsoTrendGenerator';
import { useCertExpiryInsight } from './certExpiryGenerator';
import { useSupplierPriceInsight } from './supplierPriceGenerator';
import { useDailyPlanningInsight } from './dailyPlanningGenerator';
import { useCrossServiceInsight } from './crossServiceGenerator';
import { useCashGapInsight } from './cashGapGenerator';
import { useCashflowInsight } from './cashflowInsightGenerator';
import { useCapacityInsight } from './capacityGenerator';
import { useGoalProgressInsight } from './goalProgressGenerator';
import { useProfitabilityInsight } from './profitabilityGenerator';
import { useFinancialAuditInsight } from './financialAuditGenerator';

// Profile-driven generators
import { useEstimationVarianceByTypeInsight } from './estimationVarianceByTypeGenerator';

// Cross-service generators
import { useMarginRootCauseInsight } from './marginRootCauseGenerator';
import { useCustomerLifecycleInsight } from './customerLifecycleGenerator';
import { useCascadingDelayInsight } from './cascadingDelayGenerator';

// Procurement intelligence generators
import { useSupplierPriceAnomalyInsight } from './supplierPriceAnomalyGenerator';

// Workflow generators
import { useQuoteBenchmarkInsight } from './quoteBenchmarkGenerator';
import { useMaterialSuggestionInsight } from './materialSuggestionGenerator';
import { useCustomerPaymentHistoryInsight } from './customerPaymentHistoryGenerator';
import { useMarginWarningInsight } from './marginWarningGenerator';
import { useSimilarJobComparisonInsight } from './similarJobComparisonGenerator';

// CFO project generators
import { useProjectBudgetVarianceInsight } from './projectBudgetVarianceGenerator';
import { useContingencyBurnInsight } from './contingencyBurnGenerator';
import { useApprovalBottleneckInsight } from './approvalBottleneckGenerator';
import { useProjectRiskScoreInsight } from './projectRiskScoreGenerator';
import { usePortfolioIRRInsight } from './portfolioIRRGenerator';

// COO generators
import { useScheduleFragilityInsight } from './scheduleFragilityGenerator';
import { useSupplierRiskInsight } from './supplierRiskGenerator';
import { usePermitDelayInsight } from './permitDelayGenerator';
import { useChangeOrderVelocityInsight } from './changeOrderVelocityGenerator';

// Director generators
import { useHandoverBottleneckInsight } from './handoverBottleneckGenerator';
import { usePortfolioHealthInsight } from './portfolioHealthGenerator';
import { useValueDeliveryInsight } from './valueDeliveryGenerator';
import { useCrossProjectRiskInsight } from './crossProjectRiskGenerator';

// Site lead-specific generators
import { useCrewPerformanceInsight } from './crewPerformanceGenerator';
import { useIncidentTrendInsight } from './incidentTrendGenerator';
import { useDefectClusterInsight } from './defectClusterGenerator';
import { useCertRenewalPlannerInsight } from './certRenewalPlannerGenerator';

// Stage 3 intelligence retrofit — lead pipeline, crew capacity, license renewal
import { useLeadFollowupInsight } from './leadFollowupGenerator';
import { useWorkerCapacityInsight } from './workerCapacityGenerator';
import { useLicenseRenewalActionInsight } from './licenseRenewalActionGenerator';

// Static generators (no hooks needed)
import { weatherScheduleGenerator } from './weatherScheduleGenerator';
import { staticTipGenerator } from './staticTipGenerator';

// Re-export types
export type { GeneratorContext, ScoredInsight, UserRole, ScreenContext, ReasoningChain, InsightGenerator, GeneratorLanguage, InsightAction, InsightActionType } from './types';

// =============================================================================
// DATA THRESHOLDS — minimum data required before a generator fires
// =============================================================================
// Generators NOT in this map fire always (e.g. overdue-invoice, cert-expiry,
// weather, daily-planning, static-tip, compliance-alert — useful from day 1).
// =============================================================================

export interface DataCounts {
  jobCount: number;
  invoiceCount: number;
  quoteCount: number;
}

const GENERATOR_THRESHOLDS: Record<string, { minJobs?: number; minInvoices?: number; minQuotes?: number }> = {
  'labor-efficiency': { minJobs: 5 },
  'estimation-calibration': { minJobs: 3 },
  'margin-drift': { minJobs: 5, minInvoices: 5 },
  'margin-warning': { minJobs: 3 },
  'margin-root-cause': { minJobs: 5 },
  'supplier-price-anomaly': { minJobs: 3 },
  'crew-performance': { minJobs: 10 },
  'cross-service': { minJobs: 10 },
  'portfolio-health': { minJobs: 10 },
  'portfolio-irr': { minJobs: 10 },
  'contingency-burn': { minJobs: 5 },
  'schedule-fragility': { minJobs: 5 },
  'dso-trend': { minInvoices: 5 },
  'customer-payment-history': { minInvoices: 5 },
  'cash-gap': { minInvoices: 5 },
  'profitability': { minJobs: 5 },
  'quote-benchmark': { minQuotes: 5 },
  'estimation-variance-type': { minJobs: 10 },
  'similar-job-comparison': { minJobs: 5 },
  'cross-project-risk': { minJobs: 10 },
  'project-budget-variance': { minJobs: 5 },
  'handover-bottleneck': { minJobs: 5 },
  'change-order-velocity': { minJobs: 5 },
  'approval-bottleneck': { minJobs: 5 },
};

function meetsDataThreshold(generatorId: string, counts: DataCounts): boolean {
  const threshold = GENERATOR_THRESHOLDS[generatorId];
  if (!threshold) return true; // no threshold = always fire
  if (threshold.minJobs && counts.jobCount < threshold.minJobs) return false;
  if (threshold.minInvoices && counts.invoiceCount < threshold.minInvoices) return false;
  if (threshold.minQuotes && counts.quoteCount < threshold.minQuotes) return false;
  return true;
}

// =============================================================================
// Screen relevance mapping — which generators are relevant for which screens
// =============================================================================

interface GeneratorRegistration {
  id: string;
  screens: ScreenContext[];
  roles: UserRole[];
}

export const GENERATOR_REGISTRY: GeneratorRegistration[] = [
  // Contractor + enterprise roles where relevant
  { id: 'overdue-invoice', screens: ['today', 'invoices', 'cashflow'], roles: ['contractor', 'cfo'] },
  { id: 'savings-opportunity', screens: ['today', 'savings'], roles: ['contractor'] },
  { id: 'margin-drift', screens: ['today', 'savings', 'decisions', 'financials'], roles: ['contractor', 'cfo', 'director'] },
  { id: 'cost-variance', screens: ['today', 'jobs-list', 'werk'], roles: ['contractor'] },
  { id: 'cross-sell', screens: ['today', 'werk', 'jobs-list'], roles: ['contractor'] },
  { id: 'compliance-alert', screens: ['today', 'meer', 'safety', 'quality', 'risks'], roles: ['contractor', 'sitelead', 'coo'] },
  { id: 'labor-efficiency', screens: ['today', 'decisions', 'efficiency'], roles: ['contractor', 'coo'] },
  { id: 'estimation-calibration', screens: ['today', 'savings'], roles: ['contractor'] },
  { id: 'dso-trend', screens: ['today', 'invoices', 'cashflow'], roles: ['contractor', 'cfo'] },
  { id: 'cert-expiry', screens: ['today', 'meer', 'safety'], roles: ['contractor', 'sitelead'] },
  { id: 'supplier-price', screens: ['savings', 'meer', 'procurement'], roles: ['contractor', 'coo'] },
  { id: 'weather-schedule', screens: ['today', 'schedule'], roles: ['contractor', 'sitelead'] },
  { id: 'daily-planning', screens: ['today', 'schedule', 'dispatch'], roles: ['contractor', 'sitelead'] },
  { id: 'cross-service', screens: ['invoices', 'savings', 'decisions', 'financials'], roles: ['contractor', 'cfo'] },
  { id: 'cash-gap', screens: ['today', 'invoices', 'cashflow'], roles: ['contractor', 'cfo'] },
  { id: 'cashflow-insight', screens: ['geld', 'today', 'cashflow', 'invoices'], roles: ['contractor'] },
  { id: 'capacity', screens: ['today', 'decisions', 'dispatch', 'efficiency'], roles: ['contractor', 'sitelead', 'coo'] },
  { id: 'goal-progress', screens: ['today', 'savings'], roles: ['contractor'] },
  { id: 'profitability', screens: ['overview', 'financials', 'portfolio'], roles: ['contractor', 'cfo', 'director'] },
  { id: 'financial-audit', screens: ['today', 'invoices', 'financials'], roles: ['contractor', 'cfo', 'director'] },
  { id: 'margin-root-cause', screens: ['today', 'savings', 'decisions', 'financials'], roles: ['contractor', 'cfo'] },
  { id: 'customer-lifecycle', screens: ['today', 'invoices', 'decisions'], roles: ['contractor'] },
  { id: 'cascading-delay', screens: ['today', 'schedule', 'decisions', 'dispatch'], roles: ['contractor', 'sitelead', 'coo'] },
  { id: 'estimation-variance-type', screens: ['today', 'savings', 'decisions'], roles: ['contractor'] },
  { id: 'supplier-price-anomaly', screens: ['today', 'savings', 'decisions', 'procurement', 'financials'], roles: ['contractor', 'cfo', 'coo'] },
  { id: 'static-tip', screens: ['today', 'invoices', 'savings', 'decisions', 'meer', 'overview', 'dispatch',
    'costs', 'cashflow', 'returns', 'approvals', 'risks', 'performance',
    'financials', 'efficiency', 'market', 'emerging', 'portfolio', 'safety', 'quality', 'issues',
    'quote-new', 'invoice-new', 'invoice-create', 'job-detail', 'job-materials', 'jobs-list',
    'cfo-projects', 'cfo-costs', 'cfo-appraisal', 'cfo-risks', 'cfo-approvals',
    'coo-schedule', 'director-metrics'],
    roles: ['contractor', 'sitelead', 'coo', 'cfo', 'director'] },
  // Workflow generators
  { id: 'quote-benchmark', screens: ['quote-new', 'today'], roles: ['contractor'] },
  { id: 'material-suggestion', screens: ['job-materials', 'job-detail'], roles: ['contractor'] },
  { id: 'customer-payment-history', screens: ['invoice-new', 'invoice-create', 'quote-new'], roles: ['contractor'] },
  { id: 'margin-warning', screens: ['job-detail', 'quote-new'], roles: ['contractor'] },
  { id: 'similar-job-comparison', screens: ['jobs-list', 'job-detail', 'quote-new'], roles: ['contractor'] },
  // CFO project generators
  { id: 'project-budget-variance', screens: ['cfo-costs', 'cfo-projects'], roles: ['cfo', 'director'] },
  { id: 'contingency-burn', screens: ['cfo-costs', 'cfo-projects'], roles: ['cfo', 'director'] },
  { id: 'approval-bottleneck', screens: ['cfo-approvals', 'cfo-projects'], roles: ['cfo', 'director'] },
  { id: 'project-risk-score', screens: ['cfo-risks', 'cfo-projects'], roles: ['cfo', 'director', 'coo'] },
  { id: 'portfolio-irr', screens: ['cfo-appraisal', 'cfo-projects'], roles: ['cfo', 'director'] },
  // COO generators
  { id: 'schedule-fragility', screens: ['efficiency', 'coo-schedule', 'schedule'], roles: ['coo', 'director'] },
  { id: 'supplier-risk', screens: ['emerging', 'procurement'], roles: ['coo', 'sitelead'] },
  { id: 'permit-delay', screens: ['market', 'permits'], roles: ['coo', 'director'] },
  { id: 'change-order-velocity', screens: ['financials', 'efficiency', 'costs'], roles: ['coo', 'cfo'] },
  // Site lead-specific generators — also exposed to contractor when isAannemer.
  // Generators internally return null when site-lead data is absent (no defects/
  // incidents/reports), so solo contractors don't see noise; aannemers running
  // multi-trade projects with logged site activity DO see the insights.
  { id: 'crew-performance', screens: ['today', 'overview', 'schedule', 'dispatch'], roles: ['sitelead', 'contractor'] },
  { id: 'incident-trend', screens: ['today', 'safety', 'overview'], roles: ['sitelead', 'coo', 'contractor'] },
  { id: 'defect-cluster', screens: ['today', 'quality', 'overview', 'issues'], roles: ['sitelead', 'coo', 'contractor'] },
  { id: 'cert-renewal-planner', screens: ['today', 'safety', 'compliance', 'overview'], roles: ['sitelead', 'contractor'] },
  // Stage 3 intelligence retrofit
  // lead-followup: stale-lead nudges. Fires only for contractors with leads.
  { id: 'lead-followup', screens: ['today', 'werk', 'jobs-list'], roles: ['contractor'] },
  // worker-capacity: only fires for contractors with >= 2 workers, so the
  // generator silently returns null for solo contractors regardless of
  // screen wiring. Same screens as 'capacity' (the trade-level forecast)
  // so they share the planning surface.
  { id: 'worker-capacity', screens: ['today', 'decisions', 'dispatch', 'efficiency'], roles: ['contractor', 'sitelead', 'coo'] },
  // license-renewal-action: contractor-level (R80) license renewal queue.
  // Distinct from cert-renewal-planner (worker certs) — same screens for
  // shared compliance surface.
  { id: 'license-renewal-action', screens: ['today', 'meer', 'compliance', 'safety'], roles: ['contractor'] },
  // Director generators
  { id: 'handover-bottleneck', screens: ['portfolio', 'approvals'], roles: ['director', 'cfo'] },
  { id: 'portfolio-health', screens: ['portfolio', 'performance'], roles: ['director'] },
  { id: 'value-delivery', screens: ['performance', 'director-metrics'], roles: ['director', 'cfo'] },
  { id: 'cross-project-risk', screens: ['risks', 'portfolio'], roles: ['director'] },
];

// =============================================================================
// HOOK: useAllGenerators
// =============================================================================
// Runs all generators and returns their insights.
// This is a React hook because generators internally use service hooks.
// =============================================================================

export function useAllGenerators(ctx: GeneratorContext, dataCounts?: DataCounts): ScoredInsight[] {
  // Call all hook-based generators unconditionally (React rules of hooks)
  const overdueInvoice = useOverdueInvoiceInsight(ctx);
  const savingsOpp = useSavingsOpportunityInsight(ctx);
  const marginDrift = useMarginDriftInsight(ctx);
  const costVariance = useCostVarianceInsight(ctx);
  const crossSell = useCrossSellInsight(ctx);
  const complianceAlert = useComplianceAlertInsight(ctx);
  const laborEff = useLaborEfficiencyInsight(ctx);
  const estimationCal = useEstimationCalibrationInsight(ctx);
  const dsoTrend = useDSOTrendInsight(ctx);
  const certExpiry = useCertExpiryInsight(ctx);
  const supplierPrice = useSupplierPriceInsight(ctx);
  const dailyPlanning = useDailyPlanningInsight(ctx);
  const crossService = useCrossServiceInsight(ctx);
  const cashGap = useCashGapInsight(ctx);
  const cashflowInsight = useCashflowInsight(ctx);
  const capacity = useCapacityInsight(ctx);
  const goalProgress = useGoalProgressInsight(ctx);
  const profitability = useProfitabilityInsight(ctx);
  const financialAudit = useFinancialAuditInsight(ctx);

  // Profile-driven generators
  const estimationVarianceType = useEstimationVarianceByTypeInsight(ctx);

  // Cross-service generators
  const marginRootCause = useMarginRootCauseInsight(ctx);
  const customerLifecycle = useCustomerLifecycleInsight(ctx);
  const cascadingDelay = useCascadingDelayInsight(ctx);

  // Procurement intelligence generators
  const supplierPriceAnomaly = useSupplierPriceAnomalyInsight(ctx);

  // Workflow generators
  const quoteBenchmark = useQuoteBenchmarkInsight(ctx);
  const materialSuggestion = useMaterialSuggestionInsight(ctx);
  const customerPaymentHistory = useCustomerPaymentHistoryInsight(ctx);
  const marginWarning = useMarginWarningInsight(ctx);
  const similarJobComparison = useSimilarJobComparisonInsight(ctx);

  // CFO project generators
  const projectBudgetVariance = useProjectBudgetVarianceInsight(ctx);
  const contingencyBurn = useContingencyBurnInsight(ctx);
  const approvalBottleneck = useApprovalBottleneckInsight(ctx);
  const projectRiskScore = useProjectRiskScoreInsight(ctx);
  const portfolioIRR = usePortfolioIRRInsight(ctx);

  // COO generators
  const scheduleFragility = useScheduleFragilityInsight(ctx);
  const supplierRisk = useSupplierRiskInsight(ctx);
  const permitDelay = usePermitDelayInsight(ctx);
  const changeOrderVelocity = useChangeOrderVelocityInsight(ctx);

  // Site lead-specific generators
  const crewPerformance = useCrewPerformanceInsight(ctx);
  const incidentTrend = useIncidentTrendInsight(ctx);
  const defectCluster = useDefectClusterInsight(ctx);
  const certRenewalPlanner = useCertRenewalPlannerInsight(ctx);

  // Stage 3 intelligence retrofit
  const leadFollowup = useLeadFollowupInsight(ctx);
  const workerCapacity = useWorkerCapacityInsight(ctx);
  const licenseRenewalAction = useLicenseRenewalActionInsight(ctx);

  // Director generators
  const handoverBottleneck = useHandoverBottleneckInsight(ctx);
  const portfolioHealth = usePortfolioHealthInsight(ctx);
  const valueDelivery = useValueDeliveryInsight(ctx);
  const crossProjectRisk = useCrossProjectRiskInsight(ctx);

  // Static generators (no hooks)
  const weather = weatherScheduleGenerator.generate(ctx);
  const staticTip = staticTipGenerator.generate(ctx);

  return useMemo(() => {
    // Map generator IDs to their results
    const allResults: { id: string; insight: ScoredInsight | null }[] = [
      { id: 'overdue-invoice', insight: overdueInvoice },
      { id: 'savings-opportunity', insight: savingsOpp },
      { id: 'margin-drift', insight: marginDrift },
      { id: 'cost-variance', insight: costVariance },
      { id: 'cross-sell', insight: crossSell },
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
      { id: 'cashflow-insight', insight: cashflowInsight },
      { id: 'capacity', insight: capacity },
      { id: 'goal-progress', insight: goalProgress },
      { id: 'profitability', insight: profitability },
      { id: 'financial-audit', insight: financialAudit },
      { id: 'margin-root-cause', insight: marginRootCause },
      { id: 'customer-lifecycle', insight: customerLifecycle },
      { id: 'cascading-delay', insight: cascadingDelay },
      { id: 'estimation-variance-type', insight: estimationVarianceType },
      { id: 'supplier-price-anomaly', insight: supplierPriceAnomaly },
      { id: 'static-tip', insight: staticTip },
      { id: 'quote-benchmark', insight: quoteBenchmark },
      { id: 'material-suggestion', insight: materialSuggestion },
      { id: 'customer-payment-history', insight: customerPaymentHistory },
      { id: 'margin-warning', insight: marginWarning },
      { id: 'similar-job-comparison', insight: similarJobComparison },
      { id: 'project-budget-variance', insight: projectBudgetVariance },
      { id: 'contingency-burn', insight: contingencyBurn },
      { id: 'approval-bottleneck', insight: approvalBottleneck },
      { id: 'project-risk-score', insight: projectRiskScore },
      { id: 'portfolio-irr', insight: portfolioIRR },
      { id: 'schedule-fragility', insight: scheduleFragility },
      { id: 'supplier-risk', insight: supplierRisk },
      { id: 'permit-delay', insight: permitDelay },
      { id: 'change-order-velocity', insight: changeOrderVelocity },
      { id: 'handover-bottleneck', insight: handoverBottleneck },
      { id: 'portfolio-health', insight: portfolioHealth },
      { id: 'value-delivery', insight: valueDelivery },
      { id: 'cross-project-risk', insight: crossProjectRisk },
      { id: 'crew-performance', insight: crewPerformance },
      { id: 'incident-trend', insight: incidentTrend },
      { id: 'defect-cluster', insight: defectCluster },
      { id: 'cert-renewal-planner', insight: certRenewalPlanner },
      { id: 'lead-followup', insight: leadFollowup },
      { id: 'worker-capacity', insight: workerCapacity },
      { id: 'license-renewal-action', insight: licenseRenewalAction },
    ];

    // Filter: only include generators relevant for current role + screen + data threshold
    const counts = dataCounts || { jobCount: 0, invoiceCount: 0, quoteCount: 0 };
    const relevant = allResults.filter(r => {
      const reg = GENERATOR_REGISTRY.find(g => g.id === r.id);
      if (!reg) return false;
      if (!reg.roles.includes(ctx.role) || !reg.screens.includes(ctx.screen)) return false;
      // Suppress generators that don't have enough data yet
      if (!meetsDataThreshold(r.id, counts)) return false;
      return true;
    });

    // Collect non-null insights
    return relevant
      .map(r => r.insight)
      .filter((i): i is ScoredInsight => i !== null);
  }, [
    overdueInvoice, savingsOpp, marginDrift, costVariance, crossSell, complianceAlert, laborEff,
    estimationCal, dsoTrend, certExpiry, supplierPrice, weather,
    dailyPlanning, crossService, cashGap, cashflowInsight, capacity, goalProgress,
    profitability, financialAudit, marginRootCause, customerLifecycle,
    cascadingDelay, estimationVarianceType, supplierPriceAnomaly, staticTip,
    quoteBenchmark, materialSuggestion, customerPaymentHistory,
    marginWarning, similarJobComparison,
    projectBudgetVariance, contingencyBurn, approvalBottleneck,
    projectRiskScore, portfolioIRR,
    scheduleFragility, supplierRisk, permitDelay, changeOrderVelocity,
    handoverBottleneck, portfolioHealth, valueDelivery, crossProjectRisk,
    crewPerformance, incidentTrend, defectCluster, certRenewalPlanner,
    leadFollowup, workerCapacity, licenseRenewalAction,
    ctx.role, ctx.screen, dataCounts,
  ]);
}

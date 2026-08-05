// =============================================================================
// SERVICES INDEX
// =============================================================================
// Central export for all services
// =============================================================================

export {
  jobDecisionLinker,
  useJobDecisionLinker,
  useTemplateSuggestion,
  DEFAULT_TEMPLATES,
} from './jobDecisionLinker';

// Phase 3: Data-Driven Intelligence
export {
  reorderService,
  useInventory,
  useReorderSuggestions,
  useReorderBundles,
} from './reorderService';


// Phase 4: Network & Integration
export {
  contractorNetworkService,
  useContractorNetwork,
  useReferrals,
  useContractorProfile,
} from './contractorNetworkService';

export {
  supplierIntegrationService,
  useSuppliers,
  useProductSearch,
  useCart,
  useOrders,
} from './supplierIntegrationService';


// Phase 5: Advanced Intelligence
export {
  projectPlannerService,
  useProjectPlanner,
} from './projectPlannerService';

export {
  pricingEngineService,
  usePricingEngine,
} from './pricingEngineService';

export {
  reputationService,
  useReviews,
  useReputation,
} from './reputationService';

// Phase 6: Financial Intelligence & Workflow Automation
export {
  cashFlowService,
  useCashFlow,
  usePaymentReminders,
  useFinancingSuggestions,
  useSeasonalPatterns,
} from './cashFlowService';

export {
  smartSchedulerService,
  useScheduler,
  useDaySchedule,
  useWeekSchedule,
  useWeatherAlerts,
} from './smartSchedulerService';

export {
  documentVaultService,
  useDocuments,
  useExpiringDocuments,
  useDocumentStats,
  useDocumentFolders,
  useDocumentTemplates,
} from './documentVaultService';

export {
  aiAssistantService,
  useAssistant,
  useProactiveInsights,
  useBusinessSuggestions,
  useConversationHistory,
} from './aiAssistantService';

// Phase 7: Ecosystem Integration & Predictive Intelligence
export {
  teamManagementService,
  useTeamMembers,
  useTimeTracking,
  useTeamPerformance,
  useLeaveRequests,
  useTeamStats,
  useSkillMatching,
} from './teamManagementService';

export {
  equipmentTrackerService,
  useEquipment,
  useEquipmentCheckouts,
  useMaintenanceSchedule,
  useEquipmentUtilization,
  useDepreciation,
  useEquipmentAlerts,
  useEquipmentStats,
} from './equipmentTrackerService';

export {
  complianceService,
  useLicenses,
  useCertifications,
  useSafetyChecklists,
  useRegulatoryUpdates,
  useInsurancePolicies,
  useComplianceAlerts,
  useComplianceStats,
  useExpiryCalendar,
} from './complianceService';

export {
  predictiveMaintenanceService,
  useEquipmentHealth,
  useFailurePredictions,
  useMaintenanceRecommendations,
  usePartOrderSuggestions,
  useCostSavings,
  usePredictiveStats,
} from './predictiveMaintenanceService';

// Phase 8: Customer Lifecycle & Revenue Optimization
export {
  serviceContractsService,
  useServiceContracts,
  useUpcomingVisits as useContractVisits,
  useContractRenewals,
  useContractStats,
} from './serviceContractsService';

export {
  leadGenerationService,
  useLeads,
  useLeadFunnel,
  useLeadStats,
} from './leadGenerationService';

export {
  warrantyManagerService,
  useWarranties,
  useWarrantyClaims,
  useWarrantyStats,
} from './warrantyManagerService';

export {
  upsellEngineService,
  useUpsellRecommendations,
  useUpsellPerformance,
  useUpsellStats,
} from './upsellEngineService';

// Phase 9: Business Intelligence & Automation
export {
  invoiceAutomationService,
  useAutoInvoices,
  usePaymentReminders as useInvoiceReminders,
  useInvoiceStats,
} from './invoiceAutomationService';

export {
  routeOptimizerService,
  useTodaysRoutes,
  useRouteStats,
} from './routeOptimizerService';

export {
  customerInsightsService,
  useCustomerProfiles,
  useCustomerSegments,
  useChurnPredictions,
  useCustomerInsightsStats,
} from './customerInsightsService';

export {
  businessBenchmarkingService,
  useBenchmarkCategories,
  usePerformanceGoals,
  useImprovementOpportunities,
  useCompetitivePosition,
  useBenchmarkStats,
} from './businessBenchmarkingService';

// =============================================================================
// A16Z CRE AI TRADES - NEW FEATURES
// =============================================================================

// P0: Evidence Pack & Handover Orchestration (E8 - Beachhead)
export {
  evidencePackService,
  useEvidencePack,
  useHandoverPackage,
  useEvidencePacksForJob,
} from './evidencePackService';

// P1: Supplier Reliability Tracking (E11 - Predictive)
export {
  supplierReliabilityService,
  useSupplierPerformance,
  useSupplierRanking,
  useDriftAlerts,
  useSupplierReliabilityStats,
} from './supplierReliabilityService';

// P2: Schedule Fragility Scoring (E11 - Predictive)
export {
  scheduleFragilityService,
  useFragilityScore,
  useCriticalPath,
  useFragilityAlerts,
  useWhatIfAnalysis,
  useScheduleFragilityStats,
} from './scheduleFragilityService';

// Phase 4: Cross-Role Workflows
export {
  crossRoleWorkflowService,
  useWorkflow,
  useWorkflowsForRole,
  usePendingWorkflows,
  useJobToPaymentWorkflows,
  useSupplierEscalations,
  useWorkflowStats,
} from './crossRoleWorkflowService';

// Phase 10: Predictive Capacity Planning
export {
  capacityPlanningService,
  useCapacityForecast,
  useAvailabilityWindows,
  useDurationEstimate,
  useOverrunPrediction,
  useDelayAnalysis,
  useCapacityAlerts,
  useCustomerQuoteResponse,
  usePredictionAccuracy,
} from './capacityPlanningService';

// ROI Metrics
export {
  useROIMetrics,
  useHoursSavedDisplay,
  useROIGoals,
  useROIDashboard,
  useAutomationROI,
} from './roiMetricsService';

// Dutch Compliance
export {
  useComplianceDashboard,
} from './dutchComplianceService';

// ROI Insights (alias)

// BuildOS Europe - Mock Project Data
// Sample projects for UK, Netherlands, and Germany

import { Project, Country, DevelopmentAppraisal, DeliveryMetrics, SiteMetrics } from '../types/buildos';

// ============================================
// SAMPLE PROJECTS
// ============================================

export const mockProjects: Project[] = [
  // UK Project - London Office Development
  {
    id: 'uk-001',
    name: 'One Broadgate Place',
    country: 'UK',
    currency: 'GBP',
    phase: 'construction',
    address: {
      street: '1 Broadgate Circle',
      city: 'London',
      region: 'Greater London',
      postalCode: 'EC2M 2QS',
      country: 'UK',
    },
    parcels: [
      {
        id: 'uk-001-p1',
        projectId: 'uk-001',
        reference: 'TL3284SW',
        areaSqm: 4500,
        acquisitionDate: '2023-06-15',
        acquisitionPrice: 45000000,
        transferTaxPaid: 2025000,
        zoning: 'Commercial/Office',
        constraints: ['Listed building adjacent', 'Archaeological potential'],
      },
    ],
    permits: [
      {
        id: 'uk-001-permit-1',
        projectId: 'uk-001',
        type: 'planning',
        reference: '2023/AP/004521',
        authority: 'City of London Corporation',
        status: 'approved-with-conditions',
        submissionDate: '2023-09-01',
        targetDecisionDate: '2023-12-01',
        actualDecisionDate: '2023-11-28',
        conditions: [
          {
            id: 'cond-1',
            description: 'Submit construction management plan',
            dischargeRequired: true,
            dischargedDate: '2024-01-15',
            triggerPoint: 'before commencement',
          },
          {
            id: 'cond-2',
            description: 'Achieve BREEAM Excellent rating',
            dischargeRequired: true,
            triggerPoint: 'before occupation',
          },
        ],
        documents: [],
        countryData: {
          applicationClass: 'major',
          localAuthority: 'City of London',
          s106Required: true,
          s106Amount: 2500000,
          s106Heads: [
            {
              category: 'Affordable housing contribution',
              obligation: 'Financial contribution in lieu',
              financialValue: 1800000,
              triggerPoint: 'before occupation',
              status: 'pending',
            },
            {
              category: 'Highways improvements',
              obligation: 'Public realm works',
              financialValue: 450000,
              triggerPoint: 'before occupation',
              status: 'pending',
            },
            {
              category: 'Employment & training',
              obligation: 'Local employment scheme',
              financialValue: 250000,
              triggerPoint: 'during construction',
              status: 'discharged',
            },
          ],
          cilRequired: true,
          cilAmount: 1250000,
          appealLodged: false,
        },
      },
    ],
    contracts: [
      {
        id: 'uk-001-c1',
        projectId: 'uk-001',
        type: 'main-contractor',
        counterparty: 'Mace Construction',
        description: 'Main building contract - D&B',
        status: 'in-progress',
        contractSum: 85000000,
        currency: 'GBP',
        startDate: '2024-03-01',
        endDate: '2026-06-30',
        retentionPercent: 3,
        retentionHeld: 2550000,
        variations: [
          {
            id: 'var-1',
            contractId: 'uk-001-c1',
            reference: 'VO-001',
            description: 'Enhanced facade specification',
            amount: 1200000,
            status: 'approved',
            submittedDate: '2024-08-15',
            approvedDate: '2024-09-01',
            approvedBy: 'Project Director',
          },
        ],
        documents: [],
      },
    ],
    budgetLines: [
      { id: 'bl-1', projectId: 'uk-001', category: 'land', costCode: '100', description: 'Land acquisition', originalBudget: 45000000, currentBudget: 45000000, committed: 45000000, actualSpent: 45000000, forecastFinal: 45000000, variance: 0 },
      { id: 'bl-2', projectId: 'uk-001', category: 'construction', costCode: '200', description: 'Main contract', originalBudget: 82000000, currentBudget: 85000000, committed: 86200000, actualSpent: 42000000, forecastFinal: 87500000, variance: -2500000 },
      { id: 'bl-3', projectId: 'uk-001', category: 'professional-fees', costCode: '300', description: 'Professional fees', originalBudget: 8500000, currentBudget: 8500000, committed: 8200000, actualSpent: 5100000, forecastFinal: 8400000, variance: 100000 },
      { id: 'bl-4', projectId: 'uk-001', category: 'statutory-fees', costCode: '400', description: 'S106 & CIL', originalBudget: 3500000, currentBudget: 3750000, committed: 3750000, actualSpent: 250000, forecastFinal: 3750000, variance: 0 },
      { id: 'bl-5', projectId: 'uk-001', category: 'finance-costs', costCode: '500', description: 'Interest & fees', originalBudget: 12000000, currentBudget: 13500000, committed: 0, actualSpent: 4200000, forecastFinal: 14200000, variance: -700000 },
      { id: 'bl-6', projectId: 'uk-001', category: 'contingency', costCode: '900', description: 'Contingency', originalBudget: 8000000, currentBudget: 8000000, committed: 0, actualSpent: 1800000, forecastFinal: 6000000, variance: 2000000 },
    ],
    invoices: [],
    scheduleActivities: [
      { id: 'sa-1', projectId: 'uk-001', wbsCode: '1.0', name: 'Project start', description: 'Project commencement', plannedStart: '2024-03-01', plannedFinish: '2024-03-01', actualStart: '2024-03-01', actualFinish: '2024-03-01', percentComplete: 100, status: 'completed', isMilestone: true, isCriticalPath: true, predecessors: [], successors: ['sa-2'], float: 0 },
      { id: 'sa-2', projectId: 'uk-001', wbsCode: '2.0', name: 'Substructure', description: 'Foundations and basement', plannedStart: '2024-03-04', plannedFinish: '2024-07-15', actualStart: '2024-03-04', actualFinish: '2024-08-02', percentComplete: 100, status: 'completed', isMilestone: false, isCriticalPath: true, predecessors: ['sa-1'], successors: ['sa-3'], float: 0 },
      { id: 'sa-3', projectId: 'uk-001', wbsCode: '3.0', name: 'Superstructure', description: 'Frame and core', plannedStart: '2024-07-16', plannedFinish: '2025-03-31', actualStart: '2024-08-05', forecastFinish: '2025-05-15', percentComplete: 65, status: 'in-progress', isMilestone: false, isCriticalPath: true, predecessors: ['sa-2'], successors: ['sa-4'], float: 0 },
      { id: 'sa-4', projectId: 'uk-001', wbsCode: '4.0', name: 'Envelope', description: 'Facade and roofing', plannedStart: '2025-01-15', plannedFinish: '2025-09-30', forecastFinish: '2025-11-15', percentComplete: 15, status: 'in-progress', isMilestone: false, isCriticalPath: true, predecessors: ['sa-3'], successors: ['sa-5'], float: 0 },
      { id: 'sa-5', projectId: 'uk-001', wbsCode: '5.0', name: 'Practical completion', description: 'PC milestone', plannedStart: '2026-06-30', plannedFinish: '2026-06-30', forecastFinish: '2026-08-31', percentComplete: 0, status: 'not-started', isMilestone: true, isCriticalPath: true, predecessors: ['sa-4'], successors: [], float: 0 },
    ],
    risks: [
      { id: 'r-1', projectId: 'uk-001', category: 'construction', description: 'Facade supply chain delays due to manufacturer capacity', likelihood: 3, impact: 4, score: 12, mitigation: 'Early order placement and alternative supplier identification', owner: 'Procurement Manager', status: 'mitigating', costExposure: 1500000, scheduleExposureDays: 45 },
      { id: 'r-2', projectId: 'uk-001', category: 'financial', description: 'Interest rate increase impact on finance costs', likelihood: 4, impact: 3, score: 12, mitigation: 'Hedge 60% of debt exposure', owner: 'CFO', status: 'mitigating', costExposure: 800000 },
    ],
    changeOrders: [
      { id: 'co-1', projectId: 'uk-001', contractId: 'uk-001-c1', reference: 'CO-001', description: 'Enhanced facade thermal performance', reason: 'BREEAM requirement clarification', proposedAmount: 1200000, approvedAmount: 1200000, timeImpactDays: 14, status: 'implemented', submittedDate: '2024-08-15', submittedBy: 'Design Manager', reviewedDate: '2024-08-25', reviewedBy: 'QS', approvedDate: '2024-09-01', approvedBy: 'Project Director', documents: [] },
    ],
    siteEvents: [],
    totalBudget: 159000000,
    committedCosts: 143150000,
    actualSpent: 98350000,
    contingency: 8000000,
    contingencyUsed: 1800000,
    plannedStartDate: '2024-03-01',
    plannedEndDate: '2026-06-30',
    actualStartDate: '2024-03-01',
    forecastEndDate: '2026-08-31',
    createdAt: '2023-06-01T00:00:00Z',
    updatedAt: '2025-01-30T00:00:00Z',
  },

  // Netherlands Project - Amsterdam Office Repositioning
  {
    id: 'nl-001',
    name: 'Zuidas Tower Retrofit',
    country: 'NL',
    currency: 'EUR',
    phase: 'pre-construction',
    address: {
      street: 'Gustav Mahlerlaan 10',
      city: 'Amsterdam',
      region: 'Noord-Holland',
      postalCode: '1082 PP',
      country: 'NL',
    },
    parcels: [
      {
        id: 'nl-001-p1',
        projectId: 'nl-001',
        reference: 'ASD-2024-ZUI-001',
        areaSqm: 12000,
        acquisitionDate: '2024-02-01',
        acquisitionPrice: 38000000,
        transferTaxPaid: 3952000,
        zoning: 'Kantoor/Mixed-use',
        constraints: ['Energy label upgrade required', 'Heritage facade elements'],
      },
    ],
    permits: [
      {
        id: 'nl-001-permit-1',
        projectId: 'nl-001',
        type: 'omgevingsvergunning',
        reference: 'OLO-2024-AMZ-00142',
        authority: 'Gemeente Amsterdam',
        status: 'under-review',
        submissionDate: '2024-11-15',
        targetDecisionDate: '2025-01-10',
        conditions: [],
        documents: [],
        countryData: {
          procedure: 'regular',
          omgevingsloketRef: 'OLO-2024-AMZ-00142',
          activiteiten: ['bouwen', 'wijzigen monument', 'milieu'],
          labelCCompliant: false,
          currentEnergyLabel: 'E',
          targetEnergyLabel: 'A',
        },
      },
    ],
    contracts: [],
    budgetLines: [
      { id: 'nl-bl-1', projectId: 'nl-001', category: 'land', costCode: '100', description: 'Building acquisition', originalBudget: 38000000, currentBudget: 38000000, committed: 38000000, actualSpent: 38000000, forecastFinal: 38000000, variance: 0 },
      { id: 'nl-bl-2', projectId: 'nl-001', category: 'construction', costCode: '200', description: 'Retrofit works', originalBudget: 22000000, currentBudget: 22000000, committed: 0, actualSpent: 0, forecastFinal: 23500000, variance: -1500000 },
      { id: 'nl-bl-3', projectId: 'nl-001', category: 'professional-fees', costCode: '300', description: 'Design & consultants', originalBudget: 2800000, currentBudget: 2800000, committed: 1200000, actualSpent: 850000, forecastFinal: 2900000, variance: -100000 },
      { id: 'nl-bl-4', projectId: 'nl-001', category: 'contingency', costCode: '900', description: 'Contingency', originalBudget: 3200000, currentBudget: 3200000, committed: 0, actualSpent: 0, forecastFinal: 3200000, variance: 0 },
    ],
    invoices: [],
    scheduleActivities: [
      { id: 'nl-sa-1', projectId: 'nl-001', wbsCode: '1.0', name: 'Permit approval', plannedStart: '2024-11-15', plannedFinish: '2025-01-10', percentComplete: 60, status: 'in-progress', isMilestone: true, isCriticalPath: true, predecessors: [], successors: ['nl-sa-2'], float: 0 },
      { id: 'nl-sa-2', projectId: 'nl-001', wbsCode: '2.0', name: 'Tender & award', plannedStart: '2025-01-13', plannedFinish: '2025-03-31', percentComplete: 0, status: 'not-started', isMilestone: false, isCriticalPath: true, predecessors: ['nl-sa-1'], successors: ['nl-sa-3'], float: 0 },
      { id: 'nl-sa-3', projectId: 'nl-001', wbsCode: '3.0', name: 'Construction start', plannedStart: '2025-04-01', plannedFinish: '2025-04-01', percentComplete: 0, status: 'not-started', isMilestone: true, isCriticalPath: true, predecessors: ['nl-sa-2'], successors: [], float: 0 },
    ],
    risks: [
      { id: 'nl-r-1', projectId: 'nl-001', category: 'regulatory', description: 'Permit extension to extended procedure', likelihood: 2, impact: 4, score: 8, mitigation: 'Pre-application consultation completed', owner: 'Development Manager', status: 'mitigating', scheduleExposureDays: 120 },
      { id: 'nl-r-2', projectId: 'nl-001', category: 'construction', description: 'Hidden defects in existing structure', likelihood: 3, impact: 3, score: 9, mitigation: 'Comprehensive surveys completed', owner: 'Project Manager', status: 'identified', costExposure: 1200000 },
    ],
    changeOrders: [],
    siteEvents: [],
    totalBudget: 66000000,
    committedCosts: 39200000,
    actualSpent: 38850000,
    contingency: 3200000,
    contingencyUsed: 0,
    plannedStartDate: '2025-04-01',
    plannedEndDate: '2026-09-30',
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2025-01-30T00:00:00Z',
  },

  // Germany Project - Frankfurt Mixed-Use
  {
    id: 'de-001',
    name: 'Frankfurt Westend Quarter',
    country: 'DE',
    currency: 'EUR',
    phase: 'planning',
    address: {
      street: 'Bockenheimer Landstraße 24',
      city: 'Frankfurt am Main',
      region: 'Hessen',
      postalCode: '60323',
      country: 'DE',
    },
    parcels: [
      {
        id: 'de-001-p1',
        projectId: 'de-001',
        reference: 'FFM-WE-2024-001',
        areaSqm: 8500,
        acquisitionDate: '2024-06-01',
        acquisitionPrice: 52000000,
        transferTaxPaid: 3120000, // 6% Hessen rate
        zoning: 'Kerngebiet (MK)',
        constraints: ['Denkmalschutz adjacent', 'Noise protection requirements'],
      },
    ],
    permits: [
      {
        id: 'de-001-permit-1',
        projectId: 'de-001',
        type: 'bouwvergunning',
        authority: 'Bauaufsicht Frankfurt',
        status: 'submitted',
        submissionDate: '2024-12-01',
        targetDecisionDate: '2025-03-01',
        conditions: [],
        documents: [],
        countryData: {
          bundesland: 'Hessen',
          procedure: 'full',
          completenessConfirmed: true,
          completenessDate: '2024-12-15',
          specialistDepartments: ['Brandschutz', 'Denkmalschutz', 'Umweltamt'],
          gegCompliant: true,
        },
      },
    ],
    contracts: [],
    budgetLines: [
      { id: 'de-bl-1', projectId: 'de-001', category: 'land', costCode: '100', description: 'Grundstück', originalBudget: 52000000, currentBudget: 52000000, committed: 52000000, actualSpent: 52000000, forecastFinal: 52000000, variance: 0 },
      { id: 'de-bl-2', projectId: 'de-001', category: 'construction', costCode: '200', description: 'Baukosten', originalBudget: 78000000, currentBudget: 78000000, committed: 0, actualSpent: 0, forecastFinal: 82000000, variance: -4000000 },
      { id: 'de-bl-3', projectId: 'de-001', category: 'professional-fees', costCode: '300', description: 'Planungskosten', originalBudget: 9500000, currentBudget: 9500000, committed: 4200000, actualSpent: 2800000, forecastFinal: 9800000, variance: -300000 },
      { id: 'de-bl-4', projectId: 'de-001', category: 'statutory-fees', costCode: '400', description: 'Gebühren & Abgaben', originalBudget: 4500000, currentBudget: 4500000, committed: 3120000, actualSpent: 3120000, forecastFinal: 4500000, variance: 0 },
      { id: 'de-bl-5', projectId: 'de-001', category: 'contingency', costCode: '900', description: 'Reserven', originalBudget: 7000000, currentBudget: 7000000, committed: 0, actualSpent: 0, forecastFinal: 7000000, variance: 0 },
    ],
    invoices: [],
    scheduleActivities: [
      { id: 'de-sa-1', projectId: 'de-001', wbsCode: '1.0', name: 'Baugenehmigung', plannedStart: '2024-12-01', plannedFinish: '2025-03-01', percentComplete: 30, status: 'in-progress', isMilestone: true, isCriticalPath: true, predecessors: [], successors: ['de-sa-2'], float: 0 },
      { id: 'de-sa-2', projectId: 'de-001', wbsCode: '2.0', name: 'Ausschreibung', plannedStart: '2025-03-03', plannedFinish: '2025-06-30', percentComplete: 0, status: 'not-started', isMilestone: false, isCriticalPath: true, predecessors: ['de-sa-1'], successors: ['de-sa-3'], float: 0 },
      { id: 'de-sa-3', projectId: 'de-001', wbsCode: '3.0', name: 'Baubeginn', plannedStart: '2025-07-01', plannedFinish: '2025-07-01', percentComplete: 0, status: 'not-started', isMilestone: true, isCriticalPath: true, predecessors: ['de-sa-2'], successors: [], float: 0 },
    ],
    risks: [
      { id: 'de-r-1', projectId: 'de-001', category: 'regulatory', description: 'Denkmalschutz requirements may increase scope', likelihood: 3, impact: 3, score: 9, mitigation: 'Early engagement with Denkmalamt', owner: 'Architect', status: 'mitigating', costExposure: 2000000 },
      { id: 'de-r-2', projectId: 'de-001', category: 'construction', description: 'GEG compliance costs higher than budget', likelihood: 3, impact: 2, score: 6, mitigation: 'Detailed energy concept completed', owner: 'Energy Consultant', status: 'identified', costExposure: 800000 },
    ],
    changeOrders: [],
    siteEvents: [],
    totalBudget: 151000000,
    committedCosts: 59320000,
    actualSpent: 57920000,
    contingency: 7000000,
    contingencyUsed: 0,
    plannedStartDate: '2025-07-01',
    plannedEndDate: '2028-03-31',
    createdAt: '2024-05-01T00:00:00Z',
    updatedAt: '2025-01-30T00:00:00Z',
  },
];

// ============================================
// DEVELOPMENT APPRAISALS
// ============================================

export const mockAppraisals: Record<string, DevelopmentAppraisal> = {
  'uk-001': {
    projectId: 'uk-001',
    gdv: 225000000,
    rentalIncome: 11250000,
    yieldOnCost: 0.071,
    exitYield: 0.05,
    landCost: 45000000,
    constructionCost: 87500000,
    professionalFees: 8400000,
    statutoryCosts: 3750000,
    financeCosts: 14200000,
    marketingCosts: 500000,
    contingency: 6000000,
    totalDevelopmentCost: 165350000,
    profitOnCost: 0.361,
    profitOnGdv: 0.265,
    irr: 0.182,
    equityIrr: 0.245,
    npv: 28500000,
    equityMultiple: 1.85,
  },
  'nl-001': {
    projectId: 'nl-001',
    gdv: 95000000,
    rentalIncome: 5200000,
    yieldOnCost: 0.079,
    exitYield: 0.055,
    landCost: 38000000,
    constructionCost: 23500000,
    professionalFees: 2900000,
    statutoryCosts: 500000,
    financeCosts: 3800000,
    marketingCosts: 200000,
    contingency: 3200000,
    totalDevelopmentCost: 72100000,
    profitOnCost: 0.318,
    profitOnGdv: 0.241,
    irr: 0.156,
    npv: 12800000,
  },
  'de-001': {
    projectId: 'de-001',
    gdv: 210000000,
    rentalIncome: 9800000,
    yieldOnCost: 0.065,
    exitYield: 0.047,
    landCost: 52000000,
    constructionCost: 82000000,
    professionalFees: 9800000,
    statutoryCosts: 4500000,
    financeCosts: 15500000,
    marketingCosts: 600000,
    contingency: 7000000,
    totalDevelopmentCost: 171400000,
    profitOnCost: 0.225,
    profitOnGdv: 0.184,
    irr: 0.142,
    npv: 18200000,
  },
};

// ============================================
// DELIVERY METRICS
// ============================================

export const mockDeliveryMetrics: Record<string, DeliveryMetrics> = {
  'uk-001': {
    projectId: 'uk-001',
    asOfDate: '2025-01-30',
    plannedDuration: 850,
    elapsedDuration: 335,
    remainingDuration: 580,
    scheduleVarianceDays: -62,
    spiSchedulePerformanceIndex: 0.91,
    criticalPathFloat: 0,
    budgetAtCompletion: 159000000,
    earnedValue: 89500000,
    actualCost: 98350000,
    costVariance: -8850000,
    cpiCostPerformanceIndex: 0.91,
    estimateAtCompletion: 174725275,
    estimateToComplete: 76375275,
    contractsAwarded: 8,
    contractsPending: 3,
    procurementRiskValue: 4500000,
    changeOrdersSubmitted: 5,
    changeOrdersApproved: 3,
    changeOrdersValue: 2800000,
    avgChangeOrderCycleTime: 18,
  },
  'nl-001': {
    projectId: 'nl-001',
    asOfDate: '2025-01-30',
    plannedDuration: 548,
    elapsedDuration: 0,
    remainingDuration: 548,
    scheduleVarianceDays: 0,
    spiSchedulePerformanceIndex: 1.0,
    criticalPathFloat: 0,
    budgetAtCompletion: 66000000,
    earnedValue: 38850000,
    actualCost: 38850000,
    costVariance: 0,
    cpiCostPerformanceIndex: 1.0,
    estimateAtCompletion: 67600000,
    estimateToComplete: 28750000,
    contractsAwarded: 2,
    contractsPending: 6,
    procurementRiskValue: 22000000,
    changeOrdersSubmitted: 0,
    changeOrdersApproved: 0,
    changeOrdersValue: 0,
    avgChangeOrderCycleTime: 0,
  },
  'de-001': {
    projectId: 'de-001',
    asOfDate: '2025-01-30',
    plannedDuration: 1004,
    elapsedDuration: 0,
    remainingDuration: 1004,
    scheduleVarianceDays: 0,
    spiSchedulePerformanceIndex: 1.0,
    criticalPathFloat: 0,
    budgetAtCompletion: 151000000,
    earnedValue: 57920000,
    actualCost: 57920000,
    costVariance: 0,
    cpiCostPerformanceIndex: 1.0,
    estimateAtCompletion: 155300000,
    estimateToComplete: 97380000,
    contractsAwarded: 3,
    contractsPending: 8,
    procurementRiskValue: 78000000,
    changeOrdersSubmitted: 0,
    changeOrdersApproved: 0,
    changeOrdersValue: 0,
    avgChangeOrderCycleTime: 0,
  },
};

// ============================================
// SITE METRICS
// ============================================

export const mockSiteMetrics: Record<string, SiteMetrics> = {
  'uk-001': {
    projectId: 'uk-001',
    asOfDate: '2025-01-30',
    overallPercentComplete: 42,
    plannedPercentComplete: 48,
    progressVariance: -6,
    defectsOpenTotal: 23,
    defectsClosedTotal: 156,
    defectClosureRate: 0.87,
    reworkCostToDate: 420000,
    hoursWorked: 485000,
    incidentsThisPeriod: 0,
    incidentsTotal: 2,
    nearMissesThisPeriod: 3,
    ltir: 0.41,
    openRfis: 18,
    avgRfiResponseDays: 4.2,
    openConstraints: 7,
    constraintsClearedThisWeek: 4,
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getProjectById(id: string): Project | undefined {
  return mockProjects.find((p) => p.id === id);
}

export function getProjectsByCountry(country: Country): Project[] {
  return mockProjects.filter((p) => p.country === country);
}

export function getAppraisalForProject(projectId: string): DevelopmentAppraisal | undefined {
  return mockAppraisals[projectId];
}

export function getDeliveryMetricsForProject(projectId: string): DeliveryMetrics | undefined {
  return mockDeliveryMetrics[projectId];
}

export function getSiteMetricsForProject(projectId: string): SiteMetrics | undefined {
  return mockSiteMetrics[projectId];
}

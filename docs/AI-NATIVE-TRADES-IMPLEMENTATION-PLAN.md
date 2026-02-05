# AI-Native Trades App Implementation Plan for Vasco

Based on analysis from "Pdf analysis for app.pdf" - consolidated insights from a16z investment patterns, procurement research, and UK/Germany/Netherlands trades research.

---

## Executive Summary

The PDF identifies that successful AI-native vertical software must be a **"system of action"** - not just a chatbot, but a vertical OS that:
1. **Ingests** messy inputs (photos, messages, PDFs, spreadsheets)
2. **Computes** KPI deltas continuously
3. **Generates** actions with audit trails and human approval gates

---

## Gap Analysis: Vasco vs PDF Requirements

| PDF Requirement | Vasco Current State | Gap | Priority |
|-----------------|---------------------|-----|----------|
| Evidence Graph (job→evidence→compliance→payment) | Partial (document vault, handover) | Need formal graph structure | **P0** |
| Credential Vault with Auto-Gates | Basic credential tracking | Need country-specific auto-gates | **P0** |
| Procurement Optimisation Engine (MILP/CP-SAT) | Supplier reliability tracking planned | Need OR-Tools optimisation | **P1** |
| Price & Risk Forecasting | Basic analytics | Need ML price/lead-time forecasting | **P1** |
| Evidence-Grounded Quote Builder | Job costing exists | Need photo→BOM extraction | **P1** |
| Constraint-Aware Scheduling | Schedule fragility planned | Need CP solver for scheduling | **P2** |
| Country Compliance Templates (UK/DE/NL) | Generic compliance | Need country modules | **P1** |
| Learning Flywheel | Intelligence engine exists | Need feedback loops | **P2** |
| Mobile-First UX (offline, voice) | Mobile app exists | Need offline + voice notes | **P2** |
| Purchase Pack Generation | Handover pack planned | Need procurement-specific packs | **P1** |

---

## Phase 1: Evidence Graph & Credential System (P0)

### 1.1 Evidence Graph Service

**Goal:** Create a formal graph connecting every piece of evidence to jobs, compliance, and payments.

**File:** `src/services/evidenceGraphService.ts`

```typescript
interface EvidenceNode {
  id: string;
  type: 'job' | 'task' | 'photo' | 'test-result' | 'certificate' | 'credential' | 'invoice' | 'payment' | 'warranty';
  data: any;
  metadata: {
    createdAt: string;
    createdBy: string;
    source: 'manual' | 'ai-extracted' | 'api-sync' | 'document-ingestion';
    verifiedAt?: string;
    verifiedBy?: string;
  };
}

interface EvidenceEdge {
  id: string;
  fromNode: string;
  toNode: string;
  relationship: 'requires' | 'produces' | 'validates' | 'pays-for' | 'part-of' | 'depends-on';
  metadata: {
    createdAt: string;
    reason?: string;
  };
}

interface EvidenceGraph {
  nodes: Map<string, EvidenceNode>;
  edges: EvidenceEdge[];
}

// Evidence Graph traversal
interface EvidenceTrail {
  startNode: EvidenceNode;
  path: EvidenceEdge[];
  endNode: EvidenceNode;
  completeness: number;  // 0-100 (are all required nodes present?)
  missingNodes: string[];
}

// Functions
createEvidenceNode(type: NodeType, data: any, linkedTo?: string[]): EvidenceNode
linkEvidence(fromId: string, toId: string, relationship: string): EvidenceEdge
getEvidenceTrail(jobId: string): EvidenceTrail
validateCompleteness(jobId: string): { complete: boolean, missing: string[] }
getPaymentReadiness(jobId: string): { ready: boolean, blockers: string[] }
exportEvidencePack(jobId: string, format: 'pdf' | 'json'): Blob
```

**Visual Representation:**
```
┌─────────────────────────────────────────────────────────────────────┐
│                         EVIDENCE GRAPH                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│    [JOB-001]                                                        │
│        │                                                            │
│        ├──requires──► [CREDENTIAL: Gas Safe #12345]                │
│        │                     │                                      │
│        │                     └──validates──► [CERTIFICATE: Expiry]  │
│        │                                                            │
│        ├──part-of──► [TASK: Install Boiler]                        │
│        │                   │                                        │
│        │                   ├──produces──► [PHOTO: Before]          │
│        │                   ├──produces──► [PHOTO: After]           │
│        │                   └──produces──► [TEST: Pressure Check]   │
│        │                                       │                    │
│        │                                       └──validates──►      │
│        │                                           [COMPLIANCE OK]  │
│        │                                                            │
│        ├──produces──► [INVOICE: INV-2024-001]                      │
│        │                   │                                        │
│        │                   └──pays-for──► [PAYMENT: £2,500]        │
│        │                                                            │
│        └──produces──► [WARRANTY: 2 Years]                          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Credential Vault with Country-Specific Auto-Gates

**Goal:** Store credentials as structured objects and enforce compliance gates at key workflow points.

**File:** `src/services/credentialVaultService.ts`

```typescript
interface Credential {
  id: string;
  type: CredentialType;
  holder: {
    userId: string;
    businessId?: string;
  };
  details: {
    registrationNumber: string;
    issuer: string;
    level?: string;              // e.g., "Master" for German Meister
    scope: string[];             // What work this credential covers
    jurisdiction: 'UK' | 'DE' | 'NL';
    issuedAt: string;
    expiresAt: string;
    verificationUrl?: string;    // Link to registry for verification
  };
  status: 'active' | 'expired' | 'suspended' | 'pending-verification';
  verificationHistory: VerificationEvent[];
}

// Country-specific credential types
type CredentialType =
  // UK
  | 'gas-safe'              // Gas Safe Register
  | 'oftec'                 // Oil firing technician
  | 'part-p'                // Electrical Part P
  | 'fgas-uk'               // F-Gas certification UK
  | 'cscs'                  // Construction Skills Certification

  // Germany
  | 'handwerksrolle'        // Crafts Register (Meister required)
  | 'hwk-certificate'       // Chamber of Crafts certificate
  | 'tuv-certification'     // TÜV technical certification
  | 'fgas-de'               // F-Gas Germany

  // Netherlands
  | 'co-certificate'        // CO (carbon monoxide) certification
  | 'fgas-nl'               // F-Gas Netherlands
  | 'stek-certification'    // Refrigeration certification
  | 'vca-certification'     // Safety certification
  | 'kvk-registration';     // Chamber of Commerce registration

interface AutoGate {
  id: string;
  name: string;
  triggerPoint: 'onboarding' | 'job-acceptance' | 'pre-work' | 'pre-invoice' | 'pre-payment';
  condition: GateCondition;
  action: 'block' | 'warn' | 'require-override';
  message: string;
}

interface GateCondition {
  type: 'credential-required' | 'credential-valid' | 'credential-scope-match';
  credentialType?: CredentialType;
  scope?: string;               // e.g., "gas-installation"
  jurisdictionMatch?: boolean;  // Must match job location
}

// Country compliance modules
const UK_COMPLIANCE_GATES: AutoGate[] = [
  {
    id: 'uk-gas-safe-required',
    name: 'Gas Safe Registration Required',
    triggerPoint: 'job-acceptance',
    condition: {
      type: 'credential-required',
      credentialType: 'gas-safe',
      scope: 'gas-work'
    },
    action: 'block',
    message: 'Gas Safe registration required for gas work. It is illegal to perform gas work without registration.'
  },
  // ... more UK gates
];

const DE_COMPLIANCE_GATES: AutoGate[] = [
  {
    id: 'de-meister-required',
    name: 'Meister Qualification Required',
    triggerPoint: 'job-acceptance',
    condition: {
      type: 'credential-required',
      credentialType: 'handwerksrolle'
    },
    action: 'block',
    message: 'Handwerksrolle registration (Meister) required for this trade in Germany.'
  },
  // ... more DE gates
];

const NL_COMPLIANCE_GATES: AutoGate[] = [
  {
    id: 'nl-co-certificate-required',
    name: 'CO Certificate Required',
    triggerPoint: 'pre-work',
    condition: {
      type: 'credential-required',
      credentialType: 'co-certificate',
      scope: 'gas-combustion'
    },
    action: 'block',
    message: 'CO certificate required for gas combustion work in the Netherlands.'
  },
  // ... more NL gates
];

// Functions
addCredential(credential: Credential): Promise<Credential>
verifyCredential(credentialId: string): Promise<VerificationResult>
checkAutoGates(userId: string, jobId: string, triggerPoint: string): GateCheckResult
getExpiringCredentials(userId: string, daysAhead: number): Credential[]
syncWithRegistry(credentialType: CredentialType, registrationNumber: string): Promise<Credential>

// React Hooks
useCredentialVault(userId: string): { credentials, expiring, loading }
useAutoGateCheck(jobId: string, triggerPoint: string): { passed, blockers, warnings }
useCredentialReminders(userId: string): { reminders, dismiss }
```

### 1.3 Credential Vault UI Components

**File:** `src/components/credentials/CredentialVaultPanel.tsx`

Features:
- List of all credentials with status badges (Active/Expiring/Expired)
- Expiry countdown and renewal reminders
- Registry verification button (check against Gas Safe, etc.)
- Upload new credential with AI extraction
- Country selector for relevant credential types

**File:** `src/components/credentials/AutoGateBlocker.tsx`

Features:
- Modal shown when auto-gate blocks action
- Explains why action is blocked
- Shows which credential is missing/expired
- Link to add/renew credential
- Override request (with audit logging) for authorized users

---

## Phase 2: Procurement Optimisation Engine (P1)

### 2.1 Master + Transactions Database Schema

**Goal:** Implement the "master + transactions" design for procurement data.

**File:** `src/types/procurement-database.ts`

```typescript
// ============================================
// MASTER DATA
// ============================================

interface ItemCatalogue {
  id: string;
  sku?: string;
  name: string;
  description: string;
  category: string;
  subcategory: string;
  tradePackage: string;          // e.g., "Plumbing", "Electrical"
  specifications: {
    unit: string;                 // "each", "m", "m²", "kg", "litre"
    minOrderQty?: number;
    packSize?: number;
    dimensions?: Dimensions;
    material?: string;
    grade?: string;
  };
  alternativeSkus: string[];      // Substitutable items
  leadTimeCategory: 'stock' | 'short-lead' | 'long-lead' | 'made-to-order';
}

interface SupplierCatalogue {
  id: string;
  name: string;
  type: 'merchant' | 'manufacturer' | 'distributor' | 'trade-counter';
  regionsServed: string[];
  capabilities: {
    deliveryTypes: ('collection' | 'standard-delivery' | 'express' | 'site-delivery')[];
    minOrderValue?: number;
    maxCapacity?: number;
    certifications: string[];
    paymentTerms: string[];
  };
  reliability: {
    onTimeRate: number;
    qualityScore: number;
    responseTime: number;         // Hours
  };
  contacts: Contact[];
  accountStatus: 'active' | 'approved' | 'pending' | 'suspended';
}

interface UnitConversion {
  fromUnit: string;
  toUnit: string;
  factor: number;
  itemCategory?: string;          // Some conversions are item-specific
}

// ============================================
// TRANSACTIONAL EVIDENCE
// ============================================

interface SupplierQuote {
  id: string;
  supplierId: string;
  requestedAt: string;
  receivedAt: string;
  validFrom: string;
  validUntil: string;
  lineItems: {
    itemId: string;
    quantity: number;
    unitPrice: number;
    currency: string;
    leadTimeDays: number;
    moq?: number;
    volumeDiscounts?: { qty: number; price: number }[];
  }[];
  terms: {
    paymentTerms: string;
    deliveryTerms: string;
    earlyPaymentDiscount?: number;
  };
  status: 'active' | 'expired' | 'superseded' | 'accepted' | 'rejected';
}

interface PurchaseOrder {
  id: string;
  supplierId: string;
  quoteId?: string;
  projectId: string;
  orderedAt: string;
  expectedDeliveryAt: string;
  lineItems: {
    itemId: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  total: number;
  status: 'draft' | 'submitted' | 'confirmed' | 'partially-delivered' | 'delivered' | 'closed';
  deliveryAddress: Address;
}

interface DeliveryRecord {
  id: string;
  purchaseOrderId: string;
  deliveredAt: string;
  receivedBy: string;
  lineItems: {
    itemId: string;
    orderedQty: number;
    deliveredQty: number;
    condition: 'good' | 'damaged' | 'wrong-item' | 'missing';
    notes?: string;
  }[];
  photos: string[];               // Evidence photos
  signatureUrl?: string;
}

interface DefectRecord {
  id: string;
  purchaseOrderId: string;
  itemId: string;
  supplierId: string;
  reportedAt: string;
  defectType: 'quality' | 'damage' | 'wrong-spec' | 'wrong-quantity' | 'late';
  description: string;
  photos: string[];
  resolution: 'credit' | 'replacement' | 'return' | 'accepted' | 'pending';
  financialImpact: number;
}
```

### 2.2 Price & Risk Forecasting Service

**File:** `src/services/priceForecastingService.ts`

```typescript
interface PriceForecast {
  itemId: string;
  forecastDate: string;
  horizon: number;                // Days ahead
  predictions: {
    date: string;
    predictedPrice: number;
    lowerBound: number;           // 90% confidence interval
    upperBound: number;
    volatility: number;
  }[];
  factors: {
    name: string;
    impact: number;               // % contribution to forecast
    direction: 'up' | 'down' | 'stable';
  }[];
  dataQuality: 'high' | 'medium' | 'low';
  lastUpdated: string;
}

interface LeadTimeForecast {
  itemId: string;
  supplierId: string;
  forecastDate: string;
  predictions: {
    expectedDays: number;
    p10Days: number;              // 10th percentile (optimistic)
    p90Days: number;              // 90th percentile (pessimistic)
    riskLevel: 'low' | 'medium' | 'high';
  };
}

interface SupplierRiskScore {
  supplierId: string;
  itemId?: string;                // Item-specific or overall
  riskScore: number;              // 0-100 (higher = riskier)
  components: {
    deliveryReliability: number;
    priceVolatility: number;
    qualityHistory: number;
    financialStability: number;
    capacityRisk: number;
  };
  trend: 'improving' | 'stable' | 'deteriorating';
}

// Functions
forecastPrice(itemId: string, horizon: number): PriceForecast
forecastLeadTime(itemId: string, supplierId: string): LeadTimeForecast
calculateSupplierRisk(supplierId: string, itemId?: string): SupplierRiskScore
getMarketPriceIndex(itemCategory: string): MarketIndex
compareToHistorical(itemId: string, currentPrice: number): PriceComparison
detectPriceAnomaly(itemId: string, quotePrice: number): AnomalyResult

// Model training
trainPriceModel(itemCategory: string, historicalData: Quote[]): void
updateModelWithTransaction(quote: Quote | PurchaseOrder): void
```

### 2.3 Procurement Optimisation Engine

**Goal:** Use mathematical optimisation (MILP/CP-SAT) to determine optimal supplier allocation.

**File:** `src/services/procurementOptimisationService.ts`

```typescript
interface ProcurementProblem {
  projectId: string;
  demands: {
    itemId: string;
    quantity: number;
    requiredByDate: string;
    priority: 'critical' | 'high' | 'normal' | 'low';
    acceptableSubstitutes?: string[];
  }[];
  supplierOffers: {
    supplierId: string;
    itemId: string;
    unitPrice: number;
    moq: number;
    maxQty: number;
    leadTimeDays: number;
    validUntil: string;
  }[];
  constraints: {
    maxSuppliersPerItem?: number;
    minSupplierReliability?: number;
    maxBudget?: number;
    preferredSuppliers?: string[];
    excludedSuppliers?: string[];
    deliveryWindowDays?: number;
  };
  objectives: {
    minimizeCost: number;         // Weight 0-1
    minimizeRisk: number;         // Weight 0-1
    minimizeLeadTime: number;     // Weight 0-1
  };
}

interface OptimisationResult {
  status: 'optimal' | 'feasible' | 'infeasible' | 'timeout';
  totalCost: number;
  awards: {
    supplierId: string;
    itemId: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    expectedDeliveryDate: string;
  }[];
  unmetDemands: {
    itemId: string;
    shortfall: number;
    reason: string;
  }[];
  metrics: {
    savingsVsNaive: number;       // $ saved vs first-available
    riskScore: number;
    averageLeadTime: number;
  };
  sensitivity: {
    constraintName: string;
    shadowPrice: number;          // Value of relaxing constraint
  }[];
}

interface PurchasePack {
  id: string;
  projectId: string;
  generatedAt: string;
  generatedBy: string;

  // Evidence section
  evidence: {
    quotesUsed: SupplierQuote[];
    priceForecastsUsed: PriceForecast[];
    supplierRiskScores: SupplierRiskScore[];
    marketBenchmarks: MarketIndex[];
  };

  // Assumptions section
  assumptions: {
    description: string;
    value: any;
    source: string;
    confidence: number;
  }[];

  // Recommendation section
  recommendation: OptimisationResult;

  // Alternatives considered
  alternatives: {
    description: string;
    result: OptimisationResult;
    whyNotChosen: string;
  }[];

  // Approval workflow
  approval: {
    status: 'pending' | 'approved' | 'rejected' | 'modified';
    approver?: string;
    approvedAt?: string;
    comments?: string;
    modifications?: any;
  };
}

// Functions
optimizeProcurement(problem: ProcurementProblem): OptimisationResult
runRobustOptimisation(problem: ProcurementProblem, scenarios: Scenario[]): RobustResult
generatePurchasePack(projectId: string, result: OptimisationResult): PurchasePack
comparePurchaseOptions(options: OptimisationResult[]): ComparisonReport

// React Hooks
useProcurementOptimisation(projectId: string): {
  problem,
  result,
  purchasePack,
  optimize,
  loading
}
```

### 2.4 Purchase Pack UI

**File:** `src/components/procurement/PurchasePackBuilder.tsx`

Features:
- Demand entry (or import from BOM)
- Supplier offer collection
- Constraint configuration
- One-click optimisation
- Results comparison view
- Evidence and assumptions display
- Approval workflow integration

---

## Phase 3: Evidence-Grounded Quoting (P1)

### 3.1 Quote Builder with AI Extraction

**Goal:** Build quotes from photos and site notes with AI-assisted BOM generation.

**File:** `src/services/quoteBuilderService.ts`

```typescript
interface QuoteInput {
  jobId: string;
  customerRequest: string;        // Original message/description
  siteNotes: string;
  photos: {
    url: string;
    type: 'site-overview' | 'problem-area' | 'existing-equipment' | 'measurements';
    aiAnalysis?: PhotoAnalysis;
  }[];
  measurements?: {
    area?: number;
    length?: number;
    height?: number;
    units: string;
  };
  constraints?: {
    customerBudget?: number;
    requiredDate?: string;
    accessRestrictions?: string;
  };
}

interface PhotoAnalysis {
  detectedItems: {
    item: string;
    confidence: number;
    boundingBox?: any;
  }[];
  detectedCondition: string;
  suggestedScope: string[];
  riskFactors: string[];
}

interface GeneratedBOM {
  lineItems: {
    itemId?: string;              // From catalogue, or null if new
    description: string;
    quantity: number;
    unit: string;
    estimatedUnitCost: number;
    confidence: number;           // How sure AI is about this item
    source: 'ai-detected' | 'template' | 'historical' | 'manual';
    notes?: string;
  }[];
  labourHours: {
    tradeType: string;
    hours: number;
    ratePerHour: number;
    confidence: number;
  }[];
  assumptions: {
    description: string;
    impact: 'cost' | 'schedule' | 'scope';
    ifWrong: string;              // What happens if assumption is wrong
  }[];
  exclusions: string[];           // What's NOT included
  riskAllowance: number;          // % contingency
}

interface Quote {
  id: string;
  jobId: string;
  version: number;
  createdAt: string;

  // Input evidence
  input: QuoteInput;

  // Generated content
  bom: GeneratedBOM;

  // Pricing
  pricing: {
    materialsTotal: number;
    labourTotal: number;
    subtotal: number;
    markup: number;
    markupPercent: number;
    total: number;
    currency: string;
  };

  // Comparison to similar jobs
  benchmarks: {
    similarJobCount: number;
    averagePrice: number;
    pricePercentile: number;      // Where this quote falls
    marginPercentile: number;
  };

  // Status
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  sentAt?: string;
  respondedAt?: string;
  customerResponse?: string;
}

// Functions
analyzePhotos(photos: Photo[]): Promise<PhotoAnalysis[]>
generateBOM(input: QuoteInput): Promise<GeneratedBOM>
estimateFromHistory(jobType: string, scope: string[]): HistoricalEstimate
createQuote(input: QuoteInput): Promise<Quote>
compareToSimilarJobs(quote: Quote): BenchmarkResult
updateQuoteWithFeedback(quoteId: string, feedback: JobOutcome): void  // Learning

// React Hooks
useQuoteBuilder(jobId: string): {
  input,
  bom,
  quote,
  generateBOM,
  adjustBOM,
  createQuote,
  loading
}
```

### 3.2 Quote Builder UI

**File:** `src/components/quoting/QuoteBuilderWizard.tsx`

Steps:
1. **Input Collection** - Photos, notes, customer request
2. **AI Analysis** - Show detected items, conditions, risks
3. **BOM Review** - Edit/add/remove items, adjust quantities
4. **Labour Estimation** - Review AI-suggested hours
5. **Assumptions & Exclusions** - Make explicit what's included/not
6. **Pricing** - Apply markup, compare to benchmarks
7. **Preview & Send** - Generate PDF, send to customer

---

## Phase 4: Constraint-Aware Scheduling (P2)

### 4.1 Scheduling Optimisation Service

**File:** `src/services/schedulingOptimisationService.ts`

```typescript
interface SchedulingProblem {
  projectId: string;
  jobs: {
    jobId: string;
    duration: number;             // Hours
    tradeType: string;
    requiredCredentials: CredentialType[];
    siteId: string;
    dependencies: string[];       // Jobs that must complete first
    earliestStart?: string;
    deadline?: string;
    priority: number;
  }[];
  resources: {
    resourceId: string;           // Person or team
    tradeTypes: string[];
    credentials: CredentialType[];
    availability: {
      date: string;
      startTime: string;
      endTime: string;
    }[];
    homeLocation: Coordinates;
  }[];
  constraints: {
    maxTravelTime?: number;       // Minutes between jobs
    minBreakBetweenJobs?: number;
    respectWeekends?: boolean;
    customerTimePreferences?: any;
  };
}

interface ScheduleResult {
  status: 'optimal' | 'feasible' | 'infeasible';
  assignments: {
    jobId: string;
    resourceId: string;
    scheduledStart: string;
    scheduledEnd: string;
    travelTimeMinutes: number;
  }[];
  unscheduledJobs: {
    jobId: string;
    reason: string;
  }[];
  metrics: {
    totalTravelTime: number;
    resourceUtilization: number;
    onTimePercentage: number;
    idleTime: number;
  };
}

// Functions
optimizeSchedule(problem: SchedulingProblem): ScheduleResult
reoptimizeOnChange(currentSchedule: Schedule, change: ScheduleChange): ScheduleResult
detectConflicts(schedule: Schedule): Conflict[]
suggestReschedule(jobId: string, newConstraints: any): ScheduleResult
```

---

## Phase 5: Country Compliance Templates (P1)

### 5.1 Compliance Template Service

**File:** `src/services/complianceTemplateService.ts`

```typescript
interface ComplianceTemplate {
  id: string;
  name: string;
  country: 'UK' | 'DE' | 'NL';
  tradeType: string;
  jobTypes: string[];

  // Required evidence
  requiredEvidence: {
    type: 'photo' | 'test-result' | 'measurement' | 'signature' | 'certificate';
    name: string;
    description: string;
    mandatory: boolean;
    validationRules?: any;
  }[];

  // Form fields
  formFields: {
    name: string;
    type: 'text' | 'number' | 'select' | 'date' | 'checkbox';
    label: string;
    required: boolean;
    options?: string[];
    validation?: any;
  }[];

  // Output document
  outputDocument: {
    name: string;
    format: 'pdf' | 'form';
    templateUrl: string;
  };
}

// Country-specific templates
const UK_GAS_SAFE_TEMPLATES: ComplianceTemplate[] = [
  {
    id: 'uk-gas-safe-cp12',
    name: 'Landlord Gas Safety Certificate (CP12)',
    country: 'UK',
    tradeType: 'gas',
    jobTypes: ['gas-safety-check', 'landlord-certificate'],
    requiredEvidence: [
      { type: 'test-result', name: 'Tightness Test', description: 'Gas tightness test result', mandatory: true },
      { type: 'test-result', name: 'Flue Flow Test', description: 'Flue flow verification', mandatory: true },
      { type: 'measurement', name: 'CO Reading', description: 'Carbon monoxide reading at appliance', mandatory: true },
      { type: 'signature', name: 'Engineer Signature', description: 'Gas Safe engineer signature', mandatory: true },
    ],
    formFields: [
      { name: 'propertyAddress', type: 'text', label: 'Property Address', required: true },
      { name: 'landlordName', type: 'text', label: 'Landlord Name', required: true },
      { name: 'applianceLocation', type: 'text', label: 'Appliance Location', required: true },
      { name: 'applianceMake', type: 'text', label: 'Appliance Make/Model', required: true },
      { name: 'flueType', type: 'select', label: 'Flue Type', required: true, options: ['Open Flue', 'Room Sealed', 'Flueless'] },
      { name: 'safeToUse', type: 'checkbox', label: 'Safe to Use', required: true },
    ],
    outputDocument: {
      name: 'CP12 Certificate',
      format: 'pdf',
      templateUrl: '/templates/uk-cp12.pdf'
    }
  },
  // More UK templates...
];

const NL_CO_CERTIFICATE_TEMPLATES: ComplianceTemplate[] = [
  {
    id: 'nl-co-certificate',
    name: 'CO-vrij Verklaring',
    country: 'NL',
    tradeType: 'gas',
    jobTypes: ['gas-appliance-install', 'gas-safety-check'],
    requiredEvidence: [
      { type: 'test-result', name: 'CO Meting', description: 'CO measurement results', mandatory: true },
      { type: 'photo', name: 'Rookgasafvoer', description: 'Photo of flue installation', mandatory: true },
      { type: 'certificate', name: 'F-gas Certificaat', description: 'If applicable', mandatory: false },
    ],
    formFields: [
      { name: 'adres', type: 'text', label: 'Adres', required: true },
      { name: 'toestelType', type: 'text', label: 'Toestel Type', required: true },
      { name: 'coWaarde', type: 'number', label: 'CO Waarde (ppm)', required: true },
      { name: 'veiligVerklaard', type: 'checkbox', label: 'Veilig Verklaard', required: true },
    ],
    outputDocument: {
      name: 'CO-vrij Verklaring',
      format: 'pdf',
      templateUrl: '/templates/nl-co-certificate.pdf'
    }
  },
  // More NL templates...
];

// Functions
getTemplatesForJob(jobId: string, country: string): ComplianceTemplate[]
generateComplianceForm(templateId: string, jobId: string): ComplianceForm
prefillFromEvidenceGraph(formId: string, jobId: string): ComplianceForm
submitComplianceDocument(formId: string): SubmissionResult
```

---

## Phase 6: Learning Flywheel (P2)

### 6.1 Feedback Loop Service

**File:** `src/services/learningFlywheelService.ts`

```typescript
interface JobOutcome {
  jobId: string;
  quoteId: string;

  // Actual vs Estimated
  actualMaterials: { itemId: string; quantity: number; cost: number }[];
  actualLabourHours: number;
  actualTotalCost: number;

  // Performance
  onTimeCompletion: boolean;
  customerSatisfaction?: number;  // 1-5
  revisitsRequired: number;
  warrantyClaimsFiled: number;

  // Issues
  issuesEncountered: {
    type: 'scope-creep' | 'material-issue' | 'access-problem' | 'customer-change' | 'estimation-error';
    description: string;
    costImpact: number;
  }[];
}

interface ModelFeedback {
  modelType: 'price-forecast' | 'lead-time' | 'bom-estimation' | 'labour-estimation';
  inputUsed: any;
  predictionMade: any;
  actualOutcome: any;
  error: number;
  feedbackDate: string;
}

// Functions
recordJobOutcome(outcome: JobOutcome): void
calculateEstimationAccuracy(tradeType: string, dateRange: DateRange): AccuracyReport
updatePriceModel(feedback: ModelFeedback[]): void
updateBOMModel(feedback: ModelFeedback[]): void
getImprovementSuggestions(): Suggestion[]

// Metrics
getROIMetrics(): {
  averageQuoteAccuracy: number;
  revisitRateReduction: number;
  paymentCycleImprovement: number;
  materialWasteReduction: number;
}
```

---

## Implementation Roadmap

### Phase 1: Foundation (P0) - Evidence Graph & Credentials
- [ ] Evidence Graph Service
- [ ] Evidence Graph UI (visual explorer)
- [ ] Credential Vault Service with country modules
- [ ] Auto-Gate system (UK Gas Safe, NL CO, DE Handwerksrolle)
- [ ] Credential verification API integrations

### Phase 2: Procurement Intelligence (P1)
- [ ] Master + Transactions database schema
- [ ] Price forecasting service
- [ ] Procurement optimisation engine (OR-Tools integration)
- [ ] Purchase Pack generation
- [ ] Procurement UI components

### Phase 3: Quoting & Compliance (P1)
- [ ] Photo analysis for BOM generation
- [ ] Quote builder with AI assistance
- [ ] Historical job comparison
- [ ] Country compliance templates (UK, DE, NL)
- [ ] Compliance form generation

### Phase 4: Scheduling & Learning (P2)
- [ ] Constraint-aware scheduling optimisation
- [ ] Calendar integration
- [ ] Learning flywheel service
- [ ] ROI metrics dashboard
- [ ] Model improvement pipeline

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Quote accuracy | ±10% of actual | Compare quote to job outcome |
| Payment cycle time | -30% | Days from job complete to payment |
| Compliance rejection rate | <5% | Rejected compliance forms |
| Material waste | -20% | Unused materials per job |
| Revisit rate | -25% | Callbacks per 100 jobs |
| Credential compliance | 100% | Jobs with valid credentials |

---

## Files Summary

### New Services
- `src/services/evidenceGraphService.ts`
- `src/services/credentialVaultService.ts`
- `src/services/priceForecastingService.ts`
- `src/services/procurementOptimisationService.ts`
- `src/services/quoteBuilderService.ts`
- `src/services/schedulingOptimisationService.ts`
- `src/services/complianceTemplateService.ts`
- `src/services/learningFlywheelService.ts`

### New Types
- `src/types/evidence-graph.ts`
- `src/types/credentials.ts`
- `src/types/procurement-database.ts`
- `src/types/quote-builder.ts`
- `src/types/scheduling.ts`
- `src/types/compliance-templates.ts`

### New Components
- `src/components/evidence/EvidenceGraphExplorer.tsx`
- `src/components/evidence/EvidenceTrailView.tsx`
- `src/components/credentials/CredentialVaultPanel.tsx`
- `src/components/credentials/AutoGateBlocker.tsx`
- `src/components/credentials/CredentialVerificationCard.tsx`
- `src/components/procurement/PurchasePackBuilder.tsx`
- `src/components/procurement/SupplierOfferComparison.tsx`
- `src/components/procurement/OptimisationResultView.tsx`
- `src/components/quoting/QuoteBuilderWizard.tsx`
- `src/components/quoting/PhotoAnalysisView.tsx`
- `src/components/quoting/BOMEditor.tsx`
- `src/components/compliance/ComplianceFormBuilder.tsx`
- `src/components/compliance/CountryTemplateSelector.tsx`
- `src/components/scheduling/ScheduleOptimiser.tsx`
- `src/components/analytics/LearningFlywheelDashboard.tsx`
- `src/components/analytics/ROIMetricsPanel.tsx`

---

## Integration with Existing Plans

This plan **complements** the existing:
- **DECISION-GUIDANCE-PLAN.md** - Adds evidence graph to support Auditor reasoning
- **a16z Improvement Plan** - Implements the procurement and evidence pack requirements

The Evidence Graph becomes the foundation for:
- Financial Auditor invoice verification (can trace invoice back to PO → delivery → job)
- Handover Pack assembly (collect all evidence nodes for a job)
- Compliance checking (verify all required evidence present before invoice)

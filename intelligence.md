# Vasco Intelligence Learning Engine

## Overview

The Vasco Intelligence Learning Engine replaces the static, hardcoded guidance system (45+ templates) with a dynamic, behavior-driven system that learns from contractor actions, shows evidence-based reasoning, and improves over time. All data stays on-device via AsyncStorage — no backend required.

---

## Architecture

```
Contractor uses app
        ↓
  Screen visit tracked (learningStorage)
        ↓
  Insight interactions recorded (viewed, expanded, dismissed, acted, etc.)
        ↓
  Learning Profile updated (AsyncStorage)
        ↓
  18 Generators produce ScoredInsights from real service data + profile
        ↓
  insightScorer ranks by: relevance (0.4) + engagement (0.3) + freshness (0.2) + urgency (0.1) - fatigue
        ↓
  Top 5 insights per screen, max 20/day, score > 0.3 threshold
        ↓
  VascoInsightCard displays with "Waarom?" reasoning toggle
```

---

## Files Created

### Core Intelligence Layer

| File | Purpose |
|------|---------|
| `src/intelligence/learningStorage.ts` | AsyncStorage persistence for contractor learning profile. Tracks interactions (last 500), screen visits, job outcomes, invoice patterns, savings profile. Debounced saves (2s). Exposes `useLearningProfile()` hook. |
| `src/intelligence/insightScorer.ts` | Scoring algorithm with screen-relevance matrix (18 generators x 24 screens). Applies fatigue penalties (+0.3 if shown in 4h, +0.6 if dismissed in 24h). Caps at 5/screen, 20/day. |
| `src/intelligence/calibration.ts` | Prediction accuracy tracking. Logs predictions, resolves them against actual outcomes, computes accuracy rates per generator. Poor calibration reduces confidence scores. |

### 18 Insight Generators (`src/intelligence/generators/`)

| Generator | Data Source | What It Detects |
|-----------|-----------|-----------------|
| `overdueInvoiceGenerator` | `useCashFlow()` | Overdue invoices, total amount at risk |
| `savingsOpportunityGenerator` | `usePredictiveSavingsSummary()` | Urgent savings opportunities with deadlines |
| `marginDriftGenerator` | `useJobCostSummary()` | Cost variance / margin leakage across jobs |
| `complianceAlertGenerator` | `useComplianceAlerts()` | Critical/high compliance issues |
| `laborEfficiencyGenerator` | `useLaborCosts()` | Idle time > 10%, travel optimization |
| `estimationCalibrationGenerator` | `useEstimationAccuracy()` | Quote accuracy trends, hours deviation |
| `dsoTrendGenerator` | `useDSOMetrics()` | DSO trend vs industry average |
| `certExpiryGenerator` | `useExpiryCalendar()` | Certificates expiring within 60 days |
| `supplierPriceGenerator` | `useSupplierNegotiation()` | Discount potential, leverage opportunities |
| `weatherScheduleGenerator` | (mock weather data) | Weather disruption warnings by season |
| `dailyPlanningGenerator` | `useDaySchedule()` | Schedule gaps > 1.5 hours |
| `crossServiceGenerator` | `useCrossServiceIntelligence()` | Cross-service correlations and patterns |
| `cashGapGenerator` | `useCollectionsAgent()` | Cash gap alerts, dunning sequence status |
| `capacityGenerator` | `useCapacityForecast()` | Under-booked weeks (< 60% utilization) |
| `goalProgressGenerator` | `useSavingsAggregation()` | Monthly savings goal progress tracking |
| `staticTipGenerator` | (hardcoded tips) | Low-priority tips when no data insights apply |
| `profitabilityGenerator` | `useProjectProfitability()` | Job type profitability ranking (CFO/Director) |
| `financialAuditGenerator` | `useFinancialAuditStats()` | Audit anomalies and risk alerts |

### Generator Registry & Pipeline

| File | Purpose |
|------|---------|
| `src/intelligence/generators/types.ts` | Core interfaces: `InsightGenerator`, `ScoredInsight`, `GeneratorContext`, `ReasoningChain` |
| `src/intelligence/generators/index.ts` | Barrel export + `useAllGenerators(ctx)` hook that runs all generators and filters by role/screen |

---

## Files Modified

| File | Changes |
|------|---------|
| `src/services/vascoGuidanceService.ts` | Complete rewrite: removed 45+ hardcoded templates, replaced with generator pipeline. `useVascoGuidance()` now returns `ScoredInsight[]` (backward compatible with `VascoInsight`). `useInlineInsight()` preserved unchanged. |
| `src/components/shared/VascoInsightCard.tsx` | Added interaction tracking (viewed, expanded, dismissed, snoozed, acted, ignored with 5s timeout). Added "Waarom?" reasoning toggle UI with confidence badge (green >80%, orange 50-80%, gray <50%), evidence counts, observation/impact/advies rows. |
| `app/(contractor)/index.tsx` | Added `recordScreenVisit('today')` on mount |
| `app/(contractor)/besparen.tsx` | Added `recordScreenVisit('savings')` on mount |
| `app/(contractor)/facturen.tsx` | Added `recordScreenVisit('invoices')` on mount |
| `app/(contractor)/decisions.tsx` | Added `recordScreenVisit('decisions')` on mount |
| `app/(contractor)/meer.tsx` | Added `recordScreenVisit('meer')` on mount |

---

## Scoring Algorithm

```
finalScore = (relevanceScore x 0.4)
           + (engagementScore x 0.3)
           + (freshnessScore x 0.2)
           + (urgencyScore x 0.1)
           - fatiguePenalty

relevanceScore  = screen-specific weight per generator (0-1 matrix)
engagementScore = historical acted / (acted + dismissed) ratio per generator
freshnessScore  = 1 / (1 + hoursSinceDataChanged / 24)
urgencyScore    = critical=1.0, high=0.75, medium=0.5, low=0.25
fatiguePenalty   = +0.3 if same generator shown < 4h ago
                   +0.6 if dismissed < 24h ago
```

### Filters
- Minimum score threshold: **0.3**
- Maximum per screen: **5 insights**
- Daily budget: **20 insights** across all screens

---

## Reasoning UI ("Waarom?")

Each `ScoredInsight` card includes an expandable reasoning section:

```
┌─────────────────────────────────────────┐
│ 🔴  Je DSO is opgelopen naar 24 dagen   │
│     Stuur eerder herinneringen          │
│                                          │
│  Waarom? ▾                              │
│  ┌─ Op basis van 47 facturen ──────────┐│
│  │ Observatie: DSO gestegen 18 → 24d   ││
│  │ Impact: ~€320/mnd werkkapitaal      ││
│  │ Advies: Herinnering op dag 14       ││
│  │                        72% zeker  📊││
│  └─────────────────────────────────────┘│
│                      [Pas aan] [Sluiten] │
└─────────────────────────────────────────┘
```

- Only shown on `ScoredInsight` cards (regular `VascoInsight` cards unchanged)
- Confidence color: green (>80%), orange (50-80%), gray (<50%)
- Evidence count: "Op basis van X facturen/klussen/maanden"

---

## Learning Loop

1. **Track**: Every screen visit and insight interaction is recorded to the learning profile
2. **Score**: Engagement rates per generator feed into the scoring algorithm
3. **Rank**: Insights the contractor acts on score higher; dismissed types get penalized
4. **Calibrate**: Predictions are tracked and accuracy rates adjust confidence over time
5. **Suppress**: After 3+ dismissals of a generator type, it gets marked as a dismissed pattern

---

## Dependencies Added

- `@react-native-async-storage/async-storage` — on-device key-value storage for learning profiles and calibration data

---

## Session 2 Improvements (2026-02-09)

### 1. Closed Feedback Loops
- Generators (`marginDriftGenerator`, `dsoTrendGenerator`) now call `logPrediction()` from calibration system
- `learningStorage.resolveOutcomesFromJobHistory()` auto-resolves predictions when job outcomes arrive
- `recordJobOutcome()` now updates savings profile from history

### 2. Mock → Computed Data (3 services rewritten)
- **`savingsAggregatorService`** — Pulls from `laborCostService` (travel clustering, idle time), `supplierNegotiationService` (discounts), `collectionsAgentService` (DSO), `jobCostTrackingService` (under-budget jobs)
- **`crossServiceIntelligenceService`** — Computes 5 correlation types: labor→profitability, supplier HHI→leverage, DSO×outstanding→cash gap, estimation→margin, travel×idle
- **`estimationFeedbackService`** — Derives accuracy and job type calibrations from `jobCostTrackingService` variance data

### 3. Engine Predictions in UI
- `pricingEngineService.suggestPrice()` now async — calls `intelligence.predict('quote_acceptance')` and `intelligence.predict('quote_pricing')`
- Merges engine confidence with local confidence; logs predictions for calibration
- `recordPriceOutcome()` resolves calibration predictions with actual price

### 4. Category Diversity Enforcement
- `insightScorer.scoreAndRankInsights()` now limits **max 2 insights per category** per screen
- Prevents one category (e.g., financial) from dominating all insight slots

### 5. Role-Based Scoring Weights
- 5 custom weight profiles: contractor (engagement-first), sitelead (relevance-first), coo/cfo/director (urgency-first)
- `scoreInsight()` and `scoreAndRankInsights()` accept `role` parameter
- `vascoGuidanceService` passes active role to scorer

### 6. Decision Intelligence — Material Categorization
- `decisionIntelligence.categorizeMaterial()` — brand extraction + product category inference, shared across app
- `decisionIntelligence.analyzeMaterialSpend()` — batch categorization with brand concentration analysis
- `jobCostTrackingService.useMaterialAnalysis()` — hook exposing material insights from job actuals

### 7. Intelligence Dashboard
- New screen: `app/contractor/intelligence.tsx` at `/contractor/intelligence`
- Shows: generator engagement rates (sorted), calibration accuracy, daily budget usage, interaction breakdown (pie), screen visit stats
- Dutch labels for all 18+ generators; privacy notice about on-device data
- Linked from Meer tab under "AI Tools"

### 8. Entity Resolution (Levenshtein)
- `intelligenceEngine.resolveEntity()` — Levenshtein similarity matching against entity cache (threshold > 0.7)
- `stringSimilarity()` private method — full Levenshtein matrix computation
- `findSimilarEntities()` now returns actual matches sorted by similarity
- New entities initialized with full `Entity` interface (confidence, sources, timestamps)

### Updated Scoring Formula
```
finalScore = (relevanceScore × W_r)
           + (engagementScore × W_e)
           + (freshnessScore × W_f)
           + (urgencyScore × W_u)
           - fatiguePenalty

Weights by role:
  contractor: W_r=0.35  W_e=0.30  W_f=0.25  W_u=0.10
  sitelead:   W_r=0.40  W_e=0.25  W_f=0.25  W_u=0.10
  coo:        W_r=0.30  W_e=0.20  W_f=0.20  W_u=0.30
  cfo:        W_r=0.30  W_e=0.20  W_f=0.15  W_u=0.35
  director:   W_r=0.30  W_e=0.15  W_f=0.15  W_u=0.40
```

---

## Session 3: Adaptive Intelligence (2026-02-09)

The intelligence system is now genuinely adaptive. Calibration accuracy feeds back into scores, generators check trends instead of snapshots, thresholds are personalized, cross-service correlations are surfaced, and prediction models learn from outcomes.

### Phase 1: Calibration Feedback Loop
- `insightScorer.ts`: Added `calibrationCache` (Map) + `refreshCalibrationCache()` that loads calibration scores
- `scoreInsight()` now multiplies `finalScore` by `getCalibratedMultiplier(generatorId)` from cache
- Accurate generators (>80%) get 1.1x boost; inaccurate (<40%) dampened to 0.7x
- `vascoGuidanceService.ts`: Calls `refreshCalibrationCache()` via useEffect on mount

### Phase 2: Trend Tracking Infrastructure
- `learningStorage.ts`: Added `MetricKey` type (8 metrics: dso, marginLeakage, idlePercent, estimationAccuracy, savingsTotal, overdueAmount, complianceScore, capacityUtilization)
- Added `MetricSnapshot`, `TrendDirection`, `TrendResult` types
- Extended `ContractorLearningProfile` with `metricHistory: MetricSnapshot[]` (max 12 weeks per metric)
- Migration guard in `loadProfile()`: `if (!profile.metricHistory) profile.metricHistory = []`
- `recordMetricSnapshot(metric, value)`: Weekly snapshots, deduplicated by ISO week key
- `getTrend(profile, metric, weeks)`: Returns improving/stable/declining with slope
- `useMetricTrend(metric, weeks)` hook for components

### Phase 3: Adaptive Thresholds
- **New file:** `src/intelligence/adaptiveThresholds.ts`
- Computes contractor's own baseline from metric history (mean + stddev)
- Alerts when metric exceeds 1 stddev from their baseline
- Defaults for <4 weeks of data (DSO=21, marginLeakage=500, idle=12%, etc.)
- Exports `getAdaptiveThreshold(profile, metric)` and `isAboveThreshold(profile, metric, value)`
- Small contractor gets alerts at €800 overdue; large contractor at €12K — fully personalized

### Phase 4: Deepened 5 Existing Generators
| Generator | Changes |
|-----------|---------|
| `complianceAlertGenerator` | Computes compliance score (0-100), records snapshot, shows trend in reasoning, counts ALL critical+high alerts |
| `cashGapGenerator` | Imports `useDSOMetrics`, computes payment velocity from dunning step intervals, predicts next cash arrival ETA, adds DSO trend |
| `profitabilityGenerator` | Returns composite of top 3 insights (warnings + opportunities), shows total impact, not just first warning |
| `overdueInvoiceGenerator` | Replaced `>5000` with `isAboveThreshold()`, records metric snapshot, adds collection velocity trend |
| `laborEfficiencyGenerator` | Replaced `>10%` with `isAboveThreshold()`, records metric snapshot, adds week-over-week comparison |

### Phase 5: 3 New Cross-Service Generators
| Generator | Data Sources | Detects |
|-----------|-------------|---------|
| `marginRootCauseGenerator` | jobCostTracking + laborCost + estimationFeedback | Chains variance → idle → supplier → estimation to identify PRIMARY cause of margin loss |
| `customerLifecycleGenerator` | projectProfitability + collectionsAgent | At-risk high-CLV customers with overdue invoices; top customer upsell opportunities |
| `cascadingDelayGenerator` | capacityPlanning + smartScheduler | Predicts when current job overrun will cascade and delay downstream jobs |

All 3 registered in `generators/index.ts` with SCREEN_RELEVANCE entries in `insightScorer.ts`.

### Phase 6: Activated Feedback Loops
- `intelligenceEngine.ts`: Added `FeedbackWeights` interface persisted via AsyncStorage
- Tracks: quote acceptance rates by price bracket + customer type, job duration ratios by category, payment timing by segment
- `processFeedbackLoops()` now updates weights on `quote_accepted/rejected`, `job_completed`, `payment_received`
- Every quote/job/payment trains the prediction models

### Phase 7: Learned Prediction Models
- `predictQuoteAcceptance()`: Uses learned acceptance rate by price bracket + customer type; blends with heuristics (60/40); confidence scales with data volume
- `predictJobDuration()`: Uses learned actual/estimated ratio by category to correct base rates; confidence scales with historical data
- Both methods are now async to load FeedbackWeights
- Model version bumped to 2.0.0

### Updated Generator Count: 21 total
- 18 original generators (Session 1-2)
- 3 new cross-service generators (Session 3): `marginRootCauseGenerator`, `customerLifecycleGenerator`, `cascadingDelayGenerator`

### Updated Scoring Formula
```
finalScore = [(relevanceScore × W_r) + (engagementScore × W_e) + (freshnessScore × W_f) + (urgencyScore × W_u) - fatiguePenalty] × calibrationMultiplier

calibrationMultiplier:
  accuracy >= 80%  → 1.1  (boost)
  accuracy >= 60%  → 1.0  (neutral)
  accuracy >= 40%  → 0.85 (dampen)
  accuracy < 40%   → 0.7  (strong dampen)
  no data          → 1.0  (neutral)
```

### Files Changed Summary
| Type | Files |
|------|-------|
| Modified | `insightScorer.ts`, `learningStorage.ts`, `vascoGuidanceService.ts`, `intelligenceEngine.ts`, `generators/index.ts`, `complianceAlertGenerator.ts`, `cashGapGenerator.ts`, `profitabilityGenerator.ts`, `overdueInvoiceGenerator.ts`, `laborEfficiencyGenerator.ts` |
| New | `adaptiveThresholds.ts`, `marginRootCauseGenerator.ts`, `customerLifecycleGenerator.ts`, `cascadingDelayGenerator.ts` |

---

## Verification

- `npx tsc --noEmit` passes with **zero new errors** in all intelligence/generator files
- All existing pre-existing TypeScript errors remain unchanged (COODashboard, SiteLeadDashboard, ComplianceCenter, etc.)
- Backward compatible: `ScoredInsight extends VascoInsight` — all existing consumers work without changes

# Vasco Intelligence Engine

## Architecture Overview

The intelligence engine is the learning backbone of Vasco. It generates personalized, data-driven insights for contractors and ranks them by relevance, engagement, urgency, and freshness. Everything runs on-device via AsyncStorage.

### Core Files

| File | Purpose |
|------|---------|
| `src/intelligence/intelligenceEngine.ts` | Prediction models (quote acceptance, job duration, payment timing), feedback loop processing, FeedbackWeights persistence |
| `src/intelligence/learningStorage.ts` | `ContractorLearningProfile` (on-device), interaction recording, metric trend tracking, engagement scoring |
| `src/intelligence/insightScorer.ts` | Scoring formula, role-based weights, calibration integration, consolidation, diversity enforcement |
| `src/intelligence/calibration.ts` | Prediction logging, resolution, accuracy tracking, confidence multipliers |
| `src/intelligence/adaptiveThresholds.ts` | Per-contractor mean+stddev thresholds, defaults for <4 weeks data |
| `src/intelligence/generators/types.ts` | `ScoredInsight`, `InsightGenerator`, `ReasoningChain` types |
| `src/intelligence/generators/index.ts` | Generator registry |

### Generators (45 total)

**Core (18):** marginDrift, overdueInvoice, savingsOpportunity, complianceAlert, laborEfficiency, estimationCalibration, dsoTrend, certExpiry, supplierPrice, weatherSchedule, dailyPlanning, cashGap, capacity, goalProgress, profitability, financialAudit, customerLifecycle, staticTip

**Cross-Service (3):** marginRootCause, customerLifecycle, cascadingDelay

**Profile-Driven (1):** estimationVarianceByType (Session 6)

**Procurement (1):** supplierPriceAnomaly (Session 11)

**Workflow (5):** quoteBenchmark, materialSuggestion, customerPaymentHistory, marginWarning, similarJobComparison

**CFO Project (5):** projectBudgetVariance, contingencyBurn, approvalBottleneck, projectRiskScore, portfolioIRR

**COO (4):** scheduleFragility, supplierRisk, permitDelay, changeOrderVelocity

**Director (4):** handoverBottleneck, portfolioHealth, valueDelivery, crossProjectRisk

**Site Lead (4):** crewPerformance, incidentTrend, defectCluster, certRenewalPlanner (Session 13)

---

## Session History

### Session 1 — Foundation
- 18 insight generators with `ReasoningChain` (observation/evidence/implication/suggestion)
- `insightScorer.ts`: weighted formula per role, fatigue penalties, diversity enforcement
- `learningStorage.ts`: on-device profile, interaction recording, screen visits, job outcomes

### Session 2 — Calibration
- `calibration.ts`: prediction logging + resolution, accuracy tracking
- Calibration multipliers: accurate generators boosted (1.1x), inaccurate dampened (0.7x)
- Calibration cache in scorer (5-min TTL)

### Session 3 — Adaptive Intelligence
- 3 new cross-service generators: marginRootCause, customerLifecycle, cascadingDelay
- Trend tracking: 8 MetricKeys, weekly snapshots, `getTrend()` slope analysis
- Adaptive thresholds: `adaptiveThresholds.ts` — per-contractor mean+stddev, defaults for sparse data
- Feedback loops: `FeedbackWeights` — learned quote acceptance, job duration ratios, payment timing
- Prediction models v2: blend learned data (60%) + heuristics (40%)

### Session 4 — Learning Effectiveness (5 improvements)

#### 1. Learning Profile Versioning
- Added `schemaVersion: number` to `ContractorLearningProfile` (current: 2)
- Migration registry: `Record<number, (profile) => profile>` runs v0->v1->v2 sequentially
- Removed ad-hoc `if (!profile.metricHistory)` guard (subsumed into migration v0->v1)
- Auto-persists upgraded profiles on load

#### 2. Recency-Weighted Engagement Scoring
- `getEngagementRate()` now uses exponential decay (14-day half-life)
- Recent interactions weight ~1.0; 2 weeks old ~0.5; 2 months old ~6%
- Falls back to 0.5 (neutral) when total weight < 0.01
- Zero changes needed in scorer — it already calls this function

#### 3. Time-Decayed Feedback Weights
- `FeedbackWeights` restructured from cumulative counters to `FeedbackObservation[]` arrays
- Each observation: `{ timestamp, value }` (1/0 for acceptance, ratio for duration, days for payment)
- `getDecayedRate(observations)`: 60-day half-life, returns `{ rate, effectiveN }`
- Cap: 100 observations per key, oldest trimmed on overflow
- Migration: `migrateFeedbackWeightsV1ToV2()` spreads old counters uniformly over 90 days
- `processFeedbackLoops()` pushes individual observations
- `predictQuoteAcceptance()` and `predictJobDuration()` use decayed rates
- Model version bumped to 3.0.0

#### 4. Narrowing Confidence Intervals
- `confidenceInterval(estimate, effectiveN, baseWidth, minWidth)` utility
- Width = max(minWidth, baseWidth / sqrt(effectiveN)) — classic statistical narrowing
- Asymmetric upper bound (1.3x) — construction jobs overrun more than underrun
- 8% minimum width — never overconfident
- Applied to `predictJobDuration()` (range uses CI) and `predictQuoteAcceptance()` (explanation)
- Dutch certainty levels: "Hoge zekerheid", "Redelijke zekerheid", "Lage zekerheid"

#### 5. Insight Consolidation Layer
- `rootCauseTags?: string[]` and `consolidatedFrom?: string[]` added to `ScoredInsight`
- 6 generators tagged:
  - marginDrift -> `['margin', 'cost-variance']`
  - marginRootCause -> `['margin', <primaryCause>]`
  - laborEfficiency -> `['idle-time', 'labor']`
  - dsoTrend -> `['cashflow', 'dso']`
  - cashGap -> `['cashflow', 'cash-gap']`
  - overdueInvoice -> `['cashflow', 'overdue']`
- `consolidateInsights()` runs in `scoreAndRankInsights()` before diversity enforcement
- Highest-scored insight absorbs lower-scored ones sharing >= 1 tag
- Confidence boosted (+15% per absorbed, capped at 0.95)
- Evidence notes "bevestigd door N bronnen"
- rawScore gets 1.1x boost for multi-source corroboration

---

## Scoring Formula

```
finalScore = ((relevance × W_r) + (engagement × W_e) + (freshness × W_f)
             + (urgency × W_u) + screenAffinityBoost + actionedBonus
             - fatiguePenalty - categoryFatigue
             + crossGeneratorBoost + outcomeBoost)
             × calibrationMultiplier
```

Role weights:
- Contractor: relevance 0.35, engagement 0.30, freshness 0.25, urgency 0.10
- CFO: relevance 0.30, engagement 0.20, freshness 0.15, urgency 0.35
- Site Lead: relevance 0.40, engagement 0.25, freshness 0.25, urgency 0.10
- COO: relevance 0.30, engagement 0.20, freshness 0.20, urgency 0.30
- Director: relevance 0.30, engagement 0.15, freshness 0.15, urgency 0.40

## Pipeline Flow

1. Generators produce `ScoredInsight[]` (rawScore=0)
2. `scoreInsight()` computes weighted score per role
3. Filter: rawScore >= 0.3
4. Sort by rawScore descending
5. **Consolidate**: merge insights sharing rootCauseTags (Session 4)
6. Diversity: max 2 per category
7. Budget: max 5 per screen, respecting daily budget (20/day)

---

### Session 5 — Calibration Wiring, Anomaly Detection & Completeness

#### 1. Z-Score Anomaly Detection
- New `detectAnomaly()` in `adaptiveThresholds.ts`
- Returns severity: null (normal), `'moderate'` (>2σ), `'severe'` (>3σ)
- Requires >= 4 data points; Dutch descriptions
- `AnomalyResult` includes zScore, mean, stddev, direction ('spike'/'drop')

#### 2. Seasonal Pattern Adjustments
- `SEASONAL_MULTIPLIERS` per MetricKey per month (construction activity peaks spring/summer)
- `getSeasonalMultiplier(metric, month)` adjusts baseline before anomaly z-score
- Applied to: dso, marginLeakage, idlePercent, overdueAmount, capacityUtilization
- Neutral (1.0) for: estimationAccuracy, savingsTotal, complianceScore

#### 3. Complete Calibration Wiring
- New `resolveByGenerator()` and `resolveCalibrationPredictions()` batch API in `calibration.ts`
- Rewrote `resolveOutcomesFromJobHistory()` to use batch resolver
- Resolves predictions for: margin-drift, estimation-calibration, cascading-delay, profitability
- Added `logPrediction()` to 5 generators: capacity, cascadingDelay, customerLifecycle, estimationCalibration, profitability
- Total generators logging predictions: 7/21 (was 2/21)

#### 4. rootCauseTags: All 21 Generators Tagged
- All generators now have rootCauseTags for consolidation
- Tag mapping:
  - `marginDrift` → `['margin', 'cost-variance']`
  - `marginRootCause` → `['margin', <primaryCause>]`
  - `laborEfficiency` → `['idle-time', 'labor']`
  - `dsoTrend` → `['cashflow', 'dso']`
  - `cashGap` → `['cashflow', 'cash-gap']`
  - `overdueInvoice` → `['cashflow', 'overdue']`
  - `savingsOpportunity` → `['savings', 'procurement']`
  - `complianceAlert` → `['compliance', 'risk']`
  - `estimationCalibration` → `['estimation', 'accuracy']`
  - `certExpiry` → `['compliance', 'certification']`
  - `supplierPrice` → `['savings', 'supplier']`
  - `weatherSchedule` → `['schedule', 'weather']`
  - `dailyPlanning` → `['schedule', 'idle-time']`
  - `crossService` → `['cross-service', 'correlation']`
  - `capacity` → `['capacity', 'schedule']`
  - `goalProgress` → `['savings', 'goal']`
  - `profitability` → `['margin', 'profitability']`
  - `financialAudit` → `['financial', 'audit']`
  - `customerLifecycle` → `['customer', 'cashflow']` or `['customer', 'upsell']`
  - `cascadingDelay` → `['schedule', 'cascade']`
  - `staticTip` → `['tip', 'general']`

#### 5. Smooth Calibration Curve
- Replaced discrete step function with logistic curve in `getConfidenceMultiplier()`
- Formula: `0.7 + 0.4 / (1 + e^(-8*(rate - 0.6)))`
- Smooth scaling: rate=0.3 → 0.73x, rate=0.6 → 1.0x, rate=0.8 → 1.08x
- No more cliff effect at 0.80 accuracy boundary

#### Quick Fixes Applied
- Fixed DSO trend direction logic in `cashGapGenerator` (was using wrong direction labels)
- Removed unused `dsoWorsening` variable → replaced with `dsoImproving`
- Fixed `weatherScheduleGenerator` — replaced `Math.random()` with deterministic day-of-month check
- Kept `dsoTrendGenerator` dataPoints at 1 (DSOMetrics type has no totalInvoices field)

### Session 6 — Full-Stack Integration (7 improvements)

#### 1. Anomaly Detection Adoption in Generators
- Wired `detectAnomaly()` into 4 generators: marginDrift, dsoTrend, laborEfficiency, overdueInvoice
- Pattern per generator:
  - Priority escalation: `severe` → critical, `moderate` → high
  - Anomaly description appended to detail/message when detected
  - Evidence enriched with z-score when anomalous (`anomalie gedetecteerd (Xσ)`)
  - Confidence boosted +0.05 when anomaly detected (capped at 0.95)

#### 2. Calibration Resolution on Job Completion & App Startup
- `recordJobOutcome()` now calls `resolveOutcomesFromJobHistory()` after saving
- `useLearningProfile()` triggers resolution on first load (app startup)
- Both use fire-and-forget pattern with `.catch(() => {})` for resilience

#### 3. Cross-Generator Confidence Dependencies
- New `CONFIDENCE_DEPENDENCIES` map in `insightScorer.ts`:
  - `margin-root-cause` ← `margin-drift`
  - `cash-gap` ← `dso-trend`, `overdue-invoice`
  - `cascading-delay` ← `capacity`, `daily-planning`
  - `customer-lifecycle` ← `overdue-invoice`, `profitability`
- `getCrossGeneratorBoost()` returns 0–0.1 bonus based on dependency calibration accuracy
- Applied additively before calibration multiplier in `scoreInsight()`

#### 4. Payment Timing Enrichment with FeedbackWeights
- `predictPaymentTiming()` now uses time-decayed segment observations
- Blends learned segment data (60%) + direct customer history (40%)
- Applies confidence intervals with Dutch certainty levels
- Model version bumped to 3.0.0

#### 5. Seasonal Context in Generators
- 3 generators now include seasonal awareness:
  - `capacityGenerator`: high/low season notes in messages
  - `laborEfficiencyGenerator`: seasonal idle time explanation
  - `marginDriftGenerator`: seasonal margin pressure context
- Uses `getSeasonalMultiplier()` from `adaptiveThresholds.ts`

#### 6. Invoice & Savings Profile Population
- `recordJobOutcome()` now properly populates `savingsProfile`:
  - `monthlySavings`: calculated from cost savings per job
  - `savingsStreak`: consecutive months with savings > 0
  - `topSavingsCategory`: job type with highest total savings
- New `recordInvoiceOutcome()` function populates `invoicePatterns`:
  - Running average DSO calculation
  - On-time rate tracking
  - Overdue count tracking
- `goalProgressGenerator` uses `savingsStreak` and `topSavingsCategory`
- `overdueInvoiceGenerator` uses `onTimeRate` from profile

#### 7. New Generator: estimationVarianceByType (Generator #22)
- File: `src/intelligence/generators/estimationVarianceByTypeGenerator.ts`
- Uses job completion history from learning profile (no service dependency)
- Groups jobs by type, calculates cost/hours variance ratios
- Triggers when worst job type has >10% cost overrun
- Provides targeted suggestion: adjust hours or check material costs
- rootCauseTags: `['estimation', 'cost-variance']`
- Registered in generator index + screen relevance in scorer

#### Files Modified
| File | Changes |
|------|---------|
| `generators/marginDriftGenerator.ts` | anomaly detection, seasonal context |
| `generators/dsoTrendGenerator.ts` | anomaly detection |
| `generators/laborEfficiencyGenerator.ts` | anomaly detection, seasonal context |
| `generators/overdueInvoiceGenerator.ts` | anomaly detection, profile context |
| `generators/capacityGenerator.ts` | seasonal context |
| `generators/goalProgressGenerator.ts` | savings streak, top category |
| `generators/estimationVarianceByTypeGenerator.ts` | **NEW** — profile-driven variance analysis |
| `generators/index.ts` | registered new generator |
| `insightScorer.ts` | cross-generator confidence, screen relevance for new generator |
| `intelligenceEngine.ts` | payment timing enrichment with FeedbackWeights |
| `learningStorage.ts` | calibration on job completion/startup, invoice/savings population |

### Session 7 — Scoring Sophistication & Full Coverage (7 improvements)

#### 1. Universal Calibration Coverage (21/22 generators)
- Added `logPrediction()` to 14 additional generators (was 7/22, now 21/22)
- Generators added: overdueInvoice, savingsOpportunity, complianceAlert, laborEfficiency, certExpiry, supplierPrice, dailyPlanning, crossService, cashGap, goalProgress, financialAudit, marginRootCause, weatherSchedule, estimationVarianceByType
- Only `staticTip` excluded (no quantifiable predictions by design)
- Each prediction logs: generatorId, timestamp, Dutch description, predictedValue

#### 2. Engagement & Fatigue Sophistication
- **Dwell-time weighting**: `getEngagementRate()` now gives 1.5x weight to expanded insights (dwell > 5s) and 0.3x to quick dismissals (< 1s)
- **Habituation scoring**: `getHabituationScore(profile, generatorId)` tracks 14-day dismissal window; 0.15 penalty per dismissal (max 0.8)
- **Category fatigue**: `getCategoryFatigueToday(profile, category, now)` penalizes 0.05 per view above 5/day (max 0.3)
- Habituation feeds into `getFatiguePenalty()` in scorer
- Category fatigue applied as direct penalty in `scoreInsight()`

#### 3. Profile Data Wired into Scoring
- **Dismissed patterns suppression**: insights from persistently-dismissed generators get `rawScore: 0`
- **Screen affinity boost**: +0.03 for >10 visits, +0.05 for >20 visits to a screen
- **Actioned patterns bonus**: +0.05 for generators the contractor regularly acts on
- **Outcome success rate**: +0.05 boost for >60% positive outcomes, -0.05 penalty for <30%
- Uses `serviceUsageStats`, `actionedPatterns`, `dismissedPatterns` from profile

#### 4. Bidirectional Learning (Outcome Tracking)
- Added `outcome?: 'positive' | 'negative' | 'neutral'` to `InsightInteraction`
- New `recordInsightOutcome(profile, insightId, generatorId, outcome)` function
- New `getOutcomeSuccessRate(profile, generatorId)` — ratio of positive outcomes (neutral default: 0.5 when < 2 observations)
- Outcome data feeds into scoring (improvement #3) and can inform generator tuning

#### 5. Profile-Aware Dynamic Tips
- `staticTipGenerator` now tries 3 profile-aware dynamic tips before falling back to static:
  1. **Hours underestimation**: triggers when job history avgRatio > 1.15 (3+ jobs) — suggests adding buffer
  2. **Savings streak motivation**: triggers when `savingsStreak >= 3` — celebrates momentum
  3. **Payment behavior advice**: triggers when `onTimeRate < 0.7` with 5+ invoices — recommends earlier invoicing
- Dynamic tips have higher confidence (0.75) vs static tips (0.50)
- Falls through to random static tip when no profile data matches

#### 6. Seasonal Context Expansion
- Added seasonal awareness to 3 additional generators (total now 6):
  - `dsoTrendGenerator`: "Langere betaaltermijnen zijn normaal in het laagseizoen"
  - `overdueInvoiceGenerator`: "Hogere openstaande bedragen zijn normaal in het laagseizoen"
  - `cashGapGenerator`: seasonal note in detail text
- All use `getSeasonalMultiplier()` from `adaptiveThresholds.ts`
- Previously: capacityGenerator, laborEfficiencyGenerator, marginDriftGenerator (Session 6)

#### 7. Enterprise Role Generator Expansion
- Expanded `GENERATOR_REGISTRY` roles so enterprise dashboards receive relevant insights:
  - **CFO** (9 generators): overdue-invoice, margin-drift, dso-trend, cross-service, cash-gap, profitability, financial-audit, margin-root-cause, static-tip
  - **Director** (4 generators): margin-drift, profitability, financial-audit, static-tip
  - **COO** (6 generators): compliance-alert, labor-efficiency, supplier-price, capacity, cascading-delay, static-tip
  - **Site Lead** (7 generators): compliance-alert, cert-expiry, weather-schedule, daily-planning, capacity, cascading-delay, static-tip
- Updated `profitabilityGenerator` roles to include `'contractor'` (was CFO/Director only)
- Screen mappings expanded: cashflow, efficiency, dispatch, procurement, safety, quality, risks, portfolio

#### Updated Scoring Formula
```
finalScore = ((relevance × W_r) + (engagement × W_e) + (freshness × W_f)
             + (urgency × W_u) + screenAffinityBoost + actionedBonus
             - fatiguePenalty - categoryFatigue
             + crossGeneratorBoost + outcomeBoost)
             × calibrationMultiplier
```

Where:
- `screenAffinityBoost`: 0 / 0.03 / 0.05 based on screen visit count
- `actionedBonus`: 0.05 if generator is in contractor's actionedPatterns
- `categoryFatigue`: 0–0.3 based on same-category views today
- `outcomeBoost`: -0.05 / 0 / +0.05 based on historical outcome success rate
- Dismissed generators return rawScore: 0 (suppressed entirely)

#### Files Modified
| File | Changes |
|------|---------|
| 14 generators | Added `logPrediction()` for calibration coverage |
| `generators/dsoTrendGenerator.ts` | seasonal context |
| `generators/overdueInvoiceGenerator.ts` | seasonal context |
| `generators/cashGapGenerator.ts` | seasonal context |
| `generators/staticTipGenerator.ts` | profile-aware dynamic tips |
| `generators/profitabilityGenerator.ts` | added 'contractor' role |
| `generators/index.ts` | expanded roles/screens for enterprise (CFO/COO/Director/SiteLead) |
| `insightScorer.ts` | habituation, category fatigue, dismissed suppression, screen affinity, actioned bonus, outcome boost |
| `learningStorage.ts` | dwell-time engagement, habituation scoring, category fatigue, outcome tracking |

### Session 8 — Data Integrity & Learning Loop Completion (7 fixes)

#### 1. Render Side-Effect Deduplication (CRITICAL)
- `logPrediction()` now has in-memory dedup: same generatorId + predictedValue skipped within 5-minute window
- `recordMetricSnapshot()` now has 1-minute dedup per metric key
- Prevents storage bloat and calibration data pollution from React re-renders
- Dedup maps auto-prune stale entries when size exceeds 50

#### 2. Missing MetricKey Recording
- `capacityGenerator` now records `recordMetricSnapshot('capacityUtilization', avgUtil)`
- `savingsOpportunityGenerator` now records `recordMetricSnapshot('savingsTotal', totalPotential)`
- All 8 MetricKeys now have active recording: adaptive thresholds, anomaly detection, and trends work for every metric

#### 3. Dwell-Time Capture on Expand/Collapse
- `VascoInsightCard` now tracks expand timestamp via `expandedAtRef`
- On collapse, records a second 'expanded' interaction with `dwellTimeMs` = time card was open
- Activates the engagement dwell-time bonus (>5s = 1.5x weight) that was previously dead code

#### 4. Per-Category Fatigue Tracking
- Added `category?: string` to `InsightInteraction` interface
- `VascoInsightCard` now passes `insight.category` in all `recordInteraction()` calls
- `getCategoryFatigueToday()` now filters by actual category instead of counting all views
- Old interactions without category gracefully degrade (no fatigue penalty)

#### 5. Calibration Cache Auto-Refresh
- `getCalibratedMultiplier()` now checks cache staleness on every call
- If cache age exceeds 5-minute TTL, triggers fire-and-forget `refreshCalibrationCache()`
- Resolved predictions now affect scoring within the same session

#### 6. Screen Context in Interactions
- Added `shownOnScreen?: string` to `ScoredInsight` type
- `vascoGuidanceService` stamps `screen` on each insight before returning
- `VascoInsightCard` reads `shownOnScreen` and passes it as `screenContext` in all interactions
- Enables per-screen engagement analysis (e.g., "user acts on margin insights on the savings screen")

#### 7. Periodically-Updating Timestamp
- `vascoGuidanceService` now uses `useState` + 5-minute interval instead of frozen `useMemo(() => new Date(), [])`
- Freshness calculations, fatigue windows, and daily budget resets stay accurate during long sessions
- Prevents stale scoring when app stays open on job sites

#### Files Modified
| File | Changes |
|------|---------|
| `calibration.ts` | In-memory dedup map for `logPrediction()` (5-min window) |
| `learningStorage.ts` | Dedup for `recordMetricSnapshot()`, `category` on `InsightInteraction`, fixed `getCategoryFatigueToday` filter |
| `generators/capacityGenerator.ts` | `recordMetricSnapshot('capacityUtilization')` |
| `generators/savingsOpportunityGenerator.ts` | `recordMetricSnapshot('savingsTotal')` |
| `generators/types.ts` | `shownOnScreen?: string` on `ScoredInsight` |
| `insightScorer.ts` | Auto-refresh stale calibration cache in `getCalibratedMultiplier()` |
| `VascoInsightCard.tsx` | Dwell-time on collapse, category in all interactions, screenContext from insight |
| `vascoGuidanceService.ts` | Stamp `shownOnScreen`, periodic `now` updates (5-min interval) |

### Session 9 — End-to-End Learning Loop Activation (6 improvements)

#### 1. Enterprise Screen Visit Tracking
- Added `recordScreenVisit(activeTab)` via `useEffect` to all 4 enterprise dashboards
- CFO, COO, Director, Site Lead tab changes now recorded in learning profile
- Enables screen affinity boost scoring for enterprise roles (was always 0 before)

#### 2. Outcome Feedback UI on Acted Insights
- `VascoInsightCard` now shows "Nuttig?" with thumbs-up/thumbs-down after acting on an insight
- Calls `recordInsightOutcome(insightId, generatorId, 'positive'|'negative')` on tap
- Completes the bidirectional learning loop — outcome data now flows into `getOutcomeSuccessRate()` and scoring

#### 3. Job & Invoice Outcome Recording
- `smartSchedulerService.advanceLifecycle()` now calls `recordJobOutcome()` when job reaches 'gereed' or 'betaald'
- `cashFlowService.markInvoicePaid()` now calls `recordInvoiceOutcome()` with payment timing data
- `invoiceAutomationService.markPaid()` also calls `recordInvoiceOutcome()`
- All use dynamic `import()` to avoid circular dependencies + fire-and-forget `.catch(() => {})`
- Calibration predictions can now be resolved against actual outcomes

#### 4. Role-Aware Learning Profile Storage
- Storage key changed from static `@vasco_learning_profile` to `@vasco_learning_profile_{role}`
- New `setActiveRole(role)` function invalidates cache when role changes
- `vascoGuidanceService` calls `setActiveRole(role)` before loading profile
- Prevents cross-contamination of learning data when switching roles

#### 5. Intelligence Dashboard — Missing Generator Labels
- Added 4 missing generators to `GENERATOR_LABELS` and `GENERATOR_ICONS`:
  - `margin-root-cause` → 'Marge-oorzaak'
  - `customer-lifecycle` → 'Klant-levenscyclus'
  - `cascading-delay` → 'Cascadevertraging'
  - `estimation-variance-type` → 'Schattingsafwijking per type'

#### 6. Anomaly Detection Expansion
- Added `detectAnomaly()` to 3 more generators (total now 7/22):
  - `capacityGenerator`: anomaly on `capacityUtilization`, priority escalation, anomaly in message + evidence
  - `cashGapGenerator`: anomaly on `dso`, priority escalation, anomaly in message + evidence
  - `complianceAlertGenerator`: anomaly on `complianceScore`, z-score in evidence
- All follow the established pattern: severity-based priority, description in output, z-score in evidence, confidence boost +0.05

#### Files Modified
| File | Changes |
|------|---------|
| `CFODashboard.tsx` | `useEffect` import, `recordScreenVisit(screenContext)` |
| `COODashboard.tsx` | `useEffect` import, `recordScreenVisit(activeTab)` |
| `DirectorDashboard.tsx` | `useEffect` import, `recordScreenVisit(activeTab)` |
| `SiteLeadDashboard.tsx` | `useEffect` import, `recordScreenVisit(activeTab)` |
| `VascoInsightCard.tsx` | Outcome feedback UI (thumbs up/down), `recordInsightOutcome` wiring |
| `smartSchedulerService.ts` | `recordJobOutcome` on lifecycle advance to gereed/betaald |
| `cashFlowService.ts` | `recordInvoiceOutcome` on markInvoicePaid |
| `invoiceAutomationService.ts` | `recordInvoiceOutcome` on markPaid |
| `learningStorage.ts` | Role-aware storage key, `setActiveRole()`, `getStorageKey()` |
| `vascoGuidanceService.ts` | `setActiveRole(role)` call before profile load |
| `intelligence.tsx` | 4 missing generator labels + icons |
| `capacityGenerator.ts` | anomaly detection on capacityUtilization |
| `cashGapGenerator.ts` | anomaly detection on DSO |
| `complianceAlertGenerator.ts` | anomaly detection on complianceScore |

### Session 10 — Adaptive Thresholds, Trend Enrichment & Consolidation (5 improvements)

#### 1. Adaptive Thresholds in 5 Generators
- Replaced hardcoded thresholds with `isAboveThreshold()` / `getAdaptiveThreshold()` in 5 generators:
  - `marginRootCauseGenerator`: marginLeakage (was <200), estimationAccuracy (was <75), idlePercent (was >8)
  - `estimationCalibrationGenerator`: estimationAccuracy (was >=90)
  - `cascadingDelayGenerator`: capacityUtilization (was >0.9)
  - `profitabilityGenerator`: warningImpact (was >5000)
  - `capacityGenerator`: utilization thresholds (was 50/90, now adaptive per contractor)
- Messages now display adaptive threshold values instead of hardcoded numbers

#### 2. Trend Enrichment Across 8 Generators
- Added `getTrend()` calls to 8 generators that previously had no trend context:
  - `marginRootCauseGenerator`, `savingsOpportunityGenerator`, `capacityGenerator` (already recorded metrics)
  - `dsoTrendGenerator`, `marginDriftGenerator`, `estimationCalibrationGenerator`, `profitabilityGenerator`, `cascadingDelayGenerator` (added `recordMetricSnapshot` + `getTrend`)
- Trend direction now appears in evidence strings (e.g., "bezettingstrend: stijgend")
- All 8 MetricKeys now have at least one generator recording + one using trends

#### 3. Calibration Resolution for Financial Generators
- `recordInvoiceOutcome()` now resolves calibration predictions for 3 financial generators:
  - `dso-trend`: actual DSO from payment timing
  - `overdue-invoice`: actual amount
  - `cash-gap`: actual DSO
- `resolveOutcomesFromJobHistory()` now also resolves `margin-root-cause` predictions
- Closes the calibration loop for all financial generators — accuracy now improves with data

#### 4. Consolidation Evidence with Source Names
- Added `GENERATOR_DISPLAY_NAMES` map (22 Dutch names) to `insightScorer.ts`
- Consolidated insights now show specific source names in evidence:
  - Before: "bevestigd door 3 bronnen"
  - After: "bevestigd door Marge-analyse, DSO-trend (3 bronnen)"
- Makes the consolidation transparent to contractors

#### 5. Generator-Level Diversity Enforcement
- Added `seenGenerators` Set in `scoreAndRankInsights()` diversity loop
- Max 1 insight per generator (highest-scored wins), combined with existing max 2 per category
- Prevents the same generator from dominating the insight feed even with multiple outputs

#### Files Modified
| File | Changes |
|------|---------|
| `marginRootCauseGenerator.ts` | 3 adaptive thresholds, getTrend in evidence |
| `estimationCalibrationGenerator.ts` | Adaptive threshold, recordMetricSnapshot, getTrend |
| `cascadingDelayGenerator.ts` | Adaptive capacity threshold, getTrend |
| `profitabilityGenerator.ts` | Adaptive marginLeakage threshold, recordMetricSnapshot, getTrend |
| `capacityGenerator.ts` | Adaptive over/under thresholds, getTrend in both evidence paths |
| `savingsOpportunityGenerator.ts` | getTrend in evidence |
| `dsoTrendGenerator.ts` | recordMetricSnapshot('dso'), getTrend in evidence |
| `marginDriftGenerator.ts` | recordMetricSnapshot('marginLeakage'), getTrend in evidence |
| `learningStorage.ts` | Invoice outcome calibration resolution, margin-root-cause in job resolution |
| `insightScorer.ts` | GENERATOR_DISPLAY_NAMES, source names in consolidation, generator-level dedup |

### Session 11 — Scoring Accuracy & Learning Completeness (6 improvements)

#### 1. Calibration Cache Persistence
- Added AsyncStorage persistence for calibration multiplier cache
- On app restart, loads persisted cache (24h TTL) instead of returning neutral 1.0
- Refresh writes to AsyncStorage so calibration data survives cold starts
- Cold-start loader: `loadPersistedCalibrationCache()` fires on first `getCalibratedMultiplier()` call

#### 2. Expanded Outcome Resolution (9 generators now resolved)
- `resolveOutcomesFromJobHistory()` now resolves 9 generators (was 5):
  - Added: `savings-opportunity` (totalSaved), `labor-efficiency` (avgDurationRatio), `capacity` (utilization proxy), `estimation-variance-type` (avgVarianceRatio)
  - Existing: margin-drift, margin-root-cause, estimation-calibration, cascading-delay, profitability
- Invoice outcome resolution still resolves 3: dso-trend, overdue-invoice, cash-gap
- Total: 12 of 22 generators have calibration feedback loops

#### 3. Cross-Generator Confidence Dependencies (9 links)
- Expanded `CONFIDENCE_DEPENDENCIES` from 4 to 9 entries:
  - Added: goal-progress→savings-opportunity, profitability→estimation-calibration+margin-drift, labor-efficiency→capacity, estimation-variance-type→estimation-calibration, margin-drift→labor-efficiency
- When a source generator has high calibration accuracy (>1.0 multiplier), dependent generators get a boost (up to 0.1)

#### 4. Data-Point Confidence Dampening
- New `dataPointFactor` in `scoreInsight()`: scales from 0.7 (1 data point) to 1.0 (10+ data points)
- Applied as multiplier to final score: low-data insights score 30% lower
- Uses `insight.dataPoints` field already set by all generators

#### 5. Outcome-Weighted Actioned Bonus
- Replaced flat 0.05 `actionedBonus` with scaled bonus based on `getOutcomeSuccessRate()`:
  - outcomeRate > 0.7 → 0.08 (strong positive signal)
  - outcomeRate > 0.5 → 0.05 (moderate)
  - outcomeRate <= 0.5 → 0.02 (low — user acts but outcomes are mixed)
- Generators consistently producing good outcomes get amplified

#### 6. Role-Aware Fatigue Penalties
- Replaced global `FATIGUE_SAME_GENERATOR_4H` / `FATIGUE_DISMISSED_24H` with per-role `ROLE_FATIGUE` map
- Contractors: lowest fatigue (0.20/0.40) — they tolerate frequent insights
- Site Leads: moderate (0.25/0.50)
- COO: higher (0.35/0.65) — operational but less frequent
- CFO: high (0.40/0.70) — prefers quality over quantity
- Director: highest fatigue (0.45/0.75) — strategic, few insights preferred
- `getFatiguePenalty()` now accepts `role` parameter

#### Scoring Formula (updated)
```
finalScore = ((relevance × W_r) + (engagement × W_e) + (freshness × W_f) + (urgency × W_u)
  + screenAffinityBoost + actionedBonus(outcomeRate)
  - fatigue(role) - categoryFatigue + crossGeneratorBoost + outcomeBoost)
  × calibrationMultiplier × dataPointFactor
```

#### Files Modified
| File | Changes |
|------|---------|
| `insightScorer.ts` | AsyncStorage import, calibration persistence, cold-start loader, 5 new cross-generator deps, dataPointFactor, outcome-weighted actionedBonus, ROLE_FATIGUE map, getFatiguePenalty(role) |
| `learningStorage.ts` | 4 new generators in resolveOutcomesFromJobHistory (savings, labor, capacity, estimation-variance) |

### Session 12 — Deeper Learning Loops & UX Polish (5 improvements)

#### 1. Feedback Loop Expansion (4 new event types)
- `processFeedbackLoops()` now handles 4 additional event types beyond quote/job/payment:
  - `quote_viewed`: weak positive signal (0.3) for bracket — they looked but haven't decided
  - `quote_expired`: negative signal (0) for bracket — opportunity lost
  - `payment_overdue`: high payment days (daysOverdue + 30) for segment — risk indicator
  - `job_cancelled`: 0 ratio for category — no work completed
- Total event types: 7 (was 3)

#### 2. Snooze-Duration Persistence
- Added `snoozeUntil?: string` (ISO date) to `InsightInteraction`
- New `getSnoozeExpiry(profile, generatorId)` helper returns active snooze expiry or null
- `scoreAndRankInsights()` filters snoozed insights before scoring (not after diversity)
- Snoozed generators don't consume diversity slots or daily budget

#### 3. Low-Data Confidence Warning
- Added `confidenceWarning?: string` to `ScoredInsight` type
- `scoreInsight()` sets warning when `dataPoints < 5`: "Vroeg signaal — gebaseerd op X datapunten"
- `VascoInsightCard` displays orange flask badge next to confidence badge in reasoning panel
- New `confidenceRow` style wraps both badges with flex row + wrap

#### 4. Cross-Screen Dedup for Enterprise Roles
- Non-contractor roles (sitelead, coo, cfo, director) get -0.15 penalty when same generator was viewed on a different screen within 6 hours
- Prevents enterprise users seeing the same insight repeated across tabs
- Contractors exempt: they typically use fewer screens, repetition is acceptable
- Checks `insightInteractions` for recent 'viewed' actions on other screens

#### 5. Goal Tracking Activation
- `goalProgressGenerator` now records `recordMetricSnapshot('savingsTotal', ...)` for trend tracking
- Evidence string enriched with `getTrend()` direction (stijgend/dalend)
- Prediction logged with progress percentage instead of raw savings amount
- All 22 generators now have metric recording and trend enrichment

#### Scoring Formula (updated)
```
finalScore = ((relevance × W_r) + (engagement × W_e) + (freshness × W_f) + (urgency × W_u)
  + screenAffinityBoost + actionedBonus(outcomeRate)
  - fatigue(role) - categoryFatigue - crossScreenPenalty
  + crossGeneratorBoost + outcomeBoost)
  × calibrationMultiplier × dataPointFactor
```

New term:
- `crossScreenPenalty`: 0.15 for enterprise roles when same generator was shown on different screen within 6h (0 for contractors)

#### Files Modified
| File | Changes |
|------|---------|
| `intelligenceEngine.ts` | 4 new event types in processFeedbackLoops (quote_viewed, quote_expired, payment_overdue, job_cancelled) |
| `learningStorage.ts` | `snoozeUntil` on InsightInteraction, `getSnoozeExpiry()` helper |
| `insightScorer.ts` | Snooze filtering, confidenceWarning computation, crossScreenPenalty for enterprise |
| `generators/types.ts` | `confidenceWarning?: string` on ScoredInsight |
| `generators/goalProgressGenerator.ts` | recordMetricSnapshot, getTrend in evidence |
| `VascoInsightCard.tsx` | confidenceWarning badge display, `confidenceRow` style |

---

### Session 13 — Site Lead AI Implementation (2026-03-21)

4 new site-lead-specific generators, 5 screens wired with inline insights, outcome recording for calibration feedback loops.

#### 1. New Generators (4)

| Generator | File | Screens | Roles | Purpose |
|-----------|------|---------|-------|---------|
| `crew-performance` | `crewPerformanceGenerator.ts` | today, overview, schedule, dispatch | sitelead | Workforce utilization trends from daily reports. Detects declining bezetting, low avg progress, productivity anomalies. Uses 7-day rolling window, compares recent vs older periods. |
| `incident-trend` | `incidentTrendGenerator.ts` | today, safety, overview | sitelead, coo | Z-score spike detection on incidents + near-misses. Combines incident reports + daily report safety counts. Baseline = monthly rate / weeks. Triggers on z > 1.5 or high-severity incidents. |
| `defect-cluster` | `defectClusterGenerator.ts` | today, quality, overview, issues | sitelead, coo | Pattern detection in open defects: clusters by trade (>50% concentration), clusters by zone, oldest-age tracking. Suggests targeted QC rounds for dominant trades. |
| `cert-renewal-planner` | `certRenewalPlannerGenerator.ts` | today, safety, compliance, overview | sitelead | Reads worker cert data from AsyncStorage. Detects batch expirations (multiple in same month), expired-cert workers, staggered renewal opportunities. Lead time warnings (2-4 week renewal estimate). |

**Total generators: 45** (was 41)
- Contractor: 22 generators
- Site Lead: 11 (7 cross-role + 4 dedicated)
- CFO: 9, COO: 6, Director: 4

#### 2. InsightCategory Extended

Added 3 new categories to `VascoInsightCard.tsx`:
- `'operations'` — crew performance, capacity (site lead operational)
- `'safety'` — incident trends, safety compliance
- `'quality'` — defect patterns, inspection quality

Full type: `'alert' | 'opportunity' | 'compliance' | 'financial' | 'schedule' | 'tip' | 'weather' | 'operational' | 'operations' | 'safety' | 'quality'`

#### 3. Site Lead Metric Keys (4 new)

Added to `learningStorage.ts` MetricKey type:
- `workforceUtilization` — % present vs planned (from daily reports)
- `incidentRate` — incidents + near-misses count (from daily reports + incident reports)
- `defectCount` — open defect count (updated on close)
- `inspectionScore` — % checked items / total items (from inspections)

#### 4. Outcome Recording

Wired into `siteLeadDataService.ts` — every CRUD action now records metrics for AI calibration:

| Action | Metric Recorded | Value |
|--------|----------------|-------|
| `closeDefect()` | `defectCount` | remaining open count |
| `addReport()` | `workforceUtilization` | present/planned × 100 |
| `addReport()` | `incidentRate` | incidents + near-misses (if > 0) |
| `addInspection()` | `inspectionScore` | checked/total × 100 |
| `addIncident()` | `incidentRate` | total incident count |

These feed the `recordMetricSnapshot()` pipeline: weekly snapshots → trend analysis → generator evidence strings.

#### 5. Inline Insights on Secondary Screens

Added 6 new inline insight entries to `vascoGuidanceService.ts`:

| Screen Key | Icon | Message Theme |
|-----------|------|---------------|
| `sitelead:daily-report:overview` | analytics | Consistent reporting improves AI predictions 40% |
| `sitelead:worker-certs:overview` | ribbon | Current certs = 60% fewer safety incidents |
| `sitelead:compliance:overview` | shield-checkmark | Vasco monitors certs/permits automatically |
| `sitelead:close-defect:overview` | construct | Defects closed within 7 days = 35% cheaper |
| `sitelead:incident-report:overview` | warning | Every report improves safety patterns; near-misses prevent 10x serious incidents |

Wired into 5 screens with `useInlineInsight()` hook + `<InlineInsight>` component:
- `app/sitelead/daily-report.tsx`
- `app/sitelead/worker-certs.tsx`
- `app/sitelead/compliance.tsx`
- `app/sitelead/close-defect.tsx`
- `app/sitelead/incident-report.tsx`

#### Files Modified/Created

| File | Changes |
|------|---------|
| `generators/crewPerformanceGenerator.ts` | **NEW** — workforce utilization analysis |
| `generators/incidentTrendGenerator.ts` | **NEW** — z-score anomaly detection |
| `generators/defectClusterGenerator.ts` | **NEW** — trade/zone clustering |
| `generators/certRenewalPlannerGenerator.ts` | **NEW** — batch expiry + renewal planning |
| `generators/index.ts` | 4 new imports, 4 registry entries, 4 hook calls, 4 allResults entries, deps array updated |
| `VascoInsightCard.tsx` | InsightCategory extended with operations/safety/quality |
| `learningStorage.ts` | 4 new MetricKeys (workforceUtilization, incidentRate, defectCount, inspectionScore) |
| `siteLeadDataService.ts` | recordMetricSnapshot calls in closeDefect, addReport, addInspection, addIncident |
| `vascoGuidanceService.ts` | 6 new INLINE_INSIGHTS entries for site lead screens |
| `app/sitelead/daily-report.tsx` | InlineInsight + useInlineInsight wired |
| `app/sitelead/worker-certs.tsx` | InlineInsight + useInlineInsight wired |
| `app/sitelead/compliance.tsx` | InlineInsight + useInlineInsight wired |
| `app/sitelead/close-defect.tsx` | InlineInsight + useInlineInsight wired |
| `app/sitelead/incident-report.tsx` | InlineInsight + useInlineInsight wired |

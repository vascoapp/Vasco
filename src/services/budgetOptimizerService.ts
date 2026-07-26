/**
 * Budget Optimizer Service — constraint optimizer that takes enriched budget
 * lines and runs 3 optimization scenarios (conservative, balanced, aggressive).
 * Uses a greedy heuristic: score each line by savingsAmount x confidence x
 * (1 - riskFactor), sort descending, then greedily pick lines that pass the
 * scenario threshold filters while respecting constraints.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { EnrichedBudgetLine, SavingsAction } from './budgetEnrichmentService';
import type { BudgetExtractionResult, BudgetCategorySummary } from '../ingestion/budgetExtractor';
import { enrichBudgetLines } from './budgetEnrichmentService';
import { trackUserAction } from '../intelligence/intelligenceEngine';
import {
  getCurrentWorkbook,
  saveWorkbook,
  updateWorkbook,
  listWorkbooks,
  approvalsToRecord,
  recordToApprovals,
  type BudgetWorkbook,
} from './budgetStorageService';
import { formatMoney } from '../i18n/formatting';

// ── Types ──────────────────────────────────────────────────────

export type OptimizationScenario = 'conservative' | 'balanced' | 'aggressive';

export type OptimizationActionType =
  | 'negotiate_rate'
  | 'switch_supplier'
  | 'alternative_material'
  | 'bulk_purchase'
  | 'reduce_quantity'
  | 'phase_timing'
  | 'spec_optimization'
  | 'remove_redundant';

export interface OptimizationConstraints {
  maxBudget: number;
  minQualityScore?: number; // 0-100
  fixedLines?: string[]; // costCodes that cannot change
  categoryBudgets?: Record<string, number>;
  supplierPreferences?: string[];
  timelineWeeks?: number;
}

export interface LineOptimization {
  costCode: string;
  description: string;
  category: string;
  currentUnitRate: number;
  suggestedUnitRate: number;
  currentTotal: number;
  suggestedTotal: number;
  savings: number;
  savingsPercent: number;
  confidence: number;
  action: OptimizationActionType;
  reasoning: string; // Dutch
  sources: string[];
  risk: 'low' | 'medium' | 'high';
  approvalRequired: boolean;
  approved?: boolean;
}

export interface ScenarioResult {
  scenario: OptimizationScenario;
  label: string; // Dutch
  description: string; // Dutch
  totalBudget: number;
  optimizedBudget: number;
  totalSavings: number;
  savingsPercent: number;
  optimizations: LineOptimization[];
  categoryBreakdown: CategoryOptimization[];
  riskProfile: { low: number; medium: number; high: number };
  confidenceAvg: number;
  lineCount: number;
}

export interface CategoryOptimization {
  name: string;
  currentTotal: number;
  optimizedTotal: number;
  savings: number;
  savingsPercent: number;
  lineCount: number;
}

export interface BudgetOptimizerState {
  extractionResult: BudgetExtractionResult | null;
  enrichedLines: EnrichedBudgetLine[];
  scenarios: ScenarioResult[];
  selectedScenario: OptimizationScenario;
  approvals: Map<string, boolean>; // costCode -> approved
  constraints: OptimizationConstraints;
  isProcessing: boolean;
}

// ── Scenario Config ────────────────────────────────────────────

interface ScenarioConfig {
  label: string;
  description: string;
  minConfidence: number;
  maxRisk: 'low' | 'medium' | 'high';
  minSavingsPercent: number;
}

const SCENARIO_CONFIGS: Record<OptimizationScenario, ScenarioConfig> = {
  conservative: {
    label: 'Conservatief',
    description: 'Alleen wijzigingen met hoge zekerheid en laag risico',
    minConfidence: 0.8,
    maxRisk: 'low',
    minSavingsPercent: 2,
  },
  balanced: {
    label: 'Gebalanceerd',
    description: 'Optimale mix van besparingen en risico',
    minConfidence: 0.6,
    maxRisk: 'medium',
    minSavingsPercent: 1,
  },
  aggressive: {
    label: 'Agressief',
    description: 'Maximale besparingen, hogere risicotolerantie',
    minConfidence: 0.4,
    maxRisk: 'high',
    minSavingsPercent: 0.5,
  },
};

const RISK_FACTOR: Record<'low' | 'medium' | 'high', number> = {
  low: 0,
  medium: 0.3,
  high: 0.6,
};

const RISK_ORDER: Record<'low' | 'medium' | 'high', number> = {
  low: 0,
  medium: 1,
  high: 2,
};

// ── Service ────────────────────────────────────────────────────

class BudgetOptimizerService {
  /**
   * Run all 3 optimization scenarios against the enriched budget lines.
   */
  optimizeBudget(
    enrichedLines: EnrichedBudgetLine[],
    constraints: OptimizationConstraints,
  ): ScenarioResult[] {
    const scenarios: OptimizationScenario[] = ['conservative', 'balanced', 'aggressive'];
    return scenarios.map((s) => this.runScenario(s, enrichedLines, constraints));
  }

  /**
   * Run a single optimization scenario against the enriched lines.
   */
  private runScenario(
    scenario: OptimizationScenario,
    lines: EnrichedBudgetLine[],
    constraints: OptimizationConstraints,
  ): ScenarioResult {
    const config = SCENARIO_CONFIGS[scenario];
    const fixedSet = new Set(constraints.fixedLines ?? []);
    const totalBudget = lines.reduce((sum, l) => sum + l.total, 0);

    // Build scored candidate list from all savings actions on all lines
    const candidates = this.buildScoredCandidates(lines, config, fixedSet);

    // Greedy selection: pick optimizations respecting constraints
    const optimizations = this.greedySelect(candidates, constraints, lines);

    // Category breakdown
    const categoryBreakdown = this.calculateCategoryBreakdown(optimizations, lines);

    // Risk profile
    const riskProfile = { low: 0, medium: 0, high: 0 };
    for (const opt of optimizations) {
      riskProfile[opt.risk] += 1;
    }

    // Confidence average
    const confidenceAvg =
      optimizations.length > 0
        ? optimizations.reduce((sum, o) => sum + o.confidence, 0) / optimizations.length
        : 0;

    // Totals
    const totalSavings = optimizations.reduce((sum, o) => sum + o.savings, 0);
    const optimizedBudget = totalBudget - totalSavings;

    return {
      scenario,
      label: config.label,
      description: config.description,
      totalBudget,
      optimizedBudget,
      totalSavings,
      savingsPercent: totalBudget > 0 ? (totalSavings / totalBudget) * 100 : 0,
      optimizations,
      categoryBreakdown,
      riskProfile,
      confidenceAvg: Math.round(confidenceAvg * 100) / 100,
      lineCount: optimizations.length,
    };
  }

  /**
   * Build a scored, sorted list of candidate optimizations from enriched lines.
   */
  private buildScoredCandidates(
    lines: EnrichedBudgetLine[],
    config: ScenarioConfig,
    fixedSet: Set<string>,
  ): Array<{ optimization: LineOptimization; score: number }> {
    const candidates: Array<{ optimization: LineOptimization; score: number }> = [];

    for (const line of lines) {
      // Skip lines locked by constraints
      if (fixedSet.has(line.costCode)) continue;

      // Consider each savings action on this enriched line
      if (!line.savingsPotential?.actions || line.savingsPotential?.actions.length === 0) continue;

      // Pick the best action for this line (highest savings that passes filters)
      const bestAction = this.pickBestAction(line, config);
      if (!bestAction) continue;

      const savingsAmount = bestAction.estimatedSaving;
      const savingsPercent = line.total > 0 ? (savingsAmount / line.total) * 100 : 0;

      // Threshold filter: minimum savings percent
      if (savingsPercent < config.minSavingsPercent) continue;

      // Threshold filter: minimum confidence
      if (bestAction.confidence < config.minConfidence) continue;

      // Threshold filter: risk ceiling
      if (RISK_ORDER[bestAction.risk] > RISK_ORDER[config.maxRisk]) continue;

      const suggestedTotal = line.total - savingsAmount;
      const suggestedUnitRate =
        line.quantity > 0 ? suggestedTotal / line.quantity : line.unitRate;

      const optimization: LineOptimization = {
        costCode: line.costCode,
        description: line.description,
        category: line.category || 'Overig',
        currentUnitRate: line.unitRate,
        suggestedUnitRate: Math.round(suggestedUnitRate * 100) / 100,
        currentTotal: line.total,
        suggestedTotal: Math.round(suggestedTotal * 100) / 100,
        savings: Math.round(savingsAmount * 100) / 100,
        savingsPercent: Math.round(savingsPercent * 100) / 100,
        confidence: bestAction.confidence,
        action: bestAction.type as OptimizationActionType,
        reasoning: this.generateReasoning(line, bestAction),
        sources: [bestAction.label],
        risk: bestAction.risk,
        approvalRequired: bestAction.risk !== 'low' || savingsAmount > 1000,
      };

      // Score: savingsAmount x confidence x (1 - riskFactor)
      const score = savingsAmount * bestAction.confidence * (1 - RISK_FACTOR[bestAction.risk]);

      candidates.push({ optimization, score });
    }

    // Sort descending by score
    candidates.sort((a, b) => b.score - a.score);

    return candidates;
  }

  /**
   * Pick the best savings action for a line that passes the scenario filters.
   * Returns the action with the highest effective score.
   */
  private pickBestAction(
    line: EnrichedBudgetLine,
    config: ScenarioConfig,
  ): SavingsAction | null {
    let best: SavingsAction | null = null;
    let bestScore = -1;

    for (const action of line.savingsPotential?.actions ?? []) {
      // Filter: confidence
      if (action.confidence < config.minConfidence) continue;

      // Filter: risk
      if (RISK_ORDER[action.risk] > RISK_ORDER[config.maxRisk]) continue;

      // Filter: minimum savings percent
      const pct = line.total > 0 ? (action.estimatedSaving / line.total) * 100 : 0;
      if (pct < config.minSavingsPercent) continue;

      const score =
        action.estimatedSaving * action.confidence * (1 - RISK_FACTOR[action.risk]);

      if (score > bestScore) {
        bestScore = score;
        best = action;
      }
    }

    return best;
  }

  /**
   * Greedy selection: iterate scored candidates and accumulate while respecting
   * category budget constraints.
   */
  private greedySelect(
    candidates: Array<{ optimization: LineOptimization; score: number }>,
    constraints: OptimizationConstraints,
    allLines: EnrichedBudgetLine[],
  ): LineOptimization[] {
    const selected: LineOptimization[] = [];
    const categorySpend = new Map<string, number>();

    // Pre-compute current category totals
    for (const line of allLines) {
      const cat = line.category || 'Overig';
      categorySpend.set(cat, (categorySpend.get(cat) ?? 0) + line.total);
    }

    // Track per-category optimized spend
    const categoryOptimized = new Map<string, number>(categorySpend);
    const selectedCostCodes = new Set<string>();

    for (const { optimization } of candidates) {
      // Skip if we already optimized this cost code
      if (selectedCostCodes.has(optimization.costCode)) continue;

      // Check category budget constraint
      if (constraints.categoryBudgets) {
        const catBudget = constraints.categoryBudgets[optimization.category];
        if (catBudget !== undefined) {
          const currentCatSpend = categoryOptimized.get(optimization.category) ?? 0;
          const newCatSpend = currentCatSpend - optimization.savings;
          // Don't optimize below category budget floor (we want to respect minimum allocation)
          if (newCatSpend < catBudget * 0.5) continue;
        }
      }

      selected.push(optimization);
      selectedCostCodes.add(optimization.costCode);

      // Update category optimized spend
      const cat = optimization.category || 'Overig';
      categoryOptimized.set(cat, (categoryOptimized.get(cat) ?? 0) - optimization.savings);
    }

    return selected;
  }

  /**
   * Generate Dutch reasoning text for an optimization action.
   */
  private generateReasoning(line: EnrichedBudgetLine, action: SavingsAction): string {
    const currentRate = line.unitRate;
    const savingsAmount = action.estimatedSaving;
    const savingsPercent = line.total > 0 ? ((savingsAmount / line.total) * 100).toFixed(1) : '0';
    const suggestedRate =
      line.quantity > 0
        ? (line.total - savingsAmount) / line.quantity
        : currentRate * (1 - savingsAmount / line.total);

    switch (action.type) {
      case 'negotiate_rate':
        return (
          `Huidig tarief ${formatMoney(currentRate)}/eenheid ligt ${savingsPercent}% boven marktgemiddelde ` +
          `(${formatMoney(suggestedRate)}). Onderhandeling kan ${formatMoney(savingsAmount)} besparen.`
        );

      case 'switch_supplier':
        return (
          `Alternatieve leverancier biedt vergelijkbare kwaliteit voor ${formatMoney(suggestedRate)}/eenheid, ` +
          `${savingsPercent}% goedkoper.`
        );

      case 'alternative_material':
        return (
          `Alternatief materiaal met vergelijkbare specificaties beschikbaar voor ` +
          `${formatMoney(suggestedRate)}/eenheid.`
        );

      case 'bulk_purchase':
        return (
          `Gecombineerde inkoop over meerdere posten kan volumekorting van ${savingsPercent}% opleveren.`
        );

      case 'reduce_quantity':
        return (
          `Hoeveelheid kan worden geoptimaliseerd op basis van vergelijkbare projecten. ` +
          `Verwachte besparing: ${formatMoney(savingsAmount)}.`
        );

      case 'phase_timing':
        return (
          `Door fasering aan te passen kunnen tarieven dalen. ` +
          `Geschatte besparing: ${formatMoney(savingsAmount)} (${savingsPercent}%).`
        );

      case 'spec_optimization':
        return (
          `Specificatie-optimalisatie mogelijk zonder kwaliteitsverlies. ` +
          `Besparing: ${formatMoney(savingsAmount)}.`
        );

      case 'remove_redundant':
        return (
          `Post lijkt overlappend met andere begrotingsregels. ` +
          `Verwijdering bespaart ${formatMoney(savingsAmount)}.`
        );

      default:
        return `Optimalisatie mogelijk: ${formatMoney(savingsAmount)} besparing (${savingsPercent}%).`;
    }
  }

  /**
   * Calculate per-category breakdown of optimizations vs. original budget.
   */
  private calculateCategoryBreakdown(
    optimizations: LineOptimization[],
    allLines: EnrichedBudgetLine[],
  ): CategoryOptimization[] {
    // Current totals per category
    const categoryTotals = new Map<string, { currentTotal: number; lineCount: number }>();
    for (const line of allLines) {
      const cat = line.category || 'Overig';
      const entry = categoryTotals.get(cat) ?? { currentTotal: 0, lineCount: 0 };
      entry.currentTotal += line.total;
      entry.lineCount += 1;
      categoryTotals.set(cat, entry);
    }

    // Savings per category from optimizations
    const categorySavings = new Map<string, { savings: number; optCount: number }>();
    for (const opt of optimizations) {
      const cat = opt.category || 'Overig';
      const entry = categorySavings.get(cat) ?? { savings: 0, optCount: 0 };
      entry.savings += opt.savings;
      entry.optCount += 1;
      categorySavings.set(cat, entry);
    }

    // Build result
    const breakdown: CategoryOptimization[] = [];
    for (const [name, { currentTotal, lineCount }] of categoryTotals.entries()) {
      const savingsEntry = categorySavings.get(name);
      const savings = savingsEntry?.savings ?? 0;
      const optimizedTotal = currentTotal - savings;

      breakdown.push({
        name,
        currentTotal: Math.round(currentTotal * 100) / 100,
        optimizedTotal: Math.round(optimizedTotal * 100) / 100,
        savings: Math.round(savings * 100) / 100,
        savingsPercent:
          currentTotal > 0 ? Math.round((savings / currentTotal) * 10000) / 100 : 0,
        lineCount,
      });
    }

    // Sort by savings descending
    breakdown.sort((a, b) => b.savings - a.savings);

    return breakdown;
  }

  /**
   * Track an approval for a specific cost code optimization.
   */
  approveOptimization(costCode: string): void {
    trackUserAction('ai_recommendation_accepted', {
      action: 'budget_optimization_approved',
      costCode,
    });
  }

  /**
   * Track a rejection for a specific cost code optimization.
   */
  rejectOptimization(costCode: string): void {
    trackUserAction('ai_recommendation_rejected', {
      action: 'budget_optimization_rejected',
      costCode,
    });
  }

  /**
   * Sum savings of only the approved optimizations in a scenario.
   */
  getApprovedSavings(
    scenario: ScenarioResult,
    approvals: Map<string, boolean>,
  ): number {
    let total = 0;
    for (const opt of scenario.optimizations) {
      if (approvals.get(opt.costCode) === true) {
        total += opt.savings;
      }
    }
    return Math.round(total * 100) / 100;
  }
}

// ── Singleton ──────────────────────────────────────────────────

export const budgetOptimizerService = new BudgetOptimizerService();

// ── React Hook ─────────────────────────────────────────────────

export function useBudgetOptimizer(role: string = 'contractor') {
  const [extractionResult, setExtractionResult] = useState<BudgetExtractionResult | null>(null);
  const [enrichedLines, setEnrichedLines] = useState<EnrichedBudgetLine[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioResult[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<OptimizationScenario>('balanced');
  const [approvals, setApprovals] = useState<Map<string, boolean>>(new Map());
  const [constraints, setConstraints] = useState<OptimizationConstraints>({ maxBudget: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [workbookId, setWorkbookId] = useState<string | null>(null);
  const [savedWorkbooks, setSavedWorkbooks] = useState<Array<{ id: string; projectName: string; totalBudget: number; savedAt: string }>>([]);
  const [hydratedFromStorage, setHydratedFromStorage] = useState(false);

  // Debounced auto-save ref
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load persisted workbook on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const wb = await getCurrentWorkbook(role);
        if (wb && !cancelled) {
          setExtractionResult(wb.extractionResult);
          setEnrichedLines(wb.enrichedLines);
          setScenarios(wb.scenarios);
          setSelectedScenario(wb.selectedScenario);
          setApprovals(recordToApprovals(wb.approvals));
          setConstraints(wb.constraints);
          setWorkbookId(wb.id);
          setHydratedFromStorage(true);
        }
        const wbs = await listWorkbooks(role);
        if (!cancelled) setSavedWorkbooks(wbs);
      } catch {
        // Silent — will fall through to mock data
      }
    })();
    return () => { cancelled = true; };
  }, [role]);

  // Debounced auto-save when key state changes
  useEffect(() => {
    if (!extractionResult || !workbookId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const wb: BudgetWorkbook = {
        id: workbookId,
        extractionResult,
        enrichedLines,
        scenarios,
        selectedScenario,
        approvals: approvalsToRecord(approvals),
        constraints,
        savedAt: new Date().toISOString(),
      };
      saveWorkbook(wb, role).catch(() => {});
    }, 2000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [extractionResult, enrichedLines, scenarios, selectedScenario, approvals, constraints, workbookId, role]);

  const processExtraction = useCallback(
    async (result: BudgetExtractionResult) => {
      setIsProcessing(true);
      setExtractionResult(result);

      try {
        // Enrich lines with market data and savings actions
        const enriched = enrichBudgetLines(result.lines);
        setEnrichedLines(enriched);

        // Set default constraints from extraction
        const newConstraints: OptimizationConstraints = {
          ...constraints,
          maxBudget: result.totalBudget,
        };
        setConstraints(newConstraints);

        // Run optimizer
        const results = budgetOptimizerService.optimizeBudget(enriched, newConstraints);
        setScenarios(results);

        // Reset approvals for new extraction
        setApprovals(new Map());

        // Generate workbook ID and persist
        const newId = `wb_${Date.now()}`;
        setWorkbookId(newId);

        const wb: BudgetWorkbook = {
          id: newId,
          extractionResult: result,
          enrichedLines: enriched,
          scenarios: results,
          selectedScenario: 'balanced',
          approvals: {},
          constraints: newConstraints,
          savedAt: new Date().toISOString(),
        };
        await saveWorkbook(wb, role);
        const wbs = await listWorkbooks(role);
        setSavedWorkbooks(wbs);

        trackUserAction('document_extracted', {
          action: 'budget_optimized',
          totalBudget: result.totalBudget,
          lineCount: enriched.length,
          scenarios: results.map((s) => ({
            scenario: s.scenario,
            savings: s.totalSavings,
            savingsPercent: s.savingsPercent,
          })),
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [constraints, role],
  );

  const approveOptimization = useCallback(
    (costCode: string) => {
      setApprovals((prev) => {
        const next = new Map(prev);
        next.set(costCode, true);
        return next;
      });
      budgetOptimizerService.approveOptimization(costCode);
    },
    [],
  );

  const rejectOptimization = useCallback(
    (costCode: string) => {
      setApprovals((prev) => {
        const next = new Map(prev);
        next.set(costCode, false);
        return next;
      });
      budgetOptimizerService.rejectOptimization(costCode);
    },
    [],
  );

  const selectedScenarioResult = useMemo(
    () => scenarios.find((s) => s.scenario === selectedScenario) ?? null,
    [scenarios, selectedScenario],
  );

  const approvedSavings = useMemo(() => {
    if (!selectedScenarioResult) return 0;
    return budgetOptimizerService.getApprovedSavings(selectedScenarioResult, approvals);
  }, [selectedScenarioResult, approvals]);

  // Re-run optimizer when constraints change and we have enriched lines
  useEffect(() => {
    if (enrichedLines.length > 0 && constraints.maxBudget > 0) {
      const results = budgetOptimizerService.optimizeBudget(enrichedLines, constraints);
      setScenarios(results);
    }
  }, [constraints, enrichedLines]);

  return {
    extractionResult,
    enrichedLines,
    scenarios,
    selectedScenario,
    selectedScenarioResult,
    approvals,
    constraints,
    isProcessing,
    processExtraction,
    setSelectedScenario,
    setConstraints,
    approveOptimization,
    rejectOptimization,
    approvedSavings,
    workbookId,
    savedWorkbooks,
    hydratedFromStorage,
  };
}

// =============================================================================
// BUDGET OPTIMIZER DASHBOARD — AI Budget Optimization for Directors
// =============================================================================
// 2-tab dashboard: Overzicht | Details
// Processes mock budget workbook through enrichment + optimization pipeline.
// =============================================================================

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { Spacing, SafeArea } from '../../theme/spacing';
import {
  useBudgetOptimizer,
  type OptimizationScenario,
  type LineOptimization,
  type ScenarioResult,
  type CategoryOptimization,
} from '../../services/budgetOptimizerService';
import { MOCK_BUDGET_WORKBOOK } from '../../data/mockBudgetWorkbook';
import { extractBudgetWorkbook } from '../../ingestion/budgetExtractor';
import { exportBudgetPdf } from '../../services/budgetPdfService';
import { useAppState } from '../../state/AppState';
import { formatCurrency } from '../../i18n/formatting';
import type { EnrichedBudgetLine } from '../../services/budgetEnrichmentService';
import type {
  BudgetExtractionResult,
  ExtractedBudgetLine,
  BudgetCategorySummary,
} from '../../ingestion/budgetExtractor';
import type { NegotiationSummary } from '../../services/supplierNegotiationService';
import type { TCOSummary } from '../../services/tcoCalculatorService';

// =============================================================================
// CONSTANTS
// =============================================================================

type IconName = keyof typeof Ionicons.glyphMap;
type TabView = 'overview' | 'details';

const DIRECTOR_COLOR = SemanticColors.roleDirector;

// ── Mock projects for dropdown ────────────────────────────────────────────────

const MOCK_PROJECTS = [
  'Renovatie Kantoorgebouw',
  'Nieuwbouw Appartementen',
  'Utiliteitsbouw Logistiek',
];

// ── Number formatting ───────────────────────────────────────────────────────

const fmt = (n: number) => formatCurrency(n);

const fmtDec = (n: number) => formatCurrency(n);

const fmtPct = (n: number) => `${n.toFixed(1)}%`;

const fmtCompact = (n: number) => {
  if (n >= 1_000_000) return `${formatCurrency(n / 1_000_000).replace(/,00$|\.00$/, '')}M`;
  if (n >= 1_000) return `${formatCurrency(n / 1_000).replace(/,00$|\.00$/, '')}K`;
  return fmt(n);
};

// ── Action badge colors ─────────────────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
  negotiate_rate: SemanticColors.feedbackInfo,
  switch_supplier: '#7C3AED',
  alternative_material: SemanticColors.feedbackWarning,
  bulk_purchase: SemanticColors.feedbackSuccess,
  reduce_quantity: SemanticColors.feedbackError,
  phase_timing: SemanticColors.textTertiary,
  spec_optimization: Palette.hermesOrange,
  remove_redundant: SemanticColors.feedbackError,
};

// ── Action labels (Dutch) ───────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  negotiate_rate: 'Onderhandelen',
  switch_supplier: 'Leverancier wisselen',
  alternative_material: 'Alternatief materiaal',
  bulk_purchase: 'Bulk inkoop',
  reduce_quantity: 'Hoeveelheid reduceren',
  phase_timing: 'Fasering aanpassen',
  spec_optimization: 'Specificatie optimaliseren',
  remove_redundant: 'Redundant verwijderen',
};

// =============================================================================
// HELPER: Convert mock data to BudgetExtractionResult
// =============================================================================

function mockToBudgetExtraction(): BudgetExtractionResult {
  const wb = MOCK_BUDGET_WORKBOOK;

  const lines: ExtractedBudgetLine[] = wb.lines.map((l, idx) => ({
    id: `bgt_mock_${idx}`,
    costCode: l.costCode,
    description: l.description,
    category: l.category,
    subcategory: l.subcategory,
    quantity: l.quantity,
    unit: l.unit,
    unitRate: l.unitRate,
    total: l.total,
    supplier: l.supplier,
    sheetSource: l.sheetSource,
    confidence: 0.85,
  }));

  // Build category summaries
  const catMap = new Map<string, { total: number; lineCount: number }>();
  for (const line of lines) {
    const cat = line.category || 'Overig';
    const entry = catMap.get(cat) ?? { total: 0, lineCount: 0 };
    entry.total += line.total;
    entry.lineCount += 1;
    catMap.set(cat, entry);
  }
  const grandTotal = lines.reduce((sum, l) => sum + l.total, 0);
  const categories: BudgetCategorySummary[] = [];
  for (const [name, { total, lineCount }] of catMap.entries()) {
    categories.push({
      name,
      total,
      lineCount,
      percentage: grandTotal > 0 ? Math.round((total / grandTotal) * 10000) / 100 : 0,
    });
  }
  categories.sort((a, b) => b.total - a.total);

  return {
    projectName: wb.projectName,
    totalBudget: wb.totalBudget,
    currency: wb.currency,
    lines,
    categories,
    metadata: {
      fileName: `${wb.projectCode}.xlsx`,
      sheetsProcessed: 8,
      totalLinesExtracted: lines.length,
      averageConfidence: 0.85,
    },
  };
}

// =============================================================================
// TAB BUTTON COMPONENT
// =============================================================================

interface TabButtonProps {
  label: string;
  icon: IconName;
  isActive: boolean;
  onPress: () => void;
  activeColor?: string;
}

function TabButton({ label, icon, isActive, onPress, activeColor }: TabButtonProps) {
  return (
    <Pressable
      style={[styles.tabButton, isActive && [styles.tabButtonActive, activeColor ? { backgroundColor: activeColor } : undefined]]}
      onPress={onPress}
    >
      <Ionicons
        name={icon}
        size={15}
        color={isActive ? '#fff' : SemanticColors.textSecondary}
      />
      <Text
        style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// =============================================================================
// PROPS
// =============================================================================

interface BudgetOptimizerDashboardProps {
  accentColor?: string;
  embedded?: boolean;
  supplierNegotiation?: NegotiationSummary;
  tcoSummary?: TCOSummary;
}

// =============================================================================
// MAIN DASHBOARD
// =============================================================================

export default function BudgetOptimizerDashboard({
  accentColor,
  embedded,
  supplierNegotiation,
  tcoSummary,
}: BudgetOptimizerDashboardProps = {}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabView>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedOptId, setExpandedOptId] = useState<string | null>(null);
  const [expandedCatName, setExpandedCatName] = useState<string | null>(null);
  const [detailLine, setDetailLine] = useState<EnrichedBudgetLine | null>(null);
  const [filterAction, setFilterAction] = useState<string | null>(null);
  const [selectedProjectIdx, setSelectedProjectIdx] = useState(0);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);

  const ACCENT = accentColor ?? DIRECTOR_COLOR;

  const { pendingBudgetExtraction, setPendingBudgetExtraction } = useAppState();

  const optimizer = useBudgetOptimizer();
  const {
    enrichedLines,
    scenarios,
    selectedScenario,
    selectedScenarioResult,
    approvals,
    isProcessing,
    processExtraction,
    setSelectedScenario,
    approveOptimization,
    rejectOptimization,
    approvedSavings,
    hydratedFromStorage,
  } = optimizer;

  // ── Auto-load: real data > persisted data > mock fallback ───────────────────
  useEffect(() => {
    if (pendingBudgetExtraction) {
      processExtraction(pendingBudgetExtraction);
      setPendingBudgetExtraction(null);
    } else if (scenarios.length === 0 && !isProcessing && !optimizer.extractionResult && !hydratedFromStorage) {
      const extraction = mockToBudgetExtraction();
      processExtraction(extraction);
    }
  }, [pendingBudgetExtraction]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived data ──────────────────────────────────────────────────────────

  const activeScenario = selectedScenarioResult;

  const scenarioList = useMemo(
    () =>
      (['conservative', 'balanced', 'aggressive'] as OptimizationScenario[]).map(
        (key) => scenarios.find((s) => s.scenario === key) ?? null,
      ),
    [scenarios],
  );

  const projectName = optimizer.extractionResult?.projectName ?? MOCK_PROJECTS[selectedProjectIdx];
  const totalBudget = optimizer.extractionResult?.totalBudget ?? 0;
  const lineCount = optimizer.extractionResult?.lines.length ?? 0;

  // Action types present in active scenario
  const actionTypes = useMemo(() => {
    if (!activeScenario) return [];
    const types = new Set<string>();
    for (const opt of activeScenario.optimizations) {
      types.add(opt.action);
    }
    return Array.from(types);
  }, [activeScenario]);

  // Filtered optimizations
  const filteredOptimizations = useMemo(() => {
    if (!activeScenario) return [];
    if (!filterAction) return activeScenario.optimizations;
    return activeScenario.optimizations.filter((o) => o.action === filterAction);
  }, [activeScenario, filterAction]);

  // Filtered enriched lines for Details tab — search filters across categories AND lines
  const filteredLines = useMemo(() => {
    if (!searchQuery.trim()) return enrichedLines;
    const q = searchQuery.toLowerCase();
    return enrichedLines.filter(
      (l) =>
        l.costCode.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        l.category.toLowerCase().includes(q),
    );
  }, [enrichedLines, searchQuery]);

  // Group filtered enriched lines by category for integrated Details view
  const linesByCategory = useMemo(() => {
    const map = new Map<string, EnrichedBudgetLine[]>();
    for (const line of filteredLines) {
      const cat = line.category || 'Overig';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(line);
    }
    return map;
  }, [filteredLines]);

  // Filtered categories for Details tab
  const filteredCategories = useMemo(() => {
    if (!activeScenario) return [];
    if (!searchQuery.trim()) return activeScenario.categoryBreakdown;
    const q = searchQuery.toLowerCase();
    return activeScenario.categoryBreakdown.filter((cat) => {
      // Keep category if name matches
      if (cat.name.toLowerCase().includes(q)) return true;
      // Keep category if any of its optimizations match
      const catOpts = activeScenario.optimizations.filter(
        (o) => (o.category || 'Overig') === cat.name,
      );
      return catOpts.some(
        (o) =>
          o.costCode.toLowerCase().includes(q) ||
          o.description.toLowerCase().includes(q),
      );
    });
  }, [activeScenario, searchQuery]);

  // ── Export handler ────────────────────────────────────────────────────────

  const handleExport = useCallback(() => {
    if (!activeScenario) return;
    const approved = activeScenario.optimizations.filter(
      (o) => approvals.get(o.costCode) === true,
    );
    if (approved.length === 0) {
      Alert.alert(t('budget.noApprovals', 'No approvals'), t('budget.approveFirst', 'Approve optimizations first before exporting.'));
      return;
    }
    exportBudgetPdf(projectName, activeScenario, approved).catch((err) => {
      Alert.alert(t('budget.exportFailed', 'Export failed'), err instanceof Error ? err.message : t('common.unknownError', 'Unknown error'));
    });
  }, [activeScenario, approvals, projectName]);

  // ── Loading state ─────────────────────────────────────────────────────────

  if (isProcessing || scenarios.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.loadingText}>Budget analyseren...</Text>
        <Text style={styles.loadingSubtext}>
          Marktdata ophalen en optimalisaties berekenen
        </Text>
      </View>
    );
  }

  // ── Scenario selector labels ──────────────────────────────────────────────

  const scenarioMeta: Record<
    OptimizationScenario,
    { icon: IconName; riskLabel: string; riskColor: string }
  > = {
    conservative: {
      icon: 'shield-checkmark',
      riskLabel: 'Laag risico',
      riskColor: SemanticColors.feedbackSuccess,
    },
    balanced: {
      icon: 'swap-horizontal',
      riskLabel: 'Gebalanceerd',
      riskColor: SemanticColors.feedbackWarning,
    },
    aggressive: {
      icon: 'rocket',
      riskLabel: 'Hoog risico',
      riskColor: SemanticColors.feedbackError,
    },
  };

  // ── Price status for enriched line ────────────────────────────────────────

  function getPriceStatus(line: EnrichedBudgetLine): { label: string; color: string } {
    if (!line.marketData) return { label: t('common.noData', 'No data'), color: SemanticColors.textTertiary };
    const pct = line.marketData.percentileVsMarket;
    if (pct <= 40) return { label: t('budget.belowMarket', 'Below market'), color: SemanticColors.feedbackSuccess };
    if (pct <= 60) return { label: t('budget.marketRate', 'Market rate'), color: SemanticColors.feedbackWarning };
    return { label: 'Boven markt', color: SemanticColors.feedbackError };
  }

  function getLineDelta(line: EnrichedBudgetLine): { value: number; color: string } {
    if (!line.marketData)
      return { value: 0, color: SemanticColors.textTertiary };
    const delta =
      line.marketData.marketAvg > 0
        ? ((line.unitRate - line.marketData.marketAvg) / line.marketData.marketAvg) * 100
        : 0;
    if (delta <= -5) return { value: delta, color: SemanticColors.feedbackSuccess };
    if (delta <= 5) return { value: delta, color: SemanticColors.feedbackWarning };
    return { value: delta, color: SemanticColors.feedbackError };
  }

  // =========================================================================
  // TAB 1: OVERZICHT (combines old overview + top impact)
  // =========================================================================

  const renderOverview = () => (
    <>
      {/* Hero card — hidden when embedded in CFO */}
      {!embedded && (
        <View style={styles.card}>
          <View style={styles.heroHeader}>
            <View style={[styles.heroBadge, { backgroundColor: ACCENT }]}>
              <Ionicons name="calculator" size={24} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Budget Optimalisatie</Text>
              <Text style={styles.heroSubtitle} numberOfLines={1}>
                {projectName}
              </Text>
            </View>
            {activeScenario && approvedSavings > 0 && (
              <Pressable
                style={[styles.exportButton, { borderColor: ACCENT }]}
                onPress={handleExport}
              >
                <Ionicons name="download-outline" size={16} color={ACCENT} />
                <Text style={[styles.exportButtonText, { color: ACCENT }]}>Exporteer</Text>
              </Pressable>
            )}
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{fmtCompact(totalBudget)}</Text>
              <Text style={styles.heroStatLabel}>Totaal budget</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{lineCount}</Text>
              <Text style={styles.heroStatLabel}>Regels</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>8</Text>
              <Text style={styles.heroStatLabel}>Categorieën</Text>
            </View>
          </View>
          <Text style={styles.heroCaption}>
            AI-analyse van {lineCount} begrotingsregels
          </Text>
        </View>
      )}

      {/* Scenario selector — big buttons with savings below */}
      {activeScenario && (
        <View style={styles.scenarioButtonRow}>
          {scenarioList.map((s) => {
            if (!s) return null;
            const meta = scenarioMeta[s.scenario];
            const isActive = selectedScenario === s.scenario;
            return (
              <Pressable
                key={s.scenario}
                style={[
                  styles.scenarioButton,
                  isActive && { backgroundColor: ACCENT, borderColor: ACCENT },
                ]}
                onPress={() => setSelectedScenario(s.scenario)}
              >
                <Ionicons name={meta.icon} size={18} color={isActive ? '#fff' : SemanticColors.textSecondary} />
                <Text style={[styles.scenarioButtonLabel, isActive && { color: Palette.white }]}>
                  {s.label}
                </Text>
                <Text style={[styles.scenarioButtonSaving, isActive && { color: Palette.white }]}>
                  {fmtCompact(Math.round(s.totalSavings))}
                </Text>
                <Text style={[styles.scenarioButtonMeta, isActive && { color: 'rgba(255,255,255,0.7)' }]}>
                  {s.optimizations.length} kansen · {fmtPct(s.savingsPercent)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Integrated category overview with supplier & TCO insights */}
      {activeScenario && (
        <>
          <Text style={styles.sectionTitle}>Besparingskansen</Text>
          {activeScenario.categoryBreakdown.map((cat) => {
            const catOpts = activeScenario.optimizations
              .filter((o) => (o.category || 'Overig') === cat.name)
              .sort((a, b) => b.savings - a.savings);
            const topActions = [...new Set(catOpts.map(o => ACTION_LABELS[o.action] ?? o.action))].slice(0, 3);
            // Match TCO comparisons to this category
            const tcoMatch = tcoSummary?.comparisons.find(
              (c) => cat.name.toLowerCase().includes(c.category.toLowerCase().split(' ')[0]) ||
                     c.category.toLowerCase().includes(cat.name.toLowerCase().split(' ')[0]),
            );
            // Match supplier wins to this category (via optimizations referencing suppliers)
            const catSuppliers = new Set(
              catOpts.map((o) => {
                const line = enrichedLines.find((l) => l.costCode === o.costCode);
                return line?.supplier?.toLowerCase();
              }).filter(Boolean),
            );
            const matchedSupplierWins = supplierNegotiation?.quickWins.filter(
              (w) => catSuppliers.has(w.supplier.toLowerCase()),
            ) ?? [];

            return (
              <View key={cat.name} style={styles.catBarCard}>
                {/* Header: name + total savings */}
                <View style={styles.catBarHeader}>
                  <Text style={styles.catBarName} numberOfLines={1}>{cat.name}</Text>
                  {cat.savings > 0 && (
                    <Text style={styles.catBarSavingsBig}>
                      -{fmtCompact(Math.round(cat.savings))}
                    </Text>
                  )}
                </View>
                {/* Budget line + progress */}
                <View style={styles.catBarBudgetRow}>
                  <Text style={styles.catBarBudgetText}>
                    {fmtCompact(cat.currentTotal)} → {fmtCompact(cat.optimizedTotal)}
                  </Text>
                  {cat.savingsPercent > 0 && (
                    <Text style={styles.catBarPct}>-{fmtPct(cat.savingsPercent)}</Text>
                  )}
                </View>
                <View style={styles.catBarContainer}>
                  <View style={[styles.catBarOptimized, { width: `${cat.currentTotal > 0 ? Math.round((cat.optimizedTotal / cat.currentTotal) * 100) : 100}%` }]} />
                  {cat.savings > 0 && (
                    <View style={[styles.catBarSaved, { width: `${cat.currentTotal > 0 ? Math.round((cat.savings / cat.currentTotal) * 100) : 0}%` }]} />
                  )}
                </View>
                {/* Action types */}
                {topActions.length > 0 && (
                  <Text style={styles.catBarContext}>
                    {topActions.join(' · ')} — {catOpts.length} kansen
                  </Text>
                )}
                {/* Top impact drivers */}
                {catOpts.slice(0, 3).map((opt) => (
                  <View key={opt.costCode} style={styles.catImpactRow}>
                    <Text style={styles.catImpactDesc} numberOfLines={1}>{opt.description}</Text>
                    <Text style={styles.catImpactSaving}>-{fmtCompact(Math.round(opt.savings))}</Text>
                    <View style={[styles.catImpactBadge, { backgroundColor: ACTION_COLORS[opt.action] ?? SemanticColors.textTertiary }]}>
                      <Text style={styles.catImpactBadgeText}>{ACTION_LABELS[opt.action] ?? opt.action}</Text>
                    </View>
                  </View>
                ))}
                {/* TCO match inline */}
                {tcoMatch && (
                  <Pressable
                    style={styles.catInlineInsight}
                    onPress={() => Alert.alert(
                      `TCO: ${tcoMatch.category}`,
                      `${tcoMatch.customerPitch}\n\nAanbeveling: ${tcoMatch.recommendation.name} (${tcoMatch.recommendation.brand})\nTCO/jaar: ${formatCurrency(tcoMatch.recommendation.tcoPerYear)} vs ${formatCurrency(tcoMatch.materials[0].tcoPerYear)} (budget)\n\nBesparing: ${formatCurrency(tcoMatch.savingsVsBudget)}/jaar`,
                    )}
                  >
                    <Ionicons name="calculator" size={13} color={SemanticColors.feedbackInfo} />
                    <Text style={styles.catInlineInsightText} numberOfLines={1}>
                      TCO: {tcoMatch.recommendation.brand} {tcoMatch.recommendation.name}
                    </Text>
                    <Text style={styles.catInlineInsightSaving}>-{formatCurrency(tcoMatch.savingsVsBudget)}/jr</Text>
                  </Pressable>
                )}
                {/* Supplier wins inline */}
                {matchedSupplierWins.map((win) => (
                  <Pressable
                    key={win.supplier}
                    style={styles.catInlineInsight}
                    onPress={() => Alert.alert(
                      `${win.supplier} — Actie`,
                      `${win.action}\n\nGeschatte besparing: ${formatCurrency(win.saving)}/jaar`,
                      [
                        { text: 'Later' },
                        { text: t('budget.contactSupplier', 'Contact supplier'), onPress: () => Alert.alert(t('budget.reminderSet', 'Reminder set'), t('budget.reminderMessage', 'We will remind you to contact {{supplier}}.', { supplier: win.supplier })) },
                      ],
                    )}
                  >
                    <Ionicons name="business" size={13} color="#7C3AED" />
                    <Text style={styles.catInlineInsightText} numberOfLines={1}>
                      {win.supplier}: {win.action}
                    </Text>
                    <Text style={styles.catInlineInsightSaving}>{formatCurrency(win.saving)}/jr</Text>
                  </Pressable>
                ))}
                {catOpts.length === 0 && !tcoMatch && matchedSupplierWins.length === 0 && (
                  <Text style={styles.catBarNoOpts}>Geen optimalisaties gevonden</Text>
                )}
              </View>
            );
          })}

          {/* Unmatched supplier wins — shown as compact rows at the end */}
          {(() => {
            const matchedSupplierNames = new Set<string>();
            activeScenario.categoryBreakdown.forEach((cat) => {
              const catOpts = activeScenario.optimizations.filter((o) => (o.category || 'Overig') === cat.name);
              const catSuppliers = new Set(
                catOpts.map((o) => {
                  const line = enrichedLines.find((l) => l.costCode === o.costCode);
                  return line?.supplier?.toLowerCase();
                }).filter(Boolean),
              );
              supplierNegotiation?.quickWins.forEach((w) => {
                if (catSuppliers.has(w.supplier.toLowerCase())) matchedSupplierNames.add(w.supplier);
              });
            });
            const unmatchedWins = supplierNegotiation?.quickWins.filter((w) => !matchedSupplierNames.has(w.supplier)) ?? [];
            if (unmatchedWins.length === 0) return null;
            return unmatchedWins.map((win) => (
              <Pressable
                key={win.supplier}
                style={styles.catInlineInsightStandalone}
                onPress={() => Alert.alert(
                  `${win.supplier} — Actie`,
                  `${win.action}\n\nGeschatte besparing: ${formatCurrency(win.saving)}/jaar`,
                )}
              >
                <Ionicons name="business" size={14} color="#7C3AED" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.catInlineStandaloneTitle}>{win.supplier}</Text>
                  <Text style={styles.catInlineStandaloneSub}>{win.action}</Text>
                </View>
                <Text style={styles.catInlineInsightSaving}>{formatCurrency(win.saving)}/jr</Text>
              </Pressable>
            ));
          })()}

          {/* Unmatched TCO comparisons */}
          {(() => {
            const matchedTcoCategories = new Set<string>();
            activeScenario.categoryBreakdown.forEach((cat) => {
              const match = tcoSummary?.comparisons.find(
                (c) => cat.name.toLowerCase().includes(c.category.toLowerCase().split(' ')[0]) ||
                       c.category.toLowerCase().includes(cat.name.toLowerCase().split(' ')[0]),
              );
              if (match) matchedTcoCategories.add(match.category);
            });
            const unmatchedTco = tcoSummary?.comparisons.filter((c) => !matchedTcoCategories.has(c.category)) ?? [];
            if (unmatchedTco.length === 0) return null;
            return unmatchedTco.map((comp) => (
              <Pressable
                key={comp.category}
                style={styles.catInlineInsightStandalone}
                onPress={() => Alert.alert(
                  `TCO: ${comp.category}`,
                  `${comp.customerPitch}\n\nAanbeveling: ${comp.recommendation.name} (${comp.recommendation.brand})\nBesparing: ${formatCurrency(comp.savingsVsBudget)}/jaar`,
                )}
              >
                <Ionicons name="calculator" size={14} color={SemanticColors.feedbackInfo} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.catInlineStandaloneTitle}>{comp.category}</Text>
                  <Text style={styles.catInlineStandaloneSub}>{comp.recommendation.brand} {comp.recommendation.name} — beste TCO</Text>
                </View>
                <Text style={styles.catInlineInsightSaving}>-{formatCurrency(comp.savingsVsBudget)}/jr</Text>
              </Pressable>
            ));
          })()}
        </>
      )}

      {/* Upload button */}
      <Pressable
        style={[styles.secondaryButton, { borderColor: ACCENT }]}
        onPress={() => router.push('/(modals)/ingestion' as any)}
      >
        <Ionicons
          name="cloud-upload"
          size={18}
          color={ACCENT}
        />
        <Text style={[styles.secondaryButtonText, { color: ACCENT }]}>
          {embedded ? 'Begroting analyseren' : 'Nieuwe begroting uploaden'}
        </Text>
      </Pressable>
      {/* Export button (embedded) */}
      {embedded && activeScenario && approvedSavings > 0 && (
        <Pressable
          style={[styles.secondaryButton, { borderColor: SemanticColors.feedbackSuccess, marginTop: 0 }]}
          onPress={handleExport}
        >
          <Ionicons name="download-outline" size={18} color={SemanticColors.feedbackSuccess} />
          <Text style={[styles.secondaryButtonText, { color: SemanticColors.feedbackSuccess }]}>
            Exporteer goedgekeurde besparingen
          </Text>
        </Pressable>
      )}

      {/* Inkoop kansen link */}
      <Pressable
        style={[styles.card, styles.enrichLinkCard]}
        onPress={() => router.push('/contractor/purchase-orders' as any)}
      >
        <View style={[styles.enrichIconBox, { backgroundColor: SemanticColors.feedbackSuccess + '15' }]}>
          <Ionicons name="cart" size={18} color={SemanticColors.feedbackSuccess} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.enrichItemTitle}>Bekijk alle inkooptips</Text>
          <Text style={styles.enrichItemSubtitle}>Prijsalerts, trends & besteladvies</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
      </Pressable>

      {/* Benchmarking link */}
      <Pressable
        style={[styles.card, styles.enrichLinkCard]}
        onPress={() => router.push('/contractor/market-prices' as any)}
      >
        <View style={[styles.enrichIconBox, { backgroundColor: ACCENT + '15' }]}>
          <Ionicons name="bar-chart" size={18} color={ACCENT} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.enrichItemTitle}>Kostenbenchmarking</Text>
          <Text style={styles.enrichItemSubtitle}>Kostenvergelijking tussen projecten</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
      </Pressable>
    </>
  );

  // =========================================================================
  // TAB 2: DETAILS (combines old categories accordion + lines search)
  // =========================================================================

  const renderDetails = () => {
    if (!activeScenario) return null;

    return (
      <>
        {/* Search bar — compact */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={SemanticColors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Zoek op code, omschrijving of categorie..."
            placeholderTextColor={SemanticColors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={SemanticColors.textTertiary} />
            </Pressable>
          )}
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Pressable
            style={[styles.chip, !filterAction && [styles.chipActive, { backgroundColor: ACCENT }]]}
            onPress={() => setFilterAction(null)}
          >
            <Text style={[styles.chipText, !filterAction && styles.chipTextActive]}>Alle</Text>
          </Pressable>
          {actionTypes.map((type) => (
            <Pressable
              key={type}
              style={[styles.chip, filterAction === type && { backgroundColor: ACTION_COLORS[type] ?? SemanticColors.textTertiary }]}
              onPress={() => setFilterAction(filterAction === type ? null : type)}
            >
              <Text style={[styles.chipText, filterAction === type && { color: Palette.white }]}>
                {ACTION_LABELS[type] ?? type}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Integrated category sections with optimizations + lines */}
        {filteredCategories.map((cat) => {
          const isExpanded = expandedCatName === cat.name;
          let catOptimizations = activeScenario.optimizations.filter(
            (o) => (o.category || 'Overig') === cat.name,
          );
          if (filterAction) catOptimizations = catOptimizations.filter((o) => o.action === filterAction);
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            catOptimizations = catOptimizations.filter(
              (o) => o.costCode.toLowerCase().includes(q) || o.description.toLowerCase().includes(q) || cat.name.toLowerCase().includes(q),
            );
          }
          const catLines = linesByCategory.get(cat.name) ?? [];

          return (
            <View key={cat.name}>
              {/* Category header — pressable to expand */}
              <Pressable
                style={styles.detailCatHeader}
                onPress={() => setExpandedCatName(isExpanded ? null : cat.name)}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.detailCatName}>{cat.name}</Text>
                    {catOptimizations.length > 0 && (
                      <View style={styles.catCountBadge}>
                        <Text style={styles.catCountText}>{catOptimizations.length}</Text>
                      </View>
                    )}
                    <Text style={styles.detailCatLineCount}>{catLines.length} regels</Text>
                  </View>
                  <Text style={styles.detailCatSub}>
                    {fmtCompact(cat.currentTotal)} → {fmtCompact(cat.optimizedTotal)}
                    {cat.savings > 0 ? `  ·  -${fmtCompact(Math.round(cat.savings))} (${fmtPct(cat.savingsPercent)})` : ''}
                  </Text>
                </View>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={SemanticColors.textTertiary}
                />
              </Pressable>

              {/* Expanded content: optimizations first, then lines */}
              {isExpanded && (
                <View style={styles.detailCatContent}>
                  {/* Optimizations */}
                  {catOptimizations.length > 0 && (
                    <View style={styles.detailOptSection}>
                      <Text style={styles.detailOptTitle}>
                        Optimalisaties ({catOptimizations.length})
                      </Text>
                      {catOptimizations.map((opt) => {
                        const isApproved = approvals.get(opt.costCode) === true;
                        const isRejected = approvals.get(opt.costCode) === false;
                        return (
                          <View
                            key={opt.costCode}
                            style={[
                              styles.detailOptRow,
                              isApproved && { borderLeftColor: SemanticColors.feedbackSuccess, borderLeftWidth: 2 },
                              isRejected && { opacity: 0.5 },
                            ]}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={styles.detailOptDesc} numberOfLines={1}>{opt.description}</Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                <Text style={styles.detailOptCode}>{opt.costCode}</Text>
                                <View style={[styles.actionBadgeSmall, { backgroundColor: ACTION_COLORS[opt.action] ?? SemanticColors.textTertiary }]}>
                                  <Text style={styles.actionBadgeSmallText}>{ACTION_LABELS[opt.action] ?? opt.action}</Text>
                                </View>
                              </View>
                            </View>
                            <Text style={styles.detailOptSaving}>-{fmtCompact(Math.round(opt.savings))}</Text>
                            <Pressable onPress={() => approveOptimization(opt.costCode)}>
                              <Ionicons name="checkmark-circle" size={18} color={isApproved ? SemanticColors.feedbackSuccess : SemanticColors.textTertiary} />
                            </Pressable>
                            <Pressable onPress={() => rejectOptimization(opt.costCode)}>
                              <Ionicons name="close-circle" size={18} color={isRejected ? SemanticColors.feedbackError : SemanticColors.textTertiary} />
                            </Pressable>
                          </View>
                        );
                      })}
                    </View>
                  )}
                  {/* Budget lines in this category — compact rows */}
                  {catLines.map((line) => {
                    const status = getPriceStatus(line);
                    return (
                      <Pressable
                        key={line.id}
                        style={styles.detailLineRow}
                        onPress={() => setDetailLine(line)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.detailLineDesc} numberOfLines={1}>{line.description}</Text>
                          <Text style={styles.detailLineMeta}>
                            {line.costCode} · {fmtDec(line.unitRate)}/{line.unit} · {line.quantity} {line.unit}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.detailLineTotal}>{fmtCompact(Math.round(line.total))}</Text>
                          <View style={[styles.detailLineStatus, { backgroundColor: status.color + '15' }]}>
                            <View style={[styles.riskDot, { backgroundColor: status.color, width: 5, height: 5, borderRadius: 3 }]} />
                            <Text style={[styles.detailLineStatusText, { color: status.color }]}>{status.label}</Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        {filteredCategories.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="document-text" size={40} color={SemanticColors.textTertiary} />
            <Text style={styles.emptyStateText}>Geen resultaten gevonden</Text>
          </View>
        )}
      </>
    );
  };

  // =========================================================================
  // LINE DETAIL MODAL
  // =========================================================================

  const renderDetailModal = () => {
    if (!detailLine) return null;

    const status = getPriceStatus(detailLine);
    const delta = getLineDelta(detailLine);
    const md = detailLine.marketData;
    const sp = detailLine.savingsPotential;

    return (
      <Modal
        visible={!!detailLine}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailLine(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{detailLine.description}</Text>
                <Text style={styles.modalSubtitle}>
                  {detailLine.costCode} — {detailLine.category}
                </Text>
              </View>
              <Pressable onPress={() => setDetailLine(null)}>
                <Ionicons
                  name="close"
                  size={24}
                  color={SemanticColors.textPrimary}
                />
              </Pressable>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Pricing */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Prijsinformatie</Text>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Tarief</Text>
                  <Text style={styles.modalValue}>
                    {fmtDec(detailLine.unitRate)}/{detailLine.unit}
                  </Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Hoeveelheid</Text>
                  <Text style={styles.modalValue}>
                    {detailLine.quantity.toLocaleString(undefined)} {detailLine.unit}
                  </Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Totaal</Text>
                  <Text style={[styles.modalValue, { fontWeight: '700' }]}>
                    {fmt(Math.round(detailLine.total))}
                  </Text>
                </View>
                {detailLine.supplier && (
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Leverancier</Text>
                    <Text style={styles.modalValue}>{detailLine.supplier}</Text>
                  </View>
                )}
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Marktpositie</Text>
                  <View style={[styles.statusBadge, { backgroundColor: status.color + '22' }]}>
                    <View style={[styles.riskDot, { backgroundColor: status.color }]} />
                    <Text style={[styles.statusBadgeText, { color: status.color }]}>
                      {status.label}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Market sources */}
              {md && md.sources.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Marktbronnen</Text>
                  {md.sources.map((src, i) => (
                    <View key={i} style={styles.modalSourceRow}>
                      <Text style={styles.modalSourceName}>{src.name}</Text>
                      <Text style={styles.modalSourcePrice}>
                        {fmtDec(src.price)}/{src.unit}
                      </Text>
                      <Text style={styles.modalSourceDate}>
                        {src.lastUpdated}
                      </Text>
                    </View>
                  ))}
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Marktgemiddelde</Text>
                    <Text style={styles.modalValue}>
                      {fmtDec(md.marketAvg)}
                    </Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Markt bereik</Text>
                    <Text style={styles.modalValue}>
                      {fmtDec(md.marketLow)} — {fmtDec(md.marketHigh)}
                    </Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Trend</Text>
                    <Text style={styles.modalValue}>
                      {md.trend === 'rising'
                        ? 'Stijgend'
                        : md.trend === 'falling'
                          ? 'Dalend'
                          : 'Stabiel'}
                    </Text>
                  </View>
                </View>
              )}

              {/* Savings potential */}
              {sp && sp.actions.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>
                    Besparingspotentieel
                  </Text>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Huidig totaal</Text>
                    <Text style={styles.modalValue}>
                      {fmt(Math.round(sp.currentTotal))}
                    </Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Geoptimaliseerd</Text>
                    <Text
                      style={[
                        styles.modalValue,
                        { color: SemanticColors.feedbackSuccess },
                      ]}
                    >
                      {fmt(Math.round(sp.optimizedTotal))}
                    </Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Besparing</Text>
                    <Text
                      style={[
                        styles.modalValue,
                        { color: SemanticColors.feedbackSuccess, fontWeight: '700' },
                      ]}
                    >
                      -{fmt(Math.round(sp.savingsAmount))} ({fmtPct(sp.savingsPercent)})
                    </Text>
                  </View>
                  <Text style={styles.modalActionsTitle}>Acties:</Text>
                  {sp.actions.map((action, i) => (
                    <View key={i} style={styles.modalActionItem}>
                      <View
                        style={[
                          styles.actionBadgeSmall,
                          {
                            backgroundColor:
                              ACTION_COLORS[action.type] ??
                              SemanticColors.textTertiary,
                          },
                        ]}
                      >
                        <Text style={styles.actionBadgeSmallText}>
                          {ACTION_LABELS[action.type] ?? action.label}
                        </Text>
                      </View>
                      <Text style={styles.modalActionDesc}>
                        {action.description}
                      </Text>
                      <Text style={styles.modalActionSaving}>
                        Besparing: {fmt(Math.round(action.estimatedSaving))} |
                        Zekerheid: {Math.round(action.confidence * 100)}% |
                        Risico: {action.risk === 'low' ? 'Laag' : action.risk === 'medium' ? 'Middel' : 'Hoog'}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* TCO match — if category matches */}
              {(() => {
                const tcoMatch = tcoSummary?.comparisons.find(
                  (c) => detailLine.category.toLowerCase().includes(c.category.toLowerCase().split(' ')[0]),
                );
                if (!tcoMatch) return null;
                return (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>TCO Vergelijking</Text>
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>Aanbevolen alternatief</Text>
                      <Text style={styles.modalValue}>{tcoMatch.recommendation.brand} {tcoMatch.recommendation.name}</Text>
                    </View>
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>TCO/jaar (aanbevolen)</Text>
                      <Text style={[styles.modalValue, { color: SemanticColors.feedbackSuccess }]}>{formatCurrency(tcoMatch.recommendation.tcoPerYear)}</Text>
                    </View>
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>TCO/jaar (budget)</Text>
                      <Text style={styles.modalValue}>{formatCurrency(tcoMatch.materials[0].tcoPerYear)}</Text>
                    </View>
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>Jaarlijkse besparing</Text>
                      <Text style={[styles.modalValue, { color: SemanticColors.feedbackSuccess, fontWeight: '700' }]}>{formatCurrency(tcoMatch.savingsVsBudget)}/jr</Text>
                    </View>
                  </View>
                );
              })()}

              {/* Supplier leverage — if supplier matches */}
              {(() => {
                const supplierMatch = supplierNegotiation?.suppliers.find(
                  (s) => detailLine.supplier && s.supplierName.toLowerCase().includes(detailLine.supplier.toLowerCase().split(' ')[0]),
                );
                if (!supplierMatch) return null;
                return (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Leverancier Leverage</Text>
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>Huidige korting</Text>
                      <Text style={styles.modalValue}>{supplierMatch.currentDiscount}%</Text>
                    </View>
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>Potentiële korting</Text>
                      <Text style={[styles.modalValue, { color: SemanticColors.feedbackSuccess }]}>{supplierMatch.potentialDiscount}%</Text>
                    </View>
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>Leverage score</Text>
                      <Text style={[styles.modalValue, { color: ACCENT }]}>{supplierMatch.leverageScore}/100</Text>
                    </View>
                    <View style={[styles.aiRecommendation, { marginTop: Spacing.xs }]}>
                      <Ionicons name="bulb" size={14} color="#7C3AED" />
                      <Text style={styles.aiRecommendationText}>{supplierMatch.negotiationTip}</Text>
                    </View>
                  </View>
                );
              })()}

              {/* AI Recommendation */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>AI Aanbeveling</Text>
                <View style={styles.aiRecommendation}>
                  <Ionicons
                    name="sparkles"
                    size={16}
                    color={ACCENT}
                  />
                  <Text style={styles.aiRecommendationText}>
                    {sp && sp.actions.length > 0
                      ? `Op basis van ${md?.sources.length ?? 0} marktbronnen adviseert Vasco om ${sp.actions[0].label.toLowerCase()} als primaire actie. Verwachte besparing: ${fmt(Math.round(sp.savingsAmount))} (${fmtPct(sp.savingsPercent)}).`
                      : md
                        ? `De huidige prijs is ${status.label.toLowerCase()} (percentiel ${md.percentileVsMarket}). Geen directe optimalisaties aanbevolen.`
                        : 'Onvoldoende marktdata beschikbaar voor deze post. Overweeg handmatige prijsverificatie.'}
                  </Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // =========================================================================
  // RENDER — everything scrolls together
  // =========================================================================

  return (
    <View style={styles.container}>
      {/* Header — hidden when embedded */}
      {!embedded && (
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={[styles.headerAccent, { backgroundColor: ACCENT }]} />
            <Text style={styles.headerTitle}>Budget Optimizer</Text>
          </View>
          {activeScenario && (
            <Text style={styles.headerSubtitle}>
              {activeScenario.label} — {fmt(Math.round(activeScenario.totalSavings))} besparing ({fmtPct(activeScenario.savingsPercent)})
            </Text>
          )}
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Project dropdown selector */}
        {embedded && (
          <View style={styles.projectDropdownWrapper}>
            <Pressable
              style={styles.projectDropdown}
              onPress={() => setShowProjectDropdown(!showProjectDropdown)}
            >
              <Ionicons name="business" size={14} color={ACCENT} />
              <Text style={styles.projectDropdownText} numberOfLines={1}>
                {MOCK_PROJECTS[selectedProjectIdx]}
              </Text>
              <Ionicons
                name={showProjectDropdown ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={SemanticColors.textTertiary}
              />
            </Pressable>
            {showProjectDropdown && (
              <View style={styles.projectDropdownList}>
                {MOCK_PROJECTS.map((name, idx) => (
                  <Pressable
                    key={name}
                    style={[
                      styles.projectDropdownItem,
                      idx === selectedProjectIdx && { backgroundColor: ACCENT + '12' },
                    ]}
                    onPress={() => {
                      setSelectedProjectIdx(idx);
                      setShowProjectDropdown(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.projectDropdownItemText,
                        idx === selectedProjectIdx && { color: ACCENT, fontWeight: '700' },
                      ]}
                    >
                      {name}
                    </Text>
                    {idx === selectedProjectIdx && (
                      <Ionicons name="checkmark" size={16} color={ACCENT} />
                    )}
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Tab Bar — now INSIDE ScrollView */}
        <View style={styles.tabBar}>
          <TabButton
            label="Overzicht"
            icon="grid"
            isActive={activeTab === 'overview'}
            onPress={() => setActiveTab('overview')}
            activeColor={ACCENT}
          />
          <TabButton
            label="Details"
            icon="list"
            isActive={activeTab === 'details'}
            onPress={() => setActiveTab('details')}
            activeColor={ACCENT}
          />
        </View>

        {/* Tab content */}
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'details' && renderDetails()}
      </ScrollView>

      {/* Detail modal */}
      {renderDetailModal()}
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfaceBackground,
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: TYPE.sectionSize,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    marginTop: Spacing.sm,
  },
  loadingSubtext: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textTertiary,
  },

  // Project dropdown selector
  projectDropdownWrapper: {
    zIndex: 10,
    marginBottom: 4,
  },
  projectDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  projectDropdownText: {
    flex: 1,
    fontSize: TYPE.bodySize - 1,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  projectDropdownList: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    marginTop: 4,
    overflow: 'hidden',
  },
  projectDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  projectDropdownItemText: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textPrimary,
  },

  // Header
  header: {
    paddingHorizontal: SafeArea.side,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  headerAccent: {
    width: 4,
    height: 20,
    borderRadius: 2,
  },
  headerTitle: {
    fontSize: TYPE.sectionSize,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  headerSubtitle: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
    marginTop: 4,
    marginLeft: 12,
  },

  // Tab Bar — compressed padding
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 0,
    paddingVertical: Spacing.xs,
    backgroundColor: SemanticColors.surfaceBackground,
    gap: 6,
    marginBottom: Spacing.xs,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: RADIUS.sm,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  tabButtonActive: {
    backgroundColor: DIRECTOR_COLOR,
  },
  tabButtonText: {
    fontSize: TYPE.labelSize,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  tabButtonTextActive: {
    color: Palette.white,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingHorizontal: SafeArea.side,
    gap: Spacing.sm,
    paddingBottom: SafeArea.bottom + Spacing.xl,
  },

  // Card pattern
  card: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    padding: Spacing.lg,
  },

  // Section title
  sectionTitle: {
    fontSize: TYPE.titleSize,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    marginTop: Spacing.xs,
    marginBottom: 6,
  },

  // ── Hero Card ─────────────────────────────────────────────────────────────
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  heroBadge: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: TYPE.sectionSize,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  heroSubtitle: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatValue: {
    fontSize: TYPE.sectionSize,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  heroStatLabel: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  heroStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: SemanticColors.borderDefault,
  },
  heroCaption: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textTertiary,
    textAlign: 'center',
    marginTop: 4,
  },

  // ── Export Button ────────────────────────────────────────────────────────
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
  },
  exportButtonText: {
    fontSize: TYPE.labelSize,
    fontWeight: '600',
  },

  // ── Scenario Buttons — big with savings below ────────────────────────────
  scenarioButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scenarioButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: SemanticColors.borderDefault,
    backgroundColor: SemanticColors.surfacePrimary,
    gap: 2,
  },
  scenarioButtonLabel: {
    fontSize: TYPE.labelSize,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    marginTop: 2,
  },
  scenarioButtonSaving: {
    fontSize: TYPE.titleSize,
    fontWeight: '800',
    color: SemanticColors.feedbackSuccess,
  },
  scenarioButtonMeta: {
    fontSize: TYPE.tinySize - 2,
    color: SemanticColors.textTertiary,
    marginTop: 1,
  },
  riskDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // (summaryCompact removed)

  // ── Category Bars (Overview) — tightened ───────────────────────────────────
  catBarCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    padding: 12,
  },
  catBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  catBarName: {
    fontSize: TYPE.captionSize,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    flex: 1,
  },
  catBarSavingsBig: {
    fontSize: TYPE.bodySize - 1,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
  },
  catBarBudgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  catBarBudgetText: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textSecondary,
  },
  catBarPct: {
    fontSize: TYPE.tinySize,
    fontWeight: '600',
    color: SemanticColors.feedbackSuccess,
  },
  catBarNoOpts: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textTertiary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  // Inline insight rows (TCO/supplier inside category cards)
  catInlineInsight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.sm,
    marginTop: 4,
  },
  catInlineInsightText: {
    flex: 1,
    fontSize: TYPE.tinySize,
    color: SemanticColors.textSecondary,
  },
  catInlineInsightSaving: {
    fontSize: TYPE.tinySize,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
  },
  // Standalone insight rows (unmatched supplier/TCO after categories)
  catInlineInsightStandalone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  catInlineStandaloneTitle: {
    fontSize: TYPE.labelSize,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  catInlineStandaloneSub: {
    fontSize: TYPE.tinySize - 1,
    color: SemanticColors.textSecondary,
    marginTop: 1,
  },
  catBarContainer: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    backgroundColor: SemanticColors.surfaceSecondary,
    overflow: 'hidden',
    marginBottom: 4,
  },
  catBarOptimized: {
    height: '100%',
    backgroundColor: SemanticColors.feedbackSuccess,
    borderRadius: 3,
  },
  catBarSaved: {
    height: '100%',
    backgroundColor: SemanticColors.feedbackSuccessBg,
  },
  // (catBarFooter removed — budget info now in catBarBudgetRow)
  catBarContext: {
    fontSize: TYPE.tinySize - 1,
    color: SemanticColors.textTertiary,
    marginBottom: 3,
  },

  // ── Inline impact rows (under category bars) ──────────────────────────────
  catImpactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 4,
    paddingLeft: 2,
  },
  // (catImpactCode removed)
  catImpactDesc: {
    flex: 1,
    fontSize: TYPE.tinySize,
    color: SemanticColors.textSecondary,
  },
  catImpactSaving: {
    fontSize: TYPE.tinySize,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
  },
  catImpactBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  catImpactBadgeText: {
    fontSize: TYPE.tinySize - 2,
    fontWeight: '600',
    color: Palette.white,
  },

  // ── Secondary Button ──────────────────────────────────────────────────────
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: DIRECTOR_COLOR,
    marginTop: Spacing.md,
    minHeight: 48,
  },
  secondaryButtonText: {
    fontSize: TYPE.bodySize - 1,
    fontWeight: '600',
    color: DIRECTOR_COLOR,
  },

  // ── Impact Tab ────────────────────────────────────────────────────────────
  impactHeaderText: {
    fontSize: TYPE.bodySize,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    lineHeight: 22,
  },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingVertical: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.lg,
    backgroundColor: SemanticColors.surfaceSecondary,
    minHeight: 36,
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: DIRECTOR_COLOR,
  },
  chipText: {
    fontSize: TYPE.labelSize,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  chipTextActive: {
    color: Palette.white,
  },

  // Optimization card
  optRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  optCodeBadge: {
    backgroundColor: SemanticColors.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm - 2,
  },
  optCodeText: {
    fontSize: TYPE.tinySize,
    fontWeight: '700',
    color: SemanticColors.textSecondary,
  },
  optDescription: {
    fontSize: TYPE.bodySize,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    lineHeight: 20,
  },
  optCategory: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  optPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.xs,
  },
  optPrice: {
    fontSize: TYPE.bodySize,
    fontWeight: '600',
  },
  optSavingsBadge: {
    fontSize: TYPE.labelSize,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
    marginLeft: 'auto',
  },

  // Action badge
  optMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  actionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  actionBadgeText: {
    fontSize: TYPE.tinySize,
    fontWeight: '600',
    color: Palette.white,
  },
  actionBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm - 2,
  },
  actionBadgeSmallText: {
    fontSize: TYPE.tinySize - 1,
    fontWeight: '600',
    color: Palette.white,
  },

  // Confidence bar
  confidenceBarContainer: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  confidenceBar: {
    height: '100%',
    borderRadius: 3,
  },
  confidenceText: {
    fontSize: TYPE.tinySize,
    fontWeight: '600',
    color: SemanticColors.textTertiary,
    width: 32,
    textAlign: 'right',
  },

  // Expanded area
  optExpanded: {
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  optReasoning: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
    lineHeight: 18,
  },
  optSourcesList: {
    marginTop: Spacing.xs,
  },
  optSourcesLabel: {
    fontSize: TYPE.labelSize,
    fontWeight: '600',
    color: SemanticColors.textTertiary,
    marginBottom: 4,
  },
  optSourceItem: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textTertiary,
    marginLeft: Spacing.xs,
  },

  // Approve/reject
  optActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.xs,
    marginTop: 4,
  },
  optActionButton: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.surfaceSecondary,
  },

  // ── Categories Tab — compressed ─────────────────────────────────────────
  catAccordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  catAccordionName: {
    fontSize: TYPE.bodySize - 1,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  catAccordionSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  catAccordionSub: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textSecondary,
  },
  catAccordionSavings: {
    fontSize: TYPE.tinySize,
    fontWeight: '600',
  },
  catCountBadge: {
    backgroundColor: SemanticColors.feedbackSuccess + '20',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: RADIUS.sm - 2,
    minWidth: 18,
    alignItems: 'center',
  },
  catCountText: {
    fontSize: TYPE.tinySize - 2,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
  },
  miniBarContainer: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: SemanticColors.surfaceSecondary,
    overflow: 'hidden',
  },
  miniBar: {
    height: '100%',
    borderRadius: 3,
  },
  catLineCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    padding: 8,
    marginLeft: 12,
  },
  catLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  catLineCode: {
    fontSize: TYPE.tinySize - 1,
    fontWeight: '700',
    color: SemanticColors.textTertiary,
    width: 48,
  },
  catLineDesc: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textPrimary,
    flex: 1,
  },
  catLineSaving: {
    fontSize: TYPE.labelSize,
    fontWeight: '600',
    color: SemanticColors.feedbackSuccess,
    flex: 1,
  },

  // ── Details Tab — integrated categories + lines ──────────────────────────
  detailCatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    padding: 10,
    gap: 8,
  },
  detailCatName: {
    fontSize: TYPE.bodySize - 1,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  detailCatLineCount: {
    fontSize: TYPE.tinySize - 1,
    color: SemanticColors.textTertiary,
    marginLeft: 'auto',
  },
  detailCatSub: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  detailCatContent: {
    marginLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: SemanticColors.borderDefault,
    paddingLeft: 8,
    gap: 2,
    marginBottom: 4,
  },
  detailOptSection: {
    marginBottom: 2,
  },
  detailOptTitle: {
    fontSize: TYPE.tinySize,
    fontWeight: '600',
    color: SemanticColors.feedbackSuccess,
    paddingVertical: 4,
  },
  detailOptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: SemanticColors.feedbackSuccessBg,
    borderRadius: RADIUS.sm,
    marginBottom: 2,
  },
  detailOptDesc: {
    fontSize: TYPE.labelSize,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  detailOptCode: {
    fontSize: TYPE.tinySize - 1,
    fontWeight: '600',
    color: SemanticColors.textTertiary,
  },
  detailOptSaving: {
    fontSize: TYPE.labelSize,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
  },
  detailLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault + '40',
  },
  detailLineDesc: {
    fontSize: TYPE.labelSize,
    fontWeight: '500',
    color: SemanticColors.textPrimary,
  },
  detailLineMeta: {
    fontSize: TYPE.tinySize - 1,
    color: SemanticColors.textTertiary,
    marginTop: 1,
  },
  detailLineTotal: {
    fontSize: TYPE.labelSize,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  detailLineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 2,
  },
  detailLineStatusText: {
    fontSize: TYPE.tinySize - 2,
    fontWeight: '600',
  },

  // ── Lines Tab (legacy — for modal references) ──────────────────────────
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textPrimary,
    padding: 0,
  },
  linesCount: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textTertiary,
    fontWeight: '600',
  },
  lineCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  lineCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  lineCodeBadge: {
    backgroundColor: SemanticColors.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm - 2,
  },
  lineCodeText: {
    fontSize: TYPE.tinySize,
    fontWeight: '700',
    color: SemanticColors.textSecondary,
    letterSpacing: 0.3,
  },
  lineCardCategory: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textTertiary,
    flex: 1,
  },
  lineCardDesc: {
    fontSize: TYPE.bodySize,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    lineHeight: 20,
  },
  lineCardPrices: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.sm,
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  linePriceCol: {
    flex: 1,
  },
  linePriceLabel: {
    fontSize: TYPE.tinySize - 1,
    fontWeight: '600',
    color: SemanticColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  linePriceValue: {
    fontSize: TYPE.bodySize - 1,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  linePriceUnit: {
    fontSize: TYPE.tinySize,
    fontWeight: '400',
    color: SemanticColors.textTertiary,
  },
  lineCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  lineStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  lineStatusText: {
    fontSize: TYPE.tinySize,
    fontWeight: '600',
  },
  lineDeltaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  lineDeltaText: {
    fontSize: TYPE.tinySize,
    fontWeight: '700',
  },
  lineSavingHint: {
    fontSize: TYPE.tinySize,
    fontWeight: '600',
    color: SemanticColors.feedbackSuccess,
    marginLeft: 'auto',
  },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    padding: Spacing.xl,
  },
  emptyStateText: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textTertiary,
    textAlign: 'center',
  },
  emptyStateTextSmall: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textTertiary,
    textAlign: 'center',
  },

  // ── Enrichment sections (supplier/TCO/links) ────────────────────────────
  enrichSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: Spacing.sm,
  },
  enrichSectionBadgeSuccess: {
    fontSize: TYPE.labelSize,
    fontWeight: '600',
    color: SemanticColors.feedbackSuccess,
  },
  enrichSectionCount: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textTertiary,
  },
  enrichRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  enrichIconBox: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enrichItemTitle: {
    fontSize: TYPE.bodySize - 1,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  enrichItemSubtitle: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  enrichSavingText: {
    fontSize: TYPE.bodySize - 1,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
  },
  enrichSavingMeta: {
    fontSize: TYPE.tinySize - 1,
    color: SemanticColors.textTertiary,
  },
  enrichLinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },

  // ── Detail Modal ──────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceOverlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: SemanticColors.surfaceBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: SafeArea.bottom,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.lg,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  modalTitle: {
    fontSize: TYPE.sectionSize,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  modalSubtitle: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  modalSection: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  modalSectionTitle: {
    fontSize: TYPE.bodySize,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    marginBottom: Spacing.sm,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  modalLabel: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
  },
  modalValue: {
    fontSize: TYPE.captionSize,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  statusBadgeText: {
    fontSize: TYPE.labelSize,
    fontWeight: '600',
  },

  // Market sources
  modalSourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: Spacing.xs,
  },
  modalSourceName: {
    flex: 1,
    fontSize: TYPE.labelSize,
    color: SemanticColors.textPrimary,
  },
  modalSourcePrice: {
    fontSize: TYPE.labelSize,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  modalSourceDate: {
    fontSize: TYPE.tinySize - 1,
    color: SemanticColors.textTertiary,
    width: 70,
    textAlign: 'right',
  },

  // Savings modal
  modalActionsTitle: {
    fontSize: TYPE.captionSize,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginTop: Spacing.xs,
    marginBottom: 4,
  },
  modalActionItem: {
    marginBottom: Spacing.sm,
  },
  modalActionDesc: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    marginTop: 4,
    lineHeight: 17,
  },
  modalActionSaving: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textTertiary,
    marginTop: 4,
  },

  // AI recommendation
  aiRecommendation: {
    flexDirection: 'row',
    gap: Spacing.xs,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.sm,
    padding: Spacing.sm,
    alignItems: 'flex-start',
  },
  aiRecommendationText: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textPrimary,
    flex: 1,
    lineHeight: 18,
  },
});

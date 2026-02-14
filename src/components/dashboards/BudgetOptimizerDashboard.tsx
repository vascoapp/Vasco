// =============================================================================
// BUDGET OPTIMIZER DASHBOARD — AI Budget Optimization for Directors
// =============================================================================
// 4-tab dashboard: Overzicht | Top Impact | Categorieën | Regels
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
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
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
type TabView = 'overview' | 'impact' | 'categories' | 'lines';

const DIRECTOR_COLOR = SemanticColors.roleDirector;

// ── Number formatting ───────────────────────────────────────────────────────

const fmt = (n: number) =>
  `€${n.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const fmtDec = (n: number) =>
  `€${n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtPct = (n: number) => `${n.toFixed(1)}%`;

const fmtCompact = (n: number) => {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
  if (n >= 1_000) return `€${(n / 1_000).toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}K`;
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
        size={18}
        color={isActive ? '#fff' : SemanticColors.textSecondary}
      />
      <Text
        style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}
        numberOfLines={1}
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
  const [activeTab, setActiveTab] = useState<TabView>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedOptId, setExpandedOptId] = useState<string | null>(null);
  const [expandedCatName, setExpandedCatName] = useState<string | null>(null);
  const [detailLine, setDetailLine] = useState<EnrichedBudgetLine | null>(null);
  const [filterAction, setFilterAction] = useState<string | null>(null);

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

  const projectName = optimizer.extractionResult?.projectName ?? 'Geen project';
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

  // Filtered enriched lines for Regels tab
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

  // ── Export handler ────────────────────────────────────────────────────────

  const handleExport = useCallback(() => {
    if (!activeScenario) return;
    const approved = activeScenario.optimizations.filter(
      (o) => approvals.get(o.costCode) === true,
    );
    if (approved.length === 0) {
      Alert.alert('Geen goedkeuringen', 'Keur eerst optimalisaties goed voordat je exporteert.');
      return;
    }
    exportBudgetPdf(projectName, activeScenario, approved).catch((err) => {
      Alert.alert('Export mislukt', err instanceof Error ? err.message : 'Onbekende fout');
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
    if (!line.marketData) return { label: 'Geen data', color: SemanticColors.textTertiary };
    const pct = line.marketData.percentileVsMarket;
    if (pct <= 40) return { label: 'Onder markt', color: SemanticColors.feedbackSuccess };
    if (pct <= 60) return { label: 'Marktconform', color: SemanticColors.feedbackWarning };
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
  // TAB 1: OVERZICHT
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

      {/* Scenario selector cards */}
      <Text style={styles.sectionTitle}>Optimalisatie scenario</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scenarioRow}
      >
        {scenarioList.map((s) => {
          if (!s) return null;
          const meta = scenarioMeta[s.scenario];
          const isActive = selectedScenario === s.scenario;
          return (
            <Pressable
              key={s.scenario}
              style={[
                styles.scenarioCard,
                isActive && { borderColor: ACCENT, borderWidth: 2 },
              ]}
              onPress={() => setSelectedScenario(s.scenario)}
            >
              <View style={styles.scenarioHeader}>
                <Ionicons name={meta.icon} size={20} color={isActive ? ACCENT : SemanticColors.textSecondary} />
                <Text
                  style={[
                    styles.scenarioLabel,
                    isActive && { color: ACCENT },
                  ]}
                >
                  {s.label}
                </Text>
              </View>
              <Text style={styles.scenarioSavings}>{fmt(Math.round(s.totalSavings))}</Text>
              <Text style={styles.scenarioSavingsPct}>
                {fmtPct(s.savingsPercent)} besparing
              </Text>
              <View style={styles.scenarioRisk}>
                <View
                  style={[styles.riskDot, { backgroundColor: meta.riskColor }]}
                />
                <Text style={styles.scenarioRiskText}>{meta.riskLabel}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Summary stats */}
      {activeScenario && (
        <View style={styles.card}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatValue}>
                {activeScenario.optimizations.length}
              </Text>
              <Text style={styles.summaryStatLabel}>optimalisaties</Text>
            </View>
            <View style={styles.summaryStatDivider} />
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatValue}>
                {activeScenario.categoryBreakdown.filter((c) => c.savings > 0).length}
              </Text>
              <Text style={styles.summaryStatLabel}>categorieën</Text>
            </View>
            <View style={styles.summaryStatDivider} />
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatValue}>
                {fmtPct(activeScenario.confidenceAvg * 100)}
              </Text>
              <Text style={styles.summaryStatLabel}>gem. zekerheid</Text>
            </View>
          </View>
        </View>
      )}

      {/* Category breakdown */}
      {activeScenario && (
        <>
          <Text style={styles.sectionTitle}>Categorie overzicht</Text>
          {activeScenario.categoryBreakdown.map((cat) => (
            <View key={cat.name} style={styles.card}>
              <View style={styles.catBarHeader}>
                <Text style={styles.catBarName} numberOfLines={1}>
                  {cat.name}
                </Text>
                <Text style={styles.catBarSavings}>
                  {cat.savings > 0 ? `-${fmt(Math.round(cat.savings))}` : '—'}
                </Text>
              </View>
              <View style={styles.catBarContainer}>
                <View
                  style={[
                    styles.catBarOptimized,
                    {
                      width: `${
                        cat.currentTotal > 0
                          ? Math.round(
                              (cat.optimizedTotal / cat.currentTotal) * 100,
                            )
                          : 100
                      }%`,
                    },
                  ]}
                />
                {cat.savings > 0 && (
                  <View
                    style={[
                      styles.catBarSaved,
                      {
                        width: `${
                          cat.currentTotal > 0
                            ? Math.round(
                                (cat.savings / cat.currentTotal) * 100,
                              )
                            : 0
                        }%`,
                      },
                    ]}
                  />
                )}
              </View>
              <View style={styles.catBarFooter}>
                <Text style={styles.catBarFooterText}>
                  {fmtCompact(cat.optimizedTotal)} van {fmtCompact(cat.currentTotal)}
                </Text>
                {cat.savingsPercent > 0 && (
                  <Text
                    style={[
                      styles.catBarFooterText,
                      { color: SemanticColors.feedbackSuccess },
                    ]}
                  >
                    -{fmtPct(cat.savingsPercent)}
                  </Text>
                )}
              </View>
            </View>
          ))}
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
    </>
  );

  // =========================================================================
  // TAB 2: TOP IMPACT
  // =========================================================================

  const renderImpact = () => {
    if (!activeScenario) return null;

    return (
      <>
        {/* Header */}
        <View style={styles.card}>
          <Text style={styles.impactHeaderText}>
            Goedgekeurde besparingen:{' '}
            <Text style={{ color: SemanticColors.feedbackSuccess }}>
              {fmt(Math.round(approvedSavings))}
            </Text>
            {' '}van{' '}
            <Text style={{ color: ACCENT }}>
              {fmt(Math.round(activeScenario.totalSavings))}
            </Text>
          </Text>
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Pressable
            style={[
              styles.chip,
              !filterAction && [styles.chipActive, { backgroundColor: ACCENT }],
            ]}
            onPress={() => setFilterAction(null)}
          >
            <Text
              style={[
                styles.chipText,
                !filterAction && styles.chipTextActive,
              ]}
            >
              Alle
            </Text>
          </Pressable>
          {actionTypes.map((type) => (
            <Pressable
              key={type}
              style={[
                styles.chip,
                filterAction === type && {
                  backgroundColor: ACTION_COLORS[type] ?? SemanticColors.textTertiary,
                },
              ]}
              onPress={() =>
                setFilterAction(filterAction === type ? null : type)
              }
            >
              <Text
                style={[
                  styles.chipText,
                  filterAction === type && { color: '#fff' },
                ]}
              >
                {ACTION_LABELS[type] ?? type}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Optimization cards */}
        {filteredOptimizations.map((opt) => {
          const isExpanded = expandedOptId === opt.costCode;
          const isApproved = approvals.get(opt.costCode) === true;
          const isRejected = approvals.get(opt.costCode) === false;
          const actionColor =
            ACTION_COLORS[opt.action] ?? SemanticColors.textTertiary;

          return (
            <Pressable
              key={opt.costCode}
              style={[
                styles.card,
                isApproved && {
                  borderColor: SemanticColors.feedbackSuccess,
                  borderWidth: 1.5,
                },
                isRejected && { opacity: 0.5 },
              ]}
              onPress={() =>
                setExpandedOptId(isExpanded ? null : opt.costCode)
              }
            >
              <View style={styles.optRow}>
                {/* Cost code badge */}
                <View style={styles.optCodeBadge}>
                  <Text style={styles.optCodeText}>{opt.costCode}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: Spacing.xs }}>
                  <Text style={styles.optDescription} numberOfLines={2}>
                    {opt.description}
                  </Text>
                  <Text style={styles.optCategory}>{opt.category}</Text>
                </View>
              </View>

              {/* Price arrow */}
              <View style={styles.optPriceRow}>
                <Text style={[styles.optPrice, { color: SemanticColors.feedbackError }]}>
                  {fmt(Math.round(opt.currentTotal))}
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={14}
                  color={SemanticColors.textTertiary}
                />
                <Text style={[styles.optPrice, { color: SemanticColors.feedbackSuccess }]}>
                  {fmt(Math.round(opt.suggestedTotal))}
                </Text>
                <Text style={styles.optSavingsBadge}>
                  -{fmtPct(opt.savingsPercent)}
                </Text>
              </View>

              {/* Action badge + confidence bar */}
              <View style={styles.optMetaRow}>
                <View style={[styles.actionBadge, { backgroundColor: actionColor }]}>
                  <Text style={styles.actionBadgeText}>
                    {ACTION_LABELS[opt.action] ?? opt.action}
                  </Text>
                </View>
                <View style={styles.confidenceBarContainer}>
                  <View
                    style={[
                      styles.confidenceBar,
                      {
                        width: `${Math.round(opt.confidence * 100)}%`,
                        backgroundColor: ACCENT,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.confidenceText}>
                  {Math.round(opt.confidence * 100)}%
                </Text>
              </View>

              {/* Expanded area */}
              {isExpanded && (
                <View style={styles.optExpanded}>
                  <Text style={styles.optReasoning}>{opt.reasoning}</Text>
                  {opt.sources.length > 0 && (
                    <View style={styles.optSourcesList}>
                      <Text style={styles.optSourcesLabel}>Bronnen:</Text>
                      {opt.sources.map((src, i) => (
                        <Text key={i} style={styles.optSourceItem}>
                          • {src}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Approve / Reject buttons */}
              <View style={styles.optActions}>
                <Pressable
                  style={[
                    styles.optActionButton,
                    isApproved && {
                      backgroundColor: SemanticColors.feedbackSuccessBg,
                    },
                  ]}
                  onPress={() => approveOptimization(opt.costCode)}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={24}
                    color={
                      isApproved
                        ? SemanticColors.feedbackSuccess
                        : SemanticColors.textTertiary
                    }
                  />
                </Pressable>
                <Pressable
                  style={[
                    styles.optActionButton,
                    isRejected && {
                      backgroundColor: SemanticColors.feedbackErrorBg,
                    },
                  ]}
                  onPress={() => rejectOptimization(opt.costCode)}
                >
                  <Ionicons
                    name="close-circle"
                    size={24}
                    color={
                      isRejected
                        ? SemanticColors.feedbackError
                        : SemanticColors.textTertiary
                    }
                  />
                </Pressable>
              </View>
            </Pressable>
          );
        })}

        {filteredOptimizations.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons
              name="search"
              size={40}
              color={SemanticColors.textTertiary}
            />
            <Text style={styles.emptyStateText}>
              Geen optimalisaties gevonden voor dit filter
            </Text>
          </View>
        )}

        {/* Leverancier Kansen — from supplier negotiation data */}
        {supplierNegotiation && supplierNegotiation.quickWins.length > 0 && (
          <>
            <View style={styles.enrichSectionHeader}>
              <Text style={styles.sectionTitle}>Leverancier Kansen</Text>
              <Text style={styles.enrichSectionBadgeSuccess}>
                €{supplierNegotiation.totalDiscountPotential}/jr potentieel
              </Text>
            </View>
            {supplierNegotiation.quickWins.map((win) => (
              <Pressable
                key={win.supplier}
                style={styles.card}
                onPress={() => Alert.alert(
                  `${win.supplier} \u2014 Actie`,
                  `${win.action}\n\nGeschatte besparing: \u20AC${win.saving}/jaar`,
                  [
                    { text: 'Later' },
                    { text: 'Contact opnemen', onPress: () => Alert.alert('Herinnering ingesteld', `We herinneren je om contact op te nemen met ${win.supplier}.`) },
                  ],
                )}
              >
                <View style={styles.enrichRow}>
                  <View style={[styles.enrichIconBox, { backgroundColor: '#7C3AED15' }]}>
                    <Ionicons name="business" size={18} color="#7C3AED" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.enrichItemTitle}>{win.supplier}</Text>
                    <Text style={styles.enrichItemSubtitle}>{win.action}</Text>
                  </View>
                  <Text style={styles.enrichSavingText}>€{win.saving}/jr</Text>
                </View>
              </Pressable>
            ))}
          </>
        )}

        {/* Inkoop kansen link */}
        <Pressable
          style={[styles.card, styles.enrichLinkCard]}
          onPress={() => router.push('/contractor/purchasing' as any)}
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
      </>
    );
  };

  // =========================================================================
  // TAB 3: CATEGORIEËN
  // =========================================================================

  const renderCategories = () => {
    if (!activeScenario) return null;

    return (
      <>
        {activeScenario.categoryBreakdown.map((cat) => {
          const isExpanded = expandedCatName === cat.name;
          const catOptimizations = activeScenario.optimizations.filter(
            (o) => (o.category || 'Overig') === cat.name,
          );

          return (
            <View key={cat.name}>
              <Pressable
                style={styles.card}
                onPress={() =>
                  setExpandedCatName(isExpanded ? null : cat.name)
                }
              >
                <View style={styles.catAccordionHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.catAccordionName}>{cat.name}</Text>
                      {catOptimizations.length > 0 && (
                        <View style={styles.catCountBadge}>
                          <Text style={styles.catCountText}>
                            {catOptimizations.length}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.catAccordionSubRow}>
                      <Text style={styles.catAccordionSub}>
                        {fmtCompact(cat.currentTotal)} → {fmtCompact(cat.optimizedTotal)}
                      </Text>
                      {cat.savings > 0 && (
                        <Text
                          style={[
                            styles.catAccordionSavings,
                            { color: SemanticColors.feedbackSuccess },
                          ]}
                        >
                          -{fmt(Math.round(cat.savings))} ({fmtPct(cat.savingsPercent)})
                        </Text>
                      )}
                    </View>
                  </View>
                  {/* Mini savings bar */}
                  <View style={styles.miniBarContainer}>
                    <View
                      style={[
                        styles.miniBar,
                        {
                          width: `${
                            cat.currentTotal > 0
                              ? Math.min(
                                  100,
                                  Math.round(
                                    (cat.savings / cat.currentTotal) * 100,
                                  ),
                                )
                              : 0
                          }%`,
                          backgroundColor: SemanticColors.feedbackSuccess,
                        },
                      ]}
                    />
                  </View>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={SemanticColors.textTertiary}
                  />
                </View>
              </Pressable>

              {/* Expanded: lines in this category */}
              {isExpanded &&
                catOptimizations.map((opt) => {
                  const isApproved = approvals.get(opt.costCode) === true;
                  const isRejected = approvals.get(opt.costCode) === false;
                  return (
                    <View
                      key={opt.costCode}
                      style={[
                        styles.catLineCard,
                        isApproved && {
                          borderLeftColor: SemanticColors.feedbackSuccess,
                          borderLeftWidth: 3,
                        },
                        isRejected && { opacity: 0.5 },
                      ]}
                    >
                      <View style={styles.catLineRow}>
                        <Text style={styles.catLineCode}>{opt.costCode}</Text>
                        <Text style={styles.catLineDesc} numberOfLines={1}>
                          {opt.description}
                        </Text>
                      </View>
                      <View style={styles.catLineRow}>
                        <Text style={styles.catLineSaving}>
                          -{fmt(Math.round(opt.savings))}
                        </Text>
                        <View
                          style={[
                            styles.actionBadgeSmall,
                            {
                              backgroundColor:
                                ACTION_COLORS[opt.action] ??
                                SemanticColors.textTertiary,
                            },
                          ]}
                        >
                          <Text style={styles.actionBadgeSmallText}>
                            {ACTION_LABELS[opt.action] ?? opt.action}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 4 }}>
                          <Pressable
                            onPress={() => approveOptimization(opt.costCode)}
                          >
                            <Ionicons
                              name="checkmark-circle"
                              size={18}
                              color={
                                isApproved
                                  ? SemanticColors.feedbackSuccess
                                  : SemanticColors.textTertiary
                              }
                            />
                          </Pressable>
                          <Pressable
                            onPress={() => rejectOptimization(opt.costCode)}
                          >
                            <Ionicons
                              name="close-circle"
                              size={18}
                              color={
                                isRejected
                                  ? SemanticColors.feedbackError
                                  : SemanticColors.textTertiary
                              }
                            />
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  );
                })}

              {isExpanded && catOptimizations.length === 0 && (
                <View style={styles.catLineCard}>
                  <Text style={styles.emptyStateTextSmall}>
                    Geen optimalisaties in deze categorie
                  </Text>
                </View>
              )}
            </View>
          );
        })}

        {/* TCO Vergelijking — from TCO calculator data */}
        {tcoSummary && tcoSummary.comparisons.length > 0 && (
          <>
            <View style={styles.enrichSectionHeader}>
              <Text style={styles.sectionTitle}>TCO Vergelijking</Text>
              <Text style={styles.enrichSectionCount}>
                {tcoSummary.comparisons.length} categorieën
              </Text>
            </View>
            {tcoSummary.comparisons.map((comp) => (
              <Pressable
                key={comp.category}
                style={styles.card}
                onPress={() => Alert.alert(
                  `TCO: ${comp.category}`,
                  `${comp.customerPitch}\n\nAanbeveling: ${comp.recommendation.name} (${comp.recommendation.brand})\nTCO/jaar: \u20AC${comp.recommendation.tcoPerYear} vs \u20AC${comp.materials[0].tcoPerYear} (budget)\n\nBesparing: \u20AC${comp.savingsVsBudget}/jaar`,
                )}
              >
                <View style={styles.enrichRow}>
                  <View style={[styles.enrichIconBox, { backgroundColor: SemanticColors.feedbackInfo + '15' }]}>
                    <Ionicons name="calculator" size={18} color={SemanticColors.feedbackInfo} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.enrichItemTitle}>{comp.category}</Text>
                    <Text style={styles.enrichItemSubtitle}>
                      {comp.recommendation.brand} {comp.recommendation.name} — beste TCO
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.enrichSavingText}>-€{comp.savingsVsBudget}/jr</Text>
                    <Text style={styles.enrichSavingMeta}>vs budget</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </>
        )}

        {/* Benchmarking link */}
        <Pressable
          style={[styles.card, styles.enrichLinkCard]}
          onPress={() => router.push('/contractor/benchmark' as any)}
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
  };

  // =========================================================================
  // TAB 4: REGELS (Line Details)
  // =========================================================================

  const renderLines = () => (
    <>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <Ionicons
          name="search"
          size={18}
          color={SemanticColors.textTertiary}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Zoek op code, omschrijving of categorie..."
          placeholderTextColor={SemanticColors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')}>
            <Ionicons
              name="close-circle"
              size={18}
              color={SemanticColors.textTertiary}
            />
          </Pressable>
        )}
      </View>

      {/* Results count */}
      <Text style={styles.linesCount}>
        {filteredLines.length} regel{filteredLines.length !== 1 ? 's' : ''}
        {searchQuery.length > 0 ? ' gevonden' : ''}
      </Text>

      {/* Line cards */}
      {filteredLines.map((line) => {
        const delta = getLineDelta(line);
        const status = getPriceStatus(line);
        const marketPrice = line.marketData?.marketAvg ?? 0;

        return (
          <Pressable
            key={line.id}
            style={styles.lineCard}
            onPress={() => setDetailLine(line)}
          >
            {/* Header: code + category */}
            <View style={styles.lineCardHeader}>
              <View style={styles.lineCodeBadge}>
                <Text style={styles.lineCodeText}>{line.costCode}</Text>
              </View>
              <Text style={styles.lineCardCategory} numberOfLines={1}>
                {line.category}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={14}
                color={SemanticColors.textTertiary}
                style={{ marginLeft: 'auto' }}
              />
            </View>

            {/* Description */}
            <Text style={styles.lineCardDesc} numberOfLines={2}>
              {line.description}
            </Text>

            {/* Price grid */}
            <View style={styles.lineCardPrices}>
              <View style={styles.linePriceCol}>
                <Text style={styles.linePriceLabel}>Tarief</Text>
                <Text style={styles.linePriceValue}>
                  {fmtDec(line.unitRate)}
                  <Text style={styles.linePriceUnit}>/{line.unit}</Text>
                </Text>
              </View>
              <View style={styles.linePriceCol}>
                <Text style={styles.linePriceLabel}>Totaal</Text>
                <Text style={[styles.linePriceValue, { fontWeight: '700' }]}>
                  {fmt(Math.round(line.total))}
                </Text>
              </View>
              <View style={styles.linePriceCol}>
                <Text style={styles.linePriceLabel}>Markt</Text>
                <Text
                  style={[
                    styles.linePriceValue,
                    marketPrice === 0 && { color: SemanticColors.textTertiary },
                  ]}
                >
                  {marketPrice > 0 ? fmtDec(marketPrice) : '—'}
                </Text>
              </View>
            </View>

            {/* Footer: status + delta + savings */}
            <View style={styles.lineCardFooter}>
              <View
                style={[
                  styles.lineStatusBadge,
                  { backgroundColor: status.color + '18' },
                ]}
              >
                <View
                  style={[styles.riskDot, { backgroundColor: status.color }]}
                />
                <Text style={[styles.lineStatusText, { color: status.color }]}>
                  {status.label}
                </Text>
              </View>
              {marketPrice > 0 && (
                <View
                  style={[
                    styles.lineDeltaBadge,
                    { backgroundColor: delta.color + '18' },
                  ]}
                >
                  <Text style={[styles.lineDeltaText, { color: delta.color }]}>
                    {delta.value >= 0 ? '+' : ''}
                    {fmtPct(delta.value)}
                  </Text>
                </View>
              )}
              {line.savingsPotential && (
                <Text style={styles.lineSavingHint}>
                  Besparing: {fmt(Math.round(line.savingsPotential.savingsAmount))}
                </Text>
              )}
            </View>
          </Pressable>
        );
      })}

      {filteredLines.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons
            name="document-text"
            size={40}
            color={SemanticColors.textTertiary}
          />
          <Text style={styles.emptyStateText}>Geen regels gevonden</Text>
        </View>
      )}
    </>
  );

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
                    {detailLine.quantity.toLocaleString('nl-NL')} {detailLine.unit}
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
                      <Text style={[styles.modalValue, { color: SemanticColors.feedbackSuccess }]}>€{tcoMatch.recommendation.tcoPerYear}</Text>
                    </View>
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>TCO/jaar (budget)</Text>
                      <Text style={styles.modalValue}>€{tcoMatch.materials[0].tcoPerYear}</Text>
                    </View>
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>Jaarlijkse besparing</Text>
                      <Text style={[styles.modalValue, { color: SemanticColors.feedbackSuccess, fontWeight: '700' }]}>€{tcoMatch.savingsVsBudget}/jr</Text>
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
  // RENDER
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

      {/* Embedded summary strip — replaces hidden header context */}
      {embedded && activeScenario && (
        <View style={[styles.embeddedSummary, { borderBottomColor: ACCENT + '30' }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={[styles.embeddedDot, { backgroundColor: ACCENT }]} />
              <Text style={styles.embeddedScenario}>{projectName}</Text>
            </View>
            <Text style={styles.embeddedMeta}>
              {activeScenario.label} — {activeScenario.optimizations.length} optimalisaties
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <Text style={[styles.embeddedSavings, { color: SemanticColors.feedbackSuccess }]}>
              {fmt(Math.round(activeScenario.totalSavings))}
            </Text>
            {approvedSavings > 0 ? (
              <Text style={styles.embeddedApproved}>
                {fmt(Math.round(approvedSavings))} goedgekeurd
              </Text>
            ) : (
              <Text style={styles.embeddedSavingsPct}>
                -{fmtPct(activeScenario.savingsPercent)} potentieel
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TabButton
          label="Overzicht"
          icon="grid"
          isActive={activeTab === 'overview'}
          onPress={() => setActiveTab('overview')}
          activeColor={ACCENT}
        />
        <TabButton
          label="Top Impact"
          icon="trending-down"
          isActive={activeTab === 'impact'}
          onPress={() => setActiveTab('impact')}
          activeColor={ACCENT}
        />
        <TabButton
          label="Categorieën"
          icon="layers"
          isActive={activeTab === 'categories'}
          onPress={() => setActiveTab('categories')}
          activeColor={ACCENT}
        />
        <TabButton
          label="Regels"
          icon="list"
          isActive={activeTab === 'lines'}
          onPress={() => setActiveTab('lines')}
          activeColor={ACCENT}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'impact' && renderImpact()}
        {activeTab === 'categories' && renderCategories()}
        {activeTab === 'lines' && renderLines()}
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
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    marginTop: Spacing.sm,
  },
  loadingSubtext: {
    fontSize: 14,
    color: SemanticColors.textTertiary,
  },

  // Embedded summary strip
  embeddedSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SafeArea.side,
    paddingVertical: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
  },
  embeddedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  embeddedScenario: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  embeddedSavings: {
    fontSize: 18,
    fontWeight: '700',
  },
  embeddedMeta: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    marginLeft: 14,
  },
  embeddedSavingsPct: {
    fontSize: 11,
    fontWeight: '600',
    color: SemanticColors.textTertiary,
  },
  embeddedApproved: {
    fontSize: 11,
    fontWeight: '600',
    color: SemanticColors.feedbackSuccess,
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
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 4,
    marginLeft: 12,
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
    gap: 6,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  tabButtonActive: {
    backgroundColor: DIRECTOR_COLOR,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  tabButtonTextActive: {
    color: '#fff',
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingHorizontal: SafeArea.side,
    gap: Spacing.md,
    paddingBottom: SafeArea.bottom + Spacing.xl,
  },

  // Card pattern
  card: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    padding: Spacing.lg,
  },

  // Section title
  sectionTitle: {
    fontSize: 16,
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
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  heroSubtitle: {
    fontSize: 13,
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
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  heroStatLabel: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  heroStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: SemanticColors.borderDefault,
  },
  heroCaption: {
    fontSize: 12,
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
    borderRadius: 10,
    borderWidth: 1.5,
  },
  exportButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // ── Scenario Selector ─────────────────────────────────────────────────────
  scenarioRow: {
    gap: Spacing.xs,
    paddingVertical: 4,
  },
  scenarioCard: {
    width: 170,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    padding: Spacing.md,
  },
  scenarioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.xs,
  },
  scenarioLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  scenarioSavings: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
  },
  scenarioSavingsPct: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  scenarioRisk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.xs,
  },
  riskDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scenarioRiskText: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },

  // ── Summary Stats ─────────────────────────────────────────────────────────
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryStat: {
    flex: 1,
    alignItems: 'center',
  },
  summaryStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  summaryStatLabel: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  summaryStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: SemanticColors.borderDefault,
  },

  // ── Category Bars (Overview) ──────────────────────────────────────────────
  catBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  catBarName: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    flex: 1,
  },
  catBarSavings: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.feedbackSuccess,
  },
  catBarContainer: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    backgroundColor: SemanticColors.surfaceSecondary,
    overflow: 'hidden',
    marginBottom: 6,
  },
  catBarOptimized: {
    height: '100%',
    backgroundColor: SemanticColors.feedbackSuccess,
    borderRadius: 4,
  },
  catBarSaved: {
    height: '100%',
    backgroundColor: SemanticColors.feedbackSuccessBg,
  },
  catBarFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  catBarFooterText: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
  },

  // ── Secondary Button ──────────────────────────────────────────────────────
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: DIRECTOR_COLOR,
    marginTop: Spacing.md,
    minHeight: 48,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: DIRECTOR_COLOR,
  },

  // ── Impact Tab ────────────────────────────────────────────────────────────
  impactHeaderText: {
    fontSize: 15,
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
    borderRadius: 16,
    backgroundColor: SemanticColors.surfaceSecondary,
    minHeight: 36,
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: DIRECTOR_COLOR,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  chipTextActive: {
    color: '#fff',
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
    borderRadius: 6,
  },
  optCodeText: {
    fontSize: 11,
    fontWeight: '700',
    color: SemanticColors.textSecondary,
  },
  optDescription: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    lineHeight: 20,
  },
  optCategory: {
    fontSize: 12,
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
    fontSize: 15,
    fontWeight: '600',
  },
  optSavingsBadge: {
    fontSize: 12,
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
    borderRadius: 8,
  },
  actionBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  actionBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  actionBadgeSmallText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
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
    fontSize: 11,
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
    fontSize: 13,
    color: SemanticColors.textSecondary,
    lineHeight: 18,
  },
  optSourcesList: {
    marginTop: Spacing.xs,
  },
  optSourcesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.textTertiary,
    marginBottom: 4,
  },
  optSourceItem: {
    fontSize: 12,
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
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.surfaceSecondary,
  },

  // ── Categories Tab ────────────────────────────────────────────────────────
  catAccordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  catAccordionName: {
    fontSize: 16,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  catAccordionSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: 4,
  },
  catAccordionSub: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  catAccordionSavings: {
    fontSize: 12,
    fontWeight: '600',
  },
  catCountBadge: {
    backgroundColor: SemanticColors.feedbackSuccess + '20',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 20,
    alignItems: 'center',
  },
  catCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
  },
  miniBarContainer: {
    width: 40,
    height: 6,
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    padding: Spacing.sm,
    marginLeft: Spacing.md,
  },
  catLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 4,
  },
  catLineCode: {
    fontSize: 11,
    fontWeight: '700',
    color: SemanticColors.textTertiary,
    width: 52,
  },
  catLineDesc: {
    fontSize: 13,
    color: SemanticColors.textPrimary,
    flex: 1,
  },
  catLineSaving: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.feedbackSuccess,
    flex: 1,
  },

  // ── Lines Tab ─────────────────────────────────────────────────────────────
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: SemanticColors.textPrimary,
    padding: 0,
  },
  linesCount: {
    fontSize: 13,
    color: SemanticColors.textTertiary,
    fontWeight: '600',
  },
  lineCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
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
    borderRadius: 6,
  },
  lineCodeText: {
    fontSize: 11,
    fontWeight: '700',
    color: SemanticColors.textSecondary,
    letterSpacing: 0.3,
  },
  lineCardCategory: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    flex: 1,
  },
  lineCardDesc: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    lineHeight: 20,
  },
  lineCardPrices: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  linePriceCol: {
    flex: 1,
  },
  linePriceLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: SemanticColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  linePriceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  linePriceUnit: {
    fontSize: 11,
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
    borderRadius: 8,
  },
  lineStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  lineDeltaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  lineDeltaText: {
    fontSize: 11,
    fontWeight: '700',
  },
  lineSavingHint: {
    fontSize: 11,
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    padding: Spacing.xl,
  },
  emptyStateText: {
    fontSize: 14,
    color: SemanticColors.textTertiary,
    textAlign: 'center',
  },
  emptyStateTextSmall: {
    fontSize: 12,
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
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.feedbackSuccess,
  },
  enrichSectionCount: {
    fontSize: 12,
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
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enrichItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  enrichItemSubtitle: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  enrichSavingText: {
    fontSize: 14,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
  },
  enrichSavingMeta: {
    fontSize: 10,
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
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  modalSection: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  modalSectionTitle: {
    fontSize: 15,
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
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  modalValue: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 12,
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
    fontSize: 12,
    color: SemanticColors.textPrimary,
  },
  modalSourcePrice: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  modalSourceDate: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
    width: 70,
    textAlign: 'right',
  },

  // Savings modal
  modalActionsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginTop: Spacing.xs,
    marginBottom: 4,
  },
  modalActionItem: {
    marginBottom: Spacing.sm,
  },
  modalActionDesc: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 4,
    lineHeight: 17,
  },
  modalActionSaving: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    marginTop: 4,
  },

  // AI recommendation
  aiRecommendation: {
    flexDirection: 'row',
    gap: Spacing.xs,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: Spacing.sm,
    alignItems: 'flex-start',
  },
  aiRecommendationText: {
    fontSize: 13,
    color: SemanticColors.textPrimary,
    flex: 1,
    lineHeight: 18,
  },
});

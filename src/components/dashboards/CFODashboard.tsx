// =============================================================================
// CFO DASHBOARD - Financial Oversight & Cost Control
// =============================================================================
// Executive financial dashboard for real estate development CFOs
// Focus: Appraisals, Cost Control, Cash Flow, Investment Returns
// Tabbed interface for cleaner navigation
// =============================================================================

import { useState, useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import {
  mockProjects,
  mockAppraisals,
  mockDeliveryMetrics,
  getProjectById,
} from '../../data/mockProjects';
import {
  calculateTransferTax,
  formatPercent,
  getCurrencyForCountry,
} from '../../modules/countryModules';
import type { Country } from '../../types/buildos';

type IconName = keyof typeof Ionicons.glyphMap;
export type CFOTabView = 'finance' | 'costs' | 'cashflow' | 'returns';
type TabView = CFOTabView;

// Role color
const CFO_COLOR = '#10B981'; // Green for financial

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Format large numbers with K/M abbreviations
 */
function formatCompact(value: number, currency: string = 'GBP'): string {
  const symbol = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$';
  const absValue = Math.abs(value);

  if (absValue >= 1_000_000_000) {
    return `${symbol}${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (absValue >= 1_000_000) {
    return `${symbol}${(value / 1_000_000).toFixed(1)}M`;
  }
  if (absValue >= 1_000) {
    return `${symbol}${(value / 1_000).toFixed(0)}K`;
  }
  return `${symbol}${value.toFixed(0)}`;
}

/**
 * Format with sign for variance display
 */
function formatVariance(value: number, currency: string = 'GBP'): string {
  const formatted = formatCompact(Math.abs(value), currency);
  return value >= 0 ? `+${formatted}` : `-${formatted.replace(/[£€$]/, '')}`;
}

// =============================================================================
// COMPONENTS
// =============================================================================

interface QuickActionProps {
  icon: IconName;
  label: string;
  badge?: number;
  onPress: () => void;
}

function QuickAction({ icon, label, badge, onPress }: QuickActionProps) {
  return (
    <Pressable style={styles.quickAction} onPress={onPress}>
      <View style={styles.quickActionIcon}>
        <Ionicons name={icon} size={20} color={CFO_COLOR} />
        {badge !== undefined && badge > 0 && (
          <View style={styles.quickActionBadge}>
            <Text style={styles.quickActionBadgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={styles.quickActionLabel} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

interface MetricCardProps {
  value: string;
  label: string;
  color?: string;
  subtitle?: string;
}

function MetricCard({ value, label, color, subtitle }: MetricCardProps) {
  return (
    <View style={styles.metricCard}>
      <Text style={[styles.metricValue, color && { color }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      {subtitle && <Text style={styles.metricSubtitle}>{subtitle}</Text>}
    </View>
  );
}

// =============================================================================
// MAIN DASHBOARD
// =============================================================================

interface CFODashboardProps {
  initialTab?: TabView;
  showTabBar?: boolean;
}

export function CFODashboard({ initialTab = 'finance', showTabBar = true }: CFODashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabView>(initialTab);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('uk-001');
  const [taxAmount, setTaxAmount] = useState('');
  const [taxCountry, setTaxCountry] = useState<Country>('UK');

  // Derived data
  const selectedProject = useMemo(() => getProjectById(selectedProjectId), [selectedProjectId]);
  const appraisal = useMemo(() => mockAppraisals[selectedProjectId], [selectedProjectId]);
  const deliveryMetrics = useMemo(() => mockDeliveryMetrics[selectedProjectId], [selectedProjectId]);
  const currency = useMemo(() => selectedProject ? getCurrencyForCountry(selectedProject.country) : 'GBP', [selectedProject]);

  // Portfolio metrics
  const portfolioMetrics = useMemo(() => {
    let totalGdv = 0;
    let totalBudget = 0;
    let totalSpent = 0;
    let irrSum = 0;
    let projectCount = 0;

    mockProjects.forEach((project) => {
      const appr = mockAppraisals[project.id];
      if (appr) {
        totalGdv += appr.gdv;
        irrSum += appr.irr;
        projectCount++;
      }
      totalBudget += project.totalBudget;
      totalSpent += project.actualSpent;
    });

    return {
      totalGdv,
      avgIrr: projectCount > 0 ? irrSum / projectCount : 0,
      totalBudget,
      totalSpent,
      uncommitted: totalBudget - totalSpent,
    };
  }, []);

  // Cost health
  const costHealth = useMemo(() => {
    if (!selectedProject || !deliveryMetrics) return null;
    const cpi = deliveryMetrics.cpiCostPerformanceIndex;
    const eac = deliveryMetrics.estimateAtCompletion;
    const budgetVariance = selectedProject.totalBudget - eac;
    const contingencyRemaining = selectedProject.contingency - selectedProject.contingencyUsed;

    return {
      cpi,
      eac,
      budgetVariance,
      contingencyRemaining,
      contingencyPercent: selectedProject.contingency > 0
        ? contingencyRemaining / selectedProject.contingency : 0,
      status: cpi >= 0.95 ? 'healthy' : cpi >= 0.85 ? 'at-risk' : 'critical',
    };
  }, [selectedProject, deliveryMetrics]);

  // Tax calculator
  const taxResult = useMemo(() => {
    const amount = parseFloat(taxAmount);
    if (isNaN(amount) || amount <= 0) return null;
    return calculateTransferTax(taxCountry, amount, { isResidential: false });
  }, [taxAmount, taxCountry]);

  const fmt = (amount: number) => formatCompact(amount, currency);

  return (
    <View style={styles.container}>
      {/* Header with Portfolio Summary */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Portfolio</Text>
            <Text style={styles.headerSubtitle}>{mockProjects.length} actieve projecten</Text>
          </View>
          <View style={[styles.headerAccent, { backgroundColor: CFO_COLOR }]} />
        </View>

        {/* Key Metrics Row */}
        <View style={styles.headerMetrics}>
          <View style={styles.headerMetric}>
            <Text style={styles.headerMetricValue}>{formatCompact(portfolioMetrics.totalGdv, 'GBP')}</Text>
            <Text style={styles.headerMetricLabel}>Total GDV</Text>
          </View>
          <View style={styles.headerMetricDivider} />
          <View style={styles.headerMetric}>
            <Text style={[styles.headerMetricValue, { color: CFO_COLOR }]}>
              {formatPercent(portfolioMetrics.avgIrr)}
            </Text>
            <Text style={styles.headerMetricLabel}>Avg IRR</Text>
          </View>
          <View style={styles.headerMetricDivider} />
          <View style={styles.headerMetric}>
            <Text style={styles.headerMetricValue}>{formatCompact(portfolioMetrics.uncommitted, 'GBP')}</Text>
            <Text style={styles.headerMetricLabel}>Uncommitted</Text>
          </View>
        </View>
      </View>

      {/* Tab Bar (only show when not using navigation tabs) */}
      {showTabBar && (
        <View style={styles.tabBar}>
          {[
            { key: 'finance', label: 'Finance', icon: 'stats-chart' },
            { key: 'costs', label: 'Costs', icon: 'wallet' },
            { key: 'cashflow', label: 'Cash', icon: 'cash' },
            { key: 'returns', label: 'Returns', icon: 'pie-chart' },
          ].map((tab) => (
            <Pressable
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key as TabView)}
            >
              <Ionicons
                name={tab.icon as IconName}
                size={18}
                color={activeTab === tab.key ? '#fff' : SemanticColors.textSecondary}
              />
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* FINANCE TAB */}
        {activeTab === 'finance' && (
          <>
            {/* Quick Actions */}
            <View style={styles.quickActionsRow}>
              <QuickAction
                icon="document-text"
                label="Draw"
                onPress={() => router.push('/hub/costs' as any)}
              />
              <QuickAction
                icon="trending-up"
                label="Investor"
                badge={1}
                onPress={() => router.push('/hub/reports' as any)}
              />
              <QuickAction
                icon="pie-chart"
                label="Report"
                onPress={() => router.push('/hub/costs' as any)}
              />
              <QuickAction
                icon="checkmark-done"
                label="Approve"
                badge={3}
                onPress={() => router.push('/hub/approvals' as any)}
              />
            </View>

            {/* Project Selector */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Project Analysis</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.projectRow}>
                  {mockProjects.map((project) => (
                    <Pressable
                      key={project.id}
                      style={[
                        styles.projectPill,
                        selectedProjectId === project.id && styles.projectPillActive,
                      ]}
                      onPress={() => setSelectedProjectId(project.id)}
                    >
                      <Text style={styles.projectCountry}>{project.country}</Text>
                      <Text style={[
                        styles.projectName,
                        selectedProjectId === project.id && styles.projectNameActive,
                      ]} numberOfLines={1}>
                        {project.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Development Appraisal */}
            {appraisal && selectedProject && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderIcon}>
                    <Ionicons name="stats-chart" size={18} color={CFO_COLOR} />
                  </View>
                  <Text style={styles.cardTitle}>Development Appraisal</Text>
                </View>

                {/* Key Returns Grid */}
                <View style={styles.returnsGrid}>
                  <View style={styles.returnItem}>
                    <Text style={styles.returnValue}>{formatPercent(appraisal.irr)}</Text>
                    <Text style={styles.returnLabel}>IRR</Text>
                  </View>
                  <View style={styles.returnItem}>
                    <Text style={styles.returnValue}>{fmt(appraisal.npv)}</Text>
                    <Text style={styles.returnLabel}>NPV</Text>
                  </View>
                  <View style={styles.returnItem}>
                    <Text style={styles.returnValue}>{formatPercent(appraisal.profitOnCost)}</Text>
                    <Text style={styles.returnLabel}>PoC</Text>
                  </View>
                  <View style={styles.returnItem}>
                    <Text style={styles.returnValue}>{formatPercent(appraisal.profitOnGdv)}</Text>
                    <Text style={styles.returnLabel}>PoGDV</Text>
                  </View>
                </View>

                {/* Key Figures */}
                <View style={styles.figuresRow}>
                  <View style={styles.figureItem}>
                    <Text style={styles.figureLabel}>GDV</Text>
                    <Text style={styles.figureValue}>{fmt(appraisal.gdv)}</Text>
                  </View>
                  <View style={styles.figureItem}>
                    <Text style={styles.figureLabel}>TDC</Text>
                    <Text style={styles.figureValue}>{fmt(appraisal.totalDevelopmentCost)}</Text>
                  </View>
                  <View style={styles.figureItem}>
                    <Text style={styles.figureLabel}>Profit</Text>
                    <Text style={[styles.figureValue, { color: CFO_COLOR }]}>
                      {fmt(appraisal.gdv - appraisal.totalDevelopmentCost)}
                    </Text>
                  </View>
                </View>

                {/* Equity Returns */}
                {appraisal.equityIrr && (
                  <View style={styles.equityBanner}>
                    <View style={styles.equityItem}>
                      <Ionicons name="trending-up" size={16} color={SemanticColors.feedbackSuccess} />
                      <Text style={styles.equityLabel}>Equity IRR</Text>
                      <Text style={styles.equityValue}>{formatPercent(appraisal.equityIrr)}</Text>
                    </View>
                    {appraisal.equityMultiple && (
                      <View style={styles.equityItem}>
                        <Ionicons name="layers" size={16} color={SemanticColors.feedbackSuccess} />
                        <Text style={styles.equityLabel}>Multiple</Text>
                        <Text style={styles.equityValue}>{appraisal.equityMultiple.toFixed(2)}x</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}
          </>
        )}

        {/* COSTS TAB */}
        {activeTab === 'costs' && costHealth && selectedProject && (
          <>
            {/* Project Selector */}
            <View style={styles.section}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.projectRow}>
                  {mockProjects.map((project) => (
                    <Pressable
                      key={project.id}
                      style={[
                        styles.projectPill,
                        selectedProjectId === project.id && styles.projectPillActive,
                      ]}
                      onPress={() => setSelectedProjectId(project.id)}
                    >
                      <Text style={styles.projectCountry}>{project.country}</Text>
                      <Text style={[
                        styles.projectName,
                        selectedProjectId === project.id && styles.projectNameActive,
                      ]} numberOfLines={1}>
                        {project.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* CPI Status Banner */}
            <View style={[
              styles.cpiBanner,
              costHealth.status === 'healthy' && styles.cpiBannerHealthy,
              costHealth.status === 'at-risk' && styles.cpiBannerWarning,
              costHealth.status === 'critical' && styles.cpiBannerCritical,
            ]}>
              <View style={styles.cpiLeft}>
                <Text style={styles.cpiLabel}>Cost Performance Index</Text>
                <Text style={styles.cpiStatus}>
                  {costHealth.status === 'healthy' ? 'On Budget' :
                   costHealth.status === 'at-risk' ? 'At Risk' : 'Over Budget'}
                </Text>
              </View>
              <View style={styles.cpiCircle}>
                <Text style={styles.cpiValue}>{costHealth.cpi.toFixed(2)}</Text>
              </View>
            </View>

            {/* Cost Metrics */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Cost Summary</Text>
              <View style={styles.costMetrics}>
                <MetricCard
                  value={fmt(selectedProject.totalBudget)}
                  label="Budget"
                />
                <MetricCard
                  value={fmt(selectedProject.actualSpent)}
                  label="Spent"
                  subtitle={`${Math.round((selectedProject.actualSpent / selectedProject.totalBudget) * 100)}%`}
                />
                <MetricCard
                  value={fmt(costHealth.eac)}
                  label="EAC"
                  color={costHealth.budgetVariance < 0 ? SemanticColors.feedbackError : undefined}
                />
                <MetricCard
                  value={formatVariance(costHealth.budgetVariance, currency)}
                  label="Variance"
                  color={costHealth.budgetVariance >= 0 ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError}
                />
              </View>
            </View>

            {/* Contingency */}
            <View style={styles.card}>
              <View style={styles.contingencyHeader}>
                <Text style={styles.cardTitle}>Contingency</Text>
                <Text style={[
                  styles.contingencyPercent,
                  costHealth.contingencyPercent < 0.3 && { color: SemanticColors.feedbackError }
                ]}>
                  {formatPercent(costHealth.contingencyPercent)} remaining
                </Text>
              </View>

              <View style={styles.contingencyBar}>
                <View style={[
                  styles.contingencyUsed,
                  { width: `${(1 - costHealth.contingencyPercent) * 100}%` },
                  costHealth.contingencyPercent < 0.3 && styles.contingencyUsedDanger,
                ]} />
              </View>

              <View style={styles.contingencyDetails}>
                <View style={styles.contingencyDetail}>
                  <Text style={styles.contingencyDetailLabel}>Total</Text>
                  <Text style={styles.contingencyDetailValue}>{fmt(selectedProject.contingency)}</Text>
                </View>
                <View style={styles.contingencyDetail}>
                  <Text style={styles.contingencyDetailLabel}>Used</Text>
                  <Text style={[styles.contingencyDetailValue, { color: SemanticColors.feedbackWarning }]}>
                    {fmt(selectedProject.contingencyUsed)}
                  </Text>
                </View>
                <View style={styles.contingencyDetail}>
                  <Text style={styles.contingencyDetailLabel}>Remaining</Text>
                  <Text style={[styles.contingencyDetailValue, { color: CFO_COLOR }]}>
                    {fmt(costHealth.contingencyRemaining)}
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}

        {/* TAX TAB */}
        {activeTab === 'tax' && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderIcon}>
                <Ionicons name="calculator" size={18} color={CFO_COLOR} />
              </View>
              <Text style={styles.cardTitle}>Transfer Tax Calculator</Text>
            </View>

            {/* Country Selector */}
            <View style={styles.taxCountryRow}>
              {(['UK', 'NL', 'DE'] as Country[]).map((country) => (
                <Pressable
                  key={country}
                  style={[
                    styles.taxCountryPill,
                    taxCountry === country && styles.taxCountryPillActive,
                  ]}
                  onPress={() => setTaxCountry(country)}
                >
                  <Text style={[
                    styles.taxCountryText,
                    taxCountry === country && styles.taxCountryTextActive,
                  ]}>
                    {country === 'UK' ? 'UK SDLT' : country === 'NL' ? 'NL RETT' : 'DE RETT'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Amount Input */}
            <View style={styles.taxInputContainer}>
              <Text style={styles.taxInputLabel}>Purchase Price</Text>
              <View style={styles.taxInputRow}>
                <Text style={styles.taxCurrency}>{taxCountry === 'UK' ? '£' : '€'}</Text>
                <TextInput
                  style={styles.taxInput}
                  placeholder="Enter amount"
                  placeholderTextColor={SemanticColors.textTertiary}
                  value={taxAmount}
                  onChangeText={setTaxAmount}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Result */}
            {taxResult && (
              <View style={styles.taxResult}>
                <View style={styles.taxResultRow}>
                  <Text style={styles.taxResultLabel}>
                    {taxCountry === 'UK' ? 'SDLT Payable' :
                     taxCountry === 'NL' ? 'Overdrachtsbelasting' : 'Grunderwerbsteuer'}
                  </Text>
                  <Text style={styles.taxResultValue}>
                    {formatCompact(taxResult.totalTax, taxCountry === 'UK' ? 'GBP' : 'EUR')}
                  </Text>
                </View>
                <View style={styles.taxResultRow}>
                  <Text style={styles.taxEffectiveLabel}>Effective Rate</Text>
                  <Text style={styles.taxEffectiveValue}>{formatPercent(taxResult.effectiveRate)}</Text>
                </View>
              </View>
            )}

            {/* Quick Reference */}
            <View style={styles.taxReference}>
              <Text style={styles.taxReferenceTitle}>Quick Reference</Text>
              <View style={styles.taxReferenceItem}>
                <Text style={styles.taxReferenceLabel}>UK SDLT (Commercial)</Text>
                <Text style={styles.taxReferenceValue}>0-5% tiered</Text>
              </View>
              <View style={styles.taxReferenceItem}>
                <Text style={styles.taxReferenceLabel}>NL RETT</Text>
                <Text style={styles.taxReferenceValue}>10.4% flat</Text>
              </View>
              <View style={styles.taxReferenceItem}>
                <Text style={styles.taxReferenceLabel}>DE RETT</Text>
                <Text style={styles.taxReferenceValue}>3.5-6.5% by state</Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
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

  // Header
  header: {
    backgroundColor: SemanticColors.surfacePrimary,
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  headerAccent: {
    width: 6,
    height: 36,
    borderRadius: 3,
  },
  headerMetrics: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 12,
    padding: Spacing.md,
  },
  headerMetric: {
    flex: 1,
    alignItems: 'center',
  },
  headerMetricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  headerMetricLabel: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  headerMetricDivider: {
    width: 1,
    backgroundColor: SemanticColors.borderDefault,
    marginHorizontal: Spacing.sm,
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    gap: Spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  tabActive: {
    backgroundColor: CFO_COLOR,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  tabTextActive: {
    color: '#fff',
  },

  // Scroll Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },

  // Section
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Quick Actions
  quickActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickAction: {
    flex: 1,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  quickActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: CFO_COLOR + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: SemanticColors.feedbackError,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    textAlign: 'center',
  },

  // Project Selector
  projectRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  projectPill: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    minWidth: 100,
  },
  projectPillActive: {
    borderColor: CFO_COLOR,
    backgroundColor: CFO_COLOR + '10',
  },
  projectCountry: {
    fontSize: 10,
    fontWeight: '700',
    color: CFO_COLOR,
  },
  projectName: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  projectNameActive: {
    color: SemanticColors.textPrimary,
  },

  // Cards
  card: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: CFO_COLOR + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },

  // Returns Grid
  returnsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  returnItem: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  returnValue: {
    fontSize: 16,
    fontWeight: '700',
    color: CFO_COLOR,
  },
  returnLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },

  // Figures Row
  figuresRow: {
    flexDirection: 'row',
    gap: 8,
  },
  figureItem: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  figureLabel: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },
  figureValue: {
    fontSize: 13,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },

  // Equity Banner
  equityBanner: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.feedbackSuccessBg,
    borderRadius: 10,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.feedbackSuccessBorder,
  },
  equityItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  equityLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  equityValue: {
    fontSize: 14,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
  },

  // CPI Banner
  cpiBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 14,
  },
  cpiBannerHealthy: {
    backgroundColor: SemanticColors.feedbackSuccessBg,
  },
  cpiBannerWarning: {
    backgroundColor: SemanticColors.feedbackWarningBg,
  },
  cpiBannerCritical: {
    backgroundColor: SemanticColors.feedbackErrorBg,
  },
  cpiLeft: {},
  cpiLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  cpiStatus: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    marginTop: 2,
  },
  cpiCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: SemanticColors.surfacePrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cpiValue: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },

  // Cost Metrics
  costMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  metricLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  metricSubtitle: {
    fontSize: 10,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },

  // Contingency
  contingencyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contingencyPercent: {
    fontSize: 13,
    fontWeight: '600',
    color: CFO_COLOR,
  },
  contingencyBar: {
    height: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  contingencyUsed: {
    height: '100%',
    backgroundColor: SemanticColors.feedbackWarning,
    borderRadius: 4,
  },
  contingencyUsedDanger: {
    backgroundColor: SemanticColors.feedbackError,
  },
  contingencyDetails: {
    flexDirection: 'row',
    gap: 8,
  },
  contingencyDetail: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  contingencyDetailLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
  },
  contingencyDetailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    marginTop: 2,
  },

  // Tax Calculator
  taxCountryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  taxCountryPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  taxCountryPillActive: {
    backgroundColor: CFO_COLOR + '15',
    borderColor: CFO_COLOR,
  },
  taxCountryText: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  taxCountryTextActive: {
    color: CFO_COLOR,
  },
  taxInputContainer: {
    gap: 6,
  },
  taxInputLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  taxInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  taxCurrency: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    paddingLeft: 12,
    paddingRight: 4,
  },
  taxInput: {
    flex: 1,
    padding: 12,
    color: SemanticColors.textPrimary,
    fontSize: 14,
  },
  taxResult: {
    backgroundColor: CFO_COLOR + '10',
    borderRadius: 10,
    padding: Spacing.md,
    gap: 8,
    borderWidth: 1,
    borderColor: CFO_COLOR + '30',
  },
  taxResultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taxResultLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  taxResultValue: {
    fontSize: 20,
    fontWeight: '700',
    color: CFO_COLOR,
  },
  taxEffectiveLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  taxEffectiveValue: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  taxReference: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: Spacing.md,
    gap: 8,
  },
  taxReferenceTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    marginBottom: 4,
  },
  taxReferenceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  taxReferenceLabel: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
  },
  taxReferenceValue: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
});

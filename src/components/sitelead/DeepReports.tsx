// DeepReports.tsx - Comprehensive analytics and reporting for Site Leads
// Financial, workforce, materials, safety, and schedule reporting

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { Spacing } from '../../theme/spacing';
import { MOCK_SITE_REPORT } from '../../data/mockSiteLead';

type IconName = keyof typeof Ionicons.glyphMap;

// ============================================
// SUB-COMPONENTS
// ============================================

interface StatBlockProps {
  label: string;
  value: string | number;
  prefix?: string;
  suffix?: string;
  change?: number;
  icon?: IconName;
  color?: string;
}

function StatBlock({ label, value, prefix, suffix, change, icon, color }: StatBlockProps) {
  const displayColor = color || SemanticColors.textPrimary;

  return (
    <View style={styles.statBlock}>
      {icon && (
        <View style={[styles.statIcon, { backgroundColor: displayColor + '15' }]}>
          <Ionicons name={icon} size={18} color={displayColor} />
        </View>
      )}
      <View style={styles.statContent}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={[styles.statValue, { color: displayColor }]}>
          {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
        </Text>
        {change !== undefined && (
          <View style={styles.changeRow}>
            <Ionicons
              name={change >= 0 ? 'trending-up' : 'trending-down'}
              size={12}
              color={change >= 0 ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError}
            />
            <Text style={[
              styles.changeText,
              { color: change >= 0 ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError }
            ]}>
              {change >= 0 ? '+' : ''}{change}%
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

interface ProgressBarProps {
  label: string;
  value: number;
  max: number;
  color: string;
  showLabel?: boolean;
}

function ProgressBar({ label, value, max, color, showLabel = true }: ProgressBarProps) {
  const percent = Math.min((value / max) * 100, 100);

  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>{label}</Text>
        {showLabel && <Text style={styles.progressValue}>{value}/{max}</Text>}
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

interface ReportSectionProps {
  title: string;
  icon: IconName;
  color: string;
  children: React.ReactNode;
}

function ReportSection({ title, icon, color, children }: ReportSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <View style={styles.reportSection}>
      <Pressable style={styles.sectionHeader} onPress={() => setIsExpanded(!isExpanded)}>
        <View style={[styles.sectionIcon, { backgroundColor: color + '15' }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={SemanticColors.textSecondary}
        />
      </Pressable>
      {isExpanded && <View style={styles.sectionContent}>{children}</View>}
    </View>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

interface DeepReportsProps {
  onClose?: () => void;
}

export function DeepReports({ onClose }: DeepReportsProps) {
  const { t } = useTranslation();
  const [report] = useState(MOCK_SITE_REPORT);
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('week');

  const periods = [
    { id: 'week' as const, label: 'Deze Week' },
    { id: 'month' as const, label: 'Deze Maand' },
    { id: 'quarter' as const, label: 'Dit Kwartaal' },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Rapporten</Text>
          <Text style={styles.subtitle}>Gedetailleerde Analyses & Inzichten</Text>
        </View>
        {onClose && (
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={SemanticColors.textSecondary} />
          </Pressable>
        )}
      </View>

      {/* Period Selector */}
      <View style={styles.periodSelector}>
        {periods.map((p) => (
          <Pressable
            key={p.id}
            style={[styles.periodButton, period === p.id && styles.periodButtonActive]}
            onPress={() => setPeriod(p.id)}
          >
            <Text style={[styles.periodText, period === p.id && styles.periodTextActive]}>
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Financial Overview */}
        <ReportSection title="Financieel Overzicht" icon="wallet" color={SemanticColors.feedbackSuccess}>
          <View style={styles.statsGrid}>
            <StatBlock
              label="Totale Omzet"
              value={report.overview.totalRevenue}
              prefix={'\u20AC'}
              icon="trending-up"
              color={SemanticColors.feedbackSuccess}
            />
            <StatBlock
              label="Totale Kosten"
              value={report.overview.totalCosts}
              prefix={'\u20AC'}
              icon="trending-down"
              color={SemanticColors.feedbackError}
            />
            <StatBlock
              label="Brutowinst"
              value={report.overview.grossProfit}
              prefix={'\u20AC'}
              icon="cash"
              color={SemanticColors.actionPrimary}
            />
            <StatBlock
              label="Brutomarge"
              value={report.overview.grossMargin}
              suffix="%"
              icon="pie-chart"
              color={SemanticColors.feedbackInfo}
            />
          </View>

          {/* Profit Visualization */}
          <View style={styles.profitCard}>
            <Text style={styles.profitCardTitle}>Winstopbouw</Text>
            <View style={styles.profitBar}>
              <View
                style={[
                  styles.profitSegment,
                  {
                    backgroundColor: SemanticColors.feedbackSuccess,
                    width: `${report.overview.grossMargin}%`,
                  },
                ]}
              />
              <View
                style={[
                  styles.profitSegment,
                  {
                    backgroundColor: SemanticColors.feedbackError,
                    width: `${100 - report.overview.grossMargin}%`,
                  },
                ]}
              />
            </View>
            <View style={styles.profitLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: SemanticColors.feedbackSuccess }]} />
                <Text style={styles.legendText}>Winst ({report.overview.grossMargin}%)</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: SemanticColors.feedbackError }]} />
                <Text style={styles.legendText}>Kosten ({100 - report.overview.grossMargin}%)</Text>
              </View>
            </View>
          </View>
        </ReportSection>

        {/* Workforce Analytics */}
        <ReportSection title="Personeel Analyse" icon="people" color={SemanticColors.feedbackInfo}>
          <View style={styles.statsGrid}>
            <StatBlock
              label="Totaal Uren"
              value={report.workforce.totalHours}
              suffix="u"
              icon="time"
            />
            <StatBlock
              label="Declarabele Uren"
              value={report.workforce.billableHours}
              suffix="u"
              icon="cash"
              color={SemanticColors.feedbackSuccess}
            />
            <StatBlock
              label="Bezettingsgraad"
              value={report.workforce.utilizationRate}
              suffix="%"
              icon="speedometer"
              color={SemanticColors.feedbackInfo}
            />
            <StatBlock
              label="Overuren"
              value={report.workforce.overtimeHours}
              suffix="u"
              icon="alarm"
              color={SemanticColors.feedbackWarning}
            />
          </View>

          <View style={styles.utilizationCard}>
            <Text style={styles.cardTitle}>Bezettingsgraad Overzicht</Text>
            <ProgressBar
              label="Declarabel"
              value={report.workforce.billableHours}
              max={report.workforce.totalHours}
              color={SemanticColors.feedbackSuccess}
            />
            <ProgressBar
              label="Niet-declarabel"
              value={report.workforce.totalHours - report.workforce.billableHours}
              max={report.workforce.totalHours}
              color={SemanticColors.feedbackWarning}
            />
            <ProgressBar
              label="Overuren"
              value={report.workforce.overtimeHours}
              max={report.workforce.totalHours}
              color={SemanticColors.feedbackError}
            />
          </View>

          {/* Top Performers */}
          <View style={styles.performersCard}>
            <Text style={styles.cardTitle}>Beste Presteerders</Text>
            {report.workforce.topPerformers.map((performer, index) => (
              <View key={performer.workerId} style={styles.performerRow}>
                <Text style={styles.performerRank}>#{index + 1}</Text>
                <Text style={styles.performerName}>{performer.workerName}</Text>
                <View style={styles.performerMetrics}>
                  <Text style={styles.performerJobs}>{performer.jobsCompleted} klussen</Text>
                  <Text style={styles.performerRevenue}>{'\u20AC'}{performer.revenue.toLocaleString()}</Text>
                </View>
              </View>
            ))}
          </View>
        </ReportSection>

        {/* Materials & Costs */}
        <ReportSection title="Materialen & Kosten" icon="cube" color={SemanticColors.feedbackWarning}>
          <View style={styles.statsGrid}>
            <StatBlock
              label="Materiaaluitgaven"
              value={report.materials.totalSpend}
              prefix={'\u20AC'}
              icon="cart"
            />
            <StatBlock
              label="Budgetafwijking"
              value={report.materials.budgetVariance}
              prefix={report.materials.budgetVariance >= 0 ? '+\u20AC' : '-\u20AC'}
              icon={report.materials.budgetVariance >= 0 ? 'arrow-up' : 'arrow-down'}
              color={report.materials.budgetVariance >= 0 ? SemanticColors.feedbackError : SemanticColors.feedbackSuccess}
            />
            <StatBlock
              label="Verspilling"
              value={report.materials.wastePercent}
              suffix="%"
              icon="trash"
              color={SemanticColors.feedbackError}
            />
          </View>

          {/* Top Materials */}
          <View style={styles.materialsCard}>
            <Text style={styles.cardTitle}>Duurste Materialen</Text>
            {report.materials.topMaterials.map((material, index) => (
              <View key={index} style={styles.materialRow}>
                <View style={styles.materialInfo}>
                  <Text style={styles.materialName}>{material.name}</Text>
                  <Text style={styles.materialQty}>{material.quantity} stuks</Text>
                </View>
                <View style={styles.materialCost}>
                  <Text style={styles.materialCostValue}>{'\u20AC'}{material.cost}</Text>
                  <Ionicons
                    name={material.trend === 'up' ? 'trending-up' : material.trend === 'down' ? 'trending-down' : 'remove'}
                    size={14}
                    color={
                      material.trend === 'up'
                        ? SemanticColors.feedbackError
                        : material.trend === 'down'
                        ? SemanticColors.feedbackSuccess
                        : SemanticColors.textTertiary
                    }
                  />
                </View>
              </View>
            ))}
          </View>
        </ReportSection>

        {/* Safety */}
        <ReportSection title="Veiligheid & Naleving" icon="shield-checkmark" color={SemanticColors.feedbackSuccess}>
          <View style={styles.safetyCard}>
            <View style={styles.safetyScoreCircle}>
              <Text style={styles.safetyScoreValue}>{report.safety.safetyScore}</Text>
              <Text style={styles.safetyScoreLabel}>Veiligheidsscore</Text>
            </View>
            <View style={styles.safetyStats}>
              <View style={styles.safetyStat}>
                <Text style={styles.safetyStatValue}>{report.safety.daysSinceIncident}</Text>
                <Text style={styles.safetyStatLabel}>Dagen Sinds Incident</Text>
              </View>
              <View style={styles.safetyStat}>
                <Text style={styles.safetyStatValue}>{report.safety.incidentCount}</Text>
                <Text style={styles.safetyStatLabel}>Incidenten</Text>
              </View>
              <View style={styles.safetyStat}>
                <Text style={styles.safetyStatValue}>{report.safety.nearMissCount}</Text>
                <Text style={styles.safetyStatLabel}>Bijna-ongelukken</Text>
              </View>
            </View>
          </View>
        </ReportSection>

        {/* Schedule Performance */}
        <ReportSection title="Planning Prestaties" icon="calendar" color={SemanticColors.feedbackInfo}>
          <View style={styles.scheduleCard}>
            <View style={styles.scheduleHeader}>
              <Text style={styles.scheduleMetric}>
                {report.schedule.plannedVsActual}%
              </Text>
              <Text style={styles.scheduleMetricLabel}>Op Schema</Text>
            </View>

            <View style={[
              styles.criticalPathBadge,
              {
                backgroundColor:
                  report.schedule.criticalPathStatus === 'on-track'
                    ? SemanticColors.feedbackSuccessBg
                    : report.schedule.criticalPathStatus === 'at-risk'
                    ? SemanticColors.feedbackWarningBg
                    : SemanticColors.feedbackErrorBg,
              },
            ]}>
              <Ionicons
                name={
                  report.schedule.criticalPathStatus === 'on-track'
                    ? 'checkmark-circle'
                    : 'alert-circle'
                }
                size={16}
                color={
                  report.schedule.criticalPathStatus === 'on-track'
                    ? SemanticColors.feedbackSuccess
                    : report.schedule.criticalPathStatus === 'at-risk'
                    ? SemanticColors.feedbackWarning
                    : SemanticColors.feedbackError
                }
              />
              <Text style={[
                styles.criticalPathText,
                {
                  color:
                    report.schedule.criticalPathStatus === 'on-track'
                      ? SemanticColors.feedbackSuccess
                      : report.schedule.criticalPathStatus === 'at-risk'
                      ? SemanticColors.feedbackWarning
                      : SemanticColors.feedbackError,
                },
              ]}>
                Kritiek Pad: {report.schedule.criticalPathStatus === 'on-track' ? 'op schema' : report.schedule.criticalPathStatus === 'at-risk' ? 'risico' : 'vertraagd'}
              </Text>
            </View>

            <Text style={styles.cardTitle}>Aankomende Mijlpalen</Text>
            {report.schedule.upcomingMilestones.map((milestone, index) => (
              <View key={index} style={styles.milestoneRow}>
                <View style={[
                  styles.milestoneStatus,
                  {
                    backgroundColor:
                      milestone.status === 'on-track'
                        ? SemanticColors.feedbackSuccess
                        : milestone.status === 'at-risk'
                        ? SemanticColors.feedbackWarning
                        : SemanticColors.feedbackError,
                  },
                ]} />
                <View style={styles.milestoneInfo}>
                  <Text style={styles.milestoneName}>{milestone.name}</Text>
                  <Text style={styles.milestoneDate}>
                    {milestone.daysUntil === 0 ? t('common.today', 'Today') : t('common.inDays', 'In {{count}} days', { count: milestone.daysUntil })}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </ReportSection>

        {/* Customer Metrics */}
        <ReportSection title="Klantstatistieken" icon="happy" color={SemanticColors.actionPrimary}>
          <View style={styles.statsGrid}>
            <StatBlock
              label="Klussen Afgerond"
              value={report.overview.jobsCompleted}
              icon="checkmark-done"
              color={SemanticColors.feedbackSuccess}
            />
            <StatBlock
              label="Op Tijd"
              value={report.overview.onTimeRate}
              suffix="%"
              icon="time"
              color={SemanticColors.feedbackInfo}
            />
            <StatBlock
              label="Tevredenheid"
              value={report.overview.customerSatisfaction}
              suffix="/5"
              icon="star"
              color={SemanticColors.feedbackWarning}
            />
            <StatBlock
              label="Terugkeerpercentage"
              value={report.overview.repeatCustomerRate}
              suffix="%"
              icon="repeat"
              color={SemanticColors.actionPrimary}
            />
          </View>
        </ReportSection>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Export Button */}
      <View style={styles.exportBar}>
        <Pressable style={styles.exportButton}>
          <Ionicons name="download-outline" size={20} color={SemanticColors.textInverse} />
          <Text style={styles.exportButtonText}>Rapport Exporteren</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: Spacing.lg,
    paddingTop: 60,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  title: {
    fontSize: TYPE.displaySize,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  subtitle: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  closeButton: {
    padding: 8,
  },

  // Period Selector
  periodSelector: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  periodButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: RADIUS.sm,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  periodButtonActive: {
    backgroundColor: SemanticColors.actionPrimary,
  },
  periodText: {
    fontSize: TYPE.captionSize,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  periodTextActive: {
    color: SemanticColors.textInverse,
  },

  content: {
    flex: 1,
    padding: Spacing.md,
  },

  // Report Section
  reportSection: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    flex: 1,
    fontSize: TYPE.titleSize,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginLeft: Spacing.sm,
  },
  sectionContent: {
    padding: Spacing.md,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statBlock: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: Spacing.sm,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statContent: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  statLabel: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textSecondary,
  },
  statValue: {
    fontSize: TYPE.sectionSize,
    fontWeight: '700',
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  changeText: {
    fontSize: TYPE.tinySize - 1,
    fontWeight: '600',
  },

  // Profit Card
  profitCard: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
  },
  profitCardTitle: {
    fontSize: TYPE.bodySize - 1,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: Spacing.sm,
  },
  profitBar: {
    flexDirection: 'row',
    height: 24,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  profitSegment: {
    height: '100%',
  },
  profitLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
  },

  // Utilization Card
  utilizationCard: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: TYPE.bodySize - 1,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: Spacing.sm,
  },

  // Progress
  progressContainer: {
    marginBottom: Spacing.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
  },
  progressValue: {
    fontSize: TYPE.labelSize,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  progressTrack: {
    height: 8,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },

  // Performers
  performersCard: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
  },
  performerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  performerRank: {
    width: 30,
    fontSize: TYPE.bodySize - 1,
    fontWeight: '700',
    color: SemanticColors.actionPrimary,
  },
  performerName: {
    flex: 1,
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textPrimary,
  },
  performerMetrics: {
    alignItems: 'flex-end',
  },
  performerJobs: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
  },
  performerRevenue: {
    fontSize: TYPE.bodySize - 1,
    fontWeight: '600',
    color: SemanticColors.feedbackSuccess,
  },

  // Materials
  materialsCard: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
  },
  materialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  materialInfo: {
    flex: 1,
  },
  materialName: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textPrimary,
  },
  materialQty: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
  },
  materialCost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  materialCostValue: {
    fontSize: TYPE.bodySize - 1,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },

  // Safety
  safetyCard: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  safetyScoreCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: SemanticColors.feedbackSuccessBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  safetyScoreValue: {
    fontSize: TYPE.displaySize + 4,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
  },
  safetyScoreLabel: {
    fontSize: TYPE.tinySize - 1,
    color: SemanticColors.feedbackSuccess,
  },
  safetyStats: {
    flexDirection: 'row',
    gap: Spacing.xl,
  },
  safetyStat: {
    alignItems: 'center',
  },
  safetyStatValue: {
    fontSize: TYPE.displaySize - 4,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  safetyStatLabel: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textSecondary,
  },

  // Schedule
  scheduleCard: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
  },
  scheduleHeader: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  scheduleMetric: {
    fontSize: 48,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  scheduleMetricLabel: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
  },
  criticalPathBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.xl,
    marginBottom: Spacing.md,
  },
  criticalPathText: {
    fontSize: TYPE.captionSize,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  milestoneStatus: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  milestoneInfo: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  milestoneName: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textPrimary,
  },
  milestoneDate: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
  },

  // Export Bar
  exportBar: {
    padding: Spacing.md,
    backgroundColor: SemanticColors.surfacePrimary,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: SemanticColors.actionPrimary,
    paddingVertical: Spacing.md,
    borderRadius: RADIUS.md,
  },
  exportButtonText: {
    fontSize: TYPE.titleSize,
    fontWeight: '600',
    color: SemanticColors.textInverse,
  },
});

export default DeepReports;

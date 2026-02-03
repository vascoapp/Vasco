// =============================================================================
// SITE LEAD DASHBOARD
// =============================================================================
// Site execution focus: Safety, Quality, Progress, Constraints
// Orange/terracotta color scheme for site-level operations
// =============================================================================

import { useState, useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SemanticColors, Palette } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import {
  mockProjects,
  mockSiteMetrics,
  getProjectById,
} from '../../data/mockProjects';
import {
  formatCurrency,
  formatPercent,
  getCurrencyForCountry,
} from '../../modules/countryModules';

// -----------------------------------------------------------------------------
// CONSTANTS
// -----------------------------------------------------------------------------

const SITE_LEAD_COLOR = '#F97316'; // Orange for site operations

// -----------------------------------------------------------------------------
// COMPONENT TYPES
// -----------------------------------------------------------------------------

interface MetricTileProps {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  alert?: boolean;
}

interface QuickActionProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  badge?: number;
  onPress: () => void;
}

interface StatusPillProps {
  label: string;
  count: number;
  color: string;
}

// -----------------------------------------------------------------------------
// SUB-COMPONENTS
// -----------------------------------------------------------------------------

function MetricTile({ label, value, subtitle, trend, alert }: MetricTileProps) {
  return (
    <View style={[styles.metricTile, alert && styles.metricTileAlert]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricValueRow}>
        <Text style={[styles.metricValue, alert && styles.metricValueAlert]}>
          {value}
        </Text>
        {trend && (
          <Ionicons
            name={trend === 'up' ? 'trending-up' : trend === 'down' ? 'trending-down' : 'remove'}
            size={16}
            color={trend === 'up' ? Palette.success : trend === 'down' ? Palette.error : SemanticColors.textTertiary}
          />
        )}
      </View>
      {subtitle && <Text style={styles.metricSubtitle}>{subtitle}</Text>}
    </View>
  );
}

function QuickAction({ icon, label, badge, onPress }: QuickActionProps) {
  return (
    <Pressable style={styles.quickAction} onPress={onPress}>
      <View style={styles.quickActionIconWrap}>
        <Ionicons name={icon} size={22} color={SITE_LEAD_COLOR} />
        {badge !== undefined && badge > 0 && (
          <View style={styles.quickActionBadge}>
            <Text style={styles.quickActionBadgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </Pressable>
  );
}

function StatusPill({ label, count, color }: StatusPillProps) {
  return (
    <View style={[styles.statusPill, { backgroundColor: color + '20' }]}>
      <Text style={[styles.statusPillCount, { color }]}>{count}</Text>
      <Text style={styles.statusPillLabel}>{label}</Text>
    </View>
  );
}

// -----------------------------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------------------------

export function SiteLeadDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('uk-001');

  // Derived data
  const selectedProject = useMemo(() => getProjectById(selectedProjectId), [selectedProjectId]);
  const siteMetrics = useMemo(() => mockSiteMetrics[selectedProjectId], [selectedProjectId]);
  const currency = useMemo(
    () => (selectedProject ? getCurrencyForCountry(selectedProject.country) : 'GBP'),
    [selectedProject]
  );

  // Progress metrics
  const progressHealth = useMemo(() => {
    if (!siteMetrics) return null;
    const variance = siteMetrics.progressVariance;
    return {
      actual: siteMetrics.overallPercentComplete,
      planned: siteMetrics.plannedPercentComplete,
      variance,
      status: variance >= -2 ? 'on-track' : variance >= -5 ? 'at-risk' : 'behind',
    };
  }, [siteMetrics]);

  // Safety metrics
  const safetyHealth = useMemo(() => {
    if (!siteMetrics) return null;
    const score =
      siteMetrics.ltir < 0.5
        ? 'excellent'
        : siteMetrics.ltir < 1.0
          ? 'good'
          : siteMetrics.ltir < 2.0
            ? 'fair'
            : 'poor';
    return {
      ltir: siteMetrics.ltir,
      hoursWorked: siteMetrics.hoursWorked,
      incidents: siteMetrics.incidentsTotal,
      incidentsThisPeriod: siteMetrics.incidentsThisPeriod,
      nearMisses: siteMetrics.nearMissesThisPeriod,
      score,
    };
  }, [siteMetrics]);

  // Quality metrics
  const qualityHealth = useMemo(() => {
    if (!siteMetrics) return null;
    return {
      defectsOpen: siteMetrics.defectsOpenTotal,
      defectsClosed: siteMetrics.defectsClosedTotal,
      closureRate: siteMetrics.defectClosureRate,
      reworkCost: siteMetrics.reworkCostToDate,
    };
  }, [siteMetrics]);

  // Constraints metrics
  const constraintStatus = useMemo(() => {
    if (!siteMetrics) return null;
    return {
      openRfis: siteMetrics.openRfis,
      avgRfiResponse: siteMetrics.avgRfiResponseDays,
      openConstraints: siteMetrics.openConstraints,
      clearedThisWeek: siteMetrics.constraintsClearedThisWeek,
    };
  }, [siteMetrics]);

  // Risk counts
  const riskCounts = useMemo(() => {
    if (!selectedProject) return { high: 0, medium: 0, low: 0 };
    const activeRisks = selectedProject.risks.filter((r) => r.status !== 'closed');
    return {
      high: activeRisks.filter((r) => r.score >= 12).length,
      medium: activeRisks.filter((r) => r.score >= 6 && r.score < 12).length,
      low: activeRisks.filter((r) => r.score < 6).length,
    };
  }, [selectedProject]);

  const fmt = (amount: number) => formatCurrency(amount, currency);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Goedemorgen';
    if (hour < 18) return 'Goedemiddag';
    return 'Goedenavond';
  };

  const getSafetyColor = (score: string) => {
    switch (score) {
      case 'excellent':
      case 'good':
        return Palette.success;
      case 'fair':
        return Palette.warning;
      default:
        return Palette.error;
    }
  };

  const getProgressStatusColor = (status: string) => {
    switch (status) {
      case 'on-track':
        return Palette.success;
      case 'at-risk':
        return Palette.warning;
      default:
        return Palette.error;
    }
  };

  if (!selectedProject || !siteMetrics || !progressHealth || !safetyHealth || !qualityHealth || !constraintStatus) {
    return (
      <View style={styles.container}>
        <Text style={styles.headerTitle}>Site Lead Dashboard</Text>
        <Text style={styles.emptyText}>Selecteer een project om te beginnen</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()}, {user?.name?.split(' ')[0] || 'Site Lead'}</Text>
          <Text style={styles.headerSubtitle}>Site overzicht</Text>
        </View>
        <View style={[styles.headerAccent, { backgroundColor: SITE_LEAD_COLOR }]} />
      </View>

      {/* Project Selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.projectScroller}>
        {mockProjects.filter((p) => mockSiteMetrics[p.id]).map((project) => (
          <Pressable
            key={project.id}
            style={[
              styles.projectPill,
              selectedProjectId === project.id && styles.projectPillActive,
            ]}
            onPress={() => setSelectedProjectId(project.id)}
          >
            <Text style={styles.projectCountry}>{project.country}</Text>
            <Text
              style={[
                styles.projectName,
                selectedProjectId === project.id && styles.projectNameActive,
              ]}
              numberOfLines={1}
            >
              {project.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Snelle acties</Text>
        <View style={styles.quickActionsRow}>
          <QuickAction
            icon="document-text"
            label="Dagrapport"
            onPress={() => router.push('/(hub)/documents')}
          />
          <QuickAction
            icon="shield-checkmark"
            label="Veiligheid"
            badge={safetyHealth.incidentsThisPeriod}
            onPress={() => router.push('/(hub)/safety')}
          />
          <QuickAction
            icon="alert-circle"
            label="Escalatie"
            badge={riskCounts.high}
            onPress={() => router.push('/(hub)/risks')}
          />
          <QuickAction
            icon="chatbubbles"
            label="RFI's"
            badge={constraintStatus.openRfis > 10 ? constraintStatus.openRfis : undefined}
            onPress={() => router.push('/(hub)/rfis')}
          />
        </View>
      </View>

      {/* Progress Banner */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Voortgang</Text>
        <View
          style={[
            styles.progressBanner,
            { backgroundColor: getProgressStatusColor(progressHealth.status) + '15' },
          ]}
        >
          <View style={styles.progressBannerLeft}>
            <Text style={styles.progressBannerStatus}>
              {progressHealth.status === 'on-track'
                ? 'Op Schema'
                : progressHealth.status === 'at-risk'
                  ? 'Risico'
                  : 'Achter Schema'}
            </Text>
            <Text style={styles.progressBannerVariance}>
              {progressHealth.variance > 0 ? '+' : ''}
              {progressHealth.variance}% t.o.v. plan
            </Text>
          </View>
          <View
            style={[
              styles.progressCircle,
              { borderColor: getProgressStatusColor(progressHealth.status) },
            ]}
          >
            <Text style={styles.progressCircleValue}>{progressHealth.actual}%</Text>
          </View>
        </View>

        {/* Progress Bars */}
        <View style={styles.progressBars}>
          <View style={styles.progressBarRow}>
            <Text style={styles.progressBarLabel}>Actueel</Text>
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${progressHealth.actual}%`, backgroundColor: SITE_LEAD_COLOR },
                ]}
              />
            </View>
            <Text style={styles.progressBarValue}>{progressHealth.actual}%</Text>
          </View>
          <View style={styles.progressBarRow}>
            <Text style={styles.progressBarLabel}>Gepland</Text>
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${progressHealth.planned}%`, backgroundColor: SemanticColors.textTertiary },
                ]}
              />
            </View>
            <Text style={styles.progressBarValue}>{progressHealth.planned}%</Text>
          </View>
        </View>
      </View>

      {/* Safety Card */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Veiligheid</Text>
          <View
            style={[
              styles.safetyBadge,
              { backgroundColor: getSafetyColor(safetyHealth.score) + '20' },
            ]}
          >
            <Text style={[styles.safetyBadgeText, { color: getSafetyColor(safetyHealth.score) }]}>
              {safetyHealth.score.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          {/* LTIR Banner */}
          <View style={styles.ltirBanner}>
            <View>
              <Text style={styles.ltirLabel}>LTIR</Text>
              <Text style={styles.ltirSubtext}>Lost Time Injury Rate</Text>
            </View>
            <Text style={[styles.ltirValue, { color: getSafetyColor(safetyHealth.score) }]}>
              {safetyHealth.ltir.toFixed(2)}
            </Text>
          </View>

          {/* Safety Metrics Grid */}
          <View style={styles.metricsGrid}>
            <MetricTile
              label="Gewerkte uren"
              value={safetyHealth.hoursWorked.toLocaleString()}
              subtitle="totaal"
            />
            <MetricTile
              label="Incidenten"
              value={safetyHealth.incidents}
              subtitle="totaal"
              alert={safetyHealth.incidents > 0}
            />
            <MetricTile
              label="Deze periode"
              value={safetyHealth.incidentsThisPeriod}
              subtitle="incidenten"
              alert={safetyHealth.incidentsThisPeriod > 0}
            />
            <MetricTile
              label="Near misses"
              value={safetyHealth.nearMisses}
              subtitle="deze week"
            />
          </View>
        </View>
      </View>

      {/* Quality Card */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Kwaliteit</Text>
        <View style={styles.card}>
          <View style={styles.metricsGrid}>
            <MetricTile
              label="Open gebreken"
              value={qualityHealth.defectsOpen}
              alert={qualityHealth.defectsOpen > 20}
            />
            <MetricTile
              label="Gesloten"
              value={qualityHealth.defectsClosed}
            />
            <MetricTile
              label="Afsluitingspercentage"
              value={formatPercent(qualityHealth.closureRate)}
              trend={qualityHealth.closureRate >= 0.8 ? 'up' : 'down'}
            />
            <MetricTile
              label="Herstelkosten"
              value={fmt(qualityHealth.reworkCost)}
            />
          </View>
        </View>
      </View>

      {/* Constraints & RFIs Card */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Beperkingen & RFI's</Text>
        <View style={styles.card}>
          <View style={styles.metricsGrid}>
            <MetricTile
              label="Open RFI's"
              value={constraintStatus.openRfis}
              alert={constraintStatus.openRfis > 15}
            />
            <MetricTile
              label="Gem. responstijd"
              value={`${constraintStatus.avgRfiResponse}d`}
              subtitle={constraintStatus.avgRfiResponse > 3 ? 'boven target' : 'binnen target'}
              alert={constraintStatus.avgRfiResponse > 3}
            />
            <MetricTile
              label="Open beperkingen"
              value={constraintStatus.openConstraints}
            />
            <MetricTile
              label="Opgelost"
              value={constraintStatus.clearedThisWeek}
              subtitle="deze week"
              trend="up"
            />
          </View>
        </View>
      </View>

      {/* Risks Overview */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Risico overzicht</Text>
        <View style={styles.statusRow}>
          <StatusPill label="Hoog" count={riskCounts.high} color={Palette.error} />
          <StatusPill label="Middel" count={riskCounts.medium} color={Palette.warning} />
          <StatusPill label="Laag" count={riskCounts.low} color={Palette.success} />
        </View>

        {/* High priority risks list */}
        {selectedProject.risks
          .filter((r) => r.status !== 'closed' && r.score >= 12)
          .slice(0, 3)
          .map((risk) => (
            <View key={risk.id} style={styles.riskItem}>
              <View style={styles.riskScoreBadge}>
                <Text style={styles.riskScoreText}>{risk.score}</Text>
              </View>
              <View style={styles.riskContent}>
                <Text style={styles.riskCategory}>{risk.category}</Text>
                <Text style={styles.riskDescription} numberOfLines={2}>
                  {risk.description}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
            </View>
          ))}
      </View>

      {/* Hub Navigation Cards */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Site Management</Text>
        <View style={styles.hubGrid}>
          <Pressable style={styles.hubCard} onPress={() => router.push('/(hub)/safety')}>
            <View style={[styles.hubIconWrap, { backgroundColor: Palette.error + '15' }]}>
              <Ionicons name="shield-checkmark" size={24} color={Palette.error} />
            </View>
            <Text style={styles.hubCardTitle}>Veiligheid</Text>
            <Text style={styles.hubCardSubtitle}>Incidenten & inspectie</Text>
          </Pressable>

          <Pressable style={styles.hubCard} onPress={() => router.push('/(hub)/quality')}>
            <View style={[styles.hubIconWrap, { backgroundColor: Palette.warning + '15' }]}>
              <Ionicons name="checkmark-done-circle" size={24} color={Palette.warning} />
            </View>
            <Text style={styles.hubCardTitle}>Kwaliteit</Text>
            <Text style={styles.hubCardSubtitle}>Gebreken & snaglijst</Text>
          </Pressable>

          <Pressable style={styles.hubCard} onPress={() => router.push('/(hub)/rfis')}>
            <View style={[styles.hubIconWrap, { backgroundColor: SITE_LEAD_COLOR + '15' }]}>
              <Ionicons name="help-circle" size={24} color={SITE_LEAD_COLOR} />
            </View>
            <Text style={styles.hubCardTitle}>RFI's</Text>
            <Text style={styles.hubCardSubtitle}>Informatieverzoeken</Text>
          </Pressable>

          <Pressable style={styles.hubCard} onPress={() => router.push('/(hub)/documents')}>
            <View style={[styles.hubIconWrap, { backgroundColor: Palette.success + '15' }]}>
              <Ionicons name="document-text" size={24} color={Palette.success} />
            </View>
            <Text style={styles.hubCardTitle}>Documenten</Text>
            <Text style={styles.hubCardSubtitle}>Rapporten & formulieren</Text>
          </Pressable>
        </View>
      </View>

      {/* Bottom Spacing */}
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

// -----------------------------------------------------------------------------
// STYLES
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  content: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    padding: 20,
  },
  headerAccent: {
    width: 8,
    height: 40,
    borderRadius: 4,
  },
  emptyText: {
    fontSize: 14,
    color: SemanticColors.textTertiary,
    padding: 20,
  },
  projectScroller: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  projectPill: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 10,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    minWidth: 120,
  },
  projectPillActive: {
    borderColor: SITE_LEAD_COLOR,
    backgroundColor: SITE_LEAD_COLOR + '10',
  },
  projectCountry: {
    fontSize: 10,
    fontWeight: '700',
    color: SITE_LEAD_COLOR,
    marginBottom: 2,
  },
  projectName: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  projectNameActive: {
    color: SemanticColors.textPrimary,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    marginBottom: 12,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickAction: {
    flex: 1,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  quickActionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SITE_LEAD_COLOR + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Palette.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  quickActionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    textAlign: 'center',
  },
  card: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  progressBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  progressBannerLeft: {},
  progressBannerStatus: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  progressBannerVariance: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  progressCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    backgroundColor: SemanticColors.surfacePrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCircleValue: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  progressBars: {
    gap: 12,
  },
  progressBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBarLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    width: 60,
  },
  progressBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressBarValue: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    width: 40,
    textAlign: 'right',
  },
  safetyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  safetyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  ltirBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  ltirLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  ltirSubtext: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  ltirValue: {
    fontSize: 32,
    fontWeight: '700',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricTile: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 12,
    padding: 14,
  },
  metricTileAlert: {
    backgroundColor: Palette.error + '10',
  },
  metricLabel: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    marginBottom: 6,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  metricValueAlert: {
    color: Palette.error,
  },
  metricSubtitle: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
    marginTop: 4,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  statusPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  statusPillCount: {
    fontSize: 18,
    fontWeight: '700',
  },
  statusPillLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  riskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 12,
  },
  riskScoreBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Palette.error + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  riskScoreText: {
    fontSize: 14,
    fontWeight: '700',
    color: Palette.error,
  },
  riskContent: {
    flex: 1,
  },
  riskCategory: {
    fontSize: 10,
    fontWeight: '700',
    color: SITE_LEAD_COLOR,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  riskDescription: {
    fontSize: 13,
    color: SemanticColors.textPrimary,
  },
  hubGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  hubCard: {
    width: '48%',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  hubIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  hubCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    marginBottom: 4,
  },
  hubCardSubtitle: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  bottomSpacer: {
    height: 40,
  },
});

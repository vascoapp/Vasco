// =============================================================================
// VASCO INTELLIGENCE — Effectiveness Dashboard
// =============================================================================
// Shows how the AI learns from the contractor's behavior:
// - Generator engagement rates (which insights are valued)
// - Calibration accuracy scores
// - Daily insight budget usage
// - Learning profile stats
// =============================================================================

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { useLearningProfile, getEngagementRate, getRemainingDailyBudget } from '../../src/intelligence/learningStorage';
import { useCalibrationScores } from '../../src/intelligence/calibration';

// Generator display names (Dutch)
const GENERATOR_LABELS: Record<string, string> = {
  'overdue-invoice': 'Verlopen facturen',
  'savings-opportunity': 'Besparingskansen',
  'margin-drift': 'Marge-erosie',
  'compliance-alert': 'Compliance waarschuwing',
  'labor-efficiency': 'Arbeid effici\u00ebntie',
  'estimation-calibration': 'Schattingskalibratie',
  'dso-trend': 'DSO trend',
  'cert-expiry': 'Certificaat verlopen',
  'supplier-price': 'Leveranciersprijzen',
  'weather-schedule': 'Weer & planning',
  'daily-planning': 'Dagplanning',
  'cross-service': 'Cross-service inzichten',
  'cash-gap': 'Kasgat waarschuwing',
  'capacity': 'Capaciteit',
  'goal-progress': 'Doelvoortgang',
  'profitability': 'Winstgevendheid',
  'financial-audit': 'Financieel audit',
  'static-tip': 'Vasco tips',
  'smart-pricing': 'Slimme prijzen',
};

const GENERATOR_ICONS: Record<string, string> = {
  'overdue-invoice': 'receipt',
  'savings-opportunity': 'pricetag',
  'margin-drift': 'trending-down',
  'compliance-alert': 'shield-checkmark',
  'labor-efficiency': 'people',
  'estimation-calibration': 'calculator',
  'dso-trend': 'timer',
  'cert-expiry': 'document',
  'supplier-price': 'cart',
  'weather-schedule': 'cloudy',
  'daily-planning': 'calendar',
  'cross-service': 'git-network',
  'cash-gap': 'wallet',
  'capacity': 'bar-chart',
  'goal-progress': 'trophy',
  'profitability': 'stats-chart',
  'financial-audit': 'search',
  'static-tip': 'bulb',
  'smart-pricing': 'flash',
};

export default function IntelligenceDashboard() {
  const { profile, loading: profileLoading } = useLearningProfile();
  const { scores, loading: scoresLoading, overallAccuracy } = useCalibrationScores();

  const dailyBudgetRemaining = getRemainingDailyBudget(profile);
  const dailyBudgetUsed = 20 - dailyBudgetRemaining;

  // Compute engagement rates for all known generators
  const generatorIds = Object.keys(GENERATOR_LABELS);
  const engagementRates = generatorIds.map(id => ({
    id,
    label: GENERATOR_LABELS[id],
    icon: GENERATOR_ICONS[id] || 'bulb',
    rate: getEngagementRate(profile, id),
    isActioned: profile.actionedPatterns.includes(id),
    isDismissed: profile.dismissedPatterns.includes(id),
  })).sort((a, b) => b.rate - a.rate);

  // Separate top performers from ignored
  const topPerformers = engagementRates.filter(g => g.rate > 0.5 && !g.isDismissed);
  const ignored = engagementRates.filter(g => g.isDismissed);

  // Stats
  const totalInteractions = profile.insightInteractions.length;
  const totalActed = profile.insightInteractions.filter(i => i.action === 'acted').length;
  const totalDismissed = profile.insightInteractions.filter(i => i.action === 'dismissed').length;
  const totalExpanded = profile.insightInteractions.filter(i => i.action === 'expanded').length;

  const loading = profileLoading || scoresLoading;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="sparkles" size={24} color={Palette.hermesOrange} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Vasco Intelligence</Text>
          <Text style={styles.headerSubtitle}>
            Hoe de AI leert van jouw gedrag
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingState}>
          <Text style={styles.loadingText}>Profiel laden...</Text>
        </View>
      ) : (
        <>
          {/* Overall Stats */}
          <View style={styles.statsRow}>
            <StatCard
              label="Interacties"
              value={totalInteractions.toString()}
              icon="pulse"
              color={Palette.blue500}
            />
            <StatCard
              label="Nauwkeurigheid"
              value={`${Math.round(overallAccuracy * 100)}%`}
              icon="checkmark-circle"
              color={Palette.green500}
            />
            <StatCard
              label="Budget vandaag"
              value={`${dailyBudgetUsed}/20`}
              icon="today"
              color={Palette.hermesOrange}
            />
          </View>

          {/* Interaction Breakdown */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Interacties overzicht</Text>
            <View style={styles.breakdownCard}>
              <BreakdownRow label="Actie ondernomen" count={totalActed} total={totalInteractions} color={Palette.green500} />
              <BreakdownRow label="Uitgeklapt" count={totalExpanded} total={totalInteractions} color={Palette.blue500} />
              <BreakdownRow label="Weggeklikt" count={totalDismissed} total={totalInteractions} color={Palette.red500} />
            </View>
          </View>

          {/* Calibration Scores */}
          {scores.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Voorspellingsnauwkeurigheid</Text>
              <Text style={styles.sectionSubtitle}>
                Hoe goed voorspellen de generators hun uitkomsten?
              </Text>
              {scores.map(score => (
                <View key={score.generatorId} style={styles.calibrationRow}>
                  <View style={styles.calibrationInfo}>
                    <Ionicons
                      name={(GENERATOR_ICONS[score.generatorId] || 'analytics') as any}
                      size={16}
                      color={SemanticColors.textSecondary}
                    />
                    <Text style={styles.calibrationLabel} numberOfLines={1}>
                      {GENERATOR_LABELS[score.generatorId] || score.generatorId}
                    </Text>
                  </View>
                  <View style={styles.calibrationMetrics}>
                    <Text style={styles.calibrationCount}>
                      {score.resolvedPredictions}/{score.totalPredictions}
                    </Text>
                    <View style={[
                      styles.accuracyBadge,
                      {
                        backgroundColor: score.accuracyRate >= 0.7
                          ? Palette.green500 + '20'
                          : score.accuracyRate >= 0.5
                          ? Palette.orange500 + '20'
                          : Palette.red500 + '20',
                      },
                    ]}>
                      <Text style={[
                        styles.accuracyText,
                        {
                          color: score.accuracyRate >= 0.7
                            ? Palette.green500
                            : score.accuracyRate >= 0.5
                            ? Palette.orange500
                            : Palette.red500,
                        },
                      ]}>
                        {Math.round(score.accuracyRate * 100)}%
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Top Performing Generators */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Meest waardevolle inzichten</Text>
            <Text style={styles.sectionSubtitle}>
              Generators waar je het vaakst actie op onderneemt
            </Text>
            {topPerformers.length > 0 ? (
              topPerformers.slice(0, 5).map(g => (
                <View key={g.id} style={styles.generatorRow}>
                  <View style={[styles.generatorIcon, { backgroundColor: Palette.green500 + '15' }]}>
                    <Ionicons name={g.icon as any} size={16} color={Palette.green500} />
                  </View>
                  <View style={styles.generatorInfo}>
                    <Text style={styles.generatorLabel}>{g.label}</Text>
                    <View style={styles.rateBar}>
                      <View style={[styles.rateFill, { width: `${Math.round(g.rate * 100)}%`, backgroundColor: Palette.green500 }]} />
                    </View>
                  </View>
                  <Text style={styles.ratePercent}>{Math.round(g.rate * 100)}%</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>
                Nog geen data. Gebruik de app om het profiel op te bouwen.
              </Text>
            )}
          </View>

          {/* Ignored / Dismissed Generators */}
          {ignored.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Onderdrukte inzichten</Text>
              <Text style={styles.sectionSubtitle}>
                Generators die je 3+ keer hebt weggeklikt (worden minder vaak getoond)
              </Text>
              {ignored.map(g => (
                <View key={g.id} style={styles.generatorRow}>
                  <View style={[styles.generatorIcon, { backgroundColor: Palette.red500 + '15' }]}>
                    <Ionicons name={g.icon as any} size={16} color={Palette.red500} />
                  </View>
                  <View style={styles.generatorInfo}>
                    <Text style={[styles.generatorLabel, { color: SemanticColors.textSecondary }]}>{g.label}</Text>
                  </View>
                  <Ionicons name="volume-mute" size={16} color={Palette.red500} />
                </View>
              ))}
            </View>
          )}

          {/* Screen Usage */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Schermgebruik</Text>
            <Text style={styles.sectionSubtitle}>
              Hoe vaak je elk scherm bezoekt
            </Text>
            <View style={styles.screenGrid}>
              {Object.entries(profile.serviceUsageStats)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([screen, count]) => (
                  <View key={screen} style={styles.screenCard}>
                    <Text style={styles.screenCount}>{count}</Text>
                    <Text style={styles.screenLabel}>{screen}</Text>
                  </View>
                ))}
            </View>
            {Object.keys(profile.serviceUsageStats).length === 0 && (
              <Text style={styles.emptyText}>
                Nog geen schermbezoeken bijgehouden.
              </Text>
            )}
          </View>

          {/* Privacy Notice */}
          <View style={styles.privacyNotice}>
            <Ionicons name="lock-closed" size={14} color={SemanticColors.textSecondary} />
            <Text style={styles.privacyText}>
              Alle leerdata blijft op je apparaat. Niets wordt naar een server gestuurd.
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function BreakdownRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <View style={styles.breakdownRow}>
      <View style={[styles.breakdownDot, { backgroundColor: color }]} />
      <Text style={styles.breakdownLabel}>{label}</Text>
      <View style={styles.breakdownBarContainer}>
        <View style={[styles.breakdownBar, { width: `${percent}%`, backgroundColor: color + '40' }]} />
      </View>
      <Text style={styles.breakdownValue}>{count} ({percent}%)</Text>
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
  content: {
    paddingTop: SafeArea.top + Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingBottom: SafeArea.bottom + Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Palette.hermesOrange + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  loadingState: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 15,
    color: SemanticColors.textSecondary,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },

  // Sections
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginBottom: Spacing.sm,
  },

  // Breakdown
  breakdownCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breakdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  breakdownLabel: {
    fontSize: 13,
    color: SemanticColors.textPrimary,
    width: 120,
  },
  breakdownBarContainer: {
    flex: 1,
    height: 6,
    backgroundColor: SemanticColors.borderDefault,
    borderRadius: 3,
  },
  breakdownBar: {
    height: '100%',
    borderRadius: 3,
  },
  breakdownValue: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    minWidth: 60,
    textAlign: 'right',
  },

  // Calibration
  calibrationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 10,
    padding: Spacing.sm,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  calibrationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  calibrationLabel: {
    fontSize: 13,
    color: SemanticColors.textPrimary,
    flex: 1,
  },
  calibrationMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calibrationCount: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  accuracyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  accuracyText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Generator Rows
  generatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 10,
    padding: Spacing.sm,
    marginBottom: 6,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  generatorIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generatorInfo: {
    flex: 1,
  },
  generatorLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: SemanticColors.textPrimary,
    marginBottom: 4,
  },
  rateBar: {
    height: 4,
    backgroundColor: SemanticColors.borderDefault,
    borderRadius: 2,
  },
  rateFill: {
    height: '100%',
    borderRadius: 2,
  },
  ratePercent: {
    fontSize: 14,
    fontWeight: '600',
    color: Palette.green500,
    minWidth: 36,
    textAlign: 'right',
  },

  // Screen Grid
  screenGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  screenCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    minWidth: 70,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  screenCount: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  screenLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },

  emptyText: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    fontStyle: 'italic',
    paddingVertical: 12,
  },

  // Privacy
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    color: SemanticColors.textSecondary,
    lineHeight: 16,
  },
});

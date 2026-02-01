import { useState, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';
import {
  generateRiskDashboard,
  generateRiskReport,
  MOCK_RISKS,
  type Risk,
  type RiskRating,
  type RiskCategory,
  type RiskTrend,
} from '../../modules/riskRegister';
import { formatCurrency } from '../../modules/countryModules';

type TabId = 'overview' | 'register' | 'report';

const RATING_COLORS: Record<RiskRating, string> = {
  critical: Colors.danger,
  high: '#F97316',
  medium: Colors.warning,
  low: Colors.success,
};

const TREND_ICONS: Record<RiskTrend, string> = {
  improving: '↓',
  stable: '→',
  worsening: '↑',
};

const CATEGORY_LABELS: Record<RiskCategory, string> = {
  schedule: 'Schedule',
  cost: 'Cost',
  quality: 'Quality',
  safety: 'Safety',
  regulatory: 'Regulatory',
  commercial: 'Commercial',
  environmental: 'Environmental',
  stakeholder: 'Stakeholder',
  'supply-chain': 'Supply Chain',
  weather: 'Weather',
};

export function RiskDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);
  const [generatedReport, setGeneratedReport] = useState<string | null>(null);

  const dashboard = useMemo(() => generateRiskDashboard(MOCK_RISKS), []);

  const handleGenerateReport = () => {
    const report = generateRiskReport(MOCK_RISKS, 'London Mixed-Use Development');
    setGeneratedReport(report);
  };

  const getRatingColor = (rating: RiskRating) => RATING_COLORS[rating];
  const getTrendColor = (trend: RiskTrend) => {
    switch (trend) {
      case 'improving':
        return Colors.success;
      case 'stable':
        return Colors.muted;
      case 'worsening':
        return Colors.danger;
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={Typography.title}>Risk Register</Text>

      {/* Risk Summary Banner */}
      <View style={styles.summaryBanner}>
        <View style={styles.summaryMain}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{dashboard.openRisks}</Text>
            <Text style={styles.summaryLabel}>Open Risks</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: Colors.danger }]}>
              {(dashboard.byRating['critical'] || 0) + (dashboard.byRating['high'] || 0)}
            </Text>
            <Text style={styles.summaryLabel}>High/Critical</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: Colors.danger }]}>
              {dashboard.worseningRisks.length}
            </Text>
            <Text style={styles.summaryLabel}>Worsening</Text>
          </View>
        </View>
        <View style={styles.exposureCard}>
          <Text style={styles.exposureLabel}>Cost Exposure</Text>
          <Text style={styles.exposureValue}>
            {formatCurrency(dashboard.totalCostExposure.min, 'GBP')} - {formatCurrency(dashboard.totalCostExposure.max, 'GBP')}
          </Text>
          <Text style={styles.exposureLabel}>Schedule Exposure</Text>
          <Text style={styles.exposureValue}>{dashboard.totalScheduleExposure} days</Text>
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabRow}>
        {(['overview', 'register', 'report'] as const).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'overview' ? 'Overview' : tab === 'register' ? 'Full Register' : 'Report'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <View style={styles.content}>
          {/* Risk Matrix */}
          <View style={styles.card}>
            <Text style={Typography.subtitle}>Risk Profile</Text>
            <View style={styles.ratingGrid}>
              {(['critical', 'high', 'medium', 'low'] as const).map((rating) => (
                <View key={rating} style={styles.ratingCard}>
                  <View
                    style={[
                      styles.ratingDot,
                      { backgroundColor: getRatingColor(rating) },
                    ]}
                  />
                  <Text style={styles.ratingValue}>{dashboard.byRating[rating] || 0}</Text>
                  <Text style={styles.ratingLabel}>{rating.charAt(0).toUpperCase() + rating.slice(1)}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Critical Risks */}
          {dashboard.criticalRisks.length > 0 && (
            <View style={styles.card}>
              <Text style={Typography.subtitle}>Critical & High Risks</Text>
              {dashboard.criticalRisks.slice(0, 4).map((risk) => (
                <Pressable
                  key={risk.id}
                  style={styles.riskRow}
                  onPress={() => setSelectedRisk(risk)}
                >
                  <View style={styles.riskInfo}>
                    <View style={styles.riskHeader}>
                      <View
                        style={[
                          styles.riskRatingBadge,
                          { backgroundColor: getRatingColor(risk.rating) + '30' },
                        ]}
                      >
                        <Text
                          style={[styles.riskRatingText, { color: getRatingColor(risk.rating) }]}
                        >
                          {risk.rating.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={[styles.trendIndicator, { color: getTrendColor(risk.trend) }]}>
                        {TREND_ICONS[risk.trend]}
                      </Text>
                    </View>
                    <Text style={styles.riskTitle}>{risk.title}</Text>
                    <Text style={styles.riskMeta}>
                      {CATEGORY_LABELS[risk.category]} | Owner: {risk.owner}
                    </Text>
                  </View>
                  <View style={styles.riskScore}>
                    <Text style={styles.riskScoreValue}>{risk.score}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {/* Worsening Risks */}
          {dashboard.worseningRisks.length > 0 && (
            <View style={styles.alertCard}>
              <Text style={styles.alertTitle}>Worsening Risks</Text>
              {dashboard.worseningRisks.slice(0, 3).map((risk) => (
                <View key={risk.id} style={styles.alertRow}>
                  <Text style={styles.trendWarning}>{TREND_ICONS.worsening}</Text>
                  <View style={styles.alertInfo}>
                    <Text style={styles.alertRiskTitle}>{risk.title}</Text>
                    <Text style={styles.alertRiskMeta}>
                      {risk.rating} | Score: {risk.score}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Overdue Mitigations */}
          {dashboard.overdueMitigations.length > 0 && (
            <View style={styles.warningCard}>
              <Text style={styles.warningTitle}>
                Overdue Mitigations ({dashboard.overdueMitigations.length})
              </Text>
              {dashboard.overdueMitigations.slice(0, 3).map(({ risk, mitigation }) => (
                <View key={mitigation.id} style={styles.warningRow}>
                  <Text style={styles.warningRisk}>{risk.title}</Text>
                  <Text style={styles.warningMitigation}>{mitigation.description}</Text>
                  <Text style={styles.warningDue}>Due: {mitigation.dueDate}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Category Breakdown */}
          <View style={styles.card}>
            <Text style={Typography.subtitle}>By Category</Text>
            <View style={styles.categoryGrid}>
              {Object.entries(dashboard.byCategory).map(([category, count]) => (
                <View key={category} style={styles.categoryItem}>
                  <Text style={styles.categoryCount}>{count}</Text>
                  <Text style={styles.categoryLabel}>
                    {CATEGORY_LABELS[category as RiskCategory] || category}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Upcoming Reviews */}
          {dashboard.upcomingReviews.length > 0 && (
            <View style={styles.card}>
              <Text style={Typography.subtitle}>Upcoming Reviews</Text>
              {dashboard.upcomingReviews.map((risk) => (
                <View key={risk.id} style={styles.reviewRow}>
                  <Text style={Typography.body}>{risk.title}</Text>
                  <Text style={styles.reviewDate}>{risk.nextReviewDate.split('T')[0]}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Register Tab */}
      {activeTab === 'register' && (
        <View style={styles.content}>
          {MOCK_RISKS.map((risk) => (
            <Pressable
              key={risk.id}
              style={styles.registerCard}
              onPress={() => setSelectedRisk(selectedRisk?.id === risk.id ? null : risk)}
            >
              <View style={styles.registerHeader}>
                <View
                  style={[
                    styles.riskRatingBadge,
                    { backgroundColor: getRatingColor(risk.rating) + '30' },
                  ]}
                >
                  <Text style={[styles.riskRatingText, { color: getRatingColor(risk.rating) }]}>
                    {risk.rating.toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.statusBadge, risk.status === 'closed' && styles.statusClosed]}>
                  {risk.status}
                </Text>
              </View>
              <Text style={styles.registerTitle}>{risk.title}</Text>
              <Text style={styles.registerDescription}>{risk.description}</Text>

              <View style={styles.registerMeta}>
                <Text style={styles.registerMetaItem}>Category: {CATEGORY_LABELS[risk.category]}</Text>
                <Text style={styles.registerMetaItem}>Owner: {risk.owner}</Text>
                <Text style={[styles.registerMetaItem, { color: getTrendColor(risk.trend) }]}>
                  Trend: {TREND_ICONS[risk.trend]} {risk.trend}
                </Text>
              </View>

              {selectedRisk?.id === risk.id && (
                <View style={styles.riskDetails}>
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Assessment</Text>
                    <Text style={styles.detailValue}>
                      Probability: {risk.probability} | Impact: {risk.impact} | Score: {risk.score}
                    </Text>
                  </View>

                  {(risk.costImpactMin || risk.costImpactMax) && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Cost Impact</Text>
                      <Text style={styles.detailValue}>
                        {formatCurrency(risk.costImpactMin || 0, 'GBP')} - {formatCurrency(risk.costImpactMax || 0, 'GBP')}
                      </Text>
                    </View>
                  )}

                  {risk.scheduleImpactDays && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Schedule Impact</Text>
                      <Text style={styles.detailValue}>{risk.scheduleImpactDays} days</Text>
                    </View>
                  )}

                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Mitigation Strategy</Text>
                    <Text style={styles.detailValue}>{risk.mitigationStrategy}</Text>
                  </View>

                  {risk.mitigations.length > 0 && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>
                        Mitigations ({risk.mitigations.length})
                      </Text>
                      {risk.mitigations.map((m) => (
                        <View key={m.id} style={styles.mitigationItem}>
                          <Text style={styles.mitigationDesc}>{m.description}</Text>
                          <Text style={styles.mitigationMeta}>
                            {m.status} | Due: {m.dueDate} | Owner: {m.owner}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {risk.earlyWarningIndicators.length > 0 && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Early Warning Indicators</Text>
                      {risk.earlyWarningIndicators.map((indicator, i) => (
                        <Text key={i} style={styles.indicatorItem}>- {indicator}</Text>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </Pressable>
          ))}
        </View>
      )}

      {/* Report Tab */}
      {activeTab === 'report' && (
        <View style={styles.content}>
          <Pressable style={styles.generateButton} onPress={handleGenerateReport}>
            <Text style={styles.generateButtonText}>Generate Risk Report</Text>
          </Pressable>

          {generatedReport && (
            <View style={styles.reportCard}>
              <ScrollView style={styles.reportContent} nestedScrollEnabled>
                <Text style={styles.reportText}>{generatedReport}</Text>
              </ScrollView>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: 100,
  },
  summaryBanner: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  summaryMain: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '700',
  },
  summaryLabel: {
    color: Colors.muted,
    fontSize: 11,
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
  },
  exposureCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.md,
    gap: 4,
  },
  exposureLabel: {
    color: Colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  exposureValue: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  tabRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: Colors.surface,
  },
  tabText: {
    color: Colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: Colors.text,
  },
  content: {
    gap: Spacing.md,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  ratingGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  ratingCard: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  ratingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  ratingValue: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  ratingLabel: {
    color: Colors.muted,
    fontSize: 10,
  },
  riskRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  riskInfo: {
    flex: 1,
    gap: 4,
  },
  riskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  riskRatingBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  riskRatingText: {
    fontSize: 9,
    fontWeight: '700',
  },
  trendIndicator: {
    fontSize: 14,
    fontWeight: '700',
  },
  riskTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  riskMeta: {
    color: Colors.muted,
    fontSize: 11,
  },
  riskScore: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riskScoreValue: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  alertCard: {
    backgroundColor: Colors.danger + '15',
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.danger + '30',
    gap: Spacing.sm,
  },
  alertTitle: {
    color: Colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.danger + '20',
  },
  trendWarning: {
    color: Colors.danger,
    fontSize: 16,
    fontWeight: '700',
  },
  alertInfo: {
    flex: 1,
  },
  alertRiskTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  alertRiskMeta: {
    color: Colors.muted,
    fontSize: 11,
  },
  warningCard: {
    backgroundColor: Colors.warning + '15',
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.warning + '30',
    gap: Spacing.sm,
  },
  warningTitle: {
    color: Colors.warning,
    fontSize: 14,
    fontWeight: '700',
  },
  warningRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.warning + '20',
    gap: 2,
  },
  warningRisk: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  warningMitigation: {
    color: Colors.muted,
    fontSize: 11,
  },
  warningDue: {
    color: Colors.warning,
    fontSize: 10,
    fontWeight: '600',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  categoryItem: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    minWidth: 80,
  },
  categoryCount: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  categoryLabel: {
    color: Colors.muted,
    fontSize: 10,
    marginTop: 2,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  reviewDate: {
    color: Colors.accentMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  registerCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  registerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    color: Colors.accentMuted,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statusClosed: {
    color: Colors.muted,
  },
  registerTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  registerDescription: {
    color: Colors.muted,
    fontSize: 12,
  },
  registerMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  registerMetaItem: {
    color: Colors.muted,
    fontSize: 11,
  },
  riskDetails: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.md,
  },
  detailSection: {
    gap: 4,
  },
  detailLabel: {
    color: Colors.accentMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  detailValue: {
    color: Colors.text,
    fontSize: 12,
  },
  mitigationItem: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 8,
    padding: Spacing.sm,
    marginTop: 4,
  },
  mitigationDesc: {
    color: Colors.text,
    fontSize: 12,
  },
  mitigationMeta: {
    color: Colors.muted,
    fontSize: 10,
    marginTop: 4,
  },
  indicatorItem: {
    color: Colors.text,
    fontSize: 11,
    paddingLeft: 8,
  },
  generateButton: {
    backgroundColor: Colors.accentDeep,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  generateButtonText: {
    color: '#0B0C0F',
    fontSize: 14,
    fontWeight: '700',
  },
  reportCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reportContent: {
    maxHeight: 500,
    padding: Spacing.md,
  },
  reportText: {
    color: Colors.text,
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
});

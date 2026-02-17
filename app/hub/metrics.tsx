// Hub: Metrics & KPIs - Platform performance and project metrics
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';
import { InlineInsight, VascoInsightCard } from '../../src/components/shared/VascoInsightCard';
import { useVascoGuidance, useInlineInsight } from '../../src/services/vascoGuidanceService';

type IconName = keyof typeof Ionicons.glyphMap;

interface MetricData {
  label: string;
  value: string;
  trend: 'up' | 'down' | 'neutral';
  trendValue: string;
  icon: IconName;
  color: string;
}

const PLATFORM_METRICS: MetricData[] = [
  { label: 'Uren bespaard', value: '127h', trend: 'up', trendValue: '+18%', icon: 'time', color: Palette.hermesOrange },
  { label: 'Waarde geleverd', value: '£48K', trend: 'up', trendValue: '+23%', icon: 'cash', color: SemanticColors.feedbackSuccess },
  { label: 'AI Acties', value: '156', trend: 'up', trendValue: '+12%', icon: 'flash', color: '#8B5CF6' },
  { label: 'Document nauwkeurigheid', value: '92%', trend: 'up', trendValue: '+3%', icon: 'document-text', color: SemanticColors.feedbackInfo },
];

const PROJECT_KPIS: { label: string; value: string; target: string; onTrack: boolean }[] = [
  { label: 'Gemiddelde SPI', value: '0.94', target: '≥ 0.95', onTrack: false },
  { label: 'Gemiddelde CPI', value: '0.98', target: '≥ 0.95', onTrack: true },
  { label: 'DSO Reductie', value: '4.2 dagen', target: '≥ 3 dagen', onTrack: true },
  { label: 'Handover compleetheid', value: '87%', target: '≥ 90%', onTrack: false },
  { label: 'Leverancier betrouwbaarheid', value: 'B+', target: '≥ B', onTrack: true },
  { label: 'Compliance score', value: '96%', target: '≥ 95%', onTrack: true },
];

const ROI_ITEMS: { label: string; value: string }[] = [
  { label: 'Admin tijdsbesparing', value: '£28.5K' },
  { label: 'Snellere incasso', value: '£12.4K' },
  { label: 'Foutpreventie', value: '£7.1K' },
];

function getTrendIcon(trend: string): IconName {
  switch (trend) {
    case 'up': return 'trending-up';
    case 'down': return 'trending-down';
    default: return 'remove';
  }
}

function getTrendColor(trend: string): string {
  switch (trend) {
    case 'up': return SemanticColors.feedbackSuccess;
    case 'down': return SemanticColors.feedbackError;
    default: return SemanticColors.textTertiary;
  }
}

export default function MetricsScreen() {
  const insights = useVascoGuidance('director', 'director-metrics');
  const inlineTip = useInlineInsight('director', 'director-metrics', 'overview');
  const topInsight = insights[0] ?? null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Platform Performance */}
      <View style={styles.sectionHeader}>
        <Ionicons name="rocket" size={16} color={Palette.hermesOrange} />
        <Text style={styles.sectionTitle}>Platform Prestaties</Text>
      </View>

      <View style={styles.metricsGrid}>
        {PLATFORM_METRICS.map(metric => (
          <View key={metric.label} style={styles.metricCard}>
            <View style={[styles.metricIconContainer, { backgroundColor: metric.color + '15' }]}>
              <Ionicons name={metric.icon} size={20} color={metric.color} />
            </View>
            <Text style={styles.metricValue}>{metric.value}</Text>
            <Text style={styles.metricLabel}>{metric.label}</Text>
            <View style={styles.trendRow}>
              <Ionicons name={getTrendIcon(metric.trend)} size={12} color={getTrendColor(metric.trend)} />
              <Text style={[styles.trendText, { color: getTrendColor(metric.trend) }]}>{metric.trendValue}</Text>
            </View>
          </View>
        ))}
      </View>

      {inlineTip && <InlineInsight icon={inlineTip.icon as IconName} message={inlineTip.message} />}
      {topInsight && <VascoInsightCard insight={topInsight} compact />}

      {/* ROI Breakdown */}
      <View style={styles.sectionHeader}>
        <Ionicons name="cash" size={16} color={SemanticColors.feedbackSuccess} />
        <Text style={styles.sectionTitle}>ROI Breakdown</Text>
      </View>

      <View style={styles.roiCard}>
        {ROI_ITEMS.map((item, i) => (
          <View key={item.label} style={[styles.roiRow, i > 0 && styles.roiRowBorder]}>
            <Text style={styles.roiLabel}>{item.label}</Text>
            <Text style={styles.roiValue}>{item.value}</Text>
          </View>
        ))}
        <View style={[styles.roiRow, styles.roiRowBorder, styles.roiTotal]}>
          <Text style={styles.roiTotalLabel}>Totaal</Text>
          <Text style={styles.roiTotalValue}>£48.0K</Text>
        </View>
      </View>

      {/* Project KPIs */}
      <View style={styles.sectionHeader}>
        <Ionicons name="analytics" size={16} color={SemanticColors.feedbackInfo} />
        <Text style={styles.sectionTitle}>Project KPIs</Text>
      </View>

      <View style={styles.kpiCard}>
        {PROJECT_KPIS.map((kpi, i) => (
          <View key={kpi.label} style={[styles.kpiRow, i > 0 && styles.kpiRowBorder]}>
            <View style={styles.kpiInfo}>
              <Text style={styles.kpiLabel}>{kpi.label}</Text>
              <Text style={styles.kpiTarget}>Target: {kpi.target}</Text>
            </View>
            <View style={styles.kpiValueRow}>
              <Text style={styles.kpiValue}>{kpi.value}</Text>
              <Ionicons
                name={kpi.onTrack ? 'checkmark-circle' : 'alert-circle'}
                size={16}
                color={kpi.onTrack ? SemanticColors.feedbackSuccess : SemanticColors.feedbackWarning}
              />
            </View>
          </View>
        ))}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SemanticColors.surfaceBackground },
  content: { padding: Spacing.md, gap: Spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.xs },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: SemanticColors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  metricCard: { width: '48%', backgroundColor: SemanticColors.surfacePrimary, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: SemanticColors.borderDefault, gap: 4 },
  metricIconContainer: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  metricValue: { fontSize: 22, fontWeight: '700', color: SemanticColors.textPrimary },
  metricLabel: { fontSize: 12, color: SemanticColors.textTertiary },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  trendText: { fontSize: 12, fontWeight: '600' },
  roiCard: { backgroundColor: SemanticColors.surfacePrimary, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: SemanticColors.borderDefault },
  roiRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  roiRowBorder: { borderTopWidth: 1, borderTopColor: SemanticColors.borderMuted },
  roiLabel: { fontSize: 14, color: SemanticColors.textSecondary },
  roiValue: { fontSize: 14, fontWeight: '600', color: SemanticColors.textPrimary },
  roiTotal: { marginTop: 4 },
  roiTotalLabel: { fontSize: 14, fontWeight: '700', color: SemanticColors.textPrimary },
  roiTotalValue: { fontSize: 16, fontWeight: '700', color: SemanticColors.feedbackSuccess },
  kpiCard: { backgroundColor: SemanticColors.surfacePrimary, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: SemanticColors.borderDefault },
  kpiRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  kpiRowBorder: { borderTopWidth: 1, borderTopColor: SemanticColors.borderMuted },
  kpiInfo: { flex: 1 },
  kpiLabel: { fontSize: 14, color: SemanticColors.textPrimary, fontWeight: '500' },
  kpiTarget: { fontSize: 11, color: SemanticColors.textTertiary, marginTop: 1 },
  kpiValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kpiValue: { fontSize: 14, fontWeight: '700', color: SemanticColors.textPrimary },
});

// Hub: Appraisal - Development appraisal overview
import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';
import { InlineInsight, VascoInsightCard } from '../../src/components/shared/VascoInsightCard';
import { useVascoGuidance, useInlineInsight } from '../../src/services/vascoGuidanceService';

type IconName = keyof typeof Ionicons.glyphMap;

interface AppraisalProject {
  id: string;
  name: string;
  country: string;
  gdv: number;
  totalCost: number;
  profit: number;
  irr: number;
  equityMultiple: number;
  status: 'green' | 'amber' | 'red';
}

const MOCK_APPRAISALS: AppraisalProject[] = [
  { id: 'p1', name: 'Riverside Quarter', country: '🇬🇧', gdv: 18500000, totalCost: 14200000, profit: 4300000, irr: 22.1, equityMultiple: 1.95, status: 'green' },
  { id: 'p2', name: 'Oak Gardens', country: '🇬🇧', gdv: 12800000, totalCost: 10100000, profit: 2700000, irr: 19.8, equityMultiple: 1.72, status: 'amber' },
  { id: 'p3', name: 'Harbour View', country: '🇳🇱', gdv: 8400000, totalCost: 6100000, profit: 2300000, irr: 24.5, equityMultiple: 2.1, status: 'green' },
  { id: 'p4', name: 'Stadtmitte Residenz', country: '🇩🇪', gdv: 5500000, totalCost: 4200000, profit: 1300000, irr: 21.2, equityMultiple: 1.65, status: 'green' },
];

function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `£${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `£${(amount / 1000).toFixed(0)}K`;
  return `£${amount}`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'green': return SemanticColors.feedbackSuccess;
    case 'amber': return SemanticColors.feedbackWarning;
    case 'red': return SemanticColors.feedbackError;
    default: return SemanticColors.textTertiary;
  }
}

export default function AppraisalScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const insights = useVascoGuidance('cfo', 'cfo-appraisal');
  const inlineTip = useInlineInsight('cfo', 'cfo-appraisal', 'overview');
  const topInsight = insights[0] ?? null;

  const totals = MOCK_APPRAISALS.reduce((acc, p) => ({
    gdv: acc.gdv + p.gdv,
    cost: acc.cost + p.totalCost,
    profit: acc.profit + p.profit,
  }), { gdv: 0, cost: 0, profit: 0 });

  const avgIrr = MOCK_APPRAISALS.reduce((s, p) => s + p.irr, 0) / MOCK_APPRAISALS.length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Portfolio Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Portfolio Taxatie</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{formatCurrency(totals.gdv)}</Text>
            <Text style={styles.summaryLabel}>Totaal GDV</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{formatCurrency(totals.profit)}</Text>
            <Text style={styles.summaryLabel}>Totale Winst</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{avgIrr.toFixed(1)}%</Text>
            <Text style={styles.summaryLabel}>Gem. IRR</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{MOCK_APPRAISALS.length}</Text>
            <Text style={styles.summaryLabel}>Projecten</Text>
          </View>
        </View>
      </View>

      {inlineTip && <InlineInsight icon={inlineTip.icon as IconName} message={inlineTip.message} />}
      {topInsight && <VascoInsightCard insight={topInsight} compact />}

      {/* Project Appraisals */}
      {MOCK_APPRAISALS.map(project => (
        <Pressable
          key={project.id}
          style={[styles.projectCard, selectedId === project.id && styles.projectCardSelected]}
          onPress={() => setSelectedId(selectedId === project.id ? null : project.id)}
        >
          <View style={styles.projectHeader}>
            <View style={styles.projectNameRow}>
              <Text style={styles.projectFlag}>{project.country}</Text>
              <Text style={styles.projectName}>{project.name}</Text>
            </View>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(project.status) }]} />
          </View>

          <View style={styles.projectMetrics}>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{formatCurrency(project.gdv)}</Text>
              <Text style={styles.metricLabel}>GDV</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, { color: Palette.hermesOrange }]}>{project.irr}%</Text>
              <Text style={styles.metricLabel}>IRR</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{project.equityMultiple}x</Text>
              <Text style={styles.metricLabel}>Equity Multiple</Text>
            </View>
          </View>

          {selectedId === project.id && (
            <View style={styles.expandedDetail}>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Totale kosten</Text>
                <Text style={styles.detailValue}>{formatCurrency(project.totalCost)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Verwachte winst</Text>
                <Text style={[styles.detailValue, { color: SemanticColors.feedbackSuccess }]}>{formatCurrency(project.profit)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Winstmarge</Text>
                <Text style={styles.detailValue}>{((project.profit / project.gdv) * 100).toFixed(1)}%</Text>
              </View>
            </View>
          )}
        </Pressable>
      ))}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SemanticColors.surfaceBackground },
  content: { padding: Spacing.md, gap: Spacing.md },
  summaryCard: { backgroundColor: SemanticColors.surfacePrimary, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: SemanticColors.borderDefault, gap: Spacing.md },
  summaryTitle: { fontSize: 14, fontWeight: '600', color: SemanticColors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  summaryItem: { width: '47%', backgroundColor: SemanticColors.surfaceSecondary, borderRadius: 8, padding: Spacing.sm },
  summaryValue: { fontSize: 18, fontWeight: '700', color: SemanticColors.textPrimary },
  summaryLabel: { fontSize: 11, color: SemanticColors.textTertiary, marginTop: 2 },
  projectCard: { backgroundColor: SemanticColors.surfacePrimary, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: SemanticColors.borderDefault, gap: Spacing.sm },
  projectCardSelected: { borderColor: Palette.hermesOrange + '50' },
  projectHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  projectNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  projectFlag: { fontSize: 18 },
  projectName: { fontSize: 16, fontWeight: '600', color: SemanticColors.textPrimary },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  projectMetrics: { flexDirection: 'row', gap: Spacing.md },
  metricItem: { flex: 1 },
  metricValue: { fontSize: 16, fontWeight: '700', color: SemanticColors.textPrimary },
  metricLabel: { fontSize: 11, color: SemanticColors.textTertiary, marginTop: 1 },
  expandedDetail: { gap: 8 },
  detailDivider: { height: 1, backgroundColor: SemanticColors.borderMuted, marginVertical: 4 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { fontSize: 13, color: SemanticColors.textSecondary },
  detailValue: { fontSize: 14, fontWeight: '600', color: SemanticColors.textPrimary },
});

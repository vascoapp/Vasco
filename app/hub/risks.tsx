// Hub: Risks - Risk register with portfolio risk overview
import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';
import { InlineInsight, VascoInsightCard } from '../../src/components/shared/VascoInsightCard';
import { useVascoGuidance, useInlineInsight } from '../../src/services/vascoGuidanceService';

type IconName = keyof typeof Ionicons.glyphMap;

interface RiskItem {
  id: string;
  title: string;
  description: string;
  project: string;
  category: string;
  likelihood: 'low' | 'medium' | 'high' | 'very-high';
  impact: 'low' | 'medium' | 'high' | 'very-high';
  score: number;
  status: 'open' | 'mitigating' | 'monitoring' | 'closed';
  owner: string;
  mitigation?: string;
}

const MOCK_RISKS: RiskItem[] = [
  {
    id: 'r1', title: 'Staalprijs volatiliteit', description: 'Stijgende staalprijzen (+8% deze maand) kunnen het budget van meerdere projecten beïnvloeden.',
    project: 'Portfolio', category: 'Financieel', likelihood: 'high', impact: 'high', score: 16, status: 'mitigating', owner: 'CFO',
    mitigation: 'Voorinkoop overwegen voor Phase 3 staal. Hedging opties bespreken met finance team.',
  },
  {
    id: 'r2', title: 'Vergunning vertraging Oak Gardens', description: 'Gemeentelijke bouwvergunning Phase 2 is 2 weken vertraagd.',
    project: 'Oak Gardens', category: 'Vergunningen', likelihood: 'very-high', impact: 'high', score: 20, status: 'open', owner: 'COO',
    mitigation: 'Spoedprocedure aanvragen. Contact opnemen met gemeente voor status update.',
  },
  {
    id: 'r3', title: 'Onderaannemer capaciteit', description: 'MEP contractor heeft capaciteitsproblemen gemeld voor Q2.',
    project: 'Riverside Quarter', category: 'Leveranciers', likelihood: 'medium', impact: 'high', score: 12, status: 'monitoring', owner: 'COO',
    mitigation: 'Alternatieve contractors geïdentificeerd. Backup planning opgesteld.',
  },
  {
    id: 'r4', title: 'Weersvertraging fundering', description: 'Langdurige regenperiode kan funderingswerkzaamheden vertragen.',
    project: 'Harbour View', category: 'Planning', likelihood: 'medium', impact: 'medium', score: 9, status: 'monitoring', owner: 'Site Lead',
  },
  {
    id: 'r5', title: 'Regelgeving wijziging brandveiligheid', description: 'Nieuwe brandveiligheidsregels kunnen aanvullende maatregelen vereisen.',
    project: 'Portfolio', category: 'Compliance', likelihood: 'low', impact: 'high', score: 8, status: 'monitoring', owner: 'Director',
  },
];

function getScoreColor(score: number): string {
  if (score >= 15) return SemanticColors.feedbackError;
  if (score >= 10) return SemanticColors.feedbackWarning;
  if (score >= 5) return Palette.hermesOrange;
  return SemanticColors.feedbackSuccess;
}

function getStatusConfig(status: string): { label: string; color: string } {
  switch (status) {
    case 'open': return { label: 'Open', color: SemanticColors.feedbackError };
    case 'mitigating': return { label: 'Mitigeren', color: SemanticColors.feedbackWarning };
    case 'monitoring': return { label: 'Monitoren', color: SemanticColors.feedbackInfo };
    case 'closed': return { label: 'Gesloten', color: SemanticColors.feedbackSuccess };
    default: return { label: status, color: SemanticColors.textTertiary };
  }
}

export default function RisksScreen() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'critical' | 'open'>('all');
  const insights = useVascoGuidance('cfo', 'cfo-risks');
  const inlineTip = useInlineInsight('cfo', 'cfo-risks', 'overview');
  const topInsight = insights[0] ?? null;

  const filteredRisks = MOCK_RISKS.filter(r => {
    if (filter === 'critical') return r.score >= 15;
    if (filter === 'open') return r.status === 'open';
    return true;
  });

  const highRisks = MOCK_RISKS.filter(r => r.score >= 15).length;
  const openRisks = MOCK_RISKS.filter(r => r.status === 'open').length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: SemanticColors.feedbackError }]}>{highRisks}</Text>
          <Text style={styles.statLabel}>Hoog risico</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: SemanticColors.feedbackWarning }]}>{openRisks}</Text>
          <Text style={styles.statLabel}>Open</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{MOCK_RISKS.length}</Text>
          <Text style={styles.statLabel}>Totaal</Text>
        </View>
      </View>

      {inlineTip && <InlineInsight icon={inlineTip.icon as IconName} message={inlineTip.message} />}
      {topInsight && <VascoInsightCard insight={topInsight} compact />}

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(['all', 'critical', 'open'] as const).map(f => (
          <Pressable
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'Alle' : f === 'critical' ? 'Kritiek' : 'Open'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Risk cards */}
      {filteredRisks.map(risk => {
        const statusConfig = getStatusConfig(risk.status);
        const isExpanded = expandedId === risk.id;

        return (
          <Pressable
            key={risk.id}
            style={styles.riskCard}
            onPress={() => setExpandedId(isExpanded ? null : risk.id)}
          >
            <View style={styles.riskHeader}>
              <View style={[styles.scoreBadge, { backgroundColor: getScoreColor(risk.score) + '20' }]}>
                <Text style={[styles.scoreText, { color: getScoreColor(risk.score) }]}>{risk.score}</Text>
              </View>
              <View style={styles.riskHeaderText}>
                <Text style={styles.riskTitle}>{risk.title}</Text>
                <View style={styles.riskMeta}>
                  <Text style={styles.riskProject}>{risk.project}</Text>
                  <Text style={styles.metaSep}>·</Text>
                  <Text style={styles.riskCategory}>{risk.category}</Text>
                </View>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
                <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
              </View>
            </View>

            <Text style={styles.riskDesc} numberOfLines={isExpanded ? undefined : 2}>{risk.description}</Text>

            {isExpanded && (
              <View style={styles.expandedContent}>
                <View style={styles.detailDivider} />
                <View style={styles.detailGrid}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Kans</Text>
                    <Text style={styles.detailValue}>{risk.likelihood}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Impact</Text>
                    <Text style={styles.detailValue}>{risk.impact}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Eigenaar</Text>
                    <Text style={styles.detailValue}>{risk.owner}</Text>
                  </View>
                </View>
                {risk.mitigation && (
                  <View style={styles.mitigationBox}>
                    <Ionicons name="shield-checkmark" size={14} color={SemanticColors.feedbackInfo} />
                    <Text style={styles.mitigationText}>{risk.mitigation}</Text>
                  </View>
                )}
              </View>
            )}
          </Pressable>
        );
      })}

      {filteredRisks.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="shield-checkmark" size={48} color={SemanticColors.feedbackSuccess} />
          <Text style={styles.emptyTitle}>Geen risico's gevonden</Text>
          <Text style={styles.emptySubtext}>Pas je filter aan om meer te zien</Text>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SemanticColors.surfaceBackground },
  content: { padding: Spacing.md, gap: Spacing.md },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statCard: { flex: 1, backgroundColor: SemanticColors.surfacePrimary, borderRadius: 10, padding: Spacing.md, alignItems: 'center', borderWidth: 1, borderColor: SemanticColors.borderDefault },
  statValue: { fontSize: 20, fontWeight: '700', color: SemanticColors.textPrimary },
  statLabel: { fontSize: 11, color: SemanticColors.textTertiary, marginTop: 2 },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterTab: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8, backgroundColor: SemanticColors.surfacePrimary, borderWidth: 1, borderColor: SemanticColors.borderDefault },
  filterTabActive: { backgroundColor: Palette.hermesOrange + '15', borderColor: Palette.hermesOrange + '40' },
  filterText: { fontSize: 13, fontWeight: '500', color: SemanticColors.textSecondary },
  filterTextActive: { color: Palette.hermesOrange, fontWeight: '600' },
  riskCard: { backgroundColor: SemanticColors.surfacePrimary, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: SemanticColors.borderDefault, gap: 8 },
  riskHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  scoreBadge: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  scoreText: { fontSize: 14, fontWeight: '700' },
  riskHeaderText: { flex: 1 },
  riskTitle: { fontSize: 14, fontWeight: '600', color: SemanticColors.textPrimary },
  riskMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  riskProject: { fontSize: 12, color: Palette.hermesOrange, fontWeight: '500' },
  metaSep: { fontSize: 12, color: SemanticColors.textTertiary },
  riskCategory: { fontSize: 12, color: SemanticColors.textTertiary },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  statusText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  riskDesc: { fontSize: 13, color: SemanticColors.textSecondary, lineHeight: 18 },
  expandedContent: { gap: 10 },
  detailDivider: { height: 1, backgroundColor: SemanticColors.borderMuted },
  detailGrid: { flexDirection: 'row', gap: Spacing.md },
  detailItem: {},
  detailLabel: { fontSize: 11, color: SemanticColors.textTertiary },
  detailValue: { fontSize: 13, fontWeight: '600', color: SemanticColors.textPrimary, marginTop: 1, textTransform: 'capitalize' },
  mitigationBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: SemanticColors.feedbackInfoBg, padding: 10, borderRadius: 8 },
  mitigationText: { flex: 1, fontSize: 12, color: SemanticColors.textSecondary, lineHeight: 16 },
  emptyState: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: SemanticColors.textPrimary },
  emptySubtext: { fontSize: 14, color: SemanticColors.textTertiary },
});

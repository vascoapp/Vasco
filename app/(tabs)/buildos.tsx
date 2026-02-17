import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActionTile } from '../../src/components/ActionTile';
import { KpiChip } from '../../src/components/KpiChip';
import { Screen } from '../../src/components/Screen';
import {
  auditTrail,
  buildOSOverview,
  buildOSPillars,
  buildOSProjects,
  documentIntelligence,
  countryModules,
  roleDashboards,
  systemOfAction,
  BuildOSRole,
} from '../../src/data/mockBuildOS';
import { SemanticColors } from '../../src/theme/colors';
import { Radius } from '../../src/theme/radius';
import { Shadows } from '../../src/theme/shadows';
import { Spacing } from '../../src/theme/spacing';
import { Typography } from '../../src/theme/typography';

const roles: { id: BuildOSRole; label: string }[] = [
  { id: 'cfo', label: 'CFO' },
  { id: 'coo', label: 'COO' },
  { id: 'site', label: 'Site Lead' },
];

export default function BuildOSScreen() {
  const [role, setRole] = useState<BuildOSRole>('cfo');
  const [projectId, setProjectId] = useState(buildOSProjects[0]?.id ?? '');
  const roleData = useMemo(() => roleDashboards[role], [role]);
  const selectedProject =
    buildOSProjects.find((project) => project.id === projectId) ?? buildOSProjects[0];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.sectionLabel}>BuildOS Europe</Text>
            <Text style={Typography.title}>{buildOSOverview.title}</Text>
          </View>
          <View style={styles.helperBadge}>
            <Text style={styles.helperBadgeText}>System of Action</Text>
          </View>
        </View>

        <Text style={Typography.muted}>{buildOSOverview.subtitle}</Text>

        <View style={styles.projectCard}>
          <Text style={styles.sectionLabel}>Active project</Text>
          <View style={styles.projectRow}>
            <View>
              <Text style={Typography.subtitle}>{selectedProject?.name}</Text>
              <Text style={Typography.muted}>Region: {selectedProject?.country}</Text>
            </View>
            <View style={styles.projectBadge}>
              <Text style={styles.projectBadgeText}>Live</Text>
            </View>
          </View>
          <View style={styles.projectSelector}>
            {buildOSProjects.map((project) => {
              const selected = project.id === projectId;
              return (
                <Pressable
                  key={project.id}
                  onPress={() => setProjectId(project.id)}
                  style={[styles.projectPill, selected && styles.projectPillActive]}
                >
                  <Text style={[styles.projectPillText, selected && styles.projectPillTextActive]}>
                    {project.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.highlightCard}>
          {buildOSOverview.highlights.map((item) => (
            <Text key={item} style={styles.highlightItem}>
              {item}
            </Text>
          ))}
        </View>

        <View style={styles.pillarRow}>
          {buildOSPillars.map((pillar) => (
            <View key={pillar.title} style={styles.pillarCard}>
              <Text style={styles.pillarTitle}>{pillar.title}</Text>
              <Text style={Typography.muted}>{pillar.detail}</Text>
              <Text style={styles.pillarMetric}>{pillar.metric}</Text>
            </View>
          ))}
        </View>

        <View style={styles.roleSwitch}>
          {roles.map((item) => {
            const selected = item.id === role;
            return (
              <Pressable
                key={item.id}
                onPress={() => setRole(item.id)}
                style={[styles.rolePill, selected && styles.rolePillActive]}
              >
                <Text style={[styles.roleText, selected && styles.roleTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Role view</Text>
          <Text style={Typography.subtitle}>{roleData.label}</Text>
        </View>

        <View style={styles.kpiRow}>
          {roleData.kpis.map((kpi) => (
            <KpiChip key={kpi.label} label={kpi.label} value={kpi.value} />
          ))}
        </View>

        <View style={styles.sectionCard}>
          <Text style={Typography.subtitle}>Action queue</Text>
          <View style={styles.actionList}>
            {roleData.actions.map((action) => (
              <ActionTile
                key={action.title}
                title={action.title}
                subtitle={action.subtitle}
                why={action.why}
                impact={action.impact}
                tag={action.tag}
              />
            ))}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={Typography.subtitle}>Performance snapshot</Text>
          <View style={styles.list}>
            {roleData.performance.map((item) => {
              const progress = Math.min(100, Math.round((item.value / item.max) * 100));
              return (
                <View key={item.label} style={styles.performanceRow}>
                  <View style={styles.performanceHeader}>
                    <Text style={styles.listTitle}>{item.label}</Text>
                    <Text style={styles.performanceValue}>
                      {item.value}/{item.max}
                    </Text>
                  </View>
                  <View style={styles.performanceBar}>
                    <View style={[styles.performanceFill, { width: `${progress}%` }]} />
                  </View>
                  <Text style={styles.performanceNote}>{item.note}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={Typography.subtitle}>Agent controls</Text>
          <View style={styles.agentHeader}>
            <View>
              <Text style={styles.listTitle}>{roleData.agent.status}</Text>
              <Text style={Typography.muted}>Last trained {roleData.agent.lastTrained}</Text>
            </View>
            <View style={styles.agentBadge}>
              <Text style={styles.agentBadgeText}>{roleData.agent.readiness}</Text>
            </View>
          </View>
          <View style={styles.agentActions}>
            <Pressable style={styles.agentButton}>
              <Text style={styles.agentButtonText}>Train agent</Text>
            </Pressable>
            <Pressable style={styles.agentButtonSecondary}>
              <Text style={styles.agentButtonTextSecondary}>Review training data</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={Typography.subtitle}>Mini charts</Text>
          <View style={styles.chartGrid}>
            <View style={styles.chartCard}>
              <Text style={styles.listTitle}>Action mix</Text>
              <View style={styles.chartBar}>
                {roleData.charts.actionMix.map((item) => (
                  <View
                    key={item.label}
                    style={[styles.chartSegment, { flexBasis: `${item.value}%`, backgroundColor: item.color }]}
                  />
                ))}
              </View>
              <View style={styles.chartLegend}>
                {roleData.charts.actionMix.map((item) => (
                  <View key={item.label} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                    <Text style={styles.legendText}>
                      {item.label} {item.value}%
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.listTitle}>Event mix</Text>
              <View style={styles.chartBar}>
                {roleData.charts.eventMix.map((item) => (
                  <View
                    key={item.label}
                    style={[styles.chartSegment, { flexBasis: `${item.value}%`, backgroundColor: item.color }]}
                  />
                ))}
              </View>
              <View style={styles.chartLegend}>
                {roleData.charts.eventMix.map((item) => (
                  <View key={item.label} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                    <Text style={styles.legendText}>
                      {item.label} {item.value}%
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={Typography.subtitle}>Document intelligence</Text>
          <View style={styles.list}>
            {documentIntelligence.map((doc) => (
              <View key={doc.title} style={styles.listRow}>
                <View style={styles.docHeader}>
                  <Text style={styles.listTitle}>{doc.title}</Text>
                  <Text style={styles.docConfidence}>{doc.confidence}</Text>
                </View>
                <Text style={Typography.muted}>{doc.detail}</Text>
                <Text style={styles.docUpdated}>Updated {doc.updated}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={Typography.subtitle}>Focus insights</Text>
          <View style={styles.list}>
            {roleData.insights.map((insight) => (
              <View key={insight.title} style={styles.listRow}>
                <Text style={styles.listTitle}>{insight.title}</Text>
                <Text style={Typography.muted}>{insight.detail}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={Typography.subtitle}>System of action loop</Text>
          <View style={styles.list}>
            {systemOfAction.map((step) => (
              <Text key={step} style={styles.listItem}>
                {step}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={Typography.subtitle}>Country modules</Text>
          <View style={styles.list}>
            {countryModules.map((module) => (
              <View key={module.title} style={styles.moduleCard}>
                <View style={styles.moduleHeader}>
                  <Text style={styles.listTitle}>{module.title}</Text>
                  <View style={styles.moduleBadge}>
                    <Text style={styles.moduleBadgeText}>Active</Text>
                  </View>
                </View>
                <Text style={Typography.muted}>{module.detail}</Text>
                <Text style={styles.moduleSignal}>{module.signal}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.auditRibbon}>
          <Text style={styles.sectionLabel}>Evidence trail</Text>
          <View style={styles.auditList}>
            {auditTrail.map((item) => (
              <View key={item.title} style={styles.auditItem}>
                <Text style={styles.auditTitle}>{item.title}</Text>
                <Text style={Typography.muted}>{item.detail}</Text>
                <Text style={styles.auditTime}>{item.time}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  projectCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  projectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  projectBadge: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  projectBadgeText: {
    color: SemanticColors.textTertiary,
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  projectSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  projectPill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  projectPillActive: {
    backgroundColor: SemanticColors.surfacePrimary,
  },
  projectPillText: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  projectPillTextActive: {
    color: SemanticColors.textPrimary,
  },
  sectionLabel: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: Spacing.xs,
    fontFamily: 'Inter_500Medium',
  },
  helperBadge: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  helperBadgeText: {
    color: SemanticColors.textTertiary,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  highlightCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  highlightItem: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  pillarRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  pillarCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    minWidth: 160,
    flexGrow: 1,
    gap: 6,
  },
  pillarTitle: {
    color: SemanticColors.textPrimary,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  pillarMetric: {
    color: SemanticColors.textTertiary,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  roleSwitch: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: Radius.lg,
    padding: 6,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.xs,
  },
  rolePill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  rolePillActive: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  roleText: {
    color: SemanticColors.textSecondary,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  roleTextActive: {
    color: SemanticColors.textPrimary,
  },
  sectionHeader: {
    gap: 2,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  sectionCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  actionList: {
    gap: Spacing.sm,
  },
  list: {
    gap: Spacing.sm,
  },
  listRow: {
    gap: 4,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  performanceRow: {
    gap: 6,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  performanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  performanceValue: {
    color: SemanticColors.textPrimary,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  performanceBar: {
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    overflow: 'hidden',
  },
  performanceFill: {
    height: '100%',
    backgroundColor: SemanticColors.actionPrimary,
  },
  performanceNote: {
    color: SemanticColors.textSecondary,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  agentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  agentBadge: {
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  agentBadgeText: {
    color: SemanticColors.textTertiary,
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  agentActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  agentButton: {
    backgroundColor: SemanticColors.actionPrimary,
    borderRadius: Radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  agentButtonText: {
    color: '#0B0C0F',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  agentButtonSecondary: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  agentButtonTextSecondary: {
    color: SemanticColors.textPrimary,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  chartGrid: {
    gap: Spacing.sm,
  },
  chartCard: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  chartBar: {
    flexDirection: 'row',
    borderRadius: Radius.pill,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    backgroundColor: SemanticColors.surfacePrimary,
    height: 10,
  },
  chartSegment: {
    height: '100%',
  },
  chartLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.sm,
  },
  legendText: {
    color: SemanticColors.textSecondary,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  docHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  docConfidence: {
    color: SemanticColors.textTertiary,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  docUpdated: {
    color: SemanticColors.textSecondary,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  moduleCard: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 6,
  },
  moduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  moduleBadge: {
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: SemanticColors.surfacePrimary,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  moduleBadgeText: {
    color: SemanticColors.textTertiary,
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  moduleSignal: {
    color: SemanticColors.feedbackWarning,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  auditRibbon: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  auditList: {
    gap: Spacing.sm,
  },
  auditItem: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 4,
  },
  auditTitle: {
    color: SemanticColors.textPrimary,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  auditTime: {
    color: SemanticColors.textSecondary,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  listTitle: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  listItem: {
    color: SemanticColors.textPrimary,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
});

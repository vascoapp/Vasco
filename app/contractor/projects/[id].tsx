// =============================================================================
// PROJECT DETAIL — View/manage a multi-trade project
// =============================================================================

import { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, RefreshControl } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../../src/theme/tabStyles';
import { SafeArea } from '../../../src/theme/spacing';
import { useAppState } from '../../../src/state/AppState';
import { useAuth } from '../../../src/context/AuthContext';
import { formatCurrency, formatCurrency0, type Country } from '../../../src/i18n/formatting';
import { makeEntityLabels } from '../../../src/i18n/entityLabels';
import { hapticSuccess } from '../../../src/utils/haptics';
import { FadeIn } from '../../../src/components/shared/FadeIn';
import type { ProjectStatus } from '../../../src/types/project';

type IconName = keyof typeof Ionicons.glyphMap;

const STATUS_KEYS: { key: ProjectStatus; i18nKey: string; icon: IconName }[] = [
  { key: 'planning', i18nKey: 'project.statusPlanning', icon: 'document-text-outline' },
  { key: 'active', i18nKey: 'project.statusActive', icon: 'hammer-outline' },
  { key: 'on_hold', i18nKey: 'project.statusOnHold', icon: 'pause-circle-outline' },
  { key: 'completed', i18nKey: 'project.statusCompleted', icon: 'checkmark-circle-outline' },
];

export default function ProjectDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { projects, updateProject, jobs, invoices, customers, getProjectPnL, addJobToProject } = useAppState();
  const { user } = useAuth();
  const country = (user?.country ?? 'NL') as Country;
  // The job rows printed the raw JobStatus enum ('completed', 'in-progress')
  // and a hardcoded € formatted in the DEVICE locale, on an aannemer P&L
  // screen. Same class as the R322 werk/customer-detail fixes.
  const { jobStatusLabel } = makeEntityLabels(t);
  const [refreshing, setRefreshing] = useState(false);

  const project = useMemo(() => projects.find(p => p.id === id), [projects, id]);
  const pnl = useMemo(() => project ? getProjectPnL(project.id) : null, [project]);
  const projectJobs = useMemo(() => project ? jobs.filter(j => project.jobIds.includes(j.id)) : [], [project, jobs]);
  const unassignedJobs = useMemo(() => jobs.filter(j => !projects.some(p => p.jobIds.includes(j.id))), [jobs, projects]);
  const customer = useMemo(() => project ? customers.find(c => c.id === project.customerId) : null, [project, customers]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); hapticSuccess(); }, 600);
  }, []);

  const handleStatusChange = () => {
    if (!project) return;
    Alert.alert(t('project.changeStatus'), undefined,
      STATUS_KEYS.map(opt => ({
        text: t(opt.i18nKey),
        onPress: () => { hapticSuccess(); updateProject(project.id, { status: opt.key }); },
      }))
    );
  };

  const handleAssignJob = () => {
    if (!project || unassignedJobs.length === 0) {
      Alert.alert(t('project.noJobs'), t('project.allJobsAssigned'));
      return;
    }
    Alert.alert(t('project.addJob'), t('project.selectJob'),
      unassignedJobs.slice(0, 5).map(j => ({
        text: j.title,
        onPress: () => { hapticSuccess(); addJobToProject(project.id, j.id); },
      }))
    );
  };

  if (!project) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={SemanticColors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('project.notFound')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{project.title}</Text>
          <Text style={styles.headerSub}>{customer?.name ?? t('project.noCustomer')}</Text>
        </View>
        <Pressable onPress={handleStatusChange} style={styles.statusBtn}>
          <Text style={styles.statusBtnText}>
            {t(STATUS_KEYS.find(o => o.key === project.status)?.i18nKey ?? '') || project.status}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.hermesOrange} />}
      >
        {/* P&L Card */}
        {pnl && (
          <FadeIn delay={0}>
            <View style={styles.pnlCard}>
              <Text style={styles.sectionTitle}>{t('project.financialOverview')}</Text>
              <View style={styles.pnlRow}>
                <View style={styles.pnlItem}>
                  <Text style={styles.pnlValue}>{formatCurrency0(project.totalBudget, country)}</Text>
                  <Text style={styles.pnlLabel}>{t('project.budget')}</Text>
                </View>
                <View style={styles.pnlDivider} />
                <View style={styles.pnlItem}>
                  <Text style={styles.pnlValue}>{formatCurrency0(pnl.revenue, country)}</Text>
                  <Text style={styles.pnlLabel}>{t('project.revenue')}</Text>
                </View>
                <View style={styles.pnlDivider} />
                <View style={styles.pnlItem}>
                  <Text style={[styles.pnlValue, { color: pnl.grossProfit >= 0 ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError }]}>
                    {formatCurrency0(pnl.grossProfit, country)}
                  </Text>
                  <Text style={styles.pnlLabel}>{t('project.profit')}</Text>
                </View>
              </View>
              <View style={styles.pnlRow}>
                <View style={styles.pnlItem}>
                  <Text style={styles.pnlValue}>{formatCurrency0(pnl.materialCosts, country)}</Text>
                  <Text style={styles.pnlLabel}>{t('project.material')}</Text>
                </View>
                <View style={styles.pnlDivider} />
                <View style={styles.pnlItem}>
                  <Text style={styles.pnlValue}>{formatCurrency0(pnl.laborCosts, country)}</Text>
                  <Text style={styles.pnlLabel}>{t('project.labor')}</Text>
                </View>
                <View style={styles.pnlDivider} />
                <View style={styles.pnlItem}>
                  <Text style={[styles.pnlValue, { color: Palette.hermesOrange }]}>{pnl.grossMargin}%</Text>
                  <Text style={styles.pnlLabel}>{t('project.margin')}</Text>
                </View>
              </View>
            </View>
          </FadeIn>
        )}

        {/* Jobs section */}
        <FadeIn delay={100}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('project.jobsCount', { count: projectJobs.length })}</Text>
              <Pressable onPress={handleAssignJob} hitSlop={8}>
                <Ionicons name="add-circle" size={24} color={Palette.hermesOrange} />
              </Pressable>
            </View>

            {projectJobs.length === 0 ? (
              <Text style={styles.emptyText}>{t('project.noJobsAdded')}</Text>
            ) : (
              projectJobs.map(job => (
                <Pressable
                  key={job.id}
                  style={styles.jobCard}
                  onPress={() => router.push(`/quotes/${job.id}` as any)}
                >
                  <View style={[styles.jobAccent, { backgroundColor: Palette.hermesOrange }]} />
                  <View style={{ flex: 1, padding: 12 }}>
                    <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
                    <Text style={styles.jobMeta}>{jobStatusLabel(job.status)} · {formatCurrency(job.quotedAmount ?? 0, country)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} style={{ marginRight: 12 }} />
                </Pressable>
              ))
            )}
          </View>
        </FadeIn>

        {/* R246: Site-lead actions for aannemer running this project. */}
        {/* Wires the existing site-lead drill-downs into the contractor view. */}
        <FadeIn delay={150}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('project.siteOps', 'Site operations')}</Text>
            <View style={styles.siteOpsGrid}>
              <Pressable style={styles.siteOpsTile} onPress={() => router.push(`/sitelead/dispatch?projectId=${project.id}` as any)}>
                <Ionicons name="people" size={20} color={Palette.hermesOrange} />
                <Text style={styles.siteOpsLabel}>{t('siteOps.dispatch', 'Dispatch')}</Text>
              </Pressable>
              <Pressable style={styles.siteOpsTile} onPress={() => router.push(`/sitelead/daily-report?projectId=${project.id}` as any)}>
                <Ionicons name="document-text" size={20} color={Palette.hermesOrange} />
                <Text style={styles.siteOpsLabel}>{t('siteOps.dailyReport', 'Daily report')}</Text>
              </Pressable>
              <Pressable style={styles.siteOpsTile} onPress={() => router.push(`/sitelead/log-defect?projectId=${project.id}` as any)}>
                <Ionicons name="alert-circle" size={20} color={Palette.hermesOrange} />
                <Text style={styles.siteOpsLabel}>{t('siteOps.defects', 'Defects')}</Text>
              </Pressable>
              <Pressable style={styles.siteOpsTile} onPress={() => router.push(`/sitelead/inspection?projectId=${project.id}` as any)}>
                <Ionicons name="checkmark-done" size={20} color={Palette.hermesOrange} />
                <Text style={styles.siteOpsLabel}>{t('siteOps.inspection', 'Inspection')}</Text>
              </Pressable>
              <Pressable style={styles.siteOpsTile} onPress={() => router.push(`/sitelead/incident-report?projectId=${project.id}` as any)}>
                <Ionicons name="warning" size={20} color={Palette.hermesOrange} />
                <Text style={styles.siteOpsLabel}>{t('siteOps.incident', 'Incident')}</Text>
              </Pressable>
              <Pressable style={styles.siteOpsTile} onPress={() => router.push(`/sitelead/safety-docs?projectId=${project.id}` as any)}>
                <Ionicons name="shield-checkmark" size={20} color={Palette.hermesOrange} />
                <Text style={styles.siteOpsLabel}>{t('siteOps.safety', 'Safety')}</Text>
              </Pressable>
            </View>
          </View>
        </FadeIn>

        {/* Milestones placeholder */}
        <FadeIn delay={200}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('project.milestones')}</Text>
            {project.milestones.length === 0 ? (
              <Text style={styles.emptyText}>{t('project.noMilestones')}</Text>
            ) : (
              project.milestones.map(m => (
                <View key={m.id} style={styles.milestoneRow}>
                  <Ionicons
                    name={m.completed ? 'checkmark-circle' : 'ellipse-outline'}
                    size={18}
                    color={m.completed ? SemanticColors.feedbackSuccess : SemanticColors.textTertiary}
                  />
                  <Text style={[styles.milestoneText, m.completed && styles.milestoneComplete]}>{m.title}</Text>
                  <Text style={styles.milestoneWeek}>{t('project.week')} {m.weekNumber}</Text>
                </View>
              ))
            )}
          </View>
        </FadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: SafeArea.top, paddingHorizontal: SafeArea.side, paddingBottom: 12,
  },
  headerTitle: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary, textTransform: 'uppercase', letterSpacing: 1.2 },
  headerSub: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary },
  statusBtn: { backgroundColor: Palette.hermesOrange + '15', borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 6 },
  statusBtnText: { fontSize: TYPE.labelSize, fontFamily: TYPE.labelFamily, color: Palette.hermesOrange },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: SafeArea.side, gap: GRID.md },
  sectionTitle: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary, letterSpacing: TYPE.sectionTracking },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  section: { gap: GRID.sm },
  emptyText: { fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textTertiary },
  pnlCard: { backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, padding: 16, gap: 12 },
  pnlRow: { flexDirection: 'row', alignItems: 'center' },
  pnlItem: { flex: 1, alignItems: 'center' },
  pnlValue: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary },
  pnlLabel: { fontSize: TYPE.tinySize, fontFamily: TYPE.tinyFamily, color: SemanticColors.textSecondary, marginTop: 2 },
  pnlDivider: { width: 1, height: 28, backgroundColor: SemanticColors.borderDefault },
  jobCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, overflow: 'hidden' },
  jobAccent: { width: 4, alignSelf: 'stretch' },
  jobTitle: { fontSize: TYPE.titleSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  jobMeta: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary, marginTop: 2 },
  milestoneRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  milestoneText: { flex: 1, fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textPrimary },
  milestoneComplete: { textDecorationLine: 'line-through', color: SemanticColors.textTertiary },
  milestoneWeek: { fontSize: TYPE.labelSize, fontFamily: TYPE.labelFamily, color: SemanticColors.textSecondary },
  siteOpsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID.sm },
  siteOpsTile: {
    flexBasis: '31%',
    flexGrow: 1,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
  },
  siteOpsLabel: { fontSize: TYPE.labelSize, fontFamily: TYPE.labelFamily, color: SemanticColors.textPrimary, textAlign: 'center' },
});

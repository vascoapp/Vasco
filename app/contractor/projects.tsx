// =============================================================================
// PROJECTS — Multi-trade project management for aannemers
// =============================================================================

import { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { SafeArea } from '../../src/theme/spacing';
import { useAppState } from '../../src/state/AppState';
import { hapticSuccess } from '../../src/utils/haptics';
import { FadeIn } from '../../src/components/shared/FadeIn';
import { Modal } from 'react-native';
import type { Project, ProjectStatus } from '../../src/types/project';

type IconName = keyof typeof Ionicons.glyphMap;

const getStatusConfig = (t: (key: string, fallback: string) => string): Record<ProjectStatus, { label: string; color: string; icon: IconName }> => ({
  planning: { label: t('contractor.projects.statusPlanning', 'Planning'), color: SemanticColors.textTertiary, icon: 'document-text-outline' },
  active: { label: t('contractor.projects.statusActive', 'Active'), color: Palette.hermesOrange, icon: 'hammer-outline' },
  on_hold: { label: t('contractor.projects.statusOnHold', 'On hold'), color: SemanticColors.feedbackWarning, icon: 'pause-circle-outline' },
  completed: { label: t('contractor.projects.statusCompleted', 'Completed'), color: SemanticColors.feedbackSuccess, icon: 'checkmark-circle-outline' },
  cancelled: { label: t('contractor.projects.statusCancelled', 'Cancelled'), color: SemanticColors.feedbackError, icon: 'close-circle-outline' },
});

type FilterStatus = 'all' | 'active' | 'completed';

export default function ProjectsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const STATUS_CONFIG = useMemo(() => getStatusConfig(t), [t]);
  const { projects, addProject, jobs, customers, getProjectPnL } = useAppState();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCustomer, setNewCustomer] = useState('');
  const [newBudget, setNewBudget] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); hapticSuccess(); }, 600);
  }, []);

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    hapticSuccess();
    addProject({
      title: newTitle.trim(),
      customerId: newCustomer || '',
      status: 'planning',
      totalBudget: Number(newBudget) || 0,
      totalQuoted: 0,
      milestones: [],
      jobIds: [],
      quoteIds: [],
      invoiceIds: [],
      subcontractorIds: [],
    });
    setNewTitle('');
    setNewCustomer('');
    setNewBudget('');
    setShowCreate(false);
  };

  const activeProjects = useMemo(() => projects.filter(p => p.status !== 'completed' && p.status !== 'cancelled'), [projects]);
  const completedProjects = useMemo(() => projects.filter(p => p.status === 'completed' || p.status === 'cancelled'), [projects]);

  const renderProject = (project: Project) => {
    const cfg = STATUS_CONFIG[project.status];
    const pnl = getProjectPnL(project.id);
    const jobCount = project.jobIds.length;
    const customer = customers.find(c => c.id === project.customerId);
    // Calculate progress based on completed jobs
    const completedJobCount = project.jobIds.filter(jid => {
      const j = jobs.find((job: any) => job.id === jid);
      return j && ['completed', 'invoiced', 'paid', 'gereed', 'gefactureerd', 'betaald'].includes(j.status);
    }).length;
    const progressPct = jobCount > 0 ? Math.round((completedJobCount / jobCount) * 100) : 0;

    return (
      <Pressable
        key={project.id}
        style={({ pressed }) => [styles.projectCard, pressed && { opacity: 0.85 }]}
        onPress={() => router.push(`/contractor/projects/${project.id}` as any)}
      >
        <View style={[styles.statusBar, { backgroundColor: cfg.color }]} />
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.projectTitle} numberOfLines={1}>{project.title}</Text>
              <Text style={styles.projectCustomer} numberOfLines={1}>
                {customer?.name ?? project.customerName ?? t('contractor.projects.noCustomer', 'No customer')}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: cfg.color + '15' }]}>
              <Ionicons name={cfg.icon} size={14} color={cfg.color} />
              <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>{t('jobs.progress', 'Progress')}</Text>
              <Text style={[styles.progressPct, { color: progressPct >= 100 ? SemanticColors.feedbackSuccess : Palette.hermesOrange }]}>{progressPct}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPct}%` as any, backgroundColor: progressPct >= 100 ? SemanticColors.feedbackSuccess : Palette.hermesOrange }]} />
            </View>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{jobCount}</Text>
              <Text style={styles.metricLabel}>{t('contractor.projects.jobs', 'Jobs')}</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{'\u20AC'}{(pnl.revenue || project.totalBudget).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
              <Text style={styles.metricLabel}>{t('contractor.projects.budget', 'Budget')}</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metric}>
              <Text style={[styles.metricValue, { color: pnl.grossMargin >= 0 ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError }]}>
                {pnl.grossMargin}%
              </Text>
              <Text style={styles.metricLabel}>{t('contractor.projects.margin', 'Margin')}</Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('contractor.projects.title', 'Projects')}</Text>
        <Pressable onPress={() => setShowCreate(true)} hitSlop={8}>
          <Ionicons name="add-circle" size={28} color={Palette.hermesOrange} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.hermesOrange} />}
      >
        {/* Status filter chips */}
        {projects.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {([
              { key: 'all' as FilterStatus, label: t('common.all', 'All'), count: projects.length },
              { key: 'active' as FilterStatus, label: t('contractor.projects.statusActive', 'Active'), count: activeProjects.length },
              { key: 'completed' as FilterStatus, label: t('contractor.projects.statusCompleted', 'Completed'), count: completedProjects.length },
            ]).map(chip => (
              <Pressable
                key={chip.key}
                style={[styles.filterChip, statusFilter === chip.key && styles.filterChipActive]}
                onPress={() => setStatusFilter(chip.key)}
              >
                <Text style={[styles.filterChipText, statusFilter === chip.key && styles.filterChipTextActive]}>
                  {chip.label} ({chip.count})
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {projects.length === 0 ? (
          <FadeIn delay={0}>
            <View style={styles.empty}>
              <Ionicons name="folder-open-outline" size={48} color={SemanticColors.textTertiary} />
              <Text style={styles.emptyTitle}>{t('contractor.projects.emptyTitle', 'No projects')}</Text>
              <Text style={styles.emptyDesc}>{t('contractor.projects.emptyDesc', 'Create a project to group multiple jobs')}</Text>
              <Pressable style={styles.emptyBtn} onPress={() => setShowCreate(true)}>
                <Text style={styles.emptyBtnText}>{t('contractor.projects.newProject', 'New project')}</Text>
              </Pressable>
            </View>
          </FadeIn>
        ) : (
          <>
            {(statusFilter === 'all' || statusFilter === 'active') && activeProjects.length > 0 && (
              <FadeIn delay={0}>
                <Text style={styles.sectionTitle}>{t('contractor.projects.statusActive', 'Active')} ({activeProjects.length})</Text>
                {activeProjects.map(renderProject)}
              </FadeIn>
            )}
            {(statusFilter === 'all' || statusFilter === 'completed') && completedProjects.length > 0 && (
              <FadeIn delay={100}>
                <Text style={styles.sectionTitle}>{t('contractor.projects.statusCompleted', 'Completed')} ({completedProjects.length})</Text>
                {completedProjects.map(renderProject)}
              </FadeIn>
            )}
          </>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Create project modal */}
      <Modal visible={showCreate} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowCreate(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>{t('contractor.projects.newProject', 'New project')}</Text>
            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder={t('contractor.projects.projectNamePlaceholder', 'Project name (e.g. Bathroom renovation)')}
                placeholderTextColor={SemanticColors.textTertiary}
                value={newTitle}
                onChangeText={setNewTitle}
              />
              <TextInput
                style={styles.input}
                placeholder={t('contractor.projects.customerNamePlaceholder', 'Customer name (optional)')}
                placeholderTextColor={SemanticColors.textTertiary}
                value={newCustomer}
                onChangeText={setNewCustomer}
              />
              <TextInput
                style={styles.input}
                placeholder={t('contractor.projects.budgetPlaceholder', 'Budget €')}
                placeholderTextColor={SemanticColors.textTertiary}
                value={newBudget}
                onChangeText={setNewBudget}
                keyboardType="numeric"
              />
              <Pressable
                style={[styles.createBtn, !newTitle.trim() && { opacity: 0.5 }]}
                onPress={handleCreate}
                disabled={!newTitle.trim()}
              >
                <Text style={styles.createBtnText}>{t('contractor.projects.createProject', 'Create project')}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: SafeArea.top, paddingHorizontal: SafeArea.side, paddingBottom: 12,
  },
  headerTitle: { fontSize: TYPE.displaySize, fontFamily: TYPE.displayFamily, color: SemanticColors.textPrimary,  textTransform: 'uppercase', letterSpacing: 1.2 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: SafeArea.side, gap: GRID.sm, paddingBottom: 100 },
  sectionTitle: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary, letterSpacing: TYPE.sectionTracking, marginTop: GRID.md, marginBottom: GRID.xs },
  projectCard: { flexDirection: 'row', backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, overflow: 'hidden', borderWidth: 1, borderColor: SemanticColors.borderDefault, marginBottom: GRID.sm },
  statusBar: { width: 4 },
  cardContent: { flex: 1, padding: GRID.md, gap: GRID.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  projectTitle: { fontSize: TYPE.titleSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  projectCustomer: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary, marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.sm },
  statusText: { fontSize: TYPE.labelSize, fontFamily: TYPE.labelFamily },
  metricsRow: { flexDirection: 'row', alignItems: 'center' },
  metric: { flex: 1, alignItems: 'center' },
  metricValue: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary },
  metricLabel: { fontSize: TYPE.tinySize, fontFamily: TYPE.tinyFamily, color: SemanticColors.textSecondary, marginTop: 2 },
  metricDivider: { width: 1, height: 24, backgroundColor: SemanticColors.borderDefault },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary },
  emptyDesc: { fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textSecondary, textAlign: 'center' },
  emptyBtn: { backgroundColor: Palette.hermesOrange, borderRadius: RADIUS.md, paddingHorizontal: 20, paddingVertical: 12, marginTop: 8 },
  emptyBtnText: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: Palette.white },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: SemanticColors.surfacePrimary, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: 20, paddingBottom: 40 },
  modalTitle: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary, marginBottom: 16 },
  form: { gap: 12, paddingBottom: 20 },
  input: { backgroundColor: SemanticColors.surfaceSecondary, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textPrimary },
  createBtn: { backgroundColor: Palette.hermesOrange, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center' },
  createBtnText: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: Palette.white },

  // Filter chips
  filterRow: { flexDirection: 'row', gap: GRID.sm, paddingBottom: GRID.sm },
  filterChip: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.full,
    paddingHorizontal: GRID.md,
    paddingVertical: GRID.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  filterChipActive: {
    backgroundColor: Palette.hermesOrange,
    borderColor: Palette.hermesOrange,
  },
  filterChipText: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textSecondary,
  },
  filterChipTextActive: {
    color: Palette.white,
  },

  // Progress
  progressSection: { gap: GRID.xs },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textTertiary },
  progressPct: { fontSize: TYPE.captionSize, fontFamily: TYPE.sectionFamily },
  progressTrack: { height: 4, backgroundColor: SemanticColors.borderDefault, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
});

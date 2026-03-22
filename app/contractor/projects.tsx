// =============================================================================
// PROJECTS — Multi-trade project management for aannemers
// =============================================================================

import { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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

const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; icon: IconName }> = {
  planning: { label: 'Planning', color: SemanticColors.textTertiary, icon: 'document-text-outline' },
  active: { label: 'Actief', color: Palette.hermesOrange, icon: 'hammer-outline' },
  on_hold: { label: 'Gepauzeerd', color: SemanticColors.feedbackWarning, icon: 'pause-circle-outline' },
  completed: { label: 'Afgerond', color: SemanticColors.feedbackSuccess, icon: 'checkmark-circle-outline' },
  cancelled: { label: 'Geannuleerd', color: SemanticColors.feedbackError, icon: 'close-circle-outline' },
};

export default function ProjectsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { projects, addProject, jobs, customers, getProjectPnL } = useAppState();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCustomer, setNewCustomer] = useState('');
  const [newBudget, setNewBudget] = useState('');
  const [refreshing, setRefreshing] = useState(false);

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
                {customer?.name ?? project.customerName ?? 'Geen klant'}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: cfg.color + '15' }]}>
              <Ionicons name={cfg.icon} size={14} color={cfg.color} />
              <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{jobCount}</Text>
              <Text style={styles.metricLabel}>Klussen</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metric}>
              <Text style={styles.metricValue}>€{(pnl.revenue || project.totalBudget).toLocaleString('nl-NL', { maximumFractionDigits: 0 })}</Text>
              <Text style={styles.metricLabel}>Budget</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metric}>
              <Text style={[styles.metricValue, { color: pnl.grossMargin >= 0 ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError }]}>
                {pnl.grossMargin}%
              </Text>
              <Text style={styles.metricLabel}>Marge</Text>
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
          <Ionicons name="arrow-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Projecten</Text>
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
        {projects.length === 0 ? (
          <FadeIn delay={0}>
            <View style={styles.empty}>
              <Ionicons name="folder-open-outline" size={48} color={SemanticColors.textTertiary} />
              <Text style={styles.emptyTitle}>Geen projecten</Text>
              <Text style={styles.emptyDesc}>Maak een project aan om meerdere klussen te groeperen</Text>
              <Pressable style={styles.emptyBtn} onPress={() => setShowCreate(true)}>
                <Text style={styles.emptyBtnText}>Nieuw project</Text>
              </Pressable>
            </View>
          </FadeIn>
        ) : (
          <>
            {activeProjects.length > 0 && (
              <FadeIn delay={0}>
                <Text style={styles.sectionTitle}>Actief ({activeProjects.length})</Text>
                {activeProjects.map(renderProject)}
              </FadeIn>
            )}
            {completedProjects.length > 0 && (
              <FadeIn delay={100}>
                <Text style={styles.sectionTitle}>Afgerond ({completedProjects.length})</Text>
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
            <Text style={styles.modalTitle}>Nieuw project</Text>
            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="Projectnaam (bijv. Badkamer renovatie)"
                placeholderTextColor={SemanticColors.textTertiary}
                value={newTitle}
                onChangeText={setNewTitle}
              />
              <TextInput
                style={styles.input}
                placeholder="Klantnaam (optioneel)"
                placeholderTextColor={SemanticColors.textTertiary}
                value={newCustomer}
                onChangeText={setNewCustomer}
              />
              <TextInput
                style={styles.input}
                placeholder="Budget €"
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
                <Text style={styles.createBtnText}>Project aanmaken</Text>
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
  headerTitle: { fontSize: TYPE.displaySize, fontFamily: TYPE.displayFamily, color: SemanticColors.textPrimary, letterSpacing: TYPE.displayTracking },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: SafeArea.side, gap: GRID.sm },
  sectionTitle: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary, letterSpacing: TYPE.sectionTracking, marginTop: GRID.md, marginBottom: GRID.xs },
  projectCard: { flexDirection: 'row', backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, overflow: 'hidden' },
  statusBar: { width: 4 },
  cardContent: { flex: 1, padding: 14, gap: 10 },
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
});

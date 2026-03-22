// =============================================================================
// JOB PIPELINE — Kanban Board
// =============================================================================
// Visual pipeline with horizontal scroll columns per job status
// =============================================================================

import { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions, Alert, RefreshControl, Modal, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG } from '../../src/theme/tabStyles';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { useAppState } from '../../src/state/AppState';
import { hapticSuccess } from '../../src/utils/haptics';
import { FadeIn } from '../../src/components/shared/FadeIn';
import { LoadingSkeleton } from '../../src/components/shared/LoadingSkeleton';
import type { JobStatus } from '../../src/domain/jobs';

type IconName = keyof typeof Ionicons.glyphMap;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_WIDTH = SCREEN_WIDTH * 0.68;

interface ColumnConfig {
  status: JobStatus;
  label: string;
  color: string;
  icon: IconName;
  nextStatus?: JobStatus;
  nextLabel?: string;
}

const getColumns = (t: (key: string, defaultValue: string) => string): ColumnConfig[] => [
  { status: 'lead', label: t('pipeline.leads', 'Leads'), color: Palette.terracotta, icon: 'person-add-outline', nextStatus: 'quoted', nextLabel: t('pipeline.createQuote', 'Offerte maken') },
  { status: 'quoted', label: t('pipeline.quotes', 'Offertes'), color: SemanticColors.feedbackInfo, icon: 'document-text-outline', nextStatus: 'accepted', nextLabel: t('pipeline.accept', 'Accepteren') },
  { status: 'accepted', label: t('pipeline.accepted', 'Geaccepteerd'), color: '#10B981', icon: 'checkmark-circle-outline', nextStatus: 'scheduled', nextLabel: t('pipeline.schedule', 'Inplannen') },
  { status: 'scheduled', label: t('pipeline.scheduled', 'Ingepland'), color: SemanticColors.feedbackWarning, icon: 'calendar-outline', nextStatus: 'in-progress', nextLabel: t('pipeline.start', 'Starten') },
  { status: 'in-progress', label: t('pipeline.active', 'Actief'), color: '#FF5A1F', icon: 'play-circle-outline', nextStatus: 'completed', nextLabel: t('pipeline.complete', 'Afronden') },
  { status: 'completed', label: t('pipeline.completed', 'Afgerond'), color: SemanticColors.feedbackSuccess, icon: 'checkmark-done-outline', nextStatus: 'invoiced', nextLabel: t('pipeline.invoice', 'Factureren') },
  { status: 'invoiced', label: t('pipeline.invoiced', 'Gefactureerd'), color: '#6366F1', icon: 'receipt-outline', nextStatus: 'paid', nextLabel: t('pipeline.paid', 'Betaald') },
  { status: 'paid', label: t('pipeline.paidStatus', 'Betaald'), color: '#059669', icon: 'wallet-outline' },
];

const getTradeOptions = (t: (key: string, defaultValue: string) => string) => [
  t('pipeline.tradePlumber', 'Loodgieter'),
  t('pipeline.tradeElectrician', 'Elektricien'),
  t('pipeline.tradePainter', 'Schilder'),
  t('pipeline.tradeCarpenter', 'Timmerman'),
] as const;

export default function PipelineScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { jobs, updateJobStatus, customers, addJob } = useAppState();
  const COLUMNS = getColumns(t);
  const TRADE_OPTIONS = getTradeOptions(t);

  const [loading, setLoading] = useState(true);

  // Brief loading state with 300ms minimum to prevent flicker
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  const [showNewJob, setShowNewJob] = useState(false);
  const [newJobTitle, setNewJobTitle] = useState('');
  const [newJobCustomer, setNewJobCustomer] = useState('');
  const [newJobAddress, setNewJobAddress] = useState('');
  const [newJobTrade, setNewJobTrade] = useState('');

  const handleCreateJob = async () => {
    if (!newJobTitle.trim()) return;
    await addJob(
      newJobTitle.trim(),
      null,
      null,
      {
        address_street: newJobAddress.trim() || undefined,
        trade: newJobTrade || undefined,
      },
    );
    hapticSuccess();
    setNewJobTitle('');
    setNewJobCustomer('');
    setNewJobAddress('');
    setNewJobTrade('');
    setShowNewJob(false);
  };

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => { setRefreshing(true); setTimeout(() => { setRefreshing(false); hapticSuccess(); }, 600); }, []);

  const getCustomerName = (customerId: string | null) => {
    if (!customerId) return '';
    const c = customers.find(x => x.id === customerId);
    return c?.name ?? '';
  };

  const handleAdvance = (jobId: string, jobTitle: string, nextStatus: JobStatus, nextLabel: string) => {
    Alert.alert(nextLabel, t('pipeline.advanceConfirm', `"${jobTitle}" naar ${nextLabel.toLowerCase()}?`), [
      { text: t('pipeline.cancel', 'Annuleren'), style: 'cancel' },
      { text: nextLabel, onPress: () => updateJobStatus(jobId, nextStatus) },
    ]);
  };

  // Count totals
  const totalValue = jobs
    .filter(j => j.status !== 'cancelled')
    .reduce((sum, j) => sum + (j.agreedAmount || j.quotedAmount || 0), 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Terug">
          <Ionicons name="arrow-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('pipeline.title', 'Pipeline')}</Text>
          <Text style={styles.headerSubtitle}>
            {t('pipeline.headerStats', `${jobs.filter(j => j.status !== 'cancelled').length} klussen · €${totalValue.toLocaleString('nl-NL')} totaal`)}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
          onPress={() => setShowNewJob(true)}
          accessibilityLabel="Nieuwe klus"
        >
          <Ionicons name="add" size={22} color={Palette.white} />
        </Pressable>
      </View>

      {/* New Job Modal */}
      <Modal visible={showNewJob} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalDismiss} onPress={() => setShowNewJob(false)} accessibilityLabel="Sluiten" />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('pipeline.newJob', 'Nieuwe klus')}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t('pipeline.jobDescription', 'Omschrijving klus')}
              placeholderTextColor={SemanticColors.textTertiary}
              value={newJobTitle}
              onChangeText={setNewJobTitle}
            />
            <TextInput
              style={styles.modalInput}
              placeholder={t('pipeline.customer', 'Klant')}
              placeholderTextColor={SemanticColors.textTertiary}
              value={newJobCustomer}
              onChangeText={setNewJobCustomer}
            />
            <TextInput
              style={styles.modalInput}
              placeholder={t('pipeline.address', 'Adres')}
              placeholderTextColor={SemanticColors.textTertiary}
              value={newJobAddress}
              onChangeText={setNewJobAddress}
            />
            <View style={styles.modalCatRow}>
              {TRADE_OPTIONS.map(trade => (
                <Pressable
                  key={trade}
                  style={[styles.modalCatChip, newJobTrade === trade && styles.modalCatChipActive]}
                  onPress={() => setNewJobTrade(newJobTrade === trade ? '' : trade)}
                >
                  <Text style={[styles.modalCatChipText, newJobTrade === trade && styles.modalCatChipTextActive]}>
                    {trade}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={({ pressed }) => [styles.modalSubmit, pressed && { opacity: 0.9 }, !newJobTitle.trim() && { opacity: 0.5 }]}
              onPress={handleCreateJob}
              disabled={!newJobTitle.trim()}
            >
              <Text style={styles.modalSubmitText}>{t('pipeline.create', 'Aanmaken')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {loading ? (
        <View style={{ padding: Spacing.sm }}>
          <LoadingSkeleton variant="card" count={3} />
        </View>
      ) : (
      <ScrollView style={{ flex: 1 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.hermesOrange} />}>
      {/* Pipeline summary bar */}
      <FadeIn delay={0} duration={400}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.summaryBar} contentContainerStyle={styles.summaryBarContent}>
          {COLUMNS.map(col => {
            const count = jobs.filter(j => j.status === col.status).length;
            return (
              <View key={col.status} style={styles.summaryChip}>
                <View style={[styles.summaryDot, { backgroundColor: col.color }]} />
                <Text style={styles.summaryCount}>{count}</Text>
                <Text style={styles.summaryLabel}>{col.label}</Text>
              </View>
            );
          })}
        </ScrollView>
      </FadeIn>

      {/* Kanban columns */}
      <ScrollView
        horizontal
        pagingEnabled={false}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={COLUMN_WIDTH + 12}
        contentContainerStyle={styles.kanbanContent}
      >
        {COLUMNS.map(col => {
          const columnJobs = jobs
            .filter(j => j.status === col.status)
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
          const columnValue = columnJobs.reduce((sum, j) => sum + (j.agreedAmount || j.quotedAmount || 0), 0);

          return (
            <View key={col.status} style={styles.column}>
              {/* Column header */}
              <View style={styles.columnHeader}>
                <View style={[styles.columnHeaderAccent, { backgroundColor: col.color }]} />
                <Ionicons name={col.icon} size={16} color={col.color} />
                <Text style={styles.columnTitle}>{col.label}</Text>
                <View style={[styles.columnCountBadge, { backgroundColor: col.color + '20' }]}>
                  <Text style={[styles.columnCount, { color: col.color }]}>{columnJobs.length}</Text>
                </View>
              </View>
              {columnValue > 0 && (
                <Text style={styles.columnValue}>€{columnValue.toLocaleString('nl-NL')}</Text>
              )}

              {/* Job cards */}
              <ScrollView style={styles.columnScroll} showsVerticalScrollIndicator={false}>
                {columnJobs.length === 0 ? (
                  <View style={styles.emptyColumn}>
                    <Text style={styles.emptyColumnText}>{t('pipeline.noJobs', 'Geen klussen')}</Text>
                  </View>
                ) : (
                  columnJobs.map(job => {
                    const customerName = getCustomerName(job.customerId);
                    const amount = job.agreedAmount || job.quotedAmount || 0;

                    return (
                      <Pressable
                        key={job.id}
                        style={styles.jobCard}
                        onPress={() => router.push(`/contractor/job/${job.id}` as any)}
                      >
                        <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
                        {customerName ? (
                          <Text style={styles.jobCustomer} numberOfLines={1}>{customerName}</Text>
                        ) : null}
                        <View style={styles.jobMeta}>
                          {amount > 0 && (
                            <Text style={styles.jobAmount}>€{amount.toLocaleString('nl-NL')}</Text>
                          )}
                          {job.trade && (
                            <View style={styles.jobTradeBadge}>
                              <Text style={styles.jobTradeText}>{job.trade}</Text>
                            </View>
                          )}
                        </View>
                        {/* Advance button */}
                        {col.nextStatus && (
                          <Pressable
                            style={[styles.advanceBtn, { backgroundColor: col.color + '10' }]}
                            onPress={() => handleAdvance(job.id, job.title, col.nextStatus!, col.nextLabel!)}
                          >
                            <Text style={[styles.advanceBtnText, { color: col.color }]}>{col.nextLabel}</Text>
                            <Ionicons name="chevron-forward" size={14} color={col.color} />
                          </Pressable>
                        )}
                      </Pressable>
                    );
                  })
                )}
                <View style={{ height: 20 }} />
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>
      </ScrollView>
      )}

      {/* FAB */}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.95 }] }]}
        onPress={() => setShowNewJob(true)}
        accessibilityLabel="Nieuwe klus"
      >
        <Ionicons name="add" size={28} color={Palette.white} />
      </Pressable>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: SafeArea.side, paddingTop: SafeArea.top, paddingBottom: Spacing.xs },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 24, fontFamily: 'Manrope_700Bold', color: SemanticColors.textPrimary },
  headerSubtitle: { fontSize: 14, color: SemanticColors.textSecondary, marginTop: 2 },

  // Summary bar
  summaryBar: { maxHeight: 36, marginBottom: Spacing.sm },
  summaryBarContent: { paddingHorizontal: SafeArea.side, gap: 8 },
  summaryChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: SemanticColors.surfacePrimary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  summaryDot: { width: 8, height: 8, borderRadius: 4 },
  summaryCount: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: SemanticColors.textPrimary },
  summaryLabel: { fontSize: 11, color: SemanticColors.textSecondary },

  // Kanban
  kanbanContent: { paddingHorizontal: SafeArea.side, gap: 12, paddingBottom: 20, paddingRight: SafeArea.side + COLUMN_WIDTH * 0.3 },
  column: { width: COLUMN_WIDTH, backgroundColor: SemanticColors.surfacePrimary, borderRadius: 16, padding: Spacing.sm, paddingBottom: 0 },
  columnHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  columnHeaderAccent: { width: 3, height: 16, borderRadius: 2 },
  columnTitle: { flex: 1, fontSize: 14, fontFamily: 'Manrope_700Bold', color: SemanticColors.textPrimary },
  columnCountBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  columnCount: { fontSize: 12, fontFamily: 'Manrope_700Bold' },
  columnValue: { fontSize: 12, color: SemanticColors.textSecondary, marginTop: 2, marginLeft: 9 },
  columnScroll: { flex: 1, marginTop: Spacing.sm },

  emptyColumn: { paddingVertical: Spacing.lg, alignItems: 'center' },
  emptyColumnText: { fontSize: 12, color: SemanticColors.textTertiary },

  // Job cards
  jobCard: {
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 12,
    padding: Spacing.sm,
    marginBottom: 6,
    gap: 4,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  jobTitle: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: SemanticColors.textPrimary },
  jobCustomer: { fontSize: 12, color: SemanticColors.textSecondary },
  jobMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  jobAmount: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: SemanticColors.textPrimary },
  jobTradeBadge: { backgroundColor: Palette.hermesOrange + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  jobTradeText: { fontSize: 10, fontFamily: 'Manrope_600SemiBold', color: Palette.hermesOrange },
  advanceBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 6, borderRadius: 8, marginTop: 4 },
  advanceBtnText: { fontSize: 12, fontFamily: 'Manrope_600SemiBold' },

  // Header add button
  addBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Palette.hermesOrange, alignItems: 'center', justifyContent: 'center' },

  // FAB
  fab: { position: 'absolute', bottom: SafeArea.bottom + 16, right: SafeArea.side, width: 56, height: 56, borderRadius: 16, backgroundColor: Palette.hermesOrange, alignItems: 'center', justifyContent: 'center', shadowColor: Palette.hermesOrange, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalDismiss: { flex: 1 },
  modalSheet: { backgroundColor: SemanticColors.surfacePrimary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingTop: SafeArea.top, paddingBottom: 40, gap: 12 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: SemanticColors.borderDefault, alignSelf: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 18, fontFamily: 'Manrope_700Bold', color: SemanticColors.textPrimary },
  modalInput: { backgroundColor: SemanticColors.surfaceBackground, borderRadius: 12, borderWidth: 1, borderColor: SemanticColors.borderDefault, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontFamily: 'Manrope_500Medium', color: SemanticColors.textPrimary },
  modalCatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modalCatChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: SemanticColors.surfaceSecondary },
  modalCatChipActive: { backgroundColor: Palette.hermesOrange },
  modalCatChipText: { fontSize: 13, fontFamily: 'Manrope_500Medium', color: SemanticColors.textSecondary },
  modalCatChipTextActive: { color: Palette.white },
  modalSubmit: { backgroundColor: Palette.hermesOrange, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  modalSubmitText: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: Palette.white },
});

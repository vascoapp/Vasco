// =============================================================================
// JOB CLOSEOUT — Klus afsluiting
// =============================================================================
// Post-payment completion checklist: satisfaction, warranty, feedback
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG } from '../../src/theme/tabStyles';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { useAppState } from '../../src/state/AppState';
import { hapticSuccess } from '../../src/utils/haptics';
import { Toast } from '../../src/components/shared/Toast';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Ticked checklist items and finished closeouts are persisted here.
// Previously all of this lived in React state only: ticking eight items and
// backgrounding the app lost them, and "Klus afsluiten" showed a success
// toast while changing nothing — so the job reappeared in this list on the
// next visit, still at 0%.
const CLOSEOUT_STORAGE_KEY = '@vasco_closeout_state';

interface PersistedCloseout {
  /** itemId -> completed. Only ticked ids are stored. */
  checked: Record<string, string[]>;
  /** jobId -> ISO timestamp of when the contractor closed it out. */
  closedAt: Record<string, string>;
}

type IconName = keyof typeof Ionicons.glyphMap;

interface CloseoutItem {
  id: string;
  label: string;
  description: string;
  icon: IconName;
  required: boolean;
  completed: boolean;
}

interface CloseoutJob {
  jobId: string;
  title: string;
  customerName: string;
  completedAt: string;
  items: CloseoutItem[];
}

const createCloseoutItems = (t: (key: string, defaultValue: string) => string): CloseoutItem[] => [
  { id: 'photos', label: t('closeout.finalPhotos', 'Eindfotos gemaakt'), description: t('closeout.finalPhotosDesc', 'Voor-en-na fotos voor dossier'), icon: 'camera-outline', required: true, completed: false },
  { id: 'checklist', label: t('closeout.deliveryChecklist', 'Opleverchecklist'), description: t('closeout.deliveryChecklistDesc', 'Alle punten gecontroleerd en afgetekend'), icon: 'checkbox-outline', required: true, completed: false },
  { id: 'customer-sign', label: t('closeout.customerApproval', 'Klant akkoord'), description: t('closeout.customerApprovalDesc', 'Klant heeft oplevering goedgekeurd'), icon: 'create-outline', required: true, completed: false },
  { id: 'warranty', label: t('closeout.warrantyCard', 'Garantiekaart'), description: t('closeout.warrantyCardDesc', 'Garantievoorwaarden overhandigd'), icon: 'shield-checkmark-outline', required: false, completed: false },
  { id: 'manual', label: t('closeout.userManual', 'Gebruiksaanwijzing'), description: t('closeout.userManualDesc', 'Instructies en onderhoudstips gedeeld'), icon: 'book-outline', required: false, completed: false },
  { id: 'feedback', label: t('closeout.reviewRequested', 'Review gevraagd'), description: t('closeout.reviewRequestedDesc', 'Klant uitgenodigd voor Google review'), icon: 'star-outline', required: false, completed: false },
  { id: 'cleanup', label: t('closeout.workplaceCleaned', 'Werkplek opgeruimd'), description: t('closeout.workplaceCleanedDesc', 'Alles schoon en netjes achtergelaten'), icon: 'sparkles-outline', required: true, completed: false },
  { id: 'follow-up', label: t('closeout.followUpAppointment', 'Vervolgafspraak'), description: t('closeout.followUpAppointmentDesc', 'Onderhoud of controle ingepland'), icon: 'calendar-outline', required: false, completed: false },
];

export default function CloseoutScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  // NOTE: updateJobStatus is deliberately NOT used here — see handleFinalize.
  const { jobs, customers } = useAppState();

  const [persisted, setPersisted] = useState<PersistedCloseout>({ checked: {}, closedAt: {} });

  useEffect(() => {
    AsyncStorage.getItem(CLOSEOUT_STORAGE_KEY)
      .then(raw => {
        if (raw) {
          const parsed = JSON.parse(raw);
          setPersisted({ checked: parsed?.checked ?? {}, closedAt: parsed?.closedAt ?? {} });
        }
      })
      .catch(() => {});
  }, []);

  const save = useCallback((next: PersistedCloseout) => {
    setPersisted(next);
    AsyncStorage.setItem(CLOSEOUT_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const closedAtMap = persisted.closedAt;

  // Find jobs ready for closeout (paid or completed)
  // Wrapped in useMemo so the derived checklist map below has a stable
  // dependency; recomputed whenever jobs hydrate or a closeout is recorded.
  const closeoutJobs = useMemo(() => jobs
    .filter(j => ['paid', 'completed', 'invoiced'].includes(j.status))
    // Already closed out — keep it off the list instead of showing a
    // finished job back at 0% every time the screen is opened.
    .filter(j => !closedAtMap[j.id])
    .map(j => {
      const customer = customers.find(c => c.id === j.customerId);
      return {
        jobId: j.id,
        title: j.title,
        customerName: customer?.name ?? t('closeout.unknownCustomer', 'Onbekende klant'),
        completedAt: j.completedAt ?? j.updatedAt,
      };
    }), [jobs, customers, closedAtMap, t]);

  // Derived from the persisted ticks rather than seeded once — the old
  // useState initialiser ran on the FIRST render only, so any job that
  // hydrated later (AppState loads async) never got a checklist entry at all.
  const closeoutData = useMemo(() => {
    const map = new Map<string, CloseoutItem[]>();
    for (const j of closeoutJobs) {
      const ticked = new Set(persisted.checked[j.jobId] ?? []);
      map.set(j.jobId, createCloseoutItems(t).map(i => ({ ...i, completed: ticked.has(i.id) })));
    }
    return map;
  }, [closeoutJobs, persisted.checked, t]);
  const [expandedJob, setExpandedJob] = useState<string | null>(
    closeoutJobs.length === 1 ? closeoutJobs[0].jobId : null,
  );
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  const toggleItem = (jobId: string, itemId: string) => {
    const current = persisted.checked[jobId] ?? [];
    const next = current.includes(itemId)
      ? current.filter(id => id !== itemId)
      : [...current, itemId];
    save({ ...persisted, checked: { ...persisted.checked, [jobId]: next } });
    hapticSuccess();
  };

  const getProgress = (jobId: string) => {
    const items = closeoutData.get(jobId) ?? [];
    const total = items.length;
    const done = items.filter(i => i.completed).length;
    const requiredDone = items.filter(i => i.required && i.completed).length;
    const requiredTotal = items.filter(i => i.required).length;
    return { total, done, requiredDone, requiredTotal, percentage: total > 0 ? Math.round((done / total) * 100) : 0 };
  };

  const handleFinalize = (job: typeof closeoutJobs[0]) => {
    const progress = getProgress(job.jobId);
    if (progress.requiredDone < progress.requiredTotal) {
      Alert.alert(t('closeout.requiredSteps', 'Verplichte stappen'), t('closeout.requiredStepsRemaining', { defaultValue: '{{count}} required step(s) not yet completed.', count: progress.requiredTotal - progress.requiredDone }));
      return;
    }
    Alert.alert(
      t('closeout.closeJob', 'Klus afsluiten'),
      t('closeout.closeJobConfirm', { defaultValue: 'Close "{{title}}" permanently? This marks the job as fully completed.', title: job.title }),
      [
        { text: t('closeout.cancel', 'Annuleren'), style: 'cancel' },
        {
          text: t('closeout.close', 'Afsluiten'),
          onPress: () => {
            // Record the closeout so it survives a restart and the job stops
            // reappearing in this list. NOTE: this deliberately does NOT touch
            // the job's business status. There is no 'closed' JobStatus, and
            // the terminal one is 'paid' — advancing a merely-'completed' job
            // to 'paid' here would assert the customer had paid when they may
            // not have. Closeout is a handover checklist, not a payment event.
            save({
              ...persisted,
              closedAt: { ...persisted.closedAt, [job.jobId]: new Date().toISOString() },
            });
            hapticSuccess();
            setToastMessage(t('closeout.closed', 'Afgesloten') + ' — ' + t('closeout.closedSuccess', { defaultValue: '"{{title}}" has been successfully closed. Well done!', title: job.title }));
            setShowToast(true);
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel={t('common.back', 'Back')}>
          <Ionicons name="chevron-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          {/* "AUFTRAGSABSCHLUSS" broke to "AUFTRAGSABSCHLUS / S" at 24pt with
              letterSpacing 1.2 — the long-German-compound class (#113), which
              wrapping cannot fix because it is one word. Shrink instead. */}
          <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {t('closeout.title', 'Klus Afsluiting')}
          </Text>
          <Text style={styles.headerSubtitle}>{t('closeout.subtitle', { defaultValue: '{{count}} jobs to close out', count: closeoutJobs.length })}</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {closeoutJobs.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-done-circle-outline" size={48} color={SemanticColors.feedbackSuccess} />
            <Text style={styles.emptyTitle}>{t('closeout.allClosed', 'Alles afgesloten')}</Text>
            <Text style={styles.emptyText}>{t('closeout.noJobsWaiting', 'Geen klussen wachten op afsluiting')}</Text>
          </View>
        ) : (
          closeoutJobs.map(job => {
            const isExpanded = expandedJob === job.jobId;
            const progress = getProgress(job.jobId);
            const items = closeoutData.get(job.jobId) ?? [];

            return (
              <View key={job.jobId} style={styles.jobSection}>
                {/* Job header */}
                <Pressable
                  style={styles.jobHeader}
                  onPress={() => setExpandedJob(isExpanded ? null : job.jobId)}
                >
                  <View style={styles.jobInfo}>
                    <Text style={styles.jobTitle}>{job.title}</Text>
                    <Text style={styles.jobCustomer}>{job.customerName}</Text>
                  </View>
                  <View style={styles.progressCircle}>
                    <Text style={styles.progressText}>{progress.percentage}%</Text>
                  </View>
                </Pressable>

                {/* Progress bar */}
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${progress.percentage}%` }]} />
                </View>
                <Text style={styles.progressLabel}>
                  {t('closeout.stepsCompleted', { defaultValue: '{{done}}/{{total}} steps completed', done: progress.done, total: progress.total })}
                </Text>

                {/* Checklist */}
                {isExpanded && (
                  <View style={styles.checklist}>
                    {items.map(item => (
                      <Pressable
                        key={item.id}
                        style={[styles.checkItem, item.completed && styles.checkItemDone]}
                        onPress={() => toggleItem(job.jobId, item.id)}
                      >
                        <Ionicons
                          name={item.completed ? 'checkbox' : 'square-outline'}
                          size={22}
                          color={item.completed ? SemanticColors.feedbackSuccess : SemanticColors.textTertiary}
                        />
                        <View style={styles.checkInfo}>
                          <View style={styles.checkLabelRow}>
                            <Text style={[styles.checkLabel, item.completed && styles.checkLabelDone]}>
                              {item.label}
                            </Text>
                            {item.required && !item.completed && (
                              <View style={styles.requiredBadge}>
                                <Text style={styles.requiredText}>{t('closeout.required', 'Verplicht')}</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.checkDesc}>{item.description}</Text>
                        </View>
                        <Ionicons name={item.icon} size={18} color={item.completed ? SemanticColors.feedbackSuccess : SemanticColors.textTertiary} />
                      </Pressable>
                    ))}

                    {/* Finalize button */}
                    <Pressable
                      style={[
                        styles.finalizeButton,
                        progress.requiredDone < progress.requiredTotal && styles.finalizeButtonDisabled,
                      ]}
                      onPress={() => handleFinalize(job)}
                    >
                      <Ionicons name="checkmark-done-circle" size={20} color="#fff" />
                      <Text style={styles.finalizeText}>{t('closeout.finalizeJob', 'Klus definitief afsluiten')}</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
      <Toast
        message={toastMessage}
        visible={showToast}
        onHide={() => setShowToast(false)}
        type="success"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: SafeArea.side, paddingTop: SafeArea.top, paddingBottom: Spacing.sm },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 24, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textPrimary, textTransform: 'uppercase', letterSpacing: 1.2 },
  headerSubtitle: { fontSize: 14, color: SemanticColors.textSecondary, marginTop: 2 },
  scrollView: { flex: 1, paddingHorizontal: SafeArea.side },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: Spacing.sm },
  emptyTitle: { fontSize: 18, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textPrimary },
  emptyText: { fontSize: 14, color: SemanticColors.textSecondary },
  jobSection: { marginBottom: Spacing.lg },
  jobHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  jobInfo: { flex: 1 },
  jobTitle: { fontSize: 16, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textPrimary },
  jobCustomer: { fontSize: 13, color: SemanticColors.textSecondary, marginTop: 2 },
  progressCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.hermesOrange + '15', alignItems: 'center', justifyContent: 'center' },
  progressText: { fontSize: 13, fontFamily: 'Archivo_800ExtraBold', color: Palette.hermesOrange },
  progressBar: { height: 6, backgroundColor: SemanticColors.borderDefault, borderRadius: 3, overflow: 'hidden', marginTop: Spacing.sm },
  progressFill: { height: '100%', backgroundColor: SemanticColors.feedbackSuccess, borderRadius: 3 },
  progressLabel: { fontSize: 12, color: SemanticColors.textSecondary, marginTop: 4, marginBottom: Spacing.sm },
  checklist: { gap: 4 },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: SemanticColors.surfacePrimary, borderRadius: 12, padding: Spacing.sm },
  checkItemDone: { opacity: 0.7 },
  checkInfo: { flex: 1 },
  checkLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkLabel: { fontSize: 14, fontFamily: 'Archivo_700Bold', color: SemanticColors.textPrimary },
  checkLabelDone: { textDecorationLine: 'line-through', color: SemanticColors.textSecondary },
  checkDesc: { fontSize: 12, color: SemanticColors.textTertiary, marginTop: 1 },
  requiredBadge: { backgroundColor: SemanticColors.feedbackWarning + '20', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  requiredText: { fontSize: 9, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.feedbackWarning },
  finalizeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, backgroundColor: SemanticColors.feedbackSuccess, borderRadius: 12, padding: Spacing.md, paddingVertical: 14, marginTop: Spacing.sm },
  finalizeButtonDisabled: { backgroundColor: SemanticColors.textTertiary },
  finalizeText: { fontSize: 16, fontFamily: 'Archivo_800ExtraBold', color: '#fff' },
});

// =============================================================================
// JOB CLOSEOUT — Klus afsluiting
// =============================================================================
// Post-payment completion checklist: satisfaction, warranty, feedback
// =============================================================================

import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG } from '../../src/theme/tabStyles';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { useAppState } from '../../src/state/AppState';
import { hapticSuccess } from '../../src/utils/haptics';
import { Toast } from '../../src/components/shared/Toast';

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
  const { jobs, customers, updateJobStatus } = useAppState();

  // Find jobs ready for closeout (paid or completed)
  const closeoutJobs = jobs
    .filter(j => ['paid', 'completed', 'invoiced'].includes(j.status))
    .map(j => {
      const customer = customers.find(c => c.id === j.customerId);
      return {
        jobId: j.id,
        title: j.title,
        customerName: customer?.name ?? t('closeout.unknownCustomer', 'Onbekende klant'),
        completedAt: j.completedAt ?? j.updatedAt,
      };
    });

  const [closeoutData, setCloseoutData] = useState<Map<string, CloseoutItem[]>>(
    new Map(closeoutJobs.map(j => [j.jobId, createCloseoutItems(t)])),
  );
  const [expandedJob, setExpandedJob] = useState<string | null>(
    closeoutJobs.length === 1 ? closeoutJobs[0].jobId : null,
  );
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  const toggleItem = (jobId: string, itemId: string) => {
    setCloseoutData(prev => {
      const next = new Map(prev);
      const items = next.get(jobId) ?? createCloseoutItems(t);
      const updated = items.map(i =>
        i.id === itemId ? { ...i, completed: !i.completed } : i,
      );
      next.set(jobId, updated);
      return next;
    });
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
      Alert.alert(t('closeout.requiredSteps', 'Verplichte stappen'), t('closeout.requiredStepsRemaining', `Nog ${progress.requiredTotal - progress.requiredDone} verplichte stap(pen) niet afgerond.`));
      return;
    }
    Alert.alert(
      t('closeout.closeJob', 'Klus afsluiten'),
      t('closeout.closeJobConfirm', `"${job.title}" definitief afsluiten? Dit markeert de klus als volledig afgerond.`),
      [
        { text: t('closeout.cancel', 'Annuleren'), style: 'cancel' },
        {
          text: t('closeout.close', 'Afsluiten'),
          onPress: () => {
            hapticSuccess();
            setToastMessage(t('closeout.closed', 'Afgesloten') + ' — ' + t('closeout.closedSuccess', `"${job.title}" is succesvol afgesloten. Goed werk!`));
            setShowToast(true);
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('closeout.title', 'Klus Afsluiting')}</Text>
          <Text style={styles.headerSubtitle}>{t('closeout.subtitle', `${closeoutJobs.length} klussen af te sluiten`)}</Text>
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
                  {t('closeout.stepsCompleted', `${progress.done}/${progress.total} stappen afgerond`)}
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
  headerTitle: { fontSize: 24, fontFamily: 'Manrope_700Bold', color: SemanticColors.textPrimary, textTransform: 'uppercase', letterSpacing: 1.2 },
  headerSubtitle: { fontSize: 14, color: SemanticColors.textSecondary, marginTop: 2 },
  scrollView: { flex: 1, paddingHorizontal: SafeArea.side },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: Spacing.sm },
  emptyTitle: { fontSize: 18, fontFamily: 'Manrope_700Bold', color: SemanticColors.textPrimary },
  emptyText: { fontSize: 14, color: SemanticColors.textSecondary },
  jobSection: { marginBottom: Spacing.lg },
  jobHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  jobInfo: { flex: 1 },
  jobTitle: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: SemanticColors.textPrimary },
  jobCustomer: { fontSize: 13, color: SemanticColors.textSecondary, marginTop: 2 },
  progressCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.hermesOrange + '15', alignItems: 'center', justifyContent: 'center' },
  progressText: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: Palette.hermesOrange },
  progressBar: { height: 6, backgroundColor: SemanticColors.borderDefault, borderRadius: 3, overflow: 'hidden', marginTop: Spacing.sm },
  progressFill: { height: '100%', backgroundColor: SemanticColors.feedbackSuccess, borderRadius: 3 },
  progressLabel: { fontSize: 12, color: SemanticColors.textSecondary, marginTop: 4, marginBottom: Spacing.sm },
  checklist: { gap: 4 },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: SemanticColors.surfacePrimary, borderRadius: 12, padding: Spacing.sm },
  checkItemDone: { opacity: 0.7 },
  checkInfo: { flex: 1 },
  checkLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkLabel: { fontSize: 14, fontFamily: 'Manrope_600SemiBold', color: SemanticColors.textPrimary },
  checkLabelDone: { textDecorationLine: 'line-through', color: SemanticColors.textSecondary },
  checkDesc: { fontSize: 12, color: SemanticColors.textTertiary, marginTop: 1 },
  requiredBadge: { backgroundColor: SemanticColors.feedbackWarning + '20', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  requiredText: { fontSize: 9, fontFamily: 'Manrope_700Bold', color: SemanticColors.feedbackWarning },
  finalizeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, backgroundColor: SemanticColors.feedbackSuccess, borderRadius: 12, padding: Spacing.md, paddingVertical: 14, marginTop: Spacing.sm },
  finalizeButtonDisabled: { backgroundColor: SemanticColors.textTertiary },
  finalizeText: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: '#fff' },
});

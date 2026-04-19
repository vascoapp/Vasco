// DispatchBoard.tsx - ServiceTitan-style dispatch management
// Drag-drop job assignment, worker status, live map view

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { Spacing } from '../../theme/spacing';
import type { Worker, DispatchJob } from '../../types/sitelead';
import { MOCK_WORKERS, MOCK_DISPATCH_JOBS } from '../../data/mockSiteLead';
import { useTranslation } from 'react-i18next';

type IconName = keyof typeof Ionicons.glyphMap;

// ============================================
// CONFIGURATION
// ============================================

const WORKER_STATUS_CONFIG: Record<Worker['status'], { labelKey: string; fallback: string; color: string; icon: IconName }> = {
  available: { labelKey: 'sitelead.dispatchWorkerStatusAvailable', fallback: 'Beschikbaar', color: SemanticColors.feedbackSuccess, icon: 'checkmark-circle' },
  'on-job': { labelKey: 'sitelead.dispatchWorkerStatusOnJob', fallback: 'Bezig', color: SemanticColors.feedbackInfo, icon: 'construct' },
  traveling: { labelKey: 'sitelead.dispatchWorkerStatusTraveling', fallback: 'Onderweg', color: SemanticColors.feedbackWarning, icon: 'car' },
  break: { labelKey: 'sitelead.dispatchWorkerStatusBreak', fallback: 'Pauze', color: SemanticColors.textTertiary, icon: 'cafe' },
  'off-duty': { labelKey: 'sitelead.dispatchWorkerStatusOffDuty', fallback: 'Vrij', color: SemanticColors.textTertiary, icon: 'moon' },
};

const JOB_PRIORITY_CONFIG: Record<DispatchJob['priority'], { labelKey: string; fallback: string; color: string }> = {
  low: { labelKey: 'sitelead.dispatchPriorityLow', fallback: 'Laag', color: SemanticColors.textTertiary },
  medium: { labelKey: 'sitelead.dispatchPriorityMedium', fallback: 'Middel', color: SemanticColors.feedbackInfo },
  high: { labelKey: 'sitelead.dispatchPriorityHigh', fallback: 'Hoog', color: SemanticColors.feedbackWarning },
  urgent: { labelKey: 'sitelead.dispatchPriorityUrgent', fallback: 'Urgent', color: SemanticColors.feedbackError },
};

const JOB_STATUS_CONFIG: Record<DispatchJob['status'], { labelKey: string; fallback: string; color: string; icon: IconName }> = {
  unassigned: { labelKey: 'sitelead.dispatchJobUnassigned', fallback: 'Niet toegewezen', color: SemanticColors.feedbackError, icon: 'alert-circle' },
  assigned: { labelKey: 'sitelead.dispatchJobAssigned', fallback: 'Toegewezen', color: SemanticColors.feedbackInfo, icon: 'person' },
  'en-route': { labelKey: 'sitelead.dispatchJobEnRoute', fallback: 'Onderweg', color: SemanticColors.feedbackWarning, icon: 'car' },
  'in-progress': { labelKey: 'sitelead.dispatchJobInProgress', fallback: 'Bezig', color: SemanticColors.actionPrimary, icon: 'construct' },
  completed: { labelKey: 'sitelead.dispatchJobCompleted', fallback: 'Gereed', color: SemanticColors.feedbackSuccess, icon: 'checkmark-circle' },
  cancelled: { labelKey: 'sitelead.dispatchJobCancelled', fallback: 'Geannuleerd', color: SemanticColors.textTertiary, icon: 'close-circle' },
};

// ============================================
// SUB-COMPONENTS
// ============================================

interface WorkerCardProps {
  worker: Worker;
  isSelected: boolean;
  onSelect: () => void;
  assignedJob?: DispatchJob;
}

function WorkerCard({ worker, isSelected, onSelect, assignedJob }: WorkerCardProps) {
  const statusConfig = WORKER_STATUS_CONFIG[worker.status];

  return (
    <Pressable
      style={[styles.workerCard, isSelected && styles.workerCardSelected]}
      onPress={onSelect}
    >
      <View style={styles.workerHeader}>
        <View style={styles.workerAvatar}>
          <Text style={styles.workerInitials}>
            {worker.name.split(' ').map((n) => n[0]).join('')}
          </Text>
        </View>
        <View style={styles.workerInfo}>
          <Text style={styles.workerName}>{worker.name}</Text>
          <Text style={styles.workerTrade}>{worker.trade}</Text>
        </View>
        <View style={[styles.statusIndicator, { backgroundColor: statusConfig.color }]}>
          <Ionicons name={statusConfig.icon} size={12} color="#fff" />
        </View>
      </View>

      {assignedJob && (
        <View style={styles.currentJobBadge}>
          <Ionicons name="location" size={12} color={SemanticColors.textSecondary} />
          <Text style={styles.currentJobText} numberOfLines={1}>
            {assignedJob.address.split(',')[0]}
          </Text>
        </View>
      )}

      <View style={styles.workerStats}>
        <View style={styles.workerStat}>
          <Ionicons name="star" size={12} color={SemanticColors.feedbackWarning} />
          <Text style={styles.workerStatText}>{worker.rating}</Text>
        </View>
        <View style={styles.workerStat}>
          <Ionicons name="briefcase-outline" size={12} color={SemanticColors.textSecondary} />
          <Text style={styles.workerStatText}>{worker.jobsCompleted}</Text>
        </View>
        <Text style={styles.workerRate}>{'\u20AC'}{worker.hourlyRate}/u</Text>
      </View>
    </Pressable>
  );
}

interface JobCardProps {
  job: DispatchJob;
  onAssign: () => void;
  onViewDetails: () => void;
}

function JobCard({ job, onAssign, onViewDetails }: JobCardProps) {
  const { t } = useTranslation();
  const priorityConfig = JOB_PRIORITY_CONFIG[job.priority];
  const statusConfig = JOB_STATUS_CONFIG[job.status];

  const formatTime = (time: string) => {
    return time.slice(0, 5);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <Pressable style={styles.jobCard} onPress={onViewDetails}>
      <View style={styles.jobHeader}>
        <View style={styles.jobTimeBlock}>
          <Text style={styles.jobTime}>{formatTime(job.scheduledTime)}</Text>
          <Text style={styles.jobDuration}>{formatDuration(job.estimatedDuration)}</Text>
        </View>
        <View style={styles.jobContent}>
          <View style={styles.jobTitleRow}>
            <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
            <View style={[styles.priorityBadge, { backgroundColor: priorityConfig.color + '20' }]}>
              <Text style={[styles.priorityText, { color: priorityConfig.color }]}>
                {t(priorityConfig.labelKey, priorityConfig.fallback)}
              </Text>
            </View>
          </View>
          <View style={styles.jobLocationRow}>
            <Ionicons name="location-outline" size={12} color={SemanticColors.textSecondary} />
            <Text style={styles.jobAddress} numberOfLines={1}>{job.address}</Text>
          </View>
          <View style={styles.jobCustomerRow}>
            <Ionicons name="person-outline" size={12} color={SemanticColors.textSecondary} />
            <Text style={styles.jobCustomer}>{job.customerName}</Text>
          </View>
        </View>
      </View>

      <View style={styles.jobFooter}>
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
          <Ionicons name={statusConfig.icon} size={12} color={statusConfig.color} />
          <Text style={[styles.statusText, { color: statusConfig.color }]}>
            {t(statusConfig.labelKey, statusConfig.fallback)}
          </Text>
        </View>

        <Text style={styles.jobValue}>{'\u20AC'}{job.estimatedValue.toLocaleString()}</Text>

        {job.status === 'unassigned' && (
          <Pressable style={styles.assignButton} onPress={onAssign}>
            <Ionicons name="person-add" size={14} color={SemanticColors.actionPrimary} />
            <Text style={styles.assignButtonText}>{t('sitelead.dispatchAssign', 'Toewijzen')}</Text>
          </Pressable>
        )}
      </View>

      {job.assignedWorkers.length > 0 && (
        <View style={styles.assignedWorkers}>
          {job.assignedWorkers.map((workerId) => {
            const worker = MOCK_WORKERS.find((w) => w.id === workerId);
            return worker ? (
              <View key={workerId} style={styles.assignedWorkerChip}>
                <Text style={styles.assignedWorkerText}>{worker.name.split(' ')[0]}</Text>
              </View>
            ) : null;
          })}
        </View>
      )}
    </Pressable>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

interface DispatchBoardProps {
  onClose?: () => void;
}

export function DispatchBoard({ onClose }: DispatchBoardProps) {
  const { t } = useTranslation();
  const [workers] = useState<Worker[]>(MOCK_WORKERS);
  const [jobs] = useState<DispatchJob[]>(MOCK_DISPATCH_JOBS);
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');

  // Filter jobs by status
  const unassignedJobs = jobs.filter((j) => j.status === 'unassigned');
  const activeJobs = jobs.filter((j) => ['assigned', 'en-route', 'in-progress'].includes(j.status));
  const completedJobs = jobs.filter((j) => j.status === 'completed');

  // Get worker's current job
  const getWorkerJob = (workerId: string) => {
    return jobs.find((j) => j.assignedWorkers.includes(workerId) && j.status === 'in-progress');
  };

  const handleAssignJob = (jobId: string) => {
    if (!selectedWorker) {
      Alert.alert(t('sitelead.dispatchSelectWorker', 'Selecteer medewerker'), t('sitelead.dispatchSelectWorkerDesc', 'Selecteer eerst een medewerker om de klus toe te wijzen.'));
      return;
    }

    const worker = workers.find((w) => w.id === selectedWorker);
    const job = jobs.find((j) => j.id === jobId);

    Alert.alert(
      t('sitelead.dispatchAssignJob', 'Klus toewijzen'),
      t('sitelead.dispatchAssignConfirm', '"{{job}}" toewijzen aan {{worker}}?', { job: job?.title, worker: worker?.name }),
      [
        { text: t('sitelead.dispatchCancel', 'Annuleren'), style: 'cancel' },
        {
          text: t('sitelead.dispatchAssign', 'Toewijzen'),
          onPress: () => {
            Alert.alert(t('sitelead.dispatchAssigned', 'Toegewezen'), t('sitelead.dispatchAssignedDesc', 'Klus toegewezen aan {{worker}}', { worker: worker?.name }));
            setSelectedWorker(null);
          },
        },
      ]
    );
  };

  // Count by status
  const availableWorkers = workers.filter((w) => w.status === 'available').length;
  const workingWorkers = workers.filter((w) => w.status === 'on-job').length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('sitelead.dispatchTitle', 'Dispatch Overzicht')}</Text>
          <Text style={styles.subtitle}>{t('sitelead.dispatchToday', 'Vandaag')}, 1 feb</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={[styles.viewToggle, viewMode === 'list' && styles.viewToggleActive]}
            onPress={() => setViewMode('list')}
          >
            <Ionicons name="list" size={18} color={viewMode === 'list' ? '#fff' : SemanticColors.textSecondary} />
          </Pressable>
          <Pressable
            style={[styles.viewToggle, viewMode === 'timeline' && styles.viewToggleActive]}
            onPress={() => setViewMode('timeline')}
          >
            <Ionicons name="calendar" size={18} color={viewMode === 'timeline' ? '#fff' : SemanticColors.textSecondary} />
          </Pressable>
          {onClose && (
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={SemanticColors.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{unassignedJobs.length}</Text>
          <Text style={styles.statLabel}>{t('sitelead.dispatchUnassigned', 'Niet toegewezen')}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{activeJobs.length}</Text>
          <Text style={styles.statLabel}>{t('sitelead.dispatchActive', 'Bezig')}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{availableWorkers}</Text>
          <Text style={styles.statLabel}>{t('sitelead.dispatchAvailable', 'Beschikbaar')}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{workingWorkers}</Text>
          <Text style={styles.statLabel}>{t('sitelead.dispatchWorking', 'Aan het werk')}</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Workers Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('sitelead.dispatchWorkers', 'Medewerkers')} ({workers.length})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.workersScroll}>
            {workers.map((worker) => (
              <WorkerCard
                key={worker.id}
                worker={worker}
                isSelected={selectedWorker === worker.id}
                onSelect={() => setSelectedWorker(selectedWorker === worker.id ? null : worker.id)}
                assignedJob={getWorkerJob(worker.id)}
              />
            ))}
          </ScrollView>
        </View>

        {/* Unassigned Jobs */}
        {unassignedJobs.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('sitelead.dispatchUnassignedJobs', 'Niet-toegewezen klussen')}</Text>
              <View style={styles.alertBadge}>
                <Ionicons name="alert-circle" size={14} color={SemanticColors.feedbackError} />
                <Text style={styles.alertBadgeText}>{unassignedJobs.length}</Text>
              </View>
            </View>
            {unassignedJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onAssign={() => handleAssignJob(job.id)}
                onViewDetails={() => Alert.alert(t('sitelead.dispatchJobDetails', 'Klusdetails'), job.description)}
              />
            ))}
          </View>
        )}

        {/* Active Jobs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('sitelead.dispatchActiveJobs', 'Actieve klussen')} ({activeJobs.length})</Text>
          {activeJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onAssign={() => handleAssignJob(job.id)}
              onViewDetails={() => Alert.alert(t('sitelead.dispatchJobDetails', 'Klusdetails'), job.description)}
            />
          ))}
        </View>

        {/* Completed Today */}
        {completedJobs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('sitelead.dispatchCompletedToday', 'Vandaag gereed')} ({completedJobs.length})</Text>
            {completedJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onAssign={() => {}}
                onViewDetails={() => Alert.alert(t('sitelead.dispatchJobDetails', 'Klusdetails'), job.description)}
              />
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB - New Job */}
      <Pressable
        style={styles.fab}
        onPress={() => Alert.alert(t('sitelead.dispatchNewJob', 'Nieuwe klus'), t('sitelead.dispatchNewJobDesc', 'Nieuwe dispatch klus aanmaken'))}
      >
        <Ionicons name="add" size={24} color="#fff" />
      </Pressable>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: Spacing.lg,
    paddingTop: 60,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  title: {
    fontSize: TYPE.displaySize,
    fontFamily: 'Archivo_800ExtraBold',
    color: SemanticColors.textPrimary,
  },
  subtitle: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewToggle: {
    padding: 8,
    borderRadius: RADIUS.md,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  viewToggleActive: {
    backgroundColor: SemanticColors.actionPrimary,
  },
  closeButton: {
    padding: 8,
    marginLeft: 8,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.sm,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.md,
  },
  statValue: {
    fontSize: TYPE.sectionSize,
    fontFamily: 'Archivo_800ExtraBold',
    color: SemanticColors.textPrimary,
  },
  statLabel: {
    fontSize: TYPE.tinySize - 1,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },

  content: {
    flex: 1,
  },

  // Section
  section: {
    padding: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: TYPE.titleSize,
    fontFamily: 'Inter_600SemiBold',
    color: SemanticColors.textPrimary,
    marginBottom: Spacing.sm,
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SemanticColors.feedbackErrorBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.md,
  },
  alertBadgeText: {
    fontSize: TYPE.labelSize,
    fontFamily: 'Inter_600SemiBold',
    color: SemanticColors.feedbackError,
  },

  // Workers
  workersScroll: {
    marginHorizontal: -Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  workerCard: {
    width: 160,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    marginRight: Spacing.sm,
  },
  workerCardSelected: {
    borderWidth: 2,
    borderColor: SemanticColors.actionPrimary,
    backgroundColor: SemanticColors.actionPrimary + '10',
  },
  workerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  workerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: SemanticColors.actionPrimary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  workerInitials: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: 'Inter_600SemiBold',
    color: SemanticColors.actionPrimary,
  },
  workerInfo: {
    flex: 1,
    marginLeft: 8,
  },
  workerName: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: 'Inter_600SemiBold',
    color: SemanticColors.textPrimary,
  },
  workerTrade: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textSecondary,
  },
  statusIndicator: {
    width: 20,
    height: 20,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentJobBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SemanticColors.surfaceSecondary,
    padding: 6,
    borderRadius: 6,
    marginBottom: Spacing.sm,
  },
  currentJobText: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textSecondary,
    flex: 1,
  },
  workerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  workerStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  workerStatText: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textSecondary,
  },
  workerRate: {
    fontSize: TYPE.tinySize,
    fontFamily: 'Inter_600SemiBold',
    color: SemanticColors.textPrimary,
    marginLeft: 'auto',
  },

  // Job Card
  jobCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  jobHeader: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  jobTimeBlock: {
    alignItems: 'center',
    minWidth: 50,
  },
  jobTime: {
    fontSize: TYPE.titleSize,
    fontFamily: 'Archivo_800ExtraBold',
    color: SemanticColors.textPrimary,
  },
  jobDuration: {
    fontSize: TYPE.tinySize - 1,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  jobContent: {
    flex: 1,
    gap: 4,
  },
  jobTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  jobTitle: {
    fontSize: TYPE.bodySize,
    fontFamily: 'Inter_600SemiBold',
    color: SemanticColors.textPrimary,
    flex: 1,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: TYPE.tinySize - 1,
    fontFamily: 'Inter_600SemiBold',
  },
  jobLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  jobAddress: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    flex: 1,
  },
  jobCustomerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  jobCustomer: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
  },
  jobFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: TYPE.tinySize,
    fontFamily: 'Inter_600SemiBold',
  },
  jobValue: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: 'Archivo_800ExtraBold',
    color: SemanticColors.textPrimary,
    marginLeft: 'auto',
  },
  assignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SemanticColors.actionPrimary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  assignButtonText: {
    fontSize: TYPE.labelSize,
    fontFamily: 'Inter_600SemiBold',
    color: SemanticColors.actionPrimary,
  },
  assignedWorkers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: Spacing.sm,
  },
  assignedWorkerChip: {
    backgroundColor: SemanticColors.feedbackInfoBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.md,
  },
  assignedWorkerText: {
    fontSize: TYPE.tinySize,
    fontFamily: 'Inter_500Medium',
    color: SemanticColors.feedbackInfo,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: SemanticColors.actionPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default DispatchBoard;

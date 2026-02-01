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
import { Spacing } from '../../theme/spacing';
import type { Worker, DispatchJob } from '../../types/sitelead';
import { MOCK_WORKERS, MOCK_DISPATCH_JOBS } from '../../data/mockSiteLead';

type IconName = keyof typeof Ionicons.glyphMap;

// ============================================
// CONFIGURATION
// ============================================

const WORKER_STATUS_CONFIG: Record<Worker['status'], { label: string; color: string; icon: IconName }> = {
  available: { label: 'Available', color: SemanticColors.feedbackSuccess, icon: 'checkmark-circle' },
  'on-job': { label: 'On Job', color: SemanticColors.feedbackInfo, icon: 'construct' },
  traveling: { label: 'En Route', color: SemanticColors.feedbackWarning, icon: 'car' },
  break: { label: 'On Break', color: SemanticColors.textTertiary, icon: 'cafe' },
  'off-duty': { label: 'Off Duty', color: SemanticColors.textTertiary, icon: 'moon' },
};

const JOB_PRIORITY_CONFIG: Record<DispatchJob['priority'], { label: string; color: string }> = {
  low: { label: 'Low', color: SemanticColors.textTertiary },
  medium: { label: 'Medium', color: SemanticColors.feedbackInfo },
  high: { label: 'High', color: SemanticColors.feedbackWarning },
  urgent: { label: 'Urgent', color: SemanticColors.feedbackError },
};

const JOB_STATUS_CONFIG: Record<DispatchJob['status'], { label: string; color: string; icon: IconName }> = {
  unassigned: { label: 'Unassigned', color: SemanticColors.feedbackError, icon: 'alert-circle' },
  assigned: { label: 'Assigned', color: SemanticColors.feedbackInfo, icon: 'person' },
  'en-route': { label: 'En Route', color: SemanticColors.feedbackWarning, icon: 'car' },
  'in-progress': { label: 'In Progress', color: SemanticColors.actionPrimary, icon: 'construct' },
  completed: { label: 'Completed', color: SemanticColors.feedbackSuccess, icon: 'checkmark-circle' },
  cancelled: { label: 'Cancelled', color: SemanticColors.textTertiary, icon: 'close-circle' },
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
          <Ionicons name="star" size={12} color="#F59E0B" />
          <Text style={styles.workerStatText}>{worker.rating}</Text>
        </View>
        <View style={styles.workerStat}>
          <Ionicons name="briefcase-outline" size={12} color={SemanticColors.textSecondary} />
          <Text style={styles.workerStatText}>{worker.jobsCompleted}</Text>
        </View>
        <Text style={styles.workerRate}>{'\u20AC'}{worker.hourlyRate}/hr</Text>
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
                {priorityConfig.label}
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
            {statusConfig.label}
          </Text>
        </View>

        <Text style={styles.jobValue}>{'\u20AC'}{job.estimatedValue.toLocaleString()}</Text>

        {job.status === 'unassigned' && (
          <Pressable style={styles.assignButton} onPress={onAssign}>
            <Ionicons name="person-add" size={14} color={SemanticColors.actionPrimary} />
            <Text style={styles.assignButtonText}>Assign</Text>
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
      Alert.alert('Select Worker', 'Please select a worker first to assign the job.');
      return;
    }

    const worker = workers.find((w) => w.id === selectedWorker);
    const job = jobs.find((j) => j.id === jobId);

    Alert.alert(
      'Assign Job',
      `Assign "${job?.title}" to ${worker?.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Assign',
          onPress: () => {
            Alert.alert('Assigned', `Job assigned to ${worker?.name}`);
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
          <Text style={styles.title}>Dispatch Board</Text>
          <Text style={styles.subtitle}>Today, Feb 1st</Text>
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
          <Text style={styles.statLabel}>Unassigned</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{activeJobs.length}</Text>
          <Text style={styles.statLabel}>In Progress</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{availableWorkers}</Text>
          <Text style={styles.statLabel}>Available</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{workingWorkers}</Text>
          <Text style={styles.statLabel}>Working</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Workers Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Team ({workers.length})</Text>
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
              <Text style={styles.sectionTitle}>Unassigned Jobs</Text>
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
                onViewDetails={() => Alert.alert('Job Details', job.description)}
              />
            ))}
          </View>
        )}

        {/* Active Jobs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Jobs ({activeJobs.length})</Text>
          {activeJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onAssign={() => handleAssignJob(job.id)}
              onViewDetails={() => Alert.alert('Job Details', job.description)}
            />
          ))}
        </View>

        {/* Completed Today */}
        {completedJobs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Completed Today ({completedJobs.length})</Text>
            {completedJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onAssign={() => {}}
                onViewDetails={() => Alert.alert('Job Details', job.description)}
              />
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB - New Job */}
      <Pressable
        style={styles.fab}
        onPress={() => Alert.alert('New Job', 'Create new dispatch job')}
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
    backgroundColor: SemanticColors.surfaceBackground,
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
    fontSize: 28,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
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
    borderRadius: 8,
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
    borderRadius: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  statLabel: {
    fontSize: 10,
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
    fontSize: 16,
    fontWeight: '600',
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
    borderRadius: 12,
  },
  alertBadgeText: {
    fontSize: 12,
    fontWeight: '600',
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
    borderRadius: 12,
    padding: Spacing.md,
    marginRight: Spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  workerCardSelected: {
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
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.actionPrimary,
  },
  workerInfo: {
    flex: 1,
    marginLeft: 8,
  },
  workerName: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  workerTrade: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  statusIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
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
    fontSize: 11,
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
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  workerRate: {
    fontSize: 11,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginLeft: 'auto',
  },

  // Job Card
  jobCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
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
    fontSize: 16,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  jobDuration: {
    fontSize: 10,
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
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    flex: 1,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '600',
  },
  jobLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  jobAddress: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    flex: 1,
  },
  jobCustomerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  jobCustomer: {
    fontSize: 12,
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
    fontSize: 11,
    fontWeight: '600',
  },
  jobValue: {
    fontSize: 14,
    fontWeight: '700',
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
    fontSize: 12,
    fontWeight: '600',
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
    borderRadius: 12,
  },
  assignedWorkerText: {
    fontSize: 11,
    fontWeight: '500',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default DispatchBoard;

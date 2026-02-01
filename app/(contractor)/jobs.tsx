// =============================================================================
// JOBS - Contractor Jobs & Time Tracking
// =============================================================================
// All jobs, scheduling, and the time clock
// Connected to smartSchedulerService for real data
// =============================================================================

import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';
import { TimeTracker, TimeTrackerWidget } from '../../src/components/contractor/TimeTracker';
import { useScheduler, type ScheduledJob } from '../../src/services/smartSchedulerService';

type IconName = keyof typeof Ionicons.glyphMap;

// ============================================
// TYPES
// ============================================

type JobStatus = 'in-progress' | 'scheduled' | 'completed';

interface JobDisplay {
  id: string;
  title: string;
  customer: string;
  address: string;
  status: JobStatus;
  date: string;
  time?: string;
  value: number;
  progress?: number;
}

// ============================================
// COMPONENTS
// ============================================

function JobCard({ job, onPress }: { job: JobDisplay; onPress: () => void }) {
  const getStatusConfig = (status: JobStatus) => {
    switch (status) {
      case 'in-progress':
        return { label: 'Actief', color: SemanticColors.feedbackSuccess, bg: SemanticColors.feedbackSuccessBg };
      case 'scheduled':
        return { label: 'Gepland', color: Palette.hermesOrange, bg: Palette.pastelOrange + '30' };
      case 'completed':
        return { label: 'Voltooid', color: SemanticColors.textTertiary, bg: SemanticColors.surfaceSecondary };
    }
  };

  const statusConfig = getStatusConfig(job.status);

  return (
    <Pressable style={styles.jobCard} onPress={onPress}>
      <View style={styles.jobHeader}>
        <View style={styles.jobTitleRow}>
          <Text style={styles.jobTitle}>{job.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
            <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
          </View>
        </View>
        <Text style={styles.jobCustomer}>{job.customer}</Text>
      </View>

      <View style={styles.jobDetails}>
        <View style={styles.jobDetailRow}>
          <Ionicons name="calendar-outline" size={14} color={SemanticColors.textTertiary} />
          <Text style={styles.jobDetailText}>
            {job.date}{job.time ? ` om ${job.time}` : ''}
          </Text>
        </View>
        <View style={styles.jobDetailRow}>
          <Ionicons name="location-outline" size={14} color={SemanticColors.textTertiary} />
          <Text style={styles.jobDetailText}>{job.address}</Text>
        </View>
      </View>

      {job.progress !== undefined && (
        <View style={styles.progressSection}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${job.progress}%` }]} />
          </View>
          <Text style={styles.progressText}>{job.progress}% voltooid</Text>
        </View>
      )}

      <View style={styles.jobFooter}>
        <Text style={styles.jobValue}>€{job.value.toLocaleString()}</Text>
        <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
      </View>
    </Pressable>
  );
}

// ============================================
// MAIN SCREEN
// ============================================

type TabFilter = 'active' | 'upcoming' | 'completed';

export default function JobsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabFilter>('active');
  const [showTimeTracker, setShowTimeTracker] = useState(false);

  // Connect to scheduler service
  const { jobs: scheduledJobs, updateStatus } = useScheduler();

  // Transform service jobs to display format
  const displayJobs = useMemo((): JobDisplay[] => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = new Date(today.setDate(today.getDate() + 1)).toISOString().split('T')[0];

    return scheduledJobs.map((job): JobDisplay => {
      const jobDate = new Date(job.startTime);
      const dateStr = job.startTime.split('T')[0];

      // Format the date
      let displayDate: string;
      if (dateStr === todayStr) {
        displayDate = 'Vandaag';
      } else if (dateStr === tomorrowStr) {
        displayDate = 'Morgen';
      } else {
        displayDate = jobDate.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
      }

      // Map status
      let status: JobStatus;
      switch (job.status) {
        case 'in_progress':
          status = 'in-progress';
          break;
        case 'completed':
          status = 'completed';
          break;
        default:
          status = 'scheduled';
      }

      return {
        id: job.id,
        title: job.projectName,
        customer: job.customerName,
        address: job.address.split(',')[0], // Just street address
        status,
        date: displayDate,
        time: jobDate.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
        value: job.duration * 50 / 60, // Estimate value based on duration (€50/hour)
        progress: job.status === 'in_progress' ? 65 : undefined, // Mock progress for active jobs
      };
    });
  }, [scheduledJobs]);

  const filterJobs = (filter: TabFilter): JobDisplay[] => {
    switch (filter) {
      case 'active':
        return displayJobs.filter(j => j.status === 'in-progress');
      case 'upcoming':
        return displayJobs.filter(j => j.status === 'scheduled');
      case 'completed':
        return displayJobs.filter(j => j.status === 'completed');
    }
  };

  const filteredJobs = filterJobs(activeTab);
  const activeJobsCount = displayJobs.filter(j => j.status === 'in-progress').length;
  const upcomingJobsCount = displayJobs.filter(j => j.status === 'scheduled').length;
  const completedJobsCount = displayJobs.filter(j => j.status === 'completed').length;

  const tabs: { id: TabFilter; label: string; count: number }[] = [
    { id: 'active', label: 'Actief', count: activeJobsCount },
    { id: 'upcoming', label: 'Gepland', count: upcomingJobsCount },
    { id: 'completed', label: 'Geschiedenis', count: completedJobsCount },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Klussen</Text>
        <Pressable
          style={styles.addButton}
          onPress={() => router.push('/contractor/tiered-quote' as any)}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </Pressable>
      </View>

      {/* Time Tracker Widget */}
      <View style={styles.timeTrackerSection}>
        <TimeTrackerWidget
          activeEntry={undefined}
          onPress={() => setShowTimeTracker(true)}
        />
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {tabs.map(tab => (
          <Pressable
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
            {tab.count > 0 && (
              <View style={[styles.tabBadge, activeTab === tab.id && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === tab.id && styles.tabBadgeTextActive]}>
                  {tab.count}
                </Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {/* Job List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredJobs.length > 0 ? (
          filteredJobs.map(job => (
            <JobCard
              key={job.id}
              job={job}
              onPress={() => router.push(`/contractor/job/${job.id}` as any)}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="briefcase-outline" size={48} color={SemanticColors.textTertiary} />
            <Text style={styles.emptyStateTitle}>
              {activeTab === 'active' ? 'Geen actieve klussen' : activeTab === 'upcoming' ? 'Geen geplande klussen' : 'Geen geschiedenis'}
            </Text>
            <Text style={styles.emptyStateText}>
              {activeTab === 'active' ? 'Start met een geplande klus' : 'Klussen verschijnen hier'}
            </Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Time Tracker Modal */}
      <Modal
        visible={showTimeTracker}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <TimeTracker
          onClockIn={(jobId, notes) => {
            console.log('Clock in:', jobId, notes);
            setShowTimeTracker(false);
          }}
          onClockOut={(entryId, breakMins) => {
            console.log('Clock out:', entryId, breakMins);
            setShowTimeTracker(false);
          }}
          onClose={() => setShowTimeTracker(false)}
        />
      </Modal>
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
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.md,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Palette.hermesOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeTrackerSection: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    gap: Spacing.sm,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 10,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  tabActive: {
    backgroundColor: Palette.hermesOrange,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  tabTextActive: {
    color: '#fff',
  },
  tabBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: SemanticColors.surfacePrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: SemanticColors.textSecondary,
  },
  tabBadgeTextActive: {
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  jobCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  jobHeader: {
    gap: 4,
  },
  jobTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  jobCustomer: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  jobDetails: {
    gap: 4,
  },
  jobDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  jobDetailText: {
    fontSize: 13,
    color: SemanticColors.textTertiary,
  },
  progressSection: {
    gap: 4,
  },
  progressBar: {
    height: 4,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: SemanticColors.feedbackSuccess,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    color: SemanticColors.feedbackSuccess,
    fontWeight: '500',
  },
  jobFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  jobValue: {
    fontSize: 16,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.sm,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  emptyStateText: {
    fontSize: 14,
    color: SemanticColors.textTertiary,
    textAlign: 'center',
  },
});

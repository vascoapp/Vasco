// Jobs List - Filterable list of all jobs
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { Spacing } from '../../theme/spacing';
import { formatCurrency } from '../../i18n/formatting';
import { useTranslation } from 'react-i18next';
import type { Job, JobStatus } from '../../domain/jobs';
import { JOB_STATUS_CONFIG } from '../../data/mockContractor';
import { useAppState } from '../../state/AppState';
import { InlineInsight, VascoInsightCard } from '../shared/VascoInsightCard';
import { useInlineInsight, useVascoGuidance } from '../../services/vascoGuidanceService';

type IconName = keyof typeof Ionicons.glyphMap;

type FilterStatus = 'all' | 'active' | 'completed' | 'quoted';

interface JobsListProps {
  onSelectJob: (job: Job) => void;
  onNewJob: () => void;
  onNewQuote: () => void;
}

export function JobsList({ onSelectJob, onNewJob, onNewQuote }: JobsListProps) {
  const { jobs: allJobs, customers } = useAppState();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  // AI guidance — context key changes based on filter state
  const contextKey = filterStatus === 'quoted' ? 'pipeline' : 'active';
  const inlineInsight = useInlineInsight('contractor', 'jobs-list', contextKey);
  const insights = useVascoGuidance('contractor', 'jobs-list');
  const topInsight = insights.length > 0 ? insights[0] : null;

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
    });

  // Filter jobs
  const filteredJobs = allJobs.filter((job) => {
    // Search filter
    const customer = customers.find((c) => c.id === job.customerId);
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      job.title.toLowerCase().includes(searchLower) ||
      customer?.name.toLowerCase().includes(searchLower) ||
      (job.description ?? '').toLowerCase().includes(searchLower);

    // Status filter
    let matchesStatus = true;
    if (filterStatus === 'active') {
      matchesStatus = ['scheduled', 'in-progress'].includes(job.status);
    } else if (filterStatus === 'completed') {
      matchesStatus = ['completed', 'invoiced', 'paid'].includes(job.status);
    } else if (filterStatus === 'quoted') {
      matchesStatus = ['lead', 'quoted', 'accepted'].includes(job.status);
    }

    return matchesSearch && matchesStatus;
  });

  // Group by status for better organization
  const groupedJobs = filteredJobs.reduce((acc, job) => {
    const group = getStatusGroup(job.status);
    if (!acc[group]) acc[group] = [];
    acc[group].push(job);
    return acc;
  }, {} as Record<string, Job[]>);

  function getStatusGroup(status: JobStatus): string {
    if (['in-progress'].includes(status)) return 'In Progress';
    if (['scheduled'].includes(status)) return 'Scheduled';
    if (['lead', 'quoted', 'accepted'].includes(status)) return 'Pipeline';
    if (['completed', 'invoiced', 'paid'].includes(status)) return 'Completed';
    return 'Other';
  }

  const groupOrder = ['In Progress', 'Scheduled', 'Pipeline', 'Completed', 'Other'];

  const filters: { id: FilterStatus; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: allJobs.length },
    {
      id: 'active',
      label: 'Active',
      count: allJobs.filter((j) => ['scheduled', 'in-progress'].includes(j.status)).length,
    },
    {
      id: 'quoted',
      label: 'Pipeline',
      count: allJobs.filter((j) => ['lead', 'quoted', 'accepted'].includes(j.status)).length,
    },
    {
      id: 'completed',
      label: 'Done',
      count: allJobs.filter((j) => ['completed', 'invoiced', 'paid'].includes(j.status)).length,
    },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Jobs</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.headerButton} onPress={onNewQuote}>
            <Ionicons name="document-text" size={20} color={SemanticColors.textPrimary} />
          </Pressable>
          <Pressable style={styles.addButton} onPress={onNewJob}>
            <Ionicons name="add" size={22} color={Palette.white} />
          </Pressable>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={SemanticColors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search jobs, customers..."
          placeholderTextColor={SemanticColors.textTertiary}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={SemanticColors.textTertiary} />
          </Pressable>
        )}
      </View>

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersContainer}
      >
        {filters.map((filter) => (
          <Pressable
            key={filter.id}
            style={[styles.filterPill, filterStatus === filter.id && styles.filterPillActive]}
            onPress={() => setFilterStatus(filter.id)}
          >
            <Text
              style={[
                styles.filterPillText,
                filterStatus === filter.id && styles.filterPillTextActive,
              ]}
            >
              {filter.label}
            </Text>
            <View
              style={[
                styles.filterBadge,
                filterStatus === filter.id && styles.filterBadgeActive,
              ]}
            >
              <Text
                style={[
                  styles.filterBadgeText,
                  filterStatus === filter.id && styles.filterBadgeTextActive,
                ]}
              >
                {filter.count}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {/* Jobs List */}
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {inlineInsight && (
          <InlineInsight
            icon={inlineInsight.icon as any}
            message={inlineInsight.message}
            actionLabel={inlineInsight.actionLabel}
            actionRoute={inlineInsight.actionRoute}
          />
        )}
        {topInsight && (
          <VascoInsightCard insight={topInsight} compact showSource />
        )}
        {groupOrder.map((group) => {
          const jobs = groupedJobs[group];
          if (!jobs || jobs.length === 0) return null;

          return (
            <View key={group} style={styles.group}>
              <Text style={styles.groupTitle}>{group}</Text>
              {jobs.map((job) => {
                const customer = customers.find((c) => c.id === job.customerId);
                const statusConfig = JOB_STATUS_CONFIG[job.status];

                return (
                  <Pressable
                    key={job.id}
                    style={styles.jobCard}
                    onPress={() => onSelectJob(job)}
                  >
                    <View style={styles.jobCardHeader}>
                      <View style={styles.jobCardInfo}>
                        <Text style={styles.jobCardTitle} numberOfLines={1}>
                          {job.title}
                        </Text>
                        <Text style={styles.jobCardCustomer}>{customer?.name}</Text>
                      </View>
                      <View
                        style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}
                      >
                        <Ionicons
                          name={statusConfig.icon as IconName}
                          size={12}
                          color={statusConfig.color}
                        />
                        <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>
                          {statusConfig.label}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.jobCardDetails}>
                      {job.address ? (
                        <View style={styles.jobCardDetail}>
                          <Ionicons
                            name="location-outline"
                            size={14}
                            color={SemanticColors.textTertiary}
                          />
                          <Text style={styles.jobCardDetailText} numberOfLines={1}>
                            {job.address.street}{job.address.city ? `, ${job.address.city}` : ''}
                          </Text>
                        </View>
                      ) : customer?.address ? (
                        <View style={styles.jobCardDetail}>
                          <Ionicons
                            name="location-outline"
                            size={14}
                            color={SemanticColors.textTertiary}
                          />
                          <Text style={styles.jobCardDetailText} numberOfLines={1}>
                            {customer.address}
                          </Text>
                        </View>
                      ) : null}
                      <View style={styles.jobCardDetail}>
                        <Ionicons
                          name="calendar-outline"
                          size={14}
                          color={SemanticColors.textTertiary}
                        />
                        <Text style={styles.jobCardDetailText}>
                          {job.scheduledDate
                            ? formatDate(job.scheduledDate)
                            : formatDate(job.updatedAt)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.jobCardFooter}>
                      {(job.agreedAmount ?? job.quotedAmount) ? (
                        <Text style={styles.jobCardAmount}>
                          {formatCurrency(job.agreedAmount ?? job.quotedAmount!)}
                        </Text>
                      ) : (
                        <Text style={styles.jobCardNoAmount}>
                          {job.description ? job.description.substring(0, 40) + (job.description.length > 40 ? '...' : '') : 'No description'}
                        </Text>
                      )}
                      <View style={styles.jobCardMeta}>
                        {job.photos.length > 0 && (
                          <View style={styles.metaIcon}>
                            <Ionicons name="camera-outline" size={12} color={SemanticColors.textTertiary} />
                            <Text style={styles.metaText}>{job.photos.length}</Text>
                          </View>
                        )}
                        {job.timeEntries.length > 0 && (
                          <View style={styles.metaIcon}>
                            <Ionicons name="time-outline" size={12} color={SemanticColors.textTertiary} />
                            <Text style={styles.metaText}>{job.timeEntries.length}</Text>
                          </View>
                        )}
                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color={SemanticColors.textTertiary}
                        />
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          );
        })}

        {filteredJobs.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="briefcase-outline" size={48} color={SemanticColors.textTertiary} />
            <Text style={styles.emptyStateTitle}>No jobs found</Text>
            <Text style={styles.emptyStateText}>
              {searchQuery ? 'Try a different search term' : 'Create your first job to get started'}
            </Text>
            {!searchQuery && (
              <Pressable style={styles.emptyStateButton} onPress={onNewJob}>
                <Ionicons name="add" size={20} color={Palette.white} />
                <Text style={styles.emptyStateButtonText}>New Job</Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <Pressable style={styles.fab} onPress={onNewJob}>
        <Ionicons name="add" size={28} color={Palette.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    paddingTop: Spacing.xl,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  headerTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.displaySize,
    fontFamily: TYPE.sectionFamily,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.xl,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.xl,
    backgroundColor: SemanticColors.actionPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize,
  },
  filtersContainer: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  filterPillActive: {
    backgroundColor: SemanticColors.actionPrimary + '15',
    borderColor: SemanticColors.actionPrimary + '40',
  },
  filterPillText: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.labelFamily,
  },
  filterPillTextActive: {
    color: SemanticColors.actionPrimary,
  },
  filterBadge: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  filterBadgeActive: {
    backgroundColor: SemanticColors.actionPrimary,
  },
  filterBadgeText: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
  },
  filterBadgeTextActive: {
    color: Palette.white,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: 100,
    gap: Spacing.lg,
  },
  group: {
    gap: Spacing.sm,
  },
  groupTitle: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  jobCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  jobCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  jobCardInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  jobCardTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
  },
  jobCardCustomer: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.captionSize,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
  },
  jobCardDetails: {
    gap: 4,
  },
  jobCardDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  jobCardDetailText: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.labelSize,
    flex: 1,
  },
  jobCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderMuted,
  },
  jobCardAmount: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.sectionFamily,
  },
  jobCardQuoted: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.captionSize,
  },
  jobCardNoAmount: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.captionSize,
    fontStyle: 'italic',
  },
  jobCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  metaIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  metaText: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.tinySize,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyStateTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.titleFamily,
  },
  emptyStateText: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.bodySize - 1,
    textAlign: 'center',
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: SemanticColors.actionPrimary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    marginTop: Spacing.md,
  },
  emptyStateButtonText: {
    color: Palette.white,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
  },
  fab: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: 100,
    width: 56,
    height: 56,
    borderRadius: RADIUS.full,
    backgroundColor: SemanticColors.actionPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

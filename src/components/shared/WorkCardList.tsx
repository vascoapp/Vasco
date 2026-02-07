// =============================================================================
// WORK CARD LIST - Fabrico-style compact work order cards
// =============================================================================

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';

export interface WorkCard {
  id: string;
  time: string;
  title: string;
  assignedTo?: string;
  status: 'unassigned' | 'scheduled' | 'traveling' | 'in-progress' | 'completed';
  priority: 'urgent' | 'high' | 'normal' | 'low';
  jobType?: string;
}

interface WorkCardListProps {
  jobs: WorkCard[];
  maxVisible?: number;
  onJobPress?: (job: WorkCard) => void;
  onQuickAssign?: (job: WorkCard) => void;
  accentColor?: string;
}

const STATUS_CONFIG: Record<WorkCard['status'], { label: string; color: string; icon: string }> = {
  'unassigned': { label: 'Niet toegewezen', color: SemanticColors.feedbackWarning, icon: 'alert-circle' },
  'scheduled': { label: 'Gepland', color: SemanticColors.feedbackInfo, icon: 'time' },
  'traveling': { label: 'Onderweg', color: '#2563EB', icon: 'car' },
  'in-progress': { label: 'Bezig', color: Palette.hermesOrange, icon: 'construct' },
  'completed': { label: 'Afgerond', color: SemanticColors.feedbackSuccess, icon: 'checkmark-circle' },
};

const PRIORITY_CONFIG: Record<WorkCard['priority'], { color: string }> = {
  'urgent': { color: SemanticColors.feedbackError },
  'high': { color: Palette.hermesOrange },
  'normal': { color: SemanticColors.feedbackInfo },
  'low': { color: SemanticColors.textTertiary },
};

export function WorkCardList({ jobs, maxVisible = 5, onJobPress, onQuickAssign, accentColor = Palette.hermesOrange }: WorkCardListProps) {
  const visible = jobs.slice(0, maxVisible);

  return (
    <View style={styles.list}>
      {visible.map(job => {
        const statusCfg = STATUS_CONFIG[job.status];
        const priorityCfg = PRIORITY_CONFIG[job.priority];

        return (
          <Pressable
            key={job.id}
            style={[
              styles.card,
              job.priority === 'urgent' && { borderLeftColor: SemanticColors.feedbackError, borderLeftWidth: 3 },
              job.priority === 'high' && { borderLeftColor: Palette.hermesOrange, borderLeftWidth: 3 },
            ]}
            onPress={() => {
              if (job.status === 'unassigned' && onQuickAssign) {
                onQuickAssign(job);
              } else if (onJobPress) {
                onJobPress(job);
              }
            }}
          >
            {/* Time badge */}
            <View style={styles.timeBadge}>
              <Text style={styles.timeText}>{job.time}</Text>
            </View>

            {/* Title + type */}
            <View style={styles.titleCol}>
              <Text style={styles.title} numberOfLines={1}>{job.title}</Text>
              {job.jobType && (
                <Text style={[styles.jobType, { color: accentColor }]}>{job.jobType}</Text>
              )}
            </View>

            {/* Worker chip or unassigned warning */}
            <View style={styles.rightCol}>
              {job.assignedTo ? (
                <View style={styles.workerChip}>
                  <Ionicons name="person" size={10} color={accentColor} />
                  <Text style={[styles.workerChipText, { color: accentColor }]} numberOfLines={1}>
                    {job.assignedTo}
                  </Text>
                </View>
              ) : (
                <Pressable
                  style={styles.unassignedChip}
                  onPress={() => onQuickAssign?.(job)}
                >
                  <Ionicons name="alert-circle" size={10} color={SemanticColors.feedbackWarning} />
                  <Text style={styles.unassignedChipText}>Toewijzen</Text>
                </Pressable>
              )}

              {/* Status dot */}
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: statusCfg.color }]} />
                <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderMuted,
    gap: 10,
    minHeight: 56,
  },
  timeBadge: {
    backgroundColor: SemanticColors.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 48,
    alignItems: 'center',
  },
  timeText: {
    fontSize: 12,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  titleCol: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  jobType: {
    fontSize: 10,
    fontWeight: '500',
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  workerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Palette.hermesOrange + '12',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  workerChipText: {
    fontSize: 11,
    fontWeight: '600',
    maxWidth: 80,
  },
  unassignedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SemanticColors.feedbackWarningBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  unassignedChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: SemanticColors.feedbackWarning,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
});

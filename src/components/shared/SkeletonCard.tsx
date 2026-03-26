// =============================================================================
// SKELETON CARD — Card-shaped loading placeholder
// =============================================================================
// Matches the app's card style: white bg, RADIUS.lg, GRID.md padding.
// Shows a title line, 2-3 body lines, optional action area.
// =============================================================================

import { View, StyleSheet } from 'react-native';
import { SemanticColors } from '../../theme/colors';
import { RADIUS, GRID } from '../../theme/tabStyles';
import { Skeleton } from './Skeleton';

interface SkeletonCardProps {
  /** Number of body text lines (default 2) */
  lines?: number;
  /** Show an avatar circle on the left (default false) */
  showAvatar?: boolean;
  /** Show an action button area at the bottom (default false) */
  showAction?: boolean;
}

export function SkeletonCard({
  lines = 2,
  showAvatar = false,
  showAction = false,
}: SkeletonCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        {showAvatar && (
          <Skeleton width={40} height={40} borderRadius={20} />
        )}
        <View style={styles.headerText}>
          <Skeleton width="65%" height={16} borderRadius={RADIUS.sm} />
          <Skeleton width="40%" height={12} borderRadius={RADIUS.sm} />
        </View>
      </View>

      <View style={styles.body}>
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            width={i === lines - 1 ? '55%' : '90%'}
            height={12}
            borderRadius={RADIUS.sm}
          />
        ))}
      </View>

      {showAction && (
        <View style={styles.actionRow}>
          <Skeleton width={100} height={36} borderRadius={RADIUS.md} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    gap: GRID.sm + 4, // 12px
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm + 4,
  },
  headerText: {
    flex: 1,
    gap: GRID.sm - 2, // 6px
  },
  body: {
    gap: GRID.sm, // 8px
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: GRID.xs,
  },
});

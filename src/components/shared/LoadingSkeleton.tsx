// =============================================================================
// LOADING SKELETON — Composite skeleton variants for loading states
// =============================================================================
// Rebuilt on top of the Skeleton/SkeletonCard primitives.
// Uses theme tokens throughout: RADIUS, GRID, SemanticColors.
// Backward-compatible API: variant + count.
// =============================================================================

import { View, StyleSheet } from 'react-native';
import { SemanticColors } from '../../theme/colors';
import { RADIUS, GRID } from '../../theme/tabStyles';
import { SafeArea } from '../../theme/spacing';
import { Skeleton } from './Skeleton';

type SkeletonVariant = 'card' | 'list-item' | 'metric' | 'full-screen';

interface LoadingSkeletonProps {
  variant?: SkeletonVariant;
  count?: number;
}

function MetricSkeleton() {
  return (
    <View style={styles.metricContainer}>
      <Skeleton width={60} height={14} />
      <Skeleton width={80} height={28} borderRadius={RADIUS.sm} />
      <Skeleton width={50} height={12} />
    </View>
  );
}

function CardSkeleton() {
  return (
    <View style={styles.cardContainer}>
      <View style={styles.cardRow}>
        <Skeleton width={40} height={40} borderRadius={20} />
        <View style={styles.cardContent}>
          <Skeleton width="70%" height={16} />
          <Skeleton width="45%" height={12} />
        </View>
      </View>
      <Skeleton width="100%" height={12} />
    </View>
  );
}

function ListItemSkeleton() {
  return (
    <View style={styles.listItem}>
      <Skeleton width={36} height={36} borderRadius={18} />
      <View style={styles.listContent}>
        <Skeleton width="60%" height={14} />
        <Skeleton width="40%" height={12} />
      </View>
      <Skeleton width={60} height={14} />
    </View>
  );
}

export function LoadingSkeleton({ variant = 'card', count = 3 }: LoadingSkeletonProps) {
  if (variant === 'full-screen') {
    return (
      <View style={styles.fullScreen}>
        <View style={styles.metricsRow}>
          <MetricSkeleton />
          <MetricSkeleton />
          <MetricSkeleton />
        </View>
        {Array.from({ length: 3 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </View>
    );
  }

  if (variant === 'metric') {
    return (
      <View style={styles.metricsRow}>
        {Array.from({ length: count }).map((_, i) => (
          <MetricSkeleton key={i} />
        ))}
      </View>
    );
  }

  const Component = variant === 'list-item' ? ListItemSkeleton : CardSkeleton;

  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <Component key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    padding: SafeArea.side,
    gap: GRID.sm + 4,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: GRID.sm,
  },
  metricContainer: {
    flex: 1,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: GRID.md - 2,
    gap: GRID.sm,
  },
  cardContainer: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    gap: GRID.sm + 4,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm + 4,
  },
  cardContent: {
    flex: 1,
    gap: GRID.sm - 2,
  },
  list: {
    gap: GRID.sm,
    padding: SafeArea.side,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: GRID.sm + 4,
    gap: GRID.sm + 4,
  },
  listContent: {
    flex: 1,
    gap: GRID.xs,
  },
});

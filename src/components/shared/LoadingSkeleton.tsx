import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { SemanticColors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';

type SkeletonVariant = 'card' | 'list-item' | 'metric' | 'full-screen';

interface LoadingSkeletonProps {
  variant?: SkeletonVariant;
  count?: number;
}

function ShimmerBlock({ width, height, borderRadius = 8 }: { width: number | string; height: number; borderRadius?: number }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <Animated.View
      style={{
        width: width as any,
        height,
        borderRadius,
        backgroundColor: SemanticColors.borderMuted,
        opacity,
      }}
    />
  );
}

function MetricSkeleton() {
  return (
    <View style={styles.metricContainer}>
      <ShimmerBlock width={60} height={14} />
      <ShimmerBlock width={80} height={28} borderRadius={6} />
      <ShimmerBlock width={50} height={12} />
    </View>
  );
}

function CardSkeleton() {
  return (
    <View style={styles.cardContainer}>
      <View style={styles.cardRow}>
        <ShimmerBlock width={40} height={40} borderRadius={20} />
        <View style={styles.cardContent}>
          <ShimmerBlock width="70%" height={16} />
          <ShimmerBlock width="45%" height={12} />
        </View>
      </View>
      <ShimmerBlock width="100%" height={12} />
    </View>
  );
}

function ListItemSkeleton() {
  return (
    <View style={styles.listItem}>
      <ShimmerBlock width={36} height={36} borderRadius={18} />
      <View style={styles.listContent}>
        <ShimmerBlock width="60%" height={14} />
        <ShimmerBlock width="40%" height={12} />
      </View>
      <ShimmerBlock width={60} height={14} />
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
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  metricContainer: {
    flex: 1,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  cardContainer: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.sm,
    gap: 12,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardContent: {
    flex: 1,
    gap: 6,
  },
  list: {
    gap: Spacing.xs,
    padding: Spacing.sm,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 10,
    padding: 12,
    gap: 12,
  },
  listContent: {
    flex: 1,
    gap: 4,
  },
});

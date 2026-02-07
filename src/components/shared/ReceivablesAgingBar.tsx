// =============================================================================
// RECEIVABLES AGING BAR - Horizontal stacked bar for aging buckets
// =============================================================================

import { View, Text, StyleSheet } from 'react-native';
import { SemanticColors } from '../../theme/colors';

export interface AgingBucket {
  label: string;
  amount: number;
  color: string;
}

interface ReceivablesAgingBarProps {
  buckets: AgingBucket[];
  currency?: string;
}

function fmtAmount(value: number, currency: string): string {
  const symbol = currency === 'GBP' ? '\u00A3' : currency === 'EUR' ? '\u20AC' : '$';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${symbol}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${symbol}${(abs / 1_000).toFixed(0)}K`;
  return `${symbol}${value.toFixed(0)}`;
}

export function ReceivablesAgingBar({ buckets, currency = 'GBP' }: ReceivablesAgingBarProps) {
  const total = buckets.reduce((sum, b) => sum + b.amount, 0);
  if (total === 0) return null;

  return (
    <View style={styles.container}>
      {/* Stacked bar */}
      <View style={styles.barTrack}>
        {buckets.map((bucket, idx) => {
          const widthPct = (bucket.amount / total) * 100;
          if (widthPct < 1) return null;
          return (
            <View
              key={idx}
              style={[
                styles.segment,
                {
                  width: `${widthPct}%`,
                  backgroundColor: bucket.color,
                },
                idx === 0 && { borderTopLeftRadius: 6, borderBottomLeftRadius: 6 },
                idx === buckets.length - 1 && { borderTopRightRadius: 6, borderBottomRightRadius: 6 },
              ]}
            />
          );
        })}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {buckets.map((bucket, idx) => (
          <View key={idx} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: bucket.color }]} />
            <Text style={styles.legendLabel}>{bucket.label}</Text>
            <Text style={styles.legendAmount}>{fmtAmount(bucket.amount, currency)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  barTrack: {
    flexDirection: 'row',
    height: 14,
    borderRadius: 6,
    overflow: 'hidden',
  },
  segment: {
    height: '100%',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
  },
  legendAmount: {
    fontSize: 11,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
});

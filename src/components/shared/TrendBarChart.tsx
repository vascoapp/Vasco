// =============================================================================
// TREND BAR CHART - Monthly vertical bar chart (pure React Native)
// =============================================================================

import { View, Text, StyleSheet } from 'react-native';
import { SemanticColors } from '../../theme/colors';
import { TYPE } from '../../theme/tabStyles';

export interface BarDataPoint {
  label: string;
  value: number;
}

interface TrendBarChartProps {
  data: BarDataPoint[];
  positiveColor?: string;
  negativeColor?: string;
  showValues?: boolean;
  height?: number;
  currency?: string;
}

function fmtShort(value: number, currency: string): string {
  const symbol = currency === 'GBP' ? '\u00A3' : currency === 'EUR' ? '\u20AC' : '$';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${value < 0 ? '-' : ''}${symbol}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${value < 0 ? '-' : ''}${symbol}${(abs / 1_000).toFixed(0)}K`;
  return `${symbol}${value.toFixed(0)}`;
}

export function TrendBarChart({
  data,
  positiveColor = '#2563EB',
  negativeColor,
  showValues = true,
  height = 120,
  currency = 'GBP',
}: TrendBarChartProps) {
  const hasNegative = data.some(d => d.value < 0);
  const maxVal = Math.max(...data.map(d => Math.abs(d.value)), 1);
  const negColor = negativeColor || SemanticColors.feedbackError;

  if (hasNegative) {
    // Diverging chart: bars go up (positive) and down (negative) from center
    const maxPos = Math.max(...data.map(d => Math.max(d.value, 0)), 1);
    const maxNeg = Math.max(...data.map(d => Math.abs(Math.min(d.value, 0))), 1);
    const totalRange = maxPos + maxNeg;
    const halfHeight = height / 2;

    return (
      <View style={styles.container}>
        <View style={[styles.chartArea, { height }]}>
          {/* Zero line */}
          <View style={[styles.zeroLine, { top: (maxPos / totalRange) * height }]} />
          {data.map((d, idx) => {
            const isNeg = d.value < 0;
            const barH = (Math.abs(d.value) / totalRange) * height;
            const topOffset = isNeg
              ? (maxPos / totalRange) * height
              : (maxPos / totalRange) * height - barH;
            return (
              <View key={idx} style={styles.barColumn}>
                {showValues && (
                  <Text style={[styles.barValue, { position: 'absolute', top: topOffset - 16 }]}>
                    {fmtShort(d.value, currency)}
                  </Text>
                )}
                <View
                  style={[
                    styles.bar,
                    {
                      height: barH,
                      top: topOffset,
                      backgroundColor: isNeg ? negColor : positiveColor,
                      position: 'absolute',
                      left: 4,
                      right: 4,
                      borderRadius: 4,
                    },
                  ]}
                />
              </View>
            );
          })}
        </View>
        <View style={styles.labelRow}>
          {data.map((d, idx) => (
            <Text key={idx} style={styles.barLabel}>{d.label}</Text>
          ))}
        </View>
      </View>
    );
  }

  // Standard positive-only chart
  return (
    <View style={styles.container}>
      <View style={[styles.chartArea, { height }]}>
        {data.map((d, idx) => {
          const barH = (d.value / maxVal) * height;
          return (
            <View key={idx} style={styles.barColumn}>
              <View style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
                {showValues && (
                  <Text style={styles.barValue}>{fmtShort(d.value, currency)}</Text>
                )}
                <View
                  style={[
                    styles.bar,
                    {
                      height: barH,
                      backgroundColor: positiveColor,
                      alignSelf: 'stretch',
                      marginHorizontal: 4,
                      borderRadius: 4,
                    },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
      <View style={styles.labelRow}>
        {data.map((d, idx) => (
          <Text key={idx} style={styles.barLabel}>{d.label}</Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  chartArea: {
    flexDirection: 'row',
    position: 'relative',
  },
  barColumn: {
    flex: 1,
    position: 'relative',
  },
  bar: {},
  barValue: {
    fontSize: 9,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textTertiary,
    textAlign: 'center',
    marginBottom: 2,
    fontVariant: ['tabular-nums'],
  },
  labelRow: {
    flexDirection: 'row',
  },
  barLabel: {
    flex: 1,
    fontSize: 10,
    color: SemanticColors.textTertiary,
    textAlign: 'center',
  },
  zeroLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: SemanticColors.borderDefault,
  },
});

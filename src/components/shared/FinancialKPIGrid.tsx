// =============================================================================
// FINANCIAL KPI GRID - Fathom HQ-style scorecard tiles
// =============================================================================

import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
export interface KPITile {
  label: string;
  value: string;
  variance?: string;       // e.g. "+2.3%" or "-4.1%"
  varianceDirection?: 'up' | 'down';
  status?: 'green' | 'amber' | 'red';
  budgetLabel?: string;     // e.g. "Budget: £12.4M"
  heroBg?: boolean;         // Highlight tile with accent background
  onPress?: () => void;
}

interface FinancialKPIGridProps {
  tiles: KPITile[];
  accentColor?: string;
}

export function FinancialKPIGrid({ tiles, accentColor = '#2563EB' }: FinancialKPIGridProps) {
  return (
    <View style={styles.grid}>
      {tiles.map((tile, idx) => {
        const content = (
          <View
            style={[
              styles.tile,
              tile.heroBg && { backgroundColor: accentColor + '12', borderColor: accentColor + '30' },
            ]}
          >
            {/* Status dot */}
            {tile.status && (
              <View
                style={[
                  styles.statusDot,
                  tile.status === 'green' && { backgroundColor: SemanticColors.feedbackSuccess },
                  tile.status === 'amber' && { backgroundColor: SemanticColors.feedbackWarning },
                  tile.status === 'red' && { backgroundColor: SemanticColors.feedbackError },
                ]}
              />
            )}

            {/* Label */}
            <Text style={styles.label} numberOfLines={1}>{tile.label}</Text>

            {/* Value + variance row */}
            <View style={styles.valueRow}>
              <Text
                style={[styles.value, tile.heroBg && { color: accentColor }]}
                numberOfLines={1}
              >
                {tile.value}
              </Text>
              {tile.variance && (
                <View style={styles.varianceBadge}>
                  <Ionicons
                    name={tile.varianceDirection === 'down' ? 'caret-down' : 'caret-up'}
                    size={10}
                    color={tile.varianceDirection === 'down' ? SemanticColors.feedbackError : SemanticColors.feedbackSuccess}
                  />
                  <Text
                    style={[
                      styles.varianceText,
                      {
                        color: tile.varianceDirection === 'down'
                          ? SemanticColors.feedbackError
                          : SemanticColors.feedbackSuccess,
                      },
                    ]}
                  >
                    {tile.variance}
                  </Text>
                </View>
              )}
            </View>

            {/* Budget sub-line */}
            {tile.budgetLabel && (
              <Text style={styles.budget} numberOfLines={1}>{tile.budgetLabel}</Text>
            )}
          </View>
        );

        if (tile.onPress) {
          return (
            <Pressable key={idx} style={styles.tileWrapper} onPress={tile.onPress}>
              {content}
            </Pressable>
          );
        }
        return (
          <View key={idx} style={styles.tileWrapper}>
            {content}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tileWrapper: {
    width: '48.5%',
    flexGrow: 1,
  },
  tile: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderMuted,
    gap: 4,
    position: 'relative',
  },
  statusDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: TYPE.tinySize - 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  value: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  varianceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  varianceText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
    fontVariant: ['tabular-nums'],
  },
  budget: {
    fontSize: TYPE.tinySize - 1,
    color: SemanticColors.textTertiary,
    fontVariant: ['tabular-nums'],
  },
});

// =============================================================================
// UTILIZATION HEATMAP GRID - Productive-inspired worker capacity view
// =============================================================================

import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SemanticColors, Palette } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import type { WorkerHeatmapRow, HeatmapCell } from '../../services/resourceHeatmapService';

interface Props {
  rows: WorkerHeatmapRow[];
  hourLabels: string[];
  onCellPress?: (workerId: string, cell: HeatmapCell) => void;
}

const CELL_SIZE = 32;
const NAME_WIDTH = 60;

function getCellColor(utilization: number, status: HeatmapCell['status']): string {
  if (status === 'break') return SemanticColors.surfaceSecondary;
  if (status === 'overtime') return '#DC2626';
  if (utilization === 0) return SemanticColors.surfaceTertiary;
  if (utilization < 30) return 'rgba(227, 82, 5, 0.15)';
  if (utilization < 50) return 'rgba(227, 82, 5, 0.3)';
  if (utilization < 70) return 'rgba(227, 82, 5, 0.5)';
  if (utilization < 85) return 'rgba(227, 82, 5, 0.7)';
  if (utilization < 95) return Palette.hermesOrange;
  return '#DC2626';
}

function getCellTextColor(utilization: number): string {
  if (utilization >= 70) return Palette.white;
  return SemanticColors.textSecondary;
}

function UtilizationCell({ cell, workerId, onPress }: {
  cell: HeatmapCell;
  workerId: string;
  onPress?: (workerId: string, cell: HeatmapCell) => void;
}) {
  const handlePress = useCallback(() => {
    onPress?.(workerId, cell);
  }, [workerId, cell, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      style={[styles.cell, { backgroundColor: getCellColor(cell.utilization, cell.status) }]}
    >
      {cell.utilization > 0 && (
        <Text style={[styles.cellText, { color: getCellTextColor(cell.utilization) }]}>
          {cell.utilization}
        </Text>
      )}
      {cell.status === 'break' && (
        <Text style={styles.breakText}>☕</Text>
      )}
    </Pressable>
  );
}

export function UtilizationHeatmapGrid({ rows, hourLabels, onCellPress }: Props) {
  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* Hour headers */}
          <View style={styles.headerRow}>
            <View style={styles.nameCell} />
            {hourLabels.map(label => (
              <View key={label} style={styles.headerCell}>
                <Text style={styles.headerText}>{label.slice(0, 5)}</Text>
              </View>
            ))}
            <View style={styles.avgCell}>
              <Text style={styles.headerText}>Gem.</Text>
            </View>
          </View>

          {/* Worker rows */}
          {rows.map(row => (
            <View key={row.workerId} style={styles.row}>
              <View style={styles.nameCell}>
                <View style={styles.initialsCircle}>
                  <Text style={styles.initialsText}>{row.initials}</Text>
                </View>
              </View>
              {row.cells.map(cell => (
                <UtilizationCell
                  key={`${row.workerId}-${cell.hour}`}
                  cell={cell}
                  workerId={row.workerId}
                  onPress={onCellPress}
                />
              ))}
              <View style={[styles.avgCell, { backgroundColor: getCellColor(row.avgUtilization, 'active') }]}>
                <Text style={[styles.avgText, { color: getCellTextColor(row.avgUtilization) }]}>
                  {row.avgUtilization}%
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendLabel}>Bezetting:</Text>
        {[
          { label: 'Leeg', color: SemanticColors.surfaceTertiary },
          { label: 'Laag', color: 'rgba(227, 82, 5, 0.3)' },
          { label: 'Normaal', color: 'rgba(227, 82, 5, 0.5)' },
          { label: 'Hoog', color: Palette.hermesOrange },
          { label: 'Overbelast', color: '#DC2626' },
        ].map(item => (
          <View key={item.label} style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: item.color }]} />
            <Text style={styles.legendText}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderMuted,
  },
  headerRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  headerCell: {
    width: CELL_SIZE,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 1,
  },
  headerText: {
    fontSize: 9,
    color: SemanticColors.textTertiary,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  nameCell: {
    width: NAME_WIDTH,
    height: CELL_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 4,
  },
  initialsCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Palette.hermesOrange,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    fontSize: 10,
    fontWeight: '700',
    color: Palette.white,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 1,
  },
  cellText: {
    fontSize: 9,
    fontWeight: '600',
  },
  breakText: {
    fontSize: 12,
  },
  avgCell: {
    width: 40,
    height: CELL_SIZE,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  avgText: {
    fontSize: 10,
    fontWeight: '700',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderMuted,
    flexWrap: 'wrap',
    gap: 8,
  },
  legendLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
    fontWeight: '600',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 9,
    color: SemanticColors.textTertiary,
  },
});

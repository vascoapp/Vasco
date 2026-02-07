// =============================================================================
// P&L STATEMENT VIEW - Tabular financial view (Fathom HQ style)
// =============================================================================

import { View, Text, StyleSheet } from 'react-native';
import { SemanticColors } from '../../theme/colors';

export interface PLRow {
  label: string;
  actual: number;
  budget: number;
  isSubtotal?: boolean;
  isTotal?: boolean;
}

interface PLStatementViewProps {
  rows: PLRow[];
  currency?: string;
  accentColor?: string;
}

function fmtAmount(value: number, currency: string): string {
  const symbol = currency === 'GBP' ? '\u00A3' : currency === 'EUR' ? '\u20AC' : '$';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${value < 0 ? '-' : ''}${symbol}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${value < 0 ? '-' : ''}${symbol}${(abs / 1_000).toFixed(0)}K`;
  return `${symbol}${value.toFixed(0)}`;
}

function variancePercent(actual: number, budget: number): string {
  if (budget === 0) return '-';
  const pct = ((actual - budget) / Math.abs(budget)) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

export function PLStatementView({ rows, currency = 'GBP', accentColor = '#2563EB' }: PLStatementViewProps) {
  return (
    <View style={styles.container}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, styles.labelCol]}>Categorie</Text>
        <Text style={[styles.headerCell, styles.numberCol]}>Werkelijk</Text>
        <Text style={[styles.headerCell, styles.numberCol]}>Budget</Text>
        <Text style={[styles.headerCell, styles.varCol]}>Var %</Text>
      </View>

      {rows.map((row, idx) => {
        const variance = variancePercent(row.actual, row.budget);
        const isPositiveVar = row.actual <= row.budget; // For costs, under budget is positive
        const isRevenueRow = row.label === 'Omzet (GDV)' || row.isSubtotal || row.isTotal;
        const isPositive = isRevenueRow ? row.actual >= row.budget : row.actual <= row.budget;

        return (
          <View
            key={idx}
            style={[
              styles.dataRow,
              row.isSubtotal && styles.subtotalRow,
              row.isTotal && [styles.totalRow, { backgroundColor: accentColor + '10' }],
            ]}
          >
            <Text
              style={[
                styles.dataCell,
                styles.labelCol,
                styles.labelText,
                (row.isSubtotal || row.isTotal) && styles.boldText,
              ]}
              numberOfLines={1}
            >
              {row.label}
            </Text>
            <Text
              style={[
                styles.dataCell,
                styles.numberCol,
                styles.numberText,
                (row.isSubtotal || row.isTotal) && styles.boldText,
              ]}
            >
              {fmtAmount(row.actual, currency)}
            </Text>
            <Text style={[styles.dataCell, styles.numberCol, styles.numberText, styles.budgetText]}>
              {fmtAmount(row.budget, currency)}
            </Text>
            <Text
              style={[
                styles.dataCell,
                styles.varCol,
                styles.varText,
                { color: isPositive ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError },
              ]}
            >
              {variance}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SemanticColors.borderMuted,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderMuted,
  },
  headerCell: {
    fontSize: 9,
    fontWeight: '700',
    color: SemanticColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  labelCol: {
    flex: 2,
  },
  numberCol: {
    flex: 1.2,
    textAlign: 'right',
  },
  varCol: {
    width: 52,
    textAlign: 'right',
  },
  dataRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SemanticColors.borderMuted,
    alignItems: 'center',
  },
  subtotalRow: {
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  totalRow: {
    borderTopWidth: 2,
    borderTopColor: SemanticColors.borderDefault,
  },
  dataCell: {
    fontSize: 12,
    color: SemanticColors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  labelText: {
    color: SemanticColors.textSecondary,
  },
  numberText: {
    textAlign: 'right',
  },
  budgetText: {
    color: SemanticColors.textTertiary,
  },
  varText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  boldText: {
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
});

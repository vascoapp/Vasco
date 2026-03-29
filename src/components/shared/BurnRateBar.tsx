// =============================================================================
// BURN RATE BAR - Zone-based budget burn tracking with color thresholds
// =============================================================================

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SemanticColors } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { Spacing } from '../../theme/spacing';
import { formatCurrency } from '../../i18n/formatting';
import { hapticWarning, hapticError } from '../../utils/haptics';
import type { ZoneBudget } from '../../services/resourceHeatmapService';

interface Props {
  zones: ZoneBudget[];
  totalBudget: number;
  totalSpent: number;
  overallPercent: number;
}

function getBarColor(percent: number): string {
  if (percent <= 70) return SemanticColors.feedbackSuccess;
  if (percent <= 85) return SemanticColors.feedbackWarning;
  return SemanticColors.feedbackError;
}

function getStatusLabel(status: ZoneBudget['status']): string {
  switch (status) {
    case 'on-track': return 'Op schema';
    case 'at-risk': return 'Risico';
    case 'critical': return 'Kritiek';
  }
}

function ZoneBurnBar({ zone }: { zone: ZoneBudget }) {
  const barColor = getBarColor(zone.budgetPercent);
  const fillWidth = Math.min(zone.budgetPercent, 120); // Cap visual at 120%

  useEffect(() => {
    if (zone.status === 'critical') {
      hapticError();
    } else if (zone.status === 'at-risk') {
      hapticWarning();
    }
  }, [zone.status]);

  return (
    <View style={styles.zoneRow}>
      <View style={styles.zoneHeader}>
        <Text style={styles.zoneName}>{zone.zoneName}</Text>
        <View style={styles.zoneStats}>
          <Text style={[styles.zonePercent, { color: barColor }]}>{zone.budgetPercent}%</Text>
          <Text style={styles.zoneBudget}>
            {formatCurrency(zone.budgetSpent)} / {formatCurrency(zone.budgetTotal)}
          </Text>
        </View>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.min(fillWidth, 100)}%`, backgroundColor: barColor }]} />
        {zone.budgetPercent > 100 && (
          <View style={[styles.barOverflow, { width: `${fillWidth - 100}%` }]} />
        )}
      </View>
      <View style={styles.zoneFooter}>
        <Text style={[styles.statusBadge, { color: barColor }]}>
          {getStatusLabel(zone.status)}
        </Text>
        <Text style={styles.hoursText}>
          {zone.hoursUsed}/{zone.hoursPlanned} uur
        </Text>
      </View>
    </View>
  );
}

export function BurnRateBar({ zones, totalBudget, totalSpent, overallPercent }: Props) {
  return (
    <View style={styles.container}>
      {/* Overall summary */}
      <View style={styles.summaryRow}>
        <View>
          <Text style={styles.summaryLabel}>Totaal verbruik</Text>
          <Text style={styles.summaryValue}>
            {formatCurrency(totalSpent)} / {formatCurrency(totalBudget)}
          </Text>
        </View>
        <View style={[styles.overallBadge, { backgroundColor: getBarColor(overallPercent) + '20' }]}>
          <Text style={[styles.overallText, { color: getBarColor(overallPercent) }]}>
            {overallPercent}%
          </Text>
        </View>
      </View>

      {/* Per-zone bars */}
      {zones.map(zone => (
        <ZoneBurnBar key={zone.zoneId} zone={zone} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderMuted,
    gap: Spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderMuted,
  },
  summaryLabel: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textTertiary,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  overallBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  overallText: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.displayFamily,
  },
  zoneRow: {
    gap: 4,
  },
  zoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  zoneName: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  zoneStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  zonePercent: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.sectionFamily,
  },
  zoneBudget: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textTertiary,
  },
  barTrack: {
    height: 8,
    backgroundColor: SemanticColors.surfaceTertiary,
    borderRadius: 4,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  barOverflow: {
    height: '100%',
    backgroundColor: SemanticColors.feedbackError,
    opacity: 0.5,
  },
  zoneFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    fontSize: TYPE.tinySize - 1,
    fontFamily: TYPE.titleFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hoursText: {
    fontSize: TYPE.tinySize - 1,
    color: SemanticColors.textTertiary,
  },
});

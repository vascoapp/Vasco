// =============================================================================
// CONTRACTOR DASHBOARD HEADER - Compact KPI strip for all contractor tabs
// =============================================================================

import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';

type IconName = keyof typeof Ionicons.glyphMap;

export interface KPIItem {
  icon: IconName;
  value: string;
  label: string;
  color?: string;
  onPress?: () => void;
}

interface ContractorDashboardHeaderProps {
  kpis: KPIItem[];
}

export function ContractorDashboardHeader({ kpis }: ContractorDashboardHeaderProps) {
  return (
    <View style={styles.container}>
      {kpis.map((kpi, index) => {
        const content = (
          <>
            <View style={styles.kpiTop}>
              <Ionicons
                name={kpi.icon}
                size={14}
                color={kpi.color || SemanticColors.textSecondary}
              />
              <Text style={[styles.kpiValue, kpi.color ? { color: kpi.color } : undefined]}>
                {kpi.value}
              </Text>
            </View>
            <Text style={styles.kpiLabel}>{kpi.label}</Text>
          </>
        );

        return (
          <View key={index} style={styles.kpiWrapper}>
            {index > 0 && <View style={styles.divider} />}
            {kpi.onPress ? (
              <Pressable style={styles.kpiCell} onPress={kpi.onPress}>
                {content}
              </Pressable>
            ) : (
              <View style={styles.kpiCell}>
                {content}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  kpiWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: SemanticColors.borderDefault,
  },
  kpiCell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  kpiTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  kpiLabel: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});

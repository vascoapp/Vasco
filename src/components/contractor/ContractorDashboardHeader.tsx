// =============================================================================
// CONTRACTOR DASHBOARD HEADER - Redesigned KPI strip with icon circles + tints
// =============================================================================

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { useTranslation } from 'react-i18next';type IconName = keyof typeof Ionicons.glyphMap;

export interface KPIItem {
  icon: IconName;
  value: string | React.ReactNode;
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
        const accent = kpi.color || Palette.hermesOrange;
        const content = (
          <View style={styles.kpiCell}>
            <View style={[styles.iconCircle, { backgroundColor: accent + '12' }]}>
              <Ionicons name={kpi.icon} size={18} color={accent} />
            </View>
            {typeof kpi.value === 'string' ? (
              <Text style={[styles.kpiValue, { color: accent }]} numberOfLines={1}>
                {kpi.value}
              </Text>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {kpi.value}
              </View>
            )}
            <Text style={styles.kpiLabel} numberOfLines={1}>{kpi.label}</Text>
          </View>
        );

        return kpi.onPress ? (
          <Pressable
            key={index}
            style={({ pressed }) => [styles.kpiWrapper, pressed && { opacity: 0.85 }]}
            onPress={kpi.onPress}
            accessibilityLabel={`${kpi.label}: ${typeof kpi.value === 'string' ? kpi.value : ''}`}
          >
            {content}
          </Pressable>
        ) : (
          <View key={index} style={styles.kpiWrapper}>
            {content}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiWrapper: {
    flex: 1,
  },
  kpiCell: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: {
    fontSize: TYPE.sectionSize,
    fontFamily: 'Archivo_900Black',
    fontVariant: ['tabular-nums'] as any,
  },
  kpiLabel: {
    fontSize: TYPE.tinySize - 1,
    fontFamily: 'Inter_600SemiBold',
    color: SemanticColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});

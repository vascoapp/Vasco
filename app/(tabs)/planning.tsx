/**
 * Planning Screen (stub — CapacityPlanning removed in contractor declutter)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SemanticColors } from '../../src/theme/colors';
import { SafeArea } from '../../src/theme/spacing';

export default function PlanningScreen() {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('tabs.planning.title', 'Planning')}</Text>
      <Text style={styles.subtitle}>{t('tabs.planning.comingSoon', 'Coming soon')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: SafeArea.top,
  },
  title: { fontSize: 20, fontFamily: 'Manrope_700Bold', color: SemanticColors.textPrimary },
  subtitle: { fontSize: 14, color: SemanticColors.textSecondary, marginTop: 8 },
});

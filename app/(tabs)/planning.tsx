/**
 * Planning Screen (stub — CapacityPlanning removed in contractor declutter)
 */

import React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SemanticColors } from '../../src/theme/colors';
import { SafeArea } from '../../src/theme/spacing';

export default function PlanningScreen() {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
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
  title: { fontSize: 20, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textPrimary },
  subtitle: { fontSize: 14, color: SemanticColors.textSecondary, marginTop: 8 },
});

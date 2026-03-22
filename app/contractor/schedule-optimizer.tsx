// =============================================================================
// SCHEDULE OPTIMIZER — AI planning suggesties
// =============================================================================
// Optimal job ordering based on location, travel, priority, skills
// =============================================================================

import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG } from '../../src/theme/tabStyles';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { useAppState } from '../../src/state/AppState';
import { hapticSuccess } from '../../src/utils/haptics';
import { useTranslation } from 'react-i18next';

type IconName = keyof typeof Ionicons.glyphMap;

interface Suggestion {
  id: string;
  type: 'reorder' | 'cluster' | 'gap' | 'conflict' | 'weather';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  icon: IconName;
  color: string;
  applied: boolean;
}

const mockSuggestions: Suggestion[] = [
  {
    id: 'sg-1', type: 'cluster', priority: 'high',
    title: 'Locatie clustering',
    description: 'Verplaats "Lekkage reparatie" naar voor "CV-ketel onderhoud" — beide in Amsterdam-Zuid. Bespaart 25 min reistijd.',
    impact: '25 min bespaard · €23 besparing',
    icon: 'location-outline', color: '#3B82F6', applied: false,
  },
  {
    id: 'sg-2', type: 'gap', priority: 'medium',
    title: 'Gat in planning',
    description: 'Er is een gat van 2 uur tussen 13:00-15:00. "Radiator vervangen" (1.5u) past perfect in dit tijdslot.',
    impact: 'Bezetting +15% → 85%',
    icon: 'timer-outline', color: '#10B981', applied: false,
  },
  {
    id: 'sg-3', type: 'reorder', priority: 'medium',
    title: 'Prioriteit herschikken',
    description: 'Klus "Airco installatie" heeft deadline morgen. Verplaats naar ochtend voor zekerheid.',
    impact: 'Deadline risico verlaagd',
    icon: 'alert-circle-outline', color: SemanticColors.feedbackWarning, applied: false,
  },
  {
    id: 'sg-4', type: 'weather', priority: 'low',
    title: 'Weer optimalisatie',
    description: 'Vrijdag regen verwacht. Verplaats buitenwerk "Dakgoot reparatie" naar donderdag (droog).',
    impact: 'Geen vertraging door weer',
    icon: 'rainy-outline', color: Palette.terracotta, applied: false,
  },
];

const mockRouteStats = {
  currentDistance: 47, // km
  optimizedDistance: 32, // km
  currentTime: 68, // min
  optimizedTime: 43, // min
  savings: 25, // min
  fuelSavings: 4.50, // EUR
};

export default function ScheduleOptimizerScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [suggestions, setSuggestions] = useState(mockSuggestions);

  const pendingCount = suggestions.filter(s => !s.applied).length;
  const totalSavedMin = suggestions.filter(s => s.applied).length * 15; // avg 15 min per suggestion

  const handleApply = (id: string) => {
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, applied: true } : s));
    hapticSuccess();
  };

  const handleApplyAll = () => {
    Alert.alert(
      t('schedule.applyAllTitle', 'Alle suggesties toepassen'),
      `${pendingCount} ${t('schedule.applyAllDesc', 'suggesties toepassen op de planning')}?`,
      [
        { text: t('schedule.cancel', 'Annuleren'), style: 'cancel' },
        {
          text: t('schedule.apply', 'Toepassen'),
          onPress: () => {
            setSuggestions(prev => prev.map(s => ({ ...s, applied: true })));
            hapticSuccess();
            Alert.alert(t('schedule.applied', 'Toegepast'), t('schedule.allApplied', 'Alle suggesties zijn toegepast. Planning is geoptimaliseerd.'));
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('schedule.optimizationTitle', 'Planning Optimalisatie')}</Text>
          <Text style={styles.headerSubtitle}>
            {pendingCount} {t('schedule.suggestions', 'suggesties')} · {totalSavedMin} {t('schedule.minSaved', 'min bespaard')}
          </Text>
        </View>
      </View>

      {/* Route optimization card */}
      <View style={styles.routeCard}>
        <View style={styles.routeHeader}>
          <Ionicons name="navigate-outline" size={20} color={Palette.hermesOrange} />
          <Text style={styles.routeTitle}>{t('schedule.routeOptimization', 'Route Optimalisatie')}</Text>
        </View>
        <View style={styles.routeComparison}>
          <View style={styles.routeCol}>
            <Text style={styles.routeLabel}>{t('schedule.currentRoute', 'Huidige route')}</Text>
            <Text style={styles.routeValueBad}>{mockRouteStats.currentDistance} km</Text>
            <Text style={styles.routeSubValue}>{mockRouteStats.currentTime} min</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={SemanticColors.feedbackSuccess} />
          <View style={styles.routeCol}>
            <Text style={styles.routeLabel}>{t('schedule.optimized', 'Geoptimaliseerd')}</Text>
            <Text style={styles.routeValueGood}>{mockRouteStats.optimizedDistance} km</Text>
            <Text style={styles.routeSubValue}>{mockRouteStats.optimizedTime} min</Text>
          </View>
          <View style={styles.routeSavingsCol}>
            <Ionicons name="trending-down" size={18} color={SemanticColors.feedbackSuccess} />
            <Text style={styles.routeSavings}>-{mockRouteStats.savings} min</Text>
            <Text style={styles.routeFuel}>€{mockRouteStats.fuelSavings.toFixed(2)} {t('schedule.fuel', 'brandstof')}</Text>
          </View>
        </View>
      </View>

      {/* Apply all button */}
      {pendingCount > 0 && (
        <Pressable style={styles.applyAllBtn} onPress={handleApplyAll}>
          <Ionicons name="flash" size={18} color="#fff" />
          <Text style={styles.applyAllText}>{t('schedule.applyAllButton', 'Alle {{count}} suggesties toepassen', { count: pendingCount })}</Text>
        </Pressable>
      )}

      {/* Suggestions */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {suggestions.map(sg => (
          <View
            key={sg.id}
            style={[styles.suggestionCard, sg.applied && styles.suggestionCardApplied]}
          >
            <View style={[styles.sgIcon, { backgroundColor: sg.color + '15' }]}>
              <Ionicons name={sg.icon} size={20} color={sg.applied ? SemanticColors.textTertiary : sg.color} />
            </View>
            <View style={styles.sgContent}>
              <View style={styles.sgHeader}>
                <Text style={[styles.sgTitle, sg.applied && styles.sgTitleApplied]}>{sg.title}</Text>
                {sg.applied && (
                  <Ionicons name="checkmark-circle" size={18} color={SemanticColors.feedbackSuccess} />
                )}
              </View>
              <Text style={styles.sgDesc}>{sg.description}</Text>
              <View style={styles.sgImpact}>
                <Ionicons name="trending-up" size={12} color={SemanticColors.feedbackSuccess} />
                <Text style={styles.sgImpactText}>{sg.impact}</Text>
              </View>
              {!sg.applied && (
                <Pressable style={styles.sgApplyBtn} onPress={() => handleApply(sg.id)}>
                  <Text style={styles.sgApplyText}>{t('schedule.apply', 'Toepassen')}</Text>
                </Pressable>
              )}
            </View>
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: SafeArea.side, paddingTop: SafeArea.top, paddingBottom: Spacing.sm },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 24, fontFamily: 'Manrope_700Bold', color: SemanticColors.textPrimary },
  headerSubtitle: { fontSize: 14, color: SemanticColors.textSecondary, marginTop: 2 },

  routeCard: { marginHorizontal: SafeArea.side, backgroundColor: SemanticColors.surfacePrimary, borderRadius: 16, padding: Spacing.md, marginBottom: Spacing.md },
  routeHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm },
  routeTitle: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: SemanticColors.textPrimary },
  routeComparison: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  routeCol: { alignItems: 'center' },
  routeLabel: { fontSize: 10, color: SemanticColors.textTertiary, letterSpacing: 0.3 },
  routeValueBad: { fontSize: 18, fontFamily: 'Manrope_700Bold', color: SemanticColors.textSecondary, marginTop: 2 },
  routeValueGood: { fontSize: 18, fontFamily: 'Manrope_700Bold', color: SemanticColors.feedbackSuccess, marginTop: 2 },
  routeSubValue: { fontSize: 11, color: SemanticColors.textTertiary },
  routeSavingsCol: { alignItems: 'center', backgroundColor: SemanticColors.feedbackSuccess + '10', borderRadius: 12, padding: 8 },
  routeSavings: { fontSize: 14, fontFamily: 'Manrope_700Bold', color: SemanticColors.feedbackSuccess },
  routeFuel: { fontSize: 10, color: SemanticColors.feedbackSuccess },

  applyAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: SafeArea.side, backgroundColor: Palette.hermesOrange, borderRadius: 12, paddingVertical: 14, marginBottom: Spacing.md },
  applyAllText: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: '#fff' },

  scrollView: { flex: 1, paddingHorizontal: SafeArea.side },

  suggestionCard: { flexDirection: 'row', gap: Spacing.sm, backgroundColor: SemanticColors.surfacePrimary, borderRadius: 12, padding: Spacing.sm, marginBottom: 6 },
  suggestionCardApplied: { opacity: 0.6 },
  sgIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sgContent: { flex: 1 },
  sgHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sgTitle: { fontSize: 15, fontFamily: 'Manrope_600SemiBold', color: SemanticColors.textPrimary },
  sgTitleApplied: { color: SemanticColors.textSecondary },
  sgDesc: { fontSize: 12, color: SemanticColors.textSecondary, marginTop: 4, lineHeight: 17 },
  sgImpact: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  sgImpactText: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: SemanticColors.feedbackSuccess },
  sgApplyBtn: { alignSelf: 'flex-start', backgroundColor: Palette.hermesOrange + '10', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, marginTop: 8 },
  sgApplyText: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: Palette.hermesOrange },
});

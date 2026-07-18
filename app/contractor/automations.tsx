// =============================================================================
// AUTOMATIONS — "Set it and forget it" workflow packs
// =============================================================================

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { SafeArea } from '../../src/theme/spacing';
import { useWorkflowPacks, getPackROI, getPackHealth, type PackHealth } from '../../src/services/workflowPackService';
import { useAuth } from '../../src/context/AuthContext';
import { formatCurrency } from '../../src/i18n/formatting';
import type { Country } from '../../src/i18n/formatting';
import { FadeIn } from '../../src/components/shared/FadeIn';
import { hapticSuccess } from '../../src/utils/haptics';

type IconName = keyof typeof Ionicons.glyphMap;

export default function AutomationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const country = (user?.country ?? 'NL') as Country;
  const { packs, toggle, enabledCount } = useWorkflowPacks();
  const [packROIs, setPackROIs] = useState<Record<string, { actionsTriggered: number; actionsApproved: number; estimatedRevenue: number; estimatedTimeSaved: number }>>({});
  // R66r49 #7: pack health from real telemetry. Surfaces approveRate +
  // muted-customer count + 'new' / 'healthy' / 'low' status badge so
  // contractors can see whether a pack is actually working for them
  // (vs. the hardcoded 30%-recovery estimate in getPackROI).
  const [packHealths, setPackHealths] = useState<Record<string, PackHealth>>({});

  useEffect(() => {
    packs.filter(p => p.enabled).forEach(p => {
      getPackROI(p.id).then(roi => setPackROIs(prev => ({ ...prev, [p.id]: roi })));
      getPackHealth(p.id).then(h => setPackHealths(prev => ({ ...prev, [p.id]: h })));
    });
  }, [packs]);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 12 }}>
          {/* Long uppercase titles wrapped mid-word ("AUTOMATISERINGE / N").
              Shrink to fit one line, as on the Klanten KPI tiles. */}
          <Text style={s.headerTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {t('automations.title', 'Automatiseringen')}
          </Text>
          <Text style={s.headerSub}>{t('automations.subtitle', { defaultValue: '{{count}} active · Vasco works for you', count: enabledCount })}</Text>
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <FadeIn delay={0}>
          <View style={s.heroCard}>
            <Ionicons name="flash" size={24} color={Palette.hermesOrange} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.heroTitle}>{t('automations.heroTitle', 'Bespaar tijd met automatiseringen')}</Text>
              <Text style={s.heroDesc}>{t('automations.heroDesc', 'Activeer workflows en Vasco doet het werk. Je behoudt altijd controle.')}</Text>
            </View>
          </View>
        </FadeIn>

        {/* Packs — names and descriptions come from workflowPackService (AsyncStorage).
           These are persisted in the user's locale at creation time, which is fine for backwards compat. */}
        {packs.map((pack, i) => (
          <FadeIn key={pack.id} delay={50 + i * 30}>
            <View style={s.packCard}>
              <View style={s.packHeader}>
                <View style={[s.packIcon, { backgroundColor: pack.enabled ? Palette.hermesOrange + '15' : SemanticColors.surfaceSecondary }]}>
                  <Ionicons name={pack.icon as IconName} size={22} color={pack.enabled ? Palette.hermesOrange : SemanticColors.textTertiary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.packName}>{pack.name}</Text>
                  <Text style={s.packDesc}>{pack.description}</Text>
                </View>
                <Switch
                  value={pack.enabled}
                  onValueChange={(val) => { hapticSuccess(); toggle(pack.id, val); }}
                  trackColor={{ true: Palette.hermesOrange, false: SemanticColors.borderDefault }}
                  thumbColor={Palette.white}
                />
              </View>

              {/* R66r49 #7: pack health badge — 'new' (gray, <5 settled),
                  'healthy' (green, ≥40% approve), 'low' (yellow, <40% approve).
                  Surfaces real telemetry from the new pack_queued/approved/
                  dismissed events, not the hardcoded 30%-recovery estimate. */}
              {pack.enabled && packHealths[pack.id] && packHealths[pack.id].queued > 0 && (
                <View style={s.healthRow}>
                  <View style={[
                    s.healthPill,
                    packHealths[pack.id].status === 'healthy' && s.healthPillHealthy,
                    packHealths[pack.id].status === 'low' && s.healthPillLow,
                    packHealths[pack.id].status === 'new' && s.healthPillNew,
                  ]}>
                    <Text style={[
                      s.healthPillText,
                      packHealths[pack.id].status === 'healthy' && s.healthPillTextHealthy,
                      packHealths[pack.id].status === 'low' && s.healthPillTextLow,
                      packHealths[pack.id].status === 'new' && s.healthPillTextNew,
                    ]}>
                      {packHealths[pack.id].status === 'new'
                        ? t('automations.healthNew', 'NEW')
                        : packHealths[pack.id].status === 'healthy'
                          ? t('automations.healthHealthy', 'HEALTHY')
                          : t('automations.healthLow', 'NEEDS WORK')}
                      {packHealths[pack.id].status !== 'new' && ` · ${Math.round(packHealths[pack.id].approveRate * 100)}%`}
                    </Text>
                  </View>
                  {packHealths[pack.id].mutedCustomerCount > 0 && (
                    <Text style={s.mutedText}>
                      {t('automations.mutedCount', { defaultValue: '{{count}} muted', count: packHealths[pack.id].mutedCustomerCount })}
                    </Text>
                  )}
                </View>
              )}

              {/* ROI stats */}
              {pack.enabled && packROIs[pack.id] && (packROIs[pack.id].actionsTriggered > 0) && (
                <Text style={s.roiText}>
                  {packROIs[pack.id].actionsTriggered} {t('automations.actions', 'actions')} · {packROIs[pack.id].actionsApproved} {t('automations.approved', 'approved')}{packROIs[pack.id].estimatedRevenue > 0 ? ` · ${formatCurrency(packROIs[pack.id].estimatedRevenue, country)} ${t('automations.recovered', 'recovered')}` : ''} · {packROIs[pack.id].estimatedTimeSaved} min {t('automations.saved', 'saved')}
                </Text>
              )}

              {/* Steps preview */}
              {pack.enabled && (
                <View style={s.stepsPreview}>
                  {/* Step actions render via automations.actionLabels.*; the raw
                      identifier was previously printed with underscores stripped,
                      i.e. "Na 3 dagen: send friendly reminder" — an English enum
                      inside a Dutch sentence. */}
                  {pack.steps.map((step, j) => (
                    <View key={j} style={s.stepRow}>
                      <View style={s.stepDot} />
                      <Text style={s.stepText} numberOfLines={1}>
                        {step.delayDays === 0
                          ? t('automations.immediately', 'Immediately')
                          : step.delayDays < 0
                            ? t('automations.beforeDue', { defaultValue: '{{days}}d before due', days: Math.abs(step.delayDays) })
                            : t('automations.afterDays', { defaultValue: 'After {{days}} days', days: step.delayDays })
                        }: {t(`automations.actionLabels.${step.action}`, step.action.replace(/_/g, ' '))}
                      </Text>
                      <Text style={s.stepChannel}>{step.channel}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </FadeIn>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: SafeArea.top, paddingHorizontal: SafeArea.side, paddingBottom: 12 },
  headerTitle: { fontSize: TYPE.displaySize, fontFamily: TYPE.displayFamily, color: SemanticColors.textPrimary,  textTransform: 'uppercase', letterSpacing: 1.2 },
  headerSub: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: SafeArea.side, gap: GRID.md },
  heroCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Palette.hermesOrange + '08', borderRadius: RADIUS.lg, padding: GRID.md, borderWidth: 1, borderColor: Palette.hermesOrange + '20' },
  heroTitle: { fontSize: TYPE.titleSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  heroDesc: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary, marginTop: 2 },
  packCard: { backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, padding: GRID.md, gap: GRID.sm + 4 },
  packHeader: { flexDirection: 'row', alignItems: 'center', gap: GRID.sm + 4 },
  packIcon: { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  packName: { fontSize: TYPE.titleSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  packDesc: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary, marginTop: 2 },
  roiText: { fontSize: TYPE.tinySize, fontFamily: TYPE.tinyFamily, color: Palette.hermesOrange, paddingLeft: 56 },
  healthRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 56 },
  healthPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  healthPillNew: { backgroundColor: SemanticColors.surfaceSecondary, borderColor: SemanticColors.borderDefault },
  healthPillHealthy: { backgroundColor: SemanticColors.feedbackSuccess + '18', borderColor: SemanticColors.feedbackSuccess + '55' },
  healthPillLow: { backgroundColor: SemanticColors.feedbackWarning + '18', borderColor: SemanticColors.feedbackWarning + '55' },
  healthPillText: { fontSize: 10, fontFamily: TYPE.displayFamily, letterSpacing: 1.0 },
  healthPillTextNew: { color: SemanticColors.textTertiary },
  healthPillTextHealthy: { color: SemanticColors.feedbackSuccess },
  healthPillTextLow: { color: SemanticColors.feedbackWarning },
  mutedText: { fontSize: TYPE.tinySize, fontFamily: TYPE.tinyFamily, color: SemanticColors.textTertiary },
  stepsPreview: { gap: 6, paddingLeft: 56 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Palette.hermesOrange },
  stepText: { flex: 1, fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary },
  stepChannel: { fontSize: TYPE.tinySize, fontFamily: TYPE.tinyFamily, color: Palette.hermesOrange, textTransform: 'uppercase' },
});

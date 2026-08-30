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
import { useWorkflowPacks, getPackROI, getPackHealth, resolvePackName, resolvePackDescription, type PackHealth } from '../../src/services/workflowPackService';
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

  // evaluateTriggers() returns 0 on its FIRST line when the tier has no
  // `hasAutomationPacks`, so on the free plan not one of these packs ever
  // fires. The screen had no tier gate at all and still said "9 actief ·
  // Vasco werkt voor je" over nine green toggles — a claim the engine
  // contradicts. Read the real limit and say so.
  const [packsRun, setPacksRun] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const { loadSubscription, getTierLimits } = await import('../../src/services/subscriptionService');
        const sub = await loadSubscription();
        setPacksRun(getTierLimits(sub.tier).hasAutomationPacks);
      } catch {
        // Never hide the packs because a subscription read failed.
        setPacksRun(true);
      }
    })();
  }, []);

  useEffect(() => {
    packs.filter(p => p.enabled).forEach(p => {
      getPackROI(p.id).then(roi => setPackROIs(prev => ({ ...prev, [p.id]: roi })));
      getPackHealth(p.id).then(h => setPackHealths(prev => ({ ...prev, [p.id]: h })));
    });
  }, [packs]);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.back', 'Back')}>
          <Ionicons name="chevron-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 12 }}>
          {/* Long uppercase titles wrapped mid-word ("AUTOMATISERINGE / N").
              Shrink to fit one line, as on the Klanten KPI tiles. */}
          <Text style={s.headerTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {t('automations.title', 'Automatiseringen')}
          </Text>
          <Text style={s.headerSub}>
            {packsRun
              ? t('automations.subtitle', { defaultValue: '{{count}} active · Vasco works for you', count: enabledCount })
              : t('automations.lockedSub')}
          </Text>
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero — states what the engine will actually do for THIS plan. */}
        <FadeIn delay={0}>
          <Pressable
            style={s.heroCard}
            onPress={packsRun ? undefined : () => router.push('/contractor/profile' as any)}
            disabled={packsRun}
          >
            <Ionicons name={packsRun ? 'flash' : 'lock-closed'} size={24} color={Palette.hermesOrange} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.heroTitle}>
                {packsRun ? t('automations.heroTitle', 'Bespaar tijd met automatiseringen') : t('automations.lockedTitle')}
              </Text>
              <Text style={s.heroDesc}>
                {packsRun
                  ? t('automations.heroDesc', 'Activeer workflows en Vasco doet het werk. Je behoudt altijd controle.')
                  : t('automations.lockedDesc')}
              </Text>
            </View>
          </Pressable>
        </FadeIn>

        {/* Packs — names/descriptions are resolved per render via
           resolvePackName/resolvePackDescription. The `pack.name` literals in
           workflowPackService are hardcoded Dutch, so rendering them raw showed
           a Dutch title over English step labels on the same card. */}
        {packs.map((pack, i) => (
          <FadeIn key={pack.id} delay={50 + i * 30}>
            <View style={s.packCard}>
              <View style={s.packHeader}>
                <View style={[s.packIcon, { backgroundColor: pack.enabled ? Palette.hermesOrange + '15' : SemanticColors.surfaceSecondary }]}>
                  <Ionicons name={pack.icon as IconName} size={22} color={pack.enabled ? Palette.hermesOrange : SemanticColors.textTertiary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.packName}>{resolvePackName(pack)}</Text>
                  <Text style={s.packDesc}>{resolvePackDescription(pack)}</Text>
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
                /* Was assembled from fragments — `{n} {t('actions')}` — so it
                   could never agree: one action read "1 Aktionen", and the
                   Romance locales carry the agreement on the adjective too
                   ("1 approuvées"). A count glued to a plural noun is the same
                   defect as "1 Tage überfällig". Pluralised keys let each
                   locale decide its own form. */
                <Text style={s.roiText}>
                  {t('automations.roiActions', { count: packROIs[pack.id].actionsTriggered })} · {t('automations.roiApproved', { count: packROIs[pack.id].actionsApproved })}{packROIs[pack.id].estimatedRevenue > 0 ? ` · ${formatCurrency(packROIs[pack.id].estimatedRevenue, country)} ${t('automations.recovered', 'recovered')}` : ''} · {packROIs[pack.id].estimatedTimeSaved} min {t('automations.saved', 'saved')}
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
                      {/* Two lines, not one: the channel label sizes itself and
                          was starving this flex:1 sibling, so Dutch steps cut to
                          "Na 14 dagen: Dringende herinnerin…". Same flex-starvation
                          shape as the queue rows and the eve.tsx approve button. */}
                      <Text style={s.stepText} numberOfLines={2}>
                        {step.delayDays === 0
                          ? t('automations.immediately', 'Immediately')
                          : step.delayDays < 0
                            ? t('automations.beforeDue', { defaultValue: '{{days}}d before due', days: Math.abs(step.delayDays) })
                            : t('automations.afterDays', { defaultValue: 'After {{days}} days', days: step.delayDays })
                        }: {t(`automations.actionLabels.${step.action}`, step.action.replace(/_/g, ' '))}
                      </Text>
                      {/* The channel is an enum ('in_app'), not copy — it rendered
                          raw as "IN_APP" beside localised EMAIL/SMS. */}
                      <Text style={s.stepChannel}>
                        {t(`automations.channels.${step.channel}`, step.channel.replace(/_/g, ' '))}
                      </Text>
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
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  stepDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Palette.hermesOrange, marginTop: 5 },
  // minWidth:0 lets the flex child actually shrink; without it the text box
  // keeps its intrinsic width and the row overflows instead of wrapping.
  stepText: { flex: 1, minWidth: 0, fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary },
  stepChannel: { flexShrink: 0, fontSize: TYPE.tinySize, fontFamily: TYPE.tinyFamily, color: Palette.hermesOrange, textTransform: 'uppercase' },
});

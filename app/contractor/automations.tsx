// =============================================================================
// AUTOMATIONS — "Set it and forget it" workflow packs
// =============================================================================

import { View, Text, StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { SafeArea } from '../../src/theme/spacing';
import { useWorkflowPacks } from '../../src/services/workflowPackService';
import { FadeIn } from '../../src/components/shared/FadeIn';
import { hapticSuccess } from '../../src/utils/haptics';

type IconName = keyof typeof Ionicons.glyphMap;

export default function AutomationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { packs, toggle, enabledCount } = useWorkflowPacks();

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.headerTitle}>Automatiseringen</Text>
          <Text style={s.headerSub}>{enabledCount} actief · Vasco werkt voor je</Text>
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <FadeIn delay={0}>
          <View style={s.heroCard}>
            <Ionicons name="flash" size={24} color={Palette.hermesOrange} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.heroTitle}>Bespaar tijd met automatiseringen</Text>
              <Text style={s.heroDesc}>Activeer workflows en Vasco doet het werk. Je behoudt altijd controle.</Text>
            </View>
          </View>
        </FadeIn>

        {/* Packs */}
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

              {/* Steps preview */}
              {pack.enabled && (
                <View style={s.stepsPreview}>
                  {pack.steps.map((step, j) => (
                    <View key={j} style={s.stepRow}>
                      <View style={s.stepDot} />
                      <Text style={s.stepText} numberOfLines={1}>
                        {step.delayDays === 0 ? 'Direct' : step.delayDays < 0 ? `${Math.abs(step.delayDays)}d voor vervaldatum` : `Na ${step.delayDays} dagen`}: {step.action.replace(/_/g, ' ')}
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
  headerTitle: { fontSize: TYPE.displaySize, fontFamily: TYPE.displayFamily, color: SemanticColors.textPrimary, letterSpacing: TYPE.displayTracking },
  headerSub: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: SafeArea.side, gap: GRID.md },
  heroCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Palette.hermesOrange + '08', borderRadius: RADIUS.lg, padding: 16, borderWidth: 1, borderColor: Palette.hermesOrange + '20' },
  heroTitle: { fontSize: TYPE.titleSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  heroDesc: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary, marginTop: 2 },
  packCard: { backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, padding: 16, gap: 12 },
  packHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  packIcon: { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  packName: { fontSize: TYPE.titleSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  packDesc: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary, marginTop: 2 },
  stepsPreview: { gap: 6, paddingLeft: 56 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Palette.hermesOrange },
  stepText: { flex: 1, fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary },
  stepChannel: { fontSize: TYPE.tinySize, fontFamily: TYPE.tinyFamily, color: Palette.hermesOrange, textTransform: 'uppercase' },
});

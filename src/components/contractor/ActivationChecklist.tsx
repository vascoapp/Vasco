// =============================================================================
// ActivationChecklist (R225)
// =============================================================================
// Compact progress-bar + 5-step list on the Vandaag tab. Each incomplete
// step is tappable and deep-links to the relevant screen. Auto-hides
// once all 5 are done (or the contractor dismisses via the close button).
// =============================================================================

import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { DK } from '../../theme/draftkings';
import { TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { DKLabel } from '../shared/DKLabel';
import { useAppState } from '../../state/AppState';
import { useActivationMilestones } from '../../services/activationMilestonesService';

export function ActivationChecklist() {
  const { t } = useTranslation();
  const router = useRouter();
  const { businessProfile, customers, quotes, jobs, invoices } = useAppState();
  const { milestones, completedCount, totalCount, visible, dismiss } = useActivationMilestones({
    businessProfile,
    customers: customers as any,
    quotes: quotes as any,
    jobs: jobs as any,
    invoices: invoices as any,
  });

  if (!visible) return null;

  const progressPct = (completedCount / totalCount) * 100;

  return (
    <View style={s.card}>
      <View style={s.header}>
        <View style={s.iconWrap}>
          <Ionicons name="checkmark-circle-outline" size={18} color={DK.colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <DKLabel style={s.title}>
            {t('activation.title', 'Get set up').toUpperCase()}
          </DKLabel>
          <Text style={s.sub}>
            {t('activation.progress', '{{done}} of {{total}} · first win fast', { done: completedCount, total: totalCount })}
          </Text>
        </View>
        <Pressable onPress={dismiss} hitSlop={10}>
          <Ionicons name="close" size={16} color={DK.colors.textMuted} />
        </Pressable>
      </View>

      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: `${progressPct}%` }]} />
      </View>

      <View style={s.list}>
        {milestones.map((m) => (
          <Pressable
            key={m.id}
            disabled={m.done}
            onPress={() => router.push(m.route as any)}
            style={({ pressed }) => [s.row, pressed && { opacity: 0.85 }]}
          >
            <Ionicons
              name={m.done ? 'checkmark-circle' : 'ellipse-outline'}
              size={18}
              color={m.done ? DK.colors.success : DK.colors.textMuted}
            />
            <Text
              style={[
                s.rowLabel,
                m.done && { color: DK.colors.textMuted, textDecorationLine: 'line-through' },
              ]}
              numberOfLines={1}
            >
              {t(m.labelKey)}
            </Text>
            {!m.done && (
              <Ionicons name="chevron-forward" size={14} color={DK.colors.textMuted} />
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: DK.colors.panel,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: DK.colors.border,
    padding: GRID.md,
    gap: GRID.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: GRID.sm },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DK.colors.accent + '22',
  },
  title: { fontSize: TYPE.titleSize, color: DK.colors.text },
  sub: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: DK.colors.textMuted, marginTop: 2 },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: DK.colors.border,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: DK.colors.accent },
  list: { gap: GRID.xs, marginTop: GRID.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
    paddingVertical: GRID.xs,
  },
  rowLabel: {
    flex: 1,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: DK.colors.text,
  },
});

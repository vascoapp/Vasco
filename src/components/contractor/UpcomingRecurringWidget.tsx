// =============================================================================
// UPCOMING RECURRING WIDGET (R254) — Vandaag
// =============================================================================
// Surfaces the next 3-5 maintenance contracts due in the next 30 days.
// Tap a row → recurring detail screen. Tap header → full list.
//
// Hidden when no recurring jobs exist or none are due in the horizon.
// =============================================================================

import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { DK } from '../../theme/draftkings';
import { TYPE, GRID, RADIUS } from '../../theme/tabStyles';
import { DKLabel } from '../shared/DKLabel';
import {
  getRecurringInstances,
  type RecurringJobInstance,
} from '../../services/recurringJobsService';

const HORIZON_DAYS = 30;
const MAX_VISIBLE = 4;

export function UpcomingRecurringWidget() {
  const { t } = useTranslation();
  const router = useRouter();
  const [items, setItems] = useState<RecurringJobInstance[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const list = await getRecurringInstances({ withinDays: HORIZON_DAYS });
    setItems(list.slice(0, MAX_VISIBLE));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading || items.length === 0) return null;

  const overdueCount = items.filter((i) => i.overdue).length;

  return (
    <View style={styles.wrap}>
      <Pressable
        style={styles.header}
        onPress={() => router.push('/contractor/recurring' as any)}
        hitSlop={6}
        accessibilityRole="link"
        accessibilityLabel={`Maintenance — ${items.length} due${overdueCount > 0 ? `, ${overdueCount} overdue` : ''}`}
      >
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="repeat" size={14} color={DK.colors.accent} />
          <DKLabel style={styles.headerLabel}>
            {`${t('recurring.upcomingTitle', 'MAINTENANCE')}${overdueCount > 0 ? ` · ${overdueCount} ${t('recurring.overdue', 'overdue')}` : ''}`}
          </DKLabel>
        </View>
        <Text style={styles.allLink}>›</Text>
      </Pressable>

      <View style={styles.card}>
        {items.map((inst, idx) => {
          const dueLabel = inst.overdue
            ? t('recurring.daysOverdue', '{{count}} days overdue', { count: -inst.daysUntilDue })
            : inst.daysUntilDue === 0
              ? t('recurring.dueToday', 'due today')
              : t('recurring.dueInDays', 'due in {{count}} days', { count: inst.daysUntilDue });
          return (
            <Pressable
              key={inst.template.id}
              style={[styles.row, idx > 0 && styles.rowBorder]}
              onPress={() => router.push(`/contractor/recurring/${inst.template.id}` as any)}
              accessibilityRole="button"
              accessibilityLabel={`${inst.template.title}, ${dueLabel}`}
            >
              <View style={[styles.dot, inst.overdue ? styles.dotOverdue : inst.daysUntilDue <= 7 ? styles.dotSoon : styles.dotLater]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>{inst.template.title}</Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {inst.template.customerName ?? '—'} · {dueLabel}
                </Text>
              </View>
              {inst.template.estimatedAmount ? (
                <Text style={styles.amount}>€{Math.round(inst.template.estimatedAmount)}</Text>
              ) : null}
              <Ionicons name="chevron-forward" size={16} color={DK.colors.textMuted} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: GRID.sm, gap: GRID.xs },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GRID.md,
  },
  headerLabel: { color: DK.colors.textMuted },
  allLink: { fontSize: 16, color: DK.colors.textMuted, paddingHorizontal: 4 },
  card: { backgroundColor: DK.colors.panel, borderRadius: RADIUS.lg, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
    paddingHorizontal: GRID.md,
    paddingVertical: GRID.sm,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: DK.colors.border },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOverdue: { backgroundColor: DK.colors.danger ?? '#EF4444' },
  dotSoon: { backgroundColor: DK.colors.highlight },
  dotLater: { backgroundColor: DK.colors.textMuted },
  title: { fontSize: 14, fontFamily: TYPE.bodyFamily, color: DK.colors.text },
  meta: { fontSize: 11, fontFamily: TYPE.captionFamily, color: DK.colors.textMuted, marginTop: 2 },
  amount: { fontSize: 13, fontFamily: TYPE.titleFamily, color: DK.colors.accent },
});

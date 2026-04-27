// =============================================================================
// MAINTENANCE CONTRACTS — list view (R253)
// =============================================================================
// Lists all recurring-job templates the contractor has set up. Each row
// shows next-due date + days until due + pause/resume + edit. Tap to edit.
//
// Backed by recurringJobsService.ts (R246) — AsyncStorage-persisted templates
// with cadence + reminder lead-time. Surfaces the data the EVE
// onderhoud_herinnering pack already consumes; this screen lets the
// contractor manage the schedule directly instead of inferring from packs.
// =============================================================================

import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { DK } from '../../../src/theme/draftkings';
import { TYPE, GRID, RADIUS } from '../../../src/theme/tabStyles';
import { DKLabel } from '../../../src/components/shared/DKLabel';
import { DKScreenHeader } from '../../../src/components/shared/DKScreenHeader';
import {
  getRecurringInstances,
  pause as pauseRecurring,
  resume as resumeRecurring,
  deleteRecurring,
  type RecurringJobInstance,
} from '../../../src/services/recurringJobsService';
import { formatAmount } from '../../../src/utils/formatAmount';
import { hapticSuccess, hapticWarning } from '../../../src/utils/haptics';

export default function RecurringJobsListScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [items, setItems] = useState<RecurringJobInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const list = await getRecurringInstances({ includePaused: true, withinDays: 365 });
    setItems(list);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const togglePause = async (id: string, paused: boolean) => {
    if (paused) await resumeRecurring(id);
    else await pauseRecurring(id);
    hapticSuccess();
    await load();
  };

  const remove = async (id: string) => {
    await deleteRecurring(id);
    hapticWarning();
    await load();
  };

  // Bucket by overdue / due-this-week / future
  const overdue = items.filter((i) => i.overdue && !i.template.paused);
  const dueWeek = items.filter((i) => !i.overdue && i.daysUntilDue <= 7 && !i.template.paused);
  const later = items.filter((i) => !i.overdue && i.daysUntilDue > 7 && !i.template.paused);
  const paused = items.filter((i) => i.template.paused);

  // R267: hero stats — total active contracts + projected MRR + next-due
  const activeItems = items.filter((i) => !i.template.paused);
  const projectedMonthlyRevenue = activeItems.reduce((sum, i) => {
    const amount = i.template.estimatedAmount ?? 0;
    const perMonthFactor =
      i.template.cadence === 'monthly' ? 1
      : i.template.cadence === 'quarterly' ? 1 / 3
      : i.template.cadence === 'semiannual' ? 1 / 6
      : i.template.cadence === 'annual' ? 1 / 12
      : 1 / 6;
    return sum + amount * perMonthFactor;
  }, 0);
  const nextDue = activeItems.length > 0
    ? activeItems.reduce((earliest, i) => i.daysUntilDue < earliest.daysUntilDue ? i : earliest, activeItems[0])
    : null;

  return (
    <SafeAreaView style={styles.root}>
      <DKScreenHeader title={t('recurring.title', 'MAINTENANCE')} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DK.colors.accent} />}
      >
        {/* R267: hero card with stats — replaces sparse list-only layout */}
        {!loading && items.length > 0 && (
          <LinearGradient
            colors={[DK.colors.primaryDark, DK.colors.primary, '#7C2D12']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroChip}>
              <Ionicons name="repeat" size={12} color={DK.colors.accent} />
              <DKLabel style={styles.heroChipText}>{t('recurring.heroChip', 'Recurring revenue')}</DKLabel>
            </View>
            <View style={styles.heroRow}>
              <View style={styles.heroKpi}>
                <Text style={styles.heroValue}>{activeItems.length}</Text>
                <DKLabel style={styles.heroLabel}>{t('recurring.heroActive', 'Active contracts')}</DKLabel>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroKpi}>
                <Text style={styles.heroValue}>{formatAmount(projectedMonthlyRevenue)}</Text>
                <DKLabel style={styles.heroLabel}>{t('recurring.heroMrr', 'Per month')}</DKLabel>
              </View>
            </View>
            {nextDue && (
              <View style={styles.heroNext}>
                <Ionicons name="time-outline" size={14} color={DK.colors.text} />
                <Text style={styles.heroNextText} numberOfLines={1}>
                  {t('recurring.heroNext', 'Next: {{title}} · {{days}}d', {
                    title: nextDue.template.title,
                    days: nextDue.daysUntilDue,
                  })}
                </Text>
              </View>
            )}
          </LinearGradient>
        )}

        {!loading && items.length === 0 && (
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="repeat" size={32} color={DK.colors.accent} />
            </View>
            <Text style={styles.emptyTitle}>{t('recurring.empty', 'No recurring jobs yet')}</Text>
            <Text style={styles.emptyText}>{t('recurring.emptyDesc', 'Set up maintenance contracts so customers come back automatically.')}</Text>
            <Pressable
              style={styles.emptyCta}
              onPress={() => router.push('/contractor/recurring/new' as any)}
            >
              <LinearGradient
                colors={[DK.colors.primaryDark, DK.colors.primary, DK.colors.accent]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <DKLabel style={styles.emptyCtaText}>{t('recurring.addNew', 'NEW MAINTENANCE CONTRACT')}</DKLabel>
            </Pressable>
          </View>
        )}

        {overdue.length > 0 && <Section title={t('recurring.overdue', 'Overdue')} tone="error">
          {overdue.map((i) => <Card key={i.template.id} inst={i} onTogglePause={togglePause} onRemove={remove} onEdit={(id) => router.push(`/contractor/recurring/${id}` as any)} />)}
        </Section>}

        {dueWeek.length > 0 && <Section title={t('recurring.dueThisWeek', 'Due this week')} tone="warn">
          {dueWeek.map((i) => <Card key={i.template.id} inst={i} onTogglePause={togglePause} onRemove={remove} onEdit={(id) => router.push(`/contractor/recurring/${id}` as any)} />)}
        </Section>}

        {later.length > 0 && <Section title={t('recurring.later', 'Coming up')} tone="default">
          {later.map((i) => <Card key={i.template.id} inst={i} onTogglePause={togglePause} onRemove={remove} onEdit={(id) => router.push(`/contractor/recurring/${id}` as any)} />)}
        </Section>}

        {paused.length > 0 && <Section title={t('recurring.paused', 'Paused')} tone="muted">
          {paused.map((i) => <Card key={i.template.id} inst={i} onTogglePause={togglePause} onRemove={remove} onEdit={(id) => router.push(`/contractor/recurring/${id}` as any)} />)}
        </Section>}

        <Pressable style={styles.addBtn} onPress={() => router.push('/contractor/recurring/new' as any)}>
          <Ionicons name="add" size={20} color="#000" />
          <Text style={styles.addBtnText}>{t('recurring.addNew', 'NEW MAINTENANCE CONTRACT')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, tone, children }: { title: string; tone: 'error' | 'warn' | 'default' | 'muted'; children: React.ReactNode }) {
  const color = tone === 'error' ? DK.colors.danger ?? '#EF4444'
    : tone === 'warn' ? DK.colors.highlight
    : tone === 'muted' ? DK.colors.textMuted
    : DK.colors.text;
  return (
    <View style={styles.sectionWrap}>
      <DKLabel style={[styles.sectionLabel, { color }]}>{title.toUpperCase()}</DKLabel>
      {children}
    </View>
  );
}

interface CardProps {
  inst: RecurringJobInstance;
  onTogglePause: (id: string, paused: boolean) => void;
  onRemove: (id: string) => void;
  onEdit: (id: string) => void;
}

function Card({ inst, onTogglePause, onRemove, onEdit }: CardProps) {
  const { t } = useTranslation();
  const dueLabel = inst.overdue
    ? t('recurring.daysOverdue', '{{count}} days overdue', { count: -inst.daysUntilDue })
    : inst.daysUntilDue === 0
      ? t('recurring.dueToday', 'due today')
      : t('recurring.dueInDays', 'due in {{count}} days', { count: inst.daysUntilDue });

  const cadenceLabel = ({
    monthly: 'monthly', quarterly: 'quarterly', semiannual: 'semi-annual',
    annual: 'annual', custom: 'custom',
  } as Record<string, string>)[inst.template.cadence];

  return (
    <Pressable style={styles.card} onPress={() => onEdit(inst.template.id)}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.cardTitle}>{inst.template.title}</Text>
        <Text style={styles.cardSubtitle}>
          {inst.template.customerName ?? '—'} · {cadenceLabel} · {dueLabel}
        </Text>
        {inst.template.estimatedAmount ? (
          <Text style={styles.cardAmount}>€{inst.template.estimatedAmount.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}</Text>
        ) : null}
      </View>
      <View style={styles.cardActions}>
        <Pressable hitSlop={8} onPress={() => onTogglePause(inst.template.id, inst.template.paused)}>
          <Ionicons
            name={inst.template.paused ? 'play-circle' : 'pause-circle'}
            size={26}
            color={DK.colors.accent}
          />
        </Pressable>
        <Pressable hitSlop={8} onPress={() => onRemove(inst.template.id)}>
          <Ionicons name="trash-outline" size={20} color={DK.colors.textMuted} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DK.colors.bg },
  content: { padding: GRID.lg, paddingBottom: GRID.xl * 2, gap: GRID.md },

  // Hero card (R267)
  heroCard: {
    borderRadius: RADIUS.xl,
    padding: GRID.lg,
    gap: GRID.sm,
    overflow: 'hidden',
  },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: DK.colors.accent + '24',
    borderRadius: RADIUS.full,
    paddingHorizontal: GRID.sm,
    paddingVertical: 4,
  },
  heroChipText: { color: DK.colors.accent, fontSize: 10, letterSpacing: 1.2 },
  heroRow: { flexDirection: 'row', alignItems: 'center', marginTop: GRID.xs },
  heroKpi: { flex: 1, gap: 4 },
  heroValue: { fontSize: 26, fontFamily: TYPE.titleFamily, color: DK.colors.text, letterSpacing: -0.5 },
  heroLabel: { fontSize: 10, color: '#FFFFFFB0', letterSpacing: 1.2 },
  heroDivider: { width: 1, height: 32, backgroundColor: '#FFFFFF22' },
  heroNext: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#00000033', borderRadius: RADIUS.md,
    paddingHorizontal: GRID.sm, paddingVertical: 6,
    marginTop: GRID.xs,
  },
  heroNextText: { flex: 1, fontSize: 12, fontFamily: TYPE.captionFamily, color: DK.colors.text },

  // Empty state (R267)
  empty: { alignItems: 'center', paddingVertical: GRID.xl, gap: GRID.sm },
  emptyIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: DK.colors.accent + '22',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: GRID.sm,
  },
  emptyTitle: { fontSize: 18, fontFamily: TYPE.titleFamily, color: DK.colors.text },
  emptyText: { fontSize: 14, fontFamily: TYPE.bodyFamily, color: DK.colors.textMuted, textAlign: 'center', maxWidth: 280 },
  emptyCta: {
    marginTop: GRID.md,
    overflow: 'hidden',
    borderRadius: RADIUS.full,
    paddingHorizontal: GRID.xl,
    paddingVertical: GRID.md,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: DK.colors.accent, shadowOpacity: 0.4, shadowRadius: 12,
  },
  emptyCtaText: { color: '#FFFFFF', fontFamily: TYPE.titleFamily, fontSize: 13, letterSpacing: 1.4 },

  sectionWrap: { gap: GRID.xs },
  sectionLabel: { color: DK.colors.textMuted },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.md,
    backgroundColor: DK.colors.panel,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    borderWidth: 1,
    borderColor: DK.colors.border,
  },
  cardTitle: { fontSize: 15, fontFamily: TYPE.titleFamily, color: DK.colors.text },
  cardSubtitle: { fontSize: 12, fontFamily: TYPE.captionFamily, color: DK.colors.textMuted },
  cardAmount: { fontSize: 13, fontFamily: TYPE.titleFamily, color: DK.colors.accent, marginTop: 2 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: GRID.sm },
  addBtn: {
    marginTop: GRID.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: GRID.sm,
    backgroundColor: DK.colors.accent,
    borderRadius: RADIUS.full,
    paddingVertical: GRID.md,
    shadowColor: DK.colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  addBtnText: { fontSize: 14, fontFamily: TYPE.titleFamily, color: '#000', letterSpacing: 1.4 },
});

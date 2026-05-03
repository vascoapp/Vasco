// =============================================================================
// VANDAAG — DraftKings-patterned layout (same blocks as legacy, restyled only)
// =============================================================================
// Block parity with the legacy Vandaag screen (git HEAD~1):
//   1. Top bar (greeting + buttons)
//   2. Clock-in strip (when active)
//   3. KPI row (3 stats)
//   4. Hero AI banner + inline queue items (was VascoCard)
//   5. Savings banner (was VascoSavedBanner)
//   6. Schedule (vertical job list)
// No new sections added. Only visual treatment swapped to DraftKings rhythm.
// =============================================================================

import { useMemo, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, StatusBar, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { DK } from '../../src/theme/draftkings';
import { useAppState } from '../../src/state/AppState';
import { useDaySchedule, type ScheduledJob } from '../../src/services/smartSchedulerService';
import { useAIQueue, type QueueItem } from '../../src/services/aiActionQueueService';
import { executeApprovedQueueItem } from '../../src/services/queueItemExecutor';
import { evaluateTriggers } from '../../src/services/workflowPackService';
import { useSavingsAggregation } from '../../src/services/savingsAggregatorService';
import { useClockIn } from '../../src/services/clockInService';
import { formatAmount } from '../../src/utils/formatAmount';
import { hapticSuccess, hapticWarning } from '../../src/utils/haptics';
import { DKLabel } from '../../src/components/shared/DKLabel';
import { ActivationChecklist } from '../../src/components/contractor/ActivationChecklist';
import { ProjectSwitcher } from '../../src/components/contractor/ProjectSwitcher';
import { UpcomingRecurringWidget } from '../../src/components/contractor/UpcomingRecurringWidget';
import { OptimizationStatsWidget } from '../../src/components/contractor/OptimizationStatsWidget';
import { CapacityOverrunCard } from '../../src/components/contractor/CapacityOverrunCard';

export default function VandaagDK() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { invoices, quotes, jobs, customers } = useAppState();
  const today = new Date().toISOString().split('T')[0];

  const daySchedule = useDaySchedule(today);
  const clockIn = useClockIn();
  const aiQueue = useAIQueue();
  const savings = useSavingsAggregation();

  // Populate AI queue on mount (was fired by legacy Vandaag's useEffect).
  useEffect(() => {
    evaluateTriggers({ invoices, quotes, jobs, customers })
      .then(() => aiQueue.refresh())
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── KPI data (match legacy ContractorDashboardHeader: Afspraken + Verdiend + Quotes)
  const todayJobs = daySchedule?.jobs ?? [];
  const dailyEarnings = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    return invoices
      .filter((i) => i.status === 'paid' && i.paidAt && new Date(i.paidAt) >= start)
      .reduce((s, i) => s + (i.total || 0), 0);
  }, [invoices]);
  const activeQuotes = quotes.filter((q) => q.status === 'sent').length;

  const pendingQueue = aiQueue.items.filter((i) => i.status === 'pending' && !i.snoozedUntil);
  const heroAction = pendingQueue[0];
  const inlineQueue = pendingQueue.slice(1, 4);

  const handleApprove = useCallback(async (id: string) => {
    try {
      const item = await aiQueue.approve(id);
      hapticSuccess();
      // R286: actually execute the action. InlineQueueRow doesn't render
      // VascoCard's Share-sheet path, so shareable items wouldn't have
      // dispatched yet — alreadyShared:false lets the executor fire Share.
      if (item) await executeApprovedQueueItem(item, { router }, { alreadyShared: false });
    } catch (e) {
      hapticWarning();
      Alert.alert(t('dk.empty.noExtraActions', 'Action failed'), String((e as Error).message ?? e));
    }
  }, [aiQueue, router, t]);

  const handleReject = useCallback(async (id: string) => {
    try { await aiQueue.reject(id); } catch {}
  }, [aiQueue]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* 1. TOP BAR ─── greeting + actions */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: DK.colors.bg }}>
        <View style={styles.topBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.overline}>
              {new Date().toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'short' }).toUpperCase()}
            </Text>
            <Text style={styles.greeting}>{t('dk.common.goodMorning', 'Good morning')}.</Text>
          </View>
          <Pressable style={styles.bellBtn} onPress={() => router.push('/contractor/notifications' as any)} hitSlop={8}>
            <Ionicons name="notifications-outline" size={20} color={DK.colors.text} />
            {pendingQueue.length > 0 ? (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{pendingQueue.length}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 2. CLOCK-IN STRIP (only when active) */}
        {clockIn.active ? (
          <View style={styles.clockStrip}>
            <View style={styles.livePulse} />
            <DKLabel style={styles.clockLabel}>{t('dk.hero.liveClockedIn', 'Live · clocked in')}</DKLabel>
            <Text style={styles.clockTimer}>{clockIn.timerDisplay}</Text>
          </View>
        ) : null}

        {/* 2b. ACTIVATION CHECKLIST (R225) — auto-hides when all 5 milestones met */}
        <ActivationChecklist />

        {/* 3. KPI ROW ─── 2 stats (Earned removed per R267 — duplicate of Geld tab) */}
        <View style={styles.kpiRow}>
          <KpiTile label={t('dk.pill.appointments', 'Appointments').toUpperCase()} value={String(todayJobs.length)} tone={DK.colors.text} onPress={() => router.push('/contractor/drag-schedule' as any)} />
          <KpiTile label={t('dk.pill.quotes', 'Quotes').toUpperCase()} value={String(activeQuotes)} tone={DK.colors.highlight} onPress={() => router.push('/contractor/quote-list' as any)} />
        </View>

        {/* R298: ML capacity-overrun prediction — hidden when probability low */}
        <CapacityOverrunCard />

        {/* R248: Project switcher — only renders for aannemer with active projects */}
        <ProjectSwitcher />

        {/* R254: upcoming recurring jobs — auto-hides when no contracts due */}
        <UpcomingRecurringWidget />

        {/* R255: route-optimization weekly savings — auto-hides until first applied */}
        <OptimizationStatsWidget />

        {/* 4. VASCOCARD EQUIVALENT ─── hero AI action + inline queue items */}
        <View style={styles.vascoCardWrap}>
          <LinearGradient
            colors={[DK.colors.primaryDark, DK.colors.primary, '#7C2D12']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroGlowOverlay} />
            <View style={styles.heroChipRow}>
              <View style={styles.heroChip}>
                <View style={styles.heroChipDot} />
                <DKLabel style={styles.heroChipText}>{t('dk.hero.vascoAnalyst', 'Vasco Analyst')}</DKLabel>
              </View>
              {/* R16.1: dismiss affordance on the hero. Was previously
                  approve-only — a user stuck with an item they didn't want
                  had no way to clear it. */}
              {heroAction ? (
                <Pressable
                  hitSlop={10}
                  style={styles.heroDismissBtn}
                  onPress={() => handleReject(heroAction.id)}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.dismiss', 'Dismiss')}
                >
                  <Ionicons name="close" size={16} color="rgba(255,255,255,0.75)" />
                </Pressable>
              ) : null}
            </View>
            {heroAction ? (
              <>
                <Text style={styles.heroTitle} numberOfLines={2}>{heroAction.title}</Text>
                <Text style={styles.heroBody} numberOfLines={2}>{heroAction.description}</Text>
                <Pressable
                  style={({ pressed }) => [styles.heroCTA, pressed && { opacity: 0.9 }]}
                  onPress={() => handleApprove(heroAction.id)}
                >
                  <DKLabel style={styles.heroCTAText} numberOfLines={1}>{heroAction.actionLabel}</DKLabel>
                  {/* R16.1: only render the "· {impact}" suffix when impact is non-empty.
                      Was rendering a stranded " ·" prefix on items without an impact line. */}
                  {heroAction.estimatedImpact ? (
                    <Text style={styles.heroCTAImpact} numberOfLines={1}>· {heroAction.estimatedImpact}</Text>
                  ) : null}
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.heroTitle}>
                  {todayJobs.length > 0
                    ? t('dk.hero.guideToday', "Today's focus: {{job}}", { job: (todayJobs[0] as any).title || (todayJobs[0] as any).projectName || t('dk.empty.firstJob', 'first job') })
                    : activeQuotes > 0
                      ? t('dk.hero.guideFollowup', 'Follow up on {{count}} open quote(s)', { count: activeQuotes })
                      : t('dk.hero.guideStart', 'Start with your first quote')}
                </Text>
                <Text style={styles.heroBody}>
                  {todayJobs.length > 0
                    ? t('dk.hero.guideTodayDesc', 'Open the job to clock in, log materials, and finish on time.')
                    : activeQuotes > 0
                      ? t('dk.hero.guideFollowupDesc', 'Customers who reply within 48h convert ~3x more often.')
                      : t('dk.hero.guideStartDesc', 'Take a photo of the work and Vasco will draft the quote.')}
                </Text>
                <Pressable
                  style={({ pressed }) => [styles.heroCTA, pressed && { opacity: 0.9 }]}
                  onPress={() => {
                    if (todayJobs.length > 0) router.push(`/contractor/job/${(todayJobs[0] as any).id}` as any);
                    else if (activeQuotes > 0) router.push('/contractor/quote-list' as any);
                    else router.push('/contractor/tiered-quote' as any);
                  }}
                >
                  <DKLabel style={styles.heroCTAText}>
                    {todayJobs.length > 0
                      ? t('dk.actions.openJob', 'Open job')
                      : activeQuotes > 0
                        ? t('dk.actions.viewQuotes', 'View quotes')
                        : t('dk.actions.newQuote', 'New quote')}
                  </DKLabel>
                </Pressable>
              </>
            )}
          </LinearGradient>

          {/* Inline queue items — was VascoCard's embedded queue list */}
          {inlineQueue.length > 0 ? (
            <View style={styles.inlineQueue}>
              {inlineQueue.map((item) => (
                <InlineQueueRow key={item.id} item={item} onApprove={() => handleApprove(item.id)} onReject={() => handleReject(item.id)} />
              ))}
            </View>
          ) : null}
        </View>

        {/* 5. SAVINGS BANNER ─── was VascoSavedBanner */}
        {savings && savings.totalSavedThisMonth > 0 ? (
          <Pressable style={({ pressed }) => [styles.savingsBanner, pressed && { opacity: 0.9 }]} onPress={() => router.push('/hub/savings' as any)}>
            <View style={styles.savingsIcon}>
              <Ionicons name="trending-up" size={16} color={DK.colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.savingsTitle}>{t('dk.savings.savedThisMonth', { amount: formatAmount(savings.totalSavedThisMonth), defaultValue: 'Vasco saved you {{amount}}' }).toUpperCase()}</Text>
              <Text style={styles.savingsSub}>{t('dk.savings.monthSub', 'This month — view breakdown')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={DK.colors.textMuted} />
          </Pressable>
        ) : null}

        {/* 6. SCHEDULE LIST ─── vertical, was Today's Schedule block.
             R269: calendar-settings is now wired via contextual prompt at
             scheduling time (drag-schedule.tsx) — no header button needed. */}
        <View style={styles.sectionHeader}>
          <DKLabel style={styles.sectionTitle}>{t('dk.section.planning', 'Schedule')}</DKLabel>
          <Pressable onPress={() => router.push('/contractor/drag-schedule' as any)} hitSlop={8}>
            <Text style={styles.sectionLink}>{t('dk.section.all', 'All').toUpperCase()} →</Text>
          </Pressable>
        </View>
        <View style={styles.scheduleList}>
          {todayJobs.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>{t('dk.empty.noJobsToday', 'No jobs today')}</Text>
            </View>
          ) : (
            todayJobs.map((job) => (
              <JobRow key={job.id} job={job} onPress={() => router.push(`/contractor/job/${job.id}` as any)} />
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────
function KpiTile({ label, value, tone, onPress }: { label: string; value: string; tone: string; onPress?: () => void }) {
  return (
    <Pressable style={({ pressed }) => [kpiStyles.tile, pressed && { opacity: 0.85 }]} onPress={onPress}>
      <Text style={kpiStyles.label}>{label}</Text>
      <Text style={[kpiStyles.value, { color: tone }]} numberOfLines={1}>{value}</Text>
    </Pressable>
  );
}

function InlineQueueRow({ item, onApprove, onReject }: { item: QueueItem; onApprove: () => void; onReject: () => void }) {
  return (
    <View style={inlineStyles.row}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={inlineStyles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={inlineStyles.impact} numberOfLines={1}>{item.estimatedImpact}</Text>
      </View>
      <Pressable onPress={onReject} hitSlop={6} style={inlineStyles.rejectBtn}>
        <Ionicons name="close" size={14} color={DK.colors.textMuted} />
      </Pressable>
      <Pressable onPress={onApprove} style={({ pressed }) => [inlineStyles.approveBtn, pressed && { opacity: 0.85 }]}>
        <DKLabel style={inlineStyles.approveText} numberOfLines={1}>{item.actionLabel}</DKLabel>
      </Pressable>
    </View>
  );
}

function JobRow({ job, onPress }: { job: ScheduledJob; onPress: () => void }) {
  const { t } = useTranslation();
  const status = job.status === 'completed' ? t('dk.status.completed', 'Completed') : job.status === 'in_progress' ? t('dk.status.active', 'Active') : t('dk.status.scheduled', 'Scheduled');
  const statusColor =
    job.status === 'in_progress' ? DK.colors.success :
    job.status === 'completed' ? DK.colors.textMuted :
    DK.colors.highlight;
  return (
    <Pressable style={({ pressed }) => [jobStyles.row, pressed && { opacity: 0.9 }]} onPress={onPress}>
      <Text style={jobStyles.time}>{job.startTime?.slice(0, 5) || '--:--'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={jobStyles.title} numberOfLines={1}>{job.projectName}</Text>
        <Text style={jobStyles.customer} numberOfLines={1}>{job.customerName}</Text>
      </View>
      <View style={[jobStyles.statusChip, { borderColor: statusColor + '55', backgroundColor: statusColor + '1A' }]}>
        <Text style={[jobStyles.statusChipText, { color: statusColor }]}>{status}</Text>
      </View>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DK.colors.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  overline: {
    fontFamily: DK.type.display800,
    fontSize: 11,
    color: DK.colors.textMuted,
    letterSpacing: 1.8,
  },
  greeting: {
    fontFamily: DK.type.display900,
    fontSize: 28,
    color: DK.colors.text,
    letterSpacing: -0.8,
    marginTop: 4,
  },
  bellBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: DK.colors.panel,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: DK.colors.border,
  },
  bellBadge: {
    position: 'absolute', top: 4, right: 4,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: DK.colors.accent,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  bellBadgeText: {
    fontFamily: DK.type.display800,
    fontSize: 9,
    color: DK.colors.bg,
  },

  clockStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 4, marginBottom: 14,
    paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: DK.radius.chip,
    backgroundColor: DK.colors.danger + '1A',
    borderWidth: 1, borderColor: DK.colors.danger + '55',
  },
  livePulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: DK.colors.danger },
  clockLabel: {
    fontFamily: DK.type.display800,
    fontSize: 11,
    color: DK.colors.danger,
    letterSpacing: 1.5,
    flex: 1,
  },
  clockTimer: {
    fontFamily: DK.type.display900,
    fontSize: 16,
    color: DK.colors.danger,
    letterSpacing: -0.3,
  },

  kpiRow: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 16 },

  vascoCardWrap: {
    backgroundColor: DK.colors.panel,
    borderRadius: DK.radius.card,
    borderWidth: 1, borderColor: DK.colors.border,
    overflow: 'hidden',
    marginBottom: 16,
  },
  hero: {
    padding: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  heroGlowOverlay: {
    position: 'absolute',
    top: -50, right: -50,
    width: 140, height: 140,
    borderRadius: 70,
    backgroundColor: DK.colors.highlight,
    opacity: 0.15,
  },
  heroChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  heroChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 3, paddingHorizontal: 8,
    borderRadius: DK.radius.chip,
    backgroundColor: '#0B0E11AA',
  },
  heroDismissBtn: {
    width: 28, height: 28,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#0B0E1166',
  },
  heroChipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: DK.colors.highlight },
  heroChipText: {
    fontFamily: DK.type.display800,
    fontSize: 9,
    color: DK.colors.highlight,
    letterSpacing: 1.4,
  },
  heroTitle: {
    fontFamily: DK.type.display900,
    fontSize: 17,
    color: DK.colors.text,
    letterSpacing: -0.3,
    lineHeight: 21,
  },
  heroBody: {
    fontFamily: DK.type.body500,
    fontSize: 12,
    color: '#FFFFFFCC',
    lineHeight: 16,
    marginTop: 4,
    marginBottom: 10,
  },
  heroCTA: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4,
    paddingVertical: 10, paddingHorizontal: 8,
    borderRadius: DK.radius.button,
    backgroundColor: '#FFFFFF',
  },
  heroCTAText: {
    fontFamily: DK.type.display900,
    fontSize: 12,
    color: DK.colors.bg,
    letterSpacing: 1,
    flexShrink: 1,
  },
  heroCTAImpact: {
    fontFamily: DK.type.body600,
    fontSize: 11,
    color: DK.colors.primary,
    flexShrink: 1,
  },

  inlineQueue: {
    paddingHorizontal: 14,
    paddingVertical: 4,
  },

  savingsBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: DK.colors.panel,
    borderRadius: DK.radius.card,
    borderWidth: 1, borderColor: DK.colors.border,
    padding: 14,
    marginBottom: 16,
  },
  savingsIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: DK.colors.success + '1F',
    alignItems: 'center', justifyContent: 'center',
  },
  savingsTitle: {
    fontFamily: DK.type.display800,
    fontSize: 13,
    color: DK.colors.text,
    letterSpacing: 1,
  },
  savingsSub: {
    fontFamily: DK.type.body400,
    fontSize: 12,
    color: DK.colors.textMuted,
    marginTop: 2,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4, marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: DK.type.display900,
    fontSize: 13,
    color: DK.colors.text,
    letterSpacing: 1.2,
    flexShrink: 1,
  },
  sectionLink: {
    fontFamily: DK.type.display800,
    fontSize: 11,
    color: DK.colors.accent,
    letterSpacing: 1.2,
  },

  scheduleList: { gap: 8 },
  emptyCard: {
    backgroundColor: DK.colors.panel,
    borderRadius: DK.radius.card,
    borderWidth: 1, borderColor: DK.colors.border,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: { fontFamily: DK.type.body500, fontSize: 13, color: DK.colors.textMuted },
});

const kpiStyles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: DK.colors.panel,
    borderRadius: DK.radius.card,
    borderWidth: 1, borderColor: DK.colors.border,
    padding: 14,
    minHeight: 76,
    justifyContent: 'space-between',
  },
  label: {
    fontFamily: DK.type.display800,
    fontSize: 9,
    color: DK.colors.textMuted,
    letterSpacing: 1.3,
  },
  value: {
    fontFamily: DK.type.display900,
    fontSize: 22,
    letterSpacing: -0.5,
    lineHeight: 24,
  },
});

const inlineStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DK.colors.border,
  },
  title: {
    fontFamily: DK.type.display700,
    fontSize: 13,
    color: DK.colors.text,
  },
  impact: {
    fontFamily: DK.type.body500,
    fontSize: 11,
    color: DK.colors.highlight,
    marginTop: 2,
  },
  rejectBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: DK.colors.panel2,
    borderWidth: 1, borderColor: DK.colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  approveBtn: {
    backgroundColor: DK.colors.accent,
    paddingVertical: 7, paddingHorizontal: 12,
    borderRadius: DK.radius.button,
  },
  approveText: {
    fontFamily: DK.type.display900,
    fontSize: 10,
    color: DK.colors.bg,
    letterSpacing: 1,
  },
});

const jobStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: DK.colors.panel,
    borderRadius: DK.radius.card,
    borderWidth: 1, borderColor: DK.colors.border,
    padding: 14,
  },
  time: {
    fontFamily: DK.type.display900,
    fontSize: 16,
    color: DK.colors.accent,
    letterSpacing: -0.3,
    width: 52,
  },
  title: {
    fontFamily: DK.type.display800,
    fontSize: 14,
    color: DK.colors.text,
  },
  customer: {
    fontFamily: DK.type.body400,
    fontSize: 12,
    color: DK.colors.textMuted,
    marginTop: 2,
  },
  statusChip: {
    borderRadius: DK.radius.chip,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  statusChipText: {
    fontFamily: DK.type.display700,
    fontSize: 10,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
});

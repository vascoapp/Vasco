// =============================================================================
// VASCO — DraftKings-structured proactive AI hub
// =============================================================================
// DK pattern applied: top bar · HERO FEATURE CARD (top proactive action) ·
// SEGMENTED TAB STRIP (QUEUE / INSIGHTS / AUTOMATIONS / MEER) · tab-driven
// content · gradient CTAs. Functions preserved from legacy screen.
// =============================================================================

import { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Share, Platform, TextInput, Linking, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DK } from '../../src/theme/draftkings';
import { MS_PER_DAY } from '../../src/utils/timeConstants';
import { hapticSuccess } from '../../src/utils/haptics';
import { SkeletonList } from '../../src/components/shared/SkeletonList';
import { useAuth } from '../../src/context/AuthContext';
import { useAppState } from '../../src/state/AppState';
import { useAIQueue } from '../../src/services/aiActionQueueService';
import { useVascoGuidance } from '../../src/services/vascoGuidanceService';
import { recordScreenVisit } from '../../src/intelligence/learningStorage';
import { useAutomations, type AutomationContext } from '../../src/services/automationService';
import { exportAllData } from '../../src/services/dataExportService';
import { requestAccountDeletion } from '../../src/services/accountDeletionService';

type IconName = keyof typeof Ionicons.glyphMap;
type TabKey = 'queue' | 'insights' | 'automations' | 'more';

interface ProactiveAction {
  id: string;
  icon: IconName;
  iconColor: string;
  title: string;
  reason: string;
  actionLabel: string;
  actionType: 'share' | 'navigate' | 'approve';
  shareText?: string;
  route?: string;
  priority: 'high' | 'medium' | 'low';
}

export default function VascoScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { jobs, invoices, quotes, customers, isLoading } = useAppState();
  const aiQueue = useAIQueue();
  const [refreshing, setRefreshing] = useState(false);
  const [actioned, setActioned] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [tab, setTab] = useState<TabKey>('queue');

  const allGuidance = useVascoGuidance('contractor', 'compliance');
  const recommendations = useMemo(() =>
    allGuidance.filter(g => g.priority === 'critical' || g.priority === 'high').slice(0, 5),
    [allGuidance]
  );

  const automationCtx = useMemo<AutomationContext>(() => ({
    jobs: jobs.map(j => ({ id: j.id, title: j.title, status: j.status, customerId: j.customerId ?? '', agreedAmount: j.agreedAmount, completedAt: j.completedAt })),
    invoices: invoices.map(i => ({ id: i.id, customer: i.customer ?? '', amount: i.amount ?? 0, status: i.status, dueInDays: i.dueInDays ?? 0 })),
    quotes: quotes.map(q => ({ id: q.id, customer: q.customer ?? '', amount: q.amount ?? 0, status: q.status, lastUpdated: q.lastUpdated })),
    customers: customers.map(c => ({ id: c.id, name: c.name })),
  }), [jobs, invoices, quotes, customers]);
  const { results: automationResults, timeSaved, config: autoConfig, updateConfig } = useAutomations(automationCtx);

  useEffect(() => { recordScreenVisit('vasco'); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); hapticSuccess(); }, 600);
  }, []);

  const proactiveActions = useMemo((): ProactiveAction[] => {
    const actions: ProactiveAction[] = [];

    invoices.filter((i: any) => i.status === 'overdue').forEach((inv: any) => {
      const customerName = inv.customer || inv.customerName || t('ai.customer');
      const invAmount = (inv.total || inv.amount || 0).toLocaleString(undefined);
      const invRef = inv.reference || inv.id;
      actions.push({
        id: `overdue-${inv.id}`, icon: 'cash-outline', iconColor: DK.colors.danger,
        title: t('ai.paymentReminder', { customer: customerName }),
        reason: t('ai.invoiceOverdue', { reference: invRef, days: Math.abs(inv.dueInDays || 7), amount: invAmount }),
        actionLabel: t('ai.sendReminder'), actionType: 'share',
        shareText: t('ai.reminderMessage', { customer: customerName, reference: invRef, amount: invAmount }),
        priority: 'high',
      });
    });

    const completedNoInvoice = jobs.filter((j: any) => j.status === 'completed' && j.completedAt &&
      !invoices.some((i: any) => i.job === j.title || i.jobId === j.id));
    completedNoInvoice.forEach((job: any) => {
      const jobAmount = (job.quotedAmount || job.agreedAmount || 0).toLocaleString(undefined);
      actions.push({
        id: `invoice-${job.id}`, icon: 'receipt-outline', iconColor: DK.colors.accent,
        title: t('ai.createInvoice', { title: job.title }),
        reason: t('ai.jobNotInvoiced', { amount: jobAmount }),
        actionLabel: t('ai.createInvoiceBtn'), actionType: 'navigate',
        route: `/(contractor)/facturen`, priority: 'high',
      });
    });

    quotes.filter((q: any) => q.status === 'sent').forEach((q: any) => {
      const customerName = q.customer || t('ai.customer');
      const qAmount = (q.amount || 0).toLocaleString(undefined);
      const jobName = q.job || 'project';
      actions.push({
        id: `followup-${q.id}`, icon: 'chatbubble-outline', iconColor: DK.colors.highlight,
        title: t('ai.followUpQuote', { customer: customerName }),
        reason: t('ai.quoteSentNotAnswered', { job: jobName, amount: qAmount }),
        actionLabel: t('ai.sendFollowUp'), actionType: 'share',
        shareText: t('ai.followUpMessage', { customer: customerName, job: jobName }),
        priority: 'medium',
      });
    });

    jobs.filter((j: any) => j.status === 'scheduled' && j.scheduledDate).forEach((job: any) => {
      const customer = customers.find((c: any) => c.id === job.customerId);
      const daysUntil = Math.ceil((new Date(job.scheduledDate).getTime() - Date.now()) / MS_PER_DAY);
      if (daysUntil > 0 && daysUntil <= 7) {
        actions.push({
          id: `prep-${job.id}`, icon: 'calendar-outline', iconColor: DK.colors.accent,
          title: t('ai.jobInDays', { title: job.title, count: daysUntil }),
          reason: customer ? `${customer.name} · ${t('ai.confirmAppointment')}` : t('ai.confirmAppointment'),
          actionLabel: t('ai.sendConfirmation'), actionType: 'share',
          shareText: customer ? t('ai.confirmMessage', { customer: customer.name, title: job.title, date: job.scheduledDate }) : undefined,
          priority: 'medium',
        });
      }
    });

    aiQueue.items.forEach(item => {
      if (!actions.some(a => a.id === item.id)) {
        actions.push({
          id: item.id,
          icon: item.type === 'draft_invoice' ? 'receipt-outline' : item.type === 'draft_reminder' ? 'notifications-outline' : 'document-text-outline',
          iconColor: DK.colors.accent,
          title: item.title, reason: item.description,
          actionLabel: item.actionLabel || t('ai.approve'),
          actionType: 'approve', priority: 'medium',
        });
      }
    });

    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return actions
      .filter(a => !actioned.has(a.id))
      .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }, [jobs, invoices, quotes, customers, aiQueue.items, actioned, t]);

  const handleAction = async (action: ProactiveAction) => {
    hapticSuccess();
    if (action.actionType === 'share' && action.shareText) {
      const text = editingId === action.id && editText ? editText : action.shareText;
      try {
        if (Platform.OS === 'web') { await navigator.clipboard.writeText(text); alert(t('ai.copiedToClipboard')); }
        else { await Share.share({ message: text }); }
      } catch {}
    } else if (action.actionType === 'navigate' && action.route) {
      router.push(action.route as any);
    } else if (action.actionType === 'approve') {
      aiQueue.approve(action.id);
    }
    setActioned(prev => new Set(prev).add(action.id));
    setEditingId(null);
    setEditText('');
  };

  const handleDismiss = (id: string) => setActioned(prev => new Set(prev).add(id));

  const handleExportData = async () => {
    const result = await exportAllData('json', { userId: user?.id, email: user?.email });
    Alert.alert(t('profile.exportData'), result.success
      ? t('profile.exportSuccess', { count: result.keyCount })
      : t('profile.exportFailed'));
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('profile.deleteAccountConfirm'),
      t('profile.deleteAccountMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.deleteAccount'), style: 'destructive',
          onPress: async () => {
            if (user?.id) await requestAccountDeletion(user.id);
            Alert.alert(t('profile.accountDeleted'));
            await logout();
          },
        },
      ],
    );
  };

  const heroAction = proactiveActions[0];
  const restOfQueue = proactiveActions.slice(1);

  const autoToggles = [
    { key: 'autoInvoiceEnabled', icon: 'receipt-outline' as IconName, title: t('ai.autoInvoicing'), desc: t('ai.autoInvoicingDesc'), enabled: autoConfig.autoInvoiceEnabled },
    { key: 'autoReminder', icon: 'notifications-outline' as IconName, title: t('ai.paymentReminders'), desc: t('ai.paymentRemindersDesc', { days: autoConfig.autoReminderDays }), enabled: autoConfig.autoReminderDays > 0 },
    { key: 'autoFollowup', icon: 'chatbubble-outline' as IconName, title: t('ai.quoteFollowUp'), desc: t('ai.quoteFollowUpDesc', { days: autoConfig.autoFollowupDays }), enabled: autoConfig.autoFollowupDays > 0 },
    { key: 'certExpiry', icon: 'shield-checkmark-outline' as IconName, title: t('ai.certWarning'), desc: t('ai.certWarningDesc', { days: autoConfig.certExpiryWarningDays }), enabled: autoConfig.certExpiryWarningDays > 0 },
  ];

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'queue', label: 'QUEUE', count: proactiveActions.length },
    { key: 'insights', label: 'INSIGHTS', count: recommendations.length },
    { key: 'automations', label: 'AUTOMATIONS', count: autoToggles.filter(a => a.enabled).length },
    { key: 'more', label: 'MEER' },
  ];

  if (isLoading) {
    return (
      <View style={s.root}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: DK.colors.bg }}>
          <View style={s.topBar}><Text style={s.title}>VASCO</Text></View>
        </SafeAreaView>
        <SkeletonList count={3} showAction lines={2} />
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* ─── TOP BAR ─── */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: DK.colors.bg }}>
        <View style={s.topBar}>
          <Text style={s.title}>VASCO</Text>
          <Pressable style={s.iconBtn} onPress={() => router.push('/contractor/profile' as any)} hitSlop={8}>
            <Ionicons name="settings-outline" size={20} color={DK.colors.text} />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DK.colors.accent} />}
      >
        {/* ─── HERO FEATURE CARD ─── */}
        {heroAction ? (
          <HeroActionCard
            action={heroAction}
            editingId={editingId}
            editText={editText}
            setEditingId={setEditingId}
            setEditText={setEditText}
            onApprove={() => handleAction(heroAction)}
            onDismiss={() => handleDismiss(heroAction.id)}
            t={t}
          />
        ) : (
          <AllUpToDateHero />
        )}

        {/* ─── TAB STRIP ─── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabStrip}>
          {tabs.map((tb) => {
            const active = tb.key === tab;
            return (
              <Pressable
                key={tb.key}
                style={[s.tab, active && s.tabActive]}
                onPress={() => setTab(tb.key)}
              >
                <Text style={[s.tabText, active && s.tabTextActive]}>{tb.label}</Text>
                {typeof tb.count === 'number' ? (
                  <View style={[s.tabCount, active && s.tabCountActive]}>
                    <Text style={[s.tabCountText, active && s.tabCountTextActive]}>{tb.count}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ─── TAB CONTENT ─── */}
        {tab === 'queue' && (
          restOfQueue.length > 0 ? (
            <View style={s.actionList}>
              {restOfQueue.map((action) => (
                <View key={action.id} style={[s.actionCard, action.priority === 'high' && s.actionCardHigh]}>
                  <View style={s.actionHeader}>
                    <View style={[s.actionIcon, { backgroundColor: action.iconColor + '22', borderColor: action.iconColor + '55' }]}>
                      <Ionicons name={action.icon} size={16} color={action.iconColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.actionTitle} numberOfLines={2}>{action.title}</Text>
                      <Text style={s.actionReason} numberOfLines={2}>{action.reason}</Text>
                    </View>
                    {action.priority === 'high' && (
                      <View style={s.highBadge}>
                        <Text style={s.highBadgeText}>HIGH</Text>
                      </View>
                    )}
                  </View>
                  {editingId === action.id && action.shareText && (
                    <TextInput
                      style={s.editInput}
                      value={editText || action.shareText}
                      onChangeText={setEditText}
                      multiline
                      placeholderTextColor={DK.colors.textMuted}
                    />
                  )}
                  <View style={s.actionButtons}>
                    <Pressable style={s.dismissBtn} onPress={() => handleDismiss(action.id)}>
                      <Text style={s.dismissBtnText}>{t('ai.later').toUpperCase()}</Text>
                    </Pressable>
                    <Pressable style={({ pressed }) => [s.approveBtn, pressed && { opacity: 0.9 }]} onPress={() => handleAction(action)}>
                      <Ionicons name={action.actionType === 'share' ? 'send' : action.actionType === 'navigate' ? 'arrow-forward' : 'checkmark'} size={14} color={DK.colors.bg} />
                      <Text style={s.approveBtnText}>{action.actionLabel.toUpperCase()}</Text>
                    </Pressable>
                    {action.actionType === 'share' && action.shareText && (
                      <Pressable
                        style={({ pressed }) => [s.editBtn, pressed && { opacity: 0.85 }]}
                        onPress={() => {
                          if (editingId === action.id) setEditingId(null);
                          else { setEditingId(action.id); setEditText(action.shareText || ''); }
                        }}
                      >
                        <Ionicons name={editingId === action.id ? 'checkmark' : 'create-outline'} size={16} color={DK.colors.accent} />
                        <Text style={s.editBtnText}>{editingId === action.id ? 'KLAAR' : 'EDIT'}</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              ))}
              {actioned.size > 0 && (
                <View style={s.doneRow}>
                  <Ionicons name="checkmark-circle" size={14} color={DK.colors.success} />
                  <Text style={s.doneText}>{t('ai.actionsCompleted', { count: actioned.size }).toUpperCase()}</Text>
                </View>
              )}
            </View>
          ) : (
            <EmptyPanel
              icon="sparkles-outline"
              title={proactiveActions.length === 0 ? t('ai.nothingToDo') : 'GEEN EXTRA ACTIES'}
              desc={proactiveActions.length === 0 ? t('ai.monitoringDesc') : 'De feature actie hierboven is je enige openstaande item.'}
            />
          )
        )}

        {tab === 'insights' && (
          recommendations.length > 0 ? (
            <View style={s.recList}>
              {recommendations.map((rec: any) => (
                <Pressable
                  key={rec.id}
                  style={({ pressed }) => [s.recCard, pressed && { opacity: 0.9 }]}
                  onPress={() => rec.actionRoute ? router.push(rec.actionRoute as any) : null}
                >
                  <View style={s.recAccent} />
                  <View style={{ flex: 1, padding: 12 }}>
                    <Text style={s.recTitle} numberOfLines={1}>{rec.title}</Text>
                    <Text style={s.recDesc} numberOfLines={2}>{rec.message}</Text>
                  </View>
                  {rec.actionRoute && <Ionicons name="chevron-forward" size={16} color={DK.colors.textMuted} style={{ marginRight: 12 }} />}
                </Pressable>
              ))}
            </View>
          ) : (
            <EmptyPanel icon="bulb-outline" title="GEEN INSIGHTS" desc="Vasco scant je data. Nieuwe insights verschijnen hier zodra ze relevant zijn." />
          )
        )}

        {tab === 'automations' && (
          <>
            {timeSaved.weeklyHoursSaved > 0 && (
              <View style={s.savedBanner}>
                <Ionicons name="time-outline" size={14} color={DK.colors.success} />
                <Text style={s.savedBannerText}>+{timeSaved.weeklyHoursSaved.toFixed(1)}H BESPAARD / WEEK</Text>
              </View>
            )}
            <View style={s.autoList}>
              {autoToggles.map((auto, idx) => (
                <Pressable
                  key={auto.key}
                  style={[s.autoRow, idx < autoToggles.length - 1 && s.autoRowBorder]}
                  onPress={() => {
                    hapticSuccess();
                    if (auto.key === 'autoInvoiceEnabled') updateConfig({ autoInvoiceEnabled: !auto.enabled });
                    else if (auto.key === 'autoReminder') updateConfig({ autoReminderDays: auto.enabled ? 0 : 7 });
                    else if (auto.key === 'autoFollowup') updateConfig({ autoFollowupDays: auto.enabled ? 0 : 3 });
                    else if (auto.key === 'certExpiry') updateConfig({ certExpiryWarningDays: auto.enabled ? 0 : 30 });
                  }}
                >
                  <View style={[s.autoIcon, auto.enabled && s.autoIconOn]}>
                    <Ionicons name={auto.icon} size={16} color={auto.enabled ? DK.colors.accent : DK.colors.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.autoTitle}>{auto.title}</Text>
                    <Text style={s.autoDesc}>{auto.desc}</Text>
                  </View>
                  <View style={[s.toggle, auto.enabled && s.toggleOn]}>
                    <View style={[s.toggleDot, auto.enabled && s.toggleDotOn]} />
                  </View>
                </Pressable>
              ))}
            </View>
            {automationResults.length > 0 && (
              <Text style={s.autoResultCount}>
                {t('ai.actionsExecutedThisWeek', { count: automationResults.filter(r => r.actionTaken).length }).toUpperCase()}
              </Text>
            )}
            <Pressable style={s.manageLink} onPress={() => router.push('/contractor/automations' as any)}>
              <Text style={s.manageLinkText}>MANAGE ALL AUTOMATIONS</Text>
              <Ionicons name="chevron-forward" size={14} color={DK.colors.accent} />
            </Pressable>
          </>
        )}

        {tab === 'more' && (
          <>
            <Text style={s.subsectionLabel}>QUICK ACCESS</Text>
            <View style={s.chipRow}>
              <Pressable style={({ pressed }) => [s.chip, pressed && { opacity: 0.85 }]} onPress={() => router.push('/(contractor)/certificaten' as any)}>
                <Ionicons name="shield-checkmark-outline" size={14} color={DK.colors.accent} />
                <Text style={s.chipText}>{t('ai.certificates').toUpperCase()}</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [s.chip, pressed && { opacity: 0.85 }]} onPress={() => router.push('/(contractor)/besparen' as any)}>
                <Ionicons name="wallet-outline" size={14} color={DK.colors.accent} />
                <Text style={s.chipText}>{t('ai.savings').toUpperCase()}</Text>
              </Pressable>
            </View>

            <Text style={s.subsectionLabel}>ACCOUNT & PRIVACY</Text>
            <View style={s.gdprList}>
              <GdprRow icon="chatbox-ellipses-outline" label={t('profile.sendFeedback')} onPress={() => Linking.openURL('mailto:support@vasco.app?subject=Vasco Feedback')} />
              <GdprRow icon="document-text-outline" label={t('profile.legal')} onPress={() => router.push('/contractor/legal' as any)} />
              <GdprRow icon="download-outline" label={t('profile.exportData')} onPress={handleExportData} />
              <GdprRow icon="trash-outline" label={t('profile.deleteAccount')} onPress={handleDeleteAccount} tone={DK.colors.danger} last />
            </View>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────
function HeroActionCard({ action, editingId, editText, setEditingId, setEditText, onApprove, onDismiss, t }: { action: ProactiveAction; editingId: string | null; editText: string; setEditingId: (id: string | null) => void; setEditText: (txt: string) => void; onApprove: () => void; onDismiss: () => void; t: any }) {
  const editing = editingId === action.id;
  return (
    <View style={heroStyles.wrap}>
      <LinearGradient
        colors={[DK.colors.primaryDark, DK.colors.primary, '#7C2D12']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={heroStyles.card}
      >
        <View style={heroStyles.glow} />
        <View style={heroStyles.chip}>
          <Ionicons name="flash" size={12} color={DK.colors.highlight} />
          <Text style={heroStyles.chipText}>{action.priority === 'high' ? 'TOP PRIORITY' : 'NEXT ACTION'}</Text>
        </View>
        <Text style={heroStyles.title} numberOfLines={2}>{action.title}</Text>
        <Text style={heroStyles.body} numberOfLines={2}>{action.reason}</Text>

        {editing && action.shareText && (
          <TextInput
            style={heroStyles.editInput}
            value={editText || action.shareText}
            onChangeText={setEditText}
            multiline
            placeholderTextColor="#FFFFFF77"
          />
        )}

        <View style={heroStyles.ctaRow}>
          <Pressable style={heroStyles.dismissBtn} onPress={onDismiss}>
            <Text style={heroStyles.dismissText}>{t('ai.later').toUpperCase()}</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [heroStyles.approveBtn, pressed && { opacity: 0.92 }]} onPress={onApprove}>
            <Text style={heroStyles.approveText}>{action.actionLabel.toUpperCase()}</Text>
            <Ionicons name={action.actionType === 'share' ? 'send' : action.actionType === 'navigate' ? 'arrow-forward' : 'checkmark'} size={14} color={DK.colors.bg} />
          </Pressable>
          {action.actionType === 'share' && action.shareText && (
            <Pressable
              style={({ pressed }) => [heroStyles.editBtn, pressed && { opacity: 0.85 }]}
              onPress={() => {
                if (editing) setEditingId(null);
                else { setEditingId(action.id); setEditText(action.shareText || ''); }
              }}
            >
              <Ionicons name={editing ? 'checkmark' : 'create-outline'} size={20} color="#FFFFFF" />
              <Text style={heroStyles.editBtnText}>{editing ? 'KLAAR' : 'EDIT'}</Text>
            </Pressable>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

function AllUpToDateHero() {
  const { t } = useTranslation();
  return (
    <View style={heroStyles.wrap}>
      <LinearGradient
        colors={[DK.colors.panel, DK.colors.panel2]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[heroStyles.card, { borderWidth: 1, borderColor: DK.colors.border }]}
      >
        <View style={[heroStyles.chip, { backgroundColor: DK.colors.success + '22', borderColor: DK.colors.success + '55' }]}>
          <Ionicons name="checkmark-circle" size={12} color={DK.colors.success} />
          <Text style={[heroStyles.chipText, { color: DK.colors.success }]}>ALL CLEAR</Text>
        </View>
        <Text style={heroStyles.title}>{t('ai.allUpToDate')}</Text>
        <Text style={heroStyles.body}>{t('ai.scanningDesc')}</Text>
      </LinearGradient>
    </View>
  );
}

function EmptyPanel({ icon, title, desc }: { icon: IconName; title: string; desc: string }) {
  return (
    <View style={s.emptyPanel}>
      <View style={s.emptyIcon}><Ionicons name={icon} size={28} color={DK.colors.accent} /></View>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyDesc}>{desc}</Text>
    </View>
  );
}

function GdprRow({ icon, label, onPress, tone, last }: { icon: IconName; label: string; onPress: () => void; tone?: string; last?: boolean }) {
  return (
    <Pressable style={[s.gdprRow, !last && s.gdprRowBorder]} onPress={onPress}>
      <Ionicons name={icon} size={16} color={tone ?? DK.colors.textMuted} />
      <Text style={[s.gdprRowText, tone ? { color: tone } : null]}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={DK.colors.textMuted} />
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: DK.colors.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 20, gap: 14 },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontFamily: DK.type.display900, fontSize: 28, color: DK.colors.text, letterSpacing: -0.8 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: DK.colors.panel, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: DK.colors.border },

  // Tab strip
  tabStrip: { gap: 6, paddingRight: 20 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: DK.radius.button,
    backgroundColor: DK.colors.panel,
    borderWidth: 1, borderColor: DK.colors.border,
  },
  tabActive: { backgroundColor: DK.colors.accent, borderColor: DK.colors.accent },
  tabText: { fontFamily: DK.type.display900, fontSize: 11, color: DK.colors.textMuted, letterSpacing: 1.4 },
  tabTextActive: { color: DK.colors.bg },
  tabCount: {
    minWidth: 20, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: DK.radius.chip,
    backgroundColor: DK.colors.panel2,
    alignItems: 'center',
  },
  tabCountActive: { backgroundColor: '#0B0E1144' },
  tabCountText: { fontFamily: DK.type.display900, fontSize: 10, color: DK.colors.textMuted },
  tabCountTextActive: { color: DK.colors.bg },

  subsectionLabel: {
    fontFamily: DK.type.display800,
    fontSize: 10,
    color: DK.colors.textMuted,
    letterSpacing: 1.4,
    marginTop: 4,
    marginBottom: -6,
  },

  // Action list (queue tab)
  actionList: { gap: 8 },
  actionCard: {
    backgroundColor: DK.colors.panel,
    borderRadius: DK.radius.card,
    borderWidth: 1, borderColor: DK.colors.border,
    padding: 14, gap: 10,
  },
  actionCardHigh: { borderColor: DK.colors.danger + '55' },
  actionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  actionIcon: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  actionTitle: { fontFamily: DK.type.display800, fontSize: 13, color: DK.colors.text, lineHeight: 17 },
  actionReason: { fontFamily: DK.type.body400, fontSize: 12, color: DK.colors.textMuted, marginTop: 3, lineHeight: 16 },
  highBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: DK.radius.chip, backgroundColor: DK.colors.danger + '22', borderWidth: 1, borderColor: DK.colors.danger + '55' },
  highBadgeText: { fontFamily: DK.type.display900, fontSize: 9, color: DK.colors.danger, letterSpacing: 1 },

  editInput: {
    backgroundColor: DK.colors.panel2,
    borderRadius: DK.radius.button,
    borderWidth: 1, borderColor: DK.colors.border,
    padding: 10,
    fontSize: 12, fontFamily: DK.type.body400,
    color: DK.colors.text,
    minHeight: 80, textAlignVertical: 'top',
  },

  actionButtons: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 9, paddingHorizontal: 12,
    borderRadius: DK.radius.button,
    backgroundColor: DK.colors.accent + '14',
    borderWidth: 1.5, borderColor: DK.colors.accent,
  },
  editBtnText: { fontFamily: DK.type.display900, fontSize: 11, color: DK.colors.accent, letterSpacing: 1.1 },
  dismissBtn: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: DK.radius.button, backgroundColor: DK.colors.panel2, borderWidth: 1, borderColor: DK.colors.border },
  dismissBtnText: { fontFamily: DK.type.display800, fontSize: 10, color: DK.colors.textMuted, letterSpacing: 1 },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: DK.radius.button, backgroundColor: DK.colors.accent },
  approveBtnText: { fontFamily: DK.type.display900, fontSize: 10, color: DK.colors.bg, letterSpacing: 1.1 },

  doneRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: DK.radius.chip,
    backgroundColor: DK.colors.success + '14',
    borderWidth: 1, borderColor: DK.colors.success + '44',
  },
  doneText: { fontFamily: DK.type.display800, fontSize: 11, color: DK.colors.success, letterSpacing: 1.1 },

  // Empty
  emptyPanel: {
    alignItems: 'center',
    backgroundColor: DK.colors.panel,
    borderRadius: DK.radius.card,
    borderWidth: 1, borderColor: DK.colors.border,
    paddingVertical: 32, paddingHorizontal: 24, gap: 8,
  },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: DK.colors.accent + '1A', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: DK.type.display900, fontSize: 14, color: DK.colors.text, letterSpacing: 1.4 },
  emptyDesc: { fontFamily: DK.type.body400, fontSize: 12, color: DK.colors.textMuted, textAlign: 'center', lineHeight: 17 },

  // Rec list (insights tab)
  recList: { gap: 8 },
  recCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: DK.colors.panel,
    borderRadius: DK.radius.card,
    borderWidth: 1, borderColor: DK.colors.border,
    overflow: 'hidden',
  },
  recAccent: { width: 4, alignSelf: 'stretch', backgroundColor: DK.colors.highlight },
  recTitle: { fontFamily: DK.type.display800, fontSize: 13, color: DK.colors.text },
  recDesc: { fontFamily: DK.type.body400, fontSize: 12, color: DK.colors.textMuted, marginTop: 3, lineHeight: 16 },

  // Automations tab
  savedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: DK.radius.chip,
    backgroundColor: DK.colors.success + '14',
    borderWidth: 1, borderColor: DK.colors.success + '44',
    alignSelf: 'flex-start',
  },
  savedBannerText: { fontFamily: DK.type.display900, fontSize: 11, color: DK.colors.success, letterSpacing: 1.2 },
  autoList: {
    backgroundColor: DK.colors.panel,
    borderRadius: DK.radius.card,
    borderWidth: 1, borderColor: DK.colors.border,
    overflow: 'hidden',
  },
  autoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  autoRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DK.colors.border },
  autoIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: DK.colors.panel2, borderWidth: 1, borderColor: DK.colors.border, alignItems: 'center', justifyContent: 'center' },
  autoIconOn: { backgroundColor: DK.colors.accent + '1A', borderColor: DK.colors.accent + '55' },
  autoTitle: { fontFamily: DK.type.display800, fontSize: 13, color: DK.colors.text },
  autoDesc: { fontFamily: DK.type.body400, fontSize: 11, color: DK.colors.textMuted, marginTop: 2, lineHeight: 14 },
  toggle: { width: 36, height: 20, borderRadius: 10, backgroundColor: DK.colors.panel2, borderWidth: 1, borderColor: DK.colors.border, justifyContent: 'center', paddingHorizontal: 2 },
  toggleOn: { backgroundColor: DK.colors.accent + '33', borderColor: DK.colors.accent },
  toggleDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: DK.colors.textMuted },
  toggleDotOn: { alignSelf: 'flex-end', backgroundColor: DK.colors.accent },
  autoResultCount: {
    fontFamily: DK.type.display800,
    fontSize: 10,
    color: DK.colors.textMuted,
    letterSpacing: 1.2,
    textAlign: 'center',
    marginTop: 4,
  },
  manageLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10,
  },
  manageLinkText: { fontFamily: DK.type.display800, fontSize: 11, color: DK.colors.accent, letterSpacing: 1.2 },

  // More tab
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 9, paddingHorizontal: 14,
    borderRadius: DK.radius.chip,
    backgroundColor: DK.colors.accent + '14',
    borderWidth: 1, borderColor: DK.colors.accent + '44',
  },
  chipText: { fontFamily: DK.type.display800, fontSize: 11, color: DK.colors.accent, letterSpacing: 1.2 },

  gdprList: {
    backgroundColor: DK.colors.panel,
    borderRadius: DK.radius.card,
    borderWidth: 1, borderColor: DK.colors.border,
    overflow: 'hidden',
  },
  gdprRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  gdprRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DK.colors.border },
  gdprRowText: { flex: 1, fontFamily: DK.type.display700, fontSize: 13, color: DK.colors.text },
});

const heroStyles = StyleSheet.create({
  wrap: {
    borderRadius: DK.radius.card,
    shadowColor: DK.colors.accent, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.45, shadowRadius: 28, elevation: 12,
  },
  card: {
    borderRadius: DK.radius.card,
    padding: 18,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: -60, right: -60,
    width: 180, height: 180,
    borderRadius: 90,
    backgroundColor: DK.colors.highlight,
    opacity: 0.18,
  },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 4, paddingHorizontal: 10,
    borderRadius: DK.radius.chip,
    backgroundColor: '#0B0E11AA',
    borderWidth: 1, borderColor: '#FFFFFF22',
    marginBottom: 12,
  },
  chipText: { fontFamily: DK.type.display900, fontSize: 10, color: DK.colors.highlight, letterSpacing: 1.5 },
  title: { fontFamily: DK.type.display900, fontSize: 22, color: '#FFFFFF', letterSpacing: -0.5, lineHeight: 26 },
  body: { fontFamily: DK.type.body500, fontSize: 13, color: '#FFFFFFCC', marginTop: 8, lineHeight: 18, marginBottom: 14 },

  editInput: {
    backgroundColor: '#0B0E1177',
    borderRadius: DK.radius.button,
    borderWidth: 1, borderColor: '#FFFFFF22',
    padding: 10,
    fontSize: 12, fontFamily: DK.type.body400,
    color: '#FFFFFF',
    minHeight: 80, textAlignVertical: 'top',
    marginBottom: 12,
  },

  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: DK.radius.button,
    backgroundColor: '#0B0E11AA',
    borderWidth: 1.5, borderColor: '#FFFFFF55',
  },
  editBtnText: { fontFamily: DK.type.display900, fontSize: 12, color: '#FFFFFF', letterSpacing: 1.2 },
  dismissBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: DK.radius.button, backgroundColor: '#0B0E1177', borderWidth: 1, borderColor: '#FFFFFF22' },
  dismissText: { fontFamily: DK.type.display800, fontSize: 11, color: '#FFFFFFCC', letterSpacing: 1.1 },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: DK.radius.button, backgroundColor: '#FFFFFF' },
  approveText: { fontFamily: DK.type.display900, fontSize: 12, color: DK.colors.bg, letterSpacing: 1.2 },
});

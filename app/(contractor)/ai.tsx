// =============================================================================
// VASCO — Proactive AI action queue. Every item = one tap to execute.
// =============================================================================
// Vasco scans your jobs, invoices, quotes, customers, and materials.
// It prepares actions you'd normally forget or spend 10 minutes on.
// You just approve. EVE Legal AI pattern throughout.
// =============================================================================

import { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Share, Platform, TextInput, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { SafeArea } from '../../src/theme/spacing';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { MS_PER_DAY } from '../../src/utils/timeConstants';
import { useTranslation } from 'react-i18next';
import { hapticSuccess } from '../../src/utils/haptics';
import { FadeIn } from '../../src/components/shared/FadeIn';
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

// =============================================================================
// Proactive action — generated from real app data
// =============================================================================
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

  // Vasco guidance — recommendations
  const allGuidance = useVascoGuidance('contractor', 'compliance');
  const recommendations = useMemo(() =>
    allGuidance.filter(g => g.priority === 'critical' || g.priority === 'high').slice(0, 3),
    [allGuidance]
  );

  // Automations — real context
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

  // ==========================================================================
  // Generate proactive actions from real app state
  // ==========================================================================
  const proactiveActions = useMemo((): ProactiveAction[] => {
    const actions: ProactiveAction[] = [];

    // 1. Overdue invoices → send reminder
    const overdueInvoices = invoices.filter((i: any) => i.status === 'overdue');
    overdueInvoices.forEach((inv: any) => {
      const customerName = inv.customer || inv.customerName || t('ai.customer');
      const invAmount = (inv.total || inv.amount || 0).toLocaleString(undefined);
      const invRef = inv.reference || inv.id;
      actions.push({
        id: `overdue-${inv.id}`,
        icon: 'cash-outline',
        iconColor: SemanticColors.feedbackError,
        title: t('ai.paymentReminder', { customer: customerName }),
        reason: t('ai.invoiceOverdue', { reference: invRef, days: Math.abs(inv.dueInDays || 7), amount: invAmount }),
        actionLabel: t('ai.sendReminder'),
        actionType: 'share',
        shareText: t('ai.reminderMessage', { customer: customerName, reference: invRef, amount: invAmount }),
        priority: 'high',
      });
    });

    // 2. Completed jobs without invoice → create invoice
    const completedNoInvoice = jobs.filter((j: any) =>
      j.status === 'completed' && j.completedAt &&
      !invoices.some((i: any) => i.job === j.title || i.jobId === j.id)
    );
    completedNoInvoice.forEach((job: any) => {
      const jobAmount = (job.quotedAmount || job.agreedAmount || 0).toLocaleString(undefined);
      actions.push({
        id: `invoice-${job.id}`,
        icon: 'receipt-outline',
        iconColor: Palette.hermesOrange,
        title: t('ai.createInvoice', { title: job.title }),
        reason: t('ai.jobNotInvoiced', { amount: jobAmount }),
        actionLabel: t('ai.createInvoiceBtn'),
        actionType: 'navigate',
        route: `/(contractor)/facturen`,
        priority: 'high',
      });
    });

    // 3. Sent quotes without follow-up → nudge customer
    const sentQuotes = quotes.filter((q: any) => q.status === 'sent');
    sentQuotes.forEach((q: any) => {
      const customerName = q.customer || t('ai.customer');
      const qAmount = (q.amount || 0).toLocaleString(undefined);
      const jobName = q.job || 'project';
      actions.push({
        id: `followup-${q.id}`,
        icon: 'chatbubble-outline',
        iconColor: SemanticColors.feedbackInfo,
        title: t('ai.followUpQuote', { customer: customerName }),
        reason: t('ai.quoteSentNotAnswered', { job: jobName, amount: qAmount }),
        actionLabel: t('ai.sendFollowUp'),
        actionType: 'share',
        shareText: t('ai.followUpMessage', { customer: customerName, job: jobName }),
        priority: 'medium',
      });
    });

    // 4. Upcoming jobs → prep reminder
    const upcomingJobs = jobs.filter((j: any) =>
      j.status === 'scheduled' && j.scheduledDate
    );
    upcomingJobs.forEach((job: any) => {
      const customer = customers.find((c: any) => c.id === job.customerId);
      const daysUntil = Math.ceil((new Date(job.scheduledDate).getTime() - Date.now()) / MS_PER_DAY);
      if (daysUntil > 0 && daysUntil <= 7) {
        actions.push({
          id: `prep-${job.id}`,
          icon: 'calendar-outline',
          iconColor: Palette.hermesOrange,
          title: t('ai.jobInDays', { title: job.title, count: daysUntil }),
          reason: customer ? `${customer.name} · ${t('ai.confirmAppointment')}` : t('ai.confirmAppointment'),
          actionLabel: t('ai.sendConfirmation'),
          actionType: 'share',
          shareText: customer ? t('ai.confirmMessage', { customer: customer.name, title: job.title, date: job.scheduledDate }) : undefined,
          priority: 'medium',
        });
      }
    });

    // 5. AI queue items (from background scheduler)
    aiQueue.items.forEach(item => {
      if (!actions.some(a => a.id === item.id)) {
        actions.push({
          id: item.id,
          icon: item.type === 'draft_invoice' ? 'receipt-outline' : item.type === 'draft_reminder' ? 'notifications-outline' : 'document-text-outline',
          iconColor: Palette.hermesOrange,
          title: item.title,
          reason: item.description,
          actionLabel: item.actionLabel || t('ai.approve'),
          actionType: 'approve',
          priority: 'medium',
        });
      }
    });

    // Sort: high first, then medium, then low
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return actions
      .filter(a => !actioned.has(a.id))
      .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }, [jobs, invoices, quotes, customers, aiQueue.items, actioned]);

  const handleAction = async (action: ProactiveAction) => {
    hapticSuccess();
    if (action.actionType === 'share' && action.shareText) {
      const text = editingId === action.id && editText ? editText : action.shareText;
      try {
        if (Platform.OS === 'web') {
          await navigator.clipboard.writeText(text);
          alert(t('ai.copiedToClipboard'));
        } else {
          await Share.share({ message: text });
        }
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

  const handleDismiss = (id: string) => {
    setActioned(prev => new Set(prev).add(id));
  };

  const handleExportData = async () => {
    const result = await exportAllData('json', { userId: user?.id, email: user?.email });
    if (result.success) {
      Alert.alert(t('profile.exportData'), t('profile.exportSuccess', { count: result.keyCount }));
    } else {
      Alert.alert(t('profile.exportData'), t('profile.exportFailed'));
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('profile.deleteAccountConfirm'),
      t('profile.deleteAccountMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.deleteAccount'),
          style: 'destructive',
          onPress: async () => {
            if (user?.id) {
              await requestAccountDeletion(user.id);
            }
            Alert.alert(t('profile.accountDeleted'));
            await logout();
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <Text style={s.headerTitle}>Vasco</Text>
        </View>
        <SkeletonList count={3} showAction lines={2} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Vasco</Text>
        <Pressable
          style={s.settingsBtn}
          onPress={() => router.push('/contractor/profile' as any)}
          hitSlop={8}
        >
          <Ionicons name="settings-outline" size={20} color={SemanticColors.textTertiary} />
        </Pressable>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.hermesOrange} />}
      >
        {/* Status summary */}
        <FadeIn delay={0}>
          <View style={s.statusCard}>
            <View style={s.statusIcon}>
              <Ionicons name="flash" size={20} color={Palette.hermesOrange} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.statusTitle}>
                {proactiveActions.length > 0
                  ? t('ai.actionsReady', { count: proactiveActions.length })
                  : t('ai.allUpToDate')}
              </Text>
              <Text style={s.statusDesc}>
                {proactiveActions.length > 0
                  ? t('ai.workPrepared')
                  : t('ai.scanningDesc')}
              </Text>
            </View>
          </View>
        </FadeIn>

        {/* ── Proactive Actions section card ── */}
        <FadeIn delay={40}>
          <View style={s.sectionCard}>
            <View style={s.sectionCardHeader}>
              <Ionicons name="flash-outline" size={16} color={Palette.hermesOrange} />
              <Text style={s.sectionCardTitle}>{t('ai.proactiveActions', 'Proactive actions')}</Text>
              {proactiveActions.length > 0 && (
                <View style={s.sectionBadge}>
                  <Text style={s.sectionBadgeText}>{proactiveActions.length}</Text>
                </View>
              )}
            </View>

            {proactiveActions.map((action, idx) => (
              <View key={action.id} style={[s.actionCard, action.priority === 'high' && s.actionCardHigh, idx > 0 && { marginTop: GRID.sm }]}>
                {/* Header */}
                <View style={s.actionHeader}>
                  <View style={[s.actionIconCircle, { backgroundColor: action.iconColor + '12' }]}>
                    <Ionicons name={action.icon} size={18} color={action.iconColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.actionTitle} numberOfLines={2}>{action.title}</Text>
                    <Text style={s.actionReason} numberOfLines={2}>{action.reason}</Text>
                  </View>
                </View>

                {/* Editable preview for share actions */}
                {editingId === action.id && action.shareText && (
                  <TextInput
                    style={s.editInput}
                    value={editText || action.shareText}
                    onChangeText={setEditText}
                    multiline
                    placeholder={t('ai.editMessage')}
                    placeholderTextColor={SemanticColors.textTertiary}
                  />
                )}

                {/* Action buttons */}
                <View style={s.actionButtons}>
                  {action.actionType === 'share' && action.shareText && (
                    <Pressable
                      style={s.editBtn}
                      onPress={() => {
                        if (editingId === action.id) {
                          setEditingId(null);
                        } else {
                          setEditingId(action.id);
                          setEditText(action.shareText || '');
                        }
                      }}
                    >
                      <Ionicons name={editingId === action.id ? 'checkmark' : 'create-outline'} size={14} color={Palette.hermesOrange} />
                    </Pressable>
                  )}
                  <Pressable
                    style={({ pressed }) => [s.approveBtn, pressed && { opacity: 0.85 }]}
                    onPress={() => handleAction(action)}
                  >
                    <Ionicons name={action.actionType === 'share' ? 'send' : action.actionType === 'navigate' ? 'arrow-forward' : 'checkmark'} size={14} color={Palette.white} />
                    <Text style={s.approveBtnText}>{action.actionLabel}</Text>
                  </Pressable>
                  <Pressable
                    style={s.dismissBtn}
                    onPress={() => handleDismiss(action.id)}
                  >
                    <Text style={s.dismissBtnText}>{t('ai.later')}</Text>
                  </Pressable>
                </View>
              </View>
            ))}

            {/* Completed count */}
            {actioned.size > 0 && (
              <View style={[s.doneRow, { marginTop: GRID.sm }]}>
                <Ionicons name="checkmark-circle" size={16} color={SemanticColors.feedbackSuccess} />
                <Text style={s.doneText}>{t('ai.actionsCompleted', { count: actioned.size })}</Text>
              </View>
            )}

            {/* Empty state */}
            {proactiveActions.length === 0 && actioned.size === 0 && (
              <View style={s.emptyCard}>
                <Ionicons name="sparkles-outline" size={36} color={SemanticColors.textTertiary} />
                <Text style={s.emptyTitle}>{t('ai.nothingToDo')}</Text>
                <Text style={s.emptyDesc}>{t('ai.monitoringDesc')}</Text>
              </View>
            )}
          </View>
        </FadeIn>

        {/* ── AI Insights section card ── */}
        {recommendations.length > 0 && (
          <FadeIn delay={80}>
            <View style={s.sectionCard}>
              <View style={s.sectionCardHeader}>
                <Ionicons name="bulb-outline" size={16} color={Palette.hermesOrange} />
                <Text style={s.sectionCardTitle}>{t('ai.aiInsights', 'AI Insights')}</Text>
              </View>
              {recommendations.map((rec: any, idx: number) => (
                <Pressable
                  key={rec.id}
                  style={({ pressed }) => [s.recCard, pressed && { opacity: 0.85 }, idx > 0 && { marginTop: GRID.sm }]}
                  onPress={() => rec.actionRoute ? router.push(rec.actionRoute as any) : null}
                >
                  <Ionicons name={(rec.icon as IconName) || 'bulb-outline'} size={18} color={Palette.hermesOrange} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.recTitle} numberOfLines={1}>{rec.title}</Text>
                    <Text style={s.recDesc} numberOfLines={2}>{rec.message}</Text>
                  </View>
                  {rec.actionRoute && <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />}
                </Pressable>
              ))}
            </View>
          </FadeIn>
        )}

        {/* ── Automations section card ── */}
        <FadeIn delay={120}>
          <View style={s.sectionCard}>
            <View style={s.sectionCardHeader}>
              <Ionicons name="cog-outline" size={16} color={Palette.hermesOrange} />
              <Text style={s.sectionCardTitle}>{t('ai.automations')}</Text>
              {timeSaved.weeklyHoursSaved > 0 && (
                <View style={s.sectionBadgeSaved}>
                  <Text style={s.sectionBadgeSavedText}>{t('ai.hoursSavedPerWeek', { hours: timeSaved.weeklyHoursSaved.toFixed(1) })}</Text>
                </View>
              )}
            </View>
            <View style={s.autoList}>
              {([
                { key: 'autoInvoiceEnabled', icon: 'receipt-outline' as IconName, title: t('ai.autoInvoicing'), desc: t('ai.autoInvoicingDesc'), enabled: autoConfig.autoInvoiceEnabled },
                { key: 'autoReminder', icon: 'notifications-outline' as IconName, title: t('ai.paymentReminders'), desc: t('ai.paymentRemindersDesc', { days: autoConfig.autoReminderDays }), enabled: autoConfig.autoReminderDays > 0 },
                { key: 'autoFollowup', icon: 'chatbubble-outline' as IconName, title: t('ai.quoteFollowUp'), desc: t('ai.quoteFollowUpDesc', { days: autoConfig.autoFollowupDays }), enabled: autoConfig.autoFollowupDays > 0 },
                { key: 'certExpiry', icon: 'shield-checkmark-outline' as IconName, title: t('ai.certWarning'), desc: t('ai.certWarningDesc', { days: autoConfig.certExpiryWarningDays }), enabled: autoConfig.certExpiryWarningDays > 0 },
              ]).map(auto => (
                <Pressable
                  key={auto.key}
                  style={s.autoRow}
                  onPress={() => {
                    hapticSuccess();
                    switch (auto.key) {
                      case 'autoInvoiceEnabled':
                        updateConfig({ autoInvoiceEnabled: !auto.enabled });
                        break;
                      case 'autoReminder':
                        updateConfig({ autoReminderDays: auto.enabled ? 0 : 7 });
                        break;
                      case 'autoFollowup':
                        updateConfig({ autoFollowupDays: auto.enabled ? 0 : 3 });
                        break;
                      case 'certExpiry':
                        updateConfig({ certExpiryWarningDays: auto.enabled ? 0 : 30 });
                        break;
                    }
                  }}
                >
                  <Ionicons name={auto.icon} size={18} color={auto.enabled ? Palette.hermesOrange : SemanticColors.textTertiary} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.autoTitle}>{auto.title}</Text>
                    <Text style={s.autoDesc}>{auto.desc}</Text>
                  </View>
                  <View style={[s.autoToggle, auto.enabled && s.autoToggleOn]}>
                    <View style={[s.autoToggleDot, auto.enabled && s.autoToggleDotOn]} />
                  </View>
                </Pressable>
              ))}
            </View>
            {automationResults.length > 0 && (
              <Text style={s.autoResultCount}>
                {t('ai.actionsExecutedThisWeek', { count: automationResults.filter(r => r.actionTaken).length })}
              </Text>
            )}
            <Pressable style={s.manageLink} onPress={() => router.push('/contractor/automations' as any)}>
              <Text style={s.manageLinkText}>{t('ai.manageAutomations', 'Manage all automations')}</Text>
              <Ionicons name="chevron-forward" size={14} color={Palette.hermesOrange} />
            </Pressable>
          </View>
        </FadeIn>

        {/* ── Quick Access section card ── */}
        <FadeIn delay={160}>
          <View style={s.sectionCard}>
            <View style={s.sectionCardHeader}>
              <Ionicons name="grid-outline" size={16} color={Palette.hermesOrange} />
              <Text style={s.sectionCardTitle}>{t('ai.quickAccess', 'Quick access')}</Text>
            </View>
            <View style={s.linksRow}>
              <Pressable style={s.linkChip} onPress={() => router.push('/(contractor)/certificaten' as any)}>
                <Ionicons name="shield-checkmark-outline" size={14} color={SemanticColors.textSecondary} />
                <Text style={s.linkChipText}>{t('ai.certificates')}</Text>
              </Pressable>
              <Pressable style={s.linkChip} onPress={() => router.push('/(contractor)/besparen' as any)}>
                <Ionicons name="wallet-outline" size={14} color={SemanticColors.textSecondary} />
                <Text style={s.linkChipText}>{t('ai.savings')}</Text>
              </Pressable>
            </View>
          </View>
        </FadeIn>

        {/* GDPR & Support links */}
        <FadeIn delay={180}>
          <View style={s.gdprList}>
            <Pressable
              style={s.gdprRow}
              onPress={() => Linking.openURL('mailto:support@vasco.app?subject=Vasco Feedback')}
              accessibilityRole="button"
              accessibilityLabel={t('profile.sendFeedback', 'Send feedback')}
            >
              <Ionicons name="chatbox-ellipses-outline" size={18} color={SemanticColors.textSecondary} />
              <Text style={s.gdprRowText}>{t('profile.sendFeedback')}</Text>
              <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
            </Pressable>
            <Pressable
              style={s.gdprRow}
              onPress={() => router.push('/contractor/legal' as any)}
              accessibilityRole="button"
              accessibilityLabel={t('profile.legal', 'Legal information')}
            >
              <Ionicons name="document-text-outline" size={18} color={SemanticColors.textSecondary} />
              <Text style={s.gdprRowText}>{t('profile.legal')}</Text>
              <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
            </Pressable>
            <Pressable
              style={s.gdprRow}
              onPress={handleExportData}
              accessibilityRole="button"
              accessibilityLabel={t('profile.exportData', 'Export my data')}
            >
              <Ionicons name="download-outline" size={18} color={SemanticColors.textSecondary} />
              <Text style={s.gdprRowText}>{t('profile.exportData')}</Text>
              <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
            </Pressable>
            <Pressable
              style={[s.gdprRow, { borderBottomWidth: 0 }]}
              onPress={handleDeleteAccount}
              accessibilityRole="button"
              accessibilityLabel={t('profile.deleteAccount', 'Delete account')}
            >
              <Ionicons name="trash-outline" size={18} color={SemanticColors.feedbackError} />
              <Text style={[s.gdprRowText, { color: SemanticColors.feedbackError }]}>{t('profile.deleteAccount')}</Text>
              <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
            </Pressable>
          </View>
        </FadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: SafeArea.top, paddingHorizontal: SafeArea.side, paddingBottom: GRID.sm,
    backgroundColor: PAGE_BG,
  },
  headerTitle: { fontSize: TYPE.displaySize, fontFamily: TYPE.displayFamily, color: SemanticColors.textPrimary, letterSpacing: TYPE.displayTracking },
  settingsBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: SemanticColors.surfacePrimary, alignItems: 'center', justifyContent: 'center' },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: SafeArea.side, gap: GRID.md },

  // Status card
  statusCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg,
    borderLeftWidth: 3, borderLeftColor: Palette.hermesOrange, padding: 16,
  },
  statusIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.hermesOrange + '12', alignItems: 'center', justifyContent: 'center' },
  statusTitle: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  statusDesc: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary, marginTop: 2 },

  // Action card
  actionCard: {
    backgroundColor: SemanticColors.surfaceSecondary, borderRadius: RADIUS.md, padding: 14, gap: 10,
  },
  actionCardHigh: {
    borderLeftWidth: 3, borderLeftColor: SemanticColors.feedbackError,
  },
  actionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  actionIconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  actionTitle: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  actionReason: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary, marginTop: 2 },

  // Edit input
  editInput: {
    backgroundColor: PAGE_BG, borderRadius: RADIUS.sm, padding: 10,
    fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textPrimary,
    minHeight: 80, textAlignVertical: 'top',
  },

  // Action buttons
  actionButtons: { flexDirection: 'row', gap: 6, paddingLeft: 46 },
  editBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Palette.hermesOrange + '12', alignItems: 'center', justifyContent: 'center',
  },
  approveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Palette.hermesOrange, borderRadius: RADIUS.sm,
    paddingHorizontal: 14, paddingVertical: 8, flex: 1, justifyContent: 'center',
  },
  approveBtnText: { fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: Palette.white },
  dismissBtn: {
    borderRadius: RADIUS.sm, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: SemanticColors.surfaceSecondary, alignItems: 'center', justifyContent: 'center',
  },
  dismissBtnText: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textTertiary },

  // Done row
  doneRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: SemanticColors.feedbackSuccess + '10', borderRadius: RADIUS.md, padding: 12,
  },
  doneText: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.feedbackSuccess },

  // Empty
  emptyCard: { alignItems: 'center', gap: 8, paddingVertical: 48 },
  emptyTitle: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary },
  emptyDesc: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary, textAlign: 'center', paddingHorizontal: 24 },

  // Section card wrappers
  sectionCard: {
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, padding: GRID.md,
  },
  sectionCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.sm, marginBottom: GRID.sm,
  },
  sectionCardTitle: {
    fontSize: TYPE.titleSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary, flex: 1,
  },
  sectionBadge: {
    backgroundColor: Palette.hermesOrange, borderRadius: RADIUS.full, minWidth: 22, height: 22,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: GRID.xs + 2,
  },
  sectionBadgeText: {
    fontSize: TYPE.tinySize, fontFamily: TYPE.titleFamily, color: Palette.white,
  },
  sectionBadgeSaved: {
    backgroundColor: SemanticColors.feedbackSuccess + '18', borderRadius: RADIUS.full,
    paddingHorizontal: GRID.sm, paddingVertical: 2,
  },
  sectionBadgeSavedText: {
    fontSize: TYPE.tinySize, fontFamily: TYPE.captionFamily, color: SemanticColors.feedbackSuccess,
  },

  // Section (legacy)
  section: { gap: GRID.sm },
  sectionTitle: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary, letterSpacing: TYPE.sectionTracking },

  // Recommendations
  recCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: SemanticColors.surfaceSecondary, borderRadius: RADIUS.md, padding: 14,
    borderLeftWidth: 3, borderLeftColor: Palette.hermesOrange,
  },
  recTitle: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  recDesc: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary, marginTop: 1 },

  // Automations
  timeSaved: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.feedbackSuccess },
  autoList: { backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, overflow: 'hidden' },
  autoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SemanticColors.borderDefault,
  },
  autoTitle: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  autoDesc: { fontSize: TYPE.tinySize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary, marginTop: 1 },
  autoToggle: {
    width: 40, height: 22, borderRadius: 11, backgroundColor: SemanticColors.borderDefault,
    justifyContent: 'center', paddingHorizontal: 2,
  },
  autoToggleOn: { backgroundColor: Palette.hermesOrange },
  autoToggleDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: Palette.white },
  autoToggleDotOn: { alignSelf: 'flex-end' as const },
  autoResultCount: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textTertiary, textAlign: 'center' },
  manageLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: GRID.xs, paddingVertical: GRID.sm },
  manageLinkText: { fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: Palette.hermesOrange },

  // Quick links at bottom
  linksRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  linkChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: SemanticColors.surfaceSecondary, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  linkChipText: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary },

  // GDPR & Support
  gdprList: { backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, overflow: 'hidden' },
  gdprRow: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.sm, padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SemanticColors.borderDefault,
  },
  gdprRowText: { flex: 1, fontSize: TYPE.bodySize, fontFamily: TYPE.captionFamily, color: SemanticColors.textPrimary },
});

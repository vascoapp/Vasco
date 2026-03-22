// =============================================================================
// VASCO — Proactive AI action queue. Every item = one tap to execute.
// =============================================================================
// Vasco scans your jobs, invoices, quotes, customers, and materials.
// It prepares actions you'd normally forget or spend 10 minutes on.
// You just approve. EVE Legal AI pattern throughout.
// =============================================================================

import { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Share, Platform, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { SafeArea } from '../../src/theme/spacing';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { hapticSuccess } from '../../src/utils/haptics';
import { FadeIn } from '../../src/components/shared/FadeIn';
import { useAuth } from '../../src/context/AuthContext';
import { useAppState } from '../../src/state/AppState';
import { useAIQueue } from '../../src/services/aiActionQueueService';
import { useVascoGuidance } from '../../src/services/vascoGuidanceService';
import { recordScreenVisit } from '../../src/intelligence/learningStorage';
import { useAutomations, type AutomationContext } from '../../src/services/automationService';

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
  const router = useRouter();
  const { user } = useAuth();
  const { jobs, invoices, quotes, customers } = useAppState();
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
      const customerName = inv.customer || inv.customerName || 'klant';
      actions.push({
        id: `overdue-${inv.id}`,
        icon: 'cash-outline',
        iconColor: SemanticColors.feedbackError,
        title: `Betaalherinnering voor ${customerName}`,
        reason: `Factuur ${inv.reference || inv.id} is ${Math.abs(inv.dueInDays || 7)} dagen achterstallig · €${(inv.total || inv.amount || 0).toLocaleString('nl-NL')}`,
        actionLabel: 'Herinnering sturen',
        actionType: 'share',
        shareText: `Beste ${customerName},\n\nHierbij een vriendelijke herinnering voor factuur ${inv.reference || inv.id} ter waarde van €${(inv.total || inv.amount || 0).toLocaleString('nl-NL')}.\n\nKunt u deze zo spoedig mogelijk voldoen?\n\nMet vriendelijke groet`,
        priority: 'high',
      });
    });

    // 2. Completed jobs without invoice → create invoice
    const completedNoInvoice = jobs.filter((j: any) =>
      j.status === 'completed' && j.completedAt &&
      !invoices.some((i: any) => i.job === j.title || i.jobId === j.id)
    );
    completedNoInvoice.forEach((job: any) => {
      actions.push({
        id: `invoice-${job.id}`,
        icon: 'receipt-outline',
        iconColor: Palette.hermesOrange,
        title: `Factuur aanmaken voor "${job.title}"`,
        reason: `Klus afgerond maar nog niet gefactureerd · €${(job.quotedAmount || job.agreedAmount || 0).toLocaleString('nl-NL')}`,
        actionLabel: 'Factuur aanmaken',
        actionType: 'navigate',
        route: `/(contractor)/facturen`,
        priority: 'high',
      });
    });

    // 3. Sent quotes without follow-up → nudge customer
    const sentQuotes = quotes.filter((q: any) => q.status === 'sent');
    sentQuotes.forEach((q: any) => {
      const customerName = q.customer || 'klant';
      actions.push({
        id: `followup-${q.id}`,
        icon: 'chatbubble-outline',
        iconColor: SemanticColors.feedbackInfo,
        title: `Opvolging offerte ${customerName}`,
        reason: `Offerte voor "${q.job || 'project'}" is verstuurd maar nog niet beantwoord · €${(q.amount || 0).toLocaleString('nl-NL')}`,
        actionLabel: 'Opvolging sturen',
        actionType: 'share',
        shareText: `Beste ${customerName},\n\nIk wilde even informeren of u de offerte voor ${q.job || 'het project'} heeft kunnen bekijken.\n\nHeeft u vragen of wilt u wijzigingen bespreken? Ik hoor het graag.\n\nMet vriendelijke groet`,
        priority: 'medium',
      });
    });

    // 4. Upcoming jobs → prep reminder
    const upcomingJobs = jobs.filter((j: any) =>
      j.status === 'scheduled' && j.scheduledDate
    );
    upcomingJobs.forEach((job: any) => {
      const customer = customers.find((c: any) => c.id === job.customerId);
      const daysUntil = Math.ceil((new Date(job.scheduledDate).getTime() - Date.now()) / 86400000);
      if (daysUntil > 0 && daysUntil <= 7) {
        actions.push({
          id: `prep-${job.id}`,
          icon: 'calendar-outline',
          iconColor: Palette.hermesOrange,
          title: `${job.title} — over ${daysUntil} ${daysUntil === 1 ? 'dag' : 'dagen'}`,
          reason: customer ? `${customer.name} · Bevestig afspraak en controleer materiaal` : 'Bevestig afspraak en controleer materiaal',
          actionLabel: 'Bevestiging sturen',
          actionType: 'share',
          shareText: customer ? `Beste ${customer.name},\n\nDit is een bevestiging van onze afspraak voor ${job.title} op ${job.scheduledDate}.\n\nHeeft u nog vragen?\n\nMet vriendelijke groet` : undefined,
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
          actionLabel: item.actionLabel || 'Goedkeuren',
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
          alert('Gekopieerd naar klembord');
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
                  ? `${proactiveActions.length} ${proactiveActions.length === 1 ? 'actie' : 'acties'} voor je klaar`
                  : 'Alles bijgewerkt'}
              </Text>
              <Text style={s.statusDesc}>
                {proactiveActions.length > 0
                  ? 'Vasco heeft je werk voorbereid — keur goed of pas aan'
                  : 'Vasco scant je klussen, facturen en klanten. Zodra er iets te doen is, zie je het hier.'}
              </Text>
            </View>
          </View>
        </FadeIn>

        {/* Action queue — every item is one tap */}
        {proactiveActions.map((action, idx) => (
          <FadeIn key={action.id} delay={40 + idx * 30}>
            <View style={[s.actionCard, action.priority === 'high' && s.actionCardHigh]}>
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
                  placeholder="Pas bericht aan..."
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
                  <Text style={s.dismissBtnText}>Later</Text>
                </Pressable>
              </View>
            </View>
          </FadeIn>
        ))}

        {/* Completed count */}
        {actioned.size > 0 && (
          <FadeIn delay={60}>
            <View style={s.doneRow}>
              <Ionicons name="checkmark-circle" size={16} color={SemanticColors.feedbackSuccess} />
              <Text style={s.doneText}>{actioned.size} {actioned.size === 1 ? 'actie' : 'acties'} afgehandeld</Text>
            </View>
          </FadeIn>
        )}

        {/* Empty state */}
        {proactiveActions.length === 0 && actioned.size === 0 && (
          <FadeIn delay={60}>
            <View style={s.emptyCard}>
              <Ionicons name="sparkles-outline" size={36} color={SemanticColors.textTertiary} />
              <Text style={s.emptyTitle}>Niets te doen</Text>
              <Text style={s.emptyDesc}>Vasco houdt je klussen, facturen en klanten in de gaten. Acties verschijnen hier automatisch.</Text>
            </View>
          </FadeIn>
        )}

        {/* Recommendations — Vasco suggests improvements */}
        {recommendations.length > 0 && (
          <FadeIn delay={80}>
            <View style={s.section}>
              <Text style={s.sectionTitle}>Aanbevelingen</Text>
              {recommendations.map((rec: any) => (
                <Pressable
                  key={rec.id}
                  style={({ pressed }) => [s.recCard, pressed && { opacity: 0.85 }]}
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

        {/* Automations — preview what each does, toggle inline */}
        <FadeIn delay={120}>
          <View style={s.section}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={s.sectionTitle}>Automatiseringen</Text>
              {timeSaved.weeklyHoursSaved > 0 && (
                <Text style={s.timeSaved}>{timeSaved.weeklyHoursSaved.toFixed(1)}u/week bespaard</Text>
              )}
            </View>
            <View style={s.autoList}>
              {([
                { key: 'autoInvoiceEnabled', icon: 'receipt-outline' as IconName, title: 'Auto-facturering', desc: 'Factuur wordt klaargezet wanneer een klus is afgerond', enabled: autoConfig.autoInvoiceEnabled },
                { key: 'autoReminder', icon: 'notifications-outline' as IconName, title: 'Betaalherinneringen', desc: `Automatisch na ${autoConfig.autoReminderDays} dagen achterstallig`, enabled: autoConfig.autoReminderDays > 0 },
                { key: 'autoFollowup', icon: 'chatbubble-outline' as IconName, title: 'Offerte opvolging', desc: `Automatisch opvolgen na ${autoConfig.autoFollowupDays} dagen`, enabled: autoConfig.autoFollowupDays > 0 },
                { key: 'certExpiry', icon: 'shield-checkmark-outline' as IconName, title: 'Certificaat waarschuwing', desc: `${autoConfig.certExpiryWarningDays} dagen voor verlopen`, enabled: autoConfig.certExpiryWarningDays > 0 },
              ]).map(auto => (
                <Pressable
                  key={auto.key}
                  style={s.autoRow}
                  onPress={() => {
                    hapticSuccess();
                    if (auto.key === 'autoInvoiceEnabled') {
                      updateConfig({ autoInvoiceEnabled: !auto.enabled });
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
                {automationResults.filter(r => r.actionTaken).length} acties uitgevoerd deze week
              </Text>
            )}
          </View>
        </FadeIn>

        {/* Quick links — very bottom */}
        <FadeIn delay={160}>
          <View style={s.linksRow}>
            <Pressable style={s.linkChip} onPress={() => router.push('/(contractor)/certificaten' as any)}>
              <Ionicons name="shield-checkmark-outline" size={14} color={SemanticColors.textSecondary} />
              <Text style={s.linkChipText}>Certificaten</Text>
            </Pressable>
            <Pressable style={s.linkChip} onPress={() => router.push('/(contractor)/besparen' as any)}>
              <Ionicons name="wallet-outline" size={14} color={SemanticColors.textSecondary} />
              <Text style={s.linkChipText}>Besparen</Text>
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
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, padding: 14, gap: 10,
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

  // Section
  section: { gap: GRID.sm },
  sectionTitle: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary, letterSpacing: TYPE.sectionTracking },

  // Recommendations
  recCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, padding: 14,
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

  // Quick links at bottom
  linksRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  linkChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  linkChipText: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary },
});

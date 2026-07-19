// =============================================================================
// KLANTEN — DraftKings-structured customers hub
// =============================================================================
// DK pattern applied: top bar · HERO FEATURE CARD (most urgent customer or
// top revenue) · SEGMENTED TAB STRIP (OVERZICHT / BESLISSINGEN / CONTACTS) ·
// tab-driven content · gradient CTAs. Functions preserved from legacy screen.
// =============================================================================

import { useCallback, useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, TextInput, Modal, KeyboardAvoidingView, Platform, Share, FlatList } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DK } from '../../src/theme/draftkings';
import { useAppState } from '../../src/state/AppState';
import { useAuth } from '../../src/context/AuthContext';
import { useContractorDecisionInbox } from '../../src/services/decisionSyncService';
import { hapticSuccess } from '../../src/utils/haptics';
import { recordScreenVisit } from '../../src/intelligence/learningStorage';
import { SkeletonList } from '../../src/components/shared/SkeletonList';
import { formatAmount } from '../../src/utils/formatAmount';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DKLabel } from '../../src/components/shared/DKLabel';

// R113 versioned this to `_v2` to escape a poisoned v1 cache that held
// auto-seeded fake trackers. But NOTHING EVER WROTE `_v2` — every writer
// (decisions.tsx, DecisionTracker.tsx, workflowPackService,
// aiActionQueueService) uses the unsuffixed key — so this tab read an
// always-empty key and the BESLISSINGEN list, hero card and overdue counter
// were permanently 0 no matter how many trackers the contractor created.
//
// Reading the real key is safe now: the seeding R113 was escaping is gone
// (SEED_TRACKERS is []), so v1 no longer contains fabricated customers.
const TRACKER_STORAGE_KEY = '@vasco_decision_trackers';

type TabKey = 'overview' | 'decisions' | 'contacts';

interface TrackerData {
  id: string;
  customerName: string;
  project: string;
  totalDecisions: number;
  decided: number;
  overdue: number;
  lastActivity: string;
}

/**
 * Adapt a stored `CustomerDecisionTracker` to the summary shape this tab
 * renders. The stored rows carry `templateName`/`decidedCount`/`overdueCount`;
 * reading `project`/`decided`/`overdue` off them straight (as this screen used
 * to) yields `undefined` and a NaN% progress bar.
 */
function toTrackerData(raw: any): TrackerData {
  const total = Number(raw?.totalDecisions) || 0;
  const decided = Number(raw?.decidedCount ?? raw?.decided) || 0;
  return {
    id: String(raw?.id ?? ''),
    customerName: raw?.customerName ?? '',
    project: raw?.templateName ?? raw?.project ?? '',
    totalDecisions: total,
    decided,
    overdue: Number(raw?.overdueCount ?? raw?.overdue) || 0,
    lastActivity: raw?.lastReminderSent ?? raw?.lastActivity ?? '',
  };
}

// R113: seed trackers (Fam. de Vries / Bakkerij Jansen / Van Dam Advocaten)
// used to be loaded into every fresh user's Customers tab as a "preview"
// of what decision trackers look like. That preview survived
// AsyncStorage hydration so even after R105 fixed the Supabase env-var
// inlining (and the rest of the app stopped showing mock data), the
// Klanten tab still displayed three fake customers. Real users on TF
// saw "Fam. de Vries" with a Badkamer renovatie they never sold.
//
// We now start with an empty array. The empty-state already renders a
// proper "No trackers yet" panel with a CTA (per bedrijf.tsx:262), so
// the previewing-via-seed approach was strictly worse than the empty
// state we built later.
const SEED_TRACKERS: TrackerData[] = [];

export default function BedrijfScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const { customers, invoices, jobs, addCustomer, isLoading } = useAppState();
  const { user } = useAuth();
  const [trackers, setTrackers] = useState<TrackerData[]>([]);
  const [tab, setTab] = useState<TabKey>('overview');
  // R191: aggregate customer-submitted decisions across ALL of this
  // contractor's trackers. Pre-R191 submissions sat unread because there
  // was no top-level surface — contractor had to open each tracker
  // individually to check. Badge appears on the Decisions tab; clearing
  // happens when contractor switches TO the Decisions tab.
  const { newCount: newDecisionsCount, markAllSeen: markDecisionsSeen } = useContractorDecisionInbox(user?.id);
  useEffect(() => {
    if (tab === 'decisions' && newDecisionsCount > 0) {
      markDecisionsSeen().catch(() => {});
    }
  }, [tab, newDecisionsCount, markDecisionsSeen]);

  useEffect(() => { recordScreenVisit('klanten'); }, []);

  // Re-read on focus: trackers are created on the Keuzes screen, so a plain
  // mount-only effect leaves this tab stale after the user navigates back.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      AsyncStorage.getItem(TRACKER_STORAGE_KEY)
        .then(raw => {
          if (cancelled) return;
          const parsed = raw ? JSON.parse(raw) : null;
          setTrackers(Array.isArray(parsed) ? parsed.map(toTrackerData) : SEED_TRACKERS);
        })
        .catch(() => { if (!cancelled) setTrackers(SEED_TRACKERS); });
      return () => { cancelled = true; };
    }, []),
  );

  // NOTE: deliberately NO write-back. This tab renders a read-only summary
  // derived from the canonical CustomerDecisionTracker rows. Persisting its
  // reduced TrackerData shape over the shared key would destroy the phases,
  // categories, accessCode and payment fields the portal depends on.

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); hapticSuccess(); }, 600);
  }, []);

  const handleAddCustomer = useCallback(async () => {
    if (!newName.trim()) return;
    await addCustomer(newName.trim(), newEmail.trim() || undefined, newPhone.trim() || undefined);
    hapticSuccess();
    setNewName(''); setNewEmail(''); setNewPhone('');
    setShowAddModal(false);
  }, [newName, newEmail, newPhone, addCustomer]);

  const handleSendReminder = useCallback(async (trackerId: string) => {
    try {
      await Share.share({ message: t('customers.reminderMessage', 'Hi, could you review the pending decisions for your project? This helps us stay on schedule.') });
      setTrackers(prev => prev.map(tr => tr.id === trackerId ? { ...tr, lastActivity: 'Just now' } : tr));
      hapticSuccess();
    } catch {}
  }, [t]);

  const customerRevenue = useMemo(() => {
    // Resolve by customerId when present, else fall back to matching the
    // `customer` NAME against the contact list.
    //
    // Requiring customerId meant every invoice that only carries a name was
    // skipped, so this whole tab reported "No revenue yet · €0,00" while the
    // Geld tab showed €760 of paid revenue from the same invoice. Invoices
    // reaching here from several paths (seeded/imported/quote-sourced) set
    // `customer` but not `customerId`, so the id alone is not a reliable key.
    const byName: Record<string, string> = {};
    customers.forEach((c: any) => {
      if (c.name) byName[String(c.name).trim().toLowerCase()] = c.id;
    });

    const map: Record<string, number> = {};
    invoices.forEach((inv: any) => {
      if (inv.status !== 'paid') return;
      const key = inv.customerId
        ?? byName[String(inv.customer ?? inv.customerName ?? '').trim().toLowerCase()];
      if (!key) return; // unattributable — better than inventing a bucket
      map[key] = (map[key] || 0) + (inv.amount || 0);
    });
    return map;
  }, [invoices, customers]);

  const customerJobs = useMemo(() => {
    const map: Record<string, number> = {};
    jobs.forEach((j: any) => { if (j.customerId) map[j.customerId] = (map[j.customerId] || 0) + 1; });
    return map;
  }, [jobs]);

  const totalRevenue = useMemo(() => Object.values(customerRevenue).reduce((s, v) => s + v, 0), [customerRevenue]);
  const activeTrackers = trackers.filter(tr => tr.decided < tr.totalDecisions);
  const completedTrackers = trackers.filter(tr => tr.decided >= tr.totalDecisions);
  const totalOverdue = trackers.reduce((s, tr) => s + tr.overdue, 0);

  // Hero feature: most urgent tracker (by overdue count), or highest-revenue customer
  const heroFeature = useMemo(() => {
    const mostOverdue = [...trackers].sort((a, b) => b.overdue - a.overdue)[0];
    if (mostOverdue && mostOverdue.overdue > 0) {
      return { type: 'urgent' as const, tracker: mostOverdue };
    }
    const topActive = activeTrackers[0];
    if (topActive) return { type: 'active' as const, tracker: topActive };
    // Fallback: top-revenue customer
    const topRevenueEntry = Object.entries(customerRevenue).sort((a, b) => b[1] - a[1])[0];
    if (topRevenueEntry) {
      const cust = customers.find(c => c.id === topRevenueEntry[0]);
      if (cust) return { type: 'topRevenue' as const, customer: cust, revenue: topRevenueEntry[1] };
    }
    return null;
  }, [trackers, activeTrackers, customerRevenue, customers]);

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'overview', label: t('dk.tabs.overview', 'Overview').toUpperCase() },
    // R191: count badge prefers "new from customer" when there are unseen
    // submissions, otherwise falls back to "active trackers" so the tab
    // always has useful context.
    { key: 'decisions', label: t('dk.tabs.decisions', 'Decisions').toUpperCase(), count: newDecisionsCount > 0 ? newDecisionsCount : activeTrackers.length },
    { key: 'contacts', label: t('dk.tabs.contacts', 'Contacts').toUpperCase(), count: customers.length },
  ];

  if (isLoading) {
    return (
      <View style={s.root}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: DK.colors.bg }}>
          <View style={s.topBar}><DKLabel style={s.title}>{t('tabs.customers', 'Klanten')}</DKLabel></View>
        </SafeAreaView>
        <SkeletonList count={4} showAvatar lines={2} />
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* ─── TOP BAR ─── */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: DK.colors.bg }}>
        <View style={s.topBar}>
          <View style={{ flex: 1 }}>
            <DKLabel style={s.title}>{t('tabs.customers', 'Klanten')}</DKLabel>
            <Text style={s.subtitle}>{customers.length} {t('dk.tabs.contacts', 'Contacts').toUpperCase()} · {formatAmount(totalRevenue)}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [s.addBtn, pressed && { opacity: 0.9 }]}
            onPress={() => setShowAddModal(true)}
            accessibilityRole="button"
            accessibilityLabel={t('customers.addNew', 'Add new customer')}
          >
            <LinearGradient colors={[DK.colors.primaryDark, DK.colors.primary, DK.colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <Ionicons name="person-add" size={16} color="#FFFFFF" />
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
        {heroFeature ? (
          <HeroFeatureCard
            feature={heroFeature}
            onPress={() => router.push('/(contractor)/decisions' as any)}
            onRemind={(id) => handleSendReminder(id)}
          />
        ) : null}

        {/* ─── TAB STRIP ─── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabStrip}>
          {tabs.map((tb) => {
            const active = tb.key === tab;
            return (
              <Pressable
                key={tb.key}
                style={[s.tab, active && s.tabActive]}
                onPress={() => setTab(tb.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={tb.label}
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
        {tab === 'overview' && (
          <>
            {/* 3-KPI stadium */}
            <View style={s.kpiRow}>
              <KpiTile label={t('dk.tabs.contacts', 'Contacts').toUpperCase()} value={customers.length} tone={DK.colors.accent} />
              <KpiTile label={t('dk.tabs.decisions', 'Decisions').toUpperCase()} value={activeTrackers.length} tone={DK.colors.highlight} />
              <KpiTile label={t('dk.pill.overdue', 'Overdue').toUpperCase()} value={totalOverdue} tone={totalOverdue > 0 ? DK.colors.danger : DK.colors.textMuted} />
            </View>

            {/* Top 3 customers by revenue.
                Gate on revenue data, NOT customers.length — customerRevenue only
                holds customers with PAID invoices, so with contacts but no paid
                revenue (e.g. €0,00) the old gate rendered the header over an empty
                void. No revenue → hide the whole section. */}
            {/* With contacts but no paid revenue yet, hiding the section left
                the whole Overzicht tab blank below the KPI tiles. Show why
                it's empty and where to go next instead of a void. */}
            {Object.keys(customerRevenue).length === 0 && customers.length > 0 && (
              <Pressable style={s.emptyPanel} onPress={() => setTab('contacts')}>
                <View style={s.emptyIcon}><Ionicons name="trending-up-outline" size={28} color={DK.colors.accent} /></View>
                <DKLabel style={s.emptyTitle}>{t('dk.empty.noRevenueYet', 'No revenue yet')}</DKLabel>
                <Text style={s.emptyDesc}>
                  {t('dk.empty.noRevenueYetDesc', 'Top customers appear here once an invoice is paid. Open a contact to send a quote.')}
                </Text>
              </Pressable>
            )}

            {Object.keys(customerRevenue).length > 0 && (
              <>
                <DKLabel style={s.subsectionLabel}>{t('dk.money.topCustomers', 'Top customers')}</DKLabel>
                <View style={s.listGroup}>
                  {Object.entries(customerRevenue)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([cid, rev]) => {
                      const c = customers.find(cx => cx.id === cid);
                      if (!c) return null;
                      return (
                        <CustomerRow
                          key={c.id}
                          name={c.name}
                          meta={`${customerJobs[c.id] || 0} ${t('dk.pill.jobs', 'Jobs').toUpperCase()} · ${formatAmount(rev)}`}
                          onPress={() => router.push('/contractor/customer-crm' as any)}
                        />
                      );
                    })}
                </View>
              </>
            )}

            {/* Completed trackers summary */}
            {completedTrackers.length > 0 && (
              <View style={s.completedBanner}>
                <Ionicons name="checkmark-circle" size={14} color={DK.colors.success} />
                <Text style={s.completedBannerText}>{t('dk.money.completedCount', { count: completedTrackers.length, defaultValue: '{{count}} completed' }).toUpperCase()}</Text>
              </View>
            )}
          </>
        )}

        {tab === 'decisions' && (
          activeTrackers.length === 0 && completedTrackers.length === 0 ? (
            <Pressable
              style={s.emptyPanel}
              onPress={() => router.push('/(contractor)/decisions' as any)}
              accessibilityRole="button"
              accessibilityLabel={t('customers.openDecisions', 'Open decisions')}
            >
              <View style={s.emptyIcon}><Ionicons name="chatbubbles-outline" size={28} color={DK.colors.accent} /></View>
              <DKLabel style={s.emptyTitle}>{t('dk.empty.noTrackers', 'No trackers yet')}</DKLabel>
              <Text style={s.emptyDesc}>{t('customers.noTrackersDesc', 'Maak een tracker zodat klanten keuzes kunnen maken over materialen, afwerking en timing.')}</Text>
            </Pressable>
          ) : (
            <View style={s.trackerList}>
              {activeTrackers.map(tracker => {
                // Guard the zero case — a tracker created before any decisions
                // are added would render a NaN% progress bar.
                const pct = tracker.totalDecisions > 0
                  ? Math.round((tracker.decided / tracker.totalDecisions) * 100)
                  : 0;
                return (
                  <Pressable
                    key={tracker.id}
                    style={({ pressed }) => [s.trackerCard, pressed && { opacity: 0.95 }]}
                    onPress={() => router.push('/(contractor)/decisions' as any)}
                    accessibilityRole="button"
                    accessibilityLabel={t('customers.openTracker', { defaultValue: 'Open tracker for {{name}}', name: tracker.customerName })}
                  >
                    <View style={s.trackerHeader}>
                      <View style={s.trackerAvatar}>
                        <Text style={s.trackerAvatarText}>{tracker.customerName.charAt(0)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.trackerName}>{tracker.customerName}</Text>
                        <Text style={s.trackerProject}>{tracker.project}</Text>
                      </View>
                      <View style={s.trackerCount}>
                        <Text style={s.trackerCountText}>{tracker.decided}/{tracker.totalDecisions}</Text>
                      </View>
                    </View>
                    <View style={s.progressTrack}>
                      <LinearGradient
                        colors={[DK.colors.primary, DK.colors.accent]}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={[s.progressFill, { width: `${pct}%` as any }]}
                      />
                    </View>
                    <View style={s.trackerFooter}>
                      {tracker.overdue > 0 ? (
                        <View style={s.overduePill}>
                          <Ionicons name="alert-circle" size={11} color={DK.colors.danger} />
                          <Text style={s.overdueText}>{tracker.overdue} {t('dk.pill.overdue', 'Overdue').toUpperCase()}</Text>
                        </View>
                      ) : (
                        <DKLabel style={s.trackerTime}>{tracker.lastActivity}</DKLabel>
                      )}
                      <Pressable
                        style={s.reminderBtn}
                        onPress={() => handleSendReminder(tracker.id)}
                        accessibilityRole="button"
                        accessibilityLabel={t('customers.sendReminderTo', { defaultValue: 'Send reminder to {{name}}', name: tracker.customerName })}
                      >
                        <Ionicons name="paper-plane-outline" size={12} color={DK.colors.accent} />
                        <DKLabel style={s.reminderText}>{t('dk.actions.remind', 'Remind')}</DKLabel>
                      </Pressable>
                    </View>
                  </Pressable>
                );
              })}
              {completedTrackers.length > 0 && (
                <View style={s.completedBanner}>
                  <Ionicons name="checkmark-circle" size={14} color={DK.colors.success} />
                  <Text style={s.completedBannerText}>{t('dk.money.completedCount', { count: completedTrackers.length, defaultValue: '{{count}} completed' }).toUpperCase()}</Text>
                </View>
              )}
              <Pressable
                style={s.manageLink}
                onPress={() => router.push('/(contractor)/decisions' as any)}
                accessibilityRole="link"
                accessibilityLabel={`${t('dk.section.manageAll', 'Manage all')} ${t('dk.tabs.decisions', 'Decisions')}`}
              >
                <Text style={s.manageLinkText}>{t('dk.section.manageAll', 'Manage all').toUpperCase()} {t('dk.tabs.decisions', 'Decisions').toUpperCase()}</Text>
                <Ionicons name="chevron-forward" size={14} color={DK.colors.accent} />
              </Pressable>
            </View>
          )
        )}

        {tab === 'contacts' && (
          customers.length === 0 ? (
            <View style={s.emptyPanel}>
              <View style={s.emptyIcon}><Ionicons name="people-outline" size={28} color={DK.colors.accent} /></View>
              <DKLabel style={s.emptyTitle}>{t('dk.empty.noCustomers', 'No customers yet')}</DKLabel>
              <Text style={s.emptyDesc}>
                {t('dk.empty.noCustomersDesc', 'Customers fill in automatically when you add a quote — or add one manually now to track jobs and revenue per customer.')}
              </Text>
              <Pressable
                style={({ pressed }) => [s.emptyCta, pressed && { opacity: 0.85 }]}
                onPress={() => setShowAddModal(true)}
                accessibilityRole="button"
                accessibilityLabel={t('customers.addNew', 'Add new customer')}
              >
                <DKLabel style={s.emptyCtaText}>{t('dk.actions.newCustomer', 'New customer')}</DKLabel>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={s.customerCard}>
                <FlatList
                  data={customers.slice(0, 10)}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  renderItem={({ item: customer, index: idx }) => (
                    <CustomerRow
                      key={customer.id}
                      name={customer.name}
                      meta={`${customerJobs[customer.id] || 0} ${t('dk.pill.jobs', 'Jobs').toUpperCase()}${(customerRevenue[customer.id] || 0) > 0 ? ` · ${formatAmount(customerRevenue[customer.id])}` : ''}`}
                      onPress={() => router.push('/contractor/customer-crm' as any)}
                      borderBottom={idx < Math.min(customers.length, 10) - 1}
                      inCard
                    />
                  )}
                />
              </View>
              <Pressable style={s.manageLink} onPress={() => router.push('/contractor/customer-crm' as any)}>
                <Text style={s.manageLinkText}>{t('dk.section.viewAll', 'View all').toUpperCase()} {t('dk.tabs.contacts', 'Contacts').toUpperCase()}</Text>
                <Ionicons name="chevron-forward" size={14} color={DK.colors.accent} />
              </Pressable>
            </>
          )
        )}

        {/* R270: message-templates ingress consolidated to customer detail
            (next to smart-reply chips) — removed standalone link here. */}

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* ─── ADD CUSTOMER MODAL ─── */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={s.modalOverlay} onPress={() => setShowAddModal(false)}>
            <Pressable style={s.modalSheet} onPress={(e) => e.stopPropagation()}>
              <View style={s.modalHandle} />
              <DKLabel style={s.modalTitle}>{t('dk.actions.newCustomer', 'New customer')}</DKLabel>
              <TextInput style={s.modalInput} value={newName} onChangeText={setNewName} placeholder={t('customers.namePlaceholder', 'Customer name')} placeholderTextColor={DK.colors.textMuted} autoFocus />
              <TextInput style={s.modalInput} value={newEmail} onChangeText={setNewEmail} placeholder={t('customers.emailPlaceholder', 'Email')} placeholderTextColor={DK.colors.textMuted} keyboardType="email-address" autoCapitalize="none" />
              <TextInput style={s.modalInput} value={newPhone} onChangeText={setNewPhone} placeholder={t('customers.phonePlaceholder', 'Phone')} placeholderTextColor={DK.colors.textMuted} keyboardType="phone-pad" />
              <Pressable style={[s.modalSubmit, !newName.trim() && { opacity: 0.5 }]} onPress={handleAddCustomer} disabled={!newName.trim()}>
                <LinearGradient colors={[DK.colors.primaryDark, DK.colors.primary, DK.colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                <DKLabel style={s.modalSubmitText}>{t('dk.actions.addCustomer', 'Add customer')}</DKLabel>
              </Pressable>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────
type HeroFeature =
  | { type: 'urgent'; tracker: TrackerData }
  | { type: 'active'; tracker: TrackerData }
  | { type: 'topRevenue'; customer: { id: string; name: string }; revenue: number };

function HeroFeatureCard({ feature, onPress, onRemind }: { feature: HeroFeature; onPress: () => void; onRemind: (id: string) => void }) {
  const { t } = useTranslation();
  const isTracker = feature.type === 'urgent' || feature.type === 'active';
  const label = (feature.type === 'urgent' ? t('dk.hero.urgent', 'Urgent') : feature.type === 'active' ? t('dk.hero.topDecision', 'Top decision') : t('dk.hero.topCustomer', 'Top customer')).toUpperCase();
  const isUrgent = feature.type === 'urgent';
  const tone = isUrgent ? DK.colors.danger : DK.colors.highlight;
  const chipBg = isUrgent ? '#FFFFFF' : tone + '22';
  const chipBorder = isUrgent ? '#FFFFFF' : tone + '55';
  const chipTextColor = isUrgent ? DK.colors.bg : tone;
  return (
    <View style={heroStyles.wrap}>
      <LinearGradient
        colors={[DK.colors.primaryDark, DK.colors.primary, '#7C2D12']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={heroStyles.card}
      >
        <View style={[heroStyles.glow, { backgroundColor: tone }]} />
        <View style={[heroStyles.chip, { backgroundColor: chipBg, borderColor: chipBorder }, isUrgent && heroStyles.urgentChip]}>
          {isUrgent
            ? <View style={heroStyles.urgentDot} />
            : <Ionicons name="star" size={12} color={tone} />}
          <Text style={[heroStyles.chipText, { color: chipTextColor }]}>{label}</Text>
        </View>

        {isTracker ? (
          <>
            {/* Top-right stacked pills */}
            <View style={heroStyles.cornerPills}>
              <View style={[heroStyles.pill, heroStyles.pillDecided]}>
                <DKLabel style={heroStyles.pillLabel}>{t('dk.pill.decided', 'Decided')}</DKLabel>
                <Text style={[heroStyles.pillValue, { color: DK.colors.highlight }]}>{feature.tracker.decided}/{feature.tracker.totalDecisions}</Text>
              </View>
              {feature.tracker.overdue > 0 ? (
                <View style={[heroStyles.pill, heroStyles.pillOverdue]}>
                  <DKLabel style={heroStyles.pillLabel}>{t('dk.pill.overdue', 'Overdue')}</DKLabel>
                  <Text style={[heroStyles.pillValue, { color: '#FFFFFF' }]}>{feature.tracker.overdue}</Text>
                </View>
              ) : null}
            </View>

            <Text style={heroStyles.title} numberOfLines={2}>{feature.tracker.customerName}</Text>
            <Text style={heroStyles.subtitle} numberOfLines={1}>{feature.tracker.project}</Text>
            <View style={{ height: 20 }} />
            <View style={heroStyles.ctaRow}>
              <Pressable style={heroStyles.remindBtn} onPress={() => onRemind(feature.tracker.id)}>
                <Ionicons name="paper-plane-outline" size={14} color="#FFFFFF" />
                <DKLabel style={heroStyles.remindText}>{t('dk.actions.remind', 'Remind')}</DKLabel>
              </Pressable>
              <Pressable style={({ pressed }) => [heroStyles.openBtn, pressed && { opacity: 0.92 }]} onPress={onPress}>
                <DKLabel style={heroStyles.openText}>{t('dk.actions.open', 'Open')}</DKLabel>
                <Ionicons name="arrow-forward" size={14} color={DK.colors.bg} />
              </Pressable>
            </View>
          </>
        ) : (
          <>
            {/* Top-right revenue pill */}
            <View style={heroStyles.cornerPills}>
              <View style={[heroStyles.pill, heroStyles.pillDecided]}>
                <DKLabel style={heroStyles.pillLabel}>{t('dk.pill.revenue', 'Revenue')}</DKLabel>
                <Text style={[heroStyles.pillValue, { color: DK.colors.success }]}>{formatAmount(feature.revenue)}</Text>
              </View>
            </View>

            <Text style={heroStyles.title} numberOfLines={2}>{feature.customer.name}</Text>
            <View style={{ height: 20 }} />
            <Pressable style={({ pressed }) => [heroStyles.openBtn, pressed && { opacity: 0.92 }]} onPress={onPress}>
              <DKLabel style={heroStyles.openText}>{t('dk.actions.openCustomer', 'Open customer')}</DKLabel>
              <Ionicons name="arrow-forward" size={14} color={DK.colors.bg} />
            </Pressable>
          </>
        )}
      </LinearGradient>
    </View>
  );
}

function KpiTile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <View style={s.kpiTile}>
      {/* Long labels ("BESLISSINGEN") were wrapping mid-word to "BESLISSING /
          EN" in these narrow tiles. Shrink to fit on one line instead. */}
      <Text style={s.kpiLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {label}
      </Text>
      <Text style={[s.kpiValue, { color: tone }]}>{value}</Text>
    </View>
  );
}

function CustomerRow({ name, meta, onPress, borderBottom, inCard }: { name: string; meta?: string; onPress: () => void; borderBottom?: boolean; inCard?: boolean }) {
  return (
    <Pressable
      style={({ pressed }) => [
        inCard ? s.customerRowInCard : s.customerRow,
        borderBottom && s.customerBorder,
        pressed && { backgroundColor: DK.colors.panel2 },
      ]}
      onPress={onPress}
    >
      <View style={s.customerAvatar}>
        <DKLabel style={s.customerAvatarText}>{name.charAt(0)}</DKLabel>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.customerName} numberOfLines={1}>{name}</Text>
        {meta ? <Text style={s.customerMeta}>{meta}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={14} color={DK.colors.textMuted} />
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
  subtitle: { fontFamily: DK.type.display800, fontSize: 11, color: DK.colors.textMuted, letterSpacing: 1.3, marginTop: 3 },
  addBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: DK.colors.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
  },

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

  // KPI
  kpiRow: { flexDirection: 'row', gap: 8 },
  kpiTile: {
    flex: 1,
    backgroundColor: DK.colors.panel,
    borderRadius: DK.radius.card,
    borderWidth: 1, borderColor: DK.colors.border,
    padding: 14, minHeight: 82,
    justifyContent: 'space-between',
  },
  kpiLabel: { fontFamily: DK.type.display800, fontSize: 10, color: DK.colors.textMuted, letterSpacing: 1.3 },
  kpiValue: { fontFamily: DK.type.display900, fontSize: 28, letterSpacing: -0.8, lineHeight: 30 },

  listGroup: { gap: 8 },

  // Tracker list
  trackerList: { gap: 8 },
  trackerCard: {
    backgroundColor: DK.colors.panel,
    borderRadius: DK.radius.card,
    borderWidth: 1, borderColor: DK.colors.border,
    padding: 14, gap: 10,
  },
  trackerHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  trackerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: DK.colors.accent + '1A', alignItems: 'center', justifyContent: 'center' },
  trackerAvatarText: { fontFamily: DK.type.display900, fontSize: 14, color: DK.colors.accent },
  trackerName: { fontFamily: DK.type.display800, fontSize: 14, color: DK.colors.text },
  trackerProject: { fontFamily: DK.type.body400, fontSize: 12, color: DK.colors.textMuted, marginTop: 2 },
  trackerCount: { backgroundColor: DK.colors.panel2, borderRadius: DK.radius.chip, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: DK.colors.border },
  trackerCountText: { fontFamily: DK.type.display900, fontSize: 12, color: DK.colors.text },

  progressTrack: { height: 6, backgroundColor: DK.colors.panel2, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%' },

  trackerFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  trackerTime: { fontFamily: DK.type.display800, fontSize: 10, color: DK.colors.textMuted, letterSpacing: 1.1 },
  overduePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 8, borderRadius: DK.radius.chip, backgroundColor: DK.colors.danger + '1A', borderWidth: 1, borderColor: DK.colors.danger + '55' },
  overdueText: { fontFamily: DK.type.display900, fontSize: 10, color: DK.colors.danger, letterSpacing: 0.8 },
  reminderBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 8, borderRadius: DK.radius.chip, backgroundColor: DK.colors.accent + '14', borderWidth: 1, borderColor: DK.colors.accent + '44' },
  reminderText: { fontFamily: DK.type.display800, fontSize: 10, color: DK.colors.accent, letterSpacing: 0.8 },

  // Completed banner
  completedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: DK.radius.chip,
    backgroundColor: DK.colors.success + '14',
    borderWidth: 1, borderColor: DK.colors.success + '44',
    alignSelf: 'flex-start',
  },
  completedBannerText: { fontFamily: DK.type.display800, fontSize: 11, color: DK.colors.success, letterSpacing: 1.1 },

  // Customer list
  customerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12,
    backgroundColor: DK.colors.panel,
    borderRadius: DK.radius.card,
    borderWidth: 1, borderColor: DK.colors.border,
  },
  customerRowInCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14,
  },
  customerCard: {
    backgroundColor: DK.colors.panel,
    borderRadius: DK.radius.card,
    borderWidth: 1, borderColor: DK.colors.border,
    overflow: 'hidden',
  },
  customerBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DK.colors.border },
  customerAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: DK.colors.accent + '1A', alignItems: 'center', justifyContent: 'center' },
  customerAvatarText: { fontFamily: DK.type.display900, fontSize: 12, color: DK.colors.accent },
  customerName: { fontFamily: DK.type.display800, fontSize: 13, color: DK.colors.text },
  customerMeta: { fontFamily: DK.type.display800, fontSize: 10, color: DK.colors.textMuted, marginTop: 2, letterSpacing: 0.8 },

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
  emptyCta: { marginTop: 8, paddingVertical: 10, paddingHorizontal: 20, borderRadius: DK.radius.chip, backgroundColor: DK.colors.accent + '14', borderWidth: 1, borderColor: DK.colors.accent + '44' },
  emptyCtaText: { fontFamily: DK.type.display800, fontSize: 11, color: DK.colors.accent, letterSpacing: 1.2 },

  manageLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10,
  },
  manageLinkText: { fontFamily: DK.type.display800, fontSize: 11, color: DK.colors.accent, letterSpacing: 1.2 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: DK.colors.panel,
    borderTopLeftRadius: DK.radius.card, borderTopRightRadius: DK.radius.card,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: DK.colors.border,
    padding: 20, paddingBottom: 40, gap: 10,
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: DK.colors.border, alignSelf: 'center', marginBottom: 8 },
  modalTitle: { fontFamily: DK.type.display900, fontSize: 16, color: DK.colors.text, letterSpacing: 1.8 },
  modalInput: {
    backgroundColor: DK.colors.panel2,
    borderRadius: DK.radius.button,
    borderWidth: 1, borderColor: DK.colors.border,
    paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 15,
    fontFamily: DK.type.body500,
    color: DK.colors.text,
  },
  modalSubmit: {
    borderRadius: DK.radius.button,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: 4,
  },
  modalSubmitText: { fontFamily: DK.type.display900, fontSize: 13, color: '#FFFFFF', letterSpacing: 1.4 },
});

const heroStyles = StyleSheet.create({
  wrap: {
    borderRadius: DK.radius.card,
    shadowColor: DK.colors.accent, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 8,
  },
  card: {
    borderRadius: DK.radius.card,
    padding: 14,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: -50, right: -50,
    width: 140, height: 140,
    borderRadius: 70,
    opacity: 0.15,
  },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 3, paddingHorizontal: 8,
    borderRadius: DK.radius.chip,
    borderWidth: 1,
    marginBottom: 8,
  },
  urgentChip: {
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
    paddingVertical: 4, paddingHorizontal: 10,
  },
  urgentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: DK.colors.danger },
  chipText: { fontFamily: DK.type.display900, fontSize: 9, letterSpacing: 1.4 },
  title: {
    fontFamily: DK.type.display900,
    fontSize: 17,
    color: '#FFFFFF',
    letterSpacing: -0.3,
    lineHeight: 21,
    paddingRight: 90,
  },
  subtitle: {
    fontFamily: DK.type.body500,
    fontSize: 12,
    color: '#FFFFFFCC',
    marginTop: 2,
  },
  cornerPills: {
    position: 'absolute',
    top: 12, right: 12,
    alignItems: 'flex-end',
    gap: 4,
    zIndex: 2,
  },
  pill: {
    paddingVertical: 4, paddingHorizontal: 8,
    borderRadius: DK.radius.chip,
    borderWidth: 1,
    alignItems: 'flex-end',
    minWidth: 64,
  },
  pillDecided: {
    backgroundColor: DK.colors.highlight,
    borderColor: DK.colors.highlight,
    shadowColor: DK.colors.highlight,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  pillOverdue: {
    backgroundColor: DK.colors.danger,
    borderColor: DK.colors.danger,
    shadowColor: DK.colors.danger,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  pillLabel: {
    fontFamily: DK.type.display800,
    fontSize: 8,
    color: '#0B0E11CC',
    letterSpacing: 1.2,
  },
  pillValue: {
    fontFamily: DK.type.display900,
    fontSize: 12,
    marginTop: 1,
    letterSpacing: -0.2,
  },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  remindBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 9, paddingHorizontal: 10,
    borderRadius: DK.radius.button,
    backgroundColor: '#0B0E1177',
    borderWidth: 1, borderColor: '#FFFFFF22',
  },
  remindText: { fontFamily: DK.type.display800, fontSize: 10, color: '#FFFFFF', letterSpacing: 1 },
  openBtn: {
    flex: 1,
    flexShrink: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6,
    paddingVertical: 10, paddingHorizontal: 8,
    borderRadius: DK.radius.button,
    backgroundColor: '#FFFFFF',
    minWidth: 0,
  },
  openText: { fontFamily: DK.type.display900, fontSize: 11, color: DK.colors.bg, letterSpacing: 1, flexShrink: 1 },
});

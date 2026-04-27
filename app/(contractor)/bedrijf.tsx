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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DK } from '../../src/theme/draftkings';
import { useAppState } from '../../src/state/AppState';
import { hapticSuccess } from '../../src/utils/haptics';
import { recordScreenVisit } from '../../src/intelligence/learningStorage';
import { SkeletonList } from '../../src/components/shared/SkeletonList';
import { formatAmount } from '../../src/utils/formatAmount';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DKLabel } from '../../src/components/shared/DKLabel';

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

const SEED_TRACKERS: TrackerData[] = [
  { id: 'tr-1', customerName: 'Fam. de Vries', project: 'Badkamer renovatie', totalDecisions: 15, decided: 9, overdue: 2, lastActivity: '2h ago' },
  { id: 'tr-2', customerName: 'Bakkerij Jansen', project: 'Elektra kantoor', totalDecisions: 8, decided: 3, overdue: 0, lastActivity: '1d ago' },
  { id: 'tr-3', customerName: 'Van Dam Advocaten', project: 'Schilderwerk', totalDecisions: 6, decided: 6, overdue: 0, lastActivity: '3d ago' },
];

export default function BedrijfScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const { customers, invoices, jobs, addCustomer, isLoading } = useAppState();
  const [trackers, setTrackers] = useState<TrackerData[]>([]);
  const [tab, setTab] = useState<TabKey>('overview');

  useEffect(() => { recordScreenVisit('klanten'); }, []);

  useEffect(() => {
    AsyncStorage.getItem(TRACKER_STORAGE_KEY).then(raw => {
      if (raw) {
        const parsed = JSON.parse(raw);
        setTrackers(Array.isArray(parsed) && parsed.length > 0 ? parsed : SEED_TRACKERS);
      } else {
        setTrackers(SEED_TRACKERS);
        AsyncStorage.setItem(TRACKER_STORAGE_KEY, JSON.stringify(SEED_TRACKERS)).catch(() => {});
      }
    }).catch(() => setTrackers(SEED_TRACKERS));
  }, []);

  useEffect(() => {
    if (trackers.length > 0) AsyncStorage.setItem(TRACKER_STORAGE_KEY, JSON.stringify(trackers)).catch(() => {});
  }, [trackers]);

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
    const map: Record<string, number> = {};
    invoices.forEach((inv: any) => {
      if (inv.status === 'paid' && inv.customerId) map[inv.customerId] = (map[inv.customerId] || 0) + (inv.amount || 0);
    });
    return map;
  }, [invoices]);

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
    { key: 'decisions', label: t('dk.tabs.decisions', 'Decisions').toUpperCase(), count: activeTrackers.length },
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
          <Pressable style={({ pressed }) => [s.addBtn, pressed && { opacity: 0.9 }]} onPress={() => setShowAddModal(true)}>
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

            {/* Top 3 customers by revenue */}
            {customers.length > 0 && (
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
            <Pressable style={s.emptyPanel} onPress={() => router.push('/(contractor)/decisions' as any)}>
              <View style={s.emptyIcon}><Ionicons name="chatbubbles-outline" size={28} color={DK.colors.accent} /></View>
              <DKLabel style={s.emptyTitle}>{t('dk.empty.noTrackers', 'No trackers yet')}</DKLabel>
              <Text style={s.emptyDesc}>{t('customers.noTrackersDesc', 'Maak een tracker zodat klanten keuzes kunnen maken over materialen, afwerking en timing.')}</Text>
            </Pressable>
          ) : (
            <View style={s.trackerList}>
              {activeTrackers.map(tracker => {
                const pct = Math.round((tracker.decided / tracker.totalDecisions) * 100);
                return (
                  <Pressable
                    key={tracker.id}
                    style={({ pressed }) => [s.trackerCard, pressed && { opacity: 0.95 }]}
                    onPress={() => router.push('/(contractor)/decisions' as any)}
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
                      <Pressable style={s.reminderBtn} onPress={() => handleSendReminder(tracker.id)}>
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
              <Pressable style={s.manageLink} onPress={() => router.push('/(contractor)/decisions' as any)}>
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
              <Pressable style={({ pressed }) => [s.emptyCta, pressed && { opacity: 0.85 }]} onPress={() => setShowAddModal(true)}>
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
      <Text style={s.kpiLabel}>{label}</Text>
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
    opacity: 0.18,
  },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 4, paddingHorizontal: 10,
    borderRadius: DK.radius.chip,
    borderWidth: 1,
    marginBottom: 12,
  },
  urgentChip: {
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 6,
    paddingVertical: 5, paddingHorizontal: 12,
  },
  urgentDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: DK.colors.danger },
  chipText: { fontFamily: DK.type.display900, fontSize: 10, letterSpacing: 1.5 },
  title: {
    fontFamily: DK.type.display900,
    fontSize: 22,
    color: '#FFFFFF',
    letterSpacing: -0.5,
    lineHeight: 26,
  },
  subtitle: {
    fontFamily: DK.type.body500,
    fontSize: 13,
    color: '#FFFFFFCC',
    marginTop: 4,
  },
  // Top-right stacked pills (visually distinct, unbunched, positioned away from title)
  cornerPills: {
    position: 'absolute',
    top: 16, right: 16,
    alignItems: 'flex-end',
    gap: 6,
    zIndex: 2,
  },
  pill: {
    paddingVertical: 5, paddingHorizontal: 10,
    borderRadius: DK.radius.chip,
    borderWidth: 1,
    alignItems: 'flex-end',
    minWidth: 72,
  },
  pillDecided: {
    backgroundColor: DK.colors.highlight,
    borderColor: DK.colors.highlight,
    shadowColor: DK.colors.highlight,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 5,
  },
  pillOverdue: {
    backgroundColor: DK.colors.danger,
    borderColor: DK.colors.danger,
    shadowColor: DK.colors.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 6,
  },
  pillLabel: {
    fontFamily: DK.type.display800,
    fontSize: 8,
    color: '#0B0E11CC',
    letterSpacing: 1.3,
  },
  pillValue: {
    fontFamily: DK.type.display900,
    fontSize: 13,
    marginTop: 1,
    letterSpacing: -0.2,
  },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  remindBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: DK.radius.button,
    backgroundColor: '#0B0E1177',
    borderWidth: 1, borderColor: '#FFFFFF22',
  },
  remindText: { fontFamily: DK.type.display800, fontSize: 11, color: '#FFFFFF', letterSpacing: 1.1 },
  openBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: DK.radius.button,
    backgroundColor: '#FFFFFF',
  },
  openText: { fontFamily: DK.type.display900, fontSize: 13, color: DK.colors.bg, letterSpacing: 1.2 },
});

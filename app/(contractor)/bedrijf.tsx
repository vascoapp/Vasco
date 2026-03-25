// =============================================================================
// KLANTEN — Customer Hub with Decision Trackers
// =============================================================================
// 5th tab. Vertical layout: KPIs → Decision trackers → Customer list
// No horizontal scrolling — everything stacks vertically for reliability.
// =============================================================================

import { useCallback, useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, TextInput, Modal, KeyboardAvoidingView, Platform, Share, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { SafeArea } from '../../src/theme/spacing';
import { PAGE_BG, TYPE, GRID, RADIUS } from '../../src/theme/tabStyles';
import { useAppState } from '../../src/state/AppState';
import { hapticSuccess } from '../../src/utils/haptics';
import { recordScreenVisit } from '../../src/intelligence/learningStorage';
import { FadeIn } from '../../src/components/shared/FadeIn';
import { formatAmount } from '../../src/utils/formatAmount';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TRACKER_STORAGE_KEY = '@vasco_decision_trackers';

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
  const { customers, invoices, jobs, addCustomer } = useAppState();

  useEffect(() => { recordScreenVisit('klanten'); }, []);

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

  // Decision trackers
  const [trackers, setTrackers] = useState<TrackerData[]>([]);
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

  const handleSendReminder = useCallback(async (trackerId: string) => {
    try {
      await Share.share({ message: t('customers.reminderMessage', 'Hi, could you review the pending decisions for your project? This helps us stay on schedule.') });
      setTrackers(prev => prev.map(tr => tr.id === trackerId ? { ...tr, lastActivity: 'Just now' } : tr));
      hapticSuccess();
    } catch { /* cancelled */ }
  }, [t]);

  // Customer stats
  const customerRevenue = useMemo(() => {
    const map: Record<string, number> = {};
    invoices.forEach((inv: any) => {
      if (inv.status === 'paid' && inv.customerId) map[inv.customerId] = (map[inv.customerId] || 0) + (inv.amount || 0);
    });
    return map;
  }, [invoices]);

  const customerJobs = useMemo(() => {
    const map: Record<string, number> = {};
    jobs.forEach((j: any) => {
      if (j.customerId) map[j.customerId] = (map[j.customerId] || 0) + 1;
    });
    return map;
  }, [jobs]);

  const totalRevenue = useMemo(() => Object.values(customerRevenue).reduce((s, v) => s + v, 0), [customerRevenue]);
  const activeTrackers = trackers.filter(tr => tr.decided < tr.totalDecisions);
  const completedTrackers = trackers.filter(tr => tr.decided >= tr.totalDecisions);
  const totalOverdue = trackers.reduce((s, tr) => s + tr.overdue, 0);

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>{t('tabs.customers', 'Klanten')}</Text>
          <Text style={s.headerSub}>{customers.length} {t('customers.contacts', 'contacts')} · {formatAmount(totalRevenue)}</Text>
        </View>
        <Pressable style={({ pressed }) => [s.addBtn, pressed && { opacity: 0.8 }]} onPress={() => setShowAddModal(true)}>
          <Ionicons name="person-add" size={15} color="#fff" />
        </Pressable>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.hermesOrange} />}
      >
        {/* KPI strip */}
        <FadeIn delay={0} duration={300}>
          <View style={s.kpiStrip}>
            <View style={s.kpi}>
              <Text style={s.kpiValue}>{customers.length}</Text>
              <Text style={s.kpiLabel}>{t('customers.contacts', 'Contacts')}</Text>
            </View>
            <View style={s.kpiDivider} />
            <View style={s.kpi}>
              <Text style={s.kpiValue}>{activeTrackers.length}</Text>
              <Text style={s.kpiLabel}>{t('customers.activeDecisions', 'Active decisions')}</Text>
            </View>
            <View style={s.kpiDivider} />
            <View style={s.kpi}>
              <Text style={[s.kpiValue, totalOverdue > 0 && { color: SemanticColors.feedbackError }]}>{totalOverdue}</Text>
              <Text style={s.kpiLabel}>{t('customers.overdue', 'Overdue')}</Text>
            </View>
          </View>
        </FadeIn>

        {/* Decision Trackers — vertical cards */}
        <FadeIn delay={100} duration={400}>
          <View style={s.section}>
            <View style={s.sectionRow}>
              <Text style={s.sectionTitle}>{t('customers.decisions', 'Decisions')}</Text>
              <Pressable onPress={() => router.push('/(contractor)/decisions' as any)}>
                <Text style={s.sectionLink}>{t('customers.manage', 'Manage')}</Text>
              </Pressable>
            </View>

            {activeTrackers.length === 0 && completedTrackers.length === 0 ? (
              <Pressable style={s.emptyCard} onPress={() => router.push('/(contractor)/decisions' as any)}>
                <Ionicons name="chatbubbles-outline" size={32} color={Palette.hermesOrange} />
                <Text style={s.emptyTitle}>{t('customers.noTrackers', 'No decision trackers yet')}</Text>
                <Text style={s.emptyDesc}>{t('customers.noTrackersDesc', 'Create a tracker so customers can make choices about materials, finishes, and timing — keeping your project on schedule.')}</Text>
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

                      {/* Progress bar */}
                      <View style={s.progressTrack}>
                        <View style={[s.progressFill, { width: `${pct}%` }]} />
                      </View>

                      <View style={s.trackerFooter}>
                        {tracker.overdue > 0 ? (
                          <View style={s.overduePill}>
                            <Ionicons name="alert-circle" size={12} color={SemanticColors.feedbackError} />
                            <Text style={s.overdueText}>{tracker.overdue} {t('customers.overdueItems', 'overdue')}</Text>
                          </View>
                        ) : (
                          <Text style={s.trackerTime}>{tracker.lastActivity}</Text>
                        )}
                        <Pressable style={s.reminderBtn} onPress={() => handleSendReminder(tracker.id)}>
                          <Ionicons name="paper-plane-outline" size={13} color={Palette.hermesOrange} />
                          <Text style={s.reminderText}>{t('customers.nudge', 'Nudge')}</Text>
                        </Pressable>
                      </View>
                    </Pressable>
                  );
                })}

                {completedTrackers.length > 0 && (
                  <View style={s.completedRow}>
                    <Ionicons name="checkmark-circle" size={15} color={SemanticColors.feedbackSuccess} />
                    <Text style={s.completedText}>{completedTrackers.length} {t('customers.completed', 'completed')}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </FadeIn>

        {/* Customer List */}
        <FadeIn delay={200} duration={400}>
          <View style={s.section}>
            <View style={s.sectionRow}>
              <Text style={s.sectionTitle}>{t('customers.allContacts', 'All contacts')}</Text>
              <Pressable onPress={() => router.push('/contractor/customer-crm' as any)}>
                <Text style={s.sectionLink}>{t('common.viewAll', 'View all')}</Text>
              </Pressable>
            </View>

            <View style={s.customerCard}>
              {customers.length === 0 ? (
                <View style={s.noCustomers}>
                  <Ionicons name="people-outline" size={28} color={SemanticColors.textTertiary} />
                  <Text style={s.noCustomersText}>{t('customers.emptyTitle', 'No customers yet')}</Text>
                </View>
              ) : (
                customers.slice(0, 6).map((customer, idx) => (
                  <Pressable
                    key={customer.id}
                    style={({ pressed }) => [s.customerRow, idx < Math.min(customers.length, 6) - 1 && s.customerBorder, pressed && { backgroundColor: PAGE_BG }]}
                    onPress={() => router.push('/contractor/customer-crm' as any)}
                  >
                    <View style={s.customerAvatar}>
                      <Text style={s.customerAvatarText}>{customer.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.customerName} numberOfLines={1}>{customer.name}</Text>
                      <Text style={s.customerMeta}>
                        {customerJobs[customer.id] || 0} {t('customers.jobsLabel', 'jobs')}
                        {(customerRevenue[customer.id] || 0) > 0 && ` · ${formatAmount(customerRevenue[customer.id])}`}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={SemanticColors.textTertiary} />
                  </Pressable>
                ))
              )}
            </View>
          </View>
        </FadeIn>

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* Add Customer Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={s.modalOverlay} onPress={() => setShowAddModal(false)}>
            <Pressable style={s.modalSheet} onPress={(e) => e.stopPropagation()}>
              <View style={s.modalHandle} />
              <Text style={s.modalTitle}>{t('customers.newCustomer', 'New customer')}</Text>
              <TextInput style={s.modalInput} value={newName} onChangeText={setNewName} placeholder={t('customers.namePlaceholder', 'Customer name')} placeholderTextColor={SemanticColors.textTertiary} autoFocus />
              <TextInput style={s.modalInput} value={newEmail} onChangeText={setNewEmail} placeholder={t('customers.emailPlaceholder', 'Email')} placeholderTextColor={SemanticColors.textTertiary} keyboardType="email-address" autoCapitalize="none" />
              <TextInput style={s.modalInput} value={newPhone} onChangeText={setNewPhone} placeholder={t('customers.phonePlaceholder', 'Phone')} placeholderTextColor={SemanticColors.textTertiary} keyboardType="phone-pad" />
              <Pressable style={[s.modalSubmit, !newName.trim() && { opacity: 0.5 }]} onPress={handleAddCustomer} disabled={!newName.trim()}>
                <Text style={s.modalSubmitText}>{t('customers.addBtn', 'Add customer')}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: SafeArea.top, paddingHorizontal: SafeArea.side, paddingBottom: GRID.sm,
    backgroundColor: PAGE_BG,
  },
  headerTitle: { fontSize: TYPE.displaySize, fontFamily: TYPE.displayFamily, color: SemanticColors.textPrimary, letterSpacing: TYPE.displayTracking },
  headerSub: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary, marginTop: 2 },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Palette.hermesOrange, alignItems: 'center', justifyContent: 'center' },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: SafeArea.side, paddingTop: GRID.sm, gap: GRID.lg },

  // KPI strip
  kpiStrip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, padding: GRID.md,
  },
  kpi: { flex: 1, alignItems: 'center' },
  kpiValue: { fontSize: 22, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary },
  kpiLabel: { fontSize: TYPE.tinySize, fontFamily: TYPE.tinyFamily, color: SemanticColors.textSecondary, marginTop: 2 },
  kpiDivider: { width: 1, height: 28, backgroundColor: SemanticColors.borderDefault },

  // Section
  section: { gap: GRID.sm },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary, letterSpacing: TYPE.sectionTracking },
  sectionLink: { fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: Palette.hermesOrange },

  // Tracker list — VERTICAL (no horizontal scroll)
  trackerList: { gap: GRID.sm },
  trackerCard: {
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, padding: GRID.md,
    gap: GRID.sm,
  },
  trackerHeader: { flexDirection: 'row', alignItems: 'center', gap: GRID.sm },
  trackerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Palette.hermesOrange + '12', alignItems: 'center', justifyContent: 'center' },
  trackerAvatarText: { fontSize: TYPE.titleSize, fontFamily: TYPE.sectionFamily, color: Palette.hermesOrange },
  trackerName: { fontSize: TYPE.titleSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  trackerProject: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary },
  trackerCount: { backgroundColor: PAGE_BG, borderRadius: RADIUS.sm, paddingHorizontal: GRID.sm, paddingVertical: GRID.xs },
  trackerCountText: { fontSize: TYPE.titleSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary },

  // Progress
  progressTrack: { height: 4, backgroundColor: SemanticColors.borderDefault, borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: Palette.hermesOrange, borderRadius: 2 },

  // Tracker footer
  trackerFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  trackerTime: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textTertiary },
  overduePill: { flexDirection: 'row', alignItems: 'center', gap: GRID.xs, backgroundColor: SemanticColors.feedbackError + '10', paddingHorizontal: GRID.sm, paddingVertical: GRID.xs, borderRadius: RADIUS.sm },
  overdueText: { fontSize: TYPE.tinySize, fontFamily: TYPE.titleFamily, color: SemanticColors.feedbackError },
  reminderBtn: { flexDirection: 'row', alignItems: 'center', gap: GRID.xs },
  reminderText: { fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: Palette.hermesOrange },

  // Completed
  completedRow: { flexDirection: 'row', alignItems: 'center', gap: GRID.sm, paddingVertical: GRID.xs },
  completedText: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary },

  // Empty
  emptyCard: {
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, padding: GRID.lg,
    alignItems: 'center', gap: GRID.sm,
  },
  emptyTitle: { fontSize: TYPE.titleSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary, textAlign: 'center' },
  emptyDesc: { fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textSecondary, textAlign: 'center', lineHeight: 22 },

  // Customer list
  customerCard: { backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, overflow: 'hidden' },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: GRID.sm, padding: GRID.md },
  customerBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SemanticColors.borderDefault },
  customerAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Palette.hermesOrange + '10', alignItems: 'center', justifyContent: 'center' },
  customerAvatarText: { fontSize: TYPE.captionSize, fontFamily: TYPE.sectionFamily, color: Palette.hermesOrange },
  customerName: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  customerMeta: { fontSize: TYPE.tinySize, fontFamily: TYPE.captionFamily, color: SemanticColors.textTertiary, marginTop: 1 },
  noCustomers: { padding: GRID.lg, alignItems: 'center', gap: GRID.sm },
  noCustomersText: { fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textTertiary },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: SemanticColors.surfacePrimary, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: GRID.lg, paddingBottom: 40, gap: GRID.sm },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: SemanticColors.borderDefault, alignSelf: 'center', marginBottom: GRID.sm },
  modalTitle: { fontSize: TYPE.sectionSize + 2, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary },
  modalInput: { backgroundColor: PAGE_BG, borderRadius: RADIUS.md, paddingHorizontal: GRID.md, paddingVertical: GRID.sm + 4, fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textPrimary },
  modalSubmit: { backgroundColor: Palette.hermesOrange, borderRadius: RADIUS.md, paddingVertical: GRID.md, alignItems: 'center' },
  modalSubmitText: { fontSize: TYPE.titleSize, fontFamily: TYPE.titleFamily, color: '#fff' },
});

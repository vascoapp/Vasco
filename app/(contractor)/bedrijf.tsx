// =============================================================================
// KLANTEN — Customer & Decision Tracker Hub
// =============================================================================
// Core value: customer makes decisions → contractor plans + purchases → no delays
// Active trackers are FRONT AND CENTER — zero friction to see status
// =============================================================================

import { useCallback, useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, TextInput, Modal, KeyboardAvoidingView, Platform, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { PAGE_BG } from '../../src/theme/tabStyles';
import { useAppState } from '../../src/state/AppState';
import { hapticSuccess } from '../../src/utils/haptics';
import { recordScreenVisit } from '../../src/intelligence/learningStorage';
import { FadeIn } from '../../src/components/shared/FadeIn';
import { formatCurrency } from '../../src/i18n/formatting';
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
  { id: 'tr-1', customerName: 'Familie de Vries', project: 'Badkamer renovatie', totalDecisions: 15, decided: 9, overdue: 2, lastActivity: '2 uur geleden' },
  { id: 'tr-2', customerName: 'Bakkerij Jansen', project: 'Elektra kantoor', totalDecisions: 8, decided: 3, overdue: 0, lastActivity: '1 dag geleden' },
  { id: 'tr-3', customerName: 'Van Dam Advocaten', project: 'Schilderwerk', totalDecisions: 6, decided: 6, overdue: 0, lastActivity: '3 dagen geleden' },
];

export default function BedrijfScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const { customers, invoices, quotes, addCustomer } = useAppState();

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

  // Live tracker state so we can update lastActivity after sharing
  const [trackers, setTrackers] = useState<TrackerData[]>([]);

  // Load trackers from AsyncStorage, seed if empty
  useEffect(() => {
    AsyncStorage.getItem(TRACKER_STORAGE_KEY).then(raw => {
      if (raw) {
        setTrackers(JSON.parse(raw));
      } else {
        setTrackers(SEED_TRACKERS);
        AsyncStorage.setItem(TRACKER_STORAGE_KEY, JSON.stringify(SEED_TRACKERS)).catch(() => {});
      }
    }).catch(() => setTrackers(SEED_TRACKERS));
  }, []);

  // Persist on change
  useEffect(() => {
    if (trackers.length > 0) {
      AsyncStorage.setItem(TRACKER_STORAGE_KEY, JSON.stringify(trackers)).catch(() => {});
    }
  }, [trackers]);

  const handleSendReminder = useCallback(async (trackerId: string, customerName: string) => {
    try {
      await Share.share({
        message: `Hoi, er staan nog open keuzes voor je project. Bekijk ze hier: https://vasco.app/c/demo`,
        title: 'Herinnering',
      });
      // Update lastActivity to "Nu" after sharing
      setTrackers(prev =>
        prev.map(tr => tr.id === trackerId ? { ...tr, lastActivity: 'Nu' } : tr)
      );
      hapticSuccess();
    } catch (_) {
      // User cancelled the share sheet — no action needed
    }
  }, []);

  // Task 3: Customer lifetime value — total paid invoices per customer
  const customerRevenueLookup = useMemo(() => {
    const map: Record<string, number> = {};
    invoices.forEach((inv: any) => {
      if (inv.status === 'paid' && inv.customer) {
        map[inv.customer] = (map[inv.customer] || 0) + (inv.amount || 0);
      }
    });
    return map;
  }, [invoices]);

  // Active trackers with pending decisions
  const activeTrackers = trackers.filter(tr => tr.decided < tr.totalDecisions);
  const completedTrackers = trackers.filter(tr => tr.decided >= tr.totalDecisions);
  const totalOverdue = trackers.reduce((s, tr) => s + tr.overdue, 0);

  // Recent customers for the bottom section
  const recentCustomers = useMemo(() => customers.slice(0, 4), [customers]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('tabs.customers', 'Klanten')}</Text>
        <Pressable
          style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.7 }]}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="person-add" size={16} color="#fff" />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.hermesOrange} />}
      >
        {/* ============================================================ */}
        {/* ACTIVE TRACKERS — the core of this screen, zero clicks away */}
        {/* ============================================================ */}

        {totalOverdue > 0 && (
          <FadeIn delay={0} duration={300}>
            <View style={styles.urgentBanner}>
              <Ionicons name="alert-circle" size={18} color={SemanticColors.feedbackError} />
              <Text style={styles.urgentText}>
                {totalOverdue} beslissing{totalOverdue !== 1 ? 'en' : ''} achterstallig — klant herinneren
              </Text>
            </View>
          </FadeIn>
        )}

        <FadeIn delay={50} duration={400}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Actieve trackers</Text>
              <Pressable onPress={() => router.push('/(contractor)/decisions' as any)}>
                <Text style={styles.seeAll}>Nieuw +</Text>
              </Pressable>
            </View>

            {activeTrackers.length === 0 ? (
              <Pressable
                style={styles.emptyTrackerCard}
                onPress={() => router.push('/(contractor)/decisions' as any)}
              >
                <Ionicons name="git-compare-outline" size={28} color={Palette.hermesOrange} />
                <Text style={styles.emptyTitle}>Geen actieve beslissingentrackers</Text>
                <Text style={styles.emptyDesc}>Start een tracker zodat klanten keuzes kunnen maken voor materialen, kleuren en planning</Text>
              </Pressable>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={280 + 10}
                decelerationRate="fast"
                contentContainerStyle={{ gap: 10, paddingRight: 20 }}
              >
                {activeTrackers.map((tracker) => {
                  const progress = Math.round((tracker.decided / tracker.totalDecisions) * 100);
                  return (
                    <Pressable
                      key={tracker.id}
                      style={({ pressed }) => [styles.trackerCard, { width: 280 }, pressed && { opacity: 0.9 }]}
                      onPress={() => router.push('/(contractor)/decisions' as any)}
                    >
                      {/* Progress bar */}
                      <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${progress}%` }]} />
                      </View>

                      <View style={styles.trackerRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.trackerCustomer}>{tracker.customerName}</Text>
                          <Text style={styles.trackerProject}>{tracker.project}</Text>
                          {(customerRevenueLookup[tracker.customerName] || 0) > 0 && (
                            <Text style={styles.trackerRevenue}>{formatCurrency(customerRevenueLookup[tracker.customerName])} omzet</Text>
                          )}
                        </View>
                        <View style={styles.trackerStats}>
                          <Text style={styles.trackerProgress}>{tracker.decided}/{tracker.totalDecisions}</Text>
                          {tracker.overdue > 0 && (
                            <View style={styles.overdueBadge}>
                              <Text style={styles.overdueBadgeText}>{tracker.overdue} te laat</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      <View style={styles.trackerActions}>
                        <Pressable
                          style={styles.trackerAction}
                          onPress={() => handleSendReminder(tracker.id, tracker.customerName)}
                        >
                          <Ionicons name="notifications-outline" size={14} color={Palette.hermesOrange} />
                          <Text style={styles.trackerActionText}>Herinnering</Text>
                        </Pressable>
                        <Text style={styles.trackerTime}>{tracker.lastActivity}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            {/* Completed trackers — collapsed */}
            {completedTrackers.length > 0 && (
              <View style={styles.completedRow}>
                <Ionicons name="checkmark-circle" size={16} color={SemanticColors.feedbackSuccess} />
                <Text style={styles.completedText}>{completedTrackers.length} tracker{completedTrackers.length !== 1 ? 's' : ''} afgerond</Text>
              </View>
            )}
          </View>
        </FadeIn>

        {/* ============================================================ */}
        {/* KLANTEN — compact customer list below trackers               */}
        {/* ============================================================ */}

        <FadeIn delay={150} duration={400}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Klanten ({customers.length})</Text>
              <Pressable onPress={() => router.push('/contractor/customer-crm' as any)}>
                <Text style={styles.seeAll}>Alle bekijken</Text>
              </Pressable>
            </View>

            <View style={styles.customerList}>
              {recentCustomers.map((customer) => (
                <Pressable
                  key={customer.id}
                  style={({ pressed }) => [styles.customerRow, pressed && { backgroundColor: PAGE_BG }]}
                  onPress={() => router.push('/contractor/customer-crm' as any)}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{customer.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.customerName} numberOfLines={1}>{customer.name}</Text>
                  <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
                </Pressable>
              ))}
              {customers.length === 0 && (
                <Text style={styles.noCustomers}>Nog geen klanten — voeg toe via +</Text>
              )}
            </View>
          </View>
        </FadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add Customer Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowAddModal(false)}>
            <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Nieuwe klant</Text>
              <TextInput style={styles.modalInput} value={newName} onChangeText={setNewName} placeholder="Naam" placeholderTextColor={SemanticColors.textTertiary} autoFocus />
              <TextInput style={styles.modalInput} value={newEmail} onChangeText={setNewEmail} placeholder="E-mail" placeholderTextColor={SemanticColors.textTertiary} keyboardType="email-address" autoCapitalize="none" />
              <TextInput style={styles.modalInput} value={newPhone} onChangeText={setNewPhone} placeholder="Telefoon" placeholderTextColor={SemanticColors.textTertiary} keyboardType="phone-pad" />
              <Pressable style={[styles.modalSubmit, !newName.trim() && { opacity: 0.5 }]} onPress={handleAddCustomer} disabled={!newName.trim()}>
                <Text style={styles.modalSubmitText}>Toevoegen</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: SafeArea.top, paddingHorizontal: SafeArea.side, paddingBottom: Spacing.sm,
    backgroundColor: PAGE_BG,
  },
  headerTitle: { fontSize: 28, fontFamily: 'Manrope_800ExtraBold', color: SemanticColors.textPrimary, letterSpacing: -0.8 },
  addButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.hermesOrange, alignItems: 'center', justifyContent: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: SafeArea.side, paddingTop: Spacing.sm, paddingBottom: 120 },

  // Urgent banner
  urgentBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: SemanticColors.feedbackError + '10', borderRadius: 16, padding: 14,
    marginBottom: 16,
  },
  urgentText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: SemanticColors.feedbackError, flex: 1 },

  // Sections
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontFamily: 'Manrope_700Bold', color: SemanticColors.textPrimary, letterSpacing: -0.3 },
  seeAll: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Palette.hermesOrange },

  // Tracker cards — the CORE of this screen
  trackerCard: {
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: 16, padding: 16,
    overflow: 'hidden',
  },
  progressBar: { height: 4, backgroundColor: SemanticColors.borderDefault, borderRadius: 2, marginBottom: 12 },
  progressFill: { height: 4, backgroundColor: Palette.hermesOrange, borderRadius: 2 },
  trackerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  trackerCustomer: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: SemanticColors.textPrimary },
  trackerProject: { fontSize: 13, fontFamily: 'Inter_400Regular', color: SemanticColors.textSecondary, marginTop: 2 },
  trackerRevenue: { fontSize: 12, fontFamily: 'Inter_400Regular', color: SemanticColors.textTertiary, marginTop: 2 },
  trackerStats: { alignItems: 'flex-end', gap: 4 },
  trackerProgress: { fontSize: 17, fontFamily: 'Manrope_800ExtraBold', color: SemanticColors.textPrimary },
  overdueBadge: { backgroundColor: SemanticColors.feedbackError + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  overdueBadgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: SemanticColors.feedbackError },
  trackerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SemanticColors.borderDefault },
  trackerAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trackerActionText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Palette.hermesOrange },
  trackerTime: { fontSize: 12, fontFamily: 'Inter_500Medium', color: SemanticColors.textTertiary },

  // Completed row
  completedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  completedText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: SemanticColors.textSecondary },

  // Empty tracker
  emptyTrackerCard: {
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: 16, padding: 24,
    alignItems: 'center', gap: 8,
  },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: SemanticColors.textPrimary, textAlign: 'center' },
  emptyDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', color: SemanticColors.textSecondary, textAlign: 'center', lineHeight: 20 },

  // Customer list — compact
  customerList: { backgroundColor: SemanticColors.surfacePrimary, borderRadius: 16, overflow: 'hidden' },
  customerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SemanticColors.borderDefault,
  },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Palette.hermesOrange + '12', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: Palette.hermesOrange },
  customerName: { flex: 1, fontSize: 16, fontFamily: 'Inter_600SemiBold', color: SemanticColors.textPrimary },
  noCustomers: { padding: 16, fontSize: 14, fontFamily: 'Inter_500Medium', color: SemanticColors.textTertiary, textAlign: 'center' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: SemanticColors.surfacePrimary, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, gap: 12 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: SemanticColors.borderDefault, alignSelf: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 20, fontFamily: 'Manrope_700Bold', color: SemanticColors.textPrimary, letterSpacing: -0.3 },
  modalInput: { backgroundColor: PAGE_BG, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: 'Inter_400Regular', color: SemanticColors.textPrimary },
  modalSubmit: { backgroundColor: Palette.hermesOrange, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  modalSubmitText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#fff' },
});

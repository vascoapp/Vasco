// =============================================================================
// PROFIEL - Contractor Profile Page
// =============================================================================

import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import i18n from '../../src/i18n/i18n';
import { Palette, SemanticColors } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { useAuth } from '../../src/context/AuthContext';
import { useAppState } from '../../src/state/AppState';

const LANG_OPTIONS = [
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
];

type IconName = keyof typeof Ionicons.glyphMap;

interface ProfileSection {
  title: string;
  items: { id: string; icon: IconName; label: string; value?: string; route?: string }[];
}

const getProfileSections = (
  t: (key: string, fallback: string) => string,
  user: { name?: string; email?: string; company?: string; trade?: string } | null,
): ProfileSection[] => [
  {
    title: t('profile.company', 'Company'),
    items: [
      { id: 'company', icon: 'business', label: t('profile.companyName', 'Company name'), value: user?.company || '' },
      { id: 'kvk', icon: 'document-text', label: t('profile.kvkNumber', 'Chamber of Commerce'), value: '' },
      { id: 'btw', icon: 'receipt', label: t('profile.vatNumber', 'VAT number'), value: '' },
    ],
  },
  {
    title: t('profile.account', 'Account'),
    items: [
      { id: 'email', icon: 'mail', label: t('profile.email', 'Email'), value: user?.email || '' },
      { id: 'phone', icon: 'call', label: t('profile.phone', 'Phone'), value: '' },
      { id: 'plan', icon: 'diamond', label: t('profile.subscription', 'Subscription'), value: 'Vasco Pro' },
    ],
  },
  {
    title: t('profile.settings', 'Settings'),
    items: [
      { id: 'notifications', icon: 'notifications', label: t('profile.notifications', 'Notifications') },
      { id: 'language', icon: 'language', label: t('profile.language', 'Language') },
      { id: 'theme', icon: 'color-palette', label: t('profile.theme', 'Theme'), value: t('profile.themeLight', 'Light') },
    ],
  },
  {
    title: t('profile.support', 'Support'),
    items: [
      { id: 'help', icon: 'help-circle', label: t('profile.helpFaq', 'Help & FAQ') },
      { id: 'feedback', icon: 'chatbubble-ellipses', label: t('profile.giveFeedback', 'Give feedback') },
      { id: 'privacy', icon: 'shield-checkmark', label: t('profile.privacyTerms', 'Privacy & terms') },
    ],
  },
];

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, updateUser, logout } = useAuth();
  const { jobs, customers } = useAppState();
  const currentLang = LANG_OPTIONS.find(l => l.code === i18n.language) ?? LANG_OPTIONS[0];
  const profileSections = getProfileSections(t, user);

  // Contractor Score — computed from available data
  const contractorScore = useMemo(() => {
    const totalJobs = jobs.length;
    const completedJobs = jobs.filter((j: any) => j.status === 'completed' || j.status === 'gereed').length;
    const completionRate = totalJobs > 0 ? completedJobs / totalJobs : 0;
    // On-time: jobs completed before or on deadline
    const onTimeJobs = jobs.filter((j: any) => {
      if (j.status !== 'completed' && j.status !== 'gereed') return false;
      if (!j.completedAt || !j.endDate) return true; // No deadline = on time
      return new Date(j.completedAt) <= new Date(j.endDate);
    }).length;
    const onTimeRate = completedJobs > 0 ? onTimeJobs / completedJobs : 1;
    // Repeat customers: customers with 2+ jobs
    const customerJobCount = new Map<string, number>();
    jobs.forEach((j: any) => {
      if (j.customerId) customerJobCount.set(j.customerId, (customerJobCount.get(j.customerId) ?? 0) + 1);
    });
    const repeatCustomers = Array.from(customerJobCount.values()).filter(c => c >= 2).length;
    const totalCustomersWithJobs = customerJobCount.size;
    const repeatRate = totalCustomersWithJobs > 0 ? repeatCustomers / totalCustomersWithJobs : 0;
    // Score: weighted average (completion 40%, on-time 35%, repeat 25%)
    const score = Math.round((completionRate * 40 + onTimeRate * 35 + repeatRate * 25));
    return {
      score: Math.min(score, 100),
      completionRate: Math.round(completionRate * 100),
      onTimeRate: Math.round(onTimeRate * 100),
      repeatRate: Math.round(repeatRate * 100),
    };
  }, [jobs]);
  const userName = user?.name || 'User';
  const userInitials = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const userTrade = user?.trade ? t(`onboarding.trades.${user.trade}`, user.trade) : t('profile.contractor', 'Contractor');

  const handleLanguageSwitch = () => {
    Alert.alert(
      t('profile.language'),
      undefined,
      LANG_OPTIONS.map(lang => ({
        text: `${lang.flag} ${lang.label}`,
        onPress: () => {
          i18n.changeLanguage(lang.code);
          updateUser({ language: lang.code as any });
        },
      })),
    );
  };

  const handleLogout = () => {
    Alert.alert(t('profile.logout'), t('common.confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.logout'), style: 'destructive', onPress: () => { logout(); router.replace('/login'); } },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
        </Pressable>
        <Text style={styles.headerTitle}>{t('profile.title', 'Profile')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{userInitials}</Text>
          </View>
          <Text style={styles.nameText}>{userName}</Text>
          <Text style={styles.roleText}>{userTrade}</Text>
        </View>

        {/* Contractor Score */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.performance', 'PERFORMANCE').toUpperCase()}</Text>
          <View style={styles.card}>
            <View style={styles.scoreHeader}>
              <Ionicons name="trophy" size={20} color={Palette.hermesOrange} />
              <Text style={styles.scoreTitle}>{t('profile.contractorScore', 'Contractor Score')}</Text>
              <Text style={styles.scoreValue}>{contractorScore.score}/100</Text>
            </View>
            <View style={styles.scoreBreakdown}>
              <View style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>{t('profile.completionRate', 'Completion rate')}</Text>
                <Text style={styles.scoreMetric}>{contractorScore.completionRate}%</Text>
              </View>
              <View style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>{t('profile.onTimeRate', 'On-time rate')}</Text>
                <Text style={styles.scoreMetric}>{contractorScore.onTimeRate}%</Text>
              </View>
              <View style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>{t('profile.repeatCustomers', 'Repeat customers')}</Text>
                <Text style={styles.scoreMetric}>{contractorScore.repeatRate}%</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Sections */}
        {profileSections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.card}>
              {section.items.map((item, index) => (
                <Pressable
                  key={item.id}
                  style={[styles.row, index < section.items.length - 1 && styles.rowBorder]}
                  onPress={() => {
                    if (item.id === 'language') { handleLanguageSwitch(); return; }
                    Alert.alert(item.label, item.value || t('profile.openSetting', 'Opening setting...'));
                  }}
                >
                  <View style={styles.rowIcon}>
                    <Ionicons name={item.icon} size={18} color={Palette.hermesOrange} />
                  </View>
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  {item.id === 'language'
                    ? <Text style={styles.rowValue}>{currentLang.flag} {currentLang.label}</Text>
                    : item.value && <Text style={styles.rowValue}>{item.value}</Text>}
                  <Ionicons name="chevron-forward" size={16} color="#CCC" />
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        {/* Logout */}
        <Pressable
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={18} color={SemanticColors.feedbackError} />
          <Text style={styles.logoutText}>{t('profile.logout')}</Text>
        </Pressable>

        <Text style={styles.versionText}>Vasco v1.0.0</Text>

        {/* GDPR Retention Notice */}
        <View style={styles.retentionNotice}>
          <Ionicons name="shield-checkmark-outline" size={14} color={SemanticColors.textTertiary} />
          <Text style={styles.retentionText}>
            {t('profile.retentionNotice', 'Retention: Invoices 7 years · Contracts 7 years · Customer data 2 years · Personnel data 5 years')}
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: SafeArea.top,
    paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Manrope_700Bold', color: '#1A1A1A' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, gap: 20 },
  avatarSection: { alignItems: 'center', paddingVertical: Spacing.lg },
  avatar: {
    width: 72, height: 72, borderRadius: 24,
    backgroundColor: Palette.hermesOrange, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 24, fontFamily: 'Manrope_800ExtraBold', color: '#fff' },
  nameText: { fontSize: 20, fontFamily: 'Manrope_700Bold', color: '#1A1A1A', marginTop: 12 },
  roleText: { fontSize: 13, color: '#999', marginTop: 4 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 12, fontFamily: 'Manrope_700Bold', color: '#999', letterSpacing: 0.8, paddingHorizontal: 4 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  rowIcon: {
    width: 32, height: 32, borderRadius: 12,
    backgroundColor: Palette.hermesOrange + '0C', alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', color: '#1A1A1A' },
  rowValue: { fontSize: 13, color: '#999', marginRight: 4 },
  scoreHeader: {
    flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10,
    borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  scoreTitle: { flex: 1, fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#1A1A1A' },
  scoreValue: { fontSize: TYPE.titleSize, fontFamily: 'Manrope_700Bold', color: Palette.hermesOrange },
  scoreBreakdown: { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scoreLabel: { fontSize: TYPE.captionSize, fontFamily: 'Inter_400Regular', color: SemanticColors.textSecondary },
  scoreMetric: { fontSize: TYPE.captionSize, fontFamily: 'Inter_600SemiBold', color: SemanticColors.textPrimary },
  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, backgroundColor: SemanticColors.feedbackErrorBg, borderRadius: 12,
  },
  logoutText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: SemanticColors.feedbackError },
  versionText: { fontSize: 12, color: '#CCC', textAlign: 'center', marginTop: 8 },
  retentionNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  retentionText: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: SemanticColors.textTertiary,
    lineHeight: 16,
  },
});

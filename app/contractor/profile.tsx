// =============================================================================
// PROFIEL - Contractor Profile & Settings Page
// =============================================================================

import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import i18n from '../../src/i18n/i18n';
import { Palette, SemanticColors } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { useAuth } from '../../src/context/AuthContext';
import { isDemoMode } from '../../src/context/AuthContext';
import { useAppState } from '../../src/state/AppState';
import { DKLabel } from '../../src/components/shared/DKLabel';

const LANG_OPTIONS = [
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
];

type IconName = keyof typeof Ionicons.glyphMap;

// Country-specific registration label
const getRegistrationLabel = (country?: string) => {
  switch (country) {
    case 'NL': return 'KvK';
    case 'DE': return 'Handelsregister';
    case 'FR': return 'SIRET';
    case 'ES': return 'NIF';
    case 'IT': return 'Partita IVA';
    case 'UK': return 'Companies House';
    default: return 'Registration';
  }
};

// Integration status
interface IntegrationItem {
  id: string;
  name: string;
  icon: IconName;
  connected: boolean;
  route?: string;
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, updateUser, logout } = useAuth();
  const { jobs, customers, invoices, businessProfile, moneybirdConnected, mollieConnected } = useAppState();
  const currentLang = LANG_OPTIONS.find(l => l.code === i18n.language) ?? LANG_OPTIONS[0];

  // Contractor Score
  const contractorScore = useMemo(() => {
    const totalJobs = jobs.length;
    const completedJobs = jobs.filter((j: any) => j.status === 'completed' || j.status === 'gereed').length;
    const completionRate = totalJobs > 0 ? completedJobs / totalJobs : 0;
    const onTimeJobs = jobs.filter((j: any) => {
      if (j.status !== 'completed' && j.status !== 'gereed') return false;
      if (!j.completedAt || !j.endDate) return true;
      return new Date(j.completedAt) <= new Date(j.endDate);
    }).length;
    const onTimeRate = completedJobs > 0 ? onTimeJobs / completedJobs : 1;
    const customerJobCount = new Map<string, number>();
    jobs.forEach((j: any) => {
      if (j.customerId) customerJobCount.set(j.customerId, (customerJobCount.get(j.customerId) ?? 0) + 1);
    });
    const repeatCustomers = Array.from(customerJobCount.values()).filter(c => c >= 2).length;
    const totalCustomersWithJobs = customerJobCount.size;
    const repeatRate = totalCustomersWithJobs > 0 ? repeatCustomers / totalCustomersWithJobs : 0;
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
  const country = user?.country ?? 'NL';

  // Integrations
  const integrations: IntegrationItem[] = [
    { id: 'mollie', name: 'Mollie', icon: 'card', connected: mollieConnected, route: '/(modals)/mollie' },
    { id: 'moneybird', name: 'Moneybird', icon: 'calculator', connected: moneybirdConnected, route: '/(modals)/moneybird' },
    { id: 'xero', name: 'Xero', icon: 'cloud', connected: false },
    { id: 'stripe', name: 'Stripe', icon: 'card-outline', connected: false },
  ];

  const handleLanguageSwitch = () => {
    Alert.alert(
      t('profile.language', 'Language'),
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
    Alert.alert(t('profile.logout', 'Logout'), t('common.confirm', 'Are you sure?'), [
      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      { text: t('profile.logout', 'Logout'), style: 'destructive', onPress: () => { logout(); router.replace('/login'); } },
    ]);
  };

  const handleExportData = () => {
    Share.share({
      message: t('profile.exportSummary', {
        defaultValue: 'Vasco Data Export\n\nUser: {{name}} ({{email}})\nCompany: {{company}}\nInvoices: {{invoices}}\nJobs: {{jobs}}\nCustomers: {{customers}}',
        name: user?.name ?? '',
        email: user?.email ?? '',
        company: user?.company ?? '',
        invoices: invoices.length,
        jobs: jobs.length,
        customers: customers.length,
      }),
      title: t('profile.dataExport', 'Vasco Data Export'),
    });
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('profile.deleteAccount', 'Delete my account'),
      t('profile.deleteAccountWarning', 'This will permanently delete your account and all data. Financial records will be anonymized per EU retention law. This cannot be undone.'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('profile.deleteConfirm', 'Delete permanently'),
          style: 'destructive',
          onPress: async () => {
            // GDPR Art. 17: persist the deletion request so the backend worker
            // erases the user's data within 30 days. If the insert fails we
            // must NOT claim deletion was scheduled.
            let submitted = true;
            try {
              const { supabase, isSupabaseConfigured } = await import('../../src/lib/supabase');
              if (isSupabaseConfigured) {
                const { data: { user: authUser } } = await supabase.auth.getUser();
                if (authUser) {
                  const { error: insErr } = await (supabase.from('account_deletion_requests' as any) as any)
                    .insert({ user_id: authUser.id, status: 'pending' });
                  if (insErr) submitted = false;
                } else {
                  submitted = false;
                }
              }
              // Demo mode: no backend to call; local logout clears AsyncStorage.
            } catch {
              submitted = false;
            }
            if (!submitted) {
              Alert.alert(
                t('profile.deletionFailed', 'Could not submit request'),
                t('profile.deletionFailedDesc', 'Your request did not reach our servers. Check your internet and try again, or contact support.'),
              );
              return;
            }
            Alert.alert(
              t('profile.deletionScheduled', 'Account deletion requested'),
              t('profile.deletionScheduledDesc', 'Your data will be removed within 30 days. You will receive a confirmation email.'),
              [{ text: t('common.ok', 'OK'), onPress: () => { logout(); router.replace('/login'); } }],
            );
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={SemanticColors.textPrimary} />
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
        <View style={styles.sectionWrap}>
          <DKLabel style={styles.sectionLabel}>{t('profile.performance', 'PERFORMANCE')}</DKLabel>
          <View style={styles.card}>
            <View style={styles.scoreHeader}>
              <Ionicons name="trophy" size={20} color={Palette.hermesOrange} />
              <Text style={styles.scoreTitle}>{t('profile.contractorScore', 'Contractor Score')}</Text>
              <Text style={styles.scoreValue}>{contractorScore.score}/100</Text>
            </View>
            <View style={styles.scoreBreakdown}>
              <View style={styles.scoreRow}>
                <Text style={styles.scoreMetricLabel}>{t('profile.completionRate', 'Completion rate')}</Text>
                <Text style={styles.scoreMetric}>{contractorScore.completionRate}%</Text>
              </View>
              <View style={styles.scoreRow}>
                <Text style={styles.scoreMetricLabel}>{t('profile.onTimeRate', 'On-time rate')}</Text>
                <Text style={styles.scoreMetric}>{contractorScore.onTimeRate}%</Text>
              </View>
              <View style={styles.scoreRow}>
                <Text style={styles.scoreMetricLabel}>{t('profile.repeatCustomers', 'Repeat customers')}</Text>
                <Text style={styles.scoreMetric}>{contractorScore.repeatRate}%</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.sectionWrap}>
          <DKLabel style={styles.sectionLabel}>{t('profile.account', 'ACCOUNT')}</DKLabel>
          <View style={styles.card}>
            <SettingsRow icon="person" label={t('profile.name', 'Name')} value={user?.name ?? ''} />
            <SettingsRow icon="mail" label={t('profile.email', 'Email')} value={user?.email ?? ''} border />
            <SettingsRow icon="business" label={t('profile.companyName', 'Company')} value={user?.company ?? ''} border />
            <SettingsRow icon="construct" label={t('profile.trade', 'Trade')} value={userTrade} border />
            <SettingsRow icon="flag" label={t('profile.country', 'Country')} value={country} border />
          </View>
        </View>

        {/* Business Section */}
        <View style={styles.sectionWrap}>
          <DKLabel style={styles.sectionLabel}>{t('profile.business', 'BUSINESS')}</DKLabel>
          <View style={styles.card}>
            <SettingsRow
              icon="document-text"
              label={getRegistrationLabel(country)}
              value={businessProfile.kvkNumber || businessProfile.registrationNumber || t('profile.notSet', 'Not set')}
              onPress={() => router.push('/business-settings' as any)}
            />
            <SettingsRow
              icon="receipt"
              label={t('profile.vatNumber', 'VAT number')}
              value={businessProfile.vatNumber || t('profile.notSet', 'Not set')}
              border
              onPress={() => router.push('/business-settings' as any)}
            />
            <SettingsRow
              icon="location"
              label={t('profile.address', 'Address')}
              value={businessProfile.address || t('profile.notSet', 'Not set')}
              border
              onPress={() => router.push('/business-settings' as any)}
            />
            <SettingsRow
              icon="briefcase"
              label={t('profile.businessType', 'Business type')}
              value={businessProfile.businessType || t('profile.notSet', 'Not set')}
              border
              onPress={() => router.push('/business-settings' as any)}
            />
          </View>
        </View>

        {/* Integrations */}
        <View style={styles.sectionWrap}>
          <DKLabel style={styles.sectionLabel}>{t('profile.integrations', 'INTEGRATIONS')}</DKLabel>
          <View style={styles.card}>
            {integrations.map((item, idx) => (
              <Pressable
                key={item.id}
                style={[styles.row, idx > 0 && styles.rowBorder]}
                onPress={() => {
                  if (item.route) router.push(item.route as any);
                  else Alert.alert(item.name, t('profile.comingSoon', 'Coming soon'));
                }}
              >
                <View style={styles.rowIcon}>
                  <Ionicons name={item.icon} size={18} color={Palette.hermesOrange} />
                </View>
                <Text style={styles.rowLabel}>{item.name}</Text>
                <View style={[styles.statusBadge, item.connected ? styles.statusConnected : styles.statusDisconnected]}>
                  <View style={[styles.statusDot, { backgroundColor: item.connected ? SemanticColors.feedbackSuccess : SemanticColors.textTertiary }]} />
                  <Text style={[styles.statusText, { color: item.connected ? SemanticColors.feedbackSuccess : SemanticColors.textTertiary }]}>
                    {item.connected ? t('profile.connected', 'Connected') : t('profile.notConnected', 'Not connected')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
              </Pressable>
            ))}
          </View>
        </View>

        {/* Settings */}
        <View style={styles.sectionWrap}>
          <DKLabel style={styles.sectionLabel}>{t('profile.settings', 'SETTINGS')}</DKLabel>
          <View style={styles.card}>
            <Pressable style={styles.row} onPress={handleLanguageSwitch}>
              <View style={styles.rowIcon}>
                <Ionicons name="language" size={18} color={Palette.hermesOrange} />
              </View>
              <Text style={styles.rowLabel}>{t('profile.language', 'Language')}</Text>
              <Text style={styles.rowValue}>{currentLang.flag} {currentLang.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
            </Pressable>
            <Pressable
              style={[styles.row, styles.rowBorder]}
              onPress={() => router.push('/contractor/notifications' as any)}
            >
              <View style={styles.rowIcon}>
                <Ionicons name="notifications" size={18} color={Palette.hermesOrange} />
              </View>
              <Text style={styles.rowLabel}>{t('profile.notifications', 'Notifications')}</Text>
              <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
            </Pressable>
            <Pressable
              style={[styles.row, styles.rowBorder]}
              onPress={() => router.push('/contractor/legal' as any)}
            >
              <View style={styles.rowIcon}>
                <Ionicons name="shield-checkmark" size={18} color={Palette.hermesOrange} />
              </View>
              <Text style={styles.rowLabel}>{t('profile.privacyTerms', 'Privacy & terms')}</Text>
              <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
            </Pressable>
            {/* R229: referrals entry */}
            <Pressable
              style={[styles.row, styles.rowBorder]}
              onPress={() => router.push('/contractor/referrals' as any)}
            >
              <View style={styles.rowIcon}>
                <Ionicons name="people" size={18} color={Palette.hermesOrange} />
              </View>
              <Text style={styles.rowLabel}>{t('referrals.entryLabel', 'Invite contractors')}</Text>
              <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
            </Pressable>
          </View>
        </View>

        {/* Data & Privacy */}
        <View style={styles.sectionWrap}>
          <DKLabel style={styles.sectionLabel}>{t('profile.dataPrivacy', 'DATA & PRIVACY')}</DKLabel>
          <View style={styles.card}>
            <Pressable style={styles.row} onPress={handleExportData}>
              <View style={styles.rowIcon}>
                <Ionicons name="download-outline" size={18} color={Palette.hermesOrange} />
              </View>
              <Text style={styles.rowLabel}>{t('profile.exportData', 'Export my data')}</Text>
              <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
            </Pressable>
            <Pressable style={[styles.row, styles.rowBorder]} onPress={handleDeleteAccount}>
              <View style={[styles.rowIcon, { backgroundColor: SemanticColors.feedbackError + '0C' }]}>
                <Ionicons name="trash-outline" size={18} color={SemanticColors.feedbackError} />
              </View>
              <Text style={[styles.rowLabel, { color: SemanticColors.feedbackError }]}>{t('profile.deleteAccount', 'Delete my account')}</Text>
              <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
            </Pressable>
          </View>
        </View>

        {/* Logout */}
        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color={SemanticColors.feedbackError} />
          <Text style={styles.logoutText}>{t('profile.logout', 'Logout')}</Text>
        </Pressable>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.versionText}>Vasco v1.0.0</Text>
          {isDemoMode && (
            <View style={styles.demoBadge}>
              <Ionicons name="flask" size={12} color={Palette.hermesOrange} />
              <Text style={styles.demoText}>{t('profile.demoMode', 'Demo mode')}</Text>
            </View>
          )}
        </View>

        {/* GDPR Retention Notice */}
        <View style={styles.retentionNotice}>
          <Ionicons name="shield-checkmark-outline" size={14} color={SemanticColors.textTertiary} />
          <Text style={styles.retentionText}>
            {t('profile.retentionNotice', 'Retention: Invoices 7 years · Contracts 7 years · Customer data 2 years · Personnel data 5 years')}
          </Text>
        </View>

        <View style={{ height: 140 }} />
      </ScrollView>
    </View>
  );
}

// Reusable row component
function SettingsRow({
  icon,
  label,
  value,
  border,
  onPress,
}: {
  icon: IconName;
  label: string;
  value?: string;
  border?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable style={[styles.row, border && styles.rowBorder]} onPress={onPress} disabled={!onPress}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={Palette.hermesOrange} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {onPress ? <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SafeArea.side,
    paddingTop: SafeArea.top,
    paddingBottom: GRID.sm + 4,
  },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary, textTransform: 'uppercase', letterSpacing: 1.2 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: SafeArea.side, gap: GRID.lg - 4 },
  avatarSection: { alignItems: 'center', paddingVertical: Spacing.lg },
  avatar: {
    width: 72, height: 72, borderRadius: RADIUS.full + 8,
    backgroundColor: Palette.hermesOrange, alignItems: 'center', justifyContent: 'center',
    shadowColor: Palette.hermesOrange,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 6,
  },
  avatarText: { fontSize: TYPE.displaySize - 4, fontFamily: TYPE.displayFamily, color: Palette.white },
  nameText: { fontSize: TYPE.sectionSize + 2, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary, marginTop: GRID.sm + 4 },
  roleText: { fontSize: TYPE.captionSize, color: SemanticColors.textTertiary, marginTop: GRID.xs },
  sectionWrap: { gap: GRID.sm },
  sectionLabel: { fontSize: TYPE.labelSize, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textTertiary, letterSpacing: 0.8, paddingHorizontal: GRID.xs },
  card: {
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: GRID.sm + 4 },
  rowBorder: { borderTopWidth: 1, borderTopColor: SemanticColors.borderDefault },
  rowIcon: {
    width: 32, height: 32, borderRadius: RADIUS.md,
    backgroundColor: Palette.hermesOrange + '0C', alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: { flex: 1, fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textPrimary },
  rowValue: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textTertiary, marginRight: GRID.xs, maxWidth: 180 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.xs,
    paddingHorizontal: GRID.sm, paddingVertical: GRID.xs,
    borderRadius: RADIUS.sm,
  },
  statusConnected: { backgroundColor: SemanticColors.feedbackSuccess + '10' },
  statusDisconnected: { backgroundColor: SemanticColors.surfaceSecondary },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: TYPE.tinySize, fontFamily: TYPE.tinyFamily },
  scoreHeader: {
    flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10,
    borderBottomWidth: 1, borderBottomColor: SemanticColors.borderDefault,
  },
  scoreTitle: { flex: 1, fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  scoreValue: { fontSize: TYPE.titleSize, fontFamily: 'Archivo_800ExtraBold', color: Palette.hermesOrange },
  scoreBreakdown: { paddingHorizontal: 14, paddingVertical: 10, gap: GRID.sm },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scoreMetricLabel: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary },
  scoreMetric: { fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: GRID.sm,
    paddingVertical: 14, backgroundColor: SemanticColors.feedbackErrorBg, borderRadius: RADIUS.md,
  },
  logoutText: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.feedbackError },
  appInfo: { alignItems: 'center', gap: GRID.sm, marginTop: GRID.xs },
  versionText: { fontSize: TYPE.labelSize, fontFamily: TYPE.labelFamily, color: SemanticColors.textTertiary },
  demoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.xs,
    paddingHorizontal: GRID.sm, paddingVertical: GRID.xs,
    backgroundColor: Palette.hermesOrange + '10', borderRadius: RADIUS.sm,
  },
  demoText: { fontSize: TYPE.tinySize, fontFamily: TYPE.tinyFamily, color: Palette.hermesOrange },
  retentionNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: GRID.sm,
    paddingHorizontal: GRID.xs,
  },
  retentionText: {
    flex: 1,
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.tinyFamily,
    color: SemanticColors.textTertiary,
    lineHeight: 16,
  },
});

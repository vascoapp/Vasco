// =============================================================================
// PROFIEL - Contractor Profile Page
// =============================================================================

import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import i18n from '../../src/i18n/i18n';
import { Palette, SemanticColors } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS } from '../../src/theme/tabStyles';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { useAuth } from '../../src/context/AuthContext';

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

const PROFILE_SECTIONS: ProfileSection[] = [
  {
    title: 'Bedrijf',
    items: [
      { id: 'company', icon: 'business', label: 'Bedrijfsnaam', value: 'Van Dijk Installaties' },
      { id: 'kvk', icon: 'document-text', label: 'KvK nummer', value: '12345678' },
      { id: 'btw', icon: 'receipt', label: 'BTW nummer', value: 'NL123456789B01' },
    ],
  },
  {
    title: 'Account',
    items: [
      { id: 'email', icon: 'mail', label: 'E-mail', value: 'mark@vandijk.nl' },
      { id: 'phone', icon: 'call', label: 'Telefoon', value: '+31 6 12345678' },
      { id: 'plan', icon: 'diamond', label: 'Abonnement', value: 'Vasco Pro' },
    ],
  },
  {
    title: 'Instellingen',
    items: [
      { id: 'notifications', icon: 'notifications', label: 'Notificaties' },
      { id: 'language', icon: 'language', label: 'Taal', value: 'Nederlands' },
      { id: 'theme', icon: 'color-palette', label: 'Thema', value: 'Licht' },
    ],
  },
  {
    title: 'Support',
    items: [
      { id: 'help', icon: 'help-circle', label: 'Hulp & FAQ' },
      { id: 'feedback', icon: 'chatbubble-ellipses', label: 'Feedback geven' },
      { id: 'privacy', icon: 'shield-checkmark', label: 'Privacy & voorwaarden' },
    ],
  },
];

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, updateUser, logout } = useAuth();
  const currentLang = LANG_OPTIONS.find(l => l.code === i18n.language) ?? LANG_OPTIONS[0];

  const handleLanguageSwitch = () => {
    Alert.alert(
      t('settings.language', 'Taal'),
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
    Alert.alert(t('settings.logout', 'Uitloggen'), t('common.confirm', 'Weet je het zeker?'), [
      { text: t('common.cancel', 'Annuleren'), style: 'cancel' },
      { text: t('settings.logout', 'Uitloggen'), style: 'destructive', onPress: () => { logout(); router.replace('/login'); } },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
        </Pressable>
        <Text style={styles.headerTitle}>Profiel</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>MV</Text>
          </View>
          <Text style={styles.nameText}>Mark van Dijk</Text>
          <Text style={styles.roleText}>Aannemer · Loodgieter & Installateur</Text>
        </View>

        {/* Sections */}
        {PROFILE_SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.card}>
              {section.items.map((item, index) => (
                <Pressable
                  key={item.id}
                  style={[styles.row, index < section.items.length - 1 && styles.rowBorder]}
                  onPress={() => {
                    if (item.id === 'language') { handleLanguageSwitch(); return; }
                    Alert.alert(item.label, item.value || 'Instelling openen...');
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
          <Text style={styles.logoutText}>Uitloggen</Text>
        </Pressable>

        <Text style={styles.versionText}>Vasco v1.0.0</Text>

        {/* GDPR Retention Notice */}
        <View style={styles.retentionNotice}>
          <Ionicons name="shield-checkmark-outline" size={14} color={SemanticColors.textTertiary} />
          <Text style={styles.retentionText}>
            Bewaartermijnen: Facturen 7 jaar · Contracten 7 jaar · Klantgegevens 2 jaar · Personeelsgegevens 5 jaar
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

// =============================================================================
// PROFIEL - Contractor Profile Page
// =============================================================================

import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Palette, SemanticColors } from '../../src/theme/colors';
import { Spacing, SafeArea } from '../../src/theme/spacing';

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
  const router = useRouter();

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
                    Alert.alert(item.label, item.value || 'Instelling openen...');
                  }}
                >
                  <View style={styles.rowIcon}>
                    <Ionicons name={item.icon} size={18} color={Palette.hermesOrange} />
                  </View>
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  {item.value && <Text style={styles.rowValue}>{item.value}</Text>}
                  <Ionicons name="chevron-forward" size={16} color="#CCC" />
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        {/* Logout */}
        <Pressable
          style={styles.logoutButton}
          onPress={() => Alert.alert('Uitloggen', 'Weet je zeker dat je wilt uitloggen?', [
            { text: 'Annuleren', style: 'cancel' },
            { text: 'Uitloggen', style: 'destructive' },
          ])}
        >
          <Ionicons name="log-out-outline" size={18} color={SemanticColors.feedbackError} />
          <Text style={styles.logoutText}>Uitloggen</Text>
        </Pressable>

        <Text style={styles.versionText}>Vasco v1.0.0</Text>
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: SafeArea.top,
    paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, gap: 20 },
  avatarSection: { alignItems: 'center', paddingVertical: Spacing.lg },
  avatar: {
    width: 72, height: 72, borderRadius: 24,
    backgroundColor: Palette.hermesOrange, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 24, fontWeight: '800', color: '#fff' },
  nameText: { fontSize: 20, fontWeight: '700', color: '#1A1A1A', marginTop: 12 },
  roleText: { fontSize: 13, color: '#999', marginTop: 4 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 4 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  rowIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: Palette.hermesOrange + '0C', alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: '#1A1A1A' },
  rowValue: { fontSize: 13, color: '#999', marginRight: 4 },
  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, backgroundColor: SemanticColors.feedbackErrorBg, borderRadius: 12,
  },
  logoutText: { fontSize: 14, fontWeight: '600', color: SemanticColors.feedbackError },
  versionText: { fontSize: 12, color: '#CCC', textAlign: 'center', marginTop: 8 },
});

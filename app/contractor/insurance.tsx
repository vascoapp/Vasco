// =============================================================================
// VERZEKERING - Insurance Policies Overview
// =============================================================================

import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Palette, SemanticColors } from '../../src/theme/colors';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { useInsurancePolicies } from '../../src/services/complianceService';

type IconName = keyof typeof Ionicons.glyphMap;

function getStatusConfig(status: string) {
  switch (status) {
    case 'active':
      return { label: 'Actief', color: SemanticColors.feedbackSuccess, bg: SemanticColors.feedbackSuccessBg, icon: 'checkmark-circle' as IconName };
    case 'expiring_soon':
      return { label: 'Verloopt binnenkort', color: SemanticColors.feedbackWarning, bg: SemanticColors.feedbackWarningBg, icon: 'alert-circle' as IconName };
    case 'expired':
      return { label: 'Verlopen', color: SemanticColors.feedbackError, bg: SemanticColors.feedbackErrorBg, icon: 'close-circle' as IconName };
    default:
      return { label: 'Onbekend', color: SemanticColors.textTertiary, bg: SemanticColors.surfaceSecondary, icon: 'help-circle' as IconName };
  }
}

export default function InsuranceScreen() {
  const router = useRouter();
  const { policies, loading } = useInsurancePolicies();

  const activeCount = policies.filter(p => p.status === 'active').length;
  const expiringCount = policies.filter(p => p.status === 'expiring_soon').length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
        </Pressable>
        <Text style={styles.headerTitle}>Verzekeringen</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="shield-checkmark" size={20} color={SemanticColors.feedbackSuccess} />
            <Text style={[styles.statValue, { color: SemanticColors.feedbackSuccess }]}>{activeCount}</Text>
            <Text style={styles.statLabel}>Actief</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="alert-circle" size={20} color={SemanticColors.feedbackWarning} />
            <Text style={[styles.statValue, { color: SemanticColors.feedbackWarning }]}>{expiringCount}</Text>
            <Text style={styles.statLabel}>Verloopt</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="documents" size={20} color={Palette.hermesOrange} />
            <Text style={[styles.statValue, { color: Palette.hermesOrange }]}>{policies.length}</Text>
            <Text style={styles.statLabel}>Totaal</Text>
          </View>
        </View>

        {/* Policies */}
        {policies.map((policy) => {
          const status = getStatusConfig(policy.status);
          const endDate = new Date(policy.endDate);
          const daysLeft = Math.ceil((endDate.getTime() - Date.now()) / 86400000);

          return (
            <Pressable
              key={policy.id}
              style={styles.policyCard}
              onPress={() => Alert.alert(policy.name, `Verzekeraar: ${policy.provider}\nDekking: €${policy.coverage?.toLocaleString('nl-NL') || 'n.v.t.'}\nEinddatum: ${endDate.toLocaleDateString('nl-NL')}`)}
            >
              <View style={styles.policyHeader}>
                <View style={[styles.policyIcon, { backgroundColor: Palette.hermesOrange + '12' }]}>
                  <Ionicons name="shield-half" size={20} color={Palette.hermesOrange} />
                </View>
                <View style={styles.policyInfo}>
                  <Text style={styles.policyName} numberOfLines={1}>{policy.name}</Text>
                  <Text style={styles.policyProvider}>{policy.provider}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                  <Ionicons name={status.icon} size={14} color={status.color} />
                  <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                </View>
              </View>

              <View style={styles.policyFooter}>
                <View style={styles.policyDetail}>
                  <Ionicons name="calendar-outline" size={13} color="#999" />
                  <Text style={styles.policyDetailText}>
                    {daysLeft > 0 ? `Nog ${daysLeft} dagen` : `${Math.abs(daysLeft)} dagen verlopen`}
                  </Text>
                </View>
                {policy.coverage && (
                  <Text style={styles.policyAmount}>€{policy.coverage.toLocaleString('nl-NL')}</Text>
                )}
              </View>
            </Pressable>
          );
        })}

        {policies.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Ionicons name="shield-outline" size={40} color="#CCC" />
            <Text style={styles.emptyText}>Geen verzekeringen gevonden</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: SafeArea.top, paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  statCard: {
    flex: 1, alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14, gap: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  statValue: { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 10, color: '#999', textTransform: 'uppercase' },
  policyCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  policyHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  policyIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  policyInfo: { flex: 1 },
  policyName: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  policyProvider: { fontSize: 12, color: '#999', marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: '600' },
  policyFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  policyDetail: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  policyDetailText: { fontSize: 12, color: '#999' },
  policyAmount: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, color: '#999' },
});

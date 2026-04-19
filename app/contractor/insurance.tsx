// =============================================================================
// VERZEKERING - Insurance Policies Overview
// =============================================================================

import { useState, useMemo, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, RefreshControl, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Palette, SemanticColors } from '../../src/theme/colors';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { useInsurancePolicies } from '../../src/services/complianceService';
import { Toast } from '../../src/components/shared/Toast';
import { hapticSuccess } from '../../src/utils/haptics';
import { MS_PER_DAY } from '../../src/utils/timeConstants';

type IconName = keyof typeof Ionicons.glyphMap;

interface Claim {
  id: string;
  policyId: string;
  policyName: string;
  description: string;
  incidentDate: string;
  estimatedAmount: string;
  submittedAt: string;
}

function getInsuranceStatusConfig(status: string, t: (key: string, defaultValue: string) => string) {
  switch (status) {
    case 'active':
      return { label: t('insurance.statusActive', 'Actief'), color: SemanticColors.feedbackSuccess, bg: SemanticColors.feedbackSuccessBg, icon: 'checkmark-circle' as IconName };
    case 'expiring_soon':
      return { label: t('insurance.statusExpiringSoon', 'Verloopt binnenkort'), color: SemanticColors.feedbackWarning, bg: SemanticColors.feedbackWarningBg, icon: 'alert-circle' as IconName };
    case 'expired':
      return { label: t('insurance.statusExpired', 'Verlopen'), color: SemanticColors.feedbackError, bg: SemanticColors.feedbackErrorBg, icon: 'close-circle' as IconName };
    default:
      return { label: t('insurance.statusUnknown', 'Onbekend'), color: SemanticColors.textTertiary, bg: SemanticColors.surfaceSecondary, icon: 'help-circle' as IconName };
  }
}

export default function InsuranceScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { policies, loading } = useInsurancePolicies();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 600); }, []);

  // Claim state
  const [claims, setClaims] = useState<Claim[]>([]);

  // Persist claims to AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem('@vasco_insurance_claims').then(raw => {
      if (raw) setClaims(JSON.parse(raw));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (claims.length > 0) {
      AsyncStorage.setItem('@vasco_insurance_claims', JSON.stringify(claims)).catch(() => {});
    }
  }, [claims]);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimPolicyId, setClaimPolicyId] = useState('');
  const [claimDescription, setClaimDescription] = useState('');
  const [claimDate, setClaimDate] = useState('');
  const [claimAmount, setClaimAmount] = useState('');
  const [showToast, setShowToast] = useState(false);

  const openClaimForm = (policyId?: string) => {
    setClaimPolicyId(policyId || (policies.length > 0 ? policies[0].id : ''));
    setClaimDescription('');
    setClaimDate('');
    setClaimAmount('');
    setShowClaimModal(true);
  };

  const submitClaim = () => {
    const selectedPolicy = policies.find(p => p.id === claimPolicyId);
    const newClaim: Claim = {
      id: `claim_${Date.now()}`,
      policyId: claimPolicyId,
      policyName: selectedPolicy?.name || '',
      description: claimDescription,
      incidentDate: claimDate,
      estimatedAmount: claimAmount,
      submittedAt: new Date().toISOString(),
    };
    setClaims(prev => [newClaim, ...prev]);
    setShowClaimModal(false);
    hapticSuccess();
    setShowToast(true);
  };

  const activeCount = policies.filter(p => p.status === 'active').length;
  const expiringCount = policies.filter(p => p.status === 'expiring_soon').length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
        </Pressable>
        <Text style={styles.headerTitle}>{t('insurance.title', 'Verzekeringen')}</Text>
        <Pressable onPress={() => openClaimForm()} style={styles.backBtn}>
          <Ionicons name="add-circle-outline" size={24} color={Palette.hermesOrange} />
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.hermesOrange} />}>
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="shield-checkmark" size={20} color={SemanticColors.feedbackSuccess} />
            <Text style={[styles.statValue, { color: SemanticColors.feedbackSuccess }]}>{activeCount}</Text>
            <Text style={styles.statLabel}>{t('insurance.active', 'Actief')}</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="alert-circle" size={20} color={SemanticColors.feedbackWarning} />
            <Text style={[styles.statValue, { color: SemanticColors.feedbackWarning }]}>{expiringCount}</Text>
            <Text style={styles.statLabel}>{t('insurance.expiring', 'Verloopt')}</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="documents" size={20} color={Palette.hermesOrange} />
            <Text style={[styles.statValue, { color: Palette.hermesOrange }]}>{policies.length}</Text>
            <Text style={styles.statLabel}>{t('insurance.total', 'Totaal')}</Text>
          </View>
        </View>

        {/* Policies */}
        {policies.map((policy) => {
          const status = getInsuranceStatusConfig(policy.status, t);
          const endDate = new Date(policy.endDate);
          const daysLeft = Math.ceil((endDate.getTime() - Date.now()) / MS_PER_DAY);

          return (
            <Pressable
              key={policy.id}
              style={styles.policyCard}
              onPress={() => Alert.alert(
                policy.name,
                `${t('insurance.insurer', 'Verzekeraar')}: ${policy.provider}\n${t('insurance.coverage', 'Dekking')}: €${policy.coverage?.toLocaleString(undefined) || t('insurance.notApplicable', 'n.v.t.')}\n${t('insurance.endDate', 'Einddatum')}: ${endDate.toLocaleDateString(undefined)}`,
                [
                  { text: t('insurance.cancel', 'Annuleren'), style: 'cancel' },
                  { text: t('insurance.fileClaim', 'Claim indienen'), onPress: () => openClaimForm(policy.id) },
                ]
              )}
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
                    {daysLeft > 0 ? t('insurance.daysRemaining', `Nog ${daysLeft} dagen`) : t('insurance.daysExpired', `${Math.abs(daysLeft)} dagen verlopen`)}
                  </Text>
                </View>
                {policy.coverage && (
                  <Text style={styles.policyAmount}>€{policy.coverage.toLocaleString(undefined)}</Text>
                )}
              </View>
            </Pressable>
          );
        })}

        {policies.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Ionicons name="shield-outline" size={40} color="#CCC" />
            <Text style={styles.emptyText}>{t('insurance.noInsurance', 'Geen verzekeringen gevonden')}</Text>
          </View>
        )}

        {/* Claims section */}
        {claims.length > 0 && (
          <>
            <View style={{ marginTop: 12 }}>
              <Text style={styles.claimsSectionTitle}>{t('insurance.claims', 'Ingediende claims')}</Text>
            </View>
            {claims.map((claim) => (
              <View key={claim.id} style={styles.claimCard}>
                <View style={styles.claimHeader}>
                  <Ionicons name="document-text" size={18} color={Palette.hermesOrange} />
                  <Text style={styles.claimPolicyName}>{claim.policyName}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: SemanticColors.feedbackWarningBg }]}>
                    <Text style={[styles.statusText, { color: SemanticColors.feedbackWarning }]}>
                      {t('insurance.claimPending', 'In behandeling')}
                    </Text>
                  </View>
                </View>
                <Text style={styles.claimDescription} numberOfLines={2}>{claim.description}</Text>
                <View style={styles.claimFooter}>
                  <Text style={styles.claimDetailText}>{claim.incidentDate}</Text>
                  {claim.estimatedAmount ? (
                    <Text style={styles.policyAmount}>€{Number(claim.estimatedAmount).toLocaleString(undefined)}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Claim modal */}
      <Modal visible={showClaimModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('insurance.fileClaim', 'Claim indienen')}</Text>
              <Pressable onPress={() => setShowClaimModal(false)}>
                <Ionicons name="close" size={24} color="#1A1A1A" />
              </Pressable>
            </View>

            {/* Policy selector */}
            <Text style={styles.fieldLabel}>{t('insurance.policyLabel', 'Polis')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 44, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {policies.map(p => (
                  <Pressable
                    key={p.id}
                    style={[styles.policyChip, claimPolicyId === p.id && styles.policyChipActive]}
                    onPress={() => setClaimPolicyId(p.id)}
                  >
                    <Text style={[styles.policyChipText, claimPolicyId === p.id && styles.policyChipTextActive]}>
                      {p.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            {/* Description */}
            <Text style={styles.fieldLabel}>{t('insurance.descriptionLabel', 'Omschrijving')}</Text>
            <TextInput
              style={[styles.fieldInput, { minHeight: 80, textAlignVertical: 'top' }]}
              value={claimDescription}
              onChangeText={setClaimDescription}
              placeholder={t('insurance.descriptionPlaceholder', 'Beschrijf de schade of het incident...')}
              placeholderTextColor="#999"
              multiline
            />

            {/* Date */}
            <Text style={styles.fieldLabel}>{t('insurance.incidentDate', 'Datum incident')}</Text>
            <TextInput
              style={styles.fieldInput}
              value={claimDate}
              onChangeText={setClaimDate}
              placeholder="DD-MM-JJJJ"
              placeholderTextColor="#999"
            />

            {/* Amount */}
            <Text style={styles.fieldLabel}>{t('insurance.estimatedAmount', 'Geschat bedrag')}</Text>
            <TextInput
              style={styles.fieldInput}
              value={claimAmount}
              onChangeText={setClaimAmount}
              placeholder="€ 0,00"
              placeholderTextColor="#999"
              keyboardType="numeric"
            />

            {/* Photos placeholder */}
            <Pressable style={styles.photoPlaceholder}>
              <Ionicons name="camera-outline" size={20} color={Palette.hermesOrange} />
              <Text style={styles.photoPlaceholderText}>{t('insurance.addPhotos', "Foto's toevoegen")}</Text>
            </Pressable>

            {/* Submit */}
            <Pressable
              style={[styles.submitBtn, (!claimDescription || !claimPolicyId) && { opacity: 0.5 }]}
              onPress={submitClaim}
              disabled={!claimDescription || !claimPolicyId}
            >
              <Text style={styles.submitBtnText}>{t('insurance.submitClaim', 'Claim indienen')}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Toast
        message={t('insurance.claimSubmitted', 'Claim ingediend')}
        visible={showToast}
        onHide={() => setShowToast(false)}
        type="success"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: SafeArea.top, paddingBottom: 12,
  },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Manrope_700Bold', color: "#FFFFFF" },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  statCard: {
    flex: 1, alignItems: 'center', backgroundColor: "#14181F", borderRadius: 16, paddingVertical: 14, gap: 4,
  },
  statValue: { fontSize: 20, fontFamily: 'Manrope_700Bold' },
  statLabel: { fontSize: 10, color: '#999' },
  policyCard: {
    backgroundColor: "#14181F", borderRadius: 16, padding: 14, gap: 10,
  },
  policyHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  policyIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  policyInfo: { flex: 1 },
  policyName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: "#FFFFFF" },
  policyProvider: { fontSize: 12, color: '#999', marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  policyFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  policyDetail: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  policyDetailText: { fontSize: 12, color: '#999' },
  policyAmount: { fontSize: 14, fontFamily: 'Manrope_700Bold', color: "#FFFFFF" },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, color: '#999' },
  // Claims section
  claimsSectionTitle: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: "#FFFFFF", marginBottom: 4 },
  claimCard: { backgroundColor: "#14181F", borderRadius: 16, padding: 14, gap: 8, borderLeftWidth: 3, borderLeftColor: SemanticColors.feedbackWarning },
  claimHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  claimPolicyName: { flex: 1, fontSize: 14, fontFamily: 'Inter_600SemiBold', color: "#FFFFFF" },
  claimDescription: { fontSize: 13, color: '#666', lineHeight: 18 },
  claimFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  claimDetailText: { fontSize: 12, color: '#999' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: "#14181F", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 20, paddingBottom: SafeArea.bottom + 16, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontFamily: 'Manrope_700Bold', color: "#FFFFFF" },
  fieldLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#666', marginBottom: 6, marginTop: 8 },
  fieldInput: { backgroundColor: '#F8F8F6', borderRadius: 12, borderWidth: 1, borderColor: '#EEEEEE', paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: "#FFFFFF" },
  policyChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: "#1C2128", borderWidth: 1, borderColor: '#EEE' },
  policyChipActive: { backgroundColor: Palette.hermesOrange + '15', borderColor: Palette.hermesOrange },
  policyChipText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#666' },
  policyChipTextActive: { color: Palette.hermesOrange, fontFamily: 'Inter_600SemiBold' },
  photoPlaceholder: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, borderColor: Palette.hermesOrange, borderStyle: 'dashed', marginTop: 12 },
  photoPlaceholderText: { fontSize: 14, color: Palette.hermesOrange, fontFamily: 'Inter_500Medium' },
  submitBtn: { backgroundColor: Palette.hermesOrange, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  submitBtnText: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: '#fff' },
});

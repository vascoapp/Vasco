// =============================================================================
// VERZEKERING - Insurance Policies Overview
// =============================================================================

import { useState, useMemo, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, RefreshControl, Modal, TextInput, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Palette, SemanticColors } from '../../src/theme/colors';
import { DK } from '../../src/theme/draftkings';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { useInsurancePolicies } from '../../src/services/complianceService';
import { useAuth } from '../../src/context/AuthContext';
import { formatCurrency } from '../../src/i18n/formatting';
import type { Country } from '../../src/i18n/formatting';
import { Toast } from '../../src/components/shared/Toast';
import { hapticSuccess } from '../../src/utils/haptics';
import { showPhotoPicker } from '../../src/utils/photoPicker';
import { MS_PER_DAY } from '../../src/utils/timeConstants';

type IconName = keyof typeof Ionicons.glyphMap;

// A claim recorded here is a LOCAL DOSSIER, not a filed claim.
//
// Vasco has no insurer integration — EU trade insurers accept claims by
// phone or through their own portal, there is no API to post to. This screen
// previously wrote the claim to AsyncStorage, toasted "Claim ingediend"
// (claim submitted) and badged it "In behandeling" (under review), so a
// contractor could believe their insurer was processing a claim that had
// never left the phone — with a reporting deadline quietly running out.
//
// The record is still worth keeping (description, date, amount and photos
// captured while the damage is fresh is exactly what the insurer asks for),
// so the fix is honesty, not deletion: the claim stays a draft until the
// contractor reports it themselves, and `reportedAt` records when they did.
interface Claim {
  id: string;
  policyId: string;
  policyName: string;
  description: string;
  incidentDate: string;
  estimatedAmount: string;
  /** When the contractor saved this record in Vasco. */
  submittedAt: string;
  /** Set only once the contractor confirms they reported it to the insurer. */
  reportedAt?: string;
  /** Local photo URIs captured as evidence. */
  photos?: string[];
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
  const { user } = useAuth();
  const country = (user?.country ?? 'NL') as Country;
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
  const [claimPhotos, setClaimPhotos] = useState<string[]>([]);
  const [showToast, setShowToast] = useState(false);

  const openClaimForm = (policyId?: string) => {
    setClaimPolicyId(policyId || (policies.length > 0 ? policies[0].id : ''));
    setClaimDescription('');
    setClaimDate('');
    setClaimAmount('');
    setClaimPhotos([]);
    setShowClaimModal(true);
  };

  const saveClaim = () => {
    const selectedPolicy = policies.find(p => p.id === claimPolicyId);
    const newClaim: Claim = {
      id: `claim_${Date.now()}`,
      policyId: claimPolicyId,
      policyName: selectedPolicy?.name || '',
      description: claimDescription,
      incidentDate: claimDate,
      estimatedAmount: claimAmount,
      submittedAt: new Date().toISOString(),
      photos: claimPhotos,
    };
    setClaims(prev => [newClaim, ...prev]);
    setShowClaimModal(false);
    hapticSuccess();
    setShowToast(true);
  };

  // Hands the contractor off to the insurer, since Vasco cannot file for
  // them, then lets them record that they did it.
  const reportClaim = (claim: Claim) => {
    const policy = policies.find(p => p.id === claim.policyId);
    const phone = policy?.contactPhone;

    Alert.alert(
      t('insurance.reportTitle', 'Melden bij verzekeraar'),
      t('insurance.reportBody', {
        defaultValue:
          'Vasco cannot file this claim for you — your insurer only accepts claims by phone or through their own portal. Quote policy number {{number}} ({{policy}}).',
        number: policy?.policyNumber || t('insurance.notApplicable', 'n.v.t.'),
        policy: claim.policyName,
      }),
      [
        { text: t('insurance.cancel', 'Annuleren'), style: 'cancel' },
        ...(phone
          ? [{
              text: t('insurance.callInsurer', 'Bel verzekeraar'),
              onPress: () => { Linking.openURL(`tel:${phone.replace(/[^+\d]/g, '')}`).catch(() => {}); },
            }]
          : []),
        {
          text: t('insurance.markReported', 'Markeer als gemeld'),
          onPress: () => {
            setClaims(prev => prev.map(c =>
              c.id === claim.id ? { ...c, reportedAt: new Date().toISOString() } : c,
            ));
            hapticSuccess();
          },
        },
      ],
    );
  };

  const activeCount = policies.filter(p => p.status === 'active').length;
  const expiringCount = policies.filter(p => p.status === 'expiring_soon').length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#1A1A1A" />
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
                `${t('insurance.insurer', 'Verzekeraar')}: ${policy.provider}\n${t('insurance.coverage', 'Dekking')}: ${policy.coverage ? formatCurrency(policy.coverage, country) : t('insurance.notApplicable', 'n.v.t.')}\n${t('insurance.endDate', 'Einddatum')}: ${endDate.toLocaleDateString(undefined)}`,
                [
                  { text: t('insurance.cancel', 'Annuleren'), style: 'cancel' },
                  { text: t('insurance.recordClaim', 'Claim vastleggen'), onPress: () => openClaimForm(policy.id) },
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
                  <Ionicons name="calendar-outline" size={13} color={DK.colors.textMuted} />
                  <Text style={styles.policyDetailText}>
                    {daysLeft > 0 ? t('insurance.daysRemaining', { defaultValue: '{{days}} days remaining', days: daysLeft }) : t('insurance.daysExpired', { defaultValue: '{{days}} days expired', days: Math.abs(daysLeft) })}
                  </Text>
                </View>
                {policy.coverage ? (
                  <Text style={styles.policyAmount}>{formatCurrency(policy.coverage, country)}</Text>
                ) : null}
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
            {claims.map((claim) => {
              const reported = !!claim.reportedAt;
              return (
              <View
                key={claim.id}
                style={[
                  styles.claimCard,
                  { borderLeftColor: reported ? SemanticColors.feedbackSuccess : SemanticColors.feedbackWarning },
                ]}
              >
                <View style={styles.claimHeader}>
                  <Ionicons name="document-text" size={18} color={Palette.hermesOrange} />
                  <Text style={styles.claimPolicyName}>{claim.policyName}</Text>
                  {/* Was hardcoded "In behandeling" (under review) on every
                      claim — an insurer status Vasco has no way to know. */}
                  <View style={[styles.statusBadge, {
                    backgroundColor: reported ? SemanticColors.feedbackSuccessBg : SemanticColors.feedbackWarningBg,
                  }]}>
                    <Text style={[styles.statusText, {
                      color: reported ? SemanticColors.feedbackSuccess : SemanticColors.feedbackWarning,
                    }]}>
                      {reported
                        ? t('insurance.claimReported', 'Gemeld bij verzekeraar')
                        : t('insurance.claimNotReported', 'Nog niet gemeld')}
                    </Text>
                  </View>
                </View>
                <Text style={styles.claimDescription} numberOfLines={2}>{claim.description}</Text>
                <View style={styles.claimFooter}>
                  <Text style={styles.claimDetailText}>
                    {claim.incidentDate}
                    {claim.photos && claim.photos.length > 0
                      ? ` · ${t('insurance.photoCount', { defaultValue: '{{count}} photo', count: claim.photos.length })}`
                      : ''}
                  </Text>
                  {claim.estimatedAmount && !Number.isNaN(Number(claim.estimatedAmount)) ? (
                    <Text style={styles.policyAmount}>{formatCurrency(Number(claim.estimatedAmount), country)}</Text>
                  ) : null}
                </View>
                {!reported && (
                  <Pressable style={styles.reportBtn} onPress={() => reportClaim(claim)}>
                    <Ionicons name="call-outline" size={15} color={Palette.hermesOrange} />
                    <Text style={styles.reportBtnText}>{t('insurance.reportToInsurer', 'Melden bij verzekeraar')}</Text>
                  </Pressable>
                )}
              </View>
              );
            })}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Claim modal */}
      <Modal visible={showClaimModal} animationType="slide" transparent onRequestClose={() => setShowClaimModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              {/* "Record", not "file" — the modal writes a local dossier and
                  the disclaimer + button below say Vasco does not send it to
                  the insurer. A "Claim indienen" title contradicted that. */}
              <Text style={styles.modalTitle}>{t('insurance.recordClaim', 'Claim vastleggen')}</Text>
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
              placeholderTextColor={DK.colors.textMuted}
              multiline
            />

            {/* Date */}
            <Text style={styles.fieldLabel}>{t('insurance.incidentDate', 'Datum incident')}</Text>
            <TextInput
              style={styles.fieldInput}
              value={claimDate}
              onChangeText={setClaimDate}
              placeholder="DD-MM-JJJJ"
              placeholderTextColor={DK.colors.textMuted}
            />

            {/* Amount */}
            <Text style={styles.fieldLabel}>{t('insurance.estimatedAmount', 'Geschat bedrag')}</Text>
            <TextInput
              style={styles.fieldInput}
              value={claimAmount}
              onChangeText={setClaimAmount}
              placeholder="€ 0,00"
              placeholderTextColor={DK.colors.textMuted}
              keyboardType="numeric"
            />

            {/* Photos — this Pressable had no onPress at all, so the dashed
                "add photos" box did nothing when tapped. */}
            <Pressable
              style={styles.photoPlaceholder}
              onPress={() => showPhotoPicker(photo => setClaimPhotos(prev => [...prev, photo.uri]))}
            >
              <Ionicons name="camera-outline" size={20} color={Palette.hermesOrange} />
              <Text style={styles.photoPlaceholderText}>
                {claimPhotos.length > 0
                  ? t('insurance.photoCount', { defaultValue: '{{count}} photo', count: claimPhotos.length })
                  : t('insurance.addPhotos', "Foto's toevoegen")}
              </Text>
            </Pressable>

            {/* Save. Labelled "record" rather than "submit": this writes a
                local dossier, it does not reach the insurer. */}
            <Pressable
              style={[styles.submitBtn, (!claimDescription || !claimPolicyId) && { opacity: 0.5 }]}
              onPress={saveClaim}
              disabled={!claimDescription || !claimPolicyId}
            >
              <Text style={styles.submitBtnText}>{t('insurance.recordClaim', 'Claim vastleggen')}</Text>
            </Pressable>
            <Text style={styles.claimDisclaimer}>
              {t('insurance.recordDisclaimer', 'Vasco does not send this to your insurer. Report it to them yourself — we keep the record and remind you.')}
            </Text>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Toast
        message={t('insurance.claimRecorded', 'Claim vastgelegd')}
        visible={showToast}
        onHide={() => setShowToast(false)}
        type="success"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DK.colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: SafeArea.top, paddingBottom: 12,
  },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Archivo_800ExtraBold', color: DK.colors.text, textTransform: 'uppercase', letterSpacing: 1.2 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  statCard: {
    flex: 1, alignItems: 'center', backgroundColor: DK.colors.panel, borderRadius: 16, paddingVertical: 14, gap: 4,
  },
  statValue: { fontSize: 20, fontFamily: 'Archivo_800ExtraBold' },
  statLabel: { fontSize: 10, color: DK.colors.textMuted },
  policyCard: {
    backgroundColor: DK.colors.panel, borderRadius: 16, padding: 14, gap: 10,
  },
  policyHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  policyIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  policyInfo: { flex: 1 },
  policyName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: DK.colors.text },
  policyProvider: { fontSize: 12, color: DK.colors.textMuted, marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  policyFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: DK.colors.border },
  policyDetail: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  policyDetailText: { fontSize: 12, color: DK.colors.textMuted },
  policyAmount: { fontSize: 14, fontFamily: 'Archivo_800ExtraBold', color: DK.colors.text },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, color: DK.colors.textMuted },
  // Claims section
  claimsSectionTitle: { fontSize: 16, fontFamily: 'Archivo_800ExtraBold', color: DK.colors.text, marginBottom: 4 },
  claimCard: { backgroundColor: DK.colors.panel, borderRadius: 16, padding: 14, gap: 8, borderLeftWidth: 3, borderLeftColor: SemanticColors.feedbackWarning },
  claimHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  claimPolicyName: { flex: 1, fontSize: 14, fontFamily: 'Inter_600SemiBold', color: DK.colors.text },
  claimDescription: { fontSize: 13, color: DK.colors.textMuted, lineHeight: 18 },
  claimFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, borderTopWidth: 1, borderTopColor: DK.colors.border },
  claimDetailText: { fontSize: 12, color: DK.colors.textMuted },
  reportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: Palette.hermesOrange,
  },
  reportBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Palette.hermesOrange },
  claimDisclaimer: {
    fontSize: 11, color: DK.colors.textMuted, textAlign: 'center',
    marginTop: 10, lineHeight: 15,
  },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: DK.colors.panel, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 20, paddingBottom: SafeArea.bottom + 16, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontFamily: 'Archivo_800ExtraBold', color: DK.colors.text },
  fieldLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: DK.colors.textMuted, marginBottom: 6, marginTop: 8 },
  fieldInput: { backgroundColor: DK.colors.panel2, borderRadius: 12, borderWidth: 1, borderColor: DK.colors.border, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: DK.colors.text },
  policyChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: DK.colors.panel2, borderWidth: 1, borderColor: DK.colors.border },
  policyChipActive: { backgroundColor: Palette.hermesOrange + '15', borderColor: Palette.hermesOrange },
  policyChipText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: DK.colors.textMuted },
  policyChipTextActive: { color: Palette.hermesOrange, fontFamily: 'Inter_600SemiBold' },
  photoPlaceholder: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, borderColor: Palette.hermesOrange, borderStyle: 'dashed', marginTop: 12 },
  photoPlaceholderText: { fontSize: 14, color: Palette.hermesOrange, fontFamily: 'Inter_500Medium' },
  submitBtn: { backgroundColor: Palette.hermesOrange, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  submitBtnText: { fontSize: 16, fontFamily: 'Archivo_800ExtraBold', color: '#fff' },
});

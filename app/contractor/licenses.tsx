// =============================================================================
// CONTRACTOR LICENSES — US state licensing tracker (R80 US Phase 2 close-out)
// =============================================================================
// US trades carry state-issued operating licenses (Master Plumber, HVAC,
// State Contractor, etc.) that expire on a 1-3 year cycle. Letting one
// lapse voids insurance + triggers per-job fines.
//
// This screen:
//   - Lists all licenses on BusinessProfile.licenses[] with color-coded
//     expiry pills (red <0d, amber <=7d, yellow <=30d, neutral >30d)
//   - Add/edit modal — type dropdown, state, number, expiry date (+ optional
//     issue date + authority)
//   - Tap-to-delete with confirmation
//   - Hidden behind a country gate (renders an "empty state" for non-US)
//
// Data path: this writes to BusinessProfile.licenses via updateBusinessProfile.
// The supabase mapper persists to business_settings.licenses jsonb (migration
// 20260520000001). Vandaag tab + daily push digest read from there for
// expiry warnings.
// =============================================================================

import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useAppState } from '../../src/state/AppState';
import { listUsStates } from '../../src/data/usSalesTax';
import type { ContractorLicense, ContractorLicenseType } from '../../src/domain/business';
import { getExpiringLicenses } from '../../src/services/licenseExpiryService';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { DK } from '../../src/theme/draftkings';

const LICENSE_TYPES: { id: ContractorLicenseType; label: string }[] = [
  { id: 'master_plumber', label: 'Master Plumber' },
  { id: 'master_electrician', label: 'Master Electrician' },
  { id: 'general_contractor', label: 'General Contractor' },
  { id: 'hvac', label: 'HVAC License' },
  { id: 'roofing', label: 'Roofing License' },
  { id: 'gas_fitter', label: 'Gas Fitter' },
  { id: 'epa_608', label: 'EPA 608 (HVAC refrigerant)' },
  { id: 'state_contractor', label: 'State Contractor License' },
  { id: 'other', label: 'Other' },
];

const US_STATES = listUsStates();

export default function LicensesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { businessProfile, updateBusinessProfile } = useAppState();

  const licenses = useMemo(
    () => (businessProfile as { licenses?: ContractorLicense[] })?.licenses ?? [],
    [businessProfile],
  );

  const expiring = useMemo(() => getExpiringLicenses({ licenses }, 30), [licenses]);
  const expiringMap = useMemo(
    () => new Map(expiring.map((e) => [`${e.type}:${e.number}`, e])),
    [expiring],
  );

  const [editing, setEditing] = useState<ContractorLicense | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  // R91: licenses opened to EU contractors. State picker is US-only; for
  // EU users the modal hides the state row + auto-fills with country code
  // ("NL", "DE", etc.) so the type/number/expiry/authority fields are
  // genuinely useful regardless of jurisdiction. EU contractors typically
  // use this for trade-specific licenses (Gas Safe / Meisterbrief /
  // RGE Qualibat) alongside the existing Certificates screen.
  const isUs = businessProfile?.country === 'US';
  const defaultState = businessProfile?.country ?? '';

  const persist = async (next: ContractorLicense[]) => {
    await updateBusinessProfile({ licenses: next } as Partial<typeof businessProfile>);
  };

  const handleSave = async (license: ContractorLicense, original?: ContractorLicense) => {
    const next = original
      ? licenses.map((l) => (l === original ? license : l))
      : [...licenses, license];
    await persist(next);
    setEditing(null);
    setShowAdd(false);
  };

  const handleDelete = (license: ContractorLicense) => {
    Alert.alert(
      t('licenses.delete', 'Delete license'),
      t('licenses.deleteDesc', 'Remove this license from your records?'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: () => persist(licenses.filter((l) => l !== license)),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button">
          <Ionicons name="chevron-back" size={26} color={SemanticColors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {/* R91: generic "Licenses" — was "State licenses" (US-only). EU
              contractors use the same UI for trade licenses (Gas Safe,
              Meisterbrief, RGE Qualibat, etc.) */}
          {t('licenses.title', 'Licenses')}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      {(
        <ScrollView contentContainerStyle={{ padding: GRID.lg, paddingBottom: GRID.xl * 2 }}>
          {licenses.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="ribbon-outline" size={48} color={SemanticColors.textTertiary} />
              <Text style={styles.emptyTitle}>{t('licenses.empty', 'No licenses yet')}</Text>
              <Text style={styles.emptyBody}>
                {t('licenses.emptyBody', 'Add the state contractor licenses you hold so Vasco can warn you 30 days before they expire.')}
              </Text>
            </View>
          ) : (
            licenses.map((l, i) => {
              const exp = expiringMap.get(`${l.type}:${l.number}`);
              const typeLabel = LICENSE_TYPES.find((x) => x.id === l.type)?.label ?? l.type;
              return (
                <Pressable
                  key={`${l.type}-${l.number}-${i}`}
                  style={styles.card}
                  onPress={() => setEditing(l)}
                  onLongPress={() => handleDelete(l)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardType}>{typeLabel}</Text>
                    <Text style={styles.cardMeta}>
                      {l.state} · {l.number}
                    </Text>
                    <Text style={styles.cardExpiry}>
                      {t('licenses.expires', 'Expires')} {l.expiryDate}
                    </Text>
                  </View>
                  {exp ? <ExpiryPill severity={exp.severity} days={exp.daysUntilExpiry} /> : null}
                </Pressable>
              );
            })
          )}

          <Pressable style={styles.addBtn} onPress={() => setShowAdd(true)} accessibilityRole="button">
            <Ionicons name="add-circle" size={22} color={DK.colors.accent} />
            <Text style={styles.addBtnText}>{t('licenses.add', 'Add license')}</Text>
          </Pressable>
        </ScrollView>
      )}

      <LicenseModal
        isUs={isUs}
        defaultState={defaultState}
        visible={showAdd || editing !== null}
        original={editing ?? undefined}
        onClose={() => {
          setShowAdd(false);
          setEditing(null);
        }}
        onSave={handleSave}
        onDelete={editing ? () => handleDelete(editing) : undefined}
      />
    </SafeAreaView>
  );
}

function ExpiryPill({ severity, days }: { severity: 'expired' | 'urgent' | 'soon'; days: number }) {
  const palette = {
    expired: { bg: '#7F1D1D', fg: '#FECACA' },
    urgent: { bg: '#9A3412', fg: '#FED7AA' },
    soon: { bg: '#78350F', fg: '#FDE68A' },
  }[severity];
  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }]}>
      <Text style={[styles.pillText, { color: palette.fg }]}>
        {severity === 'expired' ? 'EXPIRED' : `${days}d`}
      </Text>
    </View>
  );
}

interface LicenseModalProps {
  visible: boolean;
  original?: ContractorLicense;
  onClose: () => void;
  onSave: (license: ContractorLicense, original?: ContractorLicense) => void;
  onDelete?: () => void;
  // R91: US contractors get the state picker; EU contractors get an
  // auto-filled country code in the `state` field instead so the
  // license record still has a jurisdiction stamp.
  isUs: boolean;
  defaultState: string;
}

function LicenseModal({ visible, original, onClose, onSave, onDelete, isUs, defaultState }: LicenseModalProps) {
  const { t } = useTranslation();
  const [type, setType] = useState<ContractorLicenseType>(original?.type ?? 'hvac');
  const [state, setState] = useState(original?.state ?? (isUs ? '' : defaultState));
  const [number, setNumber] = useState(original?.number ?? '');
  const [expiryDate, setExpiryDate] = useState(original?.expiryDate ?? '');
  const [issuingAuthority, setIssuingAuthority] = useState(original?.issuingAuthority ?? '');

  // R91: US requires a 2-letter state. EU contractors can save without it
  // (jurisdiction is implicit in their country profile). Number + expiry
  // are mandatory for both.
  const canSave = (isUs ? state.length === 2 : true)
    && number.trim().length > 0
    && /^\d{4}-\d{2}-\d{2}$/.test(expiryDate);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.backBtn}>
            <Ionicons name="close" size={26} color={SemanticColors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>
            {original ? t('licenses.edit', 'Edit license') : t('licenses.add', 'Add license')}
          </Text>
          <Pressable
            disabled={!canSave}
            onPress={() => onSave({ type, state: state.toUpperCase(), number, expiryDate, issuingAuthority: issuingAuthority || undefined }, original)}
          >
            <Text style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}>
              {t('common.save', 'Save')}
            </Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: GRID.lg }}>
          {/* Type picker */}
          <Text style={styles.label}>{t('licenses.type', 'License type')}</Text>
          <View style={styles.typeGrid}>
            {LICENSE_TYPES.map((opt) => {
              const selected = type === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => setType(opt.id)}
                  style={[styles.typeChip, selected && styles.typeChipSelected]}
                >
                  <Text style={[styles.typeChipText, selected && styles.typeChipTextSelected]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* R91: state picker only for US — EU contractors get the
              defaultState pre-filled (their country code) without a
              picker UI. License-tracking screen is universal but the
              50-state picker stays US-specific. */}
          {isUs ? (
            <>
              <Text style={styles.label}>{t('licenses.state', 'State')}</Text>
              <View style={styles.stateGrid}>
                {US_STATES.map((s) => {
                  const selected = state.toUpperCase() === s.code;
                  return (
                    <Pressable
                      key={s.code}
                      onPress={() => setState(s.code)}
                      style={[styles.stateChip, selected && styles.stateChipSelected]}
                    >
                      <Text style={[styles.stateChipText, selected && styles.stateChipTextSelected]}>
                        {s.code}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          {/* License number */}
          <Text style={styles.label}>{t('licenses.number', 'License number')}</Text>
          <TextInput
            value={number}
            onChangeText={setNumber}
            placeholder="e.g. TACLA85432C"
            placeholderTextColor={SemanticColors.textTertiary}
            style={styles.input}
            autoCapitalize="characters"
          />

          {/* Expiry */}
          <Text style={styles.label}>{t('licenses.expiryDate', 'Expiry date (YYYY-MM-DD)')}</Text>
          <TextInput
            value={expiryDate}
            onChangeText={setExpiryDate}
            placeholder="2027-06-30"
            placeholderTextColor={SemanticColors.textTertiary}
            style={styles.input}
            keyboardType="numeric"
          />

          {/* Issuing authority (optional) */}
          <Text style={styles.label}>{t('licenses.authority', 'Issuing authority (optional)')}</Text>
          <TextInput
            value={issuingAuthority}
            onChangeText={setIssuingAuthority}
            placeholder="e.g. Texas Department of Licensing and Regulation"
            placeholderTextColor={SemanticColors.textTertiary}
            style={styles.input}
          />

          {original && onDelete ? (
            <Pressable onPress={onDelete} style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={18} color="#FECACA" />
              <Text style={styles.deleteBtnText}>{t('licenses.delete', 'Delete license')}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GRID.md,
    paddingVertical: GRID.sm,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  backBtn: { padding: GRID.xs },
  headerTitle: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  saveBtn: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: DK.colors.accent,
    paddingHorizontal: GRID.sm,
  },
  saveBtnDisabled: { opacity: 0.4 },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: GRID.xl,
    gap: GRID.md,
  },
  emptyTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  emptyBody: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
  },
  card: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    padding: GRID.md,
    marginBottom: GRID.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.md,
  },
  cardType: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  cardMeta: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  cardExpiry: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textTertiary,
    marginTop: 4,
  },
  pill: {
    paddingHorizontal: GRID.sm,
    paddingVertical: GRID.xs,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 11,
    fontFamily: TYPE.titleFamily,
    letterSpacing: 0.6,
  },
  addBtn: {
    marginTop: GRID.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: GRID.sm,
    paddingVertical: GRID.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: `${DK.colors.accent}66`,
    backgroundColor: `${DK.colors.accent}11`,
  },
  addBtnText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: DK.colors.accent,
    letterSpacing: 0.8,
  },
  label: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: GRID.sm,
    marginTop: GRID.md,
  },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID.sm },
  typeChip: {
    paddingHorizontal: GRID.md,
    paddingVertical: GRID.sm,
    borderRadius: RADIUS.md,
    backgroundColor: SemanticColors.surfacePrimary,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  typeChipSelected: {
    borderColor: DK.colors.accent,
    backgroundColor: `${DK.colors.accent}22`,
  },
  typeChipText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textPrimary,
  },
  typeChipTextSelected: {
    color: DK.colors.accent,
    fontFamily: TYPE.titleFamily,
  },
  stateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID.xs },
  stateChip: {
    minWidth: 52,
    paddingHorizontal: 10,
    paddingVertical: GRID.xs,
    borderRadius: RADIUS.md,
    backgroundColor: SemanticColors.surfacePrimary,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    alignItems: 'center',
  },
  stateChipSelected: {
    borderColor: DK.colors.accent,
    backgroundColor: `${DK.colors.accent}22`,
  },
  stateChipText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textPrimary,
    letterSpacing: 0.6,
  },
  stateChipTextSelected: {
    color: DK.colors.accent,
    fontFamily: TYPE.titleFamily,
  },
  input: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    borderRadius: RADIUS.md,
    paddingHorizontal: GRID.md,
    paddingVertical: GRID.sm,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary,
  },
  deleteBtn: {
    marginTop: GRID.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: GRID.sm,
    paddingVertical: GRID.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#7F1D1D',
    backgroundColor: '#7F1D1D22',
  },
  deleteBtnText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: '#FECACA',
    letterSpacing: 0.8,
  },
});

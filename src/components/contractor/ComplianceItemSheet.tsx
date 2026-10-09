// =============================================================================
// ADD / EDIT A CERTIFICATE, INSURANCE POLICY OR LICENCE (decision 3a)
// =============================================================================
// The Compliance screen listed these but nothing could add one — every "Add"
// and "Renew" was hidden (DORMANT_CONTROLS.complianceItemEditing). Five facts,
// the same for every type: what it is, its name, who issued it, its number and
// when it runs out. The expiry is the one that matters — the reminders hang on
// it — so it is required; the rest is optional.
//
// Renewing is editing: the contractor types the new expiry date, the old
// reminder cards are withdrawn and the next one is scheduled from the new date.
// =============================================================================

import { useEffect, useState, type ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Modal, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { DK } from '../../theme/draftkings';
import { TYPE, GRID } from '../../theme/tabStyles';
import { SemanticColors } from '../../theme/colors';
import { useKeyboardInset } from '../../hooks/useKeyboardInset';
import { DKLabel } from '../shared/DKLabel';
import { DKMenu } from '../shared/DKMenu';
import { hapticSuccess } from '../../utils/haptics';
import { parseTypedDay, endOfLocalDay, formatTypedDay } from '../../utils/typedDate';
import { useTrackedItems, type TrackedItemType } from '../../services/complianceService';

export interface ComplianceSheetItem {
  id: string;
  type: TrackedItemType;
  name: string;
  issuer?: string;
  number?: string;
  expiryDate: Date;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Edit mode when given. */
  item?: ComplianceSheetItem | null;
  /** Add mode: the type to start on, and a name to prefill (from onboarding). */
  initialType?: TrackedItemType;
  initialName?: string;
}

/** Module-level: declared inside, every render would remount the TextInput. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      {children}
    </View>
  );
}

export function ComplianceItemSheet({ visible, onClose, item, initialType = 'certification', initialName }: Props) {
  const { t } = useTranslation();
  const kbInset = useKeyboardInset();
  const { save, remove } = useTrackedItems();
  const editing = !!item;

  const [type, setType] = useState<TrackedItemType>(initialType);
  const [name, setName] = useState('');
  const [issuer, setIssuer] = useState('');
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');

  // Keyed on the item id + visibility, so a background refresh does not
  // overwrite what is being typed.
  useEffect(() => {
    if (!visible) return;
    setType(item?.type ?? initialType);
    setName(item?.name ?? initialName ?? '');
    setIssuer(item?.issuer ?? '');
    setNumber(item?.number ?? '');
    setExpiry(item ? formatTypedDay(item.expiryDate) : '');
    // The requested type/name too: "add licence" while the sheet is open must
    // not stay on "certificate".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, item?.id, initialType, initialName]);

  const typeLabel = (k: TrackedItemType) =>
    k === 'insurance' ? t('complianceSheet.typeInsurance', 'Insurance policy')
      : k === 'license' ? t('complianceSheet.typeLicense', 'Licence or permit')
      : t('complianceSheet.typeCertificate', 'Certificate');

  const handleSave = () => {
    const cleanName = name.trim();
    if (!cleanName) return;
    const day = parseTypedDay(expiry);
    if (!day) {
      Alert.alert(
        t('complianceSheet.badDateTitle', 'Expiry date'),
        t('complianceSheet.badDateBody', 'Type the date day first, for example {{example}}.', { example: t('complianceSheet.dateExample', '31-12-2027') }),
      );
      return;
    }
    save({ id: item?.id, type, name: cleanName, issuer, number, expiryDate: endOfLocalDay(day) });
    hapticSuccess();
    onClose();
  };

  const handleDelete = () => {
    if (!item) return;
    Alert.alert(
      t('complianceSheet.deleteTitle', 'Delete?'),
      t('complianceSheet.deleteBody', '{{name}} and its reminders are removed.', { name: item.name }),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        { text: t('common.delete', 'Delete'), style: 'destructive', onPress: () => { remove(item.id); onClose(); } },
      ],
    );
  };

  const disabled = !name.trim() || !expiry.trim();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView enabled={Platform.OS === 'ios'} behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={s.overlay} onPress={onClose}>
          <Pressable style={[s.sheet, kbInset ? { paddingBottom: kbInset + GRID.md } : null]} onPress={(e) => e.stopPropagation()}>
            <View style={s.handle} />
            <DKLabel style={s.title}>
              {editing ? t('complianceSheet.editTitle', 'Edit') : t('complianceSheet.addTitle', 'Add')}
            </DKLabel>
            <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
              <Field label={t('complianceSheet.type', 'Type')}>
                <DKMenu
                  accessibilityLabel={t('complianceSheet.type', 'Type')}
                  items={(['certification', 'insurance', 'license'] as TrackedItemType[]).map((k) => ({
                    key: k, label: typeLabel(k), selected: k === type, onPress: () => setType(k),
                  }))}
                  renderAnchor={(open) => (
                    <Pressable style={[s.input, s.anchor]} onPress={open} accessibilityRole="button" accessibilityLabel={`${t('complianceSheet.type', 'Type')}: ${typeLabel(type)}`}>
                      <Text style={s.anchorText}>{typeLabel(type)}</Text>
                      <Ionicons name="chevron-down" size={16} color={DK.colors.text} />
                    </Pressable>
                  )}
                />
              </Field>
              <Field label={t('complianceSheet.name', 'Name *')}>
                <TextInput style={s.input} value={name} onChangeText={setName} placeholder={t('complianceSheet.namePlaceholder', 'e.g. liability insurance')} placeholderTextColor={SemanticColors.placeholder} autoFocus={!editing && !initialName} />
              </Field>
              <Field label={t('complianceSheet.expiry', 'Valid until *')}>
                <TextInput style={s.input} value={expiry} onChangeText={setExpiry} placeholder={t('complianceSheet.datePlaceholder', 'DD-MM-YYYY')} placeholderTextColor={SemanticColors.placeholder} keyboardType="numbers-and-punctuation" autoCorrect={false} maxLength={10} autoFocus={editing} />
              </Field>
              <Field label={type === 'insurance' ? t('complianceSheet.insurer', 'Insurer') : t('complianceSheet.issuer', 'Issued by')}>
                <TextInput style={s.input} value={issuer} onChangeText={setIssuer} />
              </Field>
              <Field label={type === 'insurance' ? t('complianceSheet.policyNumber', 'Policy number') : t('complianceSheet.number', 'Number')}>
                <TextInput style={s.input} value={number} onChangeText={setNumber} autoCapitalize="characters" autoCorrect={false} />
              </Field>
              <Text style={s.hint}>
                {t('complianceSheet.reminderHint', 'Vasco reminds you in the two weeks before it runs out. To renew, change the date here.')}
              </Text>
            </ScrollView>
            <Pressable style={[s.submit, disabled && { opacity: 0.5 }]} onPress={handleSave} disabled={disabled} accessibilityRole="button">
              <LinearGradient colors={[DK.colors.primaryDark, DK.colors.primary, DK.colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <DKLabel style={s.submitText}>{t('common.save', 'Save')}</DKLabel>
            </Pressable>
            {editing && (
              <Pressable style={s.delete} onPress={handleDelete} accessibilityRole="button">
                <Text style={s.deleteText}>{t('common.delete', 'Delete')}</Text>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: SemanticColors.surfaceOverlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: DK.colors.panel,
    borderTopLeftRadius: DK.radius.card, borderTopRightRadius: DK.radius.card,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: DK.colors.border,
    padding: GRID.lg - 4, paddingBottom: GRID.xl + 8, gap: GRID.sm,
    maxHeight: '88%',
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: DK.colors.border, alignSelf: 'center', marginBottom: GRID.sm },
  title: { fontFamily: DK.type.display900, fontSize: TYPE.titleSize, color: DK.colors.text, letterSpacing: 1.8 },
  scroll: { flexGrow: 0 },
  scrollContent: { gap: GRID.sm, paddingBottom: GRID.xs },
  field: { gap: 4 },
  // Form labels are WHITE (user, 2026-09-22).
  label: { fontFamily: DK.type.body500, fontSize: TYPE.labelSize, color: DK.colors.text },
  hint: { fontFamily: DK.type.body400, fontSize: TYPE.captionSize, color: DK.colors.text, marginTop: GRID.xs },
  input: {
    backgroundColor: DK.colors.panel2,
    borderRadius: DK.radius.button,
    borderWidth: 1, borderColor: DK.colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: TYPE.bodySize,
    fontFamily: DK.type.body500,
    color: DK.colors.text,
  },
  anchor: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  anchorText: { fontSize: TYPE.bodySize, fontFamily: DK.type.body500, color: DK.colors.text },
  submit: {
    borderRadius: DK.radius.button,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: GRID.xs,
  },
  submitText: { fontFamily: DK.type.display900, fontSize: TYPE.captionSize, color: DK.colors.text, letterSpacing: 1.4 },
  delete: { alignItems: 'center', paddingVertical: GRID.sm },
  deleteText: { fontFamily: DK.type.body600, fontSize: TYPE.captionSize, color: DK.colors.textMuted },
});

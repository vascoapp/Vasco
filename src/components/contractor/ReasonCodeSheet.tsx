// =============================================================================
// REASON CODE SHEET — one-tap "why did you change this?" bottom sheet
// =============================================================================
// Triggered right after the contractor edits an AI-prefilled quote line.
// UX target: answer in < 2 seconds. No typing unless they pick "Other".
// =============================================================================

import { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../theme/colors';
import { TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { REASON_CODES, type ReasonCode, getChipOrder } from '../../services/reasonCodeService';

interface Props {
  visible: boolean;
  lineLabel?: string;
  originalQty?: number;
  newQty?: number;
  onDismiss: () => void;
  onPick: (code: ReasonCode, freeText?: string) => void;
}

export function ReasonCodeSheet({ visible, lineLabel, originalQty, newQty, onDismiss, onPick }: Props) {
  const { t } = useTranslation();
  const [order, setOrder] = useState<ReasonCode[]>(REASON_CODES);
  const [picked, setPicked] = useState<ReasonCode | null>(null);
  const [freeText, setFreeText] = useState('');

  useEffect(() => {
    if (!visible) return;
    setPicked(null);
    setFreeText('');
    getChipOrder().then(setOrder).catch(() => {});
  }, [visible]);

  const handlePick = (code: ReasonCode) => {
    if (code === 'other') {
      setPicked(code);
      return;
    }
    onPick(code);
  };

  const handleSubmitOther = () => {
    onPick('other', freeText.trim() || undefined);
  };

  const labelFor = (code: ReasonCode): string => {
    switch (code) {
      case 'waste_underestimated':    return t('reasonCode.wasteUnderestimated', 'More waste than expected');
      case 'measurement_correction':  return t('reasonCode.measurementCorrection', 'Measurement was off');
      case 'labor_underestimated':    return t('reasonCode.laborUnderestimated', 'Labor took longer');
      case 'customer_upgrade':        return t('reasonCode.customerUpgrade', 'Customer chose premium');
      case 'local_supplier_cheaper':  return t('reasonCode.localSupplierCheaper', 'Local supplier cheaper');
      case 'site_condition_harder':   return t('reasonCode.siteConditionHarder', 'Site harder than expected');
      case 'other':                   return t('reasonCode.other', 'Other reason');
    }
  };

  const iconFor = (code: ReasonCode): any => {
    switch (code) {
      case 'waste_underestimated':    return 'trash-outline';
      case 'measurement_correction':  return 'resize-outline';
      case 'labor_underestimated':    return 'time-outline';
      case 'customer_upgrade':        return 'star-outline';
      case 'local_supplier_cheaper':  return 'cash-outline';
      case 'site_condition_harder':   return 'construct-outline';
      case 'other':                   return 'ellipsis-horizontal';
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        {/* KeyboardAvoidingView — `backdrop` is `justifyContent: 'flex-end'`
            and iOS does not lift a Modal above the keyboard, so the free-text
            reason box and the confirm button sat behind it. Fourth site of
            this class; invisible on the simulator's hardware keyboard. */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <Text style={styles.title}>{t('reasonCode.title', 'Why did you change this?')}</Text>
          {lineLabel && (
            <Text style={styles.subtitle}>
              {lineLabel}
              {originalQty !== undefined && newQty !== undefined && (
                <Text style={styles.subtitleDelta}>  ·  {originalQty} → {newQty}</Text>
              )}
            </Text>
          )}
          <Text style={styles.hint}>{t('reasonCode.hint', 'Helps Vasco give better estimates next time.')}</Text>

          {picked === 'other' ? (
            <View style={{ gap: GRID.sm }}>
              <TextInput
                style={styles.input}
                placeholder={t('reasonCode.otherPlaceholder', 'Briefly, what was it?')}
                placeholderTextColor={SemanticColors.textTertiary}
                value={freeText}
                onChangeText={setFreeText}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSubmitOther}
              />
              <Pressable style={styles.primaryBtn} onPress={handleSubmitOther}>
                <Text style={styles.primaryBtnText}>{t('common.save', 'Save')}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.chipGrid}>
              {order.map((code) => (
                <Pressable key={code} style={styles.chip} onPress={() => handlePick(code)} accessibilityRole="button">
                  <Ionicons name={iconFor(code)} size={16} color={Palette.hermesOrange} />
                  <Text style={styles.chipText}>{labelFor(code)}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <Pressable style={styles.skipBtn} onPress={onDismiss} accessibilityRole="button">
            <Text style={styles.skipText}>{t('reasonCode.skip', 'Skip')}</Text>
          </Pressable>
        </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: GRID.lg,
    paddingBottom: GRID.xl,
    gap: GRID.md,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: SemanticColors.borderMuted,
    alignSelf: 'center',
  },
  title: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary },
  subtitle: { fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textSecondary },
  subtitleDelta: { fontSize: TYPE.captionSize, fontFamily: TYPE.bodyFamily, color: Palette.hermesOrange },
  hint: { fontSize: TYPE.tinySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textTertiary, marginBottom: GRID.xs },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: GRID.md, paddingVertical: GRID.sm + 2,
    borderRadius: RADIUS.full,
    backgroundColor: Palette.hermesOrange + '12',
    borderWidth: 1, borderColor: Palette.hermesOrange + '30',
  },
  chipText: { fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  input: {
    borderWidth: 1, borderColor: SemanticColors.borderMuted, borderRadius: RADIUS.md,
    padding: GRID.sm + 2, fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary, minHeight: 44,
  },
  primaryBtn: {
    backgroundColor: Palette.hermesOrange, borderRadius: RADIUS.md,
    paddingVertical: GRID.sm + 4, alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily },
  skipBtn: { alignSelf: 'center', paddingVertical: GRID.sm, paddingHorizontal: GRID.lg },
  skipText: { fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textSecondary },
});

// =============================================================================
// PRICEBOOK EDITOR — one service, priced
// =============================================================================
// Reached from the pricebook list. `new` creates; any other id edits.
//
// The cost fields are deliberately optional and deliberately labelled as COSTS
// rather than rates. A contractor who only knows what they charge is a normal
// contractor, and the screen must not push them to invent a cost breakdown to
// get past a validator — an invented cost produces an invented margin, which is
// worse than no margin at all. When they do fill them in, margin appears and
// "price this for me" becomes available.
// =============================================================================

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Switch } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../../src/theme/tabStyles';
import { SafeArea } from '../../../src/theme/spacing';
import { hapticSuccess } from '../../../src/utils/haptics';
import { DKScreenHeader } from '../../../src/components/shared/DKScreenHeader';
import { formatCurrency } from '../../../src/i18n/formatting';
import { useAuth } from '../../../src/context/AuthContext';
import {
  usePricebook,
  newEntry,
  validateEntry,
  costOf,
  marginOf,
  suggestPrice,
  type PricebookEntry,
  type PricebookCategory,
  type PricebookPricingType,
} from '../../../src/services/pricebookService';

const CATEGORIES: PricebookCategory[] = [
  'callout',
  'installation',
  'repairs',
  'maintenance',
  'inspection',
  'preparation',
  'painting',
  'finishing',
  'specialty',
  'consultation',
  'other',
];

const PRICING_TYPES: { type: PricebookPricingType; i18nKey: string; fallback: string }[] = [
  { type: 'fixed', i18nKey: 'pricebook.typeFixed', fallback: 'Fixed price' },
  { type: 'per-unit', i18nKey: 'pricebook.typePerUnit', fallback: 'Per unit' },
  { type: 'hourly', i18nKey: 'pricebook.typeHourly', fallback: 'Hourly' },
];

/** Target margins offered by the "price this for me" row. */
const MARGIN_PRESETS = [20, 30, 40, 50];

export default function PricebookEditorScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const country = user?.country ?? 'NL';
  const { entries, loading, upsert, remove } = usePricebook();

  const isNew = id === 'new';
  const [draft, setDraft] = useState<PricebookEntry | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  // Numeric fields are held as strings while editing: parsing on every
  // keystroke turns "1." into 1 and fights the user's decimal point.
  const [priceText, setPriceText] = useState('');
  const [labourMinutesText, setLabourMinutesText] = useState('');
  const [labourRateText, setLabourRateText] = useState('');
  const [materialsText, setMaterialsText] = useState('');

  useEffect(() => {
    if (draft || loading) return;
    const found = isNew ? newEntry() : entries.find((e) => e.id === id);
    if (!found) {
      // Deleted in another tab, or a stale deep link.
      Alert.alert(t('pricebook.notFoundTitle', 'Service not found'), '', [
        { text: t('common.ok', 'OK'), onPress: () => router.back() },
      ]);
      return;
    }
    setDraft(found);
    setPriceText(found.basePrice ? String(found.basePrice) : '');
    setLabourMinutesText(found.laborMinutes != null ? String(found.laborMinutes) : '');
    setLabourRateText(found.laborCostRate != null ? String(found.laborCostRate) : '');
    setMaterialsText(found.materialsCost != null ? String(found.materialsCost) : '');
  }, [draft, loading, entries, id, isNew, router, t]);

  if (!draft) {
    return <View style={styles.container} />;
  }

  // Accepts both separators: a Dutch keyboard gives a comma and parseFloat
  // would silently read "12,50" as 12.
  const num = (text: string): number | undefined => {
    const cleaned = text.replace(',', '.').trim();
    if (!cleaned) return undefined;
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : undefined;
  };

  const patch = (p: Partial<PricebookEntry>) => setDraft({ ...draft, ...p });

  // The live entry, with the text fields resolved — what validation, margin and
  // the save all read, so the screen can never show one number and store another.
  const resolved: PricebookEntry = {
    ...draft,
    basePrice: num(priceText) ?? 0,
    laborMinutes: num(labourMinutesText),
    laborCostRate: num(labourRateText),
    materialsCost: num(materialsText),
  };

  const errors = validateEntry(resolved);
  const errorFor = (field: string) => (showErrors ? errors.find((e) => e.field === field) : undefined);
  const cost = costOf(resolved);
  const margin = marginOf(resolved);

  const handleSave = async () => {
    if (errors.length > 0) {
      setShowErrors(true);
      return;
    }
    await upsert(resolved);
    hapticSuccess();
    router.back();
  };

  const handleDelete = () => {
    Alert.alert(
      t('pricebook.deleteTitle', 'Delete this service?'),
      t('pricebook.deleteBody', 'Quotes you have already sent are not affected.'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            await remove(draft.id);
            router.back();
          },
        },
      ],
    );
  };

  const applyMarginPreset = (target: number) => {
    const suggested = suggestPrice(resolved, target);
    if (suggested === null) return;
    // Round to cents — an un-rounded 83.33333 on a customer quote reads as a
    // machine, not a price.
    setPriceText(String(Math.round(suggested * 100) / 100));
  };

  return (
    <View style={styles.container}>
      <DKScreenHeader
        title={isNew ? t('pricebook.newTitle', 'New service') : t('pricebook.editTitle', 'Edit service')}
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* --- What it is ------------------------------------------------ */}
        <Text style={styles.sectionLabel}>{t('pricebook.sectionWhat', 'What you sell')}</Text>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('pricebook.name', 'Service name')}</Text>
          <TextInput
            style={[styles.input, errorFor('name') && styles.inputError]}
            value={draft.name}
            onChangeText={(v) => patch({ name: v })}
            placeholder={t('pricebook.namePlaceholder', 'e.g. Boiler service')}
            placeholderTextColor={SemanticColors.textTertiary}
          />
          {errorFor('name') && (
            <Text style={styles.errorText}>{t('pricebook.error.nameRequired', 'Give this service a name')}</Text>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('pricebook.description', 'What it covers')}</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={draft.description}
            onChangeText={(v) => patch({ description: v })}
            placeholder={t('pricebook.descriptionPlaceholder', 'Appears on the quote line')}
            placeholderTextColor={SemanticColors.textTertiary}
            multiline
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('pricebook.category', 'Category')}</Text>
          <View style={styles.chipRow}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                style={[styles.chip, draft.category === cat && styles.chipActive]}
                onPress={() => patch({ category: cat })}
              >
                <Text style={[styles.chipText, draft.category === cat && styles.chipTextActive]}>
                  {t(`pricebook.cat.${cat}`, cat)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* --- What you charge -------------------------------------------- */}
        <Text style={styles.sectionLabel}>{t('pricebook.sectionCharge', 'What you charge')}</Text>

        <View style={styles.field}>
          <View style={styles.chipRow}>
            {PRICING_TYPES.map((pt) => (
              <Pressable
                key={pt.type}
                style={[styles.chip, draft.pricingType === pt.type && styles.chipActive]}
                onPress={() => patch({ pricingType: pt.type })}
              >
                <Text style={[styles.chipText, draft.pricingType === pt.type && styles.chipTextActive]}>
                  {t(pt.i18nKey, pt.fallback)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.field, styles.flex1]}>
            <Text style={styles.fieldLabel}>{t('pricebook.price', 'Price')}</Text>
            <TextInput
              style={[styles.input, errorFor('basePrice') && styles.inputError]}
              value={priceText}
              onChangeText={setPriceText}
              placeholder="0,00"
              placeholderTextColor={SemanticColors.textTertiary}
              keyboardType="decimal-pad"
            />
          </View>

          {draft.pricingType !== 'fixed' && (
            <View style={[styles.field, styles.flex1]}>
              <Text style={styles.fieldLabel}>{t('pricebook.unit', 'Per')}</Text>
              <TextInput
                style={[styles.input, errorFor('unit') && styles.inputError]}
                value={draft.unit ?? ''}
                onChangeText={(v) => patch({ unit: v })}
                placeholder={draft.pricingType === 'hourly' ? t('pricebook.unitHour', 'hour') : t('pricebook.unitExample', 'm²')}
                placeholderTextColor={SemanticColors.textTertiary}
              />
            </View>
          )}
        </View>
        {errorFor('unit') && (
          <Text style={styles.errorText}>{t('pricebook.error.unitRequired', 'Say what the price is per — "€12" alone is not a price a customer can check')}</Text>
        )}
        {errorFor('basePrice') && (
          <Text style={styles.errorText}>{t('pricebook.error.priceRequired', 'Enter a price of zero or more')}</Text>
        )}

        {/* --- What it costs you ------------------------------------------ */}
        <Text style={styles.sectionLabel}>{t('pricebook.sectionCost', 'What it costs you')}</Text>
        <Text style={styles.sectionHint}>
          {t('pricebook.costHint', 'Optional. Fill this in and Vasco can show your margin — leave it blank and no margin is shown, rather than a guessed one.')}
        </Text>

        <View style={styles.row}>
          <View style={[styles.field, styles.flex1]}>
            <Text style={styles.fieldLabel}>{t('pricebook.labourMinutes', 'Labour (minutes)')}</Text>
            <TextInput
              style={styles.input}
              value={labourMinutesText}
              onChangeText={setLabourMinutesText}
              placeholder="0"
              placeholderTextColor={SemanticColors.textTertiary}
              keyboardType="number-pad"
            />
          </View>
          <View style={[styles.field, styles.flex1]}>
            {/* Named for what it is. Feeding a charge-out rate in here reports a
                margin near zero and looks like a bug in the app. */}
            <Text style={styles.fieldLabel}>{t('pricebook.labourCostRate', 'That hour costs you')}</Text>
            <TextInput
              style={styles.input}
              value={labourRateText}
              onChangeText={setLabourRateText}
              placeholder="0,00"
              placeholderTextColor={SemanticColors.textTertiary}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('pricebook.materialsCost', 'Materials cost')}</Text>
          <TextInput
            style={styles.input}
            value={materialsText}
            onChangeText={setMaterialsText}
            placeholder="0,00"
            placeholderTextColor={SemanticColors.textTertiary}
            keyboardType="decimal-pad"
          />
        </View>

        {cost !== null && (
          <View style={styles.marginCard}>
            <View style={styles.marginRow}>
              <Text style={styles.marginLabel}>{t('pricebook.yourCost', 'Your cost')}</Text>
              <Text style={styles.marginValue}>{formatCurrency(cost, country)}</Text>
            </View>
            {margin !== null && (
              <View style={styles.marginRow}>
                <Text style={styles.marginLabel}>{t('pricebook.margin', 'Margin')}</Text>
                <Text
                  style={[
                    styles.marginValue,
                    { color: margin < 0 ? SemanticColors.feedbackError : SemanticColors.feedbackSuccess },
                  ]}
                >
                  {margin.toFixed(0)}%
                </Text>
              </View>
            )}
            {margin !== null && margin < 0 && (
              <Text style={styles.lossWarning}>
                {t('pricebook.lossWarning', 'This service costs more than you charge for it.')}
              </Text>
            )}

            <Text style={styles.presetLabel}>{t('pricebook.priceForMargin', 'Price it for a margin of')}</Text>
            <View style={styles.chipRow}>
              {MARGIN_PRESETS.map((target) => (
                <Pressable key={target} style={styles.chip} onPress={() => applyMarginPreset(target)}>
                  <Text style={styles.chipText}>{target}%</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* --- Availability ----------------------------------------------- */}
        <View style={styles.switchRow}>
          <View style={styles.flex1}>
            <Text style={styles.fieldLabel}>{t('pricebook.active', 'Offer this service')}</Text>
            <Text style={styles.switchHint}>
              {t('pricebook.activeHint', 'Turn off to hide it from quotes without deleting it.')}
            </Text>
          </View>
          <Switch
            value={draft.isActive}
            onValueChange={(v) => patch({ isActive: v })}
            trackColor={{ false: SemanticColors.borderDefault, true: Palette.hermesOrange }}
          />
        </View>

        <Pressable style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>{t('common.save', 'Save')}</Text>
        </Pressable>

        {!isNew && (
          <Pressable style={styles.deleteButton} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={16} color={SemanticColors.feedbackError} />
            <Text style={styles.deleteButtonText}>{t('common.delete', 'Delete')}</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  content: { padding: GRID.md, paddingBottom: SafeArea.bottom + 80, gap: GRID.sm },
  sectionLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.labelFamily,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: GRID.md,
  },
  sectionHint: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.captionSize,
    lineHeight: 18,
    marginBottom: GRID.xs,
  },
  field: { gap: 6 },
  flex1: { flex: 1 },
  row: { flexDirection: 'row', gap: GRID.sm },
  fieldLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.labelFamily,
  },
  input: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    paddingHorizontal: GRID.sm,
    paddingVertical: 12,
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize,
  },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  inputError: { borderColor: SemanticColors.feedbackError },
  errorText: { color: SemanticColors.feedbackError, fontSize: TYPE.captionSize },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID.xs },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  chipActive: {
    backgroundColor: SemanticColors.actionPrimary + '20',
    borderColor: SemanticColors.actionPrimary,
  },
  chipText: { color: SemanticColors.textSecondary, fontSize: TYPE.captionSize },
  chipTextActive: { color: SemanticColors.actionPrimary, fontFamily: TYPE.titleFamily },
  marginCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    padding: GRID.sm,
    gap: GRID.xs,
    marginTop: GRID.xs,
  },
  marginRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  marginLabel: { color: SemanticColors.textSecondary, fontSize: TYPE.bodySize },
  marginValue: { color: SemanticColors.textPrimary, fontSize: TYPE.titleSize, fontFamily: TYPE.sectionFamily },
  lossWarning: { color: SemanticColors.feedbackError, fontSize: TYPE.captionSize },
  presetLabel: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.captionSize,
    marginTop: GRID.xs,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
    marginTop: GRID.md,
  },
  switchHint: { color: SemanticColors.textTertiary, fontSize: TYPE.captionSize },
  saveButton: {
    marginTop: GRID.lg,
    backgroundColor: SemanticColors.actionPrimary,
    borderRadius: RADIUS.full,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonText: { color: Palette.white, fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  deleteButtonText: { color: SemanticColors.feedbackError, fontSize: TYPE.bodySize - 1 },
});

// =============================================================================
// JOB FORMS — define per-trade checklists once, run them on every job
// =============================================================================
// The closeout screen ships one fixed eight-item list for every job and every
// trade. A plumber servicing a boiler and a painter doing an exterior are
// checking entirely different things, and an aannemer running four trades needs
// four lists. This is where those get written.
//
// Deliberately plain: a contractor sets this up once, on a Sunday evening,
// probably never again. The screen that has to be fast is the one where the
// form gets FILLED IN, on site, in the rain.
// =============================================================================

import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Switch, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { SafeArea } from '../../src/theme/spacing';
import { hapticSuccess } from '../../src/utils/haptics';
import { FadeIn } from '../../src/components/shared/FadeIn';
import {
  useJobFormTemplates,
  type JobFormTemplate,
  type JobFormField,
  type JobFormFieldType,
} from '../../src/services/jobFormService';

const TYPE_KEYS: { type: JobFormFieldType; i18nKey: string; icon: string }[] = [
  { type: 'check', i18nKey: 'jobForms.typeCheck', icon: 'checkbox-outline' },
  { type: 'number', i18nKey: 'jobForms.typeNumber', icon: 'speedometer-outline' },
  { type: 'text', i18nKey: 'jobForms.typeText', icon: 'text-outline' },
];

export default function JobFormsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { templates, upsert, remove } = useJobFormTemplates();

  const [editing, setEditing] = useState<JobFormTemplate | null>(null);
  // The editor is reused for both; without this it always claimed "New form".
  const [isNewForm, setIsNewForm] = useState(false);

  const startNew = () => {
    const now = new Date().toISOString();
    setIsNewForm(true);
    setEditing({
      id: `jf-${Date.now()}`,
      name: '',
      // Deliberately NOT prefilled from the profile trade. A solo contractor
      // has one trade, so tagging every form with it narrows nothing and only
      // risks hiding the form from jobs whose trade was never set. An aannemer
      // who genuinely runs four trades sets it themselves.
      trade: undefined,
      fields: [],
      createdAt: now,
      updatedAt: now,
    });
  };

  const addField = () => {
    if (!editing) return;
    const next: JobFormField = {
      id: `fl-${Date.now()}`,
      label: '',
      type: 'check',
      required: false,
      sortOrder: editing.fields.length + 1,
    };
    setEditing({ ...editing, fields: [...editing.fields, next] });
  };

  const patchField = (id: string, patch: Partial<JobFormField>) => {
    if (!editing) return;
    setEditing({
      ...editing,
      fields: editing.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    });
  };

  const removeField = (id: string) => {
    if (!editing) return;
    setEditing({
      ...editing,
      // Renumber so sortOrder stays dense — blankAnswers orders by it.
      fields: editing.fields.filter((f) => f.id !== id).map((f, i) => ({ ...f, sortOrder: i + 1 })),
    });
  };

  const save = useCallback(async () => {
    if (!editing) return;
    // A form with no name is unfindable in the picker on the job screen, and
    // one with no items cannot be completed at all (validateResponse returns
    // empty_template), so both are refused here rather than saved broken.
    // Say why rather than doing nothing. A button that silently no-ops reads
    // as a broken app -- the same dead-CTA class found elsewhere this session.
    if (!editing.name.trim()) {
      Alert.alert(t('jobForms.needName', 'Give the form a name'));
      return;
    }
    if (editing.fields.filter((f) => f.label.trim().length > 0).length === 0) {
      Alert.alert(t('jobForms.needField', 'Add at least one item'));
      return;
    }
    const cleaned = {
      ...editing,
      name: editing.name.trim(),
      fields: editing.fields
        .filter((f) => f.label.trim().length > 0)
        .map((f, i) => ({ ...f, label: f.label.trim(), sortOrder: i + 1 })),
    };
    await upsert(cleaned);
    hapticSuccess();
    setEditing(null);
  }, [editing, upsert, t]);

  const confirmDelete = (tpl: JobFormTemplate) => {
    Alert.alert(t('jobForms.confirmDelete', 'Delete this form?'), t('jobForms.deleteKeepsRecords', ''), [
      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      { text: t('jobForms.delete', 'Delete'), style: 'destructive', onPress: () => remove(tpl.id) },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.back', 'Back')}>
          <Ionicons name="chevron-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('jobForms.title', 'Job forms')}</Text>
        <Pressable onPress={startNew} hitSlop={8}>
          <Ionicons name="add-circle-outline" size={22} color={Palette.hermesOrange} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>{t('jobForms.subtitle', '')}</Text>

        {templates.length === 0 ? (
          <FadeIn>
            <View style={styles.emptyCard}>
              <Ionicons name="clipboard-outline" size={28} color={SemanticColors.textTertiary} />
              <Text style={styles.emptyTitle}>{t('jobForms.empty', 'No forms yet')}</Text>
              <Text style={styles.emptyHint}>{t('jobForms.emptyHint', '')}</Text>
              <Pressable style={styles.emptyBtn} onPress={startNew}>
                <Text style={styles.emptyBtnText}>{t('jobForms.newForm', 'New form')}</Text>
              </Pressable>
            </View>
          </FadeIn>
        ) : (
          templates.map((tpl, i) => (
            <FadeIn key={tpl.id} delay={40 * i}>
              <Pressable style={styles.row} onPress={() => { setIsNewForm(false); setEditing(tpl); }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{tpl.name}</Text>
                  <Text style={styles.rowMeta}>
                    {tpl.trade || t('jobForms.tradeAny', 'All trades')} ·{' '}
                    {t('jobForms.fieldCount', { count: tpl.fields.length })}
                  </Text>
                </View>
                <Pressable hitSlop={8} onPress={() => confirmDelete(tpl)} style={styles.rowDelete}>
                  <Ionicons name="trash-outline" size={16} color={SemanticColors.feedbackError} />
                </Pressable>
                <Ionicons name="chevron-forward" size={18} color={SemanticColors.textSecondary} />
              </Pressable>
            </FadeIn>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Editor */}
      <Modal visible={editing !== null} animationType="slide" onRequestClose={() => setEditing(null)}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Pressable onPress={() => setEditing(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.close', 'Close')}>
              <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
            </Pressable>
            <Text style={styles.headerTitle}>
              {isNewForm ? t('jobForms.newForm', 'New form') : t('jobForms.editForm', 'Edit form')}
            </Text>
            <Pressable onPress={save} hitSlop={8}>
              <Text style={styles.saveText}>{t('jobForms.save', 'Save')}</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>{t('jobForms.formName', 'Name')}</Text>
            <TextInput
              style={styles.input}
              value={editing?.name ?? ''}
              onChangeText={(v) => editing && setEditing({ ...editing, name: v })}
              placeholder={t('jobForms.formNamePlaceholder', '')}
              placeholderTextColor={SemanticColors.textTertiary}
            />

            <View style={styles.fieldsHeader}>
              <Text style={styles.label}>{t('jobForms.fields', 'Items')}</Text>
              <Pressable onPress={addField} hitSlop={8}>
                <Ionicons name="add-circle-outline" size={20} color={Palette.hermesOrange} />
              </Pressable>
            </View>

            {(editing?.fields ?? []).map((f) => (
              <View key={f.id} style={styles.fieldCard}>
                <View style={styles.fieldTopRow}>
                  <TextInput
                    style={[styles.input, styles.fieldLabelInput]}
                    value={f.label}
                    onChangeText={(v) => patchField(f.id, { label: v })}
                    placeholder={t('jobForms.fieldLabelPlaceholder', '')}
                    placeholderTextColor={SemanticColors.textTertiary}
                  />
                  <Pressable hitSlop={8} onPress={() => removeField(f.id)}>
                    <Ionicons name="close-circle" size={20} color={SemanticColors.textTertiary} />
                  </Pressable>
                </View>

                <View style={styles.typeRow}>
                  {TYPE_KEYS.map((tk) => (
                    <Pressable
                      key={tk.type}
                      style={[styles.typeChip, f.type === tk.type && styles.typeChipActive]}
                      onPress={() => patchField(f.id, { type: tk.type })}
                    >
                      <Text style={[styles.typeChipText, f.type === tk.type && styles.typeChipTextActive]}>
                        {t(tk.i18nKey, tk.type)}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.fieldBottomRow}>
                  {/* A reading without its unit is not a record — "1.8" of what? */}
                  {f.type === 'number' && (
                    <TextInput
                      style={[styles.input, styles.unitInput]}
                      value={f.unit ?? ''}
                      onChangeText={(v) => patchField(f.id, { unit: v })}
                      placeholder={t('jobForms.unit', 'Unit')}
                      placeholderTextColor={SemanticColors.textTertiary}
                    />
                  )}
                  <View style={styles.requiredRow}>
                    <Text style={styles.requiredLabel}>{t('jobForms.required', 'Required')}</Text>
                    <Switch
                      value={f.required}
                      onValueChange={(v) => patchField(f.id, { required: v })}
                      trackColor={{ true: Palette.hermesOrange, false: SemanticColors.borderDefault }}
                      thumbColor={Palette.white}
                    />
                  </View>
                </View>
              </View>
            ))}

            <Pressable style={styles.addFieldBtn} onPress={addField}>
              <Ionicons name="add" size={16} color={Palette.hermesOrange} />
              <Text style={styles.addFieldText}>{t('jobForms.addField', 'Add item')}</Text>
            </Pressable>
            <View style={{ height: 60 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: SafeArea.top, paddingHorizontal: GRID.md, paddingBottom: GRID.sm,
  },
  headerTitle: { fontSize: TYPE.titleSize, fontFamily: 'Archivo_700Bold', color: SemanticColors.textPrimary },
  saveText: { fontSize: TYPE.bodySize, fontFamily: 'Inter_700Bold', color: Palette.hermesOrange },
  content: { paddingHorizontal: GRID.md },
  subtitle: { fontSize: TYPE.captionSize, color: SemanticColors.textSecondary, marginBottom: GRID.md },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.sm,
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.md,
    padding: GRID.md, marginBottom: GRID.sm,
  },
  rowTitle: { fontSize: TYPE.bodySize, fontFamily: 'Inter_600SemiBold', color: SemanticColors.textPrimary },
  rowMeta: { fontSize: TYPE.captionSize, color: SemanticColors.textSecondary, marginTop: 2 },
  rowDelete: { padding: 4 },

  emptyCard: {
    alignItems: 'center', gap: GRID.xs,
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, padding: GRID.lg,
  },
  emptyTitle: { fontSize: TYPE.bodySize, fontFamily: 'Inter_600SemiBold', color: SemanticColors.textPrimary },
  emptyHint: { fontSize: TYPE.captionSize, color: SemanticColors.textSecondary, textAlign: 'center' },
  emptyBtn: {
    marginTop: GRID.sm, paddingHorizontal: GRID.md, paddingVertical: GRID.sm,
    borderRadius: RADIUS.md, backgroundColor: Palette.hermesOrange,
  },
  emptyBtnText: { fontSize: TYPE.captionSize, fontFamily: 'Inter_700Bold', color: Palette.white },

  label: { fontSize: TYPE.captionSize, fontFamily: 'Inter_600SemiBold', color: SemanticColors.textSecondary, marginBottom: GRID.xs },
  input: {
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.md,
    padding: GRID.sm, fontSize: TYPE.bodySize, color: SemanticColors.textPrimary,
    marginBottom: GRID.sm,
  },
  fieldsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: GRID.sm },

  fieldCard: {
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.md,
    padding: GRID.sm, marginBottom: GRID.sm,
  },
  fieldTopRow: { flexDirection: 'row', alignItems: 'center', gap: GRID.xs },
  fieldLabelInput: { flex: 1, marginBottom: 0, backgroundColor: PAGE_BG },
  typeRow: { flexDirection: 'row', gap: GRID.xs, marginTop: GRID.sm },
  typeChip: {
    paddingHorizontal: GRID.sm, paddingVertical: 5, borderRadius: RADIUS.sm,
    backgroundColor: PAGE_BG,
  },
  typeChipActive: { backgroundColor: Palette.hermesOrange + '20' },
  typeChipText: { fontSize: TYPE.labelSize, color: SemanticColors.textSecondary },
  typeChipTextActive: { color: Palette.hermesOrange, fontFamily: 'Inter_600SemiBold' },
  fieldBottomRow: { flexDirection: 'row', alignItems: 'center', gap: GRID.sm, marginTop: GRID.sm },
  unitInput: { flex: 1, marginBottom: 0, backgroundColor: PAGE_BG, paddingVertical: 6 },
  requiredRow: { flexDirection: 'row', alignItems: 'center', gap: GRID.xs, marginLeft: 'auto' },
  requiredLabel: { fontSize: TYPE.labelSize, color: SemanticColors.textSecondary },

  addFieldBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: GRID.sm, borderRadius: RADIUS.md,
    backgroundColor: Palette.hermesOrange + '12', marginTop: GRID.xs,
  },
  addFieldText: { fontSize: TYPE.captionSize, fontFamily: 'Inter_600SemiBold', color: Palette.hermesOrange },
});

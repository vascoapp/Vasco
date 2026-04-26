// =============================================================================
// MAINTENANCE CONTRACT — create/edit (R253)
// =============================================================================
// Single screen handles both flows. id === 'new' → create new template.
// Otherwise → load existing + allow edits + delete.
// =============================================================================

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { DK } from '../../../src/theme/draftkings';
import { TYPE, GRID, RADIUS } from '../../../src/theme/tabStyles';
import { DKLabel } from '../../../src/components/shared/DKLabel';
import { DKScreenHeader } from '../../../src/components/shared/DKScreenHeader';
import { useAppState } from '../../../src/state/AppState';
import {
  createRecurring,
  updateRecurring,
  deleteRecurring,
  getAllRecurring,
  type RecurrenceCadence,
  type RecurringJobTemplate,
} from '../../../src/services/recurringJobsService';
import { hapticSuccess, hapticWarning } from '../../../src/utils/haptics';

const CADENCES: { value: RecurrenceCadence; labelKey: string; fallback: string }[] = [
  { value: 'monthly', labelKey: 'recurring.monthly', fallback: 'Monthly' },
  { value: 'quarterly', labelKey: 'recurring.quarterly', fallback: 'Quarterly' },
  { value: 'semiannual', labelKey: 'recurring.semiannual', fallback: 'Semi-annual' },
  { value: 'annual', labelKey: 'recurring.annual', fallback: 'Annual' },
  { value: 'custom', labelKey: 'recurring.custom', fallback: 'Custom' },
];

export default function RecurringEditScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { customers } = useAppState();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [customerId, setCustomerId] = useState<string>('');
  const [cadence, setCadence] = useState<RecurrenceCadence>('annual');
  const [customDays, setCustomDays] = useState('90');
  const [estimatedAmount, setEstimatedAmount] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState('');
  const [reminderDays, setReminderDays] = useState('7');
  const [loaded, setLoaded] = useState(isNew);

  useEffect(() => {
    if (isNew) return;
    getAllRecurring().then((all) => {
      const t = all.find((x) => x.id === id);
      if (!t) return;
      setTitle(t.title);
      setDescription(t.description ?? '');
      setCustomerId(t.customerId);
      setCadence(t.cadence);
      setCustomDays(String(t.customIntervalDays ?? 90));
      setEstimatedAmount(t.estimatedAmount ? String(t.estimatedAmount) : '');
      setEstimatedDuration(t.estimatedDurationHours ? String(t.estimatedDurationHours) : '');
      setReminderDays(String(t.reminderDaysBeforeDue));
      setLoaded(true);
    });
  }, [id, isNew]);

  const customer = (customers ?? []).find((c: any) => c.id === customerId);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert(t('recurring.titleRequired', 'Title required'));
      return;
    }
    if (!customerId) {
      Alert.alert(t('recurring.customerRequired', 'Pick a customer'));
      return;
    }
    const payload: Omit<RecurringJobTemplate, 'id' | 'createdAt' | 'updatedAt' | 'paused'> = {
      title: title.trim(),
      description: description.trim() || undefined,
      customerId,
      customerName: customer?.name,
      cadence,
      customIntervalDays: cadence === 'custom' ? Math.max(7, Math.min(parseInt(customDays, 10) || 90, 365)) : undefined,
      startDate: new Date().toISOString(),
      reminderDaysBeforeDue: parseInt(reminderDays, 10) || 7,
      estimatedAmount: estimatedAmount ? parseFloat(estimatedAmount) : undefined,
      estimatedDurationHours: estimatedDuration ? parseFloat(estimatedDuration) : undefined,
    };
    if (isNew) await createRecurring(payload);
    else await updateRecurring(id, payload);
    hapticSuccess();
    router.back();
  };

  const handleDelete = async () => {
    if (isNew) { router.back(); return; }
    Alert.alert(
      t('recurring.deleteConfirm', 'Delete this maintenance contract?'),
      undefined,
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        { text: t('common.delete', 'Delete'), style: 'destructive', onPress: async () => {
          await deleteRecurring(id);
          hapticWarning();
          router.back();
        } },
      ],
    );
  };

  if (!loaded) {
    return <SafeAreaView style={styles.root}><DKScreenHeader title={t('recurring.loading', 'Loading')} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.root}>
      <DKScreenHeader title={isNew ? t('recurring.newTitle', 'NEW MAINTENANCE') : t('recurring.editTitle', 'EDIT MAINTENANCE')} />
      <ScrollView contentContainerStyle={styles.content}>

        <DKLabel style={styles.section}>{t('recurring.basicInfo', 'BASICS')}</DKLabel>
        <Field label={t('recurring.titleLabel', 'Title')} value={title} onChange={setTitle} placeholder={t('recurring.titlePlaceholder', 'Annual boiler maintenance')} />
        <Field label={t('recurring.descLabel', 'Description (optional)')} value={description} onChange={setDescription} multiline />

        <DKLabel style={styles.section}>{t('recurring.customer', 'CUSTOMER')}</DKLabel>
        <View style={styles.card}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: GRID.md, gap: GRID.sm }}>
            {(customers ?? []).map((c: any) => (
              <Pressable
                key={c.id}
                style={[styles.pill, customerId === c.id && styles.pillActive]}
                onPress={() => setCustomerId(c.id)}
              >
                <Text style={[styles.pillText, customerId === c.id && styles.pillTextActive]}>{c.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <DKLabel style={styles.section}>{t('recurring.cadence', 'CADENCE')}</DKLabel>
        <View style={styles.card}>
          {CADENCES.map((c, idx) => (
            <Pressable
              key={c.value}
              style={[styles.row, idx > 0 && styles.rowBorder, cadence === c.value && styles.rowActive]}
              onPress={() => setCadence(c.value)}
            >
              <Text style={styles.rowLabel}>{t(c.labelKey, c.fallback)}</Text>
              {cadence === c.value && <Ionicons name="checkmark" size={20} color={DK.colors.accent} />}
            </Pressable>
          ))}
        </View>
        {cadence === 'custom' && (
          <Field label={t('recurring.customDays', 'Custom interval (days)')} value={customDays} onChange={setCustomDays} keyboardType="numeric" />
        )}

        <DKLabel style={styles.section}>{t('recurring.estimates', 'ESTIMATES')}</DKLabel>
        <Field label={t('recurring.amount', 'Amount (€)')} value={estimatedAmount} onChange={setEstimatedAmount} keyboardType="numeric" />
        <Field label={t('recurring.durationHours', 'Duration (hours)')} value={estimatedDuration} onChange={setEstimatedDuration} keyboardType="numeric" />
        <Field label={t('recurring.reminderDays', 'Remind X days before due')} value={reminderDays} onChange={setReminderDays} keyboardType="numeric" />

        <Pressable style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>{isNew ? t('common.create', 'CREATE') : t('common.save', 'SAVE')}</Text>
        </Pressable>

        {!isNew && (
          <Pressable style={styles.deleteBtn} onPress={handleDelete}>
            <Ionicons name="trash" size={16} color={DK.colors.danger ?? '#EF4444'} />
            <Text style={styles.deleteBtnText}>{t('recurring.delete', 'Delete contract')}</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

interface FieldProps { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; keyboardType?: 'default' | 'numeric'; }
function Field({ label, value, onChange, placeholder, multiline, keyboardType = 'default' }: FieldProps) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={DK.colors.textMuted}
        multiline={multiline}
        keyboardType={keyboardType}
        style={[styles.field, multiline && { minHeight: 60, textAlignVertical: 'top' }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DK.colors.bg },
  content: { padding: GRID.lg, paddingBottom: GRID.xl * 2, gap: GRID.md },
  section: { color: DK.colors.textMuted, marginTop: GRID.sm },
  fieldLabel: { fontSize: 12, fontFamily: TYPE.captionFamily, color: DK.colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  field: {
    backgroundColor: DK.colors.panel, borderRadius: RADIUS.md, borderWidth: 1, borderColor: DK.colors.border,
    color: DK.colors.text, padding: GRID.md, fontFamily: TYPE.bodyFamily, fontSize: 14,
  },
  card: { backgroundColor: DK.colors.panel, borderRadius: RADIUS.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: GRID.md, paddingVertical: GRID.md },
  rowBorder: { borderTopWidth: 1, borderTopColor: DK.colors.border },
  rowActive: { backgroundColor: DK.colors.accent + '15' },
  rowLabel: { fontSize: 14, fontFamily: TYPE.bodyFamily, color: DK.colors.text },
  pill: {
    paddingHorizontal: GRID.md, paddingVertical: GRID.sm, borderRadius: RADIUS.full,
    backgroundColor: DK.colors.bg, borderWidth: 1, borderColor: DK.colors.border,
  },
  pillActive: { backgroundColor: DK.colors.accent, borderColor: DK.colors.accent },
  pillText: { fontSize: 13, fontFamily: TYPE.bodyFamily, color: DK.colors.text },
  pillTextActive: { color: '#000' },
  saveBtn: {
    marginTop: GRID.md,
    backgroundColor: DK.colors.accent, borderRadius: RADIUS.full, paddingVertical: GRID.md,
    alignItems: 'center', shadowColor: DK.colors.accent, shadowOpacity: 0.4, shadowRadius: 12,
  },
  saveBtnText: { color: '#000', fontFamily: TYPE.titleFamily, fontSize: 14, letterSpacing: 1.4 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: GRID.sm, paddingVertical: GRID.md, marginTop: GRID.sm },
  deleteBtnText: { fontSize: 14, fontFamily: TYPE.bodyFamily, color: DK.colors.danger ?? '#EF4444' },
});

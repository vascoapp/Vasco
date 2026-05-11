// =============================================================================
// EXPENSES — Uitgaven beheer
// =============================================================================
import { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, RefreshControl, Modal, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG } from '../../src/theme/tabStyles';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { useExpenses, useExpenseStats, EXPENSE_CATEGORIES, type ExpenseCategory } from '../../src/services/expenseService';
import { useAppState } from '../../src/state/AppState';
import { useAuth } from '../../src/context/AuthContext';
import { getVATRate } from '../../src/constants/taxRates';
import { formatCurrency } from '../../src/i18n/formatting';
import type { Country } from '../../src/i18n/formatting';
import { hapticSuccess } from '../../src/utils/haptics';
import { FadeIn } from '../../src/components/shared/FadeIn';
import { EmptyState } from '../../src/components/shared/EmptyState';

type IconName = keyof typeof Ionicons.glyphMap;

export default function ExpensesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { expenses, remove, add } = useExpenses();
  const { businessProfile } = useAppState();
  const { user } = useAuth();
  const country = (user?.country ?? 'NL') as Country;
  const vatRate = getVATRate(businessProfile.country ?? 'NL');
  const vatPct = Math.round(vatRate * 100);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDesc, setNewDesc] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newCategory, setNewCategory] = useState<ExpenseCategory>('materiaal');

  const handleAddExpense = () => {
    if (!newDesc.trim() || !newAmount.trim()) return;
    const amt = parseFloat(newAmount) || 0;
    const catDef = EXPENSE_CATEGORIES.find(c => c.id === newCategory);
    add({
      description: newDesc.trim(),
      amount: amt,
      category: newCategory,
      date: new Date(),
      deductible: true,
      deductionPercentage: catDef?.deductionDefault ?? 100,
      vatRate: vatPct,
      vatAmount: amt * vatRate,
    });
    hapticSuccess();
    setNewDesc('');
    setNewAmount('');
    setShowAddForm(false);
  };
  const stats = useExpenseStats();
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRefresh = useCallback(() => { setRefreshing(true); if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); refreshTimerRef.current = setTimeout(() => { setRefreshing(false); hapticSuccess(); }, 600); }, []);

  const filtered = selectedCategory ? expenses.filter(e => e.category === selectedCategory) : expenses;

  const fmt = (n: number) => formatCurrency(n, country);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityLabel={t('common.back', 'Back')}>
          <Ionicons name="chevron-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('expenses.title', 'Uitgaven')}</Text>
          <Text style={styles.headerSubtitle}>{expenses.length} {t('expenses.expensesThisYear', 'uitgaven dit jaar')}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
          onPress={() => setShowAddForm(true)}
          accessibilityLabel={t('expenses.newExpense', 'New expense')}
        >
          <Ionicons name="add" size={22} color={Palette.white} />
        </Pressable>
      </View>

      {/* Add Expense Modal */}
      <Modal visible={showAddForm} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalDismiss} onPress={() => setShowAddForm(false)} accessibilityLabel={t('common.close', 'Close')} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('expenses.newExpense', 'Nieuwe uitgave')}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t('expenses.description', 'Omschrijving')}
              placeholderTextColor={SemanticColors.textTertiary}
              value={newDesc}
              onChangeText={setNewDesc}
            />
            <TextInput
              style={styles.modalInput}
              placeholder={t('expenses.amount', 'Bedrag (€)')}
              placeholderTextColor={SemanticColors.textTertiary}
              value={newAmount}
              onChangeText={setNewAmount}
              keyboardType="decimal-pad"
            />
            <View style={styles.modalCatRow}>
              {EXPENSE_CATEGORIES.slice(0, 4).map(cat => (
                <Pressable
                  key={cat.id}
                  style={[styles.modalCatChip, newCategory === cat.id && styles.modalCatChipActive]}
                  onPress={() => setNewCategory(cat.id)}
                >
                  <Text style={[styles.modalCatChipText, newCategory === cat.id && styles.modalCatChipTextActive]}>
                    {cat.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={({ pressed }) => [styles.modalSubmit, pressed && { opacity: 0.9 }]}
              onPress={handleAddExpense}
            >
              <Text style={styles.modalSubmitText}>{t('expenses.add', 'Toevoegen')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Stats */}
      <FadeIn delay={0} duration={400}>
      <View style={styles.statsCard}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{fmt(stats.totalThisMonth)}</Text>
            <Text style={styles.statLabel}>{t('expenses.thisMonth', 'Deze maand')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{fmt(stats.totalThisYear)}</Text>
            <Text style={styles.statLabel}>{t('expenses.thisYear', 'Dit jaar')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: SemanticColors.feedbackSuccess }]}>{fmt(stats.deductibleThisYear)}</Text>
            <Text style={styles.statLabel}>{t('expenses.deductible', 'Aftrekbaar')}</Text>
          </View>
        </View>
        <View style={styles.vatRow}>
          <Ionicons name="swap-horizontal-outline" size={14} color={Palette.hermesOrange} />
          <Text style={styles.vatText}>{t('expenses.vatReclaimable', 'BTW terug te vorderen')}: {fmt(stats.vatReclaimable)}</Text>
        </View>
      </View>
      </FadeIn>

      {/* Category breakdown */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryBar} contentContainerStyle={styles.categoryBarContent}>
        <Pressable
          style={[styles.catChip, !selectedCategory && styles.catChipActive]}
          onPress={() => setSelectedCategory(null)}
        >
          <Text style={[styles.catText, !selectedCategory && styles.catTextActive]}>{t('expenses.all', 'Alle')}</Text>
        </Pressable>
        {stats.byCategory.map(cat => {
          const config = EXPENSE_CATEGORIES.find(c => c.id === cat.category);
          return (
            <Pressable
              key={cat.category}
              style={[styles.catChip, selectedCategory === cat.category && styles.catChipActive]}
              onPress={() => setSelectedCategory(selectedCategory === cat.category ? null : cat.category)}
            >
              <Ionicons name={(config?.icon ?? 'ellipsis-horizontal') as IconName} size={14} color={selectedCategory === cat.category ? Palette.white : SemanticColors.textSecondary} />
              <Text style={[styles.catText, selectedCategory === cat.category && styles.catTextActive]}>
                {config?.label} ({cat.count})
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Expense list */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.hermesOrange} />}>
        {filtered.length === 0 ? (
          <EmptyState
            icon="receipt-outline"
            title={t('expenses.noExpenses', 'Geen uitgaven')}
            description={selectedCategory ? t('expenses.noExpensesInCategory', 'Geen uitgaven in deze categorie') : t('expenses.addFirstExpense', 'Voeg je eerste uitgave toe via de + knop')}
          />
        ) : filtered.map(expense => {
          const catConfig = EXPENSE_CATEGORIES.find(c => c.id === expense.category);
          return (
            <Pressable
              key={expense.id}
              style={styles.expenseCard}
              onLongPress={() => {
                Alert.alert(t('expenses.deleteExpense', 'Uitgave verwijderen'), `"${expense.description}" ${t('expenses.deleteConfirm', 'verwijderen')}?`, [
                  { text: t('common.cancel', 'Annuleren'), style: 'cancel' },
                  { text: t('common.delete', 'Verwijderen'), style: 'destructive', onPress: () => remove(expense.id) },
                ]);
              }}
            >
              <View style={styles.expenseIcon}>
                <Ionicons name={(catConfig?.icon ?? 'receipt-outline') as IconName} size={18} color={Palette.hermesOrange} />
              </View>
              <View style={styles.expenseInfo}>
                <Text style={styles.expenseName} numberOfLines={1}>{expense.description}</Text>
                <Text style={styles.expenseMeta}>
                  {catConfig?.label}{expense.supplier ? ` · ${expense.supplier}` : ''} · {expense.date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                </Text>
                {expense.jobTitle && (
                  <Text style={styles.expenseJob} numberOfLines={1}>{expense.jobTitle}</Text>
                )}
              </View>
              <View style={styles.expenseRight}>
                <Text style={styles.expenseAmount}>€{expense.amount.toLocaleString(undefined)}</Text>
                {expense.deductible && (
                  <View style={styles.deductBadge}>
                    <Text style={styles.deductText}>{expense.deductionPercentage}% {t('expenses.deduction', 'aftrek')}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: SafeArea.side, paddingTop: SafeArea.top, paddingBottom: Spacing.sm },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 24, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textPrimary, textTransform: 'uppercase', letterSpacing: 1.2 },
  headerSubtitle: { fontSize: 14, color: SemanticColors.textSecondary, marginTop: 2 },
  statsCard: { marginHorizontal: SafeArea.side, backgroundColor: SemanticColors.surfacePrimary, borderRadius: 16, padding: Spacing.md, marginBottom: Spacing.sm },
  statsRow: { flexDirection: 'row', marginBottom: Spacing.sm },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textPrimary },
  statLabel: { fontSize: 10, color: SemanticColors.textSecondary, marginTop: 2, letterSpacing: 0.3 },
  statDivider: { width: 1, backgroundColor: SemanticColors.borderDefault, marginHorizontal: Spacing.xs },
  vatRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Palette.hermesOrange + '08', borderRadius: 8, padding: 8 },
  vatText: { fontSize: 13, fontFamily: 'Archivo_700Bold', color: Palette.hermesOrange },
  categoryBar: { maxHeight: 40, marginBottom: Spacing.sm },
  categoryBarContent: { paddingHorizontal: SafeArea.side, gap: 6 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: SemanticColors.surfacePrimary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  catChipActive: { backgroundColor: Palette.hermesOrange },
  catText: { fontSize: 12, fontFamily: 'Archivo_700Bold', color: SemanticColors.textSecondary },
  catTextActive: { color: Palette.white },
  scrollView: { flex: 1, paddingHorizontal: SafeArea.side },
  expenseCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: SemanticColors.surfacePrimary, borderRadius: 12, padding: Spacing.sm, marginBottom: 6 },
  expenseIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: Palette.hermesOrange + '12', alignItems: 'center', justifyContent: 'center' },
  expenseInfo: { flex: 1 },
  expenseName: { fontSize: 14, fontFamily: 'Archivo_700Bold', color: SemanticColors.textPrimary },
  expenseMeta: { fontSize: 12, color: SemanticColors.textSecondary, marginTop: 1 },
  expenseJob: { fontSize: 11, color: SemanticColors.textTertiary, marginTop: 1 },
  expenseRight: { alignItems: 'flex-end' },
  expenseAmount: { fontSize: 14, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textPrimary },
  deductBadge: { backgroundColor: SemanticColors.feedbackSuccess + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 2 },
  deductText: { fontSize: 10, fontFamily: 'Archivo_700Bold', color: SemanticColors.feedbackSuccess },
  addBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Palette.hermesOrange, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalDismiss: { flex: 1 },
  modalSheet: { backgroundColor: SemanticColors.surfacePrimary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, gap: 12 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: SemanticColors.borderDefault, alignSelf: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 18, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textPrimary },
  modalInput: { backgroundColor: SemanticColors.surfaceBackground, borderRadius: 12, borderWidth: 1, borderColor: SemanticColors.borderDefault, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontFamily: 'Inter_600SemiBold', color: SemanticColors.textPrimary },
  modalCatRow: { flexDirection: 'row', gap: 8 },
  modalCatChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: SemanticColors.surfaceSecondary },
  modalCatChipActive: { backgroundColor: Palette.hermesOrange },
  modalCatChipText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: SemanticColors.textSecondary },
  modalCatChipTextActive: { color: Palette.white },
  modalSubmit: { backgroundColor: Palette.hermesOrange, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  modalSubmitText: { fontSize: 16, fontFamily: 'Archivo_800ExtraBold', color: Palette.white },
});

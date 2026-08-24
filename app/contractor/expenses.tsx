// =============================================================================
// EXPENSES — Uitgaven beheer
// =============================================================================
import { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, RefreshControl, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG } from '../../src/theme/tabStyles';
import { DK } from '../../src/theme/draftkings';
import { DKScreenHeader } from '../../src/components/shared/DKScreenHeader';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { useExpenses, useExpenseStats, EXPENSE_CATEGORIES, type ExpenseCategory } from '../../src/services/expenseService';
import { useAppState } from '../../src/state/AppState';
import { useAuth } from '../../src/context/AuthContext';
import { getVATRate } from '../../src/constants/taxRates';
import { formatCurrency, formatDayMonthAuto } from '../../src/i18n/formatting';
import type { Country } from '../../src/i18n/formatting';
import { hapticSuccess } from '../../src/utils/haptics';
import { FadeIn } from '../../src/components/shared/FadeIn';
import { EmptyState } from '../../src/components/shared/EmptyState';
import { DKMenu } from '../../src/components/shared/DKMenu';

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

  // EXPENSE_CATEGORIES ships hardcoded Dutch labels ("Materiaal", "Voertuig",
  // "Gereedschap", "Kantoor"), so a German contractor was filing tax-relevant
  // expenses under Dutch category names. The ids are the stable key and stay
  // Dutch — they are persisted on every Expense row — while the LABEL resolves
  // at render, the same rule the decision catalogue follows (CLAUDE.md).
  const categoryLabel = useCallback(
    (cat?: { id: ExpenseCategory; label: string }) =>
      cat ? t(`expenses.categories.${cat.id}`, cat.label) : '',
    [t],
  );

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
      {/* Was a bespoke header with a hardcoded `paddingTop: SafeArea.top` (59,
          an iPhone-notch guess), which crowded the title against the status bar
          and looked nothing like the other drill-downs. DKScreenHeader already
          takes a subtitle and right-hand actions — exactly this shape — and it
          derives the inset instead of assuming it. CLAUDE.md names it as the
          convention for drill-down screens. */}
      <DKScreenHeader
        title={t('expenses.title', 'Uitgaven')}
        subtitle={t('expenses.expensesThisYear', { count: expenses.length })}
        actions={[{
          icon: 'add',
          onPress: () => setShowAddForm(true),
          accessibilityLabel: t('expenses.newExpense', 'New expense'),
          tone: DK.colors.accent,
        }]}
      />

      {/* Add Expense Modal */}
      <Modal visible={showAddForm} transparent animationType="slide" onRequestClose={() => setShowAddForm(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalDismiss} onPress={() => setShowAddForm(false)} accessibilityLabel={t('common.close', 'Close')} />
          {/* The sheet sits at flex-end in a plain Modal, so the keyboard
              covered it COMPLETELY the moment the description field was
              focused — both inputs, the category picker and "Hinzufügen" all
              behind it. The expense could not be recorded on a real device at
              all. Same KeyboardAvoidingView pattern customer-crm.tsx already
              uses for its bottom sheet. */}
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ justifyContent: 'flex-end' }}>
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
              /* Labelled excl. btw on purpose: this value drives the BTW-
                 terugvorderbaar figure (amount x vatRate). A contractor typing
                 the receipt TOTAL would overstate the reclaim by 21%. */
              placeholder={t('expenses.amount', 'Bedrag (excl. btw)')}
              placeholderTextColor={SemanticColors.textTertiary}
              value={newAmount}
              onChangeText={setNewAmount}
              keyboardType="decimal-pad"
            />
            {/* Was a chip row over `EXPENSE_CATEGORIES.slice(0, 4)`: an expense
                has exactly ONE category, so this is the one-of-N case CLAUDE.md
                reserves for DKMenu — and the slice made it worse than a clipped
                strip, because Verzekering / Opleiding / Reiskosten / Overig
                could not be chosen AT ALL. Four of eight categories were
                unreachable, and "Overig" is the one you need when the other
                seven do not fit. Same shape as the permit wizard strip (#221). */}
            {/* flex lives on this wrapper, not on the anchor: DKMenu wraps
                renderAnchor in its own View to measure it, so flex on the
                anchor sizes inside a wrapper that has already shrunk to
                content (ui-playbook §2). */}
            <View style={styles.modalCatRow}>
              <View style={{ flex: 1 }}>
              <DKMenu
                accessibilityLabel={t('expenses.category', 'Category')}
                items={EXPENSE_CATEGORIES.map(cat => ({
                  key: cat.id,
                  label: categoryLabel(cat),
                  selected: newCategory === cat.id,
                  onPress: () => setNewCategory(cat.id),
                }))}
                renderAnchor={(open) => (
                  <Pressable style={styles.modalCatAnchor} onPress={open} accessibilityRole="button">
                    <Text style={styles.modalCatAnchorText} numberOfLines={1}>
                      {categoryLabel(EXPENSE_CATEGORIES.find(c => c.id === newCategory))}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={SemanticColors.textSecondary} />
                  </Pressable>
                )}
              />
              </View>
            </View>
            <Pressable
              style={({ pressed }) => [styles.modalSubmit, pressed && { opacity: 0.9 }]}
              onPress={handleAddExpense}
            >
              <Text style={styles.modalSubmitText}>{t('expenses.add', 'Toevoegen')}</Text>
            </Pressable>
          </View>
          </KeyboardAvoidingView>
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
                {categoryLabel(config)} ({cat.count})
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
                  {categoryLabel(catConfig)}{expense.supplier ? ` · ${expense.supplier}` : ''} · {formatDayMonthAuto(expense.date)}
                </Text>
                {expense.jobTitle && (
                  <Text style={styles.expenseJob} numberOfLines={1}>{expense.jobTitle}</Text>
                )}
              </View>
              <View style={styles.expenseRight}>
                <Text style={styles.expenseAmount}>{formatCurrency(expense.amount, country)}</Text>
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalDismiss: { flex: 1 },
  modalSheet: { backgroundColor: SemanticColors.surfacePrimary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, gap: 12 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: SemanticColors.borderDefault, alignSelf: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 18, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textPrimary },
  modalInput: { backgroundColor: SemanticColors.surfaceBackground, borderRadius: 12, borderWidth: 1, borderColor: SemanticColors.borderDefault, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontFamily: 'Inter_600SemiBold', color: SemanticColors.textPrimary },
  modalCatRow: { flexDirection: 'row', gap: 8 },
  modalCatAnchor: {
    // NOT `flex: 1`. DKMenu wraps renderAnchor in its own content-sized View,
    // so a flexing anchor collapses to zero width inside it and the row renders
    // as an empty box — which is exactly what it did on first try. The flex
    // belongs on the wrapper outside DKMenu; the anchor stretches to it.
    // learnings #199 / quote-flow-consolidation §8.
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  modalCatAnchorText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: SemanticColors.textPrimary, flex: 1 },
  modalSubmit: { backgroundColor: Palette.hermesOrange, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  modalSubmitText: { fontSize: 16, fontFamily: 'Archivo_800ExtraBold', color: Palette.white },
});

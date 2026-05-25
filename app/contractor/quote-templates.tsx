// =============================================================================
// QUOTE TEMPLATES — Offerte sjablonen
// =============================================================================
import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, TextInput, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG, TYPE } from '../../src/theme/tabStyles';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { useQuoteTemplates, TEMPLATE_CATEGORIES, localizeTemplate, localizeCategory, type QuoteTemplate, type QuoteTemplateItem, type TemplateCategory } from '../../src/services/quoteTemplateService';
import { useAppState } from '../../src/state/AppState';
import { useAuth } from '../../src/context/AuthContext';
import { useTranslation } from 'react-i18next';
import { getVATRate } from '../../src/constants/taxRates';
import { formatCurrency } from '../../src/i18n/formatting';
import type { Country } from '../../src/i18n/formatting';
import { hapticSuccess } from '../../src/utils/haptics';
import { FadeIn } from '../../src/components/shared/FadeIn';

type IconName = keyof typeof Ionicons.glyphMap;

export default function QuoteTemplatesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { templates, save, use, remove } = useQuoteTemplates();
  const { businessProfile } = useAppState();
  const { user } = useAuth();
  const country = (user?.country ?? 'NL') as Country;
  const vatPct = Math.round(getVATRate(businessProfile.country ?? 'NL') * 100);
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<TemplateCategory>('overig');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');

  const handleCreate = () => {
    // R66 round 11: was a silent return — clicking "Save" with empty
    // fields just dismissed without feedback. Now surfaces the missing
    // field via localized alert.
    if (!newName.trim() || !newItemDesc.trim() || !newItemPrice.trim()) {
      Alert.alert(
        t('quoteTemplates.missingFieldsTitle', 'Fill in all fields'),
        t('quoteTemplates.missingFieldsBody', 'Template needs a name, an item description, and a price.'),
      );
      return;
    }
    const item: QuoteTemplateItem = {
      description: newItemDesc.trim(),
      quantity: 1,
      unit: 'stuk',
      unitPrice: parseFloat(newItemPrice) || 0,
      vatRate: vatPct,
      type: 'labour',
    };
    save(newName.trim(), newCategory, [item]);
    setNewName('');
    setNewCategory('overig');
    setNewItemDesc('');
    setNewItemPrice('');
    setShowCreate(false);
    hapticSuccess();
  };

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); hapticSuccess(); }, 600);
  }, []);

  const filtered = selectedCategory ? templates.filter(t => t.category === selectedCategory) : templates;

  const handleUseTemplate = (template: QuoteTemplate) => {
    use(template.id);
    const localized = localizeTemplate(template, t);
    // R66 round 11: was hardcoded Dutch — every non-NL contractor saw
    // Dutch alerts despite running the app in their language.
    Alert.alert(
      t('quoteTemplates.loadedTitle', 'Template loaded'),
      t('quoteTemplates.loadedBody', '"{{name}}" loaded with {{count}} lines. Adjust the quote for the customer.', { name: localized.displayName, count: template.items.length }),
      [{ text: t('common.ok', 'OK') }],
    );
  };

  const handleDelete = (template: QuoteTemplate) => {
    const localized = localizeTemplate(template, t);
    Alert.alert(
      t('quoteTemplates.deleteTitle', 'Delete template'),
      t('quoteTemplates.deleteBody', 'Delete "{{name}}"?', { name: localized.displayName }),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        { text: t('common.delete', 'Delete'), style: 'destructive', onPress: () => remove(template.id) },
      ],
    );
  };

  const fmt = (n: number) => formatCurrency(n, country);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('quoteTemplates.title', 'Quote templates')}</Text>
          <Text style={styles.headerSubtitle}>{t('quoteTemplates.available', '{{count}} templates available', { count: templates.length })}</Text>
        </View>
        <Pressable onPress={() => setShowCreate(!showCreate)} style={styles.addBtn}>
          <Ionicons name={showCreate ? 'close' : 'add'} size={24} color={Palette.hermesOrange} />
        </Pressable>
      </View>

      {/* Category Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryBar} contentContainerStyle={styles.categoryBarContent}>
        <Pressable
          style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}
          onPress={() => setSelectedCategory(null)}
        >
          <Text style={[styles.categoryText, !selectedCategory && styles.categoryTextActive]}>{t('quoteTemplates.all', 'All')}</Text>
        </Pressable>
        {TEMPLATE_CATEGORIES.map(cat => (
          <Pressable
            key={cat.id}
            style={[styles.categoryChip, selectedCategory === cat.id && styles.categoryChipActive]}
            onPress={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
          >
            <Ionicons
              name={cat.icon as IconName}
              size={14}
              color={selectedCategory === cat.id ? Palette.white : SemanticColors.textSecondary}
            />
            <Text style={[styles.categoryText, selectedCategory === cat.id && styles.categoryTextActive]}>
              {localizeCategory(cat.id, cat.label, t)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Create Form */}
      {showCreate && (
        <View style={styles.createCard}>
          <Text style={styles.createTitle}>{t('quoteTemplates.newTemplate', 'New template')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('quoteTemplates.templateName', 'Template name')}
            placeholderTextColor={SemanticColors.textTertiary}
            value={newName}
            onChangeText={setNewName}
          />
          <Text style={styles.inputLabel}>{t('quoteTemplates.category', 'Category')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 36 }}>
            <View style={styles.catChipRow}>
              {TEMPLATE_CATEGORIES.map(cat => (
                <Pressable
                  key={cat.id}
                  style={[styles.catChip, newCategory === cat.id && styles.catChipActive]}
                  onPress={() => setNewCategory(cat.id)}
                >
                  <Text style={[styles.catChipText, newCategory === cat.id && styles.catChipTextActive]}>
                    {localizeCategory(cat.id, cat.label, t)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <Text style={styles.inputLabel}>{t('quoteTemplates.firstLine', 'First line')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('quoteTemplates.descriptionPlaceholder', 'Description')}
            placeholderTextColor={SemanticColors.textTertiary}
            value={newItemDesc}
            onChangeText={setNewItemDesc}
          />
          <TextInput
            style={styles.input}
            placeholder={t('quoteTemplates.pricePlaceholder', 'Price ex. VAT')}
            placeholderTextColor={SemanticColors.textTertiary}
            value={newItemPrice}
            onChangeText={setNewItemPrice}
            keyboardType="numeric"
          />
          <Pressable
            style={[styles.createBtn, (!newName.trim() || !newItemDesc.trim() || !newItemPrice.trim()) && { opacity: 0.5 }]}
            onPress={handleCreate}
          >
            <Ionicons name="add-circle-outline" size={18} color={Palette.white} />
            <Text style={styles.createBtnText}>{t('quoteTemplates.add', 'Add')}</Text>
          </Pressable>
        </View>
      )}

      {/* Templates List */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.hermesOrange} />}>
        <FadeIn delay={0} duration={400}>
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={40} color={SemanticColors.textTertiary} />
            <Text style={styles.emptyText}>{t('quoteTemplates.noTemplates', 'No templates in this category')}</Text>
          </View>
        ) : (
          filtered.map(template => {
            const isExpanded = expandedId === template.id;
            const catConfig = TEMPLATE_CATEGORIES.find(c => c.id === template.category);
            const localized = localizeTemplate(template, t);
            const catLabel = catConfig ? localizeCategory(catConfig.id, catConfig.label, t) : '';

            return (
              <View key={template.id}>
                <Pressable
                  style={styles.templateCard}
                  onPress={() => setExpandedId(isExpanded ? null : template.id)}
                >
                  <View style={styles.templateIcon}>
                    <Ionicons name={(catConfig?.icon ?? 'document-outline') as IconName} size={22} color={Palette.hermesOrange} />
                  </View>
                  <View style={styles.templateInfo}>
                    <Text style={styles.templateName}>{localized.displayName}</Text>
                    <Text style={styles.templateMeta}>
                      {catLabel} · {t('quoteTemplates.linesCount', '{{count}} lines', { count: template.items.length })} · {fmt(template.subtotal)}
                    </Text>
                    <View style={styles.usageBadge}>
                      <Ionicons name="repeat-outline" size={12} color={SemanticColors.textTertiary} />
                      <Text style={styles.usageText}>{t('quoteTemplates.usedCount', '{{count}}× used', { count: template.usageCount })}</Text>
                    </View>
                  </View>
                  <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={SemanticColors.textTertiary} />
                </Pressable>

                {isExpanded && (
                  <View style={styles.expandedContent}>
                    {localized.displayDescription && (
                      <Text style={styles.expandedDesc}>{localized.displayDescription}</Text>
                    )}

                    {/* Line items */}
                    {localized.displayItems.map((item, idx) => (
                      <View key={idx} style={styles.itemRow}>
                        <Text style={styles.itemDesc} numberOfLines={1}>{item.description}</Text>
                        <Text style={styles.itemQty}>{item.quantity} {item.unit}</Text>
                        <Text style={styles.itemPrice}>{fmt(item.quantity * item.unitPrice)}</Text>
                      </View>
                    ))}

                    <View style={styles.expandedMeta}>
                      {localized.displayDuration && (
                        <View style={styles.metaRow}>
                          <Ionicons name="time-outline" size={14} color={SemanticColors.textSecondary} />
                          <Text style={styles.metaText}>{localized.displayDuration}</Text>
                        </View>
                      )}
                      <View style={styles.metaRow}>
                        <Ionicons name="card-outline" size={14} color={SemanticColors.textSecondary} />
                        <Text style={styles.metaText}>{localized.displayPaymentTerms}</Text>
                      </View>
                    </View>

                    <View style={styles.expandedActions}>
                      <Pressable style={styles.useButton} onPress={() => handleUseTemplate(template)}>
                        <Ionicons name="copy-outline" size={16} color={Palette.white} />
                        <Text style={styles.useButtonText}>{t('quoteTemplates.useTemplate', 'Use template')}</Text>
                      </Pressable>
                      <Pressable style={styles.deleteButton} onPress={() => handleDelete(template)}>
                        <Ionicons name="trash-outline" size={16} color={SemanticColors.feedbackError} />
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}
        <View style={{ height: 40 }} />
        </FadeIn>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: SafeArea.side, paddingTop: SafeArea.top, paddingBottom: Spacing.sm },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 24, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary, textTransform: 'uppercase', letterSpacing: 1.2 },
  headerSubtitle: { fontSize: 14, color: SemanticColors.textSecondary, marginTop: 2 },
  categoryBar: { maxHeight: 40, marginBottom: Spacing.sm },
  categoryBarContent: { paddingHorizontal: SafeArea.side, gap: 6 },
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: SemanticColors.surfacePrimary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  categoryChipActive: { backgroundColor: Palette.hermesOrange },
  categoryText: { fontSize: 12, fontFamily: TYPE.sectionFamily, color: SemanticColors.textSecondary },
  categoryTextActive: { color: Palette.white },
  scrollView: { flex: 1, paddingHorizontal: SafeArea.side },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  emptyText: { fontSize: 14, color: SemanticColors.textTertiary },
  templateCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: SemanticColors.surfacePrimary, borderRadius: 16, padding: Spacing.sm, marginBottom: 6 },
  templateIcon: { width: 44, height: 44, borderRadius: 16, backgroundColor: Palette.hermesOrange + '12', alignItems: 'center', justifyContent: 'center' },
  templateInfo: { flex: 1 },
  templateName: { fontSize: 15, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary },
  templateMeta: { fontSize: 12, color: SemanticColors.textSecondary, marginTop: 2 },
  usageBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  usageText: { fontSize: 11, color: SemanticColors.textTertiary },
  expandedContent: { backgroundColor: SemanticColors.surfacePrimary, marginTop: -6, marginBottom: 6, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, padding: Spacing.sm, paddingTop: Spacing.xs, gap: 6 },
  expandedDesc: { fontSize: 13, color: SemanticColors.textSecondary, marginBottom: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: SemanticColors.borderDefault },
  itemDesc: { flex: 1, fontSize: 12, color: SemanticColors.textPrimary },
  itemQty: { fontSize: 12, color: SemanticColors.textSecondary, marginHorizontal: Spacing.sm },
  itemPrice: { fontSize: 12, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary },
  expandedMeta: { gap: 4, marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12, color: SemanticColors.textSecondary },
  expandedActions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  useButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Palette.hermesOrange, borderRadius: 8, paddingVertical: 10 },
  useButtonText: { fontSize: 14, fontFamily: TYPE.sectionFamily, color: Palette.white },
  deleteButton: { width: 40, height: 40, borderRadius: 8, backgroundColor: SemanticColors.feedbackError + '10', alignItems: 'center', justifyContent: 'center' },
  addBtn: { padding: 4 },
  createCard: {
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: 16, padding: 16,
    gap: 10, marginHorizontal: SafeArea.side, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Palette.hermesOrange + '30',
  },
  createTitle: { fontSize: 16, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary },
  inputLabel: { fontSize: 12, fontFamily: TYPE.sectionFamily, color: SemanticColors.textSecondary, marginTop: 2 },
  input: {
    backgroundColor: SemanticColors.surfaceBackground, borderRadius: 8, paddingHorizontal: 12,
    paddingVertical: 10, fontSize: 14, fontFamily: TYPE.bodyFamily, color: SemanticColors.textPrimary,
    borderWidth: 1, borderColor: SemanticColors.borderDefault,
  },
  catChipRow: { flexDirection: 'row', gap: 6 },
  catChip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: SemanticColors.surfaceBackground, borderWidth: 1, borderColor: SemanticColors.borderDefault,
  },
  catChipActive: { backgroundColor: Palette.hermesOrange, borderColor: Palette.hermesOrange },
  catChipText: { fontSize: 12, fontFamily: TYPE.sectionFamily, color: SemanticColors.textSecondary },
  catChipTextActive: { color: Palette.white },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Palette.hermesOrange, borderRadius: 12, paddingVertical: 12, marginTop: 2,
  },
  createBtnText: { fontSize: 15, fontFamily: TYPE.sectionFamily, color: Palette.white },
});

// =============================================================================
// QUOTE TEMPLATES — Offerte sjablonen
// =============================================================================
import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, TextInput, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG } from '../../src/theme/tabStyles';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { useQuoteTemplates, TEMPLATE_CATEGORIES, type QuoteTemplate, type QuoteTemplateItem, type TemplateCategory } from '../../src/services/quoteTemplateService';
import { hapticSuccess } from '../../src/utils/haptics';
import { FadeIn } from '../../src/components/shared/FadeIn';

type IconName = keyof typeof Ionicons.glyphMap;

export default function QuoteTemplatesScreen() {
  const router = useRouter();
  const { templates, save, use, remove } = useQuoteTemplates();
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<TemplateCategory>('overig');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');

  const handleCreate = () => {
    if (!newName.trim() || !newItemDesc.trim() || !newItemPrice.trim()) return;
    const item: QuoteTemplateItem = {
      description: newItemDesc.trim(),
      quantity: 1,
      unit: 'stuk',
      unitPrice: parseFloat(newItemPrice) || 0,
      vatRate: 21,
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
    Alert.alert(
      'Sjabloon geladen',
      `"${template.name}" is geladen met ${template.items.length} regels. Pas de offerte aan voor de klant.`,
      [{ text: 'OK' }],
    );
  };

  const handleDelete = (template: QuoteTemplate) => {
    Alert.alert('Sjabloon verwijderen', `"${template.name}" verwijderen?`, [
      { text: 'Annuleren', style: 'cancel' },
      { text: 'Verwijderen', style: 'destructive', onPress: () => remove(template.id) },
    ]);
  };

  const fmt = (n: number) => `€${n.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Offerte Sjablonen</Text>
          <Text style={styles.headerSubtitle}>{templates.length} sjablonen beschikbaar</Text>
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
          <Text style={[styles.categoryText, !selectedCategory && styles.categoryTextActive]}>Alle</Text>
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
              color={selectedCategory === cat.id ? '#fff' : SemanticColors.textSecondary}
            />
            <Text style={[styles.categoryText, selectedCategory === cat.id && styles.categoryTextActive]}>
              {cat.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Create Form */}
      {showCreate && (
        <View style={styles.createCard}>
          <Text style={styles.createTitle}>Nieuw sjabloon</Text>
          <TextInput
            style={styles.input}
            placeholder="Sjabloon naam"
            placeholderTextColor={SemanticColors.textTertiary}
            value={newName}
            onChangeText={setNewName}
          />
          <Text style={styles.inputLabel}>Categorie</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 36 }}>
            <View style={styles.catChipRow}>
              {TEMPLATE_CATEGORIES.map(cat => (
                <Pressable
                  key={cat.id}
                  style={[styles.catChip, newCategory === cat.id && styles.catChipActive]}
                  onPress={() => setNewCategory(cat.id)}
                >
                  <Text style={[styles.catChipText, newCategory === cat.id && styles.catChipTextActive]}>
                    {cat.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <Text style={styles.inputLabel}>Eerste regel</Text>
          <TextInput
            style={styles.input}
            placeholder="Omschrijving"
            placeholderTextColor={SemanticColors.textTertiary}
            value={newItemDesc}
            onChangeText={setNewItemDesc}
          />
          <TextInput
            style={styles.input}
            placeholder="Prijs excl. BTW"
            placeholderTextColor={SemanticColors.textTertiary}
            value={newItemPrice}
            onChangeText={setNewItemPrice}
            keyboardType="numeric"
          />
          <Pressable
            style={[styles.createBtn, (!newName.trim() || !newItemDesc.trim() || !newItemPrice.trim()) && { opacity: 0.5 }]}
            onPress={handleCreate}
          >
            <Ionicons name="add-circle-outline" size={18} color="#fff" />
            <Text style={styles.createBtnText}>Toevoegen</Text>
          </Pressable>
        </View>
      )}

      {/* Templates List */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.hermesOrange} />}>
        <FadeIn delay={0} duration={400}>
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={40} color={SemanticColors.textTertiary} />
            <Text style={styles.emptyText}>Geen sjablonen in deze categorie</Text>
          </View>
        ) : (
          filtered.map(template => {
            const isExpanded = expandedId === template.id;
            const catConfig = TEMPLATE_CATEGORIES.find(c => c.id === template.category);

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
                    <Text style={styles.templateName}>{template.name}</Text>
                    <Text style={styles.templateMeta}>
                      {catConfig?.label} · {template.items.length} regels · {fmt(template.subtotal)}
                    </Text>
                    <View style={styles.usageBadge}>
                      <Ionicons name="repeat-outline" size={12} color={SemanticColors.textTertiary} />
                      <Text style={styles.usageText}>{template.usageCount}× gebruikt</Text>
                    </View>
                  </View>
                  <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={SemanticColors.textTertiary} />
                </Pressable>

                {isExpanded && (
                  <View style={styles.expandedContent}>
                    {template.description && (
                      <Text style={styles.expandedDesc}>{template.description}</Text>
                    )}

                    {/* Line items */}
                    {template.items.map((item, idx) => (
                      <View key={idx} style={styles.itemRow}>
                        <Text style={styles.itemDesc} numberOfLines={1}>{item.description}</Text>
                        <Text style={styles.itemQty}>{item.quantity} {item.unit}</Text>
                        <Text style={styles.itemPrice}>{fmt(item.quantity * item.unitPrice)}</Text>
                      </View>
                    ))}

                    <View style={styles.expandedMeta}>
                      {template.estimatedDuration && (
                        <View style={styles.metaRow}>
                          <Ionicons name="time-outline" size={14} color={SemanticColors.textSecondary} />
                          <Text style={styles.metaText}>{template.estimatedDuration}</Text>
                        </View>
                      )}
                      <View style={styles.metaRow}>
                        <Ionicons name="card-outline" size={14} color={SemanticColors.textSecondary} />
                        <Text style={styles.metaText}>{template.defaultPaymentTerms}</Text>
                      </View>
                    </View>

                    <View style={styles.expandedActions}>
                      <Pressable style={styles.useButton} onPress={() => handleUseTemplate(template)}>
                        <Ionicons name="copy-outline" size={16} color="#fff" />
                        <Text style={styles.useButtonText}>Gebruik sjabloon</Text>
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
  headerTitle: { fontSize: 24, fontFamily: 'Manrope_700Bold', color: SemanticColors.textPrimary },
  headerSubtitle: { fontSize: 14, color: SemanticColors.textSecondary, marginTop: 2 },
  categoryBar: { maxHeight: 40, marginBottom: Spacing.sm },
  categoryBarContent: { paddingHorizontal: SafeArea.side, gap: 6 },
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: SemanticColors.surfacePrimary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  categoryChipActive: { backgroundColor: Palette.hermesOrange },
  categoryText: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: SemanticColors.textSecondary },
  categoryTextActive: { color: '#fff' },
  scrollView: { flex: 1, paddingHorizontal: SafeArea.side },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  emptyText: { fontSize: 14, color: SemanticColors.textTertiary },
  templateCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: SemanticColors.surfacePrimary, borderRadius: 16, padding: Spacing.sm, marginBottom: 6 },
  templateIcon: { width: 44, height: 44, borderRadius: 16, backgroundColor: Palette.hermesOrange + '12', alignItems: 'center', justifyContent: 'center' },
  templateInfo: { flex: 1 },
  templateName: { fontSize: 15, fontFamily: 'Manrope_600SemiBold', color: SemanticColors.textPrimary },
  templateMeta: { fontSize: 12, color: SemanticColors.textSecondary, marginTop: 2 },
  usageBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  usageText: { fontSize: 11, color: SemanticColors.textTertiary },
  expandedContent: { backgroundColor: SemanticColors.surfacePrimary, marginTop: -6, marginBottom: 6, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, padding: Spacing.sm, paddingTop: Spacing.xs, gap: 6 },
  expandedDesc: { fontSize: 13, color: SemanticColors.textSecondary, marginBottom: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: SemanticColors.borderDefault },
  itemDesc: { flex: 1, fontSize: 12, color: SemanticColors.textPrimary },
  itemQty: { fontSize: 12, color: SemanticColors.textSecondary, marginHorizontal: Spacing.sm },
  itemPrice: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: SemanticColors.textPrimary },
  expandedMeta: { gap: 4, marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12, color: SemanticColors.textSecondary },
  expandedActions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  useButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Palette.hermesOrange, borderRadius: 8, paddingVertical: 10 },
  useButtonText: { fontSize: 14, fontFamily: 'Manrope_600SemiBold', color: '#fff' },
  deleteButton: { width: 40, height: 40, borderRadius: 8, backgroundColor: SemanticColors.feedbackError + '10', alignItems: 'center', justifyContent: 'center' },
  addBtn: { padding: 4 },
  createCard: {
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: 16, padding: 16,
    gap: 10, marginHorizontal: SafeArea.side, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Palette.hermesOrange + '30',
  },
  createTitle: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: SemanticColors.textPrimary },
  inputLabel: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: SemanticColors.textSecondary, marginTop: 2 },
  input: {
    backgroundColor: SemanticColors.surfaceBackground, borderRadius: 8, paddingHorizontal: 12,
    paddingVertical: 10, fontSize: 14, fontFamily: 'Inter_400Regular', color: SemanticColors.textPrimary,
    borderWidth: 1, borderColor: SemanticColors.borderDefault,
  },
  catChipRow: { flexDirection: 'row', gap: 6 },
  catChip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: SemanticColors.surfaceBackground, borderWidth: 1, borderColor: SemanticColors.borderDefault,
  },
  catChipActive: { backgroundColor: Palette.hermesOrange, borderColor: Palette.hermesOrange },
  catChipText: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: SemanticColors.textSecondary },
  catChipTextActive: { color: '#fff' },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Palette.hermesOrange, borderRadius: 12, paddingVertical: 12, marginTop: 2,
  },
  createBtnText: { fontSize: 15, fontFamily: 'Manrope_600SemiBold', color: '#fff' },
});

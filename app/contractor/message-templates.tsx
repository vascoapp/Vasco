// =============================================================================
// MESSAGE TEMPLATES — CRUD screen for pre-built + custom message templates
// =============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Share,
  Modal,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG, TYPE, GRID, RADIUS } from '../../src/theme/tabStyles';
import { SafeArea } from '../../src/theme/spacing';
import { hapticSuccess } from '../../src/utils/haptics';
import { FadeIn } from '../../src/components/shared/FadeIn';
import { useAuth } from '../../src/context/AuthContext';
import {
  getAllTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  resolveTemplate,
  type MessageTemplate,
  type TemplateCategory,
  type TemplateContext,
} from '../../src/services/messageTemplateService';

type IconName = keyof typeof Ionicons.glyphMap;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_CONFIG: Record<TemplateCategory, { label: string; icon: IconName; color: string }> = {
  reminder: { label: 'Reminder', icon: 'alarm-outline', color: SemanticColors.feedbackWarning },
  'follow-up': { label: 'Follow-up', icon: 'chatbubble-outline', color: '#3B82F6' },
  confirmation: { label: 'Confirmation', icon: 'checkmark-circle-outline', color: SemanticColors.feedbackSuccess },
  'thank-you': { label: 'Thank you', icon: 'heart-outline', color: '#EC4899' },
  custom: { label: 'Custom', icon: 'create-outline', color: Palette.hermesOrange },
};

const ALL_CATEGORIES: TemplateCategory[] = ['reminder', 'follow-up', 'confirmation', 'thank-you', 'custom'];

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function MessageTemplatesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);

  // Editor form state
  const [editorTitle, setEditorTitle] = useState('');
  const [editorBody, setEditorBody] = useState('');
  const [editorCategory, setEditorCategory] = useState<TemplateCategory>('custom');

  const loadTemplates = useCallback(async () => {
    const all = await getAllTemplates();
    setTemplates(all);
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTemplates();
    setRefreshing(false);
    hapticSuccess();
  }, [loadTemplates]);

  const filtered = useMemo(() => {
    if (selectedCategory === 'all') return templates;
    return templates.filter(t => t.category === selectedCategory);
  }, [templates, selectedCategory]);

  // Open editor for new template
  const handleNew = useCallback(() => {
    setEditingTemplate(null);
    setEditorTitle('');
    setEditorBody('');
    setEditorCategory('custom');
    setShowEditor(true);
  }, []);

  // Open editor for existing template
  const handleEdit = useCallback((template: MessageTemplate) => {
    setEditingTemplate(template);
    setEditorTitle(template.title);
    setEditorBody(template.body);
    setEditorCategory(template.category);
    setShowEditor(true);
  }, []);

  // Save from editor
  const handleSave = useCallback(async () => {
    if (!editorTitle.trim() || !editorBody.trim()) {
      Alert.alert(t('common.error', 'Error'), t('templates.fillAllFields', 'Please fill in title and body'));
      return;
    }
    if (editingTemplate && !editingTemplate.isBuiltIn) {
      await updateTemplate(editingTemplate.id, {
        title: editorTitle.trim(),
        body: editorBody.trim(),
        category: editorCategory,
      });
    } else {
      await createTemplate(editorTitle.trim(), editorBody.trim(), editorCategory);
    }
    setShowEditor(false);
    hapticSuccess();
    await loadTemplates();
  }, [editingTemplate, editorTitle, editorBody, editorCategory, loadTemplates, t]);

  // Delete template
  const handleDelete = useCallback((template: MessageTemplate) => {
    if (template.isBuiltIn) return;
    Alert.alert(
      t('templates.delete', 'Delete template'),
      t('templates.deleteConfirm', 'Are you sure you want to delete this template?'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            await deleteTemplate(template.id);
            hapticSuccess();
            await loadTemplates();
          },
        },
      ]
    );
  }, [loadTemplates, t]);

  // Use template — resolve with sample context and share
  const handleUse = useCallback(async (template: MessageTemplate) => {
    const sampleContext: TemplateContext = {
      customer: 'Customer',
      amount: '\u20AC1,500.00',
      date: new Date().toLocaleDateString(),
      jobTitle: 'Job Title',
      invoiceId: 'INV-001',
      daysOverdue: 7,
      contractorName: user?.name || 'Contractor',
    };
    const resolved = resolveTemplate(template, sampleContext);
    try {
      await Share.share({ message: resolved, title: template.title });
    } catch {}
  }, [user?.name]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={22} color={SemanticColors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('templates.title', 'Message Templates')}</Text>
        <Pressable onPress={handleNew} style={styles.addBtn} accessibilityRole="button" accessibilityLabel="New template">
          <Ionicons name="add" size={24} color={Palette.hermesOrange} />
        </Pressable>
      </View>

      {/* Category filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent} style={styles.filterScroll}>
        <Pressable
          style={[styles.filterChip, selectedCategory === 'all' && styles.filterChipActive]}
          onPress={() => setSelectedCategory('all')}
        >
          <Text style={[styles.filterChipText, selectedCategory === 'all' && styles.filterChipTextActive]}>
            {t('templates.all', 'All')}
          </Text>
        </Pressable>
        {ALL_CATEGORIES.map((cat) => {
          const config = CATEGORY_CONFIG[cat];
          const isActive = selectedCategory === cat;
          return (
            <Pressable
              key={cat}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Ionicons name={config.icon} size={14} color={isActive ? Palette.hermesOrange : SemanticColors.textTertiary} />
              <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                {t(`templates.cat_${cat}`, config.label)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Template list */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.hermesOrange} />}
      >
        {filtered.length === 0 ? (
          <FadeIn>
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={48} color={SemanticColors.textDisabled} />
              <Text style={styles.emptyTitle}>{t('templates.empty', 'No templates')}</Text>
              <Text style={styles.emptyDesc}>{t('templates.emptyDesc', 'Create your first message template')}</Text>
            </View>
          </FadeIn>
        ) : (
          filtered.map((template, idx) => {
            const catConfig = CATEGORY_CONFIG[template.category];
            return (
              <FadeIn key={template.id} delay={idx * 60}>
                <Pressable
                  style={({ pressed }) => [styles.templateCard, pressed && { opacity: 0.95, transform: [{ scale: 0.98 }] }]}
                  onPress={() => handleEdit(template)}
                  onLongPress={() => !template.isBuiltIn && handleDelete(template)}
                  accessibilityRole="button"
                  accessibilityLabel={template.title}
                >
                  <View style={[styles.templateIcon, { backgroundColor: catConfig.color + '14' }]}>
                    <Ionicons name={catConfig.icon} size={18} color={catConfig.color} />
                  </View>
                  <View style={styles.templateContent}>
                    <View style={styles.templateHeaderRow}>
                      <Text style={styles.templateTitle} numberOfLines={1}>{template.title}</Text>
                      {template.isBuiltIn && (
                        <View style={styles.builtInBadge}>
                          <Text style={styles.builtInBadgeText}>{t('templates.builtIn', 'Built-in')}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.templatePreview} numberOfLines={2}>
                      {template.body}
                    </Text>
                  </View>
                  <Pressable
                    style={styles.useBtn}
                    onPress={() => handleUse(template)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t('templates.use', 'Use template')}
                  >
                    <Ionicons name="share-outline" size={18} color={Palette.hermesOrange} />
                  </Pressable>
                </Pressable>
              </FadeIn>
            );
          })
        )}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Editor Modal */}
      <Modal visible={showEditor} animationType="slide" transparent onRequestClose={() => setShowEditor(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {editingTemplate
                ? t('templates.edit', 'Edit Template')
                : t('templates.new', 'New Template')}
            </Text>

            {/* Title input */}
            <TextInput
              style={styles.modalInput}
              placeholder={t('templates.titlePlaceholder', 'Template name')}
              placeholderTextColor={SemanticColors.textDisabled}
              value={editorTitle}
              onChangeText={setEditorTitle}
            />

            {/* Category selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.catSelectorRow}>
                {ALL_CATEGORIES.map((cat) => {
                  const config = CATEGORY_CONFIG[cat];
                  const isActive = editorCategory === cat;
                  return (
                    <Pressable
                      key={cat}
                      style={[styles.catChip, isActive && { backgroundColor: config.color + '14' }]}
                      onPress={() => setEditorCategory(cat)}
                    >
                      <Ionicons name={config.icon} size={14} color={isActive ? config.color : SemanticColors.textTertiary} />
                      <Text style={[styles.catChipText, isActive && { color: config.color }]}>
                        {t(`templates.cat_${cat}`, config.label)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {/* Body input */}
            <TextInput
              style={[styles.modalInput, styles.modalBodyInput]}
              placeholder={t('templates.bodyPlaceholder', 'Message body. Use {{customer}}, {{amount}}, {{date}}, {{jobTitle}} for variables.')}
              placeholderTextColor={SemanticColors.textDisabled}
              value={editorBody}
              onChangeText={setEditorBody}
              multiline
              textAlignVertical="top"
            />

            {/* Variable hints */}
            <View style={styles.varHintRow}>
              {['{{customer}}', '{{amount}}', '{{date}}', '{{jobTitle}}'].map((v) => (
                <Pressable
                  key={v}
                  style={styles.varHint}
                  onPress={() => setEditorBody(prev => prev + v)}
                >
                  <Text style={styles.varHintText}>{v}</Text>
                </Pressable>
              ))}
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancel}
                onPress={() => setShowEditor(false)}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel', 'Cancel')}</Text>
              </Pressable>
              <Pressable
                style={styles.modalSubmit}
                onPress={handleSave}
              >
                <Text style={styles.modalSubmitText}>{t('common.save', 'Save')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: GRID.md,
    paddingTop: SafeArea.top,
    paddingBottom: GRID.sm,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
     textTransform: 'uppercase', letterSpacing: 1.2 },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Palette.hermesOrange + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Filter
  filterScroll: {
    maxHeight: 44,
  },
  filterScrollContent: {
    paddingHorizontal: GRID.md,
    gap: GRID.sm,
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.xs,
    paddingHorizontal: GRID.md - 4,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  filterChipActive: {
    backgroundColor: Palette.hermesOrange + '14',
  },
  filterChipText: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textTertiary,
  },
  filterChipTextActive: {
    color: Palette.hermesOrange,
  },

  // List
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: GRID.md,
    paddingTop: GRID.md,
    gap: GRID.sm,
  },

  // Template card
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.md - 2,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
  },
  templateIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateContent: {
    flex: 1,
    gap: GRID.xs,
  },
  templateHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
  },
  templateTitle: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    flex: 1,
  },
  builtInBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: GRID.xs,
    backgroundColor: SemanticColors.feedbackInfoBg,
  },
  builtInBadgeText: {
    fontSize: 10,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.feedbackInfo,
  },
  templatePreview: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
    lineHeight: 18,
  },
  useBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: Palette.hermesOrange + '0C',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    padding: GRID.xl,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    gap: GRID.sm,
  },
  emptyTitle: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textSecondary,
  },
  emptyDesc: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textTertiary,
    textAlign: 'center',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: GRID.lg - 4,
    paddingBottom: 40,
    gap: GRID.md - 4,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: SemanticColors.borderDefault,
    alignSelf: 'center',
    marginBottom: GRID.sm,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Archivo_800ExtraBold',
    color: SemanticColors.textPrimary,
    letterSpacing: -0.3,
  },
  modalInput: {
    backgroundColor: PAGE_BG,
    borderRadius: RADIUS.md,
    paddingHorizontal: GRID.md - 2,
    paddingVertical: GRID.md - 4,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary,
  },
  modalBodyInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },

  // Category selector
  catSelectorRow: {
    flexDirection: 'row',
    gap: GRID.sm,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.xs,
    paddingHorizontal: GRID.md - 4,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    backgroundColor: PAGE_BG,
  },
  catChipText: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textTertiary,
  },

  // Variable hints
  varHintRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID.sm,
  },
  varHint: {
    paddingHorizontal: GRID.sm,
    paddingVertical: GRID.xs,
    borderRadius: RADIUS.sm,
    backgroundColor: PAGE_BG,
  },
  varHintText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.labelFamily,
    color: Palette.hermesOrange,
  },

  // Modal actions
  modalActions: {
    flexDirection: 'row',
    gap: GRID.sm,
    marginTop: GRID.sm,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: GRID.md - 2,
    borderRadius: RADIUS.md,
    backgroundColor: PAGE_BG,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textSecondary,
  },
  modalSubmit: {
    flex: 2,
    paddingVertical: GRID.md - 2,
    borderRadius: RADIUS.md,
    backgroundColor: Palette.hermesOrange,
    alignItems: 'center',
  },
  modalSubmitText: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: '#fff',
  },
});

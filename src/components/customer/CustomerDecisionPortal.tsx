// =============================================================================
// CUSTOMER DECISION PORTAL
// =============================================================================
// Customer-facing interface for viewing and submitting project decisions
// Simple, clean UI focused on ease of use for non-technical users
// =============================================================================

import { useState, useEffect } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import type {
  CustomerPortalData,
  CustomerPortalCategory,
  CustomerPortalItem,
  CustomerDecisionSubmission,
} from '../../types/customerPortal';
import type { DecisionOption } from '../../types/decisions';

type IconName = keyof typeof Ionicons.glyphMap;

// ============================================
// MAIN PORTAL COMPONENT
// ============================================

interface CustomerDecisionPortalProps {
  portalData: CustomerPortalData;
  onSubmitDecision: (submission: CustomerDecisionSubmission) => void;
  onActivityLog?: (action: string, metadata?: Record<string, unknown>) => void;
}

export function CustomerDecisionPortal({
  portalData,
  onSubmitDecision,
  onActivityLog,
}: CustomerDecisionPortalProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const completionPercent = Math.round(
    (portalData.completedDecisions / portalData.totalDecisions) * 100
  );

  useEffect(() => {
    onActivityLog?.('portal_accessed');
  }, []);

  const accentColor = portalData.accentColor || Palette.hermesOrange;

  if (activeCategory) {
    const category = portalData.categories.find((c) => c.id === activeCategory);
    if (category) {
      return (
        <CategoryDetailView
          category={category}
          portalData={portalData}
          expandedItem={expandedItem}
          onExpandItem={setExpandedItem}
          onBack={() => setActiveCategory(null)}
          onSubmitDecision={onSubmitDecision}
          onActivityLog={onActivityLog}
          accentColor={accentColor}
        />
      );
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.contractorInfo}>
          <View style={[styles.contractorAvatar, { backgroundColor: accentColor + '20' }]}>
            <Text style={[styles.contractorInitials, { color: accentColor }]}>
              {portalData.contractorName.split(' ').map((n) => n[0]).join('')}
            </Text>
          </View>
          <View>
            <Text style={styles.contractorName}>{portalData.contractorName}</Text>
            {portalData.contractorCompany && (
              <Text style={styles.companyName}>{portalData.contractorCompany}</Text>
            )}
          </View>
        </View>
        {portalData.contractorPhone && (
          <Pressable
            style={styles.contactButton}
            onPress={() => Linking.openURL(`tel:${portalData.contractorPhone}`)}
          >
            <Ionicons name="call" size={20} color={SemanticColors.feedbackSuccess} />
          </Pressable>
        )}
      </View>

      {/* Project Info */}
      <View style={styles.projectCard}>
        <Text style={styles.projectName}>{portalData.projectName}</Text>
        <View style={styles.projectDates}>
          <View style={styles.dateItem}>
            <Ionicons name="calendar-outline" size={16} color={SemanticColors.textSecondary} />
            <Text style={styles.dateText}>
              Start: {new Date(portalData.projectStartDate).toLocaleDateString('nl-NL', {
                day: 'numeric',
                month: 'long',
              })}
            </Text>
          </View>
          {portalData.estimatedCompletionDate && (
            <View style={styles.dateItem}>
              <Ionicons name="flag-outline" size={16} color={SemanticColors.textSecondary} />
              <Text style={styles.dateText}>
                Klaar: {new Date(portalData.estimatedCompletionDate).toLocaleDateString('nl-NL', {
                  day: 'numeric',
                  month: 'long',
                })}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Progress */}
      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>Uw Keuzes</Text>
          <Text style={styles.progressPercent}>{completionPercent}%</Text>
        </View>
        <View style={styles.progressBar}>
          <View
            style={[styles.progressFill, { width: `${completionPercent}%`, backgroundColor: accentColor }]}
          />
        </View>
        <View style={styles.progressStats}>
          <View style={styles.progressStat}>
            <Ionicons name="checkmark-circle" size={18} color={SemanticColors.feedbackSuccess} />
            <Text style={styles.progressStatText}>{portalData.completedDecisions} gekozen</Text>
          </View>
          {portalData.overdueDecisions > 0 && (
            <View style={styles.progressStat}>
              <Ionicons name="alert-circle" size={18} color={SemanticColors.feedbackError} />
              <Text style={[styles.progressStatText, { color: SemanticColors.feedbackError }]}>
                {portalData.overdueDecisions} te laat
              </Text>
            </View>
          )}
          <View style={styles.progressStat}>
            <Ionicons name="time" size={18} color={SemanticColors.textTertiary} />
            <Text style={styles.progressStatText}>
              {portalData.totalDecisions - portalData.completedDecisions} nog te doen
            </Text>
          </View>
        </View>
      </View>

      {/* Urgent Items Banner */}
      {portalData.overdueDecisions > 0 && (
        <Pressable
          style={styles.urgentBanner}
          onPress={() => {
            const overdueCategory = portalData.categories.find((c) =>
              c.items.some((i) => i.isOverdue && i.status === 'pending')
            );
            if (overdueCategory) setActiveCategory(overdueCategory.id);
          }}
        >
          <View style={styles.urgentIcon}>
            <Ionicons name="alert-circle" size={24} color={SemanticColors.feedbackError} />
          </View>
          <View style={styles.urgentContent}>
            <Text style={styles.urgentTitle}>Actie vereist</Text>
            <Text style={styles.urgentText}>
              {portalData.overdueDecisions} keuze{portalData.overdueDecisions > 1 ? 's' : ''} moeten
              nog gemaakt worden om vertraging te voorkomen
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={SemanticColors.feedbackError} />
        </Pressable>
      )}

      {/* Categories */}
      <View style={styles.categoriesSection}>
        <Text style={styles.sectionTitle}>Categorieën</Text>
        {portalData.categories.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            accentColor={accentColor}
            onPress={() => {
              setActiveCategory(category.id);
              onActivityLog?.('category_viewed', { categoryId: category.id });
            }}
          />
        ))}
      </View>

      {/* Help Footer */}
      <View style={styles.helpFooter}>
        <Ionicons name="help-circle-outline" size={20} color={SemanticColors.textTertiary} />
        <Text style={styles.helpText}>
          Heeft u vragen? Neem contact op met {portalData.contractorName}
        </Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ============================================
// CATEGORY CARD
// ============================================

interface CategoryCardProps {
  category: CustomerPortalCategory;
  accentColor: string;
  onPress: () => void;
}

function CategoryCard({ category, accentColor, onPress }: CategoryCardProps) {
  const progressPercent = Math.round((category.completedCount / category.totalCount) * 100);
  const hasOverdue = category.items.some((i) => i.isOverdue && i.status === 'pending');

  const getIcon = (): IconName => {
    switch (category.icon) {
      case 'water': return 'water';
      case 'grid': return 'grid';
      case 'flash': return 'flash';
      case 'cube': return 'cube';
      case 'color-palette': return 'color-palette';
      default: return 'list';
    }
  };

  return (
    <Pressable
      style={[styles.categoryCard, hasOverdue && styles.categoryCardOverdue]}
      onPress={onPress}
    >
      <View style={[styles.categoryIcon, { backgroundColor: accentColor + '15' }]}>
        <Ionicons name={getIcon()} size={24} color={accentColor} />
      </View>
      <View style={styles.categoryContent}>
        <View style={styles.categoryHeader}>
          <Text style={styles.categoryName}>{category.name}</Text>
          {hasOverdue && (
            <View style={styles.overdueBadge}>
              <Text style={styles.overdueBadgeText}>Te laat</Text>
            </View>
          )}
        </View>
        <View style={styles.categoryProgress}>
          <View style={styles.categoryProgressBar}>
            <View
              style={[
                styles.categoryProgressFill,
                { width: `${progressPercent}%`, backgroundColor: accentColor },
              ]}
            />
          </View>
          <Text style={styles.categoryCount}>
            {category.completedCount}/{category.totalCount}
          </Text>
        </View>
        <Text style={styles.categoryDue}>
          Deadline: {new Date(category.dueDate).toLocaleDateString('nl-NL', {
            day: 'numeric',
            month: 'short',
          })}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={SemanticColors.textTertiary} />
    </Pressable>
  );
}

// ============================================
// CATEGORY DETAIL VIEW
// ============================================

interface CategoryDetailViewProps {
  category: CustomerPortalCategory;
  portalData: CustomerPortalData;
  expandedItem: string | null;
  onExpandItem: (itemId: string | null) => void;
  onBack: () => void;
  onSubmitDecision: (submission: CustomerDecisionSubmission) => void;
  onActivityLog?: (action: string, metadata?: Record<string, unknown>) => void;
  accentColor: string;
}

function CategoryDetailView({
  category,
  portalData,
  expandedItem,
  onExpandItem,
  onBack,
  onSubmitDecision,
  onActivityLog,
  accentColor,
}: CategoryDetailViewProps) {
  const pendingItems = category.items.filter((i) => i.status === 'pending');
  const completedItems = category.items.filter((i) => i.status === 'decided');

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.categoryDetailHeader}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={styles.categoryDetailTitle}>
          <Text style={styles.categoryDetailName}>{category.name}</Text>
          <Text style={styles.categoryDetailCount}>
            {category.completedCount} van {category.totalCount} gekozen
          </Text>
        </View>
      </View>

      <ScrollView style={styles.categoryDetailContent}>
        {/* Pending Items */}
        {pendingItems.length > 0 && (
          <View style={styles.itemsSection}>
            <Text style={styles.itemsSectionTitle}>Nog te kiezen</Text>
            {pendingItems.map((item) => (
              <DecisionItemCard
                key={item.id}
                item={item}
                isExpanded={expandedItem === item.id}
                onToggle={() => {
                  onExpandItem(expandedItem === item.id ? null : item.id);
                  if (expandedItem !== item.id) {
                    onActivityLog?.('item_viewed', { itemId: item.id });
                  }
                }}
                onSubmit={(value, notes, linkedProduct) => {
                  onSubmitDecision({
                    itemId: item.id,
                    trackerId: portalData.accessToken,
                    customerId: 'customer',
                    value,
                    notes,
                    deviceType: Platform.OS === 'ios' || Platform.OS === 'android' ? 'mobile' : 'desktop',
                    linkedProduct,
                    submittedAt: new Date().toISOString(),
                  });
                  onExpandItem(null);
                  onActivityLog?.('decision_made', { itemId: item.id, value });
                }}
                accentColor={accentColor}
              />
            ))}
          </View>
        )}

        {/* Completed Items */}
        {completedItems.length > 0 && (
          <View style={styles.itemsSection}>
            <Text style={styles.itemsSectionTitle}>Al gekozen</Text>
            {completedItems.map((item) => (
              <CompletedItemCard key={item.id} item={item} accentColor={accentColor} />
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ============================================
// DECISION ITEM CARD
// ============================================

interface DecisionItemCardProps {
  item: CustomerPortalItem;
  isExpanded: boolean;
  onToggle: () => void;
  onSubmit: (
    value: string | number | boolean,
    notes?: string,
    linkedProduct?: CustomerDecisionSubmission['linkedProduct']
  ) => void;
  accentColor: string;
}

function DecisionItemCard({
  item,
  isExpanded,
  onToggle,
  onSubmit,
  accentColor,
}: DecisionItemCardProps) {
  const [textValue, setTextValue] = useState('');
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);

  const getPriorityLabel = () => {
    switch (item.priority) {
      case 'critical': return 'Belangrijk';
      case 'important': return 'Aanbevolen';
      default: return 'Optioneel';
    }
  };

  const getPriorityColor = () => {
    switch (item.priority) {
      case 'critical': return SemanticColors.feedbackError;
      case 'important': return SemanticColors.feedbackWarning;
      default: return SemanticColors.textTertiary;
    }
  };

  return (
    <View style={[styles.itemCard, item.isOverdue && styles.itemCardOverdue]}>
      <Pressable style={styles.itemHeader} onPress={onToggle}>
        <View style={styles.itemTitleRow}>
          <Text style={styles.itemName}>{item.name}</Text>
          <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor() + '15' }]}>
            <Text style={[styles.priorityText, { color: getPriorityColor() }]}>
              {getPriorityLabel()}
            </Text>
          </View>
        </View>
        <Text style={styles.itemDescription}>{item.description}</Text>
        {item.isOverdue && (
          <View style={styles.overdueWarning}>
            <Ionicons name="alert-circle" size={14} color={SemanticColors.feedbackError} />
            <Text style={styles.overdueWarningText}>
              Deadline verstreken - kies zo snel mogelijk
            </Text>
          </View>
        )}
        <View style={styles.itemToggle}>
          <Text style={[styles.itemToggleText, { color: accentColor }]}>
            {isExpanded ? 'Sluiten' : 'Keuze maken'}
          </Text>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={accentColor}
          />
        </View>
      </Pressable>

      {isExpanded && (
        <View style={styles.itemExpanded}>
          {/* Help Text */}
          {item.helpText && (
            <View style={styles.helpBox}>
              <Ionicons name="information-circle" size={18} color={SemanticColors.feedbackInfo} />
              <Text style={styles.helpBoxText}>{item.helpText}</Text>
            </View>
          )}

          {/* Why It Matters */}
          {item.whyItMatters && (
            <View style={styles.whyBox}>
              <Text style={styles.whyLabel}>Waarom is dit belangrijk?</Text>
              <Text style={styles.whyText}>{item.whyItMatters}</Text>
            </View>
          )}

          {/* Input Based on Type */}
          {item.inputType === 'select' && item.options && (
            <View style={styles.optionsGrid}>
              {item.options.map((option) => (
                <OptionButton
                  key={option.value}
                  option={option}
                  onSelect={() => onSubmit(option.value, notes)}
                  accentColor={accentColor}
                />
              ))}
            </View>
          )}

          {item.inputType === 'boolean' && (
            <View style={styles.booleanOptions}>
              <Pressable
                style={[styles.booleanBtn, styles.booleanYes]}
                onPress={() => onSubmit(true, notes)}
              >
                <Ionicons name="checkmark-circle" size={28} color={SemanticColors.feedbackSuccess} />
                <Text style={[styles.booleanText, { color: SemanticColors.feedbackSuccess }]}>
                  Ja
                </Text>
              </Pressable>
              <Pressable
                style={[styles.booleanBtn, styles.booleanNo]}
                onPress={() => onSubmit(false, notes)}
              >
                <Ionicons name="close-circle" size={28} color={SemanticColors.feedbackError} />
                <Text style={[styles.booleanText, { color: SemanticColors.feedbackError }]}>
                  Nee
                </Text>
              </Pressable>
            </View>
          )}

          {(item.inputType === 'text' || item.inputType === 'color' || item.inputType === 'number') && (
            <View style={styles.textInputSection}>
              {item.exampleAnswer && (
                <Text style={styles.exampleText}>Voorbeeld: {item.exampleAnswer}</Text>
              )}
              <TextInput
                style={styles.textInput}
                placeholder={`Vul uw keuze in${item.unit ? ` (${item.unit})` : ''}...`}
                placeholderTextColor={SemanticColors.textTertiary}
                value={textValue}
                onChangeText={setTextValue}
                keyboardType={item.inputType === 'number' ? 'numeric' : 'default'}
                multiline={item.inputType === 'text'}
              />
              <Pressable
                style={[
                  styles.submitButton,
                  { backgroundColor: accentColor },
                  !textValue.trim() && styles.submitButtonDisabled,
                ]}
                onPress={() => {
                  if (textValue.trim()) {
                    onSubmit(item.inputType === 'number' ? Number(textValue) : textValue, notes);
                    setTextValue('');
                  }
                }}
                disabled={!textValue.trim()}
              >
                <Text style={styles.submitButtonText}>Bevestigen</Text>
              </Pressable>
            </View>
          )}

          {item.inputType === 'photo' && (
            <View style={styles.photoSection}>
              <Text style={styles.photoInstructions}>
                Stuur een foto of link van uw keuze naar de aannemer, of beschrijf wat u wilt.
              </Text>
              <TextInput
                style={[styles.textInput, { minHeight: 80 }]}
                placeholder="Beschrijf uw keuze of plak een link..."
                placeholderTextColor={SemanticColors.textTertiary}
                value={textValue}
                onChangeText={setTextValue}
                multiline
              />
              <Pressable
                style={[
                  styles.submitButton,
                  { backgroundColor: accentColor },
                  !textValue.trim() && styles.submitButtonDisabled,
                ]}
                onPress={() => {
                  if (textValue.trim()) {
                    // Check if it's a URL
                    const isUrl = textValue.match(/^https?:\/\//);
                    onSubmit(textValue, notes, isUrl ? { name: textValue, url: textValue } : undefined);
                    setTextValue('');
                  }
                }}
                disabled={!textValue.trim()}
              >
                <Text style={styles.submitButtonText}>Versturen</Text>
              </Pressable>
            </View>
          )}

          {/* Add Notes Toggle */}
          <Pressable
            style={styles.addNotesToggle}
            onPress={() => setShowNotes(!showNotes)}
          >
            <Ionicons
              name={showNotes ? 'chatbubble' : 'chatbubble-outline'}
              size={16}
              color={SemanticColors.textSecondary}
            />
            <Text style={styles.addNotesText}>
              {showNotes ? 'Notitie verbergen' : 'Notitie toevoegen'}
            </Text>
          </Pressable>

          {showNotes && (
            <TextInput
              style={styles.notesInput}
              placeholder="Voeg een opmerking toe..."
              placeholderTextColor={SemanticColors.textTertiary}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          )}
        </View>
      )}
    </View>
  );
}

// ============================================
// OPTION BUTTON
// ============================================

interface OptionButtonProps {
  option: DecisionOption;
  onSelect: () => void;
  accentColor: string;
}

function OptionButton({ option, onSelect, accentColor }: OptionButtonProps) {
  return (
    <Pressable style={styles.optionButton} onPress={onSelect}>
      {option.imageUrl && (
        <View style={styles.optionImage}>
          <Ionicons name="image" size={32} color={SemanticColors.textTertiary} />
        </View>
      )}
      <View style={styles.optionContent}>
        <Text style={styles.optionLabel}>{option.label}</Text>
        {option.description && (
          <Text style={styles.optionDescription}>{option.description}</Text>
        )}
        {option.priceImpact !== undefined && option.priceImpact !== 0 && (
          <Text
            style={[
              styles.optionPrice,
              {
                color: option.priceImpact > 0
                  ? SemanticColors.feedbackError
                  : SemanticColors.feedbackSuccess,
              },
            ]}
          >
            {option.priceImpact > 0 ? '+' : ''}€{option.priceImpact}
          </Text>
        )}
      </View>
      <View style={[styles.optionSelect, { borderColor: accentColor }]}>
        <Text style={[styles.optionSelectText, { color: accentColor }]}>Kiezen</Text>
      </View>
    </Pressable>
  );
}

// ============================================
// COMPLETED ITEM CARD
// ============================================

interface CompletedItemCardProps {
  item: CustomerPortalItem;
  accentColor: string;
}

function CompletedItemCard({ item, accentColor }: CompletedItemCardProps) {
  const getDisplayValue = () => {
    if (typeof item.value === 'boolean') {
      return item.value ? 'Ja' : 'Nee';
    }
    if (item.options) {
      const option = item.options.find((o) => o.value === item.value);
      return option?.label || String(item.value);
    }
    return String(item.value);
  };

  return (
    <View style={styles.completedCard}>
      <View style={styles.completedIcon}>
        <Ionicons name="checkmark-circle" size={24} color={SemanticColors.feedbackSuccess} />
      </View>
      <View style={styles.completedContent}>
        <Text style={styles.completedName}>{item.name}</Text>
        <Text style={[styles.completedValue, { color: accentColor }]}>{getDisplayValue()}</Text>
        {item.decidedAt && (
          <Text style={styles.completedDate}>
            Gekozen op {new Date(item.decidedAt).toLocaleDateString('nl-NL', {
              day: 'numeric',
              month: 'long',
            })}
          </Text>
        )}
      </View>
    </View>
  );
}

// ============================================
// ACCESS CODE ENTRY
// ============================================

interface AccessCodeEntryProps {
  onSubmit: (code: string) => void;
  error?: string;
  isLoading?: boolean;
}

export function AccessCodeEntry({ onSubmit, error, isLoading }: AccessCodeEntryProps) {
  const [code, setCode] = useState('');

  return (
    <View style={styles.accessContainer}>
      <View style={styles.accessContent}>
        <View style={styles.accessLogo}>
          <Ionicons name="home" size={48} color={Palette.hermesOrange} />
        </View>
        <Text style={styles.accessTitle}>Project Keuzes</Text>
        <Text style={styles.accessSubtitle}>
          Vul de code in die u van uw aannemer heeft ontvangen
        </Text>

        <TextInput
          style={styles.accessInput}
          placeholder="XXXXXX"
          placeholderTextColor={SemanticColors.textTertiary}
          value={code}
          onChangeText={(text) => setCode(text.toUpperCase())}
          autoCapitalize="characters"
          maxLength={6}
          autoCorrect={false}
        />

        {error && (
          <View style={styles.accessError}>
            <Ionicons name="alert-circle" size={16} color={SemanticColors.feedbackError} />
            <Text style={styles.accessErrorText}>{error}</Text>
          </View>
        )}

        <Pressable
          style={[styles.accessButton, code.length < 6 && styles.accessButtonDisabled]}
          onPress={() => onSubmit(code)}
          disabled={code.length < 6 || isLoading}
        >
          {isLoading ? (
            <Text style={styles.accessButtonText}>Laden...</Text>
          ) : (
            <Text style={styles.accessButtonText}>Doorgaan</Text>
          )}
        </Pressable>

        <Text style={styles.accessHelp}>
          Geen code? Vraag uw aannemer om een toegangslink.
        </Text>
      </View>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  contentContainer: {
    padding: Spacing.lg,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  contractorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  contractorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contractorInitials: {
    fontSize: 18,
    fontWeight: '700',
  },
  contractorName: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  companyName: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  contactButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SemanticColors.feedbackSuccessBg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Project Card
  projectCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  projectName: {
    fontSize: 22,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    marginBottom: Spacing.sm,
  },
  projectDates: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },

  // Progress Card
  progressCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  progressPercent: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  progressBar: {
    height: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  progressStatText: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },

  // Urgent Banner
  urgentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.feedbackErrorBg,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.feedbackError + '30',
  },
  urgentIcon: {
    marginRight: Spacing.sm,
  },
  urgentContent: {
    flex: 1,
  },
  urgentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.feedbackError,
  },
  urgentText: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },

  // Categories Section
  categoriesSection: {
    marginTop: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },

  // Category Card
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  categoryCardOverdue: {
    borderColor: SemanticColors.feedbackError + '50',
    borderLeftWidth: 3,
    borderLeftColor: SemanticColors.feedbackError,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  categoryContent: {
    flex: 1,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  overdueBadge: {
    backgroundColor: SemanticColors.feedbackErrorBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  overdueBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: SemanticColors.feedbackError,
  },
  categoryProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  categoryProgressBar: {
    flex: 1,
    height: 4,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  categoryProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  categoryCount: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    fontWeight: '500',
  },
  categoryDue: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },

  // Help Footer
  helpFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.lg,
  },
  helpText: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
  },

  // Category Detail
  categoryDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    paddingTop: Spacing.xl,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  backButton: {
    padding: Spacing.xs,
    marginRight: Spacing.sm,
  },
  categoryDetailTitle: {
    flex: 1,
  },
  categoryDetailName: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  categoryDetailCount: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  categoryDetailContent: {
    flex: 1,
  },

  // Items Section
  itemsSection: {
    padding: Spacing.md,
  },
  itemsSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },

  // Item Card
  itemCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    overflow: 'hidden',
  },
  itemCardOverdue: {
    borderColor: SemanticColors.feedbackError + '50',
    borderLeftWidth: 3,
    borderLeftColor: SemanticColors.feedbackError,
  },
  itemHeader: {
    padding: Spacing.md,
  },
  itemTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '600',
  },
  itemDescription: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    lineHeight: 20,
  },
  overdueWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: SemanticColors.feedbackErrorBg,
    padding: 8,
    borderRadius: 6,
  },
  overdueWarningText: {
    fontSize: 12,
    color: SemanticColors.feedbackError,
    flex: 1,
  },
  itemToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderMuted,
  },
  itemToggleText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Item Expanded
  itemExpanded: {
    padding: Spacing.md,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  helpBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: SemanticColors.feedbackInfoBg,
    padding: Spacing.sm,
    borderRadius: 8,
    marginBottom: Spacing.md,
    marginTop: Spacing.md,
  },
  helpBoxText: {
    flex: 1,
    fontSize: 13,
    color: SemanticColors.textSecondary,
    lineHeight: 18,
  },
  whyBox: {
    marginBottom: Spacing.md,
  },
  whyLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    marginBottom: 4,
  },
  whyText: {
    fontSize: 13,
    color: SemanticColors.textPrimary,
  },

  // Options
  optionsGrid: {
    gap: Spacing.sm,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 10,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  optionImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  optionDescription: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  optionPrice: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  optionSelect: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1.5,
  },
  optionSelectText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Boolean Options
  booleanOptions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  booleanBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  booleanYes: {
    backgroundColor: SemanticColors.feedbackSuccessBg,
  },
  booleanNo: {
    backgroundColor: SemanticColors.feedbackErrorBg,
  },
  booleanText: {
    fontSize: 18,
    fontWeight: '700',
  },

  // Text Input Section
  textInputSection: {
    gap: Spacing.sm,
  },
  exampleText: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
    fontStyle: 'italic',
  },
  textInput: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 10,
    padding: Spacing.md,
    fontSize: 15,
    color: SemanticColors.textPrimary,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    minHeight: 48,
  },
  submitButton: {
    borderRadius: 10,
    padding: Spacing.md,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },

  // Photo Section
  photoSection: {
    gap: Spacing.sm,
  },
  photoInstructions: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginBottom: 4,
  },

  // Notes
  addNotesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
  },
  addNotesText: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  notesInput: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 8,
    padding: Spacing.sm,
    fontSize: 14,
    color: SemanticColors.textPrimary,
    minHeight: 60,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },

  // Completed Card
  completedCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  completedIcon: {
    marginRight: Spacing.sm,
  },
  completedContent: {
    flex: 1,
  },
  completedName: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  completedValue: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 2,
  },
  completedDate: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    marginTop: 4,
  },

  // Access Code Entry
  accessContainer: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  accessContent: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  accessLogo: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: Palette.hermesOrange + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  accessTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    marginBottom: 8,
  },
  accessSubtitle: {
    fontSize: 15,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  accessInput: {
    width: '100%',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.lg,
    fontSize: 24,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    textAlign: 'center',
    letterSpacing: 8,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    marginBottom: Spacing.md,
  },
  accessError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.md,
  },
  accessErrorText: {
    fontSize: 13,
    color: SemanticColors.feedbackError,
  },
  accessButton: {
    width: '100%',
    backgroundColor: Palette.hermesOrange,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  accessButtonDisabled: {
    opacity: 0.5,
  },
  accessButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  accessHelp: {
    fontSize: 13,
    color: SemanticColors.textTertiary,
    textAlign: 'center',
  },
});

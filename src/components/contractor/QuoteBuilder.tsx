// Quote Builder - Create and edit quotes with line items
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SemanticColors } from '../../theme/colors';
import { formatCurrency } from '../../i18n/formatting';
import { Spacing } from '../../theme/spacing';
import type { Quote, QuoteLineItem, Customer } from '../../types/contractor';

interface QuoteBuilderProps {
  customer?: Customer;
  existingQuote?: Quote;
  onSave: (quote: Partial<Quote>) => void;
  onSend: (quote: Partial<Quote>) => void;
  onClose: () => void;
}

type LineItemType = 'labour' | 'materials' | 'equipment' | 'other';

const LINE_ITEM_TYPES: { id: LineItemType; label: string; icon: string }[] = [
  { id: 'labour', label: 'Labour', icon: 'person-outline' },
  { id: 'materials', label: 'Materials', icon: 'cube-outline' },
  { id: 'equipment', label: 'Equipment', icon: 'construct-outline' },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' },
];

const COMMON_UNITS = ['hours', 'days', 'sqm', 'meters', 'each', 'set', 'liters'];

export function QuoteBuilder({
  customer,
  existingQuote,
  onSave,
  onSend,
  onClose,
}: QuoteBuilderProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(existingQuote?.title || '');
  const [description, setDescription] = useState(existingQuote?.description || '');
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>(existingQuote?.lineItems || []);
  const [vatRate, setVatRate] = useState(existingQuote?.vatRate || 21);
  const [validDays, setValidDays] = useState(30);
  const [paymentTerms, setPaymentTerms] = useState(
    existingQuote?.paymentTerms || 'Payment on completion'
  );
  const [estimatedDuration, setEstimatedDuration] = useState(existingQuote?.estimatedDuration || '');
  const [showAddItem, setShowAddItem] = useState(false);

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const vatAmount = subtotal * (vatRate / 100);
  const total = subtotal + vatAmount;

  // formatCurrency imported from ../../i18n/formatting

  const generateReference = () => {
    const year = new Date().getFullYear();
    const num = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    return `Q-${year}-${num}`;
  };

  const addLineItem = (item: Omit<QuoteLineItem, 'id' | 'total'>) => {
    const newItem: QuoteLineItem = {
      ...item,
      id: `ql-${Date.now()}`,
      total: item.quantity * item.unitPrice,
    };
    setLineItems([...lineItems, newItem]);
    setShowAddItem(false);
  };

  const updateLineItem = (id: string, updates: Partial<QuoteLineItem>) => {
    setLineItems(
      lineItems.map((item) => {
        if (item.id === id) {
          const updated = { ...item, ...updates };
          updated.total = updated.quantity * updated.unitPrice;
          return updated;
        }
        return item;
      })
    );
  };

  const removeLineItem = (id: string) => {
    Alert.alert(t('quote.removeItem', 'Remove Item'), t('quote.removeItemConfirm', 'Are you sure you want to remove this item?'), [
      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      { text: t('common.remove', 'Remove'), style: 'destructive', onPress: () => setLineItems(lineItems.filter((i) => i.id !== id)) },
    ]);
  };

  const handleSave = () => {
    const quote: Partial<Quote> = {
      reference: existingQuote?.reference || generateReference(),
      title,
      description,
      lineItems,
      subtotal,
      vatRate,
      vatAmount,
      total,
      currency: 'EUR',
      validUntil: new Date(Date.now() + validDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      paymentTerms,
      estimatedDuration,
      status: 'draft',
    };
    onSave(quote);
  };

  const handleSend = () => {
    if (!title.trim()) {
      Alert.alert(t('quote.missingTitle', 'Missing Title'), t('quote.missingTitleMessage', 'Please enter a title for the quote.'));
      return;
    }
    if (lineItems.length === 0) {
      Alert.alert(t('quote.noItems', 'No Items'), t('quote.noItemsMessage', 'Please add at least one line item.'));
      return;
    }

    Alert.alert(
      t('quote.sendQuote', 'Send Quote'),
      t('quote.sendQuoteConfirm', 'Send this quote ({{total}}) to {{customer}}?', { total: formatCurrency(total), customer: customer?.name || t('quote.customer', 'customer') }),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.send', 'Send'),
          onPress: () => {
            const quote: Partial<Quote> = {
              reference: existingQuote?.reference || generateReference(),
              title,
              description,
              lineItems,
              subtotal,
              vatRate,
              vatAmount,
              total,
              currency: 'EUR',
              validUntil: new Date(Date.now() + validDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              paymentTerms,
              estimatedDuration,
              status: 'sent',
              sentAt: new Date().toISOString(),
            };
            onSend(quote);
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>
            {existingQuote ? 'Edit Quote' : 'New Quote'}
          </Text>
          {customer && <Text style={styles.headerSubtitle}>{customer.name}</Text>}
        </View>
        <Pressable onPress={handleSave} style={styles.saveButton}>
          <Text style={styles.saveButtonText}>Save</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Quote Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quote Details</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Title *</Text>
            <TextInput
              style={styles.textInput}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g., Living Room Repaint"
              placeholderTextColor={SemanticColors.textTertiary}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the work to be done..."
              placeholderTextColor={SemanticColors.textTertiary}
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        {/* Line Items */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Line Items</Text>
            <Pressable
              style={styles.addItemButton}
              onPress={() => setShowAddItem(true)}
            >
              <Ionicons name="add" size={18} color={SemanticColors.actionPrimary} />
              <Text style={styles.addItemText}>Add Item</Text>
            </Pressable>
          </View>

          {lineItems.length > 0 ? (
            <View style={styles.lineItemsList}>
              {lineItems.map((item, index) => (
                <LineItemRow
                  key={item.id}
                  item={item}
                  index={index}
                  onUpdate={(updates) => updateLineItem(item.id, updates)}
                  onRemove={() => removeLineItem(item.id)}
                  formatCurrency={formatCurrency}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyItems}>
              <Ionicons name="document-text-outline" size={32} color={SemanticColors.textTertiary} />
              <Text style={styles.emptyItemsText}>No items added yet</Text>
              <Pressable
                style={styles.emptyAddButton}
                onPress={() => setShowAddItem(true)}
              >
                <Text style={styles.emptyAddButtonText}>Add First Item</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Totals */}
        <View style={styles.totalsCard}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <View style={styles.vatRow}>
              <Text style={styles.totalLabel}>VAT</Text>
              <TextInput
                style={styles.vatInput}
                value={vatRate.toString()}
                onChangeText={(v) => setVatRate(parseInt(v) || 0)}
                keyboardType="numeric"
              />
              <Text style={styles.vatPercent}>%</Text>
            </View>
            <Text style={styles.totalValue}>{formatCurrency(vatAmount)}</Text>
          </View>
          <View style={styles.totalDivider} />
          <View style={styles.totalRow}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(total)}</Text>
          </View>
        </View>

        {/* Terms */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Terms</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Valid for (days)</Text>
            <TextInput
              style={[styles.textInput, styles.smallInput]}
              value={validDays.toString()}
              onChangeText={(v) => setValidDays(parseInt(v) || 30)}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Payment Terms</Text>
            <TextInput
              style={styles.textInput}
              value={paymentTerms}
              onChangeText={setPaymentTerms}
              placeholder="e.g., 50% deposit, 50% on completion"
              placeholderTextColor={SemanticColors.textTertiary}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Estimated Duration</Text>
            <TextInput
              style={styles.textInput}
              value={estimatedDuration}
              onChangeText={setEstimatedDuration}
              placeholder="e.g., 2-3 days"
              placeholderTextColor={SemanticColors.textTertiary}
            />
          </View>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <Pressable style={styles.previewButton} onPress={handleSave}>
          <Ionicons name="eye-outline" size={20} color={SemanticColors.textPrimary} />
          <Text style={styles.previewButtonText}>Preview</Text>
        </Pressable>
        <Pressable style={styles.sendButton} onPress={handleSend}>
          <Ionicons name="send" size={20} color="#fff" />
          <Text style={styles.sendButtonText}>Send Quote</Text>
        </Pressable>
      </View>

      {/* Add Item Modal */}
      {showAddItem && (
        <AddLineItemModal
          onAdd={addLineItem}
          onClose={() => setShowAddItem(false)}
        />
      )}
    </KeyboardAvoidingView>
  );
}

// Line Item Row Component
function LineItemRow({
  item,
  index,
  onUpdate,
  onRemove,
  formatCurrency,
}: {
  item: QuoteLineItem;
  index: number;
  onUpdate: (updates: Partial<QuoteLineItem>) => void;
  onRemove: () => void;
  formatCurrency: (n: number) => string;
}) {
  const [isEditing, setIsEditing] = useState(false);

  const typeConfig = LINE_ITEM_TYPES.find((t) => t.id === item.type);

  if (isEditing) {
    return (
      <View style={styles.lineItemEditing}>
        <TextInput
          style={styles.lineItemDescInput}
          value={item.description}
          onChangeText={(v) => onUpdate({ description: v })}
          placeholder="Description"
          placeholderTextColor={SemanticColors.textTertiary}
        />
        <View style={styles.lineItemEditRow}>
          <TextInput
            style={[styles.lineItemNumInput, { flex: 1 }]}
            value={item.quantity.toString()}
            onChangeText={(v) => onUpdate({ quantity: parseFloat(v) || 0 })}
            keyboardType="numeric"
            placeholder="Qty"
          />
          <Text style={styles.lineItemX}>×</Text>
          <TextInput
            style={[styles.lineItemNumInput, { flex: 2 }]}
            value={item.unitPrice.toString()}
            onChangeText={(v) => onUpdate({ unitPrice: parseFloat(v) || 0 })}
            keyboardType="numeric"
            placeholder="Price"
          />
        </View>
        <Pressable style={styles.lineItemDoneBtn} onPress={() => setIsEditing(false)}>
          <Text style={styles.lineItemDoneBtnText}>Done</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable style={styles.lineItem} onPress={() => setIsEditing(true)}>
      <View style={styles.lineItemLeft}>
        <View style={styles.lineItemIndex}>
          <Text style={styles.lineItemIndexText}>{index + 1}</Text>
        </View>
        <View style={styles.lineItemContent}>
          <Text style={styles.lineItemDesc}>{item.description}</Text>
          <Text style={styles.lineItemMeta}>
            {item.quantity} {item.unit} × {formatCurrency(item.unitPrice)}
          </Text>
        </View>
      </View>
      <View style={styles.lineItemRight}>
        <Text style={styles.lineItemTotal}>{formatCurrency(item.total)}</Text>
        <Pressable onPress={onRemove} hitSlop={10}>
          <Ionicons name="trash-outline" size={18} color={SemanticColors.feedbackError} />
        </Pressable>
      </View>
    </Pressable>
  );
}

// Add Line Item Modal
function AddLineItemModal({
  onAdd,
  onClose,
}: {
  onAdd: (item: Omit<QuoteLineItem, 'id' | 'total'>) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [type, setType] = useState<LineItemType>('labour');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('hours');
  const [unitPrice, setUnitPrice] = useState('');

  const handleAdd = () => {
    if (!description.trim()) {
      Alert.alert(t('quote.missingDescription', 'Missing Description'), t('quote.missingDescriptionMessage', 'Please enter a description.'));
      return;
    }
    if (!unitPrice) {
      Alert.alert(t('quote.missingPrice', 'Missing Price'), t('quote.missingPriceMessage', 'Please enter a unit price.'));
      return;
    }

    onAdd({
      type,
      description,
      quantity: parseFloat(quantity) || 1,
      unit,
      unitPrice: parseFloat(unitPrice) || 0,
    });
  };

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Add Line Item</Text>
          <Pressable onPress={onClose}>
            <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
          </Pressable>
        </View>

        {/* Type Selector */}
        <View style={styles.typeSelector}>
          {LINE_ITEM_TYPES.map((t) => (
            <Pressable
              key={t.id}
              style={[styles.typeOption, type === t.id && styles.typeOptionActive]}
              onPress={() => setType(t.id)}
            >
              <Ionicons
                name={t.icon as any}
                size={18}
                color={type === t.id ? SemanticColors.actionPrimary : SemanticColors.textSecondary}
              />
              <Text style={[styles.typeOptionText, type === t.id && styles.typeOptionTextActive]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Description */}
        <View style={styles.modalInputGroup}>
          <Text style={styles.inputLabel}>Description *</Text>
          <TextInput
            style={styles.textInput}
            value={description}
            onChangeText={setDescription}
            placeholder={type === 'labour' ? 'e.g., Surface preparation' : 'e.g., Paint and materials'}
            placeholderTextColor={SemanticColors.textTertiary}
          />
        </View>

        {/* Quantity & Unit */}
        <View style={styles.modalRow}>
          <View style={[styles.modalInputGroup, { flex: 1 }]}>
            <Text style={styles.inputLabel}>Quantity</Text>
            <TextInput
              style={styles.textInput}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
              placeholder="1"
            />
          </View>
          <View style={[styles.modalInputGroup, { flex: 1 }]}>
            <Text style={styles.inputLabel}>Unit</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.unitOptions}>
                {COMMON_UNITS.map((u) => (
                  <Pressable
                    key={u}
                    style={[styles.unitOption, unit === u && styles.unitOptionActive]}
                    onPress={() => setUnit(u)}
                  >
                    <Text style={[styles.unitOptionText, unit === u && styles.unitOptionTextActive]}>
                      {u}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>

        {/* Unit Price */}
        <View style={styles.modalInputGroup}>
          <Text style={styles.inputLabel}>Unit Price (€) *</Text>
          <TextInput
            style={styles.textInput}
            value={unitPrice}
            onChangeText={setUnitPrice}
            keyboardType="numeric"
            placeholder="0.00"
          />
        </View>

        {/* Preview */}
        {description && unitPrice && (
          <View style={styles.previewBox}>
            <Text style={styles.previewText}>
              {quantity} {unit} x {formatCurrency(parseFloat(unitPrice) || 0)} = {formatCurrency((parseFloat(quantity) || 1) * (parseFloat(unitPrice) || 0))}
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.modalActions}>
          <Pressable style={styles.modalCancelBtn} onPress={onClose}>
            <Text style={styles.modalCancelBtnText}>Cancel</Text>
          </Pressable>
          <Pressable style={styles.modalAddBtn} onPress={handleAdd}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.modalAddBtnText}>Add Item</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    paddingTop: Spacing.xl,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    color: SemanticColors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: SemanticColors.textSecondary,
    fontSize: 13,
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 8,
  },
  saveButtonText: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.md,
    paddingBottom: 120,
    gap: Spacing.lg,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: SemanticColors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  textInput: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    borderRadius: 10,
    padding: Spacing.sm,
    color: SemanticColors.textPrimary,
    fontSize: 15,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  smallInput: {
    width: 80,
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: SemanticColors.actionPrimary + '15',
    borderRadius: 8,
  },
  addItemText: {
    color: SemanticColors.actionPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  lineItemsList: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    overflow: 'hidden',
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderMuted,
  },
  lineItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Spacing.sm,
  },
  lineItemIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineItemIndexText: {
    color: SemanticColors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  lineItemContent: {
    flex: 1,
  },
  lineItemDesc: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  lineItemMeta: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
  },
  lineItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  lineItemTotal: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  lineItemEditing: {
    padding: Spacing.md,
    backgroundColor: SemanticColors.surfaceSecondary,
    gap: Spacing.sm,
  },
  lineItemDescInput: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 8,
    padding: Spacing.sm,
    color: SemanticColors.textPrimary,
    fontSize: 14,
  },
  lineItemEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  lineItemNumInput: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 8,
    padding: Spacing.sm,
    color: SemanticColors.textPrimary,
    fontSize: 14,
    textAlign: 'center',
  },
  lineItemX: {
    color: SemanticColors.textSecondary,
    fontSize: 14,
  },
  lineItemDoneBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: SemanticColors.actionPrimary,
    borderRadius: 8,
  },
  lineItemDoneBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyItems: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    borderStyle: 'dashed',
  },
  emptyItemsText: {
    color: SemanticColors.textTertiary,
    fontSize: 14,
  },
  emptyAddButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: SemanticColors.actionPrimary,
    borderRadius: 8,
  },
  emptyAddButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  totalsCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    color: SemanticColors.textSecondary,
    fontSize: 14,
  },
  totalValue: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
  },
  vatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vatInput: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    width: 40,
    textAlign: 'center',
    color: SemanticColors.textPrimary,
    fontSize: 13,
  },
  vatPercent: {
    color: SemanticColors.textSecondary,
    fontSize: 13,
  },
  totalDivider: {
    height: 1,
    backgroundColor: SemanticColors.borderDefault,
    marginVertical: 4,
  },
  grandTotalLabel: {
    color: SemanticColors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  grandTotalValue: {
    color: SemanticColors.actionPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  bottomActions: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  previewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 12,
  },
  previewButtonText: {
    color: SemanticColors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  sendButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: SemanticColors.actionPrimary,
    borderRadius: 12,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.lg,
    gap: Spacing.md,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    color: SemanticColors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  typeSelector: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  typeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 8,
  },
  typeOptionActive: {
    backgroundColor: SemanticColors.actionPrimary + '20',
    borderWidth: 1,
    borderColor: SemanticColors.actionPrimary + '40',
  },
  typeOptionText: {
    color: SemanticColors.textSecondary,
    fontSize: 11,
    fontWeight: '500',
  },
  typeOptionTextActive: {
    color: SemanticColors.actionPrimary,
  },
  modalInputGroup: {
    gap: 6,
  },
  modalRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  unitOptions: {
    flexDirection: 'row',
    gap: 6,
  },
  unitOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 8,
  },
  unitOptionActive: {
    backgroundColor: SemanticColors.actionPrimary,
  },
  unitOptionText: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  unitOptionTextActive: {
    color: '#fff',
  },
  previewBox: {
    backgroundColor: SemanticColors.feedbackInfoBg,
    padding: Spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  previewText: {
    color: SemanticColors.feedbackInfo,
    fontSize: 14,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 12,
  },
  modalCancelBtnText: {
    color: SemanticColors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  modalAddBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    backgroundColor: SemanticColors.actionPrimary,
    borderRadius: 12,
  },
  modalAddBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});

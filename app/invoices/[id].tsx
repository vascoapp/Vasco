// =============================================================================
// INVOICE DETAIL — Pro-grade, fully editable invoice view
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, View, Pressable, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Palette, SemanticColors } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { SafeArea } from '../../src/theme/spacing';
import { useAppState } from '../../src/state/AppState';
import { useAuth } from '../../src/context/AuthContext';
import { hapticError, hapticSuccess } from '../../src/utils/haptics';
import { generateInvoicePdf } from '../../src/services/invoicePdfService';
import { invoiceAutomationService } from '../../src/services/invoiceAutomationService';
import { getPaymentDisplayForCountry, getPaymentBrandColor } from '../../src/config/paymentMethods';
import { formatCurrency } from '../../src/i18n/formatting';
import {
  getCustomerPaymentPreference,
  getPaymentMethodLabel,
} from '../../src/services/customerPaymentPreferenceService';

type IconName = keyof typeof Ionicons.glyphMap;

interface EditableLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

const VAT_RATE = 0.21;

// Status badge colors
const getStatusColor = (status: string) => {
  switch (status) {
    case 'paid': return SemanticColors.feedbackSuccess;
    case 'sent': return SemanticColors.feedbackInfo;
    case 'overdue': return SemanticColors.feedbackError;
    case 'draft': return SemanticColors.textTertiary;
    default: return SemanticColors.textTertiary;
  }
};

const getStatusBg = (status: string) => {
  switch (status) {
    case 'paid': return SemanticColors.feedbackSuccess + '15';
    case 'sent': return SemanticColors.feedbackInfo + '15';
    case 'overdue': return SemanticColors.feedbackError + '15';
    case 'draft': return SemanticColors.surfaceSecondary;
    default: return SemanticColors.surfaceSecondary;
  }
};

export default function InvoiceDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    invoices,
    updateInvoice,
    markInvoicePaid,
    markInvoiceSent,
    moneybirdConnected,
    exportInvoice,
    lastMoneybirdExport,
    mollieConnected,
    createPaymentLink,
    lastMolliePayment,
    businessProfile,
    lineItems: appLineItems,
  } = useAppState();
  const { user } = useAuth();
  const invoice = invoices.find((item) => item.id === id);
  const country = user?.country ?? 'NL';
  const paymentMethods = getPaymentDisplayForCountry(country);

  // Editable state
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [editingItems, setEditingItems] = useState(false);
  const [localItems, setLocalItems] = useState<EditableLineItem[]>([]);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');

  // Customer preference
  const [customerPreference, setCustomerPreference] = useState<string | null>(null);

  useEffect(() => {
    if (invoice) {
      setCustomerName(invoice.customer);
      setNotes((invoice as any).notes ?? '');
      getCustomerPaymentPreference(invoice.id).then(setCustomerPreference);
      // Build line items from appLineItems or synthesize from amount
      const existing = appLineItems[invoice.id];
      if (existing && existing.length > 0) {
        setLocalItems(existing.map((li, idx) => ({
          id: li.id || `item-${idx}`,
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
        })));
      } else {
        // Synthesize a single line item from total
        setLocalItems([{
          id: 'item-1',
          description: invoice.job || t('invoices.services', 'Services rendered'),
          quantity: 1,
          unitPrice: invoice.amount / (1 + VAT_RATE),
        }]);
      }
    }
  }, [invoice?.id]);

  if (!invoice) {
    return (
      <View style={styles.container}>
        <View style={styles.headerBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={SemanticColors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('invoices.notFound', 'Invoice not found')}</Text>
          <View style={{ width: 40 }} />
        </View>
      </View>
    );
  }

  const lastExport = lastMoneybirdExport[invoice.id];
  const lastPayment = lastMolliePayment[invoice.id];

  // Calculations
  const subtotal = localItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const vatAmount = subtotal * VAT_RATE;
  const total = subtotal + vatAmount;

  // Handlers
  const handleSaveCustomer = () => {
    updateInvoice(invoice.id, { customer: customerName });
    setEditingCustomer(false);
    hapticSuccess();
  };

  const handleUpdateItem = (itemId: string, field: keyof EditableLineItem, value: string) => {
    setLocalItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      if (field === 'description') return { ...item, description: value };
      const numVal = parseFloat(value) || 0;
      return { ...item, [field]: numVal };
    }));
  };

  const handleAddItem = () => {
    const newId = `item-${Date.now()}`;
    setLocalItems(prev => [...prev, { id: newId, description: '', quantity: 1, unitPrice: 0 }]);
  };

  const handleRemoveItem = (itemId: string) => {
    if (localItems.length <= 1) return;
    setLocalItems(prev => prev.filter(i => i.id !== itemId));
  };

  const handleSaveItems = () => {
    const newTotal = localItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const finalTotal = newTotal * (1 + VAT_RATE);
    updateInvoice(invoice.id, { amount: Math.round(finalTotal * 100) / 100 });
    setEditingItems(false);
    hapticSuccess();
  };

  const handleSaveNotes = () => {
    updateInvoice(invoice.id, { notes } as any);
    setEditingNotes(false);
    hapticSuccess();
  };

  const handleCreatePayment = async () => {
    try {
      await createPaymentLink(invoice.id, invoice.amount);
      hapticSuccess();
    } catch {
      hapticError();
    }
  };

  const handleExportMoneybird = async () => {
    try {
      await exportInvoice(invoice.id);
      hapticSuccess();
    } catch {
      hapticError();
    }
  };

  const handleMarkPaid = () => {
    markInvoicePaid(invoice.id);
    hapticSuccess();
    Alert.alert(
      t('invoices.paidTitle', 'Payment received!'),
      t('invoices.paidDesc', {
        defaultValue: '{{amount}} from {{customer}} marked as paid.',
        amount: formatCurrency(invoice.amount, country),
        customer: invoice.customer,
      }),
      [
        { text: t('invoices.viewAll', 'View all invoices'), onPress: () => router.push('/(contractor)/geld' as any) },
        { text: t('common.close', 'Close') },
      ],
    );
  };

  const handleMarkSent = () => {
    markInvoiceSent(invoice.id);
    hapticSuccess();
    Alert.alert(
      t('invoices.reminderSent', 'Reminder sent'),
      t('invoices.reminderSentDesc', 'Vasco will track this and remind you again if needed.'),
    );
  };

  const handleViewPdf = async () => {
    hapticSuccess();
    const autoInv = invoiceAutomationService.getInvoice(invoice.id);
    if (autoInv) {
      await generateInvoicePdf(autoInv, businessProfile);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('invoices.invoice', 'Invoice')} {invoice.id}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusBg(invoice.status) }]}>
          <Text style={[styles.statusText, { color: getStatusColor(invoice.status) }]}>
            {t(`invoices.status.${invoice.status}`, invoice.status)}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Invoice Header Card */}
        <View style={styles.heroCard}>
          <Text style={styles.heroAmount}>{formatCurrency(total, country)}</Text>
          <Text style={styles.heroDue}>
            {invoice.status === 'paid'
              ? t('invoices.paymentReceived', 'Payment received')
              : invoice.dueInDays >= 0
                ? t('invoices.dueIn', { defaultValue: 'Due in {{count}} days', count: invoice.dueInDays })
                : t('invoices.overdueDays', { defaultValue: '{{count}} days overdue', count: Math.abs(invoice.dueInDays) })
            }
          </Text>
        </View>

        {/* Customer Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="person" size={18} color={Palette.hermesOrange} />
            <Text style={styles.cardTitle}>{t('invoices.customer', 'Customer')}</Text>
            <Pressable onPress={() => setEditingCustomer(!editingCustomer)} style={styles.editBtn}>
              <Ionicons name={editingCustomer ? 'close' : 'pencil'} size={14} color={Palette.hermesOrange} />
            </Pressable>
          </View>
          {editingCustomer ? (
            <View style={styles.editRow}>
              <TextInput
                style={styles.editInput}
                value={customerName}
                onChangeText={setCustomerName}
                placeholder={t('invoices.customerName', 'Customer name')}
                placeholderTextColor={SemanticColors.textTertiary}
              />
              <Pressable style={styles.saveBtn} onPress={handleSaveCustomer}>
                <Ionicons name="checkmark" size={18} color={Palette.white} />
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.customerName}>{invoice.customer}</Text>
              <Text style={styles.customerJob}>{invoice.job}</Text>
            </>
          )}
        </View>

        {/* Line Items Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="list" size={18} color={Palette.hermesOrange} />
            <Text style={styles.cardTitle}>{t('invoices.lineItems', 'Line items')}</Text>
            <Pressable
              onPress={() => {
                if (editingItems) handleSaveItems();
                else setEditingItems(true);
              }}
              style={styles.editBtn}
            >
              <Ionicons name={editingItems ? 'checkmark' : 'pencil'} size={14} color={Palette.hermesOrange} />
            </Pressable>
          </View>

          {/* Column headers */}
          <View style={styles.lineHeaderRow}>
            <Text style={[styles.lineHeaderText, { flex: 2 }]}>{t('invoices.description', 'Description')}</Text>
            <Text style={[styles.lineHeaderText, { width: 40, textAlign: 'center' }]}>{t('invoices.qty', 'Qty')}</Text>
            <Text style={[styles.lineHeaderText, { width: 70, textAlign: 'right' }]}>{t('invoices.unitPrice', 'Price')}</Text>
            <Text style={[styles.lineHeaderText, { width: 70, textAlign: 'right' }]}>{t('invoices.total', 'Total')}</Text>
          </View>

          {/* Items */}
          {localItems.map((item) => (
            <View key={item.id} style={styles.lineItemRow}>
              {editingItems ? (
                <>
                  <TextInput
                    style={[styles.lineInput, { flex: 2 }]}
                    value={item.description}
                    onChangeText={(v) => handleUpdateItem(item.id, 'description', v)}
                    placeholder={t('invoices.itemDescription', 'Description')}
                    placeholderTextColor={SemanticColors.textTertiary}
                  />
                  <TextInput
                    style={[styles.lineInput, { width: 40, textAlign: 'center' }]}
                    value={String(item.quantity)}
                    onChangeText={(v) => handleUpdateItem(item.id, 'quantity', v)}
                    keyboardType="numeric"
                  />
                  <TextInput
                    style={[styles.lineInput, { width: 70, textAlign: 'right' }]}
                    value={String(item.unitPrice)}
                    onChangeText={(v) => handleUpdateItem(item.id, 'unitPrice', v)}
                    keyboardType="numeric"
                  />
                  <Pressable onPress={() => handleRemoveItem(item.id)} style={styles.removeItemBtn}>
                    <Ionicons name="close-circle" size={18} color={SemanticColors.feedbackError} />
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={[styles.lineText, { flex: 2 }]} numberOfLines={2}>{item.description}</Text>
                  <Text style={[styles.lineTextMuted, { width: 40, textAlign: 'center' }]}>{item.quantity}</Text>
                  <Text style={[styles.lineTextMuted, { width: 70, textAlign: 'right' }]}>{formatCurrency(item.unitPrice, country)}</Text>
                  <Text style={[styles.lineText, { width: 70, textAlign: 'right' }]}>{formatCurrency(item.quantity * item.unitPrice, country)}</Text>
                </>
              )}
            </View>
          ))}

          {editingItems && (
            <Pressable style={styles.addItemBtn} onPress={handleAddItem}>
              <Ionicons name="add-circle-outline" size={18} color={Palette.hermesOrange} />
              <Text style={styles.addItemText}>{t('invoices.addItem', 'Add item')}</Text>
            </Pressable>
          )}
        </View>

        {/* Totals Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="calculator" size={18} color={Palette.hermesOrange} />
            <Text style={styles.cardTitle}>{t('invoices.totals', 'Totals')}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t('invoices.subtotal', 'Subtotal')}</Text>
            <Text style={styles.totalValue}>{formatCurrency(subtotal, country)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t('invoices.vat', 'VAT')} (21%)</Text>
            <Text style={styles.totalValue}>{formatCurrency(vatAmount, country)}</Text>
          </View>
          <View style={[styles.totalRow, styles.totalRowFinal]}>
            <Text style={styles.totalFinalLabel}>{t('invoices.totalAmount', 'Total')}</Text>
            <Text style={styles.totalFinalValue}>{formatCurrency(total, country)}</Text>
          </View>
          {lastExport ? (
            <View style={styles.statusNote}>
              <Ionicons name="checkmark-circle" size={14} color={SemanticColors.feedbackSuccess} />
              <Text style={styles.statusNoteText}>{t('invoices.exportedMoneybird', 'Exported to Moneybird')}</Text>
            </View>
          ) : null}
          {lastPayment ? (
            <View style={styles.statusNote}>
              <Ionicons name="link" size={14} color={SemanticColors.feedbackInfo} />
              <Text style={styles.statusNoteText}>{t('invoices.mollieCreated', 'Mollie payment link created')}</Text>
            </View>
          ) : null}
        </View>

        {/* Payment Methods */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="shield-checkmark" size={18} color={SemanticColors.feedbackSuccess} />
            <Text style={styles.cardTitle}>{t('invoices.offeredPaymentMethods', 'Payment methods')}</Text>
          </View>
          <View style={styles.paymentMethodList}>
            {paymentMethods.map((pm) => {
              const brandColor = getPaymentBrandColor(pm.name);
              const isPreferred = customerPreference
                ? pm.name.toLowerCase().replace(/\s+/g, '_') === customerPreference.toLowerCase()
                  || pm.name.toLowerCase() === customerPreference.toLowerCase()
                : false;
              return (
                <View
                  key={pm.name}
                  style={[
                    styles.paymentMethodRow,
                    isPreferred && [styles.paymentMethodPreferred, { borderColor: brandColor + '40' }],
                  ]}
                >
                  <View style={[styles.paymentMethodIconWrap, { backgroundColor: brandColor + '12' }]}>
                    <View style={[styles.paymentMethodDot, { backgroundColor: brandColor }]} />
                  </View>
                  <Text
                    style={[
                      styles.paymentMethodName,
                      isPreferred && { fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
                    ]}
                  >
                    {pm.name}
                  </Text>
                  {isPreferred && (
                    <View style={[styles.preferredBadge, { backgroundColor: brandColor + '15' }]}>
                      <Ionicons name="heart" size={10} color={brandColor} />
                      <Text style={[styles.preferredBadgeText, { color: brandColor }]}>{t('invoices.preferred', 'Preferred')}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
          {customerPreference && (
            <View style={styles.preferenceNote}>
              <Ionicons name="heart" size={14} color={Palette.hermesOrange} />
              <Text style={styles.preferenceNoteText}>
                {t('invoices.customerPrefers', { defaultValue: 'Customer prefers: {{method}}', method: getPaymentMethodLabel(customerPreference) })}
              </Text>
            </View>
          )}
          <View style={styles.securityNote}>
            <Ionicons name="lock-closed" size={12} color={SemanticColors.textTertiary} />
            <Text style={styles.securityNoteText}>
              {t('invoices.secureVia', { defaultValue: 'Secure via {{provider}} · PCI DSS compliant', provider: country === 'UK' ? 'Stripe' : 'Mollie' })}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="flash" size={18} color={Palette.hermesOrange} />
            <Text style={styles.cardTitle}>{t('invoices.actions', 'Actions')}</Text>
          </View>
          <ActionRow
            icon="document-text-outline"
            label={t('invoices.viewSharePdf', 'View & share PDF')}
            onPress={handleViewPdf}
          />
          <ActionRow
            icon="card-outline"
            label={mollieConnected ? t('invoices.createPaymentLink', 'Create payment link') : t('invoices.connectMollie', 'Connect Mollie')}
            onPress={() => mollieConnected ? handleCreatePayment() : router.push('/(modals)/mollie' as any)}
            border
          />
          <ActionRow
            icon="cloud-upload-outline"
            label={t('invoices.exportMoneybird', 'Export to Moneybird')}
            onPress={() => moneybirdConnected ? handleExportMoneybird() : router.push('/(modals)/moneybird' as any)}
            border
          />
          <ActionRow
            icon="send-outline"
            label={t('invoices.sendReminder', 'Send reminder')}
            onPress={handleMarkSent}
            border
          />
          {invoice.status !== 'paid' && (
            <ActionRow
              icon="checkmark-circle-outline"
              label={t('invoices.markPaid', 'Mark as paid')}
              onPress={handleMarkPaid}
              accent
              border
            />
          )}
        </View>

        {/* Activity Timeline */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="time-outline" size={18} color={Palette.hermesOrange} />
            <Text style={styles.cardTitle}>{t('invoices.activityTimeline', 'Activity')}</Text>
          </View>
          <View style={styles.timelineList}>
            {/* Created */}
            <TimelineEntry
              icon="add-circle-outline"
              color={SemanticColors.textTertiary}
              label={t('invoices.created', 'Invoice created')}
              date={invoice.lastUpdated
                ? new Date(invoice.lastUpdated).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
                : t('invoices.recently', 'Recently')}
              showLine
            />
            {/* Sent */}
            {(invoice.status === 'sent' || invoice.status === 'overdue' || invoice.status === 'paid') && (
              <TimelineEntry
                icon="send"
                color={SemanticColors.feedbackInfo}
                label={t('invoices.sentToCustomer', 'Sent to customer')}
                date={invoice.dueDate
                  ? new Date(new Date(invoice.dueDate).getTime() - 14 * 86400000).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
                  : ''}
                showLine
              />
            )}
            {/* Overdue */}
            {invoice.status === 'overdue' && (
              <TimelineEntry
                icon="alert-circle"
                color={SemanticColors.feedbackError}
                label={t('invoices.overdueNotice', 'Payment overdue')}
                labelColor={SemanticColors.feedbackError}
                date={`${invoice.dueDate
                  ? new Date(invoice.dueDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
                  : ''} · ${Math.abs(invoice.dueInDays)} ${t('invoices.daysLate', 'days late')}`}
                showLine
              />
            )}
            {/* Paid */}
            {invoice.status === 'paid' && (
              <TimelineEntry
                icon="checkmark"
                color={SemanticColors.feedbackSuccess}
                label={t('invoices.paymentReceived', 'Payment received')}
                labelColor={SemanticColors.feedbackSuccess}
                date={formatCurrency(invoice.amount, country)}
              />
            )}
            {/* Due date for unpaid */}
            {invoice.status !== 'paid' && (
              <TimelineEntry
                icon="calendar-outline"
                color={invoice.dueInDays < 0 ? SemanticColors.feedbackError : SemanticColors.textTertiary}
                label={invoice.dueInDays >= 0
                  ? t('invoices.dueIn', { defaultValue: 'Due in {{count}} days', count: invoice.dueInDays })
                  : t('invoices.overdueDays', { defaultValue: '{{count}} days overdue', count: Math.abs(invoice.dueInDays) })}
                date={invoice.dueDate
                  ? new Date(invoice.dueDate).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
                  : ''}
              />
            )}
          </View>
        </View>

        {/* Notes Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="chatbubble-outline" size={18} color={Palette.hermesOrange} />
            <Text style={styles.cardTitle}>{t('invoices.notes', 'Internal notes')}</Text>
            <Pressable onPress={() => {
              if (editingNotes) handleSaveNotes();
              else setEditingNotes(true);
            }} style={styles.editBtn}>
              <Ionicons name={editingNotes ? 'checkmark' : 'pencil'} size={14} color={Palette.hermesOrange} />
            </Pressable>
          </View>
          {editingNotes ? (
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder={t('invoices.addNotes', 'Add internal notes...')}
              placeholderTextColor={SemanticColors.textTertiary}
              multiline
              textAlignVertical="top"
            />
          ) : (
            <Text style={styles.notesText}>
              {notes || t('invoices.noNotes', 'No notes yet. Tap the pencil to add.')}
            </Text>
          )}
        </View>

        <View style={{ height: SafeArea.bottom + GRID.xl }} />
      </ScrollView>
    </View>
  );
}

// Action row component
function ActionRow({ icon, label, onPress, border, accent }: {
  icon: IconName;
  label: string;
  onPress: () => void;
  border?: boolean;
  accent?: boolean;
}) {
  return (
    <Pressable style={[styles.actionRow, border && styles.actionRowBorder]} onPress={onPress}>
      <View style={[styles.actionIcon, accent && { backgroundColor: Palette.hermesOrange + '15' }]}>
        <Ionicons name={icon} size={18} color={accent ? Palette.hermesOrange : SemanticColors.textSecondary} />
      </View>
      <Text style={[styles.actionLabel, accent && { color: Palette.hermesOrange, fontFamily: TYPE.titleFamily }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
    </Pressable>
  );
}

// Timeline entry component
function TimelineEntry({ icon, color, label, labelColor, date, showLine }: {
  icon: IconName;
  color: string;
  label: string;
  labelColor?: string;
  date: string;
  showLine?: boolean;
}) {
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineLeft}>
        <View style={[styles.timelineDot, { backgroundColor: color }]}>
          <Ionicons name={icon} size={10} color="#fff" />
        </View>
        {showLine && <View style={styles.timelineLine} />}
      </View>
      <View style={styles.timelineContent}>
        <Text style={[styles.timelineLabel, labelColor ? { color: labelColor } : undefined]}>{label}</Text>
        {date ? <Text style={styles.timelineDate}>{date}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
    paddingTop: SafeArea.top,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: GRID.md,
    paddingVertical: GRID.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderMuted,
    gap: GRID.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.sm,
  },
  headerTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    letterSpacing: TYPE.sectionTracking,
    color: SemanticColors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: GRID.sm + 2,
    paddingVertical: GRID.xs,
    borderRadius: RADIUS.sm,
  },
  statusText: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
    textTransform: 'capitalize',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: GRID.md,
    paddingTop: GRID.md,
    gap: GRID.md,
  },
  // Hero card
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: GRID.lg,
    alignItems: 'center',
  },
  heroAmount: {
    fontSize: TYPE.displaySize + 4,
    fontFamily: TYPE.displayFamily,
    letterSpacing: TYPE.displayTracking,
    color: SemanticColors.textPrimary,
  },
  heroDue: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
    marginTop: GRID.xs,
  },
  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: GRID.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
    marginBottom: GRID.sm + 4,
  },
  cardTitle: {
    flex: 1,
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  editBtn: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.sm,
    backgroundColor: Palette.hermesOrange + '0C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Customer
  customerName: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  customerJob: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
  },
  editInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    borderRadius: RADIUS.sm,
    paddingHorizontal: GRID.sm + 4,
    paddingVertical: GRID.sm,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary,
  },
  saveBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: Palette.hermesOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Line items
  lineHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: GRID.xs,
    gap: GRID.sm,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderMuted,
    marginBottom: GRID.xs,
  },
  lineHeaderText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.tinyFamily,
    color: SemanticColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lineItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: GRID.sm,
    gap: GRID.sm,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderMuted,
  },
  lineText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary,
  },
  lineTextMuted: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
  },
  lineInput: {
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    borderRadius: RADIUS.sm,
    paddingHorizontal: GRID.xs + 2,
    paddingVertical: GRID.xs,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary,
  },
  removeItemBtn: {
    width: 24,
    alignItems: 'center',
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.xs,
    paddingVertical: GRID.sm,
    justifyContent: 'center',
  },
  addItemText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: Palette.hermesOrange,
  },
  // Totals
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: GRID.xs + 2,
  },
  totalLabel: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
  },
  totalValue: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary,
  },
  totalRowFinal: {
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
    paddingTop: GRID.sm,
    marginTop: GRID.xs,
  },
  totalFinalLabel: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  totalFinalValue: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    letterSpacing: TYPE.sectionTracking,
    color: SemanticColors.textPrimary,
  },
  statusNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.xs,
    marginTop: GRID.sm,
  },
  statusNoteText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.feedbackSuccess,
  },
  // Payment methods
  paymentMethodList: {
    gap: GRID.xs + 2,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
    paddingVertical: GRID.sm,
    paddingHorizontal: GRID.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  paymentMethodPreferred: {
    backgroundColor: SemanticColors.surfaceBackground,
  },
  paymentMethodIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentMethodDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  paymentMethodName: {
    flex: 1,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary,
  },
  preferredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.xs,
    paddingHorizontal: GRID.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  preferredBadgeText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
  },
  preferenceNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.xs + 2,
    marginTop: GRID.sm,
    paddingTop: GRID.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  preferenceNoteText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: Palette.hermesOrange,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: GRID.xs + 2,
    marginTop: GRID.sm,
    paddingTop: GRID.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  securityNoteText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textTertiary,
  },
  // Actions
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: GRID.sm + 4,
    gap: GRID.sm + 4,
  },
  actionRowBorder: {
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderMuted,
  },
  actionIcon: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    flex: 1,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary,
  },
  // Timeline
  timelineList: {
    gap: 0,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: GRID.sm,
    minHeight: 40,
  },
  timelineLeft: {
    alignItems: 'center',
    width: 24,
  },
  timelineDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: SemanticColors.borderDefault,
    marginVertical: 2,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: GRID.sm,
  },
  timelineLabel: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  timelineDate: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  // Notes
  notesInput: {
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    borderRadius: RADIUS.sm,
    paddingHorizontal: GRID.sm + 4,
    paddingVertical: GRID.sm,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary,
    minHeight: 80,
  },
  notesText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
    lineHeight: 20,
  },
});

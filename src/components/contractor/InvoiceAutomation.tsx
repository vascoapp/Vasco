// =============================================================================
// INVOICE AUTOMATION COMPONENT
// =============================================================================
// Automated invoicing, payment tracking, and collection workflows
// =============================================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import {
  useAutoInvoices,
  usePaymentReminders,
  useInvoiceStats,
  AutoInvoice,
  PaymentReminder,
} from '../../services/invoiceAutomationService';

// =============================================================================
// TYPES
// =============================================================================

type TabType = 'all' | 'overdue' | 'paid';

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

const StatusBadge: React.FC<{ status: AutoInvoice['status'] }> = ({ status }) => {
  const getConfig = () => {
    switch (status) {
      case 'draft':
        return { label: 'Concept', color: Palette.gray500, bg: Palette.gray100 };
      case 'sent':
        return { label: 'Verzonden', color: Palette.blue500, bg: "rgba(59, 130, 246, 0.15)" };
      case 'viewed':
        return { label: 'Bekeken', color: "#a855f7", bg: "rgba(168, 85, 247, 0.15)" };
      case 'paid':
        return { label: 'Betaald', color: Palette.green500, bg: "rgba(34, 197, 94, 0.15)" };
      case 'overdue':
        return { label: 'Te laat', color: Palette.red500, bg: "rgba(239, 68, 68, 0.15)" };
      case 'reminded':
        return { label: 'Herinnerd', color: Palette.orange500, bg: Palette.orange100 };
      case 'collection':
        return { label: 'Incasso', color: "#b91c1c", bg: "rgba(239, 68, 68, 0.15)" };
      default:
        return { label: status, color: Palette.gray500, bg: Palette.gray100 };
    }
  };

  const config = getConfig();
  return (
    <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
      <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
};

const InvoiceCard: React.FC<{
  invoice: AutoInvoice;
  onView: () => void;
  onSend: () => void;
  onMarkPaid: () => void;
  onSendReminder: () => void;
}> = ({ invoice, onView, onSend, onMarkPaid, onSendReminder }) => {
  const [expanded, setExpanded] = useState(false);

  const daysOverdue = invoice.status === 'overdue' || invoice.dueDate < new Date()
    ? Math.floor((Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const remainingAmount = invoice.total - invoice.paidAmount;

  return (
    <Pressable
      style={styles.invoiceCard}
      onPress={() => setExpanded(!expanded)}
    >
      <View style={styles.invoiceHeader}>
        <View style={styles.invoiceInfo}>
          <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
          <Text style={styles.customerName}>{invoice.customerName}</Text>
        </View>
        <View style={styles.invoiceAmountSection}>
          <Text style={styles.invoiceAmount}>€{invoice.total.toFixed(2)}</Text>
          <StatusBadge status={invoice.status} />
        </View>
      </View>

      <View style={styles.invoiceMeta}>
        <View style={styles.metaItem}>
          <Ionicons name="calendar-outline" size={14} color={SemanticColors.textSecondary} />
          <Text style={styles.metaText}>
            {invoice.issueDate.toLocaleDateString('nl-NL')}
          </Text>
        </View>
        <View style={styles.metaDivider} />
        <View style={styles.metaItem}>
          <Ionicons
            name="time-outline"
            size={14}
            color={daysOverdue > 0 ? Palette.red500 : SemanticColors.textSecondary}
          />
          <Text
            style={[
              styles.metaText,
              daysOverdue > 0 && { color: Palette.red500, fontWeight: '600' },
            ]}
          >
            {daysOverdue > 0
              ? `${daysOverdue} dagen te laat`
              : `Vervalt ${invoice.dueDate.toLocaleDateString('nl-NL')}`}
          </Text>
        </View>
      </View>

      {expanded && (
        <View style={styles.expandedContent}>
          <View style={styles.lineItemsSection}>
            <Text style={styles.lineItemsTitle}>Regels</Text>
            {invoice.lineItems.map((item, index) => (
              <View key={index} style={styles.lineItem}>
                <Text style={styles.lineItemDesc} numberOfLines={1}>
                  {item.description}
                </Text>
                <Text style={styles.lineItemQty}>{item.quantity}x</Text>
                <Text style={styles.lineItemPrice}>€{item.total.toFixed(2)}</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotaal</Text>
              <Text style={styles.totalValue}>€{invoice.subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>BTW</Text>
              <Text style={styles.totalValue}>€{invoice.vatAmount.toFixed(2)}</Text>
            </View>
            <View style={[styles.totalRow, styles.grandTotal]}>
              <Text style={styles.grandTotalLabel}>Totaal</Text>
              <Text style={styles.grandTotalValue}>€{invoice.total.toFixed(2)}</Text>
            </View>
          </View>

          {invoice.reminders.length > 0 && (
            <View style={styles.remindersSection}>
              <Text style={styles.remindersTitle}>Herinneringen verzonden</Text>
              {invoice.reminders.map((reminder, index) => (
                <View key={index} style={styles.reminderItem}>
                  <Ionicons
                    name={reminder.opened ? 'mail-open-outline' : 'mail-outline'}
                    size={16}
                    color={reminder.opened ? Palette.green500 : SemanticColors.textSecondary}
                  />
                  <Text style={styles.reminderText}>
                    {reminder.type} - {reminder.date.toLocaleDateString('nl-NL')}
                  </Text>
                  {reminder.opened && (
                    <Text style={styles.reminderOpened}>Geopend</Text>
                  )}
                </View>
              ))}
            </View>
          )}

          <View style={styles.invoiceActions}>
            <Pressable style={styles.actionButton} onPress={onView}>
              <Ionicons name="eye-outline" size={18} color={SemanticColors.actionPrimary} />
              <Text style={styles.actionButtonText}>Bekijken</Text>
            </Pressable>

            {invoice.status === 'draft' && (
              <Pressable
                style={[styles.actionButton, styles.primaryButton]}
                onPress={onSend}
              >
                <Ionicons name="send-outline" size={18} color={Palette.white} />
                <Text style={[styles.actionButtonText, styles.primaryButtonText]}>
                  Versturen
                </Text>
              </Pressable>
            )}

            {(invoice.status === 'sent' || invoice.status === 'viewed' || invoice.status === 'reminded') && (
              <>
                <Pressable
                  style={[styles.actionButton, styles.successButton]}
                  onPress={onMarkPaid}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color={Palette.white} />
                  <Text style={[styles.actionButtonText, styles.primaryButtonText]}>
                    Betaald
                  </Text>
                </Pressable>
              </>
            )}

            {invoice.status === 'overdue' && (
              <Pressable
                style={[styles.actionButton, styles.warningButton]}
                onPress={onSendReminder}
              >
                <Ionicons name="notifications-outline" size={18} color={Palette.white} />
                <Text style={[styles.actionButtonText, styles.primaryButtonText]}>
                  Herinnering
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </Pressable>
  );
};

const ReminderCard: React.FC<{
  reminder: PaymentReminder;
  onSendReminder: () => void;
}> = ({ reminder, onSendReminder }) => (
  <View style={styles.reminderCard}>
    <View style={styles.reminderHeader}>
      <View style={styles.reminderInfo}>
        <Text style={styles.reminderInvoiceNumber}>{reminder.invoiceNumber}</Text>
        <Text style={styles.reminderCustomer}>{reminder.customerName}</Text>
      </View>
      <Text style={styles.reminderAmount}>€{reminder.amount.toFixed(2)}</Text>
    </View>

    <View style={styles.reminderDetails}>
      <View style={[styles.overdueIndicator, { backgroundColor: "rgba(239, 68, 68, 0.15)" }]}>
        <Ionicons name="alert-circle" size={16} color={Palette.red500} />
        <Text style={styles.overdueText}>{reminder.daysOverdue} dagen te laat</Text>
      </View>
      <Text style={styles.suggestedAction}>{reminder.suggestedAction}</Text>
    </View>

    <Pressable style={styles.sendReminderButton} onPress={onSendReminder}>
      <Ionicons name="notifications" size={18} color={Palette.white} />
      <Text style={styles.sendReminderText}>
        {reminder.nextReminderType === 'collection' ? 'Start Incasso' : 'Verstuur Herinnering'}
      </Text>
    </Pressable>
  </View>
);

const StatCard: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color?: string;
}> = ({ icon, label, value, color = SemanticColors.actionPrimary }) => (
  <View style={styles.statCard}>
    <View style={[styles.statIconContainer, { backgroundColor: color + '20' }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const InvoiceAutomation: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const { invoices, loading, send, markPaid, sendReminder } = useAutoInvoices();
  const reminders = usePaymentReminders();
  const stats = useInvoiceStats();

  const filteredInvoices = invoices.filter(inv => {
    switch (activeTab) {
      case 'overdue':
        return inv.status === 'overdue' || inv.status === 'reminded' || inv.status === 'collection';
      case 'paid':
        return inv.status === 'paid';
      default:
        return true;
    }
  });

  const handleView = (invoice: AutoInvoice) => {
    const statusLabels: Record<string, string> = {
      draft: 'Concept',
      sent: 'Verzonden',
      viewed: 'Bekeken',
      paid: 'Betaald',
      overdue: 'Te laat',
      reminded: 'Herinnerd',
      collection: 'Incasso',
    };
    Alert.alert(
      `Factuur ${invoice.invoiceNumber}`,
      `Klant: ${invoice.customerName}\nBedrag: \u20AC${invoice.total.toFixed(2)}\nStatus: ${statusLabels[invoice.status] || invoice.status}`,
    );
  };

  const handleSend = (invoiceId: string) => {
    send(invoiceId);
  };

  const handleMarkPaid = (invoiceId: string) => {
    markPaid(invoiceId, 'bank_transfer');
  };

  const handleSendReminder = (invoiceId: string, type: 'friendly' | 'reminder' | 'urgent' | 'final') => {
    sendReminder(invoiceId, type);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Facturatie</Text>
        <Pressable style={styles.addButton}>
          <Ionicons name="add" size={24} color={Palette.white} />
        </Pressable>
      </View>

      <View style={styles.statsSection}>
        <View style={styles.statsRow}>
          <StatCard
            icon="document-text-outline"
            label="Openstaand"
            value={`€${stats.outstanding.toLocaleString()}`}
            color={Palette.blue500}
          />
          <StatCard
            icon="alert-circle-outline"
            label="Te Laat"
            value={`€${stats.overdueAmount.toLocaleString()}`}
            color={Palette.red500}
          />
          <StatCard
            icon="checkmark-circle-outline"
            label="Betaald"
            value={`€${stats.totalPaid.toLocaleString()}`}
            color={Palette.green500}
          />
        </View>
      </View>

      {reminders.length > 0 && (
        <View style={styles.alertSection}>
          <View style={styles.alertHeader}>
            <Ionicons name="warning" size={20} color={Palette.orange500} />
            <Text style={styles.alertTitle}>Actie Vereist</Text>
            <View style={styles.alertBadge}>
              <Text style={styles.alertBadgeText}>{reminders.length}</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {reminders.map(reminder => (
              <ReminderCard
                key={reminder.invoiceId}
                reminder={reminder}
                onSendReminder={() =>
                  handleSendReminder(reminder.invoiceId, reminder.nextReminderType as 'friendly' | 'reminder' | 'urgent' | 'final')
                }
              />
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.tabs}>
        {[
          { key: 'all', label: 'Alle', count: invoices.length },
          { key: 'overdue', label: 'Te laat', count: invoices.filter(i => i.status === 'overdue').length },
          { key: 'paid', label: 'Betaald', count: invoices.filter(i => i.status === 'paid').length },
        ].map(tab => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key as TabType)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
            <View style={[styles.tabBadge, activeTab === tab.key && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === tab.key && styles.tabBadgeTextActive]}>
                {tab.count}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.invoiceList}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Laden...</Text>
            </View>
          ) : filteredInvoices.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-outline" size={48} color={SemanticColors.textSecondary} />
              <Text style={styles.emptyText}>Geen facturen gevonden</Text>
            </View>
          ) : (
            filteredInvoices.map(invoice => (
              <InvoiceCard
                key={invoice.id}
                invoice={invoice}
                onView={() => handleView(invoice)}
                onSend={() => handleSend(invoice.id)}
                onMarkPaid={() => handleMarkPaid(invoice.id)}
                onSendReminder={() => handleSendReminder(invoice.id, 'reminder')}
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SemanticColors.actionPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsSection: {
    backgroundColor: SemanticColors.surfacePrimary,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  alertSection: {
    backgroundColor: Palette.orange50,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Palette.orange200,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Palette.orange700,
    flex: 1,
  },
  alertBadge: {
    backgroundColor: Palette.orange500,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  alertBadgeText: {
    color: Palette.white,
    fontSize: 12,
    fontWeight: '700',
  },
  reminderCard: {
    backgroundColor: Palette.white,
    borderRadius: 12,
    padding: 14,
    marginRight: 12,
    width: 260,
    borderWidth: 1,
    borderColor: Palette.orange200,
  },
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  reminderInfo: {
    flex: 1,
  },
  reminderInvoiceNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.actionPrimary,
    fontFamily: 'monospace',
  },
  reminderCustomer: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginTop: 2,
  },
  reminderAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  reminderDetails: {
    marginBottom: 12,
  },
  overdueIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    marginBottom: 6,
  },
  overdueText: {
    fontSize: 12,
    fontWeight: '600',
    color: Palette.red600,
  },
  suggestedAction: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  sendReminderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.orange500,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  sendReminderText: {
    color: Palette.white,
    fontWeight: '600',
    fontSize: 14,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: SemanticColors.surfaceBackground,
    gap: 6,
  },
  tabActive: {
    backgroundColor: SemanticColors.actionPrimary + '15',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: SemanticColors.textSecondary,
  },
  tabTextActive: {
    color: SemanticColors.actionPrimary,
  },
  tabBadge: {
    backgroundColor: SemanticColors.borderDefault,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tabBadgeActive: {
    backgroundColor: SemanticColors.actionPrimary,
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  tabBadgeTextActive: {
    color: Palette.white,
  },
  content: {
    flex: 1,
  },
  invoiceList: {
    padding: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: SemanticColors.textSecondary,
    fontSize: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: SemanticColors.textSecondary,
  },
  invoiceCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  invoiceInfo: {
    flex: 1,
  },
  invoiceNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.actionPrimary,
    fontFamily: 'monospace',
  },
  customerName: {
    fontSize: 17,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginTop: 4,
  },
  invoiceAmountSection: {
    alignItems: 'flex-end',
  },
  invoiceAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  invoiceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaDivider: {
    width: 1,
    height: 12,
    backgroundColor: SemanticColors.borderDefault,
    marginHorizontal: 10,
  },
  metaText: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  expandedContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  lineItemsSection: {
    marginBottom: 16,
  },
  lineItemsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: 8,
  },
  lineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  lineItemDesc: {
    flex: 1,
    fontSize: 14,
    color: SemanticColors.textPrimary,
  },
  lineItemQty: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginHorizontal: 12,
  },
  lineItemPrice: {
    fontSize: 14,
    fontWeight: '500',
    color: SemanticColors.textPrimary,
    width: 80,
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  totalLabel: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  totalValue: {
    fontSize: 13,
    color: SemanticColors.textPrimary,
  },
  grandTotal: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  grandTotalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  grandTotalValue: {
    fontSize: 17,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  remindersSection: {
    marginBottom: 16,
  },
  remindersTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: 8,
  },
  reminderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  reminderText: {
    flex: 1,
    fontSize: 13,
    color: SemanticColors.textSecondary,
    textTransform: 'capitalize',
  },
  reminderOpened: {
    fontSize: 11,
    color: Palette.green600,
    fontWeight: '500',
  },
  invoiceActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.actionPrimary + '15',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonText: {
    color: SemanticColors.actionPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: SemanticColors.actionPrimary,
  },
  primaryButtonText: {
    color: Palette.white,
  },
  successButton: {
    backgroundColor: Palette.green500,
  },
  warningButton: {
    backgroundColor: Palette.orange500,
  },
});

export default InvoiceAutomation;

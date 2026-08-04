// IntegratedPayments.tsx - iDEAL/Mollie Integration for Dutch Contractors
// Quick payment links, reminders, and payment tracking

import React, { useState, useMemo } from 'react';
import { DEMO_MODE } from '../../config/demo';
import { useAppState } from '../../state/AppState';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import {
  PaymentSettings,
  PaymentLink,
  PaymentMethodType,
} from '../../types/contractor-features';
import { ContractorInvoice } from '../../types/contractor';
import { MOCK_PAYMENT_SETTINGS } from '../../data/mockPricebook';
import { MOCK_CONTRACTOR_INVOICES } from '../../data/mockContractor';
import { intelligence } from '../../intelligence/intelligenceEngine';
import { getCurrentUserId } from '../../lib/currentUser';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatCurrency0, type Country } from '../../i18n/formatting';
// Helper to create context for intelligence tracking
const createTrackingContext = () => ({
  platform: 'ios' as const,
  appVersion: '1.0.0',
  dayOfWeek: new Date().getDay(),
  hourOfDay: new Date().getHours(),
  isWeekend: new Date().getDay() === 0 || new Date().getDay() === 6,
  season: 'winter' as const,
});

// Color mapping for component
const Colors = {
  background: SemanticColors.surfaceBackground,
  surface: SemanticColors.surfacePrimary,
  surfaceHover: SemanticColors.surfaceSecondary,
  primary: SemanticColors.actionPrimary,
  success: SemanticColors.feedbackSuccess,
  warning: SemanticColors.feedbackWarning,
  error: SemanticColors.feedbackError,
  textPrimary: SemanticColors.textPrimary,
  textSecondary: SemanticColors.textSecondary,
  textMuted: SemanticColors.textTertiary,
  border: SemanticColors.borderDefault,
};

// ============================================
// MOCK PAYMENT LINKS
// ============================================

const DEMO_MOCK_PAYMENT_LINKS: PaymentLink[] = [
  {
    id: 'pl-001',
    invoiceId: 'inv-003',
    url: 'https://pay.vascobuild.comv/pl-001',
    shortUrl: 'vasco.pay/a1b2c3',
    qrCodeUrl: 'https://api.vascobuild.comv/qr/pl-001',
    amount: 450.12,
    currency: 'EUR',
    status: 'pending',
    expiresAt: '2024-02-15T23:59:59Z',
    createdAt: '2024-01-25T10:00:00Z',
  },
  {
    id: 'pl-002',
    invoiceId: 'inv-002',
    url: 'https://pay.vascobuild.comv/pl-002',
    shortUrl: 'vasco.pay/d4e5f6',
    amount: 1240.00,
    currency: 'EUR',
    status: 'paid',
    paidAt: '2024-01-20T14:32:00Z',
    paidAmount: 1240.00,
    paymentMethod: 'ideal',
    transactionId: 'tr_xxx456',
    providerFee: 0.29,
    netAmount: 1239.71,
    expiresAt: '2024-02-01T23:59:59Z',
    createdAt: '2024-01-15T09:00:00Z',
  },
];

/** Demo fixture — empty in production builds (see src/config/demo.ts). */
const MOCK_PAYMENT_LINKS: PaymentLink[] = DEMO_MODE ? DEMO_MOCK_PAYMENT_LINKS : [];

// ============================================
// PAYMENT METHOD ICONS
// ============================================

const PAYMENT_METHOD_INFO: Record<PaymentMethodType, { name: string; icon: string; color: string }> = {
  ideal: { name: 'iDEAL', icon: 'card', color: '#CC0066' },
  bancontact: { name: 'Bancontact', icon: 'card', color: '#005498' },
  creditcard: { name: 'Credit Card', icon: 'card-outline', color: '#1A1F71' },
  paypal: { name: 'PayPal', icon: 'logo-paypal', color: '#003087' },
  applepay: { name: 'Apple Pay', icon: 'logo-apple', color: "#FFFFFF" },
  googlepay: { name: 'Google Pay', icon: 'logo-google', color: '#4285F4' },
  klarna: { name: 'Klarna', icon: 'time-outline', color: '#FFB3C7' },
  'bank-transfer': { name: 'Bank Transfer', icon: 'business-outline', color: SemanticColors.textSecondary },
};

// ============================================
// SUB-COMPONENTS
// ============================================

interface PaymentMethodBadgeProps {
  method: PaymentMethodType;
  size?: 'small' | 'medium';
}

const PaymentMethodBadge: React.FC<PaymentMethodBadgeProps> = ({ method, size = 'small' }) => {
  const info = PAYMENT_METHOD_INFO[method];
  const iconSize = size === 'small' ? 16 : 20;

  return (
    <View style={[styles.methodBadge, { backgroundColor: info.color + '20' }]}>
      <Ionicons name={info.icon as any} size={iconSize} color={info.color} />
      {size === 'medium' && (
        <Text style={[styles.methodBadgeText, { color: info.color }]}>{info.name}</Text>
      )}
    </View>
  );
};

interface ConnectionStatusProps {
  settings: PaymentSettings;
  /** From the contractor's business profile. Undefined = not set, so the row
   *  is hidden rather than defaulting to the fixture's 14 days. */
  paymentTermsDays?: number;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ settings, paymentTermsDays }) => {
  const { t } = useTranslation();
  return (
    <View style={styles.connectionCard}>
      <View style={styles.connectionHeader}>
        <View style={styles.connectionBrand}>
          <View style={[styles.mollieIcon, settings.isConnected && styles.mollieIconConnected]}>
            <Text style={styles.mollieText}>M</Text>
          </View>
          <View>
            <Text style={styles.connectionTitle}>Mollie Payments</Text>
            <Text style={styles.connectionSubtitle}>
              {settings.isConnected
                ? (settings.accountId
                    ? t('payments.account', 'Account: {{id}}', { id: settings.accountId })
                    : t('payments.connected', 'Connected'))
                : t('payments.notConnected', 'Not connected')}
            </Text>
          </View>
        </View>
        <View style={[
          styles.statusBadge,
          settings.isConnected ? styles.statusConnected : styles.statusDisconnected,
        ]}>
          <Ionicons
            name={settings.isConnected ? 'checkmark-circle' : 'alert-circle'}
            size={14}
            color={settings.isConnected ? Colors.success : Colors.warning}
          />
          <Text style={[
            styles.statusText,
            { color: settings.isConnected ? Colors.success : Colors.warning },
          ]}>
            {settings.isConnected ? 'Connected' : 'Setup Required'}
          </Text>
        </View>
      </View>

      {/* Hidden when nothing is enabled — "Enabled payment methods:" above an
          empty row reads as a rendering failure. */}
      {settings.enabledMethods.length > 0 && (
        <View style={styles.enabledMethods}>
          <Text style={styles.enabledMethodsLabel}>
            {t('payments.enabledMethods', 'Enabled payment methods:')}
          </Text>
          <View style={styles.methodsList}>
            {settings.enabledMethods.map((method) => (
              <PaymentMethodBadge key={method} method={method} />
            ))}
          </View>
        </View>
      )}

      {/* "Deposit Required 30%" and "Auto Reminders On" lived here as well as on
          the toggles below, and were the same untrue claim: no deposit is ever
          required and nothing sends an automatic reminder. Removed rather than
          restyled. Payment terms are real — the contractor sets them in their
          business profile — so that one stays, and is hidden when unset instead
          of falling back to the fixture's 14. */}
      {typeof paymentTermsDays === 'number' && (
        <View style={styles.settingsRow}>
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>{t('payments.paymentTerms', 'Payment terms')}</Text>
            <Text style={styles.settingValue}>
              {t('payments.days', { count: paymentTermsDays, defaultValue: '{{count}} days' })}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

interface OutstandingInvoiceCardProps {
  invoice: ContractorInvoice;
  paymentLink?: PaymentLink;
  onCreateLink: () => void;
  onSendReminder: () => void;
  onCopyLink: () => void;
}

const OutstandingInvoiceCard: React.FC<OutstandingInvoiceCardProps> = ({
  invoice,
  paymentLink,
  onCreateLink,
  onSendReminder,
  onCopyLink,
}) => {
  const { user } = useAuth();
  const country = (user?.country ?? 'NL') as Country;
  const dueDate = new Date(invoice.dueDate);
  const today = new Date();
  const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const isOverdue = daysUntilDue < 0;

  return (
    <View style={styles.invoiceCard}>
      <View style={styles.invoiceHeader}>
        <View>
          {/* Headline is the invoice reference when there is one, otherwise the
              customer — never the row id. The old code rendered
              "Customer #{last 3 of the id}" as the subtitle, which identified
              nobody. */}
          <Text style={styles.invoiceNumber}>
            {invoice.invoiceNumber || invoice.customerName || ''}
          </Text>
          {!!invoice.invoiceNumber && !!invoice.customerName && (
            <Text style={styles.invoiceCustomer}>{invoice.customerName}</Text>
          )}
        </View>
        <View style={styles.invoiceAmountContainer}>
          <Text style={styles.invoiceAmount}>
            {formatCurrency(invoice.total, country)}
          </Text>
          <View style={[
            styles.dueBadge,
            isOverdue ? styles.dueBadgeOverdue : styles.dueBadgePending,
          ]}>
            <Text style={[
              styles.dueBadgeText,
              { color: isOverdue ? Colors.error : Colors.warning },
            ]}>
              {isOverdue ? `${Math.abs(daysUntilDue)}d overdue` : `Due in ${daysUntilDue}d`}
            </Text>
          </View>
        </View>
      </View>

      {paymentLink ? (
        <View style={styles.paymentLinkSection}>
          <View style={styles.paymentLinkInfo}>
            <Ionicons name="link" size={16} color={Colors.primary} />
            <Text style={styles.paymentLinkUrl}>{paymentLink.shortUrl}</Text>
            <Pressable onPress={onCopyLink} style={styles.copyButton}>
              <Ionicons name="copy-outline" size={16} color={Colors.textSecondary} />
            </Pressable>
          </View>
          <View style={styles.linkStats}>
            <Text style={styles.linkStatText}>
              Created {new Date(paymentLink.createdAt).toLocaleDateString(undefined)}
            </Text>
            <Text style={styles.linkStatText}>
              Expires {new Date(paymentLink.expiresAt).toLocaleDateString(undefined)}
            </Text>
          </View>
        </View>
      ) : (
        <Pressable style={styles.createLinkButton} onPress={onCreateLink}>
          <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
          <Text style={styles.createLinkText}>Create Payment Link</Text>
        </Pressable>
      )}

      <View style={styles.invoiceActions}>
        <Pressable style={styles.actionButton} onPress={onSendReminder}>
          <Ionicons name="notifications-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.actionButtonText}>Send Reminder</Text>
        </Pressable>
        <Pressable style={styles.actionButton}>
          <Ionicons name="chatbubble-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.actionButtonText}>WhatsApp</Text>
        </Pressable>
        <Pressable style={styles.actionButton}>
          <Ionicons name="qr-code-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.actionButtonText}>QR Code</Text>
        </Pressable>
      </View>
    </View>
  );
};

interface PaidInvoiceCardProps {
  invoice: ContractorInvoice;
  paymentLink: PaymentLink;
}

const PaidInvoiceCard: React.FC<PaidInvoiceCardProps> = ({ invoice, paymentLink }) => {
  const { user } = useAuth();
  const country = (user?.country ?? 'NL') as Country;
  return (
    <View style={[styles.invoiceCard, styles.paidInvoiceCard]}>
      <View style={styles.invoiceHeader}>
        <View>
          {/* Headline is the invoice reference when there is one, otherwise the
              customer — never the row id. The old code rendered
              "Customer #{last 3 of the id}" as the subtitle, which identified
              nobody. */}
          <Text style={styles.invoiceNumber}>
            {invoice.invoiceNumber || invoice.customerName || ''}
          </Text>
          {!!invoice.invoiceNumber && !!invoice.customerName && (
            <Text style={styles.invoiceCustomer}>{invoice.customerName}</Text>
          )}
        </View>
        <View style={styles.invoiceAmountContainer}>
          <Text style={[styles.invoiceAmount, styles.paidAmount]}>
            {formatCurrency(paymentLink.paidAmount ?? 0, country)}
          </Text>
          <View style={styles.paidBadge}>
            <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
            <Text style={styles.paidBadgeText}>Paid</Text>
          </View>
        </View>
      </View>

      <View style={styles.paymentDetails}>
        <View style={styles.paymentDetailRow}>
          <Text style={styles.paymentDetailLabel}>Paid via</Text>
          <View style={styles.paymentMethodRow}>
            <PaymentMethodBadge method={paymentLink.paymentMethod!} size="medium" />
          </View>
        </View>
        <View style={styles.paymentDetailRow}>
          <Text style={styles.paymentDetailLabel}>Date</Text>
          <Text style={styles.paymentDetailValue}>
            {new Date(paymentLink.paidAt!).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
        <View style={styles.paymentDetailRow}>
          <Text style={styles.paymentDetailLabel}>Net received</Text>
          <Text style={styles.paymentDetailValue}>
            {formatCurrency(paymentLink.netAmount ?? 0, country)}
            <Text style={styles.feeText}> (fee: {formatCurrency(paymentLink.providerFee ?? 0, country)})</Text>
          </Text>
        </View>
      </View>
    </View>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

interface IntegratedPaymentsProps {
  onClose?: () => void;
}

export const IntegratedPayments: React.FC<IntegratedPaymentsProps> = ({ onClose }) => {
  const { user } = useAuth();
  const country = (user?.country ?? 'NL') as Country;
  const { t } = useTranslation();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'outstanding' | 'paid' | 'settings'>('outstanding');
  const { invoices: appInvoices, mollieConnected, businessProfile } = useAppState();

  // Was MOCK_CONTRACTOR_INVOICES — an ungated fixture, so this screen showed
  // every contractor a fabricated "INV-2024-0022 · € 1.051 · 918d overdue" as
  // their own outstanding money, on a surface whose entire job is telling them
  // what they are owed. Now the real invoice list.
  //
  // Only six fields are read off an invoice here, so the shapes reconcile with
  // a small view-model rather than a rewrite. `customer` is a NAME, which also
  // removes the "Customer #003" id leak the old fixture forced.
  const invoices = useMemo<ContractorInvoice[]>(
    () =>
      appInvoices.map((inv) => ({
        ...(inv as unknown as ContractorInvoice),
        id: inv.id,
        // NOT `?? inv.id`: falling back to the row id printed "inv-seed-1" and
        // "i-1043" as if they were invoice numbers. An invoice without a
        // reference has no number to show, and the card falls back to the
        // customer name instead (learnings #67 — the raw-id leak class).
        invoiceNumber: inv.reference ?? '',
        customerId: inv.customerId ?? '',
        customerName: inv.customerName ?? inv.customer ?? '',
        dueDate: inv.dueDate ?? '',
        status: inv.status,
        total: inv.total ?? inv.amount ?? 0,
      })),
    [appInvoices],
  );

  // The Mollie panel used to read a fixture that hardcoded isConnected:true and
  // "Account: mol_xxx123", so it told every contractor their payment provider
  // was live when nothing was connected. AppState owns the real flag.
  // accountId is blanked rather than passed through: "mol_xxx123" was invented
  // too, and a made-up account number on a payments screen is the kind of
  // detail a contractor would reasonably quote back to their bank.
  const settings = useMemo<PaymentSettings>(
    () => ({
      ...MOCK_PAYMENT_SETTINGS,
      isConnected: mollieConnected,
      accountId: '',
      // No provider connected means no method is enabled, whatever the fixture
      // said. Ticking iDEAL/Bancontact for someone who cannot take a payment is
      // the same false reassurance as the "Connected" badge was.
      enabledMethods: mollieConnected ? MOCK_PAYMENT_SETTINGS.enabledMethods : [],
    }),
    [mollieConnected],
  );
  const [paymentLinks] = useState<PaymentLink[]>(MOCK_PAYMENT_LINKS);

  // Derived from the contractor's own paid invoices. Each figure is null when
  // the data to compute it is absent — a contractor with no paid invoice has no
  // "days to pay", and 0 would read as "you get paid instantly".
  const paymentStats = useMemo(() => {
    const paid = appInvoices.filter((inv) => inv.status === 'paid');
    if (paid.length === 0) return null;

    const withDuration = paid
      .map((inv) => {
        const sent = inv.sentAt ?? inv.createdAt;
        if (!sent || !inv.paidAt) return null;
        const days = (new Date(inv.paidAt).getTime() - new Date(sent).getTime()) / 86_400_000;
        return Number.isFinite(days) && days >= 0 ? days : null;
      })
      .filter((d): d is number => d !== null);

    const withDue = paid.filter((inv) => inv.dueDate && inv.paidAt);

    return {
      paidCount: paid.length,
      avgDaysToPay: withDuration.length
        ? withDuration.reduce((s, d) => s + d, 0) / withDuration.length
        : null,
      onTimePercent: withDue.length
        ? Math.round(
            (withDue.filter((inv) => new Date(inv.paidAt!) <= new Date(inv.dueDate!)).length /
              withDue.length) * 100,
          )
        : null,
    };
  }, [appInvoices]);

  // Filter invoices
  const outstandingInvoices = invoices.filter(
    (inv) => inv.status === 'sent' || inv.status === 'overdue'
  );
  const paidInvoices = invoices.filter((inv) => inv.status === 'paid');

  // Calculate totals
  const totalOutstanding = outstandingInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const totalOverdue = outstandingInvoices
    .filter((inv) => {
      const dueDate = new Date(inv.dueDate);
      return dueDate < new Date();
    })
    .reduce((sum, inv) => sum + inv.total, 0);

  const handleCreateLink = (invoiceId: string) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    Alert.alert(
      'Create Payment Link',
      'Generate an iDEAL payment link for this invoice?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create Link',
          onPress: () => {
            // Track invoice sent for intelligence learning
            intelligence.trackEvent({
              eventType: 'invoice_sent',
              userId: getCurrentUserId(),
              sessionId: 'current',
              context: createTrackingContext(),
              payload: {
                invoiceId,
                invoiceNumber: invoice?.invoiceNumber,
                amount: invoice?.total,
                customerId: invoice?.customerId,
                paymentMethod: 'ideal',
                linkCreated: true,
              },
              entities: invoice ? [
                { id: invoice.customerId, type: 'customer', name: `Customer ${invoice.customerId.slice(-3)}`, confidence: 0.9 },
              ] : [],
            });
            Alert.alert(t('paymentAlerts.linkCreatedTitle'), t('paymentAlerts.linkCreatedBody'));
          },
        },
      ]
    );
  };

  const handleSendReminder = (invoiceId: string) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    Alert.alert(
      'Send Reminder',
      'Send a payment reminder to the customer?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Email',
          onPress: () => {
            // Track reminder sent for intelligence
            intelligence.trackEvent({
              eventType: 'payment_reminder_sent',
              userId: getCurrentUserId(),
              sessionId: 'current',
              context: createTrackingContext(),
              payload: {
                invoiceId,
                invoiceNumber: invoice?.invoiceNumber,
                amount: invoice?.total,
                customerId: invoice?.customerId,
                channel: 'email',
                daysOverdue: invoice ? Math.ceil((new Date().getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)) : 0,
              },
              entities: invoice ? [
                { id: invoice.customerId, type: 'customer', name: `Customer ${invoice.customerId.slice(-3)}`, confidence: 0.9 },
              ] : [],
            });
            Alert.alert(t('paymentAlerts.reminderEmailTitle'), t('paymentAlerts.reminderEmailBody'));
          },
        },
        {
          text: 'WhatsApp',
          onPress: () => {
            // Track reminder sent for intelligence
            intelligence.trackEvent({
              eventType: 'payment_reminder_sent',
              userId: getCurrentUserId(),
              sessionId: 'current',
              context: createTrackingContext(),
              payload: {
                invoiceId,
                invoiceNumber: invoice?.invoiceNumber,
                amount: invoice?.total,
                customerId: invoice?.customerId,
                channel: 'whatsapp',
                daysOverdue: invoice ? Math.ceil((new Date().getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)) : 0,
              },
              entities: invoice ? [
                { id: invoice.customerId, type: 'customer', name: `Customer ${invoice.customerId.slice(-3)}`, confidence: 0.9 },
              ] : [],
            });
            Alert.alert(t('paymentAlerts.reminderEmailTitle'), t('paymentAlerts.reminderWhatsappBody'));
          },
        },
      ]
    );
  };

  const handleCopyLink = (url: string) => {
    Alert.alert(t('paymentAlerts.copiedTitle'), t('paymentAlerts.copiedBody', { url }));
  };

  const tabs = [
    { id: 'outstanding' as const, label: 'Outstanding', badge: outstandingInvoices.length },
    { id: 'paid' as const, label: 'Paid', badge: paidInvoices.length },
    { id: 'settings' as const, label: 'Settings', badge: undefined },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Payments</Text>
          <Text style={styles.subtitle}>iDEAL & Mollie Integration</Text>
        </View>
        {onClose && (
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={Colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, styles.summaryCardOutstanding]}>
          <Text style={styles.summaryLabel}>Outstanding</Text>
          <Text style={styles.summaryValue}>
            {formatCurrency0(totalOutstanding, country)}
          </Text>
          <Text style={styles.summarySubtext}>
            {outstandingInvoices.length} invoice{outstandingInvoices.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={[styles.summaryCard, styles.summaryCardOverdue]}>
          <Text style={styles.summaryLabel}>Overdue</Text>
          <Text style={[styles.summaryValue, { color: Colors.error }]}>
            {formatCurrency0(totalOverdue, country)}
          </Text>
          <Text style={styles.summarySubtext}>Needs attention</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
            {tab.badge !== undefined && tab.badge > 0 && (
              <View style={[styles.tabBadge, activeTab === tab.id && styles.tabBadgeActive]}>
                <Text style={styles.tabBadgeText}>{tab.badge}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'outstanding' && (
          <View style={styles.tabContent}>
            {outstandingInvoices.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
                <Text style={styles.emptyStateTitle}>All caught up!</Text>
                <Text style={styles.emptyStateText}>No outstanding invoices</Text>
              </View>
            ) : (
              outstandingInvoices.map((invoice) => {
                const link = paymentLinks.find(
                  (pl) => pl.invoiceId === invoice.id && pl.status === 'pending'
                );
                return (
                  <OutstandingInvoiceCard
                    key={invoice.id}
                    invoice={invoice}
                    paymentLink={link}
                    onCreateLink={() => handleCreateLink(invoice.id)}
                    onSendReminder={() => handleSendReminder(invoice.id)}
                    onCopyLink={() => link && handleCopyLink(link.shortUrl || link.url)}
                  />
                );
              })
            )}
          </View>
        )}

        {activeTab === 'paid' && (
          <View style={styles.tabContent}>
            {paymentLinks
              .filter((pl) => pl.status === 'paid')
              .map((link) => {
                const invoice = invoices.find((inv) => inv.id === link.invoiceId);
                if (!invoice) return null;
                return (
                  <PaidInvoiceCard key={link.id} invoice={invoice} paymentLink={link} />
                );
              })}

            {/* Quick stats. These read "8.2 avg days to pay / 92% paid on time
                / iDEAL most used" as hardcoded literals — every contractor was
                shown the same invented performance as their own. Both figures
                below are now derived from paid invoices, and the block is
                hidden when nothing has been paid yet rather than showing a
                confident zero. "Most used method" is gone: payment method is
                not recorded on an invoice, so there was nothing to derive it
                from (learnings #103). */}
            {paymentStats && (
              <View style={styles.paidStats}>
                <Text style={styles.paidStatsTitle}>{t('payments.statsTitle', 'Your payment record')}</Text>
                <View style={styles.paidStatsRow}>
                  {paymentStats.avgDaysToPay !== null && (
                    <View style={styles.paidStatItem}>
                      <Text style={styles.paidStatValue}>{paymentStats.avgDaysToPay.toFixed(1)}</Text>
                      <Text style={styles.paidStatLabel}>{t('payments.avgDaysToPay', 'Avg. days to pay')}</Text>
                    </View>
                  )}
                  {paymentStats.onTimePercent !== null && (
                    <View style={styles.paidStatItem}>
                      <Text style={styles.paidStatValue}>{paymentStats.onTimePercent}%</Text>
                      <Text style={styles.paidStatLabel}>{t('payments.paidOnTime', 'Paid on time')}</Text>
                    </View>
                  )}
                  <View style={styles.paidStatItem}>
                    <Text style={styles.paidStatValue}>{paymentStats.paidCount}</Text>
                    <Text style={styles.paidStatLabel}>{t('payments.invoicesPaid', 'Invoices paid')}</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {activeTab === 'settings' && (
          <View style={styles.tabContent}>
            <ConnectionStatus settings={settings} paymentTermsDays={businessProfile?.defaultPaymentTerms} />

            {/* This block held three toggles — Auto Reminders, Require Deposit,
                Enable Tipping — with no onPress and no setter behind them, so
                none could be changed. Worse than dead: "Auto Reminders · send at
                7, 3, 1, 0 days before due" rendered switched ON while nothing in
                the app sent them, which is a claim a contractor could rely on
                and then lose money to.
                Reminders DO exist, in the automation packs, so that row now goes
                where the real setting lives. Deposits and tipping have no
                backing behaviour at all and are gone rather than mocked. */}
            <View style={styles.settingsSection}>
              <Text style={styles.settingsSectionTitle}>{t('payments.preferences', 'Preferences')}</Text>

              <Pressable
                style={styles.settingsRow2}
                onPress={() => router.push('/contractor/automations' as any)}
                accessibilityRole="button"
              >
                <View style={styles.settingsRowLeft}>
                  <Ionicons name="notifications-outline" size={20} color={Colors.textSecondary} />
                  <View>
                    <Text style={styles.settingsRowTitle}>{t('payments.reminders', 'Payment reminders')}</Text>
                    <Text style={styles.settingsRowSubtitle}>
                      {t('payments.remindersSub', 'Set up in Automations')}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
              </Pressable>
            </View>

            {/* Payment Methods */}
            <View style={styles.settingsSection}>
              <Text style={styles.settingsSectionTitle}>Payment Methods</Text>
              <View style={styles.methodsGrid}>
                {(Object.keys(PAYMENT_METHOD_INFO) as PaymentMethodType[]).map((method) => {
                  const info = PAYMENT_METHOD_INFO[method];
                  const isEnabled = settings.enabledMethods.includes(method);
                  return (
                    // A View, not a Pressable: this grid had no onPress, so it
                    // offered a tap target that could never change anything.
                    // Which methods are live is configured in Mollie, not here.
                    <View
                      key={method}
                      style={[styles.methodCard, isEnabled && styles.methodCardEnabled]}
                    >
                      <Ionicons
                        name={info.icon as any}
                        size={24}
                        color={isEnabled ? info.color : Colors.textMuted}
                      />
                      <Text style={[styles.methodCardText, isEnabled && { color: Colors.textPrimary }]}>
                        {info.name}
                      </Text>
                      {isEnabled && (
                        <Ionicons
                          name="checkmark-circle"
                          size={16}
                          color={Colors.success}
                          style={styles.methodCardCheck}
                        />
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* R66r61: FAB routes to /quotes/new — the canonical entry for new
          business. The earlier Alert was a placeholder that confirmed
          "Create a new invoice with payment link?" but didn't follow
          through. Invoices in this app are minted from accepted quotes
          (addInvoiceFromJob), so routing to the quote-create flow is the
          correct shortcut from the outstanding-invoices view. */}
      {activeTab === 'outstanding' && (
        <Pressable
          style={styles.fab}
          accessibilityRole="button"
          accessibilityLabel={t('payments.newQuoteFab', 'New quote')}
          onPress={() => router.push('/quotes/new')}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </Pressable>
      )}
    </View>
  );
};

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    paddingTop: 60,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: TYPE.displaySize,
    fontFamily: TYPE.sectionFamily,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: TYPE.bodySize - 1,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  closeButton: {
    padding: 8,
  },

  // Summary Cards
  summaryRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  summaryCardOutstanding: {
    backgroundColor: Colors.warning + '10',
    borderColor: Colors.warning + '30',
  },
  summaryCardOverdue: {
    backgroundColor: Colors.error + '10',
    borderColor: Colors.error + '30',
  },
  summaryLabel: {
    fontSize: TYPE.labelSize,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: TYPE.displaySize - 4,
    fontFamily: TYPE.sectionFamily,
    color: Colors.textPrimary,
  },
  summarySubtext: {
    fontSize: TYPE.labelSize,
    color: Colors.textMuted,
    marginTop: 4,
  },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.labelFamily,
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  tabBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    backgroundColor: Colors.surfaceHover,
  },
  tabBadgeActive: {
    backgroundColor: Colors.primary + '20',
  },
  tabBadgeText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
    color: Colors.textSecondary,
  },

  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },

  // Invoice Cards
  invoiceCard: {
    backgroundColor: Colors.surface,
    borderRadius: RADIUS.md,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  paidInvoiceCard: {
    borderColor: Colors.success + '30',
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  invoiceNumber: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: Colors.textPrimary,
  },
  invoiceCustomer: {
    fontSize: TYPE.captionSize,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  invoiceAmountContainer: {
    alignItems: 'flex-end',
  },
  invoiceAmount: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: Colors.textPrimary,
  },
  paidAmount: {
    color: Colors.success,
  },
  dueBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
  },
  dueBadgePending: {
    backgroundColor: Colors.warning + '20',
  },
  dueBadgeOverdue: {
    backgroundColor: Colors.error + '20',
  },
  dueBadgeText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.success + '20',
    marginTop: 4,
  },
  paidBadgeText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
    color: Colors.success,
  },

  // Payment Link Section
  paymentLinkSection: {
    backgroundColor: Colors.primary + '10',
    borderRadius: RADIUS.sm,
    padding: 12,
    marginBottom: 12,
  },
  paymentLinkInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paymentLinkUrl: {
    flex: 1,
    fontSize: TYPE.bodySize - 1,
    color: Colors.primary,
    fontFamily: 'monospace',
  },
  copyButton: {
    padding: 4,
  },
  linkStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  linkStatText: {
    fontSize: TYPE.tinySize,
    color: Colors.textMuted,
  },
  createLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: Colors.primary + '10',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    borderStyle: 'dashed',
    marginBottom: 12,
  },
  createLinkText: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.labelFamily,
    color: Colors.primary,
  },

  // Invoice Actions
  invoiceActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
  },
  actionButtonText: {
    fontSize: TYPE.labelSize,
    color: Colors.textSecondary,
  },

  // Payment Details (Paid)
  paymentDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  paymentDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentDetailLabel: {
    fontSize: TYPE.captionSize,
    color: Colors.textSecondary,
  },
  paymentDetailValue: {
    fontSize: TYPE.captionSize,
    color: Colors.textPrimary,
  },
  paymentMethodRow: {
    flexDirection: 'row',
  },
  feeText: {
    fontSize: TYPE.tinySize,
    color: Colors.textMuted,
  },

  // Method Badge
  methodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  methodBadgeText: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.labelFamily,
  },

  // Connection Status
  connectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: RADIUS.md,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  connectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  connectionBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mollieIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    backgroundColor: Colors.surfaceHover,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mollieIconConnected: {
    backgroundColor: '#CC0066',
  },
  mollieText: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: Palette.white,
  },
  connectionTitle: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: Colors.textPrimary,
  },
  connectionSubtitle: {
    fontSize: TYPE.labelSize,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.xl,
  },
  statusConnected: {
    backgroundColor: Colors.success + '20',
  },
  statusDisconnected: {
    backgroundColor: Colors.warning + '20',
  },
  statusText: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.labelFamily,
  },
  enabledMethods: {
    marginBottom: 16,
  },
  enabledMethodsLabel: {
    fontSize: TYPE.labelSize,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  methodsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  settingItem: {
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: TYPE.tinySize,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  settingValue: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
    color: Colors.textPrimary,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.titleFamily,
    color: Colors.textPrimary,
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: TYPE.bodySize - 1,
    color: Colors.textSecondary,
    marginTop: 4,
  },

  // Paid Stats
  paidStats: {
    backgroundColor: Colors.surface,
    borderRadius: RADIUS.md,
    padding: 16,
    marginTop: 16,
  },
  paidStatsTitle: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  paidStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  paidStatItem: {
    alignItems: 'center',
  },
  paidStatValue: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: Colors.textPrimary,
  },
  paidStatLabel: {
    fontSize: TYPE.tinySize,
    color: Colors.textMuted,
    marginTop: 4,
  },

  // Settings Section
  settingsSection: {
    marginBottom: 24,
  },
  settingsSectionTitle: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
    color: Colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingsRow2: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: RADIUS.md,
    marginBottom: 8,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingsRowTitle: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.labelFamily,
    color: Colors.textPrimary,
  },
  settingsRowSubtitle: {
    fontSize: TYPE.labelSize,
    color: Colors.textMuted,
    marginTop: 2,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: RADIUS.md,
    backgroundColor: Colors.surfaceHover,
    padding: 2,
  },
  toggleOn: {
    backgroundColor: Colors.success,
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: RADIUS.md,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  toggleKnobOn: {
    marginLeft: 20,
  },

  // Methods Grid
  methodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  methodCard: {
    width: '48%',
    backgroundColor: Colors.surface,
    borderRadius: RADIUS.md,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    opacity: 0.5,
  },
  methodCardEnabled: {
    opacity: 1,
    borderColor: Colors.success + '50',
  },
  methodCardText: {
    fontSize: TYPE.labelSize,
    color: Colors.textMuted,
    marginTop: 8,
  },
  methodCardCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default IntegratedPayments;

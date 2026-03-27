import { useState, useEffect, useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { AssistBanner } from '../../src/components/AssistBanner';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { Screen } from '../../src/components/Screen';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Radius } from '../../src/theme/radius';
import { Spacing } from '../../src/theme/spacing';
import { Typography } from '../../src/theme/typography';
import { useAppState } from '../../src/state/AppState';
import { useAuth } from '../../src/context/AuthContext';
import { hapticError, hapticSuccess } from '../../src/utils/haptics';
import { generateInvoicePdf } from '../../src/services/invoicePdfService';
import { invoiceAutomationService } from '../../src/services/invoiceAutomationService';
import { getPaymentDisplayForCountry, getPaymentBrandColor } from '../../src/config/paymentMethods';
import {
  getCustomerPaymentPreference,
  getPaymentMethodLabel,
} from '../../src/services/customerPaymentPreferenceService';

type IconName = keyof typeof Ionicons.glyphMap;

export default function InvoiceDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    invoices,
    markInvoicePaid,
    markInvoiceSent,
    moneybirdConnected,
    exportInvoice,
    lastMoneybirdExport,
    mollieConnected,
    createPaymentLink,
    lastMolliePayment,
    businessProfile,
  } = useAppState();
  const { user } = useAuth();
  const invoice = invoices.find((item) => item.id === id);

  // Payment methods for this country
  const country = user?.country ?? 'NL';
  const paymentMethods = getPaymentDisplayForCountry(country);

  // Customer payment preference (from decision tracker)
  const [customerPreference, setCustomerPreference] = useState<string | null>(null);
  useEffect(() => {
    if (invoice) {
      getCustomerPaymentPreference(invoice.id).then(setCustomerPreference);
    }
  }, [invoice?.id]);

  if (!invoice) {
    return (
      <Screen>
        <View style={styles.container}>
          <Text style={Typography.title}>{t('invoices.notFound', 'Invoice not found')}</Text>
        </View>
      </Screen>
    );
  }

  const formattedTotal = `€${invoice.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const lastExport = lastMoneybirdExport[invoice.id];
  const lastPayment = lastMolliePayment[invoice.id];

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
      t('invoices.paidDesc', { defaultValue: '{{amount}} from {{customer}} marked as paid. Great work!', amount: formattedTotal, customer: invoice.customer }),
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

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={22} color={SemanticColors.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={Typography.title}>{t('invoices.invoice', 'Invoice')} {invoice.id}</Text>
          <Text style={Typography.muted}>
            {invoice.status} · {invoice.dueInDays >= 0 ? t('invoices.dueIn', { defaultValue: 'Due in {{count}} days', count: invoice.dueInDays }) : t('invoices.overdueDays', { defaultValue: '{{count}} days overdue', count: Math.abs(invoice.dueInDays) })}
          </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={Typography.subtitle}>{t('jobs.client', 'Customer')}</Text>
          <Text style={Typography.body}>{invoice.customer}</Text>
          <Text style={Typography.muted}>{invoice.job}</Text>
        </View>

        <AssistBanner
          title={t('invoices.recommendedNext', 'Recommended next step')}
          description={t('invoices.sendReminderHint', 'Send a reminder now to reduce late payment risk.')}
          actionLabel={t('invoices.sendReminder', 'Send reminder')}
          meta={formattedTotal}
        />

        <View style={styles.card}>
          <Text style={Typography.subtitle}>{t('quotes.total', 'Total')}</Text>
          <Text style={Typography.title}>{formattedTotal}</Text>
          <Text style={Typography.muted}>{t('invoices.timingOptimal', 'Invoice timing is optimal for this job.')}</Text>
          {lastExport ? (
            <Text style={styles.exportedText}>{t('invoices.exportedMoneybird', 'Exported to Moneybird just now')}</Text>
          ) : null}
          {lastPayment ? (
            <Text style={styles.paymentText}>{t('invoices.mollieCreated', 'Mollie payment link created')}</Text>
          ) : null}
        </View>

        {/* Payment Methods */}
        <View style={styles.card}>
          <View style={styles.paymentHeader}>
            <Ionicons name="shield-checkmark" size={18} color={SemanticColors.feedbackSuccess} />
            <Text style={[Typography.subtitle, { flex: 1 }]}>{t('invoices.offeredPaymentMethods', 'Offered payment methods')}</Text>
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
                  accessibilityLabel={`${pm.name}${isPreferred ? ', customer preferred' : ''}`}
                >
                  <View style={[styles.paymentMethodIconWrap, { backgroundColor: brandColor + '12' }]}>
                    <View style={[styles.paymentMethodDot, { backgroundColor: brandColor }]} />
                  </View>
                  <Text
                    style={[
                      styles.paymentMethodName,
                      isPreferred && { fontFamily: 'Inter_600SemiBold', color: SemanticColors.textPrimary },
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
          <View style={styles.paymentSecurityNote}>
            <Ionicons name="lock-closed" size={12} color={SemanticColors.textTertiary} />
            <Text style={styles.paymentSecurityNoteText}>
              Secure via {country === 'UK' ? 'Stripe' : 'Mollie'} · PCI DSS compliant
            </Text>
          </View>
        </View>

        {/* Payment & Activity Timeline */}
        <View style={styles.card}>
          <View style={styles.timelineHeader}>
            <Ionicons name="time-outline" size={18} color={Palette.hermesOrange} />
            <Text style={[Typography.subtitle, { flex: 1 }]}>{t('invoices.activityTimeline', 'Activity')}</Text>
          </View>
          <View style={styles.timelineList}>
            {/* Created */}
            <View style={styles.timelineRow}>
              <View style={styles.timelineLeft}>
                <View style={[styles.timelineDot, { backgroundColor: SemanticColors.textTertiary }]}>
                  <Ionicons name="add-circle-outline" size={10} color="#fff" />
                </View>
                <View style={styles.timelineLine} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineLabel}>{t('invoices.created', 'Invoice created')}</Text>
                <Text style={styles.timelineDate}>
                  {invoice.lastUpdated
                    ? new Date(invoice.lastUpdated).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
                    : t('invoices.recently', 'Recently')}
                </Text>
              </View>
            </View>
            {/* Sent */}
            {(invoice.status === 'sent' || invoice.status === 'overdue' || invoice.status === 'paid') && (
              <View style={styles.timelineRow}>
                <View style={styles.timelineLeft}>
                  <View style={[styles.timelineDot, { backgroundColor: SemanticColors.feedbackInfo }]}>
                    <Ionicons name="send" size={10} color="#fff" />
                  </View>
                  <View style={styles.timelineLine} />
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineLabel}>{t('invoices.sentToCustomer', 'Sent to customer')}</Text>
                  <Text style={styles.timelineDate}>
                    {invoice.dueDate
                      ? new Date(new Date(invoice.dueDate).getTime() - 14 * 86400000).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
                      : ''}
                  </Text>
                </View>
              </View>
            )}
            {/* Overdue reminder */}
            {invoice.status === 'overdue' && (
              <View style={styles.timelineRow}>
                <View style={styles.timelineLeft}>
                  <View style={[styles.timelineDot, { backgroundColor: SemanticColors.feedbackError }]}>
                    <Ionicons name="alert-circle" size={10} color="#fff" />
                  </View>
                  <View style={styles.timelineLine} />
                </View>
                <View style={styles.timelineContent}>
                  <Text style={[styles.timelineLabel, { color: SemanticColors.feedbackError }]}>
                    {t('invoices.overdueNotice', 'Payment overdue')}
                  </Text>
                  <Text style={styles.timelineDate}>
                    {invoice.dueDate
                      ? new Date(invoice.dueDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
                      : ''} · {Math.abs(invoice.dueInDays)} {t('invoices.daysLate', 'days late')}
                  </Text>
                </View>
              </View>
            )}
            {/* Paid */}
            {invoice.status === 'paid' && (
              <View style={styles.timelineRow}>
                <View style={styles.timelineLeft}>
                  <View style={[styles.timelineDot, { backgroundColor: SemanticColors.feedbackSuccess }]}>
                    <Ionicons name="checkmark" size={10} color="#fff" />
                  </View>
                </View>
                <View style={styles.timelineContent}>
                  <Text style={[styles.timelineLabel, { color: SemanticColors.feedbackSuccess }]}>
                    {t('invoices.paymentReceived', 'Payment received')}
                  </Text>
                  <Text style={styles.timelineDate}>
                    {`€${invoice.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                  </Text>
                </View>
              </View>
            )}
            {/* Due date (for unpaid) */}
            {invoice.status !== 'paid' && (
              <View style={styles.timelineRow}>
                <View style={styles.timelineLeft}>
                  <View style={[styles.timelineDot, { backgroundColor: invoice.dueInDays < 0 ? SemanticColors.feedbackError : SemanticColors.textTertiary }]}>
                    <Ionicons name="calendar-outline" size={10} color="#fff" />
                  </View>
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineLabel}>
                    {invoice.dueInDays >= 0
                      ? t('invoices.dueIn', { defaultValue: 'Due in {{count}} days', count: invoice.dueInDays })
                      : t('invoices.overdueDays', { defaultValue: '{{count}} days overdue', count: Math.abs(invoice.dueInDays) })}
                  </Text>
                  <Text style={styles.timelineDate}>
                    {invoice.dueDate
                      ? new Date(invoice.dueDate).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
                      : ''}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        <View style={styles.actions}>
          <PrimaryButton label={t('invoices.viewSharePdf', 'PDF bekijken & delen')} onPress={async () => {
            hapticSuccess();
            const autoInv = invoiceAutomationService.getInvoice(invoice.id);
            if (autoInv) {
              await generateInvoicePdf(autoInv, businessProfile);
            }
          }} />
          <PrimaryButton
            label={mollieConnected ? t('invoices.createIdealLink', 'Create iDEAL link') : t('invoices.connectMollie', 'Connect Mollie')}
            onPress={() =>
              mollieConnected
                ? handleCreatePayment()
                : router.push('/(modals)/mollie')
            }
          />
          <PrimaryButton
            label={t('invoices.exportMoneybird', 'Export to Moneybird')}
            onPress={() =>
              moneybirdConnected ? handleExportMoneybird() : router.push('/(modals)/moneybird')
            }
          />
          <PrimaryButton label={t('invoices.sendReminder', 'Send reminder')} onPress={handleMarkSent} />
          <PrimaryButton label={t('invoices.markPaid', 'Mark paid')} onPress={handleMarkPaid} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  actions: {
    gap: Spacing.sm,
  },
  exportedText: {
    color: SemanticColors.feedbackSuccess,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  paymentText: {
    color: SemanticColors.textTertiary,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  paymentHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  paymentMethodList: {
    gap: 6,
    marginTop: Spacing.xs,
  },
  paymentMethodRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: Spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
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
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  paymentMethodDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  paymentMethodName: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: SemanticColors.textPrimary,
  },
  preferredBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  preferredBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
  },
  preferenceNote: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  preferenceNoteText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Palette.hermesOrange,
  },
  paymentSecurityNote: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  paymentSecurityNoteText: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: SemanticColors.textTertiary,
  },
  // Timeline
  timelineHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: Spacing.sm,
  },
  timelineList: {
    gap: 0,
  },
  timelineRow: {
    flexDirection: 'row' as const,
    gap: Spacing.sm,
    minHeight: 40,
  },
  timelineLeft: {
    alignItems: 'center' as const,
    width: 24,
  },
  timelineDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: SemanticColors.borderDefault,
    marginVertical: 2,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: Spacing.sm,
  },
  timelineLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: SemanticColors.textPrimary,
  },
  timelineDate: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
});

import { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
          <Text style={Typography.title}>Invoice not found</Text>
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
  };

  const handleMarkSent = () => {
    markInvoiceSent(invoice.id);
    hapticSuccess();
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={Typography.title}>Invoice {invoice.id}</Text>
          <Text style={Typography.muted}>
            {invoice.status} · {invoice.dueInDays >= 0 ? `Due in ${invoice.dueInDays} days` : `${Math.abs(invoice.dueInDays)} days overdue`}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={Typography.subtitle}>Customer</Text>
          <Text style={Typography.body}>{invoice.customer}</Text>
          <Text style={Typography.muted}>{invoice.job}</Text>
        </View>

        <AssistBanner
          title="Recommended next step"
          description="Send a reminder now to reduce late payment risk."
          actionLabel="Send reminder"
          meta={formattedTotal}
        />

        <View style={styles.card}>
          <Text style={Typography.subtitle}>Total</Text>
          <Text style={Typography.title}>{formattedTotal}</Text>
          <Text style={Typography.muted}>Invoice timing is optimal for this job.</Text>
          {lastExport ? (
            <Text style={styles.exportedText}>Exported to Moneybird just now</Text>
          ) : null}
          {lastPayment ? (
            <Text style={styles.paymentText}>Mollie payment link created</Text>
          ) : null}
        </View>

        {/* Payment Methods */}
        <View style={styles.card}>
          <View style={styles.paymentHeader}>
            <Ionicons name="shield-checkmark" size={18} color={SemanticColors.feedbackSuccess} />
            <Text style={[Typography.subtitle, { flex: 1 }]}>Offered payment methods</Text>
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
                      <Text style={[styles.preferredBadgeText, { color: brandColor }]}>Preferred</Text>
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
                Customer prefers: {getPaymentMethodLabel(customerPreference)}
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

        <View style={styles.actions}>
          <PrimaryButton label="PDF bekijken & delen" onPress={async () => {
            hapticSuccess();
            const autoInv = invoiceAutomationService.getInvoice(invoice.id);
            if (autoInv) {
              await generateInvoicePdf(autoInv, businessProfile);
            }
          }} />
          <PrimaryButton
            label={mollieConnected ? 'Create iDEAL link' : 'Connect Mollie'}
            onPress={() =>
              mollieConnected
                ? handleCreatePayment()
                : router.push('/(modals)/mollie')
            }
          />
          <PrimaryButton
            label="Export to Moneybird"
            onPress={() =>
              moneybirdConnected ? handleExportMoneybird() : router.push('/(modals)/moneybird')
            }
          />
          <PrimaryButton label="Send reminder" onPress={handleMarkSent} />
          <PrimaryButton label="Mark paid" onPress={handleMarkPaid} />
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
    gap: Spacing.xs,
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
});

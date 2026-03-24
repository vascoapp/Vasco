import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AssistBanner } from '../../src/components/AssistBanner';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { Screen } from '../../src/components/Screen';
import { SemanticColors } from '../../src/theme/colors';
import { Radius } from '../../src/theme/radius';
import { Spacing } from '../../src/theme/spacing';
import { Typography } from '../../src/theme/typography';
import { useAppState } from '../../src/state/AppState';
import { hapticError, hapticSuccess } from '../../src/utils/haptics';
import { generateInvoicePdf } from '../../src/services/invoicePdfService';
import { invoiceAutomationService } from '../../src/services/invoiceAutomationService';

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
  const invoice = invoices.find((item) => item.id === id);

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
});

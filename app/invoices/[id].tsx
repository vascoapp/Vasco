import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AssistBanner } from '../../src/components/AssistBanner';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { Screen } from '../../src/components/Screen';
import { Colors } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';
import { Typography } from '../../src/theme/typography';
import { useAppState } from '../../src/state/AppState';

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

  const formattedTotal = `€${invoice.amount.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}`;
  const lastExport = lastMoneybirdExport[invoice.id];
  const lastPayment = lastMolliePayment[invoice.id];

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
          <PrimaryButton label="Generate PDF" onPress={() => router.push('/(modals)/pdf?source=invoice')} />
          <PrimaryButton
            label={mollieConnected ? 'Create iDEAL link' : 'Connect Mollie'}
            onPress={() =>
              mollieConnected
                ? createPaymentLink(invoice.id, invoice.amount)
                : router.push('/(modals)/mollie')
            }
          />
          <PrimaryButton
            label="Export to Moneybird"
            onPress={() =>
              moneybirdConnected ? exportInvoice(invoice.id) : router.push('/(modals)/moneybird')
            }
          />
          <PrimaryButton label="Send reminder" onPress={() => markInvoiceSent(invoice.id)} />
          <PrimaryButton label="Mark paid" onPress={() => markInvoicePaid(invoice.id)} />
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
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actions: {
    gap: Spacing.sm,
  },
  exportedText: {
    color: Colors.success,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  paymentText: {
    color: Colors.accent,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
});

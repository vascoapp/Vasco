import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useCallback } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { Screen } from '../../../src/components/Screen';
import { InlineInsight } from '../../../src/components/shared/VascoInsightCard';
import { useInlineInsight } from '../../../src/services/vascoGuidanceService';
import { SemanticColors } from '../../../src/theme/colors';
import { Radius } from '../../../src/theme/radius';
import { Spacing } from '../../../src/theme/spacing';
import { Typography } from '../../../src/theme/typography';
import { useAppState } from '../../../src/state/AppState';

export default function InvoiceFromQuoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { quotes, lineItems, addInvoice, markInvoiceSent } = useAppState();
  const [creating, setCreating] = useState(false);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);

  const quote = quotes.find((q) => q.id === id);
  const quoteItems = id ? lineItems[id] ?? [] : [];

  // AI guidance — context switches based on customer data
  const inlineInsight = useInlineInsight('contractor', 'invoice-create', 'total');

  const handleCreateInvoice = useCallback(async () => {
    if (!id) return;
    // Tier gate — block monthly-cap users before we mint an invoice number.
    try {
      const { loadSubscription, canCreateInvoice } = await import('../../../src/services/subscriptionService');
      const sub = await loadSubscription();
      const gate = canCreateInvoice(sub);
      if (!gate.allowed) {
        Alert.alert(
          'Upgrade required',
          gate.reason,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'View plans', onPress: () => router.push('/contractor/profile' as any) },
          ],
        );
        return;
      }
    } catch {}
    setCreating(true);
    try {
      const newId = await addInvoice(id);
      setInvoiceId(newId);
    } catch (err) {
      console.warn('[InvoiceFromQuote] Create failed:', err);
      Alert.alert('Error', 'Could not create invoice. Please try again.');
    } finally {
      setCreating(false);
    }
  }, [id, addInvoice, router]);

  const handleMarkSent = useCallback(() => {
    if (invoiceId) {
      markInvoiceSent(invoiceId);
      router.replace(`/invoices/${invoiceId}`);
    }
  }, [invoiceId, markInvoiceSent, router]);

  if (!quote) {
    return (
      <Screen>
        <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={Typography.muted}>Quote {id} not found</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={Typography.title}>Invoice from {quote.id}</Text>
          <Text style={Typography.muted}>Auto-numbered · Due in 14 days</Text>
        </View>

        {inlineInsight && (
          <InlineInsight
            icon={inlineInsight.icon as any}
            message={inlineInsight.message}
            actionLabel={inlineInsight.actionLabel}
            actionRoute={inlineInsight.actionRoute}
          />
        )}

        {/* Quote summary */}
        <View style={styles.card}>
          <Text style={Typography.subtitle}>Quote details</Text>
          <View style={styles.row}>
            <Text style={Typography.muted}>Customer</Text>
            <Text style={Typography.body}>{quote.customer}</Text>
          </View>
          <View style={styles.row}>
            <Text style={Typography.muted}>Job</Text>
            <Text style={Typography.body}>{quote.job}</Text>
          </View>
          <View style={styles.row}>
            <Text style={Typography.muted}>Amount</Text>
            <Text style={[Typography.body, { fontWeight: '700' }]}>
              €{quote.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        {/* Line items */}
        {quoteItems.length > 0 && (
          <View style={styles.card}>
            <Text style={Typography.subtitle}>Line items</Text>
            {quoteItems.map((item) => (
              <View key={item.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={Typography.body}>{item.description}</Text>
                  <Text style={Typography.muted}>
                    {item.quantity} × €{item.unitPrice.toFixed(2)}
                  </Text>
                </View>
                <Text style={Typography.body}>
                  €{(item.quantity * item.unitPrice).toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Invoice preview (after creation) */}
        {invoiceId && (
          <View style={[styles.card, { borderColor: SemanticColors.actionPrimary }]}>
            <Text style={[Typography.subtitle, { color: SemanticColors.actionPrimary }]}>Invoice created</Text>
            <View style={styles.row}>
              <Text style={Typography.body}>Invoice #{invoiceId}</Text>
              <Text style={Typography.body}>
                €{quote.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>
            </View>
            <Text style={Typography.muted}>
              Matches quote language to reduce payment disputes.
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {!invoiceId ? (
            <PrimaryButton
              label={creating ? 'Creating...' : 'Create invoice'}
              onPress={handleCreateInvoice}
            />
          ) : (
            <>
              <PrimaryButton
                label="Generate PDF"
                onPress={() => router.push('/(modals)/pdf?source=invoice')}
              />
              <PrimaryButton label="Mark sent" onPress={handleMarkSent} />
            </>
          )}
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
    paddingVertical: Spacing.xs,
  },
  actions: {
    gap: Spacing.sm,
  },
});

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useCallback } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { Screen } from '../../../src/components/Screen';
import { InlineInsight } from '../../../src/components/shared/VascoInsightCard';
import { useInlineInsight } from '../../../src/services/vascoGuidanceService';
import { SemanticColors } from '../../../src/theme/colors';
import { Radius } from '../../../src/theme/radius';
import { Spacing } from '../../../src/theme/spacing';
import { Typography } from '../../../src/theme/typography';
import { useAppState } from '../../../src/state/AppState';
import { useAuth } from '../../../src/context/AuthContext';
import { formatCurrency, type Country } from '../../../src/i18n/formatting';
import { logError } from '../../../src/utils/errorHandler';
import { DKScreenHeader } from '../../../src/components/shared/DKScreenHeader';
import { findDocumentCustomer } from '../../../src/domain/customers';

export default function InvoiceFromQuoteScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { quotes, lineItems, addInvoice, markInvoiceSent, invoices, customers } = useAppState();
  const { user } = useAuth();
  const country = (user?.country ?? 'NL') as Country;
  const [creating, setCreating] = useState(false);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);

  const quote = quotes.find((q) => q.id === id);
  // `quote.customer` is the display name for every row created after
  // R2026-08-22, and a raw customer id for the ones created between R13.2 and
  // it — this screen rendered whichever it got, so it read "c-1787349342347"
  // where the customer's name belongs. Resolve both shapes.
  const quoteCustomerName =
    findDocumentCustomer(customers as { id: string; name: string }[], quote)?.name
    ?? quote?.customer
    ?? '';
  const quoteItems = id ? lineItems[id] ?? [] : [];

  // AI guidance — context switches based on customer data
  const inlineInsight = useInlineInsight('contractor', 'invoice-create', 'total');

  const handleCreateInvoice = useCallback(async () => {
    if (!id) return;
    // Tier gate — block monthly-cap users before we mint an invoice number.
    // R52: count invoices created this calendar month from real AppState.
    try {
      const { loadSubscription, canCreateInvoice } = await import('../../../src/services/subscriptionService');
      const sub = await loadSubscription();
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const invoicesThisMonth = invoices.filter((inv: any) => {
        const created = inv.createdAt ? new Date(inv.createdAt) : null;
        return created && created >= monthStart;
      }).length;
      const gate = canCreateInvoice(sub, invoicesThisMonth);
      if (!gate.allowed) {
        Alert.alert(
          t('billing.upgradeRequired'),
          gate.reason,
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('billing.viewPlans'), onPress: () => router.push('/contractor/profile' as any) },
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
      logError('InvoiceFromQuote', err);
      Alert.alert(t('common.error'), t('quoteToInvoice.createFailed'));
    } finally {
      setCreating(false);
    }
  }, [id, addInvoice, router, t]);

  const handleMarkSent = useCallback(() => {
    if (invoiceId) {
      markInvoiceSent(invoiceId);
      router.replace(`/invoices/${invoiceId}`);
    }
  }, [invoiceId, markInvoiceSent, router]);

  if (!quote) {
    return (
      <Screen>
        {/* The dead end needed the back control most: a quote that cannot be
            found left the contractor on a one-line screen with no way out. */}
        <DKScreenHeader title={t('quotes.invoice', 'Invoice')} />
        <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={Typography.muted}>{t('quoteToInvoice.notFound', { id })}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      {/* Reached from the quote screen's "Invoice" action. The title sat inside
          the scroll view and there was no back control, so the only way out of
          a half-filled invoice was the OS gesture. */}
      <DKScreenHeader
        title={t('quoteToInvoice.header', { ref: quote.id })}
        subtitle={t('quoteToInvoice.autoNumberDue')}
      />
      <ScrollView contentContainerStyle={styles.container}>

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
          <Text style={Typography.subtitle}>{t('quoteToInvoice.quoteDetails')}</Text>
          <View style={styles.row}>
            <Text style={Typography.muted}>{t('quoteToInvoice.customer')}</Text>
            <Text style={Typography.body}>{quoteCustomerName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={Typography.muted}>{t('quoteToInvoice.job')}</Text>
            <Text style={Typography.body}>{quote.job}</Text>
          </View>
          <View style={styles.row}>
            <Text style={Typography.muted}>{t('quoteToInvoice.amount')}</Text>
            <Text style={[Typography.body, { fontWeight: '700' }]}>
              {formatCurrency(quote.amount, country)}
            </Text>
          </View>
        </View>

        {/* Line items */}
        {quoteItems.length > 0 && (
          <View style={styles.card}>
            <Text style={Typography.subtitle}>{t('quoteToInvoice.lineItems')}</Text>
            {quoteItems.map((item) => (
              <View key={item.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={Typography.body}>{item.description}</Text>
                  <Text style={Typography.muted}>
                    {item.quantity} × {formatCurrency(item.unitPrice, country)}
                  </Text>
                </View>
                <Text style={Typography.body}>
                  {formatCurrency(item.quantity * item.unitPrice, country)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Invoice preview (after creation) */}
        {invoiceId && (
          <View style={[styles.card, { borderColor: SemanticColors.actionPrimary }]}>
            <Text style={[Typography.subtitle, { color: SemanticColors.actionPrimary }]}>{t('quoteToInvoice.invoiceCreated')}</Text>
            <View style={styles.row}>
              <Text style={Typography.body}>{t('quoteToInvoice.invoiceRef', { id: invoiceId })}</Text>
              <Text style={Typography.body}>
                {formatCurrency(quote.amount, country)}
              </Text>
            </View>
            <Text style={Typography.muted}>
              {t('quoteToInvoice.matchesQuote')}
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {!invoiceId ? (
            <PrimaryButton
              label={creating ? t('quoteToInvoice.creating') : t('quoteToInvoice.createInvoice')}
              onPress={handleCreateInvoice}
            />
          ) : (
            <>
              <PrimaryButton
                label={t('quoteToInvoice.generatePdf')}
                onPress={() => router.push('/(modals)/pdf?source=invoice')}
              />
              <PrimaryButton label={t('quoteToInvoice.markSent')} onPress={handleMarkSent} />
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

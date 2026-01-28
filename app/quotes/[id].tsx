import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AssistBanner } from '../../src/components/AssistBanner';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { Screen } from '../../src/components/Screen';
import { Colors } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';
import { Typography } from '../../src/theme/typography';
import { useAppState } from '../../src/state/AppState';

export default function QuoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { quotes, markQuoteSent, priceRisks, lineItems, applySuggestedPrice } = useAppState();
  const quote = quotes.find((item) => item.id === id);
  const quoteLineItems = lineItems[quote?.id ?? ''] ?? [];
  const priceRisk = priceRisks.find((risk) => risk.quoteId === quote?.id);
  const [applied, setApplied] = useState(false);

  if (!quote) {
    return (
      <Screen>
        <View style={styles.container}>
          <Text style={Typography.title}>Quote not found</Text>
        </View>
      </Screen>
    );
  }

  const formattedTotal = `€${quote.amount.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}`;
  const formatCurrency = (value: number) =>
    `€${value.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}`;

  const riskItem = priceRisk
    ? quoteLineItems.find((item) => item.description === priceRisk.lineItem)
    : undefined;
  const currentUnitPrice = riskItem?.unitPrice ?? 0;
  const suggestedUnitPrice = priceRisk?.suggestedUnitPrice ?? 0;
  const canApplySuggestion =
    Boolean(priceRisk?.lineItem) && suggestedUnitPrice > 0 && currentUnitPrice > suggestedUnitPrice;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={Typography.title}>Quote {quote.id}</Text>
          <Text style={Typography.muted}>{quote.status} · {quote.job}</Text>
        </View>

        <View style={styles.card}>
          <Text style={Typography.subtitle}>Customer</Text>
          <Text style={Typography.body}>{quote.customer}</Text>
          <Text style={Typography.muted}>{quote.job}</Text>
        </View>

        <AssistBanner
          title="Recommended next step"
          description="Send the quote now to avoid drop‑off and shorten payment cycles."
          actionLabel="Share quote"
          meta="Saves time"
          onPress={() => markQuoteSent(quote.id)}
        />

        {priceRisk ? (
          <View style={styles.card}>
            <Text style={Typography.subtitle}>Suggested adjustment</Text>
            <Text style={Typography.muted}>{priceRisk.reason}</Text>
            {priceRisk.lineItem ? (
              <Text style={Typography.body}>
                {priceRisk.lineItem} · {formatCurrency(currentUnitPrice)} →{' '}
                {formatCurrency(suggestedUnitPrice)} each
              </Text>
            ) : null}
            <Text style={Typography.muted}>
              Estimated savings: {formatCurrency(priceRisk.estimatedSavings)}
            </Text>
            {canApplySuggestion ? (
              <PrimaryButton
                label="Apply suggested price"
                onPress={() => {
                  applySuggestedPrice(
                    quote.id,
                    priceRisk.lineItem ?? '',
                    priceRisk.suggestedUnitPrice ?? 0
                  );
                  setApplied(true);
                }}
              />
            ) : null}
            {applied ? (
              <Text style={styles.appliedText}>Applied. Quote total updated.</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={Typography.subtitle}>Line items</Text>
          {quoteLineItems.map((item) => (
            <View key={item.id} style={styles.row}>
              <Text style={Typography.body}>{item.description}</Text>
              <Text style={Typography.body}>
                {formatCurrency(item.unitPrice * item.quantity)}
              </Text>
            </View>
          ))}
          <View style={styles.row}>
            <Text style={Typography.subtitle}>Total</Text>
            <Text style={Typography.subtitle}>{formattedTotal}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <PrimaryButton label="Share quote" onPress={() => markQuoteSent(quote.id)} />
          <Link href={`/quotes/${id}/invoice`} asChild>
            <Pressable style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>Create invoice</Text>
            </Pressable>
          </Link>
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingVertical: Spacing.xs,
  },
  actions: {
    gap: Spacing.sm,
  },
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  secondaryText: {
    color: Colors.text,
    fontWeight: '600',
  },
  appliedText: {
    color: Colors.success,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
});

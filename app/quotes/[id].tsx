import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AssistBanner } from '../../src/components/AssistBanner';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { Screen } from '../../src/components/Screen';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Radius } from '../../src/theme/radius';
import { Spacing } from '../../src/theme/spacing';
import { Typography } from '../../src/theme/typography';
import { useAppState } from '../../src/state/AppState';
import { Ionicons } from '@expo/vector-icons';
import { generateQuotePdf, type QuotePdfData } from '../../src/services/quotePdfService';

export default function QuoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { quotes, markQuoteSent, priceRisks, lineItems, applySuggestedPrice, convertQuoteToJob, businessProfile, updateQuote } = useAppState();
  const quote = quotes.find((item) => item.id === id);
  const quoteLineItems = lineItems[quote?.id ?? ''] ?? [];
  const priceRisk = priceRisks.find((risk) => risk.quoteId === quote?.id);
  const [applied, setApplied] = useState(false);
  const [editing, setEditing] = useState(false);

  if (!quote) {
    return (
      <Screen>
        <View style={styles.container}>
          <Text style={Typography.title}>Offerte niet gevonden</Text>
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
          <View style={{ flex: 1 }}>
            <Text style={Typography.title}>Offerte {quote.id}</Text>
            <Text style={Typography.muted}>{quote.status} · {quote.job}</Text>
          </View>
          {quote.status === 'draft' && (
            <Pressable onPress={() => setEditing(!editing)} hitSlop={8}>
              <Ionicons name={editing ? 'checkmark-circle' : 'create-outline'} size={24} color={editing ? SemanticColors.feedbackSuccess : SemanticColors.textSecondary} />
            </Pressable>
          )}
        </View>

        <View style={styles.card}>
          <Text style={Typography.subtitle}>Klant</Text>
          <Text style={Typography.body}>{quote.customer}</Text>
          <Text style={Typography.muted}>{quote.job}</Text>
        </View>

        <AssistBanner
          title="Aanbevolen volgende stap"
          description="Verstuur de offerte nu om uitval te voorkomen en betalingscycli te verkorten."
          actionLabel="Offerte delen"
          meta="Bespaart tijd"
          onPress={() => {
            markQuoteSent(quote.id);
            Alert.alert('Offerte verstuurd!', 'Vasco herinnert je over 3 dagen om op te volgen.');
          }}
        />

        {priceRisk ? (
          <View style={styles.card}>
            <Text style={Typography.subtitle}>Voorgestelde aanpassing</Text>
            <Text style={Typography.muted}>{priceRisk.reason}</Text>
            {priceRisk.lineItem ? (
              <Text style={Typography.body}>
                {priceRisk.lineItem} · {formatCurrency(currentUnitPrice)} →{' '}
                {formatCurrency(suggestedUnitPrice)} each
              </Text>
            ) : null}
            <Text style={Typography.muted}>
              Geschatte besparing: {formatCurrency(priceRisk.estimatedSavings)}
            </Text>
            {canApplySuggestion ? (
              <PrimaryButton
                label="Voorgestelde prijs toepassen"
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
              <Text style={styles.appliedText}>Toegepast. Offerte totaal bijgewerkt.</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={Typography.subtitle}>Regels</Text>
          {quoteLineItems.map((item) => (
            <View key={item.id} style={styles.row}>
              <Text style={Typography.body}>{item.description}</Text>
              <Text style={Typography.body}>
                {formatCurrency(item.unitPrice * item.quantity)}
              </Text>
            </View>
          ))}
          <View style={styles.row}>
            <Text style={Typography.subtitle}>Totaal</Text>
            <Text style={Typography.subtitle}>{formattedTotal}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <PrimaryButton label="Offerte als PDF delen" onPress={async () => {
            const items = lineItems[quote.id] ?? [];
            const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
            const vatAmount = Math.round(subtotal * 0.21 * 100) / 100;
            const pdfData: QuotePdfData = {
              quoteNumber: quote.id,
              customerName: quote.customer ?? 'Klant',
              jobTitle: quote.job ?? 'Klus',
              issueDate: new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }),
              validUntil: new Date(Date.now() + 30 * 86400000).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }),
              lineItems: items.map(i => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, vatRate: 21 })),
              subtotal,
              vatAmount,
              total: subtotal + vatAmount,
            };
            await generateQuotePdf(pdfData, businessProfile.businessName, businessProfile.address, businessProfile.kvkNumber, businessProfile.vatNumber);
            markQuoteSent(quote.id);
          }} />

          {/* Accept & Convert to Job */}
          <Pressable
            style={styles.acceptButton}
            onPress={() => {
              Alert.alert(
                'Offerte accepteren',
                `Offerte accepteren en klus aanmaken voor ${formattedTotal}?`,
                [
                  { text: 'Annuleren', style: 'cancel' },
                  {
                    text: 'Accepteren',
                    onPress: async () => {
                      const jobId = await convertQuoteToJob(quote.id);
                      Alert.alert('Klus aangemaakt', 'De offerte is geaccepteerd en een klus is aangemaakt.');
                    },
                  },
                ],
              );
            }}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.acceptButtonText}>Accepteer & maak klus</Text>
          </Pressable>

          <Link href={`/quotes/${id}/invoice`} asChild>
            <Pressable style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>Factuur aanmaken</Text>
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
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
    paddingVertical: Spacing.xs,
  },
  actions: {
    gap: Spacing.sm,
  },
  acceptButton: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    backgroundColor: SemanticColors.feedbackSuccess,
    minHeight: 44,
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  acceptButtonText: {
    color: '#fff',
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 16,
  },
  secondaryButton: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    backgroundColor: SemanticColors.surfaceSecondary,
    minHeight: 44,
    justifyContent: 'center',
  },
  secondaryText: {
    color: SemanticColors.textPrimary,
    fontFamily: 'Manrope_600SemiBold',
  },
  appliedText: {
    color: SemanticColors.feedbackSuccess,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
});

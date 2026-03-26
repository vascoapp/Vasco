import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
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
import { shareQuoteWithAcceptanceLink } from '../../src/services/customerQuoteAcceptanceService';
import { isDemoMode } from '../../src/context/AuthContext';
import { MS_PER_DAY } from '../../src/utils/timeConstants';
import { getVATRate } from '../../src/constants/taxRates';

export default function QuoteDetailScreen() {
  const { t } = useTranslation();
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
          <Text style={Typography.title}>{t('quotes.notFound', 'Quote not found')}</Text>
        </View>
      </Screen>
    );
  }

  const formattedTotal = `€${quote.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const formatCurrency = (value: number) =>
    `€${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

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
            <Text style={Typography.title}>{t('quotes.quote', 'Quote')} {quote.id}</Text>
            <Text style={Typography.muted}>{quote.status} · {quote.job}</Text>
          </View>
          {(quote.status === 'draft' || quote.status === 'sent') && (
            <Pressable accessibilityRole="button" accessibilityLabel={editing ? t('common.done', 'Done editing') : t('common.edit', 'Edit quote')} onPress={() => {
              if (quote.status === 'sent' && !editing) {
                Alert.alert(
                  t('quotes.editSentQuote', 'Edit sent quote?'),
                  t('quotes.editSentQuoteDesc', 'Editing will mark this quote as draft. You will need to re-send it.'),
                  [
                    { text: t('common.cancel', 'Cancel'), style: 'cancel' },
                    { text: t('common.edit', 'Edit'), onPress: () => { updateQuote(quote.id, { status: 'draft' }); setEditing(true); } },
                  ],
                );
              } else {
                setEditing(!editing);
              }
            }} hitSlop={8}>
              <Ionicons name={editing ? 'checkmark-circle' : 'create-outline'} size={24} color={editing ? SemanticColors.feedbackSuccess : SemanticColors.textSecondary} />
            </Pressable>
          )}
        </View>

        <View style={styles.card}>
          <Text style={Typography.subtitle}>{t('jobs.client', 'Client')}</Text>
          <Text style={Typography.body}>{quote.customer}</Text>
          <Text style={Typography.muted}>{quote.job}</Text>
        </View>

        <AssistBanner
          title={t('quotes.recommendedNextStep', 'Recommended next step')}
          description={t('quotes.sendQuoteNow', 'Send the quote now to prevent drop-off and shorten payment cycles.')}
          actionLabel={t('quotes.shareQuote', 'Share quote')}
          meta={t('quotes.savesTime', 'Saves time')}
          onPress={() => {
            markQuoteSent(quote.id);
            Alert.alert(t('quotes.quoteSent', 'Quote sent!'), t('quotes.quoteSentDesc', 'Vasco will remind you in 3 days to follow up.'));
          }}
        />

        {priceRisk ? (
          <View style={styles.card}>
            <Text style={Typography.subtitle}>{t('quotes.suggestedAdjustment', 'Suggested adjustment')}</Text>
            <Text style={Typography.muted}>{priceRisk.reason}</Text>
            {priceRisk.lineItem ? (
              <Text style={Typography.body}>
                {priceRisk.lineItem} · {formatCurrency(currentUnitPrice)} →{' '}
                {formatCurrency(suggestedUnitPrice)} each
              </Text>
            ) : null}
            <Text style={Typography.muted}>
              {t('quotes.estimatedSavings', 'Estimated savings')}: {formatCurrency(priceRisk.estimatedSavings)}
            </Text>
            {canApplySuggestion ? (
              <PrimaryButton
                label={t('quotes.applySuggestedPrice', 'Apply suggested price')}
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
              <Text style={styles.appliedText}>{t('quotes.applied', 'Applied. Quote total updated.')}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={Typography.subtitle}>{t('quotes.lineItems', 'Line items')}</Text>
          {quoteLineItems.map((item) => (
            <View key={item.id} style={styles.row}>
              <Text style={Typography.body}>{item.description}</Text>
              <Text style={Typography.body}>
                {formatCurrency(item.unitPrice * item.quantity)}
              </Text>
            </View>
          ))}
          <View style={styles.row}>
            <Text style={Typography.subtitle}>{t('quotes.total', 'Total')}</Text>
            <Text style={Typography.subtitle}>{formattedTotal}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <PrimaryButton label={t('quotes.sharePdf', 'Share quote as PDF')} onPress={async () => {
            const items = lineItems[quote.id] ?? [];
            const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
            const vatRate = getVATRate(businessProfile.country ?? 'NL');
            const vatPct = Math.round(vatRate * 100);
            const vatAmount = Math.round(subtotal * vatRate * 100) / 100;
            const pdfData: QuotePdfData = {
              quoteNumber: quote.id,
              customerName: quote.customer ?? t('jobs.client', 'Client'),
              jobTitle: quote.job ?? t('jobs.typeJob', 'Job'),
              issueDate: new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }),
              validUntil: new Date(Date.now() + 30 * MS_PER_DAY).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }),
              lineItems: items.map(i => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, vatRate: vatPct })),
              subtotal,
              vatAmount,
              total: subtotal + vatAmount,
            };
            await generateQuotePdf(pdfData, businessProfile.businessName, businessProfile.address, businessProfile.kvkNumber, businessProfile.vatNumber);
            markQuoteSent(quote.id);
          }} />

          {/* Share with approval link — customer can accept digitally */}
          {quote.status === 'sent' && (
            <Pressable
              style={[styles.acceptButton, { backgroundColor: Palette.hermesOrange }]}
              accessibilityRole="button"
              accessibilityLabel={t('quotes.shareApprovalLink', 'Share approval link')}
              onPress={async () => {
                try {
                  const url = await shareQuoteWithAcceptanceLink({
                    id: quote.id,
                    customer: quote.customer,
                    customerName: quote.customer,
                    amount: quote.amount,
                    job: quote.job,
                  });
                  if (isDemoMode) {
                    Alert.alert(
                      t('quotes.demoMode', 'Demo mode'),
                      t('quotes.demoApprovalLink', 'In demo mode, approval links are local only. The link has been shared via your device share sheet.'),
                    );
                  }
                } catch {
                  Alert.alert(t('common.error', 'Error'), t('quotes.approvalLinkFailed', 'Could not create approval link.'));
                }
              }}
            >
              <Ionicons name="link" size={18} color="#fff" />
              <Text style={styles.acceptButtonText}>{t('quotes.shareApprovalLink', 'Share approval link')}</Text>
            </Pressable>
          )}

          {/* Accept & Convert to Job */}
          <Pressable
            style={styles.acceptButton}
            accessibilityRole="button"
            accessibilityLabel={t('quotes.acceptAndCreateJob', 'Accept and create job')}
            onPress={() => {
              Alert.alert(
                t('quotes.acceptQuote', 'Accept quote'),
                t('quotes.acceptQuoteDesc', { defaultValue: 'Accept quote and create job for {{total}}?', total: formattedTotal }),
                [
                  { text: t('common.cancel', 'Cancel'), style: 'cancel' },
                  {
                    text: t('quotes.accept', 'Accept'),
                    onPress: async () => {
                      try {
                        const jobId = await convertQuoteToJob(quote.id);
                        if (jobId) {
                          Alert.alert(t('quotes.jobCreated', 'Job created'), t('quotes.jobCreatedDesc', 'The quote has been accepted and a job has been created.'));
                        }
                      } catch (err: any) {
                        Alert.alert(t('common.error', 'Error'), err?.message || t('quotes.conversionFailed', 'Could not convert quote to job.'));
                      }
                    },
                  },
                ],
              );
            }}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.acceptButtonText}>{t('quotes.acceptAndCreateJob', 'Accept & create job')}</Text>
          </Pressable>

          <Link href={`/quotes/${id}/invoice`} asChild>
            <Pressable style={styles.secondaryButton} accessibilityRole="button" accessibilityLabel={t('quotes.createInvoice', 'Create invoice')}>
              <Text style={styles.secondaryText}>{t('quotes.createInvoice', 'Create invoice')}</Text>
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

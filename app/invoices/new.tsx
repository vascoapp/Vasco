import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../src/components/Screen';
import { InlineInsight, VascoInsightCard } from '../../src/components/shared/VascoInsightCard';
import { useAppState } from '../../src/state/AppState';
import { useAuth } from '../../src/context/AuthContext';
import { useInlineInsight, useVascoGuidance } from '../../src/services/vascoGuidanceService';
import { formatCurrency, type Country } from '../../src/i18n/formatting';
import { SemanticColors } from '../../src/theme/colors';
import { Radius } from '../../src/theme/radius';
import { Spacing } from '../../src/theme/spacing';
import { Typography } from '../../src/theme/typography';
import { DKScreenHeader } from '../../src/components/shared/DKScreenHeader';

export default function InvoiceFromQuoteSelect() {
  const { t } = useTranslation();
  const { quotes } = useAppState();
  const { user } = useAuth();
  const country = (user?.country ?? 'NL') as Country;

  // AI guidance
  const inlineInsight = useInlineInsight('contractor', 'invoice-new', 'select');
  const insights = useVascoGuidance('contractor', 'invoice-new');
  const topInsight = insights.length > 0 ? insights[0] : null;

  // Only show sent quotes (ready for invoicing)
  const sentQuotes = quotes.filter((q) => q.status === 'sent');
  const draftQuotes = quotes.filter((q) => q.status === 'draft');

  return (
    <Screen>
      {/* The title was drawn inside the scroll view, so it scrolled away and
          there was no back control at any point — this stack runs with
          headerShown:false. */}
      <DKScreenHeader
        title={t('invoiceNew.title', 'Create invoice')}
        subtitle={t('invoiceNew.subtitle', 'Pick a quote to invoice')}
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
        {topInsight && (
          <VascoInsightCard insight={topInsight} compact showSource />
        )}

        {sentQuotes.length > 0 && (
          <View style={styles.card}>
            <Text style={Typography.subtitle}>{t('invoiceNew.sentQuotes', 'Sent quotes')}</Text>
            {sentQuotes.map((quote) => (
              <Link key={quote.id} href={`/quotes/${quote.id}/invoice`} asChild>
                <Pressable style={styles.row}>
                  <View>
                    <Text style={Typography.body}>{quote.customer}</Text>
                    <Text style={Typography.muted}>{quote.job}</Text>
                  </View>
                  <Text style={Typography.body}>{formatCurrency(quote.amount, country)}</Text>
                </Pressable>
              </Link>
            ))}
          </View>
        )}

        {draftQuotes.length > 0 && (
          <View style={styles.card}>
            <Text style={Typography.subtitle}>{t('invoiceNew.draftQuotes', 'Draft quotes')}</Text>
            <Text style={[Typography.muted, { marginBottom: Spacing.xs }]}>
              {t('invoiceNew.sendFirst', 'Send these first, then invoice')}
            </Text>
            {draftQuotes.map((quote) => (
              <Link key={quote.id} href={`/quotes/${quote.id}`} asChild>
                <Pressable style={[styles.row, { opacity: 0.6 }]}>
                  <View>
                    <Text style={Typography.body}>{quote.customer}</Text>
                    <Text style={Typography.muted}>{quote.job}</Text>
                  </View>
                  <Text style={[Typography.muted, { fontSize: 12 }]}>{t('quotes.status.draft', 'Draft')}</Text>
                </Pressable>
              </Link>
            ))}
          </View>
        )}

        {quotes.length === 0 && (
          <View style={styles.card}>
            <Text style={Typography.muted}>{t('invoiceNew.noQuotes', 'No quotes yet. Create a quote first.')}</Text>
          </View>
        )}
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
    paddingVertical: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
});

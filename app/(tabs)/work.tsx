import { formatMoney } from '../../src/i18n/formatting';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../src/components/Screen';
import { useAppState } from '../../src/state/AppState';
import { SemanticColors } from '../../src/theme/colors';
import { Radius } from '../../src/theme/radius';
import { Spacing } from '../../src/theme/spacing';
import { Typography } from '../../src/theme/typography';

type Tab = 'quotes' | 'invoices';

export default function WorkScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { quotes, invoices, priceRisks } = useAppState();
  const [activeTab, setActiveTab] = useState<Tab>('quotes');

  const draftQuotes = quotes.filter((q) => q.status === 'draft');
  const sentQuotes = quotes.filter((q) => q.status === 'sent');
  const overdueInvoices = invoices.filter((i) => i.status === 'overdue');
  const sentInvoices = invoices.filter((i) => i.status === 'sent');
  const paidInvoices = invoices.filter((i) => i.status === 'paid');

  const totalOutstanding = invoices
    .filter((i) => i.status !== 'paid')
    .reduce((sum, i) => sum + i.amount, 0);

  const totalOverdue = overdueInvoices.reduce((sum, i) => sum + i.amount, 0);

  const formatCurrency = (amount: number) =>
    `${formatMoney(amount)}`;

  const getQuoteRisk = (quoteId: string) =>
    priceRisks.find((r) => r.quoteId === quoteId);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.sectionLabel}>{t('tabs.work.yourPipeline', 'Your pipeline')}</Text>
            <Text style={Typography.title}>{t('tabs.work.work', 'Work')}</Text>
          </View>
          <View style={styles.statsBadge}>
            <Text style={styles.statsText}>
              {t('tabs.work.outstanding', { defaultValue: '{{amount}} outstanding', amount: formatCurrency(totalOutstanding) })}
            </Text>
          </View>
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{draftQuotes.length}</Text>
            <Text style={styles.summaryLabel}>{t('tabs.work.draftQuotes', 'Draft quotes')}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{sentInvoices.length}</Text>
            <Text style={styles.summaryLabel}>{t('tabs.work.awaitingPayment', 'Awaiting payment')}</Text>
          </View>
          <View style={[styles.summaryCard, overdueInvoices.length > 0 && styles.summaryCardDanger]}>
            <Text style={[styles.summaryValue, overdueInvoices.length > 0 && styles.summaryValueDanger]}>
              {overdueInvoices.length}
            </Text>
            <Text style={[styles.summaryLabel, overdueInvoices.length > 0 && styles.summaryLabelDanger]}>
              {t('tabs.work.overdue', 'Overdue')}
            </Text>
          </View>
        </View>

        {/* Overdue Alert */}
        {overdueInvoices.length > 0 && (
          <View style={styles.alertCard}>
            <View style={styles.alertIcon}>
              <Text style={styles.alertIconText}>!</Text>
            </View>
            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>
                {formatCurrency(totalOverdue)} {t('tabs.work.overdue', 'overdue')}
              </Text>
              <Text style={styles.alertSubtitle}>
                {t('tabs.work.invoicesNeedAttention', '{{count}} invoice(s) need attention', { count: overdueInvoices.length })}
              </Text>
            </View>
            <Pressable
              style={styles.alertAction}
              onPress={() => {
                setActiveTab('invoices');
              }}
            >
              <Text style={styles.alertActionText}>{t('common.view', 'View')}</Text>
            </Pressable>
          </View>
        )}

        {/* Tab Switcher */}
        <View style={styles.tabSwitcher}>
          <Pressable
            style={[styles.tab, activeTab === 'quotes' && styles.tabActive]}
            onPress={() => setActiveTab('quotes')}
          >
            <Text style={[styles.tabText, activeTab === 'quotes' && styles.tabTextActive]}>
              {t('tabs.work.quotesCount', 'Quotes ({{count}})', { count: quotes.length })}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'invoices' && styles.tabActive]}
            onPress={() => setActiveTab('invoices')}
          >
            <Text style={[styles.tabText, activeTab === 'invoices' && styles.tabTextActive]}>
              {t('tabs.work.invoicesCount', 'Invoices ({{count}})', { count: invoices.length })}
            </Text>
          </Pressable>
        </View>

        {/* Quotes List */}
        {activeTab === 'quotes' && (
          <View style={styles.list}>
            {draftQuotes.length > 0 && (
              <>
                <Text style={styles.listHeader}>{t('tabs.work.drafts', 'Drafts')}</Text>
                {draftQuotes.map((quote) => {
                  const risk = getQuoteRisk(quote.id);
                  return (
                    <Pressable
                      key={quote.id}
                      style={({ pressed }) => [styles.listItem, pressed && styles.listItemPressed]}
                      onPress={() => router.push(`/quotes/${quote.id}`)}
                    >
                      <View style={styles.itemLeft}>
                        <View style={[styles.statusDot, styles.statusDraft]} />
                        <View>
                          <Text style={styles.itemTitle}>{quote.customer}</Text>
                          <Text style={styles.itemSubtitle}>{quote.job}</Text>
                        </View>
                      </View>
                      <View style={styles.itemRight}>
                        {risk && (
                          <View style={styles.riskBadge}>
                            <Text style={styles.riskBadgeText}>
                              +{formatCurrency(risk.estimatedSavings)}
                            </Text>
                          </View>
                        )}
                        <Text style={styles.itemAmount}>{formatCurrency(quote.amount)}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </>
            )}

            {sentQuotes.length > 0 && (
              <>
                <Text style={styles.listHeader}>{t('tabs.work.sent', 'Sent')}</Text>
                {sentQuotes.map((quote) => (
                  <Pressable
                    key={quote.id}
                    style={({ pressed }) => [styles.listItem, pressed && styles.listItemPressed]}
                    onPress={() => router.push(`/quotes/${quote.id}`)}
                  >
                    <View style={styles.itemLeft}>
                      <View style={[styles.statusDot, styles.statusSent]} />
                      <View>
                        <Text style={styles.itemTitle}>{quote.customer}</Text>
                        <Text style={styles.itemSubtitle}>{quote.job}</Text>
                      </View>
                    </View>
                    <View style={styles.itemRight}>
                      <Text style={styles.itemAmount}>{formatCurrency(quote.amount)}</Text>
                    </View>
                  </Pressable>
                ))}
              </>
            )}

            <Pressable
              style={styles.createButton}
              onPress={() => router.push('/quotes/new')}
            >
              <Text style={styles.createButtonText}>+ {t('tabs.work.newQuote', 'New Quote')}</Text>
            </Pressable>
          </View>
        )}

        {/* Invoices List */}
        {activeTab === 'invoices' && (
          <View style={styles.list}>
            {overdueInvoices.length > 0 && (
              <>
                <Text style={[styles.listHeader, styles.listHeaderDanger]}>{t('tabs.work.overdue', 'Overdue')}</Text>
                {overdueInvoices.map((invoice) => (
                  <Pressable
                    key={invoice.id}
                    style={({ pressed }) => [
                      styles.listItem,
                      styles.listItemDanger,
                      pressed && styles.listItemPressed,
                    ]}
                    onPress={() => router.push(`/invoices/${invoice.id}`)}
                  >
                    <View style={styles.itemLeft}>
                      <View style={[styles.statusDot, styles.statusOverdue]} />
                      <View>
                        <Text style={styles.itemTitle}>{invoice.customer}</Text>
                        <Text style={[styles.itemSubtitle, styles.itemSubtitleDanger]}>
                          {t('tabs.work.daysOverdue', '{{days}} days overdue', { days: Math.abs(invoice.dueInDays) })}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.itemRight}>
                      <Text style={[styles.itemAmount, styles.itemAmountDanger]}>
                        {formatCurrency(invoice.amount)}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </>
            )}

            {sentInvoices.length > 0 && (
              <>
                <Text style={styles.listHeader}>{t('tabs.work.awaitingPayment', 'Awaiting Payment')}</Text>
                {sentInvoices.map((invoice) => (
                  <Pressable
                    key={invoice.id}
                    style={({ pressed }) => [styles.listItem, pressed && styles.listItemPressed]}
                    onPress={() => router.push(`/invoices/${invoice.id}`)}
                  >
                    <View style={styles.itemLeft}>
                      <View style={[styles.statusDot, styles.statusSent]} />
                      <View>
                        <Text style={styles.itemTitle}>{invoice.customer}</Text>
                        <Text style={styles.itemSubtitle}>
                          {t('tabs.work.dueInDays', 'Due in {{days}} days', { days: invoice.dueInDays })}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.itemRight}>
                      <Text style={styles.itemAmount}>{formatCurrency(invoice.amount)}</Text>
                    </View>
                  </Pressable>
                ))}
              </>
            )}

            {paidInvoices.length > 0 && (
              <>
                <Text style={styles.listHeader}>{t('tabs.work.paid', 'Paid')}</Text>
                {paidInvoices.map((invoice) => (
                  <Pressable
                    key={invoice.id}
                    style={({ pressed }) => [styles.listItem, pressed && styles.listItemPressed]}
                    onPress={() => router.push(`/invoices/${invoice.id}`)}
                  >
                    <View style={styles.itemLeft}>
                      <View style={[styles.statusDot, styles.statusPaid]} />
                      <View>
                        <Text style={styles.itemTitle}>{invoice.customer}</Text>
                        <Text style={styles.itemSubtitle}>{t('tabs.work.paid', 'Paid')}</Text>
                      </View>
                    </View>
                    <View style={styles.itemRight}>
                      <Text style={[styles.itemAmount, styles.itemAmountPaid]}>
                        {formatCurrency(invoice.amount)}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </>
            )}

            <Pressable
              style={styles.createButton}
              onPress={() => router.push('/invoices/new')}
            >
              <Text style={styles.createButtonText}>+ {t('tabs.work.createInvoice', 'Create Invoice')}</Text>
            </Pressable>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  sectionLabel: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: Spacing.xs,
    fontFamily: 'Inter_500Medium',
  },
  statsBadge: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  statsText: {
    color: SemanticColors.textSecondary,
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    alignItems: 'center',
  },
  summaryCardDanger: {
    backgroundColor: SemanticColors.feedbackError + '10',
    borderColor: SemanticColors.feedbackError + '40',
  },
  summaryValue: {
    color: SemanticColors.textPrimary,
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
  },
  summaryValueDanger: {
    color: SemanticColors.feedbackError,
  },
  summaryLabel: {
    color: SemanticColors.textSecondary,
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    marginTop: 4,
    textAlign: 'center',
  },
  summaryLabelDanger: {
    color: SemanticColors.feedbackError,
  },
  alertCard: {
    backgroundColor: SemanticColors.feedbackError + '15',
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.feedbackError + '30',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  alertIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    backgroundColor: SemanticColors.feedbackError,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertIconText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    color: SemanticColors.feedbackError,
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  alertSubtitle: {
    color: SemanticColors.feedbackError,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    opacity: 0.8,
  },
  alertAction: {
    backgroundColor: SemanticColors.feedbackError,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: Radius.md,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertActionText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: Radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.md,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  tabText: {
    color: SemanticColors.textSecondary,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  tabTextActive: {
    color: SemanticColors.textPrimary,
  },
  list: {
    gap: Spacing.sm,
  },
  listHeader: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: 'Inter_600SemiBold',
    marginTop: Spacing.sm,
    marginBottom: 4,
  },
  listHeaderDanger: {
    color: SemanticColors.feedbackError,
  },
  listItem: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listItemDanger: {
    backgroundColor: SemanticColors.feedbackError + '08',
    borderColor: SemanticColors.feedbackError + '25',
  },
  listItemPressed: {
    opacity: 0.85,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: Radius.pill,
  },
  statusDraft: {
    backgroundColor: SemanticColors.feedbackWarning,
  },
  statusSent: {
    backgroundColor: SemanticColors.actionPrimary,
  },
  statusOverdue: {
    backgroundColor: SemanticColors.feedbackError,
  },
  statusPaid: {
    backgroundColor: SemanticColors.feedbackSuccess,
  },
  itemTitle: {
    color: SemanticColors.textPrimary,
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  itemSubtitle: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  itemSubtitleDanger: {
    color: SemanticColors.feedbackError,
  },
  itemRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  riskBadge: {
    backgroundColor: SemanticColors.feedbackSuccess + '20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  riskBadgeText: {
    color: SemanticColors.feedbackSuccess,
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
  itemAmount: {
    color: SemanticColors.textPrimary,
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  itemAmountDanger: {
    color: SemanticColors.feedbackError,
  },
  itemAmountPaid: {
    color: SemanticColors.feedbackSuccess,
  },
  createButton: {
    backgroundColor: SemanticColors.actionPrimary,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: Spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  createButtonText: {
    color: '#0B0C0F',
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
});

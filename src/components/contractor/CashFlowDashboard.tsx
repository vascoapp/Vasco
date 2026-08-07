// =============================================================================
// CASH FLOW DASHBOARD COMPONENT
// =============================================================================
// Financial overview with forecasting, invoice management, and insights
// =============================================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG } from '../../theme/tabStyles';
import { TYPE, RADIUS } from '../../theme/tabStyles';
import { EmptyState } from '../shared/EmptyState';
import { useTranslation } from 'react-i18next';
import { formatCurrency as formatCurrencyForCountry, type Country } from '../../i18n/formatting';
import { getCurrentCountry } from '../../lib/currentUser';
import {
  useCashFlow,
  usePaymentReminders,
  Invoice,
  CashFlowForecast,
  PaymentReminder,
} from '../../services/cashFlowService';

type TabType = 'overview' | 'invoices' | 'forecast' | 'expenses';

export function CashFlowDashboard() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // seasonalPatterns comes off the same useCashFlow call rather than the
  // useSeasonalPatterns hook, which would subscribe to AppState a second time.
  const { invoices, expenses, summary, aging, forecast, seasonalPatterns, markPaid, sendReminder } = useCashFlow();
  const { reminders } = usePaymentReminders();

  const tabs: Array<{ key: TabType; label: string; icon: string }> = [
    { key: 'overview', label: t('cashflow.tabOverview', 'Overview'), icon: 'wallet-outline' },
    { key: 'invoices', label: t('cashflow.tabInvoices', 'Invoices'), icon: 'document-text-outline' },
    { key: 'forecast', label: t('cashflow.tabForecast', 'Forecast'), icon: 'trending-up-outline' },
    { key: 'expenses', label: t('cashflow.tabExpenses', 'Expenses'), icon: 'receipt-outline' },
  ];

  // Was `new Intl.NumberFormat(undefined, { currency: 'EUR' })`, which pinned
  // every amount on this screen to euros regardless of the contractor's
  // country -- a UK or US contractor read their balance in the wrong currency.
  // `undefined` as the locale also meant the grouping/decimal separators came
  // from the device, not the app locale.
  const country = (getCurrentCountry() as Country) ?? 'NL';
  const formatCurrency = (amount: number) => formatCurrencyForCountry(amount, country);

  const getStatusStyle = (status: Invoice['status']) => {
    switch (status) {
      case 'paid': return { color: Palette.green500, bg: Palette.green500 + '20', label: t('cashflow.statusPaid', 'Paid') };
      case 'sent': return { color: Palette.hermesOrange, bg: Palette.hermesOrange + '20', label: t('common.sent', 'Sent') };
      case 'viewed': return { color: Palette.hermesOrange, bg: Palette.hermesOrange + '20', label: t('cashflow.statusViewed', 'Viewed') };
      case 'overdue': return { color: Palette.red500, bg: Palette.red500 + '20', label: t('cashflow.statusOverdue', 'Overdue') };
      case 'draft': return { color: Palette.gray500, bg: Palette.gray500 + '20', label: t('cashflow.statusDraft', 'Draft') };
      default: return { color: Palette.gray500, bg: Palette.gray500 + '20', label: status };
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 70) return Palette.green500;
    if (score >= 40) return Palette.orange500;
    return Palette.red500;
  };

  const openInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowInvoiceModal(true);
  };

  const renderOverviewTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Health Score */}
      <View style={styles.healthCard}>
        <View style={styles.healthLeft}>
          <Text style={styles.healthTitle}>{t('cashflow.healthTitle', 'Financial health')}</Text>
          <View style={[styles.healthCircle, { borderColor: getHealthColor(summary.healthScore) }]}>
            <Text style={[styles.healthScore, { color: getHealthColor(summary.healthScore) }]}>
              {summary.healthScore}
            </Text>
          </View>
        </View>
        <View style={styles.healthRight}>
          <View style={styles.healthStat}>
            <Text style={styles.healthStatLabel}>{t('cashflow.currentBalance', 'Current balance')}</Text>
            <Text style={styles.healthStatValue}>{formatCurrency(summary.currentBalance)}</Text>
          </View>
          <View style={styles.healthStat}>
            <Text style={styles.healthStatLabel}>{t('cashflow.forecast30', '30-day forecast')}</Text>
            <Text style={[styles.healthStatValue, { color: summary.projectedBalance30Days >= summary.currentBalance ? Palette.green500 : Palette.red500 }]}>
              {formatCurrency(summary.projectedBalance30Days)}
            </Text>
          </View>
        </View>
      </View>

      {/* Alerts */}
      {summary.alerts.length > 0 && (
        <View style={styles.alertsSection}>
          {summary.alerts.map((alert) => (
            <Pressable key={alert.id} style={[styles.alertCard, { borderLeftColor: alert.type === 'warning' ? Palette.orange500 : Palette.hermesOrange }]}>
              <Ionicons
                name={alert.type === 'warning' ? 'warning-outline' : 'bulb-outline'}
                size={20}
                color={alert.type === 'warning' ? Palette.orange500 : Palette.hermesOrange}
              />
              <View style={styles.alertContent}>
                <Text style={styles.alertTitle}>{alert.title}</Text>
                <Text style={styles.alertDescription}>{alert.description}</Text>
              </View>
              {alert.actionable && (
                <Ionicons name="chevron-forward" size={18} color={SemanticColors.textSecondary} />
              )}
            </Pressable>
          ))}
        </View>
      )}

      {/* Quick Stats */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Ionicons name="arrow-up-circle-outline" size={24} color={Palette.green500} />
          <Text style={styles.statLabel}>{t('cashflow.toReceive', 'To receive')}</Text>
          <Text style={styles.statValue}>{formatCurrency(summary.pendingIncome)}</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="arrow-down-circle-outline" size={24} color={Palette.red500} />
          <Text style={styles.statLabel}>{t('cashflow.toPay', 'To pay')}</Text>
          <Text style={styles.statValue}>{formatCurrency(summary.pendingExpenses)}</Text>
        </View>
      </View>

      {/* Invoice Aging */}
      <View style={styles.agingCard}>
        <Text style={styles.sectionTitle}>{t('cashflow.agingTitle', 'Invoice aging')}</Text>
        <View style={styles.agingRow}>
          <View style={styles.agingItem}>
            <Text style={styles.agingLabel}>{t('cashflow.agingCurrent', 'Current')}</Text>
            <Text style={[styles.agingValue, { color: Palette.green500 }]}>{formatCurrency(aging.current.total)}</Text>
            <Text style={styles.agingCount}>{t('cashflow.invoiceCount', { count: aging.current.count })}</Text>
          </View>
          <View style={styles.agingItem}>
            <Text style={styles.agingLabel}>{t('cashflow.aging30', '1-30 days')}</Text>
            <Text style={[styles.agingValue, { color: Palette.orange500 }]}>{formatCurrency(aging.days30.total)}</Text>
            <Text style={styles.agingCount}>{t('cashflow.invoiceCount', { count: aging.days30.count })}</Text>
          </View>
          <View style={styles.agingItem}>
            <Text style={styles.agingLabel}>{t('cashflow.aging60', '31-60 days')}</Text>
            <Text style={[styles.agingValue, { color: Palette.red500 }]}>{formatCurrency(aging.days60.total)}</Text>
            <Text style={styles.agingCount}>{t('cashflow.invoiceCount', { count: aging.days60.count })}</Text>
          </View>
          <View style={styles.agingItem}>
            <Text style={styles.agingLabel}>{t('cashflow.aging90', '60+ days')}</Text>
            <Text style={[styles.agingValue, { color: Palette.red500 }]}>{formatCurrency(aging.days90Plus.total)}</Text>
            <Text style={styles.agingCount}>{t('cashflow.invoiceCount', { count: aging.days90Plus.count })}</Text>
          </View>
        </View>
      </View>

      {/* Payment Reminders */}
      {reminders.length > 0 && (
        <View style={styles.remindersSection}>
          <Text style={styles.sectionTitle}>{t('cashflow.remindersTitle', 'Payment reminders')}</Text>
          {reminders.slice(0, 3).map((reminder) => (
            <View key={reminder.id} style={styles.reminderCard}>
              <View style={styles.reminderInfo}>
                <Text style={styles.reminderCustomer}>{reminder.customerName}</Text>
                <Text style={styles.reminderAmount}>{formatCurrency(reminder.amount)}</Text>
                <Text style={styles.reminderDays}>{t('cashflow.daysOverdue', { count: reminder.daysOverdue })}</Text>
              </View>
              <Pressable
                style={styles.reminderButton}
                onPress={() => sendReminder(reminder.invoiceId)}
              >
                <Ionicons name="mail-outline" size={18} color={Palette.hermesOrange} />
                <Text style={styles.reminderButtonText}>{t('cashflow.remindAction', 'Remind')}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* "Financieringsopties" was removed here — it advertised credit that
          does not exist. It offered a "Vasco Business Credit" line of
          "Tot € 25.000,00 beschikbaar" for € 250, and a "Vasco Financing"
          factoring facility: both providers are invented, both amounts were
          literals (or a flat 90%/3% of the aging totals), and the cards had no
          onPress behind their chevron, so there was nothing to apply to.

          Telling a contractor with tight cash that €25.000 is "available" is
          not a cosmetic fabrication — it is an inducement about credit, and it
          showed up precisely when their projected balance was low.

          It was also latent until now: the factoring card required
          `aging.days30 + aging.days60 > 2000`, and the aging table was fed by
          the empty singleton, so it was permanently 0 and neither card could
          appear. Fixing the aging wiring in this same change would have
          switched this on for anyone with >€2.000 overdue.

          Restore only alongside a real financing partner, with amounts and
          costs that come from that partner. */}
    </ScrollView>
  );

  const renderInvoiceCard = (invoice: Invoice) => {
    const status = getStatusStyle(invoice.status);
    return (
      <Pressable key={invoice.id} style={styles.invoiceCard} onPress={() => openInvoice(invoice)}>
        <View style={styles.invoiceMain}>
          <View style={styles.invoiceHeader}>
            <Text style={styles.invoiceCustomer}>{invoice.customerName}</Text>
            <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
              <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
          </View>
          <Text style={styles.invoiceProject}>{invoice.projectName}</Text>
          <View style={styles.invoiceMeta}>
            <Text style={styles.invoiceDate}>
              {t('cashflow.dueDateLabel', { date: new Date(invoice.dueDate).toLocaleDateString(undefined) })}
            </Text>
            {invoice.remindersSent > 0 && (
              <Text style={styles.invoiceReminders}>{t('cashflow.remindersSent', { count: invoice.remindersSent })}</Text>
            )}
          </View>
        </View>
        <Text style={styles.invoiceAmount}>{formatCurrency(invoice.amount)}</Text>
      </Pressable>
    );
  };

  const renderInvoicesTab = () => {
    const unpaid = invoices.filter((i) => i.status !== 'paid' && i.status !== 'cancelled');
    const paid = invoices.filter((i) => i.status === 'paid');

    if (unpaid.length === 0 && paid.length === 0) {
      return (
        <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
          <EmptyState
            icon="cash-outline"
            title={t('cashflow.noInvoicesTitle', 'No invoices yet')}
            description={t('cashflow.noInvoicesDesc', 'Mark a job as completed to create your first invoice.')}
          />
        </ScrollView>
      );
    }

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>{t('cashflow.outstandingCount', { count: unpaid.length })}</Text>
        {unpaid.map(renderInvoiceCard)}

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>{t('cashflow.paidCount', { count: paid.length })}</Text>
        {paid.map(renderInvoiceCard)}
      </ScrollView>
    );
  };

  const renderForecastBar = (week: CashFlowForecast, index: number) => {
    const isPositive = week.netCashFlow >= 0;
    const maxValue = Math.max(...forecast.map((f) => Math.abs(f.netCashFlow)));
    const barHeight = Math.abs(week.netCashFlow) / maxValue * 60;

    return (
      <View key={index} style={styles.forecastBar}>
        <View style={styles.forecastBarContainer}>
          <View
            style={[
              styles.forecastBarFill,
              {
                height: barHeight,
                backgroundColor: isPositive ? Palette.green500 : Palette.red500,
              },
            ]}
          />
        </View>
        <Text style={styles.forecastBarLabel}>{week.period.replace('Week ', 'W')}</Text>
        <Text style={[styles.forecastBarValue, { color: isPositive ? Palette.green500 : Palette.red500 }]}>
          {isPositive ? '+' : ''}{(week.netCashFlow / 1000).toFixed(1)}k
        </Text>
      </View>
    );
  };

  const renderForecastTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Forecast Chart */}
      <View style={styles.forecastCard}>
        <Text style={styles.sectionTitle}>{t('cashflow.forecast8Weeks', '8-week forecast')}</Text>
        <View style={styles.forecastChart}>
          {forecast.map(renderForecastBar)}
        </View>
        <View style={styles.forecastLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Palette.green500 }]} />
            <Text style={styles.legendText}>{t('cashflow.positive', 'Positive')}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Palette.red500 }]} />
            <Text style={styles.legendText}>{t('cashflow.negative', 'Negative')}</Text>
          </View>
        </View>
      </View>

      {/* Seasonal Patterns — computed from the contractor's own paid invoices
          and recorded expenses, so it is empty until there is history. */}
      <View style={styles.seasonalCard}>
        <Text style={styles.sectionTitle}>{t('cashflow.seasonalTitle', 'Seasonal patterns')}</Text>
        {seasonalPatterns.length === 0 && (
          <Text style={styles.emptyHint}>
            {t('cashflow.noSeasonalData', 'Not enough history yet for seasonal patterns.')}
          </Text>
        )}
        <View style={styles.seasonalGrid}>
          {seasonalPatterns.map((pattern) => {
            // Compare the real calendar month, not the array position: months
            // with no history are omitted, so index !== month.
            const isCurrentMonth = pattern.monthIndex === new Date().getMonth();
            return (
              <View
                key={pattern.month}
                style={[styles.seasonalItem, isCurrentMonth && styles.seasonalItemCurrent]}
              >
                <Text style={[styles.seasonalMonth, isCurrentMonth && { color: Palette.hermesOrange }]}>
                  {pattern.month}
                </Text>
                <View style={[styles.seasonalIndicator, {
                  backgroundColor: pattern.trend === 'high' ? Palette.green500 + '30' :
                    pattern.trend === 'medium' ? Palette.orange500 + '30' : Palette.red500 + '30',
                }]}>
                  <Text style={[styles.seasonalTrend, {
                    color: pattern.trend === 'high' ? Palette.green500 :
                      pattern.trend === 'medium' ? Palette.orange500 : Palette.red500,
                  }]}>
                    {pattern.trend === 'high'
                      ? t('cashflow.trendHigh', 'High')
                      : pattern.trend === 'medium'
                        ? t('cashflow.trendMedium', 'Medium')
                        : t('cashflow.trendLow', 'Low')}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* Forecast Details */}
      <View style={styles.forecastDetails}>
        <Text style={styles.sectionTitle}>{t('cashflow.weekDetails', 'Weekly detail')}</Text>
        {forecast.slice(0, 4).map((week, index) => (
          <View key={index} style={styles.forecastDetailRow}>
            <Text style={styles.forecastDetailPeriod}>{week.period}</Text>
            <View style={styles.forecastDetailValues}>
              <View style={styles.forecastDetailItem}>
                <Ionicons name="arrow-up" size={12} color={Palette.green500} />
                <Text style={styles.forecastDetailValue}>{formatCurrency(week.expectedIncome)}</Text>
              </View>
              <View style={styles.forecastDetailItem}>
                <Ionicons name="arrow-down" size={12} color={Palette.red500} />
                <Text style={styles.forecastDetailValue}>{formatCurrency(week.expectedExpenses)}</Text>
              </View>
              <Text style={[styles.forecastDetailNet, { color: week.netCashFlow >= 0 ? Palette.green500 : Palette.red500 }]}>
                {week.netCashFlow >= 0 ? '+' : ''}{formatCurrency(week.netCashFlow)}
              </Text>
            </View>
            {/* Omitted for weeks that expect no income: a "100%" badge next to
                EUR 0,00 reads as a claim about nothing. */}
            {week.confidence !== null && (
              <View style={styles.confidenceBadge}>
                <Text style={styles.confidenceText}>{Math.round(week.confidence * 100)}%</Text>
              </View>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const getCategoryStyle = (category: string) => {
    switch (category) {
      case 'materialen': return { color: Palette.hermesOrange, icon: 'cube-outline' };
      case 'gereedschap': return { color: Palette.hermesOrange, icon: 'hammer-outline' };
      case 'voertuig': return { color: Palette.orange500, icon: 'car-outline' };
      case 'verzekering': return { color: Palette.green500, icon: 'shield-checkmark-outline' };
      default: return { color: Palette.gray500, icon: 'ellipsis-horizontal-outline' };
    }
  };

  const renderExpensesTab = () => {
    const totalThisMonth = expenses.reduce((sum, e) => sum + e.amount, 0);
    const byCategory = expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {} as Record<string, number>);

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {/* Summary */}
        <View style={styles.expenseSummary}>
          <Text style={styles.expenseSummaryLabel}>{t('cashflow.totalThisMonth', 'Total this month')}</Text>
          <Text style={styles.expenseSummaryValue}>{formatCurrency(totalThisMonth)}</Text>
        </View>

        {/* By Category */}
        <View style={styles.categoryBreakdown}>
          <Text style={styles.sectionTitle}>{t('cashflow.perCategory', 'By category')}</Text>
          {Object.entries(byCategory).map(([category, amount]) => {
            const style = getCategoryStyle(category);
            const percentage = (amount / totalThisMonth) * 100;
            return (
              <View key={category} style={styles.categoryRow}>
                <View style={[styles.categoryIcon, { backgroundColor: style.color + '20' }]}>
                  <Ionicons name={style.icon as any} size={18} color={style.color} />
                </View>
                <View style={styles.categoryInfo}>
                  <Text style={styles.categoryName}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </Text>
                  <View style={styles.categoryBar}>
                    <View style={[styles.categoryBarFill, { width: `${percentage}%`, backgroundColor: style.color }]} />
                  </View>
                </View>
                <Text style={styles.categoryAmount}>{formatCurrency(amount)}</Text>
              </View>
            );
          })}
        </View>

        {/* Recent Expenses */}
        <View style={styles.recentExpenses}>
          <Text style={styles.sectionTitle}>{t('cashflow.recentExpenses', 'Recent expenses')}</Text>
          {expenses.length === 0 && (
            <Text style={styles.emptyHint}>{t('cashflow.noExpenses', 'No expenses recorded yet.')}</Text>
          )}
          {expenses.slice(0, 10).map((expense) => {
            const style = getCategoryStyle(expense.category);
            return (
              <View key={expense.id} style={styles.expenseRow}>
                <View style={[styles.expenseIcon, { backgroundColor: style.color + '20' }]}>
                  <Ionicons name={style.icon as any} size={16} color={style.color} />
                </View>
                <View style={styles.expenseInfo}>
                  <Text style={styles.expenseDescription}>{expense.description}</Text>
                  <Text style={styles.expenseDate}>
                    {new Date(expense.date).toLocaleDateString(undefined)}
                    {expense.recurring && ' • Terugkerend'}
                  </Text>
                </View>
                <Text style={styles.expenseAmount}>{formatCurrency(expense.amount)}</Text>
              </View>
            );
          })}
        </View>

        {/* Add Expense Button */}
        <Pressable style={styles.addExpenseButton}>
          <Ionicons name="add-circle-outline" size={24} color={Palette.hermesOrange} />
          <Text style={styles.addExpenseText}>{t('cashflow.addExpense', 'Add expense')}</Text>
        </Pressable>
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      {/* Tabs — horizontally scrollable rather than four flex:1 cells.
          Four fixed cells left each label ~89dp for an 18dp icon plus its
          text, so the last tab ran to the very edge of the content box and
          its pill was clipped. English is the SHORT case here: "Prévisions",
          "Rechnungen" and "Panoramica" are all longer than "Forecast", so a
          fixed row cannot fit every locale. Sizing each pill to its own
          content and letting the row scroll works at any label length. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBarWrap}
        contentContainerStyle={styles.tabBar}
      >
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon as any}
              size={18}
              color={activeTab === tab.key ? Palette.hermesOrange : SemanticColors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Content */}
      {activeTab === 'overview' && renderOverviewTab()}
      {activeTab === 'invoices' && renderInvoicesTab()}
      {activeTab === 'forecast' && renderForecastTab()}
      {activeTab === 'expenses' && renderExpensesTab()}

      {/* Invoice Detail Modal */}
      <Modal
        visible={showInvoiceModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowInvoiceModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowInvoiceModal(false)}>
              <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
            </Pressable>
            <Text style={styles.modalTitle}>{t('cashflow.invoiceDetails', 'Invoice details')}</Text>
            <View style={{ width: 24 }} />
          </View>

          {selectedInvoice && (
            <ScrollView style={styles.modalContent}>
              <View style={styles.invoiceDetailHeader}>
                <Text style={styles.invoiceDetailAmount}>{formatCurrency(selectedInvoice.amount)}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusStyle(selectedInvoice.status).bg }]}>
                  <Text style={[styles.statusText, { color: getStatusStyle(selectedInvoice.status).color }]}>
                    {getStatusStyle(selectedInvoice.status).label}
                  </Text>
                </View>
              </View>

              <View style={styles.invoiceDetailSection}>
                <Text style={styles.invoiceDetailLabel}>{t('cashflow.customerLabel', 'Customer')}</Text>
                <Text style={styles.invoiceDetailValue}>{selectedInvoice.customerName}</Text>
              </View>

              <View style={styles.invoiceDetailSection}>
                <Text style={styles.invoiceDetailLabel}>{t('cashflow.projectLabel', 'Project')}</Text>
                <Text style={styles.invoiceDetailValue}>{selectedInvoice.projectName}</Text>
              </View>

              <View style={styles.invoiceDetailRow}>
                <View style={styles.invoiceDetailSection}>
                  <Text style={styles.invoiceDetailLabel}>{t('cashflow.invoiceDate', 'Invoice date')}</Text>
                  <Text style={styles.invoiceDetailValue}>
                    {new Date(selectedInvoice.issueDate).toLocaleDateString(undefined)}
                  </Text>
                </View>
                <View style={styles.invoiceDetailSection}>
                  <Text style={styles.invoiceDetailLabel}>{t('cashflow.dueDate', 'Due date')}</Text>
                  <Text style={styles.invoiceDetailValue}>
                    {new Date(selectedInvoice.dueDate).toLocaleDateString(undefined)}
                  </Text>
                </View>
              </View>

              {selectedInvoice.status !== 'paid' && (
                <View style={styles.invoiceActions}>
                  <Pressable
                    style={styles.markPaidButton}
                    onPress={() => {
                      markPaid(selectedInvoice.id, 'bank_transfer');
                      setShowInvoiceModal(false);
                    }}
                  >
                    <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                    <Text style={styles.markPaidText}>{t('cashflow.markAsPaid', 'Mark as paid')}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.sendReminderButton}
                    onPress={() => {
                      sendReminder(selectedInvoice.id);
                    }}
                  >
                    <Ionicons name="mail-outline" size={20} color={Palette.hermesOrange} />
                    <Text style={styles.sendReminderText}>{t('cashflow.sendReminderAction', 'Send reminder')}</Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  tabBarWrap: {
    flexGrow: 0,
    backgroundColor: PAGE_BG,
  },
  tab: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: RADIUS.lg,
    gap: 6,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  activeTab: {
    backgroundColor: Palette.hermesOrange + '12',
  },
  tabText: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
    fontFamily: 'Inter_600SemiBold',
  },
  activeTabText: {
    color: Palette.hermesOrange,
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },

  // Section Title
  sectionTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: 'Archivo_900Black',
    color: SemanticColors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  emptyHint: {
    fontSize: TYPE.captionSize,
    fontFamily: 'Inter_400Regular',
    color: SemanticColors.textTertiary,
    paddingVertical: 12,
  },

  // Health Card
  healthCard: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 16,
  },
  healthLeft: {
    alignItems: 'center',
    marginRight: 20,
  },
  healthTitle: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    marginBottom: 8,
  },
  healthCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthScore: {
    fontSize: TYPE.displaySize - 4,
    fontFamily: 'Archivo_900Black',
  },
  healthRight: {
    flex: 1,
    justifyContent: 'center',
    gap: 12,
  },
  healthStat: {},
  healthStatLabel: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
  },
  healthStatValue: {
    fontSize: TYPE.sectionSize,
    fontFamily: 'Inter_600SemiBold',
    color: SemanticColors.textPrimary,
  },

  // Alerts
  alertsSection: {
    marginBottom: 16,
    gap: 8,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.sm,
    padding: 12,
    borderLeftWidth: 4,
    gap: 10,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: 'Inter_600SemiBold',
    color: SemanticColors.textPrimary,
  },
  alertDescription: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  statLabel: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    marginTop: 8,
  },
  statValue: {
    fontSize: TYPE.sectionSize,
    fontFamily: 'Inter_600SemiBold',
    color: SemanticColors.textPrimary,
    marginTop: 4,
  },

  // Aging
  agingCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  agingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  agingItem: {
    alignItems: 'center',
  },
  agingLabel: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textSecondary,
    marginBottom: 4,
  },
  agingValue: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: 'Inter_600SemiBold',
  },
  agingCount: {
    fontSize: TYPE.tinySize - 1,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },

  // Reminders
  remindersSection: {
    marginBottom: 16,
  },
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.sm,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  reminderInfo: {
    flex: 1,
  },
  reminderCustomer: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: 'Inter_500Medium',
    color: SemanticColors.textPrimary,
  },
  reminderAmount: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textPrimary,
    marginTop: 2,
  },
  reminderDays: {
    fontSize: TYPE.tinySize,
    color: Palette.red500,
    marginTop: 2,
  },
  reminderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.hermesOrange + '15',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    gap: 4,
  },
  reminderButtonText: {
    fontSize: TYPE.captionSize,
    fontFamily: 'Inter_600SemiBold',
    color: Palette.hermesOrange,
  },

  // Financing
  financingSection: {
    marginBottom: 16,
  },
  financingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 12,
  },
  financingIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
    backgroundColor: Palette.hermesOrange + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  financingContent: {
    flex: 1,
  },
  financingTitle: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: 'Inter_600SemiBold',
    color: SemanticColors.textPrimary,
  },
  financingDesc: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  financingAmount: {
    fontSize: TYPE.labelSize,
    color: Palette.hermesOrange,
    fontFamily: 'Inter_500Medium',
    marginTop: 4,
  },

  // Invoices
  invoiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  invoiceMain: {
    flex: 1,
  },
  invoiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  invoiceCustomer: {
    fontSize: TYPE.bodySize,
    fontFamily: 'Inter_600SemiBold',
    color: SemanticColors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  statusText: {
    fontSize: TYPE.tinySize,
    fontFamily: 'Inter_600SemiBold',
  },
  invoiceProject: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
    marginBottom: 4,
  },
  invoiceMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  invoiceDate: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textSecondary,
  },
  invoiceReminders: {
    fontSize: TYPE.tinySize,
    color: Palette.orange500,
  },
  invoiceAmount: {
    fontSize: TYPE.sectionSize,
    fontFamily: 'Inter_600SemiBold',
    color: SemanticColors.textPrimary,
  },

  // Forecast
  forecastCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  forecastChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 100,
    marginVertical: 12,
  },
  forecastBar: {
    alignItems: 'center',
    flex: 1,
  },
  forecastBarContainer: {
    height: 60,
    justifyContent: 'flex-end',
  },
  forecastBarFill: {
    width: 20,
    borderRadius: 4,
    minHeight: 4,
  },
  forecastBarLabel: {
    fontSize: TYPE.tinySize - 1,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  forecastBarValue: {
    fontSize: TYPE.tinySize - 1,
    fontFamily: 'Inter_600SemiBold',
  },
  forecastLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
  },

  // Seasonal
  seasonalCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  seasonalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  seasonalItem: {
    width: '23%',
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
  },
  seasonalItemCurrent: {
    backgroundColor: Palette.hermesOrange + '15',
  },
  seasonalMonth: {
    fontSize: TYPE.labelSize,
    fontFamily: 'Inter_500Medium',
    color: SemanticColors.textPrimary,
    marginBottom: 4,
  },
  seasonalIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  seasonalTrend: {
    fontSize: TYPE.tinySize - 1,
    fontFamily: 'Inter_600SemiBold',
  },

  // Forecast Details
  forecastDetails: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  forecastDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  forecastDetailPeriod: {
    width: 60,
    fontSize: TYPE.captionSize,
    fontFamily: 'Inter_500Medium',
    color: SemanticColors.textPrimary,
  },
  forecastDetailValues: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  forecastDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  forecastDetailValue: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textPrimary,
  },
  forecastDetailNet: {
    fontSize: TYPE.captionSize,
    fontFamily: 'Inter_600SemiBold',
  },
  confidenceBadge: {
    backgroundColor: SemanticColors.surfaceBackground,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  confidenceText: {
    fontSize: TYPE.tinySize - 1,
    color: SemanticColors.textSecondary,
  },

  // Expenses
  expenseSummary: {
    backgroundColor: Palette.red500,
    borderRadius: RADIUS.lg,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  expenseSummaryLabel: {
    fontSize: TYPE.bodySize - 1,
    color: 'rgba(255,255,255,0.8)',
  },
  expenseSummaryValue: {
    fontSize: TYPE.displaySize + 4,
    fontFamily: 'Archivo_900Black',
    color: Palette.white,
    marginTop: 4,
  },
  categoryBreakdown: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textPrimary,
    marginBottom: 4,
  },
  categoryBar: {
    height: 4,
    backgroundColor: SemanticColors.borderDefault,
    borderRadius: 2,
  },
  categoryBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  categoryAmount: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: 'Inter_600SemiBold',
    color: SemanticColors.textPrimary,
  },
  recentExpenses: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
    gap: 10,
  },
  expenseIcon: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseInfo: {
    flex: 1,
  },
  expenseDescription: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textPrimary,
  },
  expenseDate: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  expenseAmount: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: 'Inter_600SemiBold',
    color: SemanticColors.textPrimary,
  },
  addExpenseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.hermesOrange + '15',
    borderRadius: RADIUS.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Palette.hermesOrange,
    borderStyle: 'dashed',
    gap: 8,
  },
  addExpenseText: {
    fontSize: TYPE.bodySize,
    fontFamily: 'Inter_600SemiBold',
    color: Palette.hermesOrange,
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  modalTitle: {
    fontSize: TYPE.titleSize + 1,
    fontFamily: 'Inter_600SemiBold',
    color: SemanticColors.textPrimary,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  invoiceDetailHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  invoiceDetailAmount: {
    fontSize: 36,
    fontFamily: 'Archivo_900Black',
    color: SemanticColors.textPrimary,
    marginBottom: 8,
  },
  invoiceDetailSection: {
    marginBottom: 16,
  },
  invoiceDetailRow: {
    flexDirection: 'row',
    gap: 16,
  },
  invoiceDetailLabel: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    marginBottom: 4,
  },
  invoiceDetailValue: {
    fontSize: TYPE.titleSize,
    color: SemanticColors.textPrimary,
  },
  invoiceActions: {
    gap: 12,
    marginTop: 24,
  },
  markPaidButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.green500,
    paddingVertical: 16,
    borderRadius: RADIUS.lg,
    gap: 8,
  },
  markPaidText: {
    fontSize: TYPE.titleSize,
    fontFamily: 'Inter_600SemiBold',
    color: Palette.white,
  },
  sendReminderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    paddingVertical: 16,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: Palette.hermesOrange,
    gap: 8,
  },
  sendReminderText: {
    fontSize: TYPE.titleSize,
    fontFamily: 'Inter_600SemiBold',
    color: Palette.hermesOrange,
  },
});

import { formatMoney } from '../i18n/formatting';
import { AttentionItem } from '../domain/attention';
import { BusinessProfile } from '../domain/business';
import { Invoice, Quote } from '../domain/documents';
import { PriceRiskSignal } from '../domain/insights';

type AttentionInput = {
  businessProfile: BusinessProfile;
  quotes: Quote[];
  invoices: Invoice[];
  priceRisks: PriceRiskSignal[];
  mollieConnected: boolean;
};

const formatCurrency = (amount: number) =>
  `${formatMoney(amount)}`;

export function buildAttentionQueue({
  businessProfile,
  quotes,
  invoices,
  priceRisks,
  mollieConnected,
}: AttentionInput): AttentionItem[] {
  const items: AttentionItem[] = [];

  // 1. Overdue invoices (highest priority - money at risk)
  const overdueInvoices = invoices.filter((invoice) => invoice.status === 'overdue');
  if (overdueInvoices.length > 0) {
    const totalOverdue = overdueInvoices.reduce((sum, i) => sum + i.amount, 0);
    const mostOverdue = overdueInvoices.reduce((prev, curr) =>
      Math.abs(curr.dueInDays) > Math.abs(prev.dueInDays) ? curr : prev
    );

    items.push({
      id: `overdue-${mostOverdue.id}`,
      title: `${formatCurrency(totalOverdue)} overdue`,
      subtitle: `${overdueInvoices.length} invoice${overdueInvoices.length > 1 ? 's' : ''} need follow-up`,
      why: `Oldest: ${Math.abs(mostOverdue.dueInDays)} days past due`,
      impact: 'Recover cash',
      tag: '€',
      tone: 'danger',
      route: `/invoices/${mostOverdue.id}`,
      priority: 1,
    });
  }

  // 2. Price risks on draft quotes (money being left on table)
  const priceRiskQuotes = priceRisks
    .map((risk) => ({
      risk,
      quote: quotes.find((q) => q.id === risk.quoteId && q.status === 'draft'),
    }))
    .filter((item) => item.quote !== undefined);

  if (priceRiskQuotes.length > 0) {
    const totalSavings = priceRiskQuotes.reduce((sum, item) => sum + item.risk.estimatedSavings, 0);
    const topRisk = priceRiskQuotes[0];

    items.push({
      id: `price-risk-${topRisk.risk.quoteId}`,
      title: `Save ${formatCurrency(totalSavings)} on quotes`,
      subtitle: topRisk.risk.customer,
      why: topRisk.risk.reason,
      impact: `+${formatCurrency(topRisk.risk.estimatedSavings)}`,
      tag: '↑',
      tone: 'warning',
      route: `/quotes/${topRisk.risk.quoteId}`,
      priority: 2,
    });
  }

  // 3. Mollie not connected (blocking faster payments)
  if (!mollieConnected) {
    items.push({
      id: 'connect-mollie',
      title: 'Enable instant payments',
      subtitle: 'Connect Mollie for iDEAL',
      why: 'Customers pay 3x faster with payment links',
      impact: 'Get paid faster',
      tag: 'PAY',
      tone: 'warning',
      route: '/(modals)/mollie',
      priority: 3,
    });
  }

  // 4. Incomplete business profile (blocking pro features)
  if (!businessProfile.isComplete) {
    items.push({
      id: 'missing-profile',
      title: 'Complete your profile',
      subtitle: 'Unlock professional quotes',
      why: 'Missing: business details for invoices',
      impact: 'Look professional',
      tag: 'P',
      tone: 'default',
      route: '/profile',
      priority: 4,
    });
  }

  // 5. Draft quotes waiting (pipeline at risk)
  const staleDraftQuotes = quotes.filter((q) => q.status === 'draft');
  if (staleDraftQuotes.length > 0) {
    const oldestDraft = staleDraftQuotes[0];
    const totalPipeline = staleDraftQuotes.reduce((sum, q) => sum + q.amount, 0);

    items.push({
      id: `draft-${oldestDraft.id}`,
      title: `${formatCurrency(totalPipeline)} in draft quotes`,
      subtitle: `${staleDraftQuotes.length} quote${staleDraftQuotes.length > 1 ? 's' : ''} awaiting action`,
      why: `${oldestDraft.customer} - ${oldestDraft.lastUpdated}`,
      impact: 'Close deals',
      tag: 'Q',
      tone: 'default',
      route: `/quotes/${oldestDraft.id}`,
      priority: 5,
    });
  }

  // 6. Sent invoices approaching due date (proactive follow-up)
  const dueSoonInvoices = invoices.filter(
    (i) => i.status === 'sent' && i.dueInDays > 0 && i.dueInDays <= 3
  );
  if (dueSoonInvoices.length > 0) {
    const soonestDue = dueSoonInvoices[0];
    items.push({
      id: `due-soon-${soonestDue.id}`,
      title: `Invoice due in ${soonestDue.dueInDays} day${soonestDue.dueInDays > 1 ? 's' : ''}`,
      subtitle: soonestDue.customer,
      why: 'Send a friendly reminder',
      impact: 'Prevent overdue',
      tag: 'I',
      tone: 'default',
      route: `/invoices/${soonestDue.id}`,
      priority: 6,
    });
  }

  return items.sort((a, b) => a.priority - b.priority);
}

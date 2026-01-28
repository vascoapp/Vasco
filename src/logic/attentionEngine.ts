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
  `€${amount.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}`;

export function buildAttentionQueue({
  businessProfile,
  quotes,
  invoices,
  priceRisks,
  mollieConnected,
}: AttentionInput): AttentionItem[] {
  const items: AttentionItem[] = [];

  if (!businessProfile.isComplete) {
    items.push({
      id: 'missing-profile',
      title: 'Complete business profile',
      subtitle: 'Unlock pro quotes',
      why: 'Finish once, reuse forever.',
      impact: 'Save time',
      tag: 'P',
      tone: 'warning',
      route: '/profile',
      priority: 1,
    });
  }

  if (!mollieConnected) {
    items.push({
      id: 'connect-mollie',
      title: 'Connect Mollie',
      subtitle: 'Enable iDEAL payments',
      why: 'Faster payments with one-tap links.',
      impact: 'Get paid faster',
      tag: 'PAY',
      tone: 'warning',
      route: '/(modals)/mollie',
      priority: 2,
    });
  }

  const topPriceRisk = priceRisks[0];
  const priceRiskQuote = topPriceRisk
    ? quotes.find((quote) => quote.id === topPriceRisk.quoteId)
    : undefined;
  if (topPriceRisk && priceRiskQuote?.status === 'draft') {
    items.push({
      id: `price-risk-${topPriceRisk.quoteId}`,
      title: 'Price risk detected',
      subtitle: topPriceRisk.customer,
      why: topPriceRisk.reason,
      impact: `Save ${formatCurrency(topPriceRisk.estimatedSavings)}`,
      tag: 'EUR',
      tone: 'danger',
      route: `/quotes/${topPriceRisk.quoteId}`,
      priority: mollieConnected ? 2 : 3,
    });
  }

  const overdueInvoice = invoices.find((invoice) => invoice.status === 'overdue');
  if (overdueInvoice) {
    items.push({
      id: `overdue-${overdueInvoice.id}`,
      title: 'Invoice overdue',
      subtitle: `Invoice #${overdueInvoice.id.replace('i-', '')}`,
      why: `${Math.abs(overdueInvoice.dueInDays)} days overdue.`,
      impact: 'Get paid',
      tag: 'I',
      tone: 'warning',
      route: `/invoices/${overdueInvoice.id}`,
      priority: mollieConnected ? 3 : 4,
    });
  }

  const draftQuote = quotes.find((quote) => quote.status === 'draft');
  if (draftQuote) {
    items.push({
      id: `draft-${draftQuote.id}`,
      title: 'Draft quote waiting',
      subtitle: draftQuote.customer,
      why: `${draftQuote.lastUpdated} idle.`,
      impact: `Close ${formatCurrency(draftQuote.amount)}`,
      tag: 'Q',
      tone: 'default',
      route: `/quotes/${draftQuote.id}`,
      priority: mollieConnected ? 4 : 5,
    });
  }

  return items.sort((a, b) => a.priority - b.priority);
}

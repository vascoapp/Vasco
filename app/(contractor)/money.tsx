// =============================================================================
// MONEY - Quotes & Payments
// =============================================================================
// Manage quotes (Good-Better-Best) and payments (iDEAL/Mollie)
// Connected to cashFlowService for real data
// =============================================================================

import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';
import { TieredQuoteBuilder } from '../../src/components/contractor/TieredQuoteBuilder';
import { IntegratedPayments } from '../../src/components/contractor/IntegratedPayments';
import { useCashFlow, type Invoice } from '../../src/services/cashFlowService';

type IconName = keyof typeof Ionicons.glyphMap;

// ============================================
// TYPES
// ============================================

type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';

interface Quote {
  id: string;
  reference: string;
  customer: string;
  title: string;
  status: QuoteStatus;
  sentDate?: string;
  total: number;
  tiers: { good: number; better: number; best: number };
  selectedTier?: 'good' | 'better' | 'best';
  viewCount?: number;
}

// ============================================
// COMPONENTS
// ============================================

function SummaryCards({ summary, invoices }: { summary: ReturnType<typeof useCashFlow>['summary']; invoices: Invoice[] }) {
  const pendingInvoices = invoices.filter(i => ['sent', 'viewed'].includes(i.status));
  const pendingValue = pendingInvoices.reduce((sum, i) => sum + i.amount, 0);

  const paidThisMonth = invoices.filter(i => i.status === 'paid');
  const paidValue = paidThisMonth.reduce((sum, i) => sum + i.amount, 0);

  return (
    <View style={styles.summaryCards}>
      <View style={[styles.summaryCard, { borderColor: Palette.hermesOrange + '40' }]}>
        <View style={styles.summaryCardHeader}>
          <Ionicons name="document-text" size={20} color={Palette.hermesOrange} />
          <Text style={styles.summaryCardLabel}>Openstaand</Text>
        </View>
        <Text style={styles.summaryCardValue}>€{pendingValue.toLocaleString('nl-NL')}</Text>
        <Text style={styles.summaryCardMeta}>{pendingInvoices.length} wacht op antwoord</Text>
      </View>

      <View style={[styles.summaryCard, { borderColor: SemanticColors.feedbackSuccessBorder }]}>
        <View style={styles.summaryCardHeader}>
          <Ionicons name="checkmark-circle" size={20} color={SemanticColors.feedbackSuccess} />
          <Text style={styles.summaryCardLabel}>Betaald</Text>
        </View>
        <Text style={[styles.summaryCardValue, { color: SemanticColors.feedbackSuccess }]}>
          €{paidValue.toLocaleString('nl-NL')}
        </Text>
        <Text style={styles.summaryCardMeta}>{paidThisMonth.length} facturen betaald</Text>
      </View>
    </View>
  );
}

function QuoteCard({ quote, onPress }: { quote: Quote; onPress: () => void }) {
  const getStatusConfig = (status: QuoteStatus) => {
    switch (status) {
      case 'draft':
        return { label: 'Concept', color: SemanticColors.textTertiary, icon: 'create-outline' as IconName };
      case 'sent':
        return { label: 'Verstuurd', color: SemanticColors.feedbackInfo, icon: 'send-outline' as IconName };
      case 'viewed':
        return { label: `${quote.viewCount}x bekeken`, color: Palette.hermesOrange, icon: 'eye-outline' as IconName };
      case 'accepted':
        return { label: 'Geaccepteerd', color: SemanticColors.feedbackSuccess, icon: 'checkmark-circle-outline' as IconName };
      case 'rejected':
        return { label: 'Afgewezen', color: SemanticColors.feedbackError, icon: 'close-circle-outline' as IconName };
      case 'expired':
        return { label: 'Verlopen', color: SemanticColors.textTertiary, icon: 'time-outline' as IconName };
    }
  };

  const statusConfig = getStatusConfig(quote.status);

  return (
    <Pressable style={styles.quoteCard} onPress={onPress}>
      <View style={styles.quoteHeader}>
        <View style={styles.quoteInfo}>
          <Text style={styles.quoteReference}>{quote.reference}</Text>
          <Text style={styles.quoteCustomer}>{quote.customer}</Text>
        </View>
        <View style={[styles.quoteStatus, { backgroundColor: statusConfig.color + '15' }]}>
          <Ionicons name={statusConfig.icon} size={14} color={statusConfig.color} />
          <Text style={[styles.quoteStatusText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      <Text style={styles.quoteTitle}>{quote.title}</Text>

      {/* Tier Preview */}
      <View style={styles.tierPreview}>
        {(['good', 'better', 'best'] as const).map((tier) => (
          <View
            key={tier}
            style={[
              styles.tierBadge,
              quote.selectedTier === tier && styles.tierBadgeSelected,
            ]}
          >
            <Text style={[
              styles.tierLabel,
              quote.selectedTier === tier && styles.tierLabelSelected,
            ]}>
              {tier}
            </Text>
            <Text style={[
              styles.tierPrice,
              quote.selectedTier === tier && styles.tierPriceSelected,
            ]}>
              €{quote.tiers[tier].toLocaleString()}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.quoteFooter}>
        <Text style={styles.quoteSentDate}>Verstuurd {quote.sentDate}</Text>
        <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
      </View>
    </Pressable>
  );
}

// ============================================
// MAIN SCREEN
// ============================================

type TabView = 'quotes' | 'payments';

export default function MoneyScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabView>('quotes');
  const [showQuoteBuilder, setShowQuoteBuilder] = useState(false);
  const [showPayments, setShowPayments] = useState(false);

  // Connect to cash flow service
  const { invoices, summary } = useCashFlow();

  // Transform invoices to quote format for display
  const quotes = useMemo((): Quote[] => {
    return invoices.map((inv): Quote => {
      // Map invoice status to quote status
      let status: QuoteStatus;
      switch (inv.status) {
        case 'draft': status = 'draft'; break;
        case 'sent': status = 'sent'; break;
        case 'viewed': status = 'viewed'; break;
        case 'paid': status = 'accepted'; break;
        case 'overdue': status = 'sent'; break; // Treat overdue as still pending
        case 'cancelled': status = 'expired'; break;
        default: status = 'sent';
      }

      // Generate tiers based on invoice amount
      const baseAmount = inv.amount;
      return {
        id: inv.id,
        reference: `Q-${inv.id.replace('inv_', '')}`,
        customer: inv.customerName,
        title: inv.projectName,
        status,
        sentDate: new Date(inv.issueDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }),
        total: baseAmount,
        tiers: {
          good: Math.round(baseAmount * 0.75),
          better: Math.round(baseAmount * 0.9),
          best: baseAmount,
        },
        selectedTier: status === 'accepted' ? 'best' : undefined,
        viewCount: status === 'viewed' ? 3 : undefined,
      };
    });
  }, [invoices]);

  const activeQuotes = quotes.filter(q => ['sent', 'viewed'].includes(q.status));
  const wonQuotes = quotes.filter(q => q.status === 'accepted');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Geld</Text>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.headerButton}
            onPress={() => setShowPayments(true)}
          >
            <Ionicons name="card-outline" size={22} color={SemanticColors.textPrimary} />
          </Pressable>
          <Pressable
            style={styles.addButton}
            onPress={() => setShowQuoteBuilder(true)}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* Summary */}
      <View style={styles.summarySection}>
        <SummaryCards summary={summary} invoices={invoices} />
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, activeTab === 'quotes' && styles.tabActive]}
          onPress={() => setActiveTab('quotes')}
        >
          <Text style={[styles.tabText, activeTab === 'quotes' && styles.tabTextActive]}>
            Actieve Offertes
          </Text>
          {activeQuotes.length > 0 && (
            <View style={[styles.tabBadge, activeTab === 'quotes' && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === 'quotes' && styles.tabBadgeTextActive]}>
                {activeQuotes.length}
              </Text>
            </View>
          )}
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'payments' && styles.tabActive]}
          onPress={() => setActiveTab('payments')}
        >
          <Text style={[styles.tabText, activeTab === 'payments' && styles.tabTextActive]}>
            Betaald / Geschiedenis
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'quotes' ? (
          <>
            {/* Upsell Stats */}
            <View style={styles.upsellStats}>
              <Ionicons name="trending-up" size={16} color={SemanticColors.feedbackSuccess} />
              <Text style={styles.upsellStatsText}>
                83% van klanten kiest voor Beter of Best opties
              </Text>
            </View>

            {activeQuotes.length > 0 ? (
              activeQuotes.map(quote => (
                <QuoteCard
                  key={quote.id}
                  quote={quote}
                  onPress={() => router.push(`/quotes/${quote.id}` as any)}
                />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={48} color={SemanticColors.textTertiary} />
                <Text style={styles.emptyStateTitle}>Geen actieve offertes</Text>
                <Text style={styles.emptyStateText}>
                  Maak een offerte om te beginnen
                </Text>
                <Pressable
                  style={styles.emptyStateButton}
                  onPress={() => setShowQuoteBuilder(true)}
                >
                  <Text style={styles.emptyStateButtonText}>Offerte Maken</Text>
                </Pressable>
              </View>
            )}
          </>
        ) : (
          <>
            {wonQuotes.map(quote => (
              <QuoteCard
                key={quote.id}
                quote={quote}
                onPress={() => router.push(`/quotes/${quote.id}` as any)}
              />
            ))}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Quote Builder Modal */}
      <Modal
        visible={showQuoteBuilder}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <TieredQuoteBuilder
          onSend={(quote) => {
            console.log('Quote sent:', quote);
            setShowQuoteBuilder(false);
          }}
          onClose={() => setShowQuoteBuilder(false)}
        />
      </Modal>

      {/* Payments Modal */}
      <Modal
        visible={showPayments}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <IntegratedPayments onClose={() => setShowPayments(false)} />
      </Modal>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.md,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Palette.hermesOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summarySection: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  summaryCards: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
  },
  summaryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.xs,
  },
  summaryCardLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
    fontWeight: '500',
  },
  summaryCardValue: {
    fontSize: 22,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  summaryCardMeta: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    gap: Spacing.sm,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 10,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  tabActive: {
    backgroundColor: Palette.hermesOrange,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  tabTextActive: {
    color: '#fff',
  },
  tabBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: SemanticColors.surfacePrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: SemanticColors.textSecondary,
  },
  tabBadgeTextActive: {
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  upsellStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: SemanticColors.feedbackSuccessBg,
    padding: Spacing.md,
    borderRadius: 10,
    marginBottom: Spacing.sm,
  },
  upsellStatsText: {
    fontSize: 13,
    color: SemanticColors.feedbackSuccess,
    fontWeight: '500',
  },
  quoteCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  quoteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  quoteInfo: {
    flex: 1,
  },
  quoteReference: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
    fontWeight: '500',
  },
  quoteCustomer: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginTop: 2,
  },
  quoteStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  quoteStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  quoteTitle: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  tierPreview: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  tierBadge: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 8,
  },
  tierBadgeSelected: {
    backgroundColor: Palette.hermesOrange + '15',
    borderWidth: 1,
    borderColor: Palette.hermesOrange,
  },
  tierLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
    textTransform: 'capitalize',
    fontWeight: '500',
  },
  tierLabelSelected: {
    color: Palette.hermesOrange,
  },
  tierPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  tierPriceSelected: {
    color: Palette.hermesOrange,
  },
  quoteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  quoteSentDate: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.sm,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  emptyStateText: {
    fontSize: 14,
    color: SemanticColors.textTertiary,
    textAlign: 'center',
  },
  emptyStateButton: {
    marginTop: Spacing.md,
    backgroundColor: Palette.hermesOrange,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: 10,
  },
  emptyStateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});

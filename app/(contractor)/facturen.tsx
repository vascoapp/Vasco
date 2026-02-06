// =============================================================================
// FACTUREN - Invoices & Quotes (Simplified)
// =============================================================================
// Clean invoice management with integrated financial auditing
// =============================================================================

import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';
import { TieredQuoteBuilder } from '../../src/components/contractor/TieredQuoteBuilder';
import { IntegratedPayments } from '../../src/components/contractor/IntegratedPayments';
import { useCashFlow, type Invoice } from '../../src/services/cashFlowService';
import { InlineInsight } from '../../src/components/shared/VascoInsightCard';
import { ContractorDashboardHeader } from '../../src/components/contractor/ContractorDashboardHeader';
import { useInlineInsight } from '../../src/services/vascoGuidanceService';

// Integrate financial auditor for invoice verification
import { useFinancialAuditFindings } from '../../src/services/financialAuditorService';
import { useSavingsAggregation } from '../../src/services/savingsAggregatorService';
import { useLaborCosts } from '../../src/services/laborCostService';

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

function InvoiceList({ invoices }: { invoices: Invoice[] }) {
  const getStatusConfig = (status: Invoice['status']) => {
    switch (status) {
      case 'paid':
        return { label: 'Betaald', color: SemanticColors.feedbackSuccess, icon: 'checkmark-circle' as IconName };
      case 'sent':
        return { label: 'Verzonden', color: SemanticColors.feedbackInfo, icon: 'paper-plane' as IconName };
      case 'viewed':
        return { label: 'Bekeken', color: Palette.hermesOrange, icon: 'eye' as IconName };
      case 'overdue':
        return { label: 'Verlopen', color: SemanticColors.feedbackError, icon: 'alert-circle' as IconName };
      default:
        return { label: 'Concept', color: SemanticColors.textTertiary, icon: 'document' as IconName };
    }
  };

  if (invoices.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="receipt-outline" size={40} color={SemanticColors.textTertiary} />
        <Text style={styles.emptyStateText}>Nog geen facturen</Text>
      </View>
    );
  }

  // Sort by date descending
  const sorted = [...invoices].sort((a, b) =>
    new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()
  );

  return (
    <View style={styles.invoiceList}>
      {sorted.map((invoice, index) => {
        const status = getStatusConfig(invoice.status);
        return (
          <Pressable
            key={invoice.id}
            style={[styles.invoiceItem, index < sorted.length - 1 && styles.invoiceItemBorder]}
          >
            <Ionicons name={status.icon} size={20} color={status.color} />
            <View style={styles.invoiceInfo}>
              <Text style={styles.invoiceCustomer} numberOfLines={1}>{invoice.customerName}</Text>
              <Text style={styles.invoiceProject} numberOfLines={1}>{invoice.projectName}</Text>
            </View>
            <View style={styles.invoiceRight}>
              <Text style={[
                styles.invoiceAmount,
                invoice.status === 'paid' && { color: SemanticColors.feedbackSuccess }
              ]}>
                €{invoice.amount.toLocaleString('nl-NL')}
              </Text>
              <Text style={[styles.invoiceStatus, { color: status.color }]}>{status.label}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function QuoteItem({ quote, onPress }: { quote: Quote; onPress: () => void }) {
  const getStatusConfig = (status: QuoteStatus) => {
    switch (status) {
      case 'viewed':
        return { label: 'Bekeken', color: Palette.hermesOrange };
      case 'accepted':
        return { label: 'Geaccepteerd', color: SemanticColors.feedbackSuccess };
      case 'rejected':
        return { label: 'Afgewezen', color: SemanticColors.feedbackError };
      default:
        return { label: 'Verstuurd', color: SemanticColors.feedbackInfo };
    }
  };

  const status = getStatusConfig(quote.status);

  return (
    <Pressable style={styles.quoteItem} onPress={onPress}>
      <View style={styles.quoteInfo}>
        <Text style={styles.quoteCustomer} numberOfLines={1}>{quote.customer}</Text>
        <Text style={styles.quoteTitle} numberOfLines={1}>{quote.title}</Text>
      </View>
      <View style={styles.quoteRight}>
        <Text style={styles.quoteAmount}>€{quote.total.toLocaleString('nl-NL')}</Text>
        <Text style={[styles.quoteStatus, { color: status.color }]}>{status.label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
    </Pressable>
  );
}

// ============================================
// MAIN SCREEN
// ============================================

type TabView = 'offertes' | 'facturen';

export default function FacturenScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabView>('offertes');
  const [showQuoteBuilder, setShowQuoteBuilder] = useState(false);
  const [showPayments, setShowPayments] = useState(false);

  // Connect to services
  const { invoices, summary } = useCashFlow();
  const { findings: auditFindings } = useFinancialAuditFindings();
  const inlineInsight = useInlineInsight('contractor', 'invoices', 'list');
  const savings = useSavingsAggregation();
  const labor = useLaborCosts();

  // Compute KPI values
  const pendingInvoices = invoices.filter(i => ['sent', 'viewed'].includes(i.status));
  const overdueInvoices = invoices.filter(i => i.status === 'overdue');
  const pendingValue = pendingInvoices.reduce((sum, i) => sum + i.amount, 0);
  const overdueValue = overdueInvoices.reduce((sum, i) => sum + i.amount, 0);

  // Transform invoices to quotes
  const quotes = useMemo((): Quote[] => {
    return invoices
      .filter(inv => ['sent', 'viewed', 'draft'].includes(inv.status))
      .map((inv): Quote => ({
        id: inv.id,
        reference: `Q-${inv.id.replace('inv_', '')}`,
        customer: inv.customerName,
        title: inv.projectName,
        status: inv.status === 'viewed' ? 'viewed' : inv.status === 'draft' ? 'draft' : 'sent',
        sentDate: new Date(inv.issueDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }),
        total: inv.amount,
        tiers: {
          good: Math.round(inv.amount * 0.75),
          better: Math.round(inv.amount * 0.9),
          best: inv.amount,
        },
      }));
  }, [invoices]);

  // Check for audit alerts
  const hasAuditAlert = auditFindings.some(f => f.severity === 'critical' && f.status === 'new');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Facturen</Text>
        <Pressable
          style={styles.addButton}
          onPress={() => setShowQuoteBuilder(true)}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      {/* KPI Header */}
      <View style={{ paddingHorizontal: Spacing.md, paddingTop: Spacing.xs }}>
        <ContractorDashboardHeader
          kpis={[
            { icon: 'receipt', value: `€${pendingValue.toLocaleString('nl-NL')}`, label: 'Openstaand' },
            { icon: 'alert-circle', value: overdueInvoices.length > 0 ? `€${overdueValue.toLocaleString('nl-NL')}` : '0', label: 'Verlopen', color: overdueInvoices.length > 0 ? SemanticColors.feedbackError : undefined },
            { icon: 'document-text', value: String(quotes.length), label: 'Offertes', color: Palette.hermesOrange },
          ]}
        />
      </View>

      {/* Audit Alert */}
      {hasAuditAlert && (
        <View style={styles.auditAlert}>
          <Ionicons name="alert-circle" size={16} color={SemanticColors.feedbackError} />
          <Text style={styles.auditAlertText}>
            Factuur discrepantie gedetecteerd
          </Text>
          <Pressable onPress={() => {
            const critical = auditFindings.find(f => f.severity === 'critical' && f.status === 'new');
            if (critical) {
              Alert.alert(
                'Factuur Discrepantie',
                `${critical.title}\n\n${critical.description}${critical.suggestedAction ? `\n\nAanbeveling: ${critical.suggestedAction.description}` : ''}`,
                [{ text: 'Sluiten' }]
              );
            }
          }}>
            <Text style={styles.auditAlertAction}>Bekijk</Text>
          </Pressable>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, activeTab === 'offertes' && styles.tabActive]}
          onPress={() => setActiveTab('offertes')}
        >
          <Text style={[styles.tabText, activeTab === 'offertes' && styles.tabTextActive]}>
            Offertes ({quotes.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'facturen' && styles.tabActive]}
          onPress={() => setActiveTab('facturen')}
        >
          <Text style={[styles.tabText, activeTab === 'facturen' && styles.tabTextActive]}>
            Alle Facturen
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'offertes' ? (
          quotes.length > 0 ? (
            <View style={styles.quotesList}>
              {quotes.map((quote, index) => (
                <QuoteItem
                  key={quote.id}
                  quote={quote}
                  onPress={() => router.push(`/quotes/${quote.id}` as any)}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={40} color={SemanticColors.textTertiary} />
              <Text style={styles.emptyStateText}>Geen actieve offertes</Text>
              <Pressable
                style={styles.emptyStateButton}
                onPress={() => setShowQuoteBuilder(true)}
              >
                <Text style={styles.emptyStateButtonText}>Nieuwe Offerte</Text>
              </Pressable>
            </View>
          )
        ) : (
          <InvoiceList invoices={invoices} />
        )}

        {/* AI Guidance */}
        {inlineInsight && (
          <InlineInsight
            icon={inlineInsight.icon as IconName}
            message={inlineInsight.message}
            actionLabel={inlineInsight.actionLabel}
            actionRoute={inlineInsight.actionRoute}
          />
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Pressable style={styles.quickAction} onPress={() => setShowPayments(true)}>
            <Ionicons name="card-outline" size={20} color={SemanticColors.textPrimary} />
            <Text style={styles.quickActionText}>Betalingen</Text>
          </Pressable>
          <Pressable style={styles.quickAction} onPress={() => setShowQuoteBuilder(true)}>
            <Ionicons name="layers-outline" size={20} color={SemanticColors.textPrimary} />
            <Text style={styles.quickActionText}>Smart Offerte</Text>
          </Pressable>
        </View>

        {/* Financial Intelligence Strip — from laborCostService + savingsAggregatorService */}
        <View style={styles.finIntelStrip}>
          <View style={styles.finIntelItem}>
            <Text style={styles.finIntelValue}>€{labor.effectiveRate}/u</Text>
            <Text style={styles.finIntelLabel}>Effectief tarief</Text>
            <View style={styles.finIntelBadge}>
              <Ionicons name="arrow-up" size={10} color={SemanticColors.feedbackSuccess} />
              <Text style={styles.finIntelBadgeText}>+{labor.rateVsBenchmark}% vs branche</Text>
            </View>
          </View>
          <View style={styles.finIntelDivider} />
          <View style={styles.finIntelItem}>
            <Text style={styles.finIntelValue}>€{savings.savingsPerJob}</Text>
            <Text style={styles.finIntelLabel}>Besparing per klus</Text>
            <View style={styles.finIntelBadge}>
              <Ionicons name="trending-up" size={10} color={SemanticColors.feedbackSuccess} />
              <Text style={styles.finIntelBadgeText}>+{savings.savingsVsBenchmark}% vs gem.</Text>
            </View>
          </View>
        </View>

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
            setShowQuoteBuilder(false);
            Alert.alert(
              'Offerte verstuurd',
              'Je offerte is succesvol aangemaakt en verstuurd naar de klant.',
            );
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
    paddingHorizontal: Spacing.md,
    paddingTop: 56,
    paddingBottom: Spacing.sm,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Palette.hermesOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Audit Alert
  auditAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    padding: Spacing.sm,
    backgroundColor: SemanticColors.feedbackErrorBg,
    borderRadius: 8,
  },
  auditAlertText: {
    flex: 1,
    fontSize: 13,
    color: SemanticColors.feedbackError,
  },
  auditAlertAction: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.feedbackError,
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
  },
  tab: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: Palette.hermesOrange,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  tabTextActive: {
    color: '#fff',
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    gap: Spacing.md,
  },

  // Quotes List
  quotesList: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    overflow: 'hidden',
  },
  quoteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderMuted,
  },
  quoteInfo: {
    flex: 1,
  },
  quoteCustomer: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  quoteTitle: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
    marginTop: 1,
  },
  quoteRight: {
    alignItems: 'flex-end',
  },
  quoteAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  quoteStatus: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },

  // Invoice List
  invoiceList: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    overflow: 'hidden',
  },
  invoiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  invoiceItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderMuted,
  },
  invoiceInfo: {
    flex: 1,
  },
  invoiceCustomer: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  invoiceProject: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
    marginTop: 1,
  },
  invoiceRight: {
    alignItems: 'flex-end',
  },
  invoiceAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  invoiceStatus: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyStateText: {
    fontSize: 14,
    color: SemanticColors.textTertiary,
  },
  emptyStateButton: {
    marginTop: Spacing.sm,
    backgroundColor: Palette.hermesOrange,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },

  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  quickAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },

  // Financial Intelligence Strip
  finIntelStrip: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    padding: Spacing.md,
  },
  finIntelItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  finIntelValue: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  finIntelLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  finIntelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: SemanticColors.feedbackSuccessBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  finIntelBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: SemanticColors.feedbackSuccess,
  },
  finIntelDivider: {
    width: 1,
    backgroundColor: SemanticColors.borderMuted,
    marginHorizontal: Spacing.sm,
  },
});

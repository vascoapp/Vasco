// =============================================================================
// FACTUREN - Invoices & Quotes (Simplified)
// =============================================================================
// Clean invoice management with integrated financial auditing
// =============================================================================

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Alert,
  RefreshControl,
  LayoutAnimation,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { TieredQuoteBuilder } from '../../src/components/contractor/TieredQuoteBuilder';
import { useCashFlow, type Invoice } from '../../src/services/cashFlowService';
import { ContractorDashboardHeader } from '../../src/components/contractor/ContractorDashboardHeader';

// Integrate financial auditor for invoice verification
import { useFinancialAuditFindings } from '../../src/services/financialAuditorService';
import { hapticSuccess } from '../../src/utils/haptics';
import { useSavingsAggregation } from '../../src/services/savingsAggregatorService';
import { useLaborCosts } from '../../src/services/laborCostService';

// P3: Collections Agent
import { useCollectionsAgent } from '../../src/services/collectionsAgentService';
import { recordScreenVisit } from '../../src/intelligence/learningStorage';
import type { DunningSequence as DunningSeqType } from '../../src/services/collectionsAgentService';

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

function InvoiceList({ invoices, expandedId, onToggleExpand }: { invoices: Invoice[]; expandedId: string | null; onToggleExpand: (id: string) => void }) {
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

  // Sort by to-do hierarchy: overdue first, then sent/viewed (actionable), then draft, then paid
  const statusPriority: Record<string, number> = {
    overdue: 0,
    sent: 1,
    viewed: 2,
    draft: 3,
    paid: 4,
  };
  const sorted = [...invoices].sort((a, b) => {
    const priorityDiff = (statusPriority[a.status] ?? 3) - (statusPriority[b.status] ?? 3);
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime();
  });

  return (
    <View style={styles.invoiceCardList}>
      {sorted.map((invoice) => {
        const status = getStatusConfig(invoice.status);
        const isExpanded = expandedId === invoice.id;
        const showActions = ['sent', 'viewed', 'overdue'].includes(invoice.status);
        return (
          <View key={invoice.id}>
            <Pressable
              style={styles.invoiceCard}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                onToggleExpand(isExpanded ? '' : invoice.id);
              }}
            >
              <View style={[styles.invoiceCardAccent, { backgroundColor: status.color }]} />
              <Ionicons name={status.icon} size={20} color={status.color} style={{ marginLeft: Spacing.sm }} />
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
            {isExpanded && showActions && (
              <View style={styles.invoiceActions}>
                <Pressable
                  style={styles.invoiceActionBtn}
                  onPress={() => {
                    hapticSuccess();
                    Alert.alert('Herinnering verstuurd', `Betaalherinnering verstuurd aan ${invoice.customerName}.`);
                  }}
                >
                  <Ionicons name="notifications-outline" size={16} color={Palette.hermesOrange} />
                  <Text style={styles.invoiceActionText}>Herinnering</Text>
                </Pressable>
                <Pressable
                  style={styles.invoiceActionBtn}
                  onPress={() => {
                    hapticSuccess();
                    Alert.alert('Betaallink', `Mollie betaallink aangemaakt voor €${invoice.amount.toLocaleString('nl-NL')}. Link gekopieerd naar klembord.`);
                  }}
                >
                  <Ionicons name="link-outline" size={16} color={Palette.hermesOrange} />
                  <Text style={styles.invoiceActionText}>Betaallink</Text>
                </Pressable>
                <Pressable
                  style={styles.invoiceActionBtn}
                  onPress={() => {
                    Linking.openURL('tel:+31600000000');
                  }}
                >
                  <Ionicons name="call-outline" size={16} color={Palette.hermesOrange} />
                  <Text style={styles.invoiceActionText}>Bel klant</Text>
                </Pressable>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function QuoteItem({ quote, onPress }: { quote: Quote; onPress: () => void }) {
  const getStatusConfig = (status: QuoteStatus) => {
    switch (status) {
      case 'viewed':
        return { label: 'Bekeken', color: Palette.hermesOrange, icon: 'eye' as IconName };
      case 'accepted':
        return { label: 'Geaccepteerd', color: SemanticColors.feedbackSuccess, icon: 'checkmark-circle' as IconName };
      case 'rejected':
        return { label: 'Afgewezen', color: SemanticColors.feedbackError, icon: 'close-circle' as IconName };
      default:
        return { label: 'Verstuurd', color: SemanticColors.feedbackInfo, icon: 'paper-plane' as IconName };
    }
  };

  const status = getStatusConfig(quote.status);

  return (
    <Pressable style={styles.quoteCard} onPress={onPress}>
      <View style={[styles.quoteCardAccent, { backgroundColor: status.color }]} />
      <Ionicons name={status.icon} size={20} color={status.color} style={{ marginLeft: Spacing.sm }} />
      <View style={styles.quoteInfo}>
        <Text style={styles.quoteCustomer} numberOfLines={1}>{quote.customer}</Text>
        <Text style={styles.quoteTitle} numberOfLines={1}>{quote.title}</Text>
      </View>
      <View style={styles.quoteRight}>
        <Text style={styles.quoteAmount}>€{quote.total.toLocaleString('nl-NL')}</Text>
        <Text style={[styles.quoteStatus, { color: status.color }]}>{status.label}</Text>
      </View>
    </Pressable>
  );
}

// ============================================
// MAIN SCREEN
// ============================================

type TabView = 'offertes' | 'facturen' | 'incasso';

export default function FacturenScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabView>('offertes');
  const [showQuoteBuilder, setShowQuoteBuilder] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [overdueDismissed, setOverdueDismissed] = useState(false);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // Screen visit tracking
  useEffect(() => { recordScreenVisit('invoices'); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      hapticSuccess();
    }, 800);
  }, []);

  // Connect to services
  const { invoices, summary } = useCashFlow();
  const { findings: auditFindings } = useFinancialAuditFindings();
  const savings = useSavingsAggregation();
  const labor = useLaborCosts();

  // P3: Collections Agent
  const { summary: collectionsSummary, sequences: dunningSequences, alerts: cashGapAlerts, dso } = useCollectionsAgent();

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
        <View>
          <Text style={styles.headerTitle}>Facturen</Text>
          <Text style={styles.headerSubtitle}>{invoices.length} facturen · {quotes.length} offertes</Text>
        </View>
        <Pressable
          style={styles.addButton}
          onPress={() => setShowQuoteBuilder(true)}
        >
          <Ionicons name="add" size={22} color={Palette.hermesOrange} />
        </Pressable>
      </View>

      {/* KPI Header */}
      <View style={{ paddingHorizontal: Spacing.md }}>
        <ContractorDashboardHeader
          kpis={[
            { icon: 'receipt', value: `€${pendingValue.toLocaleString('nl-NL')}`, label: 'Openstaand' },
            { icon: 'timer', value: `${dso.currentDSO}d`, label: 'DSO', color: dso.trend === 'worsening' ? SemanticColors.feedbackError : dso.trend === 'improving' ? SemanticColors.feedbackSuccess : undefined },
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

      {/* Sticky Overdue Banner */}
      {!overdueDismissed && overdueValue > 0 && (
        <View style={styles.stickyOverdueBanner}>
          <View style={styles.stickyOverdueLeft}>
            <Ionicons name="alert-circle" size={16} color="#DC2626" />
            <Text style={styles.stickyOverdueText}>
              {overdueInvoices.length} facturen verlopen · {'\u20AC'}{overdueValue.toLocaleString('nl-NL')}
            </Text>
          </View>
          <View style={styles.stickyOverdueActions}>
            <Pressable
              onPress={() => {
                setActiveTab('facturen');
                hapticSuccess();
              }}
            >
              <Text style={styles.stickyOverdueAction}>Bekijk</Text>
            </Pressable>
            <Pressable onPress={() => setOverdueDismissed(true)}>
              <Ionicons name="close" size={16} color="#DC2626" />
            </Pressable>
          </View>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, activeTab === 'offertes' && styles.tabActive]}
          onPress={() => setActiveTab('offertes')}
        >
          <Text style={[styles.tabText, activeTab === 'offertes' && styles.tabTextActive]}>
            Offertes
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'facturen' && styles.tabActive]}
          onPress={() => setActiveTab('facturen')}
        >
          <Text style={[styles.tabText, activeTab === 'facturen' && styles.tabTextActive]}>
            Facturen
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'incasso' && styles.tabActive]}
          onPress={() => setActiveTab('incasso')}
        >
          <Text style={[styles.tabText, activeTab === 'incasso' && styles.tabTextActive]}>
            Incasso
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.hermesOrange} />
        }
      >
        {activeTab === 'offertes' ? (
          <View style={{ gap: Spacing.sm }}>
            {quotes.length > 0 ? (
              <View style={styles.quoteCardList}>
                {quotes.map((quote) => (
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
              </View>
            )}

            {/* Nieuwe Offerte banner */}
            <Pressable
              style={styles.nieuweOfferteBanner}
              onPress={() => setShowQuoteBuilder(true)}
            >
              <Ionicons name="add-circle" size={22} color="#fff" />
              <View style={{ flex: 1 }}>
                <Text style={styles.nieuweOfferteBannerTitle} numberOfLines={1}>Nieuwe Offerte</Text>
                <Text style={styles.nieuweOfferteBannerSub} numberOfLines={1}>Maak een Smart Offerte met Vasco AI</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#fff" />
            </Pressable>
          </View>
        ) : activeTab === 'facturen' ? (
          <View style={{ gap: Spacing.xs }}>
            <InvoiceList invoices={invoices} expandedId={expandedInvoiceId} onToggleExpand={setExpandedInvoiceId} />

            {/* Verlopen banner — below invoices */}
            {overdueValue > 0 && (
              <Pressable
                style={styles.overdueBanner}
                onPress={() => {
                  Alert.alert(
                    'Herinneringen versturen',
                    `Vasco stuurt automatische herinneringen voor ${overdueInvoices.length} verlopen facturen (\u20AC${overdueValue.toLocaleString('nl-NL')}).`,
                    [
                      { text: 'Annuleren', style: 'cancel' },
                      { text: 'Versturen', onPress: () => Alert.alert('Verstuurd', 'Herinneringen zijn verstuurd naar alle klanten met verlopen facturen.') },
                    ]
                  );
                }}
              >
                <Ionicons name="notifications" size={22} color="#fff" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.overdueBannerTitle} numberOfLines={1}>Stuur Herinnering</Text>
                  <Text style={styles.overdueBannerSub} numberOfLines={1}>
                    {'\u20AC'}{overdueValue.toLocaleString('nl-NL')} verlopen · {overdueInvoices.length} facturen
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#fff" />
              </Pressable>
            )}
          </View>
        ) : (
          /* Incasso tab (P3) */
          <View style={{ gap: Spacing.md }}>
            {/* DSO Card */}
            <View style={styles.dsoCard}>
              <View style={styles.dsoMain}>
                <Text style={styles.dsoValue}>{dso.currentDSO}d</Text>
                <Text style={styles.dsoLabel}>Days Sales Outstanding</Text>
              </View>
              <View style={styles.dsoDetails}>
                <View style={styles.dsoDetailItem}>
                  <Text style={styles.dsoDetailLabel}>Doel</Text>
                  <Text style={styles.dsoDetailValue}>{dso.targetDSO}d</Text>
                </View>
                <View style={styles.dsoDetailItem}>
                  <Text style={styles.dsoDetailLabel}>Vorige</Text>
                  <Text style={styles.dsoDetailValue}>{dso.previousDSO}d</Text>
                </View>
                <View style={styles.dsoDetailItem}>
                  <Text style={styles.dsoDetailLabel}>Branche</Text>
                  <Text style={styles.dsoDetailValue}>{dso.industryAverage}d</Text>
                </View>
              </View>
            </View>

            {/* Dunning Sequences */}
            <View style={{ gap: Spacing.xs }}>
              <Text style={styles.incassoSectionTitle}>Dunning Sequences</Text>
              {dunningSequences.map((seq: DunningSeqType) => {
                const stepColors: Record<string, string> = {
                  vriendelijk: '#3B82F6',
                  herinnering: '#F59E0B',
                  urgent: '#DC2626',
                  aanmaning: '#DC2626',
                  incasso: Palette.hermesOrange,
                };
                return (
                  <View key={seq.id} style={styles.dunningCard}>
                    <View style={styles.dunningHeader}>
                      <Text style={styles.dunningCustomer} numberOfLines={1}>{seq.customerName}</Text>
                      <Text style={styles.dunningAmount}>{'\u20AC'}{seq.invoiceAmount.toLocaleString('nl-NL')}</Text>
                    </View>
                    <View style={styles.dunningMeta}>
                      <View style={[styles.dunningStepBadge, { backgroundColor: (stepColors[seq.currentStep] || '#999') + '14' }]}>
                        <Text style={[styles.dunningStepText, { color: stepColors[seq.currentStep] || '#999' }]} numberOfLines={1}>
                          {seq.currentStep.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.dunningDays}>{seq.daysOverdue} dagen verlopen</Text>
                      {seq.autoSendEnabled && (
                        <View style={styles.dunningAutoTag}>
                          <Ionicons name="flash" size={10} color={SemanticColors.feedbackSuccess} />
                          <Text style={styles.dunningAutoText}>Auto</Text>
                        </View>
                      )}
                    </View>
                    {/* Step progress */}
                    <View style={styles.dunningSteps}>
                      {seq.steps.map((step, idx) => (
                        <View key={idx} style={styles.dunningStepDot}>
                          <View style={[
                            styles.dunningDot,
                            { backgroundColor: step.status === 'sent' ? '#16A34A' : step.status === 'pending' ? '#E0E0E0' : '#999' }
                          ]} />
                        </View>
                      ))}
                    </View>
                    <Pressable
                      style={styles.dunningAction}
                      onPress={() => Alert.alert('Verstuurd', `Herinnering verstuurd naar ${seq.customerName}.`)}
                    >
                      <Text style={styles.dunningActionText} numberOfLines={1}>Verstuur nu</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>

            {/* Cash Gap Alerts */}
            {cashGapAlerts.length > 0 && (
              <View style={{ gap: Spacing.xs }}>
                <Text style={styles.incassoSectionTitle}>Cash Gap Alerts</Text>
                {cashGapAlerts.map((alert) => (
                  <View key={alert.id} style={[styles.cashGapCard, {
                    borderLeftColor: alert.severity === 'kritiek' ? '#DC2626' : '#F59E0B',
                  }]}>
                    <Ionicons
                      name={alert.severity === 'kritiek' ? 'alert-circle' : 'warning'}
                      size={18}
                      color={alert.severity === 'kritiek' ? '#DC2626' : '#F59E0B'}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cashGapTitle} numberOfLines={1}>{alert.title}</Text>
                      <Text style={styles.cashGapDesc} numberOfLines={2}>{alert.description}</Text>
                    </View>
                    <Text style={[styles.cashGapAmount, {
                      color: alert.severity === 'kritiek' ? '#DC2626' : '#F59E0B',
                    }]}>{'\u20AC'}{alert.gapAmount.toLocaleString('nl-NL')}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Financial Intelligence Strip — offertes/facturen tabs only */}
        {activeTab !== 'incasso' && (
          <View style={styles.finIntelStrip}>
            <View style={styles.finIntelItem}>
              <Text style={styles.finIntelValue}>{'\u20AC'}{labor.effectiveRate}/u</Text>
              <Text style={styles.finIntelLabel}>Effectief tarief</Text>
              <View style={styles.finIntelBadge}>
                <Ionicons name="arrow-up" size={10} color={SemanticColors.feedbackSuccess} />
                <Text style={styles.finIntelBadgeText}>+{labor.rateVsBenchmark}%</Text>
              </View>
            </View>
            <View style={styles.finIntelDivider} />
            <View style={styles.finIntelItem}>
              <Text style={styles.finIntelValue}>{'\u20AC'}{savings.savingsPerJob}</Text>
              <Text style={styles.finIntelLabel}>Besparing/klus</Text>
              <View style={styles.finIntelBadge}>
                <Ionicons name="trending-up" size={10} color={SemanticColors.feedbackSuccess} />
                <Text style={styles.finIntelBadgeText}>+{savings.savingsVsBenchmark}%</Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 20 }} />
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

    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SafeArea.side,
    paddingTop: SafeArea.top,
    paddingBottom: Spacing.sm,
    backgroundColor: '#FAFAF8',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 2,
    fontWeight: '500',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: Palette.hermesOrange + '0A',
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
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    gap: 6,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: Palette.hermesOrange,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
  },
  tabTextActive: {
    color: '#fff',
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SafeArea.content,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },

  // Quote Cards (matching invoice card style)
  quoteCardList: {
    gap: 6,
  },
  quoteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingRight: Spacing.sm,
    paddingLeft: 0,
    gap: Spacing.sm,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  quoteCardAccent: {
    width: 3,
    alignSelf: 'stretch',
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
    fontVariant: ['tabular-nums'] as any,
  },
  quoteStatus: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },

  // Invoice Cards
  invoiceCardList: {
    gap: 6,
  },
  invoiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingRight: Spacing.sm,
    paddingLeft: 0,
    gap: Spacing.sm,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  invoiceCardAccent: {
    width: 3,
    alignSelf: 'stretch',
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
    fontVariant: ['tabular-nums'] as any,
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

  // Financial Intelligence Strip
  finIntelStrip: {
    flexDirection: 'row',
    backgroundColor: Palette.hermesOrange + '08',
    borderRadius: 14,
    padding: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Palette.hermesOrange,
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
    fontVariant: ['tabular-nums'] as any,
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
    marginHorizontal: Spacing.xs,
  },

  // Incasso Tab Content (P3)
  dsoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: Spacing.md,
  },
  dsoMain: {
    alignItems: 'center',
    gap: 4,
  },
  dsoValue: {
    fontSize: 36,
    fontWeight: '800',
    color: Palette.hermesOrange,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'] as any,
  },
  dsoLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    fontWeight: '500',
  },
  dsoDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  dsoDetailItem: {
    alignItems: 'center',
    gap: 2,
  },
  dsoDetailLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  dsoDetailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    fontVariant: ['tabular-nums'] as any,
  },
  incassoSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: SemanticColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.xs,
  },
  dunningCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: Spacing.md,
    gap: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  dunningHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dunningCustomer: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  dunningAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    fontVariant: ['tabular-nums'] as any,
  },
  dunningMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dunningStepBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dunningStepText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  dunningDays: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
  },
  dunningAutoTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: SemanticColors.feedbackSuccessBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dunningAutoText: {
    fontSize: 10,
    fontWeight: '600',
    color: SemanticColors.feedbackSuccess,
  },
  dunningSteps: {
    flexDirection: 'row',
    gap: 6,
  },
  dunningStepDot: {
    alignItems: 'center',
  },
  dunningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dunningAction: {
    alignItems: 'center',
    backgroundColor: Palette.hermesOrange + '10',
    paddingVertical: 8,
    borderRadius: 8,
  },
  dunningActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Palette.hermesOrange,
  },
  cashGapCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: Spacing.md,
    borderLeftWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cashGapTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  cashGapDesc: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  cashGapAmount: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'] as any,
  },

  // Nieuwe Offerte banner
  nieuweOfferteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Palette.hermesOrange,
    borderRadius: 14,
    padding: Spacing.md,
    paddingVertical: 16,
  },
  nieuweOfferteBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  nieuweOfferteBannerSub: {
    fontSize: 12,
    color: '#ffffffCC',
    marginTop: 2,
  },

  // Sticky Overdue Banner
  stickyOverdueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: '#DC262610',
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#DC2626',
  },
  stickyOverdueLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  stickyOverdueText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
    fontVariant: ['tabular-nums'] as any,
  },
  stickyOverdueActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  stickyOverdueAction: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },

  // Invoice Quick Actions
  invoiceActions: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.xs,
    marginTop: -4,
  },
  invoiceActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    backgroundColor: Palette.hermesOrange + '0A',
    borderRadius: 8,
  },
  invoiceActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: Palette.hermesOrange,
  },

  // Overdue banner (matching Nieuwe Offerte style)
  overdueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Palette.hermesOrange,
    borderRadius: 14,
    padding: Spacing.md,
    paddingVertical: 16,
  },
  overdueBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  overdueBannerSub: {
    fontSize: 12,
    color: '#ffffffCC',
    marginTop: 2,
  },
});

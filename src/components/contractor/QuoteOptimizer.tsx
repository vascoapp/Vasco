// =============================================================================
// QUOTE OPTIMIZER COMPONENT
// =============================================================================
// Enhances quote creation with market intelligence
// Shows optimization suggestions, competitive positioning, and upsell opportunities
// =============================================================================

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors } from '../../theme/colors';
import {
  useQuoteOptimizer,
  useRegionalBenchmarks,
  QuoteLineItem,
  QuoteOptimization,
  UpsellSuggestion,
  MarketPriceData,
} from '../../services/quoteOptimizerService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// TYPES
// ============================================

interface QuoteOptimizerProps {
  quoteId: string;
  lineItems: QuoteLineItem[];
  onApplyOptimization?: (optimization: QuoteOptimization) => void;
  onApplyUpsell?: (upsell: UpsellSuggestion) => void;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function QuoteOptimizer({
  quoteId,
  lineItems,
  onApplyOptimization,
  onApplyUpsell,
}: QuoteOptimizerProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'optimize' | 'upsell' | 'market'>('overview');
  const [selectedOptimization, setSelectedOptimization] = useState<QuoteOptimization | null>(null);
  const [selectedUpsell, setSelectedUpsell] = useState<UpsellSuggestion | null>(null);

  const {
    analysis,
    isAnalyzing,
    applyOptimization,
    rejectOptimization,
    applyUpsell,
    pendingOptimizations,
    statistics,
  } = useQuoteOptimizer(quoteId, lineItems);

  const tabs = [
    { key: 'overview' as const, label: 'Overzicht', icon: 'analytics-outline' as const },
    { key: 'optimize' as const, label: 'Optimalisaties', icon: 'flash-outline' as const },
    { key: 'upsell' as const, label: 'Upsells', icon: 'trending-up-outline' as const },
    { key: 'market' as const, label: 'Markt', icon: 'globe-outline' as const },
  ];

  if (isAnalyzing) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="analytics" size={48} color={SemanticColors.actionPrimary} />
        <Text style={styles.loadingText}>Offerte analyseren...</Text>
        <Text style={styles.loadingSubtext}>
          Marktdata, concurrentie en optimalisaties worden berekend
        </Text>
      </View>
    );
  }

  if (!analysis) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="document-text-outline" size={48} color={SemanticColors.textSecondary} />
        <Text style={styles.emptyText}>Voeg items toe om te optimaliseren</Text>
      </View>
    );
  }

  const handleApplyOptimization = (opt: QuoteOptimization) => {
    const optId = `${opt.lineItemId}_${opt.type}`;
    applyOptimization(optId);
    onApplyOptimization?.(opt);
    setSelectedOptimization(null);
  };

  const handleRejectOptimization = (opt: QuoteOptimization, reason?: string) => {
    const optId = `${opt.lineItemId}_${opt.type}`;
    rejectOptimization(optId, reason);
    setSelectedOptimization(null);
  };

  const handleApplyUpsell = (upsell: UpsellSuggestion) => {
    applyUpsell(upsell.id);
    onApplyUpsell?.(upsell);
    setSelectedUpsell(null);
  };

  return (
    <View style={styles.container}>
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon}
              size={20}
              color={activeTab === tab.key ? SemanticColors.actionPrimary : SemanticColors.textSecondary}
            />
            <Text
              style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}
            >
              {tab.label}
            </Text>
            {tab.key === 'optimize' && pendingOptimizations.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingOptimizations.length}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {/* Tab Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'overview' && (
          <OverviewTab analysis={analysis} statistics={statistics} />
        )}
        {activeTab === 'optimize' && (
          <OptimizeTab
            optimizations={analysis.optimizations}
            onSelect={setSelectedOptimization}
          />
        )}
        {activeTab === 'upsell' && (
          <UpsellTab
            suggestions={analysis.upsellSuggestions}
            onSelect={setSelectedUpsell}
          />
        )}
        {activeTab === 'market' && (
          <MarketTab marketData={analysis.marketData} />
        )}
      </ScrollView>

      {/* Optimization Detail Modal */}
      <Modal
        visible={!!selectedOptimization}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedOptimization(null)}
      >
        {selectedOptimization && (
          <OptimizationDetailModal
            optimization={selectedOptimization}
            onApply={() => handleApplyOptimization(selectedOptimization)}
            onReject={(reason) => handleRejectOptimization(selectedOptimization, reason)}
            onClose={() => setSelectedOptimization(null)}
          />
        )}
      </Modal>

      {/* Upsell Detail Modal */}
      <Modal
        visible={!!selectedUpsell}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedUpsell(null)}
      >
        {selectedUpsell && (
          <UpsellDetailModal
            upsell={selectedUpsell}
            onApply={() => handleApplyUpsell(selectedUpsell)}
            onClose={() => setSelectedUpsell(null)}
          />
        )}
      </Modal>
    </View>
  );
}

// ============================================
// TAB COMPONENTS
// ============================================

function OverviewTab({
  analysis,
  statistics,
}: {
  analysis: NonNullable<ReturnType<typeof useQuoteOptimizer>['analysis']>;
  statistics: ReturnType<typeof useQuoteOptimizer>['statistics'];
}) {
  const getScoreColor = (score: number) => {
    if (score >= 70) return SemanticColors.feedbackSuccess;
    if (score >= 50) return SemanticColors.feedbackWarning;
    return SemanticColors.feedbackError;
  };

  const getWinProbabilityLabel = (prob: number) => {
    if (prob >= 0.7) return 'Hoog';
    if (prob >= 0.5) return 'Gemiddeld';
    return 'Laag';
  };

  return (
    <View style={styles.tabContent}>
      {/* Score Cards */}
      <View style={styles.scoreCardsRow}>
        <View style={styles.scoreCard}>
          <View style={[styles.scoreCircle, { borderColor: getScoreColor(analysis.competitiveScore) }]}>
            <Text style={[styles.scoreValue, { color: getScoreColor(analysis.competitiveScore) }]}>
              {analysis.competitiveScore}
            </Text>
          </View>
          <Text style={styles.scoreLabel}>Concurrentiescore</Text>
        </View>

        <View style={styles.scoreCard}>
          <View style={[styles.scoreCircle, { borderColor: getScoreColor(analysis.winProbability * 100) }]}>
            <Text style={[styles.scoreValue, { color: getScoreColor(analysis.winProbability * 100) }]}>
              {Math.round(analysis.winProbability * 100)}%
            </Text>
          </View>
          <Text style={styles.scoreLabel}>Winkans</Text>
          <Text style={styles.scoreSubtext}>
            {getWinProbabilityLabel(analysis.winProbability)}
          </Text>
        </View>
      </View>

      {/* Summary Stats */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Offerte Samenvatting</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Totale waarde</Text>
          <Text style={styles.summaryValue}>
            €{analysis.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Geschatte marge</Text>
          <Text style={styles.summaryValue}>
            €{analysis.estimatedMargin.toFixed(2)} ({analysis.marginPercent}%)
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Optimalisaties beschikbaar</Text>
          <Text style={[styles.summaryValue, { color: SemanticColors.actionPrimary }]}>
            {analysis.summary.suggestedAdjustments}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Potentiële extra marge</Text>
          <Text style={[styles.summaryValue, { color: SemanticColors.feedbackSuccess }]}>
            +€{analysis.summary.potentialMarginGain.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Historical Performance */}
      <View style={styles.historyCard}>
        <View style={styles.historyHeader}>
          <Ionicons name="trending-up" size={24} color={SemanticColors.feedbackSuccess} />
          <Text style={styles.historyTitle}>Jouw Prestaties</Text>
        </View>
        <Text style={styles.historySubtitle}>
          Gebaseerd op {statistics.quotesAnalyzed} geanalyseerde offertes
        </Text>
        <View style={styles.historyStats}>
          <View style={styles.historyStat}>
            <Text style={styles.historyStatValue}>{statistics.optimizationsApplied}</Text>
            <Text style={styles.historyStatLabel}>Optimalisaties toegepast</Text>
          </View>
          <View style={styles.historyStat}>
            <Text style={[styles.historyStatValue, { color: SemanticColors.feedbackSuccess }]}>
              €{statistics.totalSavingsGenerated.toLocaleString(undefined)}
            </Text>
            <Text style={styles.historyStatLabel}>Extra marge gegenereerd</Text>
          </View>
          <View style={styles.historyStat}>
            <Text style={[styles.historyStatValue, { color: SemanticColors.actionPrimary }]}>
              +{statistics.avgWinRateImprovement}%
            </Text>
            <Text style={styles.historyStatLabel}>Winkans verbetering</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function OptimizeTab({
  optimizations,
  onSelect,
}: {
  optimizations: QuoteOptimization[];
  onSelect: (opt: QuoteOptimization) => void;
}) {
  const pending = optimizations.filter((o) => o.accepted === undefined);
  const applied = optimizations.filter((o) => o.accepted === true);
  const rejected = optimizations.filter((o) => o.accepted === false);

  const getTypeIcon = (type: QuoteOptimization['type']): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'price_adjustment':
        return 'pricetag-outline';
      case 'competitive_positioning':
        return 'podium-outline';
      case 'margin_warning':
        return 'alert-circle-outline';
      case 'upsell':
        return 'trending-up-outline';
      case 'bundle':
        return 'cube-outline';
      default:
        return 'flash-outline';
    }
  };

  const getTypeColor = (type: QuoteOptimization['type']) => {
    switch (type) {
      case 'price_adjustment':
        return SemanticColors.actionPrimary;
      case 'competitive_positioning':
        return '#FF9500';
      case 'margin_warning':
        return SemanticColors.feedbackError;
      default:
        return SemanticColors.feedbackSuccess;
    }
  };

  if (optimizations.length === 0) {
    return (
      <View style={styles.emptyTab}>
        <Ionicons name="checkmark-circle" size={48} color={SemanticColors.feedbackSuccess} />
        <Text style={styles.emptyTabTitle}>Offerte ziet er goed uit!</Text>
        <Text style={styles.emptyTabText}>
          Er zijn geen optimalisaties gevonden voor deze offerte.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      {pending.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>
            Aanbevelingen ({pending.length})
          </Text>
          {pending.map((opt) => (
            <Pressable
              key={`${opt.lineItemId}_${opt.type}`}
              style={styles.optimizationCard}
              onPress={() => onSelect(opt)}
            >
              <View style={[styles.optIcon, { backgroundColor: getTypeColor(opt.type) + '20' }]}>
                <Ionicons name={getTypeIcon(opt.type)} size={24} color={getTypeColor(opt.type)} />
              </View>
              <View style={styles.optContent}>
                <Text style={styles.optTitle}>{opt.title}</Text>
                <Text style={styles.optDescription} numberOfLines={2}>
                  {opt.description}
                </Text>
                <View style={styles.optMeta}>
                  <View style={styles.confidenceBadge}>
                    <Text style={styles.confidenceText}>
                      {Math.round(opt.confidence * 100)}% zekerheid
                    </Text>
                  </View>
                  {opt.impact.difference !== 0 && (
                    <Text
                      style={[
                        styles.impactText,
                        { color: opt.impact.difference > 0 ? SemanticColors.feedbackError : SemanticColors.feedbackSuccess },
                      ]}
                    >
                      {opt.impact.difference > 0 ? '+' : ''}€{opt.impact.difference.toFixed(2)}
                    </Text>
                  )}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={SemanticColors.textSecondary} />
            </Pressable>
          ))}
        </>
      )}

      {applied.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Toegepast ({applied.length})</Text>
          {applied.map((opt) => (
            <View
              key={`${opt.lineItemId}_${opt.type}_applied`}
              style={[styles.optimizationCard, styles.optimizationApplied]}
            >
              <Ionicons name="checkmark-circle" size={24} color={SemanticColors.feedbackSuccess} />
              <View style={styles.optContent}>
                <Text style={styles.optTitle}>{opt.title}</Text>
              </View>
            </View>
          ))}
        </>
      )}

      {rejected.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Afgewezen ({rejected.length})</Text>
          {rejected.map((opt) => (
            <View
              key={`${opt.lineItemId}_${opt.type}_rejected`}
              style={[styles.optimizationCard, styles.optimizationRejected]}
            >
              <Ionicons name="close-circle" size={24} color={SemanticColors.textSecondary} />
              <View style={styles.optContent}>
                <Text style={[styles.optTitle, { color: SemanticColors.textSecondary }]}>
                  {opt.title}
                </Text>
              </View>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

function UpsellTab({
  suggestions,
  onSelect,
}: {
  suggestions: UpsellSuggestion[];
  onSelect: (upsell: UpsellSuggestion) => void;
}) {
  const getTypeLabel = (type: UpsellSuggestion['type']) => {
    switch (type) {
      case 'upgrade':
        return 'Upgrade';
      case 'add_on':
        return 'Add-on';
      case 'bundle':
        return 'Bundel';
      case 'premium_alternative':
        return 'Premium';
      default:
        return 'Suggestie';
    }
  };

  const getTypeColor = (type: UpsellSuggestion['type']) => {
    switch (type) {
      case 'upgrade':
        return SemanticColors.actionPrimary;
      case 'add_on':
        return SemanticColors.feedbackSuccess;
      case 'bundle':
        return '#FF9500';
      case 'premium_alternative':
        return '#AF52DE';
      default:
        return SemanticColors.textSecondary;
    }
  };

  if (suggestions.length === 0) {
    return (
      <View style={styles.emptyTab}>
        <Ionicons name="gift-outline" size={48} color={SemanticColors.textSecondary} />
        <Text style={styles.emptyTabTitle}>Geen upsells gevonden</Text>
        <Text style={styles.emptyTabText}>
          Op basis van klantgegevens zijn er momenteel geen upsell-mogelijkheden.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Upsell Mogelijkheden</Text>
      <Text style={styles.sectionSubtitle}>
        Gebaseerd op klantvoorkeuren en projecttype
      </Text>

      {suggestions.map((upsell) => (
        <Pressable
          key={upsell.id}
          style={styles.upsellCard}
          onPress={() => onSelect(upsell)}
        >
          <View style={styles.upsellHeader}>
            <View style={[styles.typeBadge, { backgroundColor: getTypeColor(upsell.type) + '20' }]}>
              <Text style={[styles.typeBadgeText, { color: getTypeColor(upsell.type) }]}>
                {getTypeLabel(upsell.type)}
              </Text>
            </View>
            <Text style={styles.acceptanceRate}>
              {Math.round(upsell.customerAcceptanceRate * 100)}% acceptatie
            </Text>
          </View>
          <Text style={styles.upsellName}>{upsell.productName}</Text>
          <Text style={styles.upsellDescription}>{upsell.description}</Text>
          <View style={styles.upsellFooter}>
            <View style={styles.upsellStat}>
              <Text style={styles.upsellStatLabel}>Extra omzet</Text>
              <Text style={styles.upsellStatValue}>+€{upsell.priceIncrease.toFixed(2)}</Text>
            </View>
            <View style={styles.upsellStat}>
              <Text style={styles.upsellStatLabel}>Extra marge</Text>
              <Text style={[styles.upsellStatValue, { color: SemanticColors.feedbackSuccess }]}>
                +€{upsell.marginIncrease.toFixed(2)}
              </Text>
            </View>
          </View>
          <View style={styles.upsellReason}>
            <Ionicons name="bulb-outline" size={16} color={SemanticColors.actionPrimary} />
            <Text style={styles.upsellReasonText}>{upsell.reason}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function MarketTab({ marketData }: { marketData: MarketPriceData[] }) {
  const getPricePositionColor = (percentile: number) => {
    if (percentile <= 30) return SemanticColors.feedbackSuccess;
    if (percentile <= 70) return SemanticColors.feedbackWarning;
    return SemanticColors.feedbackError;
  };

  const getTrendIcon = (trend: MarketPriceData['trend']): keyof typeof Ionicons.glyphMap => {
    switch (trend) {
      case 'rising':
        return 'trending-up';
      case 'falling':
        return 'trending-down';
      default:
        return 'remove';
    }
  };

  const getTrendColor = (trend: MarketPriceData['trend']) => {
    switch (trend) {
      case 'rising':
        return SemanticColors.feedbackError;
      case 'falling':
        return SemanticColors.feedbackSuccess;
      default:
        return SemanticColors.textSecondary;
    }
  };

  if (marketData.length === 0) {
    return (
      <View style={styles.emptyTab}>
        <Ionicons name="globe-outline" size={48} color={SemanticColors.textSecondary} />
        <Text style={styles.emptyTabTitle}>Geen marktdata</Text>
        <Text style={styles.emptyTabText}>
          Er is nog geen marktdata beschikbaar voor deze producten.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Marktpositie per Product</Text>
      <Text style={styles.sectionSubtitle}>
        Vergelijking met regionale prijzen
      </Text>

      {marketData.map((data) => (
        <View key={data.materialId} style={styles.marketCard}>
          <View style={styles.marketHeader}>
            <Text style={styles.marketName} numberOfLines={1}>
              {data.materialName}
            </Text>
            <View style={styles.trendBadge}>
              <Ionicons
                name={getTrendIcon(data.trend)}
                size={16}
                color={getTrendColor(data.trend)}
              />
              {data.trendPercent !== 0 && (
                <Text style={[styles.trendText, { color: getTrendColor(data.trend) }]}>
                  {data.trendPercent > 0 ? '+' : ''}{data.trendPercent}%
                </Text>
              )}
            </View>
          </View>

          {/* Price Range Bar */}
          <View style={styles.priceRangeContainer}>
            <View style={styles.priceRange}>
              <View
                style={[
                  styles.pricePosition,
                  {
                    left: `${data.percentile}%`,
                    backgroundColor: getPricePositionColor(data.percentile),
                  },
                ]}
              />
            </View>
            <View style={styles.priceLabels}>
              <Text style={styles.priceLabel}>€{data.regionLowPrice.toFixed(2)}</Text>
              <Text style={[styles.priceLabel, { color: getPricePositionColor(data.percentile) }]}>
                Jouw prijs: percentiel {data.percentile}
              </Text>
              <Text style={styles.priceLabel}>€{data.regionHighPrice.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.marketStats}>
            <View style={styles.marketStat}>
              <Text style={styles.marketStatLabel}>Gemiddeld</Text>
              <Text style={styles.marketStatValue}>€{data.regionAvgPrice.toFixed(2)}</Text>
            </View>
            <View style={styles.marketStat}>
              <Text style={styles.marketStatLabel}>Categorie</Text>
              <Text style={styles.marketStatValue}>{data.category}</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

// ============================================
// MODAL COMPONENTS
// ============================================

function OptimizationDetailModal({
  optimization,
  onApply,
  onReject,
  onClose,
}: {
  optimization: QuoteOptimization;
  onApply: () => void;
  onReject: (reason?: string) => void;
  onClose: () => void;
}) {
  const getSourceLabel = (source: QuoteOptimization['source']) => {
    switch (source) {
      case 'market_data':
        return 'Marktdata';
      case 'customer_history':
        return 'Klantgeschiedenis';
      case 'regional_trends':
        return 'Regionale trends';
      case 'competitor_analysis':
        return 'Concurrentieanalyse';
      default:
        return 'Analyse';
    }
  };

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{optimization.title}</Text>
          <Pressable onPress={onClose} style={styles.modalClose}>
            <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
          </Pressable>
        </View>

        <ScrollView style={styles.modalBody}>
          <Text style={styles.modalDescription}>{optimization.description}</Text>

          <View style={styles.modalSection}>
            <Text style={styles.modalSectionTitle}>Impact</Text>
            <View style={styles.impactRow}>
              <View style={styles.impactItem}>
                <Text style={styles.impactLabel}>Huidige waarde</Text>
                <Text style={styles.impactValue}>
                  €{optimization.impact.currentValue.toFixed(2)}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color={SemanticColors.textSecondary} />
              <View style={styles.impactItem}>
                <Text style={styles.impactLabel}>Voorgesteld</Text>
                <Text style={[styles.impactValue, { color: SemanticColors.actionPrimary }]}>
                  €{optimization.impact.suggestedValue.toFixed(2)}
                </Text>
              </View>
            </View>
            <View style={styles.differenceBox}>
              <Text style={styles.differenceLabel}>Verschil</Text>
              <Text
                style={[
                  styles.differenceValue,
                  {
                    color:
                      optimization.impact.difference > 0
                        ? SemanticColors.feedbackError
                        : SemanticColors.feedbackSuccess,
                  },
                ]}
              >
                {optimization.impact.difference > 0 ? '+' : ''}€
                {optimization.impact.difference.toFixed(2)} (
                {optimization.impact.differencePercent > 0 ? '+' : ''}
                {optimization.impact.differencePercent.toFixed(1)}%)
              </Text>
            </View>
          </View>

          <View style={styles.modalSection}>
            <Text style={styles.modalSectionTitle}>Bron</Text>
            <View style={styles.sourceBadge}>
              <Ionicons name="analytics-outline" size={16} color={SemanticColors.actionPrimary} />
              <Text style={styles.sourceText}>{getSourceLabel(optimization.source)}</Text>
            </View>
            <View style={styles.confidenceBar}>
              <View
                style={[
                  styles.confidenceFill,
                  { width: `${optimization.confidence * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.confidenceLabel}>
              {Math.round(optimization.confidence * 100)}% zekerheid in deze aanbeveling
            </Text>
          </View>
        </ScrollView>

        <View style={styles.modalActions}>
          <Pressable
            style={[styles.modalButton, styles.modalButtonSecondary]}
            onPress={() => onReject()}
          >
            <Text style={styles.modalButtonSecondaryText}>Afwijzen</Text>
          </Pressable>
          <Pressable
            style={[styles.modalButton, styles.modalButtonPrimary]}
            onPress={onApply}
          >
            <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            <Text style={styles.modalButtonPrimaryText}>Toepassen</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function UpsellDetailModal({
  upsell,
  onApply,
  onClose,
}: {
  upsell: UpsellSuggestion;
  onApply: () => void;
  onClose: () => void;
}) {
  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Upsell Toevoegen</Text>
          <Pressable onPress={onClose} style={styles.modalClose}>
            <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
          </Pressable>
        </View>

        <ScrollView style={styles.modalBody}>
          <Text style={styles.upsellModalName}>{upsell.productName}</Text>
          <Text style={styles.upsellModalDescription}>{upsell.description}</Text>

          <View style={styles.upsellModalStats}>
            <View style={styles.upsellModalStat}>
              <Text style={styles.upsellModalStatValue}>
                +€{upsell.priceIncrease.toFixed(2)}
              </Text>
              <Text style={styles.upsellModalStatLabel}>Extra omzet</Text>
            </View>
            <View style={styles.upsellModalStat}>
              <Text style={[styles.upsellModalStatValue, { color: SemanticColors.feedbackSuccess }]}>
                +€{upsell.marginIncrease.toFixed(2)}
              </Text>
              <Text style={styles.upsellModalStatLabel}>Extra marge</Text>
            </View>
            <View style={styles.upsellModalStat}>
              <Text style={[styles.upsellModalStatValue, { color: SemanticColors.actionPrimary }]}>
                {Math.round(upsell.customerAcceptanceRate * 100)}%
              </Text>
              <Text style={styles.upsellModalStatLabel}>Acceptatiekans</Text>
            </View>
          </View>

          <View style={styles.reasonBox}>
            <Ionicons name="bulb" size={24} color={SemanticColors.actionPrimary} />
            <View style={styles.reasonContent}>
              <Text style={styles.reasonTitle}>Waarom deze suggestie?</Text>
              <Text style={styles.reasonText}>{upsell.reason}</Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.modalActions}>
          <Pressable
            style={[styles.modalButton, styles.modalButtonSecondary]}
            onPress={onClose}
          >
            <Text style={styles.modalButtonSecondaryText}>Annuleren</Text>
          </Pressable>
          <Pressable
            style={[styles.modalButton, styles.modalButtonPrimary]}
            onPress={onApply}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.modalButtonPrimaryText}>Toevoegen aan offerte</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ============================================
// STANDALONE DEMO COMPONENT
// ============================================

export function QuoteOptimizerDemo() {
  // Demo line items
  const demoLineItems: QuoteLineItem[] = [
    {
      id: 'item_1',
      materialId: 'mat_dulux_white_5l',
      materialName: 'Dulux Trade Eggshell White 5L',
      category: 'Verf',
      quantity: 4,
      unitPrice: 28.50,
      totalPrice: 114.00,
    },
    {
      id: 'item_2',
      materialId: 'mat_sigma_satin',
      materialName: 'Sigma S2U Allure 2.5L',
      category: 'Verf',
      quantity: 2,
      unitPrice: 46.00,
      totalPrice: 92.00,
    },
    {
      id: 'item_3',
      materialId: 'mat_grohe_kraan',
      materialName: 'Grohe Eurosmart Keukenkraan',
      category: 'Sanitair',
      quantity: 1,
      unitPrice: 105.00,
      totalPrice: 105.00,
    },
  ];

  return (
    <View style={styles.demoContainer}>
      <View style={styles.demoHeader}>
        <Ionicons name="flash" size={24} color={SemanticColors.actionPrimary} />
        <Text style={styles.demoTitle}>Quote Optimizer</Text>
      </View>
      <QuoteOptimizer quoteId="demo_quote_1" lineItems={demoLineItems} />
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginTop: 16,
  },
  loadingSubtext: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    color: SemanticColors.textSecondary,
    marginTop: 12,
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfaceBackground,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: SemanticColors.actionPrimary,
  },
  tabLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  tabLabelActive: {
    color: SemanticColors.actionPrimary,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: SemanticColors.feedbackError,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  // Content
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },

  // Empty Tab
  emptyTab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  emptyTabTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginTop: 16,
  },
  emptyTabText: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },

  // Score Cards
  scoreCardsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  scoreCard: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  scoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  scoreLabel: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
  },
  scoreSubtext: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },

  // Summary Card
  summaryCard: {
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: SemanticColors.borderDefault,
    marginVertical: 8,
  },

  // History Card
  historyCard: {
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 12,
    padding: 16,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  historySubtitle: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginBottom: 16,
  },
  historyStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyStat: {
    alignItems: 'center',
  },
  historyStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  historyStatLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },

  // Section
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginBottom: 16,
  },

  // Optimization Card
  optimizationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  optimizationApplied: {
    opacity: 0.6,
  },
  optimizationRejected: {
    opacity: 0.4,
  },
  optIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optContent: {
    flex: 1,
  },
  optTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: 4,
  },
  optDescription: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    lineHeight: 18,
  },
  optMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  confidenceBadge: {
    backgroundColor: SemanticColors.surfaceBackground,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  impactText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Upsell Card
  upsellCard: {
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  upsellHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  acceptanceRate: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  upsellName: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: 4,
  },
  upsellDescription: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginBottom: 12,
  },
  upsellFooter: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 12,
  },
  upsellStat: {},
  upsellStatLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  upsellStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  upsellReason: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: SemanticColors.actionPrimary + '10',
    padding: 12,
    borderRadius: 8,
  },
  upsellReasonText: {
    flex: 1,
    fontSize: 13,
    color: SemanticColors.textSecondary,
    lineHeight: 18,
  },

  // Market Card
  marketCard: {
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  marketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  marketName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginRight: 12,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendText: {
    fontSize: 13,
    fontWeight: '600',
  },
  priceRangeContainer: {
    marginBottom: 12,
  },
  priceRange: {
    height: 8,
    backgroundColor: SemanticColors.borderDefault,
    borderRadius: 4,
    marginBottom: 8,
  },
  pricePosition: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    top: -2,
    marginLeft: -6,
    borderWidth: 2,
    borderColor: SemanticColors.surfaceBackground,
  },
  priceLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priceLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  marketStats: {
    flexDirection: 'row',
    gap: 24,
  },
  marketStat: {},
  marketStatLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  marketStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: SemanticColors.surfaceBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  modalClose: {
    padding: 4,
  },
  modalBody: {
    padding: 16,
  },
  modalDescription: {
    fontSize: 15,
    color: SemanticColors.textSecondary,
    lineHeight: 22,
    marginBottom: 20,
  },
  modalSection: {
    marginBottom: 20,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: 12,
  },
  impactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  impactItem: {
    alignItems: 'center',
  },
  impactLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginBottom: 4,
  },
  impactValue: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  differenceBox: {
    backgroundColor: SemanticColors.surfaceBackground,
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  differenceLabel: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  differenceValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sourceText: {
    fontSize: 14,
    color: SemanticColors.textPrimary,
  },
  confidenceBar: {
    height: 6,
    backgroundColor: SemanticColors.borderDefault,
    borderRadius: 3,
    marginBottom: 8,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: SemanticColors.actionPrimary,
    borderRadius: 3,
  },
  confidenceLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  modalButtonPrimary: {
    backgroundColor: SemanticColors.actionPrimary,
  },
  modalButtonSecondary: {
    backgroundColor: SemanticColors.surfaceBackground,
  },
  modalButtonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonSecondaryText: {
    color: SemanticColors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },

  // Upsell Modal
  upsellModalName: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    marginBottom: 8,
  },
  upsellModalDescription: {
    fontSize: 15,
    color: SemanticColors.textSecondary,
    marginBottom: 20,
  },
  upsellModalStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  upsellModalStat: {
    alignItems: 'center',
  },
  upsellModalStatValue: {
    fontSize: 22,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  upsellModalStatLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  reasonBox: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.actionPrimary + '10',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  reasonContent: {
    flex: 1,
  },
  reasonTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    lineHeight: 20,
  },

  // Demo
  demoContainer: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  demoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 8,
    backgroundColor: SemanticColors.surfaceBackground,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  demoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
});

export default QuoteOptimizer;

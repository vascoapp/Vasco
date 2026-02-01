// =============================================================================
// SMART PRICING ENGINE COMPONENT
// =============================================================================
// Dynamic pricing suggestions based on market conditions and competition
// =============================================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import {
  usePricingEngine,
  PricingSuggestion,
  CompetitorPricing,
  SeasonalAdjustment,
} from '../../services/pricingEngineService';

type TabType = 'pricing' | 'market' | 'seasonal' | 'competitors';

export function SmartPricing() {
  const [activeTab, setActiveTab] = useState<TabType>('pricing');
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [selectedProjectType, setSelectedProjectType] = useState('Schilderwerk');
  const [selectedScope, setSelectedScope] = useState<'small' | 'medium' | 'large'>('medium');
  const [selectedCustomerType, setSelectedCustomerType] = useState<'particulier' | 'zakelijk'>('particulier');

  const {
    suggestion,
    suggestPrice,
    competitorPricing,
    seasonalAdjustments,
    getMarketRate,
  } = usePricingEngine();

  const projectTypes = ['Schilderwerk', 'Badkamerrenovatie', 'Keukenrenovatie', 'Tegelen'];

  const tabs: Array<{ key: TabType; label: string; icon: string }> = [
    { key: 'pricing', label: 'Prijzen', icon: 'pricetag-outline' },
    { key: 'market', label: 'Markt', icon: 'trending-up-outline' },
    { key: 'seasonal', label: 'Seizoen', icon: 'sunny-outline' },
    { key: 'competitors', label: 'Concurrentie', icon: 'people-outline' },
  ];

  const handleSuggestPrice = () => {
    suggestPrice({
      projectType: selectedProjectType,
      scope: selectedScope,
      customerType: selectedCustomerType,
      region: 'Amsterdam',
    });
    setShowPricingModal(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const getPositionStyle = (position: PricingSuggestion['competitivePosition']) => {
    switch (position) {
      case 'below': return { color: Palette.red, label: 'Onder gemiddeld', icon: 'arrow-down' };
      case 'average': return { color: Palette.orange, label: 'Marktconform', icon: 'remove' };
      case 'above': return { color: Palette.blue, label: 'Boven gemiddeld', icon: 'arrow-up' };
      case 'premium': return { color: Palette.emerald, label: 'Premium', icon: 'star' };
    }
  };

  const renderPriceSuggestion = (sug: PricingSuggestion) => {
    const position = getPositionStyle(sug.competitivePosition);

    return (
      <View style={styles.suggestionCard}>
        <View style={styles.suggestionHeader}>
          <View>
            <Text style={styles.suggestionType}>{sug.projectType}</Text>
            <Text style={styles.suggestionConfidence}>
              {Math.round(sug.confidence * 100)}% betrouwbaarheid
            </Text>
          </View>
          <View style={styles.priceBadge}>
            <Text style={styles.priceLabel}>Aanbevolen</Text>
            <Text style={styles.priceValue}>{formatCurrency(sug.suggestedPrice)}</Text>
          </View>
        </View>

        {/* Price Range Slider */}
        <View style={styles.priceRange}>
          <Text style={styles.rangeTitle}>Prijsbandbreedte</Text>
          <View style={styles.rangeBar}>
            <View style={styles.rangeTrack}>
              <View
                style={[
                  styles.rangeOptimalZone,
                  {
                    left: `${((sug.priceRange.min - sug.priceRange.min * 0.9) / (sug.priceRange.max * 1.1 - sug.priceRange.min * 0.9)) * 100}%`,
                    width: `${((sug.priceRange.max - sug.priceRange.min) / (sug.priceRange.max * 1.1 - sug.priceRange.min * 0.9)) * 100}%`,
                  },
                ]}
              />
              <View
                style={[
                  styles.rangeMarker,
                  {
                    left: `${((sug.suggestedPrice - sug.priceRange.min * 0.9) / (sug.priceRange.max * 1.1 - sug.priceRange.min * 0.9)) * 100}%`,
                  },
                ]}
              />
            </View>
          </View>
          <View style={styles.rangeLabels}>
            <Text style={styles.rangeLabelText}>{formatCurrency(sug.priceRange.min)}</Text>
            <Text style={[styles.rangeLabelText, { color: Palette.emerald }]}>Optimaal</Text>
            <Text style={styles.rangeLabelText}>{formatCurrency(sug.priceRange.max)}</Text>
          </View>
        </View>

        {/* Key Metrics */}
        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <View style={[styles.metricIcon, { backgroundColor: position.color + '20' }]}>
              <Ionicons name={position.icon as any} size={16} color={position.color} />
            </View>
            <Text style={styles.metricLabel}>Positie</Text>
            <Text style={[styles.metricValue, { color: position.color }]}>{position.label}</Text>
          </View>
          <View style={styles.metricItem}>
            <View style={[styles.metricIcon, { backgroundColor: Palette.blue + '20' }]}>
              <Ionicons name="trophy-outline" size={16} color={Palette.blue} />
            </View>
            <Text style={styles.metricLabel}>Winkans</Text>
            <Text style={styles.metricValue}>{Math.round(sug.winProbability * 100)}%</Text>
          </View>
          <View style={styles.metricItem}>
            <View style={[styles.metricIcon, { backgroundColor: Palette.emerald + '20' }]}>
              <Ionicons name="trending-up-outline" size={16} color={Palette.emerald} />
            </View>
            <Text style={styles.metricLabel}>Marge</Text>
            <Text style={styles.metricValue}>{sug.expectedMargin}%</Text>
          </View>
        </View>

        {/* Pricing Factors */}
        <View style={styles.factorsSection}>
          <Text style={styles.factorsTitle}>Prijsfactoren</Text>
          {sug.factors.map((factor, index) => (
            <View key={index} style={styles.factorRow}>
              <View style={styles.factorInfo}>
                <Text style={styles.factorName}>{factor.name}</Text>
                <Text style={styles.factorDesc}>{factor.description}</Text>
              </View>
              <View style={[styles.factorImpact, { backgroundColor: factor.direction === 'up' ? Palette.emerald + '20' : Palette.red + '20' }]}>
                <Ionicons
                  name={factor.direction === 'up' ? 'arrow-up' : 'arrow-down'}
                  size={12}
                  color={factor.direction === 'up' ? Palette.emerald : Palette.red}
                />
                <Text style={[styles.factorImpactText, { color: factor.direction === 'up' ? Palette.emerald : Palette.red }]}>
                  {factor.direction === 'up' ? '+' : '-'}{factor.impact}%
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.applyButton}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
            <Text style={styles.applyButtonText}>Pas toe in offerte</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.adjustButton}>
            <Ionicons name="options-outline" size={18} color={Palette.blue} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderPricingTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <TouchableOpacity
        style={styles.newPriceButton}
        onPress={() => setShowPricingModal(true)}
      >
        <Ionicons name="calculator-outline" size={24} color={Palette.blue} />
        <View style={styles.newPriceContent}>
          <Text style={styles.newPriceTitle}>Bereken optimale prijs</Text>
          <Text style={styles.newPriceSubtitle}>
            Krijg AI-aanbevelingen voor je volgende offerte
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={SemanticColors.textSecondary} />
      </TouchableOpacity>

      {suggestion ? (
        renderPriceSuggestion(suggestion)
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="pricetag-outline" size={48} color={SemanticColors.textSecondary} />
          <Text style={styles.emptyTitle}>Geen prijsberekening</Text>
          <Text style={styles.emptyText}>
            Start een nieuwe berekening om optimale prijzen te krijgen.
          </Text>
        </View>
      )}
    </ScrollView>
  );

  const renderMarketTab = () => {
    const marketRates = projectTypes.map((type) => ({
      type,
      ...getMarketRate(type, 'Amsterdam'),
    }));

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        <View style={styles.marketIntro}>
          <Ionicons name="analytics-outline" size={20} color={Palette.blue} />
          <Text style={styles.marketIntroText}>
            Actuele uurtarieven in jouw regio (Amsterdam)
          </Text>
        </View>

        {marketRates.map((rate) => (
          <View key={rate.type} style={styles.marketCard}>
            <View style={styles.marketHeader}>
              <Text style={styles.marketType}>{rate.type}</Text>
              <View style={[styles.trendBadge, { backgroundColor: rate.trend === 'rising' ? Palette.emerald + '20' : rate.trend === 'falling' ? Palette.red + '20' : Palette.gray + '20' }]}>
                <Ionicons
                  name={rate.trend === 'rising' ? 'arrow-up' : rate.trend === 'falling' ? 'arrow-down' : 'remove'}
                  size={12}
                  color={rate.trend === 'rising' ? Palette.emerald : rate.trend === 'falling' ? Palette.red : Palette.gray}
                />
                <Text style={[styles.trendText, { color: rate.trend === 'rising' ? Palette.emerald : rate.trend === 'falling' ? Palette.red : Palette.gray }]}>
                  {rate.trendPercent > 0 ? '+' : ''}{rate.trendPercent}%
                </Text>
              </View>
            </View>

            <View style={styles.marketRateRow}>
              <View style={styles.marketRateMain}>
                <Text style={styles.marketRateValue}>€{rate.avgHourlyRate}</Text>
                <Text style={styles.marketRateUnit}>/uur gem.</Text>
              </View>
              <View style={styles.marketRateRange}>
                <Text style={styles.marketRangeLabel}>Bereik</Text>
                <Text style={styles.marketRangeValue}>
                  €{rate.rateRange.min.toFixed(0)} - €{rate.rateRange.max.toFixed(0)}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderSeasonalCard = (month: SeasonalAdjustment, index: number) => {
    const isCurrentMonth = index === new Date().getMonth();
    const demandColor =
      month.demandLevel === 'high' ? Palette.emerald :
      month.demandLevel === 'medium' ? Palette.orange :
      Palette.red;

    return (
      <View
        key={month.month}
        style={[styles.seasonalCard, isCurrentMonth && styles.seasonalCardCurrent]}
      >
        <View style={styles.seasonalHeader}>
          <Text style={[styles.seasonalMonth, isCurrentMonth && { color: Palette.blue }]}>
            {month.month}
          </Text>
          {isCurrentMonth && (
            <View style={styles.currentBadge}>
              <Text style={styles.currentBadgeText}>Nu</Text>
            </View>
          )}
        </View>

        <View style={[styles.demandIndicator, { backgroundColor: demandColor + '20' }]}>
          <Text style={[styles.demandText, { color: demandColor }]}>
            {month.demandLevel === 'high' ? 'Hoog' : month.demandLevel === 'medium' ? 'Middel' : 'Laag'}
          </Text>
        </View>

        <View style={[styles.adjustmentBadge, { backgroundColor: month.suggestedAdjustment >= 0 ? Palette.emerald + '15' : Palette.red + '15' }]}>
          <Text style={[styles.adjustmentValue, { color: month.suggestedAdjustment >= 0 ? Palette.emerald : Palette.red }]}>
            {month.suggestedAdjustment >= 0 ? '+' : ''}{month.suggestedAdjustment}%
          </Text>
        </View>

        <Text style={styles.seasonalReason} numberOfLines={2}>{month.reason}</Text>
      </View>
    );
  };

  const renderSeasonalTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.seasonalIntro}>
        <Ionicons name="calendar-outline" size={20} color={Palette.orange} />
        <Text style={styles.seasonalIntroText}>
          Pas je prijzen aan op basis van seizoensgebonden vraag
        </Text>
      </View>

      <View style={styles.seasonalGrid}>
        {seasonalAdjustments.map((month, index) => renderSeasonalCard(month, index))}
      </View>

      <View style={styles.seasonalTip}>
        <Ionicons name="bulb-outline" size={18} color={Palette.blue} />
        <Text style={styles.seasonalTipText}>
          Tip: Verhoog je prijzen in drukke periodes (apr-jun, sep) en geef korting in rustige maanden voor stabiele werkstroom.
        </Text>
      </View>
    </ScrollView>
  );

  const renderCompetitorCard = (comp: CompetitorPricing) => {
    const positionColor =
      comp.yourPosition > 75 ? Palette.emerald :
      comp.yourPosition > 50 ? Palette.blue :
      comp.yourPosition > 25 ? Palette.orange :
      Palette.red;

    return (
      <View key={comp.competitorType} style={styles.competitorCard}>
        <View style={styles.competitorHeader}>
          <Text style={styles.competitorType}>{comp.competitorType}</Text>
          <Text style={styles.competitorSample}>{comp.sampleSize} bedrijven</Text>
        </View>

        <View style={styles.competitorPricing}>
          <View style={styles.competitorAvg}>
            <Text style={styles.competitorAvgLabel}>Gem. tarief</Text>
            <Text style={styles.competitorAvgValue}>€{comp.avgPrice}/uur</Text>
          </View>
          <View style={styles.competitorRange}>
            <Text style={styles.competitorRangeLabel}>Bereik</Text>
            <Text style={styles.competitorRangeValue}>
              €{comp.priceRange.min} - €{comp.priceRange.max}
            </Text>
          </View>
        </View>

        <View style={styles.positionSection}>
          <Text style={styles.positionLabel}>Jouw positie</Text>
          <View style={styles.positionBar}>
            <View style={styles.positionTrack}>
              <View style={[styles.positionFill, { width: `${comp.yourPosition}%`, backgroundColor: positionColor }]} />
              <View style={[styles.positionMarker, { left: `${comp.yourPosition}%` }]} />
            </View>
          </View>
          <View style={styles.positionLabels}>
            <Text style={styles.positionLabelText}>Laagste</Text>
            <Text style={[styles.positionPercent, { color: positionColor }]}>
              Top {100 - comp.yourPosition}%
            </Text>
            <Text style={styles.positionLabelText}>Hoogste</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderCompetitorsTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.competitorIntro}>
        <Ionicons name="people-outline" size={20} color={Palette.purple} />
        <Text style={styles.competitorIntroText}>
          Vergelijk je tarieven met concurrenten in jouw segment
        </Text>
      </View>

      {competitorPricing.map(renderCompetitorCard)}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon as any}
              size={18}
              color={activeTab === tab.key ? Palette.blue : SemanticColors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {activeTab === 'pricing' && renderPricingTab()}
      {activeTab === 'market' && renderMarketTab()}
      {activeTab === 'seasonal' && renderSeasonalTab()}
      {activeTab === 'competitors' && renderCompetitorsTab()}

      {/* Pricing Modal */}
      <Modal
        visible={showPricingModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPricingModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowPricingModal(false)}>
              <Ionicons name="close" size={24} color={SemanticColors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Prijs berekenen</Text>
            <TouchableOpacity onPress={handleSuggestPrice}>
              <Text style={styles.modalAction}>Bereken</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Project Type */}
            <Text style={styles.inputLabel}>Type project</Text>
            <View style={styles.typeGrid}>
              {projectTypes.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeOption, selectedProjectType === type && styles.typeOptionSelected]}
                  onPress={() => setSelectedProjectType(type)}
                >
                  <Text style={[styles.typeOptionText, selectedProjectType === type && styles.typeOptionTextSelected]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Scope */}
            <Text style={styles.inputLabel}>Omvang</Text>
            <View style={styles.scopeOptions}>
              {[
                { key: 'small' as const, label: 'Klein', price: 'Enkele ruimte' },
                { key: 'medium' as const, label: 'Middel', price: 'Meerdere ruimtes' },
                { key: 'large' as const, label: 'Groot', price: 'Complete woning' },
              ].map((scope) => (
                <TouchableOpacity
                  key={scope.key}
                  style={[styles.scopeOption, selectedScope === scope.key && styles.scopeOptionSelected]}
                  onPress={() => setSelectedScope(scope.key)}
                >
                  <Text style={[styles.scopeLabel, selectedScope === scope.key && styles.scopeLabelSelected]}>
                    {scope.label}
                  </Text>
                  <Text style={[styles.scopeDesc, selectedScope === scope.key && styles.scopeDescSelected]}>
                    {scope.price}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Customer Type */}
            <Text style={styles.inputLabel}>Klanttype</Text>
            <View style={styles.customerTypeOptions}>
              <TouchableOpacity
                style={[styles.customerTypeOption, selectedCustomerType === 'particulier' && styles.customerTypeSelected]}
                onPress={() => setSelectedCustomerType('particulier')}
              >
                <Ionicons
                  name="person-outline"
                  size={24}
                  color={selectedCustomerType === 'particulier' ? Palette.blue : SemanticColors.textSecondary}
                />
                <Text style={[styles.customerTypeLabel, selectedCustomerType === 'particulier' && styles.customerTypeLabelSelected]}>
                  Particulier
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.customerTypeOption, selectedCustomerType === 'zakelijk' && styles.customerTypeSelected]}
                onPress={() => setSelectedCustomerType('zakelijk')}
              >
                <Ionicons
                  name="business-outline"
                  size={24}
                  color={selectedCustomerType === 'zakelijk' ? Palette.blue : SemanticColors.textSecondary}
                />
                <Text style={[styles.customerTypeLabel, selectedCustomerType === 'zakelijk' && styles.customerTypeLabelSelected]}>
                  Zakelijk
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.background,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.card,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  activeTab: {
    backgroundColor: Palette.blue + '15',
  },
  tabText: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    fontWeight: '500',
  },
  activeTabText: {
    color: Palette.blue,
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },

  // New Price Button
  newPriceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: SemanticColors.border,
    gap: 12,
  },
  newPriceContent: {
    flex: 1,
  },
  newPriceTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  newPriceSubtitle: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },

  // Suggestion Card
  suggestionCard: {
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  suggestionType: {
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  suggestionConfidence: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  priceBadge: {
    backgroundColor: Palette.emerald,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
  },
  priceValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },

  // Price Range
  priceRange: {
    marginBottom: 20,
  },
  rangeTitle: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginBottom: 10,
  },
  rangeBar: {
    height: 12,
    backgroundColor: SemanticColors.border,
    borderRadius: 6,
    marginBottom: 6,
  },
  rangeTrack: {
    height: '100%',
    borderRadius: 6,
    position: 'relative',
  },
  rangeOptimalZone: {
    position: 'absolute',
    height: '100%',
    backgroundColor: Palette.emerald + '40',
    borderRadius: 6,
  },
  rangeMarker: {
    position: 'absolute',
    top: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Palette.emerald,
    borderWidth: 2,
    borderColor: '#fff',
    marginLeft: -8,
  },
  rangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rangeLabelText: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },

  // Metrics Row
  metricsRow: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    gap: 8,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  metricLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.text,
    marginTop: 2,
  },

  // Factors Section
  factorsSection: {
    borderTopWidth: 1,
    borderTopColor: SemanticColors.border,
    paddingTop: 16,
    marginBottom: 16,
  },
  factorsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.text,
    marginBottom: 12,
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  factorInfo: {
    flex: 1,
    marginRight: 12,
  },
  factorName: {
    fontSize: 14,
    fontWeight: '500',
    color: SemanticColors.text,
  },
  factorDesc: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 1,
  },
  factorImpact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 2,
  },
  factorImpactText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  applyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.blue,
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  adjustButton: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.blue + '15',
    borderRadius: 10,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.text,
    marginTop: 12,
  },
  emptyText: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  // Market Tab
  marketIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.blue + '15',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 10,
  },
  marketIntroText: {
    flex: 1,
    fontSize: 14,
    color: SemanticColors.text,
  },
  marketCard: {
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  marketHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  marketType: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 2,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  marketRateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  marketRateMain: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  marketRateValue: {
    fontSize: 28,
    fontWeight: '700',
    color: SemanticColors.text,
  },
  marketRateUnit: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginLeft: 4,
  },
  marketRateRange: {
    alignItems: 'flex-end',
  },
  marketRangeLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  marketRangeValue: {
    fontSize: 14,
    color: SemanticColors.text,
  },

  // Seasonal Tab
  seasonalIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.orange + '15',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 10,
  },
  seasonalIntroText: {
    flex: 1,
    fontSize: 14,
    color: SemanticColors.text,
  },
  seasonalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  seasonalCard: {
    width: '31%',
    backgroundColor: SemanticColors.card,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: SemanticColors.border,
    alignItems: 'center',
  },
  seasonalCardCurrent: {
    borderColor: Palette.blue,
    borderWidth: 2,
  },
  seasonalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 4,
  },
  seasonalMonth: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  currentBadge: {
    backgroundColor: Palette.blue,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  currentBadgeText: {
    fontSize: 8,
    color: '#fff',
    fontWeight: '700',
  },
  demandIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 6,
  },
  demandText: {
    fontSize: 10,
    fontWeight: '600',
  },
  adjustmentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 6,
  },
  adjustmentValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  seasonalReason: {
    fontSize: 9,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
  },
  seasonalTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Palette.blue + '15',
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  seasonalTipText: {
    flex: 1,
    fontSize: 13,
    color: SemanticColors.text,
    lineHeight: 18,
  },

  // Competitors Tab
  competitorIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.purple + '15',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 10,
  },
  competitorIntroText: {
    flex: 1,
    fontSize: 14,
    color: SemanticColors.text,
  },
  competitorCard: {
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  competitorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  competitorType: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  competitorSample: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  competitorPricing: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  competitorAvg: {},
  competitorAvgLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  competitorAvgValue: {
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  competitorRange: {
    alignItems: 'flex-end',
  },
  competitorRangeLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  competitorRangeValue: {
    fontSize: 14,
    color: SemanticColors.text,
  },
  positionSection: {},
  positionLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginBottom: 6,
  },
  positionBar: {
    marginBottom: 4,
  },
  positionTrack: {
    height: 8,
    backgroundColor: SemanticColors.border,
    borderRadius: 4,
    position: 'relative',
  },
  positionFill: {
    height: '100%',
    borderRadius: 4,
  },
  positionMarker: {
    position: 'absolute',
    top: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: SemanticColors.text,
    marginLeft: -6,
  },
  positionLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  positionLabelText: {
    fontSize: 10,
    color: SemanticColors.textSecondary,
  },
  positionPercent: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: SemanticColors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.border,
    backgroundColor: SemanticColors.card,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  modalAction: {
    fontSize: 16,
    fontWeight: '600',
    color: Palette.blue,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.text,
    marginBottom: 12,
    marginTop: 8,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  typeOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: SemanticColors.card,
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  typeOptionSelected: {
    backgroundColor: Palette.blue,
    borderColor: Palette.blue,
  },
  typeOptionText: {
    fontSize: 14,
    color: SemanticColors.text,
  },
  typeOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  scopeOptions: {
    gap: 8,
    marginBottom: 16,
  },
  scopeOption: {
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  scopeOptionSelected: {
    backgroundColor: Palette.blue + '15',
    borderColor: Palette.blue,
  },
  scopeLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  scopeLabelSelected: {
    color: Palette.blue,
  },
  scopeDesc: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  scopeDescSelected: {
    color: Palette.blue,
  },
  customerTypeOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  customerTypeOption: {
    flex: 1,
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.border,
    gap: 8,
  },
  customerTypeSelected: {
    backgroundColor: Palette.blue + '15',
    borderColor: Palette.blue,
  },
  customerTypeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: SemanticColors.text,
  },
  customerTypeLabelSelected: {
    color: Palette.blue,
    fontWeight: '600',
  },
});

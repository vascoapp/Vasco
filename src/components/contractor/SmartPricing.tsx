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
  Pressable,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { formatCurrency } from '../../i18n/formatting';
import { useTranslation } from 'react-i18next';
import {
  usePricingEngine,
  PricingSuggestion,
  CompetitorPricing,
  SeasonalAdjustment,
} from '../../services/pricingEngineService';

type TabType = 'pricing' | 'market' | 'seasonal' | 'competitors';

export function SmartPricing() {
  const { t } = useTranslation();
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
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const getPositionStyle = (position: PricingSuggestion['competitivePosition']) => {
    switch (position) {
      case 'below': return { color: Palette.red500, label: 'Onder gemiddeld', icon: 'arrow-down' };
      case 'average': return { color: Palette.orange500, label: 'Marktconform', icon: 'remove' };
      case 'above': return { color: Palette.blue500, label: 'Boven gemiddeld', icon: 'arrow-up' };
      case 'premium': return { color: Palette.green500, label: 'Premium', icon: 'star' };
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
            <Text style={[styles.rangeLabelText, { color: Palette.green500 }]}>Optimaal</Text>
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
            <View style={[styles.metricIcon, { backgroundColor: Palette.blue500 + '20' }]}>
              <Ionicons name="trophy-outline" size={16} color={Palette.blue500} />
            </View>
            <Text style={styles.metricLabel}>Winkans</Text>
            <Text style={styles.metricValue}>{Math.round(sug.winProbability * 100)}%</Text>
          </View>
          <View style={styles.metricItem}>
            <View style={[styles.metricIcon, { backgroundColor: Palette.green500 + '20' }]}>
              <Ionicons name="trending-up-outline" size={16} color={Palette.green500} />
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
              <View style={[styles.factorImpact, { backgroundColor: factor.direction === 'up' ? Palette.green500 + '20' : Palette.red500 + '20' }]}>
                <Ionicons
                  name={factor.direction === 'up' ? 'arrow-up' : 'arrow-down'}
                  size={12}
                  color={factor.direction === 'up' ? Palette.green500 : Palette.red500}
                />
                <Text style={[styles.factorImpactText, { color: factor.direction === 'up' ? Palette.green500 : Palette.red500 }]}>
                  {factor.direction === 'up' ? '+' : '-'}{factor.impact}%
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Pressable style={styles.applyButton}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
            <Text style={styles.applyButtonText}>Pas toe in offerte</Text>
          </Pressable>
          <Pressable style={styles.adjustButton}>
            <Ionicons name="options-outline" size={18} color={Palette.blue500} />
          </Pressable>
        </View>
      </View>
    );
  };

  const renderPricingTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <Pressable
        style={styles.newPriceButton}
        onPress={() => setShowPricingModal(true)}
      >
        <Ionicons name="calculator-outline" size={24} color={Palette.blue500} />
        <View style={styles.newPriceContent}>
          <Text style={styles.newPriceTitle}>Bereken optimale prijs</Text>
          <Text style={styles.newPriceSubtitle}>
            Krijg AI-aanbevelingen voor je volgende offerte
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={SemanticColors.textSecondary} />
      </Pressable>

      {suggestion ? (
        renderPriceSuggestion(suggestion)
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="pricetag-outline" size={48} color={SemanticColors.textSecondary} />
          <Text style={styles.emptyTitle}>{t('pricing.noPriceCalculation', 'No price calculation')}</Text>
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
          <Ionicons name="analytics-outline" size={20} color={Palette.blue500} />
          <Text style={styles.marketIntroText}>
            Actuele uurtarieven in jouw regio (Amsterdam)
          </Text>
        </View>

        {marketRates.map((rate) => (
          <View key={rate.type} style={styles.marketCard}>
            <View style={styles.marketHeader}>
              <Text style={styles.marketType}>{rate.type}</Text>
              <View style={[styles.trendBadge, { backgroundColor: rate.trend === 'rising' ? Palette.green500 + '20' : rate.trend === 'falling' ? Palette.red500 + '20' : Palette.gray500 + '20' }]}>
                <Ionicons
                  name={rate.trend === 'rising' ? 'arrow-up' : rate.trend === 'falling' ? 'arrow-down' : 'remove'}
                  size={12}
                  color={rate.trend === 'rising' ? Palette.green500 : rate.trend === 'falling' ? Palette.red500 : Palette.gray500}
                />
                <Text style={[styles.trendText, { color: rate.trend === 'rising' ? Palette.green500 : rate.trend === 'falling' ? Palette.red500 : Palette.gray500 }]}>
                  {rate.trendPercent > 0 ? '+' : ''}{rate.trendPercent}%
                </Text>
              </View>
            </View>

            <View style={styles.marketRateRow}>
              <View style={styles.marketRateMain}>
                <Text style={styles.marketRateValue}>{formatCurrency(rate.avgHourlyRate)}</Text>
                <Text style={styles.marketRateUnit}>/uur gem.</Text>
              </View>
              <View style={styles.marketRateRange}>
                <Text style={styles.marketRangeLabel}>Bereik</Text>
                <Text style={styles.marketRangeValue}>
                  {formatCurrency(rate.rateRange.min)} - {formatCurrency(rate.rateRange.max)}
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
      month.demandLevel === 'high' ? Palette.green500 :
      month.demandLevel === 'medium' ? Palette.orange500 :
      Palette.red500;

    return (
      <View
        key={month.month}
        style={[styles.seasonalCard, isCurrentMonth && styles.seasonalCardCurrent]}
      >
        <View style={styles.seasonalHeader}>
          <Text style={[styles.seasonalMonth, isCurrentMonth && { color: Palette.blue500 }]}>
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

        <View style={[styles.adjustmentBadge, { backgroundColor: month.suggestedAdjustment >= 0 ? Palette.green500 + '15' : Palette.red500 + '15' }]}>
          <Text style={[styles.adjustmentValue, { color: month.suggestedAdjustment >= 0 ? Palette.green500 : Palette.red500 }]}>
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
        <Ionicons name="calendar-outline" size={20} color={Palette.orange500} />
        <Text style={styles.seasonalIntroText}>
          Pas je prijzen aan op basis van seizoensgebonden vraag
        </Text>
      </View>

      <View style={styles.seasonalGrid}>
        {seasonalAdjustments.map((month, index) => renderSeasonalCard(month, index))}
      </View>

      <View style={styles.seasonalTip}>
        <Ionicons name="bulb-outline" size={18} color={Palette.blue500} />
        <Text style={styles.seasonalTipText}>
          Tip: Verhoog je prijzen in drukke periodes (apr-jun, sep) en geef korting in rustige maanden voor stabiele werkstroom.
        </Text>
      </View>
    </ScrollView>
  );

  const renderCompetitorCard = (comp: CompetitorPricing) => {
    const positionColor =
      comp.yourPosition > 75 ? Palette.green500 :
      comp.yourPosition > 50 ? Palette.blue500 :
      comp.yourPosition > 25 ? Palette.orange500 :
      Palette.red500;

    return (
      <View key={comp.competitorType} style={styles.competitorCard}>
        <View style={styles.competitorHeader}>
          <Text style={styles.competitorType}>{comp.competitorType}</Text>
          <Text style={styles.competitorSample}>{comp.sampleSize} bedrijven</Text>
        </View>

        <View style={styles.competitorPricing}>
          <View style={styles.competitorAvg}>
            <Text style={styles.competitorAvgLabel}>Gem. tarief</Text>
            <Text style={styles.competitorAvgValue}>{formatCurrency(comp.avgPrice)}/uur</Text>
          </View>
          <View style={styles.competitorRange}>
            <Text style={styles.competitorRangeLabel}>Bereik</Text>
            <Text style={styles.competitorRangeValue}>
              {formatCurrency(comp.priceRange.min)} - {formatCurrency(comp.priceRange.max)}
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
        <Ionicons name="people-outline" size={20} color={Palette.hermesOrange} />
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
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon as any}
              size={18}
              color={activeTab === tab.key ? Palette.blue500 : SemanticColors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
              {tab.label}
            </Text>
          </Pressable>
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
            <Pressable onPress={() => setShowPricingModal(false)}>
              <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
            </Pressable>
            <Text style={styles.modalTitle}>Prijs berekenen</Text>
            <Pressable onPress={handleSuggestPrice}>
              <Text style={styles.modalAction}>Bereken</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Project Type */}
            <Text style={styles.inputLabel}>Type project</Text>
            <View style={styles.typeGrid}>
              {projectTypes.map((type) => (
                <Pressable
                  key={type}
                  style={[styles.typeOption, selectedProjectType === type && styles.typeOptionSelected]}
                  onPress={() => setSelectedProjectType(type)}
                >
                  <Text style={[styles.typeOptionText, selectedProjectType === type && styles.typeOptionTextSelected]}>
                    {type}
                  </Text>
                </Pressable>
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
                <Pressable
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
                </Pressable>
              ))}
            </View>

            {/* Customer Type */}
            <Text style={styles.inputLabel}>{t('common.customerType', 'Customer type')}</Text>
            <View style={styles.customerTypeOptions}>
              <Pressable
                style={[styles.customerTypeOption, selectedCustomerType === 'particulier' && styles.customerTypeSelected]}
                onPress={() => setSelectedCustomerType('particulier')}
              >
                <Ionicons
                  name="person-outline"
                  size={24}
                  color={selectedCustomerType === 'particulier' ? Palette.blue500 : SemanticColors.textSecondary}
                />
                <Text style={[styles.customerTypeLabel, selectedCustomerType === 'particulier' && styles.customerTypeLabelSelected]}>
                  Particulier
                </Text>
              </Pressable>
              <Pressable
                style={[styles.customerTypeOption, selectedCustomerType === 'zakelijk' && styles.customerTypeSelected]}
                onPress={() => setSelectedCustomerType('zakelijk')}
              >
                <Ionicons
                  name="business-outline"
                  size={24}
                  color={selectedCustomerType === 'zakelijk' ? Palette.blue500 : SemanticColors.textSecondary}
                />
                <Text style={[styles.customerTypeLabel, selectedCustomerType === 'zakelijk' && styles.customerTypeLabelSelected]}>
                  Zakelijk
                </Text>
              </Pressable>
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
    backgroundColor: SemanticColors.surfaceBackground,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    gap: 4,
  },
  activeTab: {
    backgroundColor: Palette.blue500 + '15',
  },
  tabText: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    fontFamily: TYPE.labelFamily,
  },
  activeTabText: {
    color: Palette.blue500,
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },

  // New Price Button
  newPriceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 12,
  },
  newPriceContent: {
    flex: 1,
  },
  newPriceTitle: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  newPriceSubtitle: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },

  // Suggestion Card
  suggestionCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: 16,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  suggestionType: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  suggestionConfidence: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  priceBadge: {
    backgroundColor: Palette.green500,
    borderRadius: RADIUS.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: TYPE.tinySize - 1,
    color: 'rgba(255,255,255,0.8)',
  },
  priceValue: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: Palette.white,
  },

  // Price Range
  priceRange: {
    marginBottom: 20,
  },
  rangeTitle: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
    marginBottom: 10,
  },
  rangeBar: {
    height: 12,
    backgroundColor: SemanticColors.borderDefault,
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
    backgroundColor: Palette.green500 + '40',
    borderRadius: 6,
  },
  rangeMarker: {
    position: 'absolute',
    top: -2,
    width: 16,
    height: 16,
    borderRadius: RADIUS.sm,
    backgroundColor: Palette.green500,
    borderWidth: 2,
    borderColor: '#fff',
    marginLeft: -8,
  },
  rangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rangeLabelText: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textSecondary,
  },

  // Metrics Row
  metricsRow: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: RADIUS.md,
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
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  metricLabel: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textSecondary,
  },
  metricValue: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    marginTop: 2,
  },

  // Factors Section
  factorsSection: {
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
    paddingTop: 16,
    marginBottom: 16,
  },
  factorsTitle: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
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
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textPrimary,
  },
  factorDesc: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    marginTop: 1,
  },
  factorImpact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.md,
    gap: 2,
  },
  factorImpactText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
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
    backgroundColor: Palette.blue500,
    paddingVertical: 14,
    borderRadius: RADIUS.sm,
    gap: 8,
  },
  applyButtonText: {
    color: Palette.white,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
  },
  adjustButton: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.blue500 + '15',
    borderRadius: RADIUS.sm,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    marginTop: 12,
  },
  emptyText: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  // Market Tab
  marketIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.blue500 + '15',
    borderRadius: RADIUS.md,
    padding: 16,
    marginBottom: 16,
    gap: 10,
  },
  marketIntroText: {
    flex: 1,
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textPrimary,
  },
  marketCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  marketHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  marketType: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.md,
    gap: 2,
  },
  trendText: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
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
    fontSize: TYPE.displaySize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  marketRateUnit: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
    marginLeft: 4,
  },
  marketRateRange: {
    alignItems: 'flex-end',
  },
  marketRangeLabel: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textSecondary,
  },
  marketRangeValue: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textPrimary,
  },

  // Seasonal Tab
  seasonalIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.orange500 + '15',
    borderRadius: RADIUS.md,
    padding: 16,
    marginBottom: 16,
    gap: 10,
  },
  seasonalIntroText: {
    flex: 1,
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textPrimary,
  },
  seasonalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  seasonalCard: {
    width: '31%',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    alignItems: 'center',
  },
  seasonalCardCurrent: {
    borderColor: Palette.blue500,
    borderWidth: 2,
  },
  seasonalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 4,
  },
  seasonalMonth: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  currentBadge: {
    backgroundColor: Palette.blue500,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  currentBadgeText: {
    fontSize: TYPE.tinySize - 3,
    color: Palette.white,
    fontFamily: TYPE.sectionFamily,
  },
  demandIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    marginBottom: 6,
  },
  demandText: {
    fontSize: TYPE.tinySize - 1,
    fontFamily: TYPE.titleFamily,
  },
  adjustmentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    marginBottom: 6,
  },
  adjustmentValue: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.sectionFamily,
  },
  seasonalReason: {
    fontSize: TYPE.tinySize - 2,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
  },
  seasonalTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Palette.blue500 + '15',
    borderRadius: RADIUS.md,
    padding: 16,
    gap: 10,
  },
  seasonalTipText: {
    flex: 1,
    fontSize: TYPE.captionSize,
    color: SemanticColors.textPrimary,
    lineHeight: 18,
  },

  // Competitors Tab
  competitorIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.hermesOrange + '15',
    borderRadius: RADIUS.md,
    padding: 16,
    marginBottom: 16,
    gap: 10,
  },
  competitorIntroText: {
    flex: 1,
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textPrimary,
  },
  competitorCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  competitorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  competitorType: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  competitorSample: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
  },
  competitorPricing: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  competitorAvg: {},
  competitorAvgLabel: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textSecondary,
  },
  competitorAvgValue: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  competitorRange: {
    alignItems: 'flex-end',
  },
  competitorRangeLabel: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textSecondary,
  },
  competitorRangeValue: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textPrimary,
  },
  positionSection: {},
  positionLabel: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    marginBottom: 6,
  },
  positionBar: {
    marginBottom: 4,
  },
  positionTrack: {
    height: 8,
    backgroundColor: SemanticColors.borderDefault,
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
    backgroundColor: SemanticColors.surfacePrimary,
    borderWidth: 2,
    borderColor: SemanticColors.textPrimary,
    marginLeft: -6,
  },
  positionLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  positionLabelText: {
    fontSize: TYPE.tinySize - 1,
    color: SemanticColors.textSecondary,
  },
  positionPercent: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
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
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  modalAction: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: Palette.blue500,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  inputLabel: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
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
    borderRadius: RADIUS.xl,
    backgroundColor: SemanticColors.surfacePrimary,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  typeOptionSelected: {
    backgroundColor: Palette.blue500,
    borderColor: Palette.blue500,
  },
  typeOptionText: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textPrimary,
  },
  typeOptionTextSelected: {
    color: Palette.white,
    fontFamily: TYPE.titleFamily,
  },
  scopeOptions: {
    gap: 8,
    marginBottom: 16,
  },
  scopeOption: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: 16,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  scopeOptionSelected: {
    backgroundColor: Palette.blue500 + '15',
    borderColor: Palette.blue500,
  },
  scopeLabel: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  scopeLabelSelected: {
    color: Palette.blue500,
  },
  scopeDesc: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  scopeDescSelected: {
    color: Palette.blue500,
  },
  customerTypeOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  customerTypeOption: {
    flex: 1,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 8,
  },
  customerTypeSelected: {
    backgroundColor: Palette.blue500 + '15',
    borderColor: Palette.blue500,
  },
  customerTypeLabel: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textPrimary,
  },
  customerTypeLabelSelected: {
    color: Palette.blue500,
    fontFamily: TYPE.titleFamily,
  },
});

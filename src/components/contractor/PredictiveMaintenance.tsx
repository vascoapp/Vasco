// =============================================================================
// PREDICTIVE MAINTENANCE COMPONENT
// =============================================================================
// AI-powered predictive maintenance dashboard
// =============================================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import {
  useEquipmentHealth,
  useFailurePredictions,
  useMaintenanceRecommendations,
  usePartOrderSuggestions,
  useCostSavings,
  usePredictiveStats,
  EquipmentHealth,
  FailurePrediction,
  MaintenanceRecommendation,
} from '../../services/predictiveMaintenanceService';

const { width } = Dimensions.get('window');

type TabType = 'overview' | 'predictions' | 'recommendations' | 'parts';

export function PredictiveMaintenance() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentHealth | null>(null);
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [selectedPrediction, setSelectedPrediction] = useState<FailurePrediction | null>(null);
  const [showPredictionModal, setShowPredictionModal] = useState(false);
  const [analyzing, setAnalyzing] = useState<string | null>(null);

  const { health, runAnalysis } = useEquipmentHealth();
  const { predictions, acknowledge } = useFailurePredictions();
  const { recommendations, schedule, dismiss } = useMaintenanceRecommendations();
  const { suggestions, order } = usePartOrderSuggestions();
  const { report } = useCostSavings();
  const stats = usePredictiveStats();

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overzicht', icon: 'pulse' },
    { id: 'predictions', label: 'Voorspellingen', icon: 'analytics' },
    { id: 'recommendations', label: 'Aanbevelingen', icon: 'bulb' },
    { id: 'parts', label: 'Onderdelen', icon: 'cube' },
  ];

  const handleRunAnalysis = async (equipmentId: string) => {
    setAnalyzing(equipmentId);
    await runAnalysis(equipmentId);
    setAnalyzing(null);
  };

  const renderStatsBar = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.statsBar}
      contentContainerStyle={styles.statsBarContent}
    >
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{stats.averageHealthScore}%</Text>
        <Text style={styles.statLabel}>Gem. Gezondheid</Text>
      </View>
      <View style={styles.statItem}>
        <Text style={[styles.statValue, stats.equipmentAtRisk > 0 && styles.warningValue]}>
          {stats.equipmentAtRisk}
        </Text>
        <Text style={styles.statLabel}>Risico</Text>
      </View>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{stats.predictionsActive}</Text>
        <Text style={styles.statLabel}>Voorspellingen</Text>
      </View>
      <View style={styles.statItem}>
        <Text style={[styles.statValue, { color: Palette.success }]}>
          €{stats.savingsThisMonth}
        </Text>
        <Text style={styles.statLabel}>Bespaard</Text>
      </View>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{stats.preventedFailuresThisMonth}</Text>
        <Text style={styles.statLabel}>Voorkomen</Text>
      </View>
    </ScrollView>
  );

  const renderOverviewTab = () => (
    <ScrollView style={styles.tabContent}>
      {report && (
        <View style={styles.savingsCard}>
          <View style={styles.savingsHeader}>
            <Ionicons name="trending-up" size={24} color={Palette.success} />
            <Text style={styles.savingsTitle}>Maandelijkse Besparingen</Text>
          </View>
          <View style={styles.savingsMain}>
            <Text style={styles.savingsAmount}>€{report.savings}</Text>
            <Text style={styles.savingsPercentage}>
              {report.savingsPercentage}% minder kosten
            </Text>
          </View>
          <View style={styles.savingsDetails}>
            <View style={styles.savingsDetail}>
              <Text style={styles.savingsDetailLabel}>Storingen voorkomen</Text>
              <Text style={styles.savingsDetailValue}>{report.preventedFailures}</Text>
            </View>
            <View style={styles.savingsDetail}>
              <Text style={styles.savingsDetailLabel}>Downtime voorkomen</Text>
              <Text style={styles.savingsDetailValue}>{report.downtimePrevented}u</Text>
            </View>
            <View style={styles.savingsDetail}>
              <Text style={styles.savingsDetailLabel}>Omzet beschermd</Text>
              <Text style={styles.savingsDetailValue}>€{report.revenueProtected}</Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Apparatuur Gezondheid</Text>
        <TouchableOpacity>
          <Text style={styles.sectionLink}>Alles bekijken</Text>
        </TouchableOpacity>
      </View>

      {health
        .sort((a, b) => a.healthScore - b.healthScore)
        .map(item => (
          <TouchableOpacity
            key={item.equipmentId}
            style={styles.healthCard}
            onPress={() => {
              setSelectedEquipment(item);
              setShowEquipmentModal(true);
            }}
          >
            <View style={styles.healthHeader}>
              <View style={styles.healthInfo}>
                <Text style={styles.healthName}>{item.equipmentName}</Text>
                <Text style={styles.healthCategory}>{getCategoryName(item.category)}</Text>
              </View>
              <View style={styles.healthScoreContainer}>
                <View
                  style={[
                    styles.healthScoreCircle,
                    { borderColor: getHealthColor(item.healthScore) },
                  ]}
                >
                  <Text style={[styles.healthScoreValue, { color: getHealthColor(item.healthScore) }]}>
                    {item.healthScore}
                  </Text>
                </View>
                <View style={styles.trendIndicator}>
                  <Ionicons
                    name={
                      item.trend === 'improving'
                        ? 'arrow-up'
                        : item.trend === 'declining'
                        ? 'arrow-down'
                        : 'remove'
                    }
                    size={14}
                    color={
                      item.trend === 'improving'
                        ? Palette.success
                        : item.trend === 'declining'
                        ? Palette.error
                        : SemanticColors.textSecondary
                    }
                  />
                </View>
              </View>
            </View>

            <View style={styles.healthFactors}>
              {item.factors.slice(0, 3).map((factor, i) => (
                <View key={i} style={styles.factorBar}>
                  <View style={styles.factorInfo}>
                    <Text style={styles.factorName}>{factor.name}</Text>
                    <Text style={styles.factorValue}>{factor.value}%</Text>
                  </View>
                  <View style={styles.factorProgress}>
                    <View
                      style={[
                        styles.factorFill,
                        {
                          width: `${factor.value}%`,
                          backgroundColor: getFactorColor(factor.status),
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>

            {(item.riskLevel === 'high' || item.riskLevel === 'critical') && (
              <View style={[styles.riskBadge, { backgroundColor: getRiskColor(item.riskLevel) + '15' }]}>
                <Ionicons name="warning" size={14} color={getRiskColor(item.riskLevel)} />
                <Text style={[styles.riskText, { color: getRiskColor(item.riskLevel) }]}>
                  {item.riskLevel === 'critical' ? 'Kritiek risico' : 'Hoog risico'}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.analyzeButton}
              onPress={() => handleRunAnalysis(item.equipmentId)}
              disabled={analyzing === item.equipmentId}
            >
              {analyzing === item.equipmentId ? (
                <ActivityIndicator size="small" color={SemanticColors.primary} />
              ) : (
                <>
                  <Ionicons name="refresh" size={16} color={SemanticColors.primary} />
                  <Text style={styles.analyzeButtonText}>Analyse uitvoeren</Text>
                </>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
    </ScrollView>
  );

  const renderPredictionsTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Actieve Voorspellingen</Text>
        <Text style={styles.sectionSubtitle}>{predictions.filter(p => !p.acknowledged).length} vereisen aandacht</Text>
      </View>

      {predictions
        .filter(p => !p.acknowledged)
        .sort((a, b) => b.probability - a.probability)
        .map(prediction => (
          <TouchableOpacity
            key={prediction.id}
            style={styles.predictionCard}
            onPress={() => {
              setSelectedPrediction(prediction);
              setShowPredictionModal(true);
            }}
          >
            <View style={styles.predictionHeader}>
              <View
                style={[
                  styles.probabilityCircle,
                  { backgroundColor: getProbabilityColor(prediction.probability) + '20' },
                ]}
              >
                <Text
                  style={[
                    styles.probabilityValue,
                    { color: getProbabilityColor(prediction.probability) },
                  ]}
                >
                  {prediction.probability}%
                </Text>
                <Text style={styles.probabilityLabel}>kans</Text>
              </View>
              <View style={styles.predictionInfo}>
                <Text style={styles.predictionEquipment}>{prediction.equipmentName}</Text>
                <Text style={styles.predictionComponent}>{prediction.component}</Text>
                <Text style={styles.predictionType}>{prediction.failureType}</Text>
              </View>
              <View
                style={[
                  styles.impactBadge,
                  { backgroundColor: getImpactColor(prediction.potentialImpact) + '20' },
                ]}
              >
                <Text
                  style={[
                    styles.impactText,
                    { color: getImpactColor(prediction.potentialImpact) },
                  ]}
                >
                  {getImpactName(prediction.potentialImpact)}
                </Text>
              </View>
            </View>

            <View style={styles.predictionTimeline}>
              <Text style={styles.timelineLabel}>Verwachte storing:</Text>
              <Text style={styles.timelineValue}>
                {formatDateRange(prediction.predictedTimeframe.earliest, prediction.predictedTimeframe.latest)}
              </Text>
            </View>

            <View style={styles.predictionCosts}>
              <View style={styles.costItem}>
                <Text style={styles.costLabel}>Reparatiekosten</Text>
                <Text style={[styles.costValue, { color: Palette.error }]}>
                  €{prediction.estimatedRepairCost}
                </Text>
              </View>
              <View style={styles.costItem}>
                <Text style={styles.costLabel}>Preventiekosten</Text>
                <Text style={[styles.costValue, { color: Palette.success }]}>
                  €{prediction.preventionCost}
                </Text>
              </View>
              <View style={styles.costItem}>
                <Text style={styles.costLabel}>Besparing</Text>
                <Text style={[styles.costValue, { color: SemanticColors.primary }]}>
                  €{prediction.savingsIfPrevented}
                </Text>
              </View>
            </View>

            <View style={styles.predictionIndicators}>
              <Text style={styles.indicatorsLabel}>Indicatoren:</Text>
              {prediction.indicators.slice(0, 2).map((indicator, i) => (
                <View key={i} style={styles.indicatorItem}>
                  <Ionicons name="ellipse" size={6} color={SemanticColors.textSecondary} />
                  <Text style={styles.indicatorText}>{indicator}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.acknowledgeButton}
              onPress={() => acknowledge(prediction.id)}
            >
              <Ionicons name="checkmark-circle" size={18} color={SemanticColors.primary} />
              <Text style={styles.acknowledgeButtonText}>Gezien & Gepland</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}

      {predictions.filter(p => p.acknowledged).length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Bevestigd</Text>
          </View>
          {predictions
            .filter(p => p.acknowledged)
            .map(prediction => (
              <View key={prediction.id} style={[styles.predictionCard, styles.acknowledgedCard]}>
                <View style={styles.predictionHeader}>
                  <View
                    style={[
                      styles.probabilityCircle,
                      { backgroundColor: SemanticColors.border },
                    ]}
                  >
                    <Text style={[styles.probabilityValue, { color: SemanticColors.textSecondary }]}>
                      {prediction.probability}%
                    </Text>
                  </View>
                  <View style={styles.predictionInfo}>
                    <Text style={styles.predictionEquipment}>{prediction.equipmentName}</Text>
                    <Text style={styles.predictionComponent}>{prediction.component}</Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={24} color={Palette.success} />
                </View>
              </View>
            ))}
        </>
      )}
    </ScrollView>
  );

  const renderRecommendationsTab = () => (
    <ScrollView style={styles.tabContent}>
      {recommendations
        .filter(r => r.status === 'pending')
        .sort((a, b) => getPriorityOrder(a.priority) - getPriorityOrder(b.priority))
        .map(rec => (
          <View key={rec.id} style={styles.recommendationCard}>
            <View style={styles.recommendationHeader}>
              <View
                style={[
                  styles.priorityBadge,
                  { backgroundColor: getPriorityColor(rec.priority) + '20' },
                ]}
              >
                <Text style={[styles.priorityText, { color: getPriorityColor(rec.priority) }]}>
                  {getPriorityName(rec.priority)}
                </Text>
              </View>
              <View
                style={[
                  styles.typeBadge,
                  { backgroundColor: SemanticColors.card },
                ]}
              >
                <Ionicons name={getTypeIcon(rec.type)} size={14} color={SemanticColors.textSecondary} />
                <Text style={styles.typeText}>{getTypeName(rec.type)}</Text>
              </View>
            </View>

            <Text style={styles.recommendationTitle}>{rec.title}</Text>
            <Text style={styles.recommendationEquipment}>{rec.equipmentName}</Text>
            <Text style={styles.recommendationDescription}>{rec.description}</Text>

            <View style={styles.recommendationReasoning}>
              <Ionicons name="bulb" size={14} color={SemanticColors.primary} />
              <Text style={styles.reasoningText}>{rec.reasoning}</Text>
            </View>

            <View style={styles.recommendationMetrics}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Kosten</Text>
                <Text style={styles.metricValue}>€{rec.estimatedCost}</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Duur</Text>
                <Text style={styles.metricValue}>{rec.estimatedDuration}min</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Besparing</Text>
                <Text style={[styles.metricValue, { color: Palette.success }]}>
                  €{rec.potentialSavings}
                </Text>
              </View>
            </View>

            {rec.requiredParts.length > 0 && (
              <View style={styles.partsNeeded}>
                <Text style={styles.partsLabel}>Benodigde onderdelen:</Text>
                {rec.requiredParts.map((part, i) => (
                  <View key={i} style={styles.partItem}>
                    <Text style={styles.partName}>{part.name}</Text>
                    <View style={styles.partStatus}>
                      {part.inStock ? (
                        <Text style={styles.partInStock}>Op voorraad</Text>
                      ) : (
                        <Text style={styles.partOutStock}>Bestellen ({part.leadTime}d)</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.recommendationActions}>
              <TouchableOpacity
                style={styles.scheduleAction}
                onPress={() => schedule(rec.id, rec.recommendedDate)}
              >
                <Ionicons name="calendar" size={18} color={Palette.white} />
                <Text style={styles.scheduleActionText}>Inplannen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dismissAction}
                onPress={() => dismiss(rec.id)}
              >
                <Text style={styles.dismissActionText}>Negeren</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
    </ScrollView>
  );

  const renderPartsTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Onderdelen Bestellen</Text>
        <Text style={styles.sectionSubtitle}>
          {suggestions.filter(s => s.urgency === 'high').length} urgent
        </Text>
      </View>

      {suggestions
        .sort((a, b) => getUrgencyOrder(a.urgency) - getUrgencyOrder(b.urgency))
        .map(suggestion => (
          <View key={suggestion.id} style={styles.partOrderCard}>
            <View style={styles.partOrderHeader}>
              <View style={styles.partOrderInfo}>
                <Text style={styles.partOrderName}>{suggestion.partName}</Text>
                {suggestion.partNumber && (
                  <Text style={styles.partOrderNumber}>{suggestion.partNumber}</Text>
                )}
              </View>
              <View
                style={[
                  styles.urgencyBadge,
                  { backgroundColor: getUrgencyColor(suggestion.urgency) + '20' },
                ]}
              >
                <Text
                  style={[
                    styles.urgencyText,
                    { color: getUrgencyColor(suggestion.urgency) },
                  ]}
                >
                  {getUrgencyName(suggestion.urgency)}
                </Text>
              </View>
            </View>

            <Text style={styles.partOrderEquipment}>
              Voor: {suggestion.equipmentName}
            </Text>
            <Text style={styles.partOrderReason}>{suggestion.reason}</Text>

            <View style={styles.partOrderDetails}>
              <View style={styles.partOrderDetail}>
                <Text style={styles.partOrderDetailLabel}>Aantal</Text>
                <Text style={styles.partOrderDetailValue}>{suggestion.quantity}x</Text>
              </View>
              <View style={styles.partOrderDetail}>
                <Text style={styles.partOrderDetailLabel}>Prijs</Text>
                <Text style={styles.partOrderDetailValue}>
                  €{suggestion.supplierPrice || suggestion.estimatedCost}
                </Text>
              </View>
              <View style={styles.partOrderDetail}>
                <Text style={styles.partOrderDetailLabel}>Levertijd</Text>
                <Text style={styles.partOrderDetailValue}>{suggestion.leadTime} dagen</Text>
              </View>
            </View>

            <View style={styles.partOrderDates}>
              <View style={styles.orderDateItem}>
                <Text style={styles.orderDateLabel}>Bestel voor</Text>
                <Text
                  style={[
                    styles.orderDateValue,
                    suggestion.orderByDate < new Date() && { color: Palette.error },
                  ]}
                >
                  {suggestion.orderByDate.toLocaleDateString('nl-NL')}
                </Text>
              </View>
              <View style={styles.orderDateItem}>
                <Text style={styles.orderDateLabel}>Nodig op</Text>
                <Text style={styles.orderDateValue}>
                  {suggestion.predictedNeedDate.toLocaleDateString('nl-NL')}
                </Text>
              </View>
            </View>

            {suggestion.supplierName && (
              <View style={styles.supplierInfo}>
                <Ionicons name="storefront" size={14} color={SemanticColors.textSecondary} />
                <Text style={styles.supplierName}>{suggestion.supplierName}</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.orderButton}
              onPress={() => order(suggestion.id)}
            >
              <Ionicons name="cart" size={18} color={Palette.white} />
              <Text style={styles.orderButtonText}>Bestellen</Text>
            </TouchableOpacity>
          </View>
        ))}

      {suggestions.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle" size={48} color={Palette.success} />
          <Text style={styles.emptyText}>Alle onderdelen op voorraad</Text>
        </View>
      )}
    </ScrollView>
  );

  const renderEquipmentModal = () => (
    <Modal
      visible={showEquipmentModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowEquipmentModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowEquipmentModal(false)}>
            <Ionicons name="close" size={24} color={SemanticColors.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Gezondheidsdetails</Text>
          <View style={{ width: 24 }} />
        </View>

        {selectedEquipment && (
          <ScrollView style={styles.modalContent}>
            <View style={styles.healthProfileHeader}>
              <View
                style={[
                  styles.healthScoreCircleLarge,
                  { borderColor: getHealthColor(selectedEquipment.healthScore) },
                ]}
              >
                <Text
                  style={[
                    styles.healthScoreValueLarge,
                    { color: getHealthColor(selectedEquipment.healthScore) },
                  ]}
                >
                  {selectedEquipment.healthScore}
                </Text>
                <Text style={styles.healthScoreLabelLarge}>score</Text>
              </View>
              <Text style={styles.healthProfileName}>{selectedEquipment.equipmentName}</Text>
              <View
                style={[
                  styles.riskBadgeLarge,
                  { backgroundColor: getRiskColor(selectedEquipment.riskLevel) + '20' },
                ]}
              >
                <Text
                  style={[
                    styles.riskTextLarge,
                    { color: getRiskColor(selectedEquipment.riskLevel) },
                  ]}
                >
                  {getRiskLevelName(selectedEquipment.riskLevel)} risico
                </Text>
              </View>
            </View>

            <View style={styles.factorsSection}>
              <Text style={styles.factorsSectionTitle}>Gezondheidsfactoren</Text>
              {selectedEquipment.factors.map((factor, i) => (
                <View key={i} style={styles.factorDetail}>
                  <View style={styles.factorDetailHeader}>
                    <Text style={styles.factorDetailName}>{factor.name}</Text>
                    <Text
                      style={[
                        styles.factorDetailValue,
                        { color: getFactorColor(factor.status) },
                      ]}
                    >
                      {factor.value}%
                    </Text>
                  </View>
                  <View style={styles.factorDetailProgress}>
                    <View
                      style={[
                        styles.factorDetailFill,
                        {
                          width: `${factor.value}%`,
                          backgroundColor: getFactorColor(factor.status),
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.factorDetailDescription}>{factor.description}</Text>
                </View>
              ))}
            </View>

            <View style={styles.lastAssessment}>
              <Text style={styles.lastAssessmentLabel}>Laatste analyse</Text>
              <Text style={styles.lastAssessmentValue}>
                {selectedEquipment.lastAssessment.toLocaleString('nl-NL')}
              </Text>
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );

  const renderPredictionModal = () => (
    <Modal
      visible={showPredictionModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowPredictionModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowPredictionModal(false)}>
            <Ionicons name="close" size={24} color={SemanticColors.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Voorspelling Details</Text>
          <View style={{ width: 24 }} />
        </View>

        {selectedPrediction && (
          <ScrollView style={styles.modalContent}>
            <View style={styles.predictionProfile}>
              <View
                style={[
                  styles.probabilityCircleLarge,
                  { backgroundColor: getProbabilityColor(selectedPrediction.probability) + '20' },
                ]}
              >
                <Text
                  style={[
                    styles.probabilityValueLarge,
                    { color: getProbabilityColor(selectedPrediction.probability) },
                  ]}
                >
                  {selectedPrediction.probability}%
                </Text>
                <Text style={styles.probabilityLabelLarge}>faalkans</Text>
              </View>
              <Text style={styles.predictionProfileName}>
                {selectedPrediction.equipmentName}
              </Text>
              <Text style={styles.predictionProfileComponent}>
                {selectedPrediction.component} - {selectedPrediction.failureType}
              </Text>
            </View>

            <View style={styles.predictionSection}>
              <Text style={styles.predictionSectionTitle}>Verwachte Periode</Text>
              <View style={styles.timeframeRow}>
                <View style={styles.timeframeItem}>
                  <Text style={styles.timeframeLabel}>Vroegst</Text>
                  <Text style={styles.timeframeValue}>
                    {selectedPrediction.predictedTimeframe.earliest.toLocaleDateString('nl-NL')}
                  </Text>
                </View>
                <View style={[styles.timeframeItem, styles.timeframeMain]}>
                  <Text style={styles.timeframeLabel}>Meest waarschijnlijk</Text>
                  <Text style={[styles.timeframeValue, styles.timeframeMainValue]}>
                    {selectedPrediction.predictedTimeframe.mostLikely.toLocaleDateString('nl-NL')}
                  </Text>
                </View>
                <View style={styles.timeframeItem}>
                  <Text style={styles.timeframeLabel}>Laatst</Text>
                  <Text style={styles.timeframeValue}>
                    {selectedPrediction.predictedTimeframe.latest.toLocaleDateString('nl-NL')}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.predictionSection}>
              <Text style={styles.predictionSectionTitle}>Indicatoren</Text>
              {selectedPrediction.indicators.map((indicator, i) => (
                <View key={i} style={styles.indicatorRow}>
                  <Ionicons name="alert-circle" size={16} color={Palette.warning} />
                  <Text style={styles.indicatorRowText}>{indicator}</Text>
                </View>
              ))}
            </View>

            <View style={styles.predictionSection}>
              <Text style={styles.predictionSectionTitle}>Kostenanalyse</Text>
              <View style={styles.costComparison}>
                <View style={[styles.costBox, styles.costBoxBad]}>
                  <Text style={styles.costBoxLabel}>Bij storing</Text>
                  <Text style={styles.costBoxValue}>€{selectedPrediction.estimatedRepairCost}</Text>
                  <Text style={styles.costBoxSub}>+ {selectedPrediction.estimatedDowntime}u downtime</Text>
                </View>
                <View style={[styles.costBox, styles.costBoxGood]}>
                  <Text style={styles.costBoxLabel}>Preventief</Text>
                  <Text style={styles.costBoxValue}>€{selectedPrediction.preventionCost}</Text>
                  <Text style={styles.costBoxSub}>Bespaar €{selectedPrediction.savingsIfPrevented}</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.modalPrimaryAction}
              onPress={() => {
                acknowledge(selectedPrediction.id);
                setShowPredictionModal(false);
              }}
            >
              <Ionicons name="shield-checkmark" size={20} color={Palette.white} />
              <Text style={styles.modalPrimaryActionText}>Preventief Onderhoud Plannen</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Predictive Maintenance</Text>
        <Text style={styles.subtitle}>AI-gestuurde onderhoudsvoor­spellingen</Text>
      </View>

      {renderStatsBar()}

      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.activeTab]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Ionicons
              name={tab.icon as any}
              size={18}
              color={activeTab === tab.id ? SemanticColors.primary : SemanticColors.textSecondary}
            />
            <Text
              style={[
                styles.tabLabel,
                activeTab === tab.id && styles.activeTabLabel,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'overview' && renderOverviewTab()}
      {activeTab === 'predictions' && renderPredictionsTab()}
      {activeTab === 'recommendations' && renderRecommendationsTab()}
      {activeTab === 'parts' && renderPartsTab()}

      {renderEquipmentModal()}
      {renderPredictionModal()}
    </View>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function getHealthColor(score: number): string {
  if (score >= 80) return Palette.success;
  if (score >= 60) return Palette.warning;
  return Palette.error;
}

function getRiskColor(level: string): string {
  const colors: Record<string, string> = {
    low: Palette.success,
    medium: Palette.warning,
    high: Palette.error,
    critical: Palette.error,
  };
  return colors[level] || SemanticColors.textSecondary;
}

function getRiskLevelName(level: string): string {
  const names: Record<string, string> = {
    low: 'Laag',
    medium: 'Gemiddeld',
    high: 'Hoog',
    critical: 'Kritiek',
  };
  return names[level] || level;
}

function getFactorColor(status: string): string {
  const colors: Record<string, string> = {
    good: Palette.success,
    warning: Palette.warning,
    critical: Palette.error,
  };
  return colors[status] || SemanticColors.textSecondary;
}

function getCategoryName(category: string): string {
  const names: Record<string, string> = {
    power_tools: 'Elektrisch gereedschap',
    vehicles: 'Voertuigen',
    diagnostic: 'Diagnose apparatuur',
  };
  return names[category] || category;
}

function getProbabilityColor(probability: number): string {
  if (probability >= 70) return Palette.error;
  if (probability >= 40) return Palette.warning;
  return Palette.info;
}

function getImpactColor(impact: string): string {
  const colors: Record<string, string> = {
    low: Palette.success,
    medium: Palette.warning,
    high: Palette.error,
    critical: Palette.error,
  };
  return colors[impact] || SemanticColors.textSecondary;
}

function getImpactName(impact: string): string {
  const names: Record<string, string> = {
    low: 'Laag',
    medium: 'Gemiddeld',
    high: 'Hoog',
    critical: 'Kritiek',
  };
  return names[impact] || impact;
}

function formatDateRange(start: Date, end: Date): string {
  return `${start.toLocaleDateString('nl-NL')} - ${end.toLocaleDateString('nl-NL')}`;
}

function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    low: Palette.info,
    medium: Palette.warning,
    high: Palette.error,
    urgent: Palette.error,
  };
  return colors[priority] || SemanticColors.textSecondary;
}

function getPriorityName(priority: string): string {
  const names: Record<string, string> = {
    low: 'Laag',
    medium: 'Gemiddeld',
    high: 'Hoog',
    urgent: 'Urgent',
  };
  return names[priority] || priority;
}

function getPriorityOrder(priority: string): number {
  const order: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  return order[priority] ?? 4;
}

function getTypeIcon(type: string): any {
  const icons: Record<string, string> = {
    preventive: 'shield',
    predictive: 'analytics',
    corrective: 'hammer',
    improvement: 'trending-up',
  };
  return icons[type] || 'construct';
}

function getTypeName(type: string): string {
  const names: Record<string, string> = {
    preventive: 'Preventief',
    predictive: 'Predictief',
    corrective: 'Correctief',
    improvement: 'Verbetering',
  };
  return names[type] || type;
}

function getUrgencyColor(urgency: string): string {
  const colors: Record<string, string> = {
    low: Palette.info,
    medium: Palette.warning,
    high: Palette.error,
  };
  return colors[urgency] || SemanticColors.textSecondary;
}

function getUrgencyName(urgency: string): string {
  const names: Record<string, string> = {
    low: 'Laag',
    medium: 'Gemiddeld',
    high: 'Urgent',
  };
  return names[urgency] || urgency;
}

function getUrgencyOrder(urgency: string): number {
  const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
  return order[urgency] ?? 3;
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.background,
  },
  header: {
    padding: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: SemanticColors.text,
  },
  subtitle: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  statsBar: {
    maxHeight: 80,
  },
  statsBarContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  statItem: {
    backgroundColor: SemanticColors.card,
    padding: 12,
    borderRadius: 12,
    minWidth: 90,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.text,
  },
  statLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  warningValue: {
    color: Palette.error,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: SemanticColors.card,
    gap: 4,
  },
  activeTab: {
    backgroundColor: SemanticColors.primary + '15',
  },
  tabLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    fontWeight: '500',
  },
  activeTabLabel: {
    color: SemanticColors.primary,
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  savingsCard: {
    backgroundColor: Palette.success + '15',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  savingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  savingsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  savingsMain: {
    alignItems: 'center',
    marginBottom: 16,
  },
  savingsAmount: {
    fontSize: 40,
    fontWeight: '700',
    color: Palette.success,
  },
  savingsPercentage: {
    fontSize: 14,
    color: Palette.success,
    marginTop: 4,
  },
  savingsDetails: {
    flexDirection: 'row',
  },
  savingsDetail: {
    flex: 1,
    alignItems: 'center',
  },
  savingsDetailLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  savingsDetailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.text,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  sectionLink: {
    fontSize: 14,
    color: SemanticColors.primary,
    fontWeight: '500',
  },
  healthCard: {
    backgroundColor: SemanticColors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  healthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  healthInfo: {
    flex: 1,
  },
  healthName: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  healthCategory: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  healthScoreContainer: {
    alignItems: 'center',
  },
  healthScoreCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthScoreValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  trendIndicator: {
    marginTop: 4,
  },
  healthFactors: {
    gap: 8,
  },
  factorBar: {
    gap: 4,
  },
  factorInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  factorName: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  factorValue: {
    fontSize: 12,
    fontWeight: '500',
    color: SemanticColors.text,
  },
  factorProgress: {
    height: 4,
    backgroundColor: SemanticColors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  factorFill: {
    height: '100%',
    borderRadius: 2,
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 12,
    gap: 6,
  },
  riskText: {
    fontSize: 12,
    fontWeight: '600',
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 10,
    backgroundColor: SemanticColors.primary + '15',
    borderRadius: 10,
    gap: 6,
  },
  analyzeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: SemanticColors.primary,
  },
  predictionCard: {
    backgroundColor: SemanticColors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  acknowledgedCard: {
    opacity: 0.7,
  },
  predictionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  probabilityCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  probabilityValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  probabilityLabel: {
    fontSize: 10,
    color: SemanticColors.textSecondary,
  },
  predictionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  predictionEquipment: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  predictionComponent: {
    fontSize: 14,
    color: SemanticColors.text,
    marginTop: 2,
  },
  predictionType: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  impactBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  impactText: {
    fontSize: 11,
    fontWeight: '600',
  },
  predictionTimeline: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  timelineLabel: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  timelineValue: {
    fontSize: 13,
    fontWeight: '500',
    color: SemanticColors.text,
  },
  predictionCosts: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.border,
  },
  costItem: {
    flex: 1,
    alignItems: 'center',
  },
  costLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  costValue: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 2,
  },
  predictionIndicators: {
    marginTop: 12,
  },
  indicatorsLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: SemanticColors.textSecondary,
    marginBottom: 6,
  },
  indicatorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  indicatorText: {
    fontSize: 13,
    color: SemanticColors.text,
  },
  acknowledgeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 10,
    backgroundColor: SemanticColors.primary + '15',
    borderRadius: 10,
    gap: 6,
  },
  acknowledgeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.primary,
  },
  recommendationCard: {
    backgroundColor: SemanticColors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  recommendationHeader: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  typeText: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  recommendationTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  recommendationEquipment: {
    fontSize: 14,
    color: SemanticColors.primary,
    marginTop: 4,
  },
  recommendationDescription: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginTop: 8,
    lineHeight: 20,
  },
  recommendationReasoning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: SemanticColors.primary + '10',
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
    gap: 8,
  },
  reasoningText: {
    flex: 1,
    fontSize: 13,
    color: SemanticColors.primary,
    lineHeight: 18,
  },
  recommendationMetrics: {
    flexDirection: 'row',
    marginTop: 12,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.text,
    marginTop: 2,
  },
  partsNeeded: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.border,
  },
  partsLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: SemanticColors.textSecondary,
    marginBottom: 8,
  },
  partItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  partName: {
    fontSize: 14,
    color: SemanticColors.text,
  },
  partStatus: {},
  partInStock: {
    fontSize: 12,
    color: Palette.success,
    fontWeight: '500',
  },
  partOutStock: {
    fontSize: 12,
    color: Palette.warning,
    fontWeight: '500',
  },
  recommendationActions: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 10,
  },
  scheduleAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  scheduleActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: Palette.white,
  },
  dismissAction: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  dismissActionText: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  partOrderCard: {
    backgroundColor: SemanticColors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  partOrderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  partOrderInfo: {
    flex: 1,
  },
  partOrderName: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  partOrderNumber: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  urgencyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  urgencyText: {
    fontSize: 11,
    fontWeight: '600',
  },
  partOrderEquipment: {
    fontSize: 13,
    color: SemanticColors.primary,
    marginTop: 8,
  },
  partOrderReason: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  partOrderDetails: {
    flexDirection: 'row',
    marginTop: 12,
  },
  partOrderDetail: {
    flex: 1,
    alignItems: 'center',
  },
  partOrderDetailLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  partOrderDetailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.text,
    marginTop: 2,
  },
  partOrderDates: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.border,
  },
  orderDateItem: {
    flex: 1,
  },
  orderDateLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  orderDateValue: {
    fontSize: 14,
    fontWeight: '500',
    color: SemanticColors.text,
    marginTop: 2,
  },
  supplierInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
  },
  supplierName: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  orderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 12,
    gap: 6,
  },
  orderButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Palette.white,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 15,
    color: SemanticColors.textSecondary,
    marginTop: 12,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: SemanticColors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  healthProfileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  healthScoreCircleLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthScoreValueLarge: {
    fontSize: 36,
    fontWeight: '700',
  },
  healthScoreLabelLarge: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  healthProfileName: {
    fontSize: 20,
    fontWeight: '600',
    color: SemanticColors.text,
    marginTop: 16,
  },
  riskBadgeLarge: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  riskTextLarge: {
    fontSize: 14,
    fontWeight: '600',
  },
  factorsSection: {
    backgroundColor: SemanticColors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  factorsSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.text,
    marginBottom: 16,
  },
  factorDetail: {
    marginBottom: 16,
  },
  factorDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  factorDetailName: {
    fontSize: 14,
    fontWeight: '500',
    color: SemanticColors.text,
  },
  factorDetailValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  factorDetailProgress: {
    height: 6,
    backgroundColor: SemanticColors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  factorDetailFill: {
    height: '100%',
    borderRadius: 3,
  },
  factorDetailDescription: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  lastAssessment: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
  },
  lastAssessmentLabel: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  lastAssessmentValue: {
    fontSize: 14,
    fontWeight: '500',
    color: SemanticColors.text,
  },
  predictionProfile: {
    alignItems: 'center',
    marginBottom: 24,
  },
  probabilityCircleLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  probabilityValueLarge: {
    fontSize: 32,
    fontWeight: '700',
  },
  probabilityLabelLarge: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  predictionProfileName: {
    fontSize: 20,
    fontWeight: '600',
    color: SemanticColors.text,
    marginTop: 16,
  },
  predictionProfileComponent: {
    fontSize: 15,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  predictionSection: {
    backgroundColor: SemanticColors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  predictionSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.text,
    marginBottom: 12,
  },
  timeframeRow: {
    flexDirection: 'row',
  },
  timeframeItem: {
    flex: 1,
    alignItems: 'center',
  },
  timeframeMain: {
    backgroundColor: SemanticColors.primary + '10',
    padding: 8,
    borderRadius: 10,
  },
  timeframeLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  timeframeValue: {
    fontSize: 13,
    fontWeight: '500',
    color: SemanticColors.text,
    marginTop: 2,
  },
  timeframeMainValue: {
    color: SemanticColors.primary,
    fontWeight: '600',
  },
  indicatorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  indicatorRowText: {
    flex: 1,
    fontSize: 14,
    color: SemanticColors.text,
    lineHeight: 20,
  },
  costComparison: {
    flexDirection: 'row',
    gap: 12,
  },
  costBox: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  costBoxBad: {
    backgroundColor: Palette.error + '10',
  },
  costBoxGood: {
    backgroundColor: Palette.success + '10',
  },
  costBoxLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  costBoxValue: {
    fontSize: 22,
    fontWeight: '700',
    color: SemanticColors.text,
    marginTop: 4,
  },
  costBoxSub: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  modalPrimaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  modalPrimaryActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: Palette.white,
  },
});

export default PredictiveMaintenance;

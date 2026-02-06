// =============================================================================
// PREDICTIVE PROJECT PLANNER COMPONENT
// =============================================================================
// AI-powered project planning with duration prediction and resource optimization
// =============================================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import {
  useProjectPlanner,
  ProjectPrediction,
  MaterialPrediction,
  CapacityForecast,
  ProjectTemplate,
} from '../../services/projectPlannerService';

type TabType = 'predict' | 'materials' | 'capacity' | 'templates';

export function ProjectPlanner() {
  const [activeTab, setActiveTab] = useState<TabType>('predict');
  const [showPredictModal, setShowPredictModal] = useState(false);
  const [selectedProjectType, setSelectedProjectType] = useState('Schilderwerk');
  const [selectedScope, setSelectedScope] = useState<'small' | 'medium' | 'large'>('medium');
  const [isOutdoor, setIsOutdoor] = useState(false);

  const {
    prediction,
    materials,
    predictProject,
    predictMaterials,
    templates,
    capacityForecast,
  } = useProjectPlanner();

  const projectTypes = ['Schilderwerk', 'Badkamerrenovatie', 'Keukenrenovatie', 'Tegelen'];
  const scopes = [
    { key: 'small' as const, label: 'Klein', description: 'Enkele ruimte' },
    { key: 'medium' as const, label: 'Middel', description: 'Meerdere ruimtes' },
    { key: 'large' as const, label: 'Groot', description: 'Complete woning' },
  ];

  const tabs: Array<{ key: TabType; label: string; icon: string }> = [
    { key: 'predict', label: 'Voorspel', icon: 'analytics-outline' },
    { key: 'materials', label: 'Materialen', icon: 'cube-outline' },
    { key: 'capacity', label: 'Capaciteit', icon: 'calendar-outline' },
    { key: 'templates', label: 'Templates', icon: 'document-outline' },
  ];

  const handlePredict = () => {
    predictProject({
      type: selectedProjectType,
      scope: selectedScope,
      location: 'Amsterdam',
      isOutdoor,
    });
    predictMaterials(selectedProjectType, selectedScope);
    setShowPredictModal(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  };

  const getFactorIcon = (impact: string) => {
    switch (impact) {
      case 'positive': return { name: 'arrow-up-circle', color: Palette.green500 };
      case 'negative': return { name: 'arrow-down-circle', color: Palette.red500 };
      default: return { name: 'remove-circle', color: Palette.gray500 };
    }
  };

  const renderPredictionCard = (pred: ProjectPrediction) => (
    <View style={styles.predictionCard}>
      <View style={styles.predictionHeader}>
        <View>
          <Text style={styles.predictionType}>{pred.projectType}</Text>
          <Text style={styles.predictionConfidence}>
            {Math.round(pred.confidence * 100)}% betrouwbaarheid
          </Text>
        </View>
        <View style={styles.durationBadge}>
          <Text style={styles.durationValue}>{pred.estimatedDuration}</Text>
          <Text style={styles.durationUnit}>dagen</Text>
        </View>
      </View>

      <View style={styles.durationRange}>
        <Text style={styles.rangeLabel}>Geschatte doorlooptijd</Text>
        <View style={styles.rangeBar}>
          <View style={styles.rangeTrack}>
            <View
              style={[
                styles.rangeFill,
                {
                  left: `${((pred.durationRange.min - pred.durationRange.min + 1) / (pred.durationRange.max - pred.durationRange.min + 2)) * 100}%`,
                  width: `${((pred.estimatedDuration - pred.durationRange.min) / (pred.durationRange.max - pred.durationRange.min + 2)) * 100}%`,
                },
              ]}
            />
          </View>
        </View>
        <View style={styles.rangeLabels}>
          <Text style={styles.rangeLabelText}>{pred.durationRange.min} dagen</Text>
          <Text style={styles.rangeLabelText}>{pred.durationRange.max} dagen</Text>
        </View>
      </View>

      <View style={styles.dateRow}>
        <View style={styles.dateItem}>
          <Ionicons name="calendar-outline" size={16} color={Palette.green500} />
          <Text style={styles.dateLabel}>Start</Text>
          <Text style={styles.dateValue}>{formatDate(pred.suggestedStartDate)}</Text>
        </View>
        <Ionicons name="arrow-forward" size={16} color={SemanticColors.textSecondary} />
        <View style={styles.dateItem}>
          <Ionicons name="flag-outline" size={16} color={Palette.blue500} />
          <Text style={styles.dateLabel}>Einde</Text>
          <Text style={styles.dateValue}>{formatDate(pred.suggestedEndDate)}</Text>
        </View>
      </View>

      {pred.weatherRisk > 15 && (
        <View style={styles.weatherWarning}>
          <Ionicons name="rainy-outline" size={18} color={Palette.orange500} />
          <Text style={styles.weatherText}>
            {pred.weatherRisk}% kans op weer-gerelateerde vertraging
          </Text>
        </View>
      )}

      <View style={styles.factorsSection}>
        <Text style={styles.factorsTitle}>Factoren</Text>
        {pred.factors.map((factor, index) => {
          const icon = getFactorIcon(factor.impact);
          return (
            <View key={index} style={styles.factorRow}>
              <Ionicons name={icon.name as any} size={18} color={icon.color} />
              <View style={styles.factorContent}>
                <Text style={styles.factorName}>{factor.name}</Text>
                <Text style={styles.factorDesc}>{factor.description}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );

  const renderPredictTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <TouchableOpacity
        style={styles.predictButton}
        onPress={() => setShowPredictModal(true)}
      >
        <Ionicons name="add-circle-outline" size={24} color={Palette.blue500} />
        <View style={styles.predictButtonContent}>
          <Text style={styles.predictButtonTitle}>Nieuw project voorspellen</Text>
          <Text style={styles.predictButtonSubtitle}>
            Krijg AI-voorspellingen voor doorlooptijd en materialen
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={SemanticColors.textSecondary} />
      </TouchableOpacity>

      {prediction ? (
        renderPredictionCard(prediction)
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="analytics-outline" size={48} color={SemanticColors.textSecondary} />
          <Text style={styles.emptyTitle}>Geen voorspellingen</Text>
          <Text style={styles.emptyText}>
            Start een nieuwe voorspelling om AI-gestuurde projectplanningen te krijgen.
          </Text>
        </View>
      )}
    </ScrollView>
  );

  const renderMaterialCard = (material: MaterialPrediction) => (
    <View key={material.materialId} style={styles.materialCard}>
      <View style={styles.materialHeader}>
        <Text style={styles.materialName}>{material.materialName}</Text>
        <Text style={styles.materialCost}>€{material.estimatedCost}</Text>
      </View>

      <View style={styles.materialDetails}>
        <View style={styles.materialDetail}>
          <Text style={styles.detailLabel}>Hoeveelheid</Text>
          <Text style={styles.detailValue}>
            {material.estimatedQuantity}
            <Text style={styles.detailRange}>
              {' '}({material.quantityRange.min}-{material.quantityRange.max})
            </Text>
          </Text>
        </View>
        <View style={styles.materialDetail}>
          <Text style={styles.detailLabel}>Levertijd</Text>
          <Text style={styles.detailValue}>{material.leadTime} dag(en)</Text>
        </View>
        <View style={styles.materialDetail}>
          <Text style={styles.detailLabel}>Zekerheid</Text>
          <Text style={[styles.detailValue, { color: material.confidence > 0.8 ? Palette.green500 : Palette.orange500 }]}>
            {Math.round(material.confidence * 100)}%
          </Text>
        </View>
      </View>

      <View style={styles.confidenceBar}>
        <View style={[styles.confidenceFill, { width: `${material.confidence * 100}%` }]} />
      </View>
    </View>
  );

  const renderMaterialsTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {materials.length > 0 ? (
        <>
          <View style={styles.materialsSummary}>
            <Text style={styles.summaryTitle}>Geschatte totaalkosten</Text>
            <Text style={styles.summaryValue}>
              €{materials.reduce((sum, m) => sum + m.estimatedCost, 0)}
            </Text>
            <Text style={styles.summaryNote}>
              Gebaseerd op {selectedProjectType} ({selectedScope})
            </Text>
          </View>

          {materials.map(renderMaterialCard)}
        </>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="cube-outline" size={48} color={SemanticColors.textSecondary} />
          <Text style={styles.emptyTitle}>Geen materialen</Text>
          <Text style={styles.emptyText}>
            Maak eerst een projectvoorspelling om materiaalschattingen te zien.
          </Text>
        </View>
      )}
    </ScrollView>
  );

  const renderCapacityBar = (forecast: CapacityForecast) => {
    const utilizationColor =
      forecast.utilization > 90 ? Palette.red500 :
      forecast.utilization > 70 ? Palette.orange500 :
      Palette.green500;

    return (
      <View key={forecast.week} style={styles.capacityRow}>
        <Text style={styles.capacityWeek}>{forecast.week}</Text>
        <View style={styles.capacityBarContainer}>
          <View style={styles.capacityBar}>
            <View
              style={[styles.capacityFill, { width: `${forecast.utilization}%`, backgroundColor: utilizationColor }]}
            />
          </View>
          <Text style={styles.capacityHours}>{forecast.booked}/{forecast.capacity}u</Text>
        </View>
        <Text style={[styles.capacityPercent, { color: utilizationColor }]}>
          {forecast.utilization}%
        </Text>
      </View>
    );
  };

  const renderCapacityTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.capacityHeader}>
        <Text style={styles.sectionTitle}>Capaciteitsoverzicht</Text>
        <Text style={styles.capacitySubtitle}>Komende 8 weken</Text>
      </View>

      <View style={styles.capacityLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Palette.green500 }]} />
          <Text style={styles.legendText}>Beschikbaar (&lt;70%)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Palette.orange500 }]} />
          <Text style={styles.legendText}>Druk (70-90%)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Palette.red500 }]} />
          <Text style={styles.legendText}>Vol (&gt;90%)</Text>
        </View>
      </View>

      <View style={styles.capacityList}>
        {capacityForecast.map(renderCapacityBar)}
      </View>

      <View style={styles.capacityTip}>
        <Ionicons name="bulb-outline" size={18} color={Palette.blue500} />
        <Text style={styles.capacityTipText}>
          Tip: Weken met minder dan 70% bezetting zijn ideaal voor nieuwe projecten.
        </Text>
      </View>
    </ScrollView>
  );

  const renderTemplateCard = (template: ProjectTemplate) => (
    <TouchableOpacity key={template.id} style={styles.templateCard}>
      <View style={styles.templateHeader}>
        <View style={styles.templateIcon}>
          <Ionicons name="document-text-outline" size={24} color={Palette.blue500} />
        </View>
        <View style={styles.templateInfo}>
          <Text style={styles.templateName}>{template.name}</Text>
          <Text style={styles.templateCategory}>{template.category}</Text>
        </View>
      </View>

      <View style={styles.templateStats}>
        <View style={styles.templateStat}>
          <Text style={styles.templateStatValue}>{template.avgDuration} dagen</Text>
          <Text style={styles.templateStatLabel}>Gem. duur</Text>
        </View>
        <View style={styles.templateStat}>
          <Text style={styles.templateStatValue}>{template.historicalData.completedCount}</Text>
          <Text style={styles.templateStatLabel}>Projecten</Text>
        </View>
        <View style={styles.templateStat}>
          <Text style={[styles.templateStatValue, { color: Palette.green500 }]}>
            {template.historicalData.onTimeRate}%
          </Text>
          <Text style={styles.templateStatLabel}>Op tijd</Text>
        </View>
      </View>

      <View style={styles.templatePhases}>
        <Text style={styles.phasesTitle}>Fases</Text>
        <View style={styles.phasesTimeline}>
          {template.phases.map((phase, index) => (
            <View key={phase.order} style={styles.phaseItem}>
              <View style={styles.phaseDot} />
              {index < template.phases.length - 1 && <View style={styles.phaseLine} />}
              <Text style={styles.phaseName}>{phase.name}</Text>
              <Text style={styles.phaseDuration}>{phase.duration}d</Text>
            </View>
          ))}
        </View>
      </View>

      <TouchableOpacity style={styles.useTemplateButton}>
        <Text style={styles.useTemplateText}>Gebruik template</Text>
        <Ionicons name="arrow-forward" size={16} color={Palette.blue500} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderTemplatesTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.templateIntro}>
        Templates op basis van je voltooide projecten met bewezen doorlooptijden.
      </Text>

      {templates.map(renderTemplateCard)}
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
              color={activeTab === tab.key ? Palette.blue500 : SemanticColors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {activeTab === 'predict' && renderPredictTab()}
      {activeTab === 'materials' && renderMaterialsTab()}
      {activeTab === 'capacity' && renderCapacityTab()}
      {activeTab === 'templates' && renderTemplatesTab()}

      {/* Predict Modal */}
      <Modal
        visible={showPredictModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPredictModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowPredictModal(false)}>
              <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Project voorspellen</Text>
            <TouchableOpacity onPress={handlePredict}>
              <Text style={styles.modalAction}>Voorspel</Text>
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
              {scopes.map((scope) => (
                <TouchableOpacity
                  key={scope.key}
                  style={[styles.scopeOption, selectedScope === scope.key && styles.scopeOptionSelected]}
                  onPress={() => setSelectedScope(scope.key)}
                >
                  <Text style={[styles.scopeLabel, selectedScope === scope.key && styles.scopeLabelSelected]}>
                    {scope.label}
                  </Text>
                  <Text style={[styles.scopeDesc, selectedScope === scope.key && styles.scopeDescSelected]}>
                    {scope.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Outdoor Toggle */}
            <TouchableOpacity
              style={styles.outdoorToggle}
              onPress={() => setIsOutdoor(!isOutdoor)}
            >
              <Ionicons
                name={isOutdoor ? 'checkbox' : 'square-outline'}
                size={24}
                color={isOutdoor ? Palette.blue500 : SemanticColors.textSecondary}
              />
              <View style={styles.outdoorContent}>
                <Text style={styles.outdoorLabel}>Buitenwerk</Text>
                <Text style={styles.outdoorHint}>Weersafhankelijke werkzaamheden</Text>
              </View>
            </TouchableOpacity>
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
    borderRadius: 8,
    gap: 4,
  },
  activeTab: {
    backgroundColor: Palette.blue500 + '15',
  },
  tabText: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    fontWeight: '500',
  },
  activeTabText: {
    color: Palette.blue500,
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },

  // Predict Button
  predictButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 12,
  },
  predictButtonContent: {
    flex: 1,
  },
  predictButtonTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  predictButtonSubtitle: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },

  // Prediction Card
  predictionCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  predictionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  predictionType: {
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  predictionConfidence: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  durationBadge: {
    backgroundColor: Palette.blue500,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  durationValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  durationUnit: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
  },

  // Duration Range
  durationRange: {
    marginBottom: 16,
  },
  rangeLabel: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginBottom: 8,
  },
  rangeBar: {
    height: 8,
    backgroundColor: SemanticColors.borderDefault,
    borderRadius: 4,
    marginBottom: 4,
  },
  rangeTrack: {
    height: '100%',
    borderRadius: 4,
    overflow: 'hidden',
  },
  rangeFill: {
    position: 'absolute',
    height: '100%',
    backgroundColor: Palette.blue500,
    borderRadius: 4,
  },
  rangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rangeLabelText: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },

  // Date Row
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  dateItem: {
    alignItems: 'center',
    gap: 4,
  },
  dateLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },

  // Weather Warning
  weatherWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.orange500 + '15',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  weatherText: {
    flex: 1,
    fontSize: 13,
    color: Palette.orange500,
  },

  // Factors
  factorsSection: {
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
    paddingTop: 16,
  },
  factorsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: 12,
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 10,
  },
  factorContent: {
    flex: 1,
  },
  factorName: {
    fontSize: 14,
    fontWeight: '500',
    color: SemanticColors.textPrimary,
  },
  factorDesc: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 1,
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
    color: SemanticColors.textPrimary,
    marginTop: 12,
  },
  emptyText: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  // Materials Tab
  materialsSummary: {
    backgroundColor: Palette.green500,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  summaryTitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginVertical: 4,
  },
  summaryNote: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  materialCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  materialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  materialName: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  materialCost: {
    fontSize: 16,
    fontWeight: '600',
    color: Palette.blue500,
  },
  materialDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  materialDetail: {},
  detailLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: SemanticColors.textPrimary,
  },
  detailRange: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  confidenceBar: {
    height: 4,
    backgroundColor: SemanticColors.borderDefault,
    borderRadius: 2,
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: Palette.green500,
    borderRadius: 2,
  },

  // Capacity Tab
  capacityHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  capacitySubtitle: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  capacityLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
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
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  capacityList: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  capacityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  capacityWeek: {
    width: 60,
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  capacityBarContainer: {
    flex: 1,
    marginHorizontal: 8,
  },
  capacityBar: {
    height: 8,
    backgroundColor: SemanticColors.borderDefault,
    borderRadius: 4,
  },
  capacityFill: {
    height: '100%',
    borderRadius: 4,
  },
  capacityHours: {
    fontSize: 10,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  capacityPercent: {
    width: 40,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '600',
  },
  capacityTip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.blue500 + '15',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    gap: 10,
  },
  capacityTipText: {
    flex: 1,
    fontSize: 13,
    color: SemanticColors.textPrimary,
    lineHeight: 18,
  },

  // Templates Tab
  templateIntro: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  templateCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  templateIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Palette.blue500 + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  templateCategory: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  templateStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  templateStat: {
    alignItems: 'center',
  },
  templateStatValue: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  templateStatLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  templatePhases: {
    marginBottom: 16,
  },
  phasesTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: 8,
  },
  phasesTimeline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  phaseItem: {
    alignItems: 'center',
    marginRight: 16,
  },
  phaseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Palette.blue500,
  },
  phaseLine: {
    position: 'absolute',
    top: 4,
    left: 10,
    width: 20,
    height: 2,
    backgroundColor: SemanticColors.borderDefault,
  },
  phaseName: {
    fontSize: 11,
    color: SemanticColors.textPrimary,
    marginTop: 4,
  },
  phaseDuration: {
    fontSize: 10,
    color: SemanticColors.textSecondary,
  },
  useTemplateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
    gap: 6,
  },
  useTemplateText: {
    fontSize: 14,
    fontWeight: '600',
    color: Palette.blue500,
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
    fontSize: 17,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  modalAction: {
    fontSize: 16,
    fontWeight: '600',
    color: Palette.blue500,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
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
    borderRadius: 20,
    backgroundColor: SemanticColors.surfacePrimary,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  typeOptionSelected: {
    backgroundColor: Palette.blue500,
    borderColor: Palette.blue500,
  },
  typeOptionText: {
    fontSize: 14,
    color: SemanticColors.textPrimary,
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
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  scopeOptionSelected: {
    backgroundColor: Palette.blue500 + '15',
    borderColor: Palette.blue500,
  },
  scopeLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  scopeLabelSelected: {
    color: Palette.blue500,
  },
  scopeDesc: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  scopeDescSelected: {
    color: Palette.blue500,
  },
  outdoorToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 12,
  },
  outdoorContent: {
    flex: 1,
  },
  outdoorLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: SemanticColors.textPrimary,
  },
  outdoorHint: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
});

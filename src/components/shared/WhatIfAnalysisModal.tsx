// =============================================================================
// WHAT-IF ANALYSIS MODAL
// =============================================================================
// Interactive modal for running schedule what-if scenarios
// Used in COODashboard and DirectorDashboard for schedule risk analysis
// =============================================================================

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { Spacing } from '../../theme/spacing';
import { formatCurrency } from '../../i18n/formatting';
import type { Scenario, ScenarioType, ImpactAnalysis, Activity } from '../../types/schedule-fragility';
import { scheduleFragilityService } from '../../services/scheduleFragilityService';
import { logWarn } from '../../utils/errorHandler';

interface WhatIfAnalysisModalProps {
  visible: boolean;
  projectId: string;
  activities: Activity[];
  onClose: () => void;
  onAnalysisComplete?: (results: ImpactAnalysis) => void;
}

interface ScenarioTemplate {
  type: ScenarioType;
  name: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const SCENARIO_TEMPLATES: ScenarioTemplate[] = [
  {
    type: 'activity-delay',
    name: 'Activity Delay',
    description: 'What if specific activities are delayed?',
    icon: 'time',
  },
  {
    type: 'weather-disruption',
    name: 'Weather Disruption',
    description: 'What if weather causes work stoppages?',
    icon: 'rainy',
  },
  {
    type: 'resource-shortage',
    name: 'Resource Shortage',
    description: 'What if resources become unavailable?',
    icon: 'people',
  },
  {
    type: 'permit-delay',
    name: 'Permit Delay',
    description: 'What if permit approvals are delayed?',
    icon: 'document-text',
  },
];

export function WhatIfAnalysisModal({
  visible,
  projectId,
  activities,
  onClose,
  onAnalysisComplete,
}: WhatIfAnalysisModalProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'select' | 'configure' | 'results'>('select');
  const [selectedScenario, setSelectedScenario] = useState<ScenarioTemplate | null>(null);
  const [delayDays, setDelayDays] = useState('5');
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<ImpactAnalysis | null>(null);


  const handleSelectScenario = (template: ScenarioTemplate) => {
    setSelectedScenario(template);
    setStep('configure');
  };

  const toggleActivity = (activityId: string) => {
    setSelectedActivityIds(prev =>
      prev.includes(activityId)
        ? prev.filter(id => id !== activityId)
        : [...prev, activityId]
    );
  };

  const handleRunAnalysis = useCallback(async () => {
    if (!selectedScenario) return;

    setIsRunning(true);

    try {
      const scenario: Scenario = {
        id: `scenario-${Date.now()}`,
        name: selectedScenario.name,
        description: selectedScenario.description,
        type: selectedScenario.type,
        parameters: [],
        createdAt: new Date().toISOString(),
        createdBy: 'user',
      };

      // Add parameters based on scenario type
      if (selectedScenario.type === 'activity-delay') {
        scenario.parameters = [
          { name: 'activities', type: 'activities', value: selectedActivityIds },
          { name: 'delayDays', type: 'number', value: parseInt(delayDays) || 5, unit: 'days' },
        ];
      } else if (selectedScenario.type === 'weather-disruption') {
        scenario.parameters = [
          { name: 'disruptionDays', type: 'number', value: parseInt(delayDays) || 3, unit: 'days' },
        ];
      } else {
        scenario.parameters = [
          { name: 'delayDays', type: 'number', value: parseInt(delayDays) || 5, unit: 'days' },
        ];
      }

      const analysis = scheduleFragilityService.runWhatIfAnalysis(projectId, scenario);
      setResults(analysis);
      setStep('results');
      onAnalysisComplete?.(analysis);
    } catch (error) {
      logWarn('WhatIfAnalysis', `Analysis failed: ${error}`);
    } finally {
      setIsRunning(false);
    }
  }, [selectedScenario, selectedActivityIds, delayDays, projectId, onAnalysisComplete]);

  const handleReset = () => {
    setStep('select');
    setSelectedScenario(null);
    setDelayDays('5');
    setSelectedActivityIds([]);
    setResults(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const renderScenarioSelection = () => (
    <View style={styles.content}>
      <Text style={styles.sectionTitle}>Select Scenario Type</Text>
      <View style={styles.scenarioGrid}>
        {SCENARIO_TEMPLATES.map((template) => (
          <Pressable
            key={template.type}
            style={styles.scenarioCard}
            onPress={() => handleSelectScenario(template)}
          >
            <View style={styles.scenarioIconContainer}>
              <Ionicons name={template.icon} size={24} color={SemanticColors.actionPrimary} />
            </View>
            <Text style={styles.scenarioName}>{template.name}</Text>
            <Text style={styles.scenarioDescription}>{template.description}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const renderConfiguration = () => (
    <View style={styles.content}>
      <View style={styles.configHeader}>
        <Pressable onPress={() => setStep('select')} style={styles.backButton} accessibilityRole="button" accessibilityLabel={t('common.back', 'Back')}>
          <Ionicons name="chevron-back" size={20} color={SemanticColors.textPrimary} />
        </Pressable>
        <Text style={styles.configTitle}>{selectedScenario?.name}</Text>
      </View>

      <View style={styles.configSection}>
        <Text style={styles.configLabel}>Delay Duration (Days)</Text>
        <View style={styles.inputRow}>
          <Pressable
            style={styles.inputButton}
            onPress={() => setDelayDays(String(Math.max(1, parseInt(delayDays) - 1)))}
           accessibilityRole="button" accessibilityLabel={t('common.remove', 'Remove')}>
            <Ionicons name="remove" size={20} color={SemanticColors.textPrimary} />
          </Pressable>
          <TextInput
            style={styles.delayInput}
            value={delayDays}
            onChangeText={setDelayDays}
            keyboardType="numeric"
          />
          <Pressable
            style={styles.inputButton}
            onPress={() => setDelayDays(String(parseInt(delayDays) + 1))}
           accessibilityRole="button" accessibilityLabel={t('common.add', 'Add')}>
            <Ionicons name="add" size={20} color={SemanticColors.textPrimary} />
          </Pressable>
        </View>
      </View>

      {selectedScenario?.type === 'activity-delay' && (
        <View style={styles.configSection}>
          <Text style={styles.configLabel}>Select Activities to Delay</Text>
          <ScrollView style={styles.activityList}>
            {activities
              .filter(a => a.status !== 'completed')
              .map((activity) => (
                <Pressable
                  key={activity.id}
                  style={[
                    styles.activityItem,
                    selectedActivityIds.includes(activity.id) && styles.activityItemSelected,
                  ]}
                  onPress={() => toggleActivity(activity.id)}
                >
                  <View style={styles.checkbox}>
                    {selectedActivityIds.includes(activity.id) && (
                      <Ionicons name="checkmark" size={14} color={Palette.white} />
                    )}
                  </View>
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityName}>{activity.name}</Text>
                    <View style={styles.activityMeta}>
                      <Text style={styles.activityMetaText}>
                        {activity.duration} days
                      </Text>
                      {activity.isCriticalPath && (
                        <View style={styles.criticalBadge}>
                          <Text style={styles.criticalBadgeText}>Critical</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </Pressable>
              ))}
          </ScrollView>
        </View>
      )}
    </View>
  );

  const renderResults = () => {
    if (!results) return null;

    const getRiskColor = (risk: string) => {
      switch (risk) {
        case 'low':
          return SemanticColors.feedbackSuccess;
        case 'medium':
          return SemanticColors.feedbackWarning;
        case 'high':
          return SemanticColors.feedbackError;
        case 'critical':
          return SemanticColors.feedbackError;
        default:
          return SemanticColors.textTertiary;
      }
    };

    return (
      <ScrollView style={styles.content}>
        <View style={styles.resultsHeader}>
          <Ionicons
            name={results.projectDelayDays > 0 ? 'warning' : 'checkmark-circle'}
            size={32}
            color={results.projectDelayDays > 0 ? SemanticColors.feedbackWarning : SemanticColors.feedbackSuccess}
          />
          <Text style={styles.resultsTitle}>
            {results.projectDelayDays > 0 ? 'Impact Detected' : 'No Significant Impact'}
          </Text>
        </View>

        {/* Impact Summary */}
        <View style={styles.impactSummary}>
          <View style={styles.impactItem}>
            <Text style={styles.impactLabel}>Project Delay</Text>
            <Text style={[styles.impactValue, { color: results.projectDelayDays > 0 ? SemanticColors.feedbackError : SemanticColors.feedbackSuccess }]}>
              {results.projectDelayDays} days
            </Text>
          </View>
          <View style={styles.impactItem}>
            <Text style={styles.impactLabel}>New Completion</Text>
            <Text style={styles.impactValue}>
              {new Date(results.newCompletionDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
          </View>
          {results.estimatedCostImpact && (
            <View style={styles.impactItem}>
              <Text style={styles.impactLabel}>Est. Cost Impact</Text>
              <Text style={[styles.impactValue, { color: SemanticColors.feedbackError }]}>
                {formatCurrency(results.estimatedCostImpact)}
              </Text>
            </View>
          )}
          <View style={styles.impactItem}>
            <Text style={styles.impactLabel}>Risk Level</Text>
            <View style={[styles.riskBadge, { backgroundColor: getRiskColor(results.overallRisk) + '20' }]}>
              <Text style={[styles.riskBadgeText, { color: getRiskColor(results.overallRisk) }]}>
                {results.overallRisk.charAt(0).toUpperCase() + results.overallRisk.slice(1)}
              </Text>
            </View>
          </View>
        </View>

        {/* Milestones Affected */}
        {results.milestonesAffected.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Milestones Affected</Text>
            {results.milestonesAffected.map((milestone) => (
              <View key={milestone.milestoneId} style={styles.milestoneItem}>
                <Ionicons name="flag" size={14} color={SemanticColors.feedbackWarning} />
                <View style={styles.milestoneContent}>
                  <Text style={styles.milestoneName}>{milestone.milestoneName}</Text>
                  <Text style={styles.milestoneDelay}>
                    Delayed by {milestone.delayDays} days
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Mitigation Options */}
        {results.mitigationOptions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Mitigation Options</Text>
            {results.mitigationOptions.map((option, index) => (
              <View key={index} style={styles.mitigationItem}>
                <View style={styles.mitigationHeader}>
                  <Ionicons name="bulb" size={14} color={SemanticColors.feedbackInfo} />
                  <Text style={styles.mitigationDescription}>{option.description}</Text>
                </View>
                <View style={styles.mitigationStats}>
                  <Text style={styles.mitigationStat}>
                    Recovery: {option.timeRecovery} days
                  </Text>
                  {option.costToImplement && (
                    <Text style={styles.mitigationStat}>
                      Cost: {formatCurrency(option.costToImplement)}
                    </Text>
                  )}
                  <View
                    style={[
                      styles.feasibilityBadge,
                      {
                        backgroundColor:
                          option.feasibility === 'high'
                            ? SemanticColors.feedbackSuccessBg
                            : option.feasibility === 'medium'
                            ? SemanticColors.feedbackWarningBg
                            : SemanticColors.feedbackErrorBg,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.feasibilityText,
                        {
                          color:
                            option.feasibility === 'high'
                              ? SemanticColors.feedbackSuccess
                              : option.feasibility === 'medium'
                              ? SemanticColors.feedbackWarning
                              : SemanticColors.feedbackError,
                        },
                      ]}
                    >
                      {option.feasibility}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Ionicons name="analytics" size={20} color={SemanticColors.actionPrimary} />
              <Text style={styles.headerTitle}>What-If Analysis</Text>
            </View>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
            </Pressable>
          </View>

          {/* Content */}
          {step === 'select' && renderScenarioSelection()}
          {step === 'configure' && renderConfiguration()}
          {step === 'results' && renderResults()}

          {/* Footer */}
          <View style={styles.footer}>
            {step === 'configure' && (
              <Pressable
                style={[
                  styles.footerButton,
                  styles.primaryButton,
                  (isRunning || (selectedScenario?.type === 'activity-delay' && selectedActivityIds.length === 0)) && styles.buttonDisabled,
                ]}
                onPress={handleRunAnalysis}
                disabled={isRunning || (selectedScenario?.type === 'activity-delay' && selectedActivityIds.length === 0)}
              >
                {isRunning ? (
                  <ActivityIndicator size="small" color={Palette.white} />
                ) : (
                  <>
                    <Ionicons name="play" size={18} color={Palette.white} />
                    <Text style={styles.primaryButtonText}>Run Analysis</Text>
                  </>
                )}
              </Pressable>
            )}
            {step === 'results' && (
              <Pressable style={[styles.footerButton, styles.primaryButton]} onPress={handleReset}>
                <Ionicons name="refresh" size={18} color={Palette.white} />
                <Text style={styles.primaryButtonText}>Run Another Scenario</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: SemanticColors.surfaceBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  content: {
    padding: Spacing.md,
  },
  sectionTitle: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    marginBottom: Spacing.sm,
  },
  scenarioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  scenarioCard: {
    width: '48%',
    padding: Spacing.md,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 8,
  },
  scenarioIconContainer: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    backgroundColor: SemanticColors.actionPrimary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scenarioName: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
  },
  scenarioDescription: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize,
  },
  configHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  backButton: {
    padding: 4,
  },
  configTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
  },
  configSection: {
    marginBottom: Spacing.md,
  },
  configLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.labelFamily,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  inputButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  delayInput: {
    flex: 1,
    height: 44,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.sm,
    paddingHorizontal: Spacing.md,
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  activityList: {
    maxHeight: 200,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.sm,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  activityItemSelected: {
    backgroundColor: SemanticColors.actionPrimary + '15',
    borderColor: SemanticColors.actionPrimary,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: SemanticColors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  activityInfo: {
    flex: 1,
  },
  activityName: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.labelFamily,
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activityMetaText: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.tinySize,
  },
  criticalBadge: {
    backgroundColor: SemanticColors.feedbackErrorBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  criticalBadgeText: {
    color: SemanticColors.feedbackError,
    fontSize: TYPE.tinySize - 2,
    fontFamily: TYPE.titleFamily,
  },
  resultsHeader: {
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.md,
  },
  resultsTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
  },
  impactSummary: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  impactItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  impactLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.captionSize,
  },
  impactValue: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  riskBadgeText: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
  },
  section: {
    marginBottom: Spacing.md,
  },
  sectionLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
    marginBottom: 8,
  },
  milestoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.sm,
    backgroundColor: SemanticColors.feedbackWarningBg,
    borderRadius: RADIUS.sm,
    marginBottom: 6,
  },
  milestoneContent: {
    flex: 1,
  },
  milestoneName: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.labelFamily,
  },
  milestoneDelay: {
    color: SemanticColors.feedbackWarning,
    fontSize: TYPE.tinySize,
  },
  mitigationItem: {
    padding: Spacing.sm,
    backgroundColor: SemanticColors.feedbackInfoBg,
    borderRadius: RADIUS.sm,
    marginBottom: 6,
    gap: 6,
  },
  mitigationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  mitigationDescription: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.labelSize,
    flex: 1,
  },
  mitigationStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
    marginLeft: 22,
  },
  mitigationStat: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize,
  },
  feasibilityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  feasibilityText: {
    fontSize: TYPE.tinySize - 1,
    fontFamily: TYPE.titleFamily,
    textTransform: 'capitalize',
  },
  footer: {
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
  },
  primaryButton: {
    backgroundColor: SemanticColors.actionPrimary,
  },
  primaryButtonText: {
    color: Palette.white,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

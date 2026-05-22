// =============================================================================
// TEMPLATE SUGGESTION COMPONENT
// =============================================================================
// Shows auto-detected decision template when creating jobs
// Part of the seamless data capture strategy
// =============================================================================

import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { Spacing } from '../../theme/spacing';
import { useTemplateSuggestion } from '../../services/jobDecisionLinker';
import type { DecisionTemplate } from '../../types/decisions';
import { useTranslation } from 'react-i18next';
type IconName = keyof typeof Ionicons.glyphMap;

interface TemplateSuggestionProps {
  jobTitle: string;
  onAccept?: (template: DecisionTemplate) => void;
  onDecline?: () => void;
  onCustomize?: (template: DecisionTemplate) => void;
}

export function TemplateSuggestion({
  jobTitle,
  onAccept,
  onDecline,
  onCustomize,
}: TemplateSuggestionProps) {
  const suggestion = useTemplateSuggestion(jobTitle);

  if (!suggestion || suggestion.confidence < 0.3) {
    return null;
  }

  const { template, confidence, matchReasons } = suggestion;
  const confidencePercent = Math.round(confidence * 100);
  const isHighConfidence = confidence >= 0.6;

  const getTradeIcon = (trade: string): IconName => {
    switch (trade) {
      case 'bathroom_fitter':
        return 'water';
      case 'kitchen_fitter':
        return 'restaurant';
      case 'painter':
        return 'color-palette';
      case 'electrician':
        return 'flash';
      case 'plumber':
        return 'water-outline';
      case 'tiler':
        return 'grid';
      case 'flooring':
        return 'layers';
      default:
        return 'construct';
    }
  };

  return (
    <View style={[styles.container, isHighConfidence && styles.containerHighConfidence]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.icon, isHighConfidence && styles.iconHighConfidence]}>
          <Ionicons
            name="sparkles"
            size={16}
            color={isHighConfidence ? Palette.hermesOrange : SemanticColors.textSecondary}
          />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Beslissingen Template Gevonden</Text>
          <Text style={styles.headerConfidence}>
            {confidencePercent}% match
          </Text>
        </View>
      </View>

      {/* Template info */}
      <View style={styles.templateInfo}>
        <View style={styles.templateIcon}>
          <Ionicons
            name={getTradeIcon(template.trade)}
            size={24}
            color={Palette.hermesOrange}
          />
        </View>
        <View style={styles.templateContent}>
          <Text style={styles.templateName}>{template.name}</Text>
          <Text style={styles.templateStats}>
            {template.estimatedTotalDecisions} beslissingen · ~{template.avgDaysToComplete} dagen
          </Text>
          <Text style={styles.templateUsage}>
            {template.usageCount}× gebruikt door aannemers
          </Text>
        </View>
      </View>

      {/* Match reasons */}
      {matchReasons.length > 0 && (
        <View style={styles.reasons}>
          {matchReasons.slice(0, 2).map((reason, index) => (
            <View key={index} style={styles.reasonBadge}>
              <Ionicons name="checkmark-circle" size={12} color={SemanticColors.feedbackSuccess} />
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Value proposition */}
      <View style={styles.valueProposition}>
        <Ionicons name="information-circle" size={14} color={SemanticColors.textTertiary} />
        <Text style={styles.valueText}>
          Automatisch klantbeslissingen bijhouden en vertragingen voorkomen
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable style={styles.declineButton} onPress={onDecline}>
          <Text style={styles.declineButtonText}>Niet nu</Text>
        </Pressable>
        <Pressable style={styles.customizeButton} onPress={() => onCustomize?.(template)}>
          <Ionicons name="settings-outline" size={16} color={Palette.hermesOrange} />
          <Text style={styles.customizeButtonText}>Aanpassen</Text>
        </Pressable>
        <Pressable style={styles.acceptButton} onPress={() => onAccept?.(template)}>
          <Ionicons name="checkmark" size={16} color="#fff" />
          <Text style={styles.acceptButtonText}>Toevoegen</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Compact version for inline display
 */
interface CompactTemplateSuggestionProps {
  jobTitle: string;
  onPress?: () => void;
}

export function CompactTemplateSuggestion({
  jobTitle,
  onPress,
}: CompactTemplateSuggestionProps) {
  const suggestion = useTemplateSuggestion(jobTitle);

  if (!suggestion || suggestion.confidence < 0.4) {
    return null;
  }

  return (
    <Pressable style={styles.compactContainer} onPress={onPress}>
      <Ionicons name="sparkles" size={14} color={Palette.hermesOrange} />
      <Text style={styles.compactText}>
        {suggestion.template.name} template beschikbaar
      </Text>
      <Ionicons name="chevron-forward" size={14} color={SemanticColors.textTertiary} />
    </Pressable>
  );
}

/**
 * Badge to show template is linked
 */
interface LinkedTemplateBadgeProps {
  templateName: string;
  decisionCount: number;
  completedCount: number;
}

export function LinkedTemplateBadge({
  templateName,
  decisionCount,
  completedCount,
}: LinkedTemplateBadgeProps) {
  const progress = decisionCount > 0 ? (completedCount / decisionCount) * 100 : 0;

  return (
    <View style={styles.linkedBadge}>
      <View style={styles.linkedHeader}>
        <Ionicons name="checkbox-outline" size={14} color={SemanticColors.feedbackSuccess} />
        <Text style={styles.linkedTitle}>{templateName}</Text>
      </View>
      <View style={styles.linkedProgress}>
        <View style={styles.linkedProgressBar}>
          <View style={[styles.linkedProgressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.linkedProgressText}>
          {completedCount}/{decisionCount}
        </Text>
      </View>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  containerHighConfidence: {
    borderColor: Palette.hermesOrange + '40',
    backgroundColor: Palette.pastelOrange + '10',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconHighConfidence: {
    backgroundColor: Palette.pastelOrange + '40',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  headerConfidence: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textTertiary,
  },
  templateInfo: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.sm,
  },
  templateIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: Palette.pastelOrange + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateContent: {
    flex: 1,
    justifyContent: 'center',
  },
  templateName: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  templateStats: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  templateUsage: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  reasons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  reasonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: SemanticColors.feedbackSuccessBg,
    borderRadius: 6,
  },
  reasonText: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.feedbackSuccess,
  },
  valueProposition: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    padding: Spacing.sm,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.sm,
  },
  valueText: {
    flex: 1,
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    lineHeight: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  declineButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: RADIUS.sm,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  declineButtonText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textSecondary,
  },
  customizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: Palette.hermesOrange,
  },
  customizeButtonText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: Palette.hermesOrange,
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    backgroundColor: Palette.hermesOrange,
  },
  acceptButtonText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: Palette.white,
  },

  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: Palette.pastelOrange + '20',
    borderRadius: RADIUS.sm,
  },
  compactText: {
    flex: 1,
    fontSize: TYPE.labelSize,
    color: Palette.hermesOrange,
    fontFamily: TYPE.labelFamily,
  },

  // Linked badge styles
  linkedBadge: {
    padding: Spacing.sm,
    backgroundColor: SemanticColors.feedbackSuccessBg,
    borderRadius: RADIUS.sm,
    gap: 6,
  },
  linkedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  linkedTitle: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.feedbackSuccess,
  },
  linkedProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  linkedProgressBar: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  linkedProgressFill: {
    height: '100%',
    backgroundColor: SemanticColors.feedbackSuccess,
    borderRadius: 2,
  },
  linkedProgressText: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.feedbackSuccess,
    fontFamily: TYPE.titleFamily,
    minWidth: 40,
    textAlign: 'right',
  },
});

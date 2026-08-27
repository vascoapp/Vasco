// =============================================================================
// AI BUSINESS ASSISTANT COMPONENT
// =============================================================================
// Contextual AI assistant with proactive insights and business recommendations
// =============================================================================

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import {
  useAssistant,
  useProactiveInsights,
  useBusinessSuggestions,
  AssistantMessage,
  ProactiveInsight,
  BusinessSuggestion,
  QuickAction,
} from '../../services/aiAssistantService';

type ViewMode = 'chat' | 'insights' | 'suggestions';

export function AIAssistant() {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<ViewMode>('chat');
  const [inputText, setInputText] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  const { conversation, sendMessage, quickActions, capabilities } = useAssistant();
  const { insights, dismissInsight, activeCount } = useProactiveInsights();
  const suggestions = useBusinessSuggestions();

  useEffect(() => {
    if (conversation?.messages.length) {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }
  }, [conversation?.messages]);

  const handleSend = () => {
    if (inputText.trim()) {
      sendMessage(inputText.trim());
      setInputText('');
    }
  };

  const handleQuickAction = (action: QuickAction) => {
    sendMessage(action.prompt);
  };

  const getInsightStyle = (type: ProactiveInsight['type']) => {
    switch (type) {
      case 'opportunity': return { color: Palette.blue500, icon: 'bulb', bg: Palette.blue500 + '15' };
      case 'warning': return { color: Palette.orange500, icon: 'warning', bg: Palette.orange500 + '15' };
      case 'tip': return { color: Palette.green500, icon: 'sparkles', bg: Palette.green500 + '15' };
      case 'milestone': return { color: Palette.hermesOrange, icon: 'trophy', bg: Palette.hermesOrange + '15' };
      case 'reminder': return { color: Palette.red500, icon: 'alarm', bg: Palette.red500 + '15' };
      default: return { color: Palette.gray500, icon: 'information-circle', bg: Palette.gray500 + '15' };
    }
  };

  const getSuggestionIcon = (type: BusinessSuggestion['type']) => {
    switch (type) {
      case 'pricing': return 'pricetag-outline';
      case 'scheduling': return 'calendar-outline';
      case 'customer': return 'people-outline';
      case 'inventory': return 'cube-outline';
      case 'marketing': return 'megaphone-outline';
      case 'efficiency': return 'flash-outline';
      default: return 'bulb-outline';
    }
  };

  const renderMessage = (message: AssistantMessage, index: number) => {
    const isUser = message.role === 'user';

    return (
      <View
        key={message.id || index}
        style={[styles.messageContainer, isUser && styles.userMessageContainer]}
      >
        {!isUser && (
          <View style={styles.assistantAvatar}>
            <Ionicons name="sparkles" size={16} color={Palette.hermesOrange} />
          </View>
        )}
        <View style={[styles.messageBubble, isUser && styles.userBubble]}>
          <Text style={[styles.messageText, isUser && styles.userMessageText]}>
            {message.content}
          </Text>
          {/* A dead "Actie ondernemen" button lived here, and two more below:
              each carried a label and an arrow and had NO onPress, and the data
              behind them has no route or action to dispatch, so wiring them
              would mean inventing behaviour. A labelled affordance that ignores
              you is worse than none. Two were hardcoded Dutch ("Actie
              ondernemen", "Implementeer suggestie") shown to a German
              contractor as well.
              This screen's only in-app entry point is COODashboard, a portfolio
              surface that ships to nobody (feedback_contractor_aannemer_only),
              so they are removed rather than rebuilt. */}
        </View>
      </View>
    );
  };

  const renderChatView = () => (
    <KeyboardAvoidingView
      style={styles.chatContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Message */}
        {!conversation?.messages.length && (
          <View style={styles.welcomeContainer}>
            <View style={styles.welcomeIcon}>
              <Ionicons name="sparkles" size={32} color={Palette.hermesOrange} />
            </View>
            <Text style={styles.welcomeTitle}>{t('aiAssistant.welcomeTitle', "Hi! I'm your Vasco assistant")}</Text>
            <Text style={styles.welcomeText}>
              {t('aiAssistant.welcomeText', 'I can help with quotes, scheduling, finances and more. What can I do for you?')}
            </Text>

            {/* Quick Actions */}
            <Text style={styles.quickActionsTitle}>Snelle acties</Text>
            <View style={styles.quickActionsGrid}>
              {quickActions.slice(0, 6).map((action) => (
                <Pressable
                  key={action.id}
                  style={styles.quickActionCard}
                  onPress={() => handleQuickAction(action)}
                >
                  <Ionicons name={action.icon as any} size={24} color={Palette.blue500} />
                  <Text style={styles.quickActionLabel}>{action.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Capabilities */}
            <Text style={styles.capabilitiesTitle}>{t('aiAssistant.canHelpWith', 'I can help with')}</Text>
            {capabilities.slice(0, 4).map((cap) => (
              <View key={cap.id} style={styles.capabilityCard}>
                <Text style={styles.capabilityName}>{cap.name}</Text>
                <Text style={styles.capabilityDesc}>{cap.description}</Text>
                <View style={styles.capabilityExamples}>
                  {cap.examples.slice(0, 2).map((ex, i) => (
                    <Pressable
                      key={i}
                      style={styles.exampleChip}
                      onPress={() => sendMessage(ex)}
                    >
                      <Text style={styles.exampleText}>"{ex}"</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Messages */}
        {conversation?.messages.map(renderMessage)}
      </ScrollView>

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={t('aiAssistant.askPlaceholder', 'Ask a question...')}
          placeholderTextColor={SemanticColors.textSecondary}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSend}
          multiline
          maxLength={500}
        />
        <Pressable
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim()}
        >
          <Ionicons
            name="send"
            size={20}
            color={inputText.trim() ? '#fff' : SemanticColors.textSecondary}
          />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );

  const renderInsightCard = (insight: ProactiveInsight) => {
    const style = getInsightStyle(insight.type);

    return (
      <View key={insight.id} style={[styles.insightCard, { borderLeftColor: style.color }]}>
        <View style={[styles.insightIcon, { backgroundColor: style.bg }]}>
          <Ionicons name={style.icon as any} size={20} color={style.color} />
        </View>
        <View style={styles.insightContent}>
          <View style={styles.insightHeader}>
            <Text style={styles.insightTitle}>{insight.title}</Text>
            <View style={[styles.priorityBadge, { backgroundColor: insight.priority === 'high' ? Palette.red500 + '20' : insight.priority === 'medium' ? Palette.orange500 + '20' : Palette.gray500 + '20' }]}>
              <Text style={[styles.priorityText, { color: insight.priority === 'high' ? Palette.red500 : insight.priority === 'medium' ? Palette.orange500 : Palette.gray500 }]}>
                {insight.priority === 'high' ? 'Hoog' : insight.priority === 'medium' ? 'Middel' : 'Laag'}
              </Text>
            </View>
          </View>
          <Text style={styles.insightDescription}>{insight.description}</Text>

          <View style={styles.insightActions}>
            <Pressable
              style={styles.dismissButton}
              onPress={() => dismissInsight(insight.id, (insight as any).generatorId, 'ai-assistant')}
            >
              <Ionicons name="close" size={18} color={SemanticColors.textSecondary} />
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  const renderInsightsView = () => (
    <ScrollView style={styles.insightsContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.insightsHeader}>
        <Text style={styles.insightsTitle}>{t('aiAssistant.activeInsights', { count: activeCount })}</Text>
        <Text style={styles.insightsSubtitle}>
          {t('aiAssistant.insightsSubtitle', 'Personalised recommendations based on your business data')}
        </Text>
      </View>

      {insights.length > 0 ? (
        insights.map(renderInsightCard)
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle-outline" size={48} color={Palette.green500} />
          <Text style={styles.emptyTitle}>{t('aiAssistant.allClear', 'All clear!')}</Text>
          <Text style={styles.emptyText}>{t('aiAssistant.noInsights', 'There are no new insights for you right now.')}</Text>
        </View>
      )}
    </ScrollView>
  );

  const renderSuggestionCard = (suggestion: BusinessSuggestion) => (
    <View key={suggestion.id} style={styles.suggestionCard}>
      <View style={styles.suggestionHeader}>
        <View style={styles.suggestionIconContainer}>
          <Ionicons name={getSuggestionIcon(suggestion.type) as any} size={24} color={Palette.green500} />
        </View>
        <View style={styles.suggestionTitleContainer}>
          <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
          <View style={styles.confidenceBadge}>
            <Text style={styles.confidenceText}>{Math.round(suggestion.confidence * 100)}% zeker</Text>
          </View>
        </View>
      </View>

      <Text style={styles.suggestionDescription}>{suggestion.description}</Text>

      <View style={styles.impactBox}>
        <Ionicons name="trending-up-outline" size={18} color={Palette.green500} />
        <Text style={styles.impactText}>Potentiële impact: {suggestion.potentialImpact}</Text>
      </View>

      <View style={styles.basedOnBox}>
        <Ionicons name="analytics-outline" size={16} color={SemanticColors.textSecondary} />
        <Text style={styles.basedOnText}>{t('aiAssistant.basedOn', { source: suggestion.basedOn })}</Text>
      </View>

      <View style={styles.actionSteps}>
        <Text style={styles.actionStepsTitle}>Aanbevolen stappen:</Text>
        {suggestion.actionSteps.map((step, index) => (
          <View key={index} style={styles.actionStep}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{index + 1}</Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>

    </View>
  );

  const renderSuggestionsView = () => (
    <ScrollView style={styles.suggestionsContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.suggestionsHeader}>
        <Text style={styles.suggestionsTitle}>{t('aiAssistant.suggestionsTitle', 'Business suggestions')}</Text>
        <Text style={styles.suggestionsSubtitle}>
          {t('aiAssistant.suggestionsSubtitle', 'AI-generated optimisations based on your data')}
        </Text>
      </View>

      {suggestions.map(renderSuggestionCard)}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* View Selector */}
      <View style={styles.viewSelector}>
        <Pressable
          style={[styles.viewButton, viewMode === 'chat' && styles.viewButtonActive]}
          onPress={() => setViewMode('chat')}
        >
          <Ionicons
            name="chatbubbles-outline"
            size={18}
            color={viewMode === 'chat' ? Palette.hermesOrange : SemanticColors.textSecondary}
          />
          <Text style={[styles.viewButtonText, viewMode === 'chat' && styles.viewButtonTextActive]}>
            {t('aiAssistant.tabChat', 'Chat')}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.viewButton, viewMode === 'insights' && styles.viewButtonActive]}
          onPress={() => setViewMode('insights')}
        >
          <View style={styles.viewButtonIconContainer}>
            <Ionicons
              name="bulb-outline"
              size={18}
              color={viewMode === 'insights' ? Palette.hermesOrange : SemanticColors.textSecondary}
            />
            {activeCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{activeCount}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.viewButtonText, viewMode === 'insights' && styles.viewButtonTextActive]}>
            {t('aiAssistant.tabInsights', 'Insights')}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.viewButton, viewMode === 'suggestions' && styles.viewButtonActive]}
          onPress={() => setViewMode('suggestions')}
        >
          <Ionicons
            name="rocket-outline"
            size={18}
            color={viewMode === 'suggestions' ? Palette.hermesOrange : SemanticColors.textSecondary}
          />
          <Text style={[styles.viewButtonText, viewMode === 'suggestions' && styles.viewButtonTextActive]}>
            {t('aiAssistant.tabSuggestions', 'Suggestions')}
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      {viewMode === 'chat' && renderChatView()}
      {viewMode === 'insights' && renderInsightsView()}
      {viewMode === 'suggestions' && renderSuggestionsView()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },

  // View Selector
  viewSelector: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
    gap: 8,
  },
  viewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    gap: 6,
  },
  viewButtonActive: {
    backgroundColor: Palette.hermesOrange + '15',
  },
  viewButtonIconContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: Palette.red500,
    borderRadius: RADIUS.sm,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: TYPE.tinySize - 1,
    fontFamily: TYPE.sectionFamily,
    color: Palette.white,
  },
  viewButtonText: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
    fontFamily: TYPE.labelFamily,
  },
  viewButtonTextActive: {
    color: Palette.hermesOrange,
    fontFamily: TYPE.titleFamily,
  },

  // Chat View
  chatContainer: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },

  // Welcome
  welcomeContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  welcomeIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Palette.hermesOrange + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: TYPE.bodySize,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  quickActionsTitle: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textSecondary,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  quickActionCard: {
    width: '31%',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  quickActionLabel: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textPrimary,
    textAlign: 'center',
    marginTop: 8,
  },
  capabilitiesTitle: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textSecondary,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  capabilityCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    width: '100%',
  },
  capabilityName: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  capabilityDesc: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  capabilityExamples: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 8,
  },
  exampleChip: {
    backgroundColor: Palette.hermesOrange + '10',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.lg,
  },
  exampleText: {
    fontSize: TYPE.labelSize,
    color: Palette.hermesOrange,
    fontStyle: 'italic',
  },

  // Messages
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  assistantAvatar: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.lg,
    backgroundColor: Palette.hermesOrange + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  messageBubble: {
    maxWidth: '80%',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    borderTopLeftRadius: 4,
    padding: 14,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  userBubble: {
    backgroundColor: Palette.hermesOrange,
    borderColor: Palette.hermesOrange,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 4,
  },
  messageText: {
    fontSize: TYPE.bodySize,
    color: SemanticColors.textPrimary,
    lineHeight: 22,
  },
  userMessageText: {
    color: Palette.white,
  },
  messageAction: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
    gap: 6,
  },
  messageActionText: {
    fontSize: TYPE.bodySize - 1,
    color: Palette.blue500,
    fontFamily: TYPE.labelFamily,
  },

  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: SemanticColors.surfacePrimary,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: RADIUS.xl,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: TYPE.bodySize,
    color: SemanticColors.textPrimary,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    backgroundColor: Palette.hermesOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: SemanticColors.borderDefault,
  },

  // Insights View
  insightsContainer: {
    flex: 1,
    padding: 16,
  },
  insightsHeader: {
    marginBottom: 16,
  },
  insightsTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  insightsSubtitle: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  insightCard: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    borderLeftWidth: 4,
    gap: 12,
  },
  insightIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightContent: {
    flex: 1,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  insightTitle: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    flex: 1,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  priorityText: {
    fontSize: TYPE.tinySize - 1,
    fontFamily: TYPE.titleFamily,
  },
  insightDescription: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  insightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  insightActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  insightActionText: {
    fontSize: TYPE.bodySize - 1,
    color: Palette.blue500,
    fontFamily: TYPE.labelFamily,
  },
  dismissButton: {
    padding: 4,
  },

  // Suggestions View
  suggestionsContainer: {
    flex: 1,
    padding: 16,
  },
  suggestionsHeader: {
    marginBottom: 16,
  },
  suggestionsTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  suggestionsSubtitle: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  suggestionCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  suggestionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
    backgroundColor: Palette.green500 + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionTitleContainer: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: TYPE.titleSize + 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  confidenceBadge: {
    backgroundColor: Palette.green500 + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  confidenceText: {
    fontSize: TYPE.tinySize,
    color: Palette.green500,
    fontFamily: TYPE.titleFamily,
  },
  suggestionDescription: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  impactBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.green500 + '10',
    borderRadius: RADIUS.sm,
    padding: 12,
    marginBottom: 8,
    gap: 8,
  },
  impactText: {
    fontSize: TYPE.bodySize - 1,
    color: Palette.green500,
    fontFamily: TYPE.labelFamily,
  },
  basedOnBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 6,
  },
  basedOnText: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
  },
  actionSteps: {
    marginBottom: 16,
  },
  actionStepsTitle: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    marginBottom: 10,
  },
  actionStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 10,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: RADIUS.md,
    backgroundColor: Palette.blue500 + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
    color: Palette.blue500,
  },
  stepText: {
    flex: 1,
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textPrimary,
    lineHeight: 20,
  },
  implementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.green500,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    gap: 8,
  },
  implementButtonText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: Palette.white,
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
  },
});

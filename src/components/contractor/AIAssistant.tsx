// =============================================================================
// AI BUSINESS ASSISTANT COMPONENT
// =============================================================================
// Contextual AI assistant with proactive insights and business recommendations
// =============================================================================

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
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
      case 'opportunity': return { color: Palette.blue, icon: 'bulb', bg: Palette.blue + '15' };
      case 'warning': return { color: Palette.orange, icon: 'warning', bg: Palette.orange + '15' };
      case 'tip': return { color: Palette.emerald, icon: 'sparkles', bg: Palette.emerald + '15' };
      case 'milestone': return { color: Palette.purple, icon: 'trophy', bg: Palette.purple + '15' };
      case 'reminder': return { color: Palette.red, icon: 'alarm', bg: Palette.red + '15' };
      default: return { color: Palette.gray, icon: 'information-circle', bg: Palette.gray + '15' };
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
            <Ionicons name="sparkles" size={16} color={Palette.purple} />
          </View>
        )}
        <View style={[styles.messageBubble, isUser && styles.userBubble]}>
          <Text style={[styles.messageText, isUser && styles.userMessageText]}>
            {message.content}
          </Text>
          {message.metadata?.actionable && (
            <TouchableOpacity style={styles.messageAction}>
              <Text style={styles.messageActionText}>Actie ondernemen</Text>
              <Ionicons name="arrow-forward" size={14} color={Palette.blue} />
            </TouchableOpacity>
          )}
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
              <Ionicons name="sparkles" size={32} color={Palette.purple} />
            </View>
            <Text style={styles.welcomeTitle}>Hoi! Ik ben je Vasco assistent</Text>
            <Text style={styles.welcomeText}>
              Ik kan je helpen met offertes, planning, financiën en meer. Wat kan ik voor je doen?
            </Text>

            {/* Quick Actions */}
            <Text style={styles.quickActionsTitle}>Snelle acties</Text>
            <View style={styles.quickActionsGrid}>
              {quickActions.slice(0, 6).map((action) => (
                <TouchableOpacity
                  key={action.id}
                  style={styles.quickActionCard}
                  onPress={() => handleQuickAction(action)}
                >
                  <Ionicons name={action.icon as any} size={24} color={Palette.blue} />
                  <Text style={styles.quickActionLabel}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Capabilities */}
            <Text style={styles.capabilitiesTitle}>Ik kan helpen met</Text>
            {capabilities.slice(0, 4).map((cap) => (
              <View key={cap.id} style={styles.capabilityCard}>
                <Text style={styles.capabilityName}>{cap.name}</Text>
                <Text style={styles.capabilityDesc}>{cap.description}</Text>
                <View style={styles.capabilityExamples}>
                  {cap.examples.slice(0, 2).map((ex, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.exampleChip}
                      onPress={() => sendMessage(ex)}
                    >
                      <Text style={styles.exampleText}>"{ex}"</Text>
                    </TouchableOpacity>
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
          placeholder="Stel een vraag..."
          placeholderTextColor={SemanticColors.textSecondary}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSend}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim()}
        >
          <Ionicons
            name="send"
            size={20}
            color={inputText.trim() ? '#fff' : SemanticColors.textSecondary}
          />
        </TouchableOpacity>
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
            <View style={[styles.priorityBadge, { backgroundColor: insight.priority === 'high' ? Palette.red + '20' : insight.priority === 'medium' ? Palette.orange + '20' : Palette.gray + '20' }]}>
              <Text style={[styles.priorityText, { color: insight.priority === 'high' ? Palette.red : insight.priority === 'medium' ? Palette.orange : Palette.gray }]}>
                {insight.priority === 'high' ? 'Hoog' : insight.priority === 'medium' ? 'Middel' : 'Laag'}
              </Text>
            </View>
          </View>
          <Text style={styles.insightDescription}>{insight.description}</Text>

          <View style={styles.insightActions}>
            {insight.actionLabel && (
              <TouchableOpacity style={styles.insightActionButton}>
                <Text style={styles.insightActionText}>{insight.actionLabel}</Text>
                <Ionicons name="arrow-forward" size={14} color={Palette.blue} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={() => dismissInsight(insight.id)}
            >
              <Ionicons name="close" size={18} color={SemanticColors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderInsightsView = () => (
    <ScrollView style={styles.insightsContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.insightsHeader}>
        <Text style={styles.insightsTitle}>{activeCount} actieve inzichten</Text>
        <Text style={styles.insightsSubtitle}>
          Gepersonaliseerde aanbevelingen op basis van je bedrijfsdata
        </Text>
      </View>

      {insights.length > 0 ? (
        insights.map(renderInsightCard)
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle-outline" size={48} color={Palette.emerald} />
          <Text style={styles.emptyTitle}>Alles op orde!</Text>
          <Text style={styles.emptyText}>Er zijn momenteel geen nieuwe inzichten voor je.</Text>
        </View>
      )}
    </ScrollView>
  );

  const renderSuggestionCard = (suggestion: BusinessSuggestion) => (
    <View key={suggestion.id} style={styles.suggestionCard}>
      <View style={styles.suggestionHeader}>
        <View style={styles.suggestionIconContainer}>
          <Ionicons name={getSuggestionIcon(suggestion.type) as any} size={24} color={Palette.emerald} />
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
        <Ionicons name="trending-up-outline" size={18} color={Palette.emerald} />
        <Text style={styles.impactText}>Potentiële impact: {suggestion.potentialImpact}</Text>
      </View>

      <View style={styles.basedOnBox}>
        <Ionicons name="analytics-outline" size={16} color={SemanticColors.textSecondary} />
        <Text style={styles.basedOnText}>Gebaseerd op: {suggestion.basedOn}</Text>
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

      <TouchableOpacity style={styles.implementButton}>
        <Ionicons name="rocket-outline" size={18} color="#fff" />
        <Text style={styles.implementButtonText}>Implementeer suggestie</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSuggestionsView = () => (
    <ScrollView style={styles.suggestionsContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.suggestionsHeader}>
        <Text style={styles.suggestionsTitle}>Bedrijfssuggesties</Text>
        <Text style={styles.suggestionsSubtitle}>
          AI-gegenereerde optimalisaties gebaseerd op jouw data
        </Text>
      </View>

      {suggestions.map(renderSuggestionCard)}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* View Selector */}
      <View style={styles.viewSelector}>
        <TouchableOpacity
          style={[styles.viewButton, viewMode === 'chat' && styles.viewButtonActive]}
          onPress={() => setViewMode('chat')}
        >
          <Ionicons
            name="chatbubbles-outline"
            size={18}
            color={viewMode === 'chat' ? Palette.purple : SemanticColors.textSecondary}
          />
          <Text style={[styles.viewButtonText, viewMode === 'chat' && styles.viewButtonTextActive]}>
            Chat
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.viewButton, viewMode === 'insights' && styles.viewButtonActive]}
          onPress={() => setViewMode('insights')}
        >
          <View style={styles.viewButtonIconContainer}>
            <Ionicons
              name="bulb-outline"
              size={18}
              color={viewMode === 'insights' ? Palette.purple : SemanticColors.textSecondary}
            />
            {activeCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{activeCount}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.viewButtonText, viewMode === 'insights' && styles.viewButtonTextActive]}>
            Inzichten
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.viewButton, viewMode === 'suggestions' && styles.viewButtonActive]}
          onPress={() => setViewMode('suggestions')}
        >
          <Ionicons
            name="rocket-outline"
            size={18}
            color={viewMode === 'suggestions' ? Palette.purple : SemanticColors.textSecondary}
          />
          <Text style={[styles.viewButtonText, viewMode === 'suggestions' && styles.viewButtonTextActive]}>
            Suggesties
          </Text>
        </TouchableOpacity>
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
    backgroundColor: SemanticColors.background,
  },

  // View Selector
  viewSelector: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.card,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.border,
    gap: 8,
  },
  viewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  viewButtonActive: {
    backgroundColor: Palette.purple + '15',
  },
  viewButtonIconContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: Palette.red,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  viewButtonText: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    fontWeight: '500',
  },
  viewButtonTextActive: {
    color: Palette.purple,
    fontWeight: '600',
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
    backgroundColor: Palette.purple + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: SemanticColors.text,
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 15,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  quickActionsTitle: {
    fontSize: 14,
    fontWeight: '600',
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
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  quickActionLabel: {
    fontSize: 12,
    color: SemanticColors.text,
    textAlign: 'center',
    marginTop: 8,
  },
  capabilitiesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  capabilityCard: {
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: SemanticColors.border,
    width: '100%',
  },
  capabilityName: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  capabilityDesc: {
    fontSize: 13,
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
    backgroundColor: Palette.purple + '10',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  exampleText: {
    fontSize: 12,
    color: Palette.purple,
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
    borderRadius: 16,
    backgroundColor: Palette.purple + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  messageBubble: {
    maxWidth: '80%',
    backgroundColor: SemanticColors.card,
    borderRadius: 16,
    borderTopLeftRadius: 4,
    padding: 14,
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  userBubble: {
    backgroundColor: Palette.purple,
    borderColor: Palette.purple,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 4,
  },
  messageText: {
    fontSize: 15,
    color: SemanticColors.text,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#fff',
  },
  messageAction: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.border,
    gap: 6,
  },
  messageActionText: {
    fontSize: 14,
    color: Palette.blue,
    fontWeight: '500',
  },

  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: SemanticColors.card,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.border,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: SemanticColors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: SemanticColors.text,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Palette.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: SemanticColors.border,
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
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  insightsSubtitle: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  insightCard: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SemanticColors.border,
    borderLeftWidth: 4,
    gap: 12,
  },
  insightIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.text,
    flex: 1,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '600',
  },
  insightDescription: {
    fontSize: 14,
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
    fontSize: 14,
    color: Palette.blue,
    fontWeight: '500',
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
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  suggestionsSubtitle: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  suggestionCard: {
    backgroundColor: SemanticColors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: SemanticColors.border,
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
    borderRadius: 24,
    backgroundColor: Palette.emerald + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionTitleContainer: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  confidenceBadge: {
    backgroundColor: Palette.emerald + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  confidenceText: {
    fontSize: 11,
    color: Palette.emerald,
    fontWeight: '600',
  },
  suggestionDescription: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  impactBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.emerald + '10',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 8,
  },
  impactText: {
    fontSize: 14,
    color: Palette.emerald,
    fontWeight: '500',
  },
  basedOnBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 6,
  },
  basedOnText: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  actionSteps: {
    marginBottom: 16,
  },
  actionStepsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.text,
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
    borderRadius: 12,
    backgroundColor: Palette.blue + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: '600',
    color: Palette.blue,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: SemanticColors.text,
    lineHeight: 20,
  },
  implementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.emerald,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  implementButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
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
  },
});

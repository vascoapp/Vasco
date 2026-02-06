// =============================================================================
// CUSTOMER FOLLOW-UP COMPONENT
// =============================================================================
// Manages automated customer follow-ups with AI-powered scheduling and messaging
// Tracks outcomes to continuously improve timing and content
// =============================================================================

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors } from '../../theme/colors';
import {
  useFollowUps,
  useFollowUpTemplates,
  useCustomers,
  followUpService,
  FollowUp,
  FollowUpTemplate,
  Customer,
} from '../../services/followUpService';

// ============================================
// MAIN COMPONENT
// ============================================

export function CustomerFollowUp() {
  const [activeTab, setActiveTab] = useState<'due' | 'scheduled' | 'completed'>('due');
  const [selectedFollowUp, setSelectedFollowUp] = useState<FollowUp | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const {
    followUps,
    dueCount,
    completeFollowUp,
    snoozeFollowUp,
    cancelFollowUp,
    scheduleFollowUp,
    todayFollowUps,
    suggestedFollowUps,
    statistics,
  } = useFollowUps();

  const tabs = [
    {
      key: 'due' as const,
      label: 'Te doen',
      icon: 'alert-circle-outline' as const,
      badge: dueCount > 0 ? dueCount : undefined,
    },
    {
      key: 'scheduled' as const,
      label: 'Gepland',
      icon: 'calendar-outline' as const,
    },
    {
      key: 'completed' as const,
      label: 'Afgerond',
      icon: 'checkmark-circle-outline' as const,
    },
  ];

  const filteredFollowUps = useMemo(() => {
    switch (activeTab) {
      case 'due':
        return followUps.filter((f) => f.status === 'due' || f.status === 'overdue');
      case 'scheduled':
        return followUps.filter((f) => f.status === 'scheduled' || f.status === 'snoozed');
      case 'completed':
        return followUps.filter((f) => f.status === 'completed' || f.status === 'cancelled');
      default:
        return followUps;
    }
  }, [followUps, activeTab]);

  return (
    <View style={styles.container}>
      {/* Stats Header */}
      <View style={styles.statsHeader}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{statistics.responseRate}%</Text>
          <Text style={styles.statLabel}>Responsrate</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{statistics.conversionRate}%</Text>
          <Text style={styles.statLabel}>Conversie</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: SemanticColors.feedbackSuccess }]}>
            €{statistics.savedDealValue.toLocaleString('nl-NL')}
          </Text>
          <Text style={styles.statLabel}>Deals gered</Text>
        </View>
      </View>

      {/* Today's Follow-ups Banner */}
      {todayFollowUps.length > 0 && (
        <View style={styles.todayBanner}>
          <Ionicons name="today" size={24} color={SemanticColors.actionPrimary} />
          <View style={styles.todayContent}>
            <Text style={styles.todayTitle}>
              {todayFollowUps.length} follow-up{todayFollowUps.length > 1 ? 's' : ''} vandaag
            </Text>
            <Text style={styles.todaySubtitle}>
              {todayFollowUps.map((f) => f.customerName).join(', ')}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.todayButton}
            onPress={() => setSelectedFollowUp(todayFollowUps[0])}
          >
            <Text style={styles.todayButtonText}>Start</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon}
              size={20}
              color={activeTab === tab.key ? SemanticColors.actionPrimary : SemanticColors.textSecondary}
            />
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
            {tab.badge && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{tab.badge}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Suggested Follow-ups */}
        {activeTab === 'due' && suggestedFollowUps.length > 0 && (
          <View style={styles.suggestedSection}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="bulb" size={16} color={SemanticColors.actionPrimary} /> Aanbevelingen
            </Text>
            {suggestedFollowUps.map((suggestion, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.suggestionCard}
                onPress={() => {
                  // Schedule the suggested follow-up
                  const followUp = scheduleFollowUp({
                    customerId: suggestion.customerId,
                    type: suggestion.type,
                    scheduledDate: suggestion.suggestedDate,
                  });
                  setSelectedFollowUp(followUp);
                }}
              >
                <View style={styles.suggestionInfo}>
                  <Text style={styles.suggestionCustomer}>{suggestion.customerName}</Text>
                  <Text style={styles.suggestionReason}>{suggestion.reason}</Text>
                </View>
                <View style={styles.suggestionAction}>
                  <Ionicons name="add-circle" size={24} color={SemanticColors.actionPrimary} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Follow-up List */}
        {filteredFollowUps.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name={activeTab === 'due' ? 'checkmark-circle' : 'calendar-outline'}
              size={64}
              color={SemanticColors.textSecondary}
            />
            <Text style={styles.emptyTitle}>
              {activeTab === 'due'
                ? 'Alles bijgewerkt!'
                : activeTab === 'scheduled'
                ? 'Geen geplande follow-ups'
                : 'Nog geen afgeronde follow-ups'}
            </Text>
            <Text style={styles.emptyText}>
              {activeTab === 'due'
                ? 'Er zijn geen openstaande follow-ups.'
                : 'Plan een nieuwe follow-up om te beginnen.'}
            </Text>
          </View>
        ) : (
          <View style={styles.followUpList}>
            {filteredFollowUps.map((followUp) => (
              <FollowUpCard
                key={followUp.id}
                followUp={followUp}
                onPress={() => setSelectedFollowUp(followUp)}
                onQuickComplete={() => {
                  Alert.alert(
                    'Follow-up afronden',
                    'Wat was het resultaat?',
                    [
                      { text: 'Reactie ontvangen', onPress: () => completeFollowUp(followUp.id, 'responded') },
                      { text: 'Deal gewonnen', onPress: () => completeFollowUp(followUp.id, 'converted') },
                      { text: 'Geen reactie', onPress: () => completeFollowUp(followUp.id, 'no_response') },
                      { text: 'Annuleren', style: 'cancel' },
                    ]
                  );
                }}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowScheduleModal(true)}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Follow-up Detail Modal */}
      <Modal
        visible={!!selectedFollowUp}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedFollowUp(null)}
      >
        {selectedFollowUp && (
          <FollowUpDetailModal
            followUp={selectedFollowUp}
            onComplete={(outcome, notes) => {
              completeFollowUp(selectedFollowUp.id, outcome, notes);
              setSelectedFollowUp(null);
            }}
            onSnooze={(days) => {
              snoozeFollowUp(selectedFollowUp.id, days);
              setSelectedFollowUp(null);
            }}
            onCancel={(reason) => {
              cancelFollowUp(selectedFollowUp.id, reason);
              setSelectedFollowUp(null);
            }}
            onClose={() => setSelectedFollowUp(null)}
          />
        )}
      </Modal>

      {/* Schedule Modal */}
      <Modal
        visible={showScheduleModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowScheduleModal(false)}
      >
        <ScheduleFollowUpModal
          onSchedule={(params) => {
            const followUp = scheduleFollowUp(params);
            setShowScheduleModal(false);
            setSelectedFollowUp(followUp);
          }}
          onClose={() => setShowScheduleModal(false)}
        />
      </Modal>
    </View>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

function FollowUpCard({
  followUp,
  onPress,
  onQuickComplete,
}: {
  followUp: FollowUp;
  onPress: () => void;
  onQuickComplete: () => void;
}) {
  const getTypeIcon = (type: FollowUp['type']): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'quote_reminder':
        return 'document-text';
      case 'project_check_in':
        return 'construct';
      case 'post_project':
        return 'star';
      case 'maintenance_reminder':
        return 'build';
      case 'seasonal':
        return 'sunny';
      case 'anniversary':
        return 'gift';
      default:
        return 'chatbubble';
    }
  };

  const getTypeLabel = (type: FollowUp['type']) => {
    switch (type) {
      case 'quote_reminder':
        return 'Offerte';
      case 'project_check_in':
        return 'Project';
      case 'post_project':
        return 'Na project';
      case 'maintenance_reminder':
        return 'Onderhoud';
      case 'seasonal':
        return 'Seizoen';
      case 'anniversary':
        return 'Jubileum';
      default:
        return 'Follow-up';
    }
  };

  const getStatusColor = (status: FollowUp['status']) => {
    switch (status) {
      case 'overdue':
        return SemanticColors.feedbackError;
      case 'due':
        return SemanticColors.feedbackWarning;
      case 'scheduled':
        return SemanticColors.actionPrimary;
      case 'completed':
        return SemanticColors.feedbackSuccess;
      default:
        return SemanticColors.textSecondary;
    }
  };

  const getPriorityColor = (priority: FollowUp['priority']) => {
    switch (priority) {
      case 'high':
        return SemanticColors.feedbackError;
      case 'medium':
        return '#FF9500';
      default:
        return SemanticColors.textSecondary;
    }
  };

  return (
    <TouchableOpacity style={styles.followUpCard} onPress={onPress}>
      <View style={styles.followUpHeader}>
        <View style={[styles.typeIcon, { backgroundColor: getStatusColor(followUp.status) + '20' }]}>
          <Ionicons
            name={getTypeIcon(followUp.type)}
            size={20}
            color={getStatusColor(followUp.status)}
          />
        </View>
        <View style={styles.followUpInfo}>
          <Text style={styles.followUpCustomer}>{followUp.customerName}</Text>
          <Text style={styles.followUpType}>{getTypeLabel(followUp.type)}</Text>
        </View>
        <View style={styles.followUpMeta}>
          {followUp.status === 'overdue' && (
            <View style={[styles.statusBadge, { backgroundColor: SemanticColors.feedbackError + '20' }]}>
              <Text style={[styles.statusText, { color: SemanticColors.feedbackError }]}>
                {Math.abs(followUp.dueInDays)}d te laat
              </Text>
            </View>
          )}
          {followUp.status === 'due' && (
            <View style={[styles.statusBadge, { backgroundColor: SemanticColors.feedbackWarning + '20' }]}>
              <Text style={[styles.statusText, { color: SemanticColors.feedbackWarning }]}>Vandaag</Text>
            </View>
          )}
          {followUp.status === 'scheduled' && (
            <Text style={styles.dueDate}>
              {followUp.dueInDays === 0
                ? 'Vandaag'
                : followUp.dueInDays === 1
                ? 'Morgen'
                : `${followUp.dueInDays}d`}
            </Text>
          )}
        </View>
      </View>

      {/* Preview of message */}
      <Text style={styles.messagePreview} numberOfLines={2}>
        {followUp.suggestedMessage}
      </Text>

      {/* Personalization factors */}
      {followUp.personalizationFactors.length > 0 && (
        <View style={styles.factorsRow}>
          {followUp.personalizationFactors.slice(0, 2).map((factor, idx) => (
            <View key={idx} style={styles.factorChip}>
              <Text style={styles.factorText}>{factor}</Text>
            </View>
          ))}
          {followUp.personalizationFactors.length > 2 && (
            <Text style={styles.moreFactors}>
              +{followUp.personalizationFactors.length - 2}
            </Text>
          )}
        </View>
      )}

      {/* Footer */}
      <View style={styles.followUpFooter}>
        <View style={styles.confidenceRow}>
          <Text style={styles.confidenceLabel}>Kans op reactie:</Text>
          <View style={styles.confidenceBar}>
            <View
              style={[
                styles.confidenceFill,
                { width: `${followUp.predictedResponseRate * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.confidenceValue}>
            {Math.round(followUp.predictedResponseRate * 100)}%
          </Text>
        </View>

        {(followUp.status === 'due' || followUp.status === 'overdue') && (
          <TouchableOpacity
            style={styles.quickCompleteButton}
            onPress={(e) => {
              e.stopPropagation();
              onQuickComplete();
            }}
          >
            <Ionicons name="checkmark" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ============================================
// MODALS
// ============================================

function FollowUpDetailModal({
  followUp,
  onComplete,
  onSnooze,
  onCancel,
  onClose,
}: {
  followUp: FollowUp;
  onComplete: (outcome: FollowUp['outcome'], notes?: string) => void;
  onSnooze: (days: number) => void;
  onCancel: (reason?: string) => void;
  onClose: () => void;
}) {
  const [message, setMessage] = useState(followUp.suggestedMessage);
  const [showOutcomeOptions, setShowOutcomeOptions] = useState(false);

  const getContactAction = () => {
    const customer = followUpService.getCustomer(followUp.customerId);
    const phone = customer?.phone?.replace(/\s/g, '') ?? '';
    const email = customer?.email ?? '';

    Alert.alert(
      'Contact opnemen',
      'Kies een manier om contact op te nemen:',
      [
        { text: 'WhatsApp', onPress: () => Linking.openURL(`https://wa.me/${phone}`) },
        { text: 'E-mail', onPress: () => Linking.openURL(`mailto:${email}`) },
        { text: 'Bellen', onPress: () => Linking.openURL(`tel:${phone}`) },
        { text: 'Annuleren', style: 'cancel' },
      ]
    );
  };

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Follow-up</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalBody}>
          {/* Customer Info */}
          <View style={styles.customerSection}>
            <View style={styles.customerAvatar}>
              <Text style={styles.customerInitial}>
                {followUp.customerName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.customerDetails}>
              <Text style={styles.customerName}>{followUp.customerName}</Text>
              <Text style={styles.customerMeta}>
                {followUp.scheduledTime && `${followUp.scheduledTime} • `}
                {new Date(followUp.scheduledDate).toLocaleDateString('nl-NL')}
              </Text>
            </View>
          </View>

          {/* AI Insights */}
          <View style={styles.insightsSection}>
            <Text style={styles.insightsTitle}>
              <Ionicons name="bulb" size={16} color={SemanticColors.actionPrimary} /> Inzichten
            </Text>
            <View style={styles.insightsList}>
              {followUp.personalizationFactors.map((factor, idx) => (
                <View key={idx} style={styles.insightItem}>
                  <Ionicons name="checkmark-circle" size={16} color={SemanticColors.feedbackSuccess} />
                  <Text style={styles.insightText}>{factor}</Text>
                </View>
              ))}
            </View>
            <View style={styles.responsePredict}>
              <Text style={styles.responsePredictLabel}>Voorspelde reactiekans</Text>
              <View style={styles.responsePredictBar}>
                <View
                  style={[
                    styles.responsePredictFill,
                    { width: `${followUp.predictedResponseRate * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.responsePredictValue}>
                {Math.round(followUp.predictedResponseRate * 100)}%
              </Text>
            </View>
          </View>

          {/* Message */}
          <View style={styles.messageSection}>
            <Text style={styles.messageSectionTitle}>Bericht</Text>
            {followUp.suggestedSubject && (
              <Text style={styles.messageSubject}>{followUp.suggestedSubject}</Text>
            )}
            <TextInput
              style={styles.messageInput}
              value={message}
              onChangeText={setMessage}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Data Sources */}
          <View style={styles.sourcesSection}>
            <Text style={styles.sourcesTitle}>Gebaseerd op</Text>
            <View style={styles.sourcesList}>
              {followUp.basedOn.map((source, idx) => (
                <View key={idx} style={styles.sourceChip}>
                  <Text style={styles.sourceText}>{source}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Actions */}
        {followUp.status === 'completed' ? (
          <View style={styles.completedInfo}>
            <Ionicons name="checkmark-circle" size={24} color={SemanticColors.feedbackSuccess} />
            <Text style={styles.completedText}>
              Afgerond op {new Date(followUp.completedAt!).toLocaleDateString('nl-NL')}
            </Text>
          </View>
        ) : (
          <View style={styles.modalActions}>
            <View style={styles.secondaryActions}>
              <TouchableOpacity
                style={styles.snoozeButton}
                onPress={() => {
                  Alert.alert('Uitstellen', 'Hoelang uitstellen?', [
                    { text: '1 dag', onPress: () => onSnooze(1) },
                    { text: '3 dagen', onPress: () => onSnooze(3) },
                    { text: '1 week', onPress: () => onSnooze(7) },
                    { text: 'Annuleren', style: 'cancel' },
                  ]);
                }}
              >
                <Ionicons name="time" size={20} color={SemanticColors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  Alert.alert(
                    'Annuleren',
                    'Weet je zeker dat je deze follow-up wilt annuleren?',
                    [
                      { text: 'Ja, annuleren', style: 'destructive', onPress: () => onCancel() },
                      { text: 'Nee', style: 'cancel' },
                    ]
                  );
                }}
              >
                <Ionicons name="trash-outline" size={20} color={SemanticColors.feedbackError} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.contactButton} onPress={getContactAction}>
              <Ionicons name="chatbubble" size={20} color="#FFFFFF" />
              <Text style={styles.contactButtonText}>Contact</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.completeButton}
              onPress={() => setShowOutcomeOptions(true)}
            >
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
              <Text style={styles.completeButtonText}>Afronden</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Outcome Options Modal */}
        {showOutcomeOptions && (
          <View style={styles.outcomeOverlay}>
            <View style={styles.outcomeModal}>
              <Text style={styles.outcomeTitle}>Resultaat</Text>
              <TouchableOpacity
                style={styles.outcomeOption}
                onPress={() => onComplete('responded')}
              >
                <Ionicons name="chatbubble-outline" size={24} color={SemanticColors.actionPrimary} />
                <Text style={styles.outcomeOptionText}>Reactie ontvangen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.outcomeOption}
                onPress={() => onComplete('converted')}
              >
                <Ionicons name="trophy-outline" size={24} color={SemanticColors.feedbackSuccess} />
                <Text style={styles.outcomeOptionText}>Deal gewonnen!</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.outcomeOption}
                onPress={() => onComplete('no_response')}
              >
                <Ionicons name="hourglass-outline" size={24} color={SemanticColors.textSecondary} />
                <Text style={styles.outcomeOptionText}>Geen reactie</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.outcomeOption}
                onPress={() => onComplete('declined')}
              >
                <Ionicons name="close-circle-outline" size={24} color={SemanticColors.feedbackError} />
                <Text style={styles.outcomeOptionText}>Afgewezen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.outcomeCancel}
                onPress={() => setShowOutcomeOptions(false)}
              >
                <Text style={styles.outcomeCancelText}>Annuleren</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

function ScheduleFollowUpModal({
  onSchedule,
  onClose,
}: {
  onSchedule: (params: {
    customerId: string;
    type: FollowUp['type'];
    scheduledDate: string;
    scheduledTime?: string;
  }) => void;
  onClose: () => void;
}) {
  const customers = useCustomers();
  const templates = useFollowUpTemplates();

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedType, setSelectedType] = useState<FollowUp['type']>('quote_reminder');
  const [selectedDate, setSelectedDate] = useState(
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  const followUpTypes: Array<{ type: FollowUp['type']; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { type: 'quote_reminder', label: 'Offerte opvolging', icon: 'document-text' },
    { type: 'project_check_in', label: 'Project check-in', icon: 'construct' },
    { type: 'post_project', label: 'Na project', icon: 'star' },
    { type: 'maintenance_reminder', label: 'Onderhoud', icon: 'build' },
    { type: 'seasonal', label: 'Seizoensactie', icon: 'sunny' },
  ];

  const handleSchedule = () => {
    if (!selectedCustomer) {
      Alert.alert('Selecteer een klant');
      return;
    }
    onSchedule({
      customerId: selectedCustomer.id,
      type: selectedType,
      scheduledDate: selectedDate,
    });
  };

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.scheduleModal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Follow-up plannen</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalBody}>
          {/* Customer Selection */}
          <Text style={styles.fieldLabel}>Klant</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.customerList}
          >
            {customers.map((customer) => (
              <TouchableOpacity
                key={customer.id}
                style={[
                  styles.customerOption,
                  selectedCustomer?.id === customer.id && styles.customerOptionSelected,
                ]}
                onPress={() => setSelectedCustomer(customer)}
              >
                <View style={styles.customerOptionAvatar}>
                  <Text style={styles.customerOptionInitial}>
                    {customer.name.charAt(0)}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.customerOptionName,
                    selectedCustomer?.id === customer.id && styles.customerOptionNameSelected,
                  ]}
                  numberOfLines={1}
                >
                  {customer.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Type Selection */}
          <Text style={styles.fieldLabel}>Type follow-up</Text>
          <View style={styles.typeGrid}>
            {followUpTypes.map((typeOption) => (
              <TouchableOpacity
                key={typeOption.type}
                style={[
                  styles.typeOption,
                  selectedType === typeOption.type && styles.typeOptionSelected,
                ]}
                onPress={() => setSelectedType(typeOption.type)}
              >
                <Ionicons
                  name={typeOption.icon}
                  size={24}
                  color={
                    selectedType === typeOption.type
                      ? SemanticColors.actionPrimary
                      : SemanticColors.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.typeOptionLabel,
                    selectedType === typeOption.type && styles.typeOptionLabelSelected,
                  ]}
                >
                  {typeOption.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Date Selection */}
          <Text style={styles.fieldLabel}>Datum</Text>
          <View style={styles.dateOptions}>
            {[
              { label: 'Morgen', days: 1 },
              { label: 'Over 3 dagen', days: 3 },
              { label: 'Volgende week', days: 7 },
            ].map((option) => {
              const date = new Date(Date.now() + option.days * 24 * 60 * 60 * 1000)
                .toISOString()
                .split('T')[0];
              return (
                <TouchableOpacity
                  key={option.days}
                  style={[
                    styles.dateOption,
                    selectedDate === date && styles.dateOptionSelected,
                  ]}
                  onPress={() => setSelectedDate(date)}
                >
                  <Text
                    style={[
                      styles.dateOptionText,
                      selectedDate === date && styles.dateOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Customer insights if selected */}
          {selectedCustomer && (
            <View style={styles.customerInsights}>
              <Text style={styles.insightsTitle}>
                <Ionicons name="information-circle" size={16} /> Klantinfo
              </Text>
              <Text style={styles.insightText}>
                Voorkeur: {selectedCustomer.preferredContact}
              </Text>
              {selectedCustomer.bestContactTime && (
                <Text style={styles.insightText}>
                  Beste tijd: {selectedCustomer.bestContactTime}
                </Text>
              )}
              <Text style={styles.insightText}>
                {selectedCustomer.totalProjects} projecten • €
                {selectedCustomer.totalRevenue.toLocaleString('nl-NL')}
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.scheduleActions}>
          <TouchableOpacity style={styles.scheduleCancelButton} onPress={onClose}>
            <Text style={styles.scheduleCancelText}>Annuleren</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.scheduleConfirmButton,
              !selectedCustomer && styles.scheduleConfirmDisabled,
            ]}
            onPress={handleSchedule}
            disabled={!selectedCustomer}
          >
            <Ionicons name="calendar" size={20} color="#FFFFFF" />
            <Text style={styles.scheduleConfirmText}>Plannen</Text>
          </TouchableOpacity>
        </View>
      </View>
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

  // Stats Header
  statsHeader: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: SemanticColors.borderDefault,
    marginVertical: 8,
  },

  // Today Banner
  todayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.actionPrimary + '15',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    gap: 12,
  },
  todayContent: {
    flex: 1,
  },
  todayTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  todaySubtitle: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  todayButton: {
    backgroundColor: SemanticColors.actionPrimary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  todayButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    marginTop: 12,
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
    fontSize: 13,
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

  // Suggested Section
  suggestedSection: {
    padding: 16,
    paddingBottom: 0,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: 12,
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: SemanticColors.actionPrimary + '30',
    borderStyle: 'dashed',
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionCustomer: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  suggestionReason: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  suggestionAction: {
    padding: 4,
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },

  // Follow-up List
  followUpList: {
    padding: 16,
  },

  // Follow-up Card
  followUpCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  followUpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  followUpInfo: {
    flex: 1,
  },
  followUpCustomer: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  followUpType: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  followUpMeta: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  dueDate: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  messagePreview: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  factorsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  factorChip: {
    backgroundColor: SemanticColors.surfaceBackground,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  factorText: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  moreFactors: {
    fontSize: 11,
    color: SemanticColors.actionPrimary,
    alignSelf: 'center',
  },
  followUpFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  confidenceLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  confidenceBar: {
    flex: 1,
    height: 4,
    backgroundColor: SemanticColors.borderDefault,
    borderRadius: 2,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: SemanticColors.actionPrimary,
    borderRadius: 2,
  },
  confidenceValue: {
    fontSize: 11,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    width: 32,
    textAlign: 'right',
  },
  quickCompleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: SemanticColors.feedbackSuccess,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: SemanticColors.actionPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
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
  modalActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
    alignItems: 'center',
  },

  // Customer Section
  customerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  customerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: SemanticColors.actionPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  customerInitial: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  customerDetails: {
    flex: 1,
  },
  customerName: {
    fontSize: 20,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  customerMeta: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },

  // Insights Section
  insightsSection: {
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  insightsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: 12,
  },
  insightsList: {
    gap: 8,
    marginBottom: 12,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  insightText: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  responsePredict: {
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
    paddingTop: 12,
  },
  responsePredictLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginBottom: 8,
  },
  responsePredictBar: {
    height: 6,
    backgroundColor: SemanticColors.borderDefault,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  responsePredictFill: {
    height: '100%',
    backgroundColor: SemanticColors.feedbackSuccess,
    borderRadius: 3,
  },
  responsePredictValue: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },

  // Message Section
  messageSection: {
    marginBottom: 20,
  },
  messageSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: 8,
  },
  messageSubject: {
    fontSize: 14,
    fontWeight: '500',
    color: SemanticColors.textPrimary,
    marginBottom: 8,
    backgroundColor: SemanticColors.surfaceBackground,
    padding: 12,
    borderRadius: 8,
  },
  messageInput: {
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: SemanticColors.textPrimary,
    minHeight: 150,
    lineHeight: 20,
  },

  // Sources Section
  sourcesSection: {
    marginBottom: 20,
  },
  sourcesTitle: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginBottom: 8,
  },
  sourcesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sourceChip: {
    backgroundColor: SemanticColors.surfaceBackground,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  sourceText: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },

  // Action Buttons
  secondaryActions: {
    flexDirection: 'row',
    gap: 8,
  },
  snoozeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SemanticColors.surfaceBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SemanticColors.feedbackError + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: SemanticColors.actionPrimary,
  },
  contactButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: SemanticColors.feedbackSuccess,
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },

  // Completed Info
  completedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  completedText: {
    fontSize: 14,
    color: SemanticColors.feedbackSuccess,
  },

  // Outcome Modal
  outcomeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  outcomeModal: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 300,
  },
  outcomeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    textAlign: 'center',
    marginBottom: 20,
  },
  outcomeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 10,
    backgroundColor: SemanticColors.surfaceBackground,
    marginBottom: 8,
  },
  outcomeOptionText: {
    fontSize: 15,
    color: SemanticColors.textPrimary,
  },
  outcomeCancel: {
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  outcomeCancelText: {
    fontSize: 15,
    color: SemanticColors.textSecondary,
  },

  // Schedule Modal
  scheduleModal: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: 12,
    marginTop: 8,
  },
  customerList: {
    marginBottom: 16,
  },
  customerOption: {
    alignItems: 'center',
    padding: 12,
    marginRight: 12,
    borderRadius: 12,
    backgroundColor: SemanticColors.surfaceBackground,
    width: 100,
  },
  customerOptionSelected: {
    backgroundColor: SemanticColors.actionPrimary + '20',
    borderWidth: 2,
    borderColor: SemanticColors.actionPrimary,
  },
  customerOptionAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: SemanticColors.actionPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  customerOptionInitial: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  customerOptionName: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
  },
  customerOptionNameSelected: {
    color: SemanticColors.actionPrimary,
    fontWeight: '600',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  typeOption: {
    width: '48%',
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  typeOptionSelected: {
    backgroundColor: SemanticColors.actionPrimary + '20',
    borderWidth: 2,
    borderColor: SemanticColors.actionPrimary,
  },
  typeOptionLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
  },
  typeOptionLabelSelected: {
    color: SemanticColors.actionPrimary,
    fontWeight: '600',
  },
  dateOptions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  dateOption: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  dateOptionSelected: {
    backgroundColor: SemanticColors.actionPrimary,
  },
  dateOptionText: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  dateOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  customerInsights: {
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  scheduleActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  scheduleCancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  scheduleCancelText: {
    fontSize: 16,
    color: SemanticColors.textSecondary,
  },
  scheduleConfirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: SemanticColors.actionPrimary,
  },
  scheduleConfirmDisabled: {
    opacity: 0.5,
  },
  scheduleConfirmText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CustomerFollowUp;

// Decision Tracker - Help contractors guide customers through project decisions
// Reduces delays, improves customer experience, builds repeat business
import { useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import type {
  CustomerDecisionTracker,
  CustomerDecisionCategory,
  CustomerDecisionItem,
  DecisionTemplate,
} from '../../types/decisions';
import {
  MOCK_ACTIVE_TRACKERS,
  DECISION_TEMPLATES,
  getTrackerStats,
} from '../../data/mockDecisions';

type IconName = keyof typeof Ionicons.glyphMap;

// ============================================
// MAIN DECISION TRACKER LIST
// ============================================

interface DecisionTrackerListProps {
  onSelectTracker?: (tracker: CustomerDecisionTracker) => void;
  onCreateNew?: () => void;
}

export function DecisionTrackerList({
  onSelectTracker,
  onCreateNew,
}: DecisionTrackerListProps) {
  const trackers = MOCK_ACTIVE_TRACKERS;
  const [filter, setFilter] = useState<'all' | 'overdue' | 'pending'>('all');

  const totalOverdue = trackers.reduce((sum, t) => sum + t.overdueCount, 0);
  const totalPending = trackers.reduce((sum, t) => sum + t.pendingCount, 0);

  const filteredTrackers = trackers.filter(t => {
    if (filter === 'overdue') return t.overdueCount > 0;
    if (filter === 'pending') return t.pendingCount > 0;
    return true;
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Stats Overview - pressable filters */}
      <View style={styles.statsRow}>
        <Pressable
          style={[styles.statCard, filter === 'all' && styles.statCardActive]}
          onPress={() => setFilter('all')}
        >
          <Ionicons name="people" size={24} color={SemanticColors.actionPrimary} />
          <Text style={styles.statValue}>{trackers.length}</Text>
          <Text style={styles.statLabel}>Actief</Text>
        </Pressable>
        <Pressable
          style={[styles.statCard, filter === 'overdue' && styles.statCardActive]}
          onPress={() => setFilter(filter === 'overdue' ? 'all' : 'overdue')}
        >
          <Ionicons name="alert-circle" size={24} color={SemanticColors.feedbackError} />
          <Text style={[styles.statValue, { color: SemanticColors.feedbackError }]}>
            {totalOverdue}
          </Text>
          <Text style={styles.statLabel}>Verlopen</Text>
        </Pressable>
        <Pressable
          style={[styles.statCard, filter === 'pending' && styles.statCardActive]}
          onPress={() => setFilter(filter === 'pending' ? 'all' : 'pending')}
        >
          <Ionicons name="time" size={24} color={SemanticColors.feedbackWarning} />
          <Text style={[styles.statValue, { color: SemanticColors.feedbackWarning }]}>
            {totalPending}
          </Text>
          <Text style={styles.statLabel}>Wachtend</Text>
        </Pressable>
      </View>

      {/* Add New Button */}
      <Pressable style={styles.addNewButton} onPress={onCreateNew}>
        <Ionicons name="add-circle" size={20} color={SemanticColors.actionPrimary} />
        <Text style={styles.addNewText}>Nieuwe keuzelijst</Text>
      </Pressable>

      {/* Active Trackers List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {filter === 'overdue' ? 'Verlopen keuzes' : filter === 'pending' ? 'Wachtende keuzes' : 'Actieve trackers'}
        </Text>
        {filteredTrackers.map((tracker) => (
          <TrackerCard
            key={tracker.id}
            tracker={tracker}
            onPress={() => onSelectTracker?.(tracker)}
          />
        ))}
      </View>
    </ScrollView>
  );
}

// ============================================
// TRACKER CARD
// ============================================

interface TrackerCardProps {
  tracker: CustomerDecisionTracker;
  onPress?: () => void;
}

function TrackerCard({ tracker, onPress }: TrackerCardProps) {
  const stats = getTrackerStats(tracker);
  const progressPercent = stats.completionPercent;

  const getChannelIcon = (): IconName => {
    switch (tracker.preferredChannel) {
      case 'whatsapp': return 'logo-whatsapp';
      case 'sms': return 'chatbubble';
      case 'email': return 'mail';
      default: return 'chatbubble';
    }
  };

  return (
    <Pressable style={styles.trackerCard} onPress={onPress}>
      <View style={styles.trackerHeader}>
        <View style={styles.trackerCustomer}>
          <View style={styles.customerAvatar}>
            <Text style={styles.customerInitials}>
              {tracker.customerName.split(' ').slice(0, 2).map(n => n[0]).join('')}
            </Text>
          </View>
          <View style={styles.customerInfo}>
            <Text style={styles.customerName}>{tracker.customerName}</Text>
            <Text style={styles.projectType}>{tracker.templateName}</Text>
          </View>
        </View>
        <View style={styles.channelBadge}>
          <Ionicons name={getChannelIcon()} size={14} color={SemanticColors.textSecondary} />
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>
        <Text style={styles.progressText}>{progressPercent}%</Text>
      </View>

      {/* Stats Row */}
      <View style={styles.trackerStats}>
        <View style={styles.trackerStat}>
          <Ionicons name="checkmark-circle" size={16} color={SemanticColors.feedbackSuccess} />
          <Text style={styles.trackerStatText}>{stats.decided} decided</Text>
        </View>
        {stats.overdue > 0 && (
          <View style={styles.trackerStat}>
            <Ionicons name="alert-circle" size={16} color={SemanticColors.feedbackError} />
            <Text style={[styles.trackerStatText, { color: SemanticColors.feedbackError }]}>
              {stats.overdue} overdue
            </Text>
          </View>
        )}
        <View style={styles.trackerStat}>
          <Ionicons name="time" size={16} color={SemanticColors.textTertiary} />
          <Text style={styles.trackerStatText}>{stats.upcoming} upcoming</Text>
        </View>
      </View>

      {/* Action Hint */}
      {stats.overdue > 0 && (
        <View style={styles.actionHint}>
          <Ionicons name="notifications" size={14} color={SemanticColors.feedbackWarning} />
          <Text style={styles.actionHintText}>Send reminder for overdue decisions</Text>
          <Ionicons name="chevron-forward" size={14} color={SemanticColors.feedbackWarning} />
        </View>
      )}
    </Pressable>
  );
}

// ============================================
// TRACKER DETAIL VIEW
// ============================================

interface DecisionTrackerDetailProps {
  tracker: CustomerDecisionTracker;
  onClose?: () => void;
  onSendReminder?: (trackerId: string, itemIds: string[], channel: 'whatsapp' | 'sms' | 'email') => void;
  onRecordDecision?: (trackerId: string, itemId: string, value: string | number | boolean) => void;
  onShareWithCustomer?: () => void;
}

export function DecisionTrackerDetail({
  tracker,
  onClose,
  onSendReminder,
  onRecordDecision,
  onShareWithCustomer,
}: DecisionTrackerDetailProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'overdue' | 'pending' | 'completed'>('overview');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const stats = getTrackerStats(tracker);

  const overdueItems = tracker.categories.flatMap(c =>
    c.items.filter(i => i.isOverdue && i.status === 'pending')
  );
  const pendingItems = tracker.categories.flatMap(c =>
    c.items.filter(i => !i.isOverdue && i.status === 'pending')
  );
  const completedItems = tracker.categories.flatMap(c =>
    c.items.filter(i => i.status === 'decided')
  );

  const handleSendReminder = (channel: 'whatsapp' | 'sms' | 'email') => {
    const itemsToRemind = selectedItems.length > 0 ? selectedItems : overdueItems.map(i => i.id);

    if (itemsToRemind.length === 0) {
      Alert.alert('No Items', 'Select items or have overdue items to send reminders.');
      return;
    }

    const itemNames = itemsToRemind.map(id => {
      const item = [...overdueItems, ...pendingItems].find(i => i.id === id);
      return item?.name || '';
    }).filter(Boolean);

    const message = generateReminderMessage(tracker.customerName, itemNames);

    if (channel === 'whatsapp' && tracker.customerPhone) {
      const url = `whatsapp://send?phone=${tracker.customerPhone.replace(/\s/g, '')}&text=${encodeURIComponent(message)}`;
      Linking.openURL(url).catch(() => {
        Alert.alert('Error', 'Could not open WhatsApp');
      });
    } else if (channel === 'sms' && tracker.customerPhone) {
      const url = `sms:${tracker.customerPhone}?body=${encodeURIComponent(message)}`;
      Linking.openURL(url).catch(() => {
        Alert.alert('Error', 'Could not open SMS');
      });
    } else if (channel === 'email' && tracker.customerEmail) {
      const subject = `Decisions needed for your ${tracker.templateName}`;
      const url = `mailto:${tracker.customerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
      Linking.openURL(url).catch(() => {
        Alert.alert('Error', 'Could not open email');
      });
    }

    onSendReminder?.(tracker.id, itemsToRemind, channel);
    setSelectedItems([]);
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const tabs: { id: typeof activeTab; label: string; badge?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'overdue', label: 'Overdue', badge: overdueItems.length },
    { id: 'pending', label: 'Pending', badge: pendingItems.length },
    { id: 'completed', label: 'Done', badge: completedItems.length },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.detailHeader}>
        <Pressable onPress={onClose} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={styles.headerContent}>
          <Text style={styles.detailTitle}>{tracker.customerName}</Text>
          <Text style={styles.detailSubtitle}>{tracker.templateName}</Text>
        </View>
        <Pressable style={styles.shareButton} onPress={onShareWithCustomer}>
          <Ionicons name="share-outline" size={20} color={SemanticColors.actionPrimary} />
        </Pressable>
        <View style={styles.progressBadge}>
          <Text style={styles.progressBadgeText}>{stats.completionPercent}%</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <Pressable
          style={[styles.reminderBtn, styles.whatsappBtn]}
          onPress={() => handleSendReminder('whatsapp')}
        >
          <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
          <Text style={[styles.reminderBtnText, { color: '#25D366' }]}>WhatsApp</Text>
        </Pressable>
        <Pressable
          style={styles.reminderBtn}
          onPress={() => handleSendReminder('sms')}
        >
          <Ionicons name="chatbubble" size={18} color={SemanticColors.feedbackInfo} />
          <Text style={[styles.reminderBtnText, { color: SemanticColors.feedbackInfo }]}>SMS</Text>
        </Pressable>
        <Pressable
          style={styles.reminderBtn}
          onPress={() => handleSendReminder('email')}
        >
          <Ionicons name="mail" size={18} color={SemanticColors.textSecondary} />
          <Text style={styles.reminderBtnText}>Email</Text>
        </Pressable>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
            {tab.badge !== undefined && tab.badge > 0 && (
              <View style={[
                styles.tabBadge,
                tab.id === 'overdue' && { backgroundColor: SemanticColors.feedbackError },
              ]}>
                <Text style={styles.tabBadgeText}>{tab.badge}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {/* Tab Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainerDetail}>
        {activeTab === 'overview' && (
          <OverviewTab tracker={tracker} stats={stats} />
        )}
        {activeTab === 'overdue' && (
          <DecisionItemsList
            items={overdueItems}
            selectedItems={selectedItems}
            onToggleSelect={toggleItemSelection}
            onRecordDecision={(itemId, value) => onRecordDecision?.(tracker.id, itemId, value)}
            emptyMessage="No overdue decisions"
            isOverdue
          />
        )}
        {activeTab === 'pending' && (
          <DecisionItemsList
            items={pendingItems}
            selectedItems={selectedItems}
            onToggleSelect={toggleItemSelection}
            onRecordDecision={(itemId, value) => onRecordDecision?.(tracker.id, itemId, value)}
            emptyMessage="No pending decisions"
          />
        )}
        {activeTab === 'completed' && (
          <CompletedItemsList items={completedItems} />
        )}
      </ScrollView>

      {/* Selection Footer */}
      {selectedItems.length > 0 && (
        <View style={styles.selectionFooter}>
          <Text style={styles.selectionText}>{selectedItems.length} selected</Text>
          <Pressable
            style={styles.sendSelectedBtn}
            onPress={() => handleSendReminder(tracker.preferredChannel)}
          >
            <Ionicons name="send" size={16} color="#fff" />
            <Text style={styles.sendSelectedText}>Send Reminder</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ============================================
// OVERVIEW TAB
// ============================================

function OverviewTab({
  tracker,
  stats,
}: {
  tracker: CustomerDecisionTracker;
  stats: ReturnType<typeof getTrackerStats>;
}) {
  return (
    <View style={styles.tabContent}>
      {/* Progress Summary */}
      <View style={styles.overviewCard}>
        <View style={styles.overviewProgress}>
          <View style={styles.progressCircle}>
            <Text style={styles.progressCircleText}>{stats.completionPercent}%</Text>
            <Text style={styles.progressCircleLabel}>Complete</Text>
          </View>
        </View>
        <View style={styles.overviewStats}>
          <View style={styles.overviewStatRow}>
            <Ionicons name="checkmark-circle" size={20} color={SemanticColors.feedbackSuccess} />
            <Text style={styles.overviewStatLabel}>Decided</Text>
            <Text style={styles.overviewStatValue}>{stats.decided}</Text>
          </View>
          <View style={styles.overviewStatRow}>
            <Ionicons name="alert-circle" size={20} color={SemanticColors.feedbackError} />
            <Text style={styles.overviewStatLabel}>Overdue</Text>
            <Text style={[styles.overviewStatValue, { color: SemanticColors.feedbackError }]}>
              {stats.overdue}
            </Text>
          </View>
          <View style={styles.overviewStatRow}>
            <Ionicons name="time" size={20} color={SemanticColors.feedbackWarning} />
            <Text style={styles.overviewStatLabel}>Upcoming</Text>
            <Text style={styles.overviewStatValue}>{stats.upcoming}</Text>
          </View>
        </View>
      </View>

      {/* Categories Progress */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Progress by Category</Text>
        {tracker.categories.map((category) => (
          <CategoryProgress key={category.id} category={category} />
        ))}
      </View>

      {/* Customer Contact */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Customer Contact</Text>
        <View style={styles.contactRow}>
          <Ionicons name="person" size={16} color={SemanticColors.textSecondary} />
          <Text style={styles.contactText}>{tracker.customerName}</Text>
        </View>
        {tracker.customerPhone && (
          <Pressable
            style={styles.contactRow}
            onPress={() => Linking.openURL(`tel:${tracker.customerPhone}`)}
          >
            <Ionicons name="call" size={16} color={SemanticColors.feedbackSuccess} />
            <Text style={[styles.contactText, { color: SemanticColors.feedbackSuccess }]}>
              {tracker.customerPhone}
            </Text>
          </Pressable>
        )}
        {tracker.customerEmail && (
          <Pressable
            style={styles.contactRow}
            onPress={() => Linking.openURL(`mailto:${tracker.customerEmail}`)}
          >
            <Ionicons name="mail" size={16} color={SemanticColors.feedbackInfo} />
            <Text style={[styles.contactText, { color: SemanticColors.feedbackInfo }]}>
              {tracker.customerEmail}
            </Text>
          </Pressable>
        )}
        <View style={styles.contactRow}>
          <Ionicons name="notifications" size={16} color={SemanticColors.textSecondary} />
          <Text style={styles.contactText}>
            Reminders: {tracker.reminderFrequency.replace('_', ' ')}
          </Text>
        </View>
      </View>

      {/* Timeline */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Project Timeline</Text>
        <View style={styles.timeline}>
          {tracker.phases.map((phase, index) => (
            <View key={phase.phase} style={styles.timelineItem}>
              <View style={[
                styles.timelineDot,
                new Date(phase.startDate) <= new Date() && styles.timelineDotActive,
              ]} />
              {index < tracker.phases.length - 1 && <View style={styles.timelineLine} />}
              <View style={styles.timelineContent}>
                <Text style={styles.timelinePhase}>
                  {phase.phase.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Text>
                <Text style={styles.timelineDate}>
                  {new Date(phase.startDate).toLocaleDateString('nl-NL', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ============================================
// CATEGORY PROGRESS
// ============================================

function CategoryProgress({ category }: { category: CustomerDecisionCategory }) {
  const progressPercent = Math.round((category.completedCount / category.totalCount) * 100);

  return (
    <View style={styles.categoryProgress}>
      <View style={styles.categoryHeader}>
        <Text style={styles.categoryName}>{category.name}</Text>
        <View style={styles.categoryStats}>
          <Text style={styles.categoryCount}>
            {category.completedCount}/{category.totalCount}
          </Text>
          {category.isOverdue && (
            <View style={styles.overdueTag}>
              <Ionicons name="alert-circle" size={12} color={SemanticColors.feedbackError} />
              <Text style={styles.overdueTagText}>Overdue</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.categoryBar}>
        <View style={[styles.categoryBarFill, { width: `${progressPercent}%` }]} />
      </View>
    </View>
  );
}

// ============================================
// DECISION ITEMS LIST
// ============================================

interface DecisionItemsListProps {
  items: CustomerDecisionItem[];
  selectedItems: string[];
  onToggleSelect: (itemId: string) => void;
  onRecordDecision: (itemId: string, value: string | number | boolean) => void;
  emptyMessage: string;
  isOverdue?: boolean;
}

function DecisionItemsList({
  items,
  selectedItems,
  onToggleSelect,
  onRecordDecision,
  emptyMessage,
  isOverdue,
}: DecisionItemsListProps) {
  if (items.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons
          name={isOverdue ? 'checkmark-circle' : 'time'}
          size={48}
          color={SemanticColors.textTertiary}
        />
        <Text style={styles.emptyStateText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      {items.map((item) => (
        <DecisionItemCard
          key={item.id}
          item={item}
          isSelected={selectedItems.includes(item.id)}
          onToggleSelect={() => onToggleSelect(item.id)}
          onRecordDecision={(value) => onRecordDecision(item.id, value)}
          isOverdue={isOverdue}
        />
      ))}
    </View>
  );
}

// ============================================
// DECISION ITEM CARD
// ============================================

interface DecisionItemCardProps {
  item: CustomerDecisionItem;
  isSelected: boolean;
  onToggleSelect: () => void;
  onRecordDecision: (value: string | number | boolean) => void;
  isOverdue?: boolean;
}

function DecisionItemCard({
  item,
  isSelected,
  onToggleSelect,
  onRecordDecision,
  isOverdue,
}: DecisionItemCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const getPriorityColor = () => {
    switch (item.priority) {
      case 'critical': return SemanticColors.feedbackError;
      case 'important': return SemanticColors.feedbackWarning;
      default: return SemanticColors.textTertiary;
    }
  };

  const dueDate = new Date(item.dueDate);
  const daysOverdue = isOverdue
    ? Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const handleSubmitValue = () => {
    if (inputValue.trim()) {
      onRecordDecision(inputValue);
      setInputValue('');
      setIsExpanded(false);
    }
  };

  return (
    <View style={[styles.itemCard, isOverdue && styles.itemCardOverdue]}>
      <Pressable style={styles.itemHeader} onPress={() => setIsExpanded(!isExpanded)}>
        <Pressable style={styles.checkbox} onPress={onToggleSelect}>
          <Ionicons
            name={isSelected ? 'checkbox' : 'square-outline'}
            size={22}
            color={isSelected ? SemanticColors.actionPrimary : SemanticColors.textTertiary}
          />
        </Pressable>
        <View style={styles.itemInfo}>
          <View style={styles.itemTitleRow}>
            <Text style={styles.itemName}>{item.name}</Text>
            <View style={[styles.priorityDot, { backgroundColor: getPriorityColor() }]} />
          </View>
          <Text style={styles.itemDescription} numberOfLines={isExpanded ? undefined : 1}>
            {item.description}
          </Text>
          {isOverdue && (
            <View style={styles.overdueInfo}>
              <Ionicons name="alert-circle" size={12} color={SemanticColors.feedbackError} />
              <Text style={styles.overdueText}>{daysOverdue} days overdue</Text>
              {item.remindersSent > 0 && (
                <Text style={styles.reminderCount}>• {item.remindersSent} reminders sent</Text>
              )}
            </View>
          )}
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={SemanticColors.textTertiary}
        />
      </Pressable>

      {isExpanded && (
        <View style={styles.itemExpanded}>
          {/* Input based on type */}
          {item.inputType === 'select' && item.options && (
            <View style={styles.optionsContainer}>
              <Text style={styles.optionsLabel}>Options:</Text>
              {item.options.map((option) => (
                <Pressable
                  key={option.value}
                  style={styles.optionBtn}
                  onPress={() => onRecordDecision(option.value)}
                >
                  <Text style={styles.optionLabel}>{option.label}</Text>
                  {option.description && (
                    <Text style={styles.optionDesc}>{option.description}</Text>
                  )}
                  {option.priceImpact !== undefined && option.priceImpact !== 0 && (
                    <Text style={[
                      styles.optionPrice,
                      { color: option.priceImpact > 0 ? SemanticColors.feedbackError : SemanticColors.feedbackSuccess },
                    ]}>
                      {option.priceImpact > 0 ? '+' : ''}€{option.priceImpact}
                    </Text>
                  )}
                </Pressable>
              ))}
            </View>
          )}

          {item.inputType === 'boolean' && (
            <View style={styles.booleanContainer}>
              <Pressable
                style={[styles.booleanBtn, styles.booleanYes]}
                onPress={() => onRecordDecision(true)}
              >
                <Ionicons name="checkmark" size={20} color={SemanticColors.feedbackSuccess} />
                <Text style={[styles.booleanText, { color: SemanticColors.feedbackSuccess }]}>Yes</Text>
              </Pressable>
              <Pressable
                style={[styles.booleanBtn, styles.booleanNo]}
                onPress={() => onRecordDecision(false)}
              >
                <Ionicons name="close" size={20} color={SemanticColors.feedbackError} />
                <Text style={[styles.booleanText, { color: SemanticColors.feedbackError }]}>No</Text>
              </Pressable>
            </View>
          )}

          {(item.inputType === 'text' || item.inputType === 'number' || item.inputType === 'color') && (
            <View style={styles.textInputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder={`Enter ${item.name.toLowerCase()}...`}
                placeholderTextColor={SemanticColors.textTertiary}
                value={inputValue}
                onChangeText={setInputValue}
                keyboardType={item.inputType === 'number' ? 'numeric' : 'default'}
              />
              <Pressable style={styles.submitBtn} onPress={handleSubmitValue}>
                <Ionicons name="checkmark" size={20} color="#fff" />
              </Pressable>
            </View>
          )}

          {item.inputType === 'photo' && (
            <Pressable style={styles.photoBtn}>
              <Ionicons name="camera" size={24} color={SemanticColors.actionPrimary} />
              <Text style={styles.photoBtnText}>Request Photo</Text>
            </Pressable>
          )}

          {/* Due date info */}
          <View style={styles.dueInfo}>
            <Ionicons name="calendar" size={14} color={SemanticColors.textTertiary} />
            <Text style={styles.dueText}>
              Due: {dueDate.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ============================================
// COMPLETED ITEMS LIST
// ============================================

function CompletedItemsList({ items }: { items: CustomerDecisionItem[] }) {
  if (items.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="hourglass" size={48} color={SemanticColors.textTertiary} />
        <Text style={styles.emptyStateText}>No decisions completed yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      {items.map((item) => (
        <View key={item.id} style={styles.completedItem}>
          <Ionicons name="checkmark-circle" size={20} color={SemanticColors.feedbackSuccess} />
          <View style={styles.completedInfo}>
            <Text style={styles.completedName}>{item.name}</Text>
            <Text style={styles.completedValue}>
              {typeof item.value === 'boolean' ? (item.value ? 'Yes' : 'No') : String(item.value)}
            </Text>
            {item.decidedAt && (
              <Text style={styles.completedDate}>
                {new Date(item.decidedAt).toLocaleDateString('nl-NL', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

// ============================================
// TEMPLATE SELECTOR
// ============================================

interface TemplatePickerProps {
  onSelect: (template: DecisionTemplate) => void;
  onClose?: () => void;
}

export function TemplatePicker({ onSelect, onClose }: TemplatePickerProps) {
  const templates = DECISION_TEMPLATES;

  return (
    <View style={styles.container}>
      <View style={styles.detailHeader}>
        <Pressable onPress={onClose} style={styles.backButton}>
          <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={styles.headerContent}>
          <Text style={styles.detailTitle}>Choose Template</Text>
          <Text style={styles.detailSubtitle}>Select a decision template for this project</Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainerDetail}>
        {templates.map((template) => (
          <Pressable
            key={template.id}
            style={styles.templateCard}
            onPress={() => onSelect(template)}
          >
            <View style={styles.templateHeader}>
              <Text style={styles.templateName}>{template.name}</Text>
              <View style={styles.templateMeta}>
                <Text style={styles.templateDecisions}>
                  {template.estimatedTotalDecisions} decisions
                </Text>
              </View>
            </View>
            <Text style={styles.templateDescription}>{template.description}</Text>
            <View style={styles.templateStats}>
              <View style={styles.templateStat}>
                <Ionicons name="list" size={14} color={SemanticColors.textTertiary} />
                <Text style={styles.templateStatText}>
                  {template.categories.length} categories
                </Text>
              </View>
              <View style={styles.templateStat}>
                <Ionicons name="time" size={14} color={SemanticColors.textTertiary} />
                <Text style={styles.templateStatText}>
                  ~{template.avgDaysToComplete} days avg
                </Text>
              </View>
              <View style={styles.templateStat}>
                <Ionicons name="people" size={14} color={SemanticColors.textTertiary} />
                <Text style={styles.templateStatText}>
                  Used {template.usageCount}x
                </Text>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateReminderMessage(customerName: string, items: string[]): string {
  const firstName = customerName.split(' ')[0];

  if (items.length === 1) {
    return `Hi ${firstName}, we still need your decision on: ${items[0]}. This will help us keep your project on schedule. Can you let us know today? Thanks!`;
  }

  const itemsList = items.slice(0, 3).join(', ');
  const moreCount = items.length > 3 ? ` and ${items.length - 3} more` : '';

  return `Hi ${firstName}, we're waiting on a few decisions to keep your project on track:\n\n• ${items.slice(0, 5).join('\n• ')}${items.length > 5 ? `\n• ...and ${items.length - 5} more` : ''}\n\nPlease let us know when you can. Thanks!`;
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  contentContainer: {
    padding: Spacing.md,
    paddingBottom: 100,
  },
  contentContainerDetail: {
    padding: Spacing.md,
    paddingBottom: 120,
  },
  summaryHeader: {
    marginBottom: Spacing.md,
  },
  summaryTitle: {
    color: SemanticColors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  summarySubtitle: {
    color: SemanticColors.textSecondary,
    fontSize: 14,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  statCardActive: {
    borderColor: SemanticColors.actionPrimary,
    borderWidth: 2,
  },
  statValue: {
    color: SemanticColors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    marginTop: 4,
  },
  statLabel: {
    color: SemanticColors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  addNewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: Spacing.md,
    backgroundColor: SemanticColors.actionPrimary + '15',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SemanticColors.actionPrimary + '30',
    borderStyle: 'dashed',
    marginBottom: Spacing.lg,
  },
  addNewText: {
    color: SemanticColors.actionPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  trackerCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  trackerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trackerCustomer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  customerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SemanticColors.actionPrimary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerInitials: {
    color: SemanticColors.actionPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    color: SemanticColors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  projectType: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
  },
  channelBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: SemanticColors.actionPrimary,
    borderRadius: 3,
  },
  progressText: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    minWidth: 36,
    textAlign: 'right',
  },
  trackerStats: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  trackerStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trackerStatText: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
  },
  actionHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: SemanticColors.feedbackWarningBg,
    padding: Spacing.sm,
    borderRadius: 8,
    marginTop: 4,
  },
  actionHintText: {
    color: SemanticColors.feedbackWarning,
    fontSize: 12,
    flex: 1,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    paddingTop: Spacing.xl,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  backButton: {
    padding: Spacing.xs,
  },
  shareButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: SemanticColors.actionPrimary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
  },
  detailTitle: {
    color: SemanticColors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  detailSubtitle: {
    color: SemanticColors.textSecondary,
    fontSize: 13,
  },
  progressBadge: {
    backgroundColor: SemanticColors.actionPrimary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  progressBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  quickActions: {
    flexDirection: 'row',
    padding: Spacing.sm,
    gap: Spacing.xs,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  reminderBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  whatsappBtn: {
    backgroundColor: '#25D366' + '15',
  },
  reminderBtnText: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: SemanticColors.actionPrimary,
  },
  tabText: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  tabTextActive: {
    color: SemanticColors.actionPrimary,
    fontWeight: '600',
  },
  tabBadge: {
    backgroundColor: SemanticColors.actionPrimary,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 18,
    alignItems: 'center',
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    gap: Spacing.sm,
  },
  card: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  cardTitle: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  overviewCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  overviewProgress: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: SemanticColors.actionPrimary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: SemanticColors.actionPrimary,
  },
  progressCircleText: {
    color: SemanticColors.actionPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  progressCircleLabel: {
    color: SemanticColors.textSecondary,
    fontSize: 10,
  },
  overviewStats: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  overviewStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  overviewStatLabel: {
    color: SemanticColors.textSecondary,
    fontSize: 13,
    flex: 1,
  },
  overviewStatValue: {
    color: SemanticColors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  categoryProgress: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderMuted,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryName: {
    color: SemanticColors.textPrimary,
    fontSize: 13,
    fontWeight: '500',
  },
  categoryStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryCount: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
  },
  overdueTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SemanticColors.feedbackErrorBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  overdueTagText: {
    color: SemanticColors.feedbackError,
    fontSize: 10,
    fontWeight: '600',
  },
  categoryBar: {
    height: 4,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  categoryBarFill: {
    height: '100%',
    backgroundColor: SemanticColors.feedbackSuccess,
    borderRadius: 2,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 6,
  },
  contactText: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
  },
  timeline: {
    paddingLeft: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    position: 'relative',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: SemanticColors.borderDefault,
    marginRight: 12,
    marginTop: 4,
  },
  timelineDotActive: {
    backgroundColor: SemanticColors.feedbackSuccess,
  },
  timelineLine: {
    position: 'absolute',
    left: 5,
    top: 16,
    bottom: -16,
    width: 2,
    backgroundColor: SemanticColors.borderDefault,
  },
  timelineContent: {
    flex: 1,
  },
  timelinePhase: {
    color: SemanticColors.textPrimary,
    fontSize: 13,
    fontWeight: '500',
  },
  timelineDate: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
  },
  itemCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    overflow: 'hidden',
  },
  itemCardOverdue: {
    borderColor: SemanticColors.feedbackError + '50',
    borderLeftWidth: 3,
    borderLeftColor: SemanticColors.feedbackError,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  checkbox: {
    padding: 2,
  },
  itemInfo: {
    flex: 1,
    gap: 4,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemName: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  itemDescription: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
  },
  overdueInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  overdueText: {
    color: SemanticColors.feedbackError,
    fontSize: 11,
    fontWeight: '500',
  },
  reminderCount: {
    color: SemanticColors.textTertiary,
    fontSize: 11,
  },
  itemExpanded: {
    padding: Spacing.md,
    paddingTop: 0,
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderMuted,
  },
  optionsContainer: {
    gap: 6,
  },
  optionsLabel: {
    color: SemanticColors.textSecondary,
    fontSize: 11,
    marginBottom: 4,
  },
  optionBtn: {
    backgroundColor: SemanticColors.surfaceSecondary,
    padding: Spacing.sm,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionLabel: {
    color: SemanticColors.textPrimary,
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  optionDesc: {
    color: SemanticColors.textTertiary,
    fontSize: 11,
  },
  optionPrice: {
    fontSize: 12,
    fontWeight: '600',
  },
  booleanContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  booleanBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 8,
  },
  booleanYes: {
    backgroundColor: SemanticColors.feedbackSuccessBg,
  },
  booleanNo: {
    backgroundColor: SemanticColors.feedbackErrorBg,
  },
  booleanText: {
    fontSize: 14,
    fontWeight: '600',
  },
  textInputContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  textInput: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: SemanticColors.textPrimary,
    fontSize: 14,
  },
  submitBtn: {
    backgroundColor: SemanticColors.actionPrimary,
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: Spacing.md,
    backgroundColor: SemanticColors.actionPrimary + '15',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: SemanticColors.actionPrimary + '30',
    borderStyle: 'dashed',
  },
  photoBtnText: {
    color: SemanticColors.actionPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  dueInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderMuted,
  },
  dueText: {
    color: SemanticColors.textTertiary,
    fontSize: 12,
  },
  completedItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  completedInfo: {
    flex: 1,
    gap: 2,
  },
  completedName: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  completedValue: {
    color: SemanticColors.feedbackSuccess,
    fontSize: 13,
    fontWeight: '600',
  },
  completedDate: {
    color: SemanticColors.textTertiary,
    fontSize: 11,
  },
  selectionFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    backgroundColor: SemanticColors.surfacePrimary,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  selectionText: {
    color: SemanticColors.textSecondary,
    fontSize: 14,
  },
  sendSelectedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: SemanticColors.actionPrimary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  sendSelectedText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyStateText: {
    color: SemanticColors.textTertiary,
    fontSize: 14,
  },
  templateCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    marginBottom: Spacing.sm,
    gap: 8,
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  templateName: {
    color: SemanticColors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  templateMeta: {
    backgroundColor: SemanticColors.actionPrimary + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  templateDecisions: {
    color: SemanticColors.actionPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  templateDescription: {
    color: SemanticColors.textSecondary,
    fontSize: 13,
  },
  templateStats: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: 4,
  },
  templateStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  templateStatText: {
    color: SemanticColors.textTertiary,
    fontSize: 11,
  },
});

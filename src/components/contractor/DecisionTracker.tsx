// Decision Tracker - Help contractors guide customers through project decisions
// Reduces delays, improves customer experience, builds repeat business
import { useState, useEffect, useMemo } from 'react';
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
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG, TYPE, GRID, RADIUS } from '../../theme/tabStyles';
import { DK } from '../../theme/draftkings';
import type {
  CustomerDecisionTracker,
  CustomerDecisionCategory,
  CustomerDecisionItem,
  DecisionTemplate,
} from '../../types/decisions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MOCK_ACTIVE_TRACKERS,
  DECISION_TEMPLATES,
  getTrackerStats,
} from '../../data/mockDecisions';
import { useAuth } from '../../context/AuthContext';
import { formatMoney, formatDayMonthAuto } from '../../i18n/formatting';

const TRACKER_KEY = '@vasco_decision_trackers';
function usePersistedTrackers(): CustomerDecisionTracker[] {
  const [trackers, setTrackers] = useState<CustomerDecisionTracker[]>([]);
  useEffect(() => {
    AsyncStorage.getItem(TRACKER_KEY).then(raw => {
      if (raw) {
        const parsed = JSON.parse(raw);
        // Validate data shape — filter out corrupted entries
        const valid = (Array.isArray(parsed) ? parsed : []).filter(
          (t: any) => t && t.id && Array.isArray(t.categories)
        );
        setTrackers(valid.length > 0 ? valid : MOCK_ACTIVE_TRACKERS);
      } else {
        setTrackers(MOCK_ACTIVE_TRACKERS);
        AsyncStorage.setItem(TRACKER_KEY, JSON.stringify(MOCK_ACTIVE_TRACKERS)).catch(() => {});
      }
    }).catch(() => setTrackers(MOCK_ACTIVE_TRACKERS));
  }, []);
  return trackers;
}

type IconName = keyof typeof Ionicons.glyphMap;

// ============================================
// PRIORITY BADGE
// ============================================

function PriorityBadge({ priority }: { priority: string }) {
  const { t } = useTranslation();
  const config = {
    critical: { bg: SemanticColors.feedbackErrorBg, color: SemanticColors.feedbackError, label: t('dt.critical') },
    important: { bg: Palette.hermesOrange + '18', color: Palette.hermesOrange, label: t('dt.important') },
    optional: { bg: SemanticColors.surfaceSecondary, color: SemanticColors.textTertiary, label: t('dt.optional') },
  }[priority] ?? { bg: SemanticColors.surfaceSecondary, color: SemanticColors.textTertiary, label: priority };

  return (
    <View style={[styles.priorityBadge, { backgroundColor: config.bg }]}>
      <Text style={[styles.priorityBadgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

// ============================================
// PROGRESS RING (SVG-free, using bordered View)
// ============================================

function ProgressRing({ percent, size = 88 }: { percent: number; size?: number }) {
  const { t } = useTranslation();
  const ringWidth = 4;
  const color = percent >= 75
    ? SemanticColors.feedbackSuccess
    : percent >= 40
      ? Palette.hermesOrange
      : SemanticColors.feedbackError;

  return (
    <View style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: color + '12',
      borderWidth: ringWidth,
      borderColor: color + '25',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    }}>
      {/* Foreground arc approximated with a thick colored border segment */}
      <View style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: ringWidth,
        borderColor: 'transparent',
        borderTopColor: color,
        borderRightColor: percent > 25 ? color : 'transparent',
        borderBottomColor: percent > 50 ? color : 'transparent',
        borderLeftColor: percent > 75 ? color : 'transparent',
        transform: [{ rotate: '-45deg' }],
      }} />
      <Text style={{
        fontSize: TYPE.sectionSize,
        fontFamily: TYPE.sectionFamily,
        color,
        letterSpacing: TYPE.sectionTracking,
      }}>
        {percent}%
      </Text>
      <Text style={{
        fontSize: TYPE.tinySize,
        fontFamily: TYPE.tinyFamily,
        color: SemanticColors.textSecondary,
        marginTop: -2,
      }}>
        {t('dt.complete')}
      </Text>
    </View>
  );
}

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
  const { t } = useTranslation();
  const trackers = usePersistedTrackers();
  const [filter, setFilter] = useState<'all' | 'overdue' | 'pending'>('all');

  const totalOverdue = trackers.reduce((sum, t) => sum + t.overdueCount, 0);
  const totalPending = trackers.reduce((sum, t) => sum + t.pendingCount, 0);

  const filteredTrackers = trackers.filter(t => {
    if (filter === 'overdue') return t.overdueCount > 0;
    if (filter === 'pending') return t.pendingCount > 0;
    return true;
  });

  // R66 round 49: fresh-contractor empty state. Pre-R49 the screen rendered
  // a hollow stats row (all zeros), the "+ new checklist" button, and an
  // empty "Active trackers" section header — leaving a fresh contractor
  // staring at scaffolding with no explanation of what this tab is for.
  // Now: hide the stats grid + section header when trackers is empty, show
  // a DK panel hero with value prop + gradient CTA.
  if (trackers.length === 0) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.emptyHero}>
          <View style={styles.emptyHeroIconWrap}>
            <LinearGradient
              colors={[DK.colors.primaryDark, DK.colors.primary, DK.colors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name="checkmark-done" size={36} color="#FFFFFF" />
          </View>
          <Text style={styles.emptyHeroTitle}>
            {t('decisions.emptyTitle', 'Stop chasing decisions').toUpperCase()}
          </Text>
          <Text style={styles.emptyHeroBody}>
            {t(
              'decisions.emptyBody',
              'Create a checklist your customer fills in (paint colors, tile choices, fixtures). Vasco nudges them so you keep moving — and projects finish on time.',
            )}
          </Text>
          <Pressable
            style={styles.emptyHeroCta}
            onPress={onCreateNew}
            accessibilityLabel={t('decisions.emptyCta', 'Create your first checklist')}
          >
            <LinearGradient
              colors={[DK.colors.primaryDark, DK.colors.primary, DK.colors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.emptyHeroCtaText}>
              {t('decisions.emptyCta', 'Create your first checklist').toUpperCase()}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Stats Overview - pressable filters */}
      <View style={styles.statsRow}>
        <Pressable
          style={[styles.statCard, filter === 'all' && styles.statCardActive]}
          onPress={() => setFilter('all')}
          accessibilityLabel={t('dt.active')}
        >
          <Ionicons name="people" size={24} color={Palette.hermesOrange} />
          <Text style={styles.statValue}>{trackers.length}</Text>
          <Text style={styles.statLabel}>{t('dt.active')}</Text>
        </Pressable>
        <Pressable
          style={[styles.statCard, filter === 'overdue' && styles.statCardActive]}
          onPress={() => setFilter(filter === 'overdue' ? 'all' : 'overdue')}
          accessibilityLabel={t('dt.overdue')}
        >
          <Ionicons name="alert-circle" size={24} color={SemanticColors.feedbackError} />
          <Text style={[styles.statValue, { color: SemanticColors.feedbackError }]}>
            {totalOverdue}
          </Text>
          <Text style={styles.statLabel}>{t('dt.overdue')}</Text>
        </Pressable>
        <Pressable
          style={[styles.statCard, filter === 'pending' && styles.statCardActive]}
          onPress={() => setFilter(filter === 'pending' ? 'all' : 'pending')}
          accessibilityLabel={t('dt.waiting')}
        >
          <Ionicons name="time" size={24} color={SemanticColors.feedbackWarning} />
          <Text style={[styles.statValue, { color: SemanticColors.feedbackWarning }]}>
            {totalPending}
          </Text>
          <Text style={styles.statLabel}>{t('dt.waiting')}</Text>
        </Pressable>
      </View>

      {/* Add New Button */}
      <Pressable style={styles.addNewButton} onPress={onCreateNew} accessibilityLabel={t('dt.newChecklist')}>
        <Ionicons name="add-circle" size={20} color={Palette.hermesOrange} />
        <Text style={styles.addNewText}>{t('dt.newChecklist')}</Text>
      </Pressable>

      {/* Active Trackers List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {filter === 'overdue' ? t('dt.overdueChoices') : filter === 'pending' ? t('dt.waitingChoices') : t('dt.activeTrackers')}
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
  const { t } = useTranslation();
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
          <Text style={styles.trackerStatText}>{stats.decided} {t('dt.decided').toLowerCase()}</Text>
        </View>
        {stats.overdue > 0 && (
          <View style={styles.trackerStat}>
            <Ionicons name="alert-circle" size={16} color={SemanticColors.feedbackError} />
            <Text style={[styles.trackerStatText, { color: SemanticColors.feedbackError }]}>
              {stats.overdue} {t('dt.overdue').toLowerCase()}
            </Text>
          </View>
        )}
        <View style={styles.trackerStat}>
          <Ionicons name="time" size={16} color={SemanticColors.textTertiary} />
          <Text style={styles.trackerStatText}>{stats.upcoming} {t('dt.upcoming').toLowerCase()}</Text>
        </View>
      </View>

      {/* Action Hint */}
      {stats.overdue > 0 && (
        <View style={styles.actionHint}>
          <Ionicons name="notifications" size={14} color={SemanticColors.feedbackWarning} />
          <Text style={styles.actionHintText}>{t('dt.sendReminderOverdue')}</Text>
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
  const { t } = useTranslation();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'overdue' | 'pending' | 'completed'>('overview');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const stats = getTrackerStats(tracker);

  const overdueItems = useMemo(() =>
    tracker.categories.flatMap(c =>
      c.items.filter(i => i.isOverdue && i.status === 'pending')
    ), [tracker]);
  const pendingItems = useMemo(() =>
    tracker.categories.flatMap(c =>
      c.items.filter(i => !i.isOverdue && i.status === 'pending')
    ), [tracker]);
  const completedItems = useMemo(() =>
    tracker.categories.flatMap(c =>
      c.items.filter(i => i.status === 'decided')
    ), [tracker]);

  // Group items by category for sectioned display
  const groupedOverdue = useMemo(() => groupByCategory(tracker, 'overdue'), [tracker]);
  const groupedPending = useMemo(() => groupByCategory(tracker, 'pending'), [tracker]);
  const groupedCompleted = useMemo(() => groupByCategory(tracker, 'completed'), [tracker]);

  const handleSendReminder = (channel: 'whatsapp' | 'sms' | 'email') => {
    const itemsToRemind = selectedItems.length > 0 ? selectedItems : overdueItems.map(i => i.id);

    if (itemsToRemind.length === 0) {
      Alert.alert(t('dt.noItems'), t('dt.selectItemsHint'));
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
        Alert.alert(t('common.error', 'Error'), t('dt.openWhatsappFailed', 'Could not open WhatsApp'));
      });
    } else if (channel === 'sms' && tracker.customerPhone) {
      const url = `sms:${tracker.customerPhone}?body=${encodeURIComponent(message)}`;
      Linking.openURL(url).catch(() => {
        Alert.alert(t('common.error', 'Error'), t('dt.openSmsFailed', 'Could not open SMS'));
      });
    } else if (channel === 'email' && tracker.customerEmail) {
      const subject = t('dt.decisionsNeeded', { template: tracker.templateName });
      const url = `mailto:${tracker.customerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
      Linking.openURL(url).catch(() => {
        Alert.alert(t('common.error', 'Error'), t('dt.openEmailFailed', 'Could not open email'));
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
    { id: 'overview', label: t('dt.overview') },
    { id: 'overdue', label: t('dt.overdue'), badge: overdueItems.length },
    { id: 'pending', label: t('dt.pending'), badge: pendingItems.length },
    { id: 'completed', label: t('dt.done'), badge: completedItems.length },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.detailHeader}>
        <Pressable onPress={onClose} style={styles.backButton} accessibilityLabel={t('common.back')}>
          <Ionicons name="chevron-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={styles.headerContent}>
          <Text style={styles.detailTitle}>{tracker.customerName}</Text>
          <Text style={styles.detailSubtitle}>{tracker.templateName}</Text>
        </View>
        <Pressable style={styles.shareButton} onPress={onShareWithCustomer} accessibilityLabel={t('common.share')}>
          <Ionicons name="share-outline" size={20} color={Palette.hermesOrange} />
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
          accessibilityLabel="WhatsApp"
        >
          <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
          <Text style={[styles.reminderBtnText, { color: '#25D366' }]}>WhatsApp</Text>
        </Pressable>
        <Pressable
          style={styles.reminderBtn}
          onPress={() => handleSendReminder('sms')}
          accessibilityLabel="SMS"
        >
          <Ionicons name="chatbubble" size={18} color={SemanticColors.feedbackInfo} />
          <Text style={[styles.reminderBtnText, { color: SemanticColors.feedbackInfo }]}>SMS</Text>
        </Pressable>
        <Pressable
          style={styles.reminderBtn}
          onPress={() => handleSendReminder('email')}
          accessibilityLabel="Email"
        >
          <Ionicons name="mail" size={18} color={SemanticColors.textSecondary} />
          <Text style={styles.reminderBtnText}>Email</Text>
        </Pressable>
      </View>

      {/* R270: templates ingress consolidated to customer detail screen
          (next to smart-reply chips) so we don't have two entry points. */}

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
          <SectionedDecisionItems
            grouped={groupedOverdue}
            selectedItems={selectedItems}
            onToggleSelect={toggleItemSelection}
            onRecordDecision={(itemId, value) => onRecordDecision?.(tracker.id, itemId, value)}
            emptyMessage={t('dt.noOverdue')}
            emptyIcon="checkmark-circle"
            isOverdue
          />
        )}
        {activeTab === 'pending' && (
          <SectionedDecisionItems
            grouped={groupedPending}
            selectedItems={selectedItems}
            onToggleSelect={toggleItemSelection}
            onRecordDecision={(itemId, value) => onRecordDecision?.(tracker.id, itemId, value)}
            emptyMessage={t('dt.noPending')}
            emptyIcon="time"
          />
        )}
        {activeTab === 'completed' && (
          <CompletedItemsList items={completedItems} />
        )}
      </ScrollView>

      {/* Selection Footer */}
      {selectedItems.length > 0 && (
        <View style={styles.selectionFooter}>
          <Text style={styles.selectionText}>{t('dt.selected', { count: selectedItems.length })}</Text>
          <Pressable
            style={styles.sendSelectedBtn}
            onPress={() => handleSendReminder(tracker.preferredChannel)}
            accessibilityLabel={t('dt.sendReminder')}
          >
            <Ionicons name="send" size={16} color="#fff" />
            <Text style={styles.sendSelectedText}>{t('dt.sendReminder')}</Text>
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
  const { t } = useTranslation();
  return (
    <View style={styles.tabContent}>
      {/* Progress Summary with Ring */}
      <View style={styles.overviewCard}>
        <View style={styles.overviewProgress}>
          <ProgressRing percent={stats.completionPercent} />
        </View>
        <View style={styles.overviewStats}>
          <View style={styles.overviewStatRow}>
            <Ionicons name="checkmark-circle" size={20} color={SemanticColors.feedbackSuccess} />
            <Text style={styles.overviewStatLabel}>{t('dt.decided')}</Text>
            <Text style={styles.overviewStatValue}>{stats.decided}</Text>
          </View>
          <View style={styles.overviewStatRow}>
            <Ionicons name="alert-circle" size={20} color={SemanticColors.feedbackError} />
            <Text style={styles.overviewStatLabel}>{t('dt.overdue')}</Text>
            <Text style={[styles.overviewStatValue, { color: SemanticColors.feedbackError }]}>
              {stats.overdue}
            </Text>
          </View>
          <View style={styles.overviewStatRow}>
            <Ionicons name="time" size={20} color={SemanticColors.feedbackWarning} />
            <Text style={styles.overviewStatLabel}>{t('dt.upcoming')}</Text>
            <Text style={styles.overviewStatValue}>{stats.upcoming}</Text>
          </View>
        </View>
      </View>

      {/* Categories Progress */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('dt.progressByCategory')}</Text>
        {tracker.categories.map((category) => (
          <CategoryProgress key={category.id} category={category} />
        ))}
      </View>

      {/* Customer Contact */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('dt.customerContact')}</Text>
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
            {t('dt.reminders')}: {tracker.reminderFrequency.replace('_', ' ')}
          </Text>
        </View>
      </View>

      {/* Timeline */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('dt.projectTimeline')}</Text>
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
                  {formatDayMonthAuto(new Date(phase.startDate))}
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
  const barColor = category.isOverdue
    ? SemanticColors.feedbackError
    : progressPercent === 100
      ? SemanticColors.feedbackSuccess
      : Palette.hermesOrange;

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
              <Text style={styles.overdueTagText}>{useTranslation().t('dt.overdue')}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.categoryBar}>
        <View style={[styles.categoryBarFill, { width: `${progressPercent}%`, backgroundColor: barColor }]} />
      </View>
    </View>
  );
}

// ============================================
// GROUP ITEMS BY CATEGORY (for sectioned display)
// ============================================

type GroupedItems = { categoryName: string; items: CustomerDecisionItem[] }[];

function groupByCategory(
  tracker: CustomerDecisionTracker,
  type: 'overdue' | 'pending' | 'completed',
): GroupedItems {
  const result: GroupedItems = [];
  for (const cat of tracker.categories) {
    const items = cat.items.filter(i => {
      if (type === 'overdue') return i.isOverdue && i.status === 'pending';
      if (type === 'pending') return !i.isOverdue && i.status === 'pending';
      return i.status === 'decided';
    });
    if (items.length > 0) {
      result.push({ categoryName: cat.name, items });
    }
  }
  return result;
}

// ============================================
// SECTIONED DECISION ITEMS (grouped by category)
// ============================================

interface SectionedDecisionItemsProps {
  grouped: GroupedItems;
  selectedItems: string[];
  onToggleSelect: (itemId: string) => void;
  onRecordDecision: (itemId: string, value: string | number | boolean) => void;
  emptyMessage: string;
  emptyIcon: IconName;
  isOverdue?: boolean;
}

function SectionedDecisionItems({
  grouped,
  selectedItems,
  onToggleSelect,
  onRecordDecision,
  emptyMessage,
  emptyIcon,
  isOverdue,
}: SectionedDecisionItemsProps) {
  if (grouped.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name={emptyIcon} size={48} color={SemanticColors.textTertiary} />
        <Text style={styles.emptyStateText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      {grouped.map((section) => (
        <View key={section.categoryName}>
          <Text style={styles.categorySectionHeader}>{section.categoryName}</Text>
          {section.items.map((item) => (
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
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const dueDate = new Date(item.dueDate);
  const now = new Date();
  const daysOverdue = isOverdue
    ? Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const isDueSoon = !isOverdue && dueDate.getTime() - now.getTime() < 3 * 24 * 60 * 60 * 1000 && dueDate > now;

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
            color={isSelected ? Palette.hermesOrange : SemanticColors.textTertiary}
          />
        </Pressable>
        <View style={styles.itemInfo}>
          <View style={styles.itemTitleRow}>
            <Text style={styles.itemName}>{item.name}</Text>
            <PriorityBadge priority={item.priority} />
          </View>
          <Text style={styles.itemDescription} numberOfLines={isExpanded ? undefined : 1}>
            {item.description}
          </Text>
          {/* Due date with color coding */}
          <View style={styles.itemDueRow}>
            <Ionicons
              name="calendar-outline"
              size={12}
              color={isOverdue ? SemanticColors.feedbackError : isDueSoon ? SemanticColors.feedbackWarning : SemanticColors.textTertiary}
            />
            <Text style={[
              styles.itemDueText,
              isOverdue && { color: SemanticColors.feedbackError, fontFamily: TYPE.labelFamily },
              isDueSoon && { color: SemanticColors.feedbackWarning },
            ]}>
              {t('dt.due', { date: formatDayMonthAuto(dueDate) })}
            </Text>
          </View>
          {isOverdue && (
            <View style={styles.overdueInfo}>
              <Ionicons name="alert-circle" size={12} color={SemanticColors.feedbackError} />
              <Text style={styles.overdueText}>{t('dt.daysOverdue', { count: daysOverdue })}</Text>
              {item.remindersSent > 0 && (
                <Text style={styles.reminderCount}>
                  {t('dt.remindersSent', { count: item.remindersSent })}
                </Text>
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
              <Text style={styles.optionsLabel}>{t('dt.options')}:</Text>
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
                      {option.priceImpact > 0 ? '+' : ''}{formatMoney(option.priceImpact)}
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
                <Text style={[styles.booleanText, { color: SemanticColors.feedbackSuccess }]}>{t('common.yes')}</Text>
              </Pressable>
              <Pressable
                style={[styles.booleanBtn, styles.booleanNo]}
                onPress={() => onRecordDecision(false)}
              >
                <Ionicons name="close" size={20} color={SemanticColors.feedbackError} />
                <Text style={[styles.booleanText, { color: SemanticColors.feedbackError }]}>{t('common.no')}</Text>
              </Pressable>
            </View>
          )}

          {(item.inputType === 'text' || item.inputType === 'number' || item.inputType === 'color') && (
            <View style={styles.textInputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder={t('dt.enter', { name: item.name.toLowerCase() })}
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
              <Ionicons name="camera" size={24} color={Palette.hermesOrange} />
              <Text style={styles.photoBtnText}>{t('dt.requestPhoto')}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

// ============================================
// COMPLETED ITEMS LIST
// ============================================

function CompletedItemsList({ items }: { items: CustomerDecisionItem[] }) {
  const { t } = useTranslation();
  if (items.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="hourglass" size={48} color={SemanticColors.textTertiary} />
        <Text style={styles.emptyStateText}>{t('dt.noCompleted')}</Text>
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
              {typeof item.value === 'boolean' ? (item.value ? t('common.yes') : t('common.no')) : String(item.value)}
            </Text>
            {item.decidedAt && (
              <Text style={styles.completedDate}>
                {formatDayMonthAuto(new Date(item.decidedAt))}
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

const TRADE_MAP: Record<string, string[]> = {
  plumbing: ['plumber', 'bathroom_fitter', 'kitchen_fitter'],
  electrical: ['electrician'],
  gas: ['plumber', 'general_contractor'],
  painting: ['painter'],
  carpentry: ['carpenter', 'kitchen_fitter'],
  general: ['general_contractor', 'bathroom_fitter', 'kitchen_fitter', 'painter', 'electrician', 'plumber', 'carpenter'],
};

function TemplateCard({ template, onSelect }: { template: DecisionTemplate; onSelect: (t: DecisionTemplate) => void }) {
  const { t } = useTranslation();
  return (
    <Pressable
      style={styles.templateCard}
      onPress={() => onSelect(template)}
    >
      <View style={styles.templateHeader}>
        <Text style={styles.templateName}>{template.name}</Text>
        <View style={styles.templateMeta}>
          <Text style={styles.templateDecisions}>
            {t('dt.decisions', { count: template.estimatedTotalDecisions })}
          </Text>
        </View>
      </View>
      <Text style={styles.templateDescription}>{template.description}</Text>
      <View style={styles.templateStats}>
        <View style={styles.templateStat}>
          <Ionicons name="list" size={14} color={SemanticColors.textTertiary} />
          <Text style={styles.templateStatText}>
            {t('dt.categories', { count: template.categories.length })}
          </Text>
        </View>
        <View style={styles.templateStat}>
          <Ionicons name="time" size={14} color={SemanticColors.textTertiary} />
          <Text style={styles.templateStatText}>
            {t('dt.avgDays', { count: template.avgDaysToComplete })}
          </Text>
        </View>
        <View style={styles.templateStat}>
          <Ionicons name="people" size={14} color={SemanticColors.textTertiary} />
          <Text style={styles.templateStatText}>
            {t('dt.usedCount', { count: template.usageCount })}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export function TemplatePicker({ onSelect, onClose }: TemplatePickerProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const contractorTrade = user?.trade ?? 'general';
  const matchingTradeIds = TRADE_MAP[contractorTrade] ?? TRADE_MAP.general;

  const myTemplates = DECISION_TEMPLATES.filter(t => matchingTradeIds.includes(t.trade));
  const otherTemplates = DECISION_TEMPLATES.filter(t => !matchingTradeIds.includes(t.trade));

  return (
    <View style={styles.container}>
      <View style={styles.detailHeader}>
        <Pressable onPress={onClose} style={styles.backButton} accessibilityLabel={t('common.close')}>
          <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={styles.headerContent}>
          <Text style={styles.detailTitle}>{t('dt.chooseTemplate')}</Text>
          <Text style={styles.detailSubtitle}>{t('dt.selectTemplate')}</Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainerDetail}>
        {myTemplates.map((template) => (
          <TemplateCard key={template.id} template={template} onSelect={onSelect} />
        ))}

        {otherTemplates.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>{t('dt.otherTrades')}</Text>
            {otherTemplates.map((template) => (
              <TemplateCard key={template.id} template={template} onSelect={onSelect} />
            ))}
          </>
        )}
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

  return `Hi ${firstName}, we're waiting on a few decisions to keep your project on track:\n\n\u2022 ${items.slice(0, 5).join('\n\u2022 ')}${items.length > 5 ? `\n\u2022 ...and ${items.length - 5} more` : ''}\n\nPlease let us know when you can. Thanks!`;
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  contentContainer: {
    padding: GRID.md,
    paddingBottom: 100,
  },
  contentContainerDetail: {
    padding: GRID.md,
    paddingBottom: 120,
  },
  statsRow: {
    flexDirection: 'row',
    gap: GRID.sm,
    marginBottom: GRID.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  statCardActive: {
    borderColor: Palette.hermesOrange,
    borderWidth: 2,
  },
  statValue: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.displaySize - 4,
    fontFamily: TYPE.sectionFamily,
    marginTop: GRID.xs,
  },
  statLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.tinyFamily,
    marginTop: 2,
  },
  addNewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: GRID.sm,
    padding: GRID.md,
    backgroundColor: Palette.hermesOrange + '12',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: Palette.hermesOrange + '30',
    borderStyle: 'dashed',
    marginBottom: GRID.lg,
  },
  addNewText: {
    color: Palette.hermesOrange,
    fontSize: TYPE.captionSize + 1,
    fontFamily: TYPE.titleFamily,
  },
  section: {
    gap: GRID.sm,
  },
  sectionTitle: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.labelFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: GRID.xs,
  },
  trackerCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: GRID.sm,
  },
  trackerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trackerCustomer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
    flex: 1,
  },
  customerAvatar: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: Palette.hermesOrange + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerInitials: {
    color: Palette.hermesOrange,
    fontSize: TYPE.captionSize + 1,
    fontFamily: TYPE.sectionFamily,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
  },
  projectType: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.captionFamily,
  },
  channelBadge: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
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
    backgroundColor: Palette.hermesOrange,
    borderRadius: 3,
  },
  progressText: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.labelFamily,
    minWidth: 36,
    textAlign: 'right',
  },
  trackerStats: {
    flexDirection: 'row',
    gap: GRID.md,
  },
  trackerStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.xs,
  },
  trackerStatText: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.captionFamily,
  },
  actionHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: SemanticColors.feedbackWarningBg,
    padding: GRID.sm,
    borderRadius: RADIUS.sm,
    marginTop: GRID.xs,
  },
  actionHintText: {
    color: SemanticColors.feedbackWarning,
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.captionFamily,
    flex: 1,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: GRID.md,
    paddingTop: GRID.xl,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
    gap: GRID.sm,
  },
  backButton: {
    padding: GRID.xs,
  },
  shareButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Palette.hermesOrange + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
  },
  detailTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    letterSpacing: TYPE.sectionTracking,
  },
  detailSubtitle: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
  },
  progressBadge: {
    backgroundColor: Palette.hermesOrange,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  progressBadgeText: {
    color: Palette.white,
    fontSize: TYPE.captionSize + 1,
    fontFamily: TYPE.sectionFamily,
  },
  quickActions: {
    flexDirection: 'row',
    padding: GRID.sm,
    gap: GRID.xs,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  templatesLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    marginTop: 4,
  },
  templatesLinkText: {
    fontSize: 11,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
    textDecorationLine: 'underline',
  },
  reminderBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  whatsappBtn: {
    backgroundColor: '#25D366' + '15',
  },
  reminderBtnText: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.labelFamily,
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
    paddingVertical: GRID.md - 4,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Palette.hermesOrange,
  },
  tabText: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.labelFamily,
  },
  tabTextActive: {
    color: Palette.hermesOrange,
    fontFamily: TYPE.titleFamily,
  },
  tabBadge: {
    backgroundColor: Palette.hermesOrange,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 18,
    alignItems: 'center',
  },
  tabBadgeText: {
    color: Palette.white,
    fontSize: TYPE.tinySize - 1,
    fontFamily: TYPE.sectionFamily,
  },
  content: {
    flex: 1,
  },
  tabContent: {
    gap: GRID.sm,
  },
  card: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: GRID.sm,
  },
  cardTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.captionSize + 1,
    fontFamily: TYPE.titleFamily,
    marginBottom: GRID.xs,
  },
  overviewCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    flexDirection: 'row',
    gap: GRID.lg,
  },
  overviewProgress: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewStats: {
    flex: 1,
    justifyContent: 'center',
    gap: GRID.sm,
  },
  overviewStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
  },
  overviewStatLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    flex: 1,
  },
  overviewStatValue: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.sectionFamily,
  },
  categoryProgress: {
    paddingVertical: GRID.sm,
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
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.labelFamily,
  },
  categoryStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
  },
  categoryCount: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.captionFamily,
  },
  overdueTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.xs,
    backgroundColor: SemanticColors.feedbackErrorBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: GRID.xs,
  },
  overdueTagText: {
    color: SemanticColors.feedbackError,
    fontSize: TYPE.tinySize - 1,
    fontFamily: TYPE.labelFamily,
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
    gap: GRID.sm,
    paddingVertical: 6,
  },
  contactText: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.captionSize + 1,
    fontFamily: TYPE.bodyFamily,
  },
  timeline: {
    paddingLeft: GRID.sm,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: GRID.md,
    position: 'relative',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: SemanticColors.borderDefault,
    marginRight: GRID.md - 4,
    marginTop: GRID.xs,
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
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.labelFamily,
  },
  timelineDate: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.captionFamily,
  },
  // Category section headers in item lists
  categorySectionHeader: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.labelFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: GRID.md,
    marginBottom: GRID.sm,
    paddingHorizontal: GRID.xs,
  },
  // Priority badge
  priorityBadge: {
    paddingHorizontal: GRID.sm,
    paddingVertical: 2,
    borderRadius: GRID.xs,
  },
  priorityBadgeText: {
    fontSize: TYPE.tinySize - 1,
    fontFamily: TYPE.labelFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  itemCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
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
    padding: GRID.md,
    gap: GRID.sm,
  },
  checkbox: {
    padding: 2,
  },
  itemInfo: {
    flex: 1,
    gap: GRID.xs,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
  },
  itemName: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.captionSize + 1,
    fontFamily: TYPE.titleFamily,
    flex: 1,
  },
  itemDescription: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.captionFamily,
  },
  itemDueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.xs,
    marginTop: 2,
  },
  itemDueText: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.captionFamily,
  },
  overdueInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.xs,
    marginTop: GRID.xs,
  },
  overdueText: {
    color: SemanticColors.feedbackError,
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.labelFamily,
  },
  reminderCount: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.captionFamily,
  },
  itemExpanded: {
    padding: GRID.md,
    paddingTop: 0,
    gap: GRID.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderMuted,
  },
  optionsContainer: {
    gap: 6,
  },
  optionsLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.labelFamily,
    marginBottom: GRID.xs,
  },
  optionBtn: {
    backgroundColor: SemanticColors.surfaceSecondary,
    padding: GRID.sm,
    borderRadius: RADIUS.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
  },
  optionLabel: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.labelFamily,
    flex: 1,
  },
  optionDesc: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.captionFamily,
  },
  optionPrice: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
  },
  booleanContainer: {
    flexDirection: 'row',
    gap: GRID.sm,
  },
  booleanBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: GRID.md - 4,
    borderRadius: RADIUS.sm,
  },
  booleanYes: {
    backgroundColor: SemanticColors.feedbackSuccessBg,
  },
  booleanNo: {
    backgroundColor: SemanticColors.feedbackErrorBg,
  },
  booleanText: {
    fontSize: TYPE.captionSize + 1,
    fontFamily: TYPE.titleFamily,
  },
  textInputContainer: {
    flexDirection: 'row',
    gap: GRID.sm,
  },
  textInput: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.sm,
    paddingHorizontal: GRID.md - 4,
    paddingVertical: 10,
    color: SemanticColors.textPrimary,
    fontSize: TYPE.captionSize + 1,
    fontFamily: TYPE.bodyFamily,
  },
  submitBtn: {
    backgroundColor: Palette.hermesOrange,
    width: 44,
    height: 44,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: GRID.sm,
    padding: GRID.md,
    backgroundColor: Palette.hermesOrange + '12',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: Palette.hermesOrange + '30',
    borderStyle: 'dashed',
  },
  photoBtnText: {
    color: Palette.hermesOrange,
    fontSize: TYPE.captionSize + 1,
    fontFamily: TYPE.titleFamily,
  },
  completedItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: GRID.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: GRID.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  completedInfo: {
    flex: 1,
    gap: 2,
  },
  completedName: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.captionSize + 1,
    fontFamily: TYPE.labelFamily,
  },
  completedValue: {
    color: SemanticColors.feedbackSuccess,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
  },
  completedDate: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.captionFamily,
  },
  selectionFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: GRID.md,
    backgroundColor: SemanticColors.surfacePrimary,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  selectionText: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.captionSize + 1,
    fontFamily: TYPE.bodyFamily,
  },
  sendSelectedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Palette.hermesOrange,
    paddingHorizontal: GRID.md,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
  },
  sendSelectedText: {
    color: Palette.white,
    fontSize: TYPE.captionSize + 1,
    fontFamily: TYPE.titleFamily,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: GRID.xl,
    gap: GRID.sm,
  },
  emptyStateText: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.captionSize + 1,
    fontFamily: TYPE.bodyFamily,
  },
  emptyHero: {
    margin: GRID.md,
    padding: GRID.xl,
    backgroundColor: DK.colors.panel,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: DK.colors.border,
    alignItems: 'center',
    gap: GRID.md,
  },
  emptyHeroIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: DK.colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  emptyHeroTitle: {
    fontSize: 22,
    fontFamily: TYPE.displayFamily,
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 1.2,
    marginTop: GRID.xs,
  },
  emptyHeroBody: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: DK.colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
  },
  emptyHeroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: GRID.xs,
    paddingVertical: 14,
    paddingHorizontal: GRID.lg,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
    alignSelf: 'stretch',
    marginTop: GRID.sm,
    shadowColor: DK.colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  emptyHeroCtaText: {
    color: '#FFFFFF',
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.displayFamily,
    letterSpacing: 1.4,
  },
  sectionLabel: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: GRID.md,
    marginBottom: GRID.sm,
  },
  templateCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    marginBottom: GRID.sm,
    gap: GRID.sm,
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  templateName: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    flex: 1,
  },
  templateMeta: {
    backgroundColor: Palette.hermesOrange + '12',
    paddingHorizontal: GRID.sm,
    paddingVertical: GRID.xs,
    borderRadius: 6,
  },
  templateDecisions: {
    color: Palette.hermesOrange,
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.labelFamily,
  },
  templateDescription: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
  },
  templateStats: {
    flexDirection: 'row',
    gap: GRID.md,
    marginTop: GRID.xs,
  },
  templateStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.xs,
  },
  templateStatText: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.captionFamily,
  },
});

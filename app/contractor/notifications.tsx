// =============================================================================
// NOTIFICATIONS — Pro-grade notification center with grouping
// =============================================================================
// Grouped by type (expandable), time sections, rich cards with actions,
// priority badges, quiet hours, settings tab.
// =============================================================================

import { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG, TYPE, GRID, RADIUS } from '../../src/theme/tabStyles';
import { SafeArea } from '../../src/theme/spacing';
import {
  useNotifications,
  useUnreadCount,
  useNotificationPreferences,
  useCombinedNotifications,
  type AppNotification,
  type NotificationType,
} from '../../src/services/notificationService';
import { useAppState } from '../../src/state/AppState';
import {
  useGroupedNotifications,
  useQuietHours,
  getActionsForType,
  type GroupedNotification,
} from '../../src/services/pushNotificationService';
import { hapticSuccess } from '../../src/utils/haptics';
import { FadeIn } from '../../src/components/shared/FadeIn';
import { MS_PER_DAY, MS_PER_HOUR } from '../../src/utils/timeConstants';

type IconName = keyof typeof Ionicons.glyphMap;
type TabType = 'inbox' | 'settings';

// R13.3: was 8 hardcoded English `label` values rendered into `typePill`
// chips on every notification card — non-English contractors saw English
// chips on every row of an otherwise-localized inbox. Labels now resolve
// via i18n at render time using `getTypeLabel(t, type)`.
const TYPE_CONFIG: Record<NotificationType, { icon: IconName; color: string; labelKey: string }> = {
  schedule_change: { icon: 'calendar', color: SemanticColors.feedbackWarning, labelKey: 'notifications.types.schedule' },
  overdue_invoice: { icon: 'alert-circle', color: SemanticColors.feedbackError, labelKey: 'notifications.types.payment' },
  team_assignment: { icon: 'people', color: SemanticColors.feedbackInfo, labelKey: 'notifications.types.team' },
  approval_request: { icon: 'shield-checkmark', color: Palette.hermesOrange, labelKey: 'notifications.types.approval' },
  permit_update: { icon: 'document-text', color: Palette.hermesOrange, labelKey: 'notifications.types.permit' },
  delivery_update: { icon: 'cube', color: SemanticColors.feedbackSuccess, labelKey: 'notifications.types.delivery' },
  credential_expiry: { icon: 'ribbon', color: SemanticColors.feedbackWarning, labelKey: 'notifications.types.cert' },
  general: { icon: 'notifications', color: SemanticColors.textSecondary, labelKey: 'notifications.types.general' },
};

const TYPE_FALLBACKS: Record<NotificationType, string> = {
  schedule_change: 'Schedule',
  overdue_invoice: 'Payment',
  team_assignment: 'Team',
  approval_request: 'Approval',
  permit_update: 'Permit',
  delivery_update: 'Delivery',
  credential_expiry: 'Cert',
  general: 'General',
};

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('inbox');
  // R272: combined feed = persisted user-fired + live-derived from AppState
  const { invoices, jobs } = useAppState();
  const { notifications, markRead, markAllRead } = useCombinedNotifications({
    invoices: invoices as any,
    jobs: jobs as any,
    // certifications: not yet on AppState — wire when the field lands
  });
  const stats = useUnreadCount();
  const { preferences, toggle } = useNotificationPreferences();
  const { groups, toggleGroup } = useGroupedNotifications(notifications);
  const { config: quietHoursConfig, toggle: toggleQuietHours } = useQuietHours();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); hapticSuccess(); }, 600);
  }, []);

  const formatTimeAgo = (date: Date) => {
    const mins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (mins < 1) return t('notifications.justNow', 'Just now');
    if (mins < 60) return t('notifications.minutesAgo', '{{count}}m', { count: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('notifications.hoursAgo', '{{count}}h', { count: hours });
    const days = Math.floor(hours / 24);
    return t('notifications.daysAgo', '{{count}}d', { count: days });
  };

  const handlePress = (notif: AppNotification) => {
    if (!notif.read) { markRead(notif.id); hapticSuccess(); }
    if (notif.actionRoute) router.push(notif.actionRoute as any);
  };

  const handleMarkAllRead = () => {
    markAllRead();
    hapticSuccess();
  };

  const renderNotificationCard = (notif: AppNotification) => {
    const conf = TYPE_CONFIG[notif.type];
    return (
      <Pressable
        key={notif.id}
        style={({ pressed }) => [s.card, !notif.read && s.cardUnread, pressed && { opacity: 0.9 }]}
        onPress={() => handlePress(notif)}
        accessibilityRole="button"
        accessibilityLabel={`${notif.title}, ${notif.body}${!notif.read ? ', unread' : ''}`}
      >
        {!notif.read && <View style={[s.cardAccent, { backgroundColor: conf.color }]} />}
        <View style={[s.iconWrap, { backgroundColor: conf.color + '12' }]}>
          <Ionicons name={conf.icon} size={18} color={conf.color} />
        </View>
        <View style={s.content}>
          <View style={s.titleRow}>
            <Text style={[s.title, !notif.read && s.titleUnread]} numberOfLines={1}>{notif.title}</Text>
            <Text style={s.time}>{formatTimeAgo(notif.createdAt)}</Text>
          </View>
          <Text style={s.body} numberOfLines={2}>{notif.body}</Text>
          <View style={s.footer}>
            <View style={[s.typePill, { backgroundColor: conf.color + '10' }]}>
              <Text style={[s.typeText, { color: conf.color }]}>{t(conf.labelKey, TYPE_FALLBACKS[notif.type])}</Text>
            </View>
            {notif.priority === 'urgent' && (
              <View style={s.urgentBadge}>
                <Ionicons name="alert-circle" size={10} color={SemanticColors.feedbackError} />
                <Text style={s.urgentBadgeText}>{t('notifications.urgent', 'Urgent')}</Text>
              </View>
            )}
            {notif.priority === 'high' && (
              <View style={[s.urgentBadge, { backgroundColor: SemanticColors.feedbackWarning + '15' }]}>
                <Text style={[s.urgentBadgeText, { color: SemanticColors.feedbackWarning }]}>{t('notifications.high', 'High')}</Text>
              </View>
            )}
            {notif.actionRoute && (
              <Pressable style={s.viewBtn} onPress={() => handlePress(notif)} accessibilityRole="button" accessibilityLabel={`${t('common.view', 'View')} ${notif.title}`}>
                <Text style={s.viewBtnText}>{t('common.view', 'View')}</Text>
                <Ionicons name="chevron-forward" size={12} color={Palette.hermesOrange} />
              </Pressable>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  const renderGroupedCard = (group: GroupedNotification) => {
    const conf = TYPE_CONFIG[group.type];
    const unreadCount = group.notifications.filter(n => !n.read).length;

    // Single notification — render normally
    if (group.count === 1) {
      return (
        <FadeIn key={group.notifications[0].id} delay={0} duration={300}>
          {renderNotificationCard(group.notifications[0])}
        </FadeIn>
      );
    }

    // Grouped notification — expandable
    return (
      <FadeIn key={`group-${group.type}`} delay={0} duration={300}>
        <View style={s.groupedCard}>
          <Pressable
            style={({ pressed }) => [s.groupedHeader, pressed && { opacity: 0.9 }]}
            onPress={() => toggleGroup(group.type)}
            accessibilityRole="button"
            accessibilityLabel={`${group.groupTitle}, ${unreadCount} unread. ${group.isExpanded ? 'Collapse' : 'Expand'}`}
          >
            <View style={[s.iconWrap, { backgroundColor: conf.color + '12' }]}>
              <Ionicons name={conf.icon} size={18} color={conf.color} />
            </View>
            <View style={s.groupedHeaderContent}>
              <View style={s.titleRow}>
                <Text style={s.groupedTitle}>{group.groupTitle}</Text>
                <Ionicons
                  name={group.isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={SemanticColors.textTertiary}
                />
              </View>
              <View style={s.groupedMeta}>
                {unreadCount > 0 && (
                  <View style={[s.typePill, { backgroundColor: conf.color + '10' }]}>
                    <Text style={[s.typeText, { color: conf.color }]}>
                      {unreadCount} {t('notifications.unread', 'unread')}
                    </Text>
                  </View>
                )}
                <Text style={s.time}>{formatTimeAgo(group.latestAt)}</Text>
              </View>
            </View>
          </Pressable>

          {/* Action buttons for grouped notifications */}
          {!group.isExpanded && (
            <View style={s.groupActions}>
              {getActionsForType(group.type).map(action => (
                <Pressable
                  key={action.route}
                  style={s.groupActionBtn}
                  onPress={() => router.push(action.route as any)}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                >
                  <Ionicons name={action.icon as IconName} size={14} color={Palette.hermesOrange} />
                  <Text style={s.groupActionText}>{action.label}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Expanded: show all notifications in the group */}
          {group.isExpanded && (
            <View style={s.groupedItems}>
              {group.notifications.map(notif => renderNotificationCard(notif))}
            </View>
          )}
        </View>
      </FadeIn>
    );
  };

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={22} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>{t('notifications.title', 'Notifications')}</Text>
        </View>
        {stats.unread > 0 && (
          <Pressable style={s.markAllBtn} onPress={handleMarkAllRead} accessibilityRole="button" accessibilityLabel={t('notifications.markAllRead', 'Mark all as read')}>
            <Ionicons name="checkmark-done" size={18} color={Palette.hermesOrange} />
          </Pressable>
        )}
      </View>

      {/* Unread summary strip */}
      {stats.unread > 0 && (
        <View style={s.unreadStrip}>
          <View style={s.unreadDot} />
          <Text style={s.unreadText}>{stats.unread} {t('notifications.unread', 'unread')}</Text>
          {stats.urgent > 0 && (
            <View style={s.urgentPill}>
              <Text style={s.urgentTextSmall}>{stats.urgent} {t('notifications.urgent', 'urgent')}</Text>
            </View>
          )}
        </View>
      )}

      {/* Tabs */}
      <View style={s.tabBar}>
        <Pressable style={[s.tab, activeTab === 'inbox' && s.tabActive]} onPress={() => setActiveTab('inbox')} accessibilityRole="tab" accessibilityState={{ selected: activeTab === 'inbox' }}>
          <Ionicons name="mail-outline" size={14} color={activeTab === 'inbox' ? '#fff' : SemanticColors.textTertiary} />
          <Text style={[s.tabText, activeTab === 'inbox' && s.tabTextActive]}>{t('notifications.inbox', 'Inbox')}</Text>
        </Pressable>
        <Pressable style={[s.tab, activeTab === 'settings' && s.tabActive]} onPress={() => setActiveTab('settings')} accessibilityRole="tab" accessibilityState={{ selected: activeTab === 'settings' }}>
          <Ionicons name="settings-outline" size={14} color={activeTab === 'settings' ? '#fff' : SemanticColors.textTertiary} />
          <Text style={[s.tabText, activeTab === 'settings' && s.tabTextActive]}>{t('notifications.settings', 'Settings')}</Text>
        </Pressable>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.hermesOrange} />}
      >
        {activeTab === 'inbox' ? (
          <>
            {notifications.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="notifications-off-outline" size={48} color={SemanticColors.textTertiary} />
                <Text style={s.emptyTitle}>{t('notifications.allCaughtUp', 'All caught up')}</Text>
                <Text style={s.emptyDesc}>{t('notifications.noNewDesc', 'No new notifications. We\'ll let you know when something needs your attention.')}</Text>
              </View>
            ) : (
              <View style={s.groupList}>
                {groups.map(group => renderGroupedCard(group))}
              </View>
            )}
          </>
        ) : (
          /* Settings tab */
          <FadeIn delay={0} duration={300}>
            <View style={s.settingsSection}>
              <Text style={s.settingsTitle}>{t('notifications.preferences', 'Notification preferences')}</Text>
              <Text style={s.settingsDesc}>{t('notifications.preferencesDesc', 'Choose which notifications you want to receive')}</Text>

              {/* Quiet hours */}
              <View style={s.quietHoursCard}>
                <View style={s.quietHoursHeader}>
                  <View style={[s.prefIcon, { backgroundColor: Palette.hermesOrange + '12' }]}>
                    <Ionicons name="moon" size={16} color={Palette.hermesOrange} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.prefLabel}>{t('notifications.quietHours', 'Quiet hours')}</Text>
                    <Text style={s.quietHoursTime}>
                      {String(quietHoursConfig.startHour).padStart(2, '0')}:{String(quietHoursConfig.startMinute).padStart(2, '0')} - {String(quietHoursConfig.endHour).padStart(2, '0')}:{String(quietHoursConfig.endMinute).padStart(2, '0')}
                    </Text>
                  </View>
                  <Switch
                    value={quietHoursConfig.enabled}
                    onValueChange={toggleQuietHours}
                    trackColor={{ true: Palette.hermesOrange, false: SemanticColors.borderDefault }}
                    thumbColor={quietHoursConfig.enabled ? '#fff' : '#f4f4f4'}
                  />
                </View>
                <Text style={s.quietHoursDesc}>
                  {t('notifications.quietHoursDesc', 'Push notifications are silenced during quiet hours.')}
                </Text>
              </View>

              {/* Notification type preferences */}
              <View style={s.prefList}>
                {preferences.map(pref => {
                  const conf = TYPE_CONFIG[pref.type];
                  return (
                    <View key={pref.type} style={s.prefRow}>
                      <View style={[s.prefIcon, { backgroundColor: conf.color + '12' }]}>
                        <Ionicons name={conf.icon} size={16} color={conf.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.prefLabel}>{t(pref.label, pref.type)}</Text>
                      </View>
                      <Switch
                        value={pref.enabled}
                        onValueChange={() => toggle(pref.type, 'enabled')}
                        trackColor={{ true: Palette.hermesOrange, false: SemanticColors.borderDefault }}
                        thumbColor={pref.enabled ? '#fff' : '#f4f4f4'}
                      />
                    </View>
                  );
                })}
              </View>
            </View>
          </FadeIn>
        )}
        <View style={{ height: 140 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.sm,
    paddingHorizontal: SafeArea.side, paddingTop: SafeArea.top, paddingBottom: GRID.xs,
  },
  backBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: TYPE.displaySize, fontFamily: TYPE.displayFamily,  color: SemanticColors.textPrimary, textTransform: 'uppercase', letterSpacing: 1.2 },
  markAllBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Palette.hermesOrange + '0A', alignItems: 'center', justifyContent: 'center' },

  // Unread strip
  unreadStrip: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.sm,
    paddingHorizontal: SafeArea.side, paddingBottom: GRID.sm,
  },
  unreadDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Palette.hermesOrange },
  unreadText: { fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textSecondary },
  urgentPill: { backgroundColor: SemanticColors.feedbackError + '15', paddingHorizontal: GRID.sm, paddingVertical: 2, borderRadius: RADIUS.sm },
  urgentTextSmall: { fontSize: TYPE.tinySize, fontFamily: TYPE.titleFamily, color: SemanticColors.feedbackError },

  // Tabs
  tabBar: { flexDirection: 'row', paddingHorizontal: SafeArea.side, gap: GRID.sm, paddingBottom: GRID.sm },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: GRID.xs, paddingVertical: GRID.sm, borderRadius: RADIUS.md, backgroundColor: SemanticColors.surfacePrimary },
  tabActive: { backgroundColor: Palette.hermesOrange },
  tabText: { fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textTertiary },
  tabTextActive: { color: '#fff' },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: SafeArea.side, gap: GRID.lg },

  // Group list
  groupList: { gap: GRID.sm },

  // Empty
  empty: { alignItems: 'center', paddingVertical: GRID.xl * 2, gap: GRID.sm },
  emptyTitle: { fontSize: TYPE.titleSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textSecondary },
  emptyDesc: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textTertiary, textAlign: 'center', paddingHorizontal: GRID.xl },

  // Card
  card: {
    flexDirection: 'row', gap: GRID.sm,
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg,
    padding: GRID.md, overflow: 'hidden',
  },
  cardUnread: { backgroundColor: SemanticColors.surfaceSecondary, borderWidth: 1, borderColor: Palette.hermesOrange + '40' },
  cardAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderTopLeftRadius: RADIUS.lg, borderBottomLeftRadius: RADIUS.lg },
  iconWrap: { width: 40, height: 40, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, gap: GRID.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: GRID.sm },
  title: { flex: 1, fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textPrimary },
  titleUnread: { fontFamily: TYPE.titleFamily },
  time: { fontSize: TYPE.tinySize, fontFamily: TYPE.tinyFamily, color: SemanticColors.textTertiary },
  body: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary, lineHeight: TYPE.captionSize * 1.5 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: GRID.sm, marginTop: GRID.xs },
  typePill: { paddingHorizontal: GRID.sm, paddingVertical: 2, borderRadius: RADIUS.sm },
  typeText: { fontSize: TYPE.tinySize, fontFamily: TYPE.labelFamily },
  urgentBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: SemanticColors.feedbackError + '12', paddingHorizontal: GRID.sm, paddingVertical: 2, borderRadius: RADIUS.sm },
  urgentBadgeText: { fontSize: TYPE.tinySize, fontFamily: TYPE.labelFamily, color: SemanticColors.feedbackError },
  viewBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 'auto' },
  viewBtnText: { fontSize: TYPE.tinySize, fontFamily: TYPE.titleFamily, color: Palette.hermesOrange },

  // Grouped card
  groupedCard: {
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  groupedHeader: {
    flexDirection: 'row', gap: GRID.sm,
    padding: GRID.md, alignItems: 'center',
  },
  groupedHeaderContent: { flex: 1, gap: GRID.xs },
  groupedTitle: { flex: 1, fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  groupedMeta: { flexDirection: 'row', alignItems: 'center', gap: GRID.sm },
  groupActions: {
    flexDirection: 'row', gap: GRID.sm,
    paddingHorizontal: GRID.md, paddingBottom: GRID.md,
  },
  groupActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.xs,
    backgroundColor: Palette.hermesOrange + '0A', borderRadius: RADIUS.md,
    paddingHorizontal: GRID.sm, paddingVertical: GRID.xs,
  },
  groupActionText: { fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: Palette.hermesOrange },
  groupedItems: { gap: 1, paddingTop: 1, backgroundColor: PAGE_BG },

  // Settings
  settingsSection: { gap: GRID.md },
  settingsTitle: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary },
  settingsDesc: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textTertiary },

  // Quiet hours
  quietHoursCard: {
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg,
    padding: GRID.md, gap: GRID.sm,
  },
  quietHoursHeader: { flexDirection: 'row', alignItems: 'center', gap: GRID.sm },
  quietHoursTime: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textTertiary },
  quietHoursDesc: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textTertiary },

  prefList: { gap: GRID.xs },
  prefRow: { flexDirection: 'row', alignItems: 'center', gap: GRID.sm, backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, padding: GRID.md },
  prefIcon: { width: 36, height: 36, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  prefLabel: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
});

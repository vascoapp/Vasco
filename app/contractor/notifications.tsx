// =============================================================================
// NOTIFICATIONS — Pro-grade notification center
// =============================================================================
// Grouped by time (Today / Earlier / This week), rich cards with actions,
// priority badges, swipe-to-read feel, settings tab.
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
  type AppNotification,
  type NotificationType,
} from '../../src/services/notificationService';
import { hapticSuccess } from '../../src/utils/haptics';
import { FadeIn } from '../../src/components/shared/FadeIn';
import { MS_PER_DAY, MS_PER_HOUR } from '../../src/utils/timeConstants';

type IconName = keyof typeof Ionicons.glyphMap;
type TabType = 'inbox' | 'settings';

const TYPE_CONFIG: Record<NotificationType, { icon: IconName; color: string; label: string }> = {
  schedule_change: { icon: 'calendar', color: SemanticColors.feedbackWarning, label: 'Schedule' },
  overdue_invoice: { icon: 'alert-circle', color: SemanticColors.feedbackError, label: 'Payment' },
  team_assignment: { icon: 'people', color: SemanticColors.feedbackInfo, label: 'Team' },
  approval_request: { icon: 'shield-checkmark', color: Palette.hermesOrange, label: 'Approval' },
  permit_update: { icon: 'document-text', color: Palette.hermesOrange, label: 'Permit' },
  delivery_update: { icon: 'cube', color: SemanticColors.feedbackSuccess, label: 'Delivery' },
  credential_expiry: { icon: 'ribbon', color: SemanticColors.feedbackWarning, label: 'Cert' },
  general: { icon: 'notifications', color: SemanticColors.textSecondary, label: 'General' },
};

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('inbox');
  const { notifications, markRead, markAllRead } = useNotifications();
  const stats = useUnreadCount();
  const { preferences, toggle } = useNotificationPreferences();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); hapticSuccess(); }, 600);
  }, []);

  // Group notifications by time
  const grouped = useMemo(() => {
    const now = Date.now();
    const today: AppNotification[] = [];
    const earlier: AppNotification[] = [];
    const thisWeek: AppNotification[] = [];
    const older: AppNotification[] = [];

    for (const n of notifications) {
      const age = now - n.createdAt.getTime();
      if (age < 12 * MS_PER_HOUR) today.push(n);
      else if (age < MS_PER_DAY) earlier.push(n);
      else if (age < 7 * MS_PER_DAY) thisWeek.push(n);
      else older.push(n);
    }

    const groups: { label: string; items: AppNotification[] }[] = [];
    if (today.length) groups.push({ label: t('notifications.today', 'Today'), items: today });
    if (earlier.length) groups.push({ label: t('notifications.earlier', 'Earlier'), items: earlier });
    if (thisWeek.length) groups.push({ label: t('notifications.thisWeek', 'This week'), items: thisWeek });
    if (older.length) groups.push({ label: t('notifications.older', 'Older'), items: older });
    return groups;
  }, [notifications, t]);

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

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>{t('notifications.title', 'Notifications')}</Text>
        </View>
        {stats.unread > 0 && (
          <Pressable style={s.markAllBtn} onPress={() => { markAllRead(); hapticSuccess(); }} accessibilityRole="button" accessibilityLabel={t('notifications.markAllRead', 'Mark all as read')}>
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
              <Text style={s.urgentText}>{stats.urgent} {t('notifications.urgent', 'urgent')}</Text>
            </View>
          )}
        </View>
      )}

      {/* Tabs */}
      <View style={s.tabBar}>
        <Pressable style={[s.tab, activeTab === 'inbox' && s.tabActive]} onPress={() => setActiveTab('inbox')} accessibilityRole="tab" accessibilityLabel={t('notifications.inbox', 'Inbox')} accessibilityState={{ selected: activeTab === 'inbox' }}>
          <Ionicons name="mail-outline" size={14} color={activeTab === 'inbox' ? '#fff' : SemanticColors.textTertiary} />
          <Text style={[s.tabText, activeTab === 'inbox' && s.tabTextActive]}>{t('notifications.inbox', 'Inbox')}</Text>
        </Pressable>
        <Pressable style={[s.tab, activeTab === 'settings' && s.tabActive]} onPress={() => setActiveTab('settings')} accessibilityRole="tab" accessibilityLabel={t('notifications.settings', 'Settings')} accessibilityState={{ selected: activeTab === 'settings' }}>
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
              grouped.map((group, gi) => (
                <FadeIn key={group.label} delay={gi * 50} duration={300}>
                  <View style={s.group}>
                    <Text style={s.groupLabel}>{group.label}</Text>
                    <View style={s.groupCards}>
                      {group.items.map((notif) => {
                        const conf = TYPE_CONFIG[notif.type];
                        return (
                          <Pressable
                            key={notif.id}
                            style={({ pressed }) => [s.card, !notif.read && s.cardUnread, pressed && { opacity: 0.9 }]}
                            onPress={() => handlePress(notif)}
                            accessibilityRole="button"
                            accessibilityLabel={`${notif.title}, ${notif.body}${!notif.read ? ', unread' : ''}`}
                          >
                            {/* Left accent */}
                            {!notif.read && <View style={[s.cardAccent, { backgroundColor: conf.color }]} />}

                            {/* Icon */}
                            <View style={[s.iconWrap, { backgroundColor: conf.color + '12' }]}>
                              <Ionicons name={conf.icon} size={18} color={conf.color} />
                            </View>

                            {/* Content */}
                            <View style={s.content}>
                              <View style={s.titleRow}>
                                <Text style={[s.title, !notif.read && s.titleUnread]} numberOfLines={1}>{notif.title}</Text>
                                <Text style={s.time}>{formatTimeAgo(notif.createdAt)}</Text>
                              </View>
                              <Text style={s.body} numberOfLines={2}>{notif.body}</Text>
                              <View style={s.footer}>
                                <View style={[s.typePill, { backgroundColor: conf.color + '10' }]}>
                                  <Text style={[s.typeText, { color: conf.color }]}>{conf.label}</Text>
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
                      })}
                    </View>
                  </View>
                </FadeIn>
              ))
            )}
          </>
        ) : (
          /* Settings tab */
          <FadeIn delay={0} duration={300}>
            <View style={s.settingsSection}>
              <Text style={s.settingsTitle}>{t('notifications.preferences', 'Notification preferences')}</Text>
              <Text style={s.settingsDesc}>{t('notifications.preferencesDesc', 'Choose which notifications you want to receive')}</Text>
              <View style={s.prefList}>
                {preferences.map(pref => {
                  const conf = TYPE_CONFIG[pref.type];
                  return (
                    <View key={pref.type} style={s.prefRow}>
                      <View style={[s.prefIcon, { backgroundColor: conf.color + '12' }]}>
                        <Ionicons name={conf.icon} size={16} color={conf.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.prefLabel}>{pref.label}</Text>
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
  headerTitle: { fontSize: TYPE.displaySize, fontFamily: TYPE.displayFamily, letterSpacing: TYPE.displayTracking, color: SemanticColors.textPrimary },
  markAllBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Palette.hermesOrange + '0A', alignItems: 'center', justifyContent: 'center' },

  // Unread strip
  unreadStrip: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.sm,
    paddingHorizontal: SafeArea.side, paddingBottom: GRID.sm,
  },
  unreadDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Palette.hermesOrange },
  unreadText: { fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textSecondary },
  urgentPill: { backgroundColor: SemanticColors.feedbackError + '15', paddingHorizontal: GRID.sm, paddingVertical: 2, borderRadius: RADIUS.sm },
  urgentText: { fontSize: TYPE.tinySize, fontFamily: TYPE.titleFamily, color: SemanticColors.feedbackError },

  // Tabs
  tabBar: { flexDirection: 'row', paddingHorizontal: SafeArea.side, gap: GRID.sm, paddingBottom: GRID.sm },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: GRID.xs, paddingVertical: GRID.sm, borderRadius: RADIUS.md, backgroundColor: SemanticColors.surfacePrimary },
  tabActive: { backgroundColor: Palette.hermesOrange },
  tabText: { fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textTertiary },
  tabTextActive: { color: '#fff' },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: SafeArea.side, gap: GRID.lg },

  // Empty
  empty: { alignItems: 'center', paddingVertical: GRID.xl * 2, gap: GRID.sm },
  emptyTitle: { fontSize: TYPE.titleSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textSecondary },
  emptyDesc: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textTertiary, textAlign: 'center', paddingHorizontal: GRID.xl },

  // Groups
  group: { gap: GRID.sm },
  groupLabel: { fontSize: TYPE.labelSize, fontFamily: TYPE.labelFamily, color: SemanticColors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  groupCards: { gap: GRID.xs },

  // Card
  card: {
    flexDirection: 'row', gap: GRID.sm,
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg,
    padding: GRID.md, overflow: 'hidden',
  },
  cardUnread: { backgroundColor: '#fff' },
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

  // Settings
  settingsSection: { gap: GRID.md },
  settingsTitle: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary },
  settingsDesc: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textTertiary },
  prefList: { gap: GRID.xs },
  prefRow: { flexDirection: 'row', alignItems: 'center', gap: GRID.sm, backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, padding: GRID.md },
  prefIcon: { width: 36, height: 36, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  prefLabel: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
});

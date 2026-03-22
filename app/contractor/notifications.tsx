// =============================================================================
// NOTIFICATIONS — Meldingen centrum
// =============================================================================
import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG } from '../../src/theme/tabStyles';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import {
  useNotifications,
  useUnreadCount,
  useNotificationPreferences,
  type AppNotification,
  type NotificationType,
} from '../../src/services/notificationService';
import { hapticSuccess } from '../../src/utils/haptics';
import { FadeIn } from '../../src/components/shared/FadeIn';

type IconName = keyof typeof Ionicons.glyphMap;
type TabType = 'inbox' | 'instellingen';

const TYPE_CONFIG: Record<NotificationType, { icon: IconName; color: string }> = {
  schedule_change: { icon: 'calendar-outline', color: SemanticColors.feedbackWarning },
  overdue_invoice: { icon: 'alert-circle-outline', color: SemanticColors.feedbackError },
  team_assignment: { icon: 'people-outline', color: SemanticColors.feedbackInfo },
  approval_request: { icon: 'shield-checkmark-outline', color: Palette.hermesOrange },
  permit_update: { icon: 'document-text-outline', color: Palette.terracotta },
  delivery_update: { icon: 'cube-outline', color: '#10B981' },
  credential_expiry: { icon: 'ribbon-outline', color: SemanticColors.feedbackWarning },
  general: { icon: 'notifications-outline', color: SemanticColors.textSecondary },
};

const getPriorityConfig = (t: (key: string, defaultValue: string) => string): Record<string, { label: string; color: string }> => ({
  urgent: { label: t('notifications.priorityUrgent', 'Urgent'), color: SemanticColors.feedbackError },
  high: { label: t('notifications.priorityHigh', 'Hoog'), color: SemanticColors.feedbackWarning },
  medium: { label: t('notifications.priorityMedium', 'Normaal'), color: SemanticColors.feedbackInfo },
  low: { label: t('notifications.priorityLow', 'Laag'), color: SemanticColors.textTertiary },
});

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const PRIORITY_CONFIG = getPriorityConfig(t);
  const [activeTab, setActiveTab] = useState<TabType>('inbox');
  const { notifications, markRead, markAllRead } = useNotifications();
  const stats = useUnreadCount();
  const { preferences, toggle } = useNotificationPreferences();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => { setRefreshing(true); setTimeout(() => { setRefreshing(false); hapticSuccess(); }, 600); }, []);

  const formatTimeAgo = (date: Date) => {
    const mins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (mins < 60) return t('notifications.minutesAgo', `${mins}m geleden`);
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('notifications.hoursAgo', `${hours}u geleden`);
    const days = Math.floor(hours / 24);
    return t('notifications.daysAgo', `${days}d geleden`);
  };

  const handleNotificationPress = (notif: AppNotification) => {
    if (!notif.read) {
      markRead(notif.id);
      hapticSuccess();
    }
    if (notif.actionRoute) {
      router.push(notif.actionRoute as any);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('notifications.title', 'Meldingen')}</Text>
          <Text style={styles.headerSubtitle}>
            {stats.unread > 0 ? t('notifications.unreadCount', `${stats.unread} ongelezen`) : t('notifications.noNew', 'Geen nieuwe meldingen')}
          </Text>
        </View>
        {stats.unread > 0 && (
          <Pressable
            style={styles.markAllButton}
            onPress={() => { markAllRead(); hapticSuccess(); }}
          >
            <Ionicons name="checkmark-done" size={20} color={Palette.hermesOrange} />
          </Pressable>
        )}
      </View>

      {/* Tabs */}
      <FadeIn delay={0} duration={400}>
        <View style={styles.tabBar}>
          <Pressable style={[styles.tab, activeTab === 'inbox' && styles.tabActive]} onPress={() => setActiveTab('inbox')}>
            <Text style={[styles.tabText, activeTab === 'inbox' && styles.tabTextActive]}>
              {t('notifications.inbox', 'Inbox')}{stats.unread > 0 ? ` (${stats.unread})` : ''}
            </Text>
          </Pressable>
          <Pressable style={[styles.tab, activeTab === 'instellingen' && styles.tabActive]} onPress={() => setActiveTab('instellingen')}>
            <Text style={[styles.tabText, activeTab === 'instellingen' && styles.tabTextActive]}>{t('notifications.settings', 'Instellingen')}</Text>
          </Pressable>
        </View>
      </FadeIn>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.hermesOrange} />}>
        {activeTab === 'inbox' ? (
          <View style={{ gap: 4 }}>
            {notifications.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="notifications-off-outline" size={40} color={SemanticColors.textTertiary} />
                <Text style={styles.emptyText}>{t('notifications.noNotifications', 'Geen meldingen')}</Text>
              </View>
            ) : (
              notifications.map(notif => {
                const typeConf = TYPE_CONFIG[notif.type];
                const prioConf = PRIORITY_CONFIG[notif.priority];
                return (
                  <Pressable
                    key={notif.id}
                    style={[styles.notifCard, !notif.read && styles.notifCardUnread]}
                    onPress={() => handleNotificationPress(notif)}
                  >
                    <View style={[styles.notifIcon, { backgroundColor: typeConf.color + '15' }]}>
                      <Ionicons name={typeConf.icon} size={18} color={typeConf.color} />
                    </View>
                    <View style={styles.notifContent}>
                      <View style={styles.notifTitleRow}>
                        <Text style={[styles.notifTitle, !notif.read && styles.notifTitleUnread]} numberOfLines={1}>
                          {notif.title}
                        </Text>
                        {!notif.read && <View style={styles.unreadDot} />}
                      </View>
                      <Text style={styles.notifBody} numberOfLines={2}>{notif.body}</Text>
                      <View style={styles.notifMeta}>
                        <Text style={styles.notifTime}>{formatTimeAgo(notif.createdAt)}</Text>
                        {notif.priority === 'urgent' && (
                          <View style={[styles.prioBadge, { backgroundColor: prioConf.color + '20' }]}>
                            <Text style={[styles.prioText, { color: prioConf.color }]}>{prioConf.label}</Text>
                          </View>
                        )}
                        {notif.actionRoute && (
                          <View style={styles.actionBadge}>
                            <Text style={styles.actionText}>{t('notifications.view', 'Bekijk →')}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
        ) : (
          /* Preferences */
          <View style={{ gap: 4 }}>
            <Text style={styles.settingsTitle}>{t('notifications.preferences', 'Meldingsvoorkeuren')}</Text>
            {preferences.map(pref => (
              <View key={pref.type} style={styles.prefRow}>
                <View style={styles.prefInfo}>
                  <Text style={styles.prefLabel}>{pref.label}</Text>
                </View>
                <View style={styles.prefToggles}>
                  <View style={styles.toggleCol}>
                    <Text style={styles.toggleLabel}>{t('notifications.on', 'Aan')}</Text>
                    <Switch
                      value={pref.enabled}
                      onValueChange={() => toggle(pref.type, 'enabled')}
                      trackColor={{ true: Palette.hermesOrange }}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: SafeArea.side, paddingTop: SafeArea.top, paddingBottom: Spacing.sm },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 24, fontFamily: 'Manrope_700Bold', color: SemanticColors.textPrimary },
  headerSubtitle: { fontSize: 14, color: SemanticColors.textSecondary, marginTop: 2 },
  markAllButton: { width: 40, height: 40, borderRadius: 16, backgroundColor: Palette.hermesOrange + '0A', alignItems: 'center', justifyContent: 'center' },
  tabBar: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: 6, paddingBottom: Spacing.sm },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 12, backgroundColor: SemanticColors.surfacePrimary, alignItems: 'center' },
  tabActive: { backgroundColor: Palette.hermesOrange },
  tabText: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: SemanticColors.textTertiary },
  tabTextActive: { color: Palette.white },
  scrollView: { flex: 1, paddingHorizontal: SafeArea.side },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  emptyText: { fontSize: 14, color: SemanticColors.textTertiary },
  notifCard: { flexDirection: 'row', gap: Spacing.sm, backgroundColor: SemanticColors.surfacePrimary, borderRadius: 12, padding: Spacing.sm },
  notifCardUnread: { borderLeftWidth: 3, borderLeftColor: Palette.hermesOrange },
  notifIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  notifContent: { flex: 1, gap: 2 },
  notifTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  notifTitle: { flex: 1, fontSize: 14, fontFamily: 'Manrope_500Medium', color: SemanticColors.textPrimary },
  notifTitleUnread: { fontFamily: 'Manrope_700Bold' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Palette.hermesOrange },
  notifBody: { fontSize: 12, color: SemanticColors.textSecondary, lineHeight: 16 },
  notifMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  notifTime: { fontSize: 11, color: SemanticColors.textTertiary },
  prioBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  prioText: { fontSize: 10, fontFamily: 'Manrope_700Bold' },
  actionBadge: { marginLeft: 'auto' },
  actionText: { fontSize: 11, fontFamily: 'Manrope_600SemiBold', color: Palette.hermesOrange },
  settingsTitle: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: SemanticColors.textPrimary, marginBottom: Spacing.sm },
  prefRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: SemanticColors.surfacePrimary, borderRadius: 12, padding: Spacing.sm, gap: Spacing.sm },
  prefInfo: { flex: 1 },
  prefLabel: { fontSize: 14, fontFamily: 'Manrope_500Medium', color: SemanticColors.textPrimary },
  prefToggles: { flexDirection: 'row', gap: Spacing.md },
  toggleCol: { alignItems: 'center', gap: 2 },
  toggleLabel: { fontSize: 10, color: SemanticColors.textTertiary },
});

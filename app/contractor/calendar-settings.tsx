// =============================================================================
// CALENDAR SETTINGS — Sync jobs to device calendar
// =============================================================================

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { SafeArea } from '../../src/theme/spacing';
import { useCalendarSync } from '../../src/services/calendarSyncService';
import { useAppState } from '../../src/state/AppState';
import { hapticSuccess } from '../../src/utils/haptics';

type IconName = keyof typeof Ionicons.glyphMap;

export default function CalendarSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { jobs } = useAppState();
  const { settings, calendars, loading, syncing, updateSettings, syncAll } = useCalendarSync();

  const handleToggleSync = async (enabled: boolean) => {
    hapticSuccess();
    if (enabled && calendars.length === 0) {
      Alert.alert(
        t('calendar.noCalendars', 'No calendars found'),
        t('calendar.noCalendarsDesc', 'Please create a calendar on your device first, or grant calendar permissions in Settings.'),
      );
      return;
    }
    // If enabling and no calendar selected, auto-select primary or first
    if (enabled && !settings.calendarId) {
      const primary = calendars.find(c => c.isPrimary) || calendars[0];
      if (primary) {
        await updateSettings({ enabled: true, calendarId: primary.id, calendarTitle: primary.title });
        return;
      }
    }
    await updateSettings({ enabled });
  };

  const handleSelectCalendar = (cal: { id: string; title: string }) => {
    hapticSuccess();
    updateSettings({ calendarId: cal.id, calendarTitle: cal.title });
  };

  const handleSyncNow = async () => {
    hapticSuccess();
    const result = await syncAll(jobs);
    Alert.alert(
      t('calendar.syncComplete', 'Sync complete'),
      t('calendar.syncResult', {
        defaultValue: '{{synced}} jobs synced, {{failed}} failed.',
        synced: result.synced,
        failed: result.failed,
      }),
    );
  };

  if (loading) {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={SemanticColors.textPrimary} />
          </Pressable>
          <Text style={s.headerTitle}>{t('calendar.settings', 'Calendar Settings')}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color={Palette.hermesOrange} />
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>{t('calendar.settings', 'Calendar Settings')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={s.heroCard}>
          <View style={s.heroIconWrap}>
            <Ionicons name="calendar" size={28} color={Palette.hermesOrange} />
          </View>
          <Text style={s.heroTitle}>{t('calendar.syncTitle', 'Calendar Sync')}</Text>
          <Text style={s.heroDesc}>
            {t('calendar.syncDesc', 'Automatically sync your scheduled jobs to your device calendar. Never miss an appointment.')}
          </Text>
        </View>

        {/* Toggle sync */}
        <View style={s.card}>
          <View style={s.settingRow}>
            <View style={s.settingInfo}>
              <Text style={s.settingLabel}>{t('calendar.enableSync', 'Sync jobs to calendar')}</Text>
              <Text style={s.settingDesc}>
                {t('calendar.enableSyncDesc', 'New and updated jobs will appear in your device calendar')}
              </Text>
            </View>
            <Switch
              value={settings.enabled}
              onValueChange={handleToggleSync}
              trackColor={{ true: Palette.hermesOrange, false: SemanticColors.borderDefault }}
              thumbColor={Palette.white}
            />
          </View>
        </View>

        {/* Calendar picker */}
        {settings.enabled && (
          <View style={s.card}>
            <Text style={s.sectionLabel}>{t('calendar.selectCalendar', 'Select calendar')}</Text>
            {calendars.length === 0 ? (
              <Text style={s.noCalendarsText}>
                {t('calendar.noCalendarsAvailable', 'No writable calendars available on this device.')}
              </Text>
            ) : (
              <View style={s.calendarList}>
                {calendars.map(cal => {
                  const isSelected = cal.id === settings.calendarId;
                  return (
                    <Pressable
                      key={cal.id}
                      style={[s.calendarRow, isSelected && s.calendarRowSelected]}
                      onPress={() => handleSelectCalendar(cal)}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('calendar.select', 'Select')} ${cal.title}`}
                    >
                      <View style={[s.calendarDot, { backgroundColor: cal.color }]} />
                      <View style={s.calendarInfo}>
                        <Text style={[s.calendarName, isSelected && s.calendarNameSelected]}>
                          {cal.title}
                        </Text>
                        {cal.source ? (
                          <Text style={s.calendarSource}>{cal.source}</Text>
                        ) : null}
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color={Palette.hermesOrange} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Sync status */}
        {settings.enabled && (
          <View style={s.card}>
            <Text style={s.sectionLabel}>{t('calendar.syncStatus', 'Sync status')}</Text>
            <View style={s.statusRow}>
              <View style={[s.statusDot, { backgroundColor: settings.lastSyncAt ? SemanticColors.feedbackSuccess : SemanticColors.textDisabled }]} />
              <Text style={s.statusText}>
                {settings.lastSyncAt
                  ? t('calendar.lastSynced', {
                      defaultValue: 'Last synced: {{date}}',
                      date: new Date(settings.lastSyncAt).toLocaleString(undefined, {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      }),
                    })
                  : t('calendar.neverSynced', 'Not synced yet')
                }
              </Text>
            </View>

            {/* Sync now button */}
            <Pressable
              style={[s.syncButton, syncing && s.syncButtonDisabled]}
              onPress={handleSyncNow}
              disabled={syncing}
              accessibilityRole="button"
              accessibilityLabel={t('calendar.syncNow', 'Sync now')}
            >
              {syncing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="sync" size={18} color="#fff" />
              )}
              <Text style={s.syncButtonText}>
                {syncing ? t('calendar.syncing', 'Syncing...') : t('calendar.syncNow', 'Sync now')}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Info */}
        <View style={s.infoCard}>
          <View style={s.infoAccent} />
          <View style={s.infoContent}>
            <View style={s.infoHeader}>
              <Ionicons name="information-circle" size={16} color={Palette.hermesOrange} />
              <Text style={s.infoTitle}>{t('calendar.howItWorks', 'How it works')}</Text>
            </View>
            <Text style={s.infoText}>
              {t('calendar.howItWorksDesc', 'When you create or update a job with a scheduled date, Vasco automatically creates or updates a calendar event on your device. Cancelled jobs are removed from your calendar.')}
            </Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GRID.md,
    paddingTop: SafeArea.top,
    paddingBottom: GRID.md,
  },
  headerTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary, textTransform: 'uppercase', letterSpacing: 1.2 },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: GRID.md,
    gap: GRID.md,
  },

  // Hero
  heroCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: GRID.lg,
    alignItems: 'center',
    gap: GRID.sm,
  },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.full,
    backgroundColor: Palette.hermesOrange + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: GRID.xs,
  },
  heroTitle: {
    fontSize: TYPE.sectionSize + 2,
    fontFamily: TYPE.displayFamily,
    color: SemanticColors.textPrimary,
    letterSpacing: -0.3,
  },
  heroDesc: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Card
  card: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    gap: GRID.md,
  },

  // Settings
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.md,
  },
  settingInfo: {
    flex: 1,
    gap: GRID.xs,
  },
  settingLabel: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  settingDesc: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
  },

  sectionLabel: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textTertiary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  noCalendarsText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textDisabled,
  },

  // Calendar list
  calendarList: {
    gap: GRID.sm,
  },
  calendarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.md - 4,
    padding: GRID.md - 4,
    borderRadius: RADIUS.md,
    backgroundColor: PAGE_BG,
  },
  calendarRowSelected: {
    backgroundColor: Palette.hermesOrange + '0A',
    borderWidth: 1,
    borderColor: Palette.hermesOrange + '30',
  },
  calendarDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  calendarInfo: {
    flex: 1,
    gap: 2,
  },
  calendarName: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  calendarNameSelected: {
    color: Palette.hermesOrange,
  },
  calendarSource: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
  },

  // Status
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textSecondary,
  },

  // Sync button
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: GRID.sm,
    backgroundColor: Palette.hermesOrange,
    borderRadius: RADIUS.md,
    paddingVertical: GRID.md - 4,
  },
  syncButtonDisabled: {
    opacity: 0.6,
  },
  syncButtonText: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: '#fff',
  },

  // Info card
  infoCard: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  infoAccent: {
    width: 4,
    backgroundColor: Palette.hermesOrange,
  },
  infoContent: {
    flex: 1,
    padding: GRID.md,
    gap: GRID.sm,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
  },
  infoTitle: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.sectionFamily,
    color: Palette.hermesOrange,
  },
  infoText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textSecondary,
    lineHeight: 18,
  },
});

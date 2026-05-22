// =============================================================================
// DecisionActivityPanel — R66 round 47
// =============================================================================
// Surfaces the customer's hesitation pattern on a decision tracker. Pre-R47
// the customer portal wrote rich activity events (item_viewed, item_expanded,
// help_clicked, decision_made, photo_viewed) into decision_activities, but
// no FE consumer read them — pure dormant data. Now the contractor sees
// "Klant heeft 3× naar tegelkleur gekeken voor ze koos" and similar
// hesitation signals on each tracker detail screen.
// =============================================================================

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DK } from '../../theme/draftkings';
import { TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { DKLabel } from '../shared/DKLabel';
import { getTrackerActivities, type DecisionActivity } from '../../services/decisionSyncService';

interface Props {
  trackerId: string;
  itemNameById?: Record<string, string>;
}

export function DecisionActivityPanel({ trackerId, itemNameById }: Props) {
  const { t } = useTranslation();
  const [activities, setActivities] = useState<DecisionActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getTrackerActivities(trackerId).then((rows) => {
      if (!cancelled) {
        setActivities(rows);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [trackerId]);

  if (loading || activities.length === 0) return null;

  // Aggregate hesitation: count views per item, find items viewed 3+ times.
  const viewCounts = new Map<string, number>();
  for (const a of activities) {
    if (a.activityType === 'item_viewed' && a.itemId) {
      viewCounts.set(a.itemId, (viewCounts.get(a.itemId) ?? 0) + 1);
    }
  }
  const hesitationItems = [...viewCounts.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const totalEvents = activities.length;
  const portalOpens = activities.filter((a) => a.activityType === 'portal_accessed').length;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="time-outline" size={16} color={DK.colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <DKLabel style={styles.title}>{t('decisions.activityTitle', 'Customer activity')}</DKLabel>
          <Text style={styles.sub}>
            {t('decisions.activitySub', '{{events}} events · {{opens}} portal opens', {
              events: totalEvents,
              opens: portalOpens,
            })}
          </Text>
        </View>
      </View>

      {hesitationItems.length > 0 && (
        <View style={styles.list}>
          <Text style={styles.listLabel}>{t('decisions.hesitationLabel', 'Hesitated on')}</Text>
          {hesitationItems.map(([itemId, count]) => {
            const itemName = itemNameById?.[itemId] ?? itemId;
            return (
              <View key={itemId} style={styles.row}>
                <Text style={styles.rowName} numberOfLines={1}>{itemName}</Text>
                <View style={styles.viewChip}>
                  <Ionicons name="eye-outline" size={11} color={DK.colors.highlight} />
                  <Text style={styles.viewChipText}>
                    {t('decisions.viewedTimes', '{{count}}×', { count })}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: DK.colors.panel,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    gap: GRID.sm,
    borderWidth: 1,
    borderColor: DK.colors.border,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: GRID.sm },
  iconWrap: {
    width: 32, height: 32,
    borderRadius: RADIUS.md,
    backgroundColor: DK.colors.accent + '14',
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontSize: TYPE.labelSize,
    fontFamily: 'Archivo_800ExtraBold',
    color: DK.colors.text,
  },
  sub: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: DK.colors.textMuted,
    marginTop: 2,
  },
  list: { gap: GRID.xs, marginTop: 4 },
  listLabel: {
    fontSize: 10,
    fontFamily: 'Archivo_700Bold',
    letterSpacing: 1.4,
    color: DK.colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
    paddingVertical: 4,
  },
  rowName: {
    flex: 1,
    fontSize: TYPE.bodySize,
    fontFamily: 'Inter_500Medium',
    color: DK.colors.text,
  },
  viewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    backgroundColor: DK.colors.highlight + '20',
  },
  viewChipText: {
    fontSize: 11,
    fontFamily: 'Archivo_700Bold',
    color: DK.colors.highlight,
  },
});

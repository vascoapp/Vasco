// =============================================================================
// REPEAT WORK — the maintenance contracts already hiding in the job history
// =============================================================================
// The competitor answer to recurring revenue is a "membership": design a plan,
// then go and sell it. Both halves are manual, which is why most contractors do
// neither. This screen does the half a contractor cannot easily do themselves —
// reading their own history back to them — and leaves the selling to them.
//
// Everything here is observed. Nothing on this screen is a market rate, an
// industry average, or a projection: the interval is the median gap between
// that customer's visits, and the money is the median of what that customer was
// actually charged. Where there is nothing to derive a figure from, the figure
// is absent rather than guessed.
// =============================================================================

import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { SafeArea } from '../../src/theme/spacing';
import { DKScreenHeader } from '../../src/components/shared/DKScreenHeader';
import { formatCurrency } from '../../src/i18n/formatting';
import { useAuth } from '../../src/context/AuthContext';
import {
  useMaintenanceOpportunities,
  MIN_VISITS_FOR_RHYTHM,
  type MaintenanceOpportunity,
} from '../../src/services/maintenanceOpportunityService';

/** "every 3 months" reads better than "every 91 days" once past a month. */
function cadenceLabel(days: number, t: (k: string, d: string, o?: object) => string): string {
  if (days >= 330 && days <= 400) return t('repeatWork.everyYear', 'every year');
  if (days >= 28) {
    const months = Math.round(days / 30.44);
    return t('repeatWork.everyMonths', 'every {{count}} months', { count: months });
  }
  return t('repeatWork.everyDays', 'every {{count}} days', { count: days });
}

export default function RepeatWorkScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const country = user?.country ?? 'NL';
  const opportunities = useMaintenanceOpportunities();

  const renderRow = (o: MaintenanceOpportunity) => {
    const overdue = o.dueInDays < 0;
    return (
      <Pressable
        key={o.customerId}
        style={styles.card}
        onPress={() => router.push(`/contractor/customer/${o.customerId}` as any)}
        accessibilityRole="button"
      >
        <View style={styles.cardTop}>
          <View style={styles.cardTitleCol}>
            <Text style={styles.customer} numberOfLines={2}>{o.customerName}</Text>
            <Text style={styles.cadence}>
              {cadenceLabel(o.intervalDays, t as never)}
              {' · '}
              {t('repeatWork.visits', '{{count}} visits', { count: o.visits })}
            </Text>
          </View>
          <View style={[styles.dueBadge, overdue && styles.dueBadgeOverdue]}>
            <Text style={[styles.dueBadgeText, overdue && styles.dueBadgeTextOverdue]}>
              {overdue
                ? t('repeatWork.overdueBy', '{{count}}d overdue', { count: Math.abs(o.dueInDays) })
                : t('repeatWork.dueIn', 'due in {{count}}d', { count: o.dueInDays })}
            </Text>
          </View>
        </View>

        {/* Absent, not zero, when no job carried an amount. */}
        {o.estimatedAnnualValue !== null && (
          <Text style={styles.value}>
            {t('repeatWork.worthPerYear', '{{amount}} a year at what you already charge', {
              amount: formatCurrency(o.estimatedAnnualValue, country),
            })}
          </Text>
        )}

        {/* Said plainly rather than shown as a confidence score: the gaps are
            irregular, so this is a repeat customer but not a schedule. */}
        {o.confidence === 'loose' && (
          <Text style={styles.loose}>
            {t('repeatWork.irregular', 'Timing varies — worth a conversation, not a fixed date.')}
          </Text>
        )}
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <DKScreenHeader
        title={t('repeatWork.title', 'Repeat work')}
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          {t(
            'repeatWork.intro',
            'Customers you already visit on a rhythm. Read from your finished jobs — the interval and the amounts are yours, not an industry average.',
          )}
        </Text>

        {opportunities.map(renderRow)}

        {opportunities.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="repeat-outline" size={44} color={SemanticColors.textTertiary} />
            <Text style={styles.emptyTitle}>{t('repeatWork.emptyTitle', 'Nothing due yet')}</Text>
            {/* The threshold is stated because an unexplained empty screen reads
                as broken, and a contractor who has done two visits for someone
                should know a third will surface them. */}
            <Text style={styles.emptyHint}>
              {t('repeatWork.emptyHint', 'A customer shows up here once you have completed {{count}} visits for them and the next one is within about two months.', { count: MIN_VISITS_FOR_RHYTHM })}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  content: { padding: GRID.md, paddingBottom: SafeArea.bottom + 40, gap: GRID.sm },
  intro: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.captionSize,
    lineHeight: 19,
    marginBottom: GRID.xs,
  },
  card: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    padding: 14,
    gap: 6,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: GRID.sm },
  cardTitleCol: { flex: 1, gap: 2 },
  customer: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
  },
  cadence: { color: SemanticColors.textSecondary, fontSize: TYPE.captionSize },
  dueBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: SemanticColors.surfaceSecondary,
    flexShrink: 0,
  },
  dueBadgeOverdue: { backgroundColor: SemanticColors.feedbackError + '20' },
  dueBadgeText: { color: SemanticColors.textSecondary, fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily },
  dueBadgeTextOverdue: { color: SemanticColors.feedbackError },
  value: { color: Palette.hermesOrange, fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily },
  loose: { color: SemanticColors.textTertiary, fontSize: TYPE.captionSize },
  empty: { alignItems: 'center', padding: GRID.xl, gap: GRID.sm },
  emptyTitle: { color: SemanticColors.textSecondary, fontSize: TYPE.bodySize },
  emptyHint: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.captionSize,
    textAlign: 'center',
    lineHeight: 19,
  },
});

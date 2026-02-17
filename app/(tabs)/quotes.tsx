import { Link, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { Screen } from '../../src/components/Screen';
import { InlineInsight } from '../../src/components/shared/VascoInsightCard';
import { useInlineInsight } from '../../src/services/vascoGuidanceService';
import { SemanticColors } from '../../src/theme/colors';
import { Radius } from '../../src/theme/radius';
import { Spacing } from '../../src/theme/spacing';
import { Typography } from '../../src/theme/typography';
import { useAppState } from '../../src/state/AppState';
import { hapticSuccess } from '../../src/utils/haptics';

const formatCurrency = (amount: number) =>
  `€${amount.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}`;

export default function QuotesScreen() {
  const router = useRouter();
  const { quotes, removeQuote, isLoading, refreshData } = useAppState();
  const [refreshing, setRefreshing] = useState(false);

  // AI guidance
  const pipelineInsight = useInlineInsight('contractor', 'quotes', 'pipeline');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
    hapticSuccess();
  }, [refreshData]);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={SemanticColors.actionPrimary} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.sectionLabel}>Quotes</Text>
            <Text style={Typography.title}>Drafts</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.refreshButton} onPress={onRefresh}>
              <Text style={styles.refreshText}>Refresh</Text>
            </Pressable>
            <PrimaryButton label="New quote" onPress={() => router.push('/quotes/new')} />
          </View>
        </View>

        {pipelineInsight && (
          <InlineInsight
            icon={pipelineInsight.icon as any}
            message={pipelineInsight.message}
            actionLabel={pipelineInsight.actionLabel}
            actionRoute={pipelineInsight.actionRoute}
          />
        )}

        {isLoading && quotes.length === 0 && (
          <ActivityIndicator size="large" color={SemanticColors.actionPrimary} style={{ marginVertical: Spacing.xl }} />
        )}

        <View style={styles.section}>
          {quotes.filter((q) => q.status === 'draft').map((draft) => (
            <Swipeable
              key={draft.id}
              renderRightActions={() => (
                <Pressable style={styles.swipeAction} onPress={() => removeQuote(draft.id)}>
                  <Text style={styles.swipeActionText}>Delete</Text>
                </Pressable>
              )}
            >
              <View style={styles.row}>
                <Link href={`/quotes/${draft.id}`} asChild>
                  <Pressable style={styles.rowContent}>
                    <View>
                      <Text style={Typography.body}>{draft.customer}</Text>
                      <Text style={Typography.muted}>{draft.id} · {draft.job}</Text>
                    </View>
                    <Text style={Typography.body}>{formatCurrency(draft.amount)}</Text>
                  </Pressable>
                </Link>
                <Pressable style={styles.deleteButton} onPress={() => removeQuote(draft.id)}>
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
              </View>
            </Swipeable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  header: {
    gap: Spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  refreshButton: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshText: {
    color: SemanticColors.actionPrimary,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  sectionLabel: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: Spacing.xs,
    fontFamily: 'Inter_500Medium',
  },
  section: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  rowContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: SemanticColors.feedbackError,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radius.sm,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    color: SemanticColors.textPrimary,
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  swipeAction: {
    backgroundColor: SemanticColors.feedbackError,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginVertical: Spacing.xs,
    borderRadius: Radius.md,
    minWidth: 72,
    minHeight: 44,
  },
  swipeActionText: {
    color: SemanticColors.textPrimary,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
});

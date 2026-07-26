import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { SemanticColors } from '../../src/theme/colors';
import { Radius } from '../../src/theme/radius';
import { Spacing } from '../../src/theme/spacing';
import { Typography } from '../../src/theme/typography';
import { useAppState } from '../../src/state/AppState';
import { formatMoney } from '../../src/i18n/formatting';

export default function InsightsModal() {
  const { priceRisks } = useAppState();

  return (
    <Screen backgroundColor={SemanticColors.surfacePrimary}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={Typography.title}>Insights</Text>
        <Text style={Typography.muted}>
          Actionable signals based on your uploaded history.
        </Text>

        {priceRisks.length === 0 ? (
          <View style={styles.card}>
            <Text style={Typography.subtitle}>No insights yet</Text>
            <Text style={Typography.muted}>
              Add PDFs to unlock price‑risk suggestions.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {priceRisks.map((risk) => (
              <Link key={risk.quoteId} href={`/quotes/${risk.quoteId}`} asChild>
                <Pressable style={styles.card}>
                  <Text style={Typography.subtitle}>Price risk detected</Text>
                  <Text style={Typography.muted}>{risk.customer}</Text>
                  <Text style={Typography.muted}>{risk.reason}</Text>
                  <Text style={styles.impact}>Save {formatMoney(risk.estimatedSavings)}</Text>
                </Pressable>
              </Link>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  list: {
    gap: Spacing.sm,
  },
  card: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  impact: {
    color: SemanticColors.textTertiary,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
});

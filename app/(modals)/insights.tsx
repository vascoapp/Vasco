import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { Colors } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';
import { Typography } from '../../src/theme/typography';
import { useAppState } from '../../src/state/AppState';

export default function InsightsModal() {
  const { priceRisks } = useAppState();

  return (
    <Screen backgroundColor={Colors.surface}>
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
                  <Text style={styles.impact}>Save €{risk.estimatedSavings}</Text>
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
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 16,
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  impact: {
    color: Colors.accent,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
});

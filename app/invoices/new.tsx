import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AssistBanner } from '../../src/components/AssistBanner';
import { Screen } from '../../src/components/Screen';
import { Colors } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';
import { Typography } from '../../src/theme/typography';

const quotes = [
  { id: 'q-102', customer: 'De Jong', amount: '€2,450', job: 'Interior repaint' },
  { id: 'q-103', customer: 'Van Dijk', amount: '€1,120', job: 'Exterior repaint' },
];

export default function InvoiceFromQuoteSelect() {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={Typography.title}>Create invoice</Text>
          <Text style={Typography.muted}>Pick a quote to invoice</Text>
        </View>

        <AssistBanner
          title="Get paid faster"
          description="Invoices sent within 24 hours are paid sooner."
          actionLabel="Pick a quote"
          meta="Guided"
        />

        <View style={styles.card}>
          {quotes.map((quote) => (
            <Link key={quote.id} href={`/quotes/${quote.id}/invoice`} asChild>
              <Pressable style={styles.row}>
                <View>
                  <Text style={Typography.body}>{quote.customer}</Text>
                  <Text style={Typography.muted}>{quote.job}</Text>
                </View>
                <Text style={Typography.body}>{quote.amount}</Text>
              </Pressable>
            </Link>
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
    gap: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});

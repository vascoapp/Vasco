import { Link, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { Screen } from '../../src/components/Screen';
import { Colors } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';
import { Typography } from '../../src/theme/typography';
import { useAppState } from '../../src/state/AppState';

const formatCurrency = (amount: number) =>
  `€${amount.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}`;

export default function InvoicesScreen() {
  const router = useRouter();
  const { invoices } = useAppState();

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.sectionLabel}>Invoices</Text>
            <Text style={Typography.title}>Outstanding</Text>
          </View>
          <PrimaryButton label="Create invoice" onPress={() => router.push('/invoices/new')} />
        </View>

        <View style={styles.section}>
          {invoices.map((invoice) => (
            <Link key={invoice.id} href={`/invoices/${invoice.id}`} asChild>
              <Pressable style={styles.row}>
                <View>
                  <Text style={Typography.body}>{invoice.customer}</Text>
                  <Text style={Typography.muted}>{invoice.id} · {invoice.job}</Text>
                </View>
                <View style={styles.amountBlock}>
                  <Text style={Typography.body}>{formatCurrency(invoice.amount)}</Text>
                  <Text style={Typography.muted}>{invoice.status}</Text>
                </View>
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
    gap: Spacing.sm,
  },
  sectionLabel: {
    color: Colors.muted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: Spacing.xs,
    fontFamily: 'Inter_500Medium',
  },
  section: {
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
  amountBlock: {
    alignItems: 'flex-end',
  },
});

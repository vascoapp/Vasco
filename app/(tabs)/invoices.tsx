import { Link, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { Screen } from '../../src/components/Screen';
import { Colors } from '../../src/theme/colors';
import { Radius } from '../../src/theme/radius';
import { Spacing } from '../../src/theme/spacing';
import { Typography } from '../../src/theme/typography';
import { useAppState } from '../../src/state/AppState';
import { hapticSuccess } from '../../src/utils/haptics';

const formatCurrency = (amount: number) =>
  `€${amount.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}`;

export default function InvoicesScreen() {
  const router = useRouter();
  const { invoices, removeInvoice } = useAppState();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      hapticSuccess();
    }, 600);
  }, []);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accentDeep} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.sectionLabel}>Invoices</Text>
            <Text style={Typography.title}>Outstanding</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.refreshButton} onPress={onRefresh}>
              <Text style={styles.refreshText}>Refresh</Text>
            </Pressable>
            <PrimaryButton label="Create invoice" onPress={() => router.push('/invoices/new')} />
          </View>
        </View>

        <View style={styles.section}>
          {invoices.map((invoice) => (
            <Swipeable
              key={invoice.id}
              renderRightActions={() => (
                <Pressable style={styles.swipeAction} onPress={() => removeInvoice(invoice.id)}>
                  <Text style={styles.swipeActionText}>Delete</Text>
                </Pressable>
              )}
            >
              <View style={styles.row}>
                <Link href={`/invoices/${invoice.id}`} asChild>
                  <Pressable style={styles.rowContent}>
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
                <Pressable style={styles.deleteButton} onPress={() => removeInvoice(invoice.id)}>
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
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshText: {
    color: Colors.accentDeep,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
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
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.sm,
  },
  rowContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountBlock: {
    alignItems: 'flex-end',
  },
  deleteButton: {
    backgroundColor: Colors.danger,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radius.sm,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    color: Colors.text,
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  swipeAction: {
    backgroundColor: Colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginVertical: Spacing.xs,
    borderRadius: Radius.md,
    minWidth: 72,
    minHeight: 44,
  },
  swipeActionText: {
    color: Colors.text,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
});

import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { Screen } from '../../../src/components/Screen';
import { Colors } from '../../../src/theme/colors';
import { Radius } from '../../../src/theme/radius';
import { Spacing } from '../../../src/theme/spacing';
import { Typography } from '../../../src/theme/typography';
import { useAppState } from '../../../src/state/AppState';

export default function InvoiceFromQuoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { markInvoiceSent } = useAppState();

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={Typography.title}>Invoice from {id}</Text>
          <Text style={Typography.muted}>Auto-numbered · Due in 14 days</Text>
        </View>

        <View style={styles.card}>
          <Text style={Typography.subtitle}>Invoice summary</Text>
          <View style={styles.row}>
            <Text style={Typography.body}>Invoice #1044</Text>
            <Text style={Typography.body}>€1,120</Text>
          </View>
          <Text style={Typography.muted}>
            Matches quote language to reduce payment disputes.
          </Text>
        </View>

        <View style={styles.actions}>
          <PrimaryButton label="Generate PDF" onPress={() => router.push('/(modals)/pdf?source=invoice')} />
          <PrimaryButton label="Share invoice" onPress={() => markInvoiceSent('i-1044')} />
          <PrimaryButton label="Mark sent" onPress={() => markInvoiceSent('i-1044')} />
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
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingVertical: Spacing.xs,
  },
  actions: {
    gap: Spacing.sm,
  },
});

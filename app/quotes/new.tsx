import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AssistBanner } from '../../src/components/AssistBanner';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { Screen } from '../../src/components/Screen';
import { Colors } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';
import { Typography } from '../../src/theme/typography';

export default function NewQuoteScreen() {
  const router = useRouter();

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={Typography.title}>New draft quote</Text>
          <Text style={Typography.muted}>Painter job · Draft-first</Text>
        </View>

        <View style={styles.card}>
          <Text style={Typography.subtitle}>Customer</Text>
          <View style={styles.field}>
            <Text style={Typography.muted}>Name</Text>
            <Text style={Typography.body}>Select customer</Text>
          </View>
          <View style={styles.field}>
            <Text style={Typography.muted}>Job type</Text>
            <Text style={Typography.body}>Exterior repaint</Text>
          </View>
        </View>

        <AssistBanner
          title="Draft first, decide later"
          description="Save time by creating a draft now. We will suggest missing items."
          actionLabel="Save draft"
          meta="1 min"
        />

        <View style={styles.card}>
          <Text style={Typography.subtitle}>Scope</Text>
          <Text style={Typography.muted}>
            Add scope items. Vasco will suggest missing prep steps.
          </Text>
          <PrimaryButton label="Add line items" />
        </View>

        <View style={styles.actions}>
          <PrimaryButton label="Save draft" />
          <PrimaryButton label="Generate PDF" onPress={() => router.push('/(modals)/pdf?source=quote')} />
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
  field: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actions: {
    gap: Spacing.sm,
  },
});

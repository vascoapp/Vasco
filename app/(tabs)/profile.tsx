import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { Screen } from '../../src/components/Screen';
import { Colors } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';
import { Typography } from '../../src/theme/typography';

export default function ProfileScreen() {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={Typography.title}>Business profile</Text>

        <View style={styles.card}>
          <Text style={Typography.subtitle}>Profile completeness</Text>
          <Text style={Typography.muted}>60% complete · Missing key details</Text>

          <View style={styles.field}>
            <Text style={Typography.muted}>Business name</Text>
            <Text style={Typography.body}>—</Text>
          </View>
          <View style={styles.field}>
            <Text style={Typography.muted}>KVK number</Text>
            <Text style={Typography.body}>—</Text>
          </View>
          <View style={styles.field}>
            <Text style={Typography.muted}>VAT number</Text>
            <Text style={Typography.body}>—</Text>
          </View>

          <PrimaryButton label="Complete profile" />
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
});

import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { Screen } from '../../src/components/Screen';
import { SemanticColors } from '../../src/theme/colors';
import { Radius } from '../../src/theme/radius';
import { Spacing } from '../../src/theme/spacing';
import { Typography } from '../../src/theme/typography';

export default function PdfPlaceholderModal() {
  const { source } = useLocalSearchParams<{ source?: string }>();
  const label = source === 'invoice' ? 'Invoice' : 'Quote';

  return (
    <Screen backgroundColor={SemanticColors.surfacePrimary}>
      <View style={styles.container}>
        <Text style={Typography.title}>Generate PDF</Text>
        <Text style={Typography.muted}>
          {label} PDF generation will be added here. This placeholder confirms the flow.
        </Text>
        <View style={styles.card}>
          <Text style={Typography.subtitle}>What happens next</Text>
          <Text style={Typography.muted}>
            We will render a branded PDF and open the share sheet.
          </Text>
        </View>
        <PrimaryButton label="Done" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  card: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
});

import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';

type KpiChipProps = {
  label: string;
  value: string;
};

export function KpiChip({ label, value }: KpiChipProps) {
  return (
    <View style={styles.chip}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 14,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 88,
    flexShrink: 1,
  },
  value: {
    ...Typography.subtitle,
    fontSize: 16,
  },
  label: {
    ...Typography.muted,
    fontSize: 12,
    marginTop: 2,
  },
});

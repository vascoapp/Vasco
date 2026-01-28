import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { Colors } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';
import { Typography } from '../../src/theme/typography';
import { useAppState } from '../../src/state/AppState';

export default function MollieConnectModal() {
  const { connectMollie, mollieConnected } = useAppState();

  return (
    <Screen backgroundColor={Colors.surface}>
      <View style={styles.container}>
        <Text style={Typography.title}>Connect Mollie</Text>
        <Text style={Typography.muted}>
          Enable iDEAL payment links on invoices.
        </Text>

        <View style={styles.card}>
          <Text style={Typography.subtitle}>What gets enabled</Text>
          <Text style={Typography.muted}>
            Payment links for invoices. Clients can pay with iDEAL.
          </Text>
        </View>

        <PrimaryButton
          label={mollieConnected ? 'Connected' : 'Connect Mollie'}
          onPress={connectMollie}
        />
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
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 16,
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});

import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { Colors } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';
import { Typography } from '../../src/theme/typography';
import { useAppState } from '../../src/state/AppState';

export default function MoneybirdConnectModal() {
  const { connectMoneybird, moneybirdConnected } = useAppState();

  return (
    <Screen backgroundColor={Colors.surface}>
      <View style={styles.container}>
        <Text style={Typography.title}>Connect Moneybird</Text>
        <Text style={Typography.muted}>
          Connect your Moneybird account to export invoices with one tap.
        </Text>

        <View style={styles.card}>
          <Text style={Typography.subtitle}>What gets synced</Text>
          <Text style={Typography.muted}>
            Customer, invoice totals, and line items. No payments yet.
          </Text>
        </View>

        <PrimaryButton
          label={moneybirdConnected ? 'Connected' : 'Connect Moneybird'}
          onPress={connectMoneybird}
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

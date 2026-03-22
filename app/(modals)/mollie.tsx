import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';
import { useAppState } from '../../src/state/AppState';
import { saveMollieConfig, isConnected as checkMollieConnected, listPayments } from '../../src/integrations/mollie';
import { hapticSuccess } from '../../src/utils/haptics';

export default function MollieConnectModal() {
  const { connectMollie, mollieConnected } = useAppState();
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const handleTest = async () => {
    if (!apiKey.startsWith('live_') && !apiKey.startsWith('test_')) {
      Alert.alert('Ongeldige sleutel', 'Mollie API keys beginnen met "live_" of "test_"');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      await saveMollieConfig({ apiKey });
      // Test the connection by listing payments
      const payments = await listPayments(1);
      // If we get here without error, connection works
      setTestResult('success');
      connectMollie();
      hapticSuccess();
    } catch {
      setTestResult('error');
    } finally {
      setTesting(false);
    }
  };

  const paymentMethods = [
    { name: 'iDEAL', icon: 'card-outline' },
    { name: 'Bancontact', icon: 'card-outline' },
    { name: 'Credit Card', icon: 'card-outline' },
    { name: 'SEPA', icon: 'swap-horizontal-outline' },
    { name: 'Klarna', icon: 'pricetag-outline' },
    { name: 'Apple Pay', icon: 'logo-apple' },
  ];

  return (
    <Screen backgroundColor={SemanticColors.surfacePrimary}>
      <View style={styles.container}>
        <Text style={styles.title}>Mollie Betalingen</Text>
        <Text style={styles.subtitle}>
          Ontvang betalingen via iDEAL, creditcard en meer
        </Text>

        {/* API Key Input */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>API Sleutel</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="live_xxxx of test_xxxx"
              placeholderTextColor={SemanticColors.textTertiary}
              value={apiKey}
              onChangeText={setApiKey}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={apiKey.length > 10}
            />
            {testResult === 'success' && (
              <Ionicons name="checkmark-circle" size={22} color={SemanticColors.feedbackSuccess} />
            )}
          </View>
          <Text style={styles.hint}>
            Vind je API key in Mollie Dashboard → Developers → API keys
          </Text>
        </View>

        {/* Test + Connect Button */}
        <Pressable
          style={[styles.connectBtn, mollieConnected && styles.connectedBtn]}
          onPress={handleTest}
          disabled={testing || apiKey.length < 5}
        >
          {testing ? (
            <Text style={styles.connectBtnText}>Verbinden...</Text>
          ) : mollieConnected ? (
            <>
              <Ionicons name="checkmark-circle" size={18} color={SemanticColors.feedbackSuccess} />
              <Text style={[styles.connectBtnText, { color: SemanticColors.feedbackSuccess }]}>Verbonden</Text>
            </>
          ) : (
            <Text style={styles.connectBtnText}>Verbinden & Testen</Text>
          )}
        </Pressable>

        {testResult === 'error' && (
          <Text style={styles.errorText}>Verbinding mislukt — controleer je API sleutel</Text>
        )}

        {/* Payment Methods */}
        <View style={styles.methodsSection}>
          <Text style={styles.label}>Betaalmethoden</Text>
          <View style={styles.methodsGrid}>
            {paymentMethods.map((m) => (
              <View key={m.name} style={styles.methodChip}>
                <Ionicons name={m.icon as any} size={14} color={mollieConnected ? Palette.hermesOrange : SemanticColors.textTertiary} />
                <Text style={[styles.methodText, mollieConnected && { color: SemanticColors.textPrimary }]}>{m.name}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.lg, gap: Spacing.md },
  title: { fontSize: 22, fontFamily: 'Manrope_700Bold', color: SemanticColors.textPrimary },
  subtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', color: SemanticColors.textSecondary },
  inputSection: { gap: 6 },
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: SemanticColors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1, backgroundColor: SemanticColors.surfaceBackground, borderRadius: 10,
    padding: 14, fontSize: 15, fontFamily: 'Inter_400Regular', color: SemanticColors.textPrimary,
    borderWidth: 1, borderColor: SemanticColors.borderDefault,
  },
  hint: { fontSize: 12, fontFamily: 'Inter_400Regular', color: SemanticColors.textTertiary },
  connectBtn: {
    backgroundColor: Palette.hermesOrange, borderRadius: 12, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  connectedBtn: { backgroundColor: SemanticColors.feedbackSuccess + '15' },
  connectBtnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  errorText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: SemanticColors.feedbackError, textAlign: 'center' },
  methodsSection: { gap: 8 },
  methodsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: SemanticColors.surfaceBackground, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  methodText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: SemanticColors.textTertiary },
});

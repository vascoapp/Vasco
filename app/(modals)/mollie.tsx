import { useState, useEffect } from 'react';
import { StyleSheet, Text, TextInput, View, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';
import { useAppState } from '../../src/state/AppState';
import { saveMollieConfig, isConnected as checkMollieConnected, listPayments } from '../../src/integrations/mollie';
import { hapticSuccess } from '../../src/utils/haptics';
import { useAuth } from '../../src/context/AuthContext';
import { getPaymentDisplayForCountry, getPaymentBrandColor } from '../../src/config/paymentMethods';
import { consentService } from '../../src/services/consentService';

export default function MollieConnectModal() {
  const { connectMollie, mollieConnected } = useAppState();
  const { user } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  // Country-specific payment methods
  const paymentMethods = getPaymentDisplayForCountry(user?.country);

  const handleTest = async () => {
    if (!apiKey.startsWith('live_') && !apiKey.startsWith('test_')) {
      Alert.alert('Ongeldige sleutel', 'Mollie API keys beginnen met "live_" of "test_"');
      return;
    }

    // Check consent before connecting
    const hasConsent = await consentService.getConsent('mollie');
    if (!hasConsent) {
      Alert.alert(
        'Toestemming vereist',
        'Vasco verwerkt betalingsgegevens via Mollie. Door te verbinden ga je akkoord met het delen van factuurgegevens met Mollie voor betalingsverwerking.',
        [
          { text: 'Annuleren', style: 'cancel' },
          {
            text: 'Akkoord & Verbinden',
            onPress: async () => {
              await consentService.setConsent('mollie', true);
              await consentService.setConsent('dataProcessing', true);
              performConnection();
            },
          },
        ],
      );
      return;
    }

    performConnection();
  };

  const performConnection = async () => {

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
            {paymentMethods.map((m) => {
              const brandColor = getPaymentBrandColor(m.name);
              const isActive = mollieConnected;
              return (
                <View
                  key={m.name}
                  style={[
                    styles.methodChip,
                    isActive && { borderColor: brandColor + '25', borderWidth: 1 },
                  ]}
                  accessibilityLabel={`${m.name} payment method${isActive ? ', active' : ''}`}
                >
                  <View style={[styles.methodDot, { backgroundColor: isActive ? brandColor : SemanticColors.textTertiary }]} />
                  <Text style={[styles.methodText, isActive && { color: SemanticColors.textPrimary }]}>{m.name}</Text>
                </View>
              );
            })}
          </View>
          {mollieConnected && (
            <View style={styles.securityFooter}>
              <Ionicons name="shield-checkmark" size={14} color={SemanticColors.feedbackSuccess} />
              <Text style={styles.securityFooterText}>All payments are PCI DSS compliant via Mollie</Text>
            </View>
          )}
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
  methodsSection: { gap: 10 },
  methodsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: SemanticColors.surfaceBackground, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: SemanticColors.borderDefault,
  },
  methodDot: {
    width: 8, height: 8, borderRadius: 4,
  },
  methodText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: SemanticColors.textTertiary },
  securityFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingTop: 8,
  },
  securityFooterText: {
    fontSize: 11, fontFamily: 'Inter_400Regular', color: SemanticColors.textTertiary,
  },
});

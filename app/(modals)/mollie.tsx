import { useState, useEffect } from 'react';
import { StyleSheet, Text, TextInput, View, Pressable, Alert, Linking, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '../../src/components/Screen';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';
import { useAppState } from '../../src/state/AppState';
import { saveMollieConfig, isConnected as checkMollieConnected, listPayments } from '../../src/integrations/mollie';
import { hapticSuccess } from '../../src/utils/haptics';
import { useAuth } from '../../src/context/AuthContext';
import { getPaymentDisplayForCountry, getPaymentBrandColor, paymentMethodLabel } from '../../src/config/paymentMethods';
import { consentService } from '../../src/services/consentService';
import { useTranslation } from 'react-i18next';
import { DKScreenHeader } from '../../src/components/shared/DKScreenHeader';

// Where Mollie shows the code to copy. Mollie asks for a login first and then
// lands on this page.
const MOLLIE_KEYS_URL = 'https://my.mollie.com/dashboard/developers/api-keys';

export default function MollieConnectModal() {
  const { connectMollie, disconnectMollie, mollieConnected, businessProfile } = useAppState();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  // Country-specific payment methods — the profile's country first (#218).
  const paymentMethods = getPaymentDisplayForCountry(businessProfile?.country ?? user?.country);

  const handleTest = async () => {
    const key = apiKey.trim();
    if (!key.startsWith('live_') && !key.startsWith('test_')) {
      Alert.alert(
        t('mollie.invalidKeyTitle', 'Invalid key'),
        t('mollie.invalidKeyDesc', 'Mollie API keys start with "live_" or "test_"'),
      );
      return;
    }

    // Check consent before connecting
    const hasConsent = await consentService.getConsent('mollie');
    if (!hasConsent) {
      Alert.alert(
        t('mollie.consentTitle', 'Consent required'),
        t('mollie.consentDesc', 'Vasco processes payment data via Mollie. By connecting you agree to share invoice data with Mollie for payment processing.'),
        [
          { text: t('common.cancel', 'Cancel'), style: 'cancel' },
          {
            text: t('mollie.consentAccept', 'Agree & connect'),
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

  const handleDisconnect = () => {
    Alert.alert(
      t('mollie.disconnectConfirmTitle', 'Disconnect Mollie?'),
      t('mollie.disconnectConfirmDesc', 'Your API key will be removed from this device. Existing payment links continue to work, but you won’t be able to create new ones until you reconnect.'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('mollie.disconnect', 'Disconnect'),
          style: 'destructive',
          onPress: async () => {
            await disconnectMollie();
            setApiKey('');
            setTestResult(null);
          },
        },
      ],
    );
  };

  const performConnection = async () => {

    setTesting(true);
    setTestResult(null);

    try {
      await saveMollieConfig({ apiKey: apiKey.trim() });
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
      {/* Reached by router.push from the invoice and quote screens, on a
          stack with headerShown:false — so this screen opened with no back
          control of any kind. The title moves here from the body. */}
      <DKScreenHeader title={t('mollie.title', 'Mollie Payments')} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>
          {t('mollie.subtitle', 'Receive payments via iDEAL, credit card and more')}
        </Text>

        {/* Written for a builder, not a developer (user, emulator walk
            2026-09-28: "highly technical for a construction worker"). It said
            "API-SLEUTEL · live_xxxx of test_xxxx · Mollie Dashboard →
            Developers → API keys". The real fix is "Verbind met Mollie"
            (Mollie Connect) — planned; until then three plain steps and a
            button that opens the right Mollie page.
            The "Vasco rekent 3.5% commissie" notice is GONE: Vasco charges
            nothing here (the contractor's own Mollie account; money never
            touches Vasco) and the tier commission must not ship —
            memory/payments-monetization-2026-08.md. */}
        {!mollieConnected && (
          <View style={styles.steps} testID="mollie-steps">
            <Text style={styles.stepsTitle}>{t('mollie.stepsTitle', 'Connect Mollie in 3 steps')}</Text>
            {[
              t('mollie.step1', 'Open Mollie and log in. No account yet? You can create one for free there.'),
              t('mollie.step2', 'Copy the code that starts with live_'),
              t('mollie.step3', 'Come back, hold your finger in the box below, tap Paste — then Connect.'),
            ].map((text, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
                <Text style={styles.stepText}>{text}</Text>
              </View>
            ))}
            <Pressable
              style={styles.openMollieBtn}
              onPress={() => Linking.openURL(MOLLIE_KEYS_URL)}
              accessibilityRole="link"
              testID="mollie-open"
            >
              <Ionicons name="open-outline" size={16} color={Palette.hermesOrange} />
              <Text style={styles.openMollieText}>{t('mollie.openMollie', 'Open Mollie')}</Text>
            </Pressable>
          </View>
        )}

        {/* The code */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>{t('mollie.codeLabel', 'Your Mollie code')}</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder={t('mollie.codePlaceholder', 'Paste your code here')}
              placeholderTextColor={SemanticColors.placeholder}
              value={apiKey}
              onChangeText={setApiKey}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={apiKey.length > 10}
              testID="mollie-code"
            />
            {testResult === 'success' && (
              <Ionicons name="checkmark-circle" size={22} color={SemanticColors.feedbackSuccess} />
            )}
          </View>
        </View>

        {/* Connect */}
        <Pressable
          style={[styles.connectBtn, mollieConnected && styles.connectedBtn]}
          onPress={handleTest}
          disabled={testing || apiKey.trim().length < 5}
        >
          {testing ? (
            <Text style={styles.connectBtnText}>{t('mollie.connecting', 'Connecting…')}</Text>
          ) : mollieConnected ? (
            <>
              <Ionicons name="checkmark-circle" size={18} color={SemanticColors.feedbackSuccess} />
              <Text style={[styles.connectBtnText, { color: SemanticColors.feedbackSuccess }]}>{t('mollie.connected', 'Connected')}</Text>
            </>
          ) : (
            <Text style={styles.connectBtnText}>{t('mollie.connect', 'Connect')}</Text>
          )}
        </Pressable>

        {testResult === 'error' && (
          <Text style={styles.errorText}>{t('mollie.connectionFailed', 'Connection failed — check your API key')}</Text>
        )}

        {mollieConnected && (
          <Pressable style={styles.disconnectBtn} onPress={handleDisconnect}>
            <Ionicons name="log-out-outline" size={16} color={SemanticColors.feedbackError} />
            <Text style={styles.disconnectBtnText}>{t('mollie.disconnect', 'Disconnect')}</Text>
          </Pressable>
        )}

        {/* Payment Methods */}
        <View style={styles.methodsSection}>
          <Text style={styles.label}>{t('mollie.paymentMethods', 'Payment methods')}</Text>
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
                  accessibilityLabel={isActive
                    ? t('payments.methodA11yActive', { defaultValue: '{{name}} payment method, active', name: paymentMethodLabel(m.name, t) })
                    : t('payments.methodA11y', { defaultValue: '{{name}} payment method', name: paymentMethodLabel(m.name, t) })}
                >
                  <View style={[styles.methodDot, { backgroundColor: isActive ? brandColor : SemanticColors.textTertiary }]} />
                  <Text style={[styles.methodText, isActive && { color: SemanticColors.textPrimary }]}>{paymentMethodLabel(m.name, t)}</Text>
                </View>
              );
            })}
          </View>
          {mollieConnected && (
            <View style={styles.securityFooter}>
              <Ionicons name="shield-checkmark" size={14} color={SemanticColors.feedbackSuccess} />
              <Text style={styles.securityFooterText}>{t('mollie.pciCompliance', 'All payments are PCI DSS compliant via Mollie')}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xl * 2 },
  steps: {
    gap: 10, padding: 14, borderRadius: 12,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderWidth: 1, borderColor: SemanticColors.borderDefault,
  },
  stepsTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: SemanticColors.textPrimary },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepNum: {
    width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Palette.hermesOrange + '22',
  },
  stepNumText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: Palette.hermesOrange },
  stepText: { flex: 1, fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular', color: SemanticColors.textPrimary },
  openMollieBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: Palette.hermesOrange, borderRadius: 10, paddingVertical: 10, marginTop: 2,
  },
  openMollieText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Palette.hermesOrange },
  title: { fontSize: 22, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textPrimary },
  subtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', color: SemanticColors.textSecondary },
  inputSection: { gap: 6 },
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: SemanticColors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1, backgroundColor: SemanticColors.surfaceBackground, borderRadius: 10,
    padding: 14, fontSize: 15, fontFamily: 'Inter_400Regular', color: SemanticColors.textPrimary,
    borderWidth: 1, borderColor: SemanticColors.borderDefault,
  },
  connectBtn: {
    backgroundColor: Palette.hermesOrange, borderRadius: 12, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  connectedBtn: { backgroundColor: SemanticColors.feedbackSuccess + '15' },
  connectBtnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  disconnectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: 'transparent', borderWidth: 1,
    borderColor: SemanticColors.feedbackError + '40',
    borderRadius: 10, paddingVertical: 10, marginTop: -4,
  },
  disconnectBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: SemanticColors.feedbackError },
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

import { useState, useEffect } from 'react';
import { StyleSheet, Text, TextInput, View, Pressable, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '../../src/components/Screen';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';
import { useAppState } from '../../src/state/AppState';
import { saveMollieConfig, isConnected as checkMollieConnected, listPayments } from '../../src/integrations/mollie';
import { hapticSuccess } from '../../src/utils/haptics';
import { useAuth } from '../../src/context/AuthContext';
import { getPaymentDisplayForCountry, getPaymentBrandColor } from '../../src/config/paymentMethods';
import { consentService } from '../../src/services/consentService';
import { VASCO_FEE_DISCLOSURE } from '../../src/services/paymentMarginService';
import i18n from '../../src/i18n/i18n';
import { useTranslation } from 'react-i18next';

type LocaleKey = keyof typeof VASCO_FEE_DISCLOSURE;
function feeDisclosureForLocale(): string {
  const lang = (i18n.language ?? 'en').slice(0, 2).toLowerCase();
  const valid: LocaleKey[] = ['en', 'nl', 'de', 'fr', 'es', 'it'];
  return VASCO_FEE_DISCLOSURE[(valid.includes(lang as LocaleKey) ? lang : 'en') as LocaleKey];
}

export default function MollieConnectModal() {
  const { connectMollie, disconnectMollie, mollieConnected } = useAppState();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  // Country-specific payment methods
  const paymentMethods = getPaymentDisplayForCountry(user?.country);

  const handleTest = async () => {
    if (!apiKey.startsWith('live_') && !apiKey.startsWith('test_')) {
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
        <Text style={styles.title}>{t('mollie.title', 'Mollie Payments')}</Text>
        <Text style={styles.subtitle}>
          {t('mollie.subtitle', 'Receive payments via iDEAL, credit card and more')}
        </Text>

        {/* R66r49 #14: Vasco platform-fee disclosure (1% on payments
            received). Required to surface in plain language wherever the
            contractor connects a payment provider. The fee itself is not
            yet collected — Stripe Connect / Mollie partner setup needed
            before paymentMarginService.application_fee flows. Disclosure
            ships now so when the back-end flips on, contractors aren't
            surprised. */}
        <View style={styles.feeNotice}>
          <Ionicons name="information-circle-outline" size={16} color={SemanticColors.textTertiary} />
          <Text style={styles.feeNoticeText}>{feeDisclosureForLocale()}</Text>
        </View>

        {/* API Key Input */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>{t('mollie.apiKeyLabel', 'API key')}</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder={t('mollie.apiKeyPlaceholder', 'live_xxxx or test_xxxx')}
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
            {t('mollie.apiKeyHint', 'Find your API key in Mollie Dashboard → Developers → API keys')}
          </Text>
        </View>

        {/* Test + Connect Button */}
        <Pressable
          style={[styles.connectBtn, mollieConnected && styles.connectedBtn]}
          onPress={handleTest}
          disabled={testing || apiKey.length < 5}
        >
          {testing ? (
            <Text style={styles.connectBtnText}>{t('mollie.connecting', 'Connecting…')}</Text>
          ) : mollieConnected ? (
            <>
              <Ionicons name="checkmark-circle" size={18} color={SemanticColors.feedbackSuccess} />
              <Text style={[styles.connectBtnText, { color: SemanticColors.feedbackSuccess }]}>{t('mollie.connected', 'Connected')}</Text>
            </>
          ) : (
            <Text style={styles.connectBtnText}>{t('mollie.connectAndTest', 'Connect & test')}</Text>
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
              <Text style={styles.securityFooterText}>{t('mollie.pciCompliance', 'All payments are PCI DSS compliant via Mollie')}</Text>
            </View>
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.lg, gap: Spacing.md },
  title: { fontSize: 22, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textPrimary },
  subtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', color: SemanticColors.textSecondary },
  feeNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  feeNoticeText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: SemanticColors.textSecondary,
    lineHeight: 16,
  },
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

import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';
import { useAppState } from '../../src/state/AppState';
import { saveStripeConfig, isConnected as checkStripeConnected } from '../../src/integrations/stripe';
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

export default function StripeConnectModal() {
  const { connectStripe, stripeConnected } = useAppState();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  // Country-specific payment methods. Defaults to UK for this modal but
  // respects the user's actual country (Stripe is multi-country).
  const paymentMethods = getPaymentDisplayForCountry(user?.country ?? 'UK');

  const handleTest = async () => {
    if (!apiKey.startsWith('sk_live_') && !apiKey.startsWith('sk_test_')) {
      Alert.alert(
        t('stripe.invalidKeyTitle', 'Invalid key'),
        t('stripe.invalidKeyDesc', 'Stripe secret keys start with "sk_live_" or "sk_test_"'),
      );
      return;
    }

    const hasConsent = await consentService.getConsent('stripe');
    if (!hasConsent) {
      Alert.alert(
        t('stripe.consentTitle', 'Consent required'),
        t('stripe.consentDesc', 'Vasco processes payment data via Stripe. By connecting you agree to share invoice data with Stripe for payment processing.'),
        [
          { text: t('common.cancel', 'Cancel'), style: 'cancel' },
          {
            text: t('stripe.consentAccept', 'Agree & connect'),
            onPress: async () => {
              await consentService.setConsent('stripe', true);
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
      await saveStripeConfig({ apiKey });
      // Verify connection by hitting Stripe — isConnected() roundtrips the
      // key against /v1/balance which fails fast on an invalid key.
      const connected = await checkStripeConnected();
      if (!connected) {
        setTestResult('error');
        return;
      }
      setTestResult('success');
      connectStripe();
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
        <Text style={styles.title}>{t('stripe.title', 'Stripe Payments')}</Text>
        <Text style={styles.subtitle}>
          {t('stripe.subtitle', 'Receive payments via card, Apple Pay, Google Pay and more')}
        </Text>

        {/* R66r54: Vasco platform-fee disclosure mirrors the Mollie modal.
            1% on payments received. Required to surface in plain language
            wherever the contractor connects a payment provider. */}
        <View style={styles.feeNotice}>
          <Ionicons name="information-circle-outline" size={16} color={SemanticColors.textTertiary} />
          <Text style={styles.feeNoticeText}>{feeDisclosureForLocale()}</Text>
        </View>

        {/* API Key Input */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>{t('stripe.apiKeyLabel', 'Secret key')}</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder={t('stripe.apiKeyPlaceholder', 'sk_live_xxxx or sk_test_xxxx')}
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
            {t('stripe.apiKeyHint', 'Find your secret key in Stripe Dashboard → Developers → API keys')}
          </Text>
        </View>

        {/* Test + Connect Button */}
        <Pressable
          style={[styles.connectBtn, stripeConnected && styles.connectedBtn]}
          onPress={handleTest}
          disabled={testing || apiKey.length < 10}
        >
          {testing ? (
            <Text style={styles.connectBtnText}>{t('stripe.connecting', 'Connecting…')}</Text>
          ) : stripeConnected ? (
            <>
              <Ionicons name="checkmark-circle" size={18} color={SemanticColors.feedbackSuccess} />
              <Text style={[styles.connectBtnText, { color: SemanticColors.feedbackSuccess }]}>{t('stripe.connected', 'Connected')}</Text>
            </>
          ) : (
            <Text style={styles.connectBtnText}>{t('stripe.connectAndTest', 'Connect & test')}</Text>
          )}
        </Pressable>

        {testResult === 'error' && (
          <Text style={styles.errorText}>{t('stripe.connectionFailed', 'Connection failed — check your secret key')}</Text>
        )}

        {/* Payment Methods */}
        <View style={styles.methodsSection}>
          <Text style={styles.label}>{t('stripe.paymentMethods', 'Payment methods')}</Text>
          <View style={styles.methodsGrid}>
            {paymentMethods.map((m) => {
              const brandColor = getPaymentBrandColor(m.name);
              const isActive = stripeConnected;
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
          {stripeConnected && (
            <View style={styles.securityFooter}>
              <Ionicons name="shield-checkmark" size={14} color={SemanticColors.feedbackSuccess} />
              <Text style={styles.securityFooterText}>{t('stripe.pciCompliance', 'All payments are PCI DSS compliant via Stripe')}</Text>
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

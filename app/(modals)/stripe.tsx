import { useEffect, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { StyleSheet, Text, TextInput, View, Pressable, Alert, Linking, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '../../src/components/Screen';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';
import { useAppState } from '../../src/state/AppState';
import { saveStripeConfig, validateConnection as validateStripeConnection } from '../../src/integrations/stripe';
import { hapticSuccess } from '../../src/utils/haptics';
import { useAuth } from '../../src/context/AuthContext';
import { getPaymentDisplayForCountry, getPaymentBrandColor, paymentMethodLabel } from '../../src/config/paymentMethods';
import { consentService } from '../../src/services/consentService';
import { useTranslation } from 'react-i18next';
import { DKScreenHeader } from '../../src/components/shared/DKScreenHeader';
import { getConnectStatus, startConnect, type ConnectStatus } from '../../src/integrations/stripeConnect';
import { clearStripeConfig } from '../../src/integrations/stripe';

/** Where stripe-connect-callback sends the browser back (closes the in-app browser). */
const CONNECT_RETURN = 'vasco://stripe-connected';

// Where Stripe shows the key to copy (after logging in).
const STRIPE_KEYS_URL = 'https://dashboard.stripe.com/apikeys';

export default function StripeConnectModal() {
  const { connectStripe, disconnectStripe, stripeConnected, businessProfile } = useAppState();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  // Stripe Connect (decision 2a): when the server has it set up, the contractor
  // signs in at Stripe instead of pasting a secret key. Until then the key form
  // below stays — a UK contractor's only payment provider is Stripe.
  const [connect, setConnect] = useState<ConnectStatus | null>(null);
  const [connectBusy, setConnectBusy] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getConnectStatus({ force: true }).then((st) => { if (alive) setConnect(st); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // Country-specific payment methods. Defaults to UK for this modal but
  // respects the user's actual country (Stripe is multi-country).
  const paymentMethods = getPaymentDisplayForCountry(businessProfile?.country ?? user?.country ?? 'UK');

  const handleTest = async () => {
    const key = apiKey.trim();
    if (!key.startsWith('sk_live_') && !key.startsWith('sk_test_')) {
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

  const handleDisconnect = () => {
    Alert.alert(
      t('stripe.disconnectConfirmTitle', 'Disconnect Stripe?'),
      t('stripe.disconnectConfirmDesc', 'Your secret key will be removed from this device. Existing payment links continue to work, but you won’t be able to create new ones until you reconnect.'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('stripe.disconnect', 'Disconnect'),
          style: 'destructive',
          onPress: async () => {
            await disconnectStripe();
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
      await saveStripeConfig({ apiKey: apiKey.trim() });
      // R66r57: validateConnection() actually hits /v1/balance instead of
      // just checking SecureStore. Pre-r57 a typo'd sk_live_xxx would
      // show "Connected ✓" and fail at first payment-link mint.
      const ok = await validateStripeConnection();
      if (!ok) {
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

  const handleConnectWithStripe = async () => {
    // Same consent as the key form: asked, never assumed.
    if (!(await consentService.getConsent('stripe'))) {
      Alert.alert(
        t('stripe.consentTitle', 'Consent required'),
        t('stripe.consentDesc', 'Vasco processes payment data via Stripe. By connecting you agree to share invoice data with Stripe for payment processing.'),
        [
          { text: t('common.cancel', 'Cancel'), style: 'cancel' },
          { text: t('stripe.consentAccept', 'Agree & connect'), onPress: async () => {
            await consentService.setConsent('stripe', true);
            await consentService.setConsent('dataProcessing', true);
            void runConnect();
          } },
        ],
      );
      return;
    }
    void runConnect();
  };

  const runConnect = async () => {
    setConnectBusy(true);
    setConnectError(null);
    try {
      const url = await startConnect();
      if (!url) { setConnectError(t('stripe.connectUnavailable', 'Stripe could not be reached. Try again in a moment.')); return; }
      const result = await WebBrowser.openAuthSessionAsync(url, CONNECT_RETURN);
      // A fixed word from stripe-connect-callback. Regex, not URL(): RN's URL
      // polyfill does not implement searchParams on every version.
      const status = result.type === 'success' ? (/[?&]status=([a-z]+)/.exec(result.url)?.[1] ?? 'failed') : 'cancelled';
      // The server is the judge, not the redirect: ask it.
      const st = await getConnectStatus({ force: true });
      setConnect(st);
      if (st.connected) {
        // A key pasted earlier is no longer needed — remove it from the phone.
        await clearStripeConfig().catch(() => {});
        connectStripe();
        hapticSuccess();
      } else if (status === 'taken') {
        setConnectError(t('stripe.connectTaken', 'This Stripe account is already connected to another Vasco account.'));
      } else if (status !== 'cancelled') {
        setConnectError(t('stripe.connectFailed', 'Connecting did not work. Please try again.'));
      }
    } finally {
      setConnectBusy(false);
    }
  };

  const handleConnectDisconnect = () => {
    Alert.alert(
      t('stripe.disconnectConfirmTitle', 'Disconnect Stripe?'),
      t('stripe.connectDisconnectDesc', 'Vasco can no longer make payment links on your Stripe account. Links already sent keep working.'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        { text: t('stripe.disconnect', 'Disconnect'), style: 'destructive', onPress: async () => {
          await disconnectStripe();
          const st = await getConnectStatus({ force: true });
          setConnect(st);
          if (st.connected) setConnectError(t('stripe.disconnectFailed', 'Disconnecting did not work. Please try again.'));
        } },
      ],
    );
  };

  // Connect is set up on the server: no key form at all.
  if (connect?.configured) {
    return (
      <Screen backgroundColor={SemanticColors.surfacePrimary}>
        <DKScreenHeader title={t('stripe.title', 'Stripe Payments')} />
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.subtitle}>
            {t('stripe.subtitle', 'Receive payments via card, Apple Pay, Google Pay and more')}
          </Text>
          {connect.connected ? (
            <>
              <View style={[styles.connectBtn, styles.connectedBtn]} testID="stripe-connect-connected">
                <Ionicons name="checkmark-circle" size={18} color={SemanticColors.feedbackSuccess} />
                <Text style={[styles.connectBtnText, { color: SemanticColors.feedbackSuccess }]}>{t('stripe.connected', 'Connected')}</Text>
              </View>
              <Pressable style={styles.disconnectBtn} onPress={handleConnectDisconnect}>
                <Ionicons name="log-out-outline" size={16} color={SemanticColors.feedbackError} />
                <Text style={styles.disconnectBtnText}>{t('stripe.disconnect', 'Disconnect')}</Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.steps} testID="stripe-connect-steps">
              <Text style={styles.stepsTitle}>{t('stripe.connectStepsTitle', 'Connect Stripe')}</Text>
              {[
                t('stripe.connectStep1', 'Tap the button — Stripe opens. No account yet? You can create one there for free.'),
                t('stripe.connectStep2', 'Log in at Stripe and allow Vasco to create payment links for you.'),
                t('stripe.connectStep3', 'You come back here automatically. Vasco never sees your Stripe password or keys.'),
              ].map((text, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
                  <Text style={styles.stepText}>{text}</Text>
                </View>
              ))}
              <Pressable style={styles.connectBtn} onPress={handleConnectWithStripe} disabled={connectBusy} accessibilityRole="button" testID="stripe-connect-start">
                <Text style={styles.connectBtnText}>
                  {connectBusy ? t('stripe.connecting', 'Connecting…') : t('stripe.connectWithStripe', 'Connect with Stripe')}
                </Text>
              </Pressable>
            </View>
          )}
          {connectError && <Text style={styles.errorText}>{connectError}</Text>}
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor={SemanticColors.surfacePrimary}>
      {/* Back + title: this modal had no way out but the OS gesture. */}
      <DKScreenHeader title={t('stripe.title', 'Stripe Payments')} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>
          {t('stripe.subtitle', 'Receive payments via card, Apple Pay, Google Pay and more')}
        </Text>

        {/* Plain steps for a builder, the same as Mollie (emulator walk
            2026-09-28). The "Vasco charges x% commission" notice is gone:
            Vasco charges nothing here — memory/payments-monetization-2026-08.md. */}
        {!stripeConnected && (
          <View style={styles.steps} testID="stripe-steps">
            <Text style={styles.stepsTitle}>{t('stripe.stepsTitle', 'Connect Stripe in 3 steps')}</Text>
            {[
              t('stripe.step1', 'Open Stripe and log in. No account yet? You can create one for free there.'),
              t('stripe.step2', 'Copy the secret key — the code that starts with sk_live_'),
              t('stripe.step3', 'Come back, hold your finger in the box below, tap Paste — then Connect.'),
            ].map((text, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
                <Text style={styles.stepText}>{text}</Text>
              </View>
            ))}
            <Pressable style={styles.openBtn} onPress={() => Linking.openURL(STRIPE_KEYS_URL)} accessibilityRole="link" testID="stripe-open">
              <Ionicons name="open-outline" size={16} color={Palette.hermesOrange} />
              <Text style={styles.openText}>{t('stripe.openStripe', 'Open Stripe')}</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.inputSection}>
          <Text style={styles.label}>{t('stripe.codeLabel', 'Your Stripe key')}</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder={t('stripe.codePlaceholder', 'Paste your key here')}
              placeholderTextColor={SemanticColors.placeholder}
              value={apiKey}
              onChangeText={setApiKey}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={apiKey.length > 10}
              testID="stripe-code"
            />
            {testResult === 'success' && (
              <Ionicons name="checkmark-circle" size={22} color={SemanticColors.feedbackSuccess} />
            )}
          </View>
        </View>

        <Pressable
          style={[styles.connectBtn, stripeConnected && styles.connectedBtn]}
          onPress={handleTest}
          disabled={testing || apiKey.trim().length < 10}
        >
          {testing ? (
            <Text style={styles.connectBtnText}>{t('stripe.connecting', 'Connecting…')}</Text>
          ) : stripeConnected ? (
            <>
              <Ionicons name="checkmark-circle" size={18} color={SemanticColors.feedbackSuccess} />
              <Text style={[styles.connectBtnText, { color: SemanticColors.feedbackSuccess }]}>{t('stripe.connected', 'Connected')}</Text>
            </>
          ) : (
            <Text style={styles.connectBtnText}>{t('stripe.connect', 'Connect')}</Text>
          )}
        </Pressable>

        {testResult === 'error' && (
          <Text style={styles.errorText}>{t('stripe.connectionFailed', 'Connection failed — check your secret key')}</Text>
        )}

        {stripeConnected && (
          <Pressable style={styles.disconnectBtn} onPress={handleDisconnect}>
            <Ionicons name="log-out-outline" size={16} color={SemanticColors.feedbackError} />
            <Text style={styles.disconnectBtnText}>{t('stripe.disconnect', 'Disconnect')}</Text>
          </Pressable>
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
          {stripeConnected && (
            <View style={styles.securityFooter}>
              <Ionicons name="shield-checkmark" size={14} color={SemanticColors.feedbackSuccess} />
              <Text style={styles.securityFooterText}>{t('stripe.pciCompliance', 'All payments are PCI DSS compliant via Stripe')}</Text>
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
  openBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: Palette.hermesOrange, borderRadius: 10, paddingVertical: 10, marginTop: 2,
  },
  openText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Palette.hermesOrange },
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

// =============================================================================
// XERO AUTH — OAuth2 flow via expo-web-browser
// =============================================================================

import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { hapticSuccess } from '../../src/utils/haptics';
import {
  getXeroAuthUrl,
  exchangeCodeForToken,
  verifyXeroOAuthState,
  isConnected,
} from '../../src/integrations/xero';
import {
  saveAccountingConfig,
} from '../../src/integrations/accounting';
import { logWarn } from '../../src/utils/errorHandler';
import { consentService } from '../../src/services/consentService';
import { ENV } from '../../src/config/env';

// Client ID is public (safe for client-side). Secret stays server-side only.
const CLIENT_ID = ENV.XERO_CLIENT_ID;
// OAuth token exchange MUST happen via Supabase Edge Function — never embed client_secret in app
const TOKEN_EXCHANGE_URL = ENV.XERO_TOKEN_URL;
const REDIRECT_URI = 'vasco://xero/callback';

export default function XeroAuthScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);

  const handleConnect = async () => {
    if (!CLIENT_ID || !TOKEN_EXCHANGE_URL) {
      Alert.alert(
        t('xero.configNeededTitle', 'Configuration needed'),
        t('xero.configNeededMsg', 'Xero API credentials are not yet configured. Please contact support.'),
      );
      return;
    }

    // Check consent before connecting
    const hasConsent = await consentService.getConsent('xero');
    if (!hasConsent) {
      Alert.alert(
        'Consent required',
        'Vasco will share invoice and contact data with Xero for accounting sync. Do you agree to proceed?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Agree & Connect',
            onPress: async () => {
              await consentService.setConsent('xero', true);
              await consentService.setConsent('dataProcessing', true);
              performXeroConnect();
            },
          },
        ],
      );
      return;
    }

    performXeroConnect();
  };

  const performXeroConnect = async () => {
    setConnecting(true);

    try {
      const authUrl = await getXeroAuthUrl(CLIENT_ID, REDIRECT_URI);
      const result = await WebBrowser.openAuthSessionAsync(authUrl, REDIRECT_URI);

      if (result.type === 'success' && result.url) {
        // Extract code and state from callback URL
        const url = new URL(result.url);
        const code = url.searchParams.get('code');
        const returnedState = url.searchParams.get('state');

        // Verify OAuth state to prevent CSRF
        if (returnedState) {
          const stateValid = await verifyXeroOAuthState(returnedState);
          if (!stateValid) {
            logWarn('XeroAuth', 'OAuth state mismatch — possible CSRF attack');
            Alert.alert(t('common.error', 'Error'), t('xero.stateMismatch', 'Security validation failed. Please try again.'));
            setConnecting(false);
            return;
          }
        }

        if (code) {
          const config = await exchangeCodeForToken(code, CLIENT_ID, '', REDIRECT_URI, TOKEN_EXCHANGE_URL);
          if (config) {
            await saveAccountingConfig({
              provider: 'xero',
              connected: true,
              connectedAt: new Date().toISOString(),
            });
            setConnected(true);
            hapticSuccess();
          } else {
            Alert.alert(t('common.error', 'Error'), t('xero.tokenExchangeFailed', 'Token exchange failed'));
          }
        }
      }
    } catch {
      Alert.alert(t('common.error', 'Error'), t('xero.connectionFailed', 'Connection failed'));
    } finally {
      setConnecting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="cloud-outline" size={40} color={Palette.hermesOrange} />
        </View>

        <Text style={styles.title}>{t('xero.title', 'Connect Xero')}</Text>
        <Text style={styles.subtitle}>
          {t('xero.subtitle', 'Automatically sync invoices, contacts and payments with Xero')}
        </Text>

        <View style={styles.features}>
          {[
            t('xero.featureSyncInvoices', 'Sync invoices to Xero'),
            t('xero.featureImportContacts', 'Import contacts'),
            t('xero.featureTrackPayments', 'Track payments'),
            t('xero.featureMtd', 'MTD compliance'),
          ].map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={18} color={SemanticColors.feedbackSuccess} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        <Pressable
          style={[styles.connectBtn, connected && styles.connectedBtn]}
          onPress={connected ? () => router.back() : handleConnect}
          disabled={connecting}
        >
          {connecting ? (
            <Text style={styles.connectBtnText}>{t('xero.connecting', 'Connecting...')}</Text>
          ) : connected ? (
            <>
              <Ionicons name="checkmark-circle" size={20} color={SemanticColors.feedbackSuccess} />
              <Text style={[styles.connectBtnText, { color: SemanticColors.feedbackSuccess }]}>
                {t('xero.connected', 'Connected to Xero')}
              </Text>
            </>
          ) : (
            <Text style={styles.connectBtnText}>{t('xero.connect', 'Connect Xero')}</Text>
          )}
        </Pressable>

        <Text style={styles.privacyText}>
          {t('xero.privacyNote', 'Vasco only accesses invoices and contacts. Your data is stored encrypted.')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SemanticColors.surfacePrimary },
  header: {
    paddingTop: SafeArea.top, paddingHorizontal: SafeArea.side, paddingBottom: Spacing.sm,
    alignItems: 'flex-end',
  },
  content: { flex: 1, paddingHorizontal: Spacing.xl, alignItems: 'center', gap: Spacing.lg },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Palette.hermesOrange + '10',
    alignItems: 'center', justifyContent: 'center',
    marginTop: Spacing.xl,
  },
  title: { fontSize: 24, fontFamily: 'Manrope_700Bold', color: SemanticColors.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: 15, fontFamily: 'Inter_400Regular', color: SemanticColors.textSecondary, textAlign: 'center', lineHeight: 22 },
  features: { gap: 10, alignSelf: 'stretch' },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: SemanticColors.textPrimary },
  connectBtn: {
    backgroundColor: Palette.hermesOrange, borderRadius: 14, paddingVertical: 16,
    paddingHorizontal: 32, flexDirection: 'row', alignItems: 'center', gap: 8,
    alignSelf: 'stretch', justifyContent: 'center',
  },
  connectedBtn: { backgroundColor: SemanticColors.feedbackSuccess + '15' },
  connectBtnText: { fontSize: 17, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  privacyText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: SemanticColors.textTertiary, textAlign: 'center' },
});

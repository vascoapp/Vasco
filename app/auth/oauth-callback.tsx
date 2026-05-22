// =============================================================================
// OAUTH CALLBACK — Handles Moneybird OAuth redirect
// =============================================================================
// Deep link: vasco://auth/oauth-callback?code=XXXXX
// Exchanges authorization code for access token, saves config, navigates back
// =============================================================================

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { exchangeCodeForToken, verifyOAuthState } from '../../src/integrations/moneybird';
import { saveAccountingConfig } from '../../src/integrations/accounting';
import { logWarn } from '../../src/utils/errorHandler';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { ENV } from '../../src/config/env';

// Client ID is public. Secret stays server-side via edge function.
const MONEYBIRD_CLIENT_ID = ENV.MONEYBIRD_CLIENT_ID;
const TOKEN_EXCHANGE_URL = ENV.MONEYBIRD_TOKEN_URL;
const REDIRECT_URI = 'vasco://auth/oauth-callback';

type Status = 'loading' | 'success' | 'error';

export default function OAuthCallbackScreen() {
  const { code, state } = useLocalSearchParams<{ code: string; state?: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!code) {
      setStatus('error');
      setErrorMsg(t('moneybird.noAuthCode', 'No authorization code received.'));
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        // Verify OAuth state parameter to prevent CSRF attacks
        if (state) {
          const stateValid = await verifyOAuthState(state);
          if (!stateValid) {
            logWarn('OAuthCallback', 'OAuth state mismatch — possible CSRF attack');
            if (!cancelled) {
              setStatus('error');
              setErrorMsg(t('moneybird.stateMismatch', 'Security validation failed. Please try again.'));
            }
            return;
          }
        }

        const config = await exchangeCodeForToken(
          code,
          MONEYBIRD_CLIENT_ID,
          '',
          REDIRECT_URI,
          TOKEN_EXCHANGE_URL,
        );

        if (cancelled) return;

        if (!config) {
          setStatus('error');
          setErrorMsg(t('moneybird.tokenExchangeFailedRetry', 'Token exchange failed. Please try again.'));
          return;
        }

        // Save unified accounting config so the rest of the app knows Moneybird is connected
        await saveAccountingConfig({
          provider: 'moneybird',
          connected: true,
          connectedAt: new Date().toISOString(),
        });

        setStatus('success');

        // Navigate back after a brief success message
        setTimeout(() => {
          if (!cancelled) router.back();
        }, 1500);
      } catch {
        if (!cancelled) {
          setStatus('error');
          setErrorMsg(t('moneybird.somethingWentWrong', 'Something went wrong while connecting.'));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <View style={styles.container}>
      {status === 'loading' && (
        <>
          <ActivityIndicator size="large" color={Palette.hermesOrange} />
          <Text style={styles.title}>{t('moneybird.connectingToMoneybird', 'Connecting to Moneybird...')}</Text>
          <Text style={styles.subtitle}>{t('moneybird.pleaseWait', 'Please wait while we process the authorization.')}</Text>
        </>
      )}

      {status === 'success' && (
        <>
          <View style={styles.iconCircle}>
            <Ionicons name="checkmark" size={36} color="#fff" />
          </View>
          <Text style={styles.title}>{t('moneybird.connectedSuccess', 'Connected!')}</Text>
          <Text style={styles.subtitle}>{t('moneybird.successfullyLinked', 'Moneybird has been successfully linked.')}</Text>
        </>
      )}

      {status === 'error' && (
        <>
          <View style={[styles.iconCircle, { backgroundColor: SemanticColors.feedbackError }]}>
            <Ionicons name="close" size={36} color="#fff" />
          </View>
          <Text style={styles.title}>{t('moneybird.connectionFailedTitle', 'Connection failed')}</Text>
          <Text style={styles.subtitle}>{errorMsg}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: SemanticColors.feedbackSuccess,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Archivo_800ExtraBold',
    color: SemanticColors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});

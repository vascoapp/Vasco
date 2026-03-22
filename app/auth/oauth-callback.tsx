// =============================================================================
// OAUTH CALLBACK — Handles Moneybird OAuth redirect
// =============================================================================
// Deep link: vasco://auth/oauth-callback?code=XXXXX
// Exchanges authorization code for access token, saves config, navigates back
// =============================================================================

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { exchangeCodeForToken } from '../../src/integrations/moneybird';
import { saveAccountingConfig } from '../../src/integrations/accounting';
import { SemanticColors, Palette } from '../../src/theme/colors';

// TODO: move these to environment config / secure storage
const MONEYBIRD_CLIENT_ID = '';
const MONEYBIRD_CLIENT_SECRET = '';
const REDIRECT_URI = 'vasco://auth/oauth-callback';

type Status = 'loading' | 'success' | 'error';

export default function OAuthCallbackScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!code) {
      setStatus('error');
      setErrorMsg('Geen autorisatiecode ontvangen.');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const config = await exchangeCodeForToken(
          code,
          MONEYBIRD_CLIENT_ID,
          MONEYBIRD_CLIENT_SECRET,
          REDIRECT_URI,
        );

        if (cancelled) return;

        if (!config) {
          setStatus('error');
          setErrorMsg('Token uitwisseling mislukt. Probeer opnieuw.');
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
          setErrorMsg('Er ging iets mis bij het verbinden.');
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
          <Text style={styles.title}>Verbinden met Moneybird...</Text>
          <Text style={styles.subtitle}>Even geduld, we verwerken de autorisatie.</Text>
        </>
      )}

      {status === 'success' && (
        <>
          <View style={styles.iconCircle}>
            <Ionicons name="checkmark" size={36} color="#fff" />
          </View>
          <Text style={styles.title}>Verbonden!</Text>
          <Text style={styles.subtitle}>Moneybird is succesvol gekoppeld.</Text>
        </>
      )}

      {status === 'error' && (
        <>
          <View style={[styles.iconCircle, { backgroundColor: SemanticColors.feedbackError }]}>
            <Ionicons name="close" size={36} color="#fff" />
          </View>
          <Text style={styles.title}>Verbinding mislukt</Text>
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
    fontFamily: 'Manrope_700Bold',
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

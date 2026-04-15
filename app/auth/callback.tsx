// =============================================================================
// AUTH CALLBACK — handles Supabase magic-link, reset-password, email-confirm
// =============================================================================
// Deep-linked as vasco://auth/callback?type=recovery|signup|magiclink&...
// Supabase client picks up the params from the URL and fires auth listeners.
// We just surface a friendly status and forward to the right screen.
// =============================================================================

import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { supabase } from '../../src/lib/supabase';

export default function AuthCallbackScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string; access_token?: string; refresh_token?: string; error_description?: string }>();
  const [status, setStatus] = useState<'processing' | 'done' | 'error'>('processing');
  const [message, setMessage] = useState('');

  useEffect(() => {
    (async () => {
      if (params.error_description) {
        setStatus('error');
        setMessage(String(params.error_description));
        return;
      }
      // The Supabase client picks up the session from the URL automatically in
      // most cases; we additionally handle explicit access/refresh tokens.
      if (params.access_token && params.refresh_token) {
        try {
          await supabase.auth.setSession({
            access_token: String(params.access_token),
            refresh_token: String(params.refresh_token),
          });
        } catch {}
      }
      setStatus('done');
      // Route based on type
      setTimeout(() => {
        if (params.type === 'recovery') router.replace('/reset-password');
        else router.replace('/');
      }, 400);
    })();
  }, [params.type, params.access_token, params.refresh_token, params.error_description]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {status === 'processing' && <ActivityIndicator size="large" color={Palette.hermesOrange} />}
        <Text style={styles.title}>
          {status === 'processing'
            ? t('auth.confirming', 'Confirming your sign-in…')
            : status === 'done'
              ? t('auth.confirmed', 'Done. Redirecting…')
              : t('auth.confirmFailed', 'We could not confirm this link.')}
        </Text>
        {message ? <Text style={styles.error}>{message}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SemanticColors.surfaceBackground },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  title: { fontSize: 16, color: SemanticColors.textPrimary, textAlign: 'center' },
  error: { fontSize: 13, color: SemanticColors.feedbackError, textAlign: 'center' },
});

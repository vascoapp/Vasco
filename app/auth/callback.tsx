// =============================================================================
// AUTH CALLBACK — handles Supabase magic-link, reset-password, email-confirm
// =============================================================================
// Deep-linked as vasco://auth/callback#access_token=...&refresh_token=...&type=...
//
// R107: Supabase puts auth tokens in the URL FRAGMENT (#), not the query
// string. useLocalSearchParams() only reads ?query params, so tokens were
// invisible to the callback — making the email "Confirm" button land here
// without authenticating the user. We now read the raw initial URL via
// expo-linking and parse the fragment manually.
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Linking from 'expo-linking';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { supabase } from '../../src/lib/supabase';

interface AuthHashParams {
  access_token?: string;
  refresh_token?: string;
  type?: string;
  error_description?: string;
}

function parseHashParams(url: string | null): AuthHashParams {
  if (!url) return {};
  const hashIdx = url.indexOf('#');
  if (hashIdx === -1) return {};
  const fragment = url.slice(hashIdx + 1);
  const out: AuthHashParams = {};
  for (const piece of fragment.split('&')) {
    const eq = piece.indexOf('=');
    if (eq === -1) continue;
    const key = decodeURIComponent(piece.slice(0, eq));
    const value = decodeURIComponent(piece.slice(eq + 1));
    if (key === 'access_token' || key === 'refresh_token' || key === 'type' || key === 'error_description') {
      out[key] = value;
    }
  }
  return out;
}

export default function AuthCallbackScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  // Query-string params are still useful as a fallback for older Supabase
  // flows that put params on `?` instead of `#`.
  const queryParams = useLocalSearchParams<{ type?: string; access_token?: string; refresh_token?: string; error_description?: string }>();
  const [status, setStatus] = useState<'processing' | 'done' | 'error'>('processing');
  const [message, setMessage] = useState('');
  // Live deep link — updates for both cold launch and warm-start 'url' events.
  const linkedUrl = Linking.useURL();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    let cancelled = false;
    (async () => {
      // Prefer the LIVE linked URL. A confirm/recovery link tapped while the app
      // is already running is delivered via the OS 'url' event (captured by
      // Linking.useURL()), NOT getInitialURL() — reading only the cold-launch URL
      // dropped the token fragment on warm starts, so password reset then failed
      // with "Auth session missing". Fall back to getInitialURL for cold start.
      const url = linkedUrl ?? (await Linking.getInitialURL().catch(() => null));
      const hashParams = parseHashParams(url);

      // Hash params take precedence; query is fallback.
      const access_token = hashParams.access_token ?? (queryParams.access_token ? String(queryParams.access_token) : undefined);
      const refresh_token = hashParams.refresh_token ?? (queryParams.refresh_token ? String(queryParams.refresh_token) : undefined);
      const type = hashParams.type ?? (queryParams.type ? String(queryParams.type) : undefined);
      const error_description = hashParams.error_description ?? (queryParams.error_description ? String(queryParams.error_description) : undefined);

      // Nothing to act on yet (no url, no query token) — wait for a later
      // linkedUrl update rather than prematurely redirecting unauthenticated.
      if (!url && !access_token && !error_description) return;
      if (cancelled) return;
      handledRef.current = true;

      if (error_description) {
        setStatus('error');
        setMessage(error_description);
        return;
      }

      if (access_token && refresh_token) {
        try {
          await supabase.auth.setSession({ access_token, refresh_token });
        } catch {
          setStatus('error');
          setMessage(t('auth.confirmFailed', 'We could not confirm this link.'));
          return;
        }
      }

      setStatus('done');
      setTimeout(() => {
        if (type === 'recovery') router.replace('/reset-password');
        else router.replace('/');
      }, 400);
    })();
    return () => { cancelled = true; };
    // Re-runs when the linked URL arrives (warm start); handledRef guards against
    // double-processing. queryParams is navigation-stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedUrl]);

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

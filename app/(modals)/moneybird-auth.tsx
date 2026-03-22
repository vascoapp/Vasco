// =============================================================================
// MONEYBIRD AUTH — OAuth2 flow via expo-web-browser
// =============================================================================

import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { hapticSuccess } from '../../src/utils/haptics';
import {
  getMoneybirdAuthUrl,
  exchangeCodeForToken,
  isConnected,
} from '../../src/integrations/moneybird';
import {
  saveAccountingConfig,
} from '../../src/integrations/accounting';

// These would come from env vars in production
const CLIENT_ID = process.env.EXPO_PUBLIC_MONEYBIRD_CLIENT_ID ?? '';
const CLIENT_SECRET = process.env.EXPO_PUBLIC_MONEYBIRD_CLIENT_SECRET ?? '';
const REDIRECT_URI = 'vasco://moneybird/callback';

export default function MoneybirdAuthScreen() {
  const router = useRouter();
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);

  const handleConnect = async () => {
    if (!CLIENT_ID) {
      Alert.alert(
        'Configuratie nodig',
        'Moneybird API credentials zijn nog niet geconfigureerd. Neem contact op met support.',
      );
      return;
    }

    setConnecting(true);

    try {
      const authUrl = getMoneybirdAuthUrl(CLIENT_ID, REDIRECT_URI);
      const result = await WebBrowser.openAuthSessionAsync(authUrl, REDIRECT_URI);

      if (result.type === 'success' && result.url) {
        // Extract code from callback URL
        const url = new URL(result.url);
        const code = url.searchParams.get('code');

        if (code) {
          const config = await exchangeCodeForToken(code, CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
          if (config) {
            await saveAccountingConfig({
              provider: 'moneybird',
              connected: true,
              connectedAt: new Date().toISOString(),
            });
            setConnected(true);
            hapticSuccess();
          } else {
            Alert.alert('Fout', 'Token uitwisseling mislukt');
          }
        }
      }
    } catch {
      Alert.alert('Fout', 'Verbinding mislukt');
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

        <Text style={styles.title}>Moneybird koppelen</Text>
        <Text style={styles.subtitle}>
          Synchroniseer facturen, contacten en betalingen automatisch met je boekhouding
        </Text>

        <View style={styles.features}>
          {[
            'Facturen automatisch exporteren',
            'Betalingen synchroniseren',
            'Contacten importeren',
            'BTW-aangifte voorbereiden',
            'Peppol e-facturen versturen',
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
            <Text style={styles.connectBtnText}>Verbinden...</Text>
          ) : connected ? (
            <>
              <Ionicons name="checkmark-circle" size={20} color={SemanticColors.feedbackSuccess} />
              <Text style={[styles.connectBtnText, { color: SemanticColors.feedbackSuccess }]}>
                Verbonden met Moneybird
              </Text>
            </>
          ) : (
            <Text style={styles.connectBtnText}>Koppel Moneybird</Text>
          )}
        </Pressable>

        <Text style={styles.privacyText}>
          Vasco heeft alleen toegang tot facturen en contacten. Je gegevens worden versleuteld opgeslagen.
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

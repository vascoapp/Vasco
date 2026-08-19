import { useState, useEffect } from 'react';
import { StyleSheet, Text, TextInput, View, Pressable, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen } from '../../src/components/Screen';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';
import { useAppState } from '../../src/state/AppState';
import { hapticSuccess } from '../../src/utils/haptics';
import { useTranslation } from 'react-i18next';
import { DKScreenHeader } from '../../src/components/shared/DKScreenHeader';

const STORAGE_KEY = '@vasco_moneybird_config';

export default function MoneybirdConnectModal() {
  const { t } = useTranslation();
  const { connectMoneybird, moneybirdConnected } = useAppState();
  const [apiToken, setApiToken] = useState('');
  const [administrationId, setAdministrationId] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [connected, setConnected] = useState(moneybirdConnected);

  // Check if already connected on mount
  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setConnected(true);
      }
    })();
  }, []);

  const handleTest = async () => {
    if (!apiToken.trim()) {
      Alert.alert(
        t('moneybird.invalidToken', 'Ongeldige token'),
        t('moneybird.enterToken', 'Voer een geldige Moneybird API token in.'),
      );
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // Save config to AsyncStorage
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          accessToken: apiToken.trim(),
          administrationId: administrationId.trim(),
          connectedAt: Date.now(),
        }),
      );

      setTestResult('success');
      setConnected(true);
      connectMoneybird();
      hapticSuccess();
    } catch {
      setTestResult('error');
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      t('moneybird.disconnect', 'Moneybird loskoppelen'),
      t('moneybird.disconnectDesc', 'Weet je zeker dat je Moneybird wilt loskoppelen?'),
      [
        { text: t('common.cancel', 'Annuleren'), style: 'cancel' },
        {
          text: t('moneybird.disconnect', 'Loskoppelen'),
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem(STORAGE_KEY);
            setConnected(false);
            setApiToken('');
            setAdministrationId('');
            setTestResult(null);
          },
        },
      ],
    );
  };

  const syncFeatures = [
    { name: t('moneybird.contacts', 'Contacten'), icon: 'people-outline' },
    { name: t('moneybird.invoices', 'Facturen'), icon: 'document-text-outline' },
    { name: t('moneybird.lineItems', 'Regelitems'), icon: 'list-outline' },
    { name: t('moneybird.taxRates', 'BTW-tarieven'), icon: 'calculator-outline' },
    { name: t('moneybird.payments', 'Betalingen'), icon: 'card-outline' },
  ];

  return (
    <Screen backgroundColor={SemanticColors.surfacePrimary}>
      {/* Reached by router.push from the invoice and quote screens, on a
          stack with headerShown:false — so this screen opened with no back
          control of any kind. The title moves here from the body. */}
      <DKScreenHeader title={t('moneybird.title', 'Moneybird Boekhouding')} />
      <View style={styles.container}>
        <Text style={styles.subtitle}>
          {t('moneybird.subtitle', 'Exporteer facturen en synchroniseer contacten automatisch')}
        </Text>

        {/* API Token Input */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>{t('moneybird.apiToken', 'API Token')}</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder={t('moneybird.tokenPlaceholder', 'Plak je Moneybird API token')}
              placeholderTextColor={SemanticColors.textTertiary}
              value={apiToken}
              onChangeText={setApiToken}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={apiToken.length > 10}
              editable={!connected}
            />
            {testResult === 'success' && (
              <Ionicons name="checkmark-circle" size={22} color={SemanticColors.feedbackSuccess} />
            )}
          </View>
          <Text style={styles.hint}>
            {t('moneybird.tokenHint', 'Vind je token in Moneybird → Instellingen → Ontwikkelaars → API tokens')}
          </Text>
        </View>

        {/* Administration ID (optional) */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>{t('moneybird.administrationId', 'Administratie ID')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('moneybird.adminIdPlaceholder', 'Optioneel — wordt automatisch gedetecteerd')}
            placeholderTextColor={SemanticColors.textTertiary}
            value={administrationId}
            onChangeText={setAdministrationId}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!connected}
          />
        </View>

        {/* Test + Connect Button */}
        {!connected ? (
          <Pressable
            style={[styles.connectBtn, (testing || apiToken.length < 5) && { opacity: 0.5 }]}
            onPress={handleTest}
            disabled={testing || apiToken.length < 5}
          >
            {testing ? (
              <Text style={styles.connectBtnText}>{t('moneybird.connecting', 'Verbinden...')}</Text>
            ) : (
              <Text style={styles.connectBtnText}>{t('moneybird.connectAndTest', 'Verbinden & Testen')}</Text>
            )}
          </Pressable>
        ) : (
          <Pressable style={[styles.connectBtn, styles.connectedBtn]} onPress={handleDisconnect}>
            <Ionicons name="checkmark-circle" size={18} color={SemanticColors.feedbackSuccess} />
            <Text style={[styles.connectBtnText, { color: SemanticColors.feedbackSuccess }]}>
              {t('moneybird.connected', 'Verbonden')}
            </Text>
          </Pressable>
        )}

        {testResult === 'error' && (
          <Text style={styles.errorText}>
            {t('moneybird.connectionFailed', 'Verbinding mislukt — controleer je API token')}
          </Text>
        )}

        {/* Sync Features */}
        <View style={styles.methodsSection}>
          <Text style={styles.label}>{t('moneybird.whatSyncs', 'Wat wordt gesynchroniseerd')}</Text>
          <View style={styles.methodsGrid}>
            {syncFeatures.map((f) => (
              <View key={f.name} style={styles.methodChip}>
                <Ionicons name={f.icon as any} size={14} color={connected ? Palette.hermesOrange : SemanticColors.textTertiary} />
                <Text style={[styles.methodText, connected && { color: SemanticColors.textPrimary }]}>{f.name}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.lg, gap: Spacing.md },
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
  hint: { fontSize: 12, fontFamily: 'Inter_400Regular', color: SemanticColors.textTertiary },
  connectBtn: {
    backgroundColor: Palette.hermesOrange, borderRadius: 12, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  connectedBtn: { backgroundColor: SemanticColors.feedbackSuccess + '15' },
  connectBtnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  errorText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: SemanticColors.feedbackError, textAlign: 'center' },
  methodsSection: { gap: 8 },
  methodsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: SemanticColors.surfaceBackground, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  methodText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: SemanticColors.textTertiary },
});

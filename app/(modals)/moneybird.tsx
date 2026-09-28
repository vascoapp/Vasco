import { useState, useEffect } from 'react';
import { DK } from '../../src/theme/draftkings';
import { DKMenu } from '../../src/components/shared/DKMenu';
import { StyleSheet, Text, TextInput, View, Pressable, Alert, Linking, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '../../src/components/Screen';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';
import { useAppState } from '../../src/state/AppState';
import { hapticSuccess } from '../../src/utils/haptics';
import { useTranslation } from 'react-i18next';
import { DKScreenHeader } from '../../src/components/shared/DKScreenHeader';
import {
  connectWithPersonalToken,
  listAdministrationsForToken,
  clearMoneybirdConfig,
  isConnected as isMoneybirdConnected,
} from '../../src/integrations/moneybird';

// Where a personal Moneybird key is made (after logging in).
const MONEYBIRD_TOKEN_URL = 'https://moneybird.com/user/applications/new';

export default function MoneybirdConnectModal() {
  const { t } = useTranslation();
  const { connectMoneybird, disconnectMoneybird, moneybirdConnected } = useAppState();
  const [apiToken, setApiToken] = useState('');
  const [choices, setChoices] = useState<Array<{ id: string; name: string }> | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [errorReason, setErrorReason] = useState<'invalid_token' | 'no_administration' | 'network' | null>(null);
  const [connected, setConnected] = useState(moneybirdConnected);

  // Check if already connected on mount
  useEffect(() => {
    (async () => {
      // The integration's own secure store is the only truth about whether a
      // token is usable — this screen used to read a key nothing else wrote.
      if (await isMoneybirdConnected()) setConnected(true);
    })();
  }, []);

  // Paste the code → Koppelen. One administration: done. Several: pick it by
  // NAME (DKMenu) — the old screen asked for an "administratie-ID"
  // (emulator walk 2026-09-28: "highly technical for a construction worker").
  const connectTo = async (adminId: string) => {
    setTesting(true);
    // Really call Moneybird. "Testen" that only wrote to storage said the
    // connection was good for a token that had never been used (#339).
    const result = await connectWithPersonalToken({ accessToken: apiToken.trim(), administrationId: adminId });
    setTesting(false);
    if (!result.ok) {
      setTestResult('error');
      setErrorReason(result.reason);
      return;
    }
    setChoices(null);
    setTestResult('success');
    setConnected(true);
    connectMoneybird();
    hapticSuccess();
  };

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
    setErrorReason(null);
    setChoices(null);
    const list = await listAdministrationsForToken(apiToken);
    setTesting(false);
    if (!list.ok) {
      setTestResult('error');
      setErrorReason(list.reason);
      return;
    }
    if (list.admins.length === 0) {
      setTestResult('error');
      setErrorReason('no_administration');
      return;
    }
    if (list.admins.length === 1) {
      await connectTo(list.admins[0].id);
      return;
    }
    setChoices(list.admins);
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
            await clearMoneybirdConfig();
            disconnectMoneybird();
            setConnected(false);
            setApiToken('');
            setChoices(null);
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
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>
          {t('moneybird.subtitle', 'Exporteer facturen en synchroniseer contacten automatisch')}
        </Text>

        {!connected && (
          <View style={styles.steps} testID="moneybird-steps">
            <Text style={styles.stepsTitle}>{t('moneybird.stepsTitle', 'Moneybird koppelen in 3 stappen')}</Text>
            {[
              t('moneybird.step1', 'Open Moneybird en log in.'),
              t('moneybird.step2', 'Maak daar een nieuwe sleutel aan — noem hem Vasco — en kopieer de code.'),
              t('moneybird.step3', 'Kom terug, houd je vinger in het vak hieronder, tik op Plakken — en dan op Koppelen.'),
            ].map((text, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
                <Text style={styles.stepText}>{text}</Text>
              </View>
            ))}
            <Pressable style={styles.openBtn} onPress={() => Linking.openURL(MONEYBIRD_TOKEN_URL)} accessibilityRole="link" testID="moneybird-open">
              <Ionicons name="open-outline" size={16} color={Palette.hermesOrange} />
              <Text style={styles.openText}>{t('moneybird.openMoneybird', 'Open Moneybird')}</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.inputSection}>
          <Text style={styles.label}>{t('moneybird.codeLabel', 'Je Moneybird-code')}</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder={t('moneybird.codePlaceholder', 'Plak hier je code')}
              placeholderTextColor={SemanticColors.placeholder}
              value={apiToken}
              onChangeText={(v) => { setApiToken(v); setChoices(null); }}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={apiToken.length > 10}
              editable={!connected}
              testID="moneybird-code"
            />
            {testResult === 'success' && (
              <Ionicons name="checkmark-circle" size={22} color={SemanticColors.feedbackSuccess} />
            )}
          </View>
        </View>

        {/* Several administrations: choose by name, never by id. */}
        {!connected && choices && (
          <View style={styles.inputSection} testID="moneybird-pick">
            <Text style={styles.pickHint}>{t('moneybird.pickHint', 'Je Moneybird heeft meer dan één administratie. Welke hoort bij dit bedrijf?')}</Text>
            <DKMenu
              accessibilityLabel={t('moneybird.pickTitle', 'Kies je administratie')}
              items={choices.map((a) => ({ key: a.id, label: a.name, onPress: () => { connectTo(a.id); } }))}
              renderAnchor={(open) => (
                <Pressable style={styles.connectBtn} onPress={open} accessibilityRole="button">
                  <Text style={styles.connectBtnText}>{t('moneybird.pickTitle', 'Kies je administratie')}</Text>
                  <Ionicons name="chevron-down" size={16} color={DK.colors.text} />
                </Pressable>
              )}
            />
          </View>
        )}

        {/* Test + Connect Button */}
        {!connected ? (choices ? null : (
          <Pressable
            style={[styles.connectBtn, (testing || apiToken.length < 5) && { opacity: 0.5 }]}
            onPress={handleTest}
            disabled={testing || apiToken.length < 5}
          >
            {testing ? (
              <Text style={styles.connectBtnText}>{t('moneybird.connecting', 'Verbinden...')}</Text>
            ) : (
              <Text style={styles.connectBtnText}>{t('moneybird.connect', 'Koppelen')}</Text>
            )}
          </Pressable>
        )) : (
          <Pressable style={[styles.connectBtn, styles.connectedBtn]} onPress={handleDisconnect}>
            <Ionicons name="checkmark-circle" size={18} color={SemanticColors.feedbackSuccess} />
            <Text style={[styles.connectBtnText, { color: SemanticColors.feedbackSuccess }]}>
              {t('moneybird.connected', 'Verbonden')}
            </Text>
          </Pressable>
        )}

        {testResult === 'error' && (
          <Text style={styles.errorText}>
            {errorReason === 'no_administration'
              ? t('moneybird.noAdministration', 'Er hoort geen administratie bij deze code. Maak eerst een administratie aan in Moneybird.')
              : errorReason === 'network'
                ? t('moneybird.connectionUnreachable', 'Moneybird niet bereikbaar — probeer het opnieuw')
                : t('moneybird.connectionFailed', 'Moneybird accepteert deze code niet. Kopieer hem opnieuw en probeer het nog eens.')}
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
  pickHint: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular', color: SemanticColors.textPrimary },
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

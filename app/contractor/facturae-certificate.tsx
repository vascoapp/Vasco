// =============================================================================
// SIGNING CERTIFICATE (Spain) — import once, every Facturae to FACe is signed
// =============================================================================
// FACe (every Spanish public body) accepts a Facturae only signed under the
// Facturae signature policy (Orden HAP/1650/2015 Anexo II.2). The contractor
// already holds a certificate — the FNMT one they use for the AEAT — as a
// .p12 / .pfx file. They import it here ONCE: the password is used to unwrap
// the key and then forgotten; the key is kept encrypted on this phone only
// (src/services/signingCertificateStore.ts). The screen shows the three facts
// that decide whether it can sign: holder, NIF, expiry — and refuses an
// expired certificate or one that does not carry the business's NIF.
//
// Reached from the business profile (Spain) and from the invoice export when
// a public-body invoice needs a signature and none is stored.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import { File as ExpoFile } from 'expo-file-system';
import { DK } from '../../src/theme/draftkings';
import { SemanticColors } from '../../src/theme/colors';
import { PAGE_BG, TYPE, GRID } from '../../src/theme/tabStyles';
import { SafeArea } from '../../src/theme/spacing';
import { DKScreenHeader } from '../../src/components/shared/DKScreenHeader';
import { DKLabel } from '../../src/components/shared/DKLabel';
import { useAppState } from '../../src/state/AppState';
import { useAuth } from '../../src/context/AuthContext';
import { goBack } from '../../src/utils/goBack';
import { hapticSuccess } from '../../src/utils/haptics';
import { formatDateShortAuto } from '../../src/i18n/formatting';
import { readSigningCertificate, judgeStoredCertificate } from '../../src/integrations/signingCertificate';
import {
  loadSigningCertificate, saveSigningCertificate, removeSigningCertificate, type StoredCertificate,
} from '../../src/services/signingCertificateStore';
import { sellerNifOf, certificateProblemText } from '../../src/services/facturaeSigning';

export default function FacturaeCertificateScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const { businessProfile } = useAppState();
  const sellerNif = sellerNifOf(businessProfile as any);
  const owner = user?.id ?? '';

  const [stored, setStored] = useState<StoredCertificate | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [picked, setPicked] = useState<{ uri: string; name: string } | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setStored(await loadSigningCertificate(owner));
    setLoaded(true);
  }, [owner]);
  useEffect(() => { void refresh(); }, [refresh]);

  const pick = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      setPicked({ uri: res.assets[0].uri, name: res.assets[0].name ?? '' });
      setPassword('');
    } catch {
      Alert.alert(t('common.error', 'Error'), t('facturaeCertificate.pickFailed', 'The file could not be opened.'));
    }
  };

  const cancelImport = () => {
    // The copy the picker made in the cache holds the key (password-protected).
    try { if (picked) { const f = new ExpoFile(picked.uri); if (f.exists) f.delete(); } } catch {}
    setPicked(null);
    setPassword('');
  };

  const doImport = async () => {
    if (!picked || busy) return;
    if (!sellerNif) {
      Alert.alert(t('facturaeCertificate.problemTitle', 'Certificate not imported'), t('facturaeCertificate.problem.noSellerNif', 'Enter your NIF/CIF in your business profile first.'));
      return;
    }
    setBusy(true);
    // Let the spinner paint before the (synchronous) key unwrap.
    await new Promise((r) => setTimeout(r, 30));
    try {
      const bytes = await new ExpoFile(picked.uri).bytes();
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const r = readSigningCertificate(bin, password, sellerNif);
      if (!r.ok) {
        Alert.alert(t('facturaeCertificate.problemTitle', 'Certificate not imported'), certificateProblemText(t, r.problem, r.info, sellerNif));
        return;
      }
      const ok = await saveSigningCertificate(owner, r.material, r.info);
      if (!ok) {
        Alert.alert(t('facturaeCertificate.problemTitle', 'Certificate not imported'), t('facturaeCertificate.saveFailed', 'The certificate could not be stored on this phone. Try again.'));
        return;
      }
      hapticSuccess();
      cancelImport();
      await refresh();
      Alert.alert(t('facturaeCertificate.imported', 'Certificate imported'), t('facturaeCertificate.importedBody', 'Facturae invoices are now signed with this certificate.'));
    } catch {
      Alert.alert(t('facturaeCertificate.problemTitle', 'Certificate not imported'), t('facturaeCertificate.problem.unreadable', 'Wrong password, or not a .p12 / .pfx certificate file.'));
    } finally {
      setBusy(false);
    }
  };

  const confirmRemove = () => {
    Alert.alert(
      t('facturaeCertificate.removeTitle', 'Remove certificate?'),
      t('facturaeCertificate.removeBody', 'Vasco can no longer sign invoices to public bodies until you import it again.'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('facturaeCertificate.remove', 'Remove certificate'),
          style: 'destructive',
          onPress: async () => {
            const ok = await removeSigningCertificate();
            await refresh();
            if (!ok) Alert.alert(t('common.error', 'Error'), t('facturaeCertificate.removeFailed', 'The certificate could not be removed. Try again.'));
          },
        },
      ],
    );
  };

  // A stored certificate is judged again: it can have expired since, or the
  // profile's NIF can have changed.
  const judged = stored ? judgeStoredCertificate(stored.material, sellerNif) : null;

  return (
    <View style={styles.container}>
      <DKScreenHeader title={t('facturaeCertificate.title', 'Signing certificate')} onBack={() => goBack(router)} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>
          {t('facturaeCertificate.intro', 'Spanish public bodies only accept invoices through FACe that are signed with your digital certificate (FNMT or another qualified certificate). Import your .p12 / .pfx file once; Vasco then signs every Facturae with it.')}
        </Text>

        {!loaded ? (
          <ActivityIndicator color={DK.colors.accent} />
        ) : stored ? (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Ionicons name={judged?.ok ? 'shield-checkmark-outline' : 'warning-outline'} size={22} color={judged?.ok ? DK.colors.success : DK.colors.highlight} />
              <Text style={styles.holder}>{stored.info.holder}</Text>
            </View>
            <Row label={t('facturaeCertificate.nif', 'NIF')} value={(judged?.ok ? judged.info.nif : undefined) ?? stored.info.nifs.join(' · ')} />
            <Row label={t('facturaeCertificate.expires', 'Valid until')} value={formatDateShortAuto(stored.info.notAfter)} />
            <Row label={t('facturaeCertificate.issuer', 'Issued by')} value={stored.info.issuer} />
            {judged && !judged.ok && (
              <Text style={styles.problem}>{certificateProblemText(t, judged.problem, judged.info, sellerNif)}</Text>
            )}
            <View style={styles.actions}>
              <Pressable style={styles.secondaryBtn} onPress={pick} accessibilityRole="button">
                <Text style={styles.secondaryText}>{t('facturaeCertificate.replace', 'Replace certificate')}</Text>
              </Pressable>
              <Pressable style={styles.dangerBtn} onPress={confirmRemove} accessibilityRole="button">
                <Text style={styles.dangerText}>{t('facturaeCertificate.remove', 'Remove certificate')}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Ionicons name="document-lock-outline" size={22} color={DK.colors.textMuted} />
              <Text style={styles.holder}>{t('facturaeCertificate.none', 'No certificate yet')}</Text>
            </View>
            {!picked && (
              <Pressable style={styles.cta} onPress={pick} accessibilityRole="button">
                <LinearGradient colors={[DK.colors.primaryDark, DK.colors.primary, DK.colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                <DKLabel style={styles.ctaText}>{t('facturaeCertificate.import', 'Import certificate (.p12 / .pfx)')}</DKLabel>
              </Pressable>
            )}
          </View>
        )}

        {picked && (
          <View style={styles.card}>
            <Text style={styles.label}>{t('facturaeCertificate.file', 'File')}</Text>
            <Text style={styles.value} numberOfLines={1}>{picked.name}</Text>
            <Text style={styles.label}>{t('facturaeCertificate.password', 'Certificate password')}</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              placeholder={t('facturaeCertificate.passwordPlaceholder', 'Password of the .p12 file')}
              placeholderTextColor={SemanticColors.placeholder}
              editable={!busy}
            />
            <View style={styles.actions}>
              <Pressable style={styles.secondaryBtn} onPress={cancelImport} disabled={busy} accessibilityRole="button">
                <Text style={styles.secondaryText}>{t('common.cancel', 'Cancel')}</Text>
              </Pressable>
              <Pressable style={[styles.cta, { flex: 1, marginTop: 0 }, busy && { opacity: 0.6 }]} onPress={doImport} disabled={busy} accessibilityRole="button">
                <LinearGradient colors={[DK.colors.primaryDark, DK.colors.primary, DK.colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                {busy ? <ActivityIndicator color={DK.colors.text} /> : <DKLabel style={styles.ctaText}>{t('facturaeCertificate.confirmImport', 'Import')}</DKLabel>}
              </Pressable>
            </View>
          </View>
        )}

        <Text style={styles.note}>
          {t('facturaeCertificate.storageNote', 'The certificate is kept encrypted on this phone only, protected by the device keychain, and never leaves it. Vasco does not keep its password. Signing in with another account on this phone removes it.')}
        </Text>
      </ScrollView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  content: { padding: GRID.md, paddingBottom: SafeArea.bottom + 40, gap: GRID.md },
  intro: { color: DK.colors.textMuted, fontSize: TYPE.captionSize, lineHeight: 19 },
  card: {
    backgroundColor: DK.colors.panel, borderRadius: DK.radius.card, borderWidth: 1, borderColor: DK.colors.border,
    padding: GRID.md, gap: GRID.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: GRID.sm },
  holder: { flex: 1, color: DK.colors.text, fontSize: TYPE.titleSize, fontFamily: TYPE.titleFamily },
  row: { gap: 2 },
  label: { color: DK.colors.text, fontSize: TYPE.labelSize, fontFamily: DK.type.body500 },
  value: { color: DK.colors.textMuted, fontSize: TYPE.bodySize, fontFamily: DK.type.body400 },
  problem: { color: DK.colors.highlight, fontSize: TYPE.captionSize, lineHeight: 19 },
  actions: { flexDirection: 'row', gap: GRID.sm, marginTop: GRID.xs },
  input: {
    backgroundColor: DK.colors.panel2, borderRadius: DK.radius.button, borderWidth: 1, borderColor: DK.colors.border,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: TYPE.bodySize, fontFamily: DK.type.body500, color: DK.colors.text,
  },
  cta: {
    borderRadius: DK.radius.button, paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', marginTop: GRID.xs,
  },
  ctaText: { fontFamily: DK.type.display900, fontSize: TYPE.captionSize, color: DK.colors.text, letterSpacing: 1.4 },
  secondaryBtn: {
    flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderRadius: DK.radius.button,
    borderWidth: 1, borderColor: DK.colors.border,
  },
  secondaryText: { color: DK.colors.text, fontSize: TYPE.captionSize, fontFamily: DK.type.body600 },
  dangerBtn: {
    flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderRadius: DK.radius.button,
    borderWidth: 1, borderColor: DK.colors.danger,
  },
  dangerText: { color: DK.colors.danger, fontSize: TYPE.captionSize, fontFamily: DK.type.body600 },
  note: { color: DK.colors.textMuted, fontSize: TYPE.tinySize, lineHeight: 16 },
});

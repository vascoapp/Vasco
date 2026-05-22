// =============================================================================
// CUSTOMER PORTAL — Landing Page (DraftKings style)
// =============================================================================
// Entry point for customers to access their decision portal.
// =============================================================================

import { useState } from 'react';
import { Image, View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { DK } from '../../src/theme/draftkings';
import { DKLabel } from '../../src/components/shared/DKLabel';

export default function CustomerLandingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    const trimmed = accessCode.trim().toUpperCase();
    if (trimmed.length < 4) {
      setError(t('customerPortal.invalidCode', 'Voer een geldige toegangscode in.'));
      return;
    }
    setError('');
    router.push(`/customer/${trimmed}` as any);
  };

  const handleDemo = () => {
    router.push('/customer/VDB24A' as any);
  };

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={s.inner} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={s.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={DK.colors.text} />
        </Pressable>

        {/* R92: official VascoBuild logo */}
        <View style={s.hero}>
          <View style={s.markWrap}>
            <Image
              source={require('../../assets/icon.png')}
              style={s.mark}
              accessibilityLabel="VascoBuild"
            />
          </View>
          <Text style={s.brand}>VASCO</Text>
          <DKLabel style={s.brandSub}>{t('customerPortal.title', 'Klantportaal')}</DKLabel>
        </View>

        {/* Welcome */}
        <View style={s.welcome}>
          <Text style={s.welcomeTitle}>{t('customerPortal.welcome', 'Welkom')}</Text>
          <Text style={s.welcomeBody}>
            {t('customerPortal.intro', 'Uw aannemer heeft keuzes voor u klaargezet. Voer de toegangscode in die u heeft ontvangen.')}
          </Text>
        </View>

        {/* Access code */}
        <View style={s.inputArea}>
          <DKLabel style={s.inputLabel}>{t('customerPortal.code', 'Toegangscode')}</DKLabel>
          <TextInput
            style={[s.codeInput, error ? s.codeInputError : null]}
            value={accessCode}
            onChangeText={(text) => { setAccessCode(text.toUpperCase()); if (error) setError(''); }}
            placeholder={t('customerPortal.codePlaceholder', 'bijv. ABC123')}
            placeholderTextColor={DK.colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />
          {error ? <Text style={s.errorText}>{error}</Text> : null}
        </View>

        {/* Primary submit */}
        <Pressable
          style={({ pressed }) => [s.submitBtn, !accessCode.trim() && s.submitBtnDisabled, pressed && { opacity: 0.9 }]}
          onPress={handleSubmit}
          disabled={!accessCode.trim()}
        >
          <LinearGradient
            colors={[DK.colors.primaryDark, DK.colors.primary, DK.colors.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <DKLabel style={s.submitBtnText}>{t('customerPortal.submit', 'Bekijk mijn keuzes')}</DKLabel>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
        </Pressable>

        {/* Demo secondary */}
        <Pressable style={({ pressed }) => [s.demoBtn, pressed && { opacity: 0.85 }]} onPress={handleDemo}>
          <Ionicons name="play-circle-outline" size={18} color={DK.colors.accent} />
          <DKLabel style={s.demoBtnText}>{t('customerPortal.demo', 'Demo modus')}</DKLabel>
        </Pressable>

        {/* Footer */}
        <View style={s.footer}>
          <Ionicons name="lock-closed" size={14} color={DK.colors.textMuted} />
          <Text style={s.footerText}>
            {t('customerPortal.privacy', 'Geen account nodig. Uw keuzes worden veilig opgeslagen en direct doorgegeven aan uw aannemer.')}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: DK.colors.bg },
  inner: { flex: 1, paddingHorizontal: 24 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: DK.colors.panel,
    borderWidth: 1, borderColor: DK.colors.border,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 8,
  },

  hero: { alignItems: 'center', marginTop: 24, gap: 10 },
  markWrap: {
    shadowColor: DK.colors.accent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 10,
    marginBottom: 8,
  },
  mark: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  brand: {
    fontFamily: 'Archivo_900Black',
    fontSize: 32,
    color: DK.colors.text,
    letterSpacing: -1,
  },
  brandSub: {
    fontFamily: 'Archivo_800ExtraBold',
    fontSize: 11,
    color: DK.colors.textMuted,
    letterSpacing: 1.8,
  },

  welcome: { marginTop: 28, gap: 8 },
  welcomeTitle: {
    fontFamily: 'Archivo_900Black',
    fontSize: 24,
    color: DK.colors.text,
    letterSpacing: -0.4,
  },
  welcomeBody: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: DK.colors.textMuted,
    lineHeight: 20,
  },

  inputArea: { marginTop: 24, gap: 8 },
  inputLabel: {
    fontFamily: 'Archivo_800ExtraBold',
    fontSize: 10,
    color: DK.colors.textMuted,
    letterSpacing: 1.4,
  },
  codeInput: {
    fontFamily: 'Archivo_900Black',
    fontSize: 24,
    color: DK.colors.text,
    letterSpacing: 4,
    textAlign: 'center',
    backgroundColor: DK.colors.panel,
    borderRadius: DK.radius.card,
    borderWidth: 2,
    borderColor: DK.colors.border,
    paddingVertical: 18,
  },
  codeInputError: { borderColor: DK.colors.danger },
  errorText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: DK.colors.danger,
    marginTop: 4,
  },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: DK.radius.button,
    paddingVertical: 16,
    marginTop: 20,
    overflow: 'hidden',
    shadowColor: DK.colors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 10,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: {
    fontFamily: 'Archivo_900Black',
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 1.4,
  },

  demoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: DK.colors.accent,
    borderRadius: DK.radius.button,
    paddingVertical: 14,
    marginTop: 12,
    backgroundColor: DK.colors.accent + '14',
  },
  demoBtnText: {
    fontFamily: 'Archivo_800ExtraBold',
    fontSize: 12,
    color: DK.colors.accent,
    letterSpacing: 1.3,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 'auto',
    marginBottom: 16,
    paddingTop: 16,
  },
  footerText: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: DK.colors.textMuted,
    lineHeight: 18,
  },
});

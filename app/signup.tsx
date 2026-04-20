// =============================================================================
// SIGNUP — email + password → Supabase auth → onboarding
// =============================================================================
// First-run real-user account creation. In DEMO_MODE we push the user toward
// the demo accounts instead since Supabase isn't configured. On success we
// route to /onboarding for the 14-step Cal-AI-style setup.
// =============================================================================

import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Linking, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { DEMO_MODE } from '../src/config/demo';
import { LinearGradient } from 'expo-linear-gradient';
import { SemanticColors, Palette } from '../src/theme/colors';
import { Spacing } from '../src/theme/spacing';
import { TYPE, RADIUS, GRID } from '../src/theme/tabStyles';
import { DK } from '../src/theme/draftkings';
import { FadeIn } from '../src/components/shared/FadeIn';
import { GradientButton } from '../src/components/shared/GradientButton';
import { isValidEmail } from '../src/utils/validation';
import { emitSignupCompleted } from '../src/intelligence/dataCollector';
import { DKLabel } from '../src/components/shared/DKLabel';

export default function SignupScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const handleSignup = async () => {
    setError('');
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError(t('signup.emailRequired', 'Email is required.'));
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      setError(t('signup.emailInvalid', 'Please enter a valid email address.'));
      return;
    }
    if (password.length < 8) {
      setError(t('signup.passwordShort', 'Password must be at least 8 characters.'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('signup.passwordMismatch', "Passwords don't match."));
      return;
    }
    if (!accepted) {
      setError(t('signup.acceptTerms', 'Please accept the Terms and Privacy Policy to continue.'));
      return;
    }
    if (DEMO_MODE) {
      setError(t('signup.demoMode', 'Signup is disabled in demo mode. Pick a demo account on the login screen.'));
      return;
    }
    setSubmitting(true);
    const result = await signUp(trimmedEmail, password);
    setSubmitting(false);
    if (result.success) {
      // Fire analytics event — funnel head. userId may not be available
      // before email confirmation; use email as stable identifier in that case.
      emitSignupCompleted((result as any).userId ?? trimmedEmail, {
        email: trimmedEmail,
        method: 'email',
      }).catch(() => {});
      // Supabase typically requires email confirmation. Show a "check your
      // email" state — onAuthStateChange will fire SIGNED_IN → auto-redirect
      // handled by app/_layout.tsx once the user confirms.
      setPending(true);
      return;
    }
    const msg = (result.error ?? '').toLowerCase();
    if (/already registered|already exists/i.test(msg)) {
      setError(t('signup.alreadyExists', 'An account with this email already exists. Try signing in.'));
    } else if (/fetch|network|timeout/.test(msg)) {
      setError(t('auth.networkError', 'Cannot reach server. Check your internet and try again.'));
    } else {
      setError(result.error ?? t('signup.failed', 'Could not create account. Try again.'));
    }
  };

  if (pending) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.pendingWrap}>
          <Ionicons name="mail" size={48} color={Palette.hermesOrange} />
          <Text style={styles.pendingTitle}>{t('signup.checkEmail', 'Check your email')}</Text>
          <Text style={styles.pendingDesc}>
            {t('signup.checkEmailDesc', 'We sent a confirmation link to {{email}}. Tap it to activate your account, then return here to log in.', { email })}
          </Text>
          <Pressable style={styles.backBtn} onPress={() => router.replace('/login' as any)} accessibilityRole="button">
            <Text style={styles.backBtnText}>{t('auth.backToLogin', 'Back to login')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FadeIn delay={0}>
            <View style={styles.header}>
              <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backIconBtn} accessibilityRole="button" accessibilityLabel={t('auth.backToLogin', 'Back to login')}>
                <Ionicons name="chevron-back" size={22} color={SemanticColors.textPrimary} />
              </Pressable>
              <View style={styles.markWrap}>
                <LinearGradient
                  colors={[DK.colors.primaryDark, DK.colors.primary, DK.colors.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.mark}
                >
                  <Ionicons name="flash" size={22} color="#FFFFFF" />
                </LinearGradient>
              </View>
              <DKLabel style={styles.title}>{t('signup.title', 'Create your account')}</DKLabel>
              <Text style={styles.subtitle}>{t('signup.subtitle', 'Start your 14-day trial — no card required.')}</Text>
            </View>
          </FadeIn>

          <FadeIn delay={120}>
            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder={t('auth.emailPlaceholder', 'Email address')}
                placeholderTextColor={SemanticColors.textTertiary}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
              <TextInput
                style={styles.input}
                placeholder={t('signup.passwordPlaceholder', 'Password (min 8 characters)')}
                placeholderTextColor={SemanticColors.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password-new"
              />
              <TextInput
                style={styles.input}
                placeholder={t('signup.confirmPasswordPlaceholder', 'Confirm password')}
                placeholderTextColor={SemanticColors.textTertiary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoComplete="password-new"
              />

              <Pressable style={styles.termsRow} onPress={() => setAccepted((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: accepted }}>
                <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
                  {accepted && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <Text style={styles.termsText}>
                  {t('signup.acceptLine', 'I accept the')}{' '}
                  <Text style={styles.termsLink} onPress={() => Linking.openURL(process.env.EXPO_PUBLIC_TERMS_URL ?? 'https://vasco.app/terms')}>
                    {t('legal.termsOfService', 'Terms')}
                  </Text>{' '}{t('common.and', 'and')}{' '}
                  <Text style={styles.termsLink} onPress={() => Linking.openURL(process.env.EXPO_PUBLIC_PRIVACY_URL ?? 'https://vasco.app/privacy')}>
                    {t('legal.privacyPolicy', 'Privacy Policy')}
                  </Text>
                </Text>
              </Pressable>

              {error !== '' && (
                <View style={styles.errorCard}>
                  <Ionicons name="alert-circle" size={16} color={SemanticColors.feedbackError} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <GradientButton
                label={submitting ? t('signup.creating', 'Creating account…') : t('signup.create', 'Create account')}
                onPress={handleSignup}
                loading={submitting}
                disabled={submitting}
                icon="arrow-forward"
              />

              <Pressable onPress={() => router.replace('/login' as any)} style={styles.loginLink} accessibilityRole="button">
                <Text style={styles.loginLinkText}>
                  {t('signup.haveAccount', 'Already have an account?')} <Text style={styles.loginLinkAccent}>{t('auth.login', 'Log in')}</Text>
                </Text>
              </Pressable>
            </View>
          </FadeIn>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SemanticColors.surfaceBackground },
  scrollContent: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xl * 2 },
  header: { gap: Spacing.sm },
  backIconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center', justifyContent: 'center',
  },
  markWrap: {
    marginTop: Spacing.md, marginBottom: 6,
    shadowColor: DK.colors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
  mark: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 30, fontFamily: 'Archivo_900Black', color: SemanticColors.textPrimary, marginTop: 4, letterSpacing: -0.8 },
  subtitle: { fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textSecondary },
  form: { gap: Spacing.sm },
  input: {
    borderWidth: 1, borderColor: SemanticColors.borderDefault,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md, paddingHorizontal: Spacing.md, paddingVertical: 14,
    fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textPrimary,
    minHeight: 50,
  },
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: GRID.sm, paddingVertical: GRID.xs },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: SemanticColors.borderDefault,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  checkboxChecked: { backgroundColor: Palette.hermesOrange, borderColor: Palette.hermesOrange },
  termsText: { flex: 1, fontSize: TYPE.captionSize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textSecondary, lineHeight: 18 },
  termsLink: { color: Palette.hermesOrange, fontFamily: TYPE.titleFamily },
  errorCard: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.xs,
    backgroundColor: SemanticColors.feedbackError + '12',
    borderRadius: RADIUS.md, padding: Spacing.sm,
  },
  errorText: { flex: 1, fontSize: TYPE.captionSize, fontFamily: TYPE.bodyFamily, color: SemanticColors.feedbackError },
  loginLink: { alignSelf: 'center', paddingVertical: Spacing.sm },
  loginLinkText: { fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textSecondary },
  loginLinkAccent: { fontFamily: TYPE.titleFamily, color: Palette.hermesOrange },
  pendingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.md },
  pendingTitle: { fontSize: TYPE.displaySize, fontFamily: TYPE.displayFamily, color: SemanticColors.textPrimary, marginTop: Spacing.md },
  pendingDesc: { fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textSecondary, textAlign: 'center', lineHeight: 22 },
  backBtn: {
    marginTop: Spacing.lg, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderRadius: RADIUS.md, backgroundColor: SemanticColors.surfaceSecondary,
  },
  backBtnText: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  // silence unused warnings for activity-indicator import that may be needed for other states
  _ai: { display: ActivityIndicator ? 'flex' : 'flex' } as any,
});

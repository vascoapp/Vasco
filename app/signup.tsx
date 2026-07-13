// =============================================================================
// SIGNUP — email + password → Supabase auth → onboarding
// =============================================================================
// First-run real-user account creation. In DEMO_MODE we push the user toward
// the demo accounts instead since Supabase isn't configured. On success we
// route to /onboarding for the 14-step Cal-AI-style setup.
// =============================================================================

import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Linking, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
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
import {
  applyPendingReferral,
  getPendingReferral,
  stashPendingReferral,
} from '../src/services/referralAttributionService';

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
  // R188: when Supabase rejects with "User already registered" we surface a
  // prominent action card with a "Sign in instead" CTA instead of burying
  // the message in the small error toast. Pre-launch we hit this ourselves
  // every time we re-signed-up with the same email and concluded "emails
  // stopped firing" — real prospects will do the same on day one.
  const [emailExists, setEmailExists] = useState(false);
  // R230: referral code (from ?ref=CODE deep-link or AsyncStorage).
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const searchParams = useLocalSearchParams<{ ref?: string | string[] }>();

  useEffect(() => {
    const raw = Array.isArray(searchParams.ref) ? searchParams.ref[0] : searchParams.ref;
    (async () => {
      // Prefer a fresh code from the URL; fall back to any previously-stashed
      // one so the code survives the email-confirm round trip.
      const fromUrl = raw ? await stashPendingReferral(raw) : null;
      const code = fromUrl ?? (await getPendingReferral());
      if (code) setReferralCode(code);
    })();
  }, [searchParams.ref]);

  const handleSignup = async () => {
    setError('');
    setEmailExists(false);
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
      const userId = (result as any).userId as string | undefined;
      emitSignupCompleted(userId ?? trimmedEmail, {
        email: trimmedEmail,
        method: 'email',
      }).catch(() => {});
      // R230: attribute referral code if a userId is already available
      // (Supabase occasionally returns one pre-confirmation). Otherwise the
      // code stays in AsyncStorage and the first SIGNED_IN handler in
      // app/_layout.tsx calls applyPendingReferral after confirmation.
      if (userId) {
        applyPendingReferral(userId).catch(() => {});
      }
      // When email confirmation is DISABLED in Supabase, signUp returns a live
      // session — the user is already authenticated, so skip the "check your
      // email" dead-end and go straight into onboarding. (onAuthStateChange
      // also fires SIGNED_IN; router.replace avoids a pending-screen flash.)
      if ((result as { session?: boolean }).session) {
        router.replace('/onboarding' as any);
        return;
      }
      // Otherwise email confirmation is required: show the "check your email"
      // state — _layout.tsx auto-redirects on SIGNED_IN once the user confirms.
      setPending(true);
      return;
    }
    const msg = (result.error ?? '').toLowerCase();
    if (/already registered|already exists|user_already/i.test(msg)) {
      // Don't set `error` — the dedicated `emailExists` card replaces it.
      setEmailExists(true);
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
                {/* R92: official VascoBuild logo. R105 — no circular crop;
                    icon.png artwork extends to its corners and was being
                    chopped by borderRadius. */}
                <Image
                  source={require('../assets/icon.png')}
                  style={styles.mark}
                  resizeMode="contain"
                  accessibilityLabel="VascoBuild"
                />
              </View>
              <DKLabel style={styles.title}>{t('signup.title', 'Create your account')}</DKLabel>
              <Text style={styles.subtitle}>{t('signup.subtitle', 'Start your 14-day trial — no card required.')}</Text>
              {/* R230: referral-code chip when ?ref=CODE was provided */}
              {referralCode && (
                <View style={styles.refChip}>
                  <Ionicons name="gift-outline" size={14} color={Palette.hermesOrange} />
                  <Text style={styles.refChipText}>
                    {t('signup.referredBy', { defaultValue: 'Referred · code {{code}}', code: referralCode })}
                  </Text>
                </View>
              )}
            </View>
          </FadeIn>

          <FadeIn delay={120}>
            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder={t('auth.emailPlaceholder', 'Email address')}
                placeholderTextColor={SemanticColors.textTertiary}
                value={email}
                onChangeText={(v) => { setEmail(v); if (emailExists) setEmailExists(false); }}
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
                  <Text style={styles.termsLink} onPress={() => Linking.openURL(process.env.EXPO_PUBLIC_TERMS_URL ?? 'https://vascobuild.com/terms')}>
                    {t('legal.termsOfService', 'Terms')}
                  </Text>{' '}{t('common.and', 'and')}{' '}
                  <Text style={styles.termsLink} onPress={() => Linking.openURL(process.env.EXPO_PUBLIC_PRIVACY_URL ?? 'https://vascobuild.com/privacy')}>
                    {t('legal.privacyPolicy', 'Privacy Policy')}
                  </Text>
                </Text>
              </Pressable>

              {emailExists ? (
                <View style={styles.existsCard}>
                  <Ionicons name="information-circle" size={20} color={Palette.hermesOrange} />
                  <View style={styles.existsTextWrap}>
                    <Text style={styles.existsTitle}>{t('signup.emailExistsTitle', 'You already have an account')}</Text>
                    <Text style={styles.existsBody}>
                      {t('signup.emailExistsBody', '{{email}} is already registered. Sign in instead, or reset your password if you forgot it.', { email: email.trim().toLowerCase() })}
                    </Text>
                    <View style={styles.existsCtaRow}>
                      <Pressable
                        onPress={() => router.replace(`/login?email=${encodeURIComponent(email.trim().toLowerCase())}` as any)}
                        style={styles.existsCtaPrimary}
                        accessibilityRole="button"
                      >
                        <Text style={styles.existsCtaPrimaryText}>{t('signup.signInInstead', 'Sign in')}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => router.push(`/forgot-password?email=${encodeURIComponent(email.trim().toLowerCase())}` as any)}
                        style={styles.existsCtaSecondary}
                        accessibilityRole="button"
                      >
                        <Text style={styles.existsCtaSecondaryText}>{t('signup.resetPasswordCta', 'Reset password')}</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ) : error !== '' ? (
                <View style={styles.errorCard}>
                  <Ionicons name="alert-circle" size={16} color={SemanticColors.feedbackError} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <GradientButton
                label={submitting ? t('signup.creating', 'Creating account…') : t('signup.create', 'Create account')}
                onPress={handleSignup}
                loading={submitting}
                disabled={submitting || emailExists}
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
    width: 56, height: 56,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 30, fontFamily: 'Archivo_900Black', color: SemanticColors.textPrimary, marginTop: 4, letterSpacing: -0.8 },
  subtitle: { fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textSecondary },
  refChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: GRID.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: GRID.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.md,
    backgroundColor: Palette.hermesOrange + '18',
    borderWidth: 1,
    borderColor: Palette.hermesOrange + '40',
  },
  refChipText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: Palette.hermesOrange,
  },
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
  // R188 — "account already exists" action card. Amber-tinted (not red), so
  // it reads as "here's where to go" rather than "you broke something".
  existsCard: {
    flexDirection: 'row', gap: GRID.sm,
    backgroundColor: Palette.hermesOrange + '14',
    borderWidth: 1, borderColor: Palette.hermesOrange + '40',
    borderRadius: RADIUS.md, padding: Spacing.md,
  },
  existsTextWrap: { flex: 1, gap: 4 },
  existsTitle: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  existsBody: { fontSize: TYPE.captionSize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textSecondary, lineHeight: 18 },
  existsCtaRow: { flexDirection: 'row', gap: GRID.sm, marginTop: GRID.sm, flexWrap: 'wrap' },
  existsCtaPrimary: {
    backgroundColor: Palette.hermesOrange,
    borderRadius: RADIUS.md, paddingHorizontal: Spacing.md, paddingVertical: GRID.sm,
  },
  existsCtaPrimaryText: { fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: Palette.white },
  existsCtaSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1, borderColor: Palette.hermesOrange + '60',
    borderRadius: RADIUS.md, paddingHorizontal: Spacing.md, paddingVertical: GRID.sm,
  },
  existsCtaSecondaryText: { fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: Palette.hermesOrange },
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

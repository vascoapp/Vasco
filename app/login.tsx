import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth, ROLE_CONFIGS, type UserRole } from '../src/context/AuthContext';
import { DEMO_MODE, DEMO_ACCOUNTS } from '../src/config/demo';
import { SemanticColors, Palette } from '../src/theme/colors';
import { SafeArea, Spacing } from '../src/theme/spacing';
import { FadeIn } from '../src/components/shared/FadeIn';
import { GradientButton } from '../src/components/shared/GradientButton';

const ENTERPRISE_ROLES: UserRole[] = ['cfo', 'coo', 'site-lead', 'director'];

const getRouteForEmail = (email: string) => {
  const normalizedEmail = email.toLowerCase().trim();
  const account = DEMO_ACCOUNTS.find((demo) => demo.email === normalizedEmail);
  const role = account?.role;
  return role && ENTERPRISE_ROLES.includes(role) ? '/(tabs)' : '/(contractor)';
};

export default function LoginScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState(0);
  const { login, isLoading } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (Date.now() < lockoutUntil) return;
    setError('');
    if (!email.trim()) {
      setError(t('common.required', 'Vul je e-mailadres in'));
      return;
    }
    const result = await login(email, password);
    if (result.ok) {
      setFailedAttempts(0);
      router.replace(getRouteForEmail(email));
      return;
    }
    // Reason-specific messaging — network outages shouldn't look like "wrong password".
    if (result.reason === 'network') {
      setError(t('auth.networkError', 'Cannot reach server. Check your internet and try again.'));
      return;
    }
    if (result.reason === 'locked') {
      setError(t('auth.accountLocked', 'Account temporarily locked. Try again in a few minutes.'));
      return;
    }
    if (result.reason === 'demo_disabled') {
      setError(t('auth.demoDisabled', 'Demo accounts are disabled in production.'));
      return;
    }
    // 'invalid' or 'unknown' — count toward client-side lockout
    const attempts = failedAttempts + 1;
    setFailedAttempts(attempts);
    if (attempts >= 5) {
      setLockoutUntil(Date.now() + 30000);
      setError(t('auth.tooManyAttempts', 'Too many attempts. Try again in 30 seconds.'));
      setTimeout(() => { setLockoutUntil(0); setFailedAttempts(0); }, 30000);
      return;
    }
    setError(t('auth.invalidCredentials', 'Invalid email or password.'));
  };

  const handleDemoLogin = async (demoEmail: string) => {
    setEmail(demoEmail);
    const result = await login(demoEmail, 'demo');
    if (result.ok) {
      router.replace(getRouteForEmail(demoEmail));
    } else if (result.reason === 'demo_disabled') {
      setError(t('auth.demoDisabled', 'Demo accounts are disabled in production.'));
    } else if (result.reason === 'network') {
      setError(t('auth.networkError', 'Cannot reach server. Check your internet and try again.'));
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero */}
          <FadeIn delay={0} duration={600}>
            <View style={styles.hero}>
              {/* Little explorer guy */}
              <View style={styles.guyWrapper}>
                {/* Hat */}
                <View style={styles.guyHatBrim} />
                <View style={styles.guyHatTop} />
                {/* Head */}
                <View style={styles.guyHead}>
                  <View style={styles.guyEyeL} />
                  <View style={styles.guyEyeR} />
                  <View style={styles.guySmile} />
                </View>
                {/* Body */}
                <View style={styles.guyBody}>
                  {/* Spyglass in hand */}
                  <View style={styles.guySpyglass} />
                  <View style={styles.guySpyglassLens} />
                </View>
                {/* Legs */}
                <View style={styles.guyLegs}>
                  <View style={styles.guyLegL} />
                  <View style={styles.guyLegR} />
                </View>
                {/* Shadow */}
                <View style={styles.guyShadow} />
              </View>
              <Text style={styles.brand}>Vasco</Text>
              <Text style={styles.tagline}>{t('auth.tagline', 'Built for the trades')}</Text>
            </View>
          </FadeIn>

          {/* Login Form */}
          <FadeIn delay={200} duration={500}>
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
                placeholder={t('auth.passwordPlaceholder', 'Password')}
                placeholderTextColor={SemanticColors.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
              />

              {error !== '' && (
                <View style={styles.errorCard}>
                  <Ionicons name="alert-circle" size={16} color={SemanticColors.feedbackError} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <GradientButton
                label={t('auth.login', 'Inloggen')}
                onPress={handleLogin}
                loading={isLoading}
                disabled={isLoading || Date.now() < lockoutUntil}
                icon="arrow-forward"
              />

              <View style={styles.authLinksRow}>
                <Pressable
                  style={styles.forgotBtn}
                  onPress={() => router.push('/forgot-password' as any)}
                >
                  <Text style={styles.forgotBtnText}>{t('auth.forgotPassword', 'Forgot password?')}</Text>
                </Pressable>
                {!DEMO_MODE && (
                  <Pressable
                    style={styles.forgotBtn}
                    onPress={() => router.push('/signup' as any)}
                  >
                    <Text style={styles.forgotBtnText}>{t('auth.createAccount', 'Create account')}</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </FadeIn>

          {/* Demo Accounts */}
          {DEMO_MODE && (
            <FadeIn delay={400} duration={500}>
              <View style={styles.demoSection}>
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>Demo</Text>
                  <View style={styles.dividerLine} />
                </View>

                <View style={styles.demoGrid}>
                  {DEMO_ACCOUNTS.map((account, i) => {
                    const config = ROLE_CONFIGS[account.role];
                    return (
                      <FadeIn key={account.email} delay={500 + i * 80} duration={400}>
                        <Pressable
                          style={({ pressed }) => [styles.demoCard, pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }]}
                          onPress={() => handleDemoLogin(account.email)}
                        >
                          <View style={[styles.demoIcon, { backgroundColor: config.primaryColor + '15' }]}>
                            <Ionicons name={account.icon as keyof typeof Ionicons.glyphMap} size={18} color={config.primaryColor} />
                          </View>
                          <View style={styles.demoInfo}>
                            <Text style={styles.demoName}>{account.name}</Text>
                            <Text style={styles.demoRole}>{config.label}</Text>
                          </View>
                          <View style={[styles.demoArrow, { backgroundColor: config.primaryColor + '10' }]}>
                            <Ionicons name="arrow-forward" size={14} color={config.primaryColor} />
                          </View>
                        </Pressable>
                      </FadeIn>
                    );
                  })}
                </View>

                {/* Onboarding demo — test the full onboarding flow */}
                <Pressable
                  style={({ pressed }) => [styles.onboardingBtn, pressed && { opacity: 0.85 }]}
                  onPress={async () => {
                    // Clear onboarding flag + AsyncStorage data to force fresh start
                    await AsyncStorage.removeItem('@vasco_onboarding').catch(() => {});
                    await AsyncStorage.removeItem('@vasco_jobs').catch(() => {});
                    await AsyncStorage.removeItem('@vasco_invoices').catch(() => {});
                    await AsyncStorage.removeItem('@vasco_quotes').catch(() => {});
                    await AsyncStorage.removeItem('@vasco_customers').catch(() => {});
                    await AsyncStorage.removeItem('@vasco_projects').catch(() => {});
                    router.push('/onboarding' as any);
                  }}
                >
                  <Ionicons name="rocket-outline" size={18} color={Palette.hermesOrange} />
                  <Text style={styles.onboardingBtnText}>{t('auth.testOnboarding', 'Test onboarding')}</Text>
                </Pressable>

                {/* Reset demo data */}
                <Pressable
                  style={({ pressed }) => [styles.resetBtn, pressed && { opacity: 0.85 }]}
                  onPress={() => {
                    Alert.alert(
                      t('auth.resetDemoData', 'Reset demo data'),
                      t('auth.resetConfirm', 'This will clear all local data. You will need to log in again for fresh demo data.'),
                      [
                        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
                        {
                          text: t('auth.reset', 'Reset'),
                          style: 'destructive',
                          onPress: async () => {
                            const keys = await AsyncStorage.getAllKeys();
                            const vascoKeys = keys.filter((k: string) => k.startsWith('@vasco_'));
                            if (vascoKeys.length > 0) await AsyncStorage.multiRemove(vascoKeys);
                            Alert.alert(t('auth.dataReset', '{{count}} items cleared. Log in again for fresh data.', { count: vascoKeys.length }));
                          },
                        },
                      ],
                    );
                  }}
                >
                  <Ionicons name="refresh-outline" size={16} color={SemanticColors.textTertiary} />
                  <Text style={styles.resetBtnText}>{t('auth.resetDemoData', 'Reset demo data')}</Text>
                </Pressable>
              </View>
            </FadeIn>
          )}

          <View style={{ height: 24 }} />

          <View style={styles.legalFooter}>
            <Text style={styles.legalFooterText}>
              {t('auth.legalNotice', 'By continuing you agree to our')}{' '}
              <Text
                style={styles.legalLink}
                onPress={() => Linking.openURL(process.env.EXPO_PUBLIC_TERMS_URL ?? 'https://vasco.app/terms')}
              >
                {t('legal.termsOfService', 'Terms')}
              </Text>
              {' '}&{' '}
              <Text
                style={styles.legalLink}
                onPress={() => Linking.openURL(process.env.EXPO_PUBLIC_PRIVACY_URL ?? 'https://vasco.app/privacy')}
              >
                {t('legal.privacyPolicy', 'Privacy Policy')}
              </Text>
              .
            </Text>
          </View>

          <View style={{ height: 16 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  legalFooter: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  legalFooterText: {
    fontSize: 12,
    lineHeight: 18,
    color: SemanticColors.textTertiary,
    textAlign: 'center',
  },
  legalLink: {
    color: Palette.hermesOrange,
    textDecorationLine: 'underline',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SafeArea.side + 4,
    justifyContent: 'center',
  },

  // Hero
  hero: {
    alignItems: 'center',
    marginBottom: 40,
  },
  guyWrapper: {
    alignItems: 'center',
    marginBottom: 16,
    height: 90,
  },
  guyHatTop: {
    width: 24,
    height: 14,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: Palette.hermesOrange,
    marginTop: -2,
  },
  guyHatBrim: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: Palette.hermesOrange,
    zIndex: 1,
  },
  guyHead: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F5CBA7',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  guyEyeL: {
    position: 'absolute',
    top: 10,
    left: 7,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: SemanticColors.textPrimary,
  },
  guyEyeR: {
    position: 'absolute',
    top: 10,
    right: 7,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: SemanticColors.textPrimary,
  },
  guySmile: {
    position: 'absolute',
    bottom: 6,
    width: 8,
    height: 4,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: Palette.hermesOrange + '60',
  },
  guyBody: {
    width: 22,
    height: 18,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    backgroundColor: Palette.hermesOrange,
    alignItems: 'flex-end',
    paddingRight: 2,
    paddingTop: 2,
    position: 'relative',
  },
  guySpyglass: {
    position: 'absolute',
    top: 2,
    right: -12,
    width: 16,
    height: 4,
    borderRadius: 2,
    backgroundColor: Palette.hermesOrange,
    transform: [{ rotate: '-20deg' }],
  },
  guySpyglassLens: {
    position: 'absolute',
    top: -1,
    right: -16,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Palette.hermesOrange,
    backgroundColor: '#87CEEB40',
    transform: [{ rotate: '-20deg' }],
  },
  guyLegs: {
    flexDirection: 'row',
    gap: 4,
  },
  guyLegL: {
    width: 8,
    height: 14,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: SemanticColors.textPrimary,
  },
  guyLegR: {
    width: 8,
    height: 14,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: SemanticColors.textPrimary,
  },
  guyShadow: {
    width: 30,
    height: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginTop: 2,
  },
  brand: {
    fontSize: 36,
    fontFamily: 'Manrope_800ExtraBold',
    color: SemanticColors.textPrimary,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 15,
    fontFamily: 'Manrope_500Medium',
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },

  // Form
  form: {
    gap: 12,
    marginBottom: 28,
  },
  input: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 15,
    fontFamily: 'Manrope_500Medium',
    color: SemanticColors.textPrimary,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: SemanticColors.feedbackErrorBg,
    borderRadius: 10,
    padding: 12,
  },
  errorText: {
    color: SemanticColors.feedbackError,
    fontSize: 13,
    fontFamily: 'Manrope_500Medium',
    flex: 1,
  },
  authLinksRow: { flexDirection: 'row', justifyContent: 'center', gap: 24 },
  forgotBtn: { alignSelf: 'center', paddingVertical: 8 },
  forgotBtnText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Palette.hermesOrange },
  // Demo
  demoSection: {
    gap: 16,
  },
  onboardingBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: Palette.hermesOrange, borderRadius: 12,
    paddingVertical: 12, marginTop: 4,
  },
  onboardingBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: Palette.hermesOrange },
  resetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10,
  },
  resetBtnText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: SemanticColors.textTertiary },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: SemanticColors.borderDefault,
  },
  dividerText: {
    fontSize: 12,
    fontFamily: 'Manrope_600SemiBold',
    color: SemanticColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  demoGrid: {
    gap: 8,
  },
  demoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  demoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoInfo: {
    flex: 1,
  },
  demoName: {
    fontSize: 15,
    fontFamily: 'Manrope_600SemiBold',
    color: SemanticColors.textPrimary,
  },
  demoRole: {
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
    color: SemanticColors.textSecondary,
  },
  demoArrow: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

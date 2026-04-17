// =============================================================================
// RESET PASSWORD — landing after tapping a Supabase recovery email link
// =============================================================================
// auth/callback.tsx picks up the recovery tokens, sets the session, then
// routes here. The user already has an active session — we just take a new
// password and call supabase.auth.updateUser.
// =============================================================================

import { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { supabase, isSupabaseConfigured } from '../src/lib/supabase';
import { SemanticColors, Palette } from '../src/theme/colors';
import { Spacing } from '../src/theme/spacing';
import { TYPE, RADIUS } from '../src/theme/tabStyles';
import { FadeIn } from '../src/components/shared/FadeIn';
import { GradientButton } from '../src/components/shared/GradientButton';

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (password.length < 8) {
      setError(t('signup.passwordShort', 'Password must be at least 8 characters.'));
      return;
    }
    if (password !== confirm) {
      setError(t('signup.passwordMismatch', "Passwords don't match."));
      return;
    }
    if (!isSupabaseConfigured) {
      setError(t('auth.networkError', 'Cannot reach server. Check your internet and try again.'));
      return;
    }
    setSubmitting(true);
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateErr) {
      const msg = (updateErr.message || '').toLowerCase();
      if (/fetch|network|timeout/.test(msg)) {
        setError(t('auth.networkError', 'Cannot reach server. Check your internet and try again.'));
      } else {
        setError(updateErr.message || t('resetPassword.failed', 'Could not update password.'));
      }
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.doneWrap}>
          <Ionicons name="checkmark-circle" size={56} color={SemanticColors.feedbackSuccess} />
          <Text style={styles.doneTitle}>{t('resetPassword.done', 'Password updated')}</Text>
          <Text style={styles.doneDesc}>{t('resetPassword.doneDesc', 'You can now sign in with your new password.')}</Text>
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
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <FadeIn delay={0}>
            <Text style={styles.title}>{t('resetPassword.title', 'Set a new password')}</Text>
            <Text style={styles.subtitle}>{t('resetPassword.subtitle', 'Choose a password with at least 8 characters.')}</Text>
          </FadeIn>

          <FadeIn delay={120}>
            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder={t('signup.passwordPlaceholder', 'Password (min 8 characters)')}
                placeholderTextColor={SemanticColors.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password-new"
                autoFocus
              />
              <TextInput
                style={styles.input}
                placeholder={t('signup.confirmPasswordPlaceholder', 'Confirm password')}
                placeholderTextColor={SemanticColors.textTertiary}
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
                autoComplete="password-new"
              />

              {error !== '' && (
                <View style={styles.errorCard}>
                  <Ionicons name="alert-circle" size={16} color={SemanticColors.feedbackError} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <GradientButton
                label={submitting ? t('resetPassword.saving', 'Saving…') : t('resetPassword.save', 'Save new password')}
                onPress={handleSubmit}
                loading={submitting}
                disabled={submitting}
                icon="arrow-forward"
              />
            </View>
          </FadeIn>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SemanticColors.surfaceBackground },
  scrollContent: { padding: Spacing.lg, gap: Spacing.lg, paddingTop: Spacing.xl * 2 },
  title: { fontSize: TYPE.displaySize, fontFamily: TYPE.displayFamily, color: SemanticColors.textPrimary },
  subtitle: { fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textSecondary, marginTop: Spacing.sm },
  form: { gap: Spacing.sm, marginTop: Spacing.lg },
  input: {
    borderWidth: 1, borderColor: SemanticColors.borderDefault,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md, paddingHorizontal: Spacing.md, paddingVertical: 14,
    fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textPrimary,
    minHeight: 50,
  },
  errorCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: SemanticColors.feedbackError + '12',
    borderRadius: RADIUS.md, padding: Spacing.sm,
  },
  errorText: { flex: 1, fontSize: TYPE.captionSize, fontFamily: TYPE.bodyFamily, color: SemanticColors.feedbackError },
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.md },
  doneTitle: { fontSize: TYPE.displaySize, fontFamily: TYPE.displayFamily, color: SemanticColors.textPrimary, marginTop: Spacing.md },
  doneDesc: { fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textSecondary, textAlign: 'center', lineHeight: 22 },
  backBtn: {
    marginTop: Spacing.lg, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderRadius: RADIUS.md, backgroundColor: Palette.hermesOrange,
  },
  backBtnText: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: '#fff' },
});

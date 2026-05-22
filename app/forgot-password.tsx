import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  View,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase, isSupabaseConfigured } from '../src/lib/supabase';
import { SemanticColors, Palette } from '../src/theme/colors';
import { SafeArea } from '../src/theme/spacing';
import { DK } from '../src/theme/draftkings';
import { GradientButton } from '../src/components/shared/GradientButton';
import { DKLabel } from '../src/components/shared/DKLabel';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) return;

    if (!isSupabaseConfigured) {
      Alert.alert(
        t('auth.demoModeTitle', 'Demo mode'),
        t('auth.demoModeResetMsg', 'Password reset is not available in demo mode. Use any password to log in.'),
      );
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'vasco://auth/reset-callback',
    });
    setLoading(false);

    if (error) {
      Alert.alert(t('common.error', 'Error'), error.message);
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Ionicons name="mail-outline" size={32} color={Palette.hermesOrange} />
          </View>
          <Text style={styles.title}>{t('auth.checkEmail', 'Check your email')}</Text>
          <Text style={styles.subtitle}>
            {t('auth.resetEmailSent', 'We sent a password reset link to {{email}}', { email })}
          </Text>
          <Pressable
            style={styles.backBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('auth.backToLogin', 'Back to login')}
          >
            <Text style={styles.backBtnText}>{t('auth.backToLogin', 'Back to login')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel={t('common.back', 'Back')}
          >
            <Ionicons name="chevron-back" size={22} color={SemanticColors.textPrimary} />
          </Pressable>
        </View>

        <View style={styles.content}>
          <View style={styles.markWrap}>
            {/* R92: official VascoBuild logo */}
            <Image
              source={require('../assets/icon.png')}
              style={styles.mark}
              accessibilityLabel="VascoBuild"
            />
          </View>
          <DKLabel style={styles.title}>{t('auth.resetPassword', 'Reset password')}</DKLabel>
          <Text style={styles.subtitle}>
            {t('auth.resetInstructions', 'Enter your email and we\'ll send you a reset link')}
          </Text>

          <TextInput
            style={styles.input}
            placeholder={t('auth.emailPlaceholder', 'Email address')}
            placeholderTextColor={SemanticColors.textTertiary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            autoFocus
          />

          <GradientButton
            label={t('auth.sendResetLink', 'Send reset link')}
            onPress={handleReset}
            loading={loading}
            disabled={loading || !email.trim()}
            icon="mail-outline"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  header: {
    paddingHorizontal: SafeArea.side,
    paddingTop: 8,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: SafeArea.side + 4,
    justifyContent: 'center',
    gap: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Palette.hermesOrange + '15',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 8,
  },
  markWrap: {
    alignSelf: 'center',
    marginBottom: 8,
    shadowColor: DK.colors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
  mark: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontFamily: 'Archivo_900Black',
    color: SemanticColors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: SemanticColors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  input: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: SemanticColors.textPrimary,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  backBtn: {
    alignSelf: 'center',
    paddingVertical: 12,
  },
  backBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: Palette.hermesOrange,
  },
});

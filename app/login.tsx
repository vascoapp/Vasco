import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth, ROLE_CONFIGS, type UserRole } from '../src/context/AuthContext';
import { Colors } from '../src/theme/colors';
import { Radius } from '../src/theme/radius';
import { Spacing } from '../src/theme/spacing';
import { Typography } from '../src/theme/typography';

const DEMO_ACCOUNTS: { email: string; role: UserRole; name: string }[] = [
  { email: 'contractor@vasco.dev', role: 'contractor', name: 'Jan van der Berg' },
  { email: 'cfo@vasco.dev', role: 'cfo', name: 'Sarah Chen' },
  { email: 'coo@vasco.dev', role: 'coo', name: 'James Morrison' },
  { email: 'site@vasco.dev', role: 'site-lead', name: 'Mike Thompson' },
  { email: 'director@vasco.dev', role: 'director', name: 'Alexandra Wright' },
];

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, isLoading } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    setError('');

    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }

    const success = await login(email, password);

    if (success) {
      router.replace('/(tabs)');
    } else {
      setError('Invalid credentials. Try one of the demo accounts below.');
    }
  };

  const handleDemoLogin = async (demoEmail: string) => {
    setEmail(demoEmail);
    const success = await login(demoEmail, 'demo');
    if (success) {
      router.replace('/(tabs)');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo / Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>V</Text>
            </View>
            <Text style={styles.title}>Vasco</Text>
            <Text style={styles.subtitle}>BuildOS Platform</Text>
          </View>

          {/* Login Form */}
          <View style={styles.form}>
            <Text style={styles.formTitle}>Sign in to your account</Text>

            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor={Colors.muted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={Colors.muted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />

            {error !== '' && (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#0B0C0F" />
              ) : (
                <Text style={styles.loginButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Demo Accounts */}
          <View style={styles.demoSection}>
            <Text style={styles.demoTitle}>Demo Accounts</Text>
            <Text style={styles.demoSubtitle}>
              Tap to sign in with a role-specific demo account
            </Text>

            <View style={styles.demoGrid}>
              {DEMO_ACCOUNTS.map((account) => {
                const config = ROLE_CONFIGS[account.role];
                return (
                  <TouchableOpacity
                    key={account.email}
                    style={[styles.demoCard, { borderColor: config.primaryColor + '50' }]}
                    onPress={() => handleDemoLogin(account.email)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[styles.demoBadge, { backgroundColor: config.primaryColor + '20' }]}
                    >
                      <Text style={[styles.demoBadgeText, { color: config.primaryColor }]}>
                        {config.label}
                      </Text>
                    </View>
                    <Text style={styles.demoName}>{account.name}</Text>
                    <Text style={styles.demoEmail}>{account.email}</Text>
                    <Text style={styles.demoDesc}>{config.description}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: Radius.xl,
    backgroundColor: Colors.accentDeep,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  logoText: {
    color: '#0B0C0F',
    fontSize: 40,
    fontWeight: '700',
  },
  title: {
    color: Colors.text,
    fontSize: 32,
    fontWeight: '700',
  },
  subtitle: {
    color: Colors.muted,
    fontSize: 16,
    marginTop: 4,
  },
  form: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  formTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    padding: Spacing.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: 16,
  },
  errorCard: {
    backgroundColor: Colors.danger + '20',
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
    textAlign: 'center',
  },
  loginButton: {
    backgroundColor: Colors.accentDeep,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: Spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#0B0C0F',
    fontSize: 16,
    fontWeight: '700',
  },
  demoSection: {
    gap: Spacing.md,
  },
  demoTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  demoSubtitle: {
    color: Colors.muted,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  demoGrid: {
    gap: Spacing.sm,
  },
  demoCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    gap: 4,
    minHeight: 44,
  },
  demoBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    marginBottom: 4,
  },
  demoBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  demoName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  demoEmail: {
    color: Colors.accentMuted,
    fontSize: 12,
  },
  demoDesc: {
    color: Colors.muted,
    fontSize: 11,
    marginTop: 4,
  },
});

// =============================================================================
// CUSTOMER PORTAL - Landing Page
// =============================================================================
// Entry point for customers to access their decision portal.
// Customers enter an access code shared by their contractor to view
// and submit project decisions.
// =============================================================================

import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../../src/theme/colors';

export default function CustomerLandingScreen() {
  const router = useRouter();
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    const trimmed = accessCode.trim().toUpperCase();
    if (trimmed.length < 4) {
      setError('Voer een geldige toegangscode in.');
      return;
    }
    setError('');
    router.push(`/customer/${trimmed}` as any);
  };

  const handleDemo = () => {
    router.push('/customer/VDB24A' as any);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Back button for contractor preview */}
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#666" />
        </Pressable>

        {/* Logo area */}
        <View style={styles.logoArea}>
          <View style={styles.logoCircle}>
            <Ionicons name="construct" size={32} color="#fff" />
          </View>
          <Text style={styles.brandName}>Vasco</Text>
          <Text style={styles.brandSub}>Klantportaal</Text>
        </View>

        {/* Welcome */}
        <View style={styles.welcomeArea}>
          <Text style={styles.welcomeTitle}>Welkom</Text>
          <Text style={styles.welcomeText}>
            Uw aannemer heeft keuzes voor u klaargezet.{'\n'}
            Voer de toegangscode in die u heeft ontvangen.
          </Text>
        </View>

        {/* Access code input */}
        <View style={styles.inputArea}>
          <Text style={styles.inputLabel}>Toegangscode</Text>
          <TextInput
            style={[styles.codeInput, error ? styles.codeInputError : null]}
            value={accessCode}
            onChangeText={(text) => {
              setAccessCode(text.toUpperCase());
              if (error) setError('');
            }}
            placeholder="bijv. ABC123"
            placeholderTextColor="#999"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        {/* Submit button */}
        <Pressable
          style={[styles.submitBtn, !accessCode.trim() && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!accessCode.trim()}
        >
          <Text style={styles.submitBtnText}>Bekijk mijn keuzes</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </Pressable>

        {/* Demo button */}
        <Pressable style={styles.demoBtn} onPress={handleDemo}>
          <Ionicons name="play-circle" size={20} color={Palette.hermesOrange} />
          <Text style={styles.demoBtnText}>Demo modus</Text>
        </Pressable>

        {/* Info footer */}
        <View style={styles.footer}>
          <Ionicons name="lock-closed" size={14} color="#999" />
          <Text style={styles.footerText}>
            Geen account nodig. Uw keuzes worden veilig opgeslagen en direct doorgegeven aan uw aannemer.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },

  // Logo
  logoArea: {
    alignItems: 'center',
    marginTop: 24,
    gap: 8,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Palette.hermesOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  brandSub: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },

  // Welcome
  welcomeArea: {
    marginTop: 32,
    gap: 8,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  welcomeText: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
  },

  // Input
  inputArea: {
    marginTop: 28,
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#444',
  },
  codeInput: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: 4,
    textAlign: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E5E5E5',
  },
  codeInputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
    marginTop: 4,
  },

  // Submit
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Palette.hermesOrange,
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 20,
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },

  // Demo
  demoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: Palette.hermesOrange,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 12,
  },
  demoBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Palette.hermesOrange,
  },

  // Footer
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
    fontSize: 12,
    color: '#999',
    lineHeight: 18,
  },
});
